"""
Loads the JMdict-derived "extras" for the app's vocab deck: grammatical
tags and example sentences, layered on top of vocab_data.py's own
JLPT-leveled deck rather than folded into it (vocab_deck.json only ever
carries {kanji, kana, meaning} — see vocab_data.py's docstring — and
dictionary.py's public contract for a vocab result shouldn't have to
change shape just because this data happens to exist for some words).

Source files sit next to vocab_deck.json under datas/vocab/:

    vocab_meanings.json — "<kanji>::<kana>" -> [sense, sense, ...]
        Keyed exactly like a vocab_deck.json entry's own kanji/kana
        pair (kana can be several readings packed with "/", e.g.
        "毎月::まいげつ/まいつき") so the common case is a direct dict
        lookup with no parsing. Each sense:
        {match_type, term, reading, tags, term_tags, glossary,
         examples: [{jp, en}, ...]}
        tags are JMdict part-of-speech/field/misc codes ("n", "v1",
        "adj-i", ...); term_tags are priority/frequency/name markers
        ("⭐", "ichi", "news3k", "place", ...).

    vocab_tags.json — tag code -> {category, sorting_order, notes, score}
        Human-readable "notes" for every code used above.

A single term can carry a dozen JMdict senses (出る has one for nearly
every verb sense in the book), but the app's own deck entry only shows
ONE meaning. Pooling tags/examples across every sense (the previous
version of this module) meant a card could show a part-of-speech tag
or example sentence that had nothing to do with the meaning actually
displayed. get_vocab_extras() instead scores each sense against the
app's own (English) gloss and only pulls from whichever sense(s) best
match it, falling back to the first sense when nothing matches well
enough to tell them apart.

Public API: get_vocab_extras(kanji, kana, meaning_hint="") ->
    {"tags": [{"code", "label", "tooltip"}, ...],
     "examples": [{"jp", "en", "segments": [...]}, ...]}

Each example's "segments" is a list of
    {"text": str, "reading": str | None, "highlight": bool}
in reading order — "reading" is set when that chunk should be rendered
as furigana (a <ruby>), and "highlight" flags the chunk(s) that make up
the headword itself so the frontend can pick it out visually. Furigana
comes from the app's own vocab/kanji decks (a lightweight longest-match
lookup, not a real morphological analyzer), so it's a best effort: any
compound already in the app's deck gets its real reading, anything
else falls back to per-character kanji readings, which is occasionally
wrong for compounds whose reading isn't just the sum of their parts.
"""
import json
import os
import re

from vocab_data import VOCAB_BY_LEVEL

try:
    from kanji_data import KANJI_BY_LEVEL
except ImportError:  # pragma: no cover - defensive only, always present in prod
    KANJI_BY_LEVEL = {}

_BASE_DIR = os.path.dirname(__file__)
_DATA_DIR = os.path.join(_BASE_DIR, "datas", "vocab")

with open(os.path.join(_DATA_DIR, "vocab_meanings.json"), encoding="utf-8") as f:
    _VOCAB_MEANINGS: dict[str, list[dict]] = json.load(f)

with open(os.path.join(_DATA_DIR, "vocab_tags.json"), encoding="utf-8") as f:
    _VOCAB_TAGS: dict[str, dict] = json.load(f)

# term_tags mix real study-relevant signal (priority/frequency markers,
# category "popular"/"frequent") with name/place/person/etc. markers
# (category "name") that don't help a JLPT learner's card — only the
# former are surfaced as tags.
_TERM_TAG_CATEGORIES_SHOWN = {"popular", "frequent"}

# A card's tag row is a quick glance, not a JMdict dump.
_MAX_TAGS = 6
_MAX_EXAMPLES = 3

_HIRAGANA_RE = re.compile(r"[\u3040-\u309F]")

# When extending a matched stem through the hiragana that follows it
# (see _extend_inflection_tail), stop as soon as one of these turns up —
# they're grammar (particles, sentence-final か/ね/よ) tacked on after
# the word, not part of its own conjugation.
_BOUNDARY_HIRAGANA = set("かねよわなはがをにでともへの")


def _is_kanji(ch: str) -> bool:
    return "\u4e00" <= ch <= "\u9fff"


def _readings(kana: str) -> list[str]:
    return [r.strip() for r in (kana or "").split("/") if r.strip()]


# ── Short tag labels ─────────────────────────────────────────
# Yomitan-style: a short glance-able label on the chip itself, with the
# full JMdict "notes" text (e.g. "ranked between the top 2,000 and
# 3,000 words in a frequency analysis...") kept only for the tooltip.
# Not every JMdict code is worth a bespoke label — anything not listed
# here just falls back to the raw code, which is already short.
_SHORT_LABELS = {
    "n": "nom", "n-suf": "suffixe", "n-pref": "préfixe", "pn": "pronom",
    "adj-i": "adj. -i", "adj-ix": "adj. -i", "adj-na": "adj. -na",
    "adj-no": "adj. -no", "adj-t": "adj. -taru", "adj-f": "adj.",
    "adv": "adv.", "adv-to": "adv. -to",
    "aux": "aux.", "aux-v": "aux. verbe", "aux-adj": "aux. adj.",
    "conj": "conj.", "cop": "copule", "ctr": "compteur",
    "exp": "expression", "int": "interjection", "num": "nombre",
    "pref": "préfixe", "prt": "particule", "suf": "suffixe", "unc": "?",
    "v1": "v. ichidan", "v1-s": "v. ichidan",
    "v5aru": "v. godan", "v5b": "v. godan", "v5g": "v. godan",
    "v5k": "v. godan", "v5k-s": "v. godan", "v5m": "v. godan",
    "v5n": "v. godan", "v5r": "v. godan", "v5r-i": "v. godan",
    "v5s": "v. godan", "v5t": "v. godan", "v5u": "v. godan",
    "v5u-s": "v. godan", "v5uru": "v. godan",
    "vk": "v. irr. (来る)", "vn": "v. irr. (ぬ)", "vr": "v. irr. (り)",
    "vs": "v. suru", "vs-c": "v. suru", "vs-i": "v. suru", "vs-s": "v. suru",
    "vz": "v. ichidan (ずる)", "vt": "transitif", "vi": "intransitif",
    "uk": "kana", "abbr": "abrév.", "col": "familier", "hon": "honorifique",
    "hum": "humble", "pol": "poli", "arch": "archaïque", "obs": "obsolète",
    "dated": "désuet", "rare": "rare", "on-mim": "onomatopée",
    "id": "idiome", "proverb": "proverbe", "derog": "péjoratif",
    "⭐": "⭐", "ichi": "fréquent", "spec": "fréquent", "gai": "emprunt",
}
_NEWS_RANK_RE = re.compile(r"^news(\d+)k$")


def _short_label(code: str) -> str:
    if code in _SHORT_LABELS:
        return _SHORT_LABELS[code]
    m = _NEWS_RANK_RE.match(code)
    if m:
        return f"top {m.group(1)}k"
    return code


def _tooltip(code: str) -> str:
    info = _VOCAB_TAGS.get(code)
    return info["notes"] if info and info.get("notes") else code


def _add_tag(tags: list, seen: set, code: str) -> None:
    if code in seen:
        return
    seen.add(code)
    tags.append({"code": code, "label": _short_label(code), "tooltip": _tooltip(code)})


def _find_senses(kanji: str, kana: str) -> list[dict] | None:
    # Fast path: vocab_meanings.json keys its entries with the exact
    # same packed kana string vocab_deck.json uses (see module
    # docstring), so most words resolve with a single dict lookup.
    senses = _VOCAB_MEANINGS.get(f"{kanji}::{kana}")
    if senses:
        return senses
    # Fallback for any mismatch in reading order/subset between the two
    # decks — try each individual reading on its own.
    for reading in _readings(kana):
        senses = _VOCAB_MEANINGS.get(f"{kanji}::{reading}")
        if senses:
            return senses
    return None


# ── Sense selection ──────────────────────────────────────────
# A word can carry many JMdict senses but the app shows one gloss —
# pick whichever sense(s) actually match it instead of pooling all of
# them (which mixes tags/examples from unrelated meanings, e.g. 掛かる
# "to take time" vs. "to start (an engine)").
_WORD_RE = re.compile(r"[a-zA-Z']+")
# Glue words that would otherwise inflate every sense's score equally
# (JMdict glosses are almost all "to <verb> ...") and create false ties
# instead of actually distinguishing senses.
_STOPWORDS = {
    "a", "an", "the", "to", "of", "in", "on", "at", "by", "for", "with",
    "and", "or", "e", "g", "eg", "etc", "someone", "something", "one",
    "ones", "one's", "is", "be", "as", "it", "that", "this",
}


def _content_words(text: str) -> set:
    return {w for w in (m.lower() for m in _WORD_RE.findall(text)) if w not in _STOPWORDS and len(w) > 1}


def _gloss_words(sense: dict) -> set:
    words = set()
    for g in sense.get("glossary", []):
        words |= _content_words(g)
    return words


def _select_senses(senses: list, meaning_hint: str) -> list:
    meaning_words = _content_words(meaning_hint or "")
    if not meaning_words:
        return senses[:1]
    scored = [(s, len(meaning_words & _gloss_words(s))) for s in senses]
    best = max(score for _, score in scored)
    if best == 0:
        return senses[:1]
    return [s for s, score in scored if score == best]


# ── Furigana + highlight ─────────────────────────────────────
# Best-effort furigana built from the app's own decks: no morphological
# analyzer is available server-side, so compounds already in the vocab
# deck get their real reading via a longest-match lookup, and anything
# else falls back to per-character kanji readings (imprecise for
# compounds whose reading isn't the sum of their kanji's own readings,
# but far better than no furigana at all).

def _kata_to_hira(s: str) -> str:
    return "".join(
        chr(ord(c) - 0x60) if "\u30A1" <= c <= "\u30F6" else c
        for c in s
    )


def _first_reading_token(kana: str) -> str:
    token = re.split(r"[・;]", kana or "")[0].strip()
    return token.replace(".", "").replace("~", "")


def _build_single_kanji_readings() -> dict:
    table = {}
    for _level, entries in KANJI_BY_LEVEL.items():
        for k in entries:
            char = k.get("kanji")
            if not char or char in table:
                continue
            token = _first_reading_token(k.get("kana", ""))
            if token:
                table[char] = _kata_to_hira(token)
    return table


def _build_vocab_readings() -> dict:
    table = {}
    # Longer entries first so the greedy tokenizer below naturally
    # prefers a full compound match over a shorter partial one, without
    # needing its own length bookkeeping per level.
    all_entries = [w for entries in VOCAB_BY_LEVEL.values() for w in entries]
    all_entries.sort(key=lambda w: len(w.get("kanji") or ""), reverse=True)
    for w in all_entries:
        form = w.get("kanji") or ""
        if not form or form in table or not any(_is_kanji(c) for c in form):
            continue
        readings = _readings(w.get("kana", ""))
        if readings:
            table[form] = readings[0]
    return table


_SINGLE_KANJI_READING = _build_single_kanji_readings()
_VOCAB_READING = _build_vocab_readings()
_MAX_VOCAB_MATCH_LEN = max((len(k) for k in _VOCAB_READING), default=1)


def _tokenize_furigana(sentence: str) -> list:
    """Splits `sentence` into ordered {text, reading, start, end} chunks."""
    segments = []
    i, n = 0, len(sentence)
    while i < n:
        ch = sentence[i]
        if _is_kanji(ch):
            match = None
            for length in range(min(_MAX_VOCAB_MATCH_LEN, n - i), 0, -1):
                candidate = sentence[i:i + length]
                reading = _VOCAB_READING.get(candidate)
                if reading:
                    match = (candidate, reading, length)
                    break
            if match:
                text, reading, length = match
                segments.append({"text": text, "reading": reading, "start": i, "end": i + length})
                i += length
                continue
            # No known compound here — consume the run of consecutive
            # kanji characters and fall back to per-character readings.
            j = i
            while j < n and _is_kanji(sentence[j]):
                j += 1
            run = sentence[i:j]
            reading = "".join(_SINGLE_KANJI_READING.get(c, c) for c in run)
            has_reading = any(c in _SINGLE_KANJI_READING for c in run)
            segments.append({
                "text": run,
                "reading": reading if has_reading else None,
                "start": i, "end": j,
            })
            i = j
            continue
        j = i
        while j < n and not _is_kanji(sentence[j]):
            j += 1
        segments.append({"text": sentence[i:j], "reading": None, "start": i, "end": j})
        i = j
    return segments


def _extend_inflection_tail(sentence: str, end: int, max_extra: int = 6) -> int:
    """Consumes hiragana after `end` (an inflection tail) but stops at
    the first character that's more plausibly a following particle or
    sentence-final ending than part of the word's own conjugation."""
    max_end = min(len(sentence), end + max_extra)
    while end < max_end and _HIRAGANA_RE.match(sentence[end]):
        if sentence[end] in _BOUNDARY_HIRAGANA:
            break
        end += 1
    return end


def _target_span(sentence: str, kanji: str, kana: str):
    """Best-effort (start, end) of the headword itself within `sentence`."""
    if kanji:
        idx = sentence.find(kanji)
        if idx != -1:
            return idx, idx + len(kanji)
        # Conjugating word (verb/i-adjective): the example rarely uses
        # the bare dictionary form. Match on the invariant kanji stem
        # (the dictionary form minus its trailing okurigana) and extend
        # through the inflection tail that follows in the sentence —
        # enough to catch 出た/出ます/太かった/... without a conjugation table.
        stem = re.sub(r"[\u3040-\u309F]+$", "", kanji)
        if stem:
            idx = sentence.find(stem)
            if idx != -1:
                return idx, _extend_inflection_tail(sentence, idx + len(stem))

    # No kanji field, or this example happens to use the kana-only form
    # of a word that does have one (common for "usually kana" words) —
    # fall back to the reading itself, with the same stem+extend trick
    # since a verb/adjective's final kana is exactly what conjugates.
    for reading in _readings(kana) or ([kana] if kana else []):
        idx = sentence.find(reading)
        if idx != -1:
            return idx, idx + len(reading)
        stem = reading[:-1] if len(reading) > 1 else reading
        if not stem:
            continue
        idx = sentence.find(stem)
        if idx != -1:
            return idx, _extend_inflection_tail(sentence, idx + len(stem))
    return None


def _annotate_sentence(sentence: str, kanji: str, kana: str) -> list:
    span = _target_span(sentence, kanji, kana)
    return [
        {
            "text": seg["text"],
            "reading": seg["reading"],
            "highlight": bool(span) and seg["start"] < span[1] and seg["end"] > span[0],
        }
        for seg in _tokenize_furigana(sentence)
    ]


def get_vocab_extras(kanji: str, kana: str, meaning_hint: str = "") -> dict:
    senses = _find_senses(kanji, kana)
    if not senses:
        return {"tags": [], "examples": []}

    chosen = _select_senses(senses, meaning_hint)

    tags = []
    seen_tags = set()
    for sense in chosen:
        for code in sense.get("tags", []):
            _add_tag(tags, seen_tags, code)
        for code in sense.get("term_tags", []):
            info = _VOCAB_TAGS.get(code)
            if not info or info.get("category") not in _TERM_TAG_CATEGORIES_SHOWN:
                continue
            _add_tag(tags, seen_tags, code)
        if len(tags) >= _MAX_TAGS:
            break

    examples = []
    seen_jp = set()
    for sense in chosen:
        for ex in sense.get("examples", []):
            jp = ex.get("jp")
            if not jp or jp in seen_jp:
                continue
            seen_jp.add(jp)
            examples.append({
                "jp": jp,
                "en": ex.get("en", ""),
                "segments": _annotate_sentence(jp, kanji, kana),
            })
            if len(examples) >= _MAX_EXAMPLES:
                break
        if len(examples) >= _MAX_EXAMPLES:
            break

    return {"tags": tags[:_MAX_TAGS], "examples": examples[:_MAX_EXAMPLES]}