"""
The seed pool's exercises measured, and new ones drafted (plan 230).
No network; needs the tokenizer. It runs routes/reading's own checks,
and importing that module opens DATABASE_URL and upserts the seeds into
its pool (routes/reading._seed_comprehension_pool): point DATABASE_URL
at a scratch database, as the tests do.

content/comprehension/*.json is written by hand and held by
tests/test_comprehension_seed.py to the bar a model answer must clear.
This runs the same checks outside pytest, with what each one found
printed, plus the review a test cannot make for itself: the things that
let a reader answer without reading.

    python -m scripts.comprehension_seed_report                 # every shipped seed
    python -m scripts.comprehension_seed_report --level N3      # one level's
    python -m scripts.comprehension_seed_report --check new.json
        # candidate exercises, in the content files' shape, before they enter them
    python -m scripts.comprehension_seed_report --draft new.json
        # new.json's entries with no breakdown, given one to correct:
        # the text cut into sentences, each sentence into the words the
        # analyser hears, every word glossed from the deck where it can be.
        # Written to new.draft.json; every TODO is the author's to fill.

The review flags, none of them a test failure:
  * a quoted fragment (「…」) of a vocabulary or grammar question that is
    not in the text -- the question is about a sentence the text lacks
  * a fragment two questions both quote -- one sentence asked twice
  * a right option far longer than the others -- the eye picks it
  * a right option that repeats a word of its question the others do
    not -- the eye matches it
  * a wrong option of a vocabulary question that shares a word with the
    right one -- two answers that can both be right
  * across a level's exercises, picking the longest option, or the
    shortest, winning more or less often than a blind pick of four
    (plan 259; the exam seeds' LENGTH_TELL, study/exam_seed.py)
"""
import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

from content import comprehension_seed as seed
from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL
from routes import reading
from scripts.carousel_bank import rows_of
from study import difficulty as D
from study.analysis import analyze_local
from study.exam_seed import LENGTH_TELL
from study.grammar_match import verifiable

QUOTE = re.compile(r"「([^」]+)」")
SENTENCE = re.compile(r"[^。！？!?]+[。！？!?]?")
WORDS = re.compile(r"[a-zà-ÿ]{4,}", re.I)
STOP = set("what does this that with from have which mean meaning text sentence writer author dans texte phrase quel quelle quoi avec pour est-ce sont".split())


def _squash_words(part: dict) -> str:
    return reading._squash("".join(w["surface"] for w in part["words"]))


def _squash_sentence(jp: str) -> str:
    return reading._squash("".join(c for c in jp if c not in "。、！？!?「」『』・"))


def problems(entry: dict) -> list[str]:
    """Everything tests/test_comprehension_seed.py would fail on, in words."""
    out: list[str] = []
    level = entry.get("level")
    catalogue = {p["pattern"]: p for p in GRAMMAR_POINTS_BY_LEVEL.get(level, [])}
    if not entry.get("grammar"):
        out.append("names no grammar point")
    for pattern in entry.get("grammar", []):
        if pattern not in catalogue:
            out.append(f"{pattern!r} is not a {level} point")
        elif not verifiable(pattern) or pattern in D.GATE_BLIND:
            out.append(f"{pattern!r} cannot be checked")
    if not entry.get("breakdown"):
        return out + ["no breakdown (draft one with --draft)"]
    points = [catalogue[p] for p in entry.get("grammar", []) if p in catalogue]
    spec = reading.COMPREHENSION_SPECS[level]["questions"]
    for lang in seed.LANGS:
        data = reading._parse_comprehension(json.dumps(seed.render(entry, lang), ensure_ascii=False))
        verdict = reading._check_comprehension(data, level, points)
        for line in verdict.repro + verdict.vocab + verdict.kanji + verdict.length:
            out.append(f"[{lang}] {line}")
        out += [f"[{lang}] seed {p['pattern']} not found in the text" for p in verdict.seeds_missing]
        out += [f"[{lang}] {line}" for line in verdict.grammar_over]
        rendered = seed.render(entry, lang)
        qs = rendered["questions"]
        if len(qs) != spec:
            out.append(f"[{lang}] {len(qs)} questions, {level} asks {spec}")
        if {q["type"] for q in qs} != reading.VALID_QUESTION_TYPES:
            out.append(f"[{lang}] question types {sorted({q['type'] for q in qs})}: all four wanted")
        for i, q in enumerate(qs):
            if len(q["options"]) != 4 or len(set(q["options"])) != 4:
                out.append(f"[{lang}] question {i + 1}: four different options wanted")
            if not 0 <= q["correct"] < 4:
                out.append(f"[{lang}] question {i + 1}: correct out of range")
        for i, part in enumerate(rendered["breakdown"]):
            if not part["words"]:
                out.append(f"[{lang}] sentence {i + 1} has no words")
            elif _squash_words(part) != _squash_sentence(part["jp"]):
                out.append(f"[{lang}] sentence {i + 1}: the words do not spell 「{part['jp']}」")
            if not part["translation"].strip():
                out.append(f"[{lang}] sentence {i + 1} has no translation")
            out += [f"[{lang}] sentence {i + 1}: {w['surface']} has no gloss" for w in part["words"] if not w["meaning"].strip()]
    todo = json.dumps(entry, ensure_ascii=False).count("TODO")
    if todo:
        out.append(f"{todo} TODO left")
    return out


def review(entry: dict) -> list[str]:
    """What lets a reader answer without reading (see the module's doc)."""
    out: list[str] = []
    text = entry["text"]
    quoted: Counter = Counter()
    for i, q in enumerate(entry["questions"], 1):
        frags = QUOTE.findall(q["question"]["en"])
        for frag in frags:
            quoted[frag] += 1
            if q["type"] in ("vocabulary", "grammar") and frag.replace("〜", "") not in text:
                out.append(f"Q{i} quotes 「{frag}」, which is not in the text")
        for lang in seed.LANGS:
            opts = q["options"][lang]
            right = opts[q["correct"]]
            others = [o for j, o in enumerate(opts) if j != q["correct"]]
            if len(right) > 1.6 * max(len(o) for o in others) and len(right) > 25:
                out.append(f"Q{i} [{lang}] the right option is much the longest")
            asked = {w.lower() for w in WORDS.findall(q["question"][lang])} - STOP
            echo = {w.lower() for w in WORDS.findall(right)} & asked
            if echo and not any({w.lower() for w in WORDS.findall(o)} & echo for o in others):
                out.append(f"Q{i} [{lang}] only the right option repeats the question ({', '.join(sorted(echo))})")
    out += [f"「{f}」 is quoted by {n} questions" for f, n in quoted.items() if n > 1]
    return out


def length_tells(entries: list[dict]) -> list[str]:
    """Written with care, the right option drifts to the longest: per
    level and language, picking the longest of the four, or the
    shortest, ties shared, must win about as often as a blind pick."""
    wins: dict[tuple[str, str], list[float]] = {}
    for e in entries:
        for q in e.get("questions", []):
            for lang in seed.LANGS:
                sizes = [len(o) for o in q["options"][lang]]
                if len(sizes) != 4 or not 0 <= q["correct"] < 4:
                    continue
                size = sizes[q["correct"]]
                tally = wins.setdefault((e["level"], lang), [0.0, 0.0, 0])
                if size == max(sizes):
                    tally[0] += 1 / sizes.count(size)
                if size == min(sizes):
                    tally[1] += 1 / sizes.count(size)
                tally[2] += 1
    low, high = LENGTH_TELL
    out = []
    for (level, lang), (longest, shortest, items) in wins.items():
        for name, won in (("the longest", longest), ("the shortest", shortest)):
            share = won / items
            if not low <= share <= high:
                out.append(f"{level} [{lang}] picking {name} option wins {share:.0%} ({won:.1f} of {items}); "
                           f"length must say nothing, {low:.0%} to {high:.0%}")
    return out


def report(entries: list[dict]) -> int:
    bad = 0
    for e in entries:
        found = problems(e)
        flags = review(e) if e.get("questions") else []
        rights = Counter(q["correct"] for q in e.get("questions", []))
        mark = "FAIL" if found else "ok  "
        print(f"{mark} {e['id']:<8} {e['level']} {len(reading._squash(e['text']))}c  "
              f"{', '.join(e.get('grammar', []))}  right answers by slot {dict(sorted(rights.items()))}")
        for line in found:
            print(f"       ! {line}")
        for line in flags:
            print(f"       ? {line}")
        bad += bool(found)
    for line in length_tells(entries):
        print(f"? {line}")
    print(f"\n{len(entries) - bad}/{len(entries)} clean")
    return bad


def _gloss(row: dict, lang: str) -> str:
    senses = row.get(lang) or ([] if lang == "fr" else row.get("en")) or []
    return senses[0] if senses else "TODO"


def draft(entry: dict) -> dict:
    """A breakdown to correct: the analyser's sentences, words and glosses."""
    parts = []
    for jp in SENTENCE.findall(entry["text"]):
        if not jp.strip():
            continue
        rows = rows_of(analyze_local(jp, entry["level"])["tokens"])
        words = [{"surface": r["t"], "meaning": {"en": _gloss(r, "en"), "fr": _gloss(r, "fr")}}
                 for r in rows if r.get("k") != "punct" and r["t"].strip() and r["t"] not in "。、！？!?「」『』・"]
        parts.append({"jp": jp, "translation": {"en": "TODO", "fr": "TODO"}, "note": {"en": "", "fr": ""}, "words": words})
    return {**entry, "breakdown": parts}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--level")
    ap.add_argument("--check", type=Path)
    ap.add_argument("--draft", type=Path)
    args = ap.parse_args()
    if args.draft:
        entries = json.loads(args.draft.read_text(encoding="utf-8"))
        out = [e if e.get("breakdown") else draft(e) for e in entries]
        target = args.draft.with_suffix(".draft.json")
        target.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"wrote {target}")
        return 0
    if args.check:
        entries = json.loads(args.check.read_text(encoding="utf-8"))
    else:
        entries = [e for e in seed.entries() if not args.level or e["level"] == args.level]
    return 1 if report(entries) else 0


if __name__ == "__main__":
    sys.exit(main())
