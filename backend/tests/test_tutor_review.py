# The tutor's review as a shape, shared (study/tutor_review.py, plan 125).
#
# The parser's leniency, the prose fallback and the corrected sentence
# are held by tests/test_translation_review.py through translation's
# aliases, and stay there. These pin only what moving the shape out of
# routes/translation.py added: the `meaning` key 作文 asks for, and the
# text form that reads it out -- and reads exactly as before without it.
import json

import pytest

from routes import translation
from study import tutor_review


def _reply(**over):
    body = {
        "verdict": "acceptable",
        "summary": "Natural, with one particle to fix.",
        "good": ["「ながら」 joins the two actions"],
        "fix": [{"issue": "「音楽が」 marks the object", "fix": "「音楽を」"}],
        "grammar_used": True,
        "better": "音楽を聞きながら勉強します。",
    }
    body.update(over)
    return json.dumps(body, ensure_ascii=False)


def test_meaning_is_read_and_shortened():
    review = tutor_review.parse_review(_reply(meaning="  I study while listening to music.  "))
    assert review["meaning"] == "I study while listening to music."
    long = tutor_review.parse_review(_reply(meaning="x" * 500))
    assert len(long["meaning"]) == 240


def test_a_reply_without_meaning_has_none_to_draw():
    review = tutor_review.parse_review(_reply())
    assert review["meaning"] == ""
    # Not text: dropped, not served.
    assert tutor_review.parse_review(_reply(meaning=["a list"]))["meaning"] == ""


def test_the_text_form_reads_meaning_out_only_when_there_is_one():
    with_meaning = tutor_review.review_as_text(tutor_review.parse_review(_reply(meaning="I study while listening.")))
    assert with_meaning.splitlines()[:2] == ["Natural, with one particle to fix.", "I study while listening."]
    without = tutor_review.review_as_text(tutor_review.parse_review(_reply()))
    assert without.splitlines()[0] == "Natural, with one particle to fix."
    assert "I study" not in without
    assert without.splitlines()[1].startswith("+ ")


def test_translation_keeps_its_names_bound_to_the_shared_shape():
    # routes/translation.py's privates are the shared functions, not
    # copies -- so a fix in one place is a fix in both.
    assert translation._parse_review is tutor_review.parse_review
    assert translation._fenced is tutor_review.fenced
    assert translation._corrected is tutor_review.corrected
    assert translation._review_as_text is tutor_review.review_as_text
    assert translation.VERDICTS == tutor_review.VERDICTS


# ── A model that thinks out loud (2026-10-12) ────────────────────────
# A learner was shown "We need to produce JSON with fields: verdict,
# summary, good, fix, grammar_used, better. First, analyze the
# learner's attempt..." as their review: the model spent its token cap
# reasoning in `content`, never reached the JSON, and the reply was
# served as prose. Three defences, each pinned here.
MONOLOGUE = (
    "We need to produce JSON with fields: verdict, summary, good, fix, grammar_used, better.\n\n"
    "First, analyze the learner's attempt: \"doyoubi ha yama he tomodachi ga ikimasu\". "
    "The grammar_used: true if the attempt uses <<<へ>>>. The learner wrote \"he\". "
    "That changes the meaning (the subject is friend). So verdict: \"partial\" or \"incorrect\"?"
)


def _answer(**over):
    body = {"verdict": "partial", "summary": "Particle.", "good": [], "fix": [], "grammar_used": True, "better": ""}
    body.update(over)
    return json.dumps(body, ensure_ascii=False)


def test_the_object_after_a_monologue_is_the_answer():
    review = tutor_review.parse_review(MONOLOGUE + "\n\n" + _answer(verdict="incorrect", summary="Meaning changed."))
    assert review["verdict"] == "incorrect"
    assert review["summary"] == "Meaning changed."


def test_the_last_object_wins_over_a_drafted_one():
    draft = _answer(verdict="correct")
    final = _answer(verdict="partial")
    assert tutor_review.parse_review(f"Draft: {draft}\nOn reflection: {final}")["verdict"] == "partial"


def test_a_monologue_alone_is_not_the_shape_and_not_prose():
    assert tutor_review.parse_review(MONOLOGUE) is None
    assert tutor_review.usable_prose(MONOLOGUE) is None
    assert not tutor_review.acceptable_reply(MONOLOGUE)


@pytest.mark.parametrize("reply", [
    '{"verdict": "partial", "summary": "cut off mid-obj',          # the cap hit inside the object
    "Nous devons produire un JSON avec les champs verdict, summary.",
    "We need to decide the verdict first.",
    "Votre phrase est correcte. " * 40,                           # not a review at a glance
    "Voici l'analyse : \"verdict\": \"partial\", grammar_used true",
    "",
])
def test_a_reply_that_reads_as_reasoning_or_cut_off_is_refused(reply):
    assert tutor_review.usable_prose(reply) is None
    assert not tutor_review.acceptable_reply(reply)


@pytest.mark.parametrize("reply", [
    "Bonjour ! Votre traduction est correcte.",
    "Almost: 「を」 marks the object, but you wrote 「が」.",
    "```\nTa phrase est naturelle.\n```",
])
def test_a_short_review_in_prose_is_still_served(reply):
    assert tutor_review.usable_prose(reply)
    assert tutor_review.acceptable_reply(reply)
