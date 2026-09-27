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
guesses -- 〜中 alone is なか to it, 〜気味 きみ, 〜得る える.
"""
from functools import lru_cache

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
