# A daily slot is given back when no model was paid for its call
# (core/daily_limit.refund_unbilled, the owner's rule of 2026-11-11).
#
# The slot is still claimed BEFORE the call, so two requests at once
# cannot both pass the ceiling. What changed is the failure: an outage
# (llm_shared.LLMUnavailable with nothing on the meter) gives its slot
# back, while a reply a model was paid for (refused, unreadable, or a
# read that timed out) keeps it. Every feature claim() counts follows
# the same rule; the last test here keeps them from drifting apart.
import ast
from pathlib import Path

import pytest

from content.grammar_points_data import find, grammar_to_id
from core import daily_limit
from core.auth import DEV_USER_ID
from core.db import db_conn
from routes import composition, exams, reading, translation
from routes import conversation as conversation_route
from routes import phrase as phrase_module
from study import llm_shared
from study.llm_shared import LLMUnavailable

BACKEND = Path(__file__).resolve().parent.parent
FEATURE = "test-refund"


def _count(feature: str) -> int:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT COALESCE(SUM(count), 0) FROM daily_usage WHERE user_id = %s AND feature = %s",
                (DEV_USER_ID, feature),
            )
            return cur.fetchone()[0]
    finally:
        conn.close()


def _wipe() -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM daily_usage WHERE user_id = %s", (DEV_USER_ID,))
            cur.execute("DELETE FROM event_log WHERE user_id = %s AND name IN ('ai_use', 'ai_refund')",
                        (DEV_USER_ID,))
        conn.commit()
    finally:
        conn.close()


@pytest.fixture(autouse=True)
def clean():
    _wipe()
    yield
    _wipe()


def _refunds() -> list:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT props FROM event_log WHERE user_id = %s AND name = 'ai_refund' ORDER BY id",
                        (DEV_USER_ID,))
            return [r[0] for r in cur.fetchall()]
    finally:
        conn.close()


# ── release() ─────────────────────────────────────────────────────────

def test_release_gives_back_one_slot():
    for _ in range(3):
        daily_limit.claim(DEV_USER_ID, FEATURE, 5)
    daily_limit.release(DEV_USER_ID, FEATURE)
    assert _count(FEATURE) == 2
    assert daily_limit.claim(DEV_USER_ID, FEATURE, 5) == 3


def test_release_never_goes_below_zero_nor_makes_a_row():
    daily_limit.release(DEV_USER_ID, FEATURE)
    assert _count(FEATURE) == 0
    daily_limit.claim(DEV_USER_ID, FEATURE, 5)
    daily_limit.release(DEV_USER_ID, FEATURE)
    daily_limit.release(DEV_USER_ID, FEATURE)
    assert _count(FEATURE) == 0
    assert daily_limit.claim(DEV_USER_ID, FEATURE, 5) == 1


def test_a_refund_is_on_the_trail_and_a_release_with_nothing_to_give_is_not():
    daily_limit.release(DEV_USER_ID, "ask")
    assert _refunds() == []
    daily_limit.claim(DEV_USER_ID, "ask", 5)
    daily_limit.release(DEV_USER_ID, "ask")
    assert _refunds() == [{"feature": "ask"}]


def test_a_database_failure_keeps_the_slot_quietly(monkeypatch):
    daily_limit.claim(DEV_USER_ID, FEATURE, 5)

    def broken():
        raise RuntimeError("no database")
    monkeypatch.setattr(daily_limit, "db_conn", broken)
    daily_limit.release(DEV_USER_ID, FEATURE)
    monkeypatch.undo()
    assert _count(FEATURE) == 1


# ── refund_unbilled() ─────────────────────────────────────────────────

def _claimed_then(body) -> int:
    daily_limit.claim(DEV_USER_ID, FEATURE, 5)
    try:
        with daily_limit.refund_unbilled(DEV_USER_ID, FEATURE):
            body()
    except Exception:
        pass
    return _count(FEATURE)


def _outage():
    raise LLMUnavailable("every provider failed")


def _billed_then_outage():
    llm_shared._billed()
    raise LLMUnavailable("no model gave a usable reply")


def _as_503():
    from fastapi import HTTPException
    try:
        _outage()
    except LLMUnavailable as e:
        raise HTTPException(503, detail=str(e))


def test_an_outage_gives_the_slot_back():
    assert _claimed_then(_outage) == 0


def test_an_outage_turned_into_a_503_gives_the_slot_back():
    assert _claimed_then(_as_503) == 0


def test_a_billed_reply_keeps_the_slot_even_if_the_call_then_fails():
    assert _claimed_then(_billed_then_outage) == 1


def test_any_other_failure_keeps_the_slot():
    def unreadable():
        raise ValueError("the tutor's reply could not be read")
    assert _claimed_then(unreadable) == 1


def test_a_success_keeps_the_slot():
    assert _claimed_then(lambda: llm_shared._billed()) == 1


def test_the_exception_goes_on_as_it_was():
    with pytest.raises(LLMUnavailable, match="every provider"):
        with daily_limit.refund_unbilled(DEV_USER_ID, FEATURE):
            _outage()


def test_a_call_billed_in_a_nested_meter_counts_for_the_outer_one():
    def nested():
        with llm_shared.metered():
            llm_shared._billed()
        _outage()
    assert _claimed_then(nested) == 1


# ── Each feature: a 503 leaves the count where it was ────────────────

@pytest.fixture
def provider(monkeypatch):
    """The real llm_shared.chat replaced at every name a route reads it
    by: an outage (nothing billed), a billed reply refused, or a reply."""
    def use(reply):
        def chat(*a, **kw):
            if isinstance(reply, Exception):
                if getattr(reply, "billed", False):
                    llm_shared._billed()
                raise reply
            llm_shared._billed()
            return reply
        monkeypatch.setattr(llm_shared, "llm_configured", lambda: True)
        for module in (reading, phrase_module):
            monkeypatch.setattr(module, "chat", chat)
        for module in (translation, composition, conversation_route):
            monkeypatch.setattr(module, "llm_configured", lambda: True)
    return use


def _refused():
    e = LLMUnavailable("All LLM providers failed. Last error: no model gave a usable reply")
    e.billed = True
    return e


NAGARA = find("〜ながら")
ROUTES = [
    ("translation_review", "/api/translation/analyze", {
        "translation_prompt": "I have to write my name every day.",
        "target_phrase": "毎日、名前を書かなければなりません。",
        "target_romaji": "mainichi, namae wo kakanakereba narimasen",
        "user_answer": "毎日名前が書かなければなりません。",
        "lang": "en",
    }),
    ("composition", "/api/composition/review", {
        "raw_id": grammar_to_id(NAGARA[1], NAGARA[0]), "sentence": "音楽が聞きながら勉強します。",
    }),
    ("conversation_review", "/api/conversation/review", {
        "scenario": "konbini-lunch", "turn": 0, "answer": "hai", "lang": "en",
    }),
    ("conversation_talk", "/api/conversation/talk", {
        "scenario": "konbini-lunch", "answer": "hai",
        "lines": [{"who": "them", "jp": "いらっしゃいませ。お弁当は温めますか。"}],
    }),
    ("deep_analysis", "/api/phrase/analyze", {
        "phrase": "返金の試験に雨が降っています。", "deep": True, "lang": "en", "save": False,
    }),
]


@pytest.mark.parametrize("feature, path, payload", ROUTES, ids=[r[0] for r in ROUTES])
def test_an_outage_is_a_503_that_costs_nothing(client, provider, feature, path, payload):
    provider(LLMUnavailable("every provider failed"))
    for _ in range(3):
        assert client.post(path, json=payload).status_code == 503
    assert _count(feature) == 0
    assert _refunds() == [{"feature": feature}] * 3


@pytest.mark.parametrize("feature, path, payload", ROUTES, ids=[r[0] for r in ROUTES])
def test_a_reply_paid_for_and_refused_still_costs_one(client, provider, feature, path, payload):
    provider(_refused())
    assert client.post(path, json=payload).status_code == 503
    assert _count(feature) == 1
    assert _refunds() == []


def test_a_success_still_counts(client, provider):
    # The cheapest route to answer for real: the deep tier's reply is
    # one small object.
    provider('{"words": [], "explanation": "Rain is falling."}')
    phrase = "返金の試験に雪が降っています。"
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            # A cached explanation is served without a call or a slot.
            cur.execute("DELETE FROM phrase_analysis_cache WHERE phrase = %s", (phrase,))
        conn.commit()
    finally:
        conn.close()
    response = client.post("/api/phrase/analyze", json={
        "phrase": phrase, "deep": True, "lang": "en", "save": False,
    })
    assert response.status_code == 200
    assert _count("deep_analysis") == 1


def test_a_paper_no_provider_could_write_gives_its_slot_back(monkeypatch):
    def generate(seed):
        raise LLMUnavailable("every provider failed")
    monkeypatch.setitem(exams.EXAM_GENERATORS, "refund-test", ("v1", "grammar", "N5", generate))
    daily_limit.claim(DEV_USER_ID, exams.EXAM_PAPERS_FEATURE, 5)
    exams._generation_worker("refund-test", 1, DEV_USER_ID)
    assert _count(exams.EXAM_PAPERS_FEATURE) == 0


def test_a_paper_half_written_before_the_outage_keeps_its_slot(monkeypatch):
    def generate(seed):
        llm_shared._billed()
        raise LLMUnavailable("every provider failed")
    monkeypatch.setitem(exams.EXAM_GENERATORS, "refund-test", ("v1", "grammar", "N5", generate))
    daily_limit.claim(DEV_USER_ID, exams.EXAM_PAPERS_FEATURE, 5)
    exams._generation_worker("refund-test", 1, DEV_USER_ID)
    assert _count(exams.EXAM_PAPERS_FEATURE) == 1


def test_the_paper_everyone_sits_is_charged_to_nobody(monkeypatch):
    # An exam's first paper is not counted (get_exam's `skipped`), so
    # its worker has no slot to give back, and gives none.
    def generate(seed):
        raise LLMUnavailable("every provider failed")
    monkeypatch.setitem(exams.EXAM_GENERATORS, "refund-test", ("v1", "grammar", "N5", generate))
    daily_limit.claim(DEV_USER_ID, exams.EXAM_PAPERS_FEATURE, 5)
    exams._generation_worker("refund-test", 1)
    assert _count(exams.EXAM_PAPERS_FEATURE) == 1


# ── No feature drifts ────────────────────────────────────────────────

def test_every_module_that_claims_a_slot_can_give_it_back():
    """A module that calls daily_limit.claim() calls refund_unbilled()
    too: a new rationed feature brings its refund in the same change."""
    missing = []
    for path in sorted(BACKEND.glob("*/*.py")):
        if path.parts[-2] in {"tests", "scripts"} or path.name == "daily_limit.py":
            continue
        # Any use, not only a call: routes/video.py hands claim to a
        # thread pool.
        calls = {
            node.attr
            for node in ast.walk(ast.parse(path.read_text(encoding="utf-8")))
            if isinstance(node, ast.Attribute)
            and isinstance(node.value, ast.Name) and node.value.id == "daily_limit"
        }
        if "claim" in calls and "refund_unbilled" not in calls:
            missing.append(str(path.relative_to(BACKEND)))
    assert missing == []
