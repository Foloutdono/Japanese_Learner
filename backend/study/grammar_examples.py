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
catalogue's when it IS a catalogue point, and otherwise the tokenizer's
(written_furigana) -- the reading its own sentences already print, and
the one place a guess is better than nothing: the learner chose the
words, and reads them in the form they wrote.
"""
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


def written_furigana(text: str) -> list[dict]:
    """A written card's rule or formation as ruby. The catalogue's own
    reading when the text is a catalogue pattern (a typed ~ or ～ read as
    its 〜); otherwise the tokenizer's, as its sentences have it; the
    bare text when it has no kanji or the tokenizer is not installed."""
    if not text or not any(_kanji(c) for c in text):
        return [{"text": text}] if text else []
    found = find(text.translate(_TILDES))
    if found and found[1].get("reading"):
        parts = pattern_furigana(found[1]["pattern"], found[1]["reading"])
        # The same characters but the tildes: spell the learner's own.
        at, out = 0, []
        for part in parts:
            n = len(part["text"])
            out.append({**part, "text": text[at:at + n]})
            at += n
        return out
    return _as_written(text, align_sentence(text))


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
