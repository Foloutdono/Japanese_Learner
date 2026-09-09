from collections import defaultdict

from fastapi import APIRouter, Depends, Query
from content.kanji_data import KANJI_BY_LEVEL, DECK_BY_CHAR, kanji_to_id
from content.vocab_data import VOCAB_BY_LEVEL, vocab_to_id
import content.vocab_jmdict_data as jmdict_db
import content.kanji_pool_data as kanji_db
from content.vocab_jmdict_data import vocab_jmdict_to_id
from content.vocab_extras import get_vocab_extras
from content.kana_data import get_syllabary, kana_to_id
# radical_data.py owns the radical dumps -- its own docstring says so
# ("read once at import rather than per consumer") -- but this module used
# to open kanji_radicals.json a second time anyway, and exam_kanji_gen.py a
# third. One owner now, and KANJI_RADICALS is the deck-scoped table rather
# than all 13,108 rows; anything outside the deck comes from the database.
from content.radical_data import KANJI_RADICALS, RADICAL_BY_NUMBER
from translations import get_meaning
from content.kanji_meanings import KANJI_FR
from translations.fr.vocab_fr import VOCAB_FR
from core.auth import get_user_id
from core.srs_instance import srs
from study.card_lookup import (
    card_stats, VOCAB_STATUS_MODES, KANJI_STATUS_MODES, KANA_STATUS_MODES,
)
from study.kanji_words import kanji_as_word, kanji_words, word_furigana

router = APIRouter()


KANJI_FR_MAP = KANJI_FR
VOCAB_FR_MAP = VOCAB_FR

# The radical tiles used to be scoped to the app's own deck -- a tile
# leading to zero results a learner could study was worth hiding. Now that
# the collection carries the whole of KANJIDIC2 no radical leads nowhere,
# so the scoping (and _build_app_radical_index with it) is gone, and the
# per-tile count is the one radicals.json always carried: its kanji_count
# fields sum to exactly 13,108, and this module was overriding them with a
# deck-only recount.


@router.get("/api/dictionary/radicals")
def get_radical_grid(all: bool = False):
    """
    Radical tiles for the 'browse by radical' picker, grouped by stroke
    count (1 stroke, 2 strokes, ...) — exactly what a tappable grid needs.

    All 214, always. This used to serve only the radicals with at least one
    kanji in the app's own deck — 194 of them — on the reasoning that a
    tile leading to zero studiable results was not worth offering. The
    collection is the whole of KANJIDIC2 now (see _kanji_collection), so
    every radical leads somewhere and the other twenty are no longer a
    dead end. `kanji_count` is radicals.json's own field, which counts
    against the full dump; this endpoint used to override it with a
    deck-only recount.

    `all` is kept because the personal-card form passes it — the learner
    filing THEIR OWN kanji under a radical needs every one selectable —
    but the two sets have converged and it no longer changes the answer.
    """
    by_stroke = defaultdict(list)
    for number, r in RADICAL_BY_NUMBER.items():
        by_stroke[r["stroke_count"]].append({
            "number":      number,
            "char":        r["char"],
            "kanji_count": r["kanji_count"],
        })

    groups = [
        {"stroke_count": stroke_count, "radicals": sorted(radicals, key=lambda r: r["number"])}
        for stroke_count, radicals in sorted(by_stroke.items())
    ]
    return {"groups": groups}


# ── The kanji collection ─────────────────────────────────────────
# ONE collection over two pools, for the same reason the vocabulary is
# (see the block below, and commit 116ad2a). The app's own JLPT deck is
# 2,235 entries over 2,212 characters; KANJIDIC2, which this repo has
# shipped all along, has 13,108. The other 10,896 were reachable from
# nowhere in the app — not by search, not by radical, not on a plate — so
# looking a character up and not finding it proved only that it was not
# one of the ~2,200 the course teaches, which is not what a dictionary is
# for.
#
# The two halves are disjoint by construction: kanji_pool_data serves
# `in_deck = 0`, and in_deck is set from this very deck when the database
# is built, so concatenating them cannot list a character twice.
#
# Order is the deck entire, N5 → N1, then the pool by sort_rank (KANJIDIC
# frequency first, then jōyō/jinmeiyō by grade, then by strokes — see
# scripts/build_kanji_db.py). The characters a learner's own course
# teaches come before the ones it doesn't, and past that the commonest
# character a query matches is the one they almost certainly meant.


def _kanji_deck_matches(q: str, lang: str) -> list[tuple[str, dict, str]]:
    """(level, entry, display meaning) for every deck kanji matching `q`,
    in deck order — N5 first, N1 last. 2,235 rows, filtered in memory."""
    matches = []
    for level, kanji_list in KANJI_BY_LEVEL.items():
        for k in kanji_list:
            meaning = get_meaning(k, lang, KANJI_FR_MAP)
            if q == "" or (
                q in k.get("kanji", "") or
                q in k.get("kana",  "") or
                q.lower() in meaning.lower()
            ):
                matches.append((level, k, meaning))
    return matches


def _kanji_result(char: str, kana: str, meaning: str, level: str | None,
                  stroke_count, radical, has_svg: bool,
                  lang: str, states: dict, user_id: str, raw_id: str | None,
                  packed_readings: str | None = None) -> dict:
    """One kanji as the catalogue serves it. Identical shape for a deck
    character and a pool one — `level` is null for the pool, and
    LevelBadge already renders nothing when it is falsy.

    Two fields carry the difference honestly rather than by faking one:

    `status` is None for a pool character. It has no SRS card (this merge
    deliberately adds no card ids), and the frontend already reads that
    as "no stage": DictionaryScreen's stageOf(entry.status?.status)
    returns null, so the tile draws no stage edge and no screen-reader
    stage word.

    `svg_url` is None when KanjiVG shipped no diagram — 6,692 of the pool
    have none, where the deck is at 100% and so nothing here has ever had
    to handle it. This is not a new convention: the kana branch below
    already serves None for a digraph, DictionaryDetail's `hasSheet`
    already draws the plate without a sheet (re-flowing its figure
    columns), and test_kana_syllabary pins it.
    """
    codepoint = hex(ord(char))[2:].zfill(5)
    # Both the "used in these words" ledger and the per-reading panel come
    # from one grouping pass -- see study/kanji_words.py.
    words = kanji_words(char, lang, packed_readings)
    return {
        "type":         "kanji",
        "kanji":        char,
        "kana":         kana,
        # How the character is read when it IS a word (山 → やま). The
        # catalogue tile prints its reading as furigana and a word's own
        # reading is what that annotation means; the character's full
        # list is the plate's business.
        "word_reading": kanji_as_word(char),
        "meaning":      meaning,
        "stroke_count": stroke_count,
        "radical":      radical,
        "level":        level,
        "svg_url":      f"/kanjivg/{codepoint}.svg" if has_svg else None,
        "status":       card_stats(states, user_id, raw_id, KANJI_STATUS_MODES)
                        if raw_id else None,
        "vocab_examples": words["examples"],
        # Every reading in the deck's order, each with the words that use
        # it -- the plate shows two, the panel all.
        "readings":     words["readings"],
    }


def _deck_kanji_result(level: str, entry: dict, meaning: str, lang: str,
                       states: dict, user_id: str) -> dict:
    char = entry["kanji"]
    info = KANJI_RADICALS.get(char)
    return _kanji_result(
        char,
        entry.get("kana", ""),
        meaning,
        level,
        # kanji_data.py entries don't carry their own stroke count —
        # fall back to the value derived from KANJIDIC2.
        entry.get("stroke_count") or (info["stroke_count"] if info else ""),
        info["radical"] if info else None,
        char in _DECK_HAS_SVG,
        lang, states, user_id, kanji_to_id(entry, level),
    )


def _pool_kanji_result(row: dict, lang: str, states: dict, user_id: str) -> dict:
    """A KANJIDIC2 character the deck does not teach. Its meaning is
    served as KANJIDIC wrote it — French where there is one (73 of
    10,896), English otherwise, the same fallback the deck's own 219
    French gaps already take."""
    return _kanji_result(
        row["char"], row["readings"], kanji_db.meaning_of(row, lang), None,
        row["stroke_count"], row["radical"], bool(row["has_svg"]),
        lang, states, user_id, None,
        # The database row already carries the readings in the deck's own
        # packed format, so the ledger is grouped without a second query.
        packed_readings=row["readings"],
    )


# Which deck characters have a stroke diagram, resolved in one bounded
# query at import rather than a lookup per row per request. It is all
# 2,212 of them today; asked rather than assumed so a KanjiVG refresh that
# drops one cannot leave the plate pointing at a 404.
_DECK_HAS_SVG = kanji_db.svg_chars(DECK_BY_CHAR)


def _kanji_collection(q: str, page: int, limit: int, lang: str,
                      radical: int | None, user_id: str) -> dict:
    """One page of the merged kanji collection.

    Paginated at its two sources rather than by building one combined list
    and slicing it — the same reason _vocab_collection is. The deck is
    small enough to filter in memory and always sorts first, so a page is
    `deck[start:start + limit]` topped up from the pool at whatever offset
    is left once the deck is behind us.

    RADICAL BROWSING IS DIFFERENT, and served whole from the database. A
    radical index is filed in stroke order, the way a paper 漢和辞典 files
    it — not deck-then-pool — so splitting it across two sources would
    interleave wrongly. One indexed query over the whole table gives the
    right order directly. It is also keyed by CHARACTER, so the 23 kanji
    the deck teaches at two levels appear once there rather than twice;
    a radical index listing a character twice was never right.
    """
    start = page * limit

    if radical is not None:
        rows, total = kanji_db.by_radical(radical, q, limit, start, lang)
        states = srs.get_user_states(user_id) if rows else {}
        results = []
        for row in rows:
            deck_hit = DECK_BY_CHAR.get(row["char"])
            if deck_hit is None:
                results.append(_pool_kanji_result(row, lang, states, user_id))
                continue
            # A deck character keeps the deck's own level, packed reading
            # and curated (translated) meaning -- the database row is the
            # index that found it, not a second source of truth for it.
            level, entry = deck_hit
            results.append(_deck_kanji_result(
                level, entry, get_meaning(entry, lang, KANJI_FR_MAP),
                lang, states, user_id,
            ))
        return {
            "results": results, "total": total, "page": page, "limit": limit,
            "has_more": start + limit < total,
        }

    deck       = _kanji_deck_matches(q, lang)
    deck_total = len(deck)
    deck_page  = deck[start:start + limit]

    if len(deck_page) < limit:
        # This page runs past the deck (wholly or partly). The offset is
        # into the POOL, not into the merged list: everything before
        # deck_total belongs to the deck, so the pool starts counting from
        # zero at that boundary.
        pool_page, pool_total = kanji_db.search(
            q, limit=limit - len(deck_page), offset=max(0, start - deck_total),
            lang=lang,
        )
    else:
        # A page entirely inside the deck still needs the pool's count for
        # the collection total — but not a single one of its rows.
        pool_page, pool_total = [], kanji_db.count_matching(q, lang)

    total = deck_total + pool_total

    # One bulk SRS fetch for the whole page. Only the deck half can have
    # any state, but the fetch is per user, not per card, so it is one
    # call either way.
    states = srs.get_user_states(user_id) if deck_page else {}

    results = [
        _deck_kanji_result(level, entry, meaning, lang, states, user_id)
        for level, entry, meaning in deck_page
    ] + [
        _pool_kanji_result(row, lang, states, user_id) for row in pool_page
    ]

    return {
        "results":  results,
        "total":    total,
        "page":     page,
        "limit":    limit,
        "has_more": start + limit < total,
    }


# ── The vocabulary collection ────────────────────────────────────
# ONE collection over two pools. The app's own curated JLPT deck
# (vocab_data.py, 8,405 levelled words) used to be the "vocab" tab and
# the rest of JMdict (vocab_jmdict_data.py, 212,460 entries) a separate
# "jmdict" tab beside it, which meant a learner who searched the
# vocabulary and found nothing had to know that a second, differently
# named collection existed before they could conclude the word was not
# in the app at all.
#
# The two pools are disjoint by construction — the JMdict pool is built
# as "every term/reading pair NOT already in the deck" (verified: zero
# of the deck's 8,405 words have a pool row) — so concatenating them
# cannot show a word twice.
#
# Order is the deck entire, N5 → N1, then the pool by frequency rank.
# The words a learner's own course teaches come before the ones it
# doesn't, and past that the commonest reading of a query is the one
# they almost certainly meant.


def _deck_matches(q: str, lang: str) -> list[tuple[str, dict, str]]:
    """(level, entry, display meaning) for every curated-deck word
    matching `q`, in deck order — N5 first, N1 last."""
    matches = []
    for level, vocab_list in VOCAB_BY_LEVEL.items():
        for w in vocab_list:
            meaning = get_meaning(w, lang, VOCAB_FR_MAP)
            if q == "" or (
                q in w.get("kanji", "") or
                q in w.get("kana", "") or
                q.lower() in meaning.lower()
            ):
                matches.append((level, w, meaning))
    return matches


def _vocab_result(entry: dict, level: str | None, meaning: str, lang: str,
                  states: dict, user_id: str, raw_id: str) -> dict:
    """One word as the catalogue serves it. Identical shape for a deck
    word and a pool word — `level` is the only field that separates
    them, and it is null for the pool (LevelBadge on the frontend
    already renders nothing when it is falsy)."""
    # lang is forwarded so tag chips (and the "tooltip" note text behind
    # them) come back in whichever language the client is actually
    # displaying — get_vocab_extras defaults to "fr" otherwise, which
    # used to leak French labels into English sessions.
    #
    # The hint stays the entry's OWN English gloss rather than the
    # translated `meaning`: _select_primary matches it against JMdict's
    # English senses to decide which one the app's gloss refers to, so a
    # French string would match nothing and lose the primary sense.
    extras = get_vocab_extras(
        entry.get("kanji", ""), entry.get("kana", ""), entry.get("meaning", ""), lang,
    )
    return {
        "type":     "vocab",
        "kanji":    entry.get("kanji", ""),
        "kana":     entry.get("kana", ""),
        "meaning":  meaning,
        "level":    level,
        # Every JMdict sense (not just the app's own single gloss) —
        # lets the detail panel show the fuller dictionary picture
        # instead of only the one meaning.
        "senses":   extras["senses"],
        "examples": extras["examples"],
        "furigana": word_furigana(entry.get("kanji", ""), entry.get("kana", "")),
        "status":   card_stats(states, user_id, raw_id, VOCAB_STATUS_MODES),
    }


def _vocab_collection(q: str, page: int, limit: int, lang: str, user_id: str) -> dict:
    """One page of the merged vocabulary collection.

    Paginated at its two sources rather than by building one combined
    list and slicing it: materializing every pool row matching `q` in
    Python is exactly what moving that pool into SQLite exists to avoid
    (see vocab_jmdict_data.py's memory note). The deck is small enough
    to filter in memory and always sorts first, so a page is
    `deck[start:start + limit]` topped up from the pool at whatever
    offset is left once the deck is behind us.
    """
    deck       = _deck_matches(q, lang)
    deck_total = len(deck)

    start     = page * limit
    deck_page = deck[start:start + limit]

    if len(deck_page) < limit:
        # This page runs past the deck (wholly or partly). The offset is
        # into the POOL, not into the merged list: everything before
        # deck_total belongs to the deck, so the pool starts counting
        # from zero at that boundary.
        pool_page, pool_total = jmdict_db.search(
            q, limit=limit - len(deck_page), offset=max(0, start - deck_total),
        )
    else:
        # A page entirely inside the deck still needs the pool's count
        # for the collection total — but not a single one of its rows.
        pool_page, pool_total = [], jmdict_db.count_matching(q)

    total = deck_total + pool_total

    # One bulk SRS fetch for the whole page, deck words and pool words
    # alike; card_stats is then a cheap in-memory lookup per entry.
    states = srs.get_user_states(user_id) if (deck_page or pool_page) else {}

    results = [
        _vocab_result(entry, level, meaning, lang, states, user_id,
                      vocab_to_id(entry, level))
        for level, entry, meaning in deck_page
    ] + [
        # The pool carries no French map (VOCAB_FR is the deck's own,
        # keyed by kanji alone — a pool homograph would collect the
        # deck word's translation), so its gloss is served as JMdict
        # wrote it.
        _vocab_result(entry, None, entry.get("meaning", ""), lang, states, user_id,
                      vocab_jmdict_to_id(entry))
        for entry in pool_page
    ]

    return {
        "results":  results,
        "total":    total,
        "page":     page,
        "limit":    limit,
        "has_more": start + limit < total,
    }


@router.get("/api/dictionary")
def get_dictionary(q: str = "", page: int = 0, limit: int = Query(50, ge=1, le=200), lang: str = "fr",
                    category: str = "all", radical: int | None = None,
                    user_id: str = Depends(get_user_id)):
    """
    category: "all" | "kanji" | "vocab" | "hiragana" | "katakana"
    — lets the client avoid pulling in thousands of vocab entries when
    only kanji (or vice versa) are wanted.

    "vocab" is the whole vocabulary: the app's curated JLPT deck first
    (N5 → N1), then the rest of JMdict by frequency rank. See
    _vocab_collection above for why the two are one collection and how
    a page spans them.

    "jmdict" is accepted as an alias of "vocab" — it used to be a
    collection of its own, and a client still holding the old console
    (or a bookmarked URL) should land on the merged list rather than on
    an empty one.

    "all" is the exception: it stays the curated cross-collection
    browse — kanji + the JLPT deck + kana — because it merges its
    sources in memory before slicing, which the 212k-row JMdict pool
    cannot join without undoing the whole reason that pool lives in
    SQLite. Nothing in the app asks for it; it is the parameter's
    default and the shape a bare GET returns.

    radical: classical (Kangxi) radical number. When given, restricts
    results to kanji filed under that radical — vocab and kana don't
    participate in radical browsing (a word can span several kanji, and
    kana have no radical at all), so this implicitly narrows to kanji
    regardless of `category`. Results are sorted by remaining
    stroke count (total strokes minus the radical's own), same order as
    a paper 漢和辞典.
    """
    if radical is not None and radical not in RADICAL_BY_NUMBER:
        return {"error": "Unknown radical"}

    # The vocabulary collection is served whole, from its own branch:
    # nothing else shares its page, so it can paginate at its two
    # sources (see _vocab_collection) rather than joining the general
    # matches-list-then-slice path below, which would mean holding
    # every matching JMdict row in Python first. Radical browsing is
    # kanji only, so a radical request never lands here.
    if category in ("vocab", "jmdict") and radical is None:
        return _vocab_collection(q, page, limit, lang, user_id)

    # Same escape for kanji, and a radical request comes here too: radical
    # browsing is kanji-only by nature, and _kanji_collection serves it
    # from the database in stroke order (see its docstring).
    if category == "kanji" or radical is not None:
        return _kanji_collection(q, page, limit, lang, radical, user_id)

    matches = []  # (kind, level, entry, meaning) — cheap, no SRS lookups yet

    # Everything that reaches here has radical=None: category="kanji",
    # category="vocab" and every radical request returned above, pool and
    # all. What this path serves is the curated decks alone — "all" over
    # kanji + vocab + kana — plus the two single-collection kana browses.
    want_kanji    = category == "all"
    want_vocab    = category == "all"
    want_hiragana = category in ("all", "hiragana")
    want_katakana = category in ("all", "katakana")

    if want_kanji:
        for level, kanji_list in KANJI_BY_LEVEL.items():
            for k in kanji_list:
                meaning = get_meaning(k, lang, KANJI_FR_MAP)
                if q == "" or (
                    q in k.get("kanji", "") or
                    q in k.get("kana",  "") or
                    q.lower() in meaning.lower()
                ):
                    matches.append(("kanji", level, k, meaning))

    if want_vocab:
        for level, w, meaning in _deck_matches(q, lang):
            matches.append(("vocab", level, w, meaning))

    # The WHOLE syllabary, not the gojūon alone: きゃ and えい are kana a
    # reader meets in their first week and could not look up here at
    # all, because this walked the basic set and nothing else.
    if want_hiragana:
        for k in get_syllabary("hiragana"):
            if q == "" or (q in k["kana"] or q.lower() in k["romaji"].lower()):
                # Reuses the tuple's "meaning" slot for romaji — it's
                # what dict-entry-card__meaning and the detail panel's
                # "Sens" row already read regardless of entry kind.
                matches.append(("hiragana", "Hiragana", k, k["romaji"]))

    if want_katakana:
        for k in get_syllabary("katakana"):
            if q == "" or (q in k["kana"] or q.lower() in k["romaji"].lower()):
                matches.append(("katakana", "Katakana", k, k["romaji"]))

    total        = len(matches)
    start        = page * limit
    end          = start + limit
    page_matches = matches[start:end]

    # Only fetch/annotate SRS progress for the page actually being returned.
    # get_user_states does one bulk fetch for the whole user; card_stats is
    # then a cheap in-memory lookup per entry.
    states = srs.get_user_states(user_id) if page_matches else {}

    results = []
    for kind, level, entry, meaning in page_matches:
        if kind == "kanji":
            results.append(_deck_kanji_result(
                level, entry, meaning, lang, states, user_id,
            ))
        elif kind == "vocab":
            results.append(_vocab_result(
                entry, level, meaning, lang, states, user_id, vocab_to_id(entry, level),
            ))
        else:  # hiragana or katakana
            raw_id = kana_to_id(entry)
            # A stroke file is one character's, and a kana here is not
            # always one character: きゃ is two, and so is every long
            # vowel. A pair gets no sheet rather than an arbitrary half
            # of one — the panel simply draws the rest of the entry
            # (DictionaryDetail's `hasSheet`).
            kana = entry["kana"]
            svg_url = (
                f"/kanjivg/{hex(ord(kana))[2:].zfill(5)}.svg"
                if len(kana) == 1
                else None
            )
            results.append({
                "type":    kind,
                "kana":    entry["kana"],
                "romaji":  entry["romaji"],
                "meaning": meaning,
                "level":   level,
                # Which gojūon row this belongs to (k/s/t/n/h/m/y/r/w/
                # vowels/n_solo, or the voiced g/z/d/b/p rows) — see
                # kana_data.py. The frontend's syllabary table groups by
                # this field to lay out the classic a-i-u-e-o chart.
                "group":   entry.get("group", ""),
                "svg_url": svg_url,
                "status":  card_stats(states, user_id, raw_id, KANA_STATUS_MODES),
            })

    return {
        "results":  results,
        "total":    total,
        "page":     page,
        "limit":    limit,
        "has_more": end < total,
    }