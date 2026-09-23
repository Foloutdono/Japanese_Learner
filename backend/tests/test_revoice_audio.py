"""
scripts/revoice_audio.py — moving the clip store onto a new voice.

The app already refuses to serve a clip an earlier voice made (the voice
epoch, study/exam_tts.py); this script is what makes that a one-off
rather than a wait for every learner, and what removes the clips that
cannot be remade. So the tests are about what it touches:

  - without --yes, nothing: not a file, not the engine;
  - with it, every stale clip that can be remade is remade IN PLACE
    (the name is stored in dictation_log and exam_papers), and only
    stale files are deleted -- a current clip nothing refers to yet may
    belong to a paper still being generated;
  - and a second run finds nothing to do.
"""
import json
import math
import os
import time
import uuid
from array import array
from unittest import mock

import pytest

import scripts.revoice_audio as revoice
import study.exam_tts as tts
import study.voice_engine as engine
from core.db import db_conn
from study import dictation

LINE = "学校は九時からです。"
TURNS = [
    {"speaker": "narrator", "textJp": f"ふたりが　はなして　います。{uuid.uuid4().hex[:6]}"},
    {"speaker": "A", "textJp": "あした　あいましょう。"},
    {"speaker": "B", "textJp": "はい、そうしましょう。"},
]


def _pcm():
    rate = engine.DIALOGUE_RATE
    return engine.Pcm(array("h", (int(8000 * math.sin(i / 5)) for i in range(rate // 4))).tobytes(), rate)


@pytest.fixture
def store(tmp_path):
    directory = str(tmp_path / "clips")
    os.makedirs(os.path.join(directory, "words"))
    with mock.patch.object(tts, "_resolve_audio_dir", lambda: directory), \
            mock.patch.object(revoice, "all_clips", lambda: [{"jp": LINE, "level": "N5"}]), \
            mock.patch.object(revoice, "_engine_ok", lambda: True), \
            mock.patch.object(engine, "style_for_slot", lambda slot: 100 + slot), \
            mock.patch.object(engine, "say", mock.Mock(side_effect=lambda *a, **k: _pcm())) as say:
        yield directory, say


@pytest.fixture
def paper():
    """A stored paper referring to one clip whose script rebuilds its key,
    and one whose script does not."""
    exam_id = f"probe-revoice-{uuid.uuid4()}"
    good = tts.content_key(TURNS)
    broken = uuid.uuid4().hex[:24]
    script = "\n".join(f"{t['speaker']}: {t['textJp']}" for t in TURNS)
    body = {"sections": [{"mondai": [{"questions": [
        {"id": "q1", "audioSrc": f"/exam-audio/{good}.mp3", "scriptJp": script},
        {"id": "q2", "audioSrc": f"/exam-audio/{broken}.mp3", "scriptJp": "no longer this clip's script"},
    ]}]}]}
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO exam_papers (exam_id, revision, level, seed, generator_version, paper,
                                            section_count, question_count)
                   VALUES (%s, 1, 'N5', 1, 'listening-gen-2', %s, 1, 2)""",
                (exam_id, json.dumps(body)))
        conn.commit()
    finally:
        conn.close()
    yield good, broken
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM exam_papers WHERE exam_id = %s", (exam_id,))
        conn.commit()
    finally:
        conn.close()


def _old(directory: str, relpath: str, content: bytes = b"an old voice") -> str:
    path = os.path.join(directory, relpath)
    with open(path, "wb") as f:
        f.write(content)
    past = tts.voice_epoch() - 7200
    os.utime(path, (past, past))
    return path


def _current(directory: str, relpath: str) -> str:
    tts.voice_epoch()
    path = os.path.join(directory, relpath)
    with open(path, "wb") as f:
        f.write(b"made by this voice")
    return path


def test_the_report_changes_nothing(store, paper):
    directory, say = store
    good, broken = paper
    stale = [_old(directory, f"{good}.mp3"), _old(directory, f"{broken}.mp3"),
             _old(directory, "words/0123456789abcdef01234567.mp3")]

    assert revoice.main([]) == 0

    say.assert_not_called()
    assert all(open(p, "rb").read() == b"an old voice" for p in stale)


def test_yes_remakes_in_place_and_deletes_only_stale_files(store, paper):
    directory, say = store
    good, broken = paper
    line = dictation.clip_id(LINE)
    remade = _old(directory, f"{good}.mp3")
    unverifiable = _old(directory, f"{broken}.mp3")
    orphan = _old(directory, f"{'f' * 24}.mp3")
    in_progress = _current(directory, f"{'e' * 24}.mp3")
    word = _old(directory, "words/0123456789abcdef01234567.mp3")
    part = _old(directory, "abc.part")
    os.utime(part, (time.time() - 7200, time.time() - 7200))

    assert revoice.main(["--yes"]) == 0

    # Remade under the same names: a stale exam clip, and a dictation line
    # that had no clip at all.
    assert tts.is_current(remade) and open(remade, "rb").read() != b"an old voice"
    assert tts.is_current(os.path.join(directory, f"{line}.mp3"))
    # (At least: papers other tests left in the shared database count too.)
    assert say.call_count >= len(TURNS) + 1
    # Gone: what cannot be remade, and what nothing needs.
    for path in (unverifiable, orphan, word, part):
        assert not os.path.exists(path), path
    # Kept: a clip the current voice made, even though nothing refers to
    # it yet -- it may belong to a paper still being generated.
    assert os.path.exists(in_progress)


def test_a_second_run_has_nothing_to_do(store, paper):
    directory, say = store
    good, _broken = paper
    _old(directory, f"{good}.mp3")
    assert revoice.main(["--yes"]) == 0
    calls = say.call_count

    assert revoice.main(["--yes"]) == 0
    assert say.call_count == calls


def test_nothing_is_remade_without_an_engine(store, paper):
    directory, say = store
    good, _broken = paper
    stale = _old(directory, f"{good}.mp3")
    with mock.patch.object(revoice, "_engine_ok", lambda: False):
        assert revoice.main(["--yes"]) == 1
    say.assert_not_called()
    assert os.path.exists(stale)
