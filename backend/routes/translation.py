import json
import logging
import re

from fastapi import APIRouter, Depends, HTTPException, Query
from core.credits import require_pass
from pydantic import BaseModel, Field

from core.db import db_conn
from core.auth import get_user_id
from core.srs_instance import srs
import routes.reading as reading  # reused wholesale below — see get_translation_batch's docstring
from study.card_lookup import vocab_card_id_for_word
from study.llm_shared import llm_configured

# A pass feature (plan 069): every route here refuses a free learner
# with 402 pass_required once CREDITS_ENFORCE=1; a no-op until then.
router = APIRouter(dependencies=[Depends(require_pass)])
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
                    quality SMALLINT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            # The screen grades with the app's six-segment rating bar, so
            # the learner's answer carries more than pass/fail. `correct`
            # stays -- it is what every existing reader and every row
            # written before this understands -- and `quality` records the
            # rating it was derived from, 0..5 worst-to-best, exactly as
            # RatingBar emits it.
            #
            # NULLable on purpose: every row logged before this column
            # existed genuinely has no rating, and a default would invent
            # one. A reader has to treat NULL as "graded, resolution
            # unknown" rather than as a score.
            #
            # ADD COLUMN IF NOT EXISTS for installs whose table predates
            # this: the create above only fires when the table is absent,
            # so it never revisits one that already exists. Same pattern
            # as phrase.py's `source` and decks.py's `structure`/`fields`.
            #
            # (Deliberately not spelling the create statement out again
            # here -- test_schema_declared.py greps this directory for
            # that phrase to find every table the code creates, and the
            # next word in a sentence would read as a table name.)
            cur.execute(
                "ALTER TABLE translation_log ADD COLUMN IF NOT EXISTS quality SMALLINT"
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


# ── The review, as a shape (2026-09-13, owner-directed) ──
# The tutor used to answer in a paragraph: five sentences, one colour,
# the praise and the error in the same breath. A learner on a phone
# read none of it. The review is now a fixed shape the screen can draw
# as a verdict, a line, and rows a learner tells apart at a glance:
# what worked (+), what to fix (- with the fix under it), and their
# own sentence corrected. The model proposes the shape; _parse_review
# decides what of it is usable, and a reply that is not the shape at
# all is served as the prose it is rather than lost.
VERDICTS = ("correct", "acceptable", "partial", "incorrect")
_MAX_ITEMS = 3

ANALYSIS_PROMPT_TEMPLATE = """You are a Japanese teacher reviewing a learner's translation attempt. The learner reads your review at a glance on a phone, so it is a SHAPE, not a paragraph.

The learner was asked to translate this {lang_name} sentence into Japanese:
"{translation_prompt}"

A reference Japanese translation is:
{target_phrase} ({target_romaji})

The learner's own attempt was:
{user_answer}
{grammar_note}
Respond with ONLY a JSON object (no markdown fences, no commentary) matching exactly this schema:
{{
  "verdict": "correct",
  "summary": "...",
  "good": ["..."],
  "fix": [{{"issue": "...", "fix": "..."}}],
  "grammar_used": null,
  "better": ""
}}

Rules:
- "verdict" is exactly one of: "correct" (the meaning is right and the Japanese is natural -- a phrasing that differs from the reference but is still correct, natural Japanese is "correct", never a mistake), "acceptable" (the meaning is right and a native speaker would understand it, but something is slightly unnatural), "partial" (understood, but with a real error: a wrong particle, a wrong verb form, a wrong word or kanji), "incorrect" (the meaning is lost or changed).
- "summary" is ONE short {lang_name} sentence saying why that verdict. No greeting, no "your translation", no restating the sentence.
- "good" lists what the attempt got right: at most {max_items} items, each a short {lang_name} phrase that NAMES the Japanese it praises in 「 」 (for example: 「を」 marks the object correctly). May be empty.
- "fix" lists what is wrong: at most {max_items} items, the most important first. Each has "issue" (a short {lang_name} phrase naming the Japanese in 「 」 and what is wrong with it) and "fix" (what to write instead, the Japanese in 「 」). A phrasing that merely differs from the reference is NOT an issue. Empty means nothing to fix.
- "grammar_used": {grammar_used_rule}
- "better" is the learner's OWN sentence with the fixes applied, in Japanese, when "fix" is not empty; the empty string when it is. Keep their wording wherever it was fine: this is their sentence corrected, not the reference copied.
- Every value is a plain JSON string, list, boolean or null, and a string opens with the " character and closes with it. Quote Japanese INSIDE a value with 「 」 only, never with quotes.
- Short over complete. The learner should see the verdict, the good items and the fix items and know in three seconds where they stand."""


def _short(value, limit: int = 240) -> str:
    return value.strip()[:limit] if isinstance(value, str) else ""


def _parse_review(content: str) -> dict | None:
    """The model's answer as the shape the screen draws, or None when it
    is not that shape at all -- in which case the caller serves the
    prose. Lenient inside the shape: a bad verdict becomes "partial", a
    list too long is cut to its first items, an item that is not text
    is dropped."""
    cleaned = re.sub(r"^```(?:\w+)?|```$", "", content.strip(), flags=re.MULTILINE).strip()
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict) or "verdict" not in data:
        return None

    verdict = data.get("verdict") if data.get("verdict") in VERDICTS else "partial"
    good = []
    if isinstance(data.get("good"), list):
        good = [_short(item) for item in data["good"] if _short(item)][:_MAX_ITEMS]
    fix = []
    if isinstance(data.get("fix"), list):
        for item in data["fix"]:
            if isinstance(item, dict) and _short(item.get("issue")):
                fix.append({"issue": _short(item.get("issue")), "fix": _short(item.get("fix"))})
            elif _short(item):
                fix.append({"issue": _short(item), "fix": ""})
    fix = fix[:_MAX_ITEMS]
    grammar_used = data.get("grammar_used")
    return {
        "verdict": verdict,
        "summary": _short(data.get("summary")),
        "good": good,
        "fix": fix,
        "grammar_used": grammar_used if isinstance(grammar_used, bool) else None,
        "better": _short(data.get("better")) if fix else "",
    }


def _review_as_text(review: dict) -> str:
    """The shape read out as lines -- what an older client prints, and
    what the log shows."""
    lines = [review["summary"]] if review["summary"] else []
    lines += [f"+ {item}" for item in review["good"]]
    lines += [f"- {item['issue']}" + (f" -> {item['fix']}" if item["fix"] else "") for item in review["fix"]]
    if review["better"]:
        lines.append(review["better"])
    return "\n".join(lines)


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
    # sentence contains it), so the review can say whether they reached
    # for that construction or worked around it -- which is the
    # difference between "you were understood" and "you practised the
    # thing this exercise was for".
    #
    # Only added when the phrase actually carries a point. A guess about
    # what a Tatoeba sentence is "for" would be exactly the kind of
    # confident-but-unfounded instruction this app avoids elsewhere.
    grammar = payload.grammar.strip()
    if grammar:
        grammar_note = f"\nThis sentence was chosen to practise the grammar point {grammar}.\n"
        grammar_used_rule = (
            f"true if the attempt uses {grammar}, false if it expresses the idea another way. "
            f"When false, add ONE \"fix\" item showing how their sentence would read with {grammar} "
            f"-- as the point of the exercise, not as an error -- even if the verdict is \"correct\"."
        )
    else:
        grammar_note = ""
        grammar_used_rule = "always null: no grammar point was named for this sentence."
    prompt = ANALYSIS_PROMPT_TEMPLATE.format(
        lang_name=lang_name,
        translation_prompt=payload.translation_prompt,
        target_phrase=payload.target_phrase,
        target_romaji=payload.target_romaji,
        user_answer=payload.user_answer,
        grammar_note=grammar_note,
        grammar_used_rule=grammar_used_rule,
        max_items=_MAX_ITEMS,
    )

    # reading._chat already handles the multi-model fallback chain and
    # raises HTTPException(503, ...) if every provider fails -- nothing
    # to add here.
    content = reading._chat([
        {"role": "system", "content": prompt},
        {"role": "user", "content": "Review my translation attempt."},
    ])
    review = _parse_review(content)
    if review is None:
        # Not the shape. The prose is still a review, so it is served as
        # one rather than costing the learner a second call; the screen
        # prints `analysis` when `review` is missing.
        logger.warning("translation review was not the shape; served as prose")
        cleaned = re.sub(r"^```(?:\w+)?|```$", "", content.strip(), flags=re.MULTILINE).strip()
        return {"review": None, "analysis": cleaned}
    return {"review": review, "analysis": _review_as_text(review)}


# ── Scheduling ───────────────────────────────────────────────────────
#
# A translation exercise has no card of its own -- the sentence bank is
# curated content, not a deck -- but every sentence is CHOSEN to practise
# one vocabulary word, and carries it as `source_word`. So the thing being
# scheduled is that word, and translating its sentence is evidence about
# it.
#
# The mode key is its own: card_modes is keyed (card_id, mode), so this
# writes a schedule that sits BESIDE vocab's own flashcard/reading modes
# rather than overwriting them. A translation session must not silently
# advance the intervals a vocab session owns.
#
# `sentence.` rather than a bare `translation`, following the
# <source>.<base> shape study/modes.py sets out. The source really is
# the curated sentence bank and not a deck, and the namespace keeps the
# key from being read as a sibling of `vocab.word_reading` or
# `kanji.readings` by anyone auditing card_modes later. It is NOT in the
# registry -- see below -- so nothing resolves it; the format is for the
# human reading the table.
#
# It is deliberately not registered in study/modes.py. card_index.locate()
# returns None for an unregistered mode and daily_queue skips such a row
# (see its `else: continue`), which is exactly right for now: 翻訳 runs
# its own session off the curated bank and has no renderer in Today. If
# translation should ever surface there, that is the change to make --
# registering the mode -- and it is a deliberate one, not a side effect.
SRS_MODE = "sentence.translation"


# ── Result logging (self-graded, same pattern as reading.py) ────────
class ResultPayload(BaseModel):
    source: str                # compact source label — see reading._source_label()
    level: str | None = None
    translation_prompt: str
    phrase: str
    romaji: str
    answer: str
    correct: bool
    # 0..5, worst to best, as RatingBar emits it. Optional so an older
    # client that still posts only `correct` keeps working; the bound is
    # enforced here rather than by a CHECK so a bad value is a 422 the
    # caller can read, not a 500 from the driver.
    quality: int | None = Field(default=None, ge=0, le=5)
    # The sentence's source word, straight from the batch payload, so the
    # rating can reach that word's schedule. Optional: an older client
    # does not send it, and an uncurated sentence has none.
    source_word: dict | None = None


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
                    (user_id, level, phase, translation_prompt, phrase, romaji,
                     answer, correct, quality)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    user_id, level_for_log, payload.source, payload.translation_prompt,
                    payload.phrase, payload.romaji, payload.answer, payload.correct,
                    payload.quality,
                ),
            )
        conn.commit()
    finally:
        conn.close()

    # Scheduling happens after the log is committed, and never instead
    # of it: a rating is a fact about what the learner did, and it must
    # survive even if the word cannot be resolved to a card.
    scheduled = None
    if payload.quality is not None:
        card_id = vocab_card_id_for_word(payload.source_word, user_id)
        if card_id:
            state = srs.review(card_id, SRS_MODE, payload.quality)
            scheduled = {
                "card_id": card_id,
                "mode": SRS_MODE,
                "interval_days": state["interval_days"],
                "next_review": state["next_review"],
                "stage": state["stage"],
                "xp_earned": state.get("xp_earned"),
                "leveled_up": state.get("leveled_up"),
                "new_level": state.get("new_level"),
            }

    # The fare. A rating that scheduled a card was paid by that review;
    # one that scheduled nothing -- no card behind the sentence, or an
    # older client sending no quality -- is paid here at the practice
    # rate (srs.award_practice), so the run's level bar moves either
    # way. Top-level on purpose: every run reads the same three keys.
    if scheduled:
        fare = {k: scheduled[k] for k in ("xp_earned", "leveled_up", "new_level")}
    else:
        quality = payload.quality if payload.quality is not None else (4 if payload.correct else 1)
        fare = srs.award_practice(user_id, "translation", payload.source, [quality])

    return {
        **fare,
        "correct": payload.correct,
        "quality": payload.quality,
        # None when the rating scheduled nothing -- no quality given, or
        # the sentence's word is not in the vocabulary list.
        "scheduled": scheduled,
    }


@router.get("/api/translation/history")
def get_translation_history(user_id: str = Depends(get_user_id), limit: int = Query(50, ge=1, le=200)):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT level, phase, translation_prompt, phrase, romaji, answer,
                       correct, quality, created_at
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
            "quality": quality,
            "created_at": created_at.isoformat(),
        }
        for level, phase, translation_prompt, phrase, romaji, answer, correct, quality, created_at
        in rows
    ]
