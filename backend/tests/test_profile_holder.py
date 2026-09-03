"""The pass-holder profile (2026-09): the stamp book's calendar, the
retention figure, and the 番付's weekly side.

Shape tests against the live test database, like test_onboarding_profile:
what the frontend reads must be there, in the unit it expects.
"""


def test_profile_carries_the_stamp_book_calendar(client):
    body = client.get("/api/profile").json()

    assert isinstance(body["calendar"], list)
    assert isinstance(body["week"], list)
    # The week is a slice of the calendar, not a second query that
    # could disagree with it.
    calendar_dates = {d["date"] for d in body["calendar"]}
    assert {d["date"] for d in body["week"]} <= calendar_dates
    for day in body["calendar"]:
        assert set(day) == {"date", "count"}
        assert day["count"] >= 1


def test_profile_retention_is_a_share_or_absent(client):
    body = client.get("/api/profile").json()
    retention = body["retention"]
    assert retention is None or 0.0 <= retention <= 1.0
    # Consistent with the review total: a learner with reviews has a
    # share, one without has none.
    if body["totalReviews"] == 0:
        assert retention is None


def test_leaderboard_has_a_weekly_side(client):
    week = client.get("/api/leaderboard?period=week&limit=6")
    assert week.status_code == 200
    body = week.json()
    assert set(body) == {"entries", "me"}
    assert len(body["entries"]) <= 6
    # Weekly XP can never exceed lifetime XP for the same person.
    lifetime = client.get("/api/leaderboard?limit=200").json()
    lifetime_xp = {e["username"]: e["xp"] for e in lifetime["entries"]}
    for e in body["entries"]:
        assert e["xp"] <= lifetime_xp.get(e["username"], e["xp"])


def test_leaderboard_rejects_an_unknown_period(client):
    assert client.get("/api/leaderboard?period=month").status_code == 422
