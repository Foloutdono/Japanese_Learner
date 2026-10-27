"""
対戦 — what happens to a duel when things go wrong (plan 276).

The owner's ask: a crash, a learner who leaves mid-duel, an account
deleted, and the rest -- every case ends in a state both players can
read, with the credits and the XP right. The server keeps the clock and
settles on every read, so most of it is « the next read puts it
straight »; the rest is what closing a duel owes the one who stays.
"""
from datetime import timedelta

import pytest

from core import credits
from routes.account import delete_user_rows
from study import duel_paper, duels
from tests.conftest import acting_as
from tests.pvp_world import (A, B, C, befriend, clock, keys, learners, place, play,  # noqa: F401
                             set_profile, sql)


@pytest.fixture(autouse=True)
def _quick_papers(monkeypatch):
    # As in test_duels: a paper per level, reused under each duel's seed.
    built = {}
    real = duel_paper.build_paper

    def build(seed, level):
        if level not in built:
            built[level] = real(seed, level)
        return {**built[level], "seed": seed}
    monkeypatch.setattr(duel_paper, "build_paper", build)


def _challenge(client, names, opponent=B, mode="async"):
    r = client.post("/api/pvp/duels", json={"opponent": names[opponent], "mode": mode})
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _ranked(client, user_id):
    with acting_as(user_id):
        r = client.post("/api/pvp/duels", json={"ranked": True})
        assert r.status_code == 200, r.text
        return r.json()


def _ledger(user_id, reason):
    return [d for (d,) in sql("SELECT delta FROM credit_ledger WHERE user_id = %s AND reason = %s ORDER BY id",
                              (user_id, reason), fetch=True)]


def _xp(user_id, duel_id):
    rows = sql("SELECT xp FROM xp_ledger WHERE user_id = %s AND source = 'duel' AND ref = %s",
               (user_id, f"duel:{duel_id}"), fetch=True)
    return sum(x for (x,) in rows)


def _status(duel_id):
    return sql("SELECT status FROM pvp_duels WHERE id = %s", (duel_id,), fetch=True)


def _answer(client, duel_id, n, pick):
    return client.post(f"/api/pvp/duels/{duel_id}/answer", json={"n": n, "pick": pick})


def _delete_account(client, user_id):
    with acting_as(user_id):
        assert client.delete("/api/account").status_code == 200


def _hall_row(client, duel_id, user_id=A):
    with acting_as(user_id):
        hall = client.get("/api/pvp").json()
    for group in ("toPlay", "live", "running", "done"):
        for row in hall[group]:
            if row["id"] == duel_id:
                return group, row
    return None, None


# ── A crash, a lost reply ───────────────────────────────────────────

def test_a_crash_mid_run_resumes_the_question_served_without_a_second_fare(client, learners, clock):
    for uid in (A, B):
        place(uid)
    left = _ranked(client, B)["id"]
    play(client, clock, B, left, [(1000, True)] * 3)
    assert _ranked(client, A) == {"id": left, "against": "seek"}
    play(client, clock, A, left, [(1000, True), (2000, True)], finish=False)
    before = sql("SELECT started_at FROM pvp_entries WHERE duel_id = %s AND user_id = %s", (left, A), fetch=True)
    # The app comes back and presses on: the same run, the same question.
    again = client.post(f"/api/pvp/duels/{left}/start").json()
    assert again["q"]["n"] == 2 and again["total"] == 100 + duels.points(2000)
    assert sql("SELECT started_at FROM pvp_entries WHERE duel_id = %s AND user_id = %s", (left, A), fetch=True) == before
    assert _ledger(A, "duel") == [-duels.RANKED_PRICE]


def test_a_reply_lost_on_the_way_is_answered_again_the_same(client, learners, clock):
    befriend(client, A, B, learners)
    duel_id = _challenge(client, learners)
    run = client.post(f"/api/pvp/duels/{duel_id}/start").json()
    clock.to(run["qAt"])
    clock.tick(900)
    key = keys(duel_id)
    first = _answer(client, duel_id, 0, key[0]).json()
    # The same answer sent again (the reply never reached the app), and
    # from a second device with another pick: the first one stands.
    clock.tick(400)
    assert _answer(client, duel_id, 0, key[0]).json() == first
    assert _answer(client, duel_id, 0, (key[0] + 1) % 4).json() == first
    cover = sql("SELECT score, rights, served_q FROM pvp_entries WHERE duel_id = %s AND user_id = %s",
                (duel_id, A), fetch=True)
    assert cover == [(100, 1, 1)]


def test_an_answer_after_the_minute_and_its_grace_is_over(client, learners, clock):
    befriend(client, A, B, learners)
    duel_id = _challenge(client, learners)
    run = client.post(f"/api/pvp/duels/{duel_id}/start").json()
    clock.to(run["endsAt"])
    clock.tick(duels.GRACE_MS + 1)
    reply = _answer(client, duel_id, run["q"]["n"], 0).json()
    assert reply["over"] is True and reply["total"] == 0
    # ...and a second press of « Partir » says the run is played.
    r = client.post(f"/api/pvp/duels/{duel_id}/start")
    assert r.status_code == 409 and r.json()["detail"]["code"] == "pvp_played"


def test_two_presses_of_start_charge_one_fare(client, learners, clock):
    place(A)
    duel_id = _ranked(client, A)["id"]
    for _ in range(2):
        assert client.post(f"/api/pvp/duels/{duel_id}/start").status_code == 200
    assert _ledger(A, "duel") == [-duels.RANKED_PRICE]


def test_the_corrections_bought_twice_cost_one_credit(client, learners, clock):
    befriend(client, A, B, learners)
    duel_id = _challenge(client, learners)
    play(client, clock, A, duel_id, [(1000, True)])
    play(client, clock, B, duel_id, [(1000, False)])
    for _ in range(2):
        assert client.post(f"/api/pvp/duels/{duel_id}/review").status_code == 200
    assert _ledger(A, "duel_review") == [-duels.REVIEW_PRICE]


# ── Leaving mid-duel ────────────────────────────────────────────────

def test_a_run_left_mid_minute_waits_in_the_hall_with_its_way_back_then_ends_with_what_was_answered(
        client, learners, clock):
    befriend(client, A, B, learners)
    duel_id = _challenge(client, learners)
    play(client, clock, A, duel_id, [(1000, True)] * 3, finish=False)
    # The screen left: the run is still the learner's, until its minute ends.
    group, row = _hall_row(client, duel_id)
    assert group == "running" and row["running"] is True and row["mine"] is None
    ends = row["endsAt"]
    resumed = client.post(f"/api/pvp/duels/{duel_id}/start").json()
    assert resumed["endsAt"] == ends and resumed["q"]["n"] == 3
    # Never back: the minute ends with the three answers, paid as practice.
    clock.to(ends)
    clock.tick(duels.GRACE_MS + 1)
    group, row = _hall_row(client, duel_id)
    assert group == "running" and "running" not in row and row["mine"] == 300
    assert _xp(A, duel_id) == 3 * 7
    cover = client.get(f"/api/pvp/duels/{duel_id}").json()
    assert cover["you"]["played"] is True and cover["you"]["score"] == 300


def test_a_run_left_in_the_countdown_ends_at_its_minute_with_nothing(client, learners, clock):
    befriend(client, A, B, learners)
    duel_id = _challenge(client, learners)
    run = client.post(f"/api/pvp/duels/{duel_id}/start").json()
    clock.to(run["endsAt"])
    clock.tick(duels.GRACE_MS + 1)
    play(client, clock, B, duel_id, [(1000, True)])
    cover = client.get(f"/api/pvp/duels/{duel_id}").json()
    assert cover["status"] == "done" and cover["result"]["outcome"] == "loss"
    assert cover["result"]["mine"] == 0 and cover["you"]["xp"] == 0


def test_a_challenge_never_played_expires_and_says_so_to_both(client, learners, clock):
    befriend(client, A, B, learners)
    duel_id = _challenge(client, learners)
    play(client, clock, A, duel_id, [(1000, True)])
    clock.tick(duels.WAIT.total_seconds() * 1000)
    assert client.get(f"/api/pvp/duels/{duel_id}").json()["status"] == "expired"
    with acting_as(B):
        assert client.get("/api/pvp").json()["toPlay"] == []
        r = client.post(f"/api/pvp/duels/{duel_id}/start")
        assert r.status_code == 409 and r.json()["detail"]["code"] == "pvp_closed"


# ── Live ────────────────────────────────────────────────────────────

def test_a_live_room_left_by_its_host_closes_for_the_friend(client, learners, clock):
    befriend(client, A, B, learners)
    duel_id = _challenge(client, learners, mode="live")
    with acting_as(B):
        assert [d["id"] for d in client.get("/api/pvp").json()["live"]] == [duel_id]
    clock.tick(duels.LOBBY.total_seconds() * 1000 + 1)
    with acting_as(B):
        assert client.get("/api/pvp").json()["live"] == []
        r = client.post(f"/api/pvp/duels/{duel_id}/join")
        assert r.status_code == 409 and r.json()["detail"]["code"] == "pvp_closed"


def test_a_live_race_left_by_one_player_is_settled_at_the_minute(client, learners, clock):
    befriend(client, A, B, learners)
    duel_id = _challenge(client, learners, mode="live")
    with acting_as(B):
        run = client.post(f"/api/pvp/duels/{duel_id}/join").json()
    # B races; A's app is gone. A's run is A's all the same: it ends at
    # the minute with nothing in it, and the duel is B's.
    play(client, clock, B, duel_id, [(1000, True)] * 2, finish=False)
    group, row = _hall_row(client, duel_id)
    assert group == "running" and row["running"] is True
    clock.to(run["endsAt"])
    clock.tick(duels.GRACE_MS + 1)
    cover = client.get(f"/api/pvp/duels/{duel_id}").json()
    assert cover["status"] == "done" and cover["result"]["outcome"] == "loss" and cover["you"]["xp"] == 0
    with acting_as(B):
        assert client.get(f"/api/pvp/duels/{duel_id}").json()["result"]["outcome"] == "win"


# ── An account erased ───────────────────────────────────────────────

def test_the_opponent_erasing_their_account_cancels_the_challenge_waiting_on_them(client, learners, clock):
    befriend(client, A, B, learners)
    duel_id = _challenge(client, learners)
    play(client, clock, A, duel_id, [(1000, True)])
    _delete_account(client, B)
    cover = client.get(f"/api/pvp/duels/{duel_id}").json()
    assert cover["status"] == "cancelled" and cover["result"] is None and cover["you"]["played"] is True
    assert _hall_row(client, duel_id) == (None, None)
    # A report of the duel's other player names nobody now.
    r = client.post("/api/pvp/reports", json={"duelId": duel_id, "reason": "cheat"})
    assert r.status_code == 404


def test_the_challenger_erasing_their_account_takes_the_challenge_back(client, learners, clock):
    befriend(client, A, B, learners)
    with acting_as(B):
        duel_id = _challenge(client, learners, opponent=A)
    assert [d["id"] for d in client.get("/api/pvp").json()["toPlay"]] == [duel_id]
    _delete_account(client, B)
    assert client.get("/api/pvp").json()["toPlay"] == []
    r = client.post(f"/api/pvp/duels/{duel_id}/start")
    assert r.status_code == 409 and r.json()["detail"]["code"] == "pvp_closed"


def test_an_account_erased_mid_race_ends_the_others_run_and_pays_it(client, learners, clock):
    befriend(client, A, B, learners)
    with acting_as(B):
        duel_id = _challenge(client, learners, opponent=A)
    play(client, clock, B, duel_id, [(1000, True)] * 4)
    play(client, clock, A, duel_id, [(1000, True)] * 2, finish=False)
    _delete_account(client, B)
    assert _status(duel_id) == [("cancelled",)]
    cover = client.get(f"/api/pvp/duels/{duel_id}").json()
    assert cover["you"]["played"] is True and cover["you"]["score"] == 200 and cover["you"]["xp"] == 2 * 7
    assert _xp(A, duel_id) == 2 * 7
    r = _answer(client, duel_id, 2, 0)
    assert r.status_code == 409 and r.json()["detail"]["code"] == "pvp_closed"


def test_two_runs_over_are_resolved_before_an_account_is_erased(client, learners, clock):
    befriend(client, A, B, learners)
    duel_id = _challenge(client, learners)
    play(client, clock, A, duel_id, [(1000, True)] * 2)
    # B's run ends with its minute, and nobody reads the duel before B
    # erases their account: the duel is A's win, not a cancellation.
    play(client, clock, B, duel_id, [(1000, True)], finish=False)
    clock.tick(duels.SPRINT_MS + duels.GRACE_MS + 1)
    _delete_account(client, B)
    cover = client.get(f"/api/pvp/duels/{duel_id}").json()
    assert cover["status"] == "done" and cover["result"]["outcome"] == "win"
    assert cover["them"] == {"username": None, "gone": True}


def test_a_seeker_mid_run_whose_runs_author_leaves_is_refunded_and_paid(client, learners, clock):
    for uid in (A, B):
        place(uid)
    left = _ranked(client, B)["id"]
    play(client, clock, B, left, [(1000, True)] * 3)
    assert _ranked(client, A)["against"] == "seek"
    play(client, clock, A, left, [(1000, True)], finish=False)
    _delete_account(client, B)
    assert _status(left) == [("cancelled",)]
    assert _ledger(A, "duel") == [-duels.RANKED_PRICE, duels.RANKED_PRICE]
    assert _xp(A, left) == 7
    you = client.get(f"/api/pvp/duels/{left}").json()["you"]
    assert you["refunded"] is True and you["answered"] == 1 and you["rights"] == 1
    # Nothing of B's is left to meet: no run, no ghost.
    assert sql("SELECT COUNT(*) FROM pvp_entries WHERE user_id = %s", (B,), fetch=True) == [(0,)]


def test_a_seat_taken_by_a_learner_who_leaves_goes_back_to_the_run(client, learners, clock):
    for uid in (A, B, C):
        place(uid)
    left = _ranked(client, B)["id"]
    play(client, clock, B, left, [(1000, True)] * 3)
    assert _ranked(client, C) == {"id": left, "against": "seek"}
    play(client, clock, C, left, [(1000, True)], finish=False)
    _delete_account(client, C)
    # B's run waits for a stranger again, B's fare untouched, and the
    # next ranked sprint meets it.
    assert _status(left) == [("open",)]
    assert _ledger(B, "duel") == [-duels.RANKED_PRICE]
    assert _ranked(client, A) == {"id": left, "against": "seek"}


def test_a_ghost_of_a_learner_who_leaves_closes_its_duel_and_is_never_served_again(client, learners, clock):
    for uid in (A, B, C):
        place(uid)
    # A done ranked duel between B and C: each run is now a recording.
    first = _ranked(client, B)["id"]
    play(client, clock, B, first, [(1000, True)] * 3)
    assert _ranked(client, C)["against"] == "seek"
    play(client, clock, C, first, [(1000, True)] * 2)
    met = _ranked(client, A)
    assert met["against"] == "ghost"
    (author,), = sql("SELECT user_id FROM pvp_entries WHERE duel_id = %s AND role = 'ghost'", (met["id"],), fetch=True)
    play(client, clock, A, met["id"], [(1000, True)], finish=False)
    _delete_account(client, author)
    assert _status(met["id"]) == [("cancelled",)]
    assert _ledger(A, "duel") == [-duels.RANKED_PRICE, duels.RANKED_PRICE]
    assert _xp(A, met["id"]) == 7
    # The next ranked sprint never meets the erased learner's runs.
    again = _ranked(client, A)
    ghost = sql("SELECT user_id FROM pvp_entries WHERE duel_id = %s AND role = 'ghost'", (again["id"],), fetch=True)
    assert (author,) not in ghost


def test_a_live_room_whose_host_leaves_the_app_for_good_closes(client, learners, clock):
    befriend(client, A, B, learners)
    with acting_as(B):
        duel_id = _challenge(client, learners, opponent=A, mode="live")
    assert [d["id"] for d in client.get("/api/pvp").json()["live"]] == [duel_id]
    _delete_account(client, B)
    assert client.get("/api/pvp").json()["live"] == []
    r = client.post(f"/api/pvp/duels/{duel_id}/join")
    assert r.status_code == 409 and r.json()["detail"]["code"] == "pvp_closed"


def test_the_orphan_purge_owes_the_other_player_their_fare(client, learners, clock):
    from core.db import db_conn
    for uid in (A, B):
        place(uid)
    left = _ranked(client, B)["id"]
    play(client, clock, B, left, [(1000, True)] * 3)
    _ranked(client, A)
    play(client, clock, A, left, [(1000, True)], finish=False)
    after: list = []
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            delete_user_rows(cur, B, after)
        conn.commit()
    finally:
        conn.close()
    # Nothing is given back before the erasure is committed...
    assert _ledger(A, "duel") == [-duels.RANKED_PRICE]
    for task in after:
        task()
    assert _ledger(A, "duel") == [-duels.RANKED_PRICE, duels.RANKED_PRICE]
    # ...and nothing is ever written for the learner erased.
    assert sql("SELECT COUNT(*) FROM credit_ledger WHERE user_id = %s", (B,), fetch=True) == [(0,)]
    assert sql("SELECT COUNT(*) FROM user_profiles WHERE user_id = %s", (B,), fetch=True) == [(0,)]


def test_one_purge_of_both_players_of_a_duel_makes_neither_again(client, learners, clock):
    # One sweep erases a run's author and the learner mid-run in its
    # seat: the closing for the first owes the second their fare, and
    # the second is gone by the time it would be paid. Nothing may be
    # written for either -- least of all a profile, made again with a
    # welcome bonus by the refund's own first read.
    import sys
    from unittest.mock import patch

    from core.db import db_conn
    from routes.account import user_ids_present
    from scripts import purge_orphans
    first, second = sorted((B, C))
    for uid in (first, second):
        place(uid)
    left = _ranked(client, first)["id"]
    play(client, clock, first, left, [(1000, True)] * 3)
    _ranked(client, second)
    play(client, clock, second, left, [(1000, True)], finish=False)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            live = user_ids_present(cur) - {first, second}
    finally:
        conn.close()
    saved = sys.argv
    sys.argv = ["purge_orphans", "--yes"]
    try:
        with patch.object(purge_orphans, "list_auth_user_ids", return_value=live):
            assert purge_orphans.main() == 0
    finally:
        sys.argv = saved
    for uid in (first, second):
        for table in ("user_profiles", "credit_ledger", "xp_ledger", "pvp_entries"):
            assert sql(f"SELECT COUNT(*) FROM {table} WHERE user_id = %s", (uid,), fetch=True) == [(0,)], (uid, table)
    assert _status(left) == []


# ── A block, a friendship ended ─────────────────────────────────────

def test_a_block_mid_race_ends_the_run_and_pays_what_was_answered(client, learners, clock):
    befriend(client, A, B, learners)
    duel_id = _challenge(client, learners)
    play(client, clock, A, duel_id, [(1000, True)] * 2, finish=False)
    with acting_as(B):
        assert client.post("/api/pvp/blocks", json={"username": learners[A]}).status_code == 200
    assert _status(duel_id) == [("cancelled",)]
    assert _xp(A, duel_id) == 2 * 7
    r = _answer(client, duel_id, 2, 0)
    assert r.status_code == 409 and r.json()["detail"]["code"] == "pvp_closed"
    cover = client.get(f"/api/pvp/duels/{duel_id}").json()
    assert cover["status"] == "cancelled" and cover["you"]["score"] == 200


def test_two_runs_over_are_resolved_rather_than_cancelled_by_an_unfriending(client, learners, clock):
    befriend(client, A, B, learners)
    duel_id = _challenge(client, learners)
    play(client, clock, A, duel_id, [(1000, True)])
    play(client, clock, B, duel_id, [(1000, True)] * 2, finish=False)
    clock.tick(duels.SPRINT_MS + duels.GRACE_MS + 1)
    assert client.delete(f"/api/pvp/friends/{learners[B]}").status_code == 200
    cover = client.get(f"/api/pvp/duels/{duel_id}").json()
    assert cover["status"] == "done" and cover["result"]["outcome"] == "loss"


# ── The day's XP, at local midnight ─────────────────────────────────

def test_the_days_cap_starts_again_at_the_learners_midnight(client, learners, clock):
    befriend(client, A, B, learners)
    sql("UPDATE user_profiles SET tz_offset_min = 0 WHERE user_id = %s", (A,))
    try:
        first = _challenge(client, learners)
        play(client, clock, A, first, [(1000, True)] * 30)
        assert _xp(A, first) == duels.XP_CAP
        play(client, clock, B, first, [(1000, True)])
        # The same evening, the cap holds; past midnight it is a new day.
        second = _challenge(client, learners)
        nxt = credits.next_midnight(0, clock.at)
        clock.to(nxt.isoformat())
        clock.tick(60_000)
        play(client, clock, A, second, [(1000, True)] * 2)
        assert _xp(A, second) == 2 * 7
    finally:
        sql("UPDATE user_profiles SET tz_offset_min = NULL WHERE user_id = %s", (A,))


def test_nothing_is_owed_twice_when_a_closing_is_read_again(client, learners, clock):
    for uid in (A, B):
        place(uid)
    left = _ranked(client, B)["id"]
    play(client, clock, B, left, [(1000, True)] * 3)
    _ranked(client, A)
    play(client, clock, A, left, [(1000, True)], finish=False)
    _delete_account(client, B)
    for _ in range(3):
        client.get(f"/api/pvp/duels/{left}")
        client.get("/api/pvp")
    clock.tick(duels.WAIT.total_seconds() * 1000)
    client.get("/api/pvp")
    assert _ledger(A, "duel") == [-duels.RANKED_PRICE, duels.RANKED_PRICE]
    assert _xp(A, left) == 7


def test_a_closing_ends_where_the_run_stood_not_later(client, learners, clock):
    befriend(client, A, B, learners)
    duel_id = _challenge(client, learners)
    play(client, clock, A, duel_id, [(1000, True)], finish=False)
    (started,), = sql("SELECT started_at FROM pvp_entries WHERE duel_id = %s AND user_id = %s",
                      (duel_id, A), fetch=True)
    clock.tick(5_000)
    with acting_as(B):
        client.delete(f"/api/pvp/friends/{learners[A]}")
    (finished,), = sql("SELECT finished_at FROM pvp_entries WHERE duel_id = %s AND user_id = %s",
                       (duel_id, A), fetch=True)
    assert started < finished <= started + timedelta(milliseconds=duels.SPRINT_MS)


def test_a_run_waiting_on_the_other_counts_every_answer_it_gave(client, learners, clock):
    befriend(client, A, B, learners)
    duel_id = _challenge(client, learners)
    play(client, clock, A, duel_id, [(1000, True), (1000, False), (1000, True)])
    you = client.get(f"/api/pvp/duels/{duel_id}").json()["you"]
    assert (you["rights"], you["answered"], you["refunded"]) == (2, 3, False)

