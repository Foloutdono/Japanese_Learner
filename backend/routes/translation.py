import logging
import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core.db import db_conn
from core.auth import get_user_id
import routes.reading as reading  # reused wholesale below — see get_translation_batch's docstring
from study.llm_shared import llm_configured

router = APIRouter()
logger = logging.getLogger(__name__)


# ── Table setup ──────────────────────────────────────────────────────
#
# No migration tooling available in this environment (see scheduler.py
# fix note / srs.py's own self-managed schema for precedent), so this
# new mode owns its table the same way SRSEngine._init_db does: create
# it on import if it isn't there yet. Mirrors reading_log's shape
# closely (level/phase/phrase/romaji/answer/correct/created_at) with
# one addition — translation_prompt — since here the *prompt* shown to
# the learner is the foreign-language sentence, not the Japanese one,
# and losing that would make translation_log's rows unreadable in
# isolation (answer/phrase alone don't tell you what was asked).
def _init_db() -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS translation_log (
                    id BIGSERIAL PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    level TEXT NOT NULL DEFAULT '',
                    phase TEXT NOT NULL,
                    translation_prompt TEXT NOT NULL,
                    phrase TEXT NOT NULL,
                    romaji TEXT NOT NULL,
                    answer TEXT NOT NULL,
                    correct BOOLEAN NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_translation_log_user
                ON translation_log(user_id, created_at)
                """
            )
        conn.commit()
    finally:
        conn.close()


_init_db()


# ── Phrase source: reuse reading.py's, don't reinvent it ────────────
#
# Translation mode needs exactly the same thing reading mode already
# has: a Japanese sentence (`phrase`/`romaji`) with a foreign-language
# gloss (`translation`), picked by level / frequency tier / the
# learner's own mastered vocab, with the same difficulty gating
# (_sentence_kanji_ok) and the same "entirely known vocabulary" gate
# for mastery mode. The only thing that differs is which field the
# learner sees FIRST (translation here, phrase in reading mode) — the
# underlying data and all its selection logic is identical, so this
# calls reading.get_reading_batch(...) directly rather than
# duplicating _pick_words_level/_pick_words_frequency/_pick_words_mastery
# here. `tier_size` defaults to the same DEFAULT_TIER_SIZE reading.py
# already uses, so the two modes' tier numbering lines up if a learner
# switches between them.
@router.get("/api/translation/batch")
def get_translation_batch(
    source: str,                         # "level" | "frequency" | "mastery"
    level: str | None = None,
    domain: str | None = None,
    tier: int | None = None,
    tier_size: int = reading.freq.DEFAULT_TIER_SIZE,
    count: int = reading.DEFAULT_BATCH,
    lang: str = "en",
    # Sentences this session has already served, "|"-separated. Passed
    # straight through: the curated bank is finite (30-55 sentences a
    # level), and without this the picker reshuffles the same pool every
    # batch and a learner meets 何を買いたいですか three times in a
    # sitting. See reading._pick_curated_phrases.
    exclude: str = "",
    user_id: str = Depends(get_user_id),
):
    return reading.get_reading_batch(
        source=source, level=level, domain=domain, tier=tier,
        tier_size=tier_size, count=count, lang=lang, exclude=exclude,
        user_id=user_id,
    )


# ── LLM analysis ──────────────────────────────────────────────────────
#
# Deliberately NOT a correct/incorrect verdict — same philosophy as
# reading.py's post_reading_result ("Correctness is self-assessed by
# the user after seeing the reveal"). The reference translation is
# already sitting in the batch response the client fetched, so the
# reveal itself needs no round trip; this endpoint only adds the part
# the client CAN'T produce on its own: a natural-language comparison
# that helps the learner judge whether their own phrasing was good
# enough, even when it doesn't match the reference word-for-word.
class AnalyzePayload(BaseModel):
    translation_prompt: str   # the foreign-language sentence the learner was asked to translate
    target_phrase: str        # reference Japanese translation, from the batch data
    target_romaji: str
    user_answer: str          # the learner's own Japanese attempt
    lang: str = "en"
    # The grammar point the reference sentence was written to
    # demonstrate, when it has one -- every curated sentence carries it
    # (see content/reading_sentences.py) and a corpus-sourced one does
    # not. Empty means "no reliable claim", not "no grammar".
    grammar: str = ""


ANALYSIS_PROMPT_TEMPLATE = """You are a friendly, encouraging Japanese teacher helping a learner self-assess their own translation attempt.

The learner was asked to translate this {lang_name} sentence into Japanese:
"{translation_prompt}"

A reference Japanese translation is:
{target_phrase} ({target_romaji})

The learner's own attempt was:
{user_answer}

Write a short analysis (3-5 sentences, in {lang_name}) that helps the learner judge for themselves whether their attempt was good enough. Do NOT simply announce "correct" or "incorrect" as a verdict — instead:
- Point out what their attempt got right (grammar, vocabulary, nuance).
- Note any meaningful differences from the reference (wrong particle, wrong verb form/conjugation, missing or added nuance, unnatural phrasing, wrong word/kanji choice) — but a DIFFERENT phrasing that is still natural and correct Japanese is not a mistake, say so explicitly if that's the case.
- Say whether a native speaker would understand what they meant, even if imperfect.
{grammar_note}
Be specific and reference actual words from their attempt rather than speaking in generalities. Keep the tone encouraging but honest. Respond with plain text only — no markdown formatting, no JSON, no preamble like "Here's my analysis"."""


@router.post("/api/translation/analyze")
def post_translation_analyze(payload: AnalyzePayload, user_id: str = Depends(get_user_id)):
    if not llm_configured():
        raise HTTPException(status_code=500, detail="No LLM provider is configured")
    if not payload.user_answer.strip():
        raise HTTPException(status_code=400, detail="user_answer is required")

    lang_name = reading.LANG_NAMES.get(payload.lang, payload.lang)
    # The one thing this endpoint knows that the learner does not, and
    # that the reference sentence alone does not say: WHY this sentence
    # was chosen. A curated sentence exists to demonstrate one grammar
    # point (content/reading_sentences.py names it, and a test proves the
    # sentence contains it), so the analysis can tell the learner whether
    # they reached for that construction or worked around it -- which is
    # the difference between "you were understood" and "you practised the
    # thing this exercise was for".
    #
    # Only added when the phrase actually carries a point. A guess about
    # what a Tatoeba sentence is "for" would be exactly the kind of
    # confident-but-unfounded instruction this app avoids elsewhere.
    grammar_note = ""
    if payload.grammar.strip():
        grammar_note = (
            "- This sentence was chosen to practise the grammar point "
            f"{payload.grammar.strip()}. Say whether the learner used it, and if "
            "they expressed the same idea another way, show them how the "
            "sentence would look using it.\n"
        )
    prompt = ANALYSIS_PROMPT_TEMPLATE.format(
        lang_name=lang_name,
        translation_prompt=payload.translation_prompt,
        target_phrase=payload.target_phrase,
        target_romaji=payload.target_romaji,
        user_answer=payload.user_answer,
        grammar_note=grammar_note,
    )

    # reading._chat already handles the multi-model fallback chain and
    # raises HTTPException(503, ...) if every provider fails — nothing
    # to add here.
    content = reading._chat([
        {"role": "system", "content": prompt},
        {"role": "user", "content": "Analyze my translation attempt."},
    ])
    # Not JSON here (plain prose is simpler for a short free-text
    # analysis and there's no structured field the client needs to
    # parse out), but strip stray code fences defensively in case a
    # model wraps its answer in one anyway.
    cleaned = re.sub(r"^```(?:\w+)?|```$", "", content.strip(), flags=re.MULTILINE).strip()
    return {"analysis": cleaned}


# ── Result logging (self-graded, same pattern as reading.py) ────────
class ResultPayload(BaseModel):
    source: str                # compact source label — see reading._source_label()
    level: str | None = None
    translation_prompt: str
    phrase: str
    romaji: str
    answer: str
    correct: bool


@router.post("/api/translation/result")
def post_translation_result(payload: ResultPayload, user_id: str = Depends(get_user_id)):
    # translation_log.level has no NOT NULL-without-default trap to
    # dodge (see reading.py's post_reading_result note) since this
    # table was created with DEFAULT '' from the start — still coalesce
    # explicitly so a None level never has to rely on the column
    # default silently doing the right thing.
    level_for_log = payload.level or ""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO translation_log
                    (user_id, level, phase, translation_prompt, phrase, romaji, answer, correct)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    user_id, level_for_log, payload.source, payload.translation_prompt,
                    payload.phrase, payload.romaji, payload.answer, payload.correct,
                ),
            )
        conn.commit()
    finally:
        conn.close()

    return {"correct": payload.correct}


@router.get("/api/translation/history")
def get_translation_history(user_id: str = Depends(get_user_id), limit: int = 50):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT level, phase, translation_prompt, phrase, romaji, answer, correct, created_at
                FROM translation_log
                WHERE user_id = %s
                ORDER BY created_at DESC
                LIMIT %s
                """,
                (user_id, limit),
            )
            rows = cur.fetchall()
    finally:
        conn.close()

    return [
        {
            "level": level, "source": phase, "translation_prompt": translation_prompt,
            "phrase": phrase, "romaji": romaji, "answer": answer, "correct": correct,
            "created_at": created_at.isoformat(),
        }
        for level, phase, translation_prompt, phrase, romaji, answer, correct, created_at in rows
    ]
