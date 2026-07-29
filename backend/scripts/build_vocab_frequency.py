"""
Builds vocab_frequency.json: the STANDARD frequency-tier ordering for
vocab. Same idea as build_frequency_index.py's kanji ordering, but vocab
needs a matching pass against JMdict first (see below) since there's no
single "freq" field sitting on each deck word the way KANJIDIC2 gives
kanji.

Frequency source: JMdict priority tags carried in each matched sense's
term_tags (see vocab_tags.json) —
    news1k, news2k, ..., news24k   rank bucket vs. a Mainichi Shimbun
                                    frequency analysis (news1k = top
                                    1-1000, news2k = 1000-2000, ...)
    ichi / spec / gai              editorially "common" flags with no
                                    numeric bucket (Ichimango list /
                                    JMdict-editor-specified / common
                                    loanword) — treated as better than
                                    ANY newsNk bucket, since JMdict only
                                    applies them to genuinely everyday
                                    words.

Requires vocab_meanings.json (from build_vocab_meanings.py) as input —
i.e. you need the deck already matched against JMdict entries before
this can rank it. Only "exact_reading" and "term_only" matches are used
(kana_fallback matches are too unreliable to trust for ranking — see
build_vocab_meanings.py's docstring on why that tier is flagged low-
confidence).

For a deck word with several matched senses, the BEST (numerically
lowest) frequency bucket found across all of them wins — one common
sense is enough to call the word common, even if it also has rarer
senses.

Deck words with no frequency-tagged match at all (no match found, or
matched but none of the JMdict senses carry a priority tag) are
appended at the end in JLPT deck order (N5 -> N1), same fallback policy
as the kanji version.

Usage:
    python build_vocab_frequency.py /path/to/vocab_meanings.json /path/to/vocab_deck.json ./out
"""
import sys
import re
import json

_NEWS_RE = re.compile(r"^news(\d+)k$")
_EDITORIAL_TAGS = {"ichi", "spec", "gai"}
_EDITORIAL_RANK = 0  # better than any newsNk bucket (news1k starts at 1000)

_TRUSTED_MATCH_TYPES = {"exact_reading", "term_only"}


def _best_rank(matches) -> int | None:
    best = None
    for m in matches:
        if m.get("match_type") not in _TRUSTED_MATCH_TYPES:
            continue
        for tag in m.get("term_tags", []):
            if tag in _EDITORIAL_TAGS:
                return _EDITORIAL_RANK  # can't do better than this, stop looking
            news_match = _NEWS_RE.match(tag)
            if news_match:
                rank = int(news_match.group(1)) * 1000
                if best is None or rank < best:
                    best = rank
    return best


def build_vocab_frequency(vocab_meanings_path, vocab_deck_path):
    with open(vocab_meanings_path, encoding="utf-8") as f:
        vocab_meanings = json.load(f)
    with open(vocab_deck_path, encoding="utf-8") as f:
        vocab_deck = json.load(f)

    deck_order = []
    seen = set()
    for level in ("N5", "N4", "N3", "N2", "N1"):
        for entry in vocab_deck.get(level, []):
            key = f"{entry.get('kanji', '')}::{entry.get('kana', '')}"
            if key not in seen:
                seen.add(key)
                deck_order.append(key)

    ranked = []
    unranked = []
    for key in deck_order:
        matches = vocab_meanings.get(key, [])
        rank = _best_rank(matches)
        if rank is not None:
            ranked.append((rank, key))
        else:
            unranked.append(key)

    ranked.sort(key=lambda pair: pair[0])
    ordered = [key for _, key in ranked] + unranked
    return ordered, len(ranked), len(unranked)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python build_vocab_frequency.py /path/to/vocab_meanings.json /path/to/vocab_deck.json [out_dir]")
        sys.exit(1)

    vocab_meanings_path, vocab_deck_path = sys.argv[1], sys.argv[2]
    out_dir = sys.argv[3] if len(sys.argv) > 3 else "."

    ordered, ranked_count, unranked_count = build_vocab_frequency(vocab_meanings_path, vocab_deck_path)

    with open(f"{out_dir}/vocab_frequency.json", "w", encoding="utf-8") as f:
        json.dump(ordered, f, ensure_ascii=False, indent=2)

    print(f"{len(ordered)} deck words ordered ({ranked_count} by JMdict priority tag, "
          f"{unranked_count} appended in JLPT order, no priority tag found).")
