# ── Onboarding's profile fields and endpoints ─────────────────────
# Route tests via the `client` fixture, acting as DEV_USER_ID.
# Every test that stamps onboarding state on the shared test user MUST
# clear it again — resolve_level() reads user_profiles.jlpt_level, so a
# leaked N2 here would silently change what reading-comprehension tests
# elsewhere in the suite are served.
import contextlib

import core.user_level as user_level
import routes.profile as profile_module
from core.auth import DEV_USER_ID
from core.db import db_conn


@contextlib.contextmanager
def _clean_onboarding_state(user_id: str):
    try:
        yield
    finally:
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE user_profiles
                    SET jlpt_level = NULL, daily_new_target = NULL, onboarded_at = NULL,
                        goal_start_level = NULL, goal_level = NULL,
                        goal_target_date = NULL, goal_set_at = NULL,
                        daily_departure = NULL, rating_scale = NULL
                    WHERE user_id = %s
                    """,
                    (user_id,),
                )
            conn.commit()
        finally:
            conn.close()
        user_level._cache.clear()


def test_init_db_is_idempotent():
    # CREATE IF NOT EXISTS is a no-op on the existing table, so the
    # ALTER loop is the real migration — this proves both survive a
    # second run (every startup runs them again).
    profile_module._init_db()
    profile_module._init_db()


def test_profile_surfaces_onboarding_fields_null_before_set_after(client):
    with _clean_onboarding_state(DEV_USER_ID):
        before = client.get("/api/profile").json()
        assert before["jlptLevel"] is None
        assert before["dailyNewTarget"] is None
        assert before["onboardedAt"] is None

        done = client.post("/api/onboarding/complete",
                           json={"jlptLevel": "N3", "dailyNewTarget": 10})
        assert done.status_code == 200

        after = client.get("/api/profile").json()
        assert after["jlptLevel"] == "N3"
        assert after["dailyNewTarget"] == 10
        assert after["onboardedAt"] is not None
        # The XP level is a separate concept and must still be present
        # under its own (bare) name — see CONTEXT.md.
        assert isinstance(after["level"], int)


def test_complete_creates_the_row_when_none_exists(client):
    # A user who never opened the Profile screen has no user_profiles
    # row at all; complete must seed one, not UPDATE zero rows. The
    # endpoint always acts as DEV_USER_ID, so prove the seeding path by
    # deleting the row first.
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM user_profiles WHERE user_id = %s", (DEV_USER_ID,))
        conn.commit()
    finally:
        conn.close()

    with _clean_onboarding_state(DEV_USER_ID):
        done = client.post("/api/onboarding/complete",
                           json={"jlptLevel": "N5", "dailyNewTarget": 5})
        assert done.status_code == 200
        assert done.json()["jlptLevel"] == "N5"
        assert client.get("/api/profile").json()["jlptLevel"] == "N5"


def test_completing_twice_keeps_the_first_timestamp(client):
    with _clean_onboarding_state(DEV_USER_ID):
        first = client.post("/api/onboarding/complete",
                            json={"jlptLevel": "N4", "dailyNewTarget": 10}).json()
        second = client.post("/api/onboarding/complete",
                             json={"jlptLevel": "N2", "dailyNewTarget": 20}).json()
        # Choices update; the onboarded moment does not.
        assert second["jlptLevel"] == "N2"
        assert second["onboardedAt"] == first["onboardedAt"]


def test_complete_rejects_invalid_values(client):
    assert client.post("/api/onboarding/complete",
                       json={"jlptLevel": "N6", "dailyNewTarget": 10}).status_code == 422
    assert client.post("/api/onboarding/complete",
                       json={"jlptLevel": "N5", "dailyNewTarget": 0}).status_code == 422
    assert client.post("/api/onboarding/complete",
                       json={"jlptLevel": "N5", "dailyNewTarget": 999}).status_code == 422


# ── The journey contract riding on complete (plan 063) ────────────
def test_complete_with_goal_stamps_the_contract(client):
    with _clean_onboarding_state(DEV_USER_ID):
        done = client.post("/api/onboarding/complete", json={
            "jlptLevel": "N5", "dailyNewTarget": 12,
            "goalLevel": "N3", "goalTargetDate": "2030-01-01",
            "dailyDeparture": "am",
        })
        assert done.status_code == 200
        body = done.json()
        assert body["goalLevel"] == "N3"
        assert body["goalTargetDate"] == "2030-01-01"
        assert body["goalSetAt"] is not None
        assert body["dailyDeparture"] == "am"

        status = client.get("/api/journey/status").json()
        assert status["goalStartLevel"] == "N5"
        assert status["goalLevel"] == "N3"
        assert status["goalTargetDate"] == "2030-01-01"
        assert status["plannedPerDay"] == 12
        assert status["dailyDeparture"] == "am"


def test_goalless_replay_clears_a_previous_goal(client):
    # "Just ride" is a first-class answer — replaying the office without
    # a destination must not leave a stale contract behind.
    with _clean_onboarding_state(DEV_USER_ID):
        client.post("/api/onboarding/complete", json={
            "jlptLevel": "N5", "dailyNewTarget": 10,
            "goalLevel": "N4", "goalTargetDate": "2030-01-01",
        })
        client.post("/api/onboarding/complete",
                    json={"jlptLevel": "N5", "dailyNewTarget": 10})
        status = client.get("/api/journey/status").json()
        assert status["goalLevel"] is None
        assert status["goalTargetDate"] is None
        assert status["goalSetAt"] is None
        assert status["goalStartLevel"] is None


def test_complete_rejects_incoherent_goals(client):
    base = {"jlptLevel": "N3", "dailyNewTarget": 10}
    # Destination behind (or at) the boarding level.
    assert client.post("/api/onboarding/complete",
                       json={**base, "goalLevel": "N3"}).status_code == 422
    assert client.post("/api/onboarding/complete",
                       json={**base, "goalLevel": "N5"}).status_code == 422
    # A date with no destination is not a goal.
    assert client.post("/api/onboarding/complete",
                       json={**base, "goalTargetDate": "2030-01-01"}).status_code == 422
    # A ticket that expired before it was printed.
    assert client.post("/api/onboarding/complete",
                       json={**base, "goalLevel": "N1",
                             "goalTargetDate": "2020-01-01"}).status_code == 422
    # An hour the station doesn't announce.
    assert client.post("/api/onboarding/complete",
                       json={**base, "dailyDeparture": "dawn"}).status_code == 422


def test_patch_learning_updates_only_what_was_sent(client):
    with _clean_onboarding_state(DEV_USER_ID):
        client.post("/api/onboarding/complete",
                    json={"jlptLevel": "N4", "dailyNewTarget": 10})

        r = client.patch("/api/profile/learning", json={"jlptLevel": "N3"})
        assert r.status_code == 200
        after = client.get("/api/profile").json()
        assert after["jlptLevel"] == "N3"
        assert after["dailyNewTarget"] == 10  # untouched

        client.patch("/api/profile/learning", json={"dailyNewTarget": 20})
        after = client.get("/api/profile").json()
        assert after["jlptLevel"] == "N3"  # untouched
        assert after["dailyNewTarget"] == 20
        # Changing your level later is not re-onboarding.
        assert after["onboardedAt"] is not None


def test_patch_learning_with_nothing_to_update_is_422(client):
    assert client.patch("/api/profile/learning", json={}).status_code == 422


def test_volumes_counts_items_not_cards(client):
    body = client.get("/api/onboarding/volumes").json()
    assert set(body) == {"vocab", "kanji", "grammar", "kana"}
    # Spot values pinned to the content decks; if a deck grows these
    # move together with it (the endpoint computes from the same data).
    assert body["grammar"] == {lvl: 71 for lvl in ("N5", "N4", "N3", "N2", "N1")}
    assert body["vocab"]["N5"] == 667
    assert body["kanji"]["N1"] == 1232
    assert body["kana"] == 224


# ── Which rating bar the learner grades with ──────────────────────
# Stored beside the other learning choices and served on the profile
# every screen already fetches, so the bar can be drawn correctly on
# the first paint of a study screen rather than after a second request.
def test_rating_scale_defaults_and_round_trips(client):
    with _clean_onboarding_state(DEV_USER_ID):
        # Never chosen reads as the default rather than as null: the
        # rating bar has to draw something, and a null would leave it
        # guessing.
        assert client.get("/api/profile").json()["ratingScale"] == "simple"

        assert client.patch("/api/profile/learning",
                            json={"ratingScale": "full"}).status_code == 200
        assert client.get("/api/profile").json()["ratingScale"] == "full"

        assert client.patch("/api/profile/learning",
                            json={"ratingScale": "simple"}).status_code == 200
        assert client.get("/api/profile").json()["ratingScale"] == "simple"


def test_an_unknown_rating_scale_is_refused(client):
    with _clean_onboarding_state(DEV_USER_ID):
        assert client.patch("/api/profile/learning",
                            json={"ratingScale": "sixish"}).status_code == 422
        assert client.get("/api/profile").json()["ratingScale"] == "simple"


def test_setting_the_scale_leaves_the_other_learning_fields_alone(client):
    # PATCH is partial: sending one field must not blank the others,
    # which is what an UPDATE built from a fixed column list would do.
    with _clean_onboarding_state(DEV_USER_ID):
        client.post("/api/onboarding/complete",
                    json={"jlptLevel": "N3", "dailyNewTarget": 10})
        client.patch("/api/profile/learning", json={"ratingScale": "full"})

        after = client.get("/api/profile").json()
        assert after["ratingScale"] == "full"
        assert after["jlptLevel"] == "N3"
        assert after["dailyNewTarget"] == 10


def test_a_patch_with_nothing_in_it_is_still_a_caller_bug(client):
    assert client.patch("/api/profile/learning", json={}).status_code == 422
