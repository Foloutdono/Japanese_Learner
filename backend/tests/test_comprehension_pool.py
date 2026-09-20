# 読解 — the shared pool behind the comprehension exercise (plan 092).
#
# The exercise is the most expensive model call this app makes: one
# request writes a passage, ten questions, a per-sentence translation
# and a glossed word list per sentence, at max_tokens=12000, up to three
# times if the checks reject it. It used to be paid once per learner per
# exercise, forever. These tests pin the three properties that make the
# pool worth having and the two that make it safe:
#
#   worth having  a second learner pays nothing; the same learner is
#                 never served the same text twice; a version bump
#                 retires the whole pool
#   safe          a pooled exercise still carries the glosses its
#                 second reader needs, and a broken pool costs a
#                 generation rather than the exercise
#
# Needs the database. The generator itself is exercised without one in
# test_comprehension.py.
import json

import pytest

from core.auth import DEV_USER_ID
from core.db import db_conn
from routes import reading
from tests.conftest import acting_as
from tests.test_comprehension import _reply, MASHITA, KUDASAI, SENTENCE_1

SECOND_LEARNER = "comprehension-pool-other"


def _sql(query, params=(), fetch=False):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(query, params)
            rows = cur.fetchall() if fetch else None
        conn.commit()
        return rows
    finally:
        conn.close()


@pytest.fixture
def empty_pool():
    """A pool with nothing in it, before and after. The table outlives a
    test run, so a leftover row from an earlier one would otherwise turn
    'this generates' into 'this was served from the pool' -- the exact
    flake this fixture exists to prevent."""
    def wipe():
        # comprehension_served cascades from the pool row.
        _sql("DELETE FROM comprehension_pool")
        _sql("DELETE FROM comprehension_served WHERE user_id IN (%s, %s)",
             (DEV_USER_ID, SECOND_LEARNER))
        # The daily generation counter is persistent too, and it is
        # shared across runs: without this the eleventh run of the
        # suite in one day would start serving repeats instead of
        # generating, and half this file would fail for a reason no
        # single test could explain.
        _sql("DELETE FROM comprehension_usage WHERE user_id IN (%s, %s)",
             (DEV_USER_ID, SECOND_LEARNER))
    wipe()
    yield
    wipe()


@pytest.fixture
def calls(monkeypatch):
    """The endpoint with its one network call stubbed and counted, and
    its seeds pinned, exactly as test_comprehension_log's `served` does
    -- but the count is the point here: a pool hit must not reach it."""
    seen = []

    def _fake_chat(messages, *a, **kw):
        seen.append(messages)
        return _reply()

    monkeypatch.setattr(reading, "llm_configured", lambda: True)
    monkeypatch.setattr(reading, "_chat", _fake_chat)
    monkeypatch.setattr(reading, "_pick_grammar_seeds", lambda *a, **kw: [MASHITA])
    monkeypatch.setattr(reading, "_pick_word_seeds", lambda *a, **kw: [])
    return seen


def _get(client, level="N5", lang="en"):
    r = client.get(f"/api/reading/comprehension?level={level}&lang={lang}")
    assert r.status_code == 200, r.text
    return r.json()


# ── what it saves ────────────────────────────────────────────
def test_the_first_exercise_is_generated_and_kept(client, calls, empty_pool):
    body = _get(client)
    assert len(calls) == 1
    assert body["text"].startswith(SENTENCE_1)

    rows = _sql("SELECT level, lang, generator_version, grammar FROM comprehension_pool",
                fetch=True)
    assert len(rows) == 1
    level, lang, version, grammar = rows[0]
    assert (level, lang, version) == ("N5", "en", reading._POOL_VERSION)
    assert grammar == [MASHITA["pattern"]]


def test_a_second_learner_pays_nothing_for_the_same_exercise(client, calls, empty_pool):
    first = _get(client)
    assert len(calls) == 1

    with acting_as(SECOND_LEARNER):
        second = _get(client)

    # Not one more model call, and the same text.
    assert len(calls) == 1
    assert second["text"] == first["text"]
    assert [q["question"] for q in second["questions"]] == \
           [q["question"] for q in first["questions"]]


def test_the_same_learner_is_never_served_the_same_text_twice(client, calls, empty_pool):
    _get(client)
    _get(client)
    # The pool's only exercise is already theirs, so the second request
    # generates rather than re-reading it.
    assert len(calls) == 2
    assert _sql("SELECT COUNT(*) FROM comprehension_pool", fetch=True)[0][0] == 2


def test_a_version_bump_retires_the_pool(client, calls, empty_pool, monkeypatch):
    _get(client)
    assert len(calls) == 1

    monkeypatch.setattr(reading, "_POOL_VERSION", "comprehension-next")
    with acting_as(SECOND_LEARNER):
        _get(client)
    # The stored exercise is invisible at the new version, so this
    # learner pays -- and their exercise is stored under the new one.
    assert len(calls) == 2
    versions = {v for (v,) in _sql(
        "SELECT generator_version FROM comprehension_pool", fetch=True)}
    assert versions == {"comprehension-1", "comprehension-next"}


def test_each_bucket_is_its_own_pool(client, calls, empty_pool):
    _get(client, lang="en")
    with acting_as(SECOND_LEARNER):
        _get(client, lang="fr")
    # An English exercise is not a French one: the translations, the
    # notes and every gloss in it are in the wrong language.
    assert len(calls) == 2


# ── what makes it safe ───────────────────────────────────────
def test_a_pooled_exercise_keeps_the_glosses_its_next_reader_needs(client, calls, empty_pool):
    """The decoration pops each sentence's word list as it folds the
    glosses into the analysis. Storing the exercise after that would
    fill the pool with texts whose second reader gets no glosses at all
    -- and nothing else in this suite would notice, because the first
    reader's response is perfect."""
    _get(client)
    (stored,) = _sql("SELECT exercise FROM comprehension_pool", fetch=True)[0]
    exercise = json.loads(stored) if isinstance(stored, str) else stored
    assert exercise["breakdown"]
    for part in exercise["breakdown"]:
        assert part.get("words"), "the pooled exercise lost its word lists"


def test_the_response_still_hides_the_raw_word_lists(client, calls, empty_pool):
    # What is stored and what is served are different shapes: the
    # analysis carries the glosses, the raw lists never go over the wire.
    for body in (_get(client), _get(client)):
        for part in body["breakdown"]:
            assert "words" not in part


def test_a_broken_pool_costs_a_generation_not_the_exercise(client, calls, empty_pool, monkeypatch):
    def _no_database():
        raise RuntimeError("no database")

    monkeypatch.setattr(reading, "db_conn", _no_database)
    body = _get(client)
    assert len(calls) == 1
    assert body["text"].startswith(SENTENCE_1)


# ── what it serves ───────────────────────────────────────────
def test_it_prefers_an_exercise_whose_grammar_is_not_the_one_just_read(
    client, calls, empty_pool, monkeypatch
):
    """The generate path keeps clear of what the learner has just read
    (_pick_grammar_seeds' `avoid`). Serving from a pool has to make the
    same trade, or a cache hit quietly undoes the pedagogy."""
    stale = {"text": "古い文です。", "translation": "old",
             "breakdown": [{"jp": "古い文です。", "translation": "old", "words": []}],
             "questions": [], "grammar_points": [{"pattern": MASHITA["pattern"]}]}
    fresh = {**stale, "text": "新しい文です。",
             "grammar_points": [{"pattern": KUDASAI["pattern"]}]}
    for exercise in (stale, fresh):
        _sql(
            """
            INSERT INTO comprehension_pool
                (level, lang, generator_version, grammar, exercise)
            VALUES (%s, %s, %s, %s, %s)
            """,
            ("N5", "en", reading._POOL_VERSION,
             json.dumps([p["pattern"] for p in exercise["grammar_points"]]),
             json.dumps(exercise, ensure_ascii=False)),
        )

    monkeypatch.setattr(reading, "_recent_grammar_patterns",
                        lambda *a, **kw: {MASHITA["pattern"]})
    assert _get(client)["text"] == "新しい文です。"
    assert not calls


def test_it_serves_a_repeat_of_the_grammar_rather_than_paying_again(
    client, calls, empty_pool, monkeypatch
):
    # Only one exercise exists and its grammar is exactly what the
    # learner just read. Generating instead would be the most expensive
    # call this app makes, to avoid a repeat the generate path itself
    # accepts when a level runs out of fresh points.
    only = {"text": "同じ文法です。", "translation": "same",
            "breakdown": [{"jp": "同じ文法です。", "translation": "same", "words": []}],
            "questions": [], "grammar_points": [{"pattern": MASHITA["pattern"]}]}
    _sql(
        """
        INSERT INTO comprehension_pool
            (level, lang, generator_version, grammar, exercise)
        VALUES (%s, %s, %s, %s, %s)
        """,
        ("N5", "en", reading._POOL_VERSION, json.dumps([MASHITA["pattern"]]),
         json.dumps(only, ensure_ascii=False)),
    )
    monkeypatch.setattr(reading, "_recent_grammar_patterns",
                        lambda *a, **kw: {MASHITA["pattern"]})
    assert _get(client)["text"] == "同じ文法です。"
    assert not calls


# ── the daily ceiling ────────────────────────────────────────
# What is capped is GENERATIONS, not exercises. Reading twenty pooled
# texts costs nothing -- they were paid for by whoever read them first
# -- so the cap only meets a learner who outruns the pool, and it hands
# them a text they have read before rather than a wall.

def _seed_pool(text, grammar=(), served_by=None, served_at=None):
    """One exercise in the pool, optionally already read by someone."""
    exercise = {"text": text, "translation": "t",
                "breakdown": [{"jp": text, "translation": "t", "words": []}],
                "questions": [], "grammar_points": [{"pattern": p} for p in grammar]}
    (pool_id,) = _sql(
        """
        INSERT INTO comprehension_pool (level, lang, generator_version, grammar, exercise)
        VALUES (%s, %s, %s, %s, %s) RETURNING id
        """,
        ("N5", "en", reading._POOL_VERSION, json.dumps(list(grammar)),
         json.dumps(exercise, ensure_ascii=False)),
        fetch=True,
    )[0]
    if served_by:
        _sql(
            "INSERT INTO comprehension_served (user_id, pool_id, served_at) "
            "VALUES (%s, %s, COALESCE(%s, NOW()))",
            (served_by, pool_id, served_at),
        )
    return pool_id


def test_reading_from_the_pool_is_not_metered(client, calls, empty_pool, monkeypatch):
    """The property the whole cap depends on. A pooled exercise was
    already paid for, so a learner working through a dozen of them in
    an evening is the app doing its job -- metering that would cap
    reading itself."""
    monkeypatch.setattr(reading, "_DAILY_GENERATION_LIMIT", 1)
    for i in range(3):
        _seed_pool(f"プール{i}のテキストです。")

    for _ in range(3):
        body = _get(client)
        assert body["repeat"] is False
    assert not calls, "a pooled exercise must never reach the model"

    counted = _sql("SELECT COALESCE(SUM(count), 0) FROM comprehension_usage "
                   "WHERE user_id = %s", (DEV_USER_ID,), fetch=True)[0][0]
    assert counted == 0


def test_past_the_ceiling_a_read_text_comes_back_instead_of_a_new_one(
    client, calls, empty_pool, monkeypatch
):
    monkeypatch.setattr(reading, "_DAILY_GENERATION_LIMIT", 1)

    first = _get(client)                     # pool empty -> generates (1 of 1)
    assert len(calls) == 1
    assert first["repeat"] is False

    second = _get(client)                    # nothing unseen, over the cap
    assert len(calls) == 1, "the ceiling must stop the second generation"
    assert second["repeat"] is True
    assert second["text"] == first["text"]


def test_the_ceiling_counts_generations_not_attempts(client, calls, empty_pool, monkeypatch):
    """One generation is up to _COMPREHENSION_ATTEMPTS model calls. A
    retry is the system failing its own checks, not something the
    learner did, so it must not spend their allowance."""
    monkeypatch.setattr(reading, "_DAILY_GENERATION_LIMIT", 2)
    # KUDASAI is not in the fixture text, so every attempt is rejected
    # and the generation costs three calls.
    monkeypatch.setattr(reading, "_pick_grammar_seeds", lambda *a, **kw: [KUDASAI])
    _get(client)
    assert len(calls) == reading._COMPREHENSION_ATTEMPTS

    counted = _sql("SELECT count FROM comprehension_usage WHERE user_id = %s",
                   (DEV_USER_ID,), fetch=True)[0][0]
    assert counted == 1


def test_a_cold_pool_past_the_ceiling_is_the_one_refusal(client, calls, empty_pool, monkeypatch):
    monkeypatch.setattr(reading, "_DAILY_GENERATION_LIMIT", 0)
    r = client.get("/api/reading/comprehension?level=N5&lang=en")
    assert r.status_code == 429, r.text
    assert "0 new" in r.json()["detail"]
    assert "resets" in r.json()["detail"]
    assert not calls


def test_repeats_rotate_oldest_first(client, calls, empty_pool, monkeypatch):
    """Handing back the same text twice in a row would read as a bug.
    The oldest read goes first, and its turn moves it to the back."""
    from datetime import datetime, timedelta, timezone

    now = datetime.now(timezone.utc)
    _seed_pool("古い方のテキストです。", served_by=DEV_USER_ID,
               served_at=now - timedelta(days=2))
    _seed_pool("新しい方のテキストです。", served_by=DEV_USER_ID,
               served_at=now - timedelta(days=1))

    monkeypatch.setattr(reading, "_DAILY_GENERATION_LIMIT", 0)
    assert _get(client)["text"] == "古い方のテキストです。"
    assert _get(client)["text"] == "新しい方のテキストです。"
    assert not calls


def test_a_broken_counter_never_costs_the_exercise(client, calls, empty_pool, monkeypatch):
    # A database hiccup in the meter must not refuse a learner: the
    # pool miss that got here has already established the alternative
    # is nothing at all.
    monkeypatch.setattr(reading, "_claim_generation_slot", lambda user_id: 0)
    assert _get(client)["text"].startswith(SENTENCE_1)
    assert len(calls) == 1
