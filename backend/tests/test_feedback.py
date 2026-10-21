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
                "SELECT kind, body, reasons, card_id, exam_id, revision, question_id, rating, route, area, status, platform, vp, os, lang, "
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


# ── The early-access sheet (plan 269) ───────────────────────────────

def test_a_rating_is_kept_with_or_without_words(client):
    r = client.post("/api/feedback", json={"kind": "rating", "rating": 4, "text": "  Plus de dictées.  "})
    assert r.status_code == 200, r.text
    r = client.post("/api/feedback", json={"kind": "rating", "rating": 5})
    assert r.status_code == 200, r.text
    first, second = _rows()
    assert (first["kind"], first["rating"], first["body"]) == ("rating", 4, "Plus de dictées.")
    assert (second["rating"], second["body"]) == (5, "")


@pytest.mark.parametrize("body", [
    {"kind": "rating"},
    {"kind": "rating", "text": "Bien."},
])
def test_a_rating_names_its_number(client, body):
    r = client.post("/api/feedback", json=body)
    assert r.status_code == 400 and _code(r) == "feedback_rating"
    assert _rows() == []


@pytest.mark.parametrize("rating", [0, 6, -1])
def test_a_rating_is_one_to_five(client, rating):
    assert client.post("/api/feedback", json={"kind": "rating", "rating": rating}).status_code == 422
    assert _rows() == []


def test_only_a_rating_keeps_a_number(client):
    client.post("/api/feedback", json={"kind": "idea", "text": "Des ideas.", "rating": 5})
    [row] = _rows()
    assert row["rating"] is None


def _profile(asked=False):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM user_profiles WHERE user_id = %s", (DEV_USER_ID,))
            cur.execute(
                "INSERT INTO user_profiles (user_id, username, feedback_asked_at) "
                "VALUES (%s, %s, CASE WHEN %s THEN NOW() END)",
                (DEV_USER_ID, "fb-test-" + DEV_USER_ID[:12], asked),
            )
        conn.commit()
    finally:
        conn.close()


@pytest.fixture
def profile():
    _profile()
    yield
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM user_profiles WHERE user_id = %s", (DEV_USER_ID,))
        conn.commit()
    finally:
        conn.close()


def test_the_sheet_is_offered_from_four_hundred_xp(profile):
    assert feedback.OFFER_XP == 400
    assert feedback.offer_open(DEV_USER_ID, 399) is False
    assert feedback.offer_open(DEV_USER_ID, 400) is True
    assert feedback.offer_open(DEV_USER_ID, 5000) is True


def test_a_learner_with_no_profile_is_not_asked():
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM user_profiles WHERE user_id = %s", (DEV_USER_ID,))
        conn.commit()
    finally:
        conn.close()
    assert feedback.offer_open(DEV_USER_ID, 10_000) is False


def test_a_rating_answers_the_offer(client, profile):
    assert feedback.offer_open(DEV_USER_ID, 400) is True
    assert client.post("/api/feedback", json={"kind": "rating", "rating": 3}).status_code == 200
    assert feedback.offer_open(DEV_USER_ID, 400) is False


def test_a_refused_rating_leaves_the_offer_open(client, profile):
    assert client.post("/api/feedback", json={"kind": "rating"}).status_code == 400
    assert feedback.offer_open(DEV_USER_ID, 400) is True


def test_a_message_of_another_kind_leaves_the_offer_open(client, profile):
    client.post("/api/feedback", json={"kind": "idea", "text": "Bonjour."})
    assert feedback.offer_open(DEV_USER_ID, 400) is True


def test_shutting_the_sheet_answers_it_too(client, profile):
    r = client.post("/api/feedback/offer")
    assert r.status_code == 200 and r.json() == {"feedbackOffer": False}
    assert feedback.offer_open(DEV_USER_ID, 400) is False
    assert _rows() == []   # nothing is said by shutting it


def test_the_first_stamp_stands(client, profile):
    def stamp():
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT feedback_asked_at FROM user_profiles WHERE user_id = %s", (DEV_USER_ID,))
                return cur.fetchone()[0]
        finally:
            conn.close()
    client.post("/api/feedback/offer")
    first = stamp()
    client.post("/api/feedback", json={"kind": "rating", "rating": 2})
    assert stamp() == first


def test_the_profile_says_when_today_asks(client, profile):
    from core.srs_instance import srs
    assert client.get("/api/profile").json()["feedbackOffer"] is False
    srs.award_xp(DEV_USER_ID, "test", "fb-offer", feedback.OFFER_XP)
    srs.forget_history(DEV_USER_ID)
    try:
        assert client.get("/api/profile").json()["feedbackOffer"] is True
        client.post("/api/feedback/offer")
        assert client.get("/api/profile").json()["feedbackOffer"] is False
    finally:
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM xp_ledger WHERE user_id = %s AND ref = %s", (DEV_USER_ID, "fb-offer"))
            conn.commit()
        finally:
            conn.close()
        srs.forget_history(DEV_USER_ID)


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
    assert _js_list(js, "KINDS") == [k for k in feedback.KINDS if k not in ("card", "question", "rating")]
    assert _js_list(js, "CARD_REASONS") == list(feedback.CARD_REASONS)
    assert _js_list(js, "QUESTION_REASONS") == list(feedback.QUESTION_REASONS)
    # The early-access sheet's stars are the server's bounds, one to five.
    import re as _re
    m = _re.search(r"export const RATINGS = \[([^\]]*)\]", js)
    assert m and [int(n) for n in m.group(1).split(",")] == list(range(feedback.RATING_MIN, feedback.RATING_MAX + 1))
    m = re.search(r"export const TEXT_MAX = (\d+)", js)
    assert m and int(m.group(1)) == feedback.TEXT_MAX
