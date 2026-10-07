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

2. NOTHING MAY BE SERVED THAT IS NOT DUE -- EXCEPT THE DAY'S RATION.
   For a long time get_new_cards was deliberately absent from this
   file: a queue that quietly tops itself up with new material cannot
   end, and a queue that cannot end cannot say "you are done for
   today". That rule left a learner who had just boarded on an empty
   gate -- nothing is due on day one -- and the owner asked (plan 098,
   2026-09-21) for the queue to carry the day's new cards too. It
   does, and the objection still holds, because the PACE is what
   bounds it: the ration is what is left of daily_new_target after
   today's first-ever reviews (core/pace.py), kana first for a learner
   who does not yet read them, then the chosen lines in turn
   (study/daily_queue.ration), each deck's cards in the order it teaches
   them (study/teaching_order, plan 186a). A learner with no stored target is
   served no ration at all. When the due set and the ration are both
   empty, this returns nothing and the client shows the next scheduled
   time from /api/today.
"""
import logging
import math
from collections import OrderedDict, defaultdict
from datetime import datetime, timedelta, timezone
from typing import NamedTuple

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

import psycopg2.extras

from core.auth import get_user_id, prefixed, unprefixed
from core import credits, events
from core.db import db_conn
from core.lines import lines_or_all
from core.pace import resolve_pace
from core.srs_instance import srs
from core.user_level import resolve_level
from srs import xp as xp_math
from study import basics, card_index, daily_queue, teaching_order
from study import level_rule
from study.level_rule import kana_sets_for, primary_mode
from study.modes import KANA, KANJI, VOCAB, GRAMMAR, MODES, try_resolve

router = APIRouter()
logger = logging.getLogger(__name__)

MAX_BATCH = 25

# Section builders, imported rather than reimplemented -- a card in the
# daily queue must be indistinguishable from the same card met in its own
# section, or the queue becomes a second, subtly different app.
from routes.kana import _build_kana_card              # noqa: E402
from routes.kanji import _build_kanji_card, FR_MAP as KANJI_FR_MAP     # noqa: E402
from routes.vocab import _build_vocab_card, FR_MAP as VOCAB_FR_MAP     # noqa: E402
from translations import get_meaning                  # noqa: E402
from routes.grammar import _build_grammar_card, ladder_progress   # noqa: E402
from routes.decks import build_personal_card, build_pool_card, VISIBLE_DECKS_CTE   # noqa: E402
from content.vocab_jmdict_data import POOL_ID_PREFIX                # noqa: E402
from routes.profile import _profile_row, bridge_rest_days, counted_from   # noqa: E402


# One adapter per section, each closing over that builder's own argument
# order so _build_section_card can call all four the same way. The
# builders' own signatures stay untouched on purpose -- kana.py/kanji.py/
# vocab.py/grammar.py each call their own builder directly too, and none
# of them has a use for the params this table exists to route (a kana
# card doesn't take raw_id/lang at all; grammar derives its own id and
# its "level" arg is this queue's deck_key under another name). Only the
# daily queue needs to dispatch across sources, so only this table knows
# the mapping.
_SECTION_BUILDERS = {
    KANA:    lambda raw_id, entry, deck_key, deck_list, m, lang, stage, preview:
        _build_kana_card(entry, deck_list, m, stage, preview),
    KANJI:   lambda raw_id, entry, deck_key, deck_list, m, lang, stage, preview:
        _build_kanji_card(raw_id, entry, deck_list, m, lang, stage, preview),
    VOCAB:   lambda raw_id, entry, deck_key, deck_list, m, lang, stage, preview:
        _build_vocab_card(raw_id, entry, deck_list, m, lang, stage, preview),
    GRAMMAR: lambda raw_id, entry, deck_key, deck_list, m, lang, stage, preview, progress=None:
        _build_grammar_card(entry, deck_key, deck_list, m, lang, stage, preview, progress),
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


def _repeats(user_id: str, due_rows: list[dict]) -> set[tuple[str, str]]:
    """(raw id, mode) of the due rows whose review is a learning step's
    repeat -- free on every line (core/credits.py, fare). The day's
    ration is never one: a new card's first review is paid."""
    cut = len(user_id) + 1
    return {(row["card_id"][cut:], row["mode"]) for row in due_rows if row.get("repeat")}


def _card_cost(key: tuple, raw_id: str, repeats: set) -> int:
    """One queued card's fare: its lane's, or nothing on a repeat."""
    return credits.fare(_lane_cost(key), (raw_id, key[-1]) in repeats)


def _affordable(user_id: str, picked: list[tuple], repeats: set = frozenset()) -> list[tuple]:
    """Under enforcement, the paid cards a balance cannot cover, dropped
    from a batch (plan 069). Free cards -- a free line's, and a
    learning step's repeat on any line -- ride regardless.

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
        cost = _card_cost(key, raw_id, repeats)
        if cost > have:
            continue
        have -= cost
        kept.append((key, raw_id))
    return kept


def _build_section_card(source, deck_key, raw_id, mode, lang, stage, preview, progress=None):
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

    # The card's progress goes to the one builder that reads it: the
    # grammar ladder asks the exercise of the card's rung (plan 187e).
    card = (build(raw_id, entry, deck_key, deck_list, m, lang, stage, preview, progress)
            if source == GRAMMAR else build(raw_id, entry, deck_key, deck_list, m, lang, stage, preview))
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
            # A JMdict pool word linked into a deck (plan 148) comes back
            # in that deck's lane too: the course's cards have their JLPT
            # stop's lane (card_index.locate), and a pool word has none,
            # so without this it would be learnt in a deck and never
            # asked again. Only the deck is looked up here; the word is
            # the pool's (build_pool_card).
            cur.execute(
                f"""
                WITH visible AS ({VISIBLE_DECKS_CTE})
                SELECT dk.raw_id, dk.deck_id, d.name AS deck_name
                FROM visible v
                JOIN decks d       ON d.id = v.deck_id
                JOIN deck_cards dk ON dk.deck_id = d.id AND dk.user_id = d.user_id
                WHERE dk.source = 'vocab' AND left(dk.raw_id, %(plen)s) = %(prefix)s
                ORDER BY dk.added_at
                """,
                {"me": user_id, "plen": len(POOL_ID_PREFIX), "prefix": POOL_ID_PREFIX},
            )
            pooled = [dict(r) for r in cur.fetchall()]
    finally:
        conn.close()

    out = {
        f"custom_{r['deck_id']}_{r['id']}": r
        for r in rows
    }
    for r in pooled:
        # A word in two decks is asked once, in the deck it went into
        # first.
        out.setdefault(r["raw_id"], {**r, "pool": True})
    return out


def _hold_line(user_id: str, level: str) -> str:
    """The level rule's line for this learner: their level, raised to
    their goal (daily_queue.hold_line). A failed goal lookup falls back
    to the level -- the rule as it stood -- rather than 500 the gate."""
    try:
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT goal_level FROM user_profiles WHERE user_id = %s", (user_id,))
                row = cur.fetchone()
        finally:
            conn.close()
    except Exception:
        logger.exception("goal lookup for the level rule failed")
        return level
    return daily_queue.hold_line(level, row[0] if row else None)


# ── 新規 — the day's ration (study/daily_queue.ration) ─────────────
class Pools(NamedTuple):
    """What daily_queue.ration spends: kana lane -> never-met ids, line
    lane -> never-met ids, and for a learner riding the basics the
    course's cards not yet met, in its order (None for everyone else)."""
    kana: "OrderedDict[tuple, list[str]]"
    lines: "OrderedDict[tuple, list[str]]"
    course: list | None


def _ration(pools: Pools, budget: int):
    return daily_queue.ration(pools.kana, pools.lines, budget, course=pools.course)


def _new_lanes(user_id: str, level: str):
    """
    lane key -> new raw ids the run may introduce today, at most what
    is left of the pace. Empty when no target is stored, when today's
    is spent, or when the lookups fail -- a ration is a comfort, and
    nothing here may 500 the gate.
    """
    pace = resolve_pace(user_id)
    if pace is None or pace.remaining <= 0:
        return OrderedDict()
    pools = _new_pools(user_id, level, pace.remaining)
    if pools is None:
        return OrderedDict()
    return _ration(pools, pace.remaining)


def _course(user_id: str, lines) -> list[tuple[tuple, str, int]]:
    """(lane key, raw id, unit) for each card of the basics course
    (study/basics.py) in the learner's lines that they have never met,
    in the order the course deals them. Empty once the course is done --
    and from the start for a learner who boarded above N5, whose N5 the
    level rule seeded known."""
    unmet: set[tuple[str, str]] = set()
    for source in basics.SOURCES:
        if source not in lines:
            continue
        ids = basics.course_ids(source)
        picked = srs.get_new_cards(primary_mode(source), limit=len(ids),
                                   card_ids=prefixed(ids, user_id), ordered=True)
        unmet |= {(source, unprefixed(cid, user_id)) for cid in picked}
    return [
        ((daily_queue.SECTION, source, basics.LEVEL, primary_mode(source)), raw_id, unit)
        for source, raw_id, unit in basics.sequence()
        if (source, raw_id) in unmet
    ]


def _riding_basics(level: str) -> bool:
    """The basics are N5's first stretch (plan 186e): a learner at N5 rides
    them, whatever their goal; one above N5 has them behind."""
    return level == basics.LEVEL


def _unit_label(n: int) -> dict:
    unit = basics.units()[n]
    return {"unit": n + 1, "of": len(basics.units()), "id": unit["id"], "jp": unit["jp"], "title": unit["title"]}


def _basics_status(user_id: str, level: str):
    """Where the learner stands on the basics (plan 186e), for the gate:
    the unit of the next card the course will deal, or done. None for a
    learner above N5, and when the profile cannot be read -- a label is
    a comfort, never a reason to fail the gate."""
    if not _riding_basics(level):
        return None
    try:
        course = _course(user_id, lines_or_all(_profile_row(user_id)[9]))
    except Exception:
        logger.exception("basics status failed")
        return None
    if not course:
        return {"done": True, "of": len(basics.units())}
    return {"done": False, **_unit_label(course[0][2])}


def _new_pools(user_id: str, level: str, budget: int):
    """The Pools of never-met cards, at most `budget` a lane -- what
    daily_queue.ration spends. None when the profile cannot be read."""
    try:
        row = _profile_row(user_id)
    except Exception:
        logger.exception("profile lookup for the ration failed")
        return None
    kana_known, lines = row[6], lines_or_all(row[9])

    # A course card comes through the course, in the course's order, and
    # never again through its line (daily_queue.ration's contract).
    course = _course(user_id, lines) if _riding_basics(level) else None

    def fresh(source: str, deck_key: str, mode: str) -> list[str]:
        ids = teaching_order.raw_ids(source, deck_key, mode)
        if course is not None:
            ids = [raw_id for raw_id in ids if basics.unit_of(raw_id) is None]
        if not ids:
            return []
        # The first cards the deck teaches that the learner has never
        # met (plan 186a). The ration was a random draw once, which dealt
        # 〜なければなりません as readily as は on day one -- and, drawn
        # again on every request, served other cards than the gate had
        # counted. In order, the gate and the run agree.
        picked = srs.get_new_cards(mode, limit=budget, card_ids=prefixed(ids, user_id), ordered=True)
        return [unprefixed(cid, user_id) for cid in picked]

    kana_mode = primary_mode(KANA)
    known_sets = set(kana_sets_for(kana_known))
    kana_lanes = OrderedDict()
    for set_name in card_index.deck_keys(KANA):
        if set_name in known_sets:
            continue
        ids = fresh(KANA, set_name, kana_mode)
        if ids:
            kana_lanes[(daily_queue.SECTION, KANA, set_name, kana_mode)] = ids

    line_lanes = OrderedDict()
    for source in lines:
        mode = primary_mode(source)
        ids = fresh(source, level, mode)
        if ids:
            line_lanes[(daily_queue.SECTION, source, level, mode)] = ids

    return Pools(kana_lanes, line_lanes,
                 None if course is None else [(key, raw_id) for key, raw_id, _ in course])


class DayQueue(NamedTuple):
    """What the day's queue holds now: the lanes /api/today counts and
    the run serves, and what they were read from."""
    due_rows: list
    level: str
    lanes: "OrderedDict[tuple, list[str]]"
    fresh: dict

    @property
    def total(self) -> int:
        # One number, and it counts scheduler ROWS rather than distinct
        # cards -- see get_today.
        return sum(len(ids) for ids in self.lanes.values())


def _day_queue(user_id: str) -> DayQueue:
    """The day's queue as the gate counts it. One function for GET
    /api/today and POST /api/today/clear (plan 191), so a day is cleared
    on exactly the count the gate prints, never on a second reading of
    it that could drift."""
    due_rows = srs.get_due_rows(user_id)
    personal = _personal_rows(user_id)
    level = resolve_level(user_id)
    # The stops beyond the learner's level AND goal wait (the level
    # rule, plan 074; daily_queue.hold_line): moving down sets them
    # aside, and the badge must not count what the run will not serve.
    # The day's ration of new cards rides beside the reviews (plan
    # 098): at the learner's own level, so the hold never touches it.
    lanes, fresh = daily_queue.merge_new(
        daily_queue.hold_above(daily_queue.lanes(user_id, due_rows, personal), _hold_line(user_id, level)),
        _new_lanes(user_id, level),
    )
    return DayQueue(due_rows, level, lanes, fresh)


@router.get("/api/today")
def get_today(user_id: str = Depends(get_user_id)):
    """
    The number the home screen leads with, and the breakdown behind it.

    Cheap enough to call on every visit to the concourse: one indexed
    query over this user's own rows plus one over their personal cards,
    with no per-section round trips and no card building.
    """
    # 運休 (plan 191): a missed day a rest ticket covers is spent here,
    # before anything reads the streak.
    bridge_rest_days(user_id)
    queue = _day_queue(user_id)
    due_rows, level, lanes, fresh = queue

    repeats = _repeats(user_id, due_rows)
    by_source: dict[str, int] = defaultdict(int)
    breakdown = []
    for key, ids in lanes.items():
        lane = daily_queue.label(key)
        # Two figures, apart: what is owed and what is offered. The
        # gate adds them for the run's length and prints the second as
        # its own tag.
        lane["new"] = fresh.get(key, 0)
        lane["due"] = len(ids) - lane["new"]
        # 無料 — this lane costs nothing (core/credits.py). Stated on
        # the lane rather than left for the gate to derive from a
        # mirrored source list: the economy is the server's to declare,
        # and the gate has to both mark the row and leave it out of its
        # own arithmetic.
        lane["free"] = _lane_cost(key) == 0
        # And how many of its cards ride free: all of a free lane's,
        # else its learning steps' repeats (credits.fare), which a paid
        # lane carries among the cards it charges for.
        lane["freeCards"] = sum(1 for rid in ids if _card_cost(key, rid, repeats) == 0)
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
    total = queue.total
    # The fare is what the run COSTS, which is no longer the same
    # number as what it CLEARS: the kana lanes are counted into `total`
    # -- they are reviews the run really will get through -- and out of
    # this (core/credits.py), as are the learning steps' repeats.
    fare = sum(_card_cost(key, rid, repeats) for key, ids in lanes.items() for rid in ids)
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
    # 所要 (plan 135): what a review takes this learner, so the gate can
    # print what a run will take -- from the gaps between their reviews
    # and from what a card cost in their last twenty runs (plan 175). A
    # figure, never a reason to fail.
    try:
        spr = srs.get_review_pace(user_id) if total else None
    except Exception:
        logger.exception("review pace failed")
        spr = None
    return {
        "seconds_per_review": spr,
        # 基礎 (plan 186e): the unit the course is at, for an N5 learner.
        "basics": _basics_status(user_id, level),
        # The fare gate prices the run against the balance (plan 069):
        # one credit a paid review, and the balance rides beside it.
        # It used to be `total` outright, back when every review cost
        # the same. Reading it counts what the refill has landed
        # (`pending`, plan 141) without claiming it.
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
        # The day's new-item gauge for the concourse strip -- and, since
        # plan 098, the budget the lanes' `new` figures were drawn
        # against (see the module docstring and _new_lanes).
        "pace": pace.payload() if pace else None,
        # 終着 and 運休 (plan 191): whether the day is cleared and what
        # clearing it pays, and the rest days.
        **_day_status(user_id),
    }


# ── 終着 — the day cleared (plan 191) ────────────────────────────
# The run's end asks POST /api/today/clear whether it emptied the day.
# A day is cleared when the queue the gate counts is empty AND a card
# was reviewed today (UTC, the streak's day): an empty gate on a day
# nothing came due is no victory, and a run that leaves cards is a
# partial one. Paid once a UTC day, the day_clears row's primary key
# the guard (srs.record_day_clear): the day's bonus for the streak and,
# on a milestone, its jackpot (srs/xp.py).

# What a review is reckoned to take when the learner's pace is not yet
# known (srs.get_review_pace is None before twenty short gaps), for the
# minutes printed beside tomorrow's cards.
DEFAULT_SECONDS_PER_REVIEW = 10


def _clear_preview(streak: int) -> dict:
    """What clearing a day on day `streak` of the streak pays."""
    milestone = xp_math.milestone_at(streak)
    return {
        "streak": streak,
        "bonus": xp_math.day_clear_bonus(streak),
        "jackpot": xp_math.jackpot_for(milestone),
        "milestone": milestone,
    }


def _paid_preview(row: dict) -> dict:
    """A cleared day's preview: what it did pay, as recorded."""
    return {"streak": row["streak"], "bonus": row["bonus"],
            "jackpot": row["jackpot"], "milestone": row["milestone"]}


def _rest_next(after: int, held: int):
    """The streak day the next rest day is earned on, counted after day
    `after`; None while the learner holds as many as they may."""
    return None if held >= xp_math.REST_HELD_MAX else xp_math.next_rest_at(after)


def _day_status(user_id: str) -> dict:
    """GET /api/today's `day_clear` and `rest`. The preview's streak
    counts today (srs.streak_figures' `today`); a day already cleared
    previews what it paid."""
    today = datetime.now(timezone.utc).date()
    figures = srs.streak_figures(user_id)
    row = srs.get_day_clear(user_id, today)
    held = srs.rest_held(user_id)
    return {
        "day_clear": {
            "done": row is not None,
            "preview": _paid_preview(row) if row else _clear_preview(figures["today"]),
        },
        "rest": {
            "held": held,
            "unseen": srs.rest_unseen(user_id),
            "streak": figures["current"],
            "next_at": _rest_next(counted_from(figures, row is not None), held),
        },
    }


def _tomorrow(user_id: str, level: str) -> dict:
    """Tomorrow's ride, as a cleared day prints it: the cards that fall
    due tomorrow (srs.get_due_forecast's second day) and a whole day's
    ration of new ones, and the minutes they take at the learner's pace,
    rounded up. A figure, never a reason to fail the clear."""
    try:
        due = srs.get_due_forecast(user_id, 2)[1]["count"]
    except Exception:
        logger.exception("tomorrow's forecast failed")
        due = 0
    fresh = 0
    try:
        pace = resolve_pace(user_id)
        if pace is not None:
            pools = _new_pools(user_id, level, pace.target)
            if pools is not None:
                fresh = sum(len(ids) for ids in _ration(pools, pace.target).values())
    except Exception:
        logger.exception("tomorrow's ration failed")
    cards = due + fresh
    try:
        spr = srs.get_review_pace(user_id)
    except Exception:
        logger.exception("review pace failed")
        spr = None
    minutes = max(1, math.ceil(cards * (spr or DEFAULT_SECONDS_PER_REVIEW) / 60)) if cards else 0
    return {"cards": cards, "minutes": minutes}


def _level_figures(user_id: str) -> dict:
    """The learner's level and how far into it, for the bar a cleared day
    fills: {level, into, span}, `into` of `span` XP."""
    lifetime = srs.get_lifetime_xp(user_id)
    level = xp_math.level_from_xp(lifetime)
    floor = xp_math.xp_threshold(level)
    return {"level": level, "into": lifetime - floor, "span": xp_math.xp_threshold(level + 1) - floor}


# Reviews a run may count for its XP: well past any run's length, a
# ceiling on the rows one question reads.
RUN_REVIEWS_MAX = 2000


class TodayClearPayload(BaseModel):
    # How many reviews the run made (its `cleared`), for `run_xp`.
    reviews: int | None = Field(default=None, ge=0)


@router.post("/api/today/clear")
def post_today_clear(payload: TodayClearPayload | None = None,
                     user_id: str = Depends(get_user_id)):
    """
    終着 (plan 191): the run is over -- is the day?

    Not cleared while the gate still counts a card (a run of a chosen
    length, one lane, the balance spent) or before a card was reviewed
    today: what is left, how long it takes and what clearing would pay.
    Cleared, the day's bonus is paid once (`already` on every call after
    the first, with no XP), and the answer carries what the ceremony
    draws: the streak and its milestone, the rest days, the week, the
    level after paying and tomorrow's ride. Always 200.

    Given the run's `reviews`, either answer carries `run_xp`, what those
    reviews earned as written (srs.get_run_xp): the run's own figure,
    reckoned from its cards' previews, runs high on a long run.
    """
    bridge_rest_days(user_id)
    today = datetime.now(timezone.utc).date()
    queue = _day_queue(user_id)
    remaining = queue.total
    figures = srs.streak_figures(user_id)
    reviews = payload.reviews if payload else None
    run_xp = srs.get_run_xp(user_id, min(reviews, RUN_REVIEWS_MAX)) if reviews is not None else None

    if remaining > 0 or srs.get_reviews_today(user_id) == 0:
        spr = None
        if remaining:
            try:
                spr = srs.get_review_pace(user_id)
            except Exception:
                logger.exception("review pace failed")
        row = srs.get_day_clear(user_id, today)
        return {
            "cleared": False,
            "remaining": remaining,
            "seconds_per_review": spr,
            "preview": _paid_preview(row) if row else _clear_preview(figures["today"]),
            "run_xp": run_xp,
        }

    # Today is studied, so the streak counts it.
    streak = figures["current"]
    milestone = xp_math.milestone_at(streak)
    bonus = xp_math.day_clear_bonus(streak)
    jackpot = xp_math.jackpot_for(milestone)
    paid = srs.record_day_clear(user_id, today, streak, bonus, jackpot, milestone)
    level = _level_figures(user_id)
    if paid is None:
        # Cleared already: the day as it was paid, and nothing more.
        row = srs.get_day_clear(user_id, today)
        streak, bonus, jackpot, milestone = row["streak"], row["bonus"], row["jackpot"], row["milestone"]
        rest_earned = bool(row["rest_earned"])
        xp = {"xp_earned": 0, "leveled_up": False, "new_level": level["level"]}
    else:
        rest_earned = paid["rest_earned"]
        xp = paid["xp"]
        events.record(user_id, "day_clear", {
            "streak": streak, "milestone": milestone, "tier": xp_math.clear_tier(milestone),
        })
        logger.info("day cleared user_id=%s streak=%d bonus=%d jackpot=%d rest=%s",
                    user_id, streak, bonus, jackpot, rest_earned)

    held = srs.rest_held(user_id)
    following = xp_math.next_milestone(streak)
    return {
        "cleared": True,
        "already": paid is None,
        "day": today.isoformat(),
        "streak": streak,
        "longest": figures["longest"],
        "bonus": bonus,
        "jackpot": jackpot,
        "milestone": milestone,
        "tier": xp_math.clear_tier(milestone),
        "next_milestone": following,
        "next_jackpot": xp_math.jackpot_for(following),
        "rest": {"held": held, "earned": rest_earned, "next_at": _rest_next(streak, held)},
        "week": srs.week_row(user_id),
        # The month's sheet (plan 191): the thirty days the month's
        # ceremony inks, only on the day it plays.
        "month": srs.week_row(user_id, 30) if xp_math.clear_tier(milestone) == "month" else None,
        "xp": xp,
        "run_xp": run_xp,
        "level": level,
        "tomorrow": _tomorrow(user_id, queue.level),
    }


@router.post("/api/today/rest/seen")
def post_today_rest_seen(user_id: str = Depends(get_user_id)):
    """運休 (plan 191): the learner has been told the rest days that kept
    their streak -- Today stops showing them."""
    srs.mark_rest_seen(user_id)
    return {"ok": True}


@router.get("/api/today/forecast")
def get_today_forecast(user_id: str = Depends(get_user_id)):
    """
    区間 (plan 135): what comes due each of the next seven days, today
    first -- the bars under the journey beside the desk's fare gate. Its
    own request rather than a field of /api/today, which the phone and
    the tab badge read on every visit and neither draws this. Today's
    bar is the gate's own total on the client, not this figure: the
    gate counts the lanes the queue can serve, this counts rows.
    """
    return {"days": srs.get_due_forecast(user_id, 7)}


# ── 発車案内 — the day ahead, for what the app says while closed (plan 156) ──
# The native shells schedule the daily nudge as dated notifications, one
# a day at the learner's hour, and hand a home or lock screen widget the
# figures it prints. Both are decided while the app is open and shown
# while it is not, so both need what the gate WILL hold at a time to
# come, not what it holds now. The device names the instants -- it
# alone knows its own time zone and the hour's daylight saving -- and
# this counts each the way /api/today counts now: the same lanes, the
# same level hold, the same ration of new cards.
#
# A count for tomorrow assumes nothing is reviewed in between. That is
# the one case in which it is ever read: any opening of the app plans
# again from the state it finds.
AHEAD_MAX_POINTS = 8
AHEAD_MAX_DAYS = 8
# A word the widget prints with its answer is one the learner will not
# be asked for sooner than this, in any mode.
SETTLED_DAYS = 7
AHEAD_WORDS = 8


def _instants(raw: str) -> list[datetime]:
    now = datetime.now(timezone.utc)
    out = []
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            t = datetime.fromisoformat(part.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(status_code=422, detail=f"not an instant: {part}")
        if t.tzinfo is None:
            raise HTTPException(status_code=422, detail=f"an instant needs its offset: {part}")
        if not (now - timedelta(days=1) <= t <= now + timedelta(days=AHEAD_MAX_DAYS)):
            raise HTTPException(status_code=422, detail=f"out of range: {part}")
        out.append(t.astimezone(timezone.utc))
    if not out or len(out) > AHEAD_MAX_POINTS:
        raise HTTPException(status_code=422, detail=f"between 1 and {AHEAD_MAX_POINTS} instants")
    return out


def _short_gloss(text: str) -> str:
    """The first sense or two of a gloss, short enough for a widget's
    one line: "soil; earth; ground" -> "soil; earth"."""
    parts = [p.strip() for p in (text or "").split(";") if p.strip()]
    gloss = "; ".join(parts[:2])
    return gloss if len(gloss) <= 32 or len(parts) < 2 else parts[0]


def _settled_word(source: str, raw_id: str, lang: str) -> dict | None:
    entry = card_index.entry_for(source, raw_id)
    if entry is None:
        return None
    if source == VOCAB:
        kanji = entry.get("kanji") or ""
        kana = (entry.get("kana") or "").split("/")[0].strip()
        jp, reading = (kanji, kana) if kanji else (kana, "")
        meaning = get_meaning(entry, lang, VOCAB_FR_MAP)
    elif source == KANJI:
        jp = entry.get("kanji") or ""
        # "ド・ト・つち": the character's readings, the first three.
        reading = "・".join((entry.get("kana") or "").split("・")[:3])
        meaning = get_meaning(entry, lang, KANJI_FR_MAP)
    else:
        return None
    if not jp or not meaning:
        return None
    return {"jp": jp, "reading": reading, "meaning": _short_gloss(meaning), "source": source}


def _settled_words(user_id: str, lang: str) -> list[dict]:
    now = datetime.now(timezone.utc)
    rows = srs.get_settled_cards(
        user_id, now + timedelta(days=SETTLED_DAYS), now.date().isoformat(), AHEAD_WORDS * 4,
        kinds=("vocab_", "kanji_"),
    )
    words = []
    for card_id, mode in rows:
        raw_id = unprefixed(card_id, user_id)
        loc = card_index.locate(raw_id, mode)
        if loc is None or loc[0] not in (VOCAB, KANJI):
            continue
        word = _settled_word(loc[0], raw_id, lang)
        if word:
            words.append(word)
        if len(words) >= AHEAD_WORDS:
            break
    return words


@router.get("/api/today/ahead")
def get_today_ahead(at: str = Query(..., description="comma-separated ISO instants, offset included"),
                    since: str | None = None, lang: str = "fr",
                    user_id: str = Depends(get_user_id)):
    """
    For each instant in `at`: what the gate will hold then -- the total,
    the new cards among it and the lanes, busiest first. With `since`
    (the learner's midnight, from the device), whether anything has
    been answered today. And the words a widget may print with their
    answer: known, and not asked for again this week.
    """
    instants = _instants(at)
    started = None
    if since:
        try:
            started = datetime.fromisoformat(since.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(status_code=422, detail="since is not an instant")
        if started.tzinfo is None:
            raise HTTPException(status_code=422, detail="since needs its offset")

    due_rows = srs.get_due_rows(user_id, until=max(instants))
    personal = _personal_rows(user_id)
    level = resolve_level(user_id)
    line = _hold_line(user_id, level)

    # The ration: what is left of today's pace for an instant today (the
    # pace's day is UTC, core/pace.py), a whole day's for any later one.
    # Drawn once at the larger budget and spent twice.
    pace = resolve_pace(user_id)
    today_new = later_new = OrderedDict()
    if pace is not None:
        pools = _new_pools(user_id, level, pace.target)
        if pools is not None:
            today_new = _ration(pools, pace.remaining)
            later_new = _ration(pools, pace.target)
    today_utc = datetime.now(timezone.utc).date()

    points = []
    for t in instants:
        rows = [r for r in due_rows if r["next_review"] <= t]
        lanes, fresh = daily_queue.merge_new(
            daily_queue.hold_above(daily_queue.lanes(user_id, rows, personal), line),
            today_new if t.date() == today_utc else later_new,
        )
        breakdown = []
        for key, ids in lanes.items():
            lane = daily_queue.label(key)
            lane["count"] = len(ids)
            lane["new"] = fresh.get(key, 0)
            breakdown.append(lane)
        breakdown.sort(key=lambda lane: -lane["count"])
        points.append({
            "at": t.isoformat(),
            "total": sum(len(ids) for ids in lanes.values()),
            "new": sum(fresh.values()),
            "lanes": breakdown,
        })

    try:
        spr = srs.get_review_pace(user_id)
    except Exception:
        logger.exception("review pace failed")
        spr = None
    try:
        words = _settled_words(user_id, lang)
    except Exception:
        # A widget without its word is a smaller widget, not a broken one.
        logger.exception("settled words failed")
        words = []
    return {
        "points": points,
        "seconds_per_review": spr,
        "rode_today": srs.reviewed_since(user_id, started) if started else None,
        "words": words,
    }


@router.get("/api/today/cards")
def get_today_cards(count: int = Query(10, ge=1, le=MAX_BATCH), exclude: str = "", lanes: str = "", lang: str = "fr",
                    only: str = "", quota: str = "", unit: str = "", user_id: str = Depends(get_user_id)):
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

    `only` is one raw id, and it serves that card alone -- what the
    dictionary panel's "review this card" boards for an entry it has
    just told the reader is due. It is not a lane filter: `lanes` and
    the level rule shape what a mixed DAY serves, and a learner who
    pressed the action on one entry is not asking for a day. The credit
    gate still applies, because a card that cannot be paid for cannot be
    paid for wherever it was started from.

    `unit` is a unit of the basics (plan 186g), boarded from its station
    on the Learn gate: that unit's cards alone, its due reviews first and
    then the cards never met in the order the course deals them -- its
    rules, each opening on its lesson, then its words, then its kanji --
    in the learner's lines, whatever the day's ration or the learner's
    level, since they chose the unit. Like `only`, not a day.
    """
    count = max(1, min(count, MAX_BATCH))

    due_rows = srs.get_due_rows(user_id)
    personal = _personal_rows(user_id)
    all_lanes = daily_queue.lanes(user_id, due_rows, personal)
    level = resolve_level(user_id)
    riding = _riding_basics(level)
    if unit:
        return _unit_cards(user_id, unit, all_lanes, due_rows, count, exclude, lang)
    if only:
        chosen = daily_queue.keep_card(all_lanes, only)
    else:
        # The ration rides with the reviews (plan 098): drawn again per
        # batch against what is left of the pace by now, so a run that
        # has met three new cards is offered three fewer. The lane
        # choice applies to it like any lane -- a switched-off line
        # offers nothing new either.
        merged, _fresh = daily_queue.merge_new(
            daily_queue.hold_above(all_lanes, _hold_line(user_id, level)), _new_lanes(user_id, level),
        )
        chosen = daily_queue.keep_lanes(merged, daily_queue.parse_lane_ids(lanes))
    chosen = daily_queue.drop_seen(chosen, daily_queue.parse_exclude(exclude))
    if quota and not only:
        # A run of a chosen length (plan 135): what each lane still owes
        # it, as the run counts it, and nothing past that.
        chosen = daily_queue.keep_quota(chosen, daily_queue.parse_quota(quota))
    # Under enforcement a run stops at the balance -- at its worth of
    # PAID cards (plan 069, and _affordable above): the free lanes go
    # on being served, so an empty balance ends the run only once the
    # kana in it is cleared too. A pass has no balance to stop at, and
    # in shadow mode the queue is untouched.
    repeats = _repeats(user_id, due_rows)
    picked = _affordable(user_id, daily_queue.interleave(chosen, count), repeats)
    if not picked:
        return {"cards": [], "beyond": 0}
    # 残り — what the queue still holds past this batch and past what
    # the client already has in hand, as the queue would serve it (the
    # balance's cut included). The run's "left" count is this plus the
    # cards it holds unanswered, measured afresh at every batch: the
    # gate's total less what was cleared is a snapshot, and it read 0
    # while the queue went on serving -- a card rated a miss is due
    # again minutes later, and others fall due as the run goes on.
    owed = sum(len(ids) for ids in chosen.values())
    beyond = len(_affordable(user_id, daily_queue.interleave(chosen, owed), repeats)) - len(picked)

    # One bulk lookup per mode for just the handful being served, exactly
    # as the section endpoints do -- so every card arrives carrying its
    # own stage and full rating preview and the client never has to ask
    # again mid-review.
    by_mode: dict[str, list[str]] = defaultdict(list)
    for key, raw_id in picked:
        by_mode[key[-1]].append(raw_id)

    states: dict = {}
    previews: dict = {}
    progresses: dict = {}
    for mode, ids in by_mode.items():
        card_ids = prefixed(ids, user_id)
        states.update({(cid, mode): v for cid, v in srs.get_bulk_stats(card_ids, mode).items()})
        previews.update({(cid, mode): v for cid, v in srs.preview_reviews_bulk(card_ids, mode, user_id).items()})
        progresses.update({(cid, mode): v for cid, v in ladder_progress(card_ids, mode).items()})

    cards = []
    for key, raw_id in picked:
        mode = key[-1]
        card_id = f"{user_id}:{raw_id}"
        stage = states.get((card_id, mode))
        preview = previews.get((card_id, mode))

        if key[0] == daily_queue.SECTION:
            _, source, deck_key, _ = key
            card = _build_section_card(source, deck_key, raw_id, mode, lang, stage, preview,
                                       progresses.get((card_id, mode)))
        else:
            _, deck_id, deck_name, _ = key
            row = personal[raw_id]
            if row.get("pool"):
                card = build_pool_card(raw_id, mode, lang, stage, preview)
            else:
                card = build_personal_card(row, raw_id, mode, stage, preview)
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
            # 基礎 (plan 186e): the course's unit a card belongs to, for
            # a learner riding it.
            unit = basics.unit_of(raw_id) if riding and key[0] == daily_queue.SECTION else None
            if unit is not None:
                card["basics"] = _unit_label(unit)
            cards.append(card)

    logger.info(
        "today queue user_id=%s lanes=%d chosen=%s requested=%d served=%d",
        user_id, len(chosen), only or lanes or "all", count, len(cards),
    )
    # Each card's bar, new to mastered (plan 147).
    srs.attach_progress(cards, user_id)
    return {"cards": cards, "beyond": beyond}


def _unit_cards(user_id: str, unit_id: str, all_lanes, due_rows, count: int, exclude: str, lang: str) -> dict:
    """One unit of the basics as a run (plan 186g): see get_today_cards'
    `unit`. A card due under another mode than its line's primary one
    rides too -- it is the unit's card, and it is due."""
    n = next((i for i, u in enumerate(basics.units()) if u["id"] == unit_id), None)
    if n is None:
        raise HTTPException(status_code=404, detail="no such unit")
    lines = lines_or_all(_profile_row(user_id)[9])
    sources = [source for source in basics.SOURCES if source in lines]
    ids = {raw_id for source in sources for raw_id in basics.units()[n]["cards"][source]}
    skip = daily_queue.parse_exclude(exclude)
    due = daily_queue.drop_seen(
        OrderedDict((key, [rid for rid in held if rid in ids]) for key, held in all_lanes.items()
                    if key[0] == daily_queue.SECTION),
        skip,
    )
    order = daily_queue.interleave(due, sum(len(v) for v in due.values()))
    held = {(rid, key[-1]) for key, rid in order}
    for source in sources:
        unit_ids = basics.units()[n]["cards"][source]
        mode = primary_mode(source)
        fresh = srs.get_new_cards(mode, limit=len(unit_ids), card_ids=prefixed(unit_ids, user_id), ordered=True)
        key = (daily_queue.SECTION, source, basics.LEVEL, mode)
        order += [(key, rid) for rid in (unprefixed(cid, user_id) for cid in fresh)
                  if (rid, mode) not in skip and (rid, mode) not in held]
    repeats = _repeats(user_id, due_rows)
    picked = _affordable(user_id, order[:count], repeats)
    if not picked:
        return {"cards": [], "beyond": 0}
    beyond = len(_affordable(user_id, order, repeats)) - len(picked)
    by_mode: dict[str, list[str]] = defaultdict(list)
    for key, raw_id in picked:
        by_mode[key[-1]].append(f"{user_id}:{raw_id}")
    states: dict = {}
    previews: dict = {}
    progresses: dict = {}
    for mode, card_ids in by_mode.items():
        states.update({(cid, mode): v for cid, v in srs.get_bulk_stats(card_ids, mode).items()})
        previews.update({(cid, mode): v for cid, v in srs.preview_reviews_bulk(card_ids, mode, user_id).items()})
        progresses.update({(cid, mode): v for cid, v in ladder_progress(card_ids, mode).items()})
    cards = []
    for key, raw_id in picked:
        _, source, deck_key, mode = key
        card_id = f"{user_id}:{raw_id}"
        stage = states.get((card_id, mode))
        preview = previews.get((card_id, mode))
        card = _build_section_card(source, deck_key, raw_id, mode, lang, stage, preview,
                                   progresses.get((card_id, mode)))
        if card is None:
            continue
        card["lane"] = daily_queue.label(key)
        card["basics"] = _unit_label(n)
        cards.append(card)
    logger.info("basics unit run user_id=%s unit=%s served=%d", user_id, unit_id, len(cards))
    srs.attach_progress(cards, user_id)
    return {"cards": cards, "beyond": beyond}


def _note_unit_done(user_id: str, raw_id: str) -> None:
    """基礎 (plan 186f): a first review that leaves its unit of the
    basics with nothing unmet in the learner's lines is that unit done,
    recorded as `basics_unit_done`. Only a course card's first review at
    N5 asks, and nothing here may fail the review."""
    unit = basics.unit_of(raw_id)
    if unit is None:
        return
    try:
        if not _riding_basics(resolve_level(user_id)):
            return
        course = _course(user_id, lines_or_all(_profile_row(user_id)[9]))
        if all(n != unit for _, _, n in course):
            events.record(user_id, "basics_unit_done", {"unit": unit + 1})
    except Exception:
        logger.exception("basics unit check failed")


@router.post("/api/today/basics/skip")
def post_basics_skip(user_id: str = Depends(get_user_id)):
    """Skip the basics (plan 186f), for a learner who knows them: every
    course card not yet met is marked known, in its line's primary mode,
    as the level rule marks the stops behind a level -- a row that exists
    is left alone, the first checks spread over the same weeks -- and the
    ration goes on to the rest of N5. Undone by nothing but study, as the
    level rule is; a card the learner is shown again and misses comes back
    like any other."""
    level = resolve_level(user_id)
    if not _riding_basics(level):
        return {"markedKnown": 0, "basics": None}
    at = _basics_status(user_id, level)
    marked = 0
    for source in basics.SOURCES:
        marked += srs.seed_known(prefixed(basics.course_ids(source), user_id), primary_mode(source),
                                 spread_days=level_rule.SPREAD_DAYS)
    if at and not at.get("done"):
        events.record(user_id, "basics_skipped", {"unit": at["unit"]})
    logger.info("basics skipped user_id=%s marked_known=%d", user_id, marked)
    return {"markedKnown": marked, "basics": _basics_status(user_id, level)}


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
    # chose to send -- nor on a learning step's repeat (credits.fare).
    fare = credits.spend(user_id, credits.fare(_review_cost(payload.card_id, payload.mode), s["repeat"]), card_id)
    if payload.prev_stage in (None, "new"):
        _note_unit_done(user_id, payload.card_id)
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


# A saved queue is at most a couple of batches (MAX_BATCH each), so this
# is generous; it only exists so one request cannot ask about a deck.
MAX_STALE_CHECK = 200


class SavedCard(BaseModel):
    card_id: str
    mode: str


class StaleCheckPayload(BaseModel):
    cards: list[SavedCard] = Field(default_factory=list, max_length=MAX_STALE_CHECK)


@router.post("/api/today/stale")
def post_today_stale(payload: StaleCheckPayload, user_id: str = Depends(get_user_id)):
    """
    Which of a saved queue's cards have been answered since it was saved.

    Every study screen keeps its queue in the browser and resumes it on
    the next visit, so a card can wait there for days -- and in the
    meantime be answered in Today, in another section that holds the
    same card (N5 vocab and a theme share ids), on another device, or in
    the stamp that holds the queue after a rating while the learner
    walks away. Replayed as saved, it came back days before it was due.
    The client asks here before it resumes a saved queue and drops
    whatever comes back (hooks/useCardSession.js).

    Here rather than on each section's router because the question is
    the same for all of them -- a card's schedule is its (id, mode) row
    whichever screen served it -- and because Today, being mixed-mode,
    already speaks in (id, mode) pairs. Scoped by the caller's own
    prefix like every review endpoint, so it can only ever read the
    caller's rows.
    """
    pairs = [(f"{user_id}:{c.card_id}", c.mode) for c in payload.cards]
    stale = srs.get_stale(pairs)
    return {"stale": [
        {"card_id": unprefixed(card_id, user_id), "mode": mode}
        for card_id, mode in stale
    ]}
