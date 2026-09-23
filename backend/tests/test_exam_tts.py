"""
聴解 audio: where clips are written, and what happens when one is gone.

The bug this suite is built around: EXAM_AUDIO_DIR named a
persistent-disk path (/data/exam_audio) that was not actually mounted on
the instance. Three separate failures fell out of that one setting, and
there is a test here for each --

  - os.makedirs recursed to mkdir("/data") and raised PermissionError,
    which is not TTSFailed, so it escaped every generator's error
    handling and killed the whole listening paper;
  - StaticFiles re-stats its directory on the first request, so every
    clip URL answered 500 rather than 404 (check_dir=False silences only
    the constructor);
  - clips written before the misconfiguration were long gone, while the
    URLs naming them stayed in exam_papers forever.

Plus the invariant that started it all: the writer and the mount must
resolve the same directory, or files are written to one place and served
from another.
"""
import json
import math
import os
import uuid
from array import array
from unittest import mock

import pytest
from starlette.applications import Starlette
from starlette.routing import Mount
from starlette.testclient import TestClient

import study.exam_tts as tts
import study.voice_engine as engine
from core.db import db_conn
from main import ExamAudioFiles, app
from study.exam_audio_repair import restore_clip, turns_from_script

# Shaped like a real one (exam_listening_gen.py builds exactly this:
# narrator reads the scene and the question, A/B read the dialogue).
TURNS = [
    {"speaker": "narrator", "textJp": "おとこの　ひとと　おんなの　ひとが　はなして　います。"},
    {"speaker": "A", "textJp": "あした　なんじに　あいましょうか。"},
    {"speaker": "B", "textJp": "ごぜん　じゅうじは　どうですか。"},
    {"speaker": "narrator", "textJp": "ふたりは　なんじに　あいますか。"},
]


@pytest.fixture
def audio_dir(tmp_path):
    """Point the writer at a scratch directory, and hand back an app
    serving that same directory through the real mount class."""
    directory = str(tmp_path / "clips")
    os.makedirs(directory)
    with mock.patch.object(tts, "_resolve_audio_dir", lambda: directory):
        yield directory


@pytest.fixture
def clip_client(audio_dir):
    served = Starlette(routes=[
        Mount("/exam-audio", ExamAudioFiles(directory=audio_dir, check_dir=False)),
    ])
    return TestClient(served)


def tone(seconds: float = 0.5, rate: int = engine.DIALOGUE_RATE) -> engine.Pcm:
    """Something audible, standing in for a line the engine spoke."""
    samples = array("h", (int(8000 * math.sin(2 * math.pi * 440 * i / rate))
                          for i in range(round(seconds * rate))))
    return engine.Pcm(samples.tobytes(), rate)


@pytest.fixture
def fake_tts():
    """The engine is a network call; what it says is not what any of this
    is testing. The encoder is the real one: the file on disk has to be
    an MP3 the player can read."""
    with mock.patch.object(engine, "style_for_slot", lambda slot: 100 + slot), \
            mock.patch.object(engine, "say", mock.Mock(side_effect=lambda *a, **k: tone())) as say:
        yield say


def _script_jp(turns):
    """The scriptJp exam_listening_gen.py stores alongside audioSrc."""
    return "\n".join(f"{t['speaker']}: {t['textJp']}" for t in turns)


@pytest.fixture
def stored_paper():
    """A listening paper in exam_papers referencing one clip, as the
    generator would have left it."""
    exam_id = f"probe-listening-{uuid.uuid4()}"
    turns = [{**t, "textJp": f"{t['textJp']}{uuid.uuid4().hex[:6]}"} for t in TURNS]
    key = tts.content_key(turns)
    paper = {
        "level": "N5",
        "sections": [{"id": "listening", "mondai": [{"questions": [{
            "id": "q1",
            "audioSrc": f"/exam-audio/{key}.mp3",
            "scriptJp": _script_jp(turns),
        }]}]}],
    }
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO exam_papers
                    (exam_id, revision, level, seed, generator_version, paper,
                     section_count, question_count)
                VALUES (%s, 1, 'N5', 1, 'listening-gen-2', %s, 1, 1)
                """,
                (exam_id, json.dumps(paper)),
            )
        conn.commit()
    finally:
        conn.close()

    yield f"{key}.mp3", turns

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM exam_papers WHERE exam_id = %s", (exam_id,))
        conn.commit()
    finally:
        conn.close()


# ── Where clips are written ──────────────────────────────────────

def test_configured_directory_is_used_when_it_is_writable(tmp_path):
    configured = str(tmp_path / "disk" / "exam_audio")
    with mock.patch.dict(os.environ, {"EXAM_AUDIO_DIR": configured}):
        tts._resolve_audio_dir.cache_clear()
        try:
            assert tts.audio_dir() == configured
            assert os.path.isdir(configured)
        finally:
            tts._resolve_audio_dir.cache_clear()


def test_falls_back_when_the_configured_directory_cannot_be_created(tmp_path):
    # A regular file where the mount point should be: makedirs raises,
    # for any user, the same way it raised on the unmounted /data.
    blocker = tmp_path / "data"
    blocker.write_text("not a mount point")
    with mock.patch.dict(os.environ, {"EXAM_AUDIO_DIR": str(blocker / "exam_audio")}):
        tts._resolve_audio_dir.cache_clear()
        try:
            resolved = tts.audio_dir()
            assert resolved != str(blocker / "exam_audio")
            assert os.path.isdir(resolved) and os.access(resolved, os.W_OK)
        finally:
            tts._resolve_audio_dir.cache_clear()


def test_an_unwritable_directory_fails_as_TTSFailed(tmp_path, fake_tts):
    # Not PermissionError: the generators catch TTSFailed and skip the
    # item, and anything else takes the entire paper down with it.
    with mock.patch.object(tts, "_resolve_audio_dir", lambda: str(tmp_path / "gone" / "clips")), \
            mock.patch("os.makedirs", side_effect=PermissionError(13, "Permission denied")):
        with pytest.raises(tts.TTSFailed):
            tts.synthesize_dialogue(TURNS)


def test_the_mount_serves_the_directory_the_writer_writes_to():
    mount = next(r for r in app.routes if getattr(r, "name", None) == "exam-audio")
    assert mount.app.directory == tts.audio_dir()


# ── Serving a clip that is not there ─────────────────────────────

def test_a_missing_directory_is_404_not_500(tmp_path):
    """The production failure exactly: the mounted directory does not
    exist at all."""
    missing = str(tmp_path / "never-mounted" / "exam_audio")
    served = Starlette(routes=[
        Mount("/exam-audio", ExamAudioFiles(directory=missing, check_dir=False)),
    ])
    with mock.patch.object(tts, "_resolve_audio_dir", lambda: missing):
        response = TestClient(served).get(f"/exam-audio/{'a' * 24}.mp3")
    assert response.status_code == 404


def test_a_name_that_is_not_a_content_key_is_never_synthesized(clip_client, fake_tts):
    for name in ("hello.mp3", "not-hex-aaaaaaaaaaaaaaaa.mp3", f"{'a' * 24}.wav"):
        assert clip_client.get(f"/exam-audio/{name}").status_code == 404
    fake_tts.assert_not_called()


def test_a_clip_no_stored_paper_refers_to_is_never_synthesized(clip_client, fake_tts):
    assert clip_client.get(f"/exam-audio/{'b' * 24}.mp3").status_code == 404
    fake_tts.assert_not_called()


# ── Restoring a clip from the paper that references it ───────────

def test_script_round_trips_back_to_the_same_content_key():
    # What makes restoration possible at all: scriptJp is a lossless
    # rendering of the turns the clip was synthesized from.
    assert turns_from_script(_script_jp(TURNS)) == TURNS
    assert tts.content_key(turns_from_script(_script_jp(TURNS))) == tts.content_key(TURNS)


def test_a_script_in_another_shape_is_refused():
    assert turns_from_script("no speaker prefix here") is None
    assert turns_from_script("") is None


def test_a_missing_clip_is_restored_and_then_served(clip_client, fake_tts, stored_paper, audio_dir):
    filename, turns = stored_paper
    assert not os.path.exists(os.path.join(audio_dir, filename))

    response = clip_client.get(f"/exam-audio/{filename}")

    assert response.status_code == 200
    assert engine.mp3_summary(response.content)["frames"] > 0
    assert fake_tts.call_count == len(turns)
    assert os.path.exists(os.path.join(audio_dir, filename))


def test_a_restored_clip_is_synthesized_once(clip_client, fake_tts, stored_paper):
    filename, turns = stored_paper
    assert clip_client.get(f"/exam-audio/{filename}").status_code == 200
    assert clip_client.get(f"/exam-audio/{filename}").status_code == 200
    # Second request served the file on disk rather than paying again.
    assert fake_tts.call_count == len(turns)


def test_restore_reports_failure_rather_than_raising(stored_paper, audio_dir):
    filename, _turns = stored_paper
    with mock.patch.object(engine, "style_for_slot", side_effect=tts.TTSFailed("no voices")):
        assert restore_clip(filename) is False


# ── The name is an identity (plan 113) ───────────────────────────
# dictation_log stores clip ids and exam_papers stores the URLs, so the
# key formula outlives any engine. Computed with the formula as it stood
# before the engine changed; if one of these moves, every stored clip
# reference points at nothing.

def test_content_keys_are_pinned():
    assert tts.content_key(TURNS) == "4fb26ff92840ba0be8ef77b3"
    assert tts.content_key([{"speaker": "reader", "textJp": "まいげつ"}]) == "db7628e49227358ee99477f5"
    assert tts.content_key([{"speaker": "narrator", "textJp": "私は学生です。"}], "-10%") \
        == "cf02e07acf9530ec0fddc7e0"


# ── Who speaks which line ────────────────────────────────────────

def test_the_narrator_and_the_two_speakers_get_three_voices():
    assert tts.voice_slots(TURNS) == {"narrator": 0, "A": 1, "B": 2}


def test_a_script_without_a_narrator_keeps_A_and_B_where_they_are():
    # Before plan 113, voices went by order of appearance, so a script
    # opening on A gave A the narrator's voice.
    turns = [{"speaker": "A", "textJp": "x"}, {"speaker": "B", "textJp": "y"}]
    assert tts.voice_slots(turns) == {"A": 1, "B": 2}


def test_labels_the_model_invented_take_the_slot_they_name():
    turns = [{"speaker": "男の人", "textJp": "x"}, {"speaker": "女の人", "textJp": "y"},
             {"speaker": "店員", "textJp": "z"}]
    assert tts.voice_slots(turns) == {"男の人": 2, "女の人": 1, "店員": 3}


def test_a_single_voice_clip_is_read_by_the_reader():
    assert tts.voice_slots([{"speaker": "reader", "textJp": "x"}]) == {"reader": 0}


# ── One file per dialogue ────────────────────────────────────────

def test_a_dialogue_is_joined_with_pauses_and_encoded_once(audio_dir, fake_tts):
    joined = []
    real_encode = engine.encode_mp3

    def encode(pcm, **kwargs):
        joined.append(pcm)
        return real_encode(pcm, **kwargs)

    with mock.patch.object(engine, "encode_mp3", side_effect=encode):
        tts.synthesize_dialogue(TURNS)

    assert len(joined) == 1
    # narrator | A | B | narrator: two narrator boundaries, one between speakers.
    expected = 4 * tone().seconds + 2 * tts._NARRATOR_GAP_S + tts._TURN_GAP_S
    assert joined[0].seconds == pytest.approx(expected, abs=0.01)
    # Each line in its slot's voice (style_for_slot is 100 + slot here).
    assert [c.args[1] for c in fake_tts.call_args_list] == [100, 101, 102, 100]


def test_a_rate_becomes_the_engine_speed(audio_dir, fake_tts):
    tts.synthesize_dialogue([{"speaker": "narrator", "textJp": "学校は九時からです。"}], "-10%")
    assert fake_tts.call_args.kwargs["speed"] == pytest.approx(0.9)


def test_the_file_is_an_mp3_the_player_can_time(audio_dir, fake_tts):
    url = tts.synthesize_dialogue(TURNS)
    info = engine.mp3_summary(open(os.path.join(audio_dir, url.rsplit("/", 1)[-1]), "rb").read())
    # Constant bitrate: the exam player's clock and seek bar read the
    # duration off the file.
    assert (info["sample_rate"], info["channels"], info["kbps"]) == (24000, 1, [48])


def test_an_existing_clip_is_not_made_again(audio_dir, fake_tts):
    tts.synthesize_dialogue(TURNS)
    tts.synthesize_dialogue(TURNS)
    assert fake_tts.call_count == len(TURNS)


def test_force_remakes_a_clip_in_place(audio_dir, fake_tts):
    url = tts.synthesize_dialogue(TURNS)
    assert tts.synthesize_dialogue(TURNS, force=True) == url
    assert fake_tts.call_count == 2 * len(TURNS)


# ── The voice epoch ──────────────────────────────────────────────

def _age(path: str) -> None:
    """Make `path` older than the current voice."""
    past = tts.voice_epoch() - 3600
    os.utime(path, (past, past))


def test_the_epoch_is_stamped_once_per_store(audio_dir):
    first = tts.voice_epoch()
    marker = os.path.join(audio_dir, tts._EPOCH_MARKER)
    assert open(marker, encoding="utf-8").read().strip() == engine.VOICE_REV
    tts._epochs.clear()
    assert tts.voice_epoch() == first


def test_a_new_voice_revision_starts_a_new_epoch(audio_dir):
    marker = os.path.join(audio_dir, tts._EPOCH_MARKER)
    with open(marker, "w", encoding="utf-8") as f:
        f.write("edge\n")
    os.utime(marker, (1000, 1000))
    tts._epochs.clear()
    assert tts.voice_epoch() > 1000
    assert open(marker, encoding="utf-8").read().strip() == engine.VOICE_REV


def test_a_clip_an_earlier_voice_made_is_made_again(audio_dir, fake_tts):
    url = tts.synthesize_dialogue(TURNS)
    path = os.path.join(audio_dir, url.rsplit("/", 1)[-1])
    _age(path)
    assert tts.is_stale(path)

    assert tts.synthesize_dialogue(TURNS) == url
    assert fake_tts.call_count == 2 * len(TURNS)
    assert tts.is_current(path)


def test_a_stale_clip_is_remade_before_it_is_served(clip_client, fake_tts, stored_paper, audio_dir):
    filename, turns = stored_paper
    path = os.path.join(audio_dir, filename)
    with open(path, "wb") as f:
        f.write(b"an old voice")
    _age(path)

    response = clip_client.get(f"/exam-audio/{filename}")

    assert response.status_code == 200
    assert response.content != b"an old voice"
    assert fake_tts.call_count == len(turns)


def test_a_stale_clip_that_cannot_be_remade_is_not_served(clip_client, stored_paper, audio_dir):
    # 404, never the old voice: after a voice change, audio the app is no
    # longer licensed to use must not play just because it is on disk.
    filename, _turns = stored_paper
    path = os.path.join(audio_dir, filename)
    with open(path, "wb") as f:
        f.write(b"an old voice")
    _age(path)

    with mock.patch.object(engine, "style_for_slot", side_effect=tts.TTSFailed("engine down")):
        response = clip_client.get(f"/exam-audio/{filename}")

    assert response.status_code == 404
