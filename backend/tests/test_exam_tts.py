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
import os
import uuid
from unittest import mock

import pytest
from starlette.applications import Starlette
from starlette.routing import Mount
from starlette.testclient import TestClient

import study.exam_tts as tts
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


@pytest.fixture
def fake_tts():
    """edge-tts is a network call; the bytes it returns are not what any
    of this is testing."""
    with mock.patch.object(tts, "voice_for_speaker", lambda i: f"voice-{i}"), \
            mock.patch.object(tts, "synthesize", mock.Mock(return_value=b"\xff\xfbmp3")) as synth:
        yield synth


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
    assert response.content == b"\xff\xfbmp3" * len(turns)
    assert os.path.exists(os.path.join(audio_dir, filename))


def test_a_restored_clip_is_synthesized_once(clip_client, fake_tts, stored_paper):
    filename, turns = stored_paper
    assert clip_client.get(f"/exam-audio/{filename}").status_code == 200
    assert clip_client.get(f"/exam-audio/{filename}").status_code == 200
    # Second request served the file on disk rather than paying again.
    assert fake_tts.call_count == len(turns)


def test_restore_reports_failure_rather_than_raising(stored_paper, audio_dir):
    filename, _turns = stored_paper
    with mock.patch.object(tts, "voice_for_speaker", side_effect=tts.TTSFailed("no voices")):
        assert restore_clip(filename) is False
