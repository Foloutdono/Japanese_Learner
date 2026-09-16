from collections import defaultdict
from functools import lru_cache

from fastapi import APIRouter, Depends, Query
from content.kanji_data import KANJI_BY_LEVEL, DECK_BY_CHAR, kanji_to_id
from content.vocab_data import VOCAB_BY_LEVEL, vocab_to_id
from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL, entry_by_id, gloss, grammar_to_id
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
    GRAMMAR_STATUS_MODES,
)
from study.grammar_lesson import lesson_payload
from study import search_match
from study.kana_words import kana_words
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


# ── What a query MEANS, before any collection answers it ─────
# study/search_match.py: a term is matched folded (case and accents off,
# so "eleve" finds élève), against BOTH app languages rather than the one
# on screen, and — when it is romaji — against the kana it spells as
# well ("mizu" finds みず). A query that finds nothing at all is retried
# once against the nearest word the collection actually holds, so a typo
# is answered rather than reported as an empty catalogue.
#
# Each collection keeps its own predicate: the curated decks are lists
# filtered in Python, the two pools are SQLite tables answering in SQL,
# and writing either as the other is what the pools exist to avoid.
# `Query.hits` is the Python half; `Query.sql_text` / `Query.sql_kana`
# feed the SQL half.
#
# THE LEXICON A TYPO IS CORRECTED TOWARD is the collection's own glosses,
# built once per collection on the first search that finds nothing. A
# spell-checker's word list would be the obvious source and the wrong
# one: a correction to a word this catalogue does not hold sends the
# learner to a second empty page.


def _corrected(query, lexicon, found):
    """`query`, or the nearest spelling of it this catalogue does hold.

    Called ONLY when the strict search found nothing — a correction that
    fires while there are real results is not a kindness, it is the
    search quietly answering a different question. `found` is the
    collection's own "does this match anything", so a correction is
    never offered unless it actually leads somewhere.
    """
    if not query.correctable:
        return query
    for alt in search_match.corrections(query.latin, lexicon()):
        candidate = search_match.Query(alt, original=query.raw)
        if found(candidate):
            return candidate
    return query


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


def _levels_of(by_level: dict, level: str | None):
    """The (level, entries) pairs a request covers, in deck order.

    `level` is one JLPT level or None for all of them. An unrecognised
    one is all of them rather than none — the client narrowed, it did
    not ask a trick question (the same rule _grammar_matches has always
    taken).
    """
    if level not in by_level:
        return by_level.items()
    return [(level, by_level[level])]


def _kanji_deck_matches(query, lang: str, level: str | None = None) -> list[tuple[str, dict, str]]:
    """(level, entry, display meaning) for every deck kanji the query
    matches, in deck order — N5 first, N1 last. 2,235 rows, filtered in
    memory.

    Matched against BOTH glosses; SHOWN in the session's language. The
    displayed meaning is now built for the matches alone rather than for
    all 2,235 rows on the way past.
    """
    matches = []
    for lvl, kanji_list in _levels_of(KANJI_BY_LEVEL, level):
        for k in kanji_list:
            char = k.get("kanji", "")
            if query.empty or query.hits(
                jp_fields=(char, k.get("kana", "")),
                latin_fields=(k.get("meaning", ""), KANJI_FR_MAP.get(char, "")),
            ):
                matches.append((lvl, k, get_meaning(k, lang, KANJI_FR_MAP)))
    return matches


@lru_cache(maxsize=1)
def _kanji_lexicon() -> tuple[str, ...]:
    return search_match.lexicon(
        gloss
        for kanji_list in KANJI_BY_LEVEL.values()
        for k in kanji_list
        for gloss in (k.get("meaning", ""), KANJI_FR_MAP.get(k.get("kanji", ""), ""))
    )


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


def _kanji_collection(query, page: int, limit: int, lang: str,
                      radical: int | None, user_id: str,
                      level: str | None = None) -> dict:
    """One page of the merged kanji collection.

    `level` narrows to one JLPT level, and that means the app's own deck
    at that level and nothing else: a JLPT level is a fact about the
    course, and the 10,896 KANJIDIC characters the course does not teach
    have none — `level` is null on every one of them, which is exactly
    why the tile draws no badge. So a levelled request is a DECK request,
    the pool is not asked, and the count is the deck's own.

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
        rows, total = kanji_db.by_radical(
            radical, query.sql_text, limit, start, lang, query.sql_kana)
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
            "corrected": None,
        }

    levelled = level in KANJI_BY_LEVEL

    def found(cand):
        return bool(_kanji_deck_matches(cand, lang, level)) or (
            not levelled and kanji_db.count_matching(cand.sql_text, lang, cand.sql_kana))

    deck       = _kanji_deck_matches(query, lang, level)
    # The pool's total is needed on every request — it is most of the
    # collection's count — and its ROWS only once a page runs past the
    # deck, so the two are asked for separately (kanji_pool_data.page).
    pool_total = 0 if levelled else kanji_db.count_matching(query.sql_text, lang, query.sql_kana)

    if not deck and not pool_total:
        corrected = _corrected(query, _kanji_lexicon, found)
        if corrected is not query:
            query      = corrected
            deck       = _kanji_deck_matches(query, lang, level)
            pool_total = 0 if levelled else kanji_db.count_matching(
                query.sql_text, lang, query.sql_kana)

    deck_total = len(deck)
    deck_page  = deck[start:start + limit]

    # This page runs past the deck (wholly or partly). The offset is
    # into the POOL, not into the merged list: everything before
    # deck_total belongs to the deck, so the pool starts counting from
    # zero at that boundary.
    pool_page = (
        kanji_db.page(query.sql_text, limit=limit - len(deck_page),
                      offset=max(0, start - deck_total), kana_forms=query.sql_kana)
        if pool_total and len(deck_page) < limit else []
    )

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
        "corrected": query.raw if query.original else None,
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


def _deck_matches(query, lang: str, level: str | None = None) -> list[tuple[str, dict, str]]:
    """(level, entry, display meaning) for every curated-deck word the
    query matches, in deck order — N5 first, N1 last.

    Matched against BOTH glosses; SHOWN in the session's language. See
    the leniency note at the top of this module.
    """
    matches = []
    for lvl, vocab_list in _levels_of(VOCAB_BY_LEVEL, level):
        for w in vocab_list:
            if query.empty or query.hits(
                jp_fields=(w.get("kanji", ""), w.get("kana", "")),
                latin_fields=(
                    w.get("meaning", ""),
                    VOCAB_FR_MAP.get(w.get("kanji") or w.get("kana", ""), ""),
                ),
            ):
                matches.append((lvl, w, get_meaning(w, lang, VOCAB_FR_MAP)))
    return matches


@lru_cache(maxsize=1)
def _vocab_lexicon() -> tuple[str, ...]:
    return search_match.lexicon(
        gloss
        for vocab_list in VOCAB_BY_LEVEL.values()
        for w in vocab_list
        for gloss in (
            w.get("meaning", ""),
            VOCAB_FR_MAP.get(w.get("kanji") or w.get("kana", ""), ""),
        )
    )


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


def _exact_vocab(q: str, kana: str, lang: str, states: dict, user_id: str) -> dict | None:
    """The one entry whose (kanji, kana) pair is exactly what the caller
    asked for, or None.

    A caller holding a card already knows precisely which word it wants;
    searching by surface alone cannot express that, and gets it wrong.
    Measured over 400 real theme words, ~1.5% resolved to a DIFFERENT
    entry: homographs with another reading (国境/くにざかい opened
    こっきょう, 工場/こうば opened こうじょう) and short kana terms that
    substring-match a longer word (ラブ opened アラブ, ビア opened
    キャビア). The second kind cannot be fixed on the client — the right
    row is not on the page at all, because the collection is ordered by
    frequency rank and a two-mora word is a substring of dozens of
    commoner ones.

    The caller sends `dictTerm` = kanji || kana, so for a kana-only word
    both `q` and `kana` are the reading and the true pair is ("", kana);
    that is the second candidate below.
    """
    if not kana:
        return None
    pairs = [(q, kana)]
    if q == kana:
        pairs.append(("", kana))

    for kanji, reading in pairs:
        for level, vocab_list in VOCAB_BY_LEVEL.items():
            for w in vocab_list:
                # A deck reading can pack several forms ("まいげつ/まいつき").
                if w.get("kanji", "") == kanji and reading in w.get("kana", "").split("/"):
                    return _vocab_result(w, level, get_meaning(w, lang, VOCAB_FR_MAP),
                                         lang, states, user_id, vocab_to_id(w, level))
    for kanji, reading in pairs:
        entry = jmdict_db.get_by_key(kanji, reading)
        if entry is not None:
            return _vocab_result(entry, None, entry.get("meaning", ""), lang, states,
                                 user_id, vocab_jmdict_to_id(entry))
    return None


def _vocab_collection(query, page: int, limit: int, lang: str, user_id: str,
                      kana: str = "", level: str | None = None) -> dict:
    """One page of the merged vocabulary collection.

    Paginated at its two sources rather than by building one combined
    list and slicing it: materializing every pool row matching the query
    in Python is exactly what moving that pool into SQLite exists to
    avoid (see vocab_jmdict_data.py's memory note). The deck is small
    enough to filter in memory and always sorts first, so a page is
    `deck[start:start + limit]` topped up from the pool at whatever
    offset is left once the deck is behind us.

    `level` narrows to one JLPT level, and that means the curated deck
    at that level and nothing else — the 212k JMdict words the course
    does not teach carry no level, which is why their tiles draw no
    badge. A levelled request is a deck request, and the pool is not
    asked at all. See _kanji_collection, which says the same of its own.
    """
    levelled = level in VOCAB_BY_LEVEL

    def found(cand):
        return bool(_deck_matches(cand, lang, level)) or (
            not levelled and jmdict_db.count_matching(cand.sql_text, cand.sql_kana))

    deck = _deck_matches(query, lang, level)
    # The pool's total is needed on every request — it is half the
    # collection's count — and its ROWS only once a page runs past the
    # deck, so the two are asked for separately (vocab_jmdict_data.page).
    pool_total = 0 if levelled else jmdict_db.count_matching(query.sql_text, query.sql_kana)

    if not deck and not pool_total:
        corrected = _corrected(query, _vocab_lexicon, found)
        if corrected is not query:
            query      = corrected
            deck       = _deck_matches(query, lang, level)
            pool_total = 0 if levelled else jmdict_db.count_matching(
                query.sql_text, query.sql_kana)

    deck_total = len(deck)
    start      = page * limit
    deck_page  = deck[start:start + limit]

    # This page runs past the deck (wholly or partly). The offset is
    # into the POOL, not into the merged list: everything before
    # deck_total belongs to the deck, so the pool starts counting
    # from zero at that boundary.
    pool_page = (
        jmdict_db.page(query.sql_text, limit=limit - len(deck_page),
                       offset=max(0, start - deck_total), kana_forms=query.sql_kana)
        if pool_total and len(deck_page) < limit else []
    )

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

    # `kana` disambiguates rather than filters: the exact entry is moved
    # to the front of the first page, never added to the collection and
    # never removed from it, so `total`/`has_more` are untouched and
    # paging past page 0 behaves exactly as before.
    if kana and page == 0:
        exact = _exact_vocab(query.raw, kana, lang, states, user_id)
        if exact is not None:
            same = lambda r: (r["kanji"], r["kana"]) == (exact["kanji"], exact["kana"])
            results = [exact] + [r for r in results if not same(r)][:limit - 1]

    return {
        "results":  results,
        "total":    total,
        "page":     page,
        "limit":    limit,
        "has_more": start + limit < total,
        "corrected": query.raw if query.original else None,
    }


# ── The grammar collection ──────────────────────────────────
# The curated catalogue (content/grammar/*.json, plan 087), N5 → N1 in
# the catalogue's own order. One pool, small enough to filter and slice
# in memory — there is no JMdict behind it — so it takes the deck path
# the vocabulary collection reserves for its first 8,405 rows. A point's
# gloss, its lesson and its sentences' translations arrive in `lang`,
# the way the 文法 line's own cards print them.

_LEVELS = ("N5", "N4", "N3", "N2", "N1")


def _grammar_matches(query, level: str | None) -> list[tuple[str, dict]]:
    """(level, entry) for every point the query matches, catalogue order.

    The pattern is matched as typed (〜, ／ and all); the structure and
    both glosses folded, as _deck_matches folds a word's meaning. The
    structure is offered to both halves of the query because it is
    itself both — "動詞てform + から" is Japanese and English in one
    string. An unknown `level` is no level at all — the whole catalogue —
    rather than an empty page: the client narrowed, it did not ask a
    trick question.
    """
    levels = (level,) if level in _LEVELS else _LEVELS
    out = []
    for lvl in levels:
        for entry in GRAMMAR_POINTS_BY_LEVEL.get(lvl, []):
            structure = entry.get("structure", "")
            if query.empty or query.hits(
                jp_fields=(entry["pattern"], structure),
                latin_fields=(structure, gloss(entry, "en"), gloss(entry, "fr")),
            ):
                out.append((lvl, entry))
    return out


@lru_cache(maxsize=1)
def _grammar_lexicon() -> tuple[str, ...]:
    return search_match.lexicon(
        text
        for points in GRAMMAR_POINTS_BY_LEVEL.values()
        for entry in points
        for text in (gloss(entry, "en"), gloss(entry, "fr"), entry.get("structure", ""))
    )


def _grammar_result(entry: dict, level: str, states: dict, user_id: str, lang: str) -> dict:
    """A row of the collection, which is also the plate: the identity,
    the localised gloss, and the whole lesson (steps, rivals, examples
    with furigana and the pattern picked out — study/grammar_lesson)."""
    raw_id = grammar_to_id(entry, level)
    return {
        "type":      "grammar",
        "raw_id":    raw_id,
        "level":     level,
        "pattern":   entry["pattern"],
        "structure": entry.get("structure", ""),
        "meaning":   gloss(entry, lang),
        **lesson_payload(level, entry, lang),
        "status":    card_stats(states, user_id, raw_id, GRAMMAR_STATUS_MODES),
    }


def _grammar_collection(query, page: int, limit: int, level: str | None,
                        grammar_id: str, user_id: str, lang: str) -> dict:
    """One page of the grammar collection.

    `grammar_id` disambiguates rather than filters, exactly as `kana`
    does for a word: the point it names is moved to the front of page 0
    — whether or not `q` or `level` would have found it — and nothing
    else about the response changes, so `total` / `has_more` and every
    later page are what they would be without it. An id that names
    nothing leaves the page alone; the client that asked for an exact
    entry can see it is not on the page (see useDictionaryLookup).
    """
    matches = _grammar_matches(query, level)
    if not matches:
        corrected = _corrected(query, _grammar_lexicon,
                               lambda cand: bool(_grammar_matches(cand, level)))
        if corrected is not query:
            query   = corrected
            matches = _grammar_matches(query, level)
    total   = len(matches)
    start   = page * limit
    page_matches = matches[start:start + limit]

    exact = entry_by_id(grammar_id) if (grammar_id and page == 0) else None

    states = srs.get_user_states(user_id) if (page_matches or exact) else {}

    results = [_grammar_result(entry, lvl, states, user_id, lang) for lvl, entry in page_matches]

    if exact is not None:
        lvl, entry = exact
        first = _grammar_result(entry, lvl, states, user_id, lang)
        results = [first] + [r for r in results if r["raw_id"] != first["raw_id"]][:limit - 1]

    return {
        "results":  results,
        "total":    total,
        "page":     page,
        "limit":    limit,
        "has_more": start + limit < total,
        "corrected": query.raw if query.original else None,
    }


@router.get("/api/dictionary")
def get_dictionary(q: str = "", page: int = 0, limit: int = Query(50, ge=1, le=200), lang: str = "fr",
                    category: str = "all", radical: int | None = None, kana: str = "",
                    level: str | None = None, id: str = "",
                    user_id: str = Depends(get_user_id)):
    """
    category: "all" | "kanji" | "vocab" | "grammar" | "hiragana" | "katakana"
    — lets the client avoid pulling in thousands of vocab entries when
    only kanji (or vice versa) are wanted.

    q: matched LENIENTLY — folded (case and accents off), against both
    app languages rather than the one on screen, against the kana a
    romaji term spells, and, when it finds nothing at all, once more
    against the nearest word the collection holds. `corrected` is that
    word when it fired and null otherwise, so the screen can say which
    question it answered. study/search_match.py is the whole of it.

    "grammar" is the curated catalogue the 文法 line studies
    (content/grammar/*.json), N5 → N1, each row the whole lesson: gloss,
    steps, rivals and example sentences, in `lang` (plan 087). One
    parameter is its alone and ignored elsewhere: `id`,
    a grammar card id to move to the front of page 0 — the
    same disambiguator `kana` is for a word. It travels as a query
    parameter and never as a path segment, because a grammar id embeds
    the pattern itself, ／ and 〜 included (routes/decks.py says the
    same of the ids it deletes by).

    level: one JLPT level, or nothing for all of them (and anything
    unrecognised is all of them — the client narrowed, it did not ask a
    trick question). It narrows kanji, vocabulary and grammar, which are
    the three collections filed on that axis; the two syllabary charts
    are fixed and have none. For kanji and vocabulary a level means the
    app's own deck at that level and NOTHING ELSE: the JMdict and
    KANJIDIC pools behind those collections carry no level — that is why
    their tiles draw no badge — so a levelled request is a deck request
    and the pool is not asked. See _vocab_collection.

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

    kana: the exact reading of an entry the caller already has in hand —
    a DISAMBIGUATOR, not a filter. Given it, the entry whose
    (kanji, kana) pair matches exactly is moved to the front of page 0;
    everything else about the response is unchanged. Vocabulary only:
    a kanji or a kana character has no second key to disambiguate with.
    See _exact_vocab for what it fixes.

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

    # Parsed ONCE, here: the romaji conversion and the fold are the same
    # work whichever collection answers, and doing them per row is
    # exactly what this replaces.
    query = search_match.parse(q)

    # The vocabulary collection is served whole, from its own branch:
    # nothing else shares its page, so it can paginate at its two
    # sources (see _vocab_collection) rather than joining the general
    # matches-list-then-slice path below, which would mean holding
    # every matching JMdict row in Python first. Radical browsing is
    # kanji only, so a radical request never lands here.
    if category in ("vocab", "jmdict") and radical is None:
        return _vocab_collection(query, page, limit, lang, user_id, kana, level)

    # Grammar has one pool and it is in memory; its branch exists so the
    # `level` / `id` parameters have somewhere to go, not for paging.
    if category == "grammar" and radical is None:
        return _grammar_collection(query, page, limit, level, id, user_id, lang)

    # Same escape for kanji, and a radical request comes here too: radical
    # browsing is kanji-only by nature, and _kanji_collection serves it
    # from the database in stroke order (see its docstring).
    if category == "kanji" or radical is not None:
        return _kanji_collection(query, page, limit, lang, radical, user_id, level)

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
        for lvl, k, meaning in _kanji_deck_matches(query, lang, level):
            matches.append(("kanji", lvl, k, meaning))

    if want_vocab:
        for lvl, w, meaning in _deck_matches(query, lang, level):
            matches.append(("vocab", lvl, w, meaning))

    # The WHOLE syllabary, not the gojūon alone: きゃ and えい are kana a
    # reader meets in their first week and could not look up here at
    # all, because this walked the basic set and nothing else.
    if want_hiragana:
        for k in get_syllabary("hiragana"):
            if query.empty or query.hits(jp_fields=(k["kana"],), latin_fields=(k["romaji"],)):
                # Reuses the tuple's "meaning" slot for romaji — it's
                # what dict-entry-card__meaning and the detail panel's
                # "Sens" row already read regardless of entry kind.
                matches.append(("hiragana", "Hiragana", k, k["romaji"]))

    if want_katakana:
        for k in get_syllabary("katakana"):
            if query.empty or query.hits(jp_fields=(k["kana"],), latin_fields=(k["romaji"],)):
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
    for kind, lvl, entry, meaning in page_matches:
        if kind == "kanji":
            results.append(_deck_kanji_result(
                lvl, entry, meaning, lang, states, user_id,
            ))
        elif kind == "vocab":
            results.append(_vocab_result(
                entry, lvl, meaning, lang, states, user_id, vocab_to_id(entry, lvl),
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
                "level":   lvl,
                # Which gojūon row this belongs to (k/s/t/n/h/m/y/r/w/
                # vowels/n_solo, or the voiced g/z/d/b/p rows) — see
                # kana_data.py. The frontend's syllabary table groups by
                # this field to lay out the classic a-i-u-e-o chart.
                "group":   entry.get("group", ""),
                "svg_url": svg_url,
                "status":  card_stats(states, user_id, raw_id, KANA_STATUS_MODES),
                # The words the kana is read in -- the kanji ledger's
                # field, under the kanji ledger's name, because the
                # panel draws the two blocks with one component
                # (plan 088). Empty for the handful of kana ordinary
                # writing has no word for, and the block then prints
                # nothing; see study/kana_words.py.
                "vocab_examples": kana_words(entry["kana"], lang),
            })

    return {
        "results":  results,
        "total":    total,
        "page":     page,
        "limit":    limit,
        "has_more": end < total,
        "corrected": None,
    }