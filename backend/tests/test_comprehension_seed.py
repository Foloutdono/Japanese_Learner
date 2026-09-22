# 理解 — the seed pool (plan 111): the hand-written exercises under
# content/comprehension/, held to the same bar as a model answer, and
# the import-time upsert that puts them in comprehension_pool so a new
# learner's first exercise at every level and language is served
# rather than generated.
#
# The content half needs no model; the pool half needs the database,
# like test_comprehension_pool.py.
import json

import pytest

from content import comprehension_seed as seed
from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL
from core.auth import DEV_USER_ID
from core.db import db_conn
from routes import reading
from study import difficulty as D
from study.grammar_match import verifiable
from tests.conftest import acting_as


# ── The content ──────────────────────────────────────────────

def _seed_points(entry: dict) -> list[dict]:
    points = {p["pattern"]: p for p in GRAMMAR_POINTS_BY_LEVEL[entry["level"]]}
    return [points[p] for p in entry["grammar"] if p in points]


def _squash_words(part: dict) -> str:
    return reading._squash("".join(w["surface"] for w in part["words"]))


def _squash_sentence(jp: str) -> str:
    return reading._squash("".join(c for c in jp if c not in "。、！？!?「」『』・"))


@pytest.mark.parametrize("entry", seed.entries(), ids=lambda e: e["id"])
@pytest.mark.parametrize("lang", seed.LANGS)
def test_every_seed_passes_the_checks_a_model_answer_must(entry, lang):
    """Parsed and checked exactly as a model's reply would be, in each
    language: the breakdown reproduces the text, the vocabulary and the
    kanji sit inside the level, and every seed pattern is found. Length
    is a hard rule here where the generator only feeds it back: a seed
    is written by hand and has no excuse."""
    data = reading._parse_comprehension(json.dumps(seed.render(entry, lang), ensure_ascii=False))
    verdict = reading._check_comprehension(data, entry["level"], _seed_points(entry))
    problems = verdict.repro + verdict.vocab + verdict.kanji + verdict.length
    problems += [f"seed missing {p['pattern']}" for p in verdict.seeds_missing]
    assert problems == [], "\n".join(problems)


@pytest.mark.parametrize("entry", seed.entries(), ids=lambda e: e["id"])
def test_every_seed_names_checkable_points_of_its_own_level(entry):
    catalogue = {p["pattern"] for p in GRAMMAR_POINTS_BY_LEVEL[entry["level"]]}
    assert entry["grammar"], "a seed is written around at least one point"
    for pattern in entry["grammar"]:
        assert pattern in catalogue, f"{pattern!r} is not a {entry['level']} point"
        assert verifiable(pattern) and pattern not in D.GATE_BLIND, f"{pattern!r} cannot be checked"


@pytest.mark.parametrize("entry", seed.entries(), ids=lambda e: e["id"])
@pytest.mark.parametrize("lang", seed.LANGS)
def test_every_seed_carries_the_paper_its_level_asks_for(entry, lang):
    data = seed.render(entry, lang)
    spec = reading.COMPREHENSION_SPECS[entry["level"]]["questions"]
    assert len(data["questions"]) == spec
    assert {q["type"] for q in data["questions"]} == reading.VALID_QUESTION_TYPES
    for i, q in enumerate(data["questions"]):
        assert q["question"].strip(), f"question {i} is empty"
        assert len(q["options"]) == 4 and len(set(q["options"])) == 4, f"question {i} options"
        assert 0 <= q["correct"] < 4


@pytest.mark.parametrize("entry", seed.entries(), ids=lambda e: e["id"])
@pytest.mark.parametrize("lang", seed.LANGS)
def test_every_word_list_reproduces_its_sentence_and_is_glossed(entry, lang):
    """The word lists are what the second reader's glosses come from
    (test_comprehension_pool's 'keeps the glosses'): a word missing from
    the list is a word with no meaning on the screen."""
    for i, part in enumerate(seed.render(entry, lang)["breakdown"]):
        assert part["words"], f"sentence {i} has no words"
        assert _squash_words(part) == _squash_sentence(part["jp"]), f"sentence {i}: words drift"
        assert part["translation"].strip(), f"sentence {i} has no translation"
        for w in part["words"]:
            assert w["meaning"].strip(), f"sentence {i}: {w['surface']} has no gloss"


def test_every_string_is_in_both_languages():
    for entry in seed.entries():
        for q in entry["questions"]:
            assert set(q["question"]) >= set(seed.LANGS), entry["id"]
            assert set(q["options"]) >= set(seed.LANGS), entry["id"]
        for part in entry["breakdown"]:
            assert set(part["translation"]) >= set(seed.LANGS), entry["id"]
            assert set(part["note"]) >= set(seed.LANGS), entry["id"]
            for w in part["words"]:
                assert set(w["meaning"]) >= set(seed.LANGS), entry["id"]


def test_every_level_has_its_floor_and_no_id_repeats():
    ids = [e["id"] for e in seed.entries()]
    assert len(ids) == len(set(ids))
    for level, rows in seed.by_level().items():
        assert len(rows) >= seed.MIN_PER_LEVEL, f"{level}: {len(rows)} seed(s)"
        for e in rows:
            assert e["level"] == level


def test_a_rendered_seed_has_the_generated_shape():
    """What the pool stores for a seed is what it stores for a model
    answer -- the same keys, and grammar_points in the shape the screen
    draws chips from."""
    data = seed.render(seed.entries()[0], "fr")
    assert set(data) == {"text", "questions", "breakdown", "translation", "grammar_points"}
    assert data["translation"] == " ".join(p["translation"] for p in data["breakdown"])
    for g in data["grammar_points"]:
        assert set(g) == {"pattern", "structure", "meaning", "level", "raw_id"}
        assert g["raw_id"].startswith(f"grammar_{g['level']}_")


# ── The pool ─────────────────────────────────────────────────

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


SEED_READER = "comprehension-seed-reader"


@pytest.fixture
def seeded():
    """The pool holding exactly the seeds, and nobody having read them.
    Restored afterwards, so the suite's other pool tests -- which wipe
    the table themselves -- start from the state they expect."""
    _sql("DELETE FROM comprehension_pool")
    _sql("DELETE FROM comprehension_served WHERE user_id IN (%s, %s)", (DEV_USER_ID, SEED_READER))
    _sql("DELETE FROM comprehension_usage WHERE user_id IN (%s, %s)", (DEV_USER_ID, SEED_READER))
    reading._seed_comprehension_pool()
    yield
    _sql("DELETE FROM comprehension_served WHERE user_id IN (%s, %s)", (DEV_USER_ID, SEED_READER))
    _sql("DELETE FROM comprehension_usage WHERE user_id IN (%s, %s)", (DEV_USER_ID, SEED_READER))


def _count():
    return _sql("SELECT COUNT(*) FROM comprehension_pool WHERE seed_key IS NOT NULL", fetch=True)[0][0]


def test_seeding_is_idempotent(seeded):
    expected = len(seed.entries()) * len(seed.LANGS)
    assert _count() == expected
    assert reading._seed_comprehension_pool() == 0
    assert _count() == expected


def test_a_changed_seed_updates_its_row_rather_than_adding_one(seeded, monkeypatch):
    expected = len(seed.entries()) * len(seed.LANGS)
    key, level, lang, grammar, exercise = seed.rows()[0]
    altered = dict(exercise, text=exercise["text"] + "　")
    monkeypatch.setattr(seed, "rows", lambda: [(key, level, lang, grammar, altered)])
    assert reading._seed_comprehension_pool() == 1
    assert _count() == expected
    (stored,) = _sql("SELECT exercise FROM comprehension_pool WHERE seed_key = %s", (key,), fetch=True)[0]
    assert (json.loads(stored) if isinstance(stored, str) else stored)["text"] == altered["text"]


def test_a_version_bump_carries_the_seeds_with_it(seeded, monkeypatch):
    monkeypatch.setattr(reading, "_POOL_VERSION", "comprehension-next")
    assert reading._seed_comprehension_pool() == len(seed.entries()) * len(seed.LANGS)
    versions = {v for (v,) in _sql(
        "SELECT DISTINCT generator_version FROM comprehension_pool WHERE seed_key IS NOT NULL", fetch=True)}
    assert versions == {"comprehension-next"}


@pytest.mark.parametrize("level", seed.LEVELS)
@pytest.mark.parametrize("lang", seed.LANGS)
def test_a_new_learner_s_first_exercise_is_a_seed_and_costs_no_model_call(client, seeded, monkeypatch, level, lang):
    def _never(*a, **kw):
        raise AssertionError("the model was called for a bucket the seeds cover")

    monkeypatch.setattr(reading, "llm_configured", lambda: True)
    monkeypatch.setattr(reading, "_chat", _never)
    with acting_as(SEED_READER):
        r = client.get(f"/api/reading/comprehension?level={level}&lang={lang}")
    assert r.status_code == 200, r.text
    body = r.json()
    texts = {e["text"] for e in seed.by_level()[level]}
    assert body["text"] in texts
    assert body["level"] == level
    assert body["repeat"] is False
    assert len(body["questions"]) == reading.COMPREHENSION_SPECS[level]["questions"]
    # Decorated like any pooled exercise: the glosses reached the tokens
    # and the raw word lists did not go over the wire.
    for part in body["breakdown"]:
        assert "words" not in part
        assert part["analysis"]["available"] is True
    assert body["grammar_points"], "the chips have something to draw"


def test_the_seeds_are_read_through_before_the_model_is_asked(client, seeded, monkeypatch):
    calls = []
    from tests.test_comprehension import _reply, MASHITA
    monkeypatch.setattr(reading, "llm_configured", lambda: True)
    monkeypatch.setattr(reading, "_chat", lambda messages, *a, **kw: calls.append(messages) or _reply())
    monkeypatch.setattr(reading, "_pick_grammar_seeds", lambda *a, **kw: [MASHITA])
    monkeypatch.setattr(reading, "_pick_word_seeds", lambda *a, **kw: [])
    n = len(seed.by_level()["N5"])
    with acting_as(SEED_READER):
        for _ in range(n):
            assert client.get("/api/reading/comprehension?level=N5&lang=en").status_code == 200
        assert calls == []
        assert client.get("/api/reading/comprehension?level=N5&lang=en").status_code == 200
    assert len(calls) == 1
