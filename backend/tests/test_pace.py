# ── The daily pace: counting, budgeting, enforcement ──────────────
# Enforcement lives in ONE place — batch_cache.pick_ids's new_limit —
# and every route passes its budget through verbatim, so the unit
# tests here carry the correctness and the endpoint test carries the
# plumbing (pace payload present, beyond_target accepted).
import contextlib
import unittest
import uuid

from core.db import db_conn
from core.pace import Pace, new_card_limit, resolve_pace
from core.srs_instance import srs
from srs import batch_cache


def _seed_reviews(user_id: str, rows: list[tuple[str, str]]) -> None:
    """rows: (raw_card_id, when_sql) — when_sql is a SQL expression."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            for raw_id, when_sql in rows:
                cur.execute(
                    f"INSERT INTO review_log (card_id, mode, quality, reviewed_at) "
                    f"VALUES (%s, 'kana.flashcard.f2b', 4, {when_sql})",
                    (f"{user_id}:{raw_id}",),
                )
        conn.commit()
    finally:
        conn.close()


def _set_target(user_id: str, target) -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO user_profiles (user_id, username, daily_new_target)
                VALUES (%s, %s, %s)
                ON CONFLICT (user_id) DO UPDATE SET daily_new_target = EXCLUDED.daily_new_target
                """,
                (user_id, f"p{uuid.uuid4().hex[:12]}", target),
            )
        conn.commit()
    finally:
        conn.close()


def _fresh_user() -> str:
    return f"pace-test-{uuid.uuid4().hex[:12]}"


class NewItemsTodayTests(unittest.TestCase):
    def test_counts_items_first_reviewed_today_not_reviews(self) -> None:
        user = _fresh_user()
        _seed_reviews(user, [
            # Introduced today — three reviews of it today still count once.
            ("kana_a", "NOW()"), ("kana_a", "NOW()"), ("kana_a", "NOW()"),
            # Introduced today, second item.
            ("kana_i", "NOW()"),
            # Introduced YESTERDAY, reviewed again today: not new today.
            ("kana_u", "NOW() - INTERVAL '1 day'"), ("kana_u", "NOW()"),
        ])
        self.assertEqual(srs.get_new_items_today(user), 2)

    def test_counts_items_not_card_mode_pairs(self) -> None:
        user = _fresh_user()
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                # One item first-seen today under TWO different modes —
                # the pace promised items, so this is one, not two.
                for mode in ("kana.flashcard.f2b", "kana.write"):
                    cur.execute(
                        "INSERT INTO review_log (card_id, mode, quality) VALUES (%s, %s, 4)",
                        (f"{user}:kana_e", mode),
                    )
            conn.commit()
        finally:
            conn.close()
        self.assertEqual(srs.get_new_items_today(user), 1)


class ResolvePaceTests(unittest.TestCase):
    def test_no_profile_row_means_no_pace(self) -> None:
        self.assertIsNone(resolve_pace(_fresh_user()))

    def test_null_target_means_no_pace(self) -> None:
        user = _fresh_user()
        _set_target(user, None)
        self.assertIsNone(resolve_pace(user))

    def test_pace_carries_target_and_spend(self) -> None:
        user = _fresh_user()
        _set_target(user, 5)
        _seed_reviews(user, [("kana_ka", "NOW()"), ("kana_ki", "NOW()")])
        pace = resolve_pace(user)
        self.assertEqual((pace.target, pace.new_today, pace.remaining), (5, 2, 3))
        self.assertEqual(pace.payload(), {"target": 5, "newToday": 2, "remaining": 3})

    def test_remaining_never_goes_negative(self) -> None:
        self.assertEqual(Pace(target=5, new_today=9).remaining, 0)

    def test_new_card_limit(self) -> None:
        pace = Pace(target=5, new_today=3)
        self.assertEqual(new_card_limit(pace, beyond_target=False), 2)
        # The 臨時列車: an explicit ask lifts the cap entirely.
        self.assertIsNone(new_card_limit(pace, beyond_target=True))
        self.assertIsNone(new_card_limit(None, beyond_target=False))


class PickIdsNewLimitTests(unittest.TestCase):
    def setUp(self) -> None:
        batch_cache.reset()

    def test_new_limit_caps_only_the_new_top_up(self) -> None:
        picked = batch_cache.pick_ids(
            "pl-k1", ["due1", "due2"], lambda limit: ["new1", "new2", "new3"],
            count=5, new_limit=1,
        )
        self.assertEqual(len(picked), 3)  # 2 due + exactly 1 new
        self.assertEqual(len([p for p in picked if p.startswith("new")]), 1)

    def test_new_limit_zero_serves_reviews_only(self) -> None:
        # Due cards are never withheld — a spent budget shifts a
        # session to reviews, never blocks it.
        picked = batch_cache.pick_ids(
            "pl-k2", ["due1", "due2"], lambda limit: ["new1"],
            count=5, new_limit=0,
        )
        self.assertEqual(sorted(picked), ["due1", "due2"])

    def test_none_means_unlimited(self) -> None:
        picked = batch_cache.pick_ids(
            "pl-k3", [], lambda limit: ["new1", "new2", "new3"],
            count=3, new_limit=None,
        )
        self.assertEqual(len(picked), 3)


# ── Plumbing through a real endpoint ──────────────────────────────
@contextlib.contextmanager
def _test_user_target(target):
    _set_target("test-user", target)
    try:
        yield
    finally:
        _set_target("test-user", None)


def test_batch_endpoint_reports_pace_and_accepts_beyond_target(client):
    with _test_user_target(7):
        body = client.get("/api/kana/cards?set_name=katakana_combos&mode=kana.flashcard.f2b").json()
        assert body["pace"] is not None
        assert body["pace"]["target"] == 7
        assert body["pace"]["remaining"] == max(0, 7 - body["pace"]["newToday"])

        beyond = client.get(
            "/api/kana/cards?set_name=katakana_combos&mode=kana.flashcard.f2b&beyond_target=true"
        )
        assert beyond.status_code == 200
        assert beyond.json()["pace"]["target"] == 7


def test_batch_endpoint_pace_is_null_without_a_target(client):
    body = client.get("/api/kana/cards?set_name=katakana_combos&mode=kana.flashcard.f2b").json()
    assert body["pace"] is None


def test_today_reports_pace(client):
    with _test_user_target(10):
        assert client.get("/api/today").json()["pace"]["target"] == 10
    assert client.get("/api/today").json()["pace"] is None


if __name__ == "__main__":
    unittest.main()
