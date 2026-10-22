"""
The parts of the app's own sentences a breakdown leaves saying nothing
(plan 266). Read-only, no database.

A breakdown is the learner's map of a sentence: every word row carries
its card's meaning, every particle and ending the grammar point written
on it, a number its figure and a name the word "name". A part with none
of these is a gap -- a row with no meaning, or a particle with no card
to open -- and this lists them, over every sentence the app teaches: the
reading bank, the grammar lessons, dictation, the conversation bank and
the comprehension seeds. The rows are grouped as the screen groups them
(frontend rows.js): a verb or an adjective takes its endings along, a
particle and the copula stand alone, a mark is no row.

    python -m scripts.breakdown_gaps                 # the gaps, by kind
    python -m scripts.breakdown_gaps --kind silent_particle --limit 60
    python -m scripts.breakdown_gaps --json          # every gap, as JSON

A reason to look, never a gate: a gap is closed in the lookups
(study/card_lookup.py) or the detector (study/grammar_detect.py), by
counter-case, and the change diffed over every sentence before it ships.
"""
import argparse
import collections
import json
import os

from scripts import audit_vocab_deck
from study import analysis

LEVELS = ("N5", "N4", "N3", "N2", "N1")
_CONTENT = os.path.join(os.path.dirname(os.path.dirname(__file__)), "content")

_SKIP_POS = frozenset({"symbol", "punctuation", "filler"})
_FOLDS = frozenset({"verb", "adjective", "auxiliary"})
_COPULA = frozenset({"だ", "です"})


def sentences() -> list[tuple[str, str, str]]:
    """(level, sentence, source) for every sentence the app shows, once."""
    out = list(audit_vocab_deck.taught_sentences())
    for level in LEVELS:
        with open(os.path.join(_CONTENT, "conversation", f"{level}.json"), encoding="utf-8") as f:
            scenarios = json.load(f)

        def walk(node):
            if isinstance(node, dict):
                for key, value in node.items():
                    if key == "jp" and isinstance(value, str):
                        out.append((level, value, "conversation"))
                    else:
                        walk(value)
            elif isinstance(node, list):
                for value in node:
                    walk(value)
        walk([s.get("turns") for s in scenarios])
        with open(os.path.join(_CONTENT, "comprehension", f"{level}.json"), encoding="utf-8") as f:
            for seed in json.load(f):
                out.extend((level, s["jp"], "comprehension") for s in seed.get("breakdown") or [] if s.get("jp"))
    seen: set[str] = set()
    return [row for row in out if not (row[1] in seen or seen.add(row[1]))]


def _stands_alone(token: dict) -> bool:
    return token["pos"] == "particle" or (token["pos"] == "auxiliary"
                                          and (token["lemma"] or token["surface"]) in _COPULA)


def rows(tokens: list[dict]) -> list[list[dict]]:
    """The tokens grouped into the rows a screen draws (rows.js)."""
    out, i = [], 0
    while i < len(tokens):
        token = tokens[i]
        if token["pos"] in _SKIP_POS or not token["surface"].strip():
            i += 1
            continue
        end = i
        if not _stands_alone(token) and token["pos"] in _FOLDS:
            while (end + 1 < len(tokens) and tokens[end + 1]["pos"] == "auxiliary"
                   and not _stands_alone(tokens[end + 1])):
                end += 1
        out.append(tokens[i:end + 1])
        i = end + 1
    return out


def gaps(result: dict) -> list[tuple[str, dict]]:
    """(kind, token) for every part of one breakdown that says nothing."""
    out = []
    for row in rows(result["tokens"]):
        head = row[0]
        explained = head.get("vocab_match") or head.get("gloss") or head.get("grammar")
        if explained:
            out.extend(("ending_unexplained", t) for t in row[1:] if not t.get("grammar"))
        elif head["pos"] in analysis.CONTENT_POS:
            out.append(("word_kanji_only" if head.get("kanji_matches") else "word_no_card", head))
        else:
            out.append((f"silent_{head['pos']}", head))
    return out


def report() -> dict:
    found = []
    taught = sentences()
    for level, jp, source in taught:
        for kind, token in gaps(analysis.analyze_local(jp)):
            found.append({"kind": kind, "surface": token["surface"], "lemma": token["lemma"],
                          "pos": token["pos"], "level": level, "source": source, "jp": jp})
    return {"sentences": len(taught), "with_a_gap": len({g["jp"] for g in found}), "gaps": found}


def render(data: dict, kind: str | None, limit: int) -> str:
    lines = [f"{data['sentences']} sentences, {data['with_a_gap']} with a part that says nothing"]
    by_kind = collections.defaultdict(collections.Counter)
    example = {}
    for g in data["gaps"]:
        key = (g["surface"], g["lemma"], g["pos"])
        by_kind[g["kind"]][key] += 1
        example.setdefault((g["kind"], key), f"[{g['level']}/{g['source']}] {g['jp']}")
    for name, counter in sorted(by_kind.items(), key=lambda kv: -sum(kv[1].values())):
        if kind and name != kind:
            continue
        lines.append(f"\n{name}: {sum(counter.values())} ({len(counter)} distinct)")
        for key, n in counter.most_common(limit):
            lines.append(f"  {n:5d}  {key[0]} ({key[1]}, {key[2]})   {example[(name, key)]}")
    return "\n".join(lines)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--kind", help="one kind of gap only (silent_particle, word_no_card, ...)")
    parser.add_argument("--limit", type=int, default=25, help="items listed per kind")
    parser.add_argument("--json", action="store_true", help="every gap, as JSON")
    args = parser.parse_args(argv)
    data = report()
    if args.json:
        print(json.dumps(data, ensure_ascii=False, indent=1))
    else:
        print(render(data, args.kind, args.limit))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
