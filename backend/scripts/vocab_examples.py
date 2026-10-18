"""
Review the course's example sentences (plan 227), in batches.

    python -m scripts.vocab_examples stats                 # the sentences, the corrections, the gaps
    python -m scripts.vocab_examples prep DIR --batches 24 # every sentence the deck shows, as review batches
    python -m scripts.vocab_examples check FILE            # a reviewer's corrections, before they are merged
    python -m scripts.vocab_examples merge DIR             # DIR/fixes_*.json, then verify_*.json, into datas/vocab/example_fixes.json

    python -m scripts.vocab_examples gaps DIR --batches 16 # the deck words with no sentence, as writing batches
    python -m scripts.vocab_examples check-added FILE      # a writer's sentences, before they are merged
    python -m scripts.vocab_examples merge-added DIR       # DIR/added_*.json, then averify_*.json, into datas/vocab/example_added.json

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

A word JMdict files no sentence under has sentences written for it
(content/example_fixes.added). `gaps` lists those words, beside the
senses JMdict gives them:

    {"key", "level", "kanji", "kana", "meaning", "meaning_fr", "senses"}

and a writer answers DIR/added_NN.json (a second reader DIR/averify_NN.json,
whose entries replace the writer's for their word):

    {"added": [{"key", "level", "jp", "en", "fr"}]}

two sentences a word, each held to `added_problems`.
"""
import argparse
import glob
import json
import os
import re
import sys

from content import example_fixes, jmdict_fr
from content.vocab_data import VOCAB_BY_LEVEL
from content.vocab_extras import _find_senses, _target_span, get_vocab_extras
from study.llm_shared import kanji_set_for_level
from translations import get_meaning
from translations.fr.vocab_fr import VOCAB_FR

LEVELS = ("N5", "N4", "N3", "N2", "N1")


def _originals() -> dict[str, dict]:
    """jp -> {en, fr, words}: every sentence the deck shows, uncorrected."""
    saved, saved_written = example_fixes.fixes, example_fixes.written
    example_fixes.fixes = lambda: {}
    example_fixes.written = lambda: {}
    # The French index is cached from fixes(): built while it is patched
    # out, it would stay empty for the rest of the process.
    example_fixes._french.cache_clear()
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
        example_fixes.fixes, example_fixes.written = saved, saved_written
        example_fixes._french.cache_clear()


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
    written = example_fixes.written()
    print(f"{sum(len(v) for v in written.values())} sentences written for {len(written)} words JMdict gives none; "
          f"{words - len(with_examples | set(written))} deck words without a sentence")
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
    # A sentence the deck no longer shows (its card retired or
    # respelled) has nothing to correct: its correction is dropped.
    merged = {k: v for k, v in example_fixes.fixes().items() if k in originals}
    stale: set[str] = set()
    found = []
    source: dict[str, str] = {}
    for path in sorted(glob.glob(os.path.join(in_dir, "fixes_*.json"))):
        # A reviewer corrects their own batch: a fix for another batch's
        # item is a crossed wire (two reviewers shared a helper script),
        # and two files correcting one sentence would be settled by
        # file order alone.
        batch = path.replace("fixes_", "batch_")
        own = {i["jp"] for i in _load(batch)} if os.path.exists(batch) else None
        for fix in _load(path).get("fixes") or []:
            name = os.path.basename(path)
            if own is not None and fix.get("orig") not in own:
                found.append(f"{name}: {(fix.get('orig') or '?')[:30]}: not an item of {os.path.basename(batch)}")
                continue
            if fix.get("orig") in source:
                found.append(f"{name}: {(fix.get('orig') or '?')[:30]}: also corrected in {source[fix['orig']]}")
                continue
            source[fix.get("orig")] = name
            if fix.get("orig") not in originals:
                stale.add(fix.get("orig"))
                continue
            issues = problems(fix, originals)
            if issues:
                found += [f"{name}: {p}" for p in issues]
                continue
            merged[fix["orig"]] = {k: fix[k].strip() for k in ("jp", "en", "fr", "why")}
    # A second reader's DIR/verify_NN.json amends batch NN's corrections:
    # an entry replaces the first reviewer's for its sentence.
    amended: dict[str, str] = {}
    for path in sorted(glob.glob(os.path.join(in_dir, "verify_*.json"))):
        name = os.path.basename(path)
        batch = path.replace("verify_", "batch_")
        own = {i["jp"] for i in _load(batch)} if os.path.exists(batch) else None
        for fix in _load(path).get("fixes") or []:
            orig = fix.get("orig")
            if own is not None and orig not in own:
                found.append(f"{name}: {(orig or '?')[:30]}: not an item of {os.path.basename(batch)}")
                continue
            if orig in amended:
                found.append(f"{name}: {(orig or '?')[:30]}: also amended in {amended[orig]}")
                continue
            amended[orig] = name
            if orig not in originals:
                stale.add(orig)
                continue
            issues = problems(fix, originals)
            if issues:
                found += [f"{name}: {p}" for p in issues]
                continue
            merged[orig] = {k: fix[k].strip() for k in ("jp", "en", "fr", "why")}
    for line in found:
        print(line)
    if found:
        print(f"{len(found)} problem(s): nothing written")
        return 1
    data = {
        "_meta": "The course's corrected example sentences (plan 227): content/example_fixes.py.",
        "fixes": dict(sorted(merged.items())),
    }
    with open(example_fixes.PATH, "w", encoding="utf-8") as f:
        f.write(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
    print(f"{len(merged)} correction(s) in {example_fixes.PATH}"
          f" ({len(stale)} of a sentence the deck no longer shows, left out)")
    return 0


# ── Sentences for the words JMdict gave none ─────────────────

# The longest a written sentence may run, by the card's level: an N5
# word is met in a short sentence (the brief asks ~20 characters).
MAX_LEN = {"N5": 30, "N4": 35, "N3": 45, "N2": 55, "N1": 60}
PER_WORD = (1, 3)
_JAPANESE = re.compile(r"[\u3040-\u30ff\u4e00-\u9fff]")


def _key(word: dict) -> str:
    return f"{word.get('kanji') or ''}::{word['kana']}"


def gap_words() -> list[tuple[str, dict]]:
    """(level, card) for every deck word that shows no sentence of JMdict's."""
    originals = _originals()
    shown = {w["key"] for item in originals.values() for w in item["words"]}
    return [(level, w) for level in LEVELS for w in VOCAB_BY_LEVEL[level] if _key(w) not in shown]


def added_problems(entry: dict, cards: dict, taken: set) -> list[str]:
    """What is wrong with one written sentence -- [] when it can be merged.
    `cards` maps (level, key) to the gap words; `taken` holds every
    sentence already shown or written."""
    where = f"{entry.get('level')} {entry.get('key')}: {(entry.get('jp') or '?')[:24]}"
    word = cards.get((entry.get("level"), entry.get("key")))
    if word is None:
        return [f"{where}: not a deck word without sentences"]
    out = []
    for field in ("jp", "en", "fr"):
        value = entry.get(field)
        if not isinstance(value, str) or not value.strip():
            out.append(f"{where}: `{field}` is empty")
        elif "\n" in value:
            out.append(f"{where}: `{field}` has a line break")
    jp = (entry.get("jp") or "").strip()
    if not jp:
        return out
    if not jp.endswith(("。", "？", "！", "」")):
        out.append(f"{where}: does not end with 。？！ or 」")
    if _target_span(jp, word.get("kanji") or "", word["kana"]) is None:
        out.append(f"{where}: does not carry the word where the page can mark it (course spelling)")
    allowed = kanji_set_for_level(entry["level"]) | set(word.get("kanji") or "")
    above = "".join(dict.fromkeys(c for c in jp if "\u4e00" <= c <= "\u9fff" and c not in allowed))
    if above:
        out.append(f"{where}: kanji above {entry['level']}: {above} (write them in kana)")
    if len(jp) > MAX_LEN[entry["level"]]:
        out.append(f"{where}: {len(jp)} characters, more than {MAX_LEN[entry['level']]} at {entry['level']}")
    for field in ("en", "fr"):
        if _JAPANESE.search(entry.get(field) or ""):
            out.append(f"{where}: `{field}` has Japanese in it")
    if jp in taken:
        out.append(f"{where}: a sentence the course already shows")
    return out


def _gap_cards() -> dict:
    return {(level, _key(w)): w for level, w in gap_words()}


def _taken() -> set:
    taken = set(_originals())
    taken |= {fix["jp"] for fix in example_fixes.fixes().values()}
    return taken


def _added_found(entries: list[dict], cards: dict, taken: set) -> list[str]:
    found = []
    seen = set(taken)
    per_word: dict[tuple, int] = {}
    for entry in entries:
        found += added_problems(entry, cards, seen)
        seen.add((entry.get("jp") or "").strip())
        pair = (entry.get("level"), entry.get("key"))
        per_word[pair] = per_word.get(pair, 0) + 1
    lo, hi = PER_WORD
    found += [f"{lv} {k}: {n} sentences (between {lo} and {hi})" for (lv, k), n in per_word.items()
              if not lo <= n <= hi]
    return found


def cmd_gaps(out_dir: str, batches: int) -> int:
    items = []
    for level, w in gap_words():
        kanji, kana = w.get("kanji") or "", w["kana"]
        senses = ["; ".join(s.get("glossary") or []) for s in (_find_senses(kanji, kana) or [])][:4]
        items.append({"key": _key(w), "level": level, "kanji": kanji, "kana": kana,
                      "meaning": w.get("meaning", ""), "meaning_fr": get_meaning(w, "fr", VOCAB_FR),
                      "senses": senses})
    os.makedirs(out_dir, exist_ok=True)
    size = -(-len(items) // batches)
    for n in range(batches):
        chunk = items[n * size:(n + 1) * size]
        if chunk:
            with open(os.path.join(out_dir, f"words_{n + 1:02d}.json"), "w", encoding="utf-8") as f:
                json.dump(chunk, f, ensure_ascii=False, indent=1)
    print(f"{len(items)} words without a sentence, in batches of {size} under {out_dir}")
    return 0


def cmd_check_added(path: str) -> int:
    entries = _load(path).get("added") or []
    found = _added_found(entries, _gap_cards(), _taken())
    for line in found:
        print(line)
    print(f"{len(entries)} sentence(s) for {len({(e.get('level'), e.get('key')) for e in entries})} word(s), "
          f"{len(found)} problem(s)")
    return 1 if found else 0


def cmd_merge_added(in_dir: str) -> int:
    cards, taken = _gap_cards(), _taken()
    by_word: dict[tuple, list] = {}
    for path in sorted(glob.glob(os.path.join(in_dir, "added_*.json"))):
        for entry in _load(path).get("added") or []:
            by_word.setdefault((entry.get("level"), entry.get("key")), []).append(entry)
    # A second reader's entries replace the writer's for their word.
    for path in sorted(glob.glob(os.path.join(in_dir, "averify_*.json"))):
        amended: dict[tuple, list] = {}
        for entry in _load(path).get("added") or []:
            amended.setdefault((entry.get("level"), entry.get("key")), []).append(entry)
        by_word.update(amended)
    entries = [e for es in by_word.values() for e in es]
    found = _added_found(entries, cards, taken)
    for line in found:
        print(line)
    if found:
        print(f"{len(found)} problem(s): nothing written")
        return 1
    out = {key: [{k: e[k].strip() for k in ("jp", "en", "fr")} for e in es]
           for (_, key), es in sorted(by_word.items(), key=lambda kv: kv[0][1])}
    data = {"_meta": "Sentences written for the deck words JMdict gives none (plan 227): content/example_fixes.py.",
            "added": out}
    with open(example_fixes.ADDED_PATH, "w", encoding="utf-8") as f:
        f.write(json.dumps(data, ensure_ascii=False, indent=1) + "\n")
    missing = len(cards) - len(out)
    print(f"{len(entries)} sentence(s) for {len(out)} word(s) in {example_fixes.ADDED_PATH}; "
          f"{missing} word(s) still without one")
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
    g = sub.add_parser("gaps")
    g.add_argument("dir")
    g.add_argument("--batches", type=int, default=16)
    ca = sub.add_parser("check-added")
    ca.add_argument("file")
    ma = sub.add_parser("merge-added")
    ma.add_argument("dir")
    args = ap.parse_args(argv)
    if args.command == "stats":
        return cmd_stats()
    if args.command == "prep":
        return cmd_prep(args.dir, args.batches)
    if args.command == "check":
        return cmd_check(args.file)
    if args.command == "gaps":
        return cmd_gaps(args.dir, args.batches)
    if args.command == "check-added":
        return cmd_check_added(args.file)
    if args.command == "merge-added":
        return cmd_merge_added(args.dir)
    return cmd_merge(args.dir)


if __name__ == "__main__":
    sys.exit(main())
