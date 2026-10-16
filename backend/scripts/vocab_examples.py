"""
Review the course's example sentences (plan 223), in batches.

    python -m scripts.vocab_examples stats                 # the sentences, the corrections, the gaps
    python -m scripts.vocab_examples prep DIR --batches 24 # every sentence the deck shows, as review batches
    python -m scripts.vocab_examples check FILE            # a reviewer's corrections, before they are merged
    python -m scripts.vocab_examples merge DIR             # every DIR/fixes_*.json into datas/vocab/example_fixes.json

The sentences are the Tatoeba ones JMdict files under the deck's words,
as get_vocab_extras shows them (at most five a word); a sentence that
illustrates several deck words is one item listing them all. `prep`
reads them as JMdict has them, ignoring the corrections already made, so
a batch is always the original.

A batch item:

    {"jp", "en", "fr", "words": [{"key", "level", "kanji", "kana",
     "meaning", "meaning_fr", "sense", "shown"}]}

`shown` says whether the sentence carries the word where the page can
mark it; a correction must keep every word that was shown so.

A reviewer writes DIR/fixes_NN.json:

    {"fixes": [{"orig", "jp", "en", "fr", "why"}], "glosses": [...]}

`orig` the sentence as the batch has it; `jp` what to show instead (the
same sentence when only a translation was wrong); `en`, `fr` its
translations; `why` one line. `glosses` lists deck glosses found wrong
on the way ({"key", "level", "lang", "now", "should", "why"}); they are
not applied here.
"""
import argparse
import glob
import json
import os
import sys

from content import example_fixes, jmdict_fr
from content.vocab_data import VOCAB_BY_LEVEL
from content.vocab_extras import _target_span, get_vocab_extras
from translations import get_meaning
from translations.fr.vocab_fr import VOCAB_FR

LEVELS = ("N5", "N4", "N3", "N2", "N1")


def _originals() -> dict[str, dict]:
    """jp -> {en, fr, words}: every sentence the deck shows, uncorrected."""
    saved = example_fixes.fixes
    example_fixes.fixes = lambda: {}
    try:
        out: dict[str, dict] = {}
        for level in LEVELS:
            for word in VOCAB_BY_LEVEL[level]:
                kanji, kana = word.get("kanji") or "", word["kana"]
                extras = get_vocab_extras(kanji, kana, word.get("meaning", ""), "en")
                for ex in extras["examples"]:
                    item = out.setdefault(ex["jp"], {"jp": ex["jp"], "en": ex.get("en", ""),
                                                     "fr": jmdict_fr.example(ex["jp"]) or "", "words": []})
                    item["words"].append({
                        "key": f"{kanji}::{kana}", "level": level, "kanji": kanji, "kana": kana,
                        "meaning": word.get("meaning", ""), "meaning_fr": get_meaning(word, "fr", VOCAB_FR),
                        "sense": ex.get("sense_glossary", ""),
                        "shown": _target_span(ex["jp"], kanji, kana) is not None,
                    })
        return out
    finally:
        example_fixes.fixes = saved


def _carries(jp: str, word: dict) -> bool:
    return _target_span(jp, word["kanji"], word["kana"]) is not None


def problems(fix: dict, originals: dict[str, dict]) -> list[str]:
    """What is wrong with one correction -- [] when it can be merged."""
    orig = fix.get("orig")
    where = (orig or "?")[:30]
    item = originals.get(orig or "")
    if item is None:
        return [f"{where}: not a sentence the deck shows"]
    out = []
    for field in ("jp", "en", "fr", "why"):
        value = fix.get(field)
        if not isinstance(value, str) or not value.strip():
            out.append(f"{where}: `{field}` is empty")
        elif "\n" in value:
            out.append(f"{where}: `{field}` has a line break")
    jp = fix.get("jp") or ""
    if jp and jp != orig:
        for word in item["words"]:
            if word["shown"] and not _carries(jp, word):
                out.append(f"{where}: the new sentence no longer carries {word['key']} where the page can mark it")
    if jp == orig and fix.get("en") == item["en"] and fix.get("fr") == item["fr"]:
        out.append(f"{where}: changes nothing")
    return out


def cmd_stats() -> int:
    originals = _originals()
    fixes = example_fixes.fixes()
    words = sum(len(VOCAB_BY_LEVEL[lv]) for lv in LEVELS)
    with_examples = {w["key"] for item in originals.values() for w in item["words"]}
    print(f"{len(originals)} sentences shown across {len(with_examples)} of {words} deck words")
    print(f"{sum(1 for i in originals.values() if not i['fr'])} without French")
    print(f"{len(fixes)} corrected ({sum(1 for k, f in fixes.items() if f['jp'] != k)} rewritten)")
    stale = [k for k in fixes if k not in originals]
    print(f"{len(stale)} corrections of a sentence the deck no longer shows")
    return 0


def cmd_prep(out_dir: str, batches: int) -> int:
    originals = _originals()
    rank = {lv: i for i, lv in enumerate(LEVELS)}
    items = sorted(originals.values(), key=lambda i: (min(rank[w["level"]] for w in i["words"]), i["words"][0]["key"]))
    os.makedirs(out_dir, exist_ok=True)
    size = -(-len(items) // batches)
    for n in range(batches):
        chunk = items[n * size:(n + 1) * size]
        if not chunk:
            break
        with open(os.path.join(out_dir, f"batch_{n + 1:02d}.json"), "w", encoding="utf-8") as f:
            json.dump(chunk, f, ensure_ascii=False, indent=1)
    print(f"{len(items)} sentences in {min(batches, -(-len(items) // size))} batches of {size} under {out_dir}")
    return 0


def _load(path: str) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def cmd_check(path: str) -> int:
    originals = _originals()
    data = _load(path)
    found = [p for fix in data.get("fixes") or [] for p in problems(fix, originals)]
    seen = set()
    for fix in data.get("fixes") or []:
        if fix.get("orig") in seen:
            found.append(f"{(fix.get('orig') or '?')[:30]}: corrected twice")
        seen.add(fix.get("orig"))
    for line in found:
        print(line)
    print(f"{len(data.get('fixes') or [])} correction(s), {len(data.get('glosses') or [])} gloss note(s), "
          f"{len(found)} problem(s)")
    return 1 if found else 0


def cmd_merge(in_dir: str) -> int:
    originals = _originals()
    merged = dict(example_fixes.fixes())
    found = []
    for path in sorted(glob.glob(os.path.join(in_dir, "fixes_*.json"))):
        for fix in _load(path).get("fixes") or []:
            issues = problems(fix, originals)
            if issues:
                found += [f"{os.path.basename(path)}: {p}" for p in issues]
                continue
            merged[fix["orig"]] = {k: fix[k].strip() for k in ("jp", "en", "fr", "why")}
    for line in found:
        print(line)
    if found:
        print(f"{len(found)} problem(s): nothing written")
        return 1
    data = {
        "_meta": "The course's corrected example sentences (plan 223): content/example_fixes.py.",
        "fixes": dict(sorted(merged.items())),
    }
    with open(example_fixes.PATH, "w", encoding="utf-8") as f:
        f.write(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
    print(f"{len(merged)} correction(s) in {example_fixes.PATH}")
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    sub = ap.add_subparsers(dest="command", required=True)
    sub.add_parser("stats")
    p = sub.add_parser("prep")
    p.add_argument("dir")
    p.add_argument("--batches", type=int, default=24)
    c = sub.add_parser("check")
    c.add_argument("file")
    m = sub.add_parser("merge")
    m.add_argument("dir")
    args = ap.parse_args(argv)
    if args.command == "stats":
        return cmd_stats()
    if args.command == "prep":
        return cmd_prep(args.dir, args.batches)
    if args.command == "check":
        return cmd_check(args.file)
    return cmd_merge(args.dir)


if __name__ == "__main__":
    sys.exit(main())
