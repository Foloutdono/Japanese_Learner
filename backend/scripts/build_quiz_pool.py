"""
Write down the sentences each grammar point's closing quiz may draw on
(plan 195), into content/grammar/quiz_pool.json.

    python -m scripts.build_quiz_pool          # rewrite the file
    python -m scripts.build_quiz_pool --check  # report what differs, write nothing

Run it after any change to the catalogue (content/grammar/*.json) or to
the reading bank (content/reading_sentences.py), and after any change to
the grammar detector that moves what it finds:
tests/test_grammar_quiz_pool.py fails while the file disagrees with what
study/grammar_quiz_pool.write_pool answers.
"""
import argparse
import json
import sys

from study import grammar_quiz_pool


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument("--check", action="store_true", help="report the differences and write nothing")
    args = parser.parse_args()

    now = grammar_quiz_pool.write_pool()
    try:
        was = json.loads(grammar_quiz_pool.SNAPSHOT.read_text(encoding="utf-8"))
    except FileNotFoundError:
        was = {}
    changed = False
    for level, points in now.items():
        for pattern, sentences in points.items():
            before = set(was.get(level, {}).get(pattern, []))
            for jp in sorted(set(sentences) - before):
                print(f"  + {level} {pattern} {jp}")
            for jp in sorted(before - set(sentences)):
                print(f"  - {level} {pattern} {jp}")
            changed |= before != set(sentences)
        for pattern in set(was.get(level, {})) - set(points):
            print(f"  - {level} {pattern} (all)")
            changed = True
        print(f"{level}: {len(points)} points with a sentence, {sum(len(s) for s in points.values())} sentences")
    if args.check:
        return 1 if changed else 0
    grammar_quiz_pool.SNAPSHOT.write_text(json.dumps(now, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"Wrote {grammar_quiz_pool.SNAPSHOT}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
