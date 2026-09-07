# ── The level rule (plan 074) ─────────────────────────────────────
# Choosing a level marks the stops behind it known: mastered rows with
# their first check spread over six weeks, never a row that exists;
# moving down deletes nothing and holds the stops above back from the
# run. The pure half (which stops, which lanes) needs no database; the
# rows themselves run as a DEDICATED user, like test_journey.py, and
# every fixture use deletes what it wrote.
from datetime import datetime, timedelta, timezone

import pytest

from core.auth import prefixed
from core.db import db_conn
from core.srs_instance import srs
from main import app
from routes.profile import get_user_id
from study import card_index, daily_queue, level_rule
from study.daily_queue import PERSONAL, SECTION
import core.user_level as user_level

LUID = "level-rule-test-user"


# ── The arithmetic ────────────────────────────────────────────────
def test_stops_behind_and_between_follow_the_line():
    assert level_rule.stops_behind("N5") == []
    assert level_rule.stops_behind("N3") == ["N5", "N4"]
    assert level_rule.stops_behind("N1") == ["N5", "N4", "N3", "N2"]
    assert level_rule.stops_between("N5", "N4") == ["N4"]
    assert level_rule.stops_between("N5", "N2") == ["N4", "N3", "N2"]
    assert level_rule.stops_between("N4", "N4") == []


def test_known_batches_take_one_row_per_item_in_the_primary_mode():
    batches = level_rule.known_batches(["N5"])
    by_source = {source: (mode, ids) for source, mode, ids in batches}
    assert set(by_source) == {"vocab", "kanji", "grammar"}
    for source, (mode, ids) in by_source.items():
        assert mode == level_rule.primary_mode(source)
        assert mode.endswith(".flashcard.f2b")
        # The deck's ids, once each (two same-kana words share an id).
        assert ids == list(dict.fromkeys(card_index.raw_ids(source, "N5", mode)))
        assert len(ids) == len(set(ids))
    # Kana is a different door: never a JLPT stop's batch.
    assert not any(source == "kana" for source, _, _ in batches)


def test_hold_above_keeps_the_stops_at_or_behind_the_level():
    lanes = daily_queue.OrderedDict([
        ((SECTION, "kanji", "N5", "kanji.flashcard.f2b"), ["a"]),
        ((SECTION, "kanji", "N3", "kanji.flashcard.f2b"), ["b"]),
        ((SECTION, "vocab", "N4", "vocab.flashcard.f2b"), ["c"]),
        ((SECTION, "kana", "hiragana_basic", "kana.flashcard.f2b"), ["d"]),
        ((PERSONAL, 7, "Mots du boulot", "vocab.flashcard.f2b"), ["e"]),
    ])
    kept = daily_queue.hold_above(lanes, "N4")
    assert list(kept) == [
        (SECTION, "kanji", "N5", "kanji.flashcard.f2b"),
        (SECTION, "vocab", "N4", "vocab.flashcard.f2b"),
        (SECTION, "kana", "hiragana_basic", "kana.flashcard.f2b"),
        (PERSONAL, 7, "Mots du boulot", "vocab.flashcard.f2b"),
    ]
    # An unknown level holds nothing back: a guess must not hide a review.
    assert list(daily_queue.hold_above(lanes, None)) == list(lanes)
    assert list(daily_queue.hold_above(lanes, "N1")) == list(lanes)


# ── The rows ──────────────────────────────────────────────────────
def _wipe(user_id: str) -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM review_log WHERE card_id LIKE %s", (f"{user_id}:%",))
            cur.execute("DELETE FROM card_modes WHERE card_id LIKE %s", (f"{user_id}:%",))
            cur.execute("DELETE FROM cards WHERE id LIKE %s", (f"{user_id}:%",))
            cur.execute("DELETE FROM user_profiles WHERE user_id = %s", (user_id,))
        conn.commit()
    finally:
        conn.close()
    user_level._cache.pop(user_id, None)


@pytest.fixture()
def lclient(client):
    _wipe(LUID)
    app.dependency_overrides[get_user_id] = lambda: LUID
    try:
        yield client
    finally:
        app.dependency_overrides.pop(get_user_id, None)
        _wipe(LUID)


def _rows(user_id: str, mode: str) -> dict:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT card_id, interval_days, is_learning, total_reviews, next_review
                FROM card_modes WHERE mode = %s AND card_id LIKE %s
                """,
                (mode, f"{user_id}:%"),
            )
            return {r[0]: r for r in cur.fetchall()}
    finally:
        conn.close()


def test_seed_known_writes_mastered_rows_spread_over_the_horizon(lclient):
    mode = level_rule.primary_mode("kanji")
    ids = prefixed(card_index.raw_ids("kanji", "N5", mode)[:20], LUID)
    before = datetime.now(timezone.utc)

    written = srs.seed_known(ids, mode, spread_days=42)
    assert written == 20

    rows = _rows(LUID, mode)
    assert set(rows) == set(ids)
    stamps = sorted(r[4] for r in rows.values())
    # Every check lies within the horizon, evenly spread, the last one
    # exactly on it -- no day gets the whole batch.
    assert stamps[0] > before
    assert stamps[-1] <= before + timedelta(days=42, minutes=1)
    assert stamps[-1] >= before + timedelta(days=41, hours=23)
    gaps = [(b - a).total_seconds() for a, b in zip(stamps, stamps[1:])]
    assert max(gaps) - min(gaps) < 2
    # Mastered, to the same classification the map and the stats use.
    assert set(srs.get_bulk_stats(ids, mode).values()) == {"mastered"}
    for r in rows.values():
        assert r[2] is False and r[1] >= 21 and r[3] == 1

    # Idempotent: the second pass writes nothing and moves nothing.
    assert srs.seed_known(ids, mode, spread_days=42) == 0
    assert {k: v[4] for k, v in _rows(LUID, mode).items()} == {k: v[4] for k, v in rows.items()}


def test_seed_known_never_touches_a_row_that_exists(lclient):
    mode = level_rule.primary_mode("vocab")
    raw = card_index.raw_ids("vocab", "N5", mode)[:5]
    ids = prefixed(raw, LUID)
    # One card the learner is mid-way through learning.
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO cards(id) VALUES (%s) ON CONFLICT DO NOTHING", (ids[0],))
            cur.execute(
                """
                INSERT INTO card_modes(card_id, mode, interval_days, is_learning, learning_step,
                                       total_reviews, correct_reviews, next_review)
                VALUES (%s, %s, 0, TRUE, 1, 3, 1, NOW() - interval '1 hour')
                """,
                (ids[0], mode),
            )
        conn.commit()
    finally:
        conn.close()

    assert srs.seed_known(ids, mode) == 4
    learning = _rows(LUID, mode)[ids[0]]
    assert learning[2] is True and learning[1] == 0 and learning[3] == 3
    assert srs.count_rows(ids, mode) == 5
    assert srs.count_cards_with_rows(ids) == 5


def test_the_office_marks_the_stops_behind_the_boarding_level_known(lclient):
    r = lclient.post("/api/onboarding/complete", json={"jlptLevel": "N4", "dailyNewTarget": 10})
    assert r.status_code == 200
    rule = r.json()["levelRule"]
    expected = sum(len(ids) for _, _, ids in level_rule.known_batches(["N5"]))
    assert rule == {"direction": "up", "markedKnown": expected, "spreadWeeks": 6}
    assert expected > 0

    # A replay of the office costs nothing a second time.
    again = lclient.post("/api/onboarding/complete", json={"jlptLevel": "N4", "dailyNewTarget": 10})
    assert again.json()["levelRule"]["markedKnown"] == 0


def test_settings_previews_then_applies_a_move_up_and_a_move_down(lclient):
    lclient.post("/api/onboarding/complete", json={"jlptLevel": "N5", "dailyNewTarget": 10})
    n5 = sum(len(ids) for _, _, ids in level_rule.known_batches(["N5"]))
    n4 = sum(len(ids) for _, _, ids in level_rule.known_batches(["N4"]))

    same = lclient.get("/api/profile/learning/preview", params={"jlptLevel": "N5"}).json()
    assert same == {"direction": "same"}
    up = lclient.get("/api/profile/learning/preview", params={"jlptLevel": "N3"}).json()
    assert up == {"direction": "up", "markedKnown": n5 + n4, "spreadWeeks": 6}
    assert lclient.get("/api/profile/learning/preview", params={"jlptLevel": "N9"}).status_code == 422

    moved = lclient.patch("/api/profile/learning", json={"jlptLevel": "N3"})
    assert moved.status_code == 200
    assert moved.json()["levelRule"] == {"direction": "up", "markedKnown": n5 + n4, "spreadWeeks": 6}
    assert lclient.get("/api/profile").json()["jlptLevel"] == "N3"

    # Down to N5: the N4 cards are set aside, none deleted -- and the
    # rows are still there afterwards.
    down = lclient.get("/api/profile/learning/preview", params={"jlptLevel": "N5"}).json()
    n4_items = sum(len(ids) for ids in level_rule.item_batches(["N4"]))
    assert down["direction"] == "down" and down["deleted"] == 0
    assert 0 < down["setAside"] <= n4_items
    kanji_mode = level_rule.primary_mode("kanji")
    rows_before = len(_rows(LUID, kanji_mode))
    moved_down = lclient.patch("/api/profile/learning", json={"jlptLevel": "N5"})
    assert moved_down.json()["levelRule"]["direction"] == "down"
    assert len(_rows(LUID, kanji_mode)) == rows_before


def test_the_run_holds_the_stops_above_the_level_back(lclient):
    lclient.post("/api/onboarding/complete", json={"jlptLevel": "N4", "dailyNewTarget": 10})
    mode = level_rule.primary_mode("kanji")
    n3 = prefixed(card_index.raw_ids("kanji", "N3", mode)[:1], LUID)[0]
    n5 = prefixed(card_index.raw_ids("kanji", "N5", mode)[:1], LUID)[0]
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            for cid in (n3, n5):
                cur.execute("INSERT INTO cards(id) VALUES (%s) ON CONFLICT DO NOTHING", (cid,))
                cur.execute(
                    """
                    INSERT INTO card_modes(card_id, mode, interval_days, is_learning,
                                           total_reviews, correct_reviews, next_review)
                    VALUES (%s, %s, 3, FALSE, 2, 2, NOW() - interval '1 day')
                    ON CONFLICT (card_id, mode) DO UPDATE SET next_review = EXCLUDED.next_review,
                        is_learning = EXCLUDED.is_learning, interval_days = EXCLUDED.interval_days
                    """,
                    (cid, mode),
                )
        conn.commit()
    finally:
        conn.close()

    decks = {lane["deck"] for lane in lclient.get("/api/today").json()["lanes"] if lane["kind"] == "section"}
    assert "N5" in decks and "N3" not in decks
    served = {c["lane"]["deck"] for c in lclient.get("/api/today/cards", params={"count": 25}).json()["cards"]}
    assert "N3" not in served

    lclient.patch("/api/profile/learning", json={"jlptLevel": "N3"})
    decks = {lane["deck"] for lane in lclient.get("/api/today").json()["lanes"] if lane["kind"] == "section"}
    assert {"N5", "N3"} <= decks
