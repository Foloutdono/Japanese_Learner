"""
本日の運行 -- what this learner owes a review on right now, across every
section at once, and a single queue that serves it.

── Why this exists ───────────────────────────────────────────
The scheduler has always known what is due. Nothing collected it. A
learner had to pick a section, then a level, then a mode, and repeat
that for each of the four sections plus their own decks -- so the one
question a spaced-repetition system exists to answer, "what should I
study now", was the one question the app made the learner answer for
itself, twelve times over.

The parts were all present and unconnected: srs.get_due_cards could
answer per mode and per deck, /api/stats computed per-bucket due counts,
and the stats screen even rendered them as buttons. But those buttons
deep-link into a NORMAL session at that level and mode, which mixes the
due cards back in with new ones -- so tapping "17 due" did not give you
those 17 cards. And it all lived behind a reporting screen you visit
deliberately, which is the wrong place for the thing you open the app to
do.

── What a queue costs that a section session does not ────────
Two things have to be right that a single-section session gets for free:

1. THE MODE TRAVELS WITH THE CARD. A section session has one mode for
   its whole life, so the client can hold it in a variable. Here every
   card can be a different mode, and the review has to be posted back
   under the mode the card was SERVED in -- post it under the wrong one
   and the SRS advances a different row than the one the learner
   answered, permanently desynchronising the two. So `mode` is on the
   payload (it already was, for every source) and POST /api/today/review
   reads it from the client rather than from any session state.

2. NOTHING MAY BE SERVED THAT IS NOT ACTUALLY DUE. get_new_cards is
   deliberately absent from this file. A queue that quietly tops itself
   up with new material cannot end, and a queue that cannot end cannot
   say "you are done for today" -- which is the entire point. When the
   due set empties, this returns nothing and the client shows the next
   scheduled time from /api/today.
"""
import logging
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

import psycopg2.extras

from core.auth import get_user_id, prefixed, unprefixed
from core import credits
from core.db import db_conn
from core.pace import resolve_pace
from core.srs_instance import srs
from core.user_level import resolve_level
from study import card_index, daily_queue
from study.modes import KANA, KANJI, VOCAB, GRAMMAR, MODES, try_resolve

router = APIRouter()
logger = logging.getLogger(__name__)

MAX_BATCH = 25

# Section builders, imported rather than reimplemented -- a card in the
# daily queue must be indistinguishable from the same card met in its own
# section, or the queue becomes a second, subtly different app.
from routes.kana import _build_kana_card              # noqa: E402
from routes.kanji import _build_kanji_card            # noqa: E402
from routes.vocab import _build_vocab_card            # noqa: E402
from routes.grammar import _build_grammar_card        # noqa: E402
from routes.decks import build_personal_card, VISIBLE_DECKS_CTE   # noqa: E402


# One adapter per section, each closing over that builder's own argument
# order so _build_section_card can call all four the same way. The
# builders' own signatures stay untouched on purpose -- kana.py/kanji.py/
# vocab.py/grammar.py each call their own builder directly too, and none
# of them has a use for the params this table exists to route (a kana or
# grammar card doesn't take raw_id/lang at all; grammar's "level" arg is
# this queue's deck_key under another name). Only the daily queue needs
# to dispatch across sources, so only this table knows the mapping.
_SECTION_BUILDERS = {
    KANA:    lambda raw_id, entry, deck_key, deck_list, m, lang, stage, preview:
        _build_kana_card(entry, deck_list, m, stage, preview),
    KANJI:   lambda raw_id, entry, deck_key, deck_list, m, lang, stage, preview:
        _build_kanji_card(raw_id, entry, deck_list, m, lang, stage, preview),
    VOCAB:   lambda raw_id, entry, deck_key, deck_list, m, lang, stage, preview:
        _build_vocab_card(raw_id, entry, deck_list, m, lang, stage, preview),
    GRAMMAR: lambda raw_id, entry, deck_key, deck_list, m, lang, stage, preview:
        _build_grammar_card(entry, deck_key, deck_list, m, stage, preview),
}


# ── 運賃 — what a queued review costs (core/credits.py) ────────
# Since the kana line rides free, the length of a run and its fare are
# no longer the same number, and both of them have to be right: the
# gate prints the count AND prices it, and under enforcement the queue
# has to stop serving the paid cards while going on serving the free
# ones. Two callers, two shapes of the same question, so both are
# answered here beside each other rather than inline at either site.

def _lane_cost(key: tuple) -> int:
    """One card's fare in this lane. A section lane rides free when its
    SOURCE does; a personal lane never does, because no deck structure
    is a kana one (study/structures.py)."""
    if key[0] == daily_queue.SECTION:
        return credits.cost_of(key[1])
    return credits.COST_PER_REVIEW


def _review_cost(raw_id: str, mode: str) -> int:
    """One posted review's fare.

    Priced on the card, not on the mode key alone. Every other review
    endpoint knows its own source outright; this one is mixed and has
    to read the mode off the payload, so pricing on that key by itself
    would sell a free ride to anything at all posted under `kana.*`.
    card_index.locate answers the real question -- which source this
    (card, mode) pair actually belongs to -- with the same lookup the
    queue used to put the card in a lane in the first place.

    Nothing it cannot place pays the full fare: a personal card, or
    content removed since it was last reviewed. Failing closed is the
    only safe direction for a price.
    """
    loc = card_index.locate(raw_id, mode)
    return credits.cost_of(loc[0]) if loc else credits.COST_PER_REVIEW


def _affordable(user_id: str, picked: list[tuple]) -> list[tuple]:
    """Under enforcement, the paid cards a balance cannot cover, dropped
    from a batch (plan 069). Free cards ride regardless.

    This trims the BATCH where it used to shorten the requested count.
    A count clamped to the balance was right while every card cost the
    same; now a batch is mixed, and `count = min(count, 0)` would end a
    run of ten kana -- which cost nothing -- because the vocab beside
    them could not be paid for. Order is the interleaved order, so what
    gets dropped is the paid cards PAST the balance rather than
    whichever ones happened to sort late.

    Nothing is dropped in shadow mode, or on a pass.
    """
    if not credits.ENFORCE:
        return picked
    have = credits.balance(user_id)
    if have is None:
        return picked
    kept = []
    for key, raw_id in picked:
        cost = _lane_cost(key)
        if cost > have:
            continue
        have -= cost
        kept.append((key, raw_id))
    return kept


def _build_section_card(source, deck_key, raw_id, mode, lang, stage, preview):
    """One card, built by its own section's builder.

    `deck_list` is the level the card came from, which is what the
    builders draw MCQ distractors out of -- so a hint on a queued card
    offers the same plausible wrong answers it would in the section.
    """
    build = _SECTION_BUILDERS.get(source)
    if build is None:
        return None

    entry = card_index.entry_for(source, raw_id)
    if entry is None:
        return None

    m = MODES[mode]
    deck_list = [
        card_index.entry_for(source, rid)
        for rid in card_index.raw_ids(source, deck_key, mode)
    ]
    deck_list = [e for e in deck_list if e is not None]

    card = build(raw_id, entry, deck_key, deck_list, m, lang, stage, preview)
    # Every builder already sets its own card_id (kana/grammar derive it
    # from `entry` the same way card_index just did to find it -- see
    # kana_to_id/grammar_to_id -- kanji/vocab take it as raw_id directly).
    # source/deck are genuinely queue-only context: a section's own
    # /cards endpoint never adds them because which section and level a
    # card came from is implied by which endpoint you called.
    card["source"] = source
    card["deck"] = deck_key
    return card


def _personal_rows(user_id: str) -> dict:
    """
    (raw_id -> {deck_id, deck_name, structure, card}) for every personal
    card on this learner's shelf — their own decks and the ones they
    follow from the library alike.

    Looked up rather than parsed out of the id: a personal card's raw id
    is "custom_{deck_id}_{card_id}" and a deck id is free to contain an
    underscore, so splitting it is a guess. One query is cheaper than
    being wrong. That same raw id is what makes a followed deck cost
    nothing extra here: it is deck-scoped but not owner-scoped, so the
    follower's scheduler rows are already filed under it.

    The shelf is VISIBLE_DECKS_CTE, shared with GET /api/decks rather
    than written twice — the two drifting apart would mean a followed
    deck whose cards are due but which the shelf never shows, or the
    reverse.
    """
    conn = db_conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            # Driven FROM the visible decks, not `WHERE ... OR EXISTS`:
            # the OR form can flip the planner off
            # idx_custom_cards_deck(deck_id, user_id) and onto a seq scan
            # of custom_cards, and this runs on every /api/today.
            #
            # The join stays `d.user_id = c.user_id` — a deck's cards are
            # its author's whoever is reading — and it is still what
            # keeps a stray custom_cards row whose user_id disagrees with
            # its deck out of the queue.
            cur.execute(
                f"""
                WITH visible AS ({VISIBLE_DECKS_CTE})
                SELECT c.id, c.deck_id, c.structure, c.fields, c.notes,
                       d.name AS deck_name, d.type AS deck_type
                FROM visible v
                JOIN decks d        ON d.id = v.deck_id
                JOIN custom_cards c ON c.deck_id = d.id AND c.user_id = d.user_id
                """,
                {"me": user_id},
            )
            rows = [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()

    return {
        f"custom_{r['deck_id']}_{r['id']}": r
        for r in rows
    }


@router.get("/api/today")
def get_today(user_id: str = Depends(get_user_id)):
    """
    The number the home screen leads with, and the breakdown behind it.

    Cheap enough to call on every visit to the concourse: one indexed
    query over this user's own rows plus one over their personal cards,
    with no per-section round trips and no card building.
    """
    due_rows = srs.get_due_rows(user_id)
    personal = _personal_rows(user_id)
    # The stops beyond the learner's level wait (the level rule, plan
    # 074): moving down sets them aside, and the badge must not count
    # what the run will not serve.
    lanes = daily_queue.hold_above(
        daily_queue.lanes(user_id, due_rows, personal), resolve_level(user_id)
    )

    by_source: dict[str, int] = defaultdict(int)
    breakdown = []
    for key, ids in lanes.items():
        lane = daily_queue.label(key)
        lane["due"] = len(ids)
        # 無料 — this lane costs nothing (core/credits.py). Stated on
        # the lane rather than left for the gate to derive from a
        # mirrored source list: the economy is the server's to declare,
        # and the gate has to both mark the row and leave it out of its
        # own arithmetic.
        lane["free"] = _lane_cost(key) == 0
        breakdown.append(lane)
        by_source["personal" if key[0] == daily_queue.PERSONAL else key[1]] += len(ids)

    # One number, and it counts scheduler ROWS rather than distinct cards.
    #
    # A card can be due in two modes at once -- 土 under both
    # kanji.flashcard.f2b and kanji.write_kanji. An earlier cut of this
    # served each card once per session to avoid "repeating itself", but
    # that is the queue overruling the scheduler for the sake of tidiness:
    # recognising 土 and writing it are different skills on different
    # schedules, and the one you were not asked would sit deferred while
    # the badge insisted something was still due. Both are served, and
    # the badge is the number the session will actually clear.
    total = sum(len(ids) for ids in lanes.values())
    # The fare is what the run COSTS, which is no longer the same
    # number as what it CLEARS: the kana lanes are counted into `total`
    # -- they are reviews the run really will get through -- and out of
    # this (core/credits.py).
    fare = sum(_lane_cost(key) * len(ids) for key, ids in lanes.items())
    # The engine restricts this to servable MODES (see
    # SRSEngine._servable_filter), which is what keeps the sentence
    # screens' own tracks -- scheduled under a mode with no lane behind
    # it -- from promising a review that will never be presented.
    #
    # Not a complete guarantee, and deliberately not described as one: a
    # registered mode on content that has since been removed still
    # answers here while daily_queue drops it (card_index.locate -> None),
    # so a countdown can still outlive its card. Narrowing that further
    # means asking the queue what it would actually build, which is a
    # bigger change than this one.
    next_due = srs.get_next_due_at(user_id) if total == 0 else None

    logger.info(
        "today summary user_id=%s due_rows=%d served=%d lanes=%d",
        user_id, len(due_rows), total, len(lanes),
    )
    pace = resolve_pace(user_id)
    return {
        # The fare gate prices the run against the balance (plan 069):
        # one credit a paid review, and the balance rides beside it.
        # It used to be `total` outright, back when every review cost
        # the same. Reading it settles the day's refill.
        "fare": fare,
        "credits": credits.summary(user_id),
        # Counted from the lanes rather than from len(due_rows): rows
        # naming content that no longer exists are dropped above, and
        # promising a card the queue cannot build is worse than
        # reporting a smaller number.
        "total": total,
        "by_source": dict(by_source),
        "lanes": breakdown,
        # Only when nothing is due -- "next review in 3 hours" is what
        # turns an empty queue into a finished day.
        "next_due": next_due.isoformat() if next_due else None,
        # The day's new-item gauge for the concourse strip. This queue
        # itself never serves new cards (see the module docstring); the
        # pace here is information, spent by the section endpoints.
        "pace": pace.payload() if pace else None,
    }


@router.get("/api/today/cards")
def get_today_cards(count: int = Query(10, ge=1, le=MAX_BATCH), exclude: str = "", lanes: str = "", lang: str = "fr",
                    user_id: str = Depends(get_user_id)):
    """
    The queue itself: up to `count` due cards, mixed across sections and
    personal decks, each carrying the mode it must be reviewed under.

    `exclude` is what the client already holds but has not answered yet,
    same contract as every section's /cards endpoint -- except that here
    each token is "rawid|mode", not a bare id.

    The mode has to be part of it. A section session has one mode, so an
    id identifies a card unambiguously; this queue can hold the same card
    under two modes, and excluding by bare id would silently drop the
    one the learner has NOT seen along with the one they have. `|` is
    the separator because neither a card id nor a registry mode key can
    contain one.
    """
    count = max(1, min(count, MAX_BATCH))

    due_rows = srs.get_due_rows(user_id)
    personal = _personal_rows(user_id)
    chosen = daily_queue.keep_lanes(
        daily_queue.hold_above(
            daily_queue.lanes(user_id, due_rows, personal), resolve_level(user_id)
        ),
        daily_queue.parse_lane_ids(lanes),
    )
    chosen = daily_queue.drop_seen(chosen, daily_queue.parse_exclude(exclude))
    # Under enforcement a run stops at the balance -- at its worth of
    # PAID cards (plan 069, and _affordable above): the free lanes go
    # on being served, so an empty balance ends the run only once the
    # kana in it is cleared too. A pass has no balance to stop at, and
    # in shadow mode the queue is untouched.
    picked = _affordable(user_id, daily_queue.interleave(chosen, count))
    if not picked:
        return {"cards": []}

    # One bulk lookup per mode for just the handful being served, exactly
    # as the section endpoints do -- so every card arrives carrying its
    # own stage and full rating preview and the client never has to ask
    # again mid-review.
    by_mode: dict[str, list[str]] = defaultdict(list)
    for key, raw_id in picked:
        by_mode[key[-1]].append(raw_id)

    states: dict = {}
    previews: dict = {}
    for mode, ids in by_mode.items():
        card_ids = prefixed(ids, user_id)
        states.update({(cid, mode): v for cid, v in srs.get_bulk_stats(card_ids, mode).items()})
        previews.update({(cid, mode): v for cid, v in srs.preview_reviews_bulk(card_ids, mode, user_id).items()})

    cards = []
    for key, raw_id in picked:
        mode = key[-1]
        card_id = f"{user_id}:{raw_id}"
        stage = states.get((card_id, mode))
        preview = previews.get((card_id, mode))

        if key[0] == daily_queue.SECTION:
            _, source, deck_key, _ = key
            card = _build_section_card(source, deck_key, raw_id, mode, lang, stage, preview)
        else:
            _, deck_id, deck_name, _ = key
            card = build_personal_card(personal[raw_id], raw_id, mode, stage, preview)
            if card is not None:
                # `source` stays "custom", as decks.py set it: the
                # frontend's structureKeyOf reads that exact string to
                # know a card carries its fields under `fields` keyed by
                # its structure's own names. Which DECK it came from is
                # display information and rides alongside.
                card["deck"] = deck_name
                card["deck_id"] = deck_id

        if card is not None:
            # What the queue shows above the card so the learner knows
            # which part of their study this came from. The section
            # screens have a header for this; the queue has to carry it.
            card["lane"] = daily_queue.label(key)
            cards.append(card)

    logger.info(
        "today queue user_id=%s lanes=%d chosen=%s requested=%d served=%d",
        user_id, len(chosen), lanes or "all", count, len(cards),
    )
    return {"cards": cards}


class TodayReviewPayload(BaseModel):
    card_id: str
    mode: str
    quality: int
    prev_stage: str | None = None


@router.post("/api/today/review")
def post_today_review(payload: TodayReviewPayload, user_id: str = Depends(get_user_id)):
    """
    Same contract as every section's review endpoint. It exists as its
    own route rather than dispatching to theirs because the queue is
    mixed-mode: the client would otherwise have to know which of six
    endpoints a given card belongs to, and getting that wrong is silent.

    The mode is validated against the registry here for the same reason
    require_mode exists on the section endpoints -- an unrecognised key
    would otherwise materialise a card_modes row under a garbage mode,
    and nothing downstream would ever look at it again.
    """
    m = try_resolve(payload.mode)
    if m is None or not m.graded:
        raise HTTPException(status_code=400, detail=f"Invalid mode: {payload.mode!r}")

    card_id = f"{user_id}:{payload.card_id}"
    s = srs.review(card_id, payload.mode, payload.quality)
    # The fare, charged only now that the scheduler has accepted the
    # review (plan 069): a rejected review is not a ride. Nothing at
    # all when the card is on a free line -- see _review_cost, which
    # is careful to price the CARD and not the mode key the client
    # chose to send.
    fare = credits.spend(user_id, _review_cost(payload.card_id, payload.mode), card_id)
    return {
        "card_id": payload.card_id,
        "interval": s["interval"],
        "next_review": s["next_review"],
        "xp_earned": s["xp_earned"],
        "leveled_up": s["leveled_up"],
        "new_level": s["new_level"],
        "stage": s["stage"],
        "credits": fare,
    }
