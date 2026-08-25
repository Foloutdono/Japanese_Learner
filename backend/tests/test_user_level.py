import unittest

from core.user_level import resolve_level, DEFAULT_LEVEL, LEVELS
from study import difficulty


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


if __name__ == "__main__":
    unittest.main()
