"""
Measure the vocab deck, the same way every time (plan 103).

    python -m scripts.audit_vocab_deck                # the report
    python -m scripts.audit_vocab_deck --dump         # the figures and lists, as JSON
    python -m scripts.audit_vocab_deck --skip-corpus  # without the tokenizer half
    python -m scripts.audit_vocab_deck --write-snapshot  # after a deck change: the served ids, for the guard

Read-only: no database, no .env, no network. It reads the tracked deck
files under datas/vocab and datas/kanji, the curated sentence banks
(parsed with `ast`, like scripts/audit_slice.py, so listening_clips.py's
pykakasi is never imported) and the grammar catalogue, and resolves the
sentences' words through study/card_lookup exactly as the breakdown
does. The corpus section needs the tokenizer (fugashi + unidic-lite);
without it the section says so rather than reporting zero.

── Why a script ───────────────────────────────────────────────
docs/vocab-deck-review.md opens with two tables of figures and plans
seven changes against them. A figure measured once, by hand, in one
session cannot say afterwards whether a change helped: this is the
measurement, re-runnable before and after each plan, and
tests/test_audit_vocab_deck.py holds the figures that must not regress.

── What it separates ──────────────────────────────────────────
The corpus section's whole value is in its partition. A content word in
a taught sentence that resolves to no card is one of four things, and
only the last is a deck gap:

    katakana   the deck HAS the word, stored in katakana; the tokenizer's
               reading is folded to hiragana and the kana index misses it
    adverb     the deck HAS the word; resolve_kana admits no adverb
    gated      the deck HAS the word by reading; UniDic tags the token
               非自立可能 (できる as a main verb) and the auxiliary gate
               refuses it
    name       a proper noun: UniDic lemmatises a kanji name to its
               katakana transcription (田中 -> タナカ), and no deck
               teaches names
    numeral    a compound numeral (三十), which composes from the digits
    absent     no entry under any spelling -- the demand list (plan 105)

The first three are plan 104's lookup repairs. Adding a deck entry for
any of them would make a duplicate of a card that already exists.

A flag here is a reason to look, never a finding -- the same rule as
audit_slice. "kanji above level" counts 写真 at N5 (写 is N4), which is
right: a card's level is the word's, not its kanji's (the review's
decision 3). It is reported because it is the reason the N5 bank writes
日よう日, not because any of the 2,241 should move.
"""
import argparse
import ast
import collections
import json
import os
import sys

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_CONTENT = os.path.join(_BASE_DIR, "content")
_VOCAB = os.path.join(_BASE_DIR, "datas", "vocab")
_KANJI = os.path.join(_BASE_DIR, "datas", "kanji")

LEVELS = ("N5", "N4", "N3", "N2", "N1")
_RANK = {level: i for i, level in enumerate(LEVELS)}

# Lemmas UniDic hands back for words that are grammar, not vocabulary:
# no deck teaches them as a card, and they would otherwise head every
# "absent" list (為る is する in every polite sentence) and hide the real
# gaps under them. Each is a decision, not an oversight, and plan 105
# added the second group with its reasons (無い was on this list's
# doorstep and got an N5 card instead):
#
#   御座る    ございます, the polite copula (でございます)
#   知れる    かもしれない, a catalogue point, not the verb 知れる
#   出でる    おいでください, keigo for 来る
#   遊ばす    UniDic's lemma for a causative (あそばせる -> 遊ばす); the
#             card is 遊ぶ and the point is 使役形
#   書き直す, 考え直す   instances of 〜直す (an N4 point); やり直す is
#             a card of its own because it is a word of its own
#   如何      the いかん of 〜いかんによらず (an N1 point); it counted as
#             the いかが card until a folded spelling had to be read as
#             folded (card_lookup._fold_into_lemma_index)
IGNORED_LEMMAS = frozenset({
    "為る", "有る", "居る", "成る", "来る", "言う", "此の", "其の", "彼の",
    "御座る", "知れる", "出でる", "遊ばす", "書き直す", "考え直す", "如何",
})

# A compound numeral (三十, 三千, 二百) composes from the digit cards the
# deck has and the compound fold (card_lookup.resolve_compound); it is
# never a card of its own, so it is its own kind below rather than a gap.
_NUMERALS = frozenset("〇零一二三四五六七八九十百千万億兆")


# ── inputs ─────────────────────────────────────────────────────

def _json(path: str):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _literal(module: str, name: str):
    """A top-level literal out of a content module, without importing it."""
    path = os.path.join(_CONTENT, module)
    with open(path, encoding="utf-8") as f:
        tree = ast.parse(f.read(), filename=path)
    for node in tree.body:
        if isinstance(node, ast.Assign):
            target = node.targets[0]
            if isinstance(target, ast.Name) and target.id == name:
                return ast.literal_eval(node.value)
    raise KeyError(f"{module} has no top-level {name}")


def deck() -> dict[str, list[dict]]:
    return _json(os.path.join(_VOCAB, "vocab_deck.json"))


def entries() -> list[tuple[str, dict]]:
    return [(level, e) for level in LEVELS for e in deck().get(level, [])]


def french() -> dict[str, str]:
    return _json(os.path.join(_VOCAB, "vocab_fr.json"))


def frequency_keys() -> list[str]:
    return _json(os.path.join(_VOCAB, "vocab_frequency.json"))


def kanji_levels() -> dict[str, str]:
    return {
        e["kanji"]: level
        for level, es in _json(os.path.join(_KANJI, "kanji_deck.json")).items()
        for e in es
    }


def taught_sentences() -> list[tuple[str, str, str]]:
    """(level, sentence, source) for every sentence the app shows a
    learner as content: the curated reading bank, the grammar
    catalogue's examples and the dictation lines."""
    out = []
    for level in LEVELS:
        for item in _literal("reading_sentences.py", level):
            out.append((level, item["jp"], "reading"))
        for point in _json(os.path.join(_CONTENT, "grammar", f"{level}.json")):
            for ex in point.get("examples") or []:
                if isinstance(ex, dict) and ex.get("jp"):
                    out.append((level, ex["jp"], "grammar"))
        for clip in _literal("listening_clips.py", level):
            jp = clip.get("jp") if isinstance(clip, dict) else None
            if jp:
                out.append((level, jp, "dictation"))
    return out


_SNAPSHOT = os.path.join(_VOCAB, "vocab_served.json")


def served_ids() -> list[str]:
    """Every card id the deck serves, sorted."""
    return sorted(f"vocab_{level}_{e.get('kanji', '')}_{e.get('kana', '')}" for level, e in entries())


def snapshot_ids() -> list[str]:
    """The ids served at the last `--write-snapshot` (plan 106b): the
    deck's memory of its old self, so tests/test_vocab_deck.py can see
    an id leave without a MOVES line. Empty when no snapshot exists."""
    if not os.path.exists(_SNAPSHOT):
        return []
    return _json(_SNAPSHOT)


def write_snapshot() -> int:
    ids = served_ids()
    with open(_SNAPSHOT, "w", encoding="utf-8") as f:
        json.dump(ids, f, ensure_ascii=False, separators=(",", ":"))
    return len(ids)


def focus_words() -> list[tuple[str, str]]:
    return [
        (level, item["focus"])
        for level in LEVELS
        for item in _literal("reading_sentences.py", level)
        if item.get("focus")
    ]


# ── the deck on its own ────────────────────────────────────────

def _key(entry: dict) -> str:
    return f"{entry.get('kanji', '')}::{entry.get('kana', '')}"


def _is_kanji(ch: str) -> bool:
    return "\u4e00" <= ch <= "\u9fff"


def _has_katakana(text: str) -> bool:
    return any("\u30a0" <= c <= "\u30ff" for c in text)


def shape(rows) -> dict:
    per_level = collections.Counter(level for level, _ in rows)
    return {
        "entries": len(rows),
        "per_level": {level: per_level.get(level, 0) for level in LEVELS},
        "kana_only": sum(1 for _, e in rows if not e.get("kanji")),
        "katakana_only": sum(1 for _, e in rows if not e.get("kanji") and _has_katakana(e.get("kana", ""))),
    }


def duplicates(rows) -> dict:
    exact = collections.defaultdict(list)
    forms = collections.defaultdict(list)
    for level, e in rows:
        exact[(e.get("kanji", ""), e.get("kana", ""))].append(level)
        if e.get("kanji"):
            forms[e["kanji"]].append(level)
    exact_pairs = [
        {"kanji": k, "kana": r, "levels": levels}
        for (k, r), levels in sorted(exact.items()) if len(levels) > 1
    ]
    shared = {form: levels for form, levels in forms.items() if len(levels) > 1}
    spelling = spelling_pairs(rows)
    return {
        "exact_pairs": exact_pairs,
        "exact_pairs_count": len(exact_pairs),
        "shared_forms_count": len(shared),
        "shared_forms_cards": sum(len(v) for v in shared.values()),
        "spelling_pairs": spelling,
        "spelling_pairs_count": len(spelling),
    }


# Two kana-only cards that share a reading and are two words: the N5
# キロ for a kilogram and the N5 キロ for a kilometre.
KANA_HOMOGRAPHS = frozenset({"キロ"})

# Pairs spelling_pairs finds that are two words, not one twice. The N2
# 御手洗 is glossed as the shrine's purifying font (みたらし in JMdict),
# not the N5 お手洗い's toilet; whether おてあらい is its reading is a
# content-audit question, not a duplicate.
DISTINCT_PAIRS = frozenset({("N2 御手洗::おてあらい", "N5 お手洗い::おてあらい")})


def _kanji_core(form: str) -> str:
    """A written form's kanji, in order: the 御/ご/お prefix off, 々
    written out, the kana dropped -- so 終る and 終わる, 御無沙汰 and
    ご無沙汰, 先々月 and 先先月 come out the same."""
    out = []
    for ch in form.removeprefix("御").removeprefix("ご").removeprefix("お"):
        if ch == "々" and out:
            out.append(out[-1])
        elif _is_kanji(ch):
            out.append(ch)
    return "".join(out)


def spelling_pairs(rows) -> list[dict]:
    """Two cards for one word that exact_pairs cannot see, because the
    fields differ (plan 112): sharing a reading, they are

        reading   one form, one card's readings a part of the other's
                  (十 じゅう beside 十 じゅう/とお)
        kana      two kana-only cards (いい beside いい/よい)
        spelling  the same kanji, other okurigana or prefix (終る and
                  終わる, 御無沙汰 and ご無沙汰)
        variant   one form the other with a kanji written in kana
                  (見付かる and 見つかる, 間も無く and 間もなく)

    Two forms with DIFFERENT kanji (会う/遭う, 川/河) are two written
    words and are not listed; nor is a kana card beside a kanji card."""
    from content import vocab_extras
    by_reading = collections.defaultdict(list)
    for level, e in rows:
        for r in (e.get("kana") or "").split("/"):
            if r:
                by_reading[r].append((level, e))
    found = {}
    for reading, cards in by_reading.items():
        for i, (la, a) in enumerate(cards):
            for lb, b in cards[i + 1:]:
                ka, kb = a.get("kanji", ""), b.get("kanji", "")
                if (ka, a.get("kana")) == (kb, b.get("kana")):
                    continue  # exact_pairs' case
                if not ka and not kb:
                    kind = None if reading in KANA_HOMOGRAPHS else "kana"
                elif not ka or not kb:
                    kind = None
                elif ka == kb:
                    kind = "reading"
                elif _kanji_core(ka) == _kanji_core(kb):
                    kind = "spelling"
                elif kb in vocab_extras.kana_spelling_variants(ka) or \
                        kb in vocab_extras.trailing_kana_variants(ka, a.get("kana", "")) or \
                        ka in vocab_extras.kana_spelling_variants(kb) or \
                        ka in vocab_extras.trailing_kana_variants(kb, b.get("kana", "")):
                    kind = "variant"
                else:
                    kind = None
                cards = tuple(sorted([f"{la} {_key(a)}", f"{lb} {_key(b)}"]))
                if kind and cards not in DISTINCT_PAIRS:
                    found[cards] = {"kind": kind, "cards": list(cards)}
    return sorted(found.values(), key=lambda p: p["cards"])


def readings(rows) -> dict:
    slash = [_key(e) for _, e in rows if "/" in e.get("kana", "")]
    semicolon = [_key(e) for _, e in rows if ";" in e.get("kana", "")]
    return {
        "slash_fields": slash,
        "slash_fields_count": len(slash),
        "semicolon_fields": semicolon,
        "semicolon_fields_count": len(semicolon),
    }


def _senses(meaning: str) -> tuple[str, ...]:
    return tuple(sorted(x.strip().lower() for x in meaning.replace(";", ",").split(",") if x.strip()))


def glosses(rows, fr: dict[str, str]) -> dict:
    """French is read per card first and per written form second
    (translations.fr_gloss, plan 107). "no_french" is a card neither key
    reaches. "shared_french" is a card that shares its written form with
    a card of a DIFFERENT English meaning and has no line of its own, so
    it reads whichever card's gloss the form carries -- the N5 私 as
    "je (fem.)" -- and 220 cards that share a form AND a meaning (the
    しいんと pair) are not counted: one gloss is right for both."""
    unspaced = sum(1 for _, e in rows if "," in e.get("meaning", "") and ", " not in e.get("meaning", ""))
    parens = sum(1 for _, e in rows if "(" in e.get("meaning", ""))
    empty = [_key(e) for _, e in rows if not e.get("meaning", "").strip()]

    def has_own(e):
        return e.get("kanji") and e.get("kana") and f"{e['kanji']}::{e['kana']}" in fr

    no_fr = [_key(e) for _, e in rows if not has_own(e) and (e.get("kanji") or e.get("kana")) not in fr]
    by_form = collections.defaultdict(list)
    for _, e in rows:
        if e.get("kanji"):
            by_form[e["kanji"]].append(e)
    shared = [
        _key(e)
        for form, cards in by_form.items()
        if len({_senses(c.get("meaning", "")) for c in cards}) > 1
        for e in cards if not has_own(e)
    ]
    return {
        "unspaced_commas": unspaced,
        "parenthesised": parens,
        "empty": empty,
        "empty_count": len(empty),
        "no_french": no_fr,
        "no_french_count": len(no_fr),
        "shared_french": shared,
        "shared_french_cards": len(shared),
    }


def frequency(rows, keys: list[str]) -> dict:
    listed = set(keys)
    deck_keys = {_key(e) for _, e in rows}
    return {
        "missing_from_order": sorted(deck_keys - listed),
        "missing_from_order_count": len(deck_keys - listed),
        "stale_in_order": sorted(listed - deck_keys),
        "stale_in_order_count": len(listed - deck_keys),
    }


def kanji_above_level(rows, levels: dict[str, str]) -> dict:
    counts = collections.Counter()
    examples = collections.defaultdict(list)
    for level, e in rows:
        chars = [c for c in e.get("kanji", "") if _is_kanji(c)]
        if not chars:
            continue
        worst = max(_RANK.get(levels.get(c), len(LEVELS)) for c in chars)
        if worst > _RANK[level]:
            counts[level] += 1
            if len(examples[level]) < 6:
                examples[level].append(e["kanji"])
    return {
        "count": sum(counts.values()),
        "per_level": {level: counts.get(level, 0) for level in LEVELS},
        "examples": dict(examples),
    }


# ── the taught corpus, through the breakdown's own lookups ─────

def _resolve_tokens(sentence: str):
    """Each content word of `sentence` as the breakdown resolves it:
    (morpheme, hit-or-None), with a deck compound folded the way
    study/analysis._tokens folds it. The same three resolvers, in the
    same order, so a word this reports as unmatched is one the screen
    shows without a badge."""
    from study import morphology
    from study.card_lookup import resolve_compound, resolve_morpheme

    morphemes = morphology.tokenize(sentence) or []
    out = []
    i = 0
    while i < len(morphemes):
        compound = resolve_compound(morphemes, i)
        if compound:
            *_, n = compound
            i += n
            continue
        m = morphemes[i]
        previous = morphemes[i - 1] if i > 0 else None
        if m.auxiliary_use and previous is not None and previous.pos == "particle" and previous.conjunctive:
            # ている, てしまう, てみる: the point's, not a word's (plan 106,
            # card_lookup.resolve_morpheme), so not a word the deck lacks.
            i += 1
            continue
        out.append((m, resolve_morpheme(morphemes, i)))
        i += 1
    return out


def _classify(m) -> str:
    """Which of the four kinds an unmatched content word is (module
    docstring). Present-by-reading is tested against the kana index
    directly, so the answer is about the DECK, not about the gate."""
    from study.card_lookup import _VOCAB_BY_KANA
    if _has_katakana(m.lemma) and (m.lemma in _VOCAB_BY_KANA or m.surface in _VOCAB_BY_KANA):
        return "katakana"
    if _has_katakana(m.lemma) and not _has_katakana(m.surface):
        return "name"
    if m.lemma and all(c in _NUMERALS for c in m.lemma):
        return "numeral"
    present = m.lemma_reading in _VOCAB_BY_KANA
    if m.pos == "adverb" and present:
        return "adverb"
    if m.auxiliary_use and present:
        return "gated"
    return "absent"


def corpus(sentences) -> dict:
    from study import morphology
    from study.analysis import CONTENT_POS

    if not morphology.MORPHOLOGY_AVAILABLE:
        return {"available": False, "sentences": len(sentences)}

    counts = {kind: collections.Counter() for kind in ("katakana", "adverb", "gated", "name", "numeral", "absent")}
    levels = collections.defaultdict(set)
    sources = collections.defaultdict(set)
    for level, jp, source in sentences:
        for m, hit in _resolve_tokens(jp):
            if hit or m.pos not in CONTENT_POS or m.lemma in IGNORED_LEMMAS:
                continue
            kind = _classify(m)
            counts[kind][m.lemma] += 1
            levels[m.lemma].add(level)
            sources[m.lemma].add(source)

    def listing(kind):
        return [
            {"lemma": lemma, "occurrences": n,
             "levels": sorted(levels[lemma], key=_RANK.get),
             "sources": sorted(sources[lemma])}
            for lemma, n in counts[kind].most_common()
        ]

    return {
        "available": True,
        "sentences": len(sentences),
        "unmatched_lemmas": sum(len(c) for c in counts.values()),
        "unmatched_occurrences": sum(sum(c.values()) for c in counts.values()),
        "kinds": {
            kind: {"lemmas": len(c), "occurrences": sum(c.values())}
            for kind, c in counts.items()
        },
        "absent": listing("absent"),
        "katakana": listing("katakana"),
        "adverb": listing("adverb"),
        "gated": listing("gated"),
        "name": listing("name"),
        "numeral": listing("numeral"),
    }


def focus(words) -> dict:
    """The curated sentences' focus words the deck cannot schedule --
    resolved exactly as routes/reading.py resolves them."""
    from study.card_lookup import vocab_card_id_for_word

    unresolved = []
    for level, word in words:
        if vocab_card_id_for_word({"kanji": word, "kana": "", "level": level}, "audit") is None:
            unresolved.append({"level": level, "word": word})
    return {"total": len(words), "unresolved": unresolved, "unresolved_count": len(unresolved)}


# ── the report ─────────────────────────────────────────────────

def measure(skip_corpus: bool = False) -> dict:
    rows = entries()
    report = {
        "shape": shape(rows),
        "duplicates": duplicates(rows),
        "readings": readings(rows),
        "glosses": glosses(rows, french()),
        "frequency": frequency(rows, frequency_keys()),
        "kanji_above_level": kanji_above_level(rows, kanji_levels()),
        "focus": focus(focus_words()),
    }
    if not skip_corpus:
        report["corpus"] = corpus(taught_sentences())
    return report


def _fmt_lemmas(items, limit: int) -> str:
    shown = ", ".join(f"{i['lemma']} ×{i['occurrences']} ({'/'.join(i['levels'])})" for i in items[:limit])
    more = f" … and {len(items) - limit} more" if len(items) > limit else ""
    return shown + more


def render(report: dict) -> str:
    s, d, r, g, f, k, fo = (report[x] for x in ("shape", "duplicates", "readings", "glosses",
                                                "frequency", "kanji_above_level", "focus"))
    lines = [
        "The deck",
        f"  entries                       {s['entries']:,}  "
        + "  ".join(f"{lv} {n:,}" for lv, n in s["per_level"].items()),
        f"  kana-only                     {s['kana_only']:,} (katakana {s['katakana_only']:,})",
        f"  same form+reading, two levels {d['exact_pairs_count']}",
        f"  one word, two spellings       {d['spelling_pairs_count']}",
        f"  same form, several cards      {d['shared_forms_count']} forms, {d['shared_forms_cards']} cards",
        f"  kana fields joined by /       {r['slash_fields_count']}",
        f"  kana fields joined by ;       {r['semicolon_fields_count']}",
        f"  glosses: unspaced comma       {g['unspaced_commas']:,}",
        f"  glosses: parenthesised note   {g['parenthesised']:,}",
        f"  glosses: empty                {g['empty_count']}",
        f"  no French gloss               {g['no_french_count']}",
        f"  French borrowed from a form   {g['shared_french_cards']} cards (a different sense, no line of its own)",
        f"  keys missing from the order   {f['missing_from_order_count']}",
        f"  stale keys in the order       {f['stale_in_order_count']}",
        f"  kanji above the card's level  {k['count']:,}  "
        + "  ".join(f"{lv} {n}" for lv, n in k["per_level"].items())
        + "   (a flag, not a defect: decision 3)",
        "",
        "The curated focus words",
        f"  unresolved                    {fo['unresolved_count']} of {fo['total']}: "
        + ", ".join(f"{w['word']} ({w['level']})" for w in fo["unresolved"]),
    ]
    c = report.get("corpus")
    if c is not None:
        lines += ["", "The taught sentences"]
        if not c["available"]:
            lines.append(f"  {c['sentences']:,} sentences; the tokenizer is not installed "
                         "(pip install fugashi unidic-lite), so nothing was measured")
        else:
            lines += [
                f"  sentences                     {c['sentences']:,}",
                f"  content words with no card    {c['unmatched_lemmas']} lemmas, "
                f"{c['unmatched_occurrences']} occurrences",
            ]
            for kind, label in (("katakana", "present, stored in katakana"),
                                ("adverb", "present, an adverb"),
                                ("gated", "present, auxiliary-gated"),
                                ("name", "a proper noun"),
                                ("numeral", "a compound numeral"),
                                ("absent", "absent from the deck")):
                n = c["kinds"][kind]
                lines.append(f"    {label:28s} {n['lemmas']} lemmas, {n['occurrences']} occurrences")
            lines += ["", "  absent, most frequent first:", "    " + _fmt_lemmas(c["absent"], 40)]
            for kind in ("katakana", "adverb", "gated", "name", "numeral"):
                if c[kind]:
                    lines += [f"  {kind}:", "    " + _fmt_lemmas(c[kind], 12)]
    return "\n".join(lines)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dump", action="store_true", help="the figures and lists as JSON")
    parser.add_argument("--skip-corpus", action="store_true",
                        help="leave out the taught-sentence section (the tokenizer half)")
    parser.add_argument("--write-snapshot", action="store_true",
                        help="record every served id in datas/vocab/vocab_served.json (after a deck change)")
    args = parser.parse_args(argv)
    if args.write_snapshot:
        print(f"{write_snapshot():,} ids written to {os.path.relpath(_SNAPSHOT, _BASE_DIR)}")
        return 0
    report = measure(skip_corpus=args.skip_corpus)
    if args.dump:
        json.dump(report, sys.stdout, ensure_ascii=False, indent=1)
        sys.stdout.write("\n")
    else:
        print(render(report))
    return 0


if __name__ == "__main__":
    sys.exit(main())
