import unittest

from scripts.wipe_srs import OPTIONAL, PLAN, UNTOUCHED


class WipePlanTests(unittest.TestCase):
    """
    The wipe is irreversible and unscoped by default, so what it does NOT
    delete matters as much as what it does. These pin the plan itself
    rather than exercising the DB: the destructive path was verified by
    running it against a synthetic user and confirming another user's rows
    survived, which is not something to leave in a test suite.
    """

    def _tables(self, steps):
        return [t for t, _clause, _why in steps]

    def test_children_are_deleted_before_their_parents(self) -> None:
        # Real foreign keys: card_modes.card_id -> cards,
        # custom_cards.deck_id -> decks, deck_cards.deck_id -> decks.
        # Getting this backwards fails the DELETE at runtime, on a
        # destructive script, after it has already committed nothing.
        order = self._tables(PLAN + OPTIONAL)
        for child, parent in [
            ("card_modes", "cards"),
            ("custom_cards", "decks"),
            ("deck_cards", "decks"),
        ]:
            self.assertIn(child, order)
            self.assertIn(parent, order)
            self.assertLess(order.index(child), order.index(parent),
                            f"{child} must be deleted before {parent}")

    def test_review_log_goes_with_card_modes(self) -> None:
        # Clearing the schedule but not the history leaves XP, level,
        # streak and 段位 reading as though nothing was reset -- which is
        # exactly the bug this script exists to avoid, and the one
        # /api/stats/reset had.
        tables = self._tables(PLAN)
        self.assertIn("review_log", tables)
        self.assertIn("card_modes", tables)

    def test_streak_mends_goes_too(self) -> None:
        # srs._studied_days unions review_log with streak_mends, so a
        # bought-back day would keep a phantom "showed up" alive under an
        # otherwise empty log.
        self.assertIn("streak_mends", self._tables(PLAN))

    def test_cards_is_optional_not_default(self) -> None:
        # `cards` is only an id registry now; get_new_cards selects over
        # the ids the router passes rather than joining it.
        self.assertNotIn("cards", self._tables(PLAN))
        self.assertIn("cards", self._tables(OPTIONAL))

    def test_survivors_are_never_in_the_plan(self) -> None:
        deleted = set(self._tables(PLAN + OPTIONAL))
        overlap = deleted & set(UNTOUCHED)
        self.assertEqual(overlap, set(), f"listed as both deleted and kept: {overlap}")

    def test_the_things_the_user_chose_to_keep_are_named(self) -> None:
        # Cosmetics and claimed daruma were explicitly agreed to survive.
        # Naming them in UNTOUCHED is what makes that a decision on record
        # rather than an omission nobody notices.
        for table in ("user_cosmetics", "daruma_state", "exam_attempts",
                      "grammar_sentences"):
            self.assertIn(table, UNTOUCHED)

    def test_every_step_explains_itself(self) -> None:
        for table, clause, why in PLAN + OPTIONAL:
            self.assertTrue(why and len(why) > 10, f"{table} has no reason given")
            self.assertIn("%(", clause, f"{table} has no user-scoping placeholder")

    def test_user_scoping_uses_the_right_key(self) -> None:
        # card ids are "{user_id}:{raw_id}", so those tables scope by
        # prefix; the rest carry a user_id column. Mixing them up would
        # silently scope to nothing and delete nothing.
        by_prefix = {"review_log", "card_modes", "cards"}
        for table, clause, _why in PLAN + OPTIONAL:
            if table in by_prefix:
                self.assertIn("%(prefix)s", clause, table)
            elif table in {"custom_cards", "deck_cards"}:
                self.assertIn("deck_id IN", clause, table)
            else:
                self.assertIn("user_id = %(user)s", clause, table)


if __name__ == "__main__":
    unittest.main()
