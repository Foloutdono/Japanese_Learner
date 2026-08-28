import unittest
import uuid

import core.user_level as user_level
from core.db import db_conn
from core.user_level import resolve_level, DEFAULT_LEVEL, LEVELS
from study import difficulty


def _insert_profile(jlpt_level):
    """A throwaway user_profiles row; returns its user_id."""
    user_id = f"lvl-test-{uuid.uuid4().hex[:12]}"
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO user_profiles (user_id, username, jlpt_level) VALUES (%s, %s, %s)",
                (user_id, f"u{uuid.uuid4().hex[:12]}", jlpt_level),
            )
        conn.commit()
    finally:
        conn.close()
    return user_id


class ResolveLevelTests(unittest.TestCase):
    """
    resolve_level answers "what JLPT level should this learner be treated
    as, for this request". Precedence is explicit request, then (once
    onboarding exists) the stored learner level, then DEFAULT_LEVEL --
    and a bad request must fall through rather than raise, since it can
    come straight off a URL query parameter.
    """

    def test_explicit_valid_level_is_returned_unchanged(self) -> None:
        for level in LEVELS:
            self.assertEqual(resolve_level("u", level), level)

    def test_no_request_returns_default(self) -> None:
        self.assertEqual(resolve_level("u"), DEFAULT_LEVEL)
        self.assertEqual(resolve_level("u", None), DEFAULT_LEVEL)

    def test_invalid_request_falls_back_to_default_without_raising(self) -> None:
        for bad in ("bogus", "", "n5", "N6", "  N5  "):
            self.assertEqual(resolve_level("u", bad), DEFAULT_LEVEL)

    def test_default_level_is_itself_a_valid_level(self) -> None:
        self.assertIn(DEFAULT_LEVEL, LEVELS)

    def test_levels_is_not_a_second_copy_of_difficultys_ordering(self) -> None:
        self.assertIs(LEVELS, difficulty.LEVELS)


class StoredLevelTests(unittest.TestCase):
    """The onboarding step of the ladder: explicit request beats the
    stored user_profiles.jlpt_level beats DEFAULT_LEVEL (docs/adr/0005).
    Each test uses its own throwaway user so the module-level cache
    can't leak state between them; it is cleared anyway in setUp."""

    def setUp(self) -> None:
        user_level._cache.clear()

    def test_stored_level_beats_default(self) -> None:
        user_id = _insert_profile("N2")
        self.assertEqual(resolve_level(user_id), "N2")

    def test_explicit_request_beats_stored_level(self) -> None:
        user_id = _insert_profile("N2")
        self.assertEqual(resolve_level(user_id, "N4"), "N4")

    def test_garbage_stored_value_falls_through_to_default(self) -> None:
        user_id = _insert_profile("intermediate-ish")
        self.assertEqual(resolve_level(user_id), DEFAULT_LEVEL)

    def test_a_missing_level_is_never_cached(self) -> None:
        # The staleness bug this guards: complete onboarding, and the
        # very next resolve must see the new level — a cached "no level"
        # would serve N5 content to a fresh N2 graduate for a TTL.
        user_id = _insert_profile(None)
        self.assertEqual(resolve_level(user_id), DEFAULT_LEVEL)
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE user_profiles SET jlpt_level = 'N2' WHERE user_id = %s",
                    (user_id,),
                )
            conn.commit()
        finally:
            conn.close()
        self.assertEqual(resolve_level(user_id), "N2")

    def test_note_stored_level_is_visible_without_a_db_read(self) -> None:
        # Write-through from the endpoints that just wrote the column;
        # no user_profiles row needed at all to prove the cache path.
        user_id = f"lvl-test-{uuid.uuid4().hex[:12]}"
        user_level.note_stored_level(user_id, "N3")
        self.assertEqual(resolve_level(user_id), "N3")


if __name__ == "__main__":
    unittest.main()
