"""
Author the exam pool's seed papers (plan 228) by replaying the generators.

    python -m scripts.exam_seed status                  # how many seeds each exam id has
    python -m scripts.exam_seed run n4-grammar-01       # build its missing seed papers
    python -m scripts.exam_seed run n4-grammar-01 --n 3 # one of them (repeatable)
    python -m scripts.exam_seed run n4-grammar-01 --rebuild  # the built ones too
    python -m scripts.exam_seed check n4-grammar-01     # what the test holds the file to
    python -m scripts.exam_seed reclip n4-listening-01  # clip names after a hand-corrected script
    python -m scripts.exam_seed kanji N4 "文を書く"       # characters outside N4's set

A seed paper (content/exam_seed/<exam_id>.json, loaded into exam_papers
by study/exam_seed.py) is made by the exam id's own generator, the one
routes/exams.py runs, with one thing replaced: the model. Every model
call the generator makes is answered from a file,

    datas/exam_seed/answers/<key>.json    (the reply, exactly as a model would send it)

keyed by a hash of the prompt and the paper (two papers asking the same
prompt are two model calls, and get two replies). A call with no answer stops the paper and
leaves its prompt in datas/exam_seed/prompts/<key>.txt; whoever is
writing the seeds reads it, writes the reply under the key, and runs
this again. A reply the generator rejects (a kanji outside the level,
a choice repeating the target word, a self-check that fails) is printed
under the paper, and the generator goes on as it would live -- to the
next batch, or to a retry with another seed -- so its next prompt is
the next file to answer. A rejected reply can also be rewritten in
place: the generator is replayed from the start on every run.

A paper is written into its seed file once the generator returns it
and study/exam_seed.problems has nothing to say about it: complete
(every blueprint mondai of its kind, full), and through the checks the
route and the pipeline run. The answers are working files (gitignored);
the papers are what ships.

Listening needs no voice engine here: a question's audioSrc is the name
of the clip of its own script (study/exam_tts.content_key), which the
route makes the first time it is asked for (study/exam_audio_repair.py),
or `scripts.revoice_audio --yes` ahead of time.

No database, no network, no API key.
"""
import argparse
import fcntl
import hashlib
import json
import logging
import os
import sys
from contextlib import contextmanager
from pathlib import Path

from study import exam_gen_utils, exam_grammar_gen, exam_listening_gen, exam_pipeline
from study import exam_reading_gen, exam_vocab_gen, voice_engine
from study.exam_catalogue import EXAM_GENERATORS
from study.exam_seed import PER_EXAM, exam_problems, load, problems, seed_for, seed_path
from study.exam_audio_repair import questions_with_audio, turns_from_script
from study.exam_tts import content_key
from study.llm_shared import offending_kanji

WORK = Path(__file__).resolve().parent.parent / "datas" / "exam_seed"
PROMPTS = WORK / "prompts"
ANSWERS = WORK / "answers"

_GENERATOR_LOGGERS = [m.__name__ for m in (
    exam_vocab_gen, exam_grammar_gen, exam_reading_gen, exam_listening_gen, exam_pipeline,
)]


class Pending(BaseException):
    """A model call nobody has answered yet. A BaseException so that no
    generator's `except Exception`/`except RuntimeError` mistakes it for
    a failed call and moves on: the paper stops where the call is."""

    def __init__(self, key: str, task: str):
        super().__init__(key)
        self.key, self.task = key, task


# The paper being replayed, "{exam_id}#{n}": part of every reply's key.
# Two seeds can draw the same subject for the same mondai, and a model
# asked the same prompt twice writes two different texts; a key of the
# prompt alone handed both papers one reply, so one passage in two
# papers.
_PAPER = {"id": ""}


def prompt_key(messages: list[dict], paper: str = "") -> str:
    raw = "\n\x00\n".join(f"{m['role']}:{m['content']}" for m in messages)
    if paper:
        raw = f"{paper}\n\x00\n{raw}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


def _claim_unkeyed(messages: list[dict], answer: Path) -> bool:
    """A reply written before keys named their paper, taken by the first
    paper replayed onto it: moved, so a second paper asking the same
    prompt is asked for a reply of its own."""
    old = ANSWERS / f"{prompt_key(messages)}.json"
    try:
        os.replace(old, answer)
        return True
    except FileNotFoundError:
        return False


def replay_chat(messages, timeout=60, max_tokens=3000, reasoning=True, *,
                vision=False, task="", accept=None) -> str:
    key = prompt_key(messages, _PAPER["id"])
    answer = ANSWERS / f"{key}.json"
    if answer.exists() or _claim_unkeyed(messages, answer):
        return answer.read_text(encoding="utf-8")
    PROMPTS.mkdir(parents=True, exist_ok=True)
    body = "\n\n".join(f"=== {m['role']} ===\n{m['content']}" for m in messages)
    (PROMPTS / f"{key}.txt").write_text(f"task: {task or 'exam'}\n\n{body}\n", encoding="utf-8")
    raise Pending(key, task)


def _clip(turns, rate="", *, force=False) -> str:
    return f"/exam-audio/{content_key(turns, rate)}.mp3"


class _Collect(logging.Handler):
    def __init__(self):
        super().__init__(logging.WARNING)
        self.lines: list[str] = []

    def emit(self, record):
        self.lines.append(record.getMessage())


@contextmanager
def replaying():
    """The generators with the model swapped for the answer files, the
    voice engine for clip names, and their warnings collected."""
    saved = []

    def swap(module, name, value):
        saved.append((module, name, getattr(module, name)))
        setattr(module, name, value)

    swap(exam_gen_utils, "chat", replay_chat)
    swap(exam_vocab_gen, "chat", replay_chat)
    for module in (exam_vocab_gen, exam_grammar_gen, exam_reading_gen, exam_listening_gen):
        swap(module, "llm_configured", lambda: True)
    swap(voice_engine, "ready", lambda timeout=2.0: True)
    swap(exam_listening_gen, "synthesize_dialogue", _clip)

    validate = exam_pipeline.validate_content

    def logged(flat, check_duplicates=True):
        errors = validate(flat, check_duplicates=check_duplicates)
        if errors:
            logging.getLogger(exam_pipeline.__name__).warning(
                "paper rejected, the generator retries with another seed: %s", "; ".join(errors))
        return errors

    swap(exam_pipeline, "validate_content", logged)

    collect = _Collect()
    levels = {}
    for name in _GENERATOR_LOGGERS:
        logger = logging.getLogger(name)
        levels[name] = logger.level
        logger.setLevel(logging.WARNING)
        logger.propagate = False
        logger.addHandler(collect)
    try:
        yield collect
    finally:
        for name in _GENERATOR_LOGGERS:
            logger = logging.getLogger(name)
            logger.removeHandler(collect)
            logger.setLevel(levels[name])
            logger.propagate = True
        for module, name, value in reversed(saved):
            setattr(module, name, value)


def build(exam_id: str, n: int) -> tuple[str, object, list[str]]:
    """Replay seed paper `n` of `exam_id`. Returns (state, detail, log):
    ("built", paper), ("pending", Pending), ("failed", message) or
    ("unfit", [problems])."""
    _version, _kind, _level, generate = EXAM_GENERATORS[exam_id]
    _PAPER["id"] = f"{exam_id}#{n}"
    with replaying() as collect:
        try:
            paper = generate(seed_for(exam_id, n))
        except Pending as p:
            return "pending", p, collect.lines
        except exam_gen_utils.GenerationFailed as e:
            return "failed", str(e), collect.lines
        finally:
            _PAPER["id"] = ""
    found = problems(exam_id, paper)
    if found:
        return "unfit", found, collect.lines
    return "built", paper, collect.lines


def _save(exam_id: str, n: int, paper: dict) -> None:
    """Paper `n` into the exam id's seed file, under a lock: the ten
    papers of one exam id may be written by two runs at once."""
    version = EXAM_GENERATORS[exam_id][0]
    path = seed_path(exam_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    WORK.mkdir(parents=True, exist_ok=True)
    with open(WORK / f"{exam_id}.lock", "w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        data = load(exam_id) or {}
        if data.get("generatorVersion") != version:
            data = {"examId": exam_id, "generatorVersion": version, "papers": []}
        papers = [e for e in data["papers"] if e["n"] != n]
        papers.append({"n": n, "seed": seed_for(exam_id, n), "paper": paper})
        data["papers"] = sorted(papers, key=lambda e: e["n"])
        path.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def built(exam_id: str) -> set[int]:
    """The seed numbers already in the file at the current version."""
    data = load(exam_id)
    if not data or data.get("generatorVersion") != EXAM_GENERATORS[exam_id][0]:
        return set()
    return {e["n"] for e in data["papers"]}


def _rel(path: Path) -> str:
    return str(path.relative_to(Path(__file__).resolve().parent.parent))


def run(exam_id: str, numbers: list[int], rebuild: bool) -> int:
    done = built(exam_id)
    waiting = 0
    for n in numbers:
        if n in done and not rebuild:
            print(f"{exam_id} #{n}: built")
            continue
        state, detail, log = build(exam_id, n)
        if state == "built":
            _save(exam_id, n, detail)
            print(f"{exam_id} #{n}: BUILT, written to {_rel(seed_path(exam_id))}")
        elif state == "pending":
            waiting += 1
            print(f"{exam_id} #{n}: waiting on {detail.task or 'exam'}")
            print(f"    prompt: {_rel(PROMPTS / f'{detail.key}.txt')}")
            print(f"    answer: {_rel(ANSWERS / f'{detail.key}.json')}")
        elif state == "failed":
            waiting += 1
            print(f"{exam_id} #{n}: FAILED: {detail}")
        else:
            waiting += 1
            print(f"{exam_id} #{n}: UNFIT: " + "; ".join(detail))
        if state != "built" and log:
            print("    rejected on the way:")
            for line in log:
                print(f"      - {line}")
    return 1 if waiting else 0


def status() -> int:
    short = 0
    for exam_id, (version, _kind, _level, _gen) in EXAM_GENERATORS.items():
        have = built(exam_id)
        short += PER_EXAM - min(len(have), PER_EXAM)
        print(f"  {exam_id:20s} {version:16s} {len(have):3d}/{PER_EXAM}")
    print(f"{short} seed paper(s) missing")
    return 1 if short else 0


def reclip(exam_id: str) -> int:
    """Rename every listening question's clip after its script: what a
    hand correction of a dialogue (scriptJp) needs, since the clip's
    name is the hash of the script it reads. Prints what it renamed."""
    data = load(exam_id)
    if not data:
        print(f"{exam_id}: no seed file")
        return 2
    renamed = 0
    for entry in data["papers"]:
        for q in questions_with_audio(entry["paper"]):
            turns = turns_from_script(q.get("scriptJp") or "")
            if turns is None:
                print(f"{exam_id} #{entry['n']} {q.get('id')}: scriptJp is not 'speaker: line' lines")
                continue
            src = _clip(turns)
            if q.get("audioSrc") != src:
                q["audioSrc"] = src
                renamed += 1
                print(f"{exam_id} #{entry['n']} {q.get('id')}: {src}")
    if renamed:
        seed_path(exam_id).write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{renamed} clip(s) renamed")
    return 0


def check(exam_id: str | None) -> int:
    """study/exam_seed.exam_problems over one exam id, or every one --
    what tests/test_exam_seed.py holds the files to."""
    found = []
    for e in [exam_id] if exam_id else EXAM_GENERATORS:
        found += exam_problems(e)
    for line in found:
        print(line)
    print(f"{len(found)} problem(s)")
    return 1 if found else 0


def main(argv=None) -> int:
    logging.basicConfig(level=logging.ERROR, format="%(message)s")
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    sub = ap.add_subparsers(dest="command", required=True)
    sub.add_parser("status")
    r = sub.add_parser("run")
    r.add_argument("exam_id")
    r.add_argument("--n", type=int, action="append", dest="numbers",
                   help=f"seed number, 1-{PER_EXAM}; repeatable. Defaults to all.")
    r.add_argument("--rebuild", action="store_true", help="replay papers already built too")
    c = sub.add_parser("check")
    c.add_argument("exam_id", nargs="?")
    rc = sub.add_parser("reclip")
    rc.add_argument("exam_id")
    k = sub.add_parser("kanji")
    k.add_argument("level")
    k.add_argument("text")
    args = ap.parse_args(argv)

    if args.command == "status":
        return status()
    if args.command == "check":
        return check(args.exam_id)
    if args.command == "reclip":
        return reclip(args.exam_id)
    if args.command == "kanji":
        bad = offending_kanji(args.text, args.level)
        print(f"outside {args.level}: {bad}" if bad else f"all within {args.level}")
        return 1 if bad else 0
    if args.exam_id not in EXAM_GENERATORS:
        print(f"unknown exam id {args.exam_id}; known: {', '.join(EXAM_GENERATORS)}")
        return 2
    numbers = args.numbers or list(range(1, PER_EXAM + 1))
    return run(args.exam_id, numbers, args.rebuild)


if __name__ == "__main__":
    sys.exit(main())
