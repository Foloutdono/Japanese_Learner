import os
import threading
import unittest

os.environ.setdefault("DATABASE_URL", "postgresql://postgres:dev@localhost:5433/jp_test")

from core.db import db_conn


class DbConnPoolTests(unittest.TestCase):
    def test_close_returns_connection_to_pool_not_terminates_it(self) -> None:
        # If close() tore the connection down instead of returning it to
        # the pool, opening N+1 connections where N=maxconn would exhaust
        # the pool. This proves reuse: open-close 25 times in a row (more
        # than the pool's own maxconn=20) and confirm none of it raises.
        for _ in range(25):
            conn = db_conn()
            with conn.cursor() as cur:
                cur.execute("SELECT 1")
                cur.fetchone()
            conn.close()

    def test_concurrent_use_does_not_raise(self) -> None:
        errors = []

        def worker():
            try:
                for _ in range(15):
                    conn = db_conn()
                    try:
                        with conn.cursor() as cur:
                            cur.execute("SELECT 1")
                            cur.fetchone()
                    finally:
                        conn.close()
            except Exception as e:  # noqa: BLE001 - the test's whole point is catching this
                errors.append(e)

        threads = [threading.Thread(target=worker) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        self.assertEqual(errors, [], f"concurrent pooled db_conn() use raised: {errors}")

    def test_pooled_connection_passes_through_attributes(self) -> None:
        # __getattr__ passthrough is what keeps every existing call site
        # (conn.commit(), conn.autocommit = ..., conn.cursor()) working
        # unmodified -- confirm the wrapper doesn't hide anything real
        # callers use.
        conn = db_conn()
        try:
            self.assertFalse(conn.autocommit)
            self.assertTrue(hasattr(conn, "commit"))
            self.assertTrue(hasattr(conn, "rollback"))
        finally:
            conn.close()

    def test_attribute_assignment_reaches_real_connection(self) -> None:
        conn = db_conn()
        try:
            conn.autocommit = True
            self.assertTrue(conn._conn.autocommit)  # not just conn.autocommit -- that would pass even with the bug
        finally:
            conn.autocommit = False  # restore before returning to the pool
            conn.close()
