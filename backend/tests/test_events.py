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


def test_the_offer_keeps_the_pick_and_whether_every_offer_was_seen(client):
    # The offer is a choice now: Pro or Max, yearly or monthly, with Max
    # behind "See all offers". The pick is two of the app's own enums
    # and `all` a boolean -- nothing typed -- and together they are what
    # the pricing sheet's annual share and the cost of leading with Pro
    # alone are read from.
    r = client.post("/api/events", json={"events": [
        {"name": "offer_intent", "props": {"where": "balance", "ms": 9100,
                                            "plan": "pro", "billing": "yearly", "all": False}},
        {"name": "offer_dismiss", "props": {"where": "runout", "ms": 4000, "all": True}},
    ]})
    assert r.status_code == 202
    assert [props for _, props, _ in rows()] == [
        {"where": "balance", "ms": 9100, "plan": "pro", "billing": "yearly", "all": False},
        {"where": "runout", "ms": 4000, "all": True},
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


def test_a_body_far_past_the_cap_is_refused_before_it_is_parsed(client):
    # lib/track.js sends a flush of twenty at most; a list this long is
    # no client of ours, and the body is bounded before validation.
    over = [{"name": "screen_view"}] * (4 * events.MAX_BATCH + 1)
    assert client.post("/api/events", json={"events": over}).status_code == 422


def test_a_database_that_is_down_is_not_an_error(client, monkeypatch):
    # The pool refusing a connection is the same failure as a write that
    # fails: swallowed, so lib/track.js does not retry it.
    import routes.events

    def down():
        raise RuntimeError("pool exhausted")

    monkeypatch.setattr(routes.events, "db_conn", down)
    r = client.post("/api/events", json={"events": [{"name": "screen_view", "props": {"route": "/today"}}]})
    assert r.status_code == 202
    assert r.json() == {"kept": 0}


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
        {"name": "boarding_step", "props": {"step": "ね" * 400}},
    ]})
    (_, props, _), = rows()
    assert len(props["step"]) == events.MAX_STR


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


# ── The same batch twice is kept once ─────────────────────────────

def test_a_batch_sent_twice_is_kept_once(client):
    # A flush on pagehide the page never heard back about is sent again
    # from the mirror on the next launch; the client's id per event is
    # what keeps the row from doubling (the live walk of plan 100 found
    # two guide_done rows for one gate).
    batch = {"events": [
        {"id": "evt-1", "name": "guide_done", "props": {"gate": "today", "skipped": False, "stops": 6, "ms": 4000}},
        {"id": "evt-2", "name": "guide_step", "props": {"gate": "today", "stop": "hud.level", "index": 0}},
    ]}
    first = client.post("/api/events", json=batch)
    assert first.status_code == 202 and first.json()["kept"] == 2
    again = client.post("/api/events", json=batch)
    assert again.status_code == 202 and again.json()["kept"] == 0
    assert [r[0] for r in rows()] == ["guide_done", "guide_step"]
    # A row with no id is never deduplicated: an older client's, or the
    # server's own.
    bare = {"events": [{"name": "install_prompt", "props": {"outcome": "dismissed"}}]}
    client.post("/api/events", json=bare)
    client.post("/api/events", json=bare)
    assert [r[0] for r in rows()].count("install_prompt") == 2


# ── 訪問 — the session id rides beside the event ──────────────────

def sids():
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT name, sid FROM event_log WHERE user_id = %s ORDER BY id",
                (DEV_USER_ID,),
            )
            return cur.fetchall()
    finally:
        conn.close()


def test_a_session_id_is_kept_beside_the_event_not_in_its_props(client):
    sid = str(uuid.uuid4())
    r = client.post("/api/events", json={"events": [
        {"name": "session_start", "sid": sid, "props": {}},
        {"name": "screen_view", "sid": sid, "props": {"route": "/today", "sid": "smuggled"}},
    ]})
    assert r.json()["kept"] == 2
    assert sids() == [("session_start", sid), ("screen_view", sid)]
    # `sid` is not a property of screen_view, so the allowlist drops it.
    assert [props for _, props, _ in rows()] == [{}, {"route": "/today"}]


def test_a_session_id_is_held_to_its_shape():
    # The one column the property allowlist does not cover, so the shape
    # is the whole defence: letters, digits and dashes, 8 to 64.
    assert events.clean_sid(str(uuid.uuid4())) is not None
    assert events.clean_sid("lx3k9a-4f7q2m1z") == "lx3k9a-4f7q2m1z"
    for bad in ("short", "x" * 65, "ma liste de mots 01", "../../etc/passwd", "été-été-été-été", "", None, 12345678, {"a": 1}):
        assert events.clean_sid(bad) is None


def test_a_bad_session_id_costs_the_event_nothing(client):
    r = client.post("/api/events", json={"events": [
        {"name": "screen_view", "sid": "ma liste de mots", "props": {"route": "/today"}},
    ]})
    assert r.json()["kept"] == 1
    assert sids() == [("screen_view", None)]


def test_an_older_client_with_no_session_id_is_still_kept(client):
    client.post("/api/events", json={"events": [{"name": "screen_view", "props": {"route": "/today"}}]})
    assert sids() == [("screen_view", None)]


# ── 足跡 II (plan 215): enums, shapes, the opt-out, the export ─────

def test_a_route_that_is_not_a_pattern_is_dropped(client):
    # `route` is held to a shape on every name: a pattern has no room
    # for a space, an accent or a dot, which is what a learner's words
    # (a theme, a deck name) are made of. `path` likewise, to an area.
    client.post("/api/events", json={"events": [
        {"name": "screen_view", "props": {"route": "/learn/vocab/theme/:theme", "tab": "learn"}},
        {"name": "screen_view", "props": {"route": "/learn/vocab/theme/mes mots préférés"}},
        {"name": "screen_leave", "props": {"route": "/learn/decks/:deck_id", "ms": 8400}},
        {"name": "api_error", "props": {"path": "/api/decks/9f3a", "status": 500}},
    ]})
    assert [props for _, props, _ in rows()] == [
        {"route": "/learn/vocab/theme/:theme", "tab": "learn"},
        {},
        {"route": "/learn/decks/:deck_id", "ms": 8400},
        {"status": 500},
    ]


def test_an_enum_value_outside_its_list_is_dropped(client):
    # The structural half of "nothing a learner typed": under these keys
    # only the app's own words get through, however they were sent.
    client.post("/api/events", json={"events": [
        {"name": "feature_use", "props": {"feature": "speech", "action": "play", "route": "/today/run", "n": 3}},
        {"name": "feature_use", "props": {"feature": "ma recherche", "action": "search", "n": 1}},
        {"name": "setting_change", "props": {"setting": "theme", "value": "dark"}},
        {"name": "setting_change", "props": {"setting": "theme", "value": "rose bonbon"}},
    ]})
    assert [props for _, props, _ in rows()] == [
        {"feature": "speech", "action": "play", "route": "/today/run", "n": 3},
        {"action": "search", "n": 1},
        {"setting": "theme", "value": "dark"},
        {"setting": "theme"},
    ]


def test_a_visit_carries_its_coarse_context(client):
    sid = str(uuid.uuid4())
    client.post("/api/events", json={"events": [
        {"name": "session_start", "sid": sid, "props": {
            "platform": "web", "vp": "desk", "os": "windows", "lang": "fr",
            "theme": "auto", "input": "mouse", "standalone": False, "reduced": False,
            # Never a raw value: a user agent or a resolution is dropped.
            "ua": "Mozilla/5.0 (Windows NT 10.0)", "width": 1366,
        }},
        {"name": "session_start", "sid": sid, "props": {"os": "Windows NT 10.0; Win64"}},
    ]})
    assert [props for _, props, _ in rows()] == [
        {"platform": "web", "vp": "desk", "os": "windows", "lang": "fr",
         "theme": "auto", "input": "mouse", "standalone": False, "reduced": False},
        {},
    ]


def test_a_run_carries_how_it_went(client):
    client.post("/api/events", json={"events": [
        {"name": "run_complete", "props": {
            "kind": "reading", "mode": "sentence", "level": "N4", "items": 10, "secs": 300,
            "ms": 240000, "card_p50": 21000, "card_p90": 40000, "right": 7, "where": "practice"}},
        {"name": "run_abandon", "props": {"kind": "vocab", "done": 4, "ms": 50000, "where": "nowhere"}},
    ]})
    kept = [props for _, props, _ in rows()]
    assert kept[0]["card_p50"] == 21000 and kept[0]["right"] == 7 and kept[0]["where"] == "practice"
    assert kept[1] == {"kind": "vocab", "done": 4, "ms": 50000}


def test_every_enum_names_a_declared_key():
    for name, keys in events.VALUES.items():
        assert name in events.EVENTS, name
        for key, allowed in keys.items():
            assert key in events.EVENTS[name], (name, key)
            assert allowed and all(isinstance(v, str) and len(v) <= events.MAX_STR for v in allowed)


def _js_values():
    """track.js's VALUES, read as data: the block between its opening
    line and `// end VALUES`, turned into JSON."""
    import json
    import re
    from pathlib import Path
    track = Path(__file__).resolve().parents[2] / "frontend" / "src" / "lib" / "track.js"
    source = track.read_text(encoding="utf-8")
    block = source.split("export const VALUES = {", 1)[1].split("// end VALUES", 1)[0]
    block = re.sub(r"//[^\n]*", "", block).strip()
    assert block.endswith("}")
    block = block[:-1]
    block = block.replace("'", '"')
    block = re.sub(r"(\b\w+)\s*:", r'"\1":', block)
    block = re.sub(r",\s*([}\]])", r"\1", "{" + block + "}")
    return json.loads(block)


def test_the_frontend_and_backend_agree_on_the_values():
    js = {name: {key: sorted(v) for key, v in keys.items()} for name, keys in _js_values().items()}
    py = {name: {key: sorted(v) for key, v in keys.items()} for name, keys in events.VALUES.items()}
    assert js == py


def _set_opt_out(user_id: str, off: bool) -> None:
    from routes.profile import ensure_profile_row
    ensure_profile_row(user_id)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE user_profiles SET analytics_off = %s WHERE user_id = %s", (off, user_id))
        conn.commit()
    finally:
        conn.close()


@pytest.fixture
def opted_out():
    _set_opt_out(DEV_USER_ID, True)
    yield
    _set_opt_out(DEV_USER_ID, False)


def test_an_opted_out_account_is_not_counted_from_any_browser(client, opted_out):
    # The switch was a localStorage flag until plan 215: the desk kept
    # counting a learner who had opted out on the phone.
    r = client.post("/api/events", json={"events": [{"name": "screen_view", "props": {"route": "/today"}}]})
    assert r.status_code == 202
    assert r.json()["kept"] == 0
    assert rows() == []


def test_an_opted_out_account_is_not_counted_by_the_server_either(opted_out):
    # fare_blocked, day_clear, basics units, ai_use: written by routes,
    # never through the browser's flag.
    events.record(DEV_USER_ID, "day_clear", {"streak": 3, "tier": "day"})
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            events.record(DEV_USER_ID, "limit_reached", {"kind": "deck", "at": 3}, cur=cur)
        conn.commit()
    finally:
        conn.close()
    assert rows() == []


def test_the_opt_out_check_never_breaks_a_callers_transaction():
    # core/credits.py records inside its own transaction; the opt-out
    # read runs in a savepoint so it cannot abort the caller's work.
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            events.record(DEV_USER_ID, "limit_reached", {"kind": "deck", "at": 3}, cur=cur)
            cur.execute("SELECT 1")
            assert cur.fetchone()[0] == 1
        conn.commit()
    finally:
        conn.close()
    assert [name for name, _, _ in rows()] == ["limit_reached"]


def test_the_profile_carries_and_takes_the_switch(client):
    try:
        r = client.patch("/api/profile/learning", json={"analyticsOff": True})
        assert r.status_code == 200 and r.json()["analyticsOff"] is True
        assert client.get("/api/profile").json()["analyticsOff"] is True
    finally:
        client.patch("/api/profile/learning", json={"analyticsOff": False})
    assert client.get("/api/profile").json()["analyticsOff"] is False


def test_the_learner_can_take_their_trail_away(client):
    # GDPR art. 15: the usage statistics are the learner's to read, in
    # both halves, and the session id stays behind.
    sid = str(uuid.uuid4())
    client.post("/api/events", json={"events": [
        {"name": "screen_view", "sid": sid, "props": {"route": "/today", "tab": "today"}},
    ]})
    r = client.get("/api/profile/export/trail")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/csv")
    lines = r.text.splitlines()
    assert lines[0] == "at,name,count,props"
    assert any(",screen_view,1," in line and "/today" in line for line in lines[1:])
    assert sid not in r.text


def test_a_rationed_call_leaves_a_count_behind():
    from core import daily_limit
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM daily_usage WHERE user_id = %s AND feature = 'ask'", (DEV_USER_ID,))
        conn.commit()
    finally:
        conn.close()
    daily_limit.claim(DEV_USER_ID, "ask", 1)
    daily_limit.claim(DEV_USER_ID, "ask", 1)
    assert [props for name, props, _ in rows() if name == "ai_use"] == [
        {"feature": "ask", "count": 1, "limit": 1, "over": False},
        {"feature": "ask", "count": 2, "limit": 1, "over": True},
    ]


def test_the_daily_counts_are_held_to_twenty_five_months():
    from scripts.prune_logs import BY_AGE
    assert ("event_daily", "day", 761) in [(t, c, d) for t, c, d, _ in BY_AGE]
