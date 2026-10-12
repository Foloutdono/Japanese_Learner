"""
Check drafted tour quizzes against the gate, and merge the clean ones (plan 196).

    python -m scripts.check_tour_quiz DRAFT.json          # report, change nothing
    python -m scripts.check_tour_quiz DRAFT.json --write  # merge what is clean into content/grammar/*.json

A draft is `{level: {pattern: quiz}}`, where `quiz` is the point's list of
questions as content/grammar/README.md ("The quiz") writes them, or, to
rewrite more of a tour in the same pass, an object with any of `quiz`,
`twists`, `scene` (each replaces the point's own, whole).

What it reports, per point:

- every problem study/grammar_check finds in the entry as it would stand
  with the draft merged in -- the shape, the kanji of the level, the point
  written in the right answer, no sentence twice in the tour, no question
  worded twice;
- as ADVISORY only (they do not hold a merge back), what study/difficulty
  thinks of each Japanese sentence of the draft: kanji, grammar or words it
  files above the level. It is a reason to look, not a verdict -- it reads
  いらっしゃいませ and 飲みたいです as grammar above N5 -- so a sentence it
  flags needs a second look and, if the flag is true, another sentence.

Read-only without --write, and it needs no database. --write touches only
the points whose draft is clean and keeps the files' own layout (two
spaces, no ASCII escapes, a closing newline).
"""
import argparse
import copy
import json
import sys
from pathlib import Path

from content.grammar_points_data import LEVELS, find
from study import difficulty as D
from study.grammar_check import check_entry
from study.grammar_tour import quiz_sentences

GRAMMAR = Path(__file__).resolve().parents[1] / "content" / "grammar"


def _merged(entry: dict, draft) -> dict:
    """The entry as it would stand with `draft` merged into its tour."""
    out = copy.deepcopy(entry)
    tour = out.setdefault("tour", {})
    parts = draft if isinstance(draft, dict) else {"quiz": draft}
    for key, value in parts.items():
        if key not in ("quiz", "twists", "scene"):
            raise ValueError(f"a draft may carry quiz, twists, scene -- not {key!r}")
        tour[key] = value
    return out


def _sentences(entry: dict) -> list[str]:
    tour = entry.get("tour") or {}
    out = []
    for question in tour.get("quiz") or []:
        try:
            out += quiz_sentences(question)
        except (KeyError, TypeError, AttributeError):
            pass
    return out


def _advisory(level: str, entry: dict, draft) -> list[str]:
    parts = draft if isinstance(draft, dict) else {"quiz": draft}
    tour = entry["tour"]
    jp = []
    if "quiz" in parts:
        jp += _sentences(entry)
    if "twists" in parts:
        jp += [t.get("jp") for t in tour.get("twists") or [] if isinstance(t, dict)]
    if "scene" in parts:
        scene = tour.get("scene") or {}
        jp += [line.get("jp") for line in scene.get("lines") or [] if isinstance(line, dict)]
        jp += list((scene.get("ask") or {}).get("choices") or [])
    out = []
    for sentence in jp:
        if not isinstance(sentence, str):
            continue
        verdict = D.report(sentence, level, allow_kanji=entry["pattern"])
        verdict["vocab"] = [(w, lv) for w, lv in verdict["vocab"] if w not in entry["pattern"]]
        why = [f"{key} {verdict[key]}" for key in ("grammar", "vocab") if verdict[key]]
        if why:
            out.append(f"advisory: {sentence} -- " + "; ".join(why))
    return out


def check(draft: dict) -> tuple[dict[tuple[str, str], list[str]], dict[tuple[str, str], list[str]]]:
    """({(level, pattern): problems}, {(level, pattern): advisories}) for a draft."""
    problems, advice = {}, {}
    for level, by_pattern in draft.items():
        if level not in LEVELS:
            raise ValueError(f"{level!r} is not a level")
        for pattern, quiz in by_pattern.items():
            found = find(pattern)
            if found is None or found[0] != level:
                problems[(level, pattern)] = [f"{pattern!r} is not a point of {level}"]
                continue
            entry = found[1]
            if "tour" not in entry:
                problems[(level, pattern)] = ["the point has no tour to put a quiz in"]
                continue
            try:
                merged = _merged(entry, quiz)
            except ValueError as exc:
                problems[(level, pattern)] = [str(exc)]
                continue
            problems[(level, pattern)] = check_entry(level, merged)
            advice[(level, pattern)] = _advisory(level, merged, quiz)
    return problems, advice


def write(draft: dict, clean: set[tuple[str, str]]) -> int:
    """Merge the clean points' drafts into the level files; the count."""
    done = 0
    for level in LEVELS:
        wanted = {p: q for p, q in draft.get(level, {}).items() if (level, p) in clean}
        if not wanted:
            continue
        path = GRAMMAR / f"{level}.json"
        entries = json.loads(path.read_text(encoding="utf-8"))
        for entry in entries:
            if entry["pattern"] in wanted:
                entry["tour"] = _merged(entry, wanted[entry["pattern"]])["tour"]
                done += 1
        path.write_text(json.dumps(entries, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return done


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("draft", help="a JSON file: {level: {pattern: quiz}}")
    parser.add_argument("--write", action="store_true", help="merge the clean points into content/grammar/*.json")
    parser.add_argument("--quiet", action="store_true", help="problems only, no advisories")
    args = parser.parse_args(argv)

    draft = json.loads(Path(args.draft).read_text(encoding="utf-8"))
    problems, advice = check(draft)
    bad = 0
    for (level, pattern), found in problems.items():
        notes = [] if args.quiet else advice.get((level, pattern), [])
        if not found and not notes:
            continue
        print(f"{level} {pattern}")
        for line in found:
            print(f"  PROBLEM {line}")
        for line in notes:
            print(f"  {line}")
        bad += bool(found)
    clean = {key for key, found in problems.items() if not found}
    print(f"\n{len(clean)} clean, {bad} with problems, of {len(problems)}")
    if args.write:
        print(f"merged {write(draft, clean)} point(s)")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
