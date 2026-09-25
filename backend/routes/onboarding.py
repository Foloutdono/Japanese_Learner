# ── みどりの窓口 — the onboarding endpoints ──────────────────────
# Four routes, all synchronous, none touching the exam pipeline:
#
#   POST /api/onboarding/placement        a fresh 12-question paper
#   POST /api/onboarding/placement/score  grade it, recommend a level
#   POST /api/onboarding/complete         stamp level + pace + onboarded_at
#                                         (+ the boarding's own answers,
#                                         plan 075: motive, kana, rhythm,
#                                         the hour and the nudge; and the
#                                         lines, core/lines.py)
#   GET  /api/onboarding/volumes          per-level item counts (projection)
#
# And the first ride (plan 097), the lesson after the boarding:
#
#   GET    /api/onboarding/ride           the two cards and the sentence
#   POST   /api/onboarding/ride/check     measure an answer to that sentence
#   POST   /api/onboarding/ride/done      stamp tutorial_at (finished or skipped)
#   DELETE /api/onboarding/ride/done      clear it (Settings' replay)
#   POST   /api/onboarding/guided/{gate}  note a gate's guide as seen
#   DELETE /api/onboarding/guided         forget them all (Settings' replay)
#
# The placement round trip is stateless by design: the paper is a pure
# function of the seed (study/placement.py), so scoring regenerates it
# rather than storing it. See placement.py's header for why this is not
# a 21st EXAM_GENERATORS entry.
import json
import random
import re
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator, model_validator

from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL
from content.kana_data import get_all_kana
from content.kanji_data import KANJI_BY_LEVEL
from content.reading_sentences import N5 as READING_N5
from content.vocab_data import VOCAB_BY_LEVEL, vocab_to_id
from core.auth import get_user_id
from core.db import db_conn
from core.lines import clean_lines
from core.user_level import GOAL_LEVELS, LEVELS, NOVICE_GOAL, note_stored_level, resolve_level
from routes.profile import _profile_row, apply_kana_rule, apply_level_rule, ensure_profile_row
from routes.reading import _display_seconds, phrase_to_romaji
from routes.vocab import _build_vocab_card
from srs.models import CardState
from srs.scheduler import Scheduler
from study.dictation import measure_forms
from study.exam_scoring import flatten_questions, score_attempt
from study.level_rule import KANA_KNOWN
from study.modes import resolve as resolve_mode
from study.placement import build_placement_paper, recommend_level, strip_answers
from study.romaji import sentence_romaji

router = APIRouter()

_SEED_BITS = 32

# ── Content volumes, for the projection ───────────────────────────
# ITEMS (words, characters, points, glyphs) — deliberately not
# (card, mode) pairs, which is what the SRS and the stats screen count.
# The projection promises "you will know N words", and multiplying by
# study modes would inflate that promise several-fold. Computed at
# import from the same content modules the decks serve, so the numbers
# can never drift from what the app actually teaches.
VOLUMES = {
    "vocab": {level: len(VOCAB_BY_LEVEL.get(level, [])) for level in LEVELS},
    "kanji": {level: len(KANJI_BY_LEVEL.get(level, [])) for level in LEVELS},
    "grammar": {level: len(GRAMMAR_POINTS_BY_LEVEL.get(level, [])) for level in LEVELS},
    "kana": len(get_all_kana()),
}


class ScorePayload(BaseModel):
    seed: int = Field(ge=0, lt=2 ** _SEED_BITS)
    # Partial submissions are legal — "stop here, this is too hard" is
    # the early exit, and unanswered questions simply score as wrong.
    answers: dict[str, str] = {}


DEPARTURES = ("am", "noon", "pm")

# The hour each daily ride is announced at -- the same three the
# frontend's departures.js prints. Settings › Destination moves the
# hour by bucket (routes/journey.py's reprint) and the reminder follows
# it, so the nudge and the pass never name different times.
DEPART_TIMES = {"am": "07:30", "noon": "12:30", "pm": "21:00"}

# Why the learner is here (the boarding's second question, plan 075).
# The plan screen's two promise lines are chosen from it client-side;
# stored so a later screen can say "for your trip" without asking twice.
MOTIVES = ("studies", "fun", "trip", "live", "friends", "other")

# A reminder hour is 'HH:MM' on the 24-hour clock, minutes included --
# the day track offers half hours, the column stores whatever a client
# sends within the day.
_REMINDER_RE = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d$")


class CompletePayload(BaseModel):
    jlptLevel: str
    dailyNewTarget: int
    # The journey contract (plan 063). All optional: no goalLevel means
    # "just ride" — a pace and nothing else — and replaying the office
    # without one CLEARS a previous goal, the same way jlptLevel and
    # dailyNewTarget are simply overwritten on replay.
    goalLevel: str | None = None
    goalTargetDate: date | None = None
    dailyDeparture: str | None = None
    # The boarding's own answers (plan 075). All optional and
    # backwards compatible: a client that sends only the five fields
    # above (Settings' retake, the old office) still completes. A
    # replay overwrites them like every other choice; kanaKnown marks
    # the scripts named known (study/level_rule.py's kana door) and,
    # being idempotent, costs nothing a second time.
    motive: str | None = None
    kanaKnown: str | None = None
    rhythmMin: int | None = None
    reminderTime: str | None = None
    notifications: bool = False
    tzOffsetMin: int | None = None
    # Which of vocab / kanji / grammar the learner wants to ride
    # (core/lines.py). Optional like the rest: a client that does not
    # ask leaves NULL, which reads as all three; a replay overwrites.
    lines: list[str] | None = None

    @field_validator("lines")
    @classmethod
    def valid_lines(cls, v: list[str] | None) -> list[str] | None:
        return clean_lines(v)

    @field_validator("motive")
    @classmethod
    def valid_motive(cls, v: str | None) -> str | None:
        if v is not None and v not in MOTIVES:
            raise ValueError(f"must be one of {', '.join(MOTIVES)}")
        return v

    @field_validator("kanaKnown")
    @classmethod
    def valid_kana_known(cls, v: str | None) -> str | None:
        if v is not None and v not in KANA_KNOWN:
            raise ValueError(f"must be one of {', '.join(KANA_KNOWN)}")
        return v

    @field_validator("rhythmMin")
    @classmethod
    def valid_rhythm(cls, v: int | None) -> int | None:
        # The boarding offers 5/10/15/20 minutes; the bound keeps out
        # nonsense without freezing those four into the API.
        if v is not None and not (1 <= v <= 180):
            raise ValueError("must be between 1 and 180")
        return v

    @field_validator("reminderTime")
    @classmethod
    def valid_reminder(cls, v: str | None) -> str | None:
        if v is not None and not _REMINDER_RE.match(v):
            raise ValueError("must be HH:MM on the 24-hour clock")
        return v

    @field_validator("tzOffsetMin")
    @classmethod
    def valid_tz(cls, v: int | None) -> int | None:
        # -14:00 .. +14:00 is the whole planet (same bound as the
        # profile PATCH's).
        if v is not None and not (-840 <= v <= 840):
            raise ValueError("must be between -840 and 840")
        return v

    @field_validator("jlptLevel")
    @classmethod
    def valid_level(cls, v: str) -> str:
        if v not in LEVELS:
            raise ValueError(f"must be one of {', '.join(LEVELS)}")
        return v

    @field_validator("dailyNewTarget")
    @classmethod
    def valid_target(cls, v: int) -> int:
        # The UI offers 5/10/20; the bound keeps out nonsense without
        # freezing those three numbers into the API.
        if not (1 <= v <= 100):
            raise ValueError("must be between 1 and 100")
        return v

    @field_validator("goalLevel")
    @classmethod
    def valid_goal_level(cls, v: str | None) -> str | None:
        # GOAL_LEVELS, not LEVELS: the novice's stop -- the kana -- is a
        # destination the office signs like any other, and the only one
        # that is not a JLPT level (core/user_level.py).
        if v is not None and v not in GOAL_LEVELS:
            raise ValueError(f"must be one of {', '.join(GOAL_LEVELS)}")
        return v

    @field_validator("goalTargetDate")
    @classmethod
    def valid_goal_date(cls, v: date | None) -> date | None:
        # Strictly future: the office refuses tickets it knows are
        # already expired. The board's own 運休 refusal handles the
        # merely-implausible; this only rejects the impossible.
        if v is not None and v <= date.today():
            raise ValueError("must be in the future")
        return v

    @field_validator("dailyDeparture")
    @classmethod
    def valid_departure(cls, v: str | None) -> str | None:
        # NULL is "flexible" — the client never sends a fourth string.
        if v is not None and v not in DEPARTURES:
            raise ValueError(f"must be one of {', '.join(DEPARTURES)} or null")
        return v

    @model_validator(mode="after")
    def goal_is_coherent(self):
        # LEVELS is journey-ordered (N5..N1), so index comparison is
        # "further down the line". The kana stop sits BEFORE the first
        # of them, so it is coherent for exactly one boarding level --
        # the first: nobody standing above N5 is still riding to the
        # syllabaries.
        if self.goalLevel == NOVICE_GOAL:
            if self.jlptLevel != LEVELS[0]:
                raise ValueError(f"the novice's stop is behind {self.jlptLevel}")
        # BEHIND is the refusal, and not "anything short of beyond":
        # the destination is the last level the ride COVERS (journey.py's
        # _journey_levels slices start..goal inclusive), so boarding at a
        # level and riding to it is the ordinary one-level ride rather
        # than a contradiction. It is also the novice's own case, and why
        # this stopped at "beyond" too soon: a learner who does not read
        # both scripts boards at N5 -- there is no stop below it -- and
        # N5 is then the destination they are likeliest to name. Stored,
        # that learner and an N5 one are the same row, so this rule
        # cannot tell them apart and must not try; refusing equality
        # refused the beginner's own goal with a 422 the boarding could
        # not get past at all (2026-09-09).
        elif self.goalLevel is not None and LEVELS.index(self.goalLevel) < LEVELS.index(self.jlptLevel):
            raise ValueError("goalLevel must not be behind jlptLevel")
        if self.goalTargetDate is not None and self.goalLevel is None:
            raise ValueError("goalTargetDate needs a goalLevel — a date with no destination is not a goal")
        return self


@router.post("/api/onboarding/placement")
def start_placement(user_id: str = Depends(get_user_id)):
    seed = random.randrange(2 ** _SEED_BITS)
    paper = build_placement_paper(seed)
    return {"seed": seed, "questions": strip_answers(flatten_questions(paper))}


@router.post("/api/onboarding/placement/score")
def score_placement(payload: ScorePayload, user_id: str = Depends(get_user_id)):
    paper = build_placement_paper(payload.seed)
    result = score_attempt(paper, payload.answers)
    return {
        "recommendedLevel": recommend_level(result["perSection"]),
        "correct": result["correct"],
        "total": result["total"],
        # score_attempt's perSection IS per-level here — the paper has
        # one section per level (see placement.py). `review` is
        # deliberately dropped: placement never reveals the answer key.
        "perLevel": result["perSection"],
    }


@router.post("/api/onboarding/complete")
def complete_onboarding(payload: CompletePayload, user_id: str = Depends(get_user_id)):
    ensure_profile_row(user_id)
    has_goal = payload.goalLevel is not None
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            # COALESCE keeps the first completion timestamp: replaying
            # the flow (or a double-tap on the finale button) updates
            # the choices without pretending the user onboarded twice.
            # The goal columns move as one block: a goal-less replay
            # clears all four, and goal_start_level is stamped with the
            # BOARDING level so the promised total never drifts when
            # jlpt_level later moves (plan 063).
            cur.execute(
                """
                UPDATE user_profiles
                SET jlpt_level = %s,
                    daily_new_target = %s,
                    onboarded_at = COALESCE(onboarded_at, NOW()),
                    goal_start_level = %s,
                    goal_level = %s,
                    goal_target_date = %s,
                    goal_set_at = CASE WHEN %s THEN NOW() END,
                    daily_departure = %s,
                    motive = %s,
                    kana_known = %s,
                    reminder_time = %s,
                    notifications = %s,
                    lines = %s,
                    tz_offset_min = COALESCE(%s, tz_offset_min)
                WHERE user_id = %s
                RETURNING onboarded_at, goal_set_at
                """,
                (
                    payload.jlptLevel,
                    payload.dailyNewTarget,
                    payload.jlptLevel if has_goal else None,
                    payload.goalLevel,
                    payload.goalTargetDate,
                    has_goal,
                    payload.dailyDeparture,
                    payload.motive,
                    payload.kanaKnown,
                    payload.reminderTime,
                    payload.notifications,
                    payload.lines,
                    payload.tzOffsetMin,
                    user_id,
                ),
            )
            onboarded_at, goal_set_at = cur.fetchone()
        conn.commit()
    finally:
        conn.close()
    # Write-through so this worker's resolver serves the new level
    # immediately rather than after its TTL (core/user_level.py).
    note_stored_level(user_id, payload.jlptLevel)
    # The level rule (plan 074): the stops behind the boarding level are
    # marked known. Seeding is idempotent, so a replay of the office
    # costs nothing a second time.
    level_rule_result = apply_level_rule(user_id, None, payload.jlptLevel)
    # The kana door (plan 075): the scripts the learner already reads
    # start known, the same way and with the same spread.
    kana_rule_result = apply_kana_rule(user_id, payload.kanaKnown)
    return {
        "jlptLevel": payload.jlptLevel,
        "dailyNewTarget": payload.dailyNewTarget,
        "onboardedAt": onboarded_at.isoformat(),
        "levelRule": level_rule_result,
        "kanaRule": kana_rule_result,
        "goalLevel": payload.goalLevel,
        "goalTargetDate": payload.goalTargetDate.isoformat() if payload.goalTargetDate else None,
        "goalSetAt": goal_set_at.isoformat() if goal_set_at else None,
        "dailyDeparture": payload.dailyDeparture,
        "motive": payload.motive,
        "kanaKnown": payload.kanaKnown,
        "rhythmMin": payload.rhythmMin,
        "reminderTime": payload.reminderTime,
        "notifications": payload.notifications,
        "lines": payload.lines,
    }


@router.get("/api/onboarding/volumes")
def get_volumes(user_id: str = Depends(get_user_id)):
    return VOLUMES


# ── 試乗 — the first ride (plan 097) ────────────────────────────────
# The lesson after the boarding: two flashcards on the real stage and
# one sentence on the reading stage, then the plate that says which
# platforms ride on the pass. Everything here is served from the same
# banks the real thing draws on -- the vocab deck, the curated N5
# sentences -- and nothing here is a review: no card is scheduled, no
# review_log row is written, no credit is spent. The first real card is
# the one behind the 改札. Per learner on the profile row, because a
# guest is a real user and the account they make later is the same row.

# The five gates a guide can be seen on -- config/tabs.js's TAB_IDS,
# spelled here so a browser cannot stamp a key of its own choosing.
GUIDE_GATES = ("today", "learn", "practice", "dictionary", "profile")

# The card the learner knows. Kana only, at N3 in the deck, and the one
# word nearly everyone arriving here has heard. The romaji is spelled
# rather than derived: study/romaji reads the final は as the particle
# it is not and prints "konnichiha", which is exactly wrong on the first
# card a learner with no kana is handed. Pinned by tests/test_ride.py.
RIDE_KNOWN = {"level": "N3", "kanji": "", "kana": "こんにちは", "romaji": "konnichiwa"}

# The card the learner cannot know: one stop above the stored level, a
# station word at each. The N1 learner has no stop above and is handed
# another N1 word. Every entry must exist in the deck at that level with
# that reading -- checked at import below, so a deck correction (plan
# 091) fails the deploy rather than serving a card with no entry behind
# it.
RIDE_UNKNOWN = {
    "N5": ("駅", "えき"),
    "N4": ("特急", "とっきゅう"),
    "N3": ("到着", "とうちゃく"),
    "N2": ("定期券", "ていきけん"),
    # Was 乗り換え, until plan 112 merged the N1 card into the N2 one
    # it duplicated.
    "N1": ("始発", "しはつ"),
}
RIDE_UNKNOWN_TOP = ("沿線", "えんせん")   # N1, for the learner already at N1

# The reading ride's sentence: fixed, the same for everyone, and drawn
# from the curated N5 bank rather than written here so it is held to
# the same checks (grammar point, kanji within level) as every sentence
# the reading platform serves.
RIDE_SENTENCE_JP = "駅で友だちに会います。"

RIDE_MODE = "vocab.flashcard.f2b"


def _deck_entry(level: str, kanji: str, kana: str) -> dict:
    for entry in VOCAB_BY_LEVEL.get(level, []):
        if entry.get("kanji", "") == kanji and entry.get("kana", "") == kana:
            return entry
    raise LookupError(f"the ride's {kanji or kana} is not in the {level} deck")


def _ride_sentence() -> dict:
    for entry in READING_N5:
        if entry["jp"] == RIDE_SENTENCE_JP:
            return entry
    raise LookupError("the ride's sentence is not in the N5 reading bank")


# Resolved once, at import: a ride that cannot be served is a deploy
# that must not go out, not a 500 on a learner's first screen.
_RIDE_KNOWN_ENTRY = _deck_entry(RIDE_KNOWN["level"], RIDE_KNOWN["kanji"], RIDE_KNOWN["kana"])
_RIDE_UNKNOWN_ENTRIES = {
    level: _deck_entry(level, kanji, kana) for level, (kanji, kana) in RIDE_UNKNOWN.items()
}
_RIDE_UNKNOWN_TOP_ENTRY = _deck_entry("N1", *RIDE_UNKNOWN_TOP)
_RIDE_SENTENCE = _ride_sentence()


def ride_unknown_level(stored: str, kana_known: str | None) -> str:
    """Which deck the unknown card comes from.

    One stop above the stored level, except for the novice -- stored at
    N5 (core/user_level.py) but short of it, told apart by the kana
    answer: a learner who does not yet read both scripts has N5 ahead of
    them, so N5 is the stop they cannot know. N1 has no stop above; the
    caller serves RIDE_UNKNOWN_TOP there.
    """
    if stored not in LEVELS:
        stored = "N5"
    if stored == "N5" and kana_known != "both":
        return "N5"
    index = LEVELS.index(stored)
    return LEVELS[min(index + 1, len(LEVELS) - 1)]


def _ride_unknown_entry(stored: str, kana_known: str | None) -> tuple[str, dict]:
    level = ride_unknown_level(stored, kana_known)
    if stored == "N1":
        return "N1", _RIDE_UNKNOWN_TOP_ENTRY
    return level, _RIDE_UNKNOWN_ENTRIES[level]


# The forecast a new card's verdicts would give it (plan 133): what the
# desk's card panel prints on each tile (components/study/CardPanel.jsx,
# plan 126), which the ride now stands on so its lesson is the run's
# real layout. `due_in` only: the ride earns no XP and moves no stage,
# so there is nothing else to preview. A fresh state is every learner's
# for a card never reviewed, so this reads nothing and writes nothing
# -- the scheduler alone, not the engine and its database.
_SCHEDULER = Scheduler()


def _ride_forecast(card_id: str, mode: str) -> dict:
    now = datetime.now(timezone.utc)
    forecast = {}
    for quality in range(6):
        after = _SCHEDULER.review(CardState(card_id=card_id, mode=mode), quality)
        forecast[str(quality)] = {"due_in": max(0, int((after.next_review - now).total_seconds()))}
    return forecast


def _ride_card(level: str, entry: dict, lang: str, romaji: str | None = None) -> dict:
    # The vocab batch's own assembly (routes/vocab.py), so the card is
    # the shape CardPrompt renders with no ride-specific branch: the
    # gloss in the learner's language, the furigana hint, the choices.
    # No stage -- the card was never studied and will not be: the ride
    # rates locally and posts nothing.
    m = resolve_mode(RIDE_MODE)
    card_id = vocab_to_id(entry, level)
    card = _build_vocab_card(card_id, entry, VOCAB_BY_LEVEL[level], m, lang, None)
    card["level"] = level
    card["review_preview"] = _ride_forecast(card_id, RIDE_MODE)
    # What the daily queue attaches to every card it serves
    # (routes/today.py): the frontend reads a card's structure off
    # `source`, and a section run knows its own. This screen is a queue
    # of two, so it says so the way the queue does.
    card["source"] = "vocab"
    # The reading in Latin letters, for the learner who answered "no
    # kana" at the boarding: the frontend rides it on the card the way
    # the furigana hint rides on a kanji.
    card["romaji"] = romaji or sentence_romaji(entry.get("kana") or entry.get("kanji") or "")
    return card


@router.get("/api/onboarding/ride")
def get_ride(lang: str = "fr", user_id: str = Depends(get_user_id)):
    row = _profile_row(user_id)
    kana_known = row[6]
    stored = resolve_level(user_id)
    unknown_level, unknown = _ride_unknown_entry(stored, kana_known)
    jp = _RIDE_SENTENCE["jp"]
    return {
        "cards": [
            _ride_card(RIDE_KNOWN["level"], _RIDE_KNOWN_ENTRY, lang, RIDE_KNOWN["romaji"]),
            _ride_card(unknown_level, unknown, lang),
        ],
        # The same shape the reading batch serves (routes/reading.py's
        # _finish_phrase), minus the source word the ride has none of.
        # The translation is English only, as every curated sentence's
        # is; the frontend labels it so.
        "sentence": {
            "phrase": jp,
            "romaji": phrase_to_romaji(jp),
            "translation": _RIDE_SENTENCE["en"],
            "translation_lang": "en",
            "display_seconds": _display_seconds(jp),
            "grammar": _RIDE_SENTENCE["grammar"],
        },
    }


class RideCheckPayload(BaseModel):
    # Empty is a legitimate answer -- the learner read none of it -- and
    # measures 0 rather than being rejected, as /api/reading/check does.
    answer: str = Field(default="", max_length=400)


@router.post("/api/onboarding/ride/check")
def check_ride(payload: RideCheckPayload, user_id: str = Depends(get_user_id)):
    """The reading ride's measure: the same one 読解 and 書取 show, from
    the same function, against the ride's own sentence and nothing else.
    The reading router's /check is pass-gated and takes the phrase from
    the client; this one is neither, which is why the sentence is not a
    parameter. Nothing is written."""
    return measure_forms(
        payload.answer, jp=_RIDE_SENTENCE["jp"], romaji=phrase_to_romaji(_RIDE_SENTENCE["jp"]),
    )


class RideDonePayload(BaseModel):
    skipped: bool = False


def _stamp(sql: str, params: tuple, user_id: str):
    ensure_profile_row(user_id)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, (*params, user_id))
            row = cur.fetchone()
        conn.commit()
    finally:
        conn.close()
    return row


@router.post("/api/onboarding/ride/done")
def finish_ride(payload: RideDonePayload, user_id: str = Depends(get_user_id)):
    # COALESCE keeps the first stamp, as /complete does: a replay from
    # Settings, or a double-tap, does not pretend the ride ended twice.
    # Skipped or finished is the same stamp -- a learner who skipped is
    # not asked again either -- and the difference is the trail's
    # (ride_done's `skipped`, core/events.py).
    (tutorial_at,) = _stamp(
        """
        UPDATE user_profiles
        SET tutorial_at = COALESCE(tutorial_at, NOW())
        WHERE user_id = %s
        RETURNING tutorial_at
        """,
        (), user_id,
    )
    return {"tutorialAt": tutorial_at.isoformat(), "skipped": payload.skipped}


@router.delete("/api/onboarding/ride/done")
def reset_ride(user_id: str = Depends(get_user_id)):
    """Settings' "take the test ride again": the index route shows the
    ride once more on the next launch. Clears the stamp only -- the ride
    wrote nothing else."""
    _stamp(
        "UPDATE user_profiles SET tutorial_at = NULL WHERE user_id = %s RETURNING user_id",
        (), user_id,
    )
    return {"tutorialAt": None}


@router.post("/api/onboarding/guided/{gate}")
def mark_guided(gate: str, user_id: str = Depends(get_user_id)):
    if gate not in GUIDE_GATES:
        raise HTTPException(status_code=422, detail="unknown gate")
    # The first time wins, like every stamp here: a guide replayed from
    # Settings clears the map first (DELETE below), so a second POST on
    # a gate already in it is a double-tap and changes nothing.
    now = datetime.now(timezone.utc).isoformat()
    (guided,) = _stamp(
        """
        UPDATE user_profiles
        SET guided = CASE WHEN guided ? %s THEN guided ELSE guided || %s::jsonb END
        WHERE user_id = %s
        RETURNING guided
        """,
        (gate, json.dumps({gate: now})), user_id,
    )
    return {"guided": guided}


@router.delete("/api/onboarding/guided")
def reset_guided(user_id: str = Depends(get_user_id)):
    """Settings' "show the guide again": every gate's guide plays on its
    next opening."""
    _stamp(
        "UPDATE user_profiles SET guided = '{}'::jsonb WHERE user_id = %s RETURNING user_id",
        (), user_id,
    )
    return {"guided": {}}
