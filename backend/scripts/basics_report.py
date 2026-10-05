"""
What the basics course's lessons ask of a learner who has met only the
course so far (plan 186d). Read-only, no database.

tests/test_basics.py holds the course's own sentences to their units: a
sentence there uses only the words and points of its unit and the ones
before it. The lessons a grammar card opens on (content/grammar/N5.json's
examples) were written for the whole of N5, so a point taught in unit 1
can show its rule in a sentence about 郵便局. This lists them, point by
point, with what each example asks that the learner has not met. It is a
reason to look, not a gate: a lesson is the content audit's to rewrite
(docs/content-audit/PLAYBOOK.md), never this script's.

    python -m scripts.basics_report            # the examples that stray
    python -m scripts.basics_report --all      # every example, met or not
    python -m scripts.basics_report --json     # the same, as JSON
"""
import argparse
import json
import os

from study import basics

N5_JSON = os.path.join(os.path.dirname(os.path.dirname(__file__)), "content", "grammar", "N5.json")


def report() -> list[dict]:
    """One row per lesson example of a course point: its unit, its point,
    the sentence and what it asks that the learner has not met there."""
    with open(N5_JSON, encoding="utf-8") as f:
        lessons = {e["pattern"]: e for e in json.load(f)}
    rows = []
    for n, unit in enumerate(basics.units()):
        words, points = basics.taught_through(n)
        for pattern in unit["grammar"]:
            for example in lessons[pattern].get("examples", []):
                rows.append({
                    "unit": unit["id"], "point": pattern, "jp": example["jp"],
                    "strays": basics.strays(example["jp"], words, points),
                })
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--all", action="store_true", help="every example, met or not")
    parser.add_argument("--json", action="store_true", help="print JSON")
    args = parser.parse_args()
    rows = report()
    shown = rows if args.all else [r for r in rows if r["strays"]]
    if args.json:
        print(json.dumps(shown, ensure_ascii=False, indent=2))
        return
    for row in shown:
        print(f"{row['unit']:<14} {row['point']:<22} {row['jp']}")
        for stray in row["strays"]:
            print(f"{'':<38}  {stray}")
    print(f"\n{sum(1 for r in rows if r['strays'])} of {len(rows)} lesson examples ask for something the course has not taught yet")


if __name__ == "__main__":
    main()
