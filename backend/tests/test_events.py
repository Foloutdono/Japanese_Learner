# ── The funnel log: what it accepts, and what it must refuse ──────
# Runs as a DEDICATED user (dependency override) rather than
# DEV_USER_ID: these assertions count rows in event_log, and the shared
# dev user collects events from any other suite that walks a flow.
# The fixture deletes exactly its own rows.
#
# The refusals are the point of most of this file. event_log is a
# write-only table a client can append to, so the allowlist, the
# scalar rule and the two caps are the only things standing between it
# and being a general-purpose dumping ground.
import json

import pytest

from core.db import db_conn
from main import app
# Imported from the router module, not core.auth — see the note in
# test_journey.py about test_auth_jwks.py reloading core.auth.
from routes.events import get_user_id

EUID = "events-test-user"


@pytest.fixture()
def eclient(client):
    app.dependency_overrides[get_user_id] = lambda: EUID
    try:
        yield client
    finally:
        app.dependency_overrides.pop(get_user_id, None)
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM event_log WHERE user_id = %s", (EUID,))
            conn.commit()
        finally:
            conn.close()


def _rows():
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT name, props FROM event_log WHERE user_id = %s ORDER BY id",
                (EUID,),
            )
            return cur.fetchall()
    finally:
        conn.close()


def test_a_batch_lands_in_order(eclient):
    r = eclient.post("/api/events", json={"events": [
        {"name": "onboarding_start", "props": {"step": "name", "index": 0}},
        {"name": "onboarding_step", "props": {"step": "name", "index": 0}},
        {"name": "paywall_view", "props": {"source": "onboarding"}},
    ]})
    assert r.status_code == 200
    assert r.json() == {"accepted": 3}
    rows = _rows()
    assert [n for n, _ in rows] == ["onboarding_start", "onboarding_step", "paywall_view"]
    assert rows[2][1] == {"source": "onboarding"}


def test_props_default_to_an_empty_object(eclient):
    r = eclient.post("/api/events", json={"events": [{"name": "onboarding_complete"}]})
    assert r.status_code == 200
    assert _rows() == [("onboarding_complete", {})]


def test_the_whole_paywall_funnel_is_accepted(eclient):
    # Every source and every paywall verb, because a name or a source
    # that only the frontend knows about is a silently missing slice of
    # the dashboard rather than an error anyone would notice.
    events = [
        {"name": verb, "props": {"source": src}}
        for src in ("onboarding", "balance", "profile", "settings", "runout")
        for verb in ("paywall_view", "paywall_intent", "paywall_dismiss")
    ]
    r = eclient.post("/api/events", json={"events": events})
    assert r.status_code == 200
    assert r.json() == {"accepted": 15}


def test_durations_are_kept(eclient):
    # `ms` is engaged time (frontend/src/lib/dwell.js): the clock stops
    # while the tab is hidden, so these are answerable questions —
    # "which boarding question stalls people", "how long before the
    # paywall is dismissed" — rather than wall-clock noise.
    r = eclient.post("/api/events", json={"events": [
        {"name": "onboarding_step", "props": {"step": "why", "index": 1, "ms": 4200}},
        {"name": "onboarding_complete", "props": {"step": "pass", "index": 12, "ms": 91000}},
        {"name": "paywall_dismiss", "props": {"source": "settings", "ms": 1800}},
        {"name": "paywall_intent", "props": {"source": "runout", "ms": 0}},
    ]})
    assert r.status_code == 200
    assert [props.get("ms") for _, props in _rows()] == [4200, 91000, 1800, 0]


@pytest.mark.parametrize("bad", [
    {"name": "button_clicked"},                                  # not on the allowlist
    {"name": "paywall_view", "props": {"source": "elsewhere"}},  # unknown source
    {"name": "paywall_view", "props": {"nested": {"a": 1}}},     # object prop
    {"name": "paywall_view", "props": {"list": [1, 2, 3]}},      # array prop
    {"name": "onboarding_step", "props": {"step": "x" * 600}},   # over the byte cap
    {"name": "onboarding_step", "props": {"ms": -1}},            # time does not run backwards
    {"name": "onboarding_step", "props": {"ms": 7 * 60 * 60 * 1000}},  # past the sane ceiling
    {"name": "onboarding_step", "props": {"ms": "4200"}},        # a string, not a duration
    {"name": "onboarding_step", "props": {"ms": True}},          # bool is an int in Python
])
def test_a_refused_event_writes_nothing(eclient, bad):
    r = eclient.post("/api/events", json={"events": [bad]})
    assert r.status_code == 422, r.text
    assert _rows() == []


def test_an_oversized_batch_is_refused(eclient):
    events = [{"name": "onboarding_step", "props": {"step": "name"}}] * 26
    assert eclient.post("/api/events", json={"events": events}).status_code == 422
    assert _rows() == []


def test_an_empty_batch_is_refused(eclient):
    assert eclient.post("/api/events", json={"events": []}).status_code == 422


def test_one_bad_event_rejects_the_whole_batch(eclient):
    # All-or-nothing on purpose: a batch is one flush from one client,
    # and half-writing it would leave a funnel with steps missing and
    # no signal that anything was dropped.
    r = eclient.post("/api/events", json={"events": [
        {"name": "onboarding_start", "props": {"step": "name"}},
        {"name": "not_a_real_event"},
    ]})
    assert r.status_code == 422
    assert _rows() == []
