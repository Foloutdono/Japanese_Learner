from fastapi import APIRouter, Depends
from db import db_conn
from kana_data import KANA_SETS, kana_to_id
from vocab_data import VOCAB_BY_LEVEL, vocab_to_id
from kanji_data import KANJI_BY_LEVEL, kanji_to_id
from auth import get_user_id, prefixed
from srs_instance import srs

router = APIRouter()

KANA_MODES  = ["mcq", "type"]
PHASES_KEYS = ["kk-s", "k-k", "s-k"]


def compute_stats(raw_ids: list[str], mode: str, user_id: str) -> dict:
    card_ids = prefixed(raw_ids, user_id)
    states   = srs.get_bulk_stats(card_ids, mode)
    due_now  = sum(1 for cid in card_ids if cid in set(srs.get_due_cards(mode)))
    new      = sum(1 for s in states.values() if s == "new")
    mastered = sum(1 for s in states.values() if s == "mastered")
    learning = sum(1 for s in states.values() if s == "learning")
    return {
        "total":    len(card_ids),
        "new":      new,
        "learning": learning,
        "mastered": mastered,
        "due_now":  due_now,
    }


@router.get("/api/stats")
def get_stats(user_id: str = Depends(get_user_id)):
    kana_stats = {
        set_name: {
            mode: compute_stats([kana_to_id(k) for k in kana_list], mode, user_id)
            for mode in KANA_MODES
        }
        for set_name, kana_list in KANA_SETS.items()
    }
    vocab_stats = {
        level: {
            key: compute_stats([vocab_to_id(w, level) for w in vocab_list], key, user_id)
            for key in PHASES_KEYS
        }
        for level, vocab_list in VOCAB_BY_LEVEL.items()
    }
    kanji_stats = {
        level: {
            key: compute_stats([kanji_to_id(k, level) for k in kanji_list], key, user_id)
            for key in PHASES_KEYS
        }
        for level, kanji_list in KANJI_BY_LEVEL.items()
    }
    return {"kana": kana_stats, "vocab": vocab_stats, "kanji": kanji_stats}


@router.delete("/api/stats/reset")
def reset_stats(user_id: str = Depends(get_user_id), card_ids: list[str] | None = None):
    if card_ids is None:
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT DISTINCT card_id FROM card_modes WHERE card_id LIKE %s", (f"{user_id}:%",))
                keys_to_delete = [row[0] for row in cur.fetchall()]
        finally:
            conn.close()
        srs.delete_cards(keys_to_delete)
    else:
        prefixed_ids = prefixed(card_ids, user_id)
        srs.delete_cards(prefixed_ids)
    return {"ok": True}