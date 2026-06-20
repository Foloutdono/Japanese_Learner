import logging
from fastapi import APIRouter, Depends
from db import db_conn
from kana_data import KANA_SETS, kana_to_id
from vocab_data import VOCAB_BY_LEVEL, vocab_to_id
from kanji_data import KANJI_BY_LEVEL, kanji_to_id
from auth import get_user_id, prefixed
from srs_instance import srs

router = APIRouter()
logger = logging.getLogger(__name__)

KANA_MODES  = ["mcq", "type"]
PHASES_KEYS = ["kk-s", "k-k", "s-k"]

KANA_IDS = {
    set_name: [kana_to_id(k) for k in kana_list]
    for set_name, kana_list in KANA_SETS.items()
}

VOCAB_IDS = {
    level: [vocab_to_id(v, level) for v in vocab_list]
    for level, vocab_list in VOCAB_BY_LEVEL.items()
}

KANJI_IDS = {
    level: [kanji_to_id(k, level) for k in kanji_list]
    for level, kanji_list in KANJI_BY_LEVEL.items()
}


def compute_stats_from_cache(
    raw_ids: list[str],
    mode: str,
    user_id: str,
    cache: dict,
):
    total = len(raw_ids)

    new = 0
    learning = 0
    mastered = 0
    due_now = 0

    for raw_id in raw_ids:

        key = (f"{user_id}:{raw_id}", mode)

        item = cache.get(key)

        if item is None:
            new += 1
            continue

        state = item["state"]

        if state == "new":
            new += 1

        elif state == "learning":
            learning += 1

        elif state == "mastered":
            mastered += 1

        if item["due"]:
            due_now += 1

    return {
        "total": total,
        "new": new,
        "learning": learning,
        "mastered": mastered,
        "due_now": due_now,
    }


@router.get("/api/stats")
def get_stats(user_id: str = Depends(get_user_id)):

    logger.info("Computing stats for user_id=%s", user_id)

    cache = srs.get_user_states(user_id)

    kana_stats = {
        set_name: {
            mode: compute_stats_from_cache(
                ids,
                mode,
                user_id,
                cache,
            )
            for mode in KANA_MODES
        }
        for set_name, ids in KANA_IDS.items()
    }

    vocab_stats = {
        level: {
            mode: compute_stats_from_cache(
                ids,
                mode,
                user_id,
                cache,
            )
            for mode in PHASES_KEYS
        }
        for level, ids in VOCAB_IDS.items()
    }

    kanji_stats = {
        level: {
            mode: compute_stats_from_cache(
                ids,
                mode,
                user_id,
                cache,
            )
            for mode in PHASES_KEYS
        }
        for level, ids in KANJI_IDS.items()
    }

    return {
        "kana": kana_stats,
        "vocab": vocab_stats,
        "kanji": kanji_stats,
    }


@router.delete("/api/stats/reset")
def reset_stats(user_id: str = Depends(get_user_id), card_ids: list[str] | None = None):
    logger.info("Resetting stats for user_id=%s", user_id)
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