"""
An example sentence as the client draws it: furigana, the pattern picked
out, the translation in the learner's language (plan 087).

Three consumers want the same sentence three ways -- the lesson shows it
whole with the pattern highlighted, indice_2 shows it whole with the
translation held back, the contrast drill shows it with the pattern
blanked -- so the span is found once here and spent as `highlight` or as
a `blank` part on the furigana parts study/furigana.align_sentence
already produces (`[{text, reading?}]`, the shape FuriganaParts and the
dictionary's ExampleSentence render).

The span is a surface-form match, the same one study/grammar_match uses
to decide a sentence contains its pattern at all: the first hit of the
longest stem. A bare particle has no verifiable stem, so it gets no span
-- shown whole, never blanked (grammar_match.verifiable says why).

The pattern itself is drawn the same way, as furigana parts
(pattern_furigana): 〜の中で is 〜の, 中 read なか, で. Its reading is
the catalogue's own `reading`, written by hand, never the tokenizer's:
a pattern is a fragment, and a fragment is exactly where the tokenizer
guesses -- 〜中 alone is なか to it, 〜気味 きみ, 〜得る える. The
formation line under it is read the same way, from `structure_reading`.

A card the learner wrote has no catalogue reading. Its rule takes the
learner's own `rule_reading` where that spells it, then the catalogue's
when it IS a catalogue point, and otherwise the tokenizer's
(written_furigana) -- the reading its own sentences already print, a
guess the learner corrects by writing the reading. Its formation is
read as its rule is, where the rule holds its kanji.
"""
import re
from functools import lru_cache

from content.grammar_points_data import find
from content.grammar_sentences_data import translation
from study.furigana import align_deck, align_sentence, is_kanji, mark_spans
from study.grammar_match import stems, verifiable

BLANK = "＿＿＿"


def highlight_span(jp: str, pattern: str) -> tuple[int, int] | None:
    """[start, end) of the pattern in `jp`, or None when nothing can be
    pointed at honestly."""
    if not jp or not verifiable(pattern):
        return None
    for stem in stems(pattern):  # longest first: the strongest evidence
        at = jp.find(stem)
        if at >= 0:
            return at, at + len(stem)
    return None


def parts_with_span(jp: str, span: tuple[int, int] | None, mark: str) -> list[dict]:
    """
    align_sentence's parts with the span marked.

    `mark="highlight"` sets `highlight: True` on every part inside the
    span; `mark="blank"` replaces those parts with one `{text: BLANK,
    blank: True}` part. The cutting rule is furigana.mark_spans's -- a
    part with no reading is split at the span's edges so the mark is
    exact, a ruby part never is -- and the blank below is that same
    marked run collapsed to one part.
    """
    parts = align_sentence(jp) if jp else []
    if span is None or not parts:
        return parts
    marked = mark_spans(parts, [span])
    if mark != "blank":
        return marked
    out: list[dict] = []
    blanked = False
    for part in marked:
        if not part.get("highlight"):
            out.append(part)
        elif not blanked:
            out.append({"text": BLANK, "blank": True})
            blanked = True
    return out


@lru_cache(maxsize=4096)
def _payload(jp: str, en: str, fr: str, register: str | None, contrast: bool,
             pattern: str, lang: str, blank: bool) -> dict:
    span = highlight_span(jp, pattern)
    payload = {
        "jp": jp,
        "tr": translation({"en": en, "fr": fr}, lang),
        "furigana": parts_with_span(jp, span, "blank" if blank else "highlight"),
    }
    if register:
        payload["register"] = register
    if contrast:
        payload["contrast"] = True
    return payload


def _frozen(payload: dict) -> dict:
    # lru_cache hands back the same object every time; a caller that
    # mutates the parts list would corrupt every later reader.
    return {**payload, "furigana": [dict(p) for p in payload["furigana"]]}


def example_payload(example: dict, pattern: str, lang: str) -> dict:
    """{jp, tr, furigana (highlighted), register?, contrast?}."""
    return _frozen(_payload(
        example["jp"], example.get("en", ""), example.get("fr", ""),
        example.get("register"), bool(example.get("contrast")), pattern, lang, False,
    ))


def blanked_payload(example: dict, pattern: str, lang: str) -> dict:
    """{jp, tr, furigana (with the pattern as one blank part), ...}."""
    return _frozen(_payload(
        example["jp"], example.get("en", ""), example.get("fr", ""),
        example.get("register"), bool(example.get("contrast")), pattern, lang, True,
    ))


def _kanji(c: str) -> bool:
    return is_kanji(c) or c == "々"


@lru_cache(maxsize=1024)
def _pattern_parts(pattern: str, reading: str | None) -> tuple[tuple[tuple[str, str], ...], ...]:
    if not reading or not any(_kanji(c) for c in pattern):
        return ((("text", pattern),),)
    parts = align_deck(pattern, reading)
    # A reading that does not spell the pattern comes back from align as
    # one part carrying all of it -- the whole reading over 〜, the
    # particles and the brackets. No furigana is better than that; the
    # gate (grammar_check) keeps the catalogue from ever getting here.
    if any(p.get("reading") and not all(_kanji(c) for c in p["text"]) for p in parts):
        return ((("text", pattern),),)
    return tuple(tuple(p.items()) for p in parts)


def pattern_furigana(pattern: str, reading: str | None) -> list[dict]:
    """[{text, reading?}] for a pattern: a reading over each kanji run
    (per kanji where align divides it), the kana, 〜 and brackets as
    they are written. One unreadinged part when there is no kanji, no
    reading (a written card's own rule) or a reading that does not
    spell the pattern."""
    return [dict(p) for p in _pattern_parts(pattern, reading)]


def structure_furigana(entry: dict) -> list[dict]:
    """The formation line (`structure`) as ruby, from `structure_reading`:
    ["noun + の", 中 read なか, "で"] for "noun + の中で"."""
    return pattern_furigana(entry.get("structure") or "", entry.get("structure_reading"))


def furigana_by_pattern(patterns) -> dict[str, list[dict]]:
    """{pattern: parts} for the catalogue patterns among `patterns` that
    carry a reading -- what a card whose choices are patterns prints over
    them. A pattern with no kanji, or none the catalogue holds, is left
    out: its option is its text."""
    out = {}
    for pattern in patterns:
        found = find(pattern)
        if found and found[1].get("reading"):
            out[pattern] = pattern_furigana(pattern, found[1]["reading"])
    return out


# The tildes a learner types for 〜: the catalogue writes the wave dash.
_TILDES = str.maketrans({"~": "〜", "～": "〜"})
# What a reading may be written in: kana, the long-vowel mark, and ・
# between two readings of one kanji (〜中 is ちゅう・じゅう).
KANA_READING = re.compile(r"[ぁ-ゖァ-ヺー・]+")
_KANJI_RUN = re.compile(r"[一-龯々]+")
# Neither kana nor kanji: the 〜, brackets, spaces and English a rule
# opens or closes on, which a learner leaves out of its reading.
_LEAD = re.compile(r"^[^぀-ヿ一-龯々]*")
_TRAIL = re.compile(r"[^぀-ヿ一-龯々]*$")


def _hiragana(s: str) -> str:
    return "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in s)


def _respelled(text: str, parts: list[dict]) -> list[dict]:
    """`parts` of text.translate(_TILDES), spelling `text` itself: the
    two differ only in their tildes, character for character."""
    at, out = 0, []
    for part in parts:
        n = len(part["text"])
        out.append({**part, "text": text[at:at + n]})
        at += n
    return out


def _learners_reading(text: str, reading: str) -> list[dict] | None:
    """`text` read by the reading a learner wrote for it, or None when
    the reading does not spell it. Lenient where a learner is: a typed ~
    or ～, the 〜 (or the English) the rule opens on left out, katakana
    for hiragana."""
    norm = text.translate(_TILDES)
    typed = (reading or "").strip().translate(_TILDES)
    if not typed:
        return None
    lead, trail = _LEAD.match(norm).group(0), _TRAIL.search(norm).group(0)
    tries = []
    for cand in (typed, _hiragana(typed)):
        tries.append(cand)
        tries.append(("" if cand.startswith(lead) else lead) + cand + ("" if cand.endswith(trail) else trail))
    for cand in dict.fromkeys(tries):
        parts = pattern_furigana(norm, cand)
        read = [p["reading"] for p in parts if p.get("reading")]
        if read and all(KANA_READING.fullmatch(r) for r in read):
            return _respelled(text, parts)
    return None


def _read_like(text: str, known: list[dict], guessed: list[dict]) -> list[dict]:
    """`text` with each kanji run read the way `known` reads it -- a
    formation by its rule's parts -- and a run `known` does not read (or
    reads two ways) as `guessed` has it, the tokenizer's parts of the
    same text. So a formation's 方 is the rule's かた, never a second
    guess of ほう beside it."""
    readings: dict[str, set[str]] = {}
    run, read = "", ""
    for part in [*known, {"text": ""}]:
        if part.get("reading"):
            run, read = run + part["text"], read + part["reading"]
            readings.setdefault(part["text"], set()).add(part["reading"])
        else:
            if run:
                readings.setdefault(run, set()).add(read)
            run, read = "", ""

    # The guessed parts by where they sit in the text.
    spans, at = [], 0
    for part in guessed:
        spans.append((at, at + len(part["text"]), part))
        at += len(part["text"])

    out: list[dict] = []

    def plain(chunk: str) -> None:
        if chunk and out and "reading" not in out[-1]:
            out[-1] = {"text": out[-1]["text"] + chunk}
        elif chunk:
            out.append({"text": chunk})

    at = 0
    for m in _KANJI_RUN.finditer(text):
        plain(text[at:m.start()])
        found = readings.get(m.group(0), set())
        inside = [p for a, b, p in spans if a >= m.start() and b <= m.end()]
        if len(found) == 1:
            parts = pattern_furigana(m.group(0), next(iter(found)))
        elif sum(len(p["text"]) for p in inside) == len(m.group(0)):
            parts = inside
        else:
            parts = [{"text": m.group(0)}]
        for part in parts:
            if part.get("reading"):
                out.append(part)
            else:
                plain(part["text"])
        at = m.end()
    plain(text[at:])
    return out


def written_furigana(text: str, reading: str | None = None, known: list[dict] | None = None) -> list[dict]:
    """A written card's rule or formation as ruby, the first of these
    that reads it: the `reading` the learner wrote, where it spells the
    text; the catalogue's own when the text is a catalogue pattern (a
    typed ~ or ～ read as its 〜); the `known` parts' readings of the same
    kanji (a formation read as its rule is); the tokenizer's, as its
    sentences have it. The bare text when it has no kanji or nothing
    reads it."""
    if not text or not any(_kanji(c) for c in text):
        return [{"text": text}] if text else []
    if reading:
        parts = _learners_reading(text, reading)
        if parts:
            return parts
    found = find(text.translate(_TILDES))
    if found and found[1].get("reading"):
        return _respelled(text, pattern_furigana(found[1]["pattern"], found[1]["reading"]))
    guessed = _as_written(text, align_sentence(text))
    return _read_like(text, known, guessed) if known else guessed


def _as_written(text: str, parts: list[dict]) -> list[dict]:
    """`parts` spelling `text` exactly. The tokenizer drops whitespace,
    and a formation is English between its Japanese ("verb て-form +
    見る"), so the spaces are put back between the parts, as plain text.
    The bare text when the parts spell anything else."""
    solid = [i for i, c in enumerate(text) if not c.isspace()]
    if "".join(p["text"] for p in parts) != "".join(text[i] for i in solid):
        return [{"text": text}]
    out: list[dict] = []

    def plain(chunk: str) -> None:
        if not chunk:
            return
        if out and "reading" not in out[-1]:
            out[-1] = {"text": out[-1]["text"] + chunk}
        else:
            out.append({"text": chunk})

    at = k = 0
    for part in parts:
        if not part["text"]:
            continue
        start, end = solid[k], solid[k + len(part["text"]) - 1] + 1
        k += len(part["text"])
        plain(text[at:start])
        if part.get("reading"):
            out.append({"text": text[start:end], "reading": part["reading"]})
        else:
            plain(text[start:end])
        at = end
    plain(text[at:])
    return out
