"""
対戦 — what happens to a duel when things go wrong (plan 279).

The owner's ask: a crash, a learner who leaves mid-duel, an account
deleted, and the rest -- every case ends in a state both players can
read, with the credits and the XP right. The server keeps the clock and
settles on every read, so most of it is « the next read puts it
straight »; the rest is what closing a duel owes the one who stays.
"""
from datetime import datetime, timedelta

import pytest

from core import credits
from routes.account import delete_user_rows
from study import duel_paper, duels
from tests.conftest import acting_as
from tests.pvp_world import (A, B, C, befriend, clock, keys, learners, place, play,  # noqa: F401
                             set_profile, sql)


@pytest.fixture(autouse=True)
def _quick_papers(monkeypatch):
    # As in test_duels: a paper per level (and revision), reused under
    # each duel's seed.
    built = {}
    real = duel_paper.build_paper

    def build(seed, level=None, mix=None):
        key = (duel_paper.PAPER_REV, level, mix)
        if key not in built:
            built[key] = real(seed, level, mix)
        return {**built[key], "seed": seed}
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


def _at_noon(clock, user_id):
    """The clock at today's noon on `user_id`'s own clock (UTC, the
    offset another test may have left on the profile put back after)."""
    from datetime import datetime, timezone
    (tz,), = sql("SELECT tz_offset_min FROM user_profiles WHERE user_id = %s", (user_id,), fetch=True)
    sql("UPDATE user_profiles SET tz_offset_min = 0 WHERE user_id = %s", (user_id,))
    _restore.append(lambda: sql("UPDATE user_profiles SET tz_offset_min = %s WHERE user_id = %s", (tz, user_id)))
    today = datetime.now(timezone.utc).date()
    clock.at = datetime(today.year, today.month, today.day, 12, tzinfo=timezone.utc)


_restore: list = []


@pytest.fixture(autouse=True)
def _put_back():
    yield
    while _restore:
        _restore.pop()()


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

    def erase(commit):
        after: list = []
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                delete_user_rows(cur, B, after)
            conn.commit() if commit else conn.rollback()
        finally:
            conn.close()
        for task in after if commit else ():
            task()
    for uid in (A, B):
        place(uid)
    left = _ranked(client, B)["id"]
    play(client, clock, B, left, [(1000, True)] * 3)
    _ranked(client, A)
    play(client, clock, A, left, [(1000, True)], finish=False)
    # The fare is given back in the erasure's own transaction: never
    # without it (an erasure that fails gives nothing back)...
    erase(commit=False)
    assert _ledger(A, "duel") == [-duels.RANKED_PRICE]
    assert _status(left) == [("open",)]
    # ...and never lost after it.
    erase(commit=True)
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



# ── The server under strain ─────────────────────────────────────────

def test_a_dead_connection_still_goes_back_to_the_pool(learners):
    import psycopg2
    from core import db

    def kill(pid):
        conn = psycopg2.connect(db.DATABASE_URL)
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute("SELECT pg_terminate_backend(%s)", (pid,))
        conn.close()
    # The connection the next request is lent (the pool keeps one idle,
    # and lends it first), dropped by the server under it.
    probe = db.db_conn()
    pid = probe.get_backend_pid()
    probe.close()
    free = db._pool._slots._value
    kill(pid)
    with pytest.raises(psycopg2.Error):
        duels.run(duels.hub, A)
    assert db._pool._slots._value == free


def test_a_deadlock_is_run_again_once_and_its_first_try_forgotten():
    import psycopg2.errors
    tries, told = [], []

    def fn(cur, after):
        tries.append(1)
        after.append(lambda n=len(tries): told.append(n))
        if len(tries) == 1:
            raise psycopg2.errors.DeadlockDetected("deadlock detected")
        cur.execute("SELECT 1")
        return "settled"
    assert duels.run(fn) == "settled"
    assert len(tries) == 2 and told == [2]

    def always(cur, after):
        raise psycopg2.errors.DeadlockDetected("deadlock detected")
    with pytest.raises(psycopg2.errors.DeadlockDetected):
        duels.run(always)


def test_one_run_has_one_seat_whatever_two_seekers_do(client, learners, clock):
    import psycopg2
    for uid in (A, B):
        place(uid)
    left = _ranked(client, A)["id"]
    play(client, clock, A, left, [(1000, True)] * 3)
    assert _ranked(client, B) == {"id": left, "against": "seek"}
    # The base refuses a second learner in the seat, however they got there.
    with pytest.raises(psycopg2.errors.UniqueViolation):
        sql("INSERT INTO pvp_entries (duel_id, user_id, role) VALUES (%s, %s, 'opponent')", (left, C))


def test_two_seekers_racing_for_one_run_never_share_its_seat(client, learners, clock):
    # The seek reads the runs still alone on the statement's snapshot,
    # then locks one: a seeker who took it and committed while the
    # statement ran is seen only by the count made under the lock. Slow
    # the statement with runs farther off, start the second seeker half
    # way through it, and the first one's seat is the one it reaches.
    import threading
    import time

    from core.db import db_conn
    decoy = "pvp-test-decoy-"

    def clean():
        sql(f"DELETE FROM pvp_duels WHERE id IN (SELECT duel_id FROM pvp_entries WHERE user_id LIKE '{decoy}%%')")
        sql(f"DELETE FROM pvp_ratings WHERE user_id LIKE '{decoy}%%'")
    clean()
    try:
        for uid in (A, B, C):
            place(uid)
        left = _ranked(client, A)["id"]
        play(client, clock, A, left, [(1000, True)] * 3)
        sql(f"""
            WITH d AS (
              INSERT INTO pvp_duels (kind, mode, level, seed, paper_rev, paper, status, ghost, created_at, expires_at)
              SELECT 'ranked', 'async', 'N5', 900000000 + g, 'decoy', '{{}}'::jsonb, 'open', false,
                     now(), now() + interval '48 hours'
                FROM generate_series(1, 4000) g
              RETURNING id, seed)
            INSERT INTO pvp_entries (duel_id, user_id, role, started_at, finished_at, created_at)
            SELECT id, '{decoy}' || seed, 'challenger', now(), now(), now() FROM d
        """)
        sql(f"INSERT INTO pvp_ratings (user_id, rating, peak, placed_level, placed_at) "
            f"SELECT '{decoy}' || (900000000 + g), 1150, 1150, 'N5', now() FROM generate_series(1, 4000) g")
        for table in ("pvp_duels", "pvp_entries", "pvp_ratings"):
            sql(f"ANALYZE {table}")
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                t = time.perf_counter()
                duels._seek(cur, C, 1000, 0, clock())
                took = time.perf_counter() - t
            conn.rollback()
        finally:
            conn.close()
        got, failed = {}, []

        def seek(uid, delay):
            time.sleep(delay)
            try:
                got[uid] = duels.run(duels.ranked, uid)
            except Exception as exc:  # pragma: no cover - the failure being looked for
                failed.append(exc)
        threads = [threading.Thread(target=seek, args=(B, 0.0)), threading.Thread(target=seek, args=(C, took / 2))]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        assert failed == []
        seated = sql("SELECT user_id FROM pvp_entries WHERE duel_id = %s ORDER BY user_id", (left,), fetch=True)
        assert len(seated) == 2
        assert sorted(d for d, _against in got.values()).count(left) == 1
    finally:
        clean()


def test_two_of_a_learners_duels_resolved_at_once_move_the_elo_twice(client, learners, clock):
    import threading

    from core.db import db_conn
    for uid in (A, B, C):
        place(uid)
    d1 = _ranked(client, A)["id"]
    play(client, clock, A, d1, [(1000, True)] * 2)
    d2 = _ranked(client, A)["id"]
    play(client, clock, A, d2, [(1000, True)] * 2)
    assert _ranked(client, B) == {"id": d1, "against": "seek"}
    assert _ranked(client, C) == {"id": d2, "against": "seek"}
    play(client, clock, B, d1, [(1000, True)] * 5, finish=False)
    play(client, clock, C, d2, [(1000, True)] * 5, finish=False)
    clock.tick(duels.SPRINT_MS + duels.LEAD_MS + duels.GRACE_MS + 1000)
    now = clock()
    # B's read resolves d1 and holds it; C's read of d2 at the same
    # moment waits for A's Elo, and moves the one d1 left.
    first = db_conn()
    cur = first.cursor()
    duel, entries, _mine = duels._load(cur, B, d1)
    duels.settle(cur, [], duel, entries, now)

    def second():
        conn = db_conn()
        try:
            with conn.cursor() as cur2:
                duel2, entries2, _m = duels._load(cur2, C, d2)
                duels.settle(cur2, [], duel2, entries2, now)
            conn.commit()
        finally:
            conn.close()
    t = threading.Thread(target=second)
    t.start()
    t.join(timeout=1.5)
    assert t.is_alive()
    first.commit()
    first.close()
    t.join(timeout=10)
    moves = sql("SELECT rating_before, rating_after FROM pvp_entries WHERE user_id = %s AND duel_id = ANY(%s) "
                "ORDER BY rating_before DESC", (A, [d1, d2]), fetch=True)
    (rating, games), = sql("SELECT rating, games FROM pvp_ratings WHERE user_id = %s", (A,), fetch=True)
    assert games == 2
    assert moves[1][0] == moves[0][1] and rating == moves[1][1] < moves[0][1]


def test_two_of_a_learners_runs_settled_at_once_keep_the_days_cap(client, learners, clock):
    import threading

    from core.db import db_conn
    befriend(client, A, B, learners)
    befriend(client, A, C, learners)
    # At noon on the learner's clock, so no run of it crosses a midnight.
    _at_noon(clock, A)
    sql("INSERT INTO xp_ledger (user_id, source, ref, xp, awarded_at) VALUES (%s, 'duel', 'pvp-test', 100, %s)",
        (A, clock()))
    d1 = _challenge(client, learners, opponent=B)
    d2 = _challenge(client, learners, opponent=C)
    play(client, clock, A, d1, [(1000, True)] * 10, finish=False)
    play(client, clock, A, d2, [(1000, True)] * 10, finish=False)
    clock.tick(duels.SPRINT_MS + duels.LEAD_MS + duels.GRACE_MS + 1000)
    now = clock()
    # B's read of d1 and C's read of d2, at once: each finishes A's run.
    first = db_conn()
    cur = first.cursor()
    duel, entries, _mine = duels._load(cur, B, d1)
    duels.settle(cur, [], duel, entries, now)

    def second():
        conn = db_conn()
        try:
            with conn.cursor() as cur2:
                duel2, entries2, _m = duels._load(cur2, C, d2)
                duels.settle(cur2, [], duel2, entries2, now)
            conn.commit()
        finally:
            conn.close()
    t = threading.Thread(target=second)
    t.start()
    t.join(timeout=1.5)
    first.commit()
    first.close()
    t.join(timeout=10)
    try:
        assert _xp(A, d1) + _xp(A, d2) == duels.XP_CAP - 100
    finally:
        sql("DELETE FROM xp_ledger WHERE user_id = %s AND ref = 'pvp-test'", (A,))


def test_a_run_left_and_finished_days_later_pays_on_the_day_it_was_run(client, learners, clock):
    befriend(client, A, B, learners)
    _at_noon(clock, A)
    duel_id = _challenge(client, learners)
    play(client, clock, A, duel_id, [(1000, True)] * 5, finish=False)
    (started,), = sql("SELECT started_at FROM pvp_entries WHERE duel_id = %s AND user_id = %s",
                      (duel_id, A), fetch=True)
    # Two days on, A's cap for today already full: B's hall finishes the
    # run, which pays on its own day, under that day's cap.
    clock.tick(2 * 24 * 3600 * 1000)
    sql("INSERT INTO xp_ledger (user_id, source, ref, xp, awarded_at) VALUES (%s, 'duel', 'pvp-test', %s, %s)",
        (A, duels.XP_CAP, clock()))
    try:
        with acting_as(B):
            client.get("/api/pvp")
        rows = sql("SELECT xp, awarded_at FROM xp_ledger WHERE user_id = %s AND ref = %s",
                   (A, f"duel:{duel_id}"), fetch=True)
        assert rows == [(5 * 7, started + timedelta(milliseconds=duels.SPRINT_MS))]
    finally:
        sql("DELETE FROM xp_ledger WHERE user_id = %s AND ref = 'pvp-test'", (A,))


# ── A run's last second ─────────────────────────────────────────────

def test_the_reply_that_ends_a_run_and_the_cover_read_after_it_agree(client, learners, clock):
    befriend(client, A, B, learners)
    duel_id = _challenge(client, learners)
    play(client, clock, A, duel_id, [(1000, True)] * 4)
    key = keys(duel_id)
    with acting_as(B):
        run = client.post(f"/api/pvp/duels/{duel_id}/start").json()
        ends = datetime.fromisoformat(run["endsAt"])
        clock.to(run["qAt"])
        q = run["q"]
        # Right every second or so, the last one 200 ms before the end:
        # the next question would come after it, so the reply has none.
        while True:
            clock.tick(1000)
            clock.at = min(clock.at, ends - timedelta(milliseconds=200))
            reply = _answer(client, duel_id, q["n"], key[q["n"]]).json()
            if reply["next"] is None:
                break
            clock.to(reply["nextAt"])
            q = reply["next"]
        # The app reads the verdict at once, long before the grace is over.
        clock.tick(300)
        cover = client.get(f"/api/pvp/duels/{duel_id}").json()
    assert cover["you"]["played"] is True and cover["you"]["score"] == reply["total"]
    assert cover["status"] == "done" and cover["result"]["outcome"] == "win"


def test_no_question_served_after_the_minute_is_ever_answered(client, learners, clock):
    befriend(client, A, B, learners)
    duel_id = _challenge(client, learners)
    key = keys(duel_id)
    run = client.post(f"/api/pvp/duels/{duel_id}/start").json()
    ends = datetime.fromisoformat(run["endsAt"])
    clock.at = ends - timedelta(milliseconds=500)
    wrong = _answer(client, duel_id, 0, (key[0] + 1) % 4).json()
    assert wrong["next"] is None and datetime.fromisoformat(wrong["nextAt"]) > ends
    # The question that would have come, answered in the grace by a
    # client that reads the paper: the run is already over.
    clock.at = datetime.fromisoformat(wrong["nextAt"]) + timedelta(milliseconds=50)
    late = _answer(client, duel_id, 1, key[1]).json()
    assert late == {"over": True, "total": 0, "rights": 0}


def test_an_answer_sent_again_says_which_pick_it_was_recorded_with(client, learners, clock):
    befriend(client, A, B, learners)
    duel_id = _challenge(client, learners)
    key = keys(duel_id)
    run = client.post(f"/api/pvp/duels/{duel_id}/start").json()
    clock.to(run["qAt"])
    clock.tick(1000)
    wrong = (key[0] + 1) % 4
    first = _answer(client, duel_id, 0, wrong).json()
    # The reply was lost; the app sends the same question with another
    # tile: the verdict is the first pick's, and says which pick it was.
    again = _answer(client, duel_id, 0, key[0]).json()
    assert first["right"] is False and again == first and again["pick"] == wrong


# ── The deadline, a decline ─────────────────────────────────────────

def test_a_run_started_before_the_deadline_has_its_minute(client, learners, clock):
    befriend(client, A, B, learners)
    duel_id = _challenge(client, learners)            # A challenges B and never plays
    (expires,), = sql("SELECT expires_at FROM pvp_duels WHERE id = %s", (duel_id,), fetch=True)
    clock.at = expires - timedelta(seconds=20)
    key = keys(duel_id)
    with acting_as(B):
        run = client.post(f"/api/pvp/duels/{duel_id}/start").json()
        clock.to(run["qAt"])
        clock.tick(1000)
        first = _answer(client, duel_id, 0, key[0]).json()
        # The 48 hours run out mid-sprint: the run goes on.
        clock.at = expires + timedelta(seconds=1)
        assert client.get("/api/pvp").status_code == 200
        second = _answer(client, duel_id, 1, key[1])
        assert second.status_code == 200 and second.json()["right"] is True
        clock.to(run["endsAt"])
        clock.tick(duels.GRACE_MS + 1)
        cover = client.get(f"/api/pvp/duels/{duel_id}").json()
    assert first["right"] is True
    assert cover["status"] == "expired" and cover["you"]["played"] is True
    assert _xp(B, duel_id) == 2 * 7


def test_a_decline_waits_for_the_challengers_minute(client, learners, clock):
    befriend(client, A, B, learners)
    duel_id = _challenge(client, learners)
    key = keys(duel_id)
    run = client.post(f"/api/pvp/duels/{duel_id}/start").json()
    clock.to(run["qAt"])
    clock.tick(1000)
    first = _answer(client, duel_id, 0, key[0]).json()
    assert first["right"] is True
    with acting_as(B):
        r = client.post(f"/api/pvp/duels/{duel_id}/decline")
        assert r.status_code == 409 and r.json()["detail"]["code"] == "pvp_running"
    clock.to(first["nextAt"])
    clock.tick(1000)
    assert _answer(client, duel_id, 1, key[1]).json()["right"] is True
    clock.to(run["endsAt"])
    clock.tick(duels.GRACE_MS + 1)
    with acting_as(B):
        assert client.post(f"/api/pvp/duels/{duel_id}/decline").status_code == 200
    cover = client.get(f"/api/pvp/duels/{duel_id}").json()
    assert cover["status"] == "declined" and cover["you"]["score"] == 200
    assert _xp(A, duel_id) == 2 * 7


# ── The fares ───────────────────────────────────────────────────────

def test_a_start_that_fails_takes_no_fare(client, learners, clock, monkeypatch):
    place(A)
    first = _ranked(client, A)["id"]
    real = duels._begin
    monkeypatch.setattr(duels, "_begin", lambda cur, mine, at: (_ for _ in ()).throw(RuntimeError("dropped")))
    with pytest.raises(RuntimeError):
        client.post(f"/api/pvp/duels/{first}/start")
    assert _ledger(A, "duel") == []
    # Pressed again, it is paid once, and given back once if nobody comes.
    monkeypatch.setattr(duels, "_begin", real)
    play(client, clock, A, first, [(1000, True)] * 3)
    assert _ledger(A, "duel") == [-duels.RANKED_PRICE]
    clock.tick(duels.WAIT.total_seconds() * 1000)
    assert client.get(f"/api/pvp/duels/{first}").json()["status"] == "expired"
    assert _ledger(A, "duel") == [-duels.RANKED_PRICE, duels.RANKED_PRICE]


def test_a_refund_that_fails_fails_its_expiry_and_the_next_read_gives_it_back(client, learners, clock, monkeypatch):
    place(A)
    first = _ranked(client, A)["id"]
    play(client, clock, A, first, [(1000, True)])
    clock.tick(duels.WAIT.total_seconds() * 1000)
    real = credits.refund
    monkeypatch.setattr(credits, "refund", lambda *a, **k: (_ for _ in ()).throw(RuntimeError("busy")))
    with pytest.raises(RuntimeError):
        client.get("/api/pvp")
    assert _status(first) == [("open",)] and _ledger(A, "duel") == [-duels.RANKED_PRICE]
    monkeypatch.setattr(credits, "refund", real)
    for _ in range(2):
        client.get("/api/pvp")
    assert _status(first) == [("expired",)]
    assert _ledger(A, "duel") == [-duels.RANKED_PRICE, duels.RANKED_PRICE]


# ── Who meets which paper ───────────────────────────────────────────

def _paper_of(duel_id):
    return sql("SELECT seed, level, paper_rev FROM pvp_duels WHERE id = %s", (duel_id,), fetch=True)[0]


def test_a_paper_whose_corrections_were_bought_is_never_dealt_again(client, learners, clock):
    for uid in (A, B, C):
        place(uid)
    first = _ranked(client, A)["id"]
    play(client, clock, A, first, [(1000, True)] * 3)
    assert _ranked(client, B) == {"id": first, "against": "seek"}
    play(client, clock, B, first, [(1000, True)] * 3)
    assert client.post(f"/api/pvp/duels/{first}/review", json={"buy": True}).status_code == 200
    # C's Elo is the recording's: without the corrections sold, its ghost.
    third = _ranked(client, C)
    assert third["against"] != "ghost" or _paper_of(third["id"]) != _paper_of(first)


def test_a_run_with_no_answer_in_it_is_never_a_ghost(client, learners, clock):
    for uid in (A, C):
        place(uid)
    first = _ranked(client, A)["id"]
    play(client, clock, A, first, [])
    clock.tick(duels.WAIT.total_seconds() * 1000)
    client.get("/api/pvp")
    assert _status(first) == [("expired",)]
    assert _ranked(client, C)["against"] == "open"


def test_nobody_new_is_dealt_a_paper_of_a_retired_revision(client, learners, clock, monkeypatch):
    for uid in (A, B, C):
        place(uid)
    waiting = _ranked(client, A)["id"]
    play(client, clock, A, waiting, [(1000, True)] * 3)
    expired = _ranked(client, C)
    assert expired["against"] == "seek" and expired["id"] == waiting
    play(client, clock, C, waiting, [(1000, True)] * 3)
    # The revision moves on (a key corrected): neither the run waiting
    # nor a recording of the old paper is dealt to B.
    monkeypatch.setattr(duel_paper, "PAPER_REV", "sprint-test")
    fresh = _ranked(client, B)
    assert fresh["against"] == "open" and _paper_of(fresh["id"])[2] == "sprint-test"


def test_two_presses_of_a_challenge_at_once_make_one(client, learners):
    import threading
    befriend(client, A, B, learners)
    made, barrier = [], threading.Barrier(2)

    def press():
        barrier.wait()
        made.append(duels.run(duels.challenge, A, learners[B], "async"))
    threads = [threading.Thread(target=press) for _ in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert len(set(made)) == 1
    with acting_as(B):
        assert [d["id"] for d in client.get("/api/pvp").json()["toPlay"]] == made[:1]


def test_a_challenge_past_its_deadline_is_never_handed_back(client, learners, clock):
    befriend(client, A, B, learners)
    room = _challenge(client, learners, mode="live")
    clock.tick(duels.LOBBY.total_seconds() * 1000 + 60_000)
    again = _challenge(client, learners, mode="live")
    assert again != room and client.get(f"/api/pvp/duels/{again}").json()["status"] == "lobby"
    assert _status(room) == [("expired",)]
    waiting = _challenge(client, learners)
    clock.tick(duels.WAIT.total_seconds() * 1000 + 60_000)
    assert _challenge(client, learners) != waiting


def test_challenges_received_never_shut_a_learner_out_of_their_own(client, learners, clock, monkeypatch):
    monkeypatch.setattr(duels, "OPEN_MAX", 1)
    place(A)
    befriend(client, A, B, learners)
    befriend(client, A, C, learners)
    for uid in (B, C):
        with acting_as(uid):
            assert client.post("/api/pvp/duels", json={"opponent": learners[A], "mode": "async"}).status_code == 200
    assert client.post("/api/pvp/duels", json={"ranked": True}).status_code == 200
    # ...and what A opened is what counts.
    r = client.post("/api/pvp/duels", json={"opponent": learners[B], "mode": "async"})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "pvp_too_many"


def test_duels_past_their_deadline_are_settled_before_the_limit_is_counted(client, learners, clock, monkeypatch):
    monkeypatch.setattr(duels, "OPEN_MAX", 1)
    place(A)
    first = _ranked(client, A)["id"]
    play(client, clock, A, first, [(1000, True)])
    # 48 hours on, nobody read the run since: it is A's one duel still.
    clock.tick(duels.WAIT.total_seconds() * 1000 + 1)
    r = client.post("/api/pvp/duels", json={"ranked": True})
    assert r.status_code == 200 and r.json()["id"] != first
    assert _status(first) == [("expired",)]


# ── What the screens are told ───────────────────────────────────────

def test_the_pass_is_shown_no_price(client, learners, clock):
    place(A)
    (plan, until), = sql("SELECT plan, plan_until FROM user_profiles WHERE user_id = %s", (A,), fetch=True)
    sql("UPDATE user_profiles SET plan = 'pass', plan_until = NULL WHERE user_id = %s", (A,))
    credits.forget(A)
    try:
        assert client.get("/api/pvp").json()["prices"] == {"ranked": 0, "review": 0}
        duel_id = _ranked(client, A)["id"]
        cover = client.get(f"/api/pvp/duels/{duel_id}").json()
        assert (cover["price"], cover["reviewPrice"]) == (0, 0)
        play(client, clock, A, duel_id, [(1000, True)])
        assert _ledger(A, "duel") == []
    finally:
        sql("UPDATE user_profiles SET plan = %s, plan_until = %s WHERE user_id = %s", (plan, until, A))
        credits.forget(A)
    assert client.get("/api/pvp").json()["prices"] == {"ranked": duels.RANKED_PRICE, "review": duels.REVIEW_PRICE}


def test_a_duel_closed_under_a_run_stays_in_its_history(client, learners, clock):
    befriend(client, A, B, learners)
    played = _challenge(client, learners)
    play(client, clock, A, played, [(1000, True)] * 2, finish=False)
    with acting_as(B):
        assert client.post("/api/pvp/blocks", json={"username": learners[A]}).status_code == 200
    rows = client.get("/api/pvp/history").json()["entries"]
    assert [(d["id"], d["outcome"], d["mine"]) for d in rows] == [(played, "cancelled", 200)]


def test_a_challenge_says_who_made_it(client, learners, clock):
    befriend(client, A, B, learners)
    sent = _challenge(client, learners)
    with acting_as(B):
        received = client.post("/api/pvp/duels", json={"opponent": learners[A], "mode": "async"}).json()["id"]
    roles = {d["id"]: d["role"] for d in client.get("/api/pvp").json()["toPlay"]}
    assert roles == {sent: "challenger", received: "opponent"}


def test_the_board_ranked_in_the_base_is_the_one_ranked_in_full(client, learners):
    # Ties, the hidden, friends, a learner with no ranked game: the
    # place, the page, the rows around and the gap are what ranking the
    # whole board in Python gives.
    import random

    from core.db import db_conn
    prefix = "pvp-test-board-"
    rng = random.Random(279)
    people = [(f"{prefix}{i:03d}", rng.choice([980, 1000, 1000, 1040, 1100, 1210]), rng.choice([0, 3, 20]),
               rng.random() < 0.2) for i in range(60)]
    me = people[17][0]

    def clean():
        sql("DELETE FROM pvp_ratings WHERE user_id LIKE %s", (prefix + "%",))
        sql("DELETE FROM pvp_friends WHERE user_id LIKE %s OR friend_id LIKE %s", (prefix + "%", prefix + "%"))
        sql("DELETE FROM user_profiles WHERE user_id LIKE %s", (prefix + "%",))
    clean()
    try:
        for uid, rating, games, hidden in people:
            sql("INSERT INTO user_profiles (user_id, username, board_hidden) VALUES (%s, %s, %s)",
                (uid, "b" + uid[-3:], hidden))
            sql("INSERT INTO pvp_ratings (user_id, rating, games, peak, placed_level, placed_at) "
                "VALUES (%s, %s, %s, %s, 'N5', NOW())", (uid, rating, games, rating))
        sql("UPDATE pvp_ratings SET games = 5 WHERE user_id = %s", (me,))
        sql("UPDATE user_profiles SET board_hidden = TRUE WHERE user_id = %s", (me,))
        friends_of_me = [p[0] for p in people[::3] if p[0] != me]
        for f in friends_of_me:
            sql("INSERT INTO pvp_friends (user_id, friend_id) VALUES (%s, %s)", (me, f))
        rows = {uid: (r, g, h) for uid, r, g, h in people}
        rows[me] = (rows[me][0], 5, True)

        def full(scope, viewer=me):
            ids = [u for u, (r, g, h) in rows.items() if g > 0 and (not h or u == viewer)
                   and (scope == "all" or u == viewer or u in friends_of_me)]
            return sorted(ids, key=lambda u: (-rows[u][0], u))
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                for scope in ("all", "friends"):
                    ranked = full(scope)
                    for offset, limit, around in ((0, 20, 0), (5, 7, 2), (40, 30, 5), (200, 10, 1)):
                        got = duels.board(cur, me, scope, offset, limit, around)
                        assert got["of"] == len(ranked)
                        assert [e["username"] for e in got["entries"]] == \
                            ["b" + u[-3:] for u in ranked[offset:offset + limit]]
                        k = ranked.index(me)
                        assert got["me"]["rank"] == k + 1
                        assert [e["rank"] for e in got["near"]] == \
                            ([] if not around else list(range(max(1, k + 1 - around), min(len(ranked), k + 1 + around) + 1)))
                        if k:
                            assert got["me"]["gap"] == {"elo": rows[ranked[k - 1]][0] - rows[me][0] + 1,
                                                        "username": "b" + ranked[k - 1][-3:], "rank": k}
                place = duels.board_place(cur, me)
                assert place == {"rank": full("all").index(me) + 1, "of": len(full("all"))}
                # One who has played no ranked duel is on no board, and the
                # hidden one is on theirs only.
                outsider = next(u for u, (r, g, h) in rows.items() if g == 0)
                assert duels.board_place(cur, outsider) == {"rank": None, "of": len(full("all", outsider))}
                assert len(full("all", outsider)) == len(full("all")) - 1
            conn.rollback()
        finally:
            conn.close()
    finally:
        clean()


def test_a_ranked_score_to_beat_is_kept_until_the_run_starts(client, learners, clock):
    # Seen with a seat still unstarted (free to give back), a strong run
    # would be passed up for a weaker one: nothing a ranked player can
    # read tells it before « Partir » -- not the cover, not the hall, not
    # the live read. A friend's challenge still shows it.
    for uid in (A, B):
        place(uid)
    left = _ranked(client, B)["id"]
    play(client, clock, B, left, [(1000, True)] * 3)
    assert _ranked(client, A) == {"id": left, "against": "seek"}
    cover = client.get(f"/api/pvp/duels/{left}").json()
    assert cover["them"]["played"] is True and (cover["them"]["score"], cover["them"]["rights"]) == (None, None)
    group, row = _hall_row(client, left)
    assert group == "toPlay" and row["theirs"] is None
    live = client.get(f"/api/pvp/duels/{left}/live").json()["them"]
    assert (live["total"], live["timeline"]) == (0, [])
    # Gone, the seat and its kept score: B's run waits for the next one.
    run = client.post(f"/api/pvp/duels/{left}/start").json()
    assert sum(e["pts"] for e in run["opponent"]["timeline"]) == 300
    assert client.get(f"/api/pvp/duels/{left}").json()["them"]["score"] == 300

    befriend(client, A, B, learners)
    with acting_as(B):
        challenge = client.post("/api/pvp/duels", json={"opponent": learners[A], "mode": "async"}).json()["id"]
    play(client, clock, B, challenge, [(1000, True)] * 2)
    assert client.get(f"/api/pvp/duels/{challenge}").json()["them"]["score"] == 200
    assert _hall_row(client, challenge)[1]["theirs"] == 200
