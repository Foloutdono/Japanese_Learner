"""
File the course's example sentences under the sense they use (plan 296), in batches.

    python -m scripts.example_senses stats                 # the sentences filed under a sense, and the moves
    python -m scripts.example_senses prep DIR --batches 10 # every word's sense-filed sentences, as review batches
    python -m scripts.example_senses check FILE            # a reviewer's moves, before they are merged
    python -m scripts.example_senses merge DIR             # DIR/senses_*.json, then sverify_*.json, into datas/vocab/example_senses.json

A deck word's card and dictionary page nest each example under the sense
JMdict files it under, and JMdict files a sentence whose link names no
sense under the first (content/example_fixes.py, "plan 296"). Only a word
with two senses or more that say different things can show a sentence
under the wrong one, so a batch holds those words alone, each with the
senses the page lists (one number for senses that say the same thing,
as the page folds them: mergeSenses) and the sentences it nests under
them, as the page shows them now -- plan 227's corrections applied, the
moves already made ignored, so a batch is always JMdict's filing.

A batch item:

    {"key", "level", "word", "card", "senses": {"1": gloss, ...},
     "examples": [{"jp", "en", "sense"}]}

`card` is the deck's own gloss; `sense` the number the sentence is filed
under now. A reviewer writes DIR/senses_NN.json, the moves alone:

    {"moves": [{"key", "jp", "sense": 3, "why"}]}

`sense` the number of the sense the sentence uses; `"sense": null` where
it uses the word in no sense listed (shown with the word, under none);
`"drop": true` in place of `sense` where the sentence is another word
written alike (方 read かた under ほう), or read alike and written
otherwise (開く under 空く, plan 297): a drop is open to any word whose
page nests sentences under a sense, one sense or more. A second reader's
DIR/sverify_NN.json, of the same shape, replaces the reviewer's move for
each sentence it names, and `"keep": true` in place of `sense` undoes it.
"""
import argparse
import glob
import json
import os
import re
import sys

from content import example_fixes
from content.vocab_data import VOCAB_BY_LEVEL
from content.vocab_extras import get_vocab_extras

LEVELS = ("N5", "N4", "N3", "N2", "N1")


def _split_outside_parens(text: str, sep: str) -> list[str]:
    out, depth, cur = [], 0, ""
    for ch in text:
        if ch in "([":
            depth += 1
        elif ch in ")]":
            depth = max(0, depth - 1)
        if ch == sep and depth == 0:
            out.append(cur)
            cur = ""
        else:
            cur += ch
    out.append(cur)
    return out


def gloss_key(gloss: str) -> str:
    """A sense's glosses as the page compares them (gloss.jsx, splitGlosses
    and mergeSenses): split, folded for case and spacing."""
    sep = ";" if ";" in gloss else ","
    parts = [re.sub(r"\s+", " ", p).strip().lower() for p in _split_outside_parens(gloss, sep)]
    return "|".join(p for p in parts if p)


def _key(word: dict) -> str:
    return f"{word.get('kanji') or ''}::{word['kana']}"


def items() -> dict[str, dict]:
    """key -> batch item, for every deck word whose page nests a sentence
    under a sense: JMdict's filing, the moves ignored. A word of one sense
    can show no sentence under the wrong one, but can show another word's
    (plan 297: 開く's door under 空く), which a drop takes off it."""
    saved = example_fixes.refiled_all
    example_fixes.refiled_all = lambda: {}
    try:
        out: dict[str, dict] = {}
        for level in LEVELS:
            for word in VOCAB_BY_LEVEL[level]:
                key = _key(word)
                if key in out:
                    continue
                kanji, kana = word.get("kanji") or "", word["kana"]
                extras = get_vocab_extras(kanji, kana, word.get("meaning", ""), "en")
                # One number for the senses that say the same thing,
                # the first, as the page folds them.
                rep: dict[int, int] = {}
                first: dict[str, int] = {}
                senses: dict[str, str] = {}
                for sense in extras["senses"]:
                    k = gloss_key(sense["glossary"])
                    if k and k in first:
                        rep[sense["number"]] = first[k]
                        continue
                    first[k] = rep[sense["number"]] = sense["number"]
                    senses[str(sense["number"])] = sense["glossary"]
                filed = [ex for ex in extras["examples"] if ex["sense_number"] is not None]
                if not filed:
                    continue
                out[key] = {
                    "key": key, "level": level,
                    "word": f"{kanji} ({kana})" if kanji else kana,
                    "card": word.get("meaning", ""),
                    "senses": senses,
                    "examples": [{"jp": ex["jp"], "en": ex.get("en", ""), "sense": rep[ex["sense_number"]]}
                                 for ex in filed],
                    "_rep": rep,
                }
        return out
    finally:
        example_fixes.refiled_all = saved


def problems(move: dict, known: dict[str, dict]) -> list[str]:
    """What is wrong with one move -- [] when it can be merged."""
    key, jp = move.get("key"), move.get("jp") or ""
    where = f"{key}: {jp[:24] or '?'}"
    item = known.get(key or "")
    if item is None:
        return [f"{where}: not a deck word that nests sentences under a sense"]
    shown = {ex["jp"]: ex for ex in item["examples"]}
    if jp not in shown:
        return [f"{where}: not a sentence the word nests under a sense"]
    out = []
    why = move.get("why")
    if not isinstance(why, str) or not why.strip():
        out.append(f"{where}: `why` is empty")
    elif "\n" in why:
        out.append(f"{where}: `why` has a line break")
    kinds = [k for k in ("sense", "drop", "keep") if k in move]
    if len(kinds) != 1:
        return out + [f"{where}: give one of `sense`, `drop` or `keep`"]
    if "drop" in move and move["drop"] is not True:
        out.append(f"{where}: `drop` is true or absent")
    if "keep" in move and move["keep"] is not True:
        out.append(f"{where}: `keep` is true or absent")
    if "sense" in move and move["sense"] is not None:
        sense = move["sense"]
        if not isinstance(sense, int) or isinstance(sense, bool) or str(sense) not in item["senses"]:
            out.append(f"{where}: sense {sense!r} is not one of {', '.join(item['senses'])}")
        elif sense == shown[jp]["sense"]:
            out.append(f"{where}: already under sense {sense}")
    return out


def _entry(move: dict, item: dict) -> dict:
    why = move["why"].strip()
    if move.get("drop"):
        return {"drop": True, "why": why}
    if move["sense"] is None:
        return {"sense": None, "why": why}
    return {"sense": move["sense"], "gloss": item["senses"][str(move["sense"])], "why": why}


def _load(path: str) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def cmd_stats() -> int:
    known = items()
    several = [i for i in known.values() if len(i["senses"]) >= 2]
    pairs = sum(len(i["examples"]) for i in several)
    print(f"{pairs} sentences nested under a sense, across {len(several)} words with two senses or more")
    moved = example_fixes.refiled_all()
    entries = [(k, jp, e) for k, by in moved.items() for jp, e in by.items()]
    print(f"{len(entries)} filed elsewhere: {sum(1 for *_, e in entries if e.get('sense'))} under another sense, "
          f"{sum(1 for *_, e in entries if 'sense' in e and e['sense'] is None)} under none, "
          f"{sum(1 for *_, e in entries if e.get('drop'))} not shown")
    stale = [f"{k}: {jp[:24]}" for k, jp, _ in entries
             if k not in known or jp not in {ex["jp"] for ex in known[k]["examples"]}]
    print(f"{len(stale)} of a sentence the word no longer nests under a sense")
    return 0


def _write_batch(path: str, chunk: list[dict]) -> None:
    # A word a line: a reviewer reads it whole, and the file stays short.
    with open(path, "w", encoding="utf-8") as f:
        f.write("[\n" + ",\n".join(json.dumps(item, ensure_ascii=False) for item in chunk) + "\n]\n")


def cmd_prep(out_dir: str, batches: int) -> int:
    # Only a word of two senses or more can show a sentence under the
    # wrong one: the review reads those.
    known = [i for i in items().values() if len(i["senses"]) >= 2]
    total = sum(len(i["examples"]) for i in known)
    os.makedirs(out_dir, exist_ok=True)
    # Batches of about the same number of sentences, a word never split.
    target, n, chunk, count = -(-total // batches), 1, [], 0
    for item in known:
        chunk.append({k: v for k, v in item.items() if not k.startswith("_")})
        count += len(item["examples"])
        if count >= target:
            _write_batch(os.path.join(out_dir, f"batch_{n:02d}.json"), chunk)
            n, chunk, count = n + 1, [], 0
    if chunk:
        _write_batch(os.path.join(out_dir, f"batch_{n:02d}.json"), chunk)
    else:
        n -= 1
    print(f"{total} sentences of {len(known)} words in {n} batches under {out_dir}")
    return 0


def cmd_check(path: str) -> int:
    known = items()
    moves = _load(path).get("moves") or []
    found = [p for move in moves for p in problems(move, known)]
    seen = set()
    for move in moves:
        pair = (move.get("key"), move.get("jp"))
        if pair in seen:
            found.append(f"{pair[0]}: {(pair[1] or '?')[:24]}: moved twice")
        seen.add(pair)
    for line in found:
        print(line)
    print(f"{len(moves)} move(s), {len(found)} problem(s)")
    return 1 if found else 0


def cmd_merge(in_dir: str) -> int:
    known = items()
    shown = {(k, ex["jp"]) for k, i in known.items() for ex in i["examples"]}
    # A move of a sentence the word no longer nests is dropped.
    merged = {(k, jp): e for k, by in example_fixes.refiled_all().items() for jp, e in by.items()
              if (k, jp) in shown}
    found = []
    for prefix in ("senses_", "sverify_"):
        source: dict[tuple, str] = {}
        for path in sorted(glob.glob(os.path.join(in_dir, f"{prefix}*.json"))):
            name = os.path.basename(path)
            batch = path.replace(prefix, "batch_")
            own = {i["key"] for i in _load(batch)} if os.path.exists(batch) else None
            for move in _load(path).get("moves") or []:
                pair = (move.get("key"), move.get("jp"))
                where = f"{name}: {pair[0]}: {(pair[1] or '?')[:24]}"
                if own is not None and pair[0] not in own:
                    found.append(f"{where}: not a word of {os.path.basename(batch)}")
                    continue
                if pair in source:
                    found.append(f"{where}: also in {source[pair]}")
                    continue
                source[pair] = name
                issues = problems(move, known)
                if issues:
                    found += [f"{name}: {p}" for p in issues]
                    continue
                if move.get("keep"):
                    merged.pop(pair, None)
                else:
                    merged[pair] = _entry(move, known[pair[0]])
    for line in found:
        print(line)
    if found:
        print(f"{len(found)} problem(s): nothing written")
        return 1
    out: dict[str, dict] = {}
    for (key, jp), entry in sorted(merged.items()):
        out.setdefault(key, {})[jp] = entry
    data = {"_meta": "The course's sentences filed under the sense they use (plan 296): content/example_fixes.py.",
            "senses": out}
    with open(example_fixes.SENSES_PATH, "w", encoding="utf-8") as f:
        f.write(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
    print(f"{len(merged)} sentence(s) of {len(out)} word(s) filed elsewhere, in {example_fixes.SENSES_PATH}")
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    sub = ap.add_subparsers(dest="command", required=True)
    sub.add_parser("stats")
    p = sub.add_parser("prep")
    p.add_argument("dir")
    p.add_argument("--batches", type=int, default=10)
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
