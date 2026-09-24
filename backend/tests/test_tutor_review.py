# The tutor's review as a shape, shared (study/tutor_review.py, plan 124).
#
# The parser's leniency, the prose fallback and the corrected sentence
# are held by tests/test_translation_review.py through translation's
# aliases, and stay there. These pin only what moving the shape out of
# routes/translation.py added: the `meaning` key 作文 asks for, and the
# text form that reads it out -- and reads exactly as before without it.
import json

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
