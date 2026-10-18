"""
Check the conversation bank, the way the build will (plan 217).

    python -m scripts.check_conversation             # every level; exit 1 on a problem
    python -m scripts.check_conversation --level N5  # one level

Read-only, and it needs no database and no .env: it imports the bank and
study/conversation.py and nothing else, so it runs in a fresh clone while
a scenario is being written. tests/test_conversation.py runs the same
rules, so a bank this passes is a bank the suite passes.
"""
import argparse
import sys

from study.conversation import LEVELS, bank, problems


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--level", choices=LEVELS, help="check one level only")
    args = parser.parse_args(argv)

    levels = (args.level,) if args.level else LEVELS
    found = [line for line in problems() if line.split(" ", 1)[0] in levels]
    for line in found:
        print(line)

    rows = bank()
    print()
    for level in levels:
        scenarios = rows[level]
        turns = sum(len(s.get("turns") or []) for s in scenarios if isinstance(s, dict))
        print(f"{level}  {len(scenarios):>3} scenarios  {turns:>4} turns")

    if found:
        print(f"\n{len(found)} problem(s)", file=sys.stderr)
        return 1
    print(f"clean: {', '.join(levels)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
