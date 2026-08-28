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

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field, field_validator

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


class CompletePayload(BaseModel):
    jlptLevel: str
    dailyNewTarget: int

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
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            # COALESCE keeps the first completion timestamp: replaying
            # the flow (or a double-tap on the finale button) updates
            # the choices without pretending the user onboarded twice.
            cur.execute(
                """
                UPDATE user_profiles
                SET jlpt_level = %s,
                    daily_new_target = %s,
                    onboarded_at = COALESCE(onboarded_at, NOW())
                WHERE user_id = %s
                RETURNING onboarded_at
                """,
                (payload.jlptLevel, payload.dailyNewTarget, user_id),
            )
            onboarded_at = cur.fetchone()[0]
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
    }


@router.get("/api/onboarding/volumes")
def get_volumes(user_id: str = Depends(get_user_id)):
    return VOLUMES
