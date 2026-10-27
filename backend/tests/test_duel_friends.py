"""対戦 — friends, blocks and reports (plan 276, study/duel_friends.py).

Two learners at least, through the routes: one asks, the other answers.
Before a request is accepted each side sees the other's username alone;
a block makes each one nobody to the other; a report is a closed reason,
one row per pair.
"""
from datetime import timedelta

from study import duel_friends
from tests.conftest import acting_as
from tests.pvp_world import A, B, C, befriend, clock, events_of, learners, set_profile, sql  # noqa: F401


def _search(client, username):
    return client.get("/api/pvp/search", params={"username": username})


def test_the_search_is_exact_and_ignores_case(client, learners):
    name = learners[B]
    r = _search(client, name.upper() if name.upper() != name else name.lower())
    assert r.status_code == 200
    assert r.json() == {"username": name, "relation": "none"}
    assert _search(client, name[:-1] if len(name) > 3 else name + "x").status_code == 404


def test_a_learner_off_the_board_is_found_all_the_same(client, learners):
    set_profile(B, hidden=True)
    assert _search(client, learners[B]).json()["username"] == learners[B]


def test_the_search_is_bounded(client, learners, monkeypatch):
    monkeypatch.setattr(duel_friends, "SEARCHES", 3)
    for _ in range(3):
        assert _search(client, learners[B]).status_code == 200
    r = _search(client, learners[B])
    assert r.status_code == 429 and r.json()["detail"]["code"] == "pvp_search_limit"


def test_a_username_is_held_to_its_shape(client, learners):
    assert _search(client, "a b").status_code == 422
    assert _search(client, "x" * 21).status_code == 422
    assert client.post("/api/pvp/requests", json={"username": "<script>"}).status_code == 422


def test_a_request_shows_the_username_alone_on_both_sides(client, learners):
    r = client.post("/api/pvp/requests", json={"username": learners[B]})
    assert r.json() == {"status": "sent"}
    mine = client.get("/api/pvp/friends").json()
    assert mine["sent"] == [{"username": learners[B]}] and mine["friends"] == []
    with acting_as(B):
        theirs = client.get("/api/pvp/friends").json()
        assert theirs["requests"] == [{"username": learners[A]}]
        assert _search(client, learners[A]).json()["relation"] == "received"
        # The card of a learner who is not a friend: the username alone.
        assert client.get(f"/api/pvp/learner/{learners[A]}").json() == {"username": learners[A], "relation": "received"}
    assert events_of(A, "pvp_friend") == [{"action": "request"}]


def test_accepting_makes_friends_both_ways(client, learners):
    befriend(client, A, B, learners)
    mine = client.get("/api/pvp/friends").json()
    assert [f["username"] for f in mine["friends"]] == [learners[B]]
    assert mine["friends"][0] | {} == {"username": learners[B], "elo": None, "provisional": False,
                                        "wins": 0, "draws": 0, "losses": 0}
    with acting_as(B):
        assert [f["username"] for f in client.get("/api/pvp/friends").json()["friends"]] == [learners[A]]
        card = client.get(f"/api/pvp/learner/{learners[A]}").json()
        assert card["relation"] == "friend" and "elo" in card and card["wins"] == 0
    assert events_of(B, "pvp_friend") == [{"action": "accept"}]
    # Asking a friend again is nothing new.
    assert client.post("/api/pvp/requests", json={"username": learners[B]}).json() == {"status": "friends"}
    assert events_of(A, "pvp_friend") == [{"action": "request"}]


def test_two_crossed_requests_are_an_acceptance(client, learners):
    with acting_as(B):
        client.post("/api/pvp/requests", json={"username": learners[A]})
    assert client.post("/api/pvp/requests", json={"username": learners[B]}).json() == {"status": "friends"}
    assert _search(client, learners[B]).json()["relation"] == "friend"
    assert sql("SELECT COUNT(*) FROM pvp_requests WHERE user_id = ANY(%s)", ([A, B],), fetch=True) == [(0,)]


def test_a_refusal_vanishes_and_keeps_the_sender_away_thirty_days(client, learners):
    client.post("/api/pvp/requests", json={"username": learners[B]})
    with acting_as(B):
        assert client.post(f"/api/pvp/requests/{learners[A]}/refuse").status_code == 200
        assert client.get("/api/pvp/friends").json()["requests"] == []
    assert client.get("/api/pvp/friends").json()["sent"] == []
    assert _search(client, learners[B]).json()["relation"] == "none"
    r = client.post("/api/pvp/requests", json={"username": learners[B]})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "pvp_request_cooldown"
    # Nor can the sender lift the cooldown by withdrawing what vanished.
    assert client.delete(f"/api/pvp/requests/{learners[B]}").status_code == 404
    sql("UPDATE pvp_requests SET refused_at = refused_at - %s WHERE user_id = %s",
        (duel_friends.COOLDOWN + timedelta(minutes=1), A))
    assert client.post("/api/pvp/requests", json={"username": learners[B]}).json() == {"status": "sent"}


def test_a_request_can_be_withdrawn_while_it_waits(client, learners):
    client.post("/api/pvp/requests", json={"username": learners[B]})
    assert client.delete(f"/api/pvp/requests/{learners[B]}").status_code == 200
    with acting_as(B):
        assert client.get("/api/pvp/friends").json()["requests"] == []
    assert client.delete(f"/api/pvp/requests/{learners[B]}").status_code == 404


def test_removing_a_friend_cancels_the_challenges_between_the_two(client, learners):
    befriend(client, A, B, learners)
    duel_id = client.post("/api/pvp/duels", json={"opponent": learners[B], "mode": "async"}).json()["id"]
    assert client.delete(f"/api/pvp/friends/{learners[B]}").status_code == 200
    with acting_as(B):
        assert client.get("/api/pvp/friends").json()["friends"] == []
    assert sql("SELECT status FROM pvp_duels WHERE id = %s", (duel_id,), fetch=True) == [("cancelled",)]
    r = client.post("/api/pvp/duels", json={"opponent": learners[B], "mode": "async"})
    assert r.status_code == 403 and r.json()["detail"]["code"] == "pvp_not_friends"


def test_a_block_makes_each_nobody_to_the_other(client, learners):
    befriend(client, A, B, learners)
    with acting_as(C):
        client.post("/api/pvp/requests", json={"username": learners[A]})
    duel_id = client.post("/api/pvp/duels", json={"opponent": learners[B], "mode": "async"}).json()["id"]
    assert client.post("/api/pvp/blocks", json={"username": learners[B]}).status_code == 200
    assert client.get("/api/pvp/friends").json()["blocked"] == [{"username": learners[B]}]
    assert client.get("/api/pvp/friends").json()["friends"] == []
    assert sql("SELECT status FROM pvp_duels WHERE id = %s", (duel_id,), fetch=True) == [("cancelled",)]
    assert _search(client, learners[B]).status_code == 404
    with acting_as(B):
        assert _search(client, learners[A]).status_code == 404
        assert client.post("/api/pvp/requests", json={"username": learners[A]}).status_code == 404
        assert client.get(f"/api/pvp/learner/{learners[A]}").status_code == 404
    # Another learner's request is untouched.
    assert client.get("/api/pvp/friends").json()["requests"] == [{"username": learners[C]}]
    assert client.delete(f"/api/pvp/blocks/{learners[B]}").status_code == 200
    assert _search(client, learners[B]).json()["relation"] == "none"
    assert [e["action"] for e in events_of(A, "pvp_friend")] == ["request", "block", "unblock"]


def test_a_report_is_a_closed_reason_one_row_per_pair(client, learners):
    assert client.post("/api/pvp/reports", json={"username": learners[B], "reason": "name"}).status_code == 200
    assert client.post("/api/pvp/reports", json={"username": learners[B], "reason": "spam"}).status_code == 200
    rows = sql("SELECT reason FROM pvp_reports WHERE user_id = %s AND reported_id = %s", (A, B), fetch=True)
    assert rows == [("spam",)]
    assert client.post("/api/pvp/reports", json={"username": learners[B], "reason": "rude"}).status_code == 422
    # No words ride with it: a field the model does not know is dropped.
    client.post("/api/pvp/reports", json={"username": learners[B], "reason": "other", "text": "hello"})
    (cols,), = sql("SELECT array_agg(column_name::text) FROM information_schema.columns WHERE table_name = 'pvp_reports'",
                   fetch=True)
    assert set(cols) == {"id", "user_id", "reported_id", "reason", "duel_id", "created_at"}
    assert [e["reason"] for e in events_of(A, "pvp_report")] == ["name", "spam", "other"]


def test_a_blocked_learner_can_still_be_reported(client, learners):
    client.post("/api/pvp/blocks", json={"username": learners[B]})
    assert client.post("/api/pvp/reports", json={"username": learners[B], "reason": "cheat"}).status_code == 200


def test_the_limits_hold(client, learners, monkeypatch):
    monkeypatch.setattr(duel_friends, "PENDING_MAX", 1)
    client.post("/api/pvp/requests", json={"username": learners[B]})
    r = client.post("/api/pvp/requests", json={"username": learners[C]})
    assert r.status_code == 409 and r.json()["detail"]["code"] == "pvp_pending_limit"
    monkeypatch.setattr(duel_friends, "PENDING_MAX", 50)
    monkeypatch.setattr(duel_friends, "REQUESTS_PER_DAY", 1)
    r = client.post("/api/pvp/requests", json={"username": learners[C]})
    assert r.status_code == 429 and r.json()["detail"]["code"] == "pvp_request_limit"
    monkeypatch.setattr(duel_friends, "REQUESTS_PER_DAY", 20)
    with acting_as(B):
        client.post(f"/api/pvp/requests/{learners[A]}/accept")
    monkeypatch.setattr(duel_friends, "FRIENDS_MAX", 1)
    with acting_as(C):
        r = client.post("/api/pvp/requests", json={"username": learners[A]})
        assert r.json() == {"status": "sent"}
    r = client.post(f"/api/pvp/requests/{learners[C]}/accept")
    assert r.status_code == 409 and r.json()["detail"]["code"] == "pvp_friend_limit"


def test_one_cannot_befriend_oneself(client, learners):
    r = client.post("/api/pvp/requests", json={"username": learners[A]})
    assert r.status_code == 400 and r.json()["detail"]["code"] == "pvp_self"
    assert _search(client, learners[A]).json()["relation"] == "me"
