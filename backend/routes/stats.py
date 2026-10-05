import logging
from fastapi import APIRouter, Depends
from core.db import db_conn
from core.auth import get_user_id, prefixed
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


def _item_stats(best: dict[str, float], total: int) -> dict:
    """One deck's cards, counted once each (plan 184).

    `best` is {raw_id: progress of the mode that card has come furthest
    in}, progress being srs.py's _progress -- 0.0 new, 1.0 mastered, the
    learning steps the first half and the interval the second, the same
    figure the card's own bar draws. Cards never reviewed are simply
    absent. `total` is every card the deck holds, so a deck nobody has
    opened scores 0 rather than dividing by nothing.

    Three figures, because a deck is three questions:

      started  how many of its cards you have met at all
      learned  how many cards the deck's progress adds up to, whole
      score    the same sum over the deck, 0..1

    `learned` and `score` are ONE sum read twice, so the figure a stop
    prints, the bar beside it and the train on the map cannot disagree.
    Every card counts for how far it has come. It used to count only
    once its interval reached 21 days, so a week of daily work printed
    0 / 665 and nothing on screen answered it; now the figure moves
    with each review and is shown whole (srs.whole_cards: 11.5 reads
    11). A card is worth 1 only when mastered, so `learned` reaches
    `total` exactly when the deck is finished.

    `started` is the count of cards MET, free -- `best` holds exactly
    the cards with a review behind them -- and is what a bar draws in
    half its pigment beyond `learned`: the cards met but not yet
    credited in full.
    """
    return {
        "total": total,
        "started": len(best),
        "learned": srs.whole_cards(best.values()),
        "score": round(sum(best.values()) / total, 4) if total else 0.0,
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
    # So each card is counted once, by its BEST mode (plan 184):
    #
    #   progress = how far that mode has come, 0.0 new to 1.0 mastered --
    #              the card's own bar (srs._progress, plan 147), so the
    #              learning steps climb the first half and the interval
    #              the second
    #   started  = it has been reviewed at all, in any mode
    #
    # and a deck's `learned` and `score` are the sum of its cards'
    # progress, whole and over the deck. Continuous on purpose, and with
    # no second curve of its own: the buckets' three states put every
    # card at 0, a flat half, or 1, and a count of mastered cards read 0
    # for the first three weeks of a deck, so neither answered the work.
    best_card: dict[tuple[str, str], dict[str, float]] = {
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
        # one kanji at its reading's progress. A card met and not yet
        # advanced is kept at 0.0: started, worth nothing yet.
        if item["total_reviews"] > 0:
            seen = best_card[(source, deck_key)]
            seen[raw_id] = max(item["progress"], seen.get(raw_id, 0.0))

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


# ── The service record (plan 085) ─────────────────────────
# The statistics screen asks one question the profile and the gate do
# not: is the learning holding, and where is it leaking? Four answers,
# every one of them already recorded:
#
#   days      reviews and good-or-better ratings per day, twelve weeks —
#             the retention line is a fold over these on the client
#   strength  how far ahead the scheduler has pushed each card
#   weakest   each line's most-missed cards, lapses first (plan 138)
#
# The screen's per-line retention, and its grid of exercise by level,
# come from /api/stats itself, which it fetches anyway. What retired
# with /api/stats/extra: the streak (the stamp book), the trend (same),
# the forecast (the fare gate) and the hour-of-day histogram (never
# drawn).
REPORT_DAYS = 84

# Per line, since plan 138 draws a plate per line with its own weakest
# cards: two rows of four tiles on the desk's plate. The query asks for
# twice that so a card no deck holds any more (content removed since it
# was reviewed) cannot leave a line short.
WEAKEST_PER_LINE = 8


@router.get("/api/stats/report")
def get_report(user_id: str = Depends(get_user_id)):
    logger.info("Computing stats report for user_id=%s", user_id)

    # Lapses first, then accuracy, within each line: a card that keeps
    # falling out of the schedule is a leak whatever its lifetime ratio
    # says, and a card missed once in two tries is a coin, not a
    # weakness.
    ranked = srs.get_weakest_by_source(user_id, per_source=WEAKEST_PER_LINE * 2)

    prefix_len = len(user_id) + 1
    by_line: dict[str, list[dict]] = {source: [] for source in SECTIONS}
    for entry in ranked:
        raw_id = entry["card_id"][prefix_len:]
        loc = card_index.locate(raw_id, entry["mode"])
        if loc is None:
            # A card no deck holds: it belongs to no line's plate, and
            # there is no run it could open.
            continue
        category, key = loc
        line = by_line.get(category)
        if line is None or len(line) >= WEAKEST_PER_LINE:
            continue
        line.append({**entry, "raw_id": raw_id, "category": category, "key": key})

    # One list, the lines in the screen's order (SECTIONS), each line's
    # cards in their rank; the client groups by `category`.
    weakest = [entry for source in SECTIONS for entry in by_line[source]]

    return {
        "days": srs.get_daily_quality(user_id, days=REPORT_DAYS),
        "strength": srs.get_interval_histogram(user_id),
        "weakest": weakest,
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
      the old version left XP, level, streak and leaderboard standing
      fully intact while reporting {"ok": true} -- a "reset" that reset
      the schedule and nothing a learner would look at.

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
            # ...and its rolled-up half (plan 078), for the same reason
            # review_log is here at all: clearing only the rows would
            # report {"ok": true} while leaving the compacted XP, the
            # streak days and the first-sighting dates standing.
            cur.execute("DELETE FROM review_daily WHERE user_id = %s", (user_id,))
            cur.execute("DELETE FROM card_first_review WHERE card_id LIKE %s", (prefix,))
            cur.execute("DELETE FROM review_compaction WHERE user_id = %s", (user_id,))
            cur.execute("DELETE FROM xp_ledger WHERE user_id = %s", (user_id,))
            # credit_ledger stays: the balance is not progress (plan 069),
            # and a learner starting over keeps the credits they have.
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    srs.delete_cards(keys_to_delete)
    return {"ok": True}