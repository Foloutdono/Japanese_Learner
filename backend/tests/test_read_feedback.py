"""scripts/read_feedback.py -- the one place a message's words are read
(plan 222): newest first, each with what it carried, the address to
answer only when one was asked for, and nothing from anyone else's
window or kind."""
from datetime import datetime, timezone

import pytest

from core.db import db_conn
from scripts import read_feedback

USER = "read-feedback-test-learner"


@pytest.fixture(autouse=True)
def rows():
    def wipe():
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM feedback WHERE user_id = %s", (USER,))
            conn.commit()
        finally:
            conn.close()

    wipe()
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO feedback (user_id, kind, body, route, vp, os, platform, reply, reply_to, created_at) "
                "VALUES (%s, 'problem', %s, '/profile/settings/:page', 'phone', 'ios', 'web', TRUE, "
                "'learner@example.com', NOW() - INTERVAL '1 hour')",
                (USER, "La dictée ne valide plus.\nDepuis hier."),
            )
            cur.execute(
                "INSERT INTO feedback (user_id, kind, reasons, card_id, created_at) "
                "VALUES (%s, 'card', ARRAY['meaning'], 'vocab_N5_先生_せんせい', NOW())",
                (USER,),
            )
            cur.execute(
                "INSERT INTO feedback (user_id, kind, body, created_at) "
                "VALUES (%s, 'idea', 'Trop vieux', NOW() - INTERVAL '40 days')",
                (USER,),
            )
        conn.commit()
    finally:
        conn.close()
    yield
    wipe()


def _mine(**kw):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            return [r for r in read_feedback.fetch(cur, **kw) if r["user_id"] == USER]
    finally:
        conn.close()


def test_newest_first_within_the_window():
    got = _mine(days=7, kind=None, reply=False)
    assert [r["kind"] for r in got] == ["card", "problem"]


def test_a_kind_and_the_answers_wanted_narrow_it():
    assert [r["kind"] for r in _mine(days=7, kind="card", reply=False)] == ["card"]
    assert [r["kind"] for r in _mine(days=7, kind=None, reply=True)] == ["problem"]


def test_a_message_prints_its_words_and_what_it_carried():
    problem = _mine(days=7, kind="problem", reply=False)[0]
    out = read_feedback.render(problem)
    assert "> La dictée ne valide plus.\n> Depuis hier." in out
    assert "/profile/settings/:page · phone · ios · web" in out
    assert "answer to: learner@example.com" in out
    card = read_feedback.render(_mine(days=7, kind="card", reply=False)[0])
    assert "card `vocab_N5_先生_せんせい` · meaning" in card
    assert "answer to" not in card
    assert "_(no words)_" in card


def test_an_address_that_could_not_be_read_says_whom_to_find():
    row = {**_mine(days=7, kind="problem", reply=False)[0], "reply_to": None}
    assert f"address not read — user {USER}" in read_feedback.render(row)
