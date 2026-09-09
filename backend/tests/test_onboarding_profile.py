# ── Onboarding's profile fields and endpoints ─────────────────────
# Route tests via the `client` fixture, acting as DEV_USER_ID.
# Every test that stamps onboarding state on the shared test user MUST
# clear it again — resolve_level() reads user_profiles.jlpt_level, so a
# leaked N2 here would silently change what reading-comprehension tests
# elsewhere in the suite are served.
import contextlib

import pytest

import core.user_level as user_level
import routes.profile as profile_module
from core.auth import DEV_USER_ID, prefixed
from core.db import db_conn
from core.srs_instance import srs
from main import app
from routes.profile import get_user_id
from study import level_rule


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
                        daily_departure = NULL, rating_scale = NULL,
                        motive = NULL, kana_known = NULL, reminder_time = NULL,
                        notifications = FALSE
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


def test_the_novice_can_ride_to_n5(client):
    """The boarding's own list, and the one destination it was refused.

    A learner who does not read BOTH scripts is a novice
    (domain/boarding.js levelForKana), boards at N5 -- there is no JLPT
    stop below it -- and is offered six destinations: the novice's own
    stop and the whole line, N5 included, because N5 is still ahead of
    someone who cannot read the kana (goalStops). Five of the six were
    accepted here and the sixth, N5, was refused 422: the rule read the
    STORED boarding level, where a novice and an N5 learner are the same
    row. It was the likeliest destination a beginner picks, and the
    boarding could not be finished at all with it -- seen 2026-09-09.
    """
    for goal in ("novice", "N5", "N4", "N3", "N2", "N1"):
        with _clean_onboarding_state(DEV_USER_ID):
            done = client.post("/api/onboarding/complete", json={
                "jlptLevel": "N5", "dailyNewTarget": 10, "kanaKnown": "hiragana",
                "goalLevel": goal, "goalTargetDate": "2030-01-01",
            })
            assert done.status_code == 200, f"the boarding offers {goal}"
            assert done.json()["goalLevel"] == goal

            # The ride is a real one: boarding level included, so N5 as a
            # destination is the kana plus the whole of N5 rather than an
            # empty promise (routes/journey.py's _journey_levels).
            status = client.get("/api/journey/status").json()
            assert status["goalLevel"] == goal
            assert status["goalStartLevel"] == "N5"
            assert status["itemsTotal"] > 0


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
    # A destination BEHIND the boarding level. Riding to the level you
    # board at is not one of these -- that is the ordinary one-level
    # ride, and the novice's own (test_the_novice_can_ride_to_n5).
    assert client.post("/api/onboarding/complete",
                       json={**base, "goalLevel": "N5"}).status_code == 422
    assert client.post("/api/onboarding/complete",
                       json={**base, "goalLevel": "N4"}).status_code == 422
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
    # 238: the gojūon and the yōon of both scripts, and the fourteen
    # long vowels the syllabary was missing (content/kana_data.py).
    assert body["kana"] == 238


# ── Which rating bar the learner grades with ──────────────────────
# Stored beside the other learning choices and served on the profile
# every screen already fetches, so the bar can be drawn correctly on
# the first paint of a study screen rather than after a second request.
def test_rating_scale_defaults_and_round_trips(client):
    with _clean_onboarding_state(DEV_USER_ID):
        # Never chosen reads as the default rather than as null: the
        # rating bar has to draw something, and a null would leave it
        # guessing. Four is the default of the three, not the shortest.
        assert client.get("/api/profile").json()["ratingScale"] == "simple"

        for scale in ("full", "binary", "simple"):
            assert client.patch("/api/profile/learning",
                                json={"ratingScale": scale}).status_code == 200
            assert client.get("/api/profile").json()["ratingScale"] == scale


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


# ── The boarding's own answers (plan 075) ─────────────────────────
# Motive, the kana check, the rhythm, the hour and the nudge ride on
# the same single POST, are served back on the profile (the plan
# screen and the native shell's daily reminder read them there), and
# every one of them is optional so the office's older callers --
# Settings' retake, a client one build behind -- still complete.
def test_complete_stores_the_boarding_answers_and_the_profile_serves_them(client):
    with _clean_onboarding_state(DEV_USER_ID):
        before = client.get("/api/profile").json()
        assert before["motive"] is None
        assert before["kanaKnown"] is None
        assert before["reminderTime"] is None
        assert before["notifications"] is False

        done = client.post("/api/onboarding/complete", json={
            "jlptLevel": "N5", "dailyNewTarget": 10,
            "goalLevel": "N4", "goalTargetDate": "2030-01-01",
            "dailyDeparture": "am",
            "motive": "trip", "kanaKnown": "none", "rhythmMin": 10,
            "reminderTime": "07:30", "notifications": True, "tzOffsetMin": 540,
        })
        assert done.status_code == 200, done.text
        body = done.json()
        assert body["motive"] == "trip"
        assert body["kanaKnown"] == "none"
        assert body["rhythmMin"] == 10
        assert body["reminderTime"] == "07:30"
        assert body["notifications"] is True
        # 'none' marks nothing known -- the syllabaries are the first stop.
        assert body["kanaRule"] == {"kanaKnown": "none", "markedKnown": 0,
                                    "spreadWeeks": level_rule.SPREAD_WEEKS}

        after = client.get("/api/profile").json()
        assert after["motive"] == "trip"
        assert after["kanaKnown"] == "none"
        assert after["reminderTime"] == "07:30"
        assert after["notifications"] is True


def test_the_boarding_answers_are_optional_and_a_replay_overwrites_them(client):
    with _clean_onboarding_state(DEV_USER_ID):
        # The old five-field contract still completes...
        first = client.post("/api/onboarding/complete",
                            json={"jlptLevel": "N4", "dailyNewTarget": 10})
        assert first.status_code == 200
        assert first.json()["motive"] is None
        assert first.json()["notifications"] is False
        # ...and a replay that answers is simply the new state.
        client.post("/api/onboarding/complete", json={
            "jlptLevel": "N4", "dailyNewTarget": 10,
            "motive": "fun", "reminderTime": "21:00", "notifications": False,
        })
        after = client.get("/api/profile").json()
        assert after["motive"] == "fun"
        assert after["reminderTime"] == "21:00"
        assert after["notifications"] is False
        # A replay with no hour clears it -- like every other choice.
        client.post("/api/onboarding/complete", json={"jlptLevel": "N4", "dailyNewTarget": 10})
        assert client.get("/api/profile").json()["reminderTime"] is None


def test_complete_rejects_bad_boarding_answers(client):
    base = {"jlptLevel": "N5", "dailyNewTarget": 10}
    for bad in (
        {"motive": "boredom"},
        {"kanaKnown": "hangul"},
        {"rhythmMin": 0},
        {"rhythmMin": 999},
        {"reminderTime": "25:00"},
        {"reminderTime": "7:30"},
        {"reminderTime": "07:60"},
        {"tzOffsetMin": 900},
    ):
        assert client.post("/api/onboarding/complete", json={**base, **bad}).status_code == 422, bad


# ── The kana door: the scripts already read start known ───────────
# Its own user, like test_level_rule.py's: the rows this writes are
# real card_modes rows, and the shared DEV user's kana state is what
# the kana tests elsewhere in the suite are served.
KUID = "kana-door-test-user"


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
def kclient(client):
    _wipe(KUID)
    app.dependency_overrides[get_user_id] = lambda: KUID
    try:
        yield client
    finally:
        app.dependency_overrides.pop(get_user_id, None)
        _wipe(KUID)


def _kana_rows(known: str) -> int:
    mode, ids = level_rule.kana_batch(known)
    return srs.count_rows(prefixed(ids, KUID), mode)


def test_kana_known_marks_the_named_scripts_known_and_only_them(kclient):
    hira_mode, hira = level_rule.kana_batch("hiragana")
    _, kata = level_rule.kana_batch("katakana")
    assert hira_mode == "kana.flashcard.f2b"
    # Every set of the script, kana_data's own registry — the gojūon,
    # the yōon and the long vowels.
    assert len(hira) == 113 and len(kata) == 125

    done = kclient.post("/api/onboarding/complete",
                        json={"jlptLevel": "N5", "dailyNewTarget": 10, "kanaKnown": "hiragana"})
    assert done.status_code == 200, done.text
    assert done.json()["kanaRule"]["markedKnown"] == len(hira)
    assert _kana_rows("hiragana") == len(hira)
    assert _kana_rows("katakana") == 0
    assert kclient.get("/api/profile").json()["kanaKnown"] == "hiragana"

    # Replaying with both adds only the other script -- seed_known never
    # touches a row that exists.
    again = kclient.post("/api/onboarding/complete",
                         json={"jlptLevel": "N5", "dailyNewTarget": 10, "kanaKnown": "both"})
    assert again.json()["kanaRule"]["markedKnown"] == len(kata)
    assert _kana_rows("both") == len(hira) + len(kata)

    # And answering 'none' afterwards deletes nothing (moving down never
    # does): the rows stay, the answer is what changes.
    none = kclient.post("/api/onboarding/complete",
                        json={"jlptLevel": "N5", "dailyNewTarget": 10, "kanaKnown": "none"})
    assert none.json()["kanaRule"]["markedKnown"] == 0
    assert _kana_rows("both") == len(hira) + len(kata)
    assert kclient.get("/api/profile").json()["kanaKnown"] == "none"


def test_the_seeded_kana_rows_are_mastered_and_spread(kclient):
    kclient.post("/api/onboarding/complete",
                 json={"jlptLevel": "N5", "dailyNewTarget": 10, "kanaKnown": "katakana"})
    mode, ids = level_rule.kana_batch("katakana")
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT MIN(next_review), MAX(next_review), BOOL_AND(NOT is_learning),
                       MIN(interval_days)
                FROM card_modes WHERE mode = %s AND card_id = ANY(%s)
                """,
                (mode, prefixed(ids, KUID)),
            )
            first, last, all_known, min_interval = cur.fetchone()
    finally:
        conn.close()
    assert all_known is True
    assert min_interval >= 21
    # The last check lands on the six-week horizon, the first well inside it.
    assert (last - first).days >= level_rule.SPREAD_DAYS - 1


# ── Settings › Destination moves the nudge with the hour ──────────
def test_reprinting_the_daily_hour_moves_the_reminder_with_it(client):
    with _clean_onboarding_state(DEV_USER_ID):
        client.post("/api/onboarding/complete", json={
            "jlptLevel": "N5", "dailyNewTarget": 10, "goalLevel": "N4",
            "dailyDeparture": "am", "reminderTime": "08:00", "notifications": True,
        })
        r = client.post("/api/journey/reprint", json={"dailyDeparture": "pm"})
        assert r.status_code == 200, r.text
        assert r.json()["dailyDeparture"] == "pm"
        assert client.get("/api/profile").json()["reminderTime"] == "21:00"

        # Flexible clears the reminder: no hour, no nudge.
        client.post("/api/journey/reprint", json={"dailyDeparture": None})
        after = client.get("/api/profile").json()
        assert after["reminderTime"] is None
        # A reprint of the DATE alone leaves the hour where it was.
        client.post("/api/journey/reprint", json={"dailyDeparture": "noon"})
        client.post("/api/journey/reprint", json={"goalTargetDate": "2031-01-01"})
        assert client.get("/api/profile").json()["reminderTime"] == "12:30"
