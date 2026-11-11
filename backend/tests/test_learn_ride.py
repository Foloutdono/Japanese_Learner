# ── 前回 — the last ride a Learn station boarded (plan 291) ──────────
# The phone's Learn gate offers the last run a station boarded again,
# in one tap. POST /api/profile/ride keeps it on the account, GET
# /api/profile reads it back as `learnRide`. A path is kept only when it
# names a line's stop in one of that line's graded modes: never the
# browse, a tier, a theme or a radical, and never a free string.
import pytest

import routes.profile as profile_module
from core.auth import DEV_USER_ID
from core.db import db_conn


@pytest.fixture
def no_ride():
    profile_module.ensure_profile_row(DEV_USER_ID)
    _clear()
    yield
    _clear()


def _clear():
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE user_profiles SET learn_ride = NULL WHERE user_id = %s", (DEV_USER_ID,))
        conn.commit()
    finally:
        conn.close()


@pytest.mark.parametrize("path", [
    "/learn/vocab/N4/vocab.flashcard.f2b",
    "/learn/kanji/N1/kanji.write_kanji",
    "/learn/grammar/N5/grammar.ladder",
    "/learn/kana/katakana_basic/kana.flashcard.b2f",
])
def test_a_line_stop_in_a_graded_mode_is_a_ride(path):
    assert profile_module.clean_ride(path) == path


@pytest.mark.parametrize("path", [
    None,
    "",
    "/learn/vocab/N4/fast_review",                 # the browse is no ride
    "/learn/vocab/N4/kanji.flashcard.f2b",         # another line's mode
    "/learn/vocab/N6/vocab.flashcard.f2b",         # no such stop
    "/learn/kana/N5/kana.flashcard.f2b",           # kana's stops are its sets
    "/learn/vocab/tier/3/vocab.flashcard.f2b",     # a tier is not a stop
    "/learn/vocab/theme/food/vocab.flashcard.f2b",
    "/learn/decks/12/study/vocab.flashcard.f2b",
    "/practice/reading/N5",
    "/learn/vocab/N4/vocab.flashcard.f2b?x=1",
    "https://example.com/learn/vocab/N4/vocab.flashcard.f2b",
])
def test_anything_else_is_refused(path):
    assert profile_module.clean_ride(path) is None


def test_the_ride_is_kept_and_read_back(client, no_ride):
    assert client.get("/api/profile").json()["learnRide"] is None

    res = client.post("/api/profile/ride", json={"path": "/learn/vocab/N4/vocab.flashcard.f2b"})
    assert res.status_code == 200
    ride = res.json()["learnRide"]
    assert ride["path"] == "/learn/vocab/N4/vocab.flashcard.f2b"
    assert ride["at"]

    assert client.get("/api/profile").json()["learnRide"] == ride

    # The next ride replaces it: the gate offers the last one only.
    client.post("/api/profile/ride", json={"path": "/learn/kanji/N5/kanji.readings"})
    assert client.get("/api/profile").json()["learnRide"]["path"] == "/learn/kanji/N5/kanji.readings"


def test_a_path_that_is_no_ride_is_refused_and_keeps_the_last(client, no_ride):
    client.post("/api/profile/ride", json={"path": "/learn/grammar/N4/grammar.ladder"})
    assert client.post("/api/profile/ride", json={"path": "/learn/vocab/N4/fast_review"}).status_code == 422
    assert client.post("/api/profile/ride", json={"path": "/learn/" + "x" * 200}).status_code == 422
    assert client.get("/api/profile").json()["learnRide"]["path"] == "/learn/grammar/N4/grammar.ladder"


def test_a_stored_ride_the_app_no_longer_offers_reads_as_none(client, no_ride):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE user_profiles SET learn_ride = %s::jsonb WHERE user_id = %s",
                ('{"path": "/learn/vocab/N4/vocab.retired_mode", "at": "2026-10-01T00:00:00+00:00"}', DEV_USER_ID),
            )
        conn.commit()
    finally:
        conn.close()
    assert client.get("/api/profile").json()["learnRide"] is None
