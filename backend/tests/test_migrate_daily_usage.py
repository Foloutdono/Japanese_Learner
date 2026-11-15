# scripts/migrate_daily_usage.py (plan 320): the two old counters fold
# into daily_usage under the routes' own feature names, a day counted in
# both is added, and the old tables are dropped. Run in one transaction
# that is rolled back, so the test leaves the database as it found it.
import uuid
from datetime import date

import routes.ocr as ocr
import routes.reading as reading
from core.db import db_conn
from scripts.migrate_daily_usage import MOVES, migrate


def test_the_features_are_the_routes_own():
    assert dict(MOVES) == {
        "ocr_usage": ocr.OCR_FEATURE,
        "comprehension_usage": reading.COMPREHENSION_FEATURE,
    }


def test_rows_are_carried_added_and_the_tables_dropped():
    uid = f"probe-{uuid.uuid4()}"
    today, before = date(2030, 1, 2), date(2030, 1, 1)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            for table, _feature in MOVES:
                cur.execute(f"""CREATE TABLE IF NOT EXISTS {table} (
                    user_id TEXT NOT NULL, day DATE NOT NULL,
                    count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (user_id, day))""")
            cur.execute("INSERT INTO ocr_usage VALUES (%s, %s, 3), (%s, %s, 7)",
                        (uid, today, uid, before))
            cur.execute("INSERT INTO comprehension_usage VALUES (%s, %s, 2)", (uid, today))
            # The new code already counted today once, before the run.
            cur.execute("INSERT INTO daily_usage VALUES (%s, 'ocr', %s, 4)", (uid, today))

            done = migrate(cur)

            assert {d[0] for d in done} == {"ocr_usage", "comprehension_usage"}
            cur.execute("SELECT feature, day, count FROM daily_usage WHERE user_id = %s "
                        "ORDER BY feature, day", (uid,))
            assert cur.fetchall() == [
                ("comprehension", today, 2),
                ("ocr", before, 7),
                ("ocr", today, 7),
            ]
            for table, _feature in MOVES:
                cur.execute("SELECT to_regclass(%s)", (f"public.{table}",))
                assert cur.fetchone()[0] is None
            # A second run finds nothing.
            assert migrate(cur) == []
    finally:
        conn.rollback()
        conn.close()
