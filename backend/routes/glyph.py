# ── 初見 — the record of a glyph's first tour (plan 216) ─────────
# The tour itself rides on the kana or kanji card that is due one
# (study/glyph_tour.mark_glyph_tours); this is its terminus, which keeps
# the first tour and grades nothing. A failed post never holds the run:
# the client boards the card either way.
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from core.auth import get_user_id
from study import glyph_tour

router = APIRouter()


class GlyphTourPayload(BaseModel):
    raw_id: str = Field(min_length=1, max_length=40)
    # The traces that missed, over every stroke (a kanji has at most ~30).
    misses: int = Field(ge=0, le=999)
    # Whether the board drew the strokes for the learner (« Montre-moi »).
    shown: bool = False


@router.post("/api/glyph/tour")
def post_glyph_tour(payload: GlyphTourPayload, user_id: str = Depends(get_user_id)):
    """`recorded` is False when the learner had been toured through the
    character already: the first tour stands."""
    if not glyph_tour.known(payload.raw_id):
        raise HTTPException(status_code=404, detail=f"No tour for: {payload.raw_id}")
    return {"recorded": glyph_tour.record(user_id, payload.raw_id, payload.misses, payload.shown)}
