import json
import os
from collections import defaultdict

from fastapi import APIRouter, Depends, Query
from content.kanji_data import KANJI_BY_LEVEL, kanji_to_id
from content.vocab_data import VOCAB_BY_LEVEL, vocab_to_id
import content.vocab_jmdict_data as jmdict_db
from content.vocab_jmdict_data import vocab_jmdict_to_id
from content.vocab_extras import get_vocab_extras
from content.kana_data import get_syllabary, kana_to_id
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

# Path to backend/
_BASE_DIR = os.path.dirname(os.path.dirname(__file__))

# Path to kanji_data/
_DATA_DIR = os.path.join(_BASE_DIR, "datas", "kanji")

with open(os.path.join(_DATA_DIR, "radicals.json"), encoding="utf-8") as f:
    _ALL_RADICALS = json.load(f)

with open(os.path.join(_DATA_DIR, "kanji_radicals.json"), encoding="utf-8") as f:
    KANJI_RADICALS = json.load(f)

RADICAL_BY_NUMBER = {r["number"]: r for r in _ALL_RADICALS}


def _build_app_radical_index():
    """
    (radical number) -> [(level, kanji_entry), ...], scoped to kanji that
    actually exist in this app's own deck (KANJI_BY_LEVEL) rather than the
    full ~13k KANJIDIC2 set — no point showing a radical tile that leads
    to zero results the user can actually study.

    Computed once at import time; the content universe is static.
    """
    grouped = defaultdict(list)
    for level, kanji_list in KANJI_BY_LEVEL.items():
        for k in kanji_list:
            info = KANJI_RADICALS.get(k["kanji"])
            if info is None:
                continue  # not found in the KANJIDIC2 dump — skip silently
            grouped[info["radical"]].append((level, k))
    return grouped


_APP_RADICAL_KANJI = _build_app_radical_index()

@router.get("/api/dictionary/radicals")
def get_radical_grid(all: bool = False):
    """
    Radical tiles for the 'browse by radical' picker, grouped by stroke
    count (1 stroke, 2 strokes, ...) — exactly what a tappable grid needs.

    By default only radicals with at least one kanji in the app's own deck
    are included: there is no point offering a tile that leads to zero
    results a learner can study.

    `all=true` returns all 214. That is for the personal-card form, where
    the learner is filing THEIR OWN kanji under a radical — which may
    easily be one the app's 2,235-kanji deck never uses. Silently
    truncating the list there would make a correct answer unselectable.
    """
    by_stroke = defaultdict(list)
    numbers = RADICAL_BY_NUMBER.keys() if all else _APP_RADICAL_KANJI.keys()
    for number in numbers:
        r = RADICAL_BY_NUMBER.get(number)
        if r is None:
            continue
        by_stroke[r["stroke_count"]].append({
            "number":      number,
            "char":        r["char"],
            "kanji_count": len(_APP_RADICAL_KANJI.get(number, ())),
        })

    groups = [
        {"stroke_count": stroke_count, "radicals": sorted(radicals, key=lambda r: r["number"])}
        for stroke_count, radicals in sorted(by_stroke.items())
    ]
    return {"groups": groups}


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


def _vocab_collection(q: str, page: int, limit: int, lang: str, user_id: str,
                      kana: str = "") -> dict:
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

    # `kana` disambiguates rather than filters: the exact entry is moved
    # to the front of the first page, never added to the collection and
    # never removed from it, so `total`/`has_more` are untouched and
    # paging past page 0 behaves exactly as before.
    if kana and page == 0:
        exact = _exact_vocab(q, kana, lang, states, user_id)
        if exact is not None:
            same = lambda r: (r["kanji"], r["kana"]) == (exact["kanji"], exact["kana"])
            results = [exact] + [r for r in results if not same(r)][:limit - 1]

    return {
        "results":  results,
        "total":    total,
        "page":     page,
        "limit":    limit,
        "has_more": start + limit < total,
    }


@router.get("/api/dictionary")
def get_dictionary(q: str = "", page: int = 0, limit: int = Query(50, ge=1, le=200), lang: str = "fr",
                    category: str = "all", radical: int | None = None, kana: str = "",
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

    # The vocabulary collection is served whole, from its own branch:
    # nothing else shares its page, so it can paginate at its two
    # sources (see _vocab_collection) rather than joining the general
    # matches-list-then-slice path below, which would mean holding
    # every matching JMdict row in Python first. Radical browsing is
    # kanji only, so a radical request never lands here.
    if category in ("vocab", "jmdict") and radical is None:
        return _vocab_collection(q, page, limit, lang, user_id, kana)

    matches = []  # (kind, level, entry, meaning) — cheap, no SRS lookups yet

    want_kanji    = category in ("all", "kanji")    or radical is not None
    # "all" only — category="vocab" returned above, pool and all. What
    # this path adds is the curated deck alone; see the docstring.
    want_vocab    = category == "all"               and radical is None
    want_hiragana = category in ("all", "hiragana") and radical is None
    want_katakana = category in ("all", "katakana") and radical is None

    if want_kanji:
        for level, kanji_list in KANJI_BY_LEVEL.items():
            for k in kanji_list:
                if radical is not None:
                    info = KANJI_RADICALS.get(k["kanji"])
                    if info is None or info["radical"] != radical:
                        continue
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

    if radical is not None:
        radical_stroke_count = RADICAL_BY_NUMBER[radical]["stroke_count"]

        def remaining_strokes(match):
            _, _, entry, _ = match
            info = KANJI_RADICALS.get(entry["kanji"])
            total = info["stroke_count"] if info else 0
            return total - radical_stroke_count

        matches.sort(key=remaining_strokes)

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
            raw_id    = kanji_to_id(entry, level)
            codepoint = hex(ord(entry["kanji"]))[2:].zfill(5)
            info      = KANJI_RADICALS.get(entry["kanji"])
            # Both the "used in these words" ledger and the per-reading
            # panel come from one grouping pass -- see study/kanji_words.py.
            words = kanji_words(entry["kanji"], lang)
            results.append({
                "type":         "kanji",
                "kanji":        entry["kanji"],
                "kana":         entry.get("kana", ""),
                # How the character is read when it IS a word (山 → やま).
                # The catalogue tile prints its reading as furigana and
                # a word's own reading is what that annotation means;
                # the character's full list is the plate's business.
                "word_reading": kanji_as_word(entry["kanji"]),
                "meaning":      meaning,
                # kanji_data.py entries don't carry their own stroke count —
                # fall back to the value derived from KANJIDIC2.
                "stroke_count": entry.get("stroke_count") or (info["stroke_count"] if info else ""),
                "radical":      info["radical"] if info else None,
                "level":        level,
                "svg_url":      f"/kanjivg/{codepoint}.svg",
                "status":       card_stats(states, user_id, raw_id, KANJI_STATUS_MODES),
                "vocab_examples": words["examples"],
                # Every reading in the deck's order, each with the words
                # that use it -- the plate shows two, the panel all.
                "readings":     words["readings"],
            })
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