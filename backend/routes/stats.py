import logging
from fastapi import APIRouter, Depends
from core.db import db_conn
from core.auth import get_user_id
from core.srs_instance import srs
from study import card_index
from study.modes import KANA, KANJI, VOCAB, GRAMMAR, GRADED_FOR_SOURCE

router = APIRouter()
logger = logging.getLogger(__name__)

# The four sections this screen reports on, in the order the frontend
# renders them. `source` is the registry's own name for the section
# (study/modes.py), which is also the key the response is shaped by, so
# there is no second vocabulary to keep in step.
SECTIONS = (KANA, VOCAB, KANJI, GRAMMAR)

# Modes per section, read off the registry rather than a local list.
# This is the whole reason the screen was blank: the local list said
# "qcm-kj-m" and every row in the database says "kanji.flashcard.f2b".
SECTION_MODES = {source: sorted(GRADED_FOR_SOURCE[source]) for source in SECTIONS}


# The day-count a card's interval has to reach to be "mastered" —
# srs.py's own _classify_stage threshold, named here because the item
# score below is a fraction OF it rather than a second, independent
# idea of what mastery means.
MASTERED_DAYS = 21

# What getting a card through its learning steps is worth, out of the
# whole journey to mastery.
#
# It has to be more than nothing. interval_days is 0 for the entire
# learning phase — it is written on graduation and not before — so
# scoring purely on the interval put a card reviewed four times, an
# hour from its next drill, at exactly the same 0 as a card never
# opened. Every line on the wall map then reads empty for a learner
# whose deck is mostly new, which is most learners most of the time.
#
# And it has to be much less than half. The rule this replaced counted
# any touched card as 0.5, so one pass over a deck — everything seen
# once, nothing retained — bought half the line and the rest crawled.
#
# A tenth: the four learning steps are a tenth of knowing a card, and
# holding it from one day out to twenty-one is the other nine. The
# split is a judgement, not a measurement; it is one number here so it
# can be argued with in one place.
LEARNING_SHARE = 0.1
LEARNING_STEPS = 4


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


def _row_score(item: dict) -> float:
    """How far one (card, mode) has come toward being known, 0..1.

    Two phases, because the card has two: climbing the learning steps,
    then holding a growing interval. They are continuous with each other
    — the last learning step scores just under a freshly graduated card
    — so the number only ever goes up as the card does.
    """
    if item["is_learning"]:
        step = min(item["learning_step"] or 0, LEARNING_STEPS - 1)
        return LEARNING_SHARE * (step + 1) / LEARNING_STEPS
    interval = item["interval_days"] or 0
    return LEARNING_SHARE + (1 - LEARNING_SHARE) * min(1.0, interval / MASTERED_DAYS)


def _item_stats(best: dict[str, tuple[float, int]], total: int) -> dict:
    """One deck's cards, counted once each.

    `best` is {raw_id: (score, interval) of the mode that card has come
    furthest in}; cards never reviewed are simply absent, and score
    zero. `total` is every card the deck holds, so a deck nobody has
    opened scores 0 rather than dividing by nothing.
    """
    learned = sum(1 for _, days in best.values() if days >= MASTERED_DAYS)
    scored = sum(score for score, _ in best.values())
    return {
        "total": total,
        "learned": learned,
        "score": round(scored / total, 4) if total else 0.0,
    }


@router.get("/api/stats")
def get_stats(user_id: str = Depends(get_user_id)):

    logger.info("Computing stats for user_id=%s", user_id)

    cache = srs.get_user_states(user_id)

    # Every (section, deck, mode) triple starts fully "new", sized by
    # what the mode can actually REACH -- card_index applies the same
    # eligibility filter the card pools do, so a mastery bar's
    # denominator is a number the learner can finish. Scoring
    # vocab.word_reading out of all 8,405 words when only 7,308 contain
    # a kanji made 100% unreachable by construction.
    buckets = {
        source: {
            deck_key: {
                mode: _empty_bucket(card_index.total(source, deck_key, mode))
                for mode in SECTION_MODES[source]
            }
            for deck_key in card_index.deck_keys(source)
        }
        for source in SECTIONS
    }

    # ── The same decks, counted in cards rather than in drills ──
    # The per-mode buckets above are the unit the stats screen's bars are
    # drawn in: vocab.word_reading has its own denominator because it is
    # its own exercise. The wall map and the profile ledger ask a
    # different question — how much of this deck do you actually know —
    # and there a kanji you can read but not write is ONE kanji, not two
    # fifths of one. Counting drills there made a line's denominator
    # (card x mode) a number that exists nowhere outside this table, and
    # capped every line at the modes the learner happens to practise.
    #
    # So each card is scored by its BEST mode and counted once:
    #
    #   score   = how far its best mode has come toward 21 days, with
    #             the learning steps carrying LEARNING_SHARE of that
    #   learned = that best mode's interval has reached 21 days
    #
    # Continuous on purpose. The buckets' three states put every card at
    # 0, a flat half, or 1, so one pass over a deck — every card reviewed
    # once, none of them retained — scored exactly 50% and then crawled.
    # A fraction of the way to the mastery threshold has no cliff and no
    # magic constant: it IS the definition of mastered, read early.
    best_card: dict[tuple[str, str], dict[str, tuple[float, int]]] = {
        (source, deck_key): {}
        for source in SECTIONS
        for deck_key in card_index.deck_keys(source)
    }

    prefix_len = len(user_id) + 1  # strip "user_id:" from the stored card_id

    # Only iterate over what the user has actually touched, not the whole
    # content universe. Counts default to "new"/total above and get
    # adjusted here.
    for (full_card_id, mode), item in cache.items():

        raw_id = full_card_id[prefix_len:]
        loc = card_index.locate(raw_id, mode)

        if loc is None:
            # A personal card (custom_...), or content removed since it
            # was reviewed. Personal cards are deliberately not folded
            # into a section's bars -- they are not part of that
            # section's deck, so counting them would make the
            # denominator lie in the other direction.
            continue

        source, deck_key = loc
        bucket = buckets[source][deck_key][mode]

        state = item["state"]
        if state != "new":
            bucket["new"] -= 1
            bucket[state] += 1

        if item["due"]:
            bucket["due_now"] += 1

        bucket["reviews"] += item["total_reviews"]
        bucket["correct"] += item["correct_reviews"]

        # A row with no reviews behind it is not progress on the card,
        # whatever interval it happens to carry. Scored per mode and
        # kept by the best one, so a kanji you can read but not write is
        # one kanji at its reading's score.
        if item["total_reviews"] > 0:
            seen = best_card[(source, deck_key)]
            scored = (_row_score(item), item["interval_days"] or 0)
            if scored > seen.get(raw_id, (-1.0, -1)):
                seen[raw_id] = scored

    items = {
        source: {
            deck_key: _item_stats(best_card[(source, deck_key)],
                                  card_index.item_total(source, deck_key))
            for deck_key in card_index.deck_keys(source)
        }
        for source in SECTIONS
    }

    # A sibling of the four sections rather than a field inside them:
    # the sections' own shape is deck -> mode -> counts, and a fifth key
    # beside the mode keys would be indistinguishable from a mode. Every
    # consumer reads the sections by name (see the frontend's CATEGORIES
    # and TRACKED_LINES), so nothing iterates the root and trips over it.
    return {**buckets, "items": items}


# A year of days plus a few, so the practice calendar always has 53
# whole weeks to draw and the leading week is never half-empty.
TREND_DAYS = 371
FORECAST_DAYS = 14


def _rhythm(user_id: str, tz_offset: int) -> dict | None:
    """When you study, how you rate yourself, and how far ahead the
    scheduler has pushed your cards.

    Guarded deliberately: these are the newest queries in the file and
    the least load-bearing thing on the screen. If one of them fails,
    the user should lose a chart — not their streak, forecast, weakest
    cards and every level bar along with it.
    """
    try:
        return {
            "hours": srs.get_review_hours(user_id, tz_offset),
            "quality": srs.get_quality_mix(user_id),
            "intervals": srs.get_interval_histogram(user_id),
        }
    except Exception:
        logger.exception("rhythm stats failed for user_id=%s", user_id)
        return None


@router.get("/api/stats/extra")
def get_extra_stats(tz_offset: int = 0, user_id: str = Depends(get_user_id)):
    """
    Supplementary stats that don't fit the per-category/mode shape of /api/stats:
    streak, activity trend, upcoming due forecast, weakest cards, and the
    rhythm aggregates (hour of day, rating mix, interval ladder).
    """
    logger.info("Computing extra stats for user_id=%s", user_id)

    streak = srs.get_streak(user_id)
    trend = srs.get_daily_review_counts(user_id, days=TREND_DAYS)
    forecast = srs.get_due_forecast(user_id, days=FORECAST_DAYS)
    weakest_raw = srs.get_weakest_cards(user_id, limit=12)

    prefix_len = len(user_id) + 1
    weakest = []
    for entry in weakest_raw:
        raw_id = entry["card_id"][prefix_len:]
        loc = card_index.locate(raw_id, entry["mode"])
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
        "rhythm": _rhythm(user_id, tz_offset),
    }


@router.delete("/api/stats/reset")
def reset_stats(user_id: str = Depends(get_user_id), card_ids: list[str] | None = None):
    """
    Reset this user's progress.

    Two different requests share this endpoint, and they mean different
    things about history:

    * card_ids GIVEN -- put those specific cards back to "new". Their
      review_log rows are LEFT ALONE deliberately: the learner earned that
      XP, and re-learning a card is not grounds for clawing it back.
    * card_ids OMITTED -- reset everything, and that has to include
      review_log. srs.delete_cards only touches card_modes and cards, so
      the old version left XP, level, streak, leaderboard standing and
      daruma progress fully intact while reporting {"ok": true} -- a
      "reset" that reset the schedule and nothing a learner would look at.
      streak_mends goes too, since a bought-back day outliving its reviews
      keeps a phantom "showed up" alive (see srs._studied_days).

    See scripts/wipe_srs.py for the same operation across every user.
    """
    logger.info("Resetting stats for user_id=%s scoped=%s", user_id, card_ids is not None)
    if card_ids is not None:
        srs.delete_cards(prefixed(card_ids, user_id))
        return {"ok": True}

    prefix = f"{user_id}:%"
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT DISTINCT card_id FROM card_modes WHERE card_id LIKE %s", (prefix,))
            keys_to_delete = [row[0] for row in cur.fetchall()]
            # Deleted first, and in one transaction with nothing else, so a
            # failure cannot leave the schedule cleared while the history
            # that explains it survives.
            cur.execute("DELETE FROM review_log WHERE card_id LIKE %s", (prefix,))
            cur.execute("DELETE FROM xp_ledger WHERE user_id = %s", (user_id,))
            cur.execute("DELETE FROM streak_mends WHERE user_id = %s", (user_id,))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    srs.delete_cards(keys_to_delete)
    return {"ok": True}