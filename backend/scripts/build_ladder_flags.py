"""
Write down which grammar points the ladder's build and write rungs can be
asked on (plan 187e), into content/grammar/ladder.json.

    python -m scripts.build_ladder_flags          # rewrite the file
    python -m scripts.build_ladder_flags --check  # report what differs, write nothing

Run it after any change to the catalogue (content/grammar/*.json):
tests/test_grammar_ladder.py fails while the file disagrees with what
study/grammar_ladder.can_build / can_write answer. The answers are slow to
compute (the detector over every example), which is the only reason they
are written down rather than asked.
"""
import argparse
import json
import sys

from study import grammar_ladder


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument("--check", action="store_true", help="report the differences and write nothing")
    args = parser.parse_args()

    now = grammar_ladder.snapshot_now()
    try:
        was = json.loads(grammar_ladder.SNAPSHOT.read_text(encoding="utf-8"))
    except FileNotFoundError:
        was = {}
    changed = False
    for level, flags in now.items():
        for kind, patterns in flags.items():
            before = set(was.get(level, {}).get(kind, []))
            added, gone = sorted(set(patterns) - before), sorted(before - set(patterns))
            for p in added:
                print(f"  + {level} {kind} {p}")
            for p in gone:
                print(f"  - {level} {kind} {p}")
            changed |= bool(added or gone)
            print(f"{level} {kind}: {len(patterns)} of the level's points")
    if args.check:
        return 1 if changed else 0
    grammar_ladder.SNAPSHOT.write_text(json.dumps(now, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {grammar_ladder.SNAPSHOT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
