import json
import os
from collections import defaultdict

from fastapi import APIRouter, Depends
from content.kanji_data import KANJI_BY_LEVEL, kanji_to_id
from content.vocab_data import VOCAB_BY_LEVEL, vocab_to_id
import content.vocab_jmdict_data as jmdict_db
from content.vocab_jmdict_data import vocab_jmdict_to_id
from content.vocab_extras import get_vocab_extras
from content.kana_data import HIRAGANA_BASIC, KATAKANA_BASIC, kana_to_id
from translations import get_meaning
from content.kanji_meanings import KANJI_FR
from translations.fr.vocab_fr import VOCAB_FR
from core.auth import get_user_id
from core.srs_instance import srs
from study.card_lookup import card_stats, VOCAB_STATUS_MODE, KANJI_STATUS_MODE, is_kanji
from study.furigana import align_deck

router = APIRouter()

# NOTE: card_lookup.py wasn't available while wiring this up, so this is
# a best guess at the mode string kana progress is actually tracked
# under (mirroring KANJI_STATUS_MODE/VOCAB_STATUS_MODE's naming). Check
# it against however card_lookup.py defines status modes for kana's own
# quiz modes ('flashcard' / 'qcm' / 'write' — see kanaModePicker) and
# adjust if it doesn't match.
KANA_STATUS_MODE = "flashcard"

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

# Same ordering rule card_lookup._level_rank uses (lower = more common) —
# duplicated here rather than imported since that name is private to
# card_lookup.py.
_LEVEL_ORDER = {"N5": 0, "N4": 1, "N3": 2, "N2": 3, "N1": 4}


def _level_rank(level: str) -> int:
    return _LEVEL_ORDER.get(level, 99)


def _build_kanji_to_vocab_index():
    """
    kanji char -> [(level, vocab_entry), ...], for every word in the app's
    own vocab deck (VOCAB_BY_LEVEL) whose kanji field contains that
    character. Powers each kanji's "used in these words" example list (see
    _vocab_examples_for_kanji) — built once at import time, same reasoning
    as _build_app_radical_index above.
    """
    index = defaultdict(list)
    for level, vocab_list in VOCAB_BY_LEVEL.items():
        for w in vocab_list:
            chars = {c for c in w.get("kanji", "") if is_kanji(c)}
            for char in chars:
                index[char].append((level, w))
    return index


_KANJI_TO_VOCAB = _build_kanji_to_vocab_index()

_MAX_KANJI_VOCAB_EXAMPLES = 4


def _word_furigana(kanji: str, kana: str) -> list[dict]:
    """Per-kanji furigana for a headword, computed once here rather than
    left to the frontend's weaker anchor-only splitter — same algorithm
    (study.furigana) the vocab screen's indice_3 hint already renders
    with. `kana` may pack several readings with "/"; only the first,
    primary one is annotated, matching how the dictionary panel's
    headline furigana already picks it."""
    if not kanji or not kana:
        return []
    primary = kana.split("/")[0].strip()
    return align_deck(kanji, primary) if primary else []


def _vocab_examples_for_kanji(char: str, lang: str) -> list[dict]:
    """Up to _MAX_KANJI_VOCAB_EXAMPLES real vocab words containing `char`,
    most-common level first. Multi-character compounds are listed before
    the bare single-character word itself — a kanji's card should show how
    it combines with others, not just repeat itself."""
    candidates = _KANJI_TO_VOCAB.get(char, [])
    compounds = sorted((c for c in candidates if len(c[1].get("kanji", "")) > 1), key=lambda c: _level_rank(c[0]))
    singles   = sorted((c for c in candidates if len(c[1].get("kanji", "")) <= 1), key=lambda c: _level_rank(c[0]))

    seen = set()
    out = []
    for level, w in compounds + singles:
        key = (w.get("kanji", ""), w.get("kana", ""))
        if key in seen:
            continue
        seen.add(key)
        out.append({
            "kanji":    w.get("kanji", ""),
            "kana":     w.get("kana", ""),
            "meaning":  get_meaning(w, lang, VOCAB_FR_MAP),
            "level":    level,
            "furigana": _word_furigana(w.get("kanji", ""), w.get("kana", "")),
        })
        if len(out) >= _MAX_KANJI_VOCAB_EXAMPLES:
            break
    return out


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


@router.get("/api/dictionary")
def get_dictionary(q: str = "", page: int = 0, limit: int = 50, lang: str = "fr",
                    category: str = "all", radical: int | None = None,
                    user_id: str = Depends(get_user_id)):
    """
    category: "all" | "kanji" | "vocab" | "hiragana" | "katakana" | "jmdict"
    — lets the client avoid pulling in thousands of vocab entries when
    only kanji (or vice versa) are wanted.

    "jmdict" is the full JMdict pool beyond the app's own curated JLPT
    deck (see vocab_jmdict_data.py) — deliberately NOT included under
    "all", so the default browse/search experience stays the curated
    ~8k-word deck plus kanji/kana rather than getting swamped by
    ~293k largely obscure entries. A client wanting full-dictionary
    lookup asks for category="jmdict" explicitly.

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

    matches = []  # (kind, level, entry, meaning) — cheap, no SRS lookups yet

    want_kanji    = category in ("all", "kanji")    or radical is not None
    want_vocab    = category in ("all", "vocab")    and radical is None
    want_hiragana = category in ("all", "hiragana") and radical is None
    want_katakana = category in ("all", "katakana") and radical is None
    want_jmdict   = category == "jmdict"            and radical is None

    if want_jmdict:
        # category="jmdict" is always its own standalone branch (never
        # combined with kanji/vocab/kana — see want_* above), so this can
        # paginate straight from the DB instead of joining the general
        # matches-list-then-slice path below, which would otherwise mean
        # materializing every JMdict row that matches `q` in Python first.
        jmdict_page, jmdict_total = jmdict_db.search(q, limit=limit, offset=page * limit)
        states = srs.get_user_states(user_id) if jmdict_page else {}
        results = []
        for entry in jmdict_page:
            raw_id = vocab_jmdict_to_id(entry)
            meaning = entry.get("meaning", "")
            # Same extras lookup as a normal vocab word; get_vocab_extras'
            # JMdict fallback (see vocab_extras.py) queries the same DB
            # this search just came from.
            extras = get_vocab_extras(
                entry.get("kanji", ""), entry.get("kana", ""), meaning, lang,
            )
            results.append({
                "type":     "vocab",
                "kanji":    entry.get("kanji", ""),
                "kana":     entry.get("kana", ""),
                "meaning":  meaning,
                # No JLPT level — LevelBadge on the frontend already
                # renders nothing when level is falsy.
                "level":    None,
                "senses":   extras["senses"],
                "examples": extras["examples"],
                "furigana": _word_furigana(entry.get("kanji", ""), entry.get("kana", "")),
                "status":   card_stats(states, user_id, raw_id, VOCAB_STATUS_MODE),
            })
        return {
            "results":  results,
            "total":    jmdict_total,
            "page":     page,
            "limit":    limit,
            "has_more": (page + 1) * limit < jmdict_total,
        }

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
        for level, vocab_list in VOCAB_BY_LEVEL.items():
            for w in vocab_list:
                meaning = get_meaning(w, lang, VOCAB_FR_MAP)
                kanji_form = w.get("kanji", "")
                kana_form  = w.get("kana", "")
                if q == "" or (
                    q in kanji_form or
                    q in kana_form or
                    q.lower() in meaning.lower()
                ):
                    matches.append(("vocab", level, w, meaning))

    if want_hiragana:
        for k in HIRAGANA_BASIC:
            if q == "" or (q in k["kana"] or q.lower() in k["romaji"].lower()):
                # Reuses the tuple's "meaning" slot for romaji — it's
                # what dict-entry-card__meaning and the detail panel's
                # "Sens" row already read regardless of entry kind.
                matches.append(("hiragana", "Hiragana", k, k["romaji"]))

    if want_katakana:
        for k in KATAKANA_BASIC:
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
            results.append({
                "type":         "kanji",
                "kanji":        entry["kanji"],
                "kana":         entry.get("kana", ""),
                "meaning":      meaning,
                # kanji_data.py entries don't carry their own stroke count —
                # fall back to the value derived from KANJIDIC2.
                "stroke_count": entry.get("stroke_count") or (info["stroke_count"] if info else ""),
                "radical":      info["radical"] if info else None,
                "level":        level,
                "svg_url":      f"/kanjivg/{codepoint}.svg",
                "status":       card_stats(states, user_id, raw_id, KANJI_STATUS_MODE),
                "vocab_examples": _vocab_examples_for_kanji(entry["kanji"], lang),
            })
        elif kind == "vocab":
            raw_id = vocab_to_id(entry, level)
            # lang is forwarded so tag chips (and the "tooltip" note
            # text behind them) come back in whichever language the
            # client is actually displaying — get_vocab_extras defaults
            # to "fr" otherwise, which used to leak French labels into
            # English sessions.
            extras = get_vocab_extras(
                entry.get("kanji", ""), entry.get("kana", ""), entry.get("meaning", ""), lang,
            )
            results.append({
                "type":     "vocab",
                "kanji":    entry.get("kanji", ""),
                "kana":     entry.get("kana", ""),
                "meaning":  meaning,
                "level":    level,
                # Every JMdict sense (not just the app's own single
                # gloss) — lets the detail panel show the fuller
                # dictionary picture instead of only the one meaning.
                "senses":   extras["senses"],
                "examples": extras["examples"],
                "furigana": _word_furigana(entry.get("kanji", ""), entry.get("kana", "")),
                "status":   card_stats(states, user_id, raw_id, VOCAB_STATUS_MODE),
            })
        else:  # hiragana or katakana
            raw_id = kana_to_id(entry)
            # Yōon combos ("きゃ") aren't included here at all anymore (see
            # the loops above), so every kana entry reaching this branch
            # is always a single character — the codepoint below is always
            # that one character's own stroke file, no ambiguity.
            codepoint = hex(ord(entry["kana"]))[2:].zfill(5)
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
                "svg_url": f"/kanjivg/{codepoint}.svg",
                "status":  card_stats(states, user_id, raw_id, KANA_STATUS_MODE),
            })

    return {
        "results":  results,
        "total":    total,
        "page":     page,
        "limit":    limit,
        "has_more": end < total,
    }