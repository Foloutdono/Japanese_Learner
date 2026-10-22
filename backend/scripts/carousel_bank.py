"""
The carousel studio's sentence bank (plan 229). Read-only over the
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
ask a server. Since plan 229b it writes the rest of what a carousel can
be drawn from too: the grammar lessons with their tours, the deck's
words and kanji, the kana and the comprehension passages; since plan
229c the wrong spellings the 表記 question deals (each checked against
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


# KANJIDIC's notes among a kanji's meanings, which are no meaning to
# learn: 働 "work; (kokuji)", 八 "eight; eight radical (no. 12)".
_NOT_A_SENSE = re.compile(r"^\(.*\)$|\bradical\b.*\(no\.\s*\d+\)", re.I)


def _kanji_senses(meaning: str, limit: int = 3) -> list[str]:
    """A kanji's meanings as _senses cuts them, its dictionary's notes
    left out before the first `limit` are taken."""
    return [s for s in _senses(meaning, 99) if not _NOT_A_SENSE.search(s)][:limit]


def _plain(text: str) -> str:
    """Catalogue prose without its markdown emphasis."""
    return re.sub(r"\*\*(.+?)\*\*", r"\1", text or "").strip()


# ── Words a page spells in kana (plan 248) ──────────────────────────
# A word whose kanji are above a text's level is written in kana
# (としょかん), or half in kana (食どう), and the tokenizer, which knows
# it only in kanji, cuts it into other words: は|と|しょ|か|んで, 食|どう.
# Each spelling here is read as the word it spells: the line is analysed
# with the word's kanji in its place, and its tokens are given back the
# page's own spelling, readings only over the kanji it writes. A list
# reviewed by hand, not a guess: a guessing pass read ふりそう as ふ理想.
# A verb's spelling (ねます) is read so only where the plain analysis
# starts a token at it (はやく|ね|ます, never わかり|かね|ます).
_RESPELL = {
    "しんかんせん": "新幹線", "しゅくだい": "宿題", "かいさつ": "改札", "としょかん": "図書館",
    "食どう": "食堂", "野さい": "野菜", "らい週": "来週", "でんち": "電池", "てんいん": "店員",
    "ちかてつ": "地下鉄", "れいぞうこ": "冷蔵庫", "きっさてん": "喫茶店", "ゆうびんきょく": "郵便局",
    "つうろ": "通路", "じしょ": "辞書", "ひこうき": "飛行機", "ていきけん": "定期券",
    "うんてんしゅ": "運転手", "まどぐち": "窓口", "るすばん": "留守番", "ぶんぽう": "文法",
    "よやく": "予約", "でぐち": "出口", "ふじさん": "富士山", "ひるごはん": "昼ご飯",
    "ばんごはん": "晩ご飯", "たんじょうび": "誕生日", "ごぶさた": "ご無沙汰",
}
_RESPELL_VERBS = {"ねます": "寝ます", "ねました": "寝ました", "ねましょう": "寝ましょう", "ねません": "寝ません"}
_RESPELL_RE = re.compile("|".join(re.escape(k) for k in sorted({**_RESPELL, **_RESPELL_VERBS}, key=len, reverse=True)))
_KANJI_CHAR = re.compile(r"[㐀-鿿々]")


def _spelled_back(tokens: list[dict], original: str) -> bool:
    """The tokens of a respelled word given the page's spelling back: each
    furigana segment is its kanji where the page writes them, its reading
    where the page writes that. False where the two do not line up."""
    at = 0
    for tok in tokens:
        segs = tok.get("furigana") or [{"text": tok["surface"]}]
        out = []
        for seg in segs:
            text, reading = seg["text"], seg.get("reading") or ""
            if original.startswith(text, at):
                out.append({"text": text, "reading": reading} if reading else {"text": text})
                at += len(text)
            elif reading and original.startswith(reading, at):
                out.append({"text": reading})
                at += len(reading)
            else:
                return False
        tok["surface"] = "".join(x["text"] for x in out)
        tok["furigana"] = out
        written = set(tok["surface"])
        tok["kanji_matches"] = [m for m in tok.get("kanji_matches") or [] if m.get("kanji") in written]
    return at == len(original)


def _analyze(jp: str, level: str | None = None) -> dict:
    """analyze_local, with the page's kana spellings read as the words they
    spell (_RESPELL); positions are the page's own."""
    plain = analyze_local(jp, level) if level else analyze_local(jp)
    starts = {t["start"] for t in plain["tokens"]}
    spans, parts, last, shift = [], [], 0, 0
    for m in _RESPELL_RE.finditer(jp):
        if m.group() in _RESPELL_VERBS and m.start() not in starts:
            continue
        word = _RESPELL.get(m.group()) or _RESPELL_VERBS[m.group()]
        parts.append(jp[last:m.start()])
        parts.append(word)
        spans.append((m.start() + shift, m.start() + shift + len(word), m.start(), m.group()))
        shift += len(word) - len(m.group())
        last = m.end()
    if not spans:
        return plain
    parts.append(jp[last:])
    analysis = analyze_local("".join(parts), level) if level else analyze_local("".join(parts))

    def back(pos: int) -> int:
        """A position in the respelled line, in the page's line."""
        moved = 0
        for a, b, o, orig in spans:
            if pos >= b:
                moved += (b - a) - len(orig)
            elif pos > a:
                return o + min(len(orig), pos - a)
        return pos - moved

    placed = {}
    for a, b, o, orig in spans:
        inside = [t for t in analysis["tokens"] if t["start"] < b and a < t["end"]]
        if not inside or inside[0]["start"] != a or inside[-1]["end"] != b or not _spelled_back(inside, orig):
            return plain
        # The word's own tokens laid end to end from where the page writes it.
        at = o
        for tok in inside:
            placed[id(tok)] = (at, at + len(tok["surface"]))
            at += len(tok["surface"])
    for tok in analysis["tokens"]:
        tok["start"], tok["end"] = placed.get(id(tok)) or (back(tok["start"]), back(tok["end"]))
    for g in analysis.get("grammar") or []:
        g["start"], g["end"] = back(g["start"]), back(g["end"])
        g["segments"] = [[back(x), back(y)] for x, y in g.get("segments") or []]
    analysis["text"] = jp
    return analysis


_KATAKANA = re.compile(r"^[\u30a0-\u30ffー]+$")


def _romaji(reading: str, kind: str, surface: str) -> str:
    if kind == "particle" and surface in PARTICLE_ROMAJI:
        return PARTICLE_ROMAJI[surface]
    # A word in katakana is romanised as it is written: its reading spells
    # ー as a vowel (コーヒー こうひい), which gave "kouhii" (plan 248).
    if _KATAKANA.match(surface):
        return to_romaji(surface)
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


# ── A number and its counter (plan 229l) ──────────────────────────
# The tokenizer cuts 三十分 into 三十 (read さんじゅっ, no gloss) and
# 分 (ぷん): read apart, neither is what the sentence says. A number and
# the counter after it are one word, read and glossed as one: 三十分
# さんじゅっぷん, "30 minutes". A counter whose sense the number leaves
# open (三日: the third, or three days; 三月: March) is left as it is.
NUMERAL = re.compile(r"^([〇一二三四五六七八九十百千万億0-9０-９]+|何|数)$")
COUNTERS = {
    # counter: (English one, English many, French one, French many)
    "分": ("minute", "minutes", "minute", "minutes"),
    "時間": ("hour", "hours", "heure", "heures"),
    "年": ("year", "years", "an", "ans"),
    "年間": ("year", "years", "an", "ans"),
    "週間": ("week", "weeks", "semaine", "semaines"),
    "か月": ("month", "months", "mois", "mois"),
    "ヶ月": ("month", "months", "mois", "mois"),
    "カ月": ("month", "months", "mois", "mois"),
    "晩": ("night", "nights", "nuit", "nuits"),
    "度": ("time", "times", "fois", "fois"),
    "回": ("time", "times", "fois", "fois"),
    "かい": ("time", "times", "fois", "fois"),
    "人": ("person", "people", "personne", "personnes"),
    "円": ("yen", "yen", "yen", "yens"),
    "冊": ("book", "books", "livre", "livres"),
    "さつ": ("book", "books", "livre", "livres"),
    "枚": ("sheet", "sheets", "feuille", "feuilles"),
    "まい": ("sheet", "sheets", "feuille", "feuilles"),
    "本": ("long thing", "long things", "objet long", "objets longs"),
    "台": ("machine", "machines", "machine", "machines"),
    "メートル": ("metre", "metres", "mètre", "mètres"),
    "周": ("lap", "laps", "tour", "tours"),
    "社": ("company", "companies", "entreprise", "entreprises"),
    "軒": ("house", "houses", "maison", "maisons"),
    "通": ("letter", "letters", "lettre", "lettres"),
    "字": ("character", "characters", "caractère", "caractères"),
    "か所": ("place", "places", "endroit", "endroits"),
    "カ所": ("place", "places", "endroit", "endroits"),
    "ページ": ("page", "pages", "page", "pages"),
}
DIGITS = dict(zip("〇一二三四五六七八九", range(10)))
UNITS = {"十": 10, "百": 100, "千": 1000}


def numeral_value(text: str) -> int | None:
    """三十 30, 五百 500, 三千 3000, 12 12; None where it is no number."""
    text = text.translate(str.maketrans("０１２３４５６７８９", "0123456789"))
    if text.isdigit():
        return int(text)
    total, big, digit = 0, 0, None
    for c in text:
        if c in DIGITS:
            digit = DIGITS[c]
        elif c in UNITS:
            total += (1 if digit is None else digit) * UNITS[c]
            digit = None
        elif c in ("万", "億"):
            big += (total + (digit or 0)) * (10_000 if c == "万" else 100_000_000)
            total, digit = 0, None
        else:
            return None
    return big + total + (digit or 0)


def counted(number: str, counter: str) -> tuple[str, str] | None:
    """A number and its counter glossed: ("30 minutes", "30 minutes"),
    何 asking how many (何度 "how many times") and 数 a few (数冊)."""
    if number == "何":
        if counter == "時":
            return ("what time", "quelle heure")
        if counter in ("歳", "才"):
            return ("how old", "quel âge")
        # 何年 is "what year" as often as "how many years": left alone.
        forms = COUNTERS.get(counter) if counter != "年" else None
        return (f"how many {forms[1]}", f"combien de {forms[3]}") if forms else None
    if number == "数":
        forms = COUNTERS.get(counter)
        return (f"several {forms[1]}", f"plusieurs {forms[3]}") if forms else None
    if counter == "時":
        n = numeral_value(number)
        return (f"{n} o'clock", f"{n} heure{'s' if n > 1 else ''}") if n is not None else None
    if counter in ("歳", "才"):
        n = numeral_value(number)
        return (f"{n} years old", f"{n} an{'s' if n > 1 else ''}") if n is not None else None
    forms = COUNTERS.get(counter)
    n = numeral_value(number)
    if not forms or n is None:
        return None
    en1, en, fr1, fr = forms
    return (f"{n} {en1 if n == 1 else en}", f"{n} {fr1 if n <= 1 else fr}")


def _counted_row(group: list[dict], after: dict | None) -> dict | None:
    gloss = counted(group[0]["surface"], group[1]["surface"])
    # 何度も, 何回も: "again and again", not a question.
    forms = COUNTERS.get(group[1]["surface"])
    if gloss and group[0]["surface"] == "何" and forms and (after or {}).get("surface") == "も":
        gloss = (f"many {forms[1]}", "maintes fois" if forms[3] == "fois" else f"beaucoup de {forms[3]}")
    if not gloss:
        return None
    row = _row(group)
    row.pop("lv", None)
    row["pos"] = "noun"
    row["en"], row["fr"] = [gloss[0]], [gloss[1]]
    return row


# ── Tokens a beginner reads as one word (plan 248) ──────────────────
# The analyser cuts a number written in parts (十|五年, which glossed 十 as
# "ten" beside 五年 "5 years"), でも opening a clause (で|も) and お or ご
# from the word they honour (お|ちゃ); each is joined back before the rows
# are made, in every source (お and ご were joined in the conversations only).
_DIGITS = re.compile(r"^[〇一二三四五六七八九十百千万億0-9０-９]+$")
_DEMO = next(({"entry": e, "level": lv} for lv, es in __import__("content.vocab_data", fromlist=["VOCAB_BY_LEVEL"]).VOCAB_BY_LEVEL.items()
              for e in es if e.get("kana") == "でも" and not e.get("kanji")), None)


def _joined(tokens: list[dict]) -> list[dict]:
    out: list[dict] = []
    for tok in tokens:
        prev = out[-1] if out else None
        if prev and _DIGITS.match(prev["surface"]) and _DIGITS.match(tok["surface"]):
            out[-1] = {**prev, "surface": prev["surface"] + tok["surface"], "end": tok.get("end"),
                       "reading": (prev.get("reading") or prev["surface"]) + (tok.get("reading") or tok["surface"]),
                       "furigana": (prev.get("furigana") or []) + (tok.get("furigana") or []),
                       "kanji_matches": (prev.get("kanji_matches") or []) + (tok.get("kanji_matches") or []),
                       # 十 is "ten", 十五 is not: a number in parts is left bare unless a counter glosses it.
                       "vocab_match": None}
            continue
        before = out[-2] if len(out) >= 2 else None
        if (prev and prev["surface"] == "で" and prev["pos"] == "particle" and tok["surface"] == "も" and tok["pos"] == "particle"
                and (before is None or before["pos"] in SKIP_POS)):
            out[-1] = {**prev, "surface": "でも", "reading": "でも", "lemma": "でも", "pos": "conjunction", "end": tok.get("end"),
                       "furigana": [{"text": "でも"}], "vocab_match": _DEMO, "grammar": []}
            continue
        if prev and prev["pos"] == "prefix" and prev["surface"] in ("お", "ご") and tok["pos"] in ("noun", "verb"):
            out[-1] = {**tok, "surface": prev["surface"] + tok["surface"], "start": prev.get("start"),
                       "reading": (prev.get("reading") or prev["surface"]) + (tok.get("reading") or tok["surface"]),
                       "furigana": (prev.get("furigana") or [{"text": prev["surface"]}]) + (tok.get("furigana") or [{"text": tok["surface"]}])}
            continue
        out.append(tok)
    return out


def rows_of(tokens: list[dict]) -> list[dict]:
    tokens = _joined(tokens)
    rows: list[dict] = []
    i = 0
    while i < len(tokens):
        tok = tokens[i]
        if tok["pos"] in SKIP_POS or not tok["surface"].strip():
            rows.append({"t": tok["surface"], "k": "punct"})
            i += 1
            continue
        if NUMERAL.match(tok["surface"]) and i + 1 < len(tokens):
            row = _counted_row(tokens[i:i + 2], tokens[i + 2] if i + 2 < len(tokens) else None)
            if row:
                rows.append(row)
                i += 2
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
    analysis = _analyze(row["jp"], level)
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
    # The sentence said the other way, Read it's bonus (plan 254).
    other = version(row["jp"], level, rows)
    if other:
        out["v"] = other
    return out


# ── 表記: how a word is written (plan 229c) ──────────────────────
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
        "en": _kanji_senses(entry.get("meaning", "")),
        "fr": _kanji_senses(get_kanji_meaning(char, "fr")),
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


# ── The rest of the app (plan 229b) ──────────────────────────────
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
    analysis = _analyze(jp, level)
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
    carousel (plan 229c); {} where the rival is not a catalogue point."""
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
    rule, its uses and the caution, the rival it is confused with, three examples
    (the rest as `ex_more`, for the long videos),
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
        if step.get("kind") in ("rule", "careful", "use") and step["kind"] not in out:
            out[step["kind"]] = _both(step)
    compare = (entry.get("compare") or [])[:1]
    if compare:
        out["compare"] = {"p": compare[0].get("pattern", ""), **_both(compare[0]), **_rival(compare[0].get("pattern", ""))}
    out["ex"] = [{"rows": text_rows(e["jp"], level, p), "en": e.get("en", ""), "fr": e.get("fr", "")}
                 for e in (entry.get("examples") or [])[:3]]
    # The examples past the carousel's three, for the long video's whole lesson (plan 233).
    more = [{"rows": text_rows(e["jp"], level, p), "en": e.get("en", ""), "fr": e.get("fr", "")}
            for e in (entry.get("examples") or [])[3:]]
    if more:
        out["ex_more"] = more
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
        for r in rows_of(_analyze(part, level)["tokens"]):
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
    word_files = {}
    for level in LEVELS:
        yield f"grammar-{level}.json", lessons(level)
        word_files[level] = words(level, index)
        yield f"words-{level}.json", word_files[level]
        yield f"kanji-{level}.json", kanji_cards(level, deck)
    yield "kanji-index.json", kanji_index(deck)
    kana = kana_cards()
    yield "kana.json", kana
    comprehension = passages()
    yield "comprehension.json", comprehension
    theme_file = themes()
    yield "themes.json", theme_file
    lookalike_file = lookalikes(deck)
    yield "lookalikes.json", lookalike_file
    scenes = conversation()
    yield "pictures.json", {**pictures(word_files, theme_file), "scenes": scene_pictures(scenes)}
    dialogue_file = with_scenes(dialogues(), scenes)
    yield "dialogues.json", dialogue_file
    yield "conversation.json", scenes
    yield "short.json", shorts()
    yield "promo.json", promo()
    trap_file = traps()
    yield "traps.json", trap_file
    yield "index.json", figures(sentences, kana, comprehension, {
        "themes": len(theme_file["themes"]),
        "themeWords": sum(len(t["words"]) for t in theme_file["themes"].values()),
        "lookalikes": len(lookalike_file["sets"]),
        "dialogues": len(dialogue_file["dialogues"]),
        "traps": len(trap_file["traps"]),
    })


# ── Four more modes (plan 229m) ───────────────────────────────────
# A theme's words with a picture each, lookalike kanji, a conversation to
# answer turn by turn and the traps the catalogue writes down. The theme
# words, the kanji and the traps are the app's own; the emoji, the
# lookalike sets and the conversations are the studio's, written by hand
# in frontend/carousel/content/ and checked by its tests.
CONTENT = BACKEND.parent / "frontend" / "carousel" / "content"
LOCALES = BACKEND.parent / "frontend" / "src" / "locales"


def _theme_names() -> dict:
    """Each theme's name in English and French, as the app shows it
    (t.themeFruits ...), read from the locale tables."""
    out: dict = {}
    for lang in ("en", "fr"):
        text = (LOCALES / lang / "index.js").read_text(encoding="utf-8")
        for key, value in re.findall(r"^\s*theme([A-Z][A-Za-z]*):\s*'((?:[^'\\]|\\.)*)'", text, re.M):
            out.setdefault(key, {})[lang] = value.replace("\\'", "'")
    return out


def themes() -> dict:
    """The themes a picture can be drawn for: each one's name, its heading
    word and its words, easiest first, each with the emoji it is drawn
    with where it has one (content/emoji.json)."""
    from content.theme_data import theme_entries

    pictures = json.loads((CONTENT / "emoji.json").read_text(encoding="utf-8"))
    names = _theme_names()
    out = {}
    for key, spec in pictures.items():
        name = names.get("".join(part.title() for part in key.split("_")), {})
        head_t, _, head_r = spec["head"].partition(" ")
        words = []
        seen = set()
        for e in theme_entries(key):
            written = e.get("kanji") or e.get("kana")
            if not written or written in seen:
                continue
            seen.add(written)
            kana = e.get("kana") or written
            w = {"t": written, "r": kana, "ro": to_romaji(kana), "band": e.get("theme_level"),
                 "en": _senses(e.get("meaning", ""), 2), "fr": _senses(e.get("meaning_fr", ""), 2)}
            if e.get("level"):
                w["lv"] = e["level"]
            emoji = spec["emoji"].get(e.get("meaning", ""))
            if emoji:
                w["e"] = emoji
            words.append(w)
        out[key] = {"name": {"en": name.get("en", key), "fr": name.get("fr", key)},
                    "head": {"t": head_t, "r": head_r or head_t}, "words": words}
    return {"rev": REV, "themes": out}


def pictures(word_files: dict, theme_file: dict) -> dict:
    """The words a vocabulary short turns over on a picture (plan 257):
    content/pictures/pictures.json, a word's key (written::kana) and its
    file beside it. A key no deck or theme word has, or a file that is
    not there, stops the build rather than leave a picture on no word."""
    spec = json.loads((CONTENT / "pictures" / "pictures.json").read_text(encoding="utf-8"))
    known = {f"{w['t']}::{w['r']}" for data in word_files.values() for w in data["words"]}
    known |= {f"{w['t']}::{w['r']}" for th in theme_file["themes"].values() for w in th["words"]}
    out = {}
    for key, name in spec.items():
        if key not in known:
            raise SystemExit(f"content/pictures/pictures.json: {key} is no deck or theme word")
        if not (CONTENT / "pictures" / name).is_file():
            raise SystemExit(f"content/pictures/pictures.json: {name} is not in content/pictures/")
        out[key] = f"content/pictures/{name}"
    return {"rev": REV, "pictures": out}


def scene_pictures(scenes_file: dict) -> dict:
    """A 会話 scene's pictures (plan 269): content/pictures/scenes/scenes.json,
    a scene's id and, for each of its turns, the picture shown while it
    is asked and the one shown once it is answered. A reply short of a
    pictured scene draws each turn over them. A scene the bank lacks, a
    turn without both, or a file that is not there stops the build: a
    video never shows one turn bare among pictured ones."""
    spec = json.loads((CONTENT / "pictures" / "scenes" / "scenes.json").read_text(encoding="utf-8"))
    turns = {sc["id"]: len(sc["turns"]) for sc in scenes_file["scenes"]}
    out = {}
    for sid, rows in spec.items():
        where = f"content/pictures/scenes/scenes.json: {sid}"
        if sid not in turns:
            raise SystemExit(f"{where} is no scene of the 会話 bank")
        if len(rows) != turns[sid]:
            raise SystemExit(f"{where} has {len(rows)} turns pictured of {turns[sid]}")
        out[sid] = []
        for row in rows:
            if set(row) != {"ask", "answer"}:
                raise SystemExit(f"{where}: a turn is pictured asked and answered, never one alone")
            for name in row.values():
                if not (CONTENT / "pictures" / "scenes" / name).is_file():
                    raise SystemExit(f"{where}: {name} is not in content/pictures/scenes/")
            out[sid].append({k: f"content/pictures/scenes/{row[k]}" for k in ("ask", "answer")})
    return out


def lookalikes(deck: dict) -> dict:
    """The lookalike sets (content/lookalikes.json), each kanji with what
    tells it apart, its meanings, its readings and a deck word that
    writes it: the easiest one a learner at the set's level can read."""
    from content.vocab_data import VOCAB_BY_LEVEL
    from translations import fr_gloss
    from translations.fr.vocab_fr import VOCAB_FR

    # Every deck word of up to four characters that writes a kanji (お父さん
    # is four), the deck's easiest first.
    words_of: dict = {}
    for lv in LEVELS:
        for e in VOCAB_BY_LEVEL.get(lv, []):
            written = e["kanji"]
            if len(written) > 4:
                continue
            for c in dict.fromkeys(written):
                if c in DECK_BY_CHAR and written != c:
                    words_of.setdefault(c, []).append((lv, e))

    def readable(written: str, rank: int) -> bool:
        """Every kanji of the word is a deck kanji at or below the level."""
        return all(ch == "々" or not _KANJI_CHAR.match(ch)
                   or (ch in DECK_BY_CHAR and LEVELS.index(DECK_BY_CHAR[ch][0]) <= rank)
                   for ch in written)

    def example(c: str, rank: int, used: set, pin) -> dict | None:
        """A word at or below the set's level written with kanji at or
        below it; else any word written with kanji at or below it; else
        none, never 目標 in an N4 set. Within a tier, a word no other kanji
        of the set shows yet comes first. `pin` is the set's own choice (a
        word, or None for no word)."""
        found = words_of.get(c, [])
        if pin is not False:
            if pin is None:
                return None
            found = [x for x in found if x[1]["kanji"] == pin]
            if not found:
                raise SystemExit(f"lookalikes.json: {pin} is no deck word that writes {c}")
        else:
            ok = [x for x in found if readable(x[1]["kanji"], rank)]
            for tier in ([x for x in ok if LEVELS.index(x[0]) <= rank], ok):
                if tier:
                    found = [next((x for x in tier if x[1]["kanji"] not in used), tier[0])]
                    break
            else:
                return None
        e = found[0][1]
        kana = (e.get("kana") or "").split("/")[0]
        w = {"t": e["kanji"], "r": kana, "en": _senses(e.get("meaning", ""), 1)}
        fr = _senses(fr_gloss(e, VOCAB_FR) or "", 1)
        if fr:
            w["fr"] = fr
        return w

    sets = []
    for spec in json.loads((CONTENT / "lookalikes.json").read_text(encoding="utf-8")):
        chars = []
        for ch in spec["chars"]:
            c = ch["c"]
            if c not in DECK_BY_CHAR:
                raise SystemExit(f"lookalikes.json: {c} is no deck kanji")
            card = kanji_entry(c, deck)
            card.pop("s", None)
            card.update({"c": c, "note": {"en": ch["en"], "fr": ch["fr"]}})
            # The sense the set is about, where the dictionary's first is
            # another (校 is “exam” before it is “school”).
            if "m" in ch:
                card["en"], card["fr"] = ch["m"]["en"], ch["m"]["fr"]
            chars.append(card)
        level = max((card["lv"] for card in chars), key=LEVELS.index)
        rank = LEVELS.index(level)
        used: set = set()
        for card, ch in zip(chars, spec["chars"]):
            # "w" pins the word (a deck word that writes the kanji), or
            # null for none, where the rule's choice reads badly (流石).
            w = example(card["c"], rank, used, ch.get("w", False))
            if w:
                card["word"] = w
                used.add(w["t"])
        sets.append({"id": spec["id"], "lv": level, "chars": chars})
    return {"rev": REV, "sets": sets}


def _honorific(rows: list[list]) -> list[list]:
    """お and ご joined to the word they honour (ご予約, お飲み物): a line
    never breaks between them, and a beginner reads them as one word."""
    out = []
    for row in rows:
        prev = out[-1] if out else None
        if prev and len(prev) >= 3 and prev[0] in ("お", "ご") and len(row) >= 3 and row[1] in ("w", "v"):
            fu = ([[prev[0], ""]] + row[3]) if len(row) > 3 and row[3] else 0
            merged = [prev[0] + row[0], row[1], prev[2] + row[2], fu] + row[4:]
            while merged[-1] == 0:
                merged.pop()
            out[-1] = merged
            continue
        out.append(row)
    return out


# Where the analyser reads a conversation's word wrong (plan 229n), the
# words as they are read: a run of rows, and the rows it becomes.
_DIALOGUE_READINGS = [
    (["船便"], [["船便", "w", "funabin", [["船", "ふな"], ["便", "びん"]]]]),
    (["御", "社"], [["御社", "w", "onsha", [["御", "おん"], ["社", "しゃ"]]]]),
    (["担当", "の", "方"], [None, None, ["方", "w", "kata", [["方", "かた"]]]]),
    # 何とか, "somehow", is one word; before なった the analyser reads かなった as 叶った.
    (["何", "と", "かなった"], [["何とか", "w", "nantoka", [["何", "なん"], ["とか", ""]]], ["なった", "v", "natta"]]),
    (["何", "と", "か"], [["何とか", "w", "nantoka", [["何", "なん"], ["とか", ""]]]]),
]


def _reread(rows: list[list]) -> list[list]:
    """A line's rows with the analyser's misreadings set right; None in a
    replacement keeps that row as it was read."""
    out = list(rows)
    for texts, repl in _DIALOGUE_READINGS:
        n = len(texts)
        i = 0
        while i + n <= len(out):
            if [r[0] for r in out[i:i + n]] != texts:
                i += 1
                continue
            new = [out[i + k] if x is None else x for k, x in enumerate(repl)]
            out[i:i + n] = new
            i += len(new)
    return out


def dialogues() -> dict:
    """The conversations (content/dialogues.json), each line cut into
    words with its furigana and romaji, for a beginner to read."""
    out = []
    for d in json.loads((CONTENT / "dialogues.json").read_text(encoding="utf-8")):
        turns = []
        for t in d["turns"]:
            turns.append({
                "them": {"rows": _reread(_honorific(text_rows(t["them"]["jp"], d["lv"]))), "en": t["them"]["en"], "fr": t["them"]["fr"]},
                "choices": [_reread(_honorific(text_rows(c, d["lv"]))) for c in t["choices"]],
                "right": t["right"], "reply": t["reply"], "why": t["why"],
            })
        out.append({"id": d["id"], "lv": d["lv"], "place": d["place"], "them": d["them"], "turns": turns})
    return {"rev": REV, "dialogues": out}


def with_scenes(dialogue_file: dict, scenes: dict) -> dict:
    """The carousel's conversations and the 会話 station's scenes, the
    ones its reply videos ask (plan 268), as one list a carousel answers:
    level by level, the hand-written ones first. A scene keeps its turns
    as the station has them, its id marked as the station's (kaiwa-…,
    clear of a hand-written id) and `kaiwa` set."""
    station = [{**sc, "id": f"kaiwa-{sc['id']}", "kaiwa": True} for sc in scenes["scenes"]]
    both = dialogue_file["dialogues"] + station
    both.sort(key=lambda d: LEVELS.index(d["lv"]))
    return {**dialogue_file, "dialogues": both}


# ── The other register, and Read it's own sentences (plan 254) ────
# Read it's bonus is the sentence said the other way: politely where it
# is plain (頭が痛い → 頭が痛いです), plainly where it is polite. The
# other way is never written here: it is plain_polite.other_register's,
# the module Construire judges a typed answer by (plan 241), which reads
# a sentence's closing ending both ways and refuses everything else (a
# clause inside, a question, a polite-only verb).
_CLOSE = "。！？!?"


def _kana(row: dict) -> str:
    return "".join(r or t for t, r in row.get("fu") or [[row["t"], ""]])


def version(jp: str, level: str, rows: list[dict]) -> dict | None:
    """The sentence in its other register: its rows, the register it is
    in, and the words that changed, written and in kana ([] where only
    です is added or dropped); None where the ending reads one way only."""
    from study.morphology import kata_to_hira, tokenize
    from study.plain_polite import other_register

    body = jp.rstrip(_CLOSE)
    tokens = tokenize(body)
    if not tokens:
        return None
    reading = "".join(kata_to_hira(t.reading or t.surface) for t in tokens)
    swapped = other_register(jp, 0, len(body), reading)
    if not swapped:
        return None
    register, forms = swapped
    other = forms[0][0] + jp[len(body):]
    them = rows_of(_analyze(other, level)["tokens"])
    a = [r for r in rows if r["k"] != "punct"]
    b = [r for r in them if r["k"] != "punct"]
    if "".join(_kana(r) for r in b) == "".join(_kana(r) for r in a):
        return None
    # What changed, the words both share either side of it left out (安いですよ → 安いよ drops です).
    k = 0
    while k < min(len(a), len(b)) and a[k]["t"] == b[k]["t"]:
        k += 1
    n = 0
    while n < min(len(a), len(b)) - k and a[-1 - n]["t"] == b[-1 - n]["t"]:
        n += 1

    def said(part: list[dict]) -> list[str]:
        return ["".join(r["t"] for r in part), "".join(_kana(r) for r in part)]

    return {"to": "plain" if register == "polite" else "polite", "rows": them,
            "from": said(a[k:len(a) - n]), "into": said(b[k:len(b) - n])}


_PAREN = re.compile(r"\s*\([^)]*\)")


def _glosses(sense: str) -> list[str]:
    """A sense cut at its commas, never inside its brackets."""
    out, depth, cur = [], 0, ""
    for ch in sense:
        depth += ch == "("
        depth -= ch == ")"
        if ch == "," and not depth:
            out.append(cur.strip())
            cur = ""
        else:
            cur += ch
    return [g for g in out + [cur.strip()] if g]


def _card_gloss(senses: list[str], pick: str | None) -> list[str]:
    """[what the word says here, the rest of that sense]: the deck's own
    words, never written here. `pick` names the deck's gloss the sentence
    means (電車, "electric train", is a "train"); else its first."""
    sense = next((s for s in senses if pick and pick.lower() in s.lower()), senses[0] if senses else "")
    glosses = _glosses(sense)
    main = pick or (_PAREN.sub("", glosses[0]).strip() if glosses else "")
    rest = []
    for g in glosses:
        g = _PAREN.sub("", g).strip()
        if g and main.lower() not in g.lower() and g not in rest:
            rest.append(g)
    # One more where the sentence picked its sense: the rest is another sense's.
    return [main, ", ".join(rest[:1 if pick else 2])]


def shorts() -> dict:
    """Read it's own sentences (content/short.json): a noun, a particle
    and a verb or adjective, each word an N5 deck word glossed from the
    deck, the particle's role written beside it, and the sentence said
    politely."""
    out = []
    for x in json.loads((CONTENT / "short.json").read_text(encoding="utf-8")):
        name = f"short.json: {x['id']}"
        rows = rows_of(_analyze(x["jp"], "N5")["tokens"])
        words = [r for r in rows if r["k"] != "punct"]
        if len(words) != 3 or [r["k"] for r in words] != ["word", "particle", "word"]:
            raise SystemExit(f"{name} is not a noun, a particle and a verb or adjective: {[r['t'] for r in words]}")
        picks = x.get("sense") or {}
        for t in picks:
            if t not in (words[0]["t"], words[2]["t"]):
                raise SystemExit(f"{name}: {t} is no word of the sentence")
        for r in (words[0], words[2]):
            if r.get("lv") != "N5" or r.get("pool"):
                raise SystemExit(f"{name}: {r['t']} is no N5 deck word")
            pick = picks.get(r["t"], {})
            for lang in ("en", "fr"):
                if pick.get(lang) and not any(pick[lang].lower() in s.lower() for s in r.get(lang) or []):
                    raise SystemExit(f"{name}: “{pick[lang]}” is not among {r['t']}'s glosses: {r.get(lang)}")
                r[f"g{lang}"] = _card_gloss(r.get(lang) or [], pick.get(lang))
        for lang in ("en", "fr"):
            words[1][f"g{lang}"] = x["role"][lang]
        polite = version(x["jp"], "N5", rows)
        if not polite or polite["to"] != "polite":
            raise SystemExit(f"{name}: no polite version of a plain sentence")
        polite["when"] = x["when"]
        entry = {"id": x["id"], "lv": "N5", "jp": x["jp"], "e": x["e"], "en": x["en"], "fr": x["fr"], "rows": rows, "v": polite}
        if x.get("lit"):
            entry["lit"] = x["lit"]
        out.append(entry)
    if len({e["id"] for e in out}) != len(out):
        raise SystemExit("short.json: an id twice")
    return {"rev": REV, "sentences": out}


# ── The station's own conversations (plan 250) ────────────────────
# The reply videos ask the 会話 station's scenes (content/conversation),
# six turns each: each line cut into words as the studio's conversations
# are, its readings held to the hand-written kana the app teaches.
CONVERSATION = BACKEND / "content" / "conversation"
_MARKS = set("、。？！…・「」『』（）")


def _said(rows: list[list]) -> str:
    """What a line's rows read: each word's furigana, or its text."""
    out = []
    for row in rows:
        if len(row) > 3 and row[3]:
            out.append("".join(r or t for t, r in row[3]))
        else:
            out.append(row[0])
    return "".join(c for c in "".join(out) if c not in _MARKS)


def _by_kana(rows: list[list], line: dict) -> list[list]:
    """The rows read as the bank reads the line: each word's furigana
    taken from the line's own kana (align_deck, the app's furigana), never
    the cut's guess (何時 is なんじ, 十分 じゅっぷん, 入れます はいれます here).
    Words a reading runs across are joined into one; a word's romaji is
    made again from its reading only where that reading changed."""
    from study.furigana import align_deck
    from study.romaji import to_romaji

    jp = line["jp"]
    parts = align_deck(jp, line["kana"])
    if "".join(p["text"] for p in parts) != jp or "".join(r[0] for r in rows) != jp:
        return rows
    spans, at = [], 0
    for p in parts:
        spans.append((at, at + len(p["text"]), p["text"], p.get("reading")))
        at += len(p["text"])
    bounds, at = [], 0
    for r in rows:
        bounds.append((at, at + len(r[0])))
        at += len(r[0])
    groups: list[list[int]] = []
    for i, (start, _) in enumerate(bounds):
        crossed = any(a < start < b and reading for a, b, _, reading in spans)
        if groups and crossed:
            groups[-1].append(i)
        else:
            groups.append([i])
    out = []
    for g in groups:
        first = rows[g[0]]
        if len(g) == 1 and len(first) == 1:
            out.append(first)
            continue
        start, end = bounds[g[0]][0], bounds[g[-1]][1]
        fu = []
        for a, b, text, reading in spans:
            lo, hi = max(a, start), min(b, end)
            if lo < hi:
                fu.append([text, reading] if reading else [jp[lo:hi], ""])
        said = "".join(r or t for t, r in fu)
        was = "".join(_said([rows[i]]) for i in g)
        ro = first[2] if len(g) == 1 and said == was else to_romaji(said)
        row = [jp[start:end], first[1], ro, fu if any(r for _, r in fu) else 0]
        while row[-1] == 0:
            row.pop()
        out.append(row)
    return out


def conversation_rows(line: dict, level: str, where: str, misread: list[str]) -> list[list]:
    """A line's rows; where they still read it otherwise than its kana, the
    line is reported, never shipped with a reading the app does not teach."""
    rows = _by_kana(_reread(_honorific(text_rows(line["jp"], level))), line)
    kana = "".join(c for c in line["kana"] if c not in _MARKS)
    if _said(rows) != kana:
        misread.append(f"{where}: {line['jp']} reads {_said(rows)}, the bank says {kana}")
    return rows


def conversation() -> dict:
    """The station's scenes as a reply video asks them: the place (its
    title as the name it goes by), who speaks, and each turn's line, the
    three replies (the right one first, the video deals them), what the
    right one means and why it is right."""
    out = []
    misread: list[str] = []
    for level in LEVELS:
        for sc in json.loads((CONVERSATION / f"{level}.json").read_text(encoding="utf-8")):
            turns = []
            for n, t in enumerate(sc["turns"], 1):
                where = f"{sc['id']} turn {n}"
                turns.append({
                    "them": {"rows": conversation_rows(t["them"], level, f"{where} them", misread), "en": t["them"]["en"], "fr": t["them"]["fr"]},
                    "choices": [conversation_rows(r, level, f"{where} reply {k}", misread) for k, r in enumerate([t["me"], *t["wrong"]])],
                    "right": 0,
                    "reply": {"en": t["me"]["en"], "fr": t["me"]["fr"]},
                    "why": {"en": t["me"]["note"]["en"], "fr": t["me"]["note"]["fr"]},
                })
            out.append({
                "id": sc["id"], "lv": level,
                "place": {"jp": sc["place"]["jp"], "en": sc["title"]["en"], "fr": sc["title"]["fr"]},
                "them": sc["them"], "turns": turns,
            })
    if misread:
        raise SystemExit("the cut reads these lines otherwise than the bank:\n  " + "\n  ".join(misread))
    return {"rev": REV, "scenes": out}


def traps() -> dict:
    """The catalogue's traps: every tour twist set against a rival (kind
    "trap"), its sentence cut into words, its question, its three
    readings (the right one first), its why, and the point's own
    “careful” step."""
    from content.grammar_points_data import find as find_point

    out = []
    for level in LEVELS:
        for pt in json.loads((BACKEND / "content" / "grammar" / f"{level}.json").read_text(encoding="utf-8")):
            careful = next((s for s in pt.get("steps", []) if s.get("kind") == "careful"), None)
            for i, tw in enumerate((pt.get("tour") or {}).get("twists") or []):
                if tw.get("kind") != "trap" or len(tw.get("choices") or []) < 3:
                    continue
                trap = {
                    "id": f"{level}-{pt['pattern']}-{i}", "p": pt["pattern"], "lv": level,
                    "notion": tw["notion"], "rows": text_rows(tw["jp"], level, pt["pattern"]),
                    "tr": tw["tr"], "ask": tw["ask"], "choices": tw["choices"][:3], "why": tw["why"],
                }
                if tw.get("pair"):
                    trap["pair"] = tw["pair"]
                if careful:
                    trap["careful"] = {"en": careful["en"], "fr": careful["fr"]}
                out.append(trap)
    return {"rev": REV, "traps": out}


def figures(sentences: dict, kana: dict, comprehension: dict, extra: dict | None = None) -> dict:
    """What a carousel's last slide may say about each line of the app
    (plan 229c): how many sentences, points, words, kanji and kana it
    teaches, counted from the content itself, never written by hand."""
    from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL
    from content.kana_data import get_all_kana
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
        # The promo stories (plan 231): each level's three decks, the kana
        # deck whole and the N5 mock exam, as the landing page counts them
        # (frontend/landing/content.mjs) for "how long to N5?".
        "levels": {lv: {"words": len(VOCAB_BY_LEVEL.get(lv, [])), "kanji": len(KANJI_BY_LEVEL.get(lv, [])),
                        "grammar": len(GRAMMAR_POINTS_BY_LEVEL.get(lv, []))} for lv in LEVELS},
        "kanaDeck": len(get_all_kana()),
        "examN5": _exam_n5(),
        **(extra or {}),
    }}


def _exam_n5() -> dict:
    """The N5 mock exam: its questions, its minutes, its pass mark out of its total."""
    from study.exam_blueprint import LEVEL_BLUEPRINT, PASS_THRESHOLDS

    sections = LEVEL_BLUEPRINT["N5"]["sections"]
    return {"questions": sum(m["count"] for s in sections for m in s["mondai"]),
            "minutes": sum(s["timeLimitMin"] for s in sections),
            "pass": PASS_THRESHOLDS["N5"]["total_min"], "max": PASS_THRESHOLDS["N5"]["total_max"]}


# ── 宣伝 — the practice features' videos (plan 270) ─────────────────
# Each feature's video is the app itself, run in a browser with its API
# answered from here (frontend/carousel/long/record.mjs). The answers are
# the backend's own, made by the functions its routes call, for the
# banks' own content: what the screen shows is what the app would say.
# A model's answer (a tutor's review) is the one part written by hand,
# in the shape the tutor returns (frontend/carousel/content/promo.json).
PROMO_AT = "2026-10-01T09:00:00+00:00"


def _promo_analysis(text: str) -> dict:
    """POST /api/phrase/analyze, save=false, deep=false, for one sentence:
    the local tier, with no learner state (routes/phrase._analyze_passage)."""
    from study.analysis import attach_user_state

    only = attach_user_state(analyze_local(text), {}, "promo")
    return {
        "passage": text, "sentences": [only], "truncated": 0,
        "explanation": only.get("explanation", ""), "translation": only.get("translation", ""),
        "words": only["tokens"], "tokens": only["tokens"], "grammar": only["grammar"],
        "level": only["level"], "grade": only.get("grade"), "available": only["available"],
        "unknown_count": only.get("unknown_count"), "off_deck_count": only.get("off_deck_count"),
        "id": None, "created_at": None,
    }


def _promo_fare(quality: int) -> dict:
    """A practice answer's fare (SRSEngine.award_practice): the base rate
    of its quality, no bonus."""
    from srs.xp import BASE_XP_BY_QUALITY

    return {"xp_earned": BASE_XP_BY_QUALITY.get(quality, 0), "leveled_up": False, "new_level": None, "correct": quality >= 3}


def _promo_boot(level: str) -> dict:
    """What the shell asks for before any screen: a learner who boarded,
    rode the first ride and saw every gate's guide (else the boarding or
    a guide would stand over the screen), on the free plan's credits."""
    from datetime import datetime

    from core import credits

    clock = datetime.fromisoformat(PROMO_AT)
    seen = "2026-09-01T09:06:00+00:00"
    return {
        "GET /api/profile": {
            "username": "Tsuji", "cardName": None, "level": 4, "xp": 420, "xpPrevLevel": 300, "xpForNext": 600,
            "jlptLevel": level, "dailyNewTarget": 10, "onboardedAt": "2026-09-01T09:00:00+00:00",
            "ratingScale": "simple", "readingPace": "standard", "motive": None, "kanaKnown": None,
            "reminderTime": None, "notifications": False, "lines": None, "tutorialAt": "2026-09-01T09:05:00+00:00",
            "guided": {k: seen for k in ("learn", "practice", "today", "dictionary", "profile")},
            "transferOffer": False, "analyticsOff": True, "boardHidden": False, "streak": 3, "streakLongest": 5,
            "totalReviews": 120, "bestQualityStreak": 8, "retention": 0.88, "week": [], "calendar": [], "tickets": [],
            "restHeld": 0, "nextMilestone": 7,
        },
        "GET /api/credits": credits._summary_of({"unlimited": False, "balance": 42, "pending": 0, "clock": clock, "plan": "free"}),
        "GET /api/today": {"total": 0},
    }


def _promo_ask(spec: dict, lang: str) -> dict:
    """POST /api/ask, for the one question a feature's video asks (plan
    273): answered as routes/ask.post_ask answers, its words written by
    hand in content/promo.json (`ask`), as its model is told to write
    them. A feature that asks nothing has no mock."""
    ask = spec.get("ask")
    return {"POST /api/ask": {"answer": ask[lang], "off_topic": False, "left": 39}} if ask else {}


def _promo_dictionary(spec: dict, lang: str, level: str) -> dict:
    """GET /api/dictionary for the entries a video opens (plan 274): the
    word and the grammar point, each as routes/dictionary.get_dictionary
    answers a learner who has studied neither, keyed by the category the
    client asks for (record.mjs matches a key's query parameters)."""
    want = spec.get("dictionary")
    if not want:
        return {}
    import sys
    import types
    from unittest import mock

    from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL, grammar_to_id

    # The route reads a learner's card states; a learner who has none, so
    # no database is opened for them.
    nobody = types.SimpleNamespace(get_user_states=lambda _u: {}, get_states_for=lambda _ids, _modes: {})
    with mock.patch.dict(sys.modules, {"core.srs_instance": sys.modules.get("core.srs_instance") or types.SimpleNamespace(srs=nobody)}):
        import routes.dictionary as dictionary
    entry = next((e for e in GRAMMAR_POINTS_BY_LEVEL[level] if e["pattern"] == want["point"]), None)
    if entry is None:
        raise SystemExit(f"content/promo.json: {want['point']} is no {level} point")
    raw_id = grammar_to_id(entry, level)
    term, kana = want["word"]
    common = {"page": 0, "limit": 50, "lang": lang, "radical": None, "level": None, "match": "word", "field": "all", "user_id": "promo"}
    with mock.patch.object(dictionary, "srs", nobody):
        word = dictionary.get_dictionary(q=term, category="vocab", kana=kana, id="", one=True, **common)
        point = dictionary.get_dictionary(q="", category="grammar", kana="", id=raw_id, one=False, **common)
    if not word["results"] or (word["results"][0]["kanji"], word["results"][0]["kana"]) != (term, kana):
        raise SystemExit(f"content/promo.json: {term} ({kana}) is no dictionary word")
    if not point["results"] or point["results"][0].get("id", point["results"][0].get("raw_id")) != raw_id:
        raise SystemExit(f"content/promo.json: {want['point']} did not come first in the grammar dictionary")
    return {"GET /api/dictionary?category=vocab": word, "GET /api/dictionary?category=grammar": point}


def _promo_spec() -> dict:
    """frontend/carousel/content/promo.json: each feature's sentence, the
    answer typed and the tutor's raw replies (plan 270)."""
    return json.loads((CONTENT / "promo.json").read_text(encoding="utf-8"))


def _reading_constants(*names: str) -> dict:
    """Constants of routes/reading.py, read from its source (the route
    opens the database on import)."""
    import ast

    tree = ast.parse((BACKEND / "routes" / "reading.py").read_text(encoding="utf-8"))
    v = {n.targets[0].id: ast.literal_eval(n.value) for n in tree.body
         if isinstance(n, ast.Assign) and len(n.targets) == 1 and isinstance(n.targets[0], ast.Name) and n.targets[0].id in names}
    if set(v) != set(names):
        raise SystemExit(f"routes/reading.py: {', '.join(sorted(set(names) - set(v)))} moved")
    return v


def _reading_clock():
    """routes/reading._display_seconds, from its four numbers."""
    v = _reading_constants("BASE_SECONDS", "SECONDS_PER_CHAR", "MIN_DISPLAY_SECONDS", "MAX_DISPLAY_SECONDS")
    return lambda jp: max(v["MIN_DISPLAY_SECONDS"], min(v["MAX_DISPLAY_SECONDS"], round(v["BASE_SECONDS"] + v["SECONDS_PER_CHAR"] * len(jp), 1)))


def _promo_phrase(jp: str, level: str, lang: str) -> dict:
    """A reading-bank row as the reading and translation batches serve it
    (routes/reading._finish_phrase, a curated row's arguments)."""
    from content import reading_sentences as rs
    from content.grammar_points_data import id_for
    from study.furigana import align_sentence
    from study.romaji import sentence_romaji, sentence_words

    row = next((r for r in rs.BY_LEVEL[level] if r["jp"] == jp), None)
    if row is None:
        raise SystemExit(f"content/promo.json: {jp} is no {level} row of the reading bank")
    text, text_lang = rs.translation(row, lang)
    return {
        "phrase": jp, "romaji": sentence_romaji(jp), "furigana": align_sentence(jp), "words": sentence_words(jp),
        "translation": text, "translation_lang": text_lang, "display_seconds": _reading_clock()(jp),
        "key": rs.phrase_key(jp), "source_word": {"kanji": row["focus"], "kana": "", "level": level},
        "grammar": row["grammar"], "grammar_id": id_for(row["grammar"]),
    }


def _promo_review(reply: dict, answer: str) -> dict:
    """The tutor's raw reply as the route serves it (study/tutor_review):
    parsed, its corrected sentence in parts with its romaji, as text."""
    from study import tutor_review

    review = tutor_review.parse_review(json.dumps(reply, ensure_ascii=False))
    if review is None:
        raise SystemExit("content/promo.json: a reply is not the tutor's shape")
    review.pop("japanese", None)
    if review["better"]:
        review.update(tutor_review.corrected(review["better"], answer))
    return {"review": review, "analysis": tutor_review.review_as_text(review)}


def _promo_dictation(spec: dict, lang: str) -> dict:
    """書取: a line of the bank heard twice, written with a slip, and
    marked as /api/dictation/check marks it."""
    from content.listening_clips import all_clips
    from study import dictation

    row = next((r for r in all_clips() if r["jp"] == spec["line"]), None)
    if row is None:
        raise SystemExit(f"content/promo.json: {spec['line']} is no line of the dictation bank")
    cid = dictation.clip_id(row["jp"])
    answer = spec["answer"]
    return {
        "level": row["level"], "line": row["jp"], "answer": answer,
        "mocks": {
            "GET /api/dictation/batch": {"level": row["level"], "max_plays": dictation.MAX_PLAYS, "clips": [{"id": cid, "level": row["level"], "audioSrc": dictation.clip_url(row["jp"])}]},
            "POST /api/dictation/check": {"id": cid, "level": row["level"], **dictation.reveal(row, lang), **dictation.measure(answer, row)},
            "POST /api/phrase/analyze": _promo_analysis(row["jp"]),
            "POST /api/dictation/result": _promo_fare(3),
        },
    }


def _promo_reading(spec: dict, lang: str) -> dict:
    """読書: a sentence of the reading bank, read against the clock, its
    reading typed, measured as /api/reading/check measures it."""
    from study.dictation import measure_forms

    phrase = _promo_phrase(spec["phrase"], spec["level"], lang)
    return {
        "level": spec["level"], "line": phrase["phrase"], "answer": spec["answer"],
        "mocks": {
            "GET /api/reading/batch": {"source": "level", "level": spec["level"], "domain": None, "tier": None, "phrases": [phrase]},
            "POST /api/reading/check": measure_forms(spec["answer"], jp=phrase["phrase"], romaji=phrase["romaji"]),
            "POST /api/phrase/analyze": _promo_analysis(phrase["phrase"]),
            "POST /api/reading/result": _promo_fare(4),
        },
    }


def _promo_translation(spec: dict, lang: str) -> dict:
    """翻訳: a reading-bank sentence to put into Japanese, the learner's
    attempt with a slip, and the tutor's read on it."""
    phrase = _promo_phrase(spec["phrase"], spec["level"], lang)
    return {
        "level": spec["level"], "line": phrase["phrase"], "answer": spec["answer"],
        "mocks": {
            "GET /api/translation/batch": {"source": "level", "level": spec["level"], "domain": None, "tier": None, "phrases": [phrase]},
            "POST /api/translation/analyze": _promo_review(spec["reply"][lang], spec["answer"]),
            "POST /api/phrase/analyze": _promo_analysis(phrase["phrase"]),
            "POST /api/translation/result": {**_promo_fare(3), "scheduled": None},
        },
    }


def _promo_composition(spec: dict, lang: str) -> dict:
    """作文: a point of the level, a sentence written with it, the
    detector's word and the tutor's (routes/composition)."""
    from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL, gloss, grammar_to_id
    from study import grammar_detect
    from study.grammar_examples import structure_text

    level = spec["level"]
    entry = next((e for e in GRAMMAR_POINTS_BY_LEVEL[level] if e["pattern"] == spec["point"]), None)
    if entry is None:
        raise SystemExit(f"content/promo.json: {spec['point']} is no {level} point")
    raw_id = grammar_to_id(entry, level)
    sentence = spec["answer"]
    found = any((h["pattern"], h["level"]) == (entry["pattern"], level) for h in grammar_detect.hits(sentence)) if grammar_detect.can_find(entry["pattern"]) else None
    review = _promo_review(spec["reply"][lang], sentence)
    # The lesson behind the point, as routes/grammar.get_grammar_point
    # serves it (plan 273), at the stage the batch below serves the point.
    from study.card_lookup import GRAMMAR_STATUS_MODES, card_stats
    from study.grammar_lesson import lesson_payload
    from study.grammar_tour import tour_payload

    lesson = {
        "raw_id": raw_id, "level": level, "pattern": entry["pattern"], "structure": structure_text(entry, lang), "meaning": gloss(entry, lang),
        # The tour without its quiz, which the sheet never opens and which
        # tour_payload deals differently from one process to the next.
        **lesson_payload(level, entry, lang), "tour": {**tour_payload(level, entry, lang), "quiz": []}, "tour_record": None,
        "status": {**card_stats({}, "promo", raw_id, GRAMMAR_STATUS_MODES), "status": "learning"},
    }
    return {
        "level": level, "line": sentence, "answer": sentence, "point": entry["pattern"],
        "mocks": {
            "GET /api/grammar/point": lesson,
            "GET /api/composition/batch": {"level": level, "points": [{"raw_id": raw_id, "level": level, "pattern": entry["pattern"], "structure": structure_text(entry, lang), "meaning": gloss(entry, lang), "register": entry.get("register"), "stage": "learning"}]},
            "POST /api/composition/check": {"found": found, "japanese": None},
            "POST /api/composition/review": {**review, "japanese": None, "found": found},
            "POST /api/phrase/analyze": _promo_analysis(sentence),
            "POST /api/composition/result": _promo_fare(3),
        },
    }


def _promo_comprehension(spec: dict, lang: str) -> dict:
    """理解: a seed passage served as GET /api/reading/comprehension
    serves it (comprehension_seed.render, its answers dealt by
    balance_answers, each sentence analysed), and the result of the
    answers the video gives: every one right but the `wrong` one."""
    import random

    from content import comprehension_seed
    from study.analysis import analyze_with_glosses, attach_user_state
    from study.answer_balance import balance_answers

    level = spec["level"]
    entry = next((e for e in comprehension_seed.by_level().get(level, []) if e["id"] == spec["seed"]), None)
    if entry is None:
        raise SystemExit(f"content/promo.json: {spec['seed']} is no {level} comprehension seed")
    data = comprehension_seed.render(entry, lang)
    # Dealt once, from the seed's id: the video answers the order it was served.
    balance_answers(data["questions"], random.Random(spec["seed"]))
    for part in data["breakdown"]:
        part["analysis"] = attach_user_state(analyze_with_glosses(part["jp"], part.pop("words", None), level), {}, "promo")
    v = _reading_constants("COMPREHENSION_SPECS", "READ_SECONDS_BY_LEVEL")
    qs = data["questions"]
    answers = [q["correct"] if i != spec["wrong"] else (q["correct"] + 1) % len(q["options"]) for i, q in enumerate(qs)]
    right = [a == q["correct"] for q, a in zip(qs, answers)]
    from srs.xp import BASE_XP_BY_QUALITY

    # The sentence the missed question is about, its breakdown opened (plan 273).
    sentence = spec.get("sentence", 0)
    if not 0 <= sentence < len(data["breakdown"]):
        raise SystemExit(f"content/promo.json: comprehension's sentence {sentence} is not one of the text's")
    return {
        "level": level, "line": data["text"], "answers": answers, "wrong": spec["wrong"], "sentence": sentence,
        # The word (by its reading) and the point the video opens in the dictionary (plan 274).
        "word": spec["dictionary"]["word"][1], "point": spec["dictionary"]["point"],
        "mocks": {
            **_promo_dictionary(spec, lang, level),
            "GET /api/reading/comprehension": {
                "level": level, "text": data["text"], "translation": data["translation"], "breakdown": data["breakdown"],
                "questions": qs, "grammar_points": data["grammar_points"], "read_seconds": v["READ_SECONDS_BY_LEVEL"][level],
                "question_count": v["COMPREHENSION_SPECS"][level]["questions"], "repeat": False,
            },
            "POST /api/reading/comprehension/result": {
                "xp_earned": sum(BASE_XP_BY_QUALITY.get(4 if ok else 1, 0) for ok in right), "leveled_up": False, "new_level": None,
                "id": 1, "score": sum(right), "total": len(qs), "created_at": PROMO_AT,
                "results": [{"type": q.get("type", "comprehension"), "question": q["question"], "options": q["options"], "correct": q["correct"], "user_answer": a, "is_correct": ok}
                            for q, a, ok in zip(qs, answers, right)],
            },
        },
    }


def _promo_exam(spec: dict, lang: str) -> dict:
    """模試: the catalogue as list_exams lists it for a learner who has sat
    nothing (each exam id's first seed paper, at revision 1), the paper
    opened, and the attempt scored by study/exam_scoring as the route
    scores it: every answer right but the `wrong` ones."""
    from study import exam_seed
    from study.exam_blueprint import name_mondai
    from study.exam_catalogue import EXAM_GENERATORS, KIND_META
    from study.exam_scoring import flatten_questions, score_attempt
    from srs.xp import BASE_XP_BY_QUALITY

    def first(exam_id):
        seeds = exam_seed.load(exam_id)
        if not seeds or not seeds.get("papers"):
            raise SystemExit(f"content/exam_seed/{exam_id}.json: no paper")
        return seeds["papers"][0]["paper"]

    catalogue = []
    for exam_id, (_v, kind, level, _gen) in EXAM_GENERATORS.items():
        paper = name_mondai(first(exam_id))
        counts, names = {}, {}
        for q in flatten_questions(paper):
            counts[q["mondaiId"]] = counts.get(q["mondaiId"], 0) + 1
        for section in paper.get("sections") or []:
            for m in section.get("mondai") or []:
                names.setdefault(m.get("id"), m.get("nameJp"))
        catalogue.append({
            "id": exam_id, "kind": kind, "level": paper["level"], "title": paper["title"], "titleJp": paper["titleJp"],
            "questionCount": sum(counts.values()), "generated": True, "revision": 1,
            "minutes": int(paper["sections"][0]["timeLimitMin"]),
            "mondai": [names[m] for m in counts], "parts": [{"nameJp": names.get(m), "count": n} for m, n in counts.items()],
            "last": None,
        })
    exam_id = spec["exam"]
    paper = name_mondai(first(exam_id))
    qs = flatten_questions(paper)
    wrong = set(spec["wrong"])
    answers = {}
    for i, q in enumerate(qs):
        ids = [c["id"] for c in q["choices"]]
        answers[q["id"]] = q["answer"] if i not in wrong else ids[(ids.index(q["answer"]) + 1) % len(ids)]
    summary = score_attempt(paper, answers)
    xp = BASE_XP_BY_QUALITY.get(4, 0) * summary["correct"] + BASE_XP_BY_QUALITY.get(1, 0) * (summary["total"] - summary["correct"])
    started = 1790845200000  # 2026-10-01 09:00 UTC
    attempt = {
        "xp_earned": xp, "leveled_up": False, "new_level": None, "attemptId": 1, "examId": exam_id, "revision": 1,
        "startedAt": started, "finishedAt": started + spec["minutes_taken"] * 60000, **summary,
    }
    return {
        "level": paper["level"], "line": paper["titleJp"], "exam": exam_id,
        "answers": [{"id": q["id"], "slot": [c["id"] for c in q["choices"]].index(answers[q["id"]])} for q in qs],
        "wrong": sorted(wrong),
        "mocks": {
            "GET /api/exams": catalogue,
            f"GET /api/exams/{exam_id}": {**paper, "revision": 1},
            f"POST /api/exams/{exam_id}/attempts": attempt,
            f"GET /api/exams/{exam_id}/attempts/1": {
                **{k: attempt[k] for k in ("attemptId", "examId", "revision", "review", "perSection", "correct", "total", "startedAt", "finishedAt")},
                "sectionId": paper["sections"][0]["id"], "answers": answers,
            },
        },
    }


def _promo_conversation(spec: dict, lang: str) -> dict:
    """会話: the station's scenarios (a learner who has ridden none) and
    one scene, ridden in Choose, its choices dealt once from its id as
    the route deals them per request, every pick the right one."""
    import random

    from study import conversation

    bank = conversation.bank_lang(lang)
    payload = conversation.scenario_payload(spec["scenario"], bank)
    if payload is None:
        raise SystemExit(f"content/promo.json: {spec['scenario']} is no scenario of the 会話 bank")
    rng = random.Random(spec["scenario"])
    turns = []
    for turn in payload["turns"]:
        choices = list(turn["choices"])
        rng.shuffle(choices)
        turns.append({**turn, "choices": choices})
    return {
        "level": payload["level"], "line": turns[0]["them"]["jp"], "scenario": spec["scenario"],
        "picks": [next(i for i, c in enumerate(t["choices"]) if c.get("right")) for t in turns],
        # A wrong reply a turn, for the one the video picks to show why (plan 273).
        "slips": [next(i for i, c in enumerate(t["choices"]) if not c.get("right")) for t in turns],
        "said": [{"them": t["them"]["jp"], "me": t["me"]["jp"]} for t in turns],
        "mocks": {
            "GET /api/conversation/scenarios": {"scenarios": conversation.catalogue(bank), "record": {}},
            f"GET /api/conversation/scenario/{spec['scenario']}": {**payload, "turns": turns},
            "POST /api/conversation/result": {"correct": True, "quality": 4, **{k: v for k, v in _promo_fare(4).items() if k != "correct"}},
        },
    }


PROMO_FEATURES = {"reading": _promo_reading, "comprehension": _promo_comprehension, "translation": _promo_translation, "dictation": _promo_dictation, "composition": _promo_composition, "exam": _promo_exam, "conversation": _promo_conversation}


def promo() -> dict:
    """bank/promo.json: per practice feature and language, what the app's
    API answers in its video, the shell's boot included."""
    spec = _promo_spec()
    out = {}
    for name, make in PROMO_FEATURES.items():
        out[name] = {}
        for lang in ("en", "fr"):
            f = make(spec[name], lang)
            f["mocks"] = {**_promo_boot(f["level"]), **_promo_ask(spec[name], lang), **f["mocks"]}
            # A question the video types rather than taps (plan 273).
            if spec[name].get("asked"):
                f["asked"] = spec[name]["asked"][lang]
            out[name][lang] = f
    return {"rev": REV, "features": out}


def _count(data: dict) -> str:
    return ", ".join(f"{len(v)} {k}" for k, v in data.items() if isinstance(v, (list, dict)))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--check", action="store_true", help="exit 1 when a file is stale")
    parser.add_argument("--only", help="write this file alone (promo.json: no tokenizer pass over the banks)")
    args = parser.parse_args()

    if args.only == "promo.json":
        text = dump(promo())
        (OUT / "promo.json").write_text(text, encoding="utf-8")
        print(f"wrote frontend/carousel/bank/promo.json: {len(text.encode()) // 1024} KB")
        return 0
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
