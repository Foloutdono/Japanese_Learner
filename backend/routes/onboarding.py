# ── みどりの窓口 — the onboarding endpoints ──────────────────────
# Four routes, all synchronous, none touching the exam pipeline:
#
#   POST /api/onboarding/placement        a fresh 12-question paper
#   POST /api/onboarding/placement/score  grade it, recommend a level
#   POST /api/onboarding/complete         stamp level + pace + onboarded_at
#                                         (+ the boarding's own answers,
#                                         plan 075: motive, kana, rhythm,
#                                         the hour and the nudge)
#   GET  /api/onboarding/volumes          per-level item counts (projection)
#
# The placement round trip is stateless by design: the paper is a pure
# function of the seed (study/placement.py), so scoring regenerates it
# rather than storing it. See placement.py's header for why this is not
# a 21st EXAM_GENERATORS entry.
import random
import re
from datetime import date

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator, model_validator

from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL
from content.kana_data import get_all_kana
from content.kanji_data import KANJI_BY_LEVEL
from content.vocab_data import VOCAB_BY_LEVEL
from core.auth import get_user_id
from core.db import db_conn
from core.user_level import GOAL_LEVELS, LEVELS, NOVICE_GOAL, note_stored_level
from routes.profile import apply_kana_rule, apply_level_rule, ensure_profile_row
from study.exam_scoring import flatten_questions, score_attempt
from study.level_rule import KANA_KNOWN
from study.placement import build_placement_paper, recommend_level, strip_answers

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
    }


@router.get("/api/onboarding/volumes")
def get_volumes(user_id: str = Depends(get_user_id)):
    return VOLUMES
