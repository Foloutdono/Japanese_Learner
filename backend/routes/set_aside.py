"""
回送 -- the cards a learner set aside (plan 328).

Not every word in a deck is one a learner wants: テープレコーダー is a
tape recorder, and somebody born after the cassette has no use for it.
A card set aside is served in no mode -- not on Today, not in its
section, not as a new card -- and counted in nothing owed, until the
learner takes it back from Réglages › Set aside. The engine does the
excluding (srs._not_set_aside), so every queue and every count agrees
without knowing this module exists.

Its schedule and its history are left as they stood: setting a card
aside is not an answer, so no figure summed over review_log moves, and
a card taken back resumes where it was.

    POST /api/cards/set-aside       {cardId}   set one card aside
    POST /api/cards/take-back       {cardId}   serve it again
    GET  /api/cards/set-aside?lang=            the list, each card named

A card is any the learner could be served: a deck card, a JMdict pool
word, or a hand-written card on their shelf. Anything else is refused,
so the table holds only ids that mean something.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from core.auth import CARD_ID_MAX, get_user_id
from core.srs_instance import srs
from content.grammar_points_data import gloss as grammar_gloss
from content.jmdict_fr import pool_meaning
from content.vocab_jmdict_data import POOL_ID_PREFIX, entry_for_raw_id
from study import card_index
from study.card_extras import lang_of
from study.modes import GRAMMAR, KANA, KANJI, VOCAB
from routes.decks import structure_for
from routes.today import _personal_rows, _settled_word, _short_gloss

router = APIRouter()
logger = logging.getLogger(__name__)

_SECTIONS = (KANA, KANJI, VOCAB, GRAMMAR)


class CardRef(BaseModel):
    cardId: str = Field(..., min_length=1, max_length=CARD_ID_MAX)


def _source_of(raw_id: str) -> str | None:
    """The deck a raw id names by its prefix: one of the four sections,
    'pool' or 'custom'."""
    if raw_id.startswith(POOL_ID_PREFIX):
        return "pool"
    head = raw_id.split("_", 1)[0]
    if head == "custom":
        return "custom"
    return head if head in _SECTIONS else None


def _personal(user_id: str, raw_ids) -> dict:
    """raw id -> its shelf row, for the hand-written cards among these."""
    wanted = [raw for raw in raw_ids if raw.startswith("custom_")]
    if not wanted:
        return {}
    return _personal_rows(user_id, [{"card_id": f"{user_id}:{raw}"} for raw in wanted])


def _exists(user_id: str, raw_id: str) -> bool:
    source = _source_of(raw_id)
    if source in _SECTIONS:
        return card_index.entry_for(source, raw_id) is not None
    if source == "pool":
        return entry_for_raw_id(raw_id) is not None
    if source == "custom":
        return raw_id in _personal(user_id, [raw_id])
    return False


def _describe(raw_id: str, lang: str, personal: dict) -> dict:
    """What a row of the list prints: the card's Japanese, its reading
    and its meaning where it has them. A card whose content is gone
    since keeps its row with its id, so it can still be taken back."""
    out = {"cardId": raw_id, "source": _source_of(raw_id) or "other", "jp": "", "reading": "", "meaning": ""}
    source = out["source"]
    if source in (VOCAB, KANJI):
        word = _settled_word(source, raw_id, lang)
        if word:
            out.update(jp=word["jp"], reading=word["reading"], meaning=word["meaning"])
    elif source == KANA:
        entry = card_index.entry_for(KANA, raw_id)
        if entry:
            out.update(jp=entry.get("kana", ""), reading=entry.get("romaji", ""))
    elif source == GRAMMAR:
        entry = card_index.entry_for(GRAMMAR, raw_id)
        if entry:
            out.update(jp=entry.get("pattern", ""), meaning=_short_gloss(grammar_gloss(entry, lang)))
    elif source == "pool":
        entry = entry_for_raw_id(raw_id)
        if entry:
            kanji, kana = entry.get("kanji") or "", entry.get("kana") or ""
            out.update(jp=kanji or kana, reading=kana if kanji else "",
                       meaning=_short_gloss(pool_meaning(entry, lang)))
    elif source == "custom":
        row = personal.get(raw_id)
        if row:
            spec = structure_for(row.get("structure", "standard"))
            fields = row.get("fields") or {}
            out.update(jp=str(fields.get(spec.front_key, "")), meaning=str(fields.get(spec.back_key, "")))
    return out


@router.post("/api/cards/set-aside")
def post_set_aside(payload: CardRef, user_id: str = Depends(get_user_id)):
    raw_id = payload.cardId
    if not _exists(user_id, raw_id):
        raise HTTPException(status_code=404, detail="card_unknown")
    if not srs.set_aside(user_id, raw_id):
        raise HTTPException(status_code=409, detail="set_aside_full")
    logger.info("card set aside user_id=%s card=%s", user_id, raw_id)
    return {"ok": True, "cardId": raw_id}


@router.post("/api/cards/take-back")
def post_take_back(payload: CardRef, user_id: str = Depends(get_user_id)):
    srs.take_back(user_id, payload.cardId)
    return {"ok": True, "cardId": payload.cardId}


@router.get("/api/cards/set-aside")
def get_set_aside(lang: str = Query("en", max_length=8), user_id: str = Depends(get_user_id)):
    lang = lang_of(lang)
    rows = srs.get_set_aside(user_id)
    personal = _personal(user_id, [raw for raw, _ in rows])
    return {
        "cards": [{**_describe(raw, lang, personal), "at": at.isoformat()} for raw, at in rows],
        "max": srs.SET_ASIDE_MAX,
    }
