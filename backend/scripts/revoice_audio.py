"""
Move every stored clip onto the current voice, and remove what cannot be
moved.

    python -m scripts.revoice_audio          # report only, changes nothing
    python -m scripts.revoice_audio --yes    # do it

Run it once after any deploy that changes the voice (plan 113 did, from
edge-tts to VOICEVOX Nemo -- study/voice_engine.py), from the backend's
own shell (Render Shell): it needs the database for the stored papers,
and only that instance mounts the disk the clips live on.

-- Why, when the app already copes -----------------------------
study/exam_tts.py's voice epoch means no clip an earlier voice made is
ever served: main.py's mount remakes a stale exam or dictation clip
before serving it, and /api/tts remakes a stale word. So nothing is
BROKEN without this script. What it buys:

  - no learner waits while their clip is remade on the spot -- every
    dictation line and every clip a stored paper refers to is remade
    now, in place, under the name dictation_log and exam_papers already
    store;
  - the clips that CANNOT be remade stop existing, rather than sitting
    on the disk in a voice the app is not licensed to use: a clip a
    paper refers to whose script no longer rebuilds its key
    ("unverifiable" below), a clip nothing refers to at all, and word
    clips (disposable by design: the text is in the URL, so the next
    request makes a new one). Only STALE files are ever deleted -- a
    clip the current voice made may belong to a paper still being
    generated, which references it only once it is saved.

-- Safe to stop and run again ----------------------------------
A clip remade is current, and a current clip is skipped, so a second run
resumes where the first stopped (a dropped shell, an engine restart) and
a run on a finished store reports nothing to do.

It synthesizes on the same engine the app uses, one clip at a time, so
it adds one request to the engine's queue while it runs -- a quiet hour
is kinder to learners, but nothing breaks at a busy one.
"""
import argparse
import logging
import os
import re
import shutil
import time

import scripts._env  # noqa: F401  -- must precede core.db, which reads
#                       DATABASE_URL at module scope. See scripts/_env.py.
from content.listening_clips import all_clips
from core.db import db_conn
from study import dictation, voice_engine
from study.exam_audio_repair import questions_with_audio, turns_from_script
from study.exam_tts import TTSFailed, audio_dir, content_key, is_current, is_stale, synthesize_dialogue
from study.word_tts import words_dir

logging.basicConfig(level=logging.INFO, format="%(message)s")
logging.getLogger("httpx").setLevel(logging.WARNING)
logger = logging.getLogger("revoice-audio")

_CLIP = re.compile(r"^([0-9a-f]{24})\.mp3$")
# A .part file younger than this may be a write in progress (the app is
# running while this does); older, it is what a crash left behind.
_PART_GRACE_S = 3600


def _engine_ok() -> bool:
    if not voice_engine.configured():
        logger.info("Engine: none configured (VOICEVOX_URL is unset).")
        return False
    try:
        version = voice_engine.version()
        styles = [f"{name}={voice_engine.style_named(name)}" for name in voice_engine.voices()]
    except TTSFailed as e:
        logger.info("Engine: not usable -- %s", e)
        return False
    logger.info("Engine: %s, version %s, voice revision %s", voice_engine.base_url(), version,
                voice_engine.VOICE_REV)
    logger.info("Voices by slot: %s", ", ".join(styles))
    return True


def _stored_clips() -> tuple[dict[str, list[dict]], dict[str, str]]:
    """Every clip a stored paper refers to: key -> turns for the ones
    whose script rebuilds the key (verified), and key -> where it is
    referenced for the ones whose script does not (unverifiable). A key
    verified by any paper is verified."""
    verified: dict[str, list[dict]] = {}
    unverifiable: dict[str, str] = {}
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT exam_id, revision, paper FROM exam_papers WHERE paper::text LIKE %s",
                        ("%/exam-audio/%",))
            rows = cur.fetchall()
    finally:
        conn.close()
    for exam_id, revision, paper in rows:
        for question in questions_with_audio(paper):
            src = question.get("audioSrc") or ""
            match = _CLIP.match(src.rsplit("/", 1)[-1])
            if not match:
                continue
            key = match.group(1)
            turns = turns_from_script(question.get("scriptJp") or "")
            if turns and content_key(turns) == key:
                verified[key] = turns
            else:
                unverifiable.setdefault(key, f"{exam_id} r{revision} {question.get('id', '?')}")
    return verified, {k: where for k, where in unverifiable.items() if k not in verified}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument("--yes", action="store_true", help="remake and delete; without it, report only")
    args = parser.parse_args(argv)

    directory = audio_dir()
    logger.info("Clip store: %s", directory)
    engine_ok = _engine_ok()

    lines = {dictation.clip_id(row["jp"]): row["jp"] for row in all_clips()}
    papers, unverifiable = _stored_clips()
    unverifiable_keys = set(unverifiable) - set(lines)

    def state(key: str) -> str:
        path = os.path.join(directory, f"{key}.mp3")
        return "current" if is_current(path) else "stale" if os.path.exists(path) else "missing"

    to_make = [(k, "dictation") for k in lines if state(k) != "current"]
    to_make += [(k, "exam") for k in papers if k not in lines and state(k) != "current"]

    on_disk = {m.group(1) for name in os.listdir(directory) if (m := _CLIP.match(name))} \
        if os.path.isdir(directory) else set()
    orphans = sorted(k for k in on_disk - set(lines) - set(papers) - unverifiable_keys
                     if is_stale(os.path.join(directory, f"{k}.mp3")))
    doomed_unverifiable = sorted(k for k in unverifiable_keys
                                 if is_stale(os.path.join(directory, f"{k}.mp3")))

    words = words_dir()
    stale_words = sorted(e.path for e in os.scandir(words) if e.is_file() and is_stale(e.path)) \
        if os.path.isdir(words) else []
    # Word stores of an earlier layout (words-<rev>): none of them is read.
    old_word_dirs = sorted(e.path for e in os.scandir(directory)
                           if e.is_dir() and e.name.startswith("words-")) if os.path.isdir(directory) else []
    now = time.time()
    parts = sorted(os.path.join(root, name) for root, _dirs, names in os.walk(directory)
                   for name in names if name.endswith(".part")
                   and now - os.path.getmtime(os.path.join(root, name)) > _PART_GRACE_S)

    logger.info("")
    logger.info("Dictation lines: %d, of which %d to make or remake.", len(lines),
                sum(1 for _k, kind in to_make if kind == "dictation"))
    logger.info("Exam clips in stored papers: %d verified, %d to make or remake; %d unverifiable.",
                len(papers), sum(1 for _k, kind in to_make if kind == "exam"), len(unverifiable))
    for key, where in sorted(unverifiable.items()):
        logger.info("  unverifiable %s  %s", key, where)
    logger.info("Stale clips to delete: %d unverifiable, %d that nothing refers to.",
                len(doomed_unverifiable), len(orphans))
    logger.info("Word clips to delete: %d stale (remade on the next request).", len(stale_words))
    if old_word_dirs:
        logger.info("Old word stores to delete: %s", ", ".join(old_word_dirs))
    if parts:
        logger.info("Abandoned partial writes to delete: %d", len(parts))

    if not args.yes:
        logger.info("")
        logger.info("Report only. Re-run with --yes to remake and delete.")
        return 0
    if to_make and not engine_ok:
        logger.error("Not remaking anything without a working voice engine.")
        return 1

    failed = []
    for i, (key, kind) in enumerate(to_make, 1):
        try:
            if kind == "dictation":
                synthesize_dialogue(dictation.clip_turns(lines[key]), dictation.RATE)
            else:
                synthesize_dialogue(papers[key])
        except TTSFailed as e:
            failed.append(f"{key} ({kind}): {e}")
            continue
        logger.info("  [%d/%d] %s %s", i, len(to_make), kind, key)

    for key in doomed_unverifiable + orphans:
        with_suppressed(os.remove, os.path.join(directory, f"{key}.mp3"))
    for path in stale_words + parts:
        with_suppressed(os.remove, path)
    for path in old_word_dirs:
        shutil.rmtree(path, ignore_errors=True)

    logger.info("Remade %d clip(s); deleted %d clip(s), %d word clip(s).", len(to_make) - len(failed),
                len(doomed_unverifiable) + len(orphans), len(stale_words))
    if failed:
        # A partial run is fine and re-running finishes it (a remade clip
        # is skipped), so this is a report rather than a rollback -- but
        # it exits non-zero, so a half-done migration does not read as a
        # finished one.
        logger.error("%d failed:", len(failed))
        for line in failed:
            logger.error("  %s", line)
        return 1
    return 0


def with_suppressed(fn, *args) -> None:
    try:
        fn(*args)
    except OSError as e:
        logger.warning("  could not remove %s: %s", args[0], e)


if __name__ == "__main__":
    raise SystemExit(main())
