import os
import threading
import unittest

os.environ.setdefault("DATABASE_URL", "postgresql://postgres:dev@localhost:5433/jp_test")

from srs.storage import Storage


class ThreadedPoolTests(unittest.TestCase):
    def test_concurrent_cursor_use_does_not_raise(self) -> None:
        storage = Storage(os.environ["DATABASE_URL"])
        errors = []

        def worker():
            try:
                for _ in range(20):
                    with storage.cursor() as cur:
                        cur.execute("SELECT 1")
                        cur.fetchone()
            except Exception as e:  # noqa: BLE001 - the test's whole point is catching this
                errors.append(e)

        threads = [threading.Thread(target=worker) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        storage.close()
        self.assertEqual(errors, [], f"concurrent pool access raised: {errors}")
