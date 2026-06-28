"""
Shared helpers for cross-referencing arbitrary Japanese text against the
existing vocab/kanji decks and the user's SRS state. Used by both the
phrase analyzer and the reading-practice mode.
"""

from vocab_data import VOCAB_BY_LEVEL, vocab_to_id
from kanji_data import KANJI_BY_LEVEL, kanji_to_id

# Representative mode used to gauge "do I know this word/kanji" for the
# clickable badges. Vocab/kanji are tracked across several phases (kk-s,
# k-k, s-k, ...); s-k (see word, recall meaning) is the closest proxy for
# "do I know what this means when I read it". Swap this if a different
# phase is a better fit for your app.
VOCAB_STATUS_MODE = "s-k"
KANJI_STATUS_MODE = "k-k"


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

    NOTE: assumes vocab entries expose kanji/kana-ish fields similar to
    kanji_data entries. Field names are a guess — adjust the .get(...)
    calls below if vocab_data.py uses different keys.
    """
    for level, vocab_list in VOCAB_BY_LEVEL.items():
        for entry in vocab_list:
            entry_word = entry.get("kanji") or entry.get("word") or entry.get("vocab") or ""
            entry_kana = entry.get("kana") or entry.get("reading") or ""
            if entry_word and entry_word in (surface, base):
                return level, entry, vocab_to_id(entry, level)
            if entry_kana and entry_kana == reading and not entry_word:
                return level, entry, vocab_to_id(entry, level)
    return None


def find_kanji_matches(text: str):
    """Find every kanji character in `text` that exists in the kanji deck."""
    matches = []
    seen = set()
    for char in text:
        if char in seen or not is_kanji(char):
            continue
        seen.add(char)
        for level, kanji_list in KANJI_BY_LEVEL.items():
            for entry in kanji_list:
                if entry.get("kanji") == char:
                    matches.append((char, level, entry, kanji_to_id(entry, level)))
                    break
            else:
                continue
            break
    return matches


def _vocab_candidates():
    """All (word, level, entry) triples from the vocab deck, longest first —
    built once at import time so dictionary scanning doesn't redo this
    per request."""
    candidates = []
    for level, vocab_list in VOCAB_BY_LEVEL.items():
        for entry in vocab_list:
            word = entry.get("kanji") or entry.get("word") or entry.get("vocab") or ""
            if word:
                candidates.append((word, level, entry))
    candidates.sort(key=lambda c: -len(c[0]))
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
        for level, kanji_list in KANJI_BY_LEVEL.items():
            for entry in kanji_list:
                if entry.get("kanji") == char:
                    raw_id = kanji_to_id(entry, level)
                    kanji_hits.append((idx, idx + 1, level, entry, raw_id))
                    covered[idx] = True
                    break
            else:
                continue
            break

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