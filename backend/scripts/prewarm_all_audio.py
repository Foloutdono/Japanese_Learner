"""
Make every clip the app can say, ahead of the learner (plan 235).

    python -m scripts.prewarm_all_audio                       # report; makes nothing
    python -m scripts.prewarm_all_audio --yes                 # everything, N5 to N1
    python -m scripts.prewarm_all_audio --part words --part conversation --level N2 --level N1 --yes

-- What "everything" is ---------------------------------------
Every line a route will voice is fixed by the content (ADR 0006): no
endpoint says what a learner typed. So the clips that can ever exist are
a finite list, and this walks all of it, in five parts:

  words         the card readings, /api/tts (study/word_tts.deck_readings)
  dictation     the 書取 bank (content/listening_clips.py)
  examples      every grammar point's example sentences, in the reader's voice
  tours         each point's twists and scene (plan 187d)
  conversation  the 会話 bank (plan 217): the other person's lines in A's
                voice, and every reply the learner can pick in B's

The last three are one store, /api/grammar/audio (study/grammar_audio).
Exam papers are not here: their clips hang off stored papers, so they
need the database; `scripts.revoice_audio --yes` makes those.

Each part already has a warm-up of its own (prewarm_word_audio,
build_dictation_audio, build_grammar_audio); this is the one command that
runs them all, at every level, with a single report first. It derives the
names the routes derive, through the same clip_for, so a clip it makes is
the one a learner is served.

-- The stores' caps --------------------------------------------
Two stores are capped and evict their oldest clips past the cap:
word_tts at 100 MB and grammar_audio at 120 MB. The words, N5 to N1,
come to about 70 MB and fit. The whole grammar store (examples, tours
and conversation) comes near or past its cap, so the report gives an
estimate for each store, and the run makes the grammar store's parts in
the order examples, tours, conversation: if anything is evicted, it is
the examples, the least asked for, and never the conversation lines.

-- Safe to stop, safe to run twice -----------------------------
Without --yes it only reports. With it, a clip the current voice already
made is skipped without a call to the engine, so a rerun resumes where an
interrupted one stopped. After MAX_CONSECUTIVE_FAILURES failures in a row
the engine is down, not the lines difficult, and it stops. A run with a
failure exits non-zero.

-- Where it runs ---------------------------------------------
From the backend's Render Shell, which holds EXAM_AUDIO_DIR and
VOICEVOX_URL and has the disk the clips live on. No database: it reads
backend/.env if there is one, like the warm-ups it gathers.
"""
import argparse
import logging
import os
import time
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

# Before the study imports: exam_tts resolves (and caches) its audio
# directory the first time it is asked, and EXAM_AUDIO_DIR has to be in
# the environment by then.
load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=False)

from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL
from content.listening_clips import BY_LEVEL as DICTATION_BY_LEVEL
from study import (
    conversation,
    dictation,
    grammar_audio,
    voice_engine,
    word_tts,
)
from study.exam_tts import (
    TTSFailed,
    audio_dir,
    is_current,
    synthesize_dialogue,
)

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("prewarm_all_audio")

LEVELS = ("N5", "N4", "N3", "N2", "N1")
# In the order they are made: within the grammar store, the most wanted
# last, so the store's eviction (oldest first) reaches it last.
PARTS = ("words", "dictation", "examples", "tours", "conversation")

# What the report assumes. A bound rather than a promise, measured on the
# engine at Starter's 0.5 CPU (docs/adr/0019): a word ~2 s and ~10 KB
# (prewarm_word_audio's figures); a sentence by its length, at about
# 0.15 s and 1 KB a character (48 kbps, VOICE_TEMPO near 1).
SECONDS_PER_WORD = 2.0
BYTES_PER_WORD = 10 * 1024
SECONDS_PER_CHAR = 0.15
BYTES_PER_CHAR = 1024
SECONDS_PER_SENTENCE = 1.5  # the engine's fixed cost on top

MAX_CONSECUTIVE_FAILURES = 5
PROGRESS_EVERY = 50


@dataclass(frozen=True)
class Clip:
    part: str
    level: str
    text: str
    # What names the file: a line shared by two parts, or a word by two
    # levels, has one key and is made once.
    key: tuple[str, ...]
    made: Callable[[], bool]
    make: Callable[[], object]

    def seconds(self) -> float:
        if self.part == "words":
            return SECONDS_PER_WORD
        return SECONDS_PER_SENTENCE + SECONDS_PER_CHAR * len(self.text)

    def bytes(self) -> int:
        return BYTES_PER_WORD if self.part == "words" else BYTES_PER_CHAR * len(self.text)


def _word(level: str, form: str) -> Clip:
    return Clip("words", level, form, ("word", form), lambda: word_tts.is_made(form), lambda: word_tts.clip_for(form))


def _line(part: str, level: str, text: str, who: str) -> Clip:
    def made() -> bool:
        return is_current(os.path.join(grammar_audio.clip_dir(), grammar_audio.clip_name(text, who)))
    return Clip(part, level, text, ("grammar", who, text), made, lambda: grammar_audio.clip_for(text, who))


def _dictation(level: str, jp: str) -> Clip:
    def made() -> bool:
        return is_current(os.path.join(audio_dir(), f"{dictation.clip_id(jp)}.mp3"))
    # Through dictation's own rate: it is part of the content key.
    return Clip("dictation", level, jp, ("dictation", jp), made,
                lambda: synthesize_dialogue(dictation.clip_turns(jp), dictation.RATE))


def _words(level: str) -> list[Clip]:
    return [_word(level, form) for form in word_tts.deck_readings([level])]


def _dictations(level: str) -> list[Clip]:
    return [_dictation(level, row["jp"]) for row in DICTATION_BY_LEVEL.get(level, [])]


def _examples(level: str) -> list[Clip]:
    return [_line("examples", level, ex["jp"], "reader")
            for entry in GRAMMAR_POINTS_BY_LEVEL.get(level, [])
            for ex in entry.get("examples", []) if ex.get("jp")]


def _tours(level: str) -> list[Clip]:
    out = []
    for entry in GRAMMAR_POINTS_BY_LEVEL.get(level, []):
        tour = entry.get("tour")
        if not tour:
            continue
        out += [_line("tours", level, twist["jp"], "reader") for twist in tour["twists"]]
        scene = tour["scene"]
        out += [_line("tours", level, line["jp"], line["who"]) for line in [*scene["lines"], scene["ask"]["cue"]]]
        out += [_line("tours", level, jp, "me") for jp in scene["ask"]["choices"]]
    return out


def _conversations(level: str) -> list[Clip]:
    # The same lines grammar_audio.conversation_lines voices, kept by
    # level here so a run can be asked for N2 and N1 alone.
    out = []
    for row in conversation.bank().get(level, []):
        them = [turn["them"]["jp"] for turn in row["turns"]]
        if row.get("close"):
            them.append(row["close"]["jp"])
        out += [_line("conversation", level, jp, "them") for jp in them]
        out += [_line("conversation", level, reply["jp"], "me")
                for turn in row["turns"]
                for reply in (turn["me"], *turn["me"].get("alt", []), *turn["wrong"])]
    return out


BUILDERS = {
    "words": _words,
    "dictation": _dictations,
    "examples": _examples,
    "tours": _tours,
    "conversation": _conversations,
}
# Which capped store each part fills, for the report's warning.
STORES = {
    "words": ("word", word_tts._MAX_BYTES),
    "examples": ("grammar", grammar_audio._MAX_BYTES),
    "tours": ("grammar", grammar_audio._MAX_BYTES),
    "conversation": ("grammar", grammar_audio._MAX_BYTES),
}


def plan(parts, levels) -> list[Clip]:
    """Every clip of the parts and levels asked for, each once (a line
    two parts share, or a word two levels share, under the first), in
    PARTS order then level order."""
    seen: set[tuple[str, ...]] = set()
    out: list[Clip] = []
    for part in PARTS:
        if part not in parts:
            continue
        for level in levels:
            for clip in BUILDERS[part](level):
                if clip.key in seen:
                    continue
                seen.add(clip.key)
                out.append(clip)
    return out


def _hours(seconds: float) -> str:
    return f"{seconds / 3600:.1f} h" if seconds >= 3600 else f"{seconds / 60:.0f} min"


def report(clips: list[Clip], parts, levels) -> list[Clip]:
    missing: list[Clip] = []
    for part in PARTS:
        if part not in parts:
            continue
        for level in levels:
            these = [c for c in clips if c.part == part and c.level == level]
            if not these:
                continue
            gone = [c for c in these if not c.made()]
            missing += gone
            logger.info("%-12s %s: %5d clips, %5d made, %5d missing",
                        part, level, len(these), len(these) - len(gone), len(gone))

    logger.info("Total: %d clips, %d made, %d missing.", len(clips), len(clips) - len(missing), len(missing))
    logger.info("Audio in %s", audio_dir())

    by_store: dict[str, tuple[int, int]] = {}
    for clip in clips:
        if clip.part in STORES:
            name, cap = STORES[clip.part]
            total, _ = by_store.get(name, (0, cap))
            by_store[name] = (total + clip.bytes(), cap)
    for name, (total, cap) in by_store.items():
        mb, cap_mb = total // (1024 * 1024), cap // (1024 * 1024)
        if total > cap:
            logger.warning("The %s store would hold about %d MB, past its %d MB cap: its oldest clips "
                           "will be evicted as new ones are made (in the grammar store, the examples first).",
                           name, mb, cap_mb)
        else:
            logger.info("The %s store would hold about %d MB of its %d MB.", name, mb, cap_mb)
    return missing


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument("--part", action="append", choices=PARTS,
                        help="a part to make (repeat for several; default all)")
    parser.add_argument("--level", action="append", choices=LEVELS,
                        help="a level to make (repeat for several; default N5 to N1)")
    parser.add_argument("--yes", action="store_true", help="make the missing clips (without it, only report)")
    args = parser.parse_args(argv)
    parts = tuple(args.part) if args.part else PARTS
    levels = tuple(args.level) if args.level else LEVELS

    clips = plan(parts, levels)
    missing = report(clips, parts, levels)
    if not missing:
        logger.info("Nothing to do.")
        return 0
    logger.info("Making them would take about %s on the engine.", _hours(sum(c.seconds() for c in missing)))
    if not args.yes:
        logger.info("Report only. Run again with --yes to make them.")
        return 0
    if not voice_engine.configured():
        logger.error("No voice engine configured: set VOICEVOX_URL (see backend/.env.example).")
        return 1

    started = time.monotonic()
    made, streak = 0, 0
    failed: list[str] = []
    for i, clip in enumerate(missing, 1):
        try:
            clip.make()
        except (TTSFailed, ValueError) as e:
            failed.append(f"{clip.part} {clip.level} {clip.text} ({e})")
            streak += 1
            if streak >= MAX_CONSECUTIVE_FAILURES:
                logger.error("%d failures in a row: the voice engine looks down. Stopping; "
                             "a rerun resumes from here.", streak)
                break
            continue
        streak = 0
        made += 1
        if made % PROGRESS_EVERY == 0:
            rate = (time.monotonic() - started) / made
            logger.info("  [%d/%d] %s %s, about %s left", i, len(missing), clip.part, clip.level,
                        _hours(rate * (len(missing) - i)))

    logger.info("Made %d clip(s).", made)
    if failed:
        logger.error("%d failed:", len(failed))
        for line in failed[:20]:
            logger.error("  %s", line)
        if len(failed) > 20:
            logger.error("  ... and %d more", len(failed) - 20)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
