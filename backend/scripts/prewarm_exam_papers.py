"""
Fill the shared pool of mock-exam papers, ahead of demand (plan 111).

    python -m scripts.prewarm_exam_papers --dry-run
    python -m scripts.prewarm_exam_papers                 # one paper per exam id
    python -m scripts.prewarm_exam_papers --target 2      # two revisions each
    python -m scripts.prewarm_exam_papers --level N5 --kind vocab

模試 (routes/exams.py) materializes a paper the first time someone
opens an exam id: a background worker makes ~35 model calls over
several minutes while the learner polls a spinner. Papers are GLOBAL
-- exam_papers is picked per revision across the whole user base
(_select_paper), so that cost is paid once per revision and every
later learner is served for free -- but the first learner at each of
the twenty exam ids (five levels, four kinds) still pays it, and pays
it with their time.

Running this moves that first generation off the learner's path: it
tops every exam id up TO `--target` live revisions (papers at the
CURRENT generator_version -- a bumped version retires the old ones,
exactly as it does on the request path) and generates the rest here,
serially, with the same generator and the same deterministic seed the
worker would have used. A paper made by this script is byte-for-byte
the paper the learner would otherwise have waited for.

Idempotent in the way that matters: an exam id already at target costs
nothing, a re-run after a rate limit or an interruption only pays for
what is still missing, and it never deletes.

Offline by design, like scripts/prewarm_comprehension_pool.py, and
with the same caveat: if this is ever a problem it will be for its
DURATION, not its price. Twenty papers at ~35 calls each is a few
hundred model calls, and a listening paper synthesizes its clips too.
"""
import argparse
import json
import logging
import sys
import time

import scripts._env  # noqa: F401  -- must precede the route import, which
#                       reads the provider API keys at module scope.
from core.db import db_conn
from routes.exams import EXAM_GENERATORS, _next_revision, _seed_for
from study.exam_gen_utils import GenerationFailed
from study.exam_scoring import flatten_questions
from study.llm_shared import LLMUnavailable, llm_configured

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger("prewarm-exams")

# One live paper per exam id is what takes the first learner off the
# generation path; a second is a re-sit. Small by default because a
# paper is the most call-heavy thing this app makes.
DEFAULT_TARGET = 1

# Between papers, not between calls: each generator paces its own
# calls. This is only so two papers do not start on the same second.
PAUSE_SECONDS = 1.0


def _counts() -> dict[str, int]:
    """How many live revisions each exam id already holds -- at its
    CURRENT generator_version, which is the only kind the route serves."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT exam_id, generator_version, COUNT(*) FROM exam_papers GROUP BY 1, 2")
            live = {
                exam_id: n for exam_id, version, n in cur.fetchall()
                if exam_id in EXAM_GENERATORS and EXAM_GENERATORS[exam_id][0] == version
            }
    finally:
        conn.close()
    return {exam_id: live.get(exam_id, 0) for exam_id in EXAM_GENERATORS}


def _store(exam_id: str, revision: int, seed: int, paper: dict) -> bool:
    """The worker's own insert (routes/exams._generation_worker), with
    the same ON CONFLICT DO NOTHING: two writers can never materialize
    two different papers for one revision. True if this call stored it."""
    generator_version = EXAM_GENERATORS[exam_id][0]
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO exam_papers
                    (exam_id, revision, level, seed, generator_version, paper, section_count, question_count)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (exam_id, revision) DO NOTHING
                """,
                (
                    exam_id, revision, paper["level"], seed, generator_version,
                    json.dumps(paper), len(paper["sections"]), len(flatten_questions(paper)),
                ),
            )
            stored = cur.rowcount == 1
        conn.commit()
        return stored
    finally:
        conn.close()


def generate_one(exam_id: str) -> tuple[int, int]:
    """One more revision of `exam_id`, stored. Returns (revision, questions)."""
    _version, _kind, _level, generate = EXAM_GENERATORS[exam_id]
    revision = _next_revision(exam_id)
    seed = _seed_for(exam_id, revision)
    paper = generate(seed)
    if not _store(exam_id, revision, seed, paper):
        raise RuntimeError(f"revision {revision} of {exam_id} was stored by someone else meanwhile")
    return revision, len(flatten_questions(paper))


def plan(levels, kinds, exam_ids, target: int) -> list[tuple[str, int]]:
    """(exam_id, how many to generate), in catalogue order, for every
    exam id the filters keep that is below `target`."""
    have = _counts()
    out = []
    for exam_id, (_version, kind, level, _gen) in EXAM_GENERATORS.items():
        if exam_ids and exam_id not in exam_ids:
            continue
        if levels and level not in levels:
            continue
        if kinds and kind not in kinds:
            continue
        missing = target - have[exam_id]
        if missing > 0:
            out.append((exam_id, missing))
    return out


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    ap.add_argument("--level", action="append", dest="levels", help="JLPT level; repeatable. Defaults to all.")
    ap.add_argument("--kind", action="append", dest="kinds",
                    help="vocab, reading, grammar or listening; repeatable. Defaults to all.")
    ap.add_argument("--exam", action="append", dest="exam_ids", help="one exam id (n5-vocab-01); repeatable.")
    ap.add_argument("--target", type=int, default=DEFAULT_TARGET,
                    help=f"live revisions per exam id (default {DEFAULT_TARGET})")
    ap.add_argument("--dry-run", action="store_true", help="report what is missing without calling the model")
    args = ap.parse_args(argv)

    unknown = [e for e in (args.exam_ids or []) if e not in EXAM_GENERATORS]
    if unknown:
        logger.error("unknown exam id(s): %s", ", ".join(unknown))
        return 2

    have = _counts()
    todo = plan(args.levels, args.kinds, args.exam_ids, args.target)
    total = sum(n for _e, n in todo)

    logger.info("target %d live paper(s) per exam id", args.target)
    for exam_id, (version, _kind, _level, _gen) in EXAM_GENERATORS.items():
        logger.info("  %-18s %s: %d stored", exam_id, version, have[exam_id])
    logger.info("%d paper(s) to generate", total)

    if args.dry_run or not total:
        return 0
    if not llm_configured():
        logger.error("No LLM provider is configured; nothing to generate with.")
        return 2

    made = failed = 0
    for exam_id, n in todo:
        for _ in range(n):
            try:
                revision, questions = generate_one(exam_id)
                made += 1
                logger.info("  %s r%d ok, %d questions (%d/%d)", exam_id, revision, questions, made, total)
            except LLMUnavailable as e:
                # Every provider is gone; the next paper will not fare
                # better, and each attempt is dozens of calls.
                logger.error("  %s: provider unavailable, stopping: %s", exam_id, e)
                return 1
            except (GenerationFailed, RuntimeError) as e:
                failed += 1
                logger.warning("  %s failed: %s", exam_id, e)
            time.sleep(PAUSE_SECONDS)

    logger.info("%d generated, %d failed", made, failed)
    return 0 if made else 1


if __name__ == "__main__":
    sys.exit(main())
