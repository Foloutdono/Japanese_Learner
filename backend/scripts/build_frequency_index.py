"""
Builds kanji_frequency.json: the STANDARD frequency-tier ordering for
kanji, i.e. the "N5-N1 alternative" the frequency-tier study mode is
built on (see frequency_data.py for how it's consumed).

Source: kanji_basic.json's "freq" field (KANJIDIC2's newspaper-frequency
rank — lower number = more frequent), restricted to kanji that are
actually in the app's own deck (kanji_deck.json / KANJI_BY_LEVEL), sorted
ascending.

2106 of the deck's 2211 kanji have a KANJIDIC2 freq rank. The other 105
(obscure/name-use kanji that showed up in JLPT lists but not in
KANJIDIC2's top ~2500-most-common ranking) are appended at the end, in
their existing JLPT deck order (N5 -> N1) rather than dropped — every
deck kanji needs to land in *some* tier, and "least frequent, in JLPT
order" is a reasonable place for kanji with no measured frequency at
all.

Usage:
    python build_frequency_index.py --kanji /path/to/kanji_basic.json /path/to/kanji_deck.json ./out
"""
import sys
import json


def build_kanji_frequency(kanji_basic_path, kanji_deck_path):
    with open(kanji_basic_path, encoding="utf-8") as f:
        kanji_basic = json.load(f)
    with open(kanji_deck_path, encoding="utf-8") as f:
        kanji_deck = json.load(f)

    # Preserve JLPT deck order (N5 -> N1, then within-level order) as
    # the fallback ordering and as the source of "which kanji are even
    # in the deck" — freq ranks for kanji outside the deck are irrelevant
    # here.
    deck_order = []
    seen = set()
    for level in ("N5", "N4", "N3", "N2", "N1"):
        for entry in kanji_deck.get(level, []):
            char = entry["kanji"]
            if char not in seen:
                seen.add(char)
                deck_order.append(char)

    ranked = []
    unranked = []
    for char in deck_order:
        freq = kanji_basic.get(char, {}).get("freq")
        if freq is not None:
            ranked.append((freq, char))
        else:
            unranked.append(char)

    ranked.sort(key=lambda pair: pair[0])
    ordered = [char for _, char in ranked] + unranked
    return ordered, len(ranked), len(unranked)


if __name__ == "__main__":
    args = sys.argv[1:]
    if args and args[0] == "--kanji":
        args = args[1:]
    if len(args) < 2:
        print("Usage: python build_frequency_index.py --kanji /path/to/kanji_basic.json /path/to/kanji_deck.json [out_dir]")
        sys.exit(1)

    kanji_basic_path, kanji_deck_path = args[0], args[1]
    out_dir = args[2] if len(args) > 2 else "."

    ordered, ranked_count, unranked_count = build_kanji_frequency(kanji_basic_path, kanji_deck_path)

    with open(f"{out_dir}/kanji_frequency.json", "w", encoding="utf-8") as f:
        json.dump(ordered, f, ensure_ascii=False, indent=2)

    print(f"{len(ordered)} deck kanji ordered ({ranked_count} by real KANJIDIC2 freq rank, "
          f"{unranked_count} appended in JLPT order, no freq rank available).")
