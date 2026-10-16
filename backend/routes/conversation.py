"""
会話 — the conversation platform's API (plan 217).

The learner is somewhere -- a konbini's till, a station's gate, a
client's office -- and someone there speaks to them. The scenarios are
the bank's (content/conversation, read by study/conversation.py), and
each is ridden three ways from the same turns:

    choose     pick the reply among three; graded by the pick
    translate  told what to say, write it in Japanese; measured, read by
               the tutor when the day allows, graded by the learner
    free       a model plays the other person and reads every line back;
               graded by the learner, line by line

    GET  /api/conversation/scenarios          the station's list, and the
                                              learner's record on each
    GET  /api/conversation/scenario/{id}      a run's script
    POST /api/conversation/check              translate: the measure --
                                              local, free, never capped
    POST /api/conversation/review             translate: the tutor's word,
                                              capped by the day
    POST /api/conversation/talk               free: the other person's
                                              next line and the tutor's
                                              word, capped by the day
    POST /api/conversation/result             one graded turn: the log and
                                              the fare

The split is composition's (ADR 0013): what is measured, what the tutor
says and what the learner grades are three opinions, kept apart. The
tutor is the one that can be missing -- past the day's ceiling (429),
with no provider, on an outage -- and choose and translate never wait on
it. Free talk is the tutor, so a spent day closes it and nothing else.

Nothing the learner typed is kept: the log is which turn of which
scenario, how it was ridden and how it went, never the words. The
history a free talk carries is the learner's screen's, sent back with
each line and fenced in the prompt, and gone when the request is.
"""
import logging
import os
import random
import re
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import BaseModel, Field

import routes.reading as reading  # _chat (LLMUnavailable -> 503), LANG_NAMES and known_lang, as composition does
from core import daily_limit
from core.auth import get_user_id
from core.credits import require_pass, resets_at
from core.db import db_conn
from core.srs_instance import srs
from study import conversation, tutor_review
from study.llm_shared import llm_configured
from study.romaji import is_romaji, kana_of

# A pass feature, like every practice platform (plan 069): a free learner
# is refused with 402 pass_required once CREDITS_ENFORCE=1, a no-op until
# then. frontend/src/domain/paywall.js's PASS_PLATFORMS names it
# (tests/test_pass_platforms.py).
router = APIRouter(dependencies=[Depends(require_pass)])
logger = logging.getLogger(__name__)

# The tutor's reviews of a translated reply a learner may buy in a day,
# and the lines of free talk -- each line one model call, the other
# person's answer and the review in one. Counted per learner on their
# own day (core/daily_limit). See .env.example for what they protect.
REVIEW_FEATURE = "conversation_review"
TALK_FEATURE = "conversation_talk"
CONVERSATION_REVIEW_DAILY_LIMIT = int(os.environ.get("CONVERSATION_REVIEW_DAILY_LIMIT", "60"))
CONVERSATION_DAILY_LIMIT = int(os.environ.get("CONVERSATION_DAILY_LIMIT", "80"))

# A reply is a line, not a paragraph; the tutor is paid by the token.
MAX_ANSWER = 200
_SCENARIO_ID = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"


# ── Table setup ──────────────────────────────────────────────────────
#
# Self-migrating at import, the pattern routes/translation.py set for a
# mode's own table. Declared in srs/data_structure.sql too
# (tests/test_schema_declared.py), erased with the account
# (routes/account.py's PLAN), capped by scripts/prune_logs.py.
def _init_db() -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS conversation_log (
                    id         BIGSERIAL PRIMARY KEY,
                    user_id    TEXT NOT NULL,
                    level      TEXT NOT NULL DEFAULT '',
                    scenario   TEXT NOT NULL,
                    mode       TEXT NOT NULL,
                    turn       SMALLINT NOT NULL,
                    accuracy   SMALLINT,
                    verdict    TEXT,
                    correct    BOOLEAN NOT NULL,
                    quality    SMALLINT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_conversation_log_user
                ON conversation_log(user_id, created_at)
                """
            )
        conn.commit()
    finally:
        conn.close()


try:
    _init_db()
except Exception:  # pragma: no cover - a missing DB must not stop import
    logger.exception("conversation_log could not be initialised")


def _scenario(scenario_id: str) -> tuple[str, dict]:
    """(level, scenario) for an id, or a 404."""
    found = conversation.find(scenario_id)
    if found is None:
        raise HTTPException(status_code=404, detail=f"Unknown scenario: {scenario_id}")
    return found


def _turn(row: dict, turn: int) -> None:
    if not 0 <= turn < len(row["turns"]):
        raise HTTPException(status_code=400, detail=f"No turn {turn} in this scenario")


def _lang(lang: str) -> str:
    """The bank's language for a request's `lang` (reading.known_lang
    first, so a region tag is French and a stray value English)."""
    return conversation.bank_lang(reading.known_lang(lang))


# ── The station's list ────────────────────────────────────────────────
@router.get("/api/conversation/scenarios")
def get_scenarios(lang: str = Query("fr", max_length=16), user_id: str = Depends(get_user_id)):
    """Every scenario, level by level, and what the learner has done on
    each: the turns graded, the share right, when last. A scenario never
    ridden has no record (absent, not zero, /api/practice/record's
    rule). The record is a reading of the log; a database that cannot
    answer still lists the scenarios."""
    record: dict[str, dict] = {}
    try:
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT scenario, COUNT(*), COUNT(*) FILTER (WHERE correct), MAX(created_at)
                    FROM conversation_log
                    WHERE user_id = %s
                    GROUP BY scenario
                    """,
                    (user_id,),
                )
                for scenario_id, done, right, last in cur.fetchall():
                    record[scenario_id] = {"done": int(done), "right": int(right), "last": last.isoformat()}
        finally:
            conn.close()
    except Exception:
        logger.exception("conversation record could not be read")
    return {"scenarios": conversation.catalogue(_lang(lang)), "record": record}


# ── A run's script ────────────────────────────────────────────────────
@router.get("/api/conversation/scenario/{scenario_id}")
def get_scenario(
    scenario_id: str = Path(max_length=conversation.MAX_ID, pattern=_SCENARIO_ID),
    lang: str = Query("fr", max_length=16),
):
    """The scenario as a run draws it: the scene, then every turn -- the
    other person's line, the model reply with its alternatives (the
    reveal of translate), and the three choices of choose, dealt into a
    fresh order each time. Every line carries its furigana and its
    translation in the learner's language."""
    payload = conversation.scenario_payload(scenario_id, _lang(lang))
    if payload is None:
        raise HTTPException(status_code=404, detail=f"Unknown scenario: {scenario_id}")
    rng = random.Random()
    turns = []
    for turn in payload["turns"]:
        choices = list(turn["choices"])
        rng.shuffle(choices)
        turns.append({**turn, "choices": choices})
    return {**payload, "turns": turns}


# ── Translate: the measure ────────────────────────────────────────────
class CheckPayload(BaseModel):
    scenario: str = Field(min_length=1, max_length=conversation.MAX_ID)
    turn: int = Field(ge=0, le=conversation.MAX_TURNS)
    # Empty is an answer -- it measures nothing matched, not 400.
    answer: str = Field(default="", max_length=MAX_ANSWER)


@router.post("/api/conversation/check")
def check_reply(payload: CheckPayload, user_id: str = Depends(get_user_id)):
    """How much of the reply the learner wrote, against the model reply
    and its alternatives (study/conversation.measure): free, local,
    uncapped, and it writes nothing. `japanese` is the reply as kana
    when it was typed in romaji, else null."""
    _level, row = _scenario(payload.scenario)
    _turn(row, payload.turn)
    found = conversation.measure(payload.scenario, payload.turn, payload.answer.strip())
    return {**found, "japanese": kana_of(payload.answer.strip())}


# ── Translate: the tutor's word ───────────────────────────────────────
class ReviewPayload(BaseModel):
    scenario: str = Field(min_length=1, max_length=conversation.MAX_ID)
    turn: int = Field(ge=0, le=conversation.MAX_TURNS)
    answer: str = Field(min_length=1, max_length=MAX_ANSWER)
    lang: str = Field(default="en", max_length=16)


def _claim(user_id: str, feature: str, limit: int, what: str) -> None:
    """A slot of the day, claimed BEFORE the model is called: a failed
    call costs one, since a client retrying a failure is what the
    ceiling stops. Over it, a 429 saying when the allowance is back."""
    used = daily_limit.claim(user_id, feature, limit)
    if used > limit:
        raise HTTPException(
            status_code=429,
            detail=f"Daily limit of {limit} {what} reached; resets {resets_at(user_id):%Y-%m-%dT%H:%MZ}",
        )


def _written(answer: str, spelled: str) -> str | None:
    """The learner's line in Japanese: null when they wrote it in
    Japanese, else the tutor's spelling when it is Japanese with no
    letter of the romaji left in it, else its kana (composition's rule)."""
    if not is_romaji(answer):
        return None
    if spelled and not is_romaji(spelled) and not re.search(r"[A-Za-z]", spelled):
        return spelled
    return kana_of(answer)


def _reviewed(review: dict | None, answer: str) -> tuple[dict | None, str | None]:
    """The review as the screen draws it, the corrected line marked
    against what the learner wrote, and the line in Japanese."""
    if review is None:
        return None, kana_of(answer)
    japanese = _written(answer, review.pop("japanese", ""))
    if review["better"]:
        review.update(tutor_review.corrected(review["better"], japanese or answer))
    return review, japanese


@router.post("/api/conversation/review")
def post_review(payload: ReviewPayload, user_id: str = Depends(get_user_id)):
    """The tutor's review of a translated reply, in the shape the screen
    draws (study/tutor_review), or the prose it answered with instead.
    The order is composition's: the turn is resolved, then a slot of the
    day is claimed, then the model is called."""
    if not llm_configured():
        raise HTTPException(status_code=500, detail="No LLM provider is configured")
    answer = payload.answer.strip()
    if not answer:
        raise HTTPException(status_code=400, detail="answer is required")
    _level, row = _scenario(payload.scenario)
    _turn(row, payload.turn)

    _claim(user_id, REVIEW_FEATURE, CONVERSATION_REVIEW_DAILY_LIMIT, "conversation reviews")

    lang_name = reading.LANG_NAMES[reading.known_lang(payload.lang)]
    content = reading._chat(
        conversation.review_messages(payload.scenario, payload.turn, answer, lang_name),
        # The shape is small: composition's, served in 1000.
        max_tokens=1000,
        task="conversation-review",
        accept=tutor_review.acceptable_reply,
    )
    review = tutor_review.parse_review(content)
    if review is None:
        cleaned = tutor_review.usable_prose(content)
        if cleaned is None:
            logger.error("conversation review was neither the shape nor prose: %s", content[:300])
            raise HTTPException(status_code=503, detail="The tutor's reply could not be read")
        logger.warning("conversation review was not the shape; served as prose")
        return {"review": None, "analysis": cleaned, "japanese": kana_of(answer)}
    review, japanese = _reviewed(review, answer)
    return {"review": review, "analysis": tutor_review.review_as_text(review), "japanese": japanese}


# ── Free: the other person, and the tutor ─────────────────────────────
class TalkLine(BaseModel):
    who: Literal["them", "me"]
    jp: str = Field(min_length=1, max_length=conversation.MAX_TALK_LINE)


class TalkPayload(BaseModel):
    scenario: str = Field(min_length=1, max_length=conversation.MAX_ID)
    # The conversation so far as the learner's screen holds it, the
    # opener first: at most every line a talk can have before this one.
    lines: list[TalkLine] = Field(min_length=1, max_length=2 * conversation.MAX_TALK_TURNS)
    answer: str = Field(min_length=1, max_length=MAX_ANSWER)
    lang: str = Field(default="en", max_length=16)


@router.post("/api/conversation/talk")
def post_talk(payload: TalkPayload, user_id: str = Depends(get_user_id)):
    """One line of free talk: the other person's answer to what the
    learner actually wrote, and the tutor's review of the line. A talk
    is MAX_TALK_TURNS lines of the learner's at most; past that, and
    past the day's ceiling, it is over. Nothing is kept."""
    if not llm_configured():
        raise HTTPException(status_code=500, detail="No LLM provider is configured")
    answer = payload.answer.strip()
    if not answer:
        raise HTTPException(status_code=400, detail="answer is required")
    _scenario(payload.scenario)
    if sum(1 for line in payload.lines if line.who == "me") >= conversation.MAX_TALK_TURNS:
        raise HTTPException(status_code=400, detail="This conversation is over")

    _claim(user_id, TALK_FEATURE, CONVERSATION_DAILY_LIMIT, "conversation lines")

    lang_name = reading.LANG_NAMES[reading.known_lang(payload.lang)]
    history = [{"who": line.who, "jp": line.jp.strip()} for line in payload.lines]
    content = reading._chat(
        conversation.talk_messages(payload.scenario, history, answer, lang_name),
        # Two short lines and the review's shape.
        max_tokens=1200,
        task="conversation-talk",
        accept=conversation.acceptable_talk,
    )
    parsed = conversation.parse_talk(content)
    if parsed is None:
        logger.error("conversation talk had no line for the other person: %s", content[:300])
        raise HTTPException(status_code=503, detail="The other person's reply could not be read")
    reply, review = parsed
    review, japanese = _reviewed(review, answer)
    return {
        "reply": reply,
        "review": review,
        "analysis": tutor_review.review_as_text(review) if review else None,
        "japanese": japanese,
    }


# ── The grade ─────────────────────────────────────────────────────────
class ResultPayload(BaseModel):
    scenario: str = Field(min_length=1, max_length=conversation.MAX_ID)
    mode: Literal["choose", "translate", "free"]
    turn: int = Field(ge=0, le=max(conversation.MAX_TURNS, conversation.MAX_TALK_TURNS))
    # choose: whether the pick was the reply. translate and free: the
    # learner's own rating, 0..5 worst-to-best as RatingBar emits it.
    correct: bool | None = None
    quality: int | None = Field(default=None, ge=0, le=5)
    # The two other opinions as the learner saw them when they rated
    # (dictation's rule), or nothing where there was none.
    accuracy: int | None = Field(default=None, ge=0, le=100)
    verdict: Literal["correct", "acceptable", "partial", "incorrect"] | None = None


@router.post("/api/conversation/result")
def post_result(payload: ResultPayload, user_id: str = Depends(get_user_id)):
    """One row per graded turn, and its fare at the practice rate. The
    level is the bank's, read off the id rather than trusted from the
    client. A pick is paid as comprehension pays a question -- 4 right,
    1 wrong -- and a rating as every self-graded run pays it."""
    level, row = _scenario(payload.scenario)
    if payload.mode == "free":
        if payload.turn >= conversation.MAX_TALK_TURNS:
            raise HTTPException(status_code=400, detail="No such line in a talk")
    else:
        _turn(row, payload.turn)
    if payload.mode == "choose":
        if payload.correct is None:
            raise HTTPException(status_code=422, detail="A pick is graded by `correct`")
        quality = 4 if payload.correct else 1
    else:
        if payload.quality is None:
            raise HTTPException(status_code=422, detail="A reply is graded by `quality`")
        quality = payload.quality
    # q > 2 is a pass: the line RatingBar draws between playCorrect and
    # playWrong, and the one every practice log derives `correct` by.
    correct = quality > 2
    try:
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO conversation_log
                        (user_id, level, scenario, mode, turn, accuracy, verdict, correct, quality)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        user_id, level, payload.scenario, payload.mode, payload.turn,
                        payload.accuracy if payload.mode == "translate" else None,
                        payload.verdict if payload.mode != "choose" else None,
                        correct, quality,
                    ),
                )
            conn.commit()
        finally:
            conn.close()
    except Exception:
        # A history row is worth less than the run the learner is in.
        logger.exception("Could not log a conversation turn on %s", payload.scenario)

    fare: dict = {}
    try:
        fare = srs.award_practice(
            user_id, "conversation", f"{payload.scenario}:{payload.mode}:{payload.turn}", [quality],
        )
    except Exception:
        logger.exception("Could not award the fare for a conversation turn on %s", payload.scenario)
    return {"correct": correct, "quality": quality, **fare}
