import unittest

import srs.batch_cache as batch_cache


class BatchCacheTests(unittest.TestCase):
    def setUp(self) -> None:
        batch_cache._batches.clear()
        batch_cache._initialized.clear()
        batch_cache._initialization_versions.clear()

    def test_cache_keys_are_user_scoped(self) -> None:
        key_a = batch_cache.key("user", "u1", "flashcard", "deck-a")
        key_b = batch_cache.key("user", "u2", "flashcard", "deck-a")

        batch_cache.ensure_initialized(key_a, lambda: None)
        batch_cache.ensure_initialized(key_b, lambda: None)

        self.assertIn(key_a, batch_cache._initialized)
        self.assertIn(key_b, batch_cache._initialized)
        self.assertNotEqual(key_a, key_b)

    def test_ensure_initialized_reuses_same_version(self) -> None:
        calls = []

        def init() -> None:
            calls.append("called")

        batch_cache.ensure_initialized("cache-key", init, version=("a", "b"))
        batch_cache.ensure_initialized("cache-key", init, version=("a", "b"))

        self.assertEqual(calls, ["called"])

    def test_ensure_initialized_reruns_for_new_version(self) -> None:
        calls = []

        def init() -> None:
            calls.append("called")

        batch_cache.ensure_initialized("cache-key", init, version=("a",))
        batch_cache.ensure_initialized("cache-key", init, version=("b",))

        self.assertEqual(calls, ["called", "called"])


if __name__ == "__main__":
    unittest.main()
