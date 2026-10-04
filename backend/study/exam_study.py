# ── A sat question, made something to study ─────────────────────
# The result screen's review shows each question revealed; this is what
# it adds under it: the question's sentence with the answer in its place
# (the one the breakdown reads, through POST /api/phrase/analyze), that
# sentence and every choice in the learner's language, and for a reading
# or listening question the passage or the script too.
#
# The texts are read from the stored paper, never taken from the client:
# the endpoint would otherwise be a free translator for anything posted
# to it. Translations are cached by content (exam_translations), so a
# shared paper is translated once per language for everyone who sits
# it, and a passage shared by three questions is translated once.
# The table is created with the other exam tables (study/exam_schema.py).
import hashlib
import json
import re

from core.db import db_conn
from study.exam_gen_utils import GenerationFailed, call_llm_json

_GAP_RUN = re.compile(r"＿{2,}")
_BLANK_MARK = re.compile(r"【(\d+)】")
_SENTENCE_END = re.compile(r"(?<=[。！？!?])")

# v1: the first prompt. Bump to retranslate every cached row.
_CACHE_REV = "v1"


def find_question(paper: dict, question_id: str) -> tuple[dict, dict, dict | None] | None:
    """(mondai, question, passage) for one question id of a stored paper,
    the question as the generator wrote it (its own blank number intact,
    which flatten_questions renumbers)."""
    for section in paper.get("sections") or []:
        for mondai in section.get("mondai") or []:
            for q in mondai.get("questions") or []:
                if q.get("id") == question_id:
                    return mondai, q, None
            for passage in mondai.get("passages") or []:
                for q in (passage.get("questions") or []) + (passage.get("blanks") or []):
                    if q.get("id") == question_id:
                        return mondai, q, passage
    return None


def _answer_text(q: dict) -> str:
    for c in q.get("choices") or []:
        if c.get("id") == q.get("answer"):
            return c.get("textJp") or ""
    return ""


def _cloze_sentence(passage: dict, number: int) -> str:
    """The sentence of a cloze passage that holds blank `number`, every
    blank of it filled with its right answer."""
    answers = {b.get("number"): _answer_text(b) for b in passage.get("blanks") or []}
    template = passage.get("textTemplateJp") or ""
    for sentence in _SENTENCE_END.split(template):
        if f"【{number}】" in sentence:
            return _BLANK_MARK.sub(lambda m: answers.get(int(m.group(1)), ""), sentence).strip()
    return ""


def study_sentence(mondai: dict, q: dict, passage: dict | None) -> str:
    """The sentence a learner studies this question by: the answer in its
    gap, the pieces in their order, the right sentence of a usage item."""
    kind = mondai.get("type")
    if "pieces" in q:
        by_id = {p["id"]: p.get("textJp") or "" for p in q["pieces"]}
        return (q.get("contextJp") or "") + "".join(by_id.get(i, "") for i in q.get("order") or [])
    if kind == "cloze-passage" and passage:
        return _cloze_sentence(passage, q.get("number"))
    if kind == "vocab-usage":
        return _answer_text(q)
    prompt = q.get("promptJp") or q.get("questionPromptJp") or ""
    if _GAP_RUN.search(prompt):
        return _GAP_RUN.sub(_answer_text(q), prompt, count=1)
    return prompt


def study_context(mondai: dict, q: dict, passage: dict | None) -> str:
    """The longer text a question was asked about, if any: a reading
    passage or a listening script. A cloze passage is the sentence's
    own text, so it is not repeated."""
    if q.get("scriptJp"):
        return q["scriptJp"]
    if passage and mondai.get("type") != "cloze-passage":
        return passage.get("textJp") or ""
    return ""


_QUESTION_PROMPT = """You translate one question of a Japanese exam for a \
learner who has just sat it, into {lang_name}.

You are given the question's sentence (with the right answer already in \
place) and its four answer choices, numbered. Respond with ONLY JSON (no \
markdown fences, no commentary):
{{"sentence": "...", "choices": ["...", "...", "...", "..."]}}

- "sentence" is the sentence translated into {lang_name}: one natural \
sentence, as a subtitle would give it, with no notes or alternatives.
- "choices" has one entry per choice, in the order given: a short \
translation of that word or phrase into {lang_name}. A choice that is a \
kana reading of a word is translated as that word. A choice that is not \
a real Japanese word or phrase (an invented reading, a misspelling made \
up to be a wrong answer) is an empty string "".
"""

_CONTEXT_PROMPT = """You translate a Japanese text from an exam into \
{lang_name} for a learner who has just sat it. Keep its lines: a line \
that starts with a speaker label ("A:", "narrator:") keeps the label \
untranslated. Respond with ONLY JSON (no markdown fences, no commentary):
{{"translation": "..."}}
"""


def _key(kind: str, lang: str, payload: object) -> str:
    raw = json.dumps([_CACHE_REV, kind, lang, payload], ensure_ascii=False, sort_keys=True)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def _cached(key: str) -> dict | None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT payload FROM exam_translations WHERE key = %s", (key,))
            row = cur.fetchone()
            return row[0] if row else None
    finally:
        conn.close()


def _store(key: str, payload: dict) -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO exam_translations(key, payload) VALUES (%s, %s) ON CONFLICT (key) DO NOTHING",
                (key, json.dumps(payload, ensure_ascii=False)),
            )
        conn.commit()
    finally:
        conn.close()


def _translate_question(sentence: str, choices: list[str], lang: str, lang_name: str) -> dict:
    key = _key("question", lang, [sentence, choices])
    hit = _cached(key)
    if hit is not None:
        return hit
    listing = "\n".join(f"{i + 1}. {c}" for i, c in enumerate(choices))
    data = call_llm_json(
        _QUESTION_PROMPT.format(lang_name=lang_name),
        f"Sentence: {sentence}\nChoices:\n{listing}",
        task="exam-study",
    )
    out_sentence = data.get("sentence") if isinstance(data, dict) else None
    out_choices = data.get("choices") if isinstance(data, dict) else None
    if not isinstance(out_sentence, str) or not isinstance(out_choices, list) or len(out_choices) != len(choices):
        raise GenerationFailed(f"exam-study: malformed translation {data!r}")
    payload = {
        "sentence": out_sentence.strip(),
        "choices": [c.strip() if isinstance(c, str) else "" for c in out_choices],
    }
    _store(key, payload)
    return payload


def _translate_context(text: str, lang: str, lang_name: str) -> str:
    key = _key("context", lang, text)
    hit = _cached(key)
    if hit is not None:
        return hit.get("translation", "")
    data = call_llm_json(_CONTEXT_PROMPT.format(lang_name=lang_name), text, task="exam-study")
    translation = data.get("translation") if isinstance(data, dict) else None
    if not isinstance(translation, str) or not translation.strip():
        raise GenerationFailed(f"exam-study: malformed context translation {data!r}")
    _store(key, {"translation": translation.strip()})
    return translation.strip()


def study_question(paper: dict, question_id: str, lang: str, lang_name: str) -> dict | None:
    """The study payload for one question, or None when the paper has no
    such question. Raises LLMUnavailable / GenerationFailed when the
    translation cannot be made; the caller turns those into a 503."""
    found = find_question(paper, question_id)
    if found is None:
        return None
    mondai, q, passage = found
    sentence = study_sentence(mondai, q, passage)
    options = q.get("choices") or q.get("pieces") or []
    # Sentence order's pieces are fragments of the sentence itself, whose
    # translation alone means little; the sentence carries them.
    choice_texts = [] if "pieces" in q else [c.get("textJp") or "" for c in options]

    translated = (
        _translate_question(sentence, choice_texts, lang, lang_name)
        if choice_texts else {"sentence": _translate_context(sentence, lang, lang_name), "choices": []}
    )
    context = study_context(mondai, q, passage)
    return {
        "questionId": question_id,
        "sentence": sentence,
        "translation": translated["sentence"],
        "choices": [
            {"id": c.get("id"), "translation": t}
            for c, t in zip(options, translated["choices"])
        ],
        "context": context,
        "contextTranslation": _translate_context(context, lang, lang_name) if context else "",
    }

