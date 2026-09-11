# 読解 — the comprehension paper and the breakdown under it.
#
# Three things changed together on 2026-09-11 (owner-directed) and this
# pins all of them, because none is visible until a model is called:
#
#   1. every level's paper gained two questions, and the floor is 8 —
#      the screen's own progress ("3 / 8") is drawn straight from the
#      list the generator returns, so a spec that silently drops back
#      to six shortens the exercise with nothing to notice it;
#   2. the whole-text translation the reading screen used to reveal is
#      gone, replaced by a per-sentence breakdown shown once the paper
#      is graded. `translation` still exists — comprehension_log's
#      column is NOT NULL — but it is now DERIVED from the breakdown
#      rather than asked for separately, so the two can never disagree;
#   3. the text is the SAME length at every level. The ladder used to
#      run 150-220 up to 600-800, which made N1 a test of stamina; what
#      a level changes now is DIFFICULTY_BY_LEVEL, and the ceiling is a
#      measurement of the reading card on the smallest phone rather
#      than a preference (see COMPREHENSION_CHARS, and the touch-lane
#      test named there).
#
# No database and no model: _call_llm_comprehension is exercised with
# its one network call stubbed, which is the only part of it that is
# not pure.

import json

import pytest
from fastapi import HTTPException

from routes import reading


def _reply(**over):
    """A well-formed model answer, as the JSON string _chat returns."""
    body = {
        "text": "駅で友達を待ちました。電車は遅れました。",
        "questions": [
            {
                "type": "comprehension",
                "question": f"Question {i}?",
                "options": ["a", "b", "c", "d"],
                "correct": 0,
            }
            for i in range(8)
        ],
        "breakdown": [
            {"jp": "駅で友達を待ちました。", "translation": "I waited for a friend at the station.",
             "note": "で marks where an action happens."},
            {"jp": "電車は遅れました。", "translation": "The train was late.", "note": ""},
        ],
    }
    body.update(over)
    # ensure_ascii=False, so the fixture reads the way a model's answer
    # actually reads — raw UTF-8, not \uXXXX escapes. The repair tests
    # below edit this text by hand, and they must be editing the shape
    # the repair sees in production.
    return json.dumps(body, ensure_ascii=False)


@pytest.fixture
def answered(monkeypatch):
    """Point the generator's network call at canned replies — one per
    attempt, in order, so a retry can be watched. Returns the list the
    messages sent are recorded in."""
    calls = []

    def use(*replies):
        queue = list(replies)

        def chat(messages, *a, **kw):
            calls.append(messages)
            return queue.pop(0) if len(queue) > 1 else queue[0]

        monkeypatch.setattr(reading, "llm_configured", lambda: True)
        monkeypatch.setattr(reading, "_chat", chat)
        return calls
    return use


# ── The paper ────────────────────────────────────────────────────────

def test_every_level_asks_for_at_least_eight_questions():
    for level, spec in reading.COMPREHENSION_SPECS.items():
        assert spec["questions"] >= 8, f"{level} asks for {spec['questions']}"
    assert reading.DEFAULT_COMPREHENSION_SPEC["questions"] >= 8


def test_the_count_scales_with_the_level():
    counts = [reading.COMPREHENSION_SPECS[lvl]["questions"] for lvl in ("N5", "N4", "N3", "N2", "N1")]
    assert counts == sorted(counts), counts


# ── One length, every level ──────────────────────────────────────────

def test_the_text_is_the_same_length_at_every_level():
    """A level changes how hard the Japanese is, not how much of it
    there is. The length lives in ONE place for that reason — a
    per-level entry is what the old ladder grew back out of."""
    assert not any("chars" in spec for spec in reading.COMPREHENSION_SPECS.values())
    assert "chars" not in reading.DEFAULT_COMPREHENSION_SPEC

    floor, ceiling = reading.COMPREHENSION_CHARS
    assert floor < ceiling
    # The ceiling is what the reading card holds without scrolling at
    # 390x667 (frontend ComprehensionRun.touch.test.jsx measures it
    # against the real card). Raising it here without re-measuring
    # there is how a passage gets back off the screen.
    assert ceiling <= 280


def test_every_level_says_what_it_makes_harder():
    for level in reading.COMPREHENSION_SPECS:
        assert reading.DIFFICULTY_BY_LEVEL[level].strip(), level
    # And no two levels ask for the same thing, which is the failure
    # this whole change exists to undo.
    briefs = list(reading.DIFFICULTY_BY_LEVEL.values())
    assert len(set(briefs)) == len(briefs)


def test_the_reading_window_no_longer_follows_a_length_that_does_not_vary():
    """Still a ladder — an N1 paragraph is slower per character than an
    N5 one — but a gentle one, not the 4x the old lengths forced."""
    windows = [reading.READ_SECONDS_BY_LEVEL[lvl] for lvl in ("N5", "N4", "N3", "N2", "N1")]
    assert windows == sorted(windows), windows
    assert windows[-1] <= windows[0] * 2, windows


@pytest.mark.parametrize("level", ["N5", "N1"])
def test_the_prompt_carries_this_level_s_difficulty_and_the_one_length(answered, level):
    """The brief the model actually receives — the constants above are
    only worth something if they reach it, and the two ends of the
    ladder must differ in exactly one way."""
    calls = answered(_reply())
    reading._call_llm_comprehension(level, "en")

    sent = calls[0][0]["content"]
    floor, ceiling = reading.COMPREHENSION_CHARS
    # Both ends and the target between them, whatever sentence they are
    # currently phrased in.
    for number in (floor, ceiling, (floor + ceiling) // 2):
        assert str(number) in sent, number
    assert reading.DIFFICULTY_BY_LEVEL[level] in sent
    # ...and not another level's.
    other = "N1" if level == "N5" else "N5"
    assert reading.DIFFICULTY_BY_LEVEL[other] not in sent


# ── The breakdown ────────────────────────────────────────────────────

def test_breakdown_survives_the_round_trip_in_order(answered):
    answered(_reply())
    data = reading._call_llm_comprehension("N5", "en")

    assert [p["jp"] for p in data["breakdown"]] == ["駅で友達を待ちました。", "電車は遅れました。"]
    assert data["breakdown"][0]["note"].startswith("で marks")
    # A sentence with nothing worth noting keeps its blank rather than
    # being dropped — the Japanese is still part of the passage.
    assert data["breakdown"][1]["note"] == ""


def test_translation_is_the_breakdown_read_end_to_end(answered):
    answered(_reply())
    data = reading._call_llm_comprehension("N5", "en")

    assert data["translation"] == (
        "I waited for a friend at the station. The train was late."
    )


def test_a_missing_breakdown_is_a_bad_gateway_not_a_silent_pass(answered):
    answered(json.dumps({"text": "駅。", "translation": "Station.", "questions": []}))
    with pytest.raises(HTTPException) as caught:
        reading._call_llm_comprehension("N5", "en")
    assert caught.value.status_code == 502


def test_an_empty_breakdown_is_a_bad_gateway(answered):
    answered(_reply(breakdown=[{"jp": "   ", "translation": "nothing"}]))
    with pytest.raises(HTTPException) as caught:
        reading._call_llm_comprehension("N5", "en")
    assert caught.value.status_code == 502


@pytest.mark.parametrize("raw,expected", [
    (None, []),
    ("not a list", []),
    ([{"jp": "駅。"}], [{"jp": "駅。", "translation": "", "note": ""}]),
    # A model that answers a text field with something that is not text
    # is answering badly, not fatally: the line prints without it.
    ([{"jp": "駅。", "translation": 42, "note": ["a"]}],
     [{"jp": "駅。", "translation": "", "note": ""}]),
    # Nothing to show a sentence against — dropped, order kept.
    ([{"translation": "orphan"}, {"jp": "駅。", "translation": "Station."}],
     [{"jp": "駅。", "translation": "Station.", "note": ""}]),
    ([{"jp": "  駅。  ", "translation": "  Station.  ", "note": ""}],
     [{"jp": "駅。", "translation": "Station.", "note": ""}]),
])
def test_clean_breakdown(raw, expected):
    assert reading._clean_breakdown(raw) == expected


# ── The quote that opens on the wrong mark ───────────────────────────
#
# The malformation this endpoint actually sees, live twice on
# 2026-09-11: the model opens a note on the Japanese quotation mark it
# was told to quote Japanese WITH, and never writes the JSON quote, so
# two thousand characters of otherwise perfect answer are unparseable.

# The same shape in an otherwise perfect answer. The closing quote is
# there — that is what makes it repairable.
BAD_NOTE = '"note": 「で」 marks where an action happens."'
GOOD_NOTE = '"note": "で marks where an action happens."'

# And a wreck no repair can reach: nothing closes the value either.
BEYOND_REPAIR = (
    '{"text": "駅。", "questions": [], '
    '"breakdown": [{"jp": "駅。", "translation": "Station.", '
    '"note": 「駅」 est une gare.}]}'
)


def test_a_value_that_opened_on_the_wrong_quote_is_repaired(answered):
    """Repaired rather than re-asked, and with no second call: a value
    that does not open on a quote is not valid JSON under any other
    reading, so nothing well-formed can be changed by this."""
    reply = _reply()
    assert GOOD_NOTE in reply
    calls = answered(reply.replace(GOOD_NOTE, BAD_NOTE))

    data = reading._call_llm_comprehension("N5", "en")

    assert len(calls) == 1
    assert data["breakdown"][0]["note"] == "「で」 marks where an action happens."


def test_repair_is_never_applied_to_an_answer_that_parses(answered):
    """It runs only on input json.loads has already refused. A value
    that contains the repair's own pattern is the case that would
    notice if that ever stopped being true."""
    quoted = 'She asked "note": what time is it, and left.'
    answered(_reply(breakdown=[
        {"jp": "駅で友達を待ちました。", "translation": quoted, "note": ""},
    ]))

    data = reading._call_llm_comprehension("N5", "en")
    assert data["breakdown"][0]["translation"] == quoted


# ── Asked again ──────────────────────────────────────────────────────

def test_an_unparseable_answer_is_asked_again(answered):
    calls = answered(BEYOND_REPAIR, _reply())
    data = reading._call_llm_comprehension("N5", "en")

    assert len(calls) == 2
    assert len(data["breakdown"]) == 2


def test_it_gives_up_rather_than_asking_forever(answered):
    calls = answered(BEYOND_REPAIR)
    with pytest.raises(HTTPException) as caught:
        reading._call_llm_comprehension("N5", "en")

    assert caught.value.status_code == 502
    assert len(calls) == reading._COMPREHENSION_ATTEMPTS


def test_a_dead_provider_is_not_asked_twice(monkeypatch):
    """503 is llm_shared saying every provider is gone. Asking again is
    a request not worth sending, so it is not retried and not turned
    into a 502 either."""
    calls = []

    def dead(*a, **kw):
        calls.append(kw)
        raise HTTPException(status_code=503, detail="no provider")

    monkeypatch.setattr(reading, "llm_configured", lambda: True)
    monkeypatch.setattr(reading, "_chat", dead)

    with pytest.raises(HTTPException) as caught:
        reading._call_llm_comprehension("N5", "en")
    assert caught.value.status_code == 503
    assert len(calls) == 1
