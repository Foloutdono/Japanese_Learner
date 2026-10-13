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
frontend/carousel/bank/, one level a file so the page opens on N5
without loading N1, and the studio is a static page with nothing to
ask a server. Since plan 200b it writes the rest of what a carousel can
be drawn from too: the grammar lessons with their tours, the deck's
words and kanji, the kana and the comprehension passages; since plan
200c the wrong spellings the 表記 question deals (each checked against
the deck and JMdict, so no wrong answer is a word) and index.json, the
figures a carousel's last slide may quote.

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
REV = 3

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
        hy = orthography(rows[fi].get("fu") or [])
        if hy:
            out["hy"] = hy
    return out


# ── 表記: how a word is written (plan 200c) ──────────────────────
# The exam's 表記 question prints a word in kana and asks for its
# kanji. Its wrong answers are the word with one kanji swapped for
# another read the same way (学校 -> 学交): a learner who knows the
# word knows which one it takes. A swap that is itself a word is never
# dealt, in the deck or in JMdict (機会 -> 機械), since it could be a
# second right answer.
_hira = lambda s: "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in s)  # noqa: E731
_ON: dict[str, list[str]] = {}
_FORMS: set[str] = set()


def _on_index() -> dict[str, list[str]]:
    """Every deck kanji by each of its on'yomi, in hiragana, the
    earliest-taught first, so a wrong answer is a kanji a learner has met."""
    if not _ON:
        found: dict[str, list] = {}
        for c, (lv, e) in DECK_BY_CHAR.items():
            for r in (e.get("kana") or "").split("・"):
                r = r.strip()
                if r and re.fullmatch(r"[ァ-ヿ]+", r):
                    found.setdefault(_hira(r), []).append((LEVELS.index(lv), c))
        _ON.update({k: [c for _, c in sorted(v)] for k, v in found.items()})
    return _ON


def _forms() -> set[str]:
    if not _FORMS:
        from content.vocab_data import VOCAB_BY_LEVEL
        _FORMS.update(e["kanji"] for lv in LEVELS for e in VOCAB_BY_LEVEL.get(lv, []) if e.get("kanji"))
    return _FORMS


def orthography(fu: list[list[str]], want: int = 3) -> list[str]:
    """Three wrong ways to write a word, from its furigana; [] when the
    word has fewer (a kanji read by a kun'yomi has no same-sounding
    rival the deck teaches)."""
    from content.vocab_jmdict_data import has_form

    segs = [(t, r) for t, r in fu]
    if not any(r for _, r in segs):
        return []
    per_slot = []
    for i, (t, r) in enumerate(segs):
        if len(t) != 1 or not r or t not in DECK_BY_CHAR:
            continue
        options = []
        for other in _on_index().get(r, []):
            if other == t:
                continue
            cand = "".join(other if j == i else x for j, (x, _) in enumerate(segs))
            if cand in _forms() or has_form(cand):
                continue
            options.append(cand)
            if len(options) == want:
                break
        if options:
            per_slot.append(options)
    # One from each kanji in turn, so the three are not one swap thrice.
    out: list[str] = []
    for n in range(want):
        for options in per_slot:
            if n < len(options) and options[n] not in out:
                out.append(options[n])
    return out[:want]


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
        out["compare"] = {"p": c.get("pattern", ""), "en": _plain(c.get("en")), "fr": _plain(c.get("fr")),
                          **_rival(c.get("pattern", ""))}
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
    """One level's sentences, whole: the sentences, the points a slide
    names (each row's own point, and every point a particle or copula row
    is glossed by) and the kanji its sentences write."""
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


# ── The rest of the app (plan 200b) ──────────────────────────────
# A carousel is not only a sentence of the reading bank: the studio also
# draws a grammar lesson, a word of the deck, a kanji, a kana and a
# comprehension passage. Each is written below from the app's own
# content, every Japanese line in it cut into words as a sentence is.

def text_rows(jp: str, level: str | None = None, pattern: str | None = None) -> list[list]:
    """A line of a lesson as the rows a slide sets, each packed as an
    array to keep thousands of them small: ["。"] for punctuation, else
    [text, kind ("w" word, "v" verb or adjective, "p" particle, "c" copula), romaji, furigana
    (0 where none), 1 where `pattern` is written on it]; trailing empties
    dropped. No glosses: a lesson's line is read, not taken apart.
    The studio unpacks them (sources.js, unpack)."""
    analysis = analyze_local(jp, level)
    out = []
    for r in rows_of(analysis["tokens"]):
        if r["k"] == "punct":
            out.append([r["t"]])
            continue
        kind = "v" if r["k"] == "word" and r["pos"] in ("verb", "adjective") else r["k"][0]
        row = [r["t"], kind, r["ro"], r.get("fu") or 0, 1 if pattern and pattern in r.get("g", []) else 0]
        while row[-1] == 0:
            row.pop()
        out.append(row)
    return out


def _rival(pattern: str) -> dict:
    """The point a point is confused with, as the catalogue teaches it:
    its level, meaning, form and one example, for the "this or that"
    carousel (plan 200c); {} where the rival is not a catalogue point."""
    found = find(pattern) if pattern else None
    if not found:
        return {}
    level, entry = found
    m = entry.get("meaning") or {}
    out = {"lv": level, "meaning": {"en": m.get("en", ""), "fr": m.get("fr", "")}, "form": entry.get("structure", "")}
    ex = (entry.get("examples") or [])[:1]
    if ex:
        out["ex"] = {"rows": text_rows(ex[0]["jp"], level, entry["pattern"]), "en": ex[0].get("en", ""), "fr": ex[0].get("fr", "")}
    return out


def _both(d: dict | None) -> dict:
    return {k: _plain((d or {}).get(k, "")) for k in ("en", "fr")}


def lesson(level: str, entry: dict) -> dict:
    """A grammar point as the tour teaches it: its meaning and form, the
    rule and the caution, the rival it is confused with, three examples,
    two twists, the scene and two of its quiz questions. Every choice
    list keeps the catalogue's order, the right one first."""
    p = entry["pattern"]
    meaning = entry.get("meaning") or {}
    out = {"p": p, "lv": level, "en": meaning.get("en", ""), "fr": meaning.get("fr", ""),
           "form": entry.get("structure", "")}
    french = form_fr(out["form"])
    if french:
        out["form_fr"] = french
    for step in entry.get("steps") or []:
        if step.get("kind") in ("rule", "careful") and step["kind"] not in out:
            out[step["kind"]] = _both(step)
    compare = (entry.get("compare") or [])[:1]
    if compare:
        out["compare"] = {"p": compare[0].get("pattern", ""), **_both(compare[0]), **_rival(compare[0].get("pattern", ""))}
    out["ex"] = [{"rows": text_rows(e["jp"], level, p), "en": e.get("en", ""), "fr": e.get("fr", "")}
                 for e in (entry.get("examples") or [])[:3]]
    tour = entry.get("tour") or {}
    twists = []
    for t in (tour.get("twists") or [])[:3]:
        tw = {"notion": t.get("notion") or {}, "why": _both(t.get("why")), "ask": _both(t.get("ask")),
              "tr": _both(t.get("tr")), "rows": text_rows(t["jp"], level, p),
              "choices": [_both(c) for c in t.get("choices") or []]}
        if t.get("pair") and len(t["pair"]) == 2:
            tw["pair"] = t["pair"]
        twists.append(tw)
    if twists:
        out["twists"] = twists
    scene = tour.get("scene")
    if scene:
        ask = scene.get("ask") or {}
        cue = ask.get("cue") or {}
        out["scene"] = {
            "place": scene.get("place", ""),
            "them": scene.get("them") or {},
            "lines": [{"who": ln["who"], "rows": text_rows(ln["jp"], level, p), "en": ln.get("en", ""), "fr": ln.get("fr", "")}
                      for ln in scene.get("lines") or []],
            "note": _both(scene.get("note")),
            "ask": {
                "cue": {"who": cue.get("who", "them"), "rows": text_rows(cue["jp"], level), "en": cue.get("en", ""), "fr": cue.get("fr", "")},
                "task": _both(ask.get("task")),
                "choices": [text_rows(c, level) for c in ask.get("choices") or []],
                "why": _both(ask.get("why")),
            } if cue.get("jp") else None,
        }
    quiz = []
    for q in (tour.get("quiz") or [])[:4]:
        item = {"kind": q.get("kind"), "ask": _both(q.get("ask")), "why": _both(q.get("why"))}
        if q.get("jp"):
            item["rows"] = text_rows(q["jp"], level)
            item["tr"] = _both(q.get("tr"))
        choices = q.get("choices") or []
        item["choices"] = [_both(c) if isinstance(c, dict) else c for c in choices]
        quiz.append(item)
    if quiz:
        out["quiz"] = quiz
    return out


def lessons(level: str) -> dict:
    from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL
    return {"rev": REV, "level": level,
            "lessons": [lesson(level, e) for e in GRAMMAR_POINTS_BY_LEVEL.get(level, [])]}


def _furigana_of(written: str, kana: str) -> list[list[str]]:
    from study.furigana import align_deck
    return _furigana([{"surface": written, "furigana": align_deck(written, kana)}])


def word_index(sentences: list[dict]) -> dict[str, list[tuple[str, str, str]]]:
    """Every word of every bank sentence, by how it is written (and by
    its dictionary form): -> [(sentence id, level, its kana)]."""
    out: dict[str, list] = {}
    for s in sentences:
        for r in s["rows"]:
            if r["k"] != "word":
                continue
            kana = r.get("lemma", [None, None])[1] or "".join(rd or t for t, rd in r.get("fu", [[r["t"], ""]]))
            for key in {r["t"], (r.get("lemma") or [None])[0]} - {None}:
                out.setdefault(key, []).append((s["id"], s["lv"], kana))
    return out


def words(level: str, index: dict) -> dict:
    """The deck's words at a level: each with its furigana, its senses in
    both languages and up to two bank sentences it is read in, the
    level's own first, then an easier one."""
    from content.vocab_data import VOCAB_BY_LEVEL
    from translations import fr_gloss
    from translations.fr.vocab_fr import VOCAB_FR

    rank = {lv: i for i, lv in enumerate(LEVELS)}
    out = []
    for e in VOCAB_BY_LEVEL.get(level, []):
        kana = (e.get("kana") or e["kanji"]).split("/")[0]
        # A word the deck writes in kana alone has an empty written form.
        written = e["kanji"] or kana
        hits = [h for h in index.get(written, []) if h[2] == kana or not h[2]]
        hits.sort(key=lambda h: (h[1] != level, abs(rank[h[1]] - rank[level]), rank[h[1]] > rank[level]))
        w = {"t": written, "r": kana, "ro": to_romaji(kana), "en": _senses(e.get("meaning", ""))}
        fr = _senses(fr_gloss(e, VOCAB_FR) or "")
        if fr:
            w["fr"] = fr
        fu = _furigana_of(written, kana)
        if any(r for _, r in fu):
            w["fu"] = fu
            hy = orthography(fu)
            if hy:
                w["hy"] = hy
        ex = list(dict.fromkeys(h[0] for h in hits))[:2]
        if ex:
            w["ex"] = ex
        out.append(w)
    return {"rev": REV, "level": level, "words": out}


def kanji_cards(level: str, deck: dict) -> dict:
    """The deck's kanji at a level, with their strokes and the deck words
    that write them, the earliest-taught first."""
    from content.kanji_data import KANJI_BY_LEVEL
    from content.vocab_data import VOCAB_BY_LEVEL
    from translations import fr_gloss
    from translations.fr.vocab_fr import VOCAB_FR

    by_char: dict[str, list] = {}
    for rank, lv in enumerate(LEVELS):
        for e in VOCAB_BY_LEVEL.get(lv, []):
            written = e["kanji"]
            if len(written) > 4:
                continue
            for c in set(written):
                if c in DECK_BY_CHAR:
                    by_char.setdefault(c, []).append((rank, len(written), lv, e))
    out = {}
    for entry in KANJI_BY_LEVEL.get(level, []):
        c = entry["kanji"]
        if DECK_BY_CHAR.get(c, (None,))[0] != level:
            continue
        card = kanji_entry(c, deck)
        ws = []
        for _, _, lv, e in sorted(by_char.get(c, []), key=lambda x: (x[0], x[1]))[:5]:
            kana = (e.get("kana") or "").split("/")[0]
            w = {"t": e["kanji"], "r": kana, "ro": to_romaji(kana), "lv": lv, "en": _senses(e.get("meaning", ""), 1)}
            fr = _senses(fr_gloss(e, VOCAB_FR) or "", 1)
            if fr:
                w["fr"] = fr
            ws.append(w)
        if ws:
            card["words"] = ws
        out[c] = card
    return {"rev": REV, "level": level, "kanji": out}


def kanji_index(deck: dict) -> dict:
    """Every deck kanji's level, meanings and two readings, without its
    strokes: what a word's slide says about each kanji it is written
    with, whatever level that kanji is taught at."""
    out = {}
    for c in sorted(DECK_BY_CHAR):
        card = kanji_entry(c, deck)
        card.pop("s", None)
        out[c] = card
    return {"rev": REV, "kanji": out}


def kana_cards() -> dict:
    """The two syllabaries' basic kana: romaji, strokes, the twin in the
    other script, and up to five N5 or N4 words that begin with it."""
    from content.kana_data import HIRAGANA_BASIC, KATAKANA_BASIC, twin
    from content.vocab_data import VOCAB_BY_LEVEL
    from translations import fr_gloss
    from translations.fr.vocab_fr import VOCAB_FR

    deck = [e for lv in ("N5", "N4") for e in VOCAB_BY_LEVEL.get(lv, [])]
    out = []
    for script, entries in (("hiragana", HIRAGANA_BASIC), ("katakana", KATAKANA_BASIC)):
        for e in entries:
            k = e["kana"]
            card = {"k": k, "ro": e["romaji"], "set": script, "group": e.get("group", "")}
            if twin(k):
                card["twin"] = twin(k)
            s = strokes(k)
            if s:
                card["s"] = s
            ws = []
            for v in deck:
                kana = (v.get("kana") or "").split("/")[0]
                written = v["kanji"] or kana
                in_script = re.fullmatch(r"[ァ-ヿ]+", kana) if script == "katakana" else re.fullmatch(r"[ぁ-ゟ]+", kana)
                if kana.startswith(k) and in_script and len(kana) <= 5:
                    w = {"t": written, "r": kana, "ro": to_romaji(kana), "en": _senses(v.get("meaning", ""), 1)}
                    fr = _senses(fr_gloss(v, VOCAB_FR) or "", 1)
                    if fr:
                        w["fr"] = fr
                    ws.append(w)
                if len(ws) == 5:
                    break
            if ws:
                card["words"] = ws
            out.append(card)
    return {"rev": REV, "kana": out}


def passages() -> dict:
    """The comprehension seeds (content/comprehension/*.json): each text
    cut into its sentences, each sentence into words, and its questions."""
    out = []
    for level in LEVELS:
        path = BACKEND / "content" / "comprehension" / f"{level}.json"
        if not path.exists():
            continue
        for ex in json.loads(path.read_text(encoding="utf-8")):
            parts = [x for x in re.split(r"(?<=[。！？])(?!」)", ex["text"]) if x.strip()]
            out.append({
                "id": ex["id"], "lv": level, "title": ex.get("title", ""), "grammar": ex.get("grammar", []),
                "sents": [text_rows(x, level) for x in parts],
                "words": _passage_words(parts, level),
                "questions": ex.get("questions", []),
            })
    return {"rev": REV, "passages": out}


def _passage_words(parts: list[str], level: str, want: int = 6) -> list[dict]:
    """The words of a passage worth learning before reading it: written
    with kanji, glossed by the deck, the passage's own level first, then
    the level under it, each once, in the order the text meets them."""
    rank = {lv: i for i, lv in enumerate(LEVELS)}
    seen, found = set(), []
    for n, part in enumerate(parts):
        for r in rows_of(analyze_local(part, level)["tokens"]):
            if r["k"] != "word" or not r.get("fu") or not r.get("en") or r.get("pool"):
                continue
            written = (r.get("lemma") or [r["t"]])[0]
            # A word of one kanji alone (日, 七) or a numeral is no word to learn first.
            if (written in seen or not re.search(r"[一-鿿]", written) or r.get("lv") not in rank
                    or len(written) < 2 or re.fullmatch(r"[一二三四五六七八九十百千万何0-9０-９]+(時|分|日|月|年|人|回|本|枚|歳|週間|時間)?", written)):
                continue
            seen.add(written)
            kana = (r.get("lemma") or [None, None])[1] or "".join(rd or t for t, rd in r["fu"])
            w = {"t": written, "r": kana, "ro": to_romaji(kana), "lv": r["lv"], "en": r["en"][:1]}
            if r.get("fr"):
                w["fr"] = r["fr"][:1]
            fu = _furigana_of(written, kana)
            if any(x for _, x in fu):
                w["fu"] = fu
            found.append((abs(rank[r["lv"]] - rank[level]), rank[r["lv"]] > rank[level], len(found), w))
    found.sort(key=lambda x: x[:3])
    return [w for *_, w in found[:want]]


def dump(data: dict) -> str:
    """The file, one sentence, point, lesson, word or kanji a line, so it
    diffs by the entry that changed rather than as one long line."""
    def line(v):
        return json.dumps(v, ensure_ascii=False, separators=(",", ":"))

    parts = []
    for key, value in data.items():
        if isinstance(value, list):
            body = "[\n" + ",\n".join(line(v) for v in value) + "]"
        elif isinstance(value, dict) and value and all(isinstance(v, dict) for v in value.values()):
            body = "{\n" + ",\n".join(f"{line(k)}:{line(v)}" for k, v in value.items()) + "}"
        else:
            body = line(value)
        parts.append(f"{line(key)}:{body}")
    return "{" + ",\n".join(parts) + "}\n"


def files(deck: dict):
    """Every file the studio reads, as (name, data), in the order written."""
    sentences = {}
    for level in LEVELS:
        sentences[level] = build(level, deck)
        yield f"{level}.json", sentences[level]
    index = word_index([s for lv in LEVELS for s in sentences[lv]["sentences"]])
    for level in LEVELS:
        yield f"grammar-{level}.json", lessons(level)
        yield f"words-{level}.json", words(level, index)
        yield f"kanji-{level}.json", kanji_cards(level, deck)
    yield "kanji-index.json", kanji_index(deck)
    kana = kana_cards()
    yield "kana.json", kana
    comprehension = passages()
    yield "comprehension.json", comprehension
    yield "index.json", figures(sentences, kana, comprehension)


def figures(sentences: dict, kana: dict, comprehension: dict) -> dict:
    """What a carousel's last slide may say about each line of the app
    (plan 200c): how many sentences, points, words, kanji and kana it
    teaches, counted from the content itself, never written by hand."""
    from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL
    from content.kanji_data import KANJI_BY_LEVEL
    from content.vocab_data import VOCAB_BY_LEVEL

    return {"rev": REV, "figures": {
        "sentences": sum(len(sentences[lv]["sentences"]) for lv in LEVELS),
        "points": sum(len(GRAMMAR_POINTS_BY_LEVEL.get(lv, [])) for lv in LEVELS),
        "words": sum(len(VOCAB_BY_LEVEL.get(lv, [])) for lv in LEVELS),
        "kanji": sum(len(KANJI_BY_LEVEL.get(lv, [])) for lv in LEVELS),
        "hiragana": sum(1 for k in kana["kana"] if k["set"] == "hiragana"),
        "katakana": sum(1 for k in kana["kana"] if k["set"] == "katakana"),
        "passages": len(comprehension["passages"]),
    }}


def _count(data: dict) -> str:
    return ", ".join(f"{len(v)} {k}" for k, v in data.items() if isinstance(v, (list, dict)))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--check", action="store_true", help="exit 1 when a file is stale")
    args = parser.parse_args()

    deck = _deck_words()
    stale = []
    for filename, data in files(deck):
        text = dump(data)
        out = OUT / filename
        name = out.relative_to(BACKEND.parent)
        if args.check:
            if not out.exists() or out.read_text(encoding="utf-8") != text:
                stale.append(str(name))
            continue
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(text, encoding="utf-8")
        print(f"wrote {name}: {_count(data)}, {len(text.encode()) // 1024} KB")
    if args.check:
        if stale:
            print("stale: " + ", ".join(stale) + " -- run python -m scripts.carousel_bank")
            return 1
        print("the carousel bank is current")
    return 0


if __name__ == "__main__":
    sys.exit(main())
