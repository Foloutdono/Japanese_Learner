"""
Persistence for generated grammar sentences.

Self-migrating, same pattern as study/exam_schema.py. Sentences are
materialised once per (level, pattern) and read forever: generation is
the expensive step and the result does not change, so a
generate-on-request design would pay for the same sentence every time it
is shown. It also keeps a study session off the LLM's latency and outage
path entirely -- a card either has its sentences or hides the hint.

`generator_version` travels with each row so a future prompt change can
regenerate selectively instead of wiping the table.
"""
import json

from core.db import db_conn


def ensure_grammar_sentence_schema() -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS grammar_sentences (
                    level             TEXT NOT NULL,
                    pattern           TEXT NOT NULL,
                    sentences         JSONB NOT NULL,
                    generator_version TEXT NOT NULL,
                    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    PRIMARY KEY (level, pattern)
                )
            """)
        conn.commit()
    finally:
        conn.close()


def save(level: str, pattern: str, sentences: list[dict], version: str) -> None:
    """Upsert one point's sentences. Overwrites on regeneration."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO grammar_sentences (level, pattern, sentences, generator_version)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (level, pattern) DO UPDATE
                    SET sentences = EXCLUDED.sentences,
                        generator_version = EXCLUDED.generator_version,
                        created_at = NOW()
                """,
                (level, pattern, json.dumps(sentences, ensure_ascii=False), version),
            )
        conn.commit()
    finally:
        conn.close()


def load_level(level: str) -> dict[str, list[dict]]:
    """{pattern: [{"jp","en"}, ...]} for one level. Absent = not generated."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT pattern, sentences FROM grammar_sentences WHERE level = %s",
                (level,),
            )
            return {row[0]: row[1] for row in cur.fetchall()}
    finally:
        conn.close()


def existing_patterns(level: str, version: str) -> set[str]:
    """
    Patterns already generated AT THIS VERSION. The generator script skips
    these, so a re-run costs nothing and an interrupted run resumes where
    it stopped instead of paying for the whole level again.
    """
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT pattern FROM grammar_sentences "
                "WHERE level = %s AND generator_version = %s",
                (level, version),
            )
            return {row[0] for row in cur.fetchall()}
    finally:
        conn.close()


def counts() -> list[tuple[str, int]]:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT level, COUNT(*) FROM grammar_sentences GROUP BY level ORDER BY level"
            )
            return cur.fetchall()
    finally:
        conn.close()
