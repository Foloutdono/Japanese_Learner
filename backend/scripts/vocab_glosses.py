"""
Review the course's glosses (plan 223), in batches.

    python -m scripts.vocab_glosses prep DIR --batches 14  # every deck card, as review batches
    python -m scripts.vocab_glosses check FILE             # a reviewer's corrections, before they are applied
    python -m scripts.vocab_glosses apply DIR              # every DIR/glosses_*.json into the deck

A card's English gloss is its `meaning` in vocab_deck.json, its French
the line fr_gloss reads in vocab_fr.json. Both came from an old import
and were never read against the word: 努める glossed "to serve" (that is
務める), 工夫 "labourer" (こうふ), 統計 "scattering", コンセント "consent",
JMdict's "(1)", "(col)" and "(de:)" left in the text. A batch item puts
each card beside the senses JMdict gives the word (curated_senses), so a
reviewer can tell a gloss from a homograph's:

    {"key", "level", "kanji", "kana", "en", "fr", "senses": ["...; ...", ...]}

A reviewer writes DIR/glosses_NN.json:

    {"fixes": [{"key", "level", "en", "fr", "why"}],
     "cards": [{"key", "level", "problem", "suggest"}]}

`en`/`fr` the corrected gloss (either may be omitted when only the other
was wrong); `cards` lists what a gloss cannot fix -- a wrong reading, a
card that is not a word, a duplicate -- for the deck's own migration
(content/vocab_renames.py); `apply` only reports them.

`apply` writes the English into the card and the French under the
card's own key ("{kanji}::{kana}", fr_gloss reads it first; a kana
card's key is its kana); a bare
written form that still carried a corrected wrong line is given the
French of its most basic card, since /api/translations/vocab serves the
map by form.
"""
import argparse
import glob
import json
import os
import re
import sys

from content.vocab_data import VOCAB_BY_LEVEL
from content.vocab_extras import _find_senses
from translations import fr_gloss
from translations.fr.vocab_fr import VOCAB_FR

LEVELS = ("N5", "N4", "N3", "N2", "N1")
_VOCAB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "datas", "vocab")
DECK = os.path.join(_VOCAB, "vocab_deck.json")
FRENCH = os.path.join(_VOCAB, "vocab_fr.json")


def _key(word: dict) -> str:
    return f"{word.get('kanji') or ''}::{word['kana']}"


def _cards() -> dict[tuple[str, str], dict]:
    return {(level, _key(w)): w for level in LEVELS for w in VOCAB_BY_LEVEL[level]}


def _senses(word: dict) -> list[str]:
    out = []
    for sense in _find_senses(word.get("kanji") or "", word["kana"]) or []:
        gloss = "; ".join(sense.get("glossary") or [])
        if gloss:
            tags = ",".join(sense.get("tags") or [])
            out.append(f"[{tags}] {gloss}" if tags else gloss)
    return out[:6]


def problems(fix: dict, cards: dict) -> list[str]:
    where = f"{fix.get('level')} {fix.get('key')}"
    if (fix.get("level"), fix.get("key")) not in cards:
        return [f"{where}: not a deck card"]
    out = []
    if not (fix.get("en") or fix.get("fr")):
        out.append(f"{where}: neither `en` nor `fr`")
    for field in ("en", "fr", "why"):
        value = fix.get(field)
        if field in fix and (not isinstance(value, str) or not value.strip() or "\n" in value):
            out.append(f"{where}: `{field}` is empty or has a line break")
        elif field != "why" and isinstance(value, str) and re.search(r",(?! )", value):
            # tests/test_audit_vocab_deck: senses are ", "-separated (plan 108).
            out.append(f"{where}: `{field}` has a comma without a space after it")
    if not (fix.get("why") or "").strip():
        out.append(f"{where}: `why` is empty")
    word = cards[(fix["level"], fix["key"])]
    if fix.get("en") == word.get("meaning") and fix.get("fr", fr_gloss(word, VOCAB_FR)) == fr_gloss(word, VOCAB_FR):
        out.append(f"{where}: changes nothing")
    return out


def cmd_prep(out_dir: str, batches: int) -> int:
    items = []
    for level in LEVELS:
        for w in VOCAB_BY_LEVEL[level]:
            items.append({"key": _key(w), "level": level, "kanji": w.get("kanji") or "", "kana": w["kana"],
                          "en": w.get("meaning", ""), "fr": fr_gloss(w, VOCAB_FR) or "", "senses": _senses(w)})
    os.makedirs(out_dir, exist_ok=True)
    size = -(-len(items) // batches)
    for n in range(batches):
        chunk = items[n * size:(n + 1) * size]
        with open(os.path.join(out_dir, f"cards_{n + 1:02d}.json"), "w", encoding="utf-8") as f:
            json.dump(chunk, f, ensure_ascii=False, indent=1)
    print(f"{len(items)} cards in {batches} batches of {size} under {out_dir}")
    return 0


def _load(path: str) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _found(data: dict, cards: dict) -> list[str]:
    found = [p for fix in data.get("fixes") or [] for p in problems(fix, cards)]
    seen = set()
    for fix in data.get("fixes") or []:
        pair = (fix.get("level"), fix.get("key"))
        if pair in seen:
            found.append(f"{pair[0]} {pair[1]}: corrected twice")
        seen.add(pair)
    for card in data.get("cards") or []:
        if (card.get("level"), card.get("key")) not in cards:
            found.append(f"{card.get('level')} {card.get('key')}: card note for a card not in the deck")
    return found


def cmd_check(path: str) -> int:
    data = _load(path)
    found = _found(data, _cards())
    for line in found:
        print(line)
    print(f"{len(data.get('fixes') or [])} correction(s), {len(data.get('cards') or [])} card note(s), "
          f"{len(found)} problem(s)")
    return 1 if found else 0


def _dump(path: str, data) -> None:
    with open(path, "w", encoding="utf-8") as f:
        f.write(json.dumps(data, ensure_ascii=False, separators=(",", ":")))


def cmd_apply(in_dir: str) -> int:
    cards = _cards()
    fixes, notes, found = {}, [], []
    for path in sorted(glob.glob(os.path.join(in_dir, "glosses_*.json"))):
        data = _load(path)
        found += [f"{os.path.basename(path)}: {p}" for p in _found(data, cards)]
        for fix in data.get("fixes") or []:
            pair = (fix["level"], fix["key"])
            if pair in fixes:
                found.append(f"{os.path.basename(path)}: {pair[0]} {pair[1]}: also corrected elsewhere")
            fixes[pair] = fix
        notes += data.get("cards") or []
    for line in found:
        print(line)
    if found:
        print(f"{len(found)} problem(s): nothing written")
        return 1
    deck = _load(DECK)
    french = _load(FRENCH)
    replaced = set()
    for level in LEVELS:
        for w in deck[level]:
            fix = fixes.get((level, _key(w)))
            if not fix:
                continue
            if fix.get("en"):
                w["meaning"] = fix["en"].strip()
            # A corrected kanji card reads its own French line, even when
            # only its English changed: a form two cards share is read by
            # both until one of them means something else
            # (audit_vocab_deck's shared_french, plan 107).
            old = fr_gloss(w, french)
            line = (fix.get("fr") or old or "").strip()
            if fix.get("fr"):
                replaced.add(old)
            if w.get("kanji"):
                french[_key(w)] = line
            elif fix.get("fr"):
                french[w["kana"]] = line
    # A bare form left holding a line just corrected takes its most
    # basic card's French.
    for level in LEVELS:
        for w in deck[level]:
            form = w.get("kanji")
            if form and french.get(form) in replaced:
                french[form] = fr_gloss(w, french)
    _dump(DECK, deck)
    _dump(FRENCH, french)
    print(f"{len(fixes)} gloss correction(s) applied; {len(notes)} card note(s) to handle by migration:")
    for card in notes:
        print(f"  {card.get('level')} {card.get('key')}: {card.get('problem')} -> {card.get('suggest')}")
    return 0


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    sub = ap.add_subparsers(dest="command", required=True)
    p = sub.add_parser("prep")
    p.add_argument("dir")
    p.add_argument("--batches", type=int, default=14)
    c = sub.add_parser("check")
    c.add_argument("file")
    a = sub.add_parser("apply")
    a.add_argument("dir")
    args = ap.parse_args(argv)
    if args.command == "prep":
        return cmd_prep(args.dir, args.batches)
    if args.command == "check":
        return cmd_check(args.file)
    return cmd_apply(args.dir)


if __name__ == "__main__":
    sys.exit(main())
