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
# And a fourth, on 2026-09-13 (plan 084): the model proposes and the
# code decides. The text is written around grammar points and words of
# the level, measured afterwards (study/level_mix), and asked for again
# with the failure fed back — see "Asked again, and told why" below.
#
# No database and no model: _call_llm_comprehension is exercised with
# its one network call stubbed, which is the only part of it that is
# not pure. The endpoint, which needs the SRS, is test_comprehension_log.py.

import json
import random

import pytest
from fastapi import HTTPException

from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL, grammar_to_id
from routes import reading

# All-N5 on every gate — kanji, vocabulary, grammar — and it uses the
# N5 point 〜ました. The sentence it replaced (駅で友達を待ちました。
# 電車は遅れました。) fails two of the gates it never used to meet:
# 達/待/遅 are outside N5's kanji, and 遅れ is filed above it.
SENTENCE_1 = "駅で友だちに会いました。"
SENTENCE_2 = "電車は新しいです。"
TEXT = SENTENCE_1 + SENTENCE_2

WORDS_1 = [
    {"surface": "駅", "meaning": "station"},
    {"surface": "で", "meaning": "at (place of action)"},
    {"surface": "友だち", "meaning": "friend"},
    {"surface": "に", "meaning": "marks who was met"},
    {"surface": "会いました", "meaning": "met"},
]
WORDS_2 = [
    {"surface": "電車", "meaning": "train"},
    {"surface": "は", "meaning": "topic marker"},
    {"surface": "新しい", "meaning": "new"},
    {"surface": "です", "meaning": "polite copula"},
]


def _point(pattern: str) -> dict:
    return next(p for p in GRAMMAR_POINTS_BY_LEVEL["N5"] if p["pattern"] == pattern)


MASHITA = _point("〜ました／〜ませんでした")   # in TEXT
KUDASAI = _point("〜てください")              # not in TEXT
TAI = _point("〜たいです")                    # not in TEXT


def _reply(**over):
    """A well-formed model answer, as the JSON string _chat returns."""
    body = {
        "text": TEXT,
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
            {"jp": SENTENCE_1, "translation": "I met a friend at the station.",
             "note": "に marks who was met.", "words": WORDS_1},
            {"jp": SENTENCE_2, "translation": "The train is new.", "note": "", "words": WORDS_2},
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
    attempt, in order, so a retry can be watched — and pin the seeds,
    so a test finds exactly the points it meant to. Returns the list
    the messages sent are recorded in.

    The seeds default to NONE: an empty list can never be missing from
    a text, so every test that is not about the seeds keeps its call
    count regardless of what the fixture text happens to contain."""
    calls = []

    def use(*replies, grammar=(), words=()):
        queue = list(replies)

        def chat(messages, *a, **kw):
            calls.append(messages)
            return queue.pop(0) if len(queue) > 1 else queue[0]

        monkeypatch.setattr(reading, "llm_configured", lambda: True)
        monkeypatch.setattr(reading, "_chat", chat)
        monkeypatch.setattr(reading, "_pick_grammar_seeds", lambda *a, **kw: list(grammar))
        monkeypatch.setattr(reading, "_pick_word_seeds", lambda *a, **kw: list(words))
        return calls
    return use


def _prompt(calls, i=0) -> str:
    return calls[i][0]["content"]


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

    sent = _prompt(calls)
    floor, ceiling = reading.COMPREHENSION_CHARS
    # Both ends and the target between them, whatever sentence they are
    # currently phrased in.
    for number in (floor, ceiling, (floor + ceiling) // 2):
        assert str(number) in sent, number
    assert reading.DIFFICULTY_BY_LEVEL[level] in sent
    # ...and not another level's.
    other = "N1" if level == "N5" else "N5"
    assert reading.DIFFICULTY_BY_LEVEL[other] not in sent


def test_length_outside_the_band_is_feedback_not_a_gate(answered):
    """The fixture is 20 characters against a 220 floor. A text the
    wrong length is told so on its next attempt, if there is one, and
    is never the reason for one: the paper still works, and the
    learner has waited long enough."""
    calls = answered(_reply())
    data = reading._call_llm_comprehension("N5", "en")
    assert len(calls) == 1
    assert data["text"] == TEXT


# ── The seeds ────────────────────────────────────────────────────────

def test_the_prompt_carries_the_grammar_seeds_and_the_words(answered):
    words = [
        {"kanji": "電車", "kana": "でんしゃ", "meaning": "train"},
        {"kanji": "", "kana": "バス/ばす", "meaning": "bus"},
    ]
    calls = answered(_reply(), grammar=[MASHITA, KUDASAI, TAI], words=words)
    reading._call_llm_comprehension("N5", "en")

    sent = _prompt(calls)
    for point in (MASHITA, KUDASAI, TAI):
        assert point["pattern"] in sent
        assert point["structure"] in sent
        assert point["meaning"] in sent
    assert "電車 (でんしゃ)" in sent
    # A kana-only entry shows its first reading as the word.
    assert "バス (バス)" in sent
    assert "REJECTED" not in sent


def test_seeds_are_drawn_from_the_level_s_checkable_points():
    rng = random.Random(7)
    seeds = reading._pick_grammar_seeds("N5", rng)
    assert len(seeds) == reading._GRAMMAR_SEEDS
    pool = reading._grammar_pool("N5")
    assert all(s in pool for s in seeds)
    # A bare particle cannot be asked for: finding 「は」 proves nothing.
    assert not any(s["pattern"] in ("は", "が", "を") for s in pool)
    assert len(reading._pick_word_seeds("N5", rng)) == reading._WORD_SEEDS


def test_seeds_keep_clear_of_the_learner_s_recent_points():
    pool = reading._grammar_pool("N5")
    wanted = {p["pattern"] for p in pool[:3]}
    avoid = {p["pattern"] for p in pool} - wanted
    seeds = reading._pick_grammar_seeds("N5", random.Random(1), avoid)
    assert {s["pattern"] for s in seeds} == wanted
    # When the learner has seen everything, the pool is the pool.
    seeds = reading._pick_grammar_seeds("N5", random.Random(1), {p["pattern"] for p in pool})
    assert len(seeds) == reading._GRAMMAR_SEEDS


def test_a_seed_the_text_does_not_use_is_asked_for_again(answered):
    calls = answered(_reply(), grammar=[KUDASAI])
    data = reading._call_llm_comprehension("N5", "en")

    assert len(calls) == reading._COMPREHENSION_ATTEMPTS
    assert "REJECTED" in _prompt(calls, 1)
    assert "〜てください" in _prompt(calls, 1)
    # Never claimed: the code decides what the text contains.
    assert data["grammar_points"] == []


def test_grammar_points_claims_only_what_was_found(answered):
    answered(_reply(), grammar=[MASHITA, KUDASAI])
    data = reading._call_llm_comprehension("N5", "en")

    assert [p["pattern"] for p in data["grammar_points"]] == ["〜ました／〜ませんでした"]
    found = data["grammar_points"][0]
    assert found["level"] == "N5"
    assert found["raw_id"] == grammar_to_id(MASHITA, "N5")
    assert found["meaning"] == MASHITA["meaning"]


# ── Asked again, and told why ────────────────────────────────────────

def test_a_breakdown_that_does_not_reproduce_the_text_is_asked_again(answered):
    drifting = _reply(text=TEXT + "駅は大きいです。")
    calls = answered(drifting, _reply())
    data = reading._call_llm_comprehension("N5", "en")

    assert len(calls) == 2
    assert "REJECTED" in _prompt(calls, 1)
    assert "does not reproduce" in _prompt(calls, 1)
    assert data["text"] == TEXT


def test_a_drifting_breakdown_is_repaired_on_the_last_attempt(answered):
    """The breakdown is what the learner opens, and every sentence of
    it is analysed as written: when the model will not make the two
    agree, the breakdown wins."""
    calls = answered(_reply(text=TEXT + "駅は大きいです。"))
    data = reading._call_llm_comprehension("N5", "en")

    assert len(calls) == reading._COMPREHENSION_ATTEMPTS
    assert data["text"] == TEXT


HARD = "人生は長いです。"      # 人生 is filed at N3, in N5 kanji


def _hard_reply():
    return _reply(text=SENTENCE_1 + HARD, breakdown=[
        {"jp": SENTENCE_1, "translation": "I met a friend at the station.", "note": "", "words": WORDS_1},
        {"jp": HARD, "translation": "Life is long.", "note": "", "words": []},
    ])


def test_vocabulary_above_the_level_is_asked_again_and_named(answered):
    calls = answered(_hard_reply(), _reply())
    data = reading._call_llm_comprehension("N5", "en")

    assert len(calls) == 2
    assert "REJECTED" in _prompt(calls, 1)
    assert "人生" in _prompt(calls, 1) and "N3" in _prompt(calls, 1)
    assert data["text"] == TEXT


def test_vocabulary_above_the_level_costs_the_exercise_after_the_last_attempt(answered):
    """The one hard gate. A text the learner cannot read is worse than
    no text, and the screen's retry is one press away."""
    calls = answered(_hard_reply())
    with pytest.raises(HTTPException) as caught:
        reading._call_llm_comprehension("N5", "en")

    assert caught.value.status_code == 502
    assert "too hard" in caught.value.detail
    assert len(calls) == reading._COMPREHENSION_ATTEMPTS


def test_out_of_level_kanji_alone_is_softened_not_asked_again(answered):
    """達 is outside N5. A kanji the learner has not met is rewritten in
    kana — what a real N5 text does — with the text, the breakdown and
    the word list kept in step; it never costs a second call."""
    with_tatsu = SENTENCE_1.replace("友だち", "友達")
    words = [dict(w, surface="友達") if w["surface"] == "友だち" else w for w in WORDS_1]
    calls = answered(_reply(text=with_tatsu + SENTENCE_2, breakdown=[
        {"jp": with_tatsu, "translation": "I met a friend at the station.", "note": "", "words": words},
        {"jp": SENTENCE_2, "translation": "The train is new.", "note": "", "words": WORDS_2},
    ]))
    data = reading._call_llm_comprehension("N5", "en")

    assert len(calls) == 1
    assert data["text"] == "駅でともだちに会いました。" + SENTENCE_2
    assert data["breakdown"][0]["jp"] == "駅でともだちに会いました。"
    assert {"surface": "ともだち", "meaning": "friend"} in data["breakdown"][0]["words"]


def test_kanji_feedback_rides_along_when_something_else_is_asked_again(answered):
    with_tatsu = SENTENCE_1.replace("友だち", "友達")
    calls = answered(_reply(text=with_tatsu + SENTENCE_2, breakdown=[
        {"jp": with_tatsu, "translation": "", "note": "", "words": []},
        {"jp": SENTENCE_2, "translation": "", "note": "", "words": []},
    ]), _reply(), grammar=[KUDASAI])
    reading._call_llm_comprehension("N5", "en")

    # The seed is what sends the prompt back (and keeps sending it: the
    # second reply lacks it too); the kanji line rides on the first
    # feedback because it was there to say.
    assert len(calls) == reading._COMPREHENSION_ATTEMPTS
    assert "kanji above N5: 達" in _prompt(calls, 1)
    assert "kanji above" not in _prompt(calls, 2)


# ── The breakdown ────────────────────────────────────────────────────

def test_breakdown_survives_the_round_trip_in_order(answered):
    answered(_reply())
    data = reading._call_llm_comprehension("N5", "en")

    assert [p["jp"] for p in data["breakdown"]] == [SENTENCE_1, SENTENCE_2]
    assert data["breakdown"][0]["note"].startswith("に marks")
    # A sentence with nothing worth noting keeps its blank rather than
    # being dropped — the Japanese is still part of the passage.
    assert data["breakdown"][1]["note"] == ""
    # And the word list rides with its sentence.
    assert data["breakdown"][0]["words"] == WORDS_1


def test_translation_is_the_breakdown_read_end_to_end(answered):
    answered(_reply())
    data = reading._call_llm_comprehension("N5", "en")

    assert data["translation"] == (
        "I met a friend at the station. The train is new."
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
    ([{"jp": "駅。"}], [{"jp": "駅。", "translation": "", "note": "", "words": []}]),
    # A model that answers a text field with something that is not text
    # is answering badly, not fatally: the line prints without it.
    ([{"jp": "駅。", "translation": 42, "note": ["a"], "words": "駅"}],
     [{"jp": "駅。", "translation": "", "note": "", "words": []}]),
    # Nothing to show a sentence against — dropped, order kept.
    ([{"translation": "orphan"}, {"jp": "駅。", "translation": "Station."}],
     [{"jp": "駅。", "translation": "Station.", "note": "", "words": []}]),
    ([{"jp": "  駅。  ", "translation": "  Station.  ", "note": ""}],
     [{"jp": "駅。", "translation": "Station.", "note": "", "words": []}]),
    # A word without a surface is nothing to gloss; a word without a
    # meaning is still a word.
    ([{"jp": "駅。", "words": [{"meaning": "x"}, {"surface": " 駅 "}, 7, {"surface": "。", "meaning": 3}]}],
     [{"jp": "駅。", "translation": "", "note": "",
       "words": [{"surface": "駅", "meaning": ""}, {"surface": "。", "meaning": ""}]}]),
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
BAD_NOTE = '"note": 「に」 marks who was met."'
GOOD_NOTE = '"note": "に marks who was met."'

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
    assert data["breakdown"][0]["note"] == "「に」 marks who was met."


def test_a_word_that_opened_on_the_wrong_quote_is_repaired_too(answered):
    """The word lists open the same door: a surface IS Japanese."""
    reply = _reply()
    good = '"surface": "駅"'
    assert good in reply
    calls = answered(reply.replace(good, '"surface": 駅"', 1))

    data = reading._call_llm_comprehension("N5", "en")
    assert len(calls) == 1
    assert data["breakdown"][0]["words"][0] == {"surface": "駅", "meaning": "station"}


def test_repair_is_never_applied_to_an_answer_that_parses(answered):
    """It runs only on input json.loads has already refused. A value
    that contains the repair's own pattern is the case that would
    notice if that ever stopped being true."""
    quoted = 'She asked "note": what time is it, and left.'
    answered(_reply(breakdown=[
        {"jp": SENTENCE_1, "translation": quoted, "note": ""},
        {"jp": SENTENCE_2, "translation": "The train is new.", "note": ""},
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
