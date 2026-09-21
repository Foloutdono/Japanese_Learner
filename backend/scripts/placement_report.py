"""
Where the deck's cards sit, and what it lacks, against outside lists (plan 109).

    python -m scripts.placement_report                  # the report
    python -m scripts.placement_report --dump           # the lists, as JSON
    python -m scripts.placement_report --slice 1        # the first forty candidates of each list
    python -m scripts.placement_report --rebuild-order  # rewrite datas/vocab/vocab_frequency.json

Read-only unless --rebuild-order; no database, no .env, no network. It
reads the deck and the two lists under datas/vocab/sources (see the
README there for provenance and licences) and needs the tokenizer
(fugashi + unidic-lite) to turn the subtitle surfaces into words.

── What it says ──────────────────────────────────────────────
Three lists, each a set of CANDIDATES for the content audit to work
through forty at a time (docs/content-audit/PLAYBOOK.md) -- never a
change this script makes:

    placed above the JLPT lists   a deck card whose level is higher than
                                  the level the community lists give the
                                  word (床屋 at N2, the lists say N4)
    in the JLPT lists, not here   a list word with no card under any
                                  spelling, affix patterns (～円) and
                                  variant rows (いい; よい) left out
    frequent, not here            a word in the ranking's top band with
                                  no card, gated through JMdict so that
                                  subtitle fillers, cast names and verb
                                  stems do not reach the list

The one thing it changes, on request, is the ORDER of
datas/vocab/vocab_frequency.json: the deck's own keys sorted by the
ranking, unranked keys after them in their old order. Nothing joins or
leaves that file here; tests/test_audit_vocab_deck.py holds it equal to
the deck, and tests/test_placement_report.py holds it equal to what this
script would write, so it cannot drift from its source.

── The ranking ───────────────────────────────────────────────
The subtitle list ranks surfaces. Each is tokenized; a surface that is
one morpheme of a content part of speech credits its count to
(lemma, reading), and the sums are the ranking. A card written with
kanji ranks by (its form or UniDic's lemma for it, its reading) -- the
pair, never the lemma alone, so a homophone inherits nothing; a
kana-only card by its reading. A compound the deck teaches as one card
(日曜日) is unranked here when the subtitles cut it, and keeps its place
among the unranked. Two limits worth knowing: a bare stem the
subtitles count as a token (言, 知) cannot be lemmatised out of context
and ranks as the noun it also is; and UniDic files spelling variants
under one lemma (診る, 観る under 見る; 帰る under 返る), so a variant
card the subtitles never write carries its group's rank.
"""
import argparse
import collections
import json
import os
import sys

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_VOCAB = os.path.join(_BASE_DIR, "datas", "vocab")
_SOURCES = os.path.join(_VOCAB, "sources")
FREQUENCY_SOURCE = os.path.join(_SOURCES, "opensubtitles_ja_50k.txt")
JLPT_SOURCE = os.path.join(_SOURCES, "jlpt_tanos.json")
ORDER_FILE = os.path.join(_VOCAB, "vocab_frequency.json")

LEVELS = ("N5", "N4", "N3", "N2", "N1")
_RANK = {level: i for i, level in enumerate(LEVELS)}
# What the deck teaches as a card: the content classes, and the closed
# classes it holds too -- あなた is a pronoun, でも a conjunction, この
# an adnominal, はい an interjection. Particles and auxiliaries are not
# cards and stay out.
CONTENT_POS = ("noun", "verb", "adjective", "adverb", "pronoun", "conjunction", "adnominal", "interjection")
SLICE = 40
# How far down the ranking "frequent" reaches. The deck's N3 median is
# ~2,500 and its N2 ~8,800; a word inside the first 6,000 that no level
# teaches is worth a look at whatever level.
FREQUENT_BAND = 6000


def _json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def deck() -> dict[str, list[dict]]:
    return _json(os.path.join(_VOCAB, "vocab_deck.json"))


def _key(e: dict) -> str:
    return f"{e.get('kanji', '')}::{e.get('kana', '')}"


# ── the ranking ────────────────────────────────────────────────

def ranking() -> dict[tuple[str, str], int]:
    """(lemma, reading) -> rank, from the subtitle surfaces summed per
    word. Needs the tokenizer; raises when it is missing, since a
    ranking that silently ranks nothing would order the deck by
    accident."""
    from study import morphology
    if not morphology.MORPHOLOGY_AVAILABLE:
        raise RuntimeError("the ranking needs fugashi + unidic-lite (pip install fugashi unidic-lite)")
    counts: collections.Counter = collections.Counter()
    with open(FREQUENCY_SOURCE, encoding="utf-8") as f:
        for line in f:
            parts = line.split()
            if len(parts) != 2:
                continue
            surface, count = parts[0], int(parts[1])
            morphemes = morphology.tokenize(surface)
            if not morphemes or len(morphemes) != 1:
                continue
            m = morphemes[0]
            if m.pos not in CONTENT_POS:
                continue
            counts[(m.lemma, m.lemma_reading)] += count
    return {key: i + 1 for i, (key, _) in enumerate(counts.most_common())}


def _lookups(rank):
    """(by lemma, by reading, the deck's written forms). By reading is
    every ranked word read that way, best first, so a kana-only card
    can take the best of the words that are not a kanji card the deck
    teaches separately."""
    by_lemma: dict[str, int] = {}
    by_reading: dict[str, list[tuple[int, str]]] = collections.defaultdict(list)
    for (lemma, reading), r in rank.items():
        by_lemma.setdefault(lemma, r)
        by_reading[reading].append((r, lemma))
    forms = {e["kanji"] for es in deck().values() for e in es if e.get("kanji")}
    return by_lemma, dict(by_reading), forms


def card_rank(entry: dict, rank, lookups=None) -> int | None:
    """The best rank the card's own word reaches.

    A card written with kanji is matched by its written form and by
    UniDic's lemma for it, paired with its own readings where the
    ranking has the pair; never by reading alone, which would hand
    every homophone the commonest word's rank (琴 is not こと's rank 1,
    刷る not する's rank 2). A kana-only card has only its reading: it
    matches a kana lemma exactly, and otherwise the best ranked word
    read that way whose lemma is not a kanji card the deck teaches on
    its own (あなた is 貴方's rank, この is 此の's; し is nobody's, since
    死 and 詩 are cards)."""
    from study import morphology
    _, by_reading, forms = lookups or _lookups(rank)
    found = []
    form = entry.get("kanji") or ""
    readings = [r.strip() for r in (entry.get("kana") or "").replace(";", "/").split("/") if r.strip()]
    if form and " " not in form:
        lemmas = [form]
        morphemes = morphology.tokenize(form)
        if morphemes and len(morphemes) == 1 and morphemes[0].lemma != form:
            lemmas.append(morphemes[0].lemma)
        # The pair, never the lemma alone: 来る read きたる is not the
        # N5 来る (くる), 人 read じん not 人 (ひと).
        found = [rank.get((lemma, morphology.kata_to_hira(r))) for lemma in lemmas for r in readings]
    elif readings:
        for reading in readings:
            folded = morphology.kata_to_hira(reading)
            exact = rank.get((reading, folded)) or rank.get((folded, folded))
            if exact:
                found.append(exact)
            else:
                # The best word read that way whose lemma is not a kanji
                # card of its own: あなた takes 貴方's rank, この 此の's;
                # し takes nothing, since 死 and 詩 are cards.
                others = [r for r, lemma in by_reading.get(folded, []) if lemma not in forms]
                if others:
                    found.append(min(others))
    found = [r for r in found if r]
    return min(found) if found else None


def ordered_keys(rank=None) -> list[str]:
    """The deck's keys, ranked ones first by rank, the rest in the order
    the file has them today -- what vocab_frequency.json should hold."""
    rank = rank or ranking()
    lookups = _lookups(rank)
    current = _json(ORDER_FILE)
    position = {key: i for i, key in enumerate(current)}
    ranked: dict[str, int] = {}
    for level in LEVELS:
        for e in deck().get(level, []):
            key = _key(e)
            r = card_rank(e, rank, lookups)
            if key not in ranked:
                ranked[key] = r if r is not None else 10 ** 9
            elif r is not None:
                ranked[key] = min(ranked[key], r)
    keys = list(ranked)
    keys.sort(key=lambda k: (ranked[k], position.get(k, 10 ** 9)))
    return keys


# ── the three lists ────────────────────────────────────────────

def _has_kanji(text: str) -> bool:
    return any("\u4e00" <= ch <= "\u9fff" for ch in text)


def _jlpt_index() -> tuple[dict[tuple[str, str], str], dict[str, str]]:
    """(by (written form, reading), by kana-only word) -> the LOWEST
    level the lists give it. A kanji row is keyed with its reading, so
    来る read きたる is not the N5 来る (くる) and 人 read じん not the N5
    人 (ひと); a row's reading alone is a key only when the row is
    written in kana, so a kanji homophone (琴 for 事's こと) never
    borrows a level."""
    by_pair: dict[tuple[str, str], str] = {}
    by_kana: dict[str, str] = {}
    for level in LEVELS:
        for expression, reading in _json(JLPT_SOURCE).get(level, []):
            expression, reading = expression.strip(), reading.strip()
            if _has_kanji(expression):
                for r in reading.replace(";", "/").split("/"):
                    if r.strip():
                        by_pair.setdefault((expression, r.strip()), level)
            else:
                for key in (expression, reading):
                    if key:
                        by_kana.setdefault(key, level)
    return by_pair, by_kana


def _is_pattern(expression: str) -> bool:
    return any(ch in expression for ch in "～()（）;") or " " in expression


def placed_above(rank, lookups) -> list[dict]:
    """Deck cards at a level above the lists' level for the word."""
    by_pair, by_kana = _jlpt_index()
    out = []
    for level in LEVELS:
        for e in deck().get(level, []):
            form = e.get("kanji") or ""
            readings = [r.strip() for r in (e.get("kana") or "").split("/") if r.strip()]
            if form:
                listed = [by_pair[(form, r)] for r in readings if (form, r) in by_pair]
            else:
                listed = [by_kana[r] for r in readings if r in by_kana]
            if not listed:
                continue
            lowest = min(listed, key=_RANK.get)
            if _RANK[lowest] < _RANK[level]:
                out.append({"key": _key(e), "level": level, "lists_say": lowest,
                            "meaning": e.get("meaning", ""), "rank": card_rank(e, rank, lookups)})
    out.sort(key=lambda x: (x["rank"] or 10 ** 9))
    return out


def listed_not_here(rank, lookups) -> list[dict]:
    """JLPT-list words with no card under any spelling."""
    forms = {e["kanji"] for es in deck().values() for e in es if e.get("kanji")}
    # The readings of the deck's KANA-ONLY cards: a list word the deck
    # holds in kana (丁度 as ちょうど) is present; one whose reading a
    # kanji card elsewhere merely shares is not.
    kanas = {r.strip() for es in deck().values() for e in es if not e.get("kanji")
             for r in (e.get("kana") or "").split("/")}
    out = []
    for level in LEVELS:
        for expression, reading in _json(JLPT_SOURCE).get(level, []):
            if _is_pattern(expression) or _is_pattern(reading):
                continue
            if expression in forms or expression in kanas or reading in kanas:
                continue
            out.append({"expression": expression, "reading": reading, "level": level,
                        "rank": card_rank({"kanji": expression, "kana": reading}, rank, lookups)})
    out.sort(key=lambda x: (x["rank"] or 10 ** 9))
    return out


def frequent_not_here(rank, band: int = FREQUENT_BAND) -> list[dict]:
    """Words in the ranking's top band with no card, gated through
    JMdict: a (lemma, reading) JMdict does not know is a filler (んー),
    a cast name (ジョン) or a stem the tokenizer left as a word, not a
    word the deck lacks."""
    from content import vocab_jmdict_data as jmdict
    from study.card_lookup import resolve_lemma, resolve_kana
    out = []
    for (lemma, reading), r in rank.items():
        if r > band:
            break
        if len(lemma) < 2 and len(reading) < 2:
            continue
        if any("a" <= ch.lower() <= "z" for ch in lemma) or "ー" in reading:
            continue
        if resolve_lemma(lemma, reading) or resolve_kana(reading, "noun", False):
            continue
        entry = jmdict.get_by_key(lemma, reading) or jmdict.get_by_key("", reading)
        if not entry and lemma != reading:
            entry = jmdict.get_by_key(lemma, "")
        if not entry:
            continue
        out.append({"lemma": lemma, "reading": reading, "rank": r, "meaning": entry.get("meaning", "")})
    return out


def measure() -> dict:
    rank = ranking()
    lookups = _lookups(rank)
    per_level = {}
    for level in LEVELS:
        ranks = [card_rank(e, rank, lookups) for e in deck().get(level, [])]
        got = sorted(r for r in ranks if r)
        per_level[level] = {"cards": len(ranks), "ranked": len(got),
                            "median": got[len(got) // 2] if got else None}
    return {
        "ranking_size": len(rank),
        "coverage": per_level,
        "placed_above": placed_above(rank, lookups),
        "listed_not_here": listed_not_here(rank, lookups),
        "frequent_not_here": frequent_not_here(rank),
    }


def render(report: dict, slice_no: int | None = None) -> str:
    def window(items):
        if slice_no is None:
            return items[:SLICE], f"first {min(SLICE, len(items))} of {len(items)}"
        start = (slice_no - 1) * SLICE
        return items[start:start + SLICE], f"slice {slice_no}: {start + 1}–{min(start + SLICE, len(items))} of {len(items)}"

    lines = ["The ranking", f"  words ranked                  {report['ranking_size']:,}"]
    for level, c in report["coverage"].items():
        lines.append(f"  {level} cards ranked               {c['ranked']} of {c['cards']}, median rank {c['median']}")
    items, label = window(report["placed_above"])
    lines += ["", f"Placed above the JLPT lists ({label})"]
    lines += [f"  {i['key']:24s} {i['level']} → lists say {i['lists_say']}  rank {i['rank'] or '—'}  {i['meaning'][:40]}" for i in items]
    items, label = window(report["listed_not_here"])
    lines += ["", f"In the JLPT lists, not in the deck ({label})"]
    lines += [f"  {i['expression']:12s} {i['reading']:14s} {i['level']}  rank {i['rank'] or '—'}" for i in items]
    items, label = window(report["frequent_not_here"])
    lines += ["", f"Frequent, not in the deck ({label}; band {FREQUENT_BAND:,})"]
    lines += [f"  {i['rank']:6d}  {i['lemma']:10s} {i['reading']:14s} {i['meaning'][:40]}" for i in items]
    return "\n".join(lines)


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dump", action="store_true", help="the lists as JSON")
    parser.add_argument("--slice", type=int, metavar="N", help=f"the Nth {SLICE} candidates of each list")
    parser.add_argument("--rebuild-order", action="store_true",
                        help="rewrite datas/vocab/vocab_frequency.json in ranking order")
    args = parser.parse_args(argv)
    if args.rebuild_order:
        keys = ordered_keys()
        with open(ORDER_FILE, "w", encoding="utf-8") as f:
            json.dump(keys, f, ensure_ascii=False, separators=(",", ":"))
        print(f"{len(keys):,} keys written to {os.path.relpath(ORDER_FILE, _BASE_DIR)}")
        return 0
    report = measure()
    if args.dump:
        json.dump(report, sys.stdout, ensure_ascii=False, indent=1)
        sys.stdout.write("\n")
    else:
        print(render(report, args.slice))
    return 0


if __name__ == "__main__":
    sys.exit(main())
