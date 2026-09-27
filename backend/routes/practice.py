"""
実践の記録 — what a learner has done on each practice platform, by grade
(plan 130), and at one stop of one platform (plan 158).

The Practice gate on the desk hangs each platform's five grades as rows,
and a row says what the learner has done there: how many sentences,
texts or papers, and the share of them that went right. Everything is
read from the logs the six platforms already keep, and nothing is
stored here.

    GET /api/practice/record

    {"reading":       {"N5": {"done": 24, "right": 20, "of": 24,
                              "last": "2026-09-27T08:12:03+00:00"}, ...},
     "comprehension": {...},   # done = texts, right/of = its questions
     "translation":   {...},
     "dictation":     {...},
     "composition":   {...},
     "exam":          {...}}   # done = papers sat, right/of = questions

`right` over `of` is the figure's share, and `of` is not always `done`:
a comprehension text carries several questions, a paper dozens. For the
four sentence platforms a row is one sentence, so `of` is `done` and
`right` counts the rows marked correct -- the learner's own rating
passed (q > 2, the rule every practice log derives `correct` by).
`last` is when the newest of them was done (plan 158: the grade rows
of a filled station say "3 days ago") -- the row's created_at, or a
paper's finished_at.

A grade with nothing logged is absent rather than zero, so the client
can say "not yet" without reading a zero as a result. Only the five
JLPT grades are read: reading and translation log '' for a frequency or
own-cards run, which has no grade and is behind no grade's row.

    GET /api/practice/stop/{platform}?stop=N4

One stop of one platform, for the grade page the desk's filled station
opens beside its line (plan 158, the owner's pick A): the stop's record
in the same figures, the sentences the learner last missed there, and
the grade's grammar they have studied at Learn. See practice_stop.
"""
from functools import lru_cache

from fastapi import APIRouter, Depends, HTTPException, Query

import routes.grammar as grammar
from content import comprehension_seed, reading_sentences
from content import frequency_data as freq
from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL, grammar_to_id
from core.auth import get_user_id
from core.db import db_conn
from routes.reading import _source_label

router = APIRouter()

GRADES = ["N5", "N4", "N3", "N2", "N1"]

# One query per platform, each answering (level, done, right, of, last).
# The table names are literals here rather than parameters: SQL cannot
# bind an identifier, and nothing a request carries reaches this string.
_SENTENCES = """
    SELECT level, COUNT(*), COUNT(*) FILTER (WHERE correct), COUNT(*), MAX(created_at)
    FROM {table}
    WHERE user_id = %(user)s AND level = ANY(%(grades)s)
    GROUP BY level
"""
QUERIES = {
    "reading": _SENTENCES.format(table="reading_log"),
    "comprehension": """
        SELECT level, COUNT(*), COALESCE(SUM(score), 0), COALESCE(SUM(total), 0), MAX(created_at)
        FROM comprehension_log
        WHERE user_id = %(user)s AND level = ANY(%(grades)s)
        GROUP BY level
    """,
    "translation": _SENTENCES.format(table="translation_log"),
    "dictation": _SENTENCES.format(table="dictation_log"),
    "composition": _SENTENCES.format(table="composition_log"),
    # A paper's grade is the paper's, not the attempt's: the attempt
    # names its paper by (exam_id, revision), the key exam_papers is
    # stored under. A sitting is dated by when it was handed in.
    "exam": """
        SELECT p.level, COUNT(*), COALESCE(SUM(a.correct), 0), COALESCE(SUM(a.total), 0),
               MAX(a.finished_at)
        FROM exam_attempts a
        JOIN exam_papers p ON p.exam_id = a.exam_id AND p.revision = a.revision
        WHERE a.user_id = %(user)s AND p.level = ANY(%(grades)s)
        GROUP BY p.level
    """,
}


def _figures(done, right, of, last) -> dict:
    return {"done": int(done), "right": int(right), "of": int(of), "last": last.isoformat()}


@router.get("/api/practice/record")
def practice_record(user_id: str = Depends(get_user_id)):
    record = {}
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            for platform, sql in QUERIES.items():
                cur.execute(sql, {"user": user_id, "grades": GRADES})
                record[platform] = {
                    level: _figures(done, right, of, last)
                    for level, done, right, of, last in cur.fetchall()
                }
    finally:
        conn.close()
    return record


# ── 駅の頁 — one stop of one platform (plan 158) ──────────────────────
#
#     GET /api/practice/stop/{platform}?stop=<key>
#
#     {"stop":   "freq:vocab:3",          # the key as normalised
#      "record": {"done", "right", "of", "last"} | null,
#      "misses": [{"jp", "sub", "score", "at"}, ...],   # newest first, <= 5
#      "known":  ["〜たら", ...]}           # a grade's studied grammar
#
# A stop is what a run was started from, and the key names it the way
# the run logs it:
#
#   N5 … N1              every platform; rows whose `level` is the
#                        grade, the rule /record counts a grade by
#   mastery              reading and translation; rows whose phase is
#                        "mastery"
#   freq:<domain>:<tier>[:<size>]
#                        reading and translation; rows whose phase is
#                        the tier's label (reading._source_label). The
#                        label carries the size only off the default,
#                        so freq:vocab:3:200 is freq:vocab:3 -- and so
#                        is every row logged before sizes were written,
#                        which is what those rows were.
#
# The page's other lists:
#
#   misses   reading, translation, dictation: the sentences the learner
#            got wrong the LAST time they met them here -- a sentence
#            missed and then got right has been learnt, and listing it
#            would say otherwise. `sub` is the grammar the curated bank
#            wrote the sentence for, when it is one of the bank's.
#            composition: the points whose sentence the learner rated a
#            miss, `sub` the sentence they wrote. comprehension: the
#            learner's texts, hit or miss, with their score -- a text
#            is read once, so "your texts" is the list worth having.
#   known    a grade's grammar points the learner has a card for at
#            Learn (a stage past "new" in any graded mode, the rule
#            composition's batch orders by), on the platforms whose
#            station lists the grade's points. Dictation names none.
#
# `lang` is sent by the client like every station read and accepted
# silently: everything this answers is the learner's Japanese.

STOP_TABLES = {
    "reading": "reading_log",
    "translation": "translation_log",
    "comprehension": "comprehension_log",
    "dictation": "dictation_log",
    "composition": "composition_log",
}
# The two platforms whose runs start from a frequency tier or from the
# learner's own cards as well as from a grade (reading.get_reading_batch).
SOURCED = ("reading", "translation")
TIER_DOMAINS = ("vocab", "vocab_jmdict")
KNOWN_PLATFORMS = ("reading", "translation", "comprehension", "composition")
MISSES = 5

# Each query reads (done, right, of, last) at one stop; {column} is
# "level" or "phase", chosen by _parse_stop, never by the request.
_STOP_SENTENCES = """
    SELECT COUNT(*), COUNT(*) FILTER (WHERE correct), COUNT(*), MAX(created_at)
    FROM {table}
    WHERE user_id = %(user)s AND {column} = %(value)s
"""
_STOP_TEXTS = """
    SELECT COUNT(*), COALESCE(SUM(score), 0), COALESCE(SUM(total), 0), MAX(created_at)
    FROM comprehension_log
    WHERE user_id = %(user)s AND {column} = %(value)s
"""
# The newest distinct sentences whose latest row here is a miss. The
# inner DISTINCT ON keeps each sentence's latest row; the outer WHERE
# drops the ones that row says were got right.
_LATEST_MISSES = """
    SELECT phrase, created_at
    FROM (
        SELECT DISTINCT ON (phrase) id, phrase, correct, created_at
        FROM {table}
        WHERE user_id = %(user)s AND {column} = %(value)s
        ORDER BY phrase, created_at DESC, id DESC
    ) latest
    WHERE NOT correct
    ORDER BY created_at DESC, id DESC
    LIMIT %(limit)s
"""
_COMPOSITION_MISSES = """
    SELECT pattern, sentence, created_at
    FROM composition_log
    WHERE user_id = %(user)s AND {column} = %(value)s AND NOT correct
    ORDER BY created_at DESC, id DESC
    LIMIT %(limit)s
"""
_TEXTS = """
    SELECT text, grammar, score, total, created_at
    FROM comprehension_log
    WHERE user_id = %(user)s AND {column} = %(value)s
    ORDER BY created_at DESC, id DESC
    LIMIT %(limit)s
"""


def _parse_stop(platform: str, stop: str) -> tuple[str, str]:
    """(the stop as normalised, the log column that selects its rows).
    400 on a key the platform's runs never log."""
    if stop in GRADES:
        return stop, "level"
    if platform in SOURCED:
        if stop == "mastery":
            return stop, "phase"
        parts = stop.split(":")
        if len(parts) in (3, 4) and parts[0] == "freq" and parts[1] in TIER_DOMAINS:
            numbers = [p for p in parts[2:] if p.isascii() and p.isdigit()]
            if len(numbers) == len(parts) - 2 and all(int(n) > 0 for n in numbers):
                tier = int(numbers[0])
                size = int(numbers[1]) if len(numbers) > 1 else freq.DEFAULT_TIER_SIZE
                return _source_label("frequency", None, parts[1], tier, size), "phase"
    raise HTTPException(status_code=400, detail=f"Unknown stop for {platform}: {stop}")


@lru_cache(maxsize=1)
def _bank_grammar() -> dict[str, str]:
    """jp -> the grammar point the curated reading bank wrote it for,
    over every level (a learner's mastery run meets any of them)."""
    out: dict[str, str] = {}
    for rows in reading_sentences.BY_LEVEL.values():
        for row in rows:
            out.setdefault(row["jp"], row["grammar"])
    return out


@lru_cache(maxsize=1)
def _seeds_by_text() -> dict[str, dict]:
    """A seed exercise by its text, at any level: a text the learner
    read from the seed pool is named by the seed's title."""
    return {seed["text"]: seed for seed in comprehension_seed.entries()}


def _text_line(text: str, logged_grammar, score: int, total: int, at) -> dict:
    seed = _seeds_by_text().get(text)
    if seed is not None:
        jp, points = seed["title"], seed.get("grammar") or []
    else:
        # A generated text has no title: its opening stands in.
        jp = text[:12] + "…" if len(text) > 12 else text
        points = logged_grammar if isinstance(logged_grammar, list) else []
    return {
        "jp": jp,
        "sub": " · ".join(str(p) for p in points) or None,
        "score": [int(score), int(total)],
        "at": at.isoformat(),
    }


def _known(platform: str, stop: str, user_id: str) -> list[str]:
    """The grade's points the learner has studied, in catalogue order --
    composition's batch's rule (routes/composition.get_composition_batch)."""
    if platform not in KNOWN_PLATFORMS or stop not in GRADES:
        return []
    points = GRAMMAR_POINTS_BY_LEVEL.get(stop) or []
    if not points:
        return []
    stages = grammar._folded_stages(points, stop, user_id)
    return [p["pattern"] for p in points if stages[grammar_to_id(p, stop)] != "new"]


@router.get("/api/practice/stop/{platform}")
def practice_stop(
    platform: str,
    stop: str = Query(..., description="N5..N1, or for reading/translation mastery or freq:<domain>:<tier>[:<size>]"),
    user_id: str = Depends(get_user_id),
):
    if platform not in STOP_TABLES:
        raise HTTPException(status_code=404, detail=f"Unknown platform: {platform}")
    key, column = _parse_stop(platform, stop)
    table = STOP_TABLES[platform]
    params = {"user": user_id, "value": key, "limit": MISSES}

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            figures = _STOP_TEXTS if platform == "comprehension" else _STOP_SENTENCES
            cur.execute(figures.format(table=table, column=column), params)
            done, right, of, last = cur.fetchone()
            record = _figures(done, right, of, last) if done else None

            if platform == "comprehension":
                cur.execute(_TEXTS.format(column=column), params)
                misses = [_text_line(*row) for row in cur.fetchall()]
            elif platform == "composition":
                cur.execute(_COMPOSITION_MISSES.format(column=column), params)
                misses = [
                    {"jp": pattern, "sub": sentence, "score": None, "at": at.isoformat()}
                    for pattern, sentence, at in cur.fetchall()
                ]
            else:
                cur.execute(_LATEST_MISSES.format(table=table, column=column), params)
                misses = [
                    {"jp": phrase, "sub": _bank_grammar().get(phrase), "score": None, "at": at.isoformat()}
                    for phrase, at in cur.fetchall()
                ]
    finally:
        conn.close()

    return {
        "stop": key,
        "record": record,
        "misses": misses,
        "known": _known(platform, key, user_id),
    }
