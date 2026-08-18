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



class ScriptEnvTests(unittest.TestCase):
    """
    Scripts are run by hand from a shell that has sourced nothing, unlike
    the API which loads .env in main.py. core/db.py reads DATABASE_URL at
    module scope, so the load has to happen BEFORE that import or it does
    nothing at all -- and the symptom is psycopg2's "fe_sendauth: no
    password supplied", which reads like a Postgres auth problem rather
    than an unset variable. Reported from a real run.
    """

    SCRIPTS = ["wipe_srs.py", "generate_grammar_sentences.py"]

    def _source(self, name):
        from pathlib import Path
        path = Path(__file__).resolve().parents[1] / "scripts" / name
        return path.read_text(encoding="utf-8")

    def test_env_is_imported_before_anything_reads_it(self) -> None:
        for name in self.SCRIPTS:
            src = self._source(name)
            self.assertIn("import scripts._env", src, name)
            env_at = src.index("import scripts._env")
            # Every import that pulls in a module reading os.environ at
            # module scope must come after it.
            for later in ("from core.", "from study.", "from content."):
                if later in src:
                    self.assertLess(env_at, src.index(later),
                                    f"{name}: scripts._env must precede {later!r}")

    def test_the_ordering_is_explained_where_it_could_be_reordered(self) -> None:
        # An import sorter would happily move it and silently reintroduce
        # the bug, so the reason sits on the line itself.
        for name in self.SCRIPTS:
            line = next(l for l in self._source(name).splitlines()
                        if "import scripts._env" in l)
            self.assertIn("noqa", line, name)

if __name__ == "__main__":
    unittest.main()
