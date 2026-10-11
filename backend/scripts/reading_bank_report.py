"""
The reading bank measured against its levels (plan 192). Read-only, no
database, no network; needs the tokenizer (fugashi + unidic-lite).

content/reading_sentences.py's rules say what a row must not hold --
nothing above its level -- and, since plan 192, what an N4-N1 row must
hold: two deck words of its own level besides its grammar point, its
focus one of them. This prints how the bank stands against both, level
by level, and checks rows that are not in the bank yet: the way the
bank was written was a file of candidates run through --check until
every row came back clean, with each row's furigana and romaji printed
so a wrong reading is seen before a learner is marked against it.

    python -m scripts.reading_bank_report               # per-level figures
    python -m scripts.reading_bank_report --rows N2     # each N2 row, its level words and problems
    python -m scripts.reading_bank_report --points N2   # each N2 point and how many rows claim it
    python -m scripts.reading_bank_report --check rows.json
        # rows.json: [{"level", "jp", "en", "fr", "grammar", "focus"}, ...]
"""
import argparse
import json
from collections import Counter
from statistics import mean

from content import reading_sentences as bank
from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL
from content.kanji_data import DECK_BY_CHAR
from study import difficulty as D
from study import grammar_detect, morphology
from study.furigana import align_sentence
from study.grammar_match import verifiable
from study.level_mix import words_at_level
from study.romaji import sentence_romaji


def level_kanji(jp: str, level: str) -> set[str]:
    """The kanji in `jp` the kanji deck teaches at exactly `level`."""
    return {c for c in jp if c in DECK_BY_CHAR and DECK_BY_CHAR[c][0] == level}


def figures(level: str) -> dict:
    """The level's figures, the ones tests/test_reading_sentences.py ratchets."""
    from content.vocab_data import VOCAB_BY_LEVEL
    from content.kanji_data import KANJI_BY_LEVEL

    rows = bank.BY_LEVEL[level]
    counts, words, kanji = [], set(), set()
    for row in rows:
        found = words_at_level(row["jp"], level, row["grammar"])
        counts.append(len(found))
        words |= {w["raw_id"] for w in found}
        kanji |= level_kanji(row["jp"], level)
    claimed = Counter(row["grammar"] for row in rows)
    checkable = {p for p in bank.patterns_for(level) if verifiable(p)}
    return {
        "rows": len(rows),
        "points": len(claimed),
        "covered": len(checkable & set(claimed)),
        "checkable": len(checkable),
        "single": sum(1 for n in claimed.values() if n < 2),
        "mean_words": round(mean(counts), 2) if counts else 0,
        "under": sum(1 for n in counts if n < bank.LEVEL_WORDS_MIN),
        "words": len(words),
        "deck_words": len(VOCAB_BY_LEVEL.get(level, [])),
        "kanji": len(kanji),
        "deck_kanji": len(KANJI_BY_LEVEL.get(level, [])),
        "mean_len": round(mean(len(r["jp"]) for r in rows), 1) if rows else 0,
        "cap": D.MAX_CHARS[level],
    }


def ruby(jp: str) -> str:
    """The furigana inline, 期[き]待[たい]が…, for reading by eye."""
    return "".join(
        f"{part['text']}[{part['reading']}]" if part.get("reading") else part["text"]
        for part in align_sentence(jp)
    )


def describe(level: str, row: dict) -> list[str]:
    """What a writer checks by eye: the readings, the romaji, the points
    the detector lights and every deck word with its level."""
    from study.analysis import analyze_local

    lines = [f"  ruby   {ruby(row['jp'])}", f"  romaji {sentence_romaji(row['jp'])}"]
    hits = [f"{p}({lv})" for p, lv, *_ in D.points_in(row["jp"])]
    lines.append(f"  points {' '.join(hits) or '-'}")
    tagged = []
    for tok in analyze_local(row["jp"])["tokens"]:
        match = tok.get("vocab_match") or {}
        if match.get("pool"):
            tagged.append(f"{tok['surface']}(pool)")
        elif match.get("level"):
            entry = match.get("entry") or {}
            tagged.append(f"{entry.get('kanji') or entry.get('kana')}({match['level']})")
    lines.append(f"  words  {' '.join(tagged) or '-'}")
    found = words_at_level(row["jp"], level, row.get("grammar", ""))
    lines.append(f"  {level}     {', '.join(w['kanji'] or w['kana'] for w in found) or '-'}")
    return lines


def check(path: str) -> int:
    """Run candidate rows through row_problems; print each with what a
    writer needs to judge it. Returns how many rows failed."""
    with open(path, encoding="utf-8") as f:
        rows = json.load(f)
    in_bank = {row["jp"]: level for level, rs in bank.BY_LEVEL.items() for row in rs}
    # The lessons' own sentences: a reading run that served them would
    # be the lesson again, not a sentence read with what it taught.
    lessons = {
        ex["jp"] for entries in GRAMMAR_POINTS_BY_LEVEL.values()
        for entry in entries for ex in entry.get("examples", []) if ex.get("jp")
    }
    seen: set[str] = set()
    failed = 0
    for i, row in enumerate(rows):
        level = row["level"]
        found = bank.row_problems(level, row)
        if row["jp"] in seen:
            found.append("twice in this file")
        seen.add(row["jp"])
        if row["jp"] in in_bank and row.get("replaces") != row["jp"]:
            found.append(f"already in the bank at {in_bank[row['jp']]}")
        if row["jp"] in lessons:
            found.append("a grammar lesson's own example")
        failed += bool(found)
        print(f"[{i}] {'FAIL' if found else 'ok  '} {level} {row.get('grammar')} | {row['jp']}")
        for line in found:
            print(f"  !!     {line}")
        for line in describe(level, row):
            print(line)
    print(f"\n{failed} of {len(rows)} rows have problems")
    return failed


def points(level: str) -> None:
    claimed = Counter(row["grammar"] for row in bank.BY_LEVEL[level])
    for entry in GRAMMAR_POINTS_BY_LEVEL[level]:
        p = entry["pattern"]
        flags = ("v" if verifiable(p) else "-") + ("d" if grammar_detect.can_find(p) else "-")
        print(f"{claimed.get(p, 0)}  {flags}  {p}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--rows", metavar="LEVEL", help="each row of a level")
    parser.add_argument("--points", metavar="LEVEL", help="each catalogue point and its rows")
    parser.add_argument("--check", metavar="FILE", help="candidate rows, as JSON")
    args = parser.parse_args()
    if not morphology.MORPHOLOGY_AVAILABLE:
        print("needs the tokenizer: pip install fugashi unidic-lite")
        return 2
    if args.check:
        return 1 if check(args.check) else 0
    if args.points:
        points(args.points)
        return 0
    if args.rows:
        catalogue = bank.patterns_for(args.rows)
        for i, row in enumerate(bank.BY_LEVEL[args.rows]):
            found = words_at_level(row["jp"], args.rows, row["grammar"])
            names = ", ".join(w["kanji"] or w["kana"] for w in found) or "-"
            print(f"{i:>3} {len(found)} {row['grammar']:<20} {row['jp']}   [{names}]")
            for line in bank.row_problems(args.rows, row, catalogue):
                print(f"      !! {line}")
        return 0
    print("level  rows  points  covered  1-row  words/row  under  level words used   level kanji used  len/cap")
    for level in D.LEVELS:
        f = figures(level)
        print(
            f"{level:<6} {f['rows']:>4}  {f['points']:>6}  {f['covered']:>3}/{f['checkable']:<4} {f['single']:>5}"
            f"  {f['mean_words']:>9}  {f['under']:>5}  {f['words']:>6} of {f['deck_words']:<8}"
            f"  {f['kanji']:>5} of {f['deck_kanji']:<6}  {f['mean_len']}/{f['cap']}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
