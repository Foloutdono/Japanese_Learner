# ── Exam tables ───────────────────────────────────────────────
# Self-migrating, same pattern routes/decks.py's _ensure_deck_schema
# uses. A generated paper is materialized once (exam_papers) rather
# than regenerated per request: getExam() is called independently by
# ExamRunner, by ExamResult on the reload path, and again inside
# submitAttempt to score — a generate-on-every-call design would grade
# a learner's answers against a different paper than they took. Attempts
# (exam_attempts) are persisted so the result screen survives a reload
# instead of depending only on React Router's in-memory location.state.
from core.db import db_conn


def ensure_exam_schema() -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS exam_papers (
                    exam_id           TEXT PRIMARY KEY,
                    level             TEXT NOT NULL,
                    seed              BIGINT NOT NULL,
                    generator_version TEXT NOT NULL,
                    paper             JSONB NOT NULL,
                    section_count     INTEGER NOT NULL,
                    question_count    INTEGER NOT NULL,
                    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS exam_attempts (
                    id          BIGSERIAL PRIMARY KEY,
                    user_id     TEXT NOT NULL,
                    exam_id     TEXT NOT NULL REFERENCES exam_papers(exam_id),
                    section_id  TEXT NOT NULL,
                    answers     JSONB NOT NULL,
                    review      JSONB NOT NULL,
                    per_section JSONB NOT NULL,
                    correct     INTEGER NOT NULL,
                    total       INTEGER NOT NULL,
                    started_at  TIMESTAMPTZ NOT NULL,
                    finished_at TIMESTAMPTZ NOT NULL,
                    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_exam_attempts_user
                ON exam_attempts(user_id, created_at DESC)
            """)
        conn.commit()
    finally:
        conn.close()
