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

KANA_MODES  = ["qcm", "flashcard", "write"]
VOCAB_PHASE_KEYS = ["qcm-kj-m", "qcm-m-kj", "flashcard-kj-m", "flashcard-m-kj"]
# Kanji has a 5th mode (drawing) that vocab doesn't have.
KANJI_PHASE_KEYS = VOCAB_PHASE_KEYS + ["write"]

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


def _build_reverse_index():
    """
    Computed once at import time (the content universe is static).

    Returns:
        index:  (raw_id, mode) -> (category, key)
        totals: (category, key) -> total number of items
    """
    index = {}
    totals = {}

    for category, ids_map, modes in (
        ("kana", KANA_IDS, KANA_MODES),
        ("vocab", VOCAB_IDS, VOCAB_PHASE_KEYS),
        ("kanji", KANJI_IDS, KANJI_PHASE_KEYS),
    ):
        for key, ids in ids_map.items():
            totals[(category, key)] = len(ids)
            for raw_id in ids:
                for mode in modes:
                    index[(raw_id, mode)] = (category, key)

    return index, totals


_ID_MODE_INDEX, _CATEGORY_TOTALS = _build_reverse_index()


def _empty_bucket(total: int) -> dict:
    # Everything starts as "new" until the cache proves otherwise.
    return {
        "total": total,
        "new": total,
        "learning": 0,
        "mastered": 0,
        "due_now": 0,
        "reviews": 0,   # sum of total_reviews across cards in this bucket
        "correct": 0,   # sum of correct_reviews across cards in this bucket
    }


@router.get("/api/stats")
def get_stats(user_id: str = Depends(get_user_id)):

    logger.info("Computing stats for user_id=%s", user_id)

    cache = srs.get_user_states(user_id)

    kana_stats = {
        set_name: {mode: _empty_bucket(len(ids)) for mode in KANA_MODES}
        for set_name, ids in KANA_IDS.items()
    }

    vocab_stats = {
        level: {mode: _empty_bucket(len(ids)) for mode in VOCAB_PHASE_KEYS}
        for level, ids in VOCAB_IDS.items()
    }

    kanji_stats = {
        level: {mode: _empty_bucket(len(ids)) for mode in KANJI_PHASE_KEYS}
        for level, ids in KANJI_IDS.items()
    }

    buckets = {"kana": kana_stats, "vocab": vocab_stats, "kanji": kanji_stats}
    prefix_len = len(user_id) + 1  # strip "user_id:" from the stored card_id

    # Only iterate over what the user has actually touched, not the whole
    # content universe. Counts default to "new"/total above and get
    # adjusted here.
    for (full_card_id, mode), item in cache.items():

        raw_id = full_card_id[prefix_len:]
        loc = _ID_MODE_INDEX.get((raw_id, mode))

        if loc is None:
            # Stale or unknown id (e.g. content removed since reviewed).
            continue

        category, key = loc
        bucket = buckets[category][key][mode]

        state = item["state"]
        if state != "new":
            bucket["new"] -= 1
            bucket[state] += 1

        if item["due"]:
            bucket["due_now"] += 1

        bucket["reviews"] += item["total_reviews"]
        bucket["correct"] += item["correct_reviews"]

    return {
        "kana": kana_stats,
        "vocab": vocab_stats,
        "kanji": kanji_stats,
    }


@router.get("/api/stats/extra")
def get_extra_stats(user_id: str = Depends(get_user_id)):
    """
    Supplementary stats that don't fit the per-category/mode shape of /api/stats:
    streak, recent activity trend, upcoming due forecast, and weakest cards.
    """
    logger.info("Computing extra stats for user_id=%s", user_id)

    streak = srs.get_streak(user_id)
    trend = srs.get_daily_review_counts(user_id, days=30)
    forecast = srs.get_due_forecast(user_id, days=7)
    weakest_raw = srs.get_weakest_cards(user_id, limit=10)

    prefix_len = len(user_id) + 1
    weakest = []
    for entry in weakest_raw:
        raw_id = entry["card_id"][prefix_len:]
        loc = _ID_MODE_INDEX.get((raw_id, entry["mode"]))
        category, key = loc if loc else (None, None)
        weakest.append({
            **entry,
            "raw_id": raw_id,
            "category": category,
            "key": key,
        })

    return {
        "streak": streak,
        "trend": trend,
        "forecast": forecast,
        "weakest": weakest,
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