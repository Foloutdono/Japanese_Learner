# 翻訳 — the tutor's review as a shape (routes/translation.py).
#
# The review used to be a paragraph; it is now a verdict, a line, what
# worked, what to fix and the corrected sentence, so the screen can draw
# it at a glance. These pin the parser's leniency (bad verdict, long
# lists, a non-text item), the prose fallback, and the prompt's grammar
# clause. The one network call is stubbed.
import json

import pytest

from routes import reading, translation


def _reply(**over):
    body = {
        "verdict": "partial",
        "summary": "The obligation is right; the object particle is wrong.",
        "good": ["「書かなければなりません」 expresses the obligation"],
        "fix": [{"issue": "「名前が」 marks the subject", "fix": "「名前を」"}],
        "grammar_used": True,
        "better": "毎日名前を書かなければなりません。",
    }
    body.update(over)
    return json.dumps(body, ensure_ascii=False)


def test_a_well_formed_reply_is_the_shape():
    review = translation._parse_review(_reply())
    assert review["verdict"] == "partial"
    assert review["good"] == ["「書かなければなりません」 expresses the obligation"]
    assert review["fix"] == [{"issue": "「名前が」 marks the subject", "fix": "「名前を」"}]
    assert review["grammar_used"] is True
    assert review["better"] == "毎日名前を書かなければなりません。"


def test_fences_are_stripped_and_a_bad_verdict_becomes_partial():
    review = translation._parse_review("```json\n" + _reply(verdict="great") + "\n```")
    assert review["verdict"] == "partial"


def test_lists_are_cut_to_three_and_items_that_are_not_text_are_dropped():
    review = translation._parse_review(_reply(
        good=["a", 7, "b", "c", "d"],
        fix=[{"issue": "x"}, "bare", {"fix": "no issue"}, {"issue": "y", "fix": "z"}, {"issue": "w"}],
    ))
    assert review["good"] == ["a", "b", "c"]
    assert review["fix"] == [
        {"issue": "x", "fix": ""}, {"issue": "bare", "fix": ""}, {"issue": "y", "fix": "z"},
    ]


def test_nothing_to_fix_means_no_corrected_sentence():
    review = translation._parse_review(_reply(verdict="correct", fix=[], better="毎日名前を書かなければなりません。"))
    assert review["fix"] == []
    assert review["better"] == ""


def test_grammar_used_is_a_boolean_or_nothing():
    assert translation._parse_review(_reply(grammar_used="yes"))["grammar_used"] is None
    assert translation._parse_review(_reply(grammar_used=False))["grammar_used"] is False


def test_prose_is_not_the_shape():
    assert translation._parse_review("Bonjour ! Votre traduction est correcte.") is None
    assert translation._parse_review('{"summary": "no verdict"}') is None


def test_the_text_form_reads_the_shape_out():
    text = translation._review_as_text(translation._parse_review(_reply()))
    assert text.splitlines()[0].startswith("The obligation")
    assert "+ 「書かなければなりません」" in text
    assert "- 「名前が」 marks the subject -> 「名前を」" in text
    assert text.endswith("毎日名前を書かなければなりません。")


@pytest.fixture
def tutor(monkeypatch):
    calls = []

    def use(reply):
        def chat(messages, *a, **kw):
            calls.append(messages)
            return reply
        monkeypatch.setattr(translation, "llm_configured", lambda: True)
        monkeypatch.setattr(reading, "_chat", chat)
        return calls
    return use


PAYLOAD = {
    "translation_prompt": "I have to write my name every day.",
    "target_phrase": "毎日、名前を書かなければなりません。",
    "target_romaji": "mainichi, namae wo kakanakereba narimasen",
    "user_answer": "毎日名前が書かなければなりません。",
    "lang": "en",
}


def test_the_endpoint_serves_the_shape_and_its_text(client, tutor):
    calls = tutor(_reply())
    r = client.post("/api/translation/analyze", json=PAYLOAD)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["review"]["verdict"] == "partial"
    assert body["review"]["fix"][0]["fix"] == "「名前を」"
    assert body["analysis"].startswith("The obligation")
    # No grammar point named: the rule says so, and the note is absent.
    sent = calls[0][0]["content"]
    assert "always null" in sent
    assert "chosen to practise" not in sent


def test_a_grammar_point_reaches_the_prompt(client, tutor):
    calls = tutor(_reply())
    r = client.post("/api/translation/analyze", json={**PAYLOAD, "grammar": "〜なければなりません"})
    assert r.status_code == 200
    sent = calls[0][0]["content"]
    assert "chosen to practise the grammar point 〜なければなりません" in sent
    assert "true if the attempt uses 〜なければなりません" in sent


def test_prose_is_served_as_prose(client, tutor):
    tutor("Bonjour ! Votre traduction est correcte.")
    r = client.post("/api/translation/analyze", json=PAYLOAD)
    assert r.status_code == 200
    assert r.json() == {"review": None, "analysis": "Bonjour ! Votre traduction est correcte."}
