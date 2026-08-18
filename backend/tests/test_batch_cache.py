import unittest

import srs.batch_cache as batch_cache


class BatchCacheTests(unittest.TestCase):
    """
    The three ensure_initialized tests that used to live here went with
    the function itself — its only job was running the pre-materialising
    srs.ensure_cards() once per (key, deck-contents), and that pre-write
    is gone (see srs.get_new_cards). What remains is the new-card pool.
    """

    def setUp(self) -> None:
        batch_cache._batches.clear()

    def test_cache_keys_are_user_scoped(self) -> None:
        key_a = batch_cache.key("user", "u1", "kana.flashcard.f2b", "deck-a")
        key_b = batch_cache.key("user", "u2", "kana.flashcard.f2b", "deck-a")
        self.assertNotEqual(key_a, key_b)

    def test_key_skips_none_parts(self) -> None:
        self.assertEqual(batch_cache.key("user", None, "x"), "user:x")

    def test_take_batch_pops_without_repeating(self) -> None:
        pool = ["a", "b", "c", "d"]

        def fetch(limit):
            taken, pool[:] = pool[:limit], pool[limit:]
            return taken

        first = batch_cache.take_batch("k", fetch, count=2)
        second = batch_cache.take_batch("k", fetch, count=2)
        self.assertEqual(len(first), 2)
        self.assertEqual(len(second), 2)
        self.assertEqual(set(first) & set(second), set())

    def test_take_batch_returns_short_when_pool_is_exhausted(self) -> None:
        # A short result means "nothing left" — callers must not retry.
        self.assertEqual(batch_cache.take_batch("k", lambda limit: [], count=5), [])

    def test_pick_ids_prefers_due_and_excludes_queued(self) -> None:
        picked = batch_cache.pick_ids(
            "k", ["due1", "due2", "due3"], lambda limit: ["new1"],
            count=2, exclude_ids={"due2"},
        )
        self.assertEqual(len(picked), 2)
        self.assertNotIn("due2", picked)
        self.assertNotIn("new1", picked)  # due ids alone already filled the request

    def test_pick_ids_tops_up_from_new_when_due_is_short(self) -> None:
        picked = batch_cache.pick_ids(
            "k", ["due1"], lambda limit: ["new1", "new2"], count=3,
        )
        self.assertEqual(picked[0], "due1")
        self.assertEqual(set(picked[1:]), {"new1", "new2"})

    def test_reset_clears_pools(self) -> None:
        batch_cache.take_batch("k", lambda limit: ["a", "b", "c"], count=1)
        self.assertIn("k", batch_cache._batches)
        batch_cache.reset()
        self.assertEqual(batch_cache._batches, {})

    def test_reset_with_prefix_only_clears_matching(self) -> None:
        batch_cache.take_batch("user:u1:m", lambda limit: ["a", "b"], count=1)
        batch_cache.take_batch("user:u2:m", lambda limit: ["c", "d"], count=1)
        batch_cache.reset("user:u1")
        self.assertNotIn("user:u1:m", batch_cache._batches)
        self.assertIn("user:u2:m", batch_cache._batches)


if __name__ == "__main__":
    unittest.main()
