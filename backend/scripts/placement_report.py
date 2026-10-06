"""
Where the deck's cards sit, and what it lacks, against outside lists (plan 109).

    python -m scripts.placement_report                  # the report
    python -m scripts.placement_report --dump           # the lists, as JSON
    python -m scripts.placement_report --slice 1        # the first forty candidates of each list
    python -m scripts.placement_report --rebuild-order  # rewrite datas/vocab/vocab_frequency.json
    python -m scripts.placement_report --write-lists    # the three lists to datas/vocab/placement_lists.json, for the audit's rotation

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
among the unranked.

A card ranks on the surfaces that write it, not on the whole of its
word's count (card_rank; the content audit's #256). The list is cut
into morphemes, not words -- 教えて is 教え + て, 言って 言 + っ + て --
and UniDic, reading each piece alone, filed pieces under words they are
not: the first card of the first tier was a kana で glossed "outflow",
ranked on the て-form; 仕様 took the surface しょ, 診る 見る's 見, 嗚呼
the kana ああ, 持ち 持つ's 持, while する, こと and 教える stood past
3,000th. So a kanji card takes its own kanji (and a kana surface only
where no kana card teaches the word), a kana card the kana spelled or
filed its way, and a verb the stem it was cut to. Limits that stay: a
lone kanji stem UniDic reads as a noun of its own (作 さく, 住 じゅう,
判 はん; 話 はなし, which is mostly the noun) cannot be told from the
verb's; a lone kanji stem read the verb's way (死 し, 歌 うた) counts for
noun and verb alike; a suffix ranks as the noun it also is (〜的 as 的
まと); and a noun written as an ichidan stem (答え, 考え) gives all of it
to the verb, since the list cannot say how much is the noun. The other
stem put right is the one that cost a card: the subtitles cut ください
and もらう before their endings, and くださ, 下さ and もら alone are 下す
and 盛る to UniDic, so every "please" ranked 下す "to hand down" 92nd
(FRAGMENTS, plan 153).
"""
import argparse
import bisect
import collections
import json
import os
import sys

from content.vocab_renames import FOLDED_FORMS

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_VOCAB = os.path.join(_BASE_DIR, "datas", "vocab")
_SOURCES = os.path.join(_VOCAB, "sources")
FREQUENCY_SOURCE = os.path.join(_SOURCES, "opensubtitles_ja_50k.txt")
JLPT_SOURCE = os.path.join(_SOURCES, "jlpt_tanos.json")
ORDER_FILE = os.path.join(_VOCAB, "vocab_frequency.json")
LISTS_FILE = os.path.join(_VOCAB, "placement_lists.json")

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

# Surfaces the subtitles cut before an inflecting word's ending, which
# alone lemmatise to another verb: (lemma, reading) of the word they are.
FRAGMENTS = {
    "くださ": ("下さる", "くださる"),
    "下さ": ("下さる", "くださる"),
    "もら": ("貰う", "もらう"),
}


class Ranking(dict):
    """(lemma, reading) -> rank, as a plain dict, carrying what each
    word's count was made of: `surfaces`, (lemma, reading) -> Counter of
    the subtitle surfaces summed into it. card_rank reads them, since a
    word's bucket is not all the card's word (#256): 仕様 took 19,242 of
    its 19,992 from the surface しょ, 持ち every 持 of 持つ, 診る every 見
    of 見る."""
    surfaces: dict[tuple[str, str], collections.Counter]


def ranking() -> Ranking:
    """(lemma, reading) -> rank, from the subtitle surfaces summed per
    word. Needs the tokenizer; raises when it is missing, since a
    ranking that silently ranks nothing would order the deck by
    accident."""
    from study import morphology
    if not morphology.MORPHOLOGY_AVAILABLE:
        raise RuntimeError("the ranking needs fugashi + unidic-lite (pip install fugashi unidic-lite)")
    surfaces: dict[tuple[str, str], collections.Counter] = collections.defaultdict(collections.Counter)
    with open(FREQUENCY_SOURCE, encoding="utf-8") as f:
        for line in f:
            parts = line.split()
            if len(parts) != 2:
                continue
            surface, count = parts[0], int(parts[1])
            if surface in FRAGMENTS:
                surfaces[FRAGMENTS[surface]][surface] += count
                continue
            morphemes = morphology.tokenize(surface)
            if not morphemes or len(morphemes) != 1:
                continue
            m = morphemes[0]
            if m.pos not in CONTENT_POS:
                continue
            surfaces[(m.lemma, m.lemma_reading)][surface] += count
    totals = collections.Counter({key: sum(c.values()) for key, c in surfaces.items()})
    rank = Ranking({key: i + 1 for i, (key, _) in enumerate(totals.most_common())})
    rank.surfaces = dict(surfaces)
    return rank


def _kanji_of(text: str) -> str:
    return "".join(ch for ch in text if "\u4e00" <= ch <= "\u9fff" or ch == "々")


def _inflects(form: str) -> bool:
    """A verb or adjective written in its dictionary form -- not a noun
    UniDic reads as one's 連用形 (持ち, 行き)."""
    from study import morphology
    morphemes = morphology.tokenize(form)
    return (bool(morphemes) and len(morphemes) == 1 and morphemes[0].pos in ("verb", "adjective")
            and morphemes[0].cform.startswith("終止形"))


def _lookups(rank):
    """What card_rank reads beside the ranking, built once per run.

    Every surface's count, and the deck's own shape, which decides what
    a surface is: the
    readings its kana-only cards are written in (a kana surface is that
    card's, not a kanji card's -- ああ is the N4 ああ, never 嗚呼), the
    spellings MOVES folded into a card, and its verbs' stems -- the
    subtitles cut a verb before its ending, so 教え, 言 and 死 are what is
    left of 教える, 言う and 死ぬ."""
    from study import morphology
    cards = [e for es in deck().values() for e in es]
    forms = {e["kanji"] for e in cards if e.get("kanji")}
    kanas = {morphology.kata_to_hira(r.strip()) for e in cards if not e.get("kanji")
             for r in (e.get("kana") or "").split("/") if r.strip()}
    folded: dict[str, list[tuple[str, str]]] = collections.defaultdict(list)
    for card_id, pairs in FOLDED_FORMS.items():
        key = "::".join(card_id.split("_", 2)[2].rsplit("_", 1))
        folded[key].extend(pairs)
        kanas.update(morphology.kata_to_hira(r.strip()) for f, kana in pairs if not f
                     for r in kana.split("/") if r.strip())
    # A kana surface is a kana card's when it is spelled the card's way
    # (じゃあ, filed under the て-form's で) or is the cut stem of a word
    # read that way (おいし for おいしい) -- never a lone kana, which is a
    # fragment (ま, filed under まあ, is every ます and ましょう), nor a
    # word UniDic merely files there (よう under 良く).
    by_surface: collections.Counter = collections.Counter()
    by_kana: dict[str, set[str]] = collections.defaultdict(set)
    read_as: dict[str, str] = {}
    for (_, reading), bucket in getattr(rank, "surfaces", {}).items():
        for surface, n in bucket.items():
            by_surface[surface] += n
            read_as[surface] = reading
            spelled = morphology.kata_to_hira(surface)
            if not _kanji_of(surface) and len(spelled) > 1:
                by_kana[spelled].add(surface)
                if reading.startswith(spelled):
                    by_kana[reading].add(surface)
    # Each verb's stem as the subtitles cut it (教え for 教える, 言 for
    # 言う, 死 for 死ぬ), where it is that verb's: a stem ending in kana
    # always is -- 教え is every 教えて and 教えた, so a noun the deck
    # writes the same way with the verb's reading gives it up -- and a
    # stem that is a kanji alone is when no card is written that way or
    # UniDic reads it as the verb does (死 し, 歌 うた, both then counted
    # for noun and verb alike), not when a card makes it another word
    # (為 ため is no する, 話 はなし no はなす, 上 かみ no のぼる).
    verb_stems: dict[str, str] = {}
    noun_stems: set[tuple[str, str]] = set()
    for e in cards:
        form = e.get("kanji") or ""
        if not (len(form) > 1 and not _kanji_of(form[-1]) and _kanji_of(form[:-1]) and _inflects(form)):
            continue
        stem = form[:-1]
        if stem not in by_surface:
            continue
        for r in (e.get("kana") or "").split("/"):
            if not r.strip():
                continue
            stem_reading = morphology.kata_to_hira(r.strip())[:-1]
            if not _kanji_of(stem[-1]):
                verb_stems[_key(e)] = stem
                noun_stems.add((stem, stem_reading))
            elif stem not in forms or read_as.get(stem) == stem_reading:
                verb_stems[_key(e)] = stem
    totals = sorted(sum(c.values()) for c in getattr(rank, "surfaces", {}).values())
    return (forms, kanas, dict(folded), by_surface, dict(by_kana), verb_stems, noun_stems, totals)


def _rank_of(count: int, totals: list[int]) -> int | None:
    """Where a count would stand among the ranking's words."""
    if count <= 0:
        return None
    return len(totals) - bisect.bisect_right(totals, count) + 1


def card_rank(entry: dict, rank, lookups=None) -> int | None:
    """Where the card's own word would stand in the ranking: the count
    of the subtitle surfaces that write it, ranked among the words.

    A card written with kanji takes the buckets of its written form and
    of UniDic's lemma for it, paired with its own readings -- never a
    reading alone, which would hand every homophone the commonest
    word's rank (琴 is not こと's rank 1, 刷る not する's rank 2) -- and
    of those buckets only the surfaces that write the card (#256): the
    same kanji (診る takes nothing of 見る's 見, 速い nothing of 早い's
    早), the whole word for one that does not inflect (持ち takes no 持,
    the stem of 持つ), and its kana surfaces only where no kana-only
    card teaches the word (ああ is the N4 ああ's, not 嗚呼's; する the N5
    する's, not 為る's) and, for a word that does not inflect, only
    spelled as it reads (しょ is no spelling of 仕様). A verb also takes
    the stem the subtitles cut it to (教え for 教える, 言 for 言う), and
    a noun written as such a stem with the verb's reading gives it up.
    A kana-only card takes the kana surfaces spelled its way or cut from
    a word read its way, whatever word UniDic files them under (する
    under 為る, こと under 事, おいし under 美味しい), and the kanji
    spellings MOVES folded into it (美味しい into おいしい) -- but never a
    lone kana, so a card of one kana ranks on nothing: the ranked で is
    the て-form's, not the noun 出."""
    from study import morphology
    lookups = lookups or _lookups(rank)
    (forms, kanas, folded, by_surface, by_kana, verb_stems, noun_stems, totals) = lookups
    surfaces_of = getattr(rank, "surfaces", {})
    form = entry.get("kanji") or ""
    readings = [morphology.kata_to_hira(r.strip())
                for r in (entry.get("kana") or "").replace(";", "/").split("/") if r.strip()]
    key = _key({"kanji": form, "kana": entry.get("kana") or ""})
    credited: set[str] = set()
    own = [form] if form and " " not in form else []
    writings = own + [f for f, _ in folded.get(key, ()) if f]
    if not own:
        credited.update(s for r in readings for s in by_kana.get(r, ()))
    if writings:
        lemmas = list(writings)
        morphemes = morphology.tokenize(writings[0])
        if morphemes and len(morphemes) == 1 and morphemes[0].lemma != writings[0]:
            lemmas.append(morphemes[0].lemma)
        inflects = _inflects(writings[0])

        def writes(surface: str, lemma: str, reading: str) -> bool:
            kanji = _kanji_of(surface)
            if not kanji:
                # Not another card's kana: 見る's みる is no spelling of 診る.
                if not own or reading in kanas or (lemma not in writings and lemma in forms):
                    return False
                spelled = morphology.kata_to_hira(surface)
                if len(spelled) < 2:
                    return False
                return spelled in readings or (inflects and any(r.startswith(spelled) for r in readings))
            for w in writings:
                if kanji != _kanji_of(w):
                    continue
                if inflects or bool(_kanji_of(surface[-1])) == bool(_kanji_of(w[-1])):
                    return True
            return False

        for lemma in lemmas:
            for reading in readings:
                for surface in surfaces_of.get((lemma, reading), ()):
                    if writes(surface, lemma, reading):
                        credited.add(surface)
        if key in verb_stems:
            credited.add(verb_stems[key])
        if not inflects:
            credited -= {form for r in readings if (form, r) in noun_stems}
    return _rank_of(sum(by_surface[s] for s in credited), totals)


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
    """Deck cards at a level above the lists' level for the word, under
    the card's own spelling or one folded into it.

    Plan 112 merged one word's spellings onto one card (終る into 終わる,
    知合い into 知り合い, 此れ into これ), and the lists still write the
    spelling that went (content/vocab_renames.FOLDED_FORMS): it is the
    surviving card's word, so it says where that card sits -- and, in
    listed_not_here, that the word has a card."""
    by_pair, by_kana = _jlpt_index()
    out = []
    for level in LEVELS:
        for e in deck().get(level, []):
            form = e.get("kanji") or ""
            readings = [r.strip() for r in (e.get("kana") or "").split("/") if r.strip()]
            pairs = [(form, r) for r in readings]
            for f, kana in FOLDED_FORMS.get(f"vocab_{level}_{form}_{e.get('kana') or ''}", ()):
                pairs += [(f, r) for r in kana.split("/")]
            listed = [
                by_pair[(f, r)] if f else by_kana[r]
                for f, r in pairs
                if ((f, r) in by_pair if f else r in by_kana)
            ]
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
    # A spelling folded into another card is that card's word.
    for pairs in FOLDED_FORMS.values():
        for form, kana in pairs:
            if form:
                forms.add(form)
            else:
                kanas.update(r.strip() for r in kana.split("/"))
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


def candidate_lists(report: dict | None = None) -> dict[str, list[dict]]:
    """The three lists as the audit's rotation reads them (plan 109):
    scripts/audit_slice.py needs no tokenizer and no network, so it
    reads datas/vocab/placement_lists.json rather than computing this,
    and tests/test_placement_report.py holds that file equal to what
    this would write -- rebuilt with --write-lists after a deck change,
    like the order file."""
    report = report or measure()
    return {k: report[k] for k in ("placed_above", "listed_not_here", "frequent_not_here")}


def write_lists() -> int:
    lists = candidate_lists()
    with open(LISTS_FILE, "w", encoding="utf-8") as f:
        json.dump(lists, f, ensure_ascii=False, indent=1)
        f.write("\n")
    return sum(len(v) for v in lists.values())


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
    parser.add_argument("--write-lists", action="store_true",
                        help="write the three candidate lists to datas/vocab/placement_lists.json")
    args = parser.parse_args(argv)
    if args.rebuild_order:
        keys = ordered_keys()
        with open(ORDER_FILE, "w", encoding="utf-8") as f:
            json.dump(keys, f, ensure_ascii=False, separators=(",", ":"))
        print(f"{len(keys):,} keys written to {os.path.relpath(ORDER_FILE, _BASE_DIR)}")
        return 0
    if args.write_lists:
        n = write_lists()
        print(f"{n:,} candidates written to {os.path.relpath(LISTS_FILE, _BASE_DIR)}")
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
