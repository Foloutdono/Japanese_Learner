"""Nous écrire — a learner's message (routes/feedback.py, plan 222).

These pin what the sheet and the privacy page rely on: a message is
kept with its words and only the context the trail's classes allow; a
value outside them is dropped, never stored; a card's report names a
card and says what is wrong with it; an empty or unknown message is
refused with a code the sheet maps to its own words; five a day; the
reply's address is the account's, never the request's; and the rows go
with the account.
"""

import pytest

from core.auth import DEV_USER_ID
from core.db import db_conn
from routes import feedback


def _wipe():
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM feedback WHERE user_id = %s", (DEV_USER_ID,))
        conn.commit()
    finally:
        conn.close()


@pytest.fixture(autouse=True)
def clean_messages():
    _wipe()
    yield
    _wipe()


def _rows():
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT kind, body, reasons, card_id, exam_id, revision, question_id, route, area, status, platform, vp, os, lang, "
                "reply, reply_to FROM feedback WHERE user_id = %s ORDER BY id",
                (DEV_USER_ID,),
            )
            cols = [d[0] for d in cur.description]
            return [dict(zip(cols, row)) for row in cur.fetchall()]
    finally:
        conn.close()


def _code(response):
    return response.json()["detail"]["code"]


def test_a_message_is_kept_with_its_context(client):
    r = client.post("/api/feedback", json={
        "kind": "idea", "text": "  Revoir les cartes ratées du jour.  ",
        "route": "/profile/settings/:page", "platform": "web", "vp": "phone",
        "os": "ios", "lang": "fr", "reply": True,
    })
    assert r.status_code == 200, r.text
    assert r.json()["ok"] is True
    [row] = _rows()
    assert row["kind"] == "idea"
    assert row["body"] == "Revoir les cartes ratées du jour."
    assert (row["route"], row["platform"], row["vp"], row["os"], row["lang"]) == (
        "/profile/settings/:page", "web", "phone", "ios", "fr")
    # Asked for, and no account address to read under DEV_USER_ID.
    assert row["reply"] is True and row["reply_to"] is None


def test_context_outside_the_classes_is_dropped_not_stored(client):
    r = client.post("/api/feedback", json={
        "kind": "problem", "text": "La dictée ne valide plus.",
        "route": "/learn/decks/Mon paquet secret", "area": "/api/decks/42",
        "status": 500, "platform": "toaster", "vp": "1920x1080", "os": "iPhone 15", "lang": "de",
    })
    assert r.status_code == 200, r.text
    [row] = _rows()
    assert row["body"] == "La dictée ne valide plus."
    for key in ("route", "area", "status", "platform", "vp", "os", "lang"):
        assert row[key] is None, key


def test_a_failure_keeps_its_area_and_status(client):
    r = client.post("/api/feedback", json={
        "kind": "problem", "text": "Ça n'a pas chargé.", "area": "/api/today", "status": 503,
    })
    assert r.status_code == 200, r.text
    [row] = _rows()
    assert (row["area"], row["status"]) == ("/api/today", 503)


def test_a_status_without_an_area_is_not_kept(client):
    client.post("/api/feedback", json={"kind": "problem", "text": "x", "status": 503})
    [row] = _rows()
    assert row["status"] is None


def _question(**over):
    return {"kind": "question", "exam_id": "n5-listening-01", "revision": 2,
            "question_id": "listening_m1_q9", "reasons": ["ambiguous", "answer"], **over}


def test_a_question_report_names_its_paper_and_its_question(client):
    r = client.post("/api/feedback", json=_question())
    assert r.status_code == 200, r.text
    [row] = _rows()
    assert (row["exam_id"], row["revision"], row["question_id"]) == ("n5-listening-01", 2, "listening_m1_q9")
    assert row["card_id"] is None and row["body"] == ""
    # In the closed list's order, whatever order they were sent in.
    assert row["reasons"] == ["answer", "ambiguous"]


@pytest.mark.parametrize("body,code", [
    (_question(exam_id="N5 listening"), "feedback_question"),
    (_question(exam_id=None), "feedback_question"),
    (_question(question_id="q 9; DROP"), "feedback_question"),
    (_question(question_id=None), "feedback_question"),
    (_question(revision=None), "feedback_question"),
    (_question(reasons=["reading"]), "feedback_reason"),
    (_question(reasons=[]), "feedback_empty"),
])
def test_a_question_report_is_held_to_closed_shapes(client, body, code):
    r = client.post("/api/feedback", json=body)
    assert r.status_code == 400 and _code(r) == code


def test_a_question_report_may_be_words_alone(client):
    assert client.post("/api/feedback", json=_question(reasons=[], text="La clé est fausse.")).status_code == 200


def test_a_card_report_names_its_card_and_what_is_wrong(client):
    r = client.post("/api/feedback", json={
        "kind": "card", "card_id": "vocab_N5_先生_せんせい",
        "reasons": ["meaning", "reading"],
    })
    assert r.status_code == 200, r.text
    [row] = _rows()
    assert row["card_id"] == "vocab_N5_先生_せんせい"
    # In the closed list's order, whatever order they were sent in.
    assert row["reasons"] == ["reading", "meaning"]
    assert row["body"] == ""


def test_a_card_report_with_words_alone_is_kept(client):
    r = client.post("/api/feedback", json={
        "kind": "card", "card_id": "kanji_N5_先", "text": "L'exemple n'utilise pas ce kanji.",
    })
    assert r.status_code == 200, r.text


@pytest.mark.parametrize("body, code", [
    ({"kind": "idea", "text": "   "}, "feedback_empty"),
    ({"kind": "complaint", "text": "x"}, "feedback_kind"),
    ({"kind": "card", "reasons": ["meaning"]}, "feedback_card"),
    ({"kind": "card", "card_id": "user-1:vocab_N5_先生_せんせい", "reasons": ["meaning"]}, "feedback_card"),
    ({"kind": "card", "card_id": "vocab_N5_先生_せんせい"}, "feedback_empty"),
    ({"kind": "card", "card_id": "vocab_N5_先生_せんせい", "reasons": ["rude"]}, "feedback_reason"),
])
def test_a_message_that_says_nothing_or_names_nothing_is_refused(client, body, code):
    r = client.post("/api/feedback", json=body)
    assert r.status_code == 400
    assert _code(r) == code
    assert _rows() == []


@pytest.mark.parametrize("body", [
    {"kind": "idea", "text": "x" * (feedback.TEXT_MAX + 1)},
    {"kind": "card", "card_id": "x" * 161, "reasons": ["other"]},
    {"kind": "card", "card_id": "c", "reasons": ["other"] * 6},
    {"kind": "idea", "text": "x", "status": 600},
])
def test_every_field_is_bounded(client, body):
    assert client.post("/api/feedback", json=body).status_code == 422
    assert _rows() == []


def test_the_text_bound_is_inclusive(client):
    r = client.post("/api/feedback", json={"kind": "idea", "text": "あ" * feedback.TEXT_MAX})
    assert r.status_code == 200, r.text


def test_five_a_day(client):
    for i in range(feedback.DAILY_MAX):
        assert client.post("/api/feedback", json={"kind": "idea", "text": f"idée {i}"}).status_code == 200
    r = client.post("/api/feedback", json={"kind": "idea", "text": "une de trop"})
    assert r.status_code == 429
    assert _code(r) == "feedback_limit"
    assert len(_rows()) == feedback.DAILY_MAX


def test_the_reply_address_is_never_taken_from_the_request(client):
    # An `email` the body carries is not a field: the model ignores it.
    r = client.post("/api/feedback", json={
        "kind": "idea", "text": "x", "reply": True, "reply_to": "stranger@example.com",
        "email": "stranger@example.com",
    })
    assert r.status_code == 200, r.text
    [row] = _rows()
    assert row["reply_to"] is None


def test_the_reply_address_is_the_accounts(monkeypatch):
    class Answer:
        status_code = 200

        @staticmethod
        def json():
            return {"id": "u-1", "email": "learner@example.com"}

    seen = {}

    def fake_get(url, **kwargs):
        seen["url"] = url
        return Answer()

    monkeypatch.setattr(feedback.auth, "DEV_USER_ID", None)
    monkeypatch.setattr(feedback.auth, "SUPABASE_URL", "https://project.supabase.co")
    monkeypatch.setattr(feedback.auth, "SUPABASE_SERVICE_KEY", "service-key")
    monkeypatch.setattr(feedback.httpx, "get", fake_get)
    assert feedback._reply_address("u-1") == "learner@example.com"
    assert seen["url"] == "https://project.supabase.co/auth/v1/admin/users/u-1"


def test_an_unread_address_still_keeps_the_message(monkeypatch):
    def down(url, **kwargs):
        raise feedback.httpx.ConnectError("no route")

    monkeypatch.setattr(feedback.auth, "DEV_USER_ID", None)
    monkeypatch.setattr(feedback.auth, "SUPABASE_URL", "https://project.supabase.co")
    monkeypatch.setattr(feedback.auth, "SUPABASE_SERVICE_KEY", "service-key")
    monkeypatch.setattr(feedback.httpx, "get", down)
    assert feedback._reply_address("u-1") is None


def test_the_messages_go_with_the_account():
    from routes.account import PLAN
    assert ("feedback", "user_id = %(user)s") in [(t, c) for t, c, _w in PLAN]


# ── The sheet's half (frontend/src/lib/feedback.js) ─────────────────

def _js_list(source, name):
    import re
    m = re.search(rf"export const {name} = \[([^\]]*)\]", source)
    assert m, f"lib/feedback.js declares no {name}"
    return re.findall(r"'([a-z_]+)'", m.group(1))


def test_the_sheet_declares_what_the_server_accepts():
    import re
    from pathlib import Path
    js = (Path(__file__).resolve().parents[2] / "frontend" / "src" / "lib" / "feedback.js").read_text(encoding="utf-8")
    # The sheet's kinds are the server's but the card's, which only the
    # flag sends.
    assert _js_list(js, "KINDS") == [k for k in feedback.KINDS if k not in ("card", "question")]
    assert _js_list(js, "CARD_REASONS") == list(feedback.CARD_REASONS)
    assert _js_list(js, "QUESTION_REASONS") == list(feedback.QUESTION_REASONS)
    m = re.search(r"export const TEXT_MAX = (\d+)", js)
    assert m and int(m.group(1)) == feedback.TEXT_MAX
