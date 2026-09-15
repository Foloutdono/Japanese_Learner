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
"""
from functools import lru_cache

from content.grammar_sentences_data import translation
from study.furigana import align_sentence
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
    blank: True}` part. A part with no reading is split at the span's
    edges so the mark is exact; a ruby part (text + reading) is never
    split -- half a reading over half a word is wrong furigana, which is
    worse than a slightly wide mark -- so the span widens to the whole
    part instead.
    """
    parts = align_sentence(jp) if jp else []
    if span is None or not parts:
        return parts
    start, end = span
    out: list[dict] = []
    pos = 0
    blanked = False
    for part in parts:
        text = part["text"]
        p_start, p_end = pos, pos + len(text)
        pos = p_end
        if p_end <= start or p_start >= end:
            out.append(part)
            continue
        if part.get("reading") is not None:
            # A ruby part: all or nothing.
            pieces = [(part, True)]
        else:
            pieces = []
            a, b = max(start, p_start), min(end, p_end)
            if a > p_start:
                pieces.append(({"text": text[: a - p_start]}, False))
            pieces.append(({"text": text[a - p_start: b - p_start]}, True))
            if b < p_end:
                pieces.append(({"text": text[b - p_start:]}, False))
        for piece, inside in pieces:
            if not inside:
                out.append(piece)
            elif mark == "blank":
                if not blanked:
                    out.append({"text": BLANK, "blank": True})
                    blanked = True
            else:
                out.append({**piece, "highlight": True})
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
