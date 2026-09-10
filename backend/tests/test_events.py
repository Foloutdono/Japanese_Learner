# ── 足跡 — POST /api/events, and the promise it has to keep ──
# The privacy policy says no trackers and no third parties, which this
# design earns by staying first-party; what it CANNOT promise on its own
# is that no learner's own words end up in a row. These tests pin that:
# a name outside the closed set is dropped, a property outside its
# name's allowlist is dropped, and a value that is not a scalar -- the
# shape free text would arrive in -- never reaches the table.
#
# They also pin the two failures that would be silent. An unknown event
# name must not 500 (a client mid-deploy sends the previous build's
# names, and a study session must not break because of it), and a bad
# batch must not take the good rows with it.
import uuid
from datetime import datetime, timedelta, timezone

import pytest

from core import events
from core.auth import DEV_USER_ID
from core.db import db_conn


@pytest.fixture(autouse=True)
def clear_events():
    """This user's trail, gone before and after. The shared DEV_USER_ID
    is the id every request in this suite resolves to, so leaving rows
    would make the next test count them."""
    def wipe():
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM event_log WHERE user_id = %s", (DEV_USER_ID,))
            conn.commit()
        finally:
            conn.close()
    wipe()
    yield
    wipe()


def rows():
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT name, props, at FROM event_log WHERE user_id = %s ORDER BY id",
                (DEV_USER_ID,),
            )
            return cur.fetchall()
    finally:
        conn.close()


# ── 定期券 — the offer, and the time it took ──────────────────────

def test_the_offer_records_all_three_verbs_with_its_door(client):
    # The pass is shown from five doors and sold from none, so these
    # three are the only willingness-to-pay signal there is. A view with
    # neither an intent nor a dismiss after it would mean a door that
    # cannot be evaluated, which is why the pairing is enforced in the
    # store rather than at the call sites (frontend/src/stores/credits.js).
    r = client.post("/api/events", json={"events": [
        {"name": "offer_view", "props": {"where": "runout"}},
        {"name": "offer_intent", "props": {"where": "runout", "ms": 21400}},
        {"name": "offer_dismiss", "props": {"where": "settings", "ms": 1800}},
    ]})
    assert r.status_code == 202
    assert r.json()["kept"] == 3
    assert [(name, props) for name, props, _ in rows()] == [
        ("offer_view", {"where": "runout"}),
        ("offer_intent", {"where": "runout", "ms": 21400}),
        ("offer_dismiss", {"where": "settings", "ms": 1800}),
    ]


def test_a_boarding_step_carries_how_long_it_held_them(client):
    # `ms` is ENGAGED time -- the client stops counting while the tab is
    # hidden (frontend/src/lib/dwell.js) -- which is what makes "which
    # question stalls people" answerable at all.
    r = client.post("/api/events", json={"events": [
        {"name": "boarding_step", "props": {"step": "name", "to": "why", "dir": "fwd", "index": 1, "ms": 23400}},
        {"name": "boarding_done", "props": {"level": "N5", "ms": 204000}},
    ]})
    assert r.status_code == 202
    kept = [props for _, props, _ in rows()]
    assert kept[0]["ms"] == 23400
    assert kept[1]["ms"] == 204000


def test_the_offer_never_carries_a_door_it_was_not_opened_from(client):
    # `where` is what every funnel query slices on, so a value the
    # frontend does not have a door for is worth losing rather than
    # silently becoming a sixth column on the dashboard.
    client.post("/api/events", json={"events": [
        {"name": "offer_intent", "props": {"where": "runout", "ms": 900, "price": "9.99"}},
    ]})
    # `price` is outside the allowlist for this name and is dropped; the
    # event itself is kept, because losing the intent would be worse.
    assert [props for _, props, _ in rows()] == [{"where": "runout", "ms": 900}]


# ── The closed set ────────────────────────────────────────────────

def test_a_name_outside_the_set_is_dropped_not_stored(client):
    r = client.post("/api/events", json={"events": [
        {"name": "screen_view", "props": {"route": "/today"}},
        {"name": "definitely_not_an_event", "props": {"route": "/today"}},
    ]})
    assert r.status_code == 202
    assert r.json()["kept"] == 1
    assert [name for name, _, _ in rows()] == ["screen_view"]


def test_an_unknown_name_alone_is_not_an_error(client):
    # A client running the previous build during a deploy. Answering 4xx
    # would make lib/track.js retry a batch that can never succeed.
    r = client.post("/api/events", json={"events": [{"name": "retired_event"}]})
    assert r.status_code == 202
    assert r.json()["kept"] == 0


def test_the_batch_is_capped(client):
    over = [{"name": "screen_view", "props": {"route": "/today"}}] * (events.MAX_BATCH + 25)
    r = client.post("/api/events", json={"events": over})
    assert r.json()["kept"] == events.MAX_BATCH


# ── The privacy rule ──────────────────────────────────────────────

def test_a_property_outside_the_allowlist_never_lands(client):
    client.post("/api/events", json={"events": [{
        "name": "screen_view",
        # `answer` is what a dictation grader would carry, and is
        # exactly the kind of key a careless call site could add.
        "props": {"route": "/practice/dictation/:level", "answer": "こんにちは", "tab": "practice"},
    }]})
    (_, props, _), = rows()
    assert props == {"route": "/practice/dictation/:level", "tab": "practice"}
    assert "answer" not in props


def test_a_non_scalar_value_is_dropped(client):
    # A dict or a list is the shape a token list, an analysed sentence
    # or a card body would arrive in.
    client.post("/api/events", json={"events": [{
        "name": "run_complete",
        "props": {"kind": "vocab", "items": [{"surface": "猫"}], "mode": {"a": 1}, "secs": 42},
    }]})
    (_, props, _), = rows()
    assert props == {"kind": "vocab", "secs": 42}


def test_a_long_string_is_cut(client):
    client.post("/api/events", json={"events": [
        {"name": "screen_view", "props": {"route": "/" + "ね" * 400}},
    ]})
    (_, props, _), = rows()
    assert len(props["route"]) == events.MAX_STR


def test_clean_refuses_a_name_it_does_not_know():
    assert events.clean("nope", {}) is None
    assert events.clean(None, {}) is None
    assert events.clean("screen_view", {"route": "/today"}) == {"route": "/today"}


# ── The clock ─────────────────────────────────────────────────────

def test_a_client_timestamp_is_honoured_within_the_window(client):
    # The queue survives a reload, so an event really can be hours old
    # and its own time is the true one.
    earlier = datetime.now(timezone.utc) - timedelta(hours=3)
    client.post("/api/events", json={"events": [
        {"name": "app_open", "at": earlier.isoformat(), "props": {"boot_ms": 900}},
    ]})
    (_, _, at), = rows()
    assert abs((at - earlier).total_seconds()) < 2


def test_a_clock_in_the_future_is_clamped_to_now(client):
    ahead = datetime.now(timezone.utc) + timedelta(days=400)
    client.post("/api/events", json={"events": [
        {"name": "app_open", "at": ahead.isoformat(), "props": {"boot_ms": 1}},
    ]})
    (_, _, at), = rows()
    assert at <= datetime.now(timezone.utc) + timedelta(seconds=2)


def test_a_clock_far_in_the_past_is_floored():
    now = datetime.now(timezone.utc)
    ancient = (now - timedelta(days=900)).isoformat()
    assert events.clean_at(ancient, now) == now - events.MAX_BACKDATE
    assert events.clean_at("not a date", now) == now
    assert events.clean_at(None, now) == now


# ── Server-side recording ─────────────────────────────────────────

def test_record_writes_without_a_request():
    events.record(DEV_USER_ID, "fare_blocked", {"balance": 0, "fare": 1, "kind": "review"})
    (name, props, _), = rows()
    assert name == "fare_blocked"
    assert props == {"balance": 0, "fare": 1, "kind": "review"}


def test_record_swallows_an_unknown_name():
    # A typo at a server call site must not 500 the route it sits in.
    events.record(DEV_USER_ID, "not_a_real_event", {"x": 1})
    assert rows() == []


def test_every_name_in_keep_long_is_a_real_event():
    assert events.KEEP_LONG <= set(events.EVENTS)


def test_the_frontend_and_backend_agree_on_the_names():
    """lib/track.js declares the same closed set this module does.

    They are written in two languages and edited months apart; the only
    thing stopping a name being added on one side and silently dropped
    on the other is this test.
    """
    import re
    from pathlib import Path
    track = Path(__file__).resolve().parents[2] / "frontend" / "src" / "lib" / "track.js"
    source = track.read_text(encoding="utf-8")
    block = source.split("export const EVENTS = {", 1)[1].split("}", 1)[0]
    declared = set(re.findall(r"^\s*(\w+)\s*:", block, re.MULTILINE))
    assert declared == set(events.EVENTS), (
        f"only in track.js: {declared - set(events.EVENTS)}; "
        f"only in core/events.py: {set(events.EVENTS) - declared}"
    )


def test_deleting_the_account_takes_the_trail_with_it():
    """event_log and event_daily are in routes/account.py's PLAN.

    test_account.py already fails if a declared table is unclassified;
    this says the classification is DELETE rather than SHARED, which is
    the half that matters for a table holding behaviour.
    """
    from routes.account import PLAN
    planned = {table for table, _, _ in PLAN}
    assert "event_log" in planned
    assert "event_daily" in planned


def test_the_trail_is_capped_by_prune_logs():
    """An unbounded events table on a 500 MB database is a matter of
    time. compact_events.py is the real retention; this pins the outer
    bound so a database where it was never run still cannot grow
    forever."""
    from scripts.prune_logs import BY_AGE
    assert any(table == "event_log" for table, _, _, _ in BY_AGE)


def test_a_new_user_id_never_sees_another_learners_trail():
    other = f"someone-else-{uuid.uuid4()}"
    events.record(other, "screen_view", {"route": "/today"})
    try:
        assert rows() == []
    finally:
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM event_log WHERE user_id = %s", (other,))
            conn.commit()
        finally:
            conn.close()
