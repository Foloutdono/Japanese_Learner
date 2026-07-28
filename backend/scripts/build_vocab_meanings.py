"""
Matches the app's own vocab deck (vocab_deck.json — JLPT N5-N1 words,
each with a kanji/kana/meaning) against the parsed JMdict term-bank data
(vocab_entries_*.json, from build_vocab_index.py) to pull real glossaries
and example sentences for each deck word.

Unlike kanji_meanings.py, this does NOT try to collapse each deck word
down to one "best" answer — JMdict routinely has several senses per
word, and picking the right one needs judgment this script doesn't have
(e.g. deciding which of "生る" 's senses matches the deck's one given
meaning). Instead, for every deck word it dumps every JMdict sense it
found for that word, tagged with how confident the match is, so you can
filter/pick during your own cleanup pass rather than silently trusting
a guess.

Matching strategy per deck word (kanji, kana — kana can pack multiple
readings separated by "/", e.g. "まいげつ/まいつき"):
  1. exact_reading  — a JMdict row whose term equals the deck's kanji
     (or kana, if the deck word has no kanji) AND whose reading is one
     of the deck's kana variants. Highest confidence.
  2. term_only      — same term, but none of its JMdict readings matched
     any deck kana variant. Kept, but flagged, since it's plausibly a
     different reading of the same written word.
  3. kana_fallback  — no match on the kanji term at all, but the deck's
     first kana variant matches a JMdict term directly (covers deck
     words JMdict only lists under an alternate kanji spelling, or
     kana-only deck words where the "kanji" field is blank).
  4. (unmatched)    — nothing found under any strategy. Reported in the
     summary printed at the end, not written to the output file.
  "forms" rows (tags containing "forms") are excluded from matching
  entirely — they're rendered kanji-form tables, not glosses.

Output: vocab_meanings.json, keyed by "kanji::kana" using the deck
entry's own exact field values (so it round-trips against
vocab_deck.json without re-parsing anything):

    { "毎月::まいげつ/まいつき": [
        { "match_type": "exact_reading", "term": "毎月", "reading": "まいげつ",
          "tags": ["n", "adv"], "glossary": ["every month"], "examples": [...] },
        { "match_type": "exact_reading", "term": "毎月", "reading": "まいつき",
          "tags": ["n", "adv"], "glossary": ["every month"], "examples": [...] }
      ], ... }

Usage:
    python build_vocab_meanings.py /path/to/vocab_deck.json /path/to/vocab_entries_dir ./out
"""
import sys
import os
import json
import glob
from collections import defaultdict


def load_entries(entries_dir):
    """Merge every vocab_entries_*.json chunk in entries_dir into one
    {sequence: [sense, ...]} dict."""
    merged = {}
    paths = glob.glob(os.path.join(entries_dir, "vocab_entries_*.json"))
    if not paths:
        # also allow a single non-chunked vocab_entries.json
        single = os.path.join(entries_dir, "vocab_entries.json")
        if os.path.exists(single):
            paths = [single]
    for path in paths:
        with open(path, encoding="utf-8") as f:
            chunk = json.load(f)
        merged.update(chunk)
    return merged, len(paths)


def build_term_index(entries):
    """term -> [sense, ...] across every sequence, skipping 'forms' rows."""
    index = defaultdict(list)
    for senses in entries.values():
        for sense in senses:
            if "forms" in sense.get("tags", []):
                continue
            index[sense["term"]].append(sense)
    return index


def _sense_summary(sense, match_type):
    return {
        "match_type": match_type,
        "term": sense["term"],
        "reading": sense["reading"],
        "tags": sense.get("tags", []),
        "glossary": sense.get("glossary", []),
        "examples": sense.get("examples", []),
    }


def match_word(kanji, kana, term_index):
    deck_readings = kana.split("/") if kana else [""]
    term = kanji if kanji else kana

    candidates = term_index.get(term, [])
    exact = [c for c in candidates if c["reading"] in deck_readings]
    if exact:
        return [_sense_summary(c, "exact_reading") for c in exact]

    if candidates:
        return [_sense_summary(c, "term_only") for c in candidates]

    if kanji:
        fallback_term = deck_readings[0]
        fallback_candidates = term_index.get(fallback_term, [])
        if fallback_candidates:
            return [_sense_summary(c, "kana_fallback") for c in fallback_candidates]

    return []


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python build_vocab_meanings.py /path/to/vocab_deck.json /path/to/vocab_entries_dir [out_dir]")
        sys.exit(1)

    deck_path = sys.argv[1]
    entries_dir = sys.argv[2]
    out_dir = sys.argv[3] if len(sys.argv) > 3 else "."
    os.makedirs(out_dir, exist_ok=True)

    with open(deck_path, encoding="utf-8") as f:
        vocab_by_level = json.load(f)

    entries, chunk_count = load_entries(entries_dir)
    term_index = build_term_index(entries)

    results = {}
    stats = defaultdict(int)
    seen = set()

    for level, words in vocab_by_level.items():
        for word in words:
            kanji = word.get("kanji", "")
            kana = word.get("kana", "")
            key = f"{kanji}::{kana}"
            if key in seen:
                continue  # same word appears in more than one level; only match once
            seen.add(key)

            matches = match_word(kanji, kana, term_index)
            if matches:
                results[key] = matches
                stats[matches[0]["match_type"]] += 1
            else:
                stats["unmatched"] += 1

    with open(os.path.join(out_dir, "vocab_meanings.json"), "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    total = len(seen)
    print(f"Loaded {chunk_count} vocab_entries chunk file(s), {len(entries)} sequences, {sum(len(v) for v in term_index.values())} indexed (non-forms) senses.")
    print(f"{total} unique deck words checked.")
    for match_type in ("exact_reading", "term_only", "kana_fallback", "unmatched"):
        print(f"  {match_type}: {stats[match_type]}")
