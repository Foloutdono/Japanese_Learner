"""
Parses a KANJIDIC2 XML dump into two small JSON assets for a radical-based
dictionary search:

  kanji_radicals.json — { "本": {"radical": 75, "stroke_count": 5}, ... }
  radicals.json        — [ {"number": 75, "char": "木", "stroke_count": 4,
                             "kanji_count": 312}, ... ]  (sorted by number)

Usage:
    python build_radical_index.py /path/to/kanjidic2.xml ./out

Notes:
  - "radical" here means the classical (Kangxi) radical number, taken from
    <rad_value rad_type="classical">. That's the traditional 214-radical
    system paper 漢和辞典 use, and the one your "tap a radical tile" UI
    should be built around.
  - A kanji can list more than one classical rad_value in KANJIDIC2 for
    characters whose classification is genuinely disputed. We keep the
    first — good enough for a browse UI; it doesn't need to be exhaustive
    the way a printed dictionary's canonical index does.
  - The radical's own stroke count and display glyph are DERIVED from your
    data rather than hand-typed: the kanji with the fewest total strokes
    filed under a given radical number is, for virtually every radical,
    the radical's own bare character (0 extra strokes) — so its
    stroke_count IS the radical's stroke count, and it's a normal CJK
    Unified Ideograph that renders reliably in any font (unlike the
    dedicated U+2F00-2FD5 Kangxi Radicals Unicode block, which many fonts
    render poorly since it's rarely used in real text).
"""
import sys
import json
import xml.etree.ElementTree as ET
from collections import defaultdict


def parse_kanjidic2(path):
    tree = ET.parse(path)
    root = tree.getroot()

    kanji_radical = {}               # char -> {"radical": N, "stroke_count": S}
    by_radical = defaultdict(list)   # radical number -> [(char, stroke_count), ...]

    for char_el in root.findall("character"):
        literal = char_el.findtext("literal")
        if not literal:
            continue

        rad_el = char_el.find("radical")
        if rad_el is None:
            continue
        classical = None
        for rv in rad_el.findall("rad_value"):
            if rv.get("rad_type") == "classical":
                classical = int(rv.text)
                break
        if classical is None:
            continue  # no classical radical listed — skip, don't guess

        misc = char_el.find("misc")
        stroke_el = misc.find("stroke_count") if misc is not None else None
        if stroke_el is None or not stroke_el.text:
            continue
        stroke_count = int(stroke_el.text)

        kanji_radical[literal] = {"radical": classical, "stroke_count": stroke_count}
        by_radical[classical].append((literal, stroke_count))

    radicals = []
    for number, entries in by_radical.items():
        char, radical_stroke_count = min(entries, key=lambda e: e[1])
        radicals.append({
            "number": number,
            "char": char,
            "stroke_count": radical_stroke_count,
            "kanji_count": len(entries),
        })
    radicals.sort(key=lambda r: r["number"])

    return kanji_radical, radicals


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python build_radical_index.py /path/to/kanjidic2.xml [out_dir]")
        sys.exit(1)

    xml_path = sys.argv[1]
    out_dir = sys.argv[2] if len(sys.argv) > 2 else "."

    kanji_radical, radicals = parse_kanjidic2(xml_path)

    with open(f"{out_dir}/kanji_radicals.json", "w", encoding="utf-8") as f:
        json.dump(kanji_radical, f, ensure_ascii=False, indent=2)

    with open(f"{out_dir}/radicals.json", "w", encoding="utf-8") as f:
        json.dump(radicals, f, ensure_ascii=False, indent=2)

    found = len(radicals)
    print(f"{len(kanji_radical)} kanji indexed, {found}/214 classical radicals represented.")
    missing = sorted(set(range(1, 215)) - {r["number"] for r in radicals})
    if missing:
        print(f"Radicals with no representative kanji in this file: {missing}")
        print("(their bare character isn't itself covered by this KANJIDIC2 file's "
              "character set — rare, but any kanji already tagged with that radical "
              "number will still filter correctly, you'd just be missing a nice "
              "single-character tile glyph for it)")