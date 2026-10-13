"""
The carousel studio's sentence bank (plan 200). Read-only over the
content, no database, no network; needs the tokenizer (fugashi +
unidic-lite).

frontend/carousel/ draws a row of the reading bank as a social carousel
-- the sentence, its words one by one, its grammar point, its
translation, a kanji's strokes -- and it draws it from what the app
itself says about the sentence: the breakdown's words
(study/analysis.analyze_local, grouped as the breakdown's rows group
them, frontend/src/components/analysis/rows.js), their readings,
furigana and romaji, the deck's glosses in both languages, the grammar
catalogue's rule and its tour's twists, KANJIDIC2's meanings and
KanjiVG's strokes. This writes all of it, once, into
frontend/carousel/bank/N5.json ... N1.json, one level a file so the
page opens on N5 without loading N1, and the studio is a static page
with nothing to ask a server.

    python -m scripts.carousel_bank            # writes frontend/carousel/bank/*.json
    python -m scripts.carousel_bank --check    # exits 1 when a file is stale

Run it after a change to content/reading_sentences.py, or to anything
the breakdown reads (the deck, the catalogue), and commit the files.
"""
import argparse
import json
import re
import sys
from pathlib import Path

from content import reading_sentences as bank
from content.grammar_points_data import find
from content.kanji_data import DECK_BY_CHAR
from content.kanji_meanings import get_kanji_meaning
from study.analysis import analyze_local
from study.romaji import to_romaji

BACKEND = Path(__file__).resolve().parent.parent
OUT = BACKEND.parent / "frontend" / "carousel" / "bank"
KANJIVG = BACKEND / "kanjivg"

# Bumped when the file's shape changes, so the studio can refuse a file
# it cannot read rather than draw half a slide.
REV = 1

LEVELS = ("N5", "N4", "N3", "N2", "N1")

# rows.js's grouping, mirrored: a particle and the copula stand alone; a
# trailing auxiliary belongs to the verb or adjective before it. One
# addition for a slide: the conjunctive て／で joins its verb too (読んで
# is one word to a reader scrolling past), which the app's breakdown
# leaves as a row of its own because there it is a point to open.
SKIP_POS = {"symbol", "punctuation", "filler"}
FOLDS = {"verb", "adjective", "auxiliary"}
COPULA = {"だ", "です"}
PARTICLE_ROMAJI = {"は": "wa", "へ": "e", "を": "o"}


def _stands_alone(tok: dict) -> bool:
    if tok["pos"] == "particle":
        return True
    return tok["pos"] == "auxiliary" and (tok.get("lemma") or tok["surface"]) in COPULA


def _joins(tok: dict) -> bool:
    """A token that folds into the run before it."""
    if tok["pos"] == "auxiliary" and not _stands_alone(tok):
        return True
    return tok["pos"] == "particle" and tok.get("lemma") == "て"


def _senses(meaning: str, limit: int = 3) -> list[str]:
    """A deck gloss cut into its senses: "to meet; to see" -> two."""
    parts = [p.strip() for p in re.split(r"[;；]", meaning or "") if p.strip()]
    return parts[:limit]


def _plain(text: str) -> str:
    """Catalogue prose without its markdown emphasis."""
    return re.sub(r"\*\*(.+?)\*\*", r"\1", text or "").strip()


def _romaji(reading: str, kind: str, surface: str) -> str:
    if kind == "particle" and surface in PARTICLE_ROMAJI:
        return PARTICLE_ROMAJI[surface]
    return to_romaji(reading)


def _furigana(tokens: list[dict]) -> list[list[str]]:
    """The run's furigana as [text, reading] pairs, a reading only over
    kanji, neighbouring kana merged."""
    out: list[list[str]] = []
    for tok in tokens:
        for seg in tok.get("furigana") or [{"text": tok["surface"]}]:
            reading = seg.get("reading") or ""
            if not reading and out and not out[-1][1]:
                out[-1][0] += seg["text"]
            else:
                out.append([seg["text"], reading])
    return out


def rows_of(tokens: list[dict]) -> list[dict]:
    rows: list[dict] = []
    i = 0
    while i < len(tokens):
        tok = tokens[i]
        if tok["pos"] in SKIP_POS or not tok["surface"].strip():
            rows.append({"t": tok["surface"], "k": "punct"})
            i += 1
            continue
        end = i
        if not _stands_alone(tok) and tok["pos"] in FOLDS:
            while end + 1 < len(tokens) and _joins(tokens[end + 1]):
                end += 1
        group = tokens[i:end + 1]
        rows.append(_row(group))
        i = end + 1
    return rows


def _row(group: list[dict]) -> dict:
    head = group[0]
    surface = "".join(t["surface"] for t in group)
    reading = "".join(t.get("reading") or t["surface"] for t in group)
    if _stands_alone(head):
        kind = "copula" if head["pos"] == "auxiliary" else "particle"
    else:
        kind = "word"
    # The reading a page prints is the furigana's (は, not the わ the
    # tokenizer hears), so it is not written twice: a page reads it off
    # `fu`, which is left out where nothing in the word takes furigana.
    row = {"t": surface, "ro": _romaji(reading, kind, surface), "k": kind, "pos": head["pos"]}
    furigana = _furigana(group)
    if any(r for _, r in furigana):
        row["fu"] = furigana
    match = head.get("vocab_match")
    if match and kind == "word":
        entry = match["entry"]
        row["lv"] = match.get("level")
        row["en"] = _senses(entry.get("meaning", ""))
        fr = _senses(entry.get("meaning_fr", ""))
        if fr:
            row["fr"] = fr
        lemma = entry.get("kanji") or entry.get("kana")
        if lemma and lemma != surface:
            row["lemma"] = [lemma, entry.get("kana", "")]
        if match.get("pool"):
            row["pool"] = True
    # The points written on the run: a particle's own rule is its gloss,
    # a verb's endings (〜ます) ride it as tags.
    points = []
    for tok in group:
        for g in tok.get("grammar") or []:
            if g["pattern"] not in points:
                points.append(g["pattern"])
    if points:
        row["g"] = points
    return row


def _focus_index(rows: list[dict], focus: str) -> int | None:
    for want in (lambda r: r["t"] == focus,
                 lambda r: (r.get("lemma") or [None])[0] == focus,
                 lambda r: focus in r["t"]):
        for i, r in enumerate(rows):
            if r["k"] == "word" and want(r):
                return i
    return None


def sentence(level: str, index: int, row: dict, kanji: set) -> dict:
    analysis = analyze_local(row["jp"], level)
    rows = rows_of(analysis["tokens"])
    grammar = []
    for g in analysis["grammar"]:
        if any(x["p"] == g["pattern"] for x in grammar):
            continue
        grammar.append({"p": g["pattern"], "lv": g["level"], "kind": g["kind"]})
    kanji.update(c for c in row["jp"] if c in DECK_BY_CHAR)
    out = {
        "id": f"{level}.{index + 1}",
        "lv": level,
        "jp": row["jp"],
        "en": row["en"],
        "fr": row["fr"],
        "p": row["grammar"],
        "focus": row["focus"],
        "rows": rows,
        "gram": grammar,
    }
    fi = _focus_index(rows, row["focus"])
    if fi is not None:
        out["fi"] = fi
    return out


# The catalogue writes a point's form in English only ("verb て-form +
# ください"). A French slide prints it in French or not at all: these
# turn the form's few terms over, and a form left with a word they do not
# know gets no French form rather than a sentence in two languages.
_FORM_FR = [
    (r"\bverb dictionary form\b", "verbe (forme du dictionnaire)"),
    (r"\bverb plain form\b", "verbe (forme neutre)"),
    (r"\bverb ます-stem\b", "verbe (radical en ます)"),
    (r"\bverb (\S+)-form\b", r"verbe (forme en \1)"),
    (r"\bverb stem\b", "radical du verbe"),
    (r"\badjective stem\b", "radical de l'adjectif"),
    (r"\bdictionary form\b", "forme du dictionnaire"),
    (r"\bplain form\b", "forme neutre"),
    (r"(\S+)-form\b", r"forme en \1"),
    (r"い-adj(ective)?\b", "adjectif en い"),
    (r"な-adj(ective)?\b", "adjectif en な"),
    (r"\bquestion word\b", "mot interrogatif"),
    (r"\bnoun\b", "nom"), (r"\bverbs?\b", "verbe"), (r"\badjective\b", "adjectif"), (r"\badj\b", "adj."),
    (r"\bsentence\b", "phrase"), (r"\bclause\b", "proposition"), (r"\bpredicate\b", "prédicat"),
    (r"\bquantity\b", "quantité"), (r"\bnumber\b", "nombre"), (r"\bcounter\b", "compteur"),
    (r"\bsubject\b", "sujet"), (r"\bobject\b", "objet"), (r"\btopic\b", "thème"), (r"\bparticle\b", "particule"),
]
_FR_WORDS = {"nom", "verbe", "forme", "neutre", "du", "dictionnaire", "radical", "de", "l", "adjectif", "adj",
             "en", "phrase", "proposition", "prédicat", "quantité", "nombre", "compteur", "mot", "interrogatif",
             "sujet", "objet", "thème", "particule", "a", "b"}


def form_fr(form: str) -> str | None:
    out = form
    for pattern, repl in _FORM_FR:
        def sub(m, repl=repl):
            text = m.expand(repl)
            return text[0].upper() + text[1:] if m.group(0)[0].isupper() else text
        out = re.sub(pattern, sub, out, flags=re.IGNORECASE)
    words = re.findall(r"[A-Za-zÀ-ÿ]+", out)
    return out if all(w.lower() in _FR_WORDS for w in words) else None


def point(pattern: str) -> dict | None:
    """What a slide says about a grammar point: its meaning, its form,
    the catalogue's rule and caution, a comparison, and the tour's
    twists (each a notion, a pair of forms and why)."""
    found = find(pattern)
    if not found:
        return None
    level, entry = found
    out = {
        "lv": level,
        "en": (entry.get("meaning") or {}).get("en", ""),
        "fr": (entry.get("meaning") or {}).get("fr", ""),
        "form": entry.get("structure", ""),
    }
    french = form_fr(out["form"])
    if french:
        out["form_fr"] = french
    for step in entry.get("steps") or []:
        if step.get("kind") in ("rule", "careful") and step["kind"] not in out:
            out[step["kind"]] = {"en": _plain(step.get("en")), "fr": _plain(step.get("fr"))}
    compare = (entry.get("compare") or [])[:1]
    if compare:
        c = compare[0]
        out["compare"] = {"p": c.get("pattern", ""), "en": _plain(c.get("en")), "fr": _plain(c.get("fr"))}
    twists = []
    for t in ((entry.get("tour") or {}).get("twists") or []):
        if not t.get("pair") or len(t["pair"]) != 2:
            continue
        twists.append({
            "notion": t.get("notion") or {},
            "pair": t["pair"],
            "why": {k: _plain(v) for k, v in (t.get("why") or {}).items()},
        })
        if len(twists) == 3:
            break
    if twists:
        out["twists"] = twists
    return out


def _deck_words() -> dict[tuple[str, str], int]:
    """Every (written, kana) pair the vocab deck teaches, to the rank of
    the first level that teaches it (N5 is 0)."""
    from content.vocab_data import VOCAB_BY_LEVEL

    ranks: dict[tuple[str, str], int] = {}
    for rank, level in enumerate(LEVELS):
        for e in VOCAB_BY_LEVEL.get(level, []):
            for k in (e.get("kana") or "").split("/"):
                ranks.setdefault((e["kanji"], k), rank)
    return ranks


def _readings(char: str, kana: str, deck: dict) -> tuple[list[str], list[list[str]]]:
    """KANJIDIC's 'ショク・ジキ・く.う・た.べる' -> on ['ショク', 'ジキ'],
    kun [['た', 'べる'], ['く', 'う']]: the stem the kanji writes and the
    okurigana after it, the readings the deck teaches earliest as words
    first (食 leads with たべる, an N5 word, not くう), as the
    dictionary's plate prints two.
    Prefix and suffix forms (~ゆき) are left out."""
    on, kun = [], []
    for r in (kana or "").split("・"):
        r = r.strip()
        if not r or r[0] in "~-～" or r[-1] in "~-～":
            continue
        if re.fullmatch(r"[ァ-ヿ]+", r):
            on.append(r)
        else:
            stem, _, oku = r.partition(".")
            if [stem, oku] not in kun:
                kun.append([stem, oku])
    kun.sort(key=lambda k: deck.get((char + k[1], k[0] + k[1]), len(LEVELS)))
    return on[:2], kun[:2]


def strokes(char: str) -> dict | None:
    """KanjiVG's strokes in their order, and where each number is set."""
    path = KANJIVG / f"{ord(char):05x}.svg"
    if not path.exists():
        return None
    svg = path.read_text(encoding="utf-8")
    paths = re.findall(r'<path[^>]*?\sd="([^"]+)"', svg)
    numbers = [
        [round(float(x), 1), round(float(y), 1)]
        for x, y in re.findall(r'<text transform="matrix\(1 0 0 1 ([\d.]+) ([\d.]+)\)">\d+</text>', svg)
    ]
    if not paths:
        return None
    return {"d": paths, "n": numbers if len(numbers) == len(paths) else []}


def kanji_entry(char: str, deck: dict) -> dict:
    level, entry = DECK_BY_CHAR[char]
    on, kun = _readings(char, entry.get("kana", ""), deck)
    out = {
        "lv": level,
        "on": on,
        "kun": kun,
        "en": _senses(entry.get("meaning", "")),
        "fr": _senses(get_kanji_meaning(char, "fr")),
    }
    s = strokes(char)
    if s:
        out["s"] = s
    return out


def build(level: str, deck: dict) -> dict:
    """One level's file, whole: its sentences, the points a slide names
    (each row's own point, and every point a particle or copula row is
    glossed by) and the kanji its sentences write."""
    points: set = set()
    kanji: set = set()
    sentences = []
    for i, row in enumerate(bank.BY_LEVEL[level]):
        s = sentence(level, i, row, kanji)
        points.add(s["p"])
        points.update(g["p"] for g in s["gram"] if g["kind"] == "marker")
        # A particle's gloss is the point written on it: に in のに is 〜のに's.
        points.update(p for r in s["rows"] if r["k"] in ("particle", "copula") for p in r.get("g", []))
        # ... and a word the deck has no gloss for (ください in 〜てください) is glossed by its point.
        points.update(p for r in s["rows"] if r["k"] == "word" and not r.get("en") for p in r.get("g", []))
        sentences.append(s)
    return {
        "rev": REV,
        "level": level,
        "sentences": sentences,
        "points": {p: v for p in sorted(points) if (v := point(p))},
        "kanji": {c: kanji_entry(c, deck) for c in sorted(kanji)},
    }


def dump(data: dict) -> str:
    # One sentence, point or kanji a line: the file diffs by the row
    # that changed rather than as one long line.
    def line(v):
        return json.dumps(v, ensure_ascii=False, separators=(",", ":"))

    parts = ['{"rev":%d,"level":%s,' % (data["rev"], line(data["level"])), '"sentences":[\n']
    parts.append(",\n".join(line(s) for s in data["sentences"]))
    parts.append('],\n"points":{\n')
    parts.append(",\n".join(f"{line(k)}:{line(v)}" for k, v in data["points"].items()))
    parts.append('},\n"kanji":{\n')
    parts.append(",\n".join(f"{line(k)}:{line(v)}" for k, v in data["kanji"].items()))
    parts.append("}}\n")
    return "".join(parts)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--check", action="store_true", help="exit 1 when a level's file is stale")
    args = parser.parse_args()

    deck = _deck_words()
    stale = []
    for level in LEVELS:
        data = build(level, deck)
        text = dump(data)
        out = OUT / f"{level}.json"
        name = out.relative_to(BACKEND.parent)
        if args.check:
            if not out.exists() or out.read_text(encoding="utf-8") != text:
                stale.append(str(name))
            continue
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(text, encoding="utf-8")
        print(f"wrote {name}: {len(data['sentences'])} sentences, {len(data['points'])} points, "
              f"{len(data['kanji'])} kanji, {len(text.encode()) // 1024} KB")
    if args.check:
        if stale:
            print("stale: " + ", ".join(stale) + " -- run python -m scripts.carousel_bank")
            return 1
        print("the carousel bank is current")
    return 0


if __name__ == "__main__":
    sys.exit(main())
