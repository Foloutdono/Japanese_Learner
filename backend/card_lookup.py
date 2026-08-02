"""
Shared helpers for cross-referencing arbitrary Japanese text against the
existing vocab/kanji decks and the user's SRS state. Used by both the
phrase analyzer and the reading-practice mode.
"""

from vocab_data import VOCAB_BY_LEVEL, vocab_to_id
from kanji_data import KANJI_BY_LEVEL, kanji_to_id
from quiz_modes import STATUS_MODE
import vocab_extras

# Representative mode used to gauge "do I know this word/kanji" for the
# clickable badges — see quiz_modes.py for the reasoning. Both vocab and
# kanji use the same mode here, but they're kept as separate names since
# nothing requires them to always match.
VOCAB_STATUS_MODE = STATUS_MODE
KANJI_STATUS_MODE = STATUS_MODE

# Used to pick between multiple deck entries that share the same surface
# form (e.g. 歩 is both the everyday word "marcher"/"pas" and the shogi
# piece "fu"/pawn, with different readings and meanings). Lower rank =
# more common = preferred default when we have no reading to disambiguate
# with. Unknown level strings fall back to a high rank (least preferred,
# but never crashes).
_LEVEL_ORDER = {"N5": 0, "N4": 1, "N3": 2, "N2": 3, "N1": 4}


def _level_rank(level: str) -> int:
    return _LEVEL_ORDER.get(level, 99)


def _reading_variants(kana_field: str) -> list:
    """A deck's kana field can list several readings separated by ';'."""
    if not kana_field:
        return []
    return [r.strip() for r in kana_field.split(';') if r.strip()]


def _reading_matches(entry_kana: str, reading: str) -> bool:
    if not entry_kana or not reading:
        return False
    variants = _reading_variants(entry_kana)
    return reading in variants or reading == entry_kana.strip()


def _surface_variants(word: str, kana: str) -> list:
    """Alternate real-world spellings of a deck word's `word` (kanji/
    surface) field that an actual sentence — a JMdict/Tatoeba example,
    or a real-word reading-practice phrase — commonly uses instead of
    the deck's own dictionary-form spelling:

      - Arabic-digit spelling of a kanji numeral (二日 -> 2日).
      - The conventional partial-kana spelling for a small hand-picked
        set of kanji (御飯 -> ご飯).
      - The word's own kana reading, but only when JMdict tags it
        "usually kana" — see vocab_extras.is_usually_kana for why this
        isn't done for every kanji-having word.

    Does not include `word` itself. See vocab_extras.py, which this
    reuses rather than re-deriving the same logic here.
    """
    if not word:
        return []
    variants = []
    numeral = vocab_extras.numeral_variant(word)
    if numeral:
        variants.append(numeral)
    variants.extend(vocab_extras.kana_spelling_variants(word))
    if kana and vocab_extras.is_usually_kana(word, kana):
        variants.extend(r for r in _reading_variants(kana) if len(r) >= 2)
    return variants


def _pick_best_candidate(candidates: list, reading: str = None):
    """
    Disambiguate between multiple deck entries sharing the same surface
    form.

    candidates: list of (level, entry, entry_kana) tuples, all already
    known to match the requested surface/base text.

    Priority:
      1. An entry whose reading matches the one we were given (exact
         signal — e.g. from the phrase analyzer's LLM segmentation).
      2. Otherwise, the entry from the lowest (most common) JLPT level,
         since niche secondary meanings tend to be introduced later.
      3. Otherwise, whichever candidate came first (stable fallback).
    """
    if not candidates:
        return None

    if reading:
        for level, entry, entry_kana in candidates:
            if _reading_matches(entry_kana, reading):
                return level, entry

    return min(candidates, key=lambda c: _level_rank(c[0]))[:2]


def is_kanji(char: str) -> bool:
    return "\u4e00" <= char <= "\u9fff"


def serializable_entry(entry: dict) -> dict:
    """Keep only plain JSON-safe fields from a deck entry (kanji/vocab dict)."""
    return {k: v for k, v in entry.items() if isinstance(v, (str, int, float, bool)) or v is None}


def card_stats(states: dict, user_id: str, raw_id: str, mode: str) -> dict:
    """Full per-card SRS stats for a detail panel, not just a status label."""
    item = states.get((f"{user_id}:{raw_id}", mode))
    if item is None:
        return {
            "status": "not_started",
            "total_reviews": 0,
            "correct_reviews": 0,
            "accuracy": None,
            "due": False,
            "interval_days": None,
            "next_review": None,
        }
    total = item["total_reviews"]
    accuracy = round(item["correct_reviews"] / total * 100, 1) if total > 0 else None
    return {
        "status": item["state"],
        "total_reviews": total,
        "correct_reviews": item["correct_reviews"],
        "accuracy": accuracy,
        "due": item["due"],
        "interval_days": item["interval_days"],
        "next_review": item["next_review"],
    }


def find_vocab_match(surface: str, base: str, reading: str):
    """
    Best-effort lookup of a single (already-segmented) word against the
    vocab deck — used by the phrase analyzer, which gets word boundaries
    from the LLM.

    Several deck entries can share the same kanji surface (e.g. 歩 as the
    everyday word "marcher" vs. the shogi piece "fu"/pawn) with different
    readings and meanings. We disambiguate using the reading supplied by
    the LLM rather than silently returning whichever entry happens to
    come first in the deck; see _pick_best_candidate for the fallback
    order when no reading matches.

    NOTE: assumes vocab entries expose kanji/kana-ish fields similar to
    kanji_data entries. Field names are a guess — adjust the .get(...)
    calls below if vocab_data.py uses different keys.
    """
    kanji_candidates = []      # entries whose kanji field (or a known spelling variant) == surface/base
    kana_only_candidates = []  # entries with no kanji field, or "usually kana" entries matched by reading alone

    for level, vocab_list in VOCAB_BY_LEVEL.items():
        for entry in vocab_list:
            entry_word = entry.get("kanji") or entry.get("word") or entry.get("vocab") or ""
            entry_kana = entry.get("kana") or entry.get("reading") or ""
            if entry_word and (entry_word in (surface, base) or any(
                v in (surface, base) for v in _surface_variants(entry_word, entry_kana)
            )):
                kanji_candidates.append((level, entry, entry_kana))
            elif entry_kana and _reading_matches(entry_kana, reading) and (
                not entry_word or vocab_extras.is_usually_kana(entry_word, entry_kana)
            ):
                kana_only_candidates.append((level, entry, entry_kana))

    best = _pick_best_candidate(kanji_candidates, reading) or _pick_best_candidate(kana_only_candidates, reading)
    if best is None:
        return None

    level, entry = best
    return level, entry, vocab_to_id(entry, level)


def find_kanji_matches(text: str):
    """Find every kanji character in `text` that exists in the kanji deck.

    If the same character were ever duplicated across levels in the deck,
    this picks the lowest-level (most common) entry rather than whichever
    happens to be found first while iterating.
    """
    matches = []
    seen = set()
    for char in text:
        if char in seen or not is_kanji(char):
            continue
        seen.add(char)
        candidates = [
            (level, entry)
            for level, kanji_list in KANJI_BY_LEVEL.items()
            for entry in kanji_list
            if entry.get("kanji") == char
        ]
        if not candidates:
            continue
        level, entry = min(candidates, key=lambda c: _level_rank(c[0]))
        matches.append((char, level, entry, kanji_to_id(entry, level)))
    return matches


def _vocab_candidates():
    """All (surface, level, entry) triples the greedy scan below can
    match against, longest first — built once at import time so
    dictionary scanning doesn't redo this per request.

    Ties (same surface length) are broken by JLPT level, lowest first. This
    matters when several entries share the same surface form (e.g. 歩 as
    the everyday word "marcher" vs. the shogi piece "fu"/pawn): without a
    known reading to disambiguate against (this function scans raw,
    unsegmented text), the greedy scan below just takes whichever
    candidate comes first — so we make sure that's the common one.

    Beyond each entry's own dictionary-form surface, this also registers
    a handful of alternate real-world spellings (see _surface_variants
    above, built from vocab_extras' numeral_variant / kana_spelling_variants
    / is_usually_kana helpers) — Arabic-digit numerals, conventional
    partial-kana spellings, and (for
    JMdict-confirmed "usually kana" words) the bare kana reading — since
    a real example/reading-practice sentence very often doesn't spell a
    word exactly like the deck does (二日 -> 2日, 御飯 -> ご飯,
    温い -> ぬるい). Every variant maps back to the SAME (level, entry)
    as the canonical form: raw_id/stats lookups key off the entry
    itself, not whichever surface text was actually found in the text.
    """
    candidates = []
    for level, vocab_list in VOCAB_BY_LEVEL.items():
        for entry in vocab_list:
            word = entry.get("kanji") or entry.get("word") or entry.get("vocab") or ""
            kana = entry.get("kana") or entry.get("reading") or ""
            if word:
                candidates.append((word, level, entry))
                for variant in _surface_variants(word, kana):
                    candidates.append((variant, level, entry))
            elif kana:
                # Kana-only deck entries (no kanji field at all) were
                # previously dropped entirely here — nothing to match
                # them against besides their own kana form.
                for reading in _reading_variants(kana):
                    candidates.append((reading, level, entry))
    candidates.sort(key=lambda c: (-len(c[0]), _level_rank(c[1])))
    return candidates


_VOCAB_CANDIDATES = _vocab_candidates()


def find_segments_in_text(text: str):
    """
    Scan raw, unsegmented text (e.g. a generated reading-practice phrase,
    where we don't have LLM-provided word boundaries) against the vocab
    deck using greedy longest-match, then check any leftover kanji
    characters against the kanji deck individually.

    Returns a list of segments covering the whole string, in order:
        {"text": "...", "start": int, "end": int, "type": "vocab"|"kanji"|"plain",
         "level": ..., "raw_id": ..., "entry": {...}}   (level/raw_id/entry omitted for "plain")
    """
    n = len(text)
    covered = [False] * n
    vocab_hits = []  # (start, end, level, entry, raw_id)

    i = 0
    while i < n:
        matched = False
        for word, level, entry in _VOCAB_CANDIDATES:
            length = len(word)
            if length == 0 or i + length > n:
                continue
            if text[i:i + length] == word:
                raw_id = vocab_to_id(entry, level)
                vocab_hits.append((i, i + length, level, entry, raw_id))
                for k in range(i, i + length):
                    covered[k] = True
                i += length
                matched = True
                break
        if not matched:
            i += 1

    kanji_hits = []  # (start, end, level, entry, raw_id)
    for idx, char in enumerate(text):
        if covered[idx] or not is_kanji(char):
            continue
        candidates = [
            (level, entry)
            for level, kanji_list in KANJI_BY_LEVEL.items()
            for entry in kanji_list
            if entry.get("kanji") == char
        ]
        if not candidates:
            continue
        level, entry = min(candidates, key=lambda c: _level_rank(c[0]))
        raw_id = kanji_to_id(entry, level)
        kanji_hits.append((idx, idx + 1, level, entry, raw_id))
        covered[idx] = True

    # Merge vocab + kanji hits into one ordered, non-overlapping list, then
    # fill the gaps with plain-text segments.
    hits = sorted(vocab_hits + kanji_hits, key=lambda h: h[0])
    segments = []
    cursor = 0
    for start, end, level, entry, raw_id in hits:
        if start > cursor:
            segments.append({"text": text[cursor:start], "start": cursor, "end": start, "type": "plain"})
        seg_type = "vocab" if (start, end, level, entry, raw_id) in vocab_hits else "kanji"
        segments.append({
            "text": text[start:end], "start": start, "end": end, "type": seg_type,
            "level": level, "raw_id": raw_id, "entry": serializable_entry(entry),
        })
        cursor = end
    if cursor < n:
        segments.append({"text": text[cursor:n], "start": cursor, "end": n, "type": "plain"})

    return segments


def attach_stats_to_segments(segments: list, states: dict, user_id: str) -> list:
    """Add a "stats" dict to each non-plain segment, using the right mode per type."""
    enriched = []
    for seg in segments:
        if seg["type"] == "plain":
            enriched.append(seg)
            continue
        mode = VOCAB_STATUS_MODE if seg["type"] == "vocab" else KANJI_STATUS_MODE
        enriched.append({**seg, "stats": card_stats(states, user_id, seg["raw_id"], mode)})
    return enriched