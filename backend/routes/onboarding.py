# ── みどりの窓口 — the onboarding endpoints ──────────────────────
# Four routes, all synchronous, none touching the exam pipeline:
#
#   POST /api/onboarding/placement        a fresh 12-question paper
#   POST /api/onboarding/placement/score  grade it, recommend a level
#   POST /api/onboarding/complete         stamp level + pace + onboarded_at
#   GET  /api/onboarding/volumes          per-level item counts (projection)
#
# The placement round trip is stateless by design: the paper is a pure
# function of the seed (study/placement.py), so scoring regenerates it
# rather than storing it. See placement.py's header for why this is not
# a 21st EXAM_GENERATORS entry.
import random
from datetime import date

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator, model_validator

from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL
from content.kana_data import get_all_kana
from content.kanji_data import KANJI_BY_LEVEL
from content.vocab_data import VOCAB_BY_LEVEL
from core.auth import get_user_id
from core.db import db_conn
from core.user_level import LEVELS, note_stored_level
from routes.profile import ensure_profile_row
from study.exam_scoring import flatten_questions, score_attempt
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
        if v is not None and v not in LEVELS:
            raise ValueError(f"must be one of {', '.join(LEVELS)}")
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
        # "further down the line".
        if self.goalLevel is not None and LEVELS.index(self.goalLevel) <= LEVELS.index(self.jlptLevel):
            raise ValueError("goalLevel must be beyond jlptLevel")
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
                    daily_departure = %s
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
    return {
        "jlptLevel": payload.jlptLevel,
        "dailyNewTarget": payload.dailyNewTarget,
        "onboardedAt": onboarded_at.isoformat(),
        "goalLevel": payload.goalLevel,
        "goalTargetDate": payload.goalTargetDate.isoformat() if payload.goalTargetDate else None,
        "goalSetAt": goal_set_at.isoformat() if goal_set_at else None,
        "dailyDeparture": payload.dailyDeparture,
    }


@router.get("/api/onboarding/volumes")
def get_volumes(user_id: str = Depends(get_user_id)):
    return VOLUMES
