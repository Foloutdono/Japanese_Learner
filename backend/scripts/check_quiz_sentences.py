"""
Check sentences written for a grammar point's closing quiz (plan 195)
before they enter content/grammar/quiz_sentences.json.

    python -m scripts.check_quiz_sentences FILE.json   # one file
    python -m scripts.check_quiz_sentences             # the committed bank

A file is {"N5": {"〜ます": ["きょうは学校へ行きます。", ...]}}: the point's
level, the point, the sentences that write it. Each is held to
study/grammar_quiz_pool.sentence_problems: a whole sentence in the level's
kanji, grammar and words, the point visibly written in it, and no
sentence the app already teaches. Sentences must also be distinct across
the file (and, for the committed bank, across the bank). Exits 1 on any
problem, listing each.
"""
import json
import sys
from pathlib import Path

from content.grammar_points_data import find
from study import grammar_quiz_pool


def check(data: dict) -> list[str]:
    out: list[str] = []
    seen: dict[str, str] = {}
    for level, by_pattern in data.items():
        for pattern, sentences in by_pattern.items():
            found = find(pattern)
            if found is None or found[0] != level:
                out.append(f"{level} {pattern}: not a {level} point")
                continue
            if not isinstance(sentences, list):
                out.append(f"{level} {pattern}: sentences must be a list")
                continue
            for jp in sentences:
                for reason in grammar_quiz_pool.sentence_problems(level, pattern, jp):
                    out.append(f"{level} {pattern} {jp}: {reason}")
                if jp in seen:
                    out.append(f"{level} {pattern} {jp}: also written for {seen[jp]}")
                seen[jp] = f"{level} {pattern}"
    return out


def main() -> int:
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else grammar_quiz_pool.WRITTEN
    data = json.loads(path.read_text(encoding="utf-8"))
    problems = check(data)
    for line in problems:
        print(line)
    count = sum(len(s) for by in data.values() for s in by.values())
    print(f"{count} sentences, {len(problems)} problems")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
