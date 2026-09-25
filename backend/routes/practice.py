"""
実践の記録 — what a learner has done on each practice platform, by grade
(plan 130).

The Practice gate on the desk hangs each platform's five grades as rows,
and a row says what the learner has done there: how many sentences,
texts or papers, and the share of them that went right. Everything is
read from the logs the six platforms already keep, and nothing is
stored here.

    GET /api/practice/record

    {"reading":       {"N5": {"done": 24, "right": 20, "of": 24}, ...},
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

A grade with nothing logged is absent rather than zero, so the client
can say "not yet" without reading a zero as a result. Only the five
JLPT grades are read: reading and translation log '' for a frequency or
own-cards run, which has no grade and is behind no grade's row.
"""
from fastapi import APIRouter, Depends

from core.auth import get_user_id
from core.db import db_conn

router = APIRouter()

GRADES = ["N5", "N4", "N3", "N2", "N1"]

# One query per platform, each answering (level, done, right, of). The
# table names are literals here rather than parameters: SQL cannot bind
# an identifier, and nothing a request carries reaches this string.
_SENTENCES = """
    SELECT level, COUNT(*), COUNT(*) FILTER (WHERE correct), COUNT(*)
    FROM {table}
    WHERE user_id = %(user)s AND level = ANY(%(grades)s)
    GROUP BY level
"""
QUERIES = {
    "reading": _SENTENCES.format(table="reading_log"),
    "comprehension": """
        SELECT level, COUNT(*), COALESCE(SUM(score), 0), COALESCE(SUM(total), 0)
        FROM comprehension_log
        WHERE user_id = %(user)s AND level = ANY(%(grades)s)
        GROUP BY level
    """,
    "translation": _SENTENCES.format(table="translation_log"),
    "dictation": _SENTENCES.format(table="dictation_log"),
    "composition": _SENTENCES.format(table="composition_log"),
    # A paper's grade is the paper's, not the attempt's: the attempt
    # names its paper by (exam_id, revision), the key exam_papers is
    # stored under.
    "exam": """
        SELECT p.level, COUNT(*), COALESCE(SUM(a.correct), 0), COALESCE(SUM(a.total), 0)
        FROM exam_attempts a
        JOIN exam_papers p ON p.exam_id = a.exam_id AND p.revision = a.revision
        WHERE a.user_id = %(user)s AND p.level = ANY(%(grades)s)
        GROUP BY p.level
    """,
}


@router.get("/api/practice/record")
def practice_record(user_id: str = Depends(get_user_id)):
    record = {}
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            for platform, sql in QUERIES.items():
                cur.execute(sql, {"user": user_id, "grades": GRADES})
                record[platform] = {
                    level: {"done": int(done), "right": int(right), "of": int(of)}
                    for level, done, right, of in cur.fetchall()
                }
    finally:
        conn.close()
    return record
