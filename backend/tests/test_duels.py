"""対戦 — a duel's life (plan 279, study/duels.py), through the routes.

The server keeps the clock: the tests move it (pvp_world.Clock) and
answer as a learner would, n seconds after each question was served.
"""
import re
from datetime import datetime, timedelta
from pathlib import Path

import pytest

from study import duel_elo, duel_paper, duels
from tests.conftest import acting_as
from tests.pvp_world import (A, B, C, befriend, clock, events_of, keys, learners, place, play,  # noqa: F401
                             set_profile, sql)

FRONTEND = Path(__file__).resolve().parents[2] / "frontend" / "src" / "domain" / "duel.js"


def _challenge(client, names, opponent=B, mode="async"):
    r = client.post("/api/pvp/duels", json={"opponent": names[opponent], "mode": mode})
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _ledger(user_id, reason):
    return [d for (d,) in sql("SELECT delta FROM credit_ledger WHERE user_id = %s AND reason = %s ORDER BY id",
                              (user_id, reason), fetch=True)]


# ── The points ──────────────────────────────────────────────────────

def test_a_right_answer_is_worth_less_as_time_passes():
    assert duels.points(0) == 100 and duels.points(1000) == 100
    assert duels.points(3500) == 63
    assert duels.points(6000) == 25 and duels.points(6001) == 0
    assert all(duels.points(ms) >= duels.points(ms + 100) for ms in range(0, 7000, 100))


def test_the_client_draws_the_same_curve():
    js = FRONTEND.read_text()
    for name, value in (("SPRINT_MS", duels.SPRINT_MS), ("LIMIT_MS", duels.LIMIT_MS),
                        ("LOCK_MS", duels.LOCK_MS), ("FULL_MS", duels.FULL_MS)):
        m = re.search(rf"const {name} = ([\d_]+)", js)
        assert m and int(m.group(1).replace("_", "")) == value, name


def test_a_duel_keeps_the_sprint_its_paper_was_dealt_with(client, learners, clock):
    # Plan 283: two minutes from sprint-2 on; a sprint-1 duel still open
    # when they came in is run, and raced, in its one minute.
    assert duels.SPRINT_MS == duels.SPRINT_MS_BY_REV[duel_paper.PAPER_REV] == 120_000
    befriend(client, A, B, learners)
    duel_id = _challenge(client, learners)
    assert client.get(f"/api/pvp/duels/{duel_id}").json()["sprintMs"] == 120_000
    sql("UPDATE pvp_duels SET paper_rev = 'sprint-1' WHERE id = %s", (duel_id,))
    assert client.get(f"/api/pvp/duels/{duel_id}").json()["sprintMs"] == 60_000
    run = client.post(f"/api/pvp/duels/{duel_id}/start").json()
    starts, ends = datetime.fromisoformat(run["startsAt"]), datetime.fromisoformat(run["endsAt"])
    assert ends - starts == timedelta(minutes=1)
    # Its minute and the grace over, the run is finished there.
    clock.to(run["endsAt"])
    clock.tick(duels.GRACE_MS + 1)
    cover = client.get(f"/api/pvp/duels/{duel_id}").json()
    assert cover["you"]["played"] is True


# ── A friend's challenge ────────────────────────────────────────────

def test_only_a_friend_is_challenged(client, learners):
    r = client.post("/api/pvp/duels", json={"opponent": learners[B], "mode": "async"})
    assert r.status_code == 403 and r.json()["detail"]["code"] == "pvp_not_friends"


def test_a_challenge_is_at_the_lower_level_and_made_once(client, learners, clock):
    set_profile(A, level="N3")
    set_profile(B, level="N4")
    befriend(client, A, B, learners)
    first = _challenge(client, learners)
    assert _challenge(client, learners) == first
    cover = client.get(f"/api/pvp/duels/{first}").json()
    assert cover["level"] == "N4" and cover["kind"] == "friend" and cover["price"] == 0
    assert cover["them"]["username"] == learners[B] and cover["them"]["played"] is False
    with acting_as(B):
        hall = client.get("/api/pvp").json()
        assert [d["id"] for d in hall["toPlay"]] == [first]
        assert hall["toPlay"][0]["who"] == learners[A]


def test_a_challenge_stands_at_the_lower_elo(client, learners, clock):
    # Plan 286: a friend's paper is built where the lower Elo stands,
    # the start of their level for one with none yet.
    set_profile(A, level="N3")
    place(B, "N4")
    sql("UPDATE pvp_ratings SET rating = 1180 WHERE user_id = %s", (B,))
    befriend(client, A, B, learners)
    cover = client.get(f"/api/pvp/duels/{_challenge(client, learners)}").json()
    # A has no Elo: N3's start, 1 400. B's 1 180 is nine tenths of N4.
    assert cover["level"] == "N4"
    assert cover["mix"] == [{"level": "N5", "share": 0.1}, {"level": "N4", "share": 0.9}]


def test_the_server_times_each_answer_and_never_says_which_was_right(client, learners, clock):
    befriend(client, A, B, learners)
    duel_id = _challenge(client, learners)
    key = keys(duel_id)
    run = client.post(f"/api/pvp/duels/{duel_id}/start").json()
    starts = datetime.fromisoformat(run["startsAt"])
    assert starts - clock() == timedelta(milliseconds=duels.LEAD_MS)
    assert run["q"]["n"] == 0 and "answer" not in run["q"] and run["opponent"] is None
    # Before its clock has started, a question takes no answer.
    r = client.post(f"/api/pvp/duels/{duel_id}/answer", json={"n": 0, "pick": key[0]})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "pvp_too_early"

    clock.to(run["qAt"])
    clock.tick(2000)
    right = client.post(f"/api/pvp/duels/{duel_id}/answer", json={"n": 0, "pick": key[0]}).json()
    assert right["right"] is True and right["pts"] == duels.points(2000) and right["ms"] == 2000
    assert "answer" not in right and "answer" not in right["next"]
    assert datetime.fromisoformat(right["nextAt"]) - clock() == timedelta(milliseconds=duels.RIGHT_HOLD_MS)

    # The same answer sent again is what it was, not a second one.
    again = client.post(f"/api/pvp/duels/{duel_id}/answer", json={"n": 0, "pick": key[0]}).json()
    assert again["total"] == right["total"] and again["next"]["n"] == 1

    clock.to(right["nextAt"])
    clock.tick(500)
    wrong = client.post(f"/api/pvp/duels/{duel_id}/answer", json={"n": 1, "pick": (key[1] + 1) % 4}).json()
    assert wrong["right"] is False and wrong["pts"] == 0 and wrong["total"] == right["total"]
    assert datetime.fromisoformat(wrong["nextAt"]) - clock() == timedelta(milliseconds=duels.LOCK_MS)
    # Not the question being served: stale.
    assert client.post(f"/api/pvp/duels/{duel_id}/answer", json={"n": 7, "pick": 0}).json()["stale"] is True

    clock.to(wrong["nextAt"])
    clock.tick(duels.LIMIT_MS + 1)
    late = client.post(f"/api/pvp/duels/{duel_id}/answer", json={"n": 2, "pick": key[2]}).json()
    assert late["right"] is True and late["pts"] == 0

    clock.to(run["endsAt"])
    clock.tick(duels.GRACE_MS + 1)
    over = client.post(f"/api/pvp/duels/{duel_id}/answer", json={"n": 3, "pick": key[3]}).json()
    assert over["over"] is True and over["total"] == right["total"]
    r = client.post(f"/api/pvp/duels/{duel_id}/start")
    assert r.status_code == 409 and r.json()["detail"]["code"] == "pvp_played"
    assert events_of(A, "pvp_duel_start") == [{"kind": "friend", "mode": "async", "level": "N5", "against": "friend"}]


def test_an_answer_in_the_grace_lands_on_the_finish_line(client, learners, clock):
    befriend(client, A, B, learners)
    duel_id = _challenge(client, learners)
    key = keys(duel_id)
    run = client.post(f"/api/pvp/duels/{duel_id}/start").json()
    clock.to(run["endsAt"])
    clock.tick(duels.GRACE_MS - 50)
    late = client.post(f"/api/pvp/duels/{duel_id}/answer", json={"n": 0, "pick": key[0]}).json()
    assert late["right"] is True and late["pts"] == 0
    clock.to(run["endsAt"])
    clock.tick(duels.GRACE_MS + 1)
    client.get(f"/api/pvp/duels/{duel_id}")
    with acting_as(B):
        line = client.post(f"/api/pvp/duels/{duel_id}/start").json()["opponent"]["timeline"]
    assert [p["t"] for p in line] == [duels.SPRINT_MS]


def test_a_recording_sums_to_its_score(client, learners, clock):
    befriend(client, A, B, learners)
    duel_id = _challenge(client, learners)
    play(client, clock, A, duel_id, [(1700, True)] * 40)
    with acting_as(B):
        cover = client.get(f"/api/pvp/duels/{duel_id}").json()
        line = client.post(f"/api/pvp/duels/{duel_id}/start").json()["opponent"]["timeline"]
    assert sum(p["pts"] for p in line if p["t"] <= duels.SPRINT_MS) == cover["them"]["score"]


# ── The combo and the rush (plan 285) ───────────────────────────────

def test_a_streak_multiplies_a_right_answers_points():
    assert [duels.multiplier(n) for n in (0, 1, 4, 5, 9, 10, 19, 20, 60)] == [1, 1, 1, 1.5, 1.5, 2, 2, 3, 3]
    assert duels.streak_of([]) == 0
    assert duels.streak_of([{"right": True}, {"right": False}, {"right": True}, {"right": True}]) == 2


def test_each_answer_pays_the_streak_it_makes(client, learners, clock):
    befriend(client, A, B, learners)
    duel_id = _challenge(client, learners)
    cover = client.get(f"/api/pvp/duels/{duel_id}").json()
    assert cover["rules"] == {"tiers": [{"at": 5, "mult": 1.5}, {"at": 10, "mult": 2}, {"at": 20, "mult": 3}],
                              "rushMs": duels.RUSH_MS}
    replies = play(client, clock, A, duel_id, [(1000, True)] * 21 + [(1000, False), (2000, True)], finish=False)
    assert [r["streak"] for r in replies] == [*range(1, 22), 0, 1]
    assert [r["mult"] for r in replies] == [1] * 4 + [1.5] * 5 + [2] * 10 + [3] * 2 + [1, 1]
    assert [r["combo"] for r in replies] == [0] * 4 + [50] * 5 + [100] * 10 + [200] * 2 + [0, 0]
    assert all(r["scored"] == r["pts"] + r["combo"] + r["rush"] and r["rush"] == 0 for r in replies)
    assert replies[-1]["total"] == sum(r["scored"] for r in replies) == (400 + 5 * 150 + 10 * 200 + 2 * 300
                                                                         + duels.points(2000))
    # Picked up again, the run knows the streak it is on.
    resumed = client.post(f"/api/pvp/duels/{duel_id}/start").json()
    assert (resumed["streak"], resumed["mult"], resumed["rules"]) == (1, 1, cover["rules"])


def test_the_last_seconds_pay_a_right_answer_once_more(client, learners, clock):
    befriend(client, A, B, learners)
    duel_id = _challenge(client, learners)
    key = keys(duel_id)
    run = client.post(f"/api/pvp/duels/{duel_id}/start").json()

    def at(offset, n, right=True):
        """Answer question `n`, `offset` ms from the rush's first instant."""
        clock.to(run["endsAt"])
        clock.tick(offset - duels.RUSH_MS)
        pick = key[n] if right else (key[n] + 1) % 4
        return client.post(f"/api/pvp/duels/{duel_id}/answer", json={"n": n, "pick": pick}).json()

    # Served at the start, the first question is worth nothing by then.
    assert at(-3000, 0)["pts"] == 0
    before = at(-1, 1)
    assert before["pts"] > 0 and before["rush"] == 0
    rush = at(1299, 2)
    assert (rush["pts"], rush["rush"], rush["scored"]) == (100, 100, 200)
    miss = at(2599, 3, right=False)
    assert (miss["rush"], miss["scored"], miss["total"]) == (0, 0, before["pts"] + 200)


def test_a_sprint_1_duel_is_scored_on_speed_alone(client, learners, clock):
    befriend(client, A, B, learners)
    duel_id = _challenge(client, learners)
    sql("UPDATE pvp_duels SET paper_rev = 'sprint-1' WHERE id = %s", (duel_id,))
    assert client.get(f"/api/pvp/duels/{duel_id}").json()["rules"] is None
    replies = play(client, clock, A, duel_id, [(1000, True)] * 6)
    assert [r["mult"] for r in replies] == [1] * 6 and replies[-1]["total"] == 600
    assert all(r["combo"] == r["rush"] == 0 for r in replies)
    lines = client.get(f"/api/pvp/duels/{duel_id}").json()["you"]["lines"]
    assert (lines["speed"], lines["combo"], lines["rush"], lines["best"]) == (600, 0, 0, 6)


def test_the_result_reads_both_runs_line_by_line(client, learners, clock):
    befriend(client, A, B, learners)
    duel_id = _challenge(client, learners)
    play(client, clock, A, duel_id, [(1000, True)] * 6 + [(1000, False)] + [(2000, True)] * 5)
    cover = client.get(f"/api/pvp/duels/{duel_id}").json()
    # Played first: the learner's own lines, while the friend has yet to run.
    assert cover["result"] is None
    # The fifth of the second streak pays ×1.5 on 85 points: 43 more.
    assert cover["you"]["lines"] == {"speed": 600 + 5 * duels.points(2000), "combo": 2 * 50 + 43, "rush": 0,
                                     "best": 6, "flashes": 6, "rights": 11, "answered": 12, "grade": "A"}
    with acting_as(B):
        assert client.get(f"/api/pvp/duels/{duel_id}").json()["you"]["lines"] is None
    play(client, clock, B, duel_id, [(1000, True)] * 3)
    result = client.get(f"/api/pvp/duels/{duel_id}").json()["result"]
    mine, theirs = result["lines"]["mine"], result["lines"]["theirs"]
    assert mine == cover["you"]["lines"]
    assert theirs == {"speed": 300, "combo": 0, "rush": 0, "best": 3, "flashes": 3, "rights": 3, "answered": 3,
                      "grade": None}
    assert mine["speed"] + mine["combo"] + mine["rush"] == result["mine"]
    assert theirs["speed"] + theirs["combo"] + theirs["rush"] == result["theirs"]


def test_a_grade_needs_a_run_long_enough_to_say():
    assert duels.grade(9, 9, 9) is None
    assert duels.grade(20, 20, 6) == "S" and duels.grade(20, 20, 5) == "A"
    assert duels.grade(19, 20, 19) == "S" and duels.grade(18, 20, 18) == "A"
    assert duels.grade(15, 20, 15) == "B" and duels.grade(14, 20, 14) == "C"


def test_a_run_resumes_where_it_was(client, learners, clock):
    befriend(client, A, B, learners)
    duel_id = _challenge(client, learners)
    play(client, clock, A, duel_id, [(1000, True), (1000, True)], finish=False)
    resumed = client.post(f"/api/pvp/duels/{duel_id}/start").json()
    assert resumed["q"]["n"] == 2 and resumed["total"] == 200


def test_the_second_player_races_the_first_ones_recording(client, learners, clock):
    befriend(client, A, B, learners)
    duel_id = _challenge(client, learners)
    play(client, clock, A, duel_id, [(1000, True)] * 5 + [(2000, False)] * 3)
    cover = client.get(f"/api/pvp/duels/{duel_id}").json()
    assert cover["you"]["played"] is True and cover["status"] == "open" and cover["result"] is None
    with acting_as(B):
        cover = client.get(f"/api/pvp/duels/{duel_id}").json()
        # The fifth right answer in a row pays ×1.5 (plan 285).
        assert cover["them"]["score"] == 550 and cover["them"]["rights"] == 5
        run = client.post(f"/api/pvp/duels/{duel_id}/start").json()
        line = run["opponent"]["timeline"]
        assert [p["pts"] for p in line] == [100] * 4 + [150] + [0] * 3
        assert all(a["t"] < b["t"] for a, b in zip(line, line[1:]))
    play(client, clock, B, duel_id, [(1000, True)] * 6)
    mine = client.get(f"/api/pvp/duels/{duel_id}").json()
    assert mine["status"] == "done"
    assert mine["result"]["outcome"] == "loss" and mine["result"]["mine"] == 550 and mine["result"]["theirs"] == 700
    assert mine["result"]["elo"] is None
    assert (mine["result"]["answered"], mine["result"]["theirAnswered"]) == (8, 6)
    assert mine["you"]["xp"] == mine["result"]["xp"] == 5 * 7 + 3 * 1
    assert mine["xp"] == {"today": 5 * 7 + 3 * 1, "cap": duels.XP_CAP}
    with acting_as(B):
        assert client.get(f"/api/pvp/duels/{duel_id}").json()["result"]["outcome"] == "win"
        assert client.get("/api/pvp/friends").json()["friends"][0]["wins"] == 1
    assert [e["outcome"] for e in events_of(A, "pvp_duel_done")] == ["loss"]
    assert _elo(A) is None


def _elo(user_id):
    rows = sql("SELECT rating FROM pvp_ratings WHERE user_id = %s", (user_id,), fetch=True)
    return rows[0][0] if rows else None


def test_a_run_pays_its_answers_as_practice_up_to_the_days_cap(client, learners, clock):
    befriend(client, A, B, learners)
    first = _challenge(client, learners)
    play(client, clock, A, first, [(1000, True)] * 10 + [(1000, False)] * 2)
    paid = sql("SELECT xp, ref FROM xp_ledger WHERE user_id = %s AND source = 'duel'", (A,), fetch=True)
    assert paid == [(10 * 7 + 2 * 1, f"duel:{first}")]
    with acting_as(B):
        client.post(f"/api/pvp/duels/{first}/decline")
    second = _challenge(client, learners)
    assert second != first
    play(client, clock, A, second, [(1000, True)] * 20)
    total = sql("SELECT SUM(xp) FROM xp_ledger WHERE user_id = %s AND source = 'duel'", (A,), fetch=True)
    assert total == [(duels.XP_CAP,)]
    assert client.get("/api/pvp").json()["xp"] == {"today": duels.XP_CAP, "cap": duels.XP_CAP}


def test_a_challenge_nobody_plays_expires(client, learners, clock):
    befriend(client, A, B, learners)
    duel_id = _challenge(client, learners)
    play(client, clock, A, duel_id, [(1000, True)])
    clock.tick(duels.WAIT.total_seconds() * 1000)
    cover = client.get(f"/api/pvp/duels/{duel_id}").json()
    assert cover["status"] == "expired"
    with acting_as(B):
        r = client.post(f"/api/pvp/duels/{duel_id}/start")
        assert r.status_code == 409 and r.json()["detail"]["code"] == "pvp_closed"
    assert [e["outcome"] for e in events_of(A, "pvp_duel_done")] == ["expired"]


def test_a_challenge_can_be_declined_or_taken_back(client, learners, clock):
    befriend(client, A, B, learners)
    duel_id = _challenge(client, learners)
    with acting_as(B):
        assert client.post(f"/api/pvp/duels/{duel_id}/decline").status_code == 200
    assert client.get(f"/api/pvp/duels/{duel_id}").json()["status"] == "declined"
    again = _challenge(client, learners)
    assert client.delete(f"/api/pvp/duels/{again}").status_code == 200
    with acting_as(B):
        assert client.get("/api/pvp").json()["toPlay"] == []
    third = _challenge(client, learners)
    play(client, clock, A, third, [(1000, True)], finish=False)
    r = client.delete(f"/api/pvp/duels/{third}")
    assert r.status_code == 409 and r.json()["detail"]["code"] == "pvp_closed"


def test_a_duel_is_nobody_elses(client, learners, clock):
    befriend(client, A, B, learners)
    duel_id = _challenge(client, learners)
    with acting_as(C):
        assert client.get(f"/api/pvp/duels/{duel_id}").status_code == 404
        assert client.post(f"/api/pvp/duels/{duel_id}/start").status_code == 404


# ── The corrections ─────────────────────────────────────────────────

def test_the_corrections_open_once_settled_for_a_credit(client, learners, clock):
    befriend(client, A, B, learners)
    duel_id = _challenge(client, learners)
    play(client, clock, A, duel_id, [(1000, True), (1000, False)])
    r = client.post(f"/api/pvp/duels/{duel_id}/review")
    assert r.status_code == 409 and r.json()["detail"]["code"] == "pvp_not_settled"
    play(client, clock, B, duel_id, [(2000, True)] * 3)
    r = client.get(f"/api/pvp/duels/{duel_id}/review")
    assert r.status_code == 409 and r.json()["detail"]["code"] == "pvp_review_unpaid"
    body = client.post(f"/api/pvp/duels/{duel_id}/review").json()
    key = keys(duel_id)
    assert [q["n"] for q in body["questions"]] == [0, 1, 2]
    first = body["questions"][0]
    assert first["answer"] == key[0] and first["mine"]["right"] is True and first["theirs"]["ms"] == 2000
    assert body["questions"][2]["mine"] is None
    assert client.post(f"/api/pvp/duels/{duel_id}/review").status_code == 200
    assert client.get(f"/api/pvp/duels/{duel_id}/review").json() == body
    assert _ledger(A, "duel_review") == [-duels.REVIEW_PRICE]
    assert events_of(A, "pvp_review") == [{"kind": "friend"}]


# ── Ranked ──────────────────────────────────────────────────────────

def _ranked(client, user_id):
    with acting_as(user_id):
        r = client.post("/api/pvp/duels", json={"ranked": True})
        assert r.status_code == 200, r.text
        return r.json()


def test_ranked_play_never_waits(client, learners, clock):
    for uid in (A, B, C):
        place(uid)
    # Nobody around: a fresh paper, paid at the start.
    first = _ranked(client, A)
    assert first["against"] == "open"
    assert _ranked(client, A) == first  # the second press
    cover = client.get(f"/api/pvp/duels/{first['id']}").json()
    assert cover["price"] == duels.RANKED_PRICE and cover["them"] is None
    play(client, clock, A, first["id"], [(1000, True)] * 4)
    assert _ledger(A, "duel") == [-duels.RANKED_PRICE]

    # A's run waits: B meets it, and both Elo move.
    seek = _ranked(client, B)
    assert seek == {"id": first["id"], "against": "seek"}
    with acting_as(B):
        # The score to beat is B's once B's run has started, not before.
        cover = client.get(f"/api/pvp/duels/{seek['id']}").json()
        assert cover["them"]["username"] == learners[A] and cover["them"]["score"] is None
        run = client.post(f"/api/pvp/duels/{seek['id']}/start").json()
        assert sum(e["pts"] for e in run["opponent"]["timeline"]) == 400
        assert client.get(f"/api/pvp/duels/{seek['id']}").json()["them"]["score"] == 400
    play(client, clock, B, seek["id"], [(1000, True)] * 6)
    a = client.get(f"/api/pvp/duels/{first['id']}").json()["result"]
    assert a["outcome"] == "loss" and a["elo"]["before"] == 1000 and a["elo"]["after"] == 980
    with acting_as(B):
        b = client.get(f"/api/pvp/duels/{first['id']}").json()["result"]
        assert b["outcome"] == "win" and b["elo"]["after"] == 1020

    # Nobody waits now: C races a recording, and only C's Elo moves.
    ghost = _ranked(client, C)
    assert ghost["against"] == "ghost"
    with acting_as(C):
        cover = client.get(f"/api/pvp/duels/{ghost['id']}").json()
        # A recording, whose score C reads once C's run has started.
        assert cover["them"]["played"] is True and cover["them"]["score"] is None
    play(client, clock, C, ghost["id"], [(1000, True)] * 8)
    with acting_as(C):
        cover = client.get(f"/api/pvp/duels/{ghost['id']}").json()
        result = cover["result"]
    assert result["outcome"] == "win" and result["theirs"] == cover["them"]["score"] == 700
    assert result["elo"]["delta"] > 0
    assert (_elo(A), _elo(B)) == (980, 1020)
    # The recording's author is not told.
    for uid in (A, B):
        with acting_as(uid):
            hall = client.get("/api/pvp").json()
            assert ghost["id"] not in [d["id"] for d in hall["done"] + hall["running"] + hall["toPlay"]]
    starts = [e["against"] for e in events_of(A, "pvp_duel_start") + events_of(B, "pvp_duel_start")
              + events_of(C, "pvp_duel_start")]
    assert sorted(starts) == ["ghost", "open", "seek"]


def _drain(user_id):
    """Spend the learner's balance down to nothing, in the ledger, the
    refill's clock restarted. The refill lands a credit every 48 minutes
    of a clock that outlives a run, and the next fare claims what it has
    landed: drained without it, the balance a test means to be short is
    not, the first run after a pause."""
    from core import credits
    credits.claim(user_id)
    have = credits.read_fresh(user_id)["balance"] or 0
    if have:
        sql("INSERT INTO credit_ledger (user_id, delta, reason, ref) VALUES (%s, %s, 'adjust', 'pvp-test')",
            (user_id, -have))
    sql("UPDATE user_profiles SET credits_accrued_at = NOW() WHERE user_id = %s", (user_id,))
    credits.forget(user_id)


def test_a_ranked_paper_stands_where_the_elo_does(client, learners, clock):
    # Plan 286 (the owner's B): a paper mixes the two levels the Elo
    # stands between, and a stranger meets a paper near their own mix.
    for uid in (A, B, C):
        place(uid)
    for uid, elo in ((A, 1180), (B, 1240), (C, 1560)):
        sql("UPDATE pvp_ratings SET rating = %s WHERE user_id = %s", (elo, uid))
    first = _ranked(client, A)
    cover = client.get(f"/api/pvp/duels/{first['id']}").json()
    assert cover["level"] == "N4"
    assert cover["mix"] == [{"level": "N5", "share": 0.1}, {"level": "N4", "share": 0.9}]
    assert sum(1 for item in duel_paper_of(first["id"])["items"] if item["level"] == "N4") == 108
    play(client, clock, A, first["id"], [(1000, True)] * 3)
    # 1 560 is within the widest Elo window of 1 180, but its paper would
    # stand two levels off (N3 · N2): it is not dealt A's run.
    far = _ranked(client, C)
    assert far["against"] == "open" and far["id"] != first["id"]
    with acting_as(C):
        assert client.get(f"/api/pvp/duels/{far['id']}").json()["mix"] == [
            {"level": "N3", "share": 0.2}, {"level": "N2", "share": 0.8}]
    # 1 240 stands near 1 180: B meets A's run.
    assert _ranked(client, B) == {"id": first["id"], "against": "seek"}


def duel_paper_of(duel_id: int) -> dict:
    return sql("SELECT paper FROM pvp_duels WHERE id = %s", (duel_id,), fetch=True)[0][0]


def test_in_shadow_mode_a_short_balance_pays_what_it_has(client, learners, clock):
    place(A)
    first = _ranked(client, A)
    _drain(A)
    sql("INSERT INTO credit_ledger (user_id, delta, reason, ref) VALUES (%s, 1, 'adjust', 'pvp-test')", (A,))
    from core import credits
    credits.forget(A)
    assert client.post(f"/api/pvp/duels/{first['id']}/start").status_code == 200
    assert _ledger(A, "duel") == [-1]
    assert events_of(A, "fare_blocked")[-1] == {"balance": 1, "fare": duels.RANKED_PRICE, "kind": "duel"}
    # A duel is not a review that waited for the balance.
    assert sql("SELECT COUNT(*) FROM credit_stops WHERE user_id = %s AND at > NOW() - INTERVAL '1 minute'",
               (A,), fetch=True) == [(0,)]
    # What it took is what an expiry gives back.
    play(client, clock, A, first["id"], [(1000, True)], finish=True)
    clock.tick(duels.WAIT.total_seconds() * 1000)
    client.get("/api/pvp")
    assert _ledger(A, "duel") == [-1, 1]


def test_under_enforcement_an_empty_balance_does_not_start(client, learners, monkeypatch):
    from core import credits
    place(A)
    first = _ranked(client, A)
    _drain(A)
    monkeypatch.setattr(credits, "ENFORCE", True)
    r = client.post(f"/api/pvp/duels/{first['id']}/start")
    assert r.status_code == 402 and r.json()["detail"] == "out_of_credits"
    assert client.get(f"/api/pvp/duels/{first['id']}").json()["you"]["started"] is False
    assert _ledger(A, "duel") == []


def test_a_paper_is_never_met_twice(client, learners, clock):
    for uid in (A, B, C):
        place(uid)
    first = _ranked(client, A)
    play(client, clock, A, first["id"], [(1000, True)] * 3)
    play(client, clock, B, _ranked(client, B)["id"], [(1000, True)] * 3)
    ghost = _ranked(client, C)
    assert ghost["against"] == "ghost"
    play(client, clock, C, ghost["id"], [(1000, True)])
    # The only recordings are of that one paper: C is given a fresh one.
    assert _ranked(client, C)["against"] == "open"


def test_a_block_keeps_two_learners_apart_in_ranked_play(client, learners, clock):
    for uid in (A, B):
        place(uid)
    first = _ranked(client, A)
    play(client, clock, A, first["id"], [(1000, True)] * 3)
    with acting_as(B):
        client.post("/api/pvp/blocks", json={"username": learners[A]})
    assert _ranked(client, B)["against"] == "open"


def test_a_ranked_seat_left_unstarted_is_given_back(client, learners, clock):
    for uid in (A, B):
        place(uid)
    first = _ranked(client, A)
    play(client, clock, A, first["id"], [(1000, True)] * 3)
    assert _ranked(client, B)["against"] == "seek"
    clock.tick(duels.HOLD.total_seconds() * 1000 + 1)
    with acting_as(B):
        assert client.get(f"/api/pvp/duels/{first['id']}").status_code == 404
    assert len(sql("SELECT 1 FROM pvp_entries WHERE duel_id = %s", (first["id"],), fetch=True)) == 1
    # And the paper is A's to wait with again.
    assert _ranked(client, B) == {"id": first["id"], "against": "seek"}


def test_a_ranked_run_nobody_meets_is_refunded(client, learners, clock):
    place(A)
    first = _ranked(client, A)
    play(client, clock, A, first["id"], [(1000, True)] * 3)
    clock.tick(duels.WAIT.total_seconds() * 1000)
    hall = client.get("/api/pvp").json()
    assert hall["running"] == [] and hall["rating"]["games"] == 0
    assert client.get(f"/api/pvp/duels/{first['id']}").json()["status"] == "expired"
    assert _ledger(A, "duel") == [-duels.RANKED_PRICE, duels.RANKED_PRICE]


def test_a_stranger_off_the_board_is_a_traveller(client, learners, clock):
    for uid in (A, B):
        place(uid)
    set_profile(A, hidden=True)
    first = _ranked(client, A)
    play(client, clock, A, first["id"], [(1000, True)] * 3)
    _ranked(client, B)
    with acting_as(B):
        them = client.get(f"/api/pvp/duels/{first['id']}").json()["them"]
        assert them["username"] is None and them["elo"] == 1000
        # Reported all the same, from the duel.
        assert client.post("/api/pvp/reports", json={"duelId": first["id"], "reason": "cheat"}).status_code == 200
    assert sql("SELECT reported_id FROM pvp_reports WHERE user_id = %s", (B,), fetch=True) == [(A,)]


# ── Live ────────────────────────────────────────────────────────────

def test_a_live_duel_starts_both_runs_together(client, learners, clock):
    befriend(client, A, B, learners)
    duel_id = _challenge(client, learners, mode="live")
    r = client.post(f"/api/pvp/duels/{duel_id}/start")
    assert r.status_code == 409 and r.json()["detail"]["code"] == "pvp_waiting"
    assert client.get(f"/api/pvp/duels/{duel_id}/live").json()["status"] == "lobby"
    with acting_as(B):
        assert [d["id"] for d in client.get("/api/pvp").json()["live"]] == [duel_id]
        joined = client.post(f"/api/pvp/duels/{duel_id}/join").json()
    room = client.get(f"/api/pvp/duels/{duel_id}/live").json()
    assert room["status"] == "live" and room["startsAt"] == joined["startsAt"]
    mine = client.post(f"/api/pvp/duels/{duel_id}/start").json()
    assert mine["startsAt"] == joined["startsAt"] and mine["opponent"] is None

    play(client, clock, B, duel_id, [(1000, True)] * 3, finish=False)
    seen = client.get(f"/api/pvp/duels/{duel_id}/live", params={"v": 1}).json()
    assert seen["them"]["total"] == 300 and len(seen["them"]["timeline"]) == 2 and seen["them"]["v"] == 3
    clock.to(joined["endsAt"])
    clock.tick(duels.GRACE_MS + 1)
    done = client.get(f"/api/pvp/duels/{duel_id}/live").json()
    assert done["status"] == "done" and done["result"]["outcome"] == "loss"


def test_a_live_room_nobody_walks_into_closes(client, learners, clock):
    befriend(client, A, B, learners)
    duel_id = _challenge(client, learners, mode="live")
    clock.tick(duels.LOBBY.total_seconds() * 1000 + 1)
    assert client.get(f"/api/pvp/duels/{duel_id}/live").json()["status"] == "expired"
    with acting_as(B):
        r = client.post(f"/api/pvp/duels/{duel_id}/join")
        assert r.status_code == 409 and r.json()["detail"]["code"] == "pvp_closed"


# ── The Elo board and the hall ──────────────────────────────────────

def test_the_board_ranks_those_who_played_and_keeps_the_hidden_off(client, learners, clock):
    for uid in (A, B, C):
        place(uid)
    first = _ranked(client, A)
    play(client, clock, A, first["id"], [(1000, True)] * 3)
    play(client, clock, B, _ranked(client, B)["id"], [(1000, True)] * 5)
    board = client.get("/api/pvp/board").json()
    assert [e["username"] for e in board["entries"]] == [learners[B], learners[A]]
    assert board["me"]["rank"] == 2 and board["me"]["gap"]["username"] == learners[B]
    assert board["entries"][0]["provisional"] is True
    set_profile(B, hidden=True)
    assert [e["username"] for e in client.get("/api/pvp/board").json()["entries"]] == [learners[A]]
    with acting_as(B):
        assert client.get("/api/pvp/board").json()["me"]["rank"] == 1
    with acting_as(C):
        assert client.get("/api/pvp/board").json()["me"]["rank"] is None
    rating = client.get("/api/pvp/rating").json()
    assert rating["games"] == 1 and rating["losses"] == 1 and rating["trend"] == [980]
    assert rating["start"] == 1000 and "moves" not in rating


def test_the_history_pages_past_duels(client, learners, clock):
    befriend(client, A, B, learners)
    duel_id = _challenge(client, learners)
    play(client, clock, A, duel_id, [(1000, True)])
    play(client, clock, B, duel_id, [(1000, True)])
    page = client.get("/api/pvp/history", params={"limit": 5}).json()
    assert [(e["id"], e["outcome"], e["who"]) for e in page["entries"]] == [(duel_id, "draw", learners[B])]
    assert client.get("/api/pvp/history", params={"limit": 51}).status_code == 422


# ── The account ─────────────────────────────────────────────────────

def test_deleting_an_account_leaves_the_other_players_duel(client, learners, clock):
    for uid in (A, B, C):
        place(uid)
    befriend(client, B, C, learners)
    with acting_as(B):
        shared = client.post("/api/pvp/duels", json={"opponent": learners[C], "mode": "async"}).json()["id"]
    play(client, clock, B, shared, [(1000, True)])
    play(client, clock, C, shared, [(1000, True)] * 2)
    alone = _ranked(client, B)["id"]
    play(client, clock, B, alone, [(1000, True)])
    with acting_as(B):
        assert client.delete("/api/account").status_code == 200
    assert sql("SELECT 1 FROM pvp_duels WHERE id = %s", (alone,), fetch=True) == []
    assert sql("SELECT user_id FROM pvp_entries WHERE duel_id = %s", (shared,), fetch=True) == [(C,)]
    with acting_as(C):
        cover = client.get(f"/api/pvp/duels/{shared}").json()
        assert cover["them"] == {"username": None, "gone": True} and cover["result"]["outcome"] == "win"
    for table, col in (("pvp_ratings", "user_id"), ("pvp_friends", "friend_id")):
        assert sql(f"SELECT 1 FROM {table} WHERE {col} = %s", (B,), fetch=True) == []


@pytest.fixture(autouse=True)
def _quick_papers(monkeypatch):
    """A paper per duel is built in about a second at the first call of a
    level; the tests reuse a few, which changes nothing they measure."""
    built = {}
    real = duel_paper.build_paper

    def build(seed, level=None, mix=None):
        if (level, mix) not in built:
            built[level, mix] = real(seed, level, mix)
        return {**built[level, mix], "seed": seed}
    monkeypatch.setattr(duel_paper, "build_paper", build)
