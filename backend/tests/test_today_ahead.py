# ── 発車案内 — the day ahead (plan 156) ──────────────────────────────
# The native shells schedule the daily nudge as dated notifications and
# hand a widget its figures, both decided while the app is open and
# shown while it is not. /api/today/ahead counts the gate at instants
# the device names, the way /api/today counts it now; says whether the
# learner has answered anything since their midnight; and lists the
# words a widget may print with their answer -- known, and not asked
# for again this week.
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from core.auth import get_user_id
from core.db import db_conn
from core.srs_instance import srs
from main import app
from routes.today import SETTLED_DAYS, _instants, _short_gloss
from study import card_index
from tests.test_today_ration import _board, _wipe

AHEAD_USER = "ahead-test-user"
F2B = "vocab.flashcard.f2b"


@pytest.fixture()
def client(client):
    _wipe(AHEAD_USER)
    previous = app.dependency_overrides.get(get_user_id)
    app.dependency_overrides[get_user_id] = lambda: AHEAD_USER
    try:
        yield client
    finally:
        if previous is None:
            app.dependency_overrides.pop(get_user_id, None)
        else:
            app.dependency_overrides[get_user_id] = previous
        _wipe(AHEAD_USER)


def _iso(t: datetime) -> str:
    return t.isoformat().replace("+00:00", "Z")


def _board_words(client) -> None:
    """Boarded at N5 on the vocab line, both scripts read -- less the
    kana the boarding marks known, whose reviews fall due over the
    following days and would crowd every count here."""
    _board(client, "N5", "both", 5, ["vocab"])
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM card_modes WHERE card_id LIKE %s", (f"{AHEAD_USER}:kana\\_%",))
            cur.execute("DELETE FROM cards WHERE id LIKE %s", (f"{AHEAD_USER}:kana\\_%",))
        conn.commit()
    finally:
        conn.close()


def _answered(raw_ids: list[str], due: datetime) -> None:
    """These words answered once, and next due at `due`."""
    for raw_id in raw_ids:
        srs.review(f"{AHEAD_USER}:{raw_id}", F2B, 4)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE card_modes SET next_review = %s WHERE card_id = ANY(%s)",
                (due, [f"{AHEAD_USER}:{r}" for r in raw_ids]),
            )
            assert cur.rowcount == len(raw_ids)
        conn.commit()
    finally:
        conn.close()


# ── The pure part ─────────────────────────────────────────────────

def test_instants_read_offsets_and_refuse_the_rest():
    now = datetime.now(timezone.utc)
    soon = now + timedelta(hours=2)
    got = _instants(f"{_iso(soon)},{(soon + timedelta(days=1)).isoformat()}")
    assert [t.tzinfo for t in got] == [timezone.utc, timezone.utc]
    assert abs((got[0] - soon).total_seconds()) < 1
    for bad in (
        "",                                                     # none
        "tomorrow",                                             # not an instant
        soon.replace(tzinfo=None).isoformat(),                  # no offset
        _iso(now + timedelta(days=30)),                         # too far
        ",".join(_iso(now + timedelta(hours=h)) for h in range(9)),  # too many
    ):
        with pytest.raises(HTTPException) as err:
            _instants(bad)
        assert err.value.status_code == 422


def test_a_gloss_is_cut_to_a_widget_line():
    assert _short_gloss("soil; earth; ground") == "soil; earth"
    assert _short_gloss("mountain") == "mountain"
    assert _short_gloss("a rather long first sense; and a second one besides") == "a rather long first sense"
    assert _short_gloss("") == ""


# ── The endpoint ──────────────────────────────────────────────────

def test_each_instant_counts_what_the_gate_will_hold(client):
    # Vocab only, both scripts read: no kana lane, a pace of 5.
    _board_words(client)
    words = card_index.raw_ids("vocab", "N5", F2B)[:6]
    now = datetime.now(timezone.utc)
    # Six first reviews today spend the whole pace: nothing new is left
    # for today, a whole day's worth for tomorrow's instant.
    _answered(words[:2], now - timedelta(minutes=1))
    _answered(words[2:4], now + timedelta(days=2))
    _answered(words[4:], now + timedelta(days=30))

    soon, later = now + timedelta(minutes=5), now + timedelta(days=3)
    r = client.get("/api/today/ahead", params={"at": f"{_iso(soon)},{_iso(later)}"})
    assert r.status_code == 200, r.text
    body = r.json()
    first, second = body["points"]

    assert (first["total"], first["new"]) == (2, 0)
    # The two due in two days join the two owed now; the pace's five
    # new cards ride on the later day.
    assert (second["total"], second["new"]) == (9, 5)
    assert second["lanes"][0]["source"] == "vocab"
    assert second["lanes"][0]["count"] == 9
    # The instant now is the gate now.
    assert first["total"] == client.get("/api/today").json()["total"]
    # Asked without `since`, the day's ride is not guessed at.
    assert body["rode_today"] is None


def test_a_day_already_ridden_is_said(client):
    _board(client, "N5", "both", 5, ["vocab"])
    now = datetime.now(timezone.utc)
    at = _iso(now + timedelta(hours=1))
    before = client.get("/api/today/ahead", params={"at": at, "since": _iso(now - timedelta(hours=1))})
    assert before.json()["rode_today"] is False
    _answered(card_index.raw_ids("vocab", "N5", F2B)[:1], now + timedelta(days=1))
    after = client.get("/api/today/ahead", params={"at": at, "since": _iso(now - timedelta(hours=1))})
    assert after.json()["rode_today"] is True
    # Answers from before the learner's midnight do not count.
    tomorrow = client.get("/api/today/ahead", params={"at": at, "since": _iso(now + timedelta(minutes=1))})
    assert tomorrow.json()["rode_today"] is False


def test_the_widget_words_are_known_and_not_due_this_week(client):
    # The seeded kana stay: they are known, not due this week, and no
    # word -- the query must look past them.
    _board(client, "N5", "both", 5, ["vocab"])
    words = card_index.raw_ids("vocab", "N5", F2B)[:6]
    now = datetime.now(timezone.utc)
    _answered(words[:3], now + timedelta(days=SETTLED_DAYS + 5))
    _answered(words[3:], now + timedelta(days=2))

    body = client.get("/api/today/ahead", params={"at": _iso(now + timedelta(hours=1)), "lang": "en"}).json()
    settled = {card_index.entry_for("vocab", r)["kanji"] or card_index.entry_for("vocab", r)["kana"] for r in words[:3]}
    assert {w["jp"] for w in body["words"]} == settled
    for w in body["words"]:
        assert w["source"] == "vocab"
        assert w["meaning"]


def test_the_ahead_refuses_what_it_cannot_read(client):
    assert client.get("/api/today/ahead").status_code == 422
    assert client.get("/api/today/ahead", params={"at": "soon"}).status_code == 422
    at = _iso(datetime.now(timezone.utc) + timedelta(hours=1))
    assert client.get("/api/today/ahead", params={"at": at, "since": "midnight"}).status_code == 422


def test_settings_switch_the_nudge(client):
    _board(client, "N5", "both", 5, ["vocab"])
    r = client.patch("/api/profile/learning", json={"notifications": True})
    assert r.status_code == 200, r.text
    assert r.json()["notifications"] is True
    assert client.get("/api/profile").json()["notifications"] is True
    client.patch("/api/profile/learning", json={"notifications": False})
    assert client.get("/api/profile").json()["notifications"] is False


def test_a_learner_who_never_boarded_is_told_nothing_is_due(client):
    # No level, no pace, no cards: every train empty, no word, no error.
    at = _iso(datetime.now(timezone.utc) + timedelta(days=1))
    body = client.get("/api/today/ahead", params={"at": at}).json()
    assert body["points"] == [{"at": body["points"][0]["at"], "total": 0, "new": 0, "lanes": []}]
    assert body["words"] == []
