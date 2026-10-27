"""対戦 — the Elo (plan 279, study/duel_elo.py), its start from the
placement test, and what reads the duels' rows by hand: the reports'
reader and the pruning of duels nobody played."""
from datetime import timedelta

import pytest

from scripts import prune_logs, read_reports
from study import duel_elo
from tests.conftest import acting_as
from tests.pvp_world import A, B, befriend, clock, learners, place, play, sql  # noqa: F401


# ── The arithmetic ──────────────────────────────────────────────────

def test_the_expectation_is_the_classic_one():
    assert duel_elo.expected(1000, 1000) == 0.5
    assert duel_elo.expected(1400, 1000) == pytest.approx(10 / 11)
    assert duel_elo.expected(1000, 1400) + duel_elo.expected(1400, 1000) == pytest.approx(1)


def test_k_is_high_while_provisional_then_settles():
    assert duel_elo.rated(1000, 1000, 1, 0, []) == 1020
    assert duel_elo.rated(1000, 1000, 1, duel_elo.PROVISIONAL, []) == 1010
    assert duel_elo.rated(1000, 1000, 0.5, 3, []) == 1000


def test_nobody_falls_under_the_floor():
    assert duel_elo.rated(duel_elo.FLOOR, 2000, 0, 40, []) == duel_elo.FLOOR


def test_a_strong_learner_on_a_fresh_account_keeps_k_high():
    # Ten wins against players 300 above: a performance far over the Elo.
    strong = [(1300, 1.0)] * 10
    assert duel_elo.is_smurf(1000, 20, strong)
    assert duel_elo.k_factor(1000, 20, strong) == duel_elo.K_PROVISIONAL
    # Not before SMURF_GAMES duels, and not on a record that is merely good.
    assert not duel_elo.is_smurf(1000, duel_elo.SMURF_GAMES - 1, strong)
    mixed = [(1300, 1.0)] * 7 + [(1300, 0.0)] * 3
    assert not duel_elo.is_smurf(1000, 20, mixed)
    assert duel_elo.k_factor(1000, 20, mixed) == duel_elo.K_SETTLED


# ── The start comes from the placement test ─────────────────────────

def _climb_to_the_end(client):
    """Stop the placement climb at its first level: « too hard »."""
    step = client.post("/api/onboarding/placement/start").json()
    step = client.post("/api/onboarding/placement/answer",
                       json={"seed": step["seed"], "answers": {}, "stop": True}).json()
    assert step["done"]
    return step


def test_the_climbs_verdict_is_the_starting_elo(client, learners):
    step = _climb_to_the_end(client)
    level = step["recommendedLevel"]
    rows = sql("SELECT rating, placed_level, games FROM pvp_ratings WHERE user_id = %s", (A,), fetch=True)
    assert rows == [(duel_elo.START[level], level, 0)]
    assert client.get("/api/pvp/rating").json()["elo"] == duel_elo.START[level]


def test_taking_the_test_again_does_not_reset_an_elo_in_play(client, learners):
    place(A, "N3")
    assert sql("SELECT rating FROM pvp_ratings WHERE user_id = %s", (A,), fetch=True) == [(1400,)]
    place(A, "N4")
    assert sql("SELECT rating FROM pvp_ratings WHERE user_id = %s", (A,), fetch=True) == [(1200,)]
    sql("UPDATE pvp_ratings SET games = 1, rating = 1234 WHERE user_id = %s", (A,))
    place(A, "N1")
    assert sql("SELECT rating, placed_level FROM pvp_ratings WHERE user_id = %s", (A,), fetch=True) == [(1234, "N4")]


# ── The reports, read by a person ───────────────────────────────────

def test_the_reports_reader_names_both_sides(client, learners):
    client.post("/api/pvp/reports", json={"username": learners[B], "reason": "name"})
    with acting_as(B):
        client.post("/api/pvp/reports", json={"username": learners[A], "reason": "spam"})
    conn = _conn()
    try:
        with conn.cursor() as cur:
            rows = [r for r in read_reports.fetch(cur, 30, None, None) if r["user_id"] in (A, B)]
            assert {(r["reporter"], r["reported"], r["reason"]) for r in rows} == {
                (learners[A], learners[B], "name"), (learners[B], learners[A], "spam")}
            only = read_reports.fetch(cur, 30, "spam", learners[A])
            assert [r["reason"] for r in only] == ["spam"]
    finally:
        conn.close()
    text = read_reports.render(B, [r for r in rows if r["reported_id"] == B])
    assert learners[B] in text and "**name**" in text and learners[A] in text


def _conn():
    from core.db import db_conn
    return db_conn()


# ── A duel nobody played is collected ───────────────────────────────

def test_a_duel_nobody_played_is_pruned_after_a_month(client, learners, clock):
    befriend(client, A, B, learners)
    unplayed = client.post("/api/pvp/duels", json={"opponent": learners[B], "mode": "async"}).json()["id"]
    with acting_as(B):
        client.post(f"/api/pvp/duels/{unplayed}/decline")
    played = client.post("/api/pvp/duels", json={"opponent": learners[B], "mode": "async"}).json()["id"]
    play(client, clock, A, played, [(1000, True)])
    with acting_as(B):
        client.post(f"/api/pvp/duels/{played}/decline")
    sql("UPDATE pvp_duels SET resolved_at = NOW() - %s WHERE id = ANY(%s)",
        (timedelta(days=prune_logs.UNPLAYED_DUEL_DAYS + 1), [unplayed, played]))
    conn = _conn()
    try:
        with conn.cursor() as cur:
            assert prune_logs._unplayed_duels(cur, prune_logs.UNPLAYED_DUEL_DAYS, A, count_only=True) == 1
            assert prune_logs._unplayed_duels(cur, prune_logs.UNPLAYED_DUEL_DAYS, A, count_only=False) == 1
        conn.commit()
    finally:
        conn.close()
    assert sql("SELECT id FROM pvp_duels WHERE id = ANY(%s)", ([unplayed, played],), fetch=True) == [(played,)]
