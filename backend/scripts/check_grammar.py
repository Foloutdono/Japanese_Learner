"""
Check the grammar catalogue, the way the build will (plan 087).

    python -m scripts.check_grammar                # every level; exit 1 on a problem
    python -m scripts.check_grammar --level N5     # one level
    python -m scripts.check_grammar --report       # the coverage table too

Read-only, and it needs no database and no .env: it imports the content
and study/grammar_check.py and nothing else, so it runs in a fresh clone
while a lesson is being written. tests/test_grammar_points.py runs the
same gate, so a catalogue this passes is a catalogue the suite passes.
"""
import argparse
import sys

from content.grammar_points_data import LEVELS
from study.grammar_check import problems, report


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--level", choices=LEVELS, help="check one level only")
    parser.add_argument("--report", action="store_true", help="print the per-level coverage table")
    args = parser.parse_args(argv)

    levels = (args.level,) if args.level else LEVELS
    found = problems(levels)
    for line in found:
        print(line)

    if args.report:
        rows = report(levels)
        cols = ("points", "rich", "with_steps", "with_compare", "contrast_ok", "fill_ok",
                "fr_pending", "examples_min", "examples_avg")
        print()
        print("level  " + "  ".join(f"{c:>12}" for c in cols))
        for level, row in rows.items():
            print(f"{level:<5}  " + "  ".join(f"{str(row[c]):>12}" for c in cols))

    if found:
        print(f"\n{len(found)} problem(s)", file=sys.stderr)
        return 1
    print(f"clean: {', '.join(levels)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
