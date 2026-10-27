"""The owner's bell (core/bell.py, plan 276).

These pin what privacy.html promises of it: a post carries a message's
kind, number and closed classes, never its words, its reply address or
its author; nothing in it can ping anyone; it is tagged by the ids
DISCORD_FEEDBACK_TAGS gives and rings anyway when Discord refuses the
tags; and it is silent with no webhook set.
"""
import json
import threading

import httpx
import pytest

from core import bell
from core.auth import DEV_USER_ID
from core.db import db_conn
from routes import decks, feedback

WORDS = "Mon voisin Kenji m'a dit que la carte était fausse"


@pytest.fixture(autouse=True)
def clean_messages(monkeypatch):
    monkeypatch.delenv(bell.WEBHOOK_ENV, raising=False)
    monkeypatch.delenv(bell.TAGS_ENV, raising=False)

    def wipe():
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM feedback WHERE user_id = %s", (DEV_USER_ID,))
            conn.commit()
        finally:
            conn.close()

    wipe()
    yield
    wipe()


@pytest.fixture
def rung(monkeypatch):
    posts = []
    monkeypatch.setattr(bell, "ring", posts.append)
    return posts


def test_a_message_rings_with_its_number_and_never_its_words(client, rung, monkeypatch):
    monkeypatch.setattr(feedback, "_reply_address", lambda user_id: "learner@example.com")
    r = client.post("/api/feedback", json={
        "kind": "card", "card_id": "vocab_N5_先生_せんせい", "reasons": ["meaning", "example"],
        "text": WORDS, "route": "/learn/vocab", "vp": "phone", "os": "ios", "reply": True,
    })
    assert r.status_code == 200, r.text
    [post] = rung
    sent = json.dumps(post, ensure_ascii=False)
    assert WORDS not in sent and "Kenji" not in sent
    assert "learner@example.com" not in sent and DEV_USER_ID not in sent
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, triage FROM feedback WHERE user_id = %s", (DEV_USER_ID,))
            (number, triage), = cur.fetchall()
    finally:
        conn.close()
    assert triage == "new"
    assert post["thread_name"] == f"Carte · vocab_N5_先生_せんせい · #{number}"
    assert "`vocab_N5_先生_せんせい` · sens, exemple" in post["content"]
    assert f"{len(WORDS)} caractères · réponse demandée" in post["content"]
    assert f"read_feedback --id {number}" in post["content"]
    # The device classes are the script's to show, not the bell's.
    assert "ios" not in post["content"]


def test_a_refused_message_rings_nothing(client, rung):
    assert client.post("/api/feedback", json={"kind": "problem", "text": "  "}).status_code == 400
    assert rung == []


def test_a_failure_and_a_rating_say_what_they_are(monkeypatch):
    monkeypatch.setenv(bell.TAGS_ENV, "problem=11,failure=22,reply=33,rating=44")
    post = bell.message_post(number=7, kind="problem", chars=0, route="/today", area="/api/today", status=500)
    assert post["thread_name"] == "Problème · /api/today 500 · #7"
    assert "Échec `/api/today` · 500" in post["content"] and "sans mot" in post["content"]
    assert post["applied_tags"] == ["11", "22"]
    post = bell.message_post(number=8, kind="rating", chars=1, rating=4, reply=True)
    assert post["thread_name"] == "Note · ★★★★☆ · #8"
    assert "1 caractère · réponse demandée" in post["content"]
    assert post["applied_tags"] == ["44", "33"]


def test_nothing_in_a_post_reads_as_markdown_or_pings():
    post = bell.message_post(number=1, kind="card", chars=0, card_id="`@everyone`[x](https://a.b)" + "x" * 200)
    assert post["allowed_mentions"] == {"parse": []}
    assert "`'@everyone'[x](https://a.b)" in post["content"]
    assert len(post["thread_name"]) == bell.THREAD_NAME_MAX


def test_tags_are_read_by_key_and_a_stray_pair_is_ignored(monkeypatch):
    monkeypatch.setenv(bell.TAGS_ENV, " card = 123 ,nope=4, idea=abc,deck=99,")
    assert bell.tag_ids() == {"card": "123", "deck": "99"}
    assert "applied_tags" not in bell.message_post(number=1, kind="idea", chars=3)


def test_every_kind_and_reason_has_its_words():
    assert set(feedback.KINDS) <= set(bell.TAGS)
    reasons = set(feedback.CARD_REASONS) | set(feedback.QUESTION_REASONS) | set(decks.REPORT_REASONS)
    assert reasons <= set(bell.REASONS)
    assert len(set(bell.TAGS.values())) == len(bell.TAGS)


class _Discord:
    def __init__(self, *answers):
        self.answers = list(answers)
        self.sent = []

    def post(self, url, json=None, **kw):
        self.sent.append(json)
        answer = self.answers.pop(0)
        if isinstance(answer, Exception):
            raise answer
        return httpx.Response(answer)


def test_no_webhook_sends_nothing(monkeypatch):
    discord = _Discord()
    monkeypatch.setattr(bell.httpx, "post", discord.post)
    assert bell.send({"content": "x"}) is None
    bell.ring({"content": "x"})
    assert discord.sent == []


def test_a_post_refused_for_its_tags_is_sent_bare(monkeypatch):
    monkeypatch.setenv(bell.WEBHOOK_ENV, "https://discord.test/api/webhooks/1/t")
    discord = _Discord(400, 204)
    monkeypatch.setattr(bell.httpx, "post", discord.post)
    assert bell.send({"content": "x", "applied_tags": ["1"]}) == 204
    assert discord.sent == [{"content": "x", "applied_tags": ["1"]}, {"content": "x"}]


def test_a_discord_out_of_reach_costs_nothing(monkeypatch):
    monkeypatch.setenv(bell.WEBHOOK_ENV, "https://discord.test/api/webhooks/1/t")
    monkeypatch.setattr(bell.httpx, "post", _Discord(httpx.ConnectError("down")).post)
    assert bell.send({"content": "x"}) is None


def test_the_bell_rings_off_the_request(monkeypatch):
    monkeypatch.setenv(bell.WEBHOOK_ENV, "https://discord.test/api/webhooks/1/t")
    done = threading.Event()
    seen = []

    def send(payload):
        seen.append((threading.current_thread().name, payload))
        done.set()

    monkeypatch.setattr(bell, "send", send)
    bell.ring({"content": "x"})
    assert done.wait(5)
    assert seen == [("bell", {"content": "x"})]


def test_the_setup_finds_the_forums_tags_by_name(monkeypatch):
    from scripts import discord_bell
    found, missing = discord_bell.match([
        {"id": 1, "name": " carte "}, {"id": 2, "name": "PANNE"}, {"id": 3, "name": "Autre"},
    ])
    assert found == {"card": "1", "failure": "2"}
    assert set(missing) == set(bell.TAGS) - {"card", "failure"}
    line = discord_bell.env_line(found)
    assert line == "DISCORD_FEEDBACK_TAGS=card=1,failure=2"
    # What it prints is what the backend reads back.
    monkeypatch.setenv(bell.TAGS_ENV, line.split("=", 1)[1])
    assert bell.tag_ids() == found
