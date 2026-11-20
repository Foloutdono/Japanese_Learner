"""
札の中身 — what a flip card shows besides its answer (plan 326).

A learner past the first steps found the flip cards too bare: the word
and its meaning, nothing to hold them. Réglages › Card contents lets
each learner add what the dictionary already knows, line by line, kept
on the account (user_profiles.card_contents, NULL for never chosen):

  vocab   on the question  furigana    the word's reading over its kanji
                           sentence    an example, in Japanese only
          under the answer example     an example and its translation
                           kanji       each kanji of the word, its meaning
                           meanings    the word's other senses
                           pair        its transitive / intransitive pair
                           verb        its verb group and transitivity
  kanji   under the answer words       the course's words written with it
                           radical     its radical and that radical's meaning
                           strokes     its stroke count

Nothing chosen is today's card, so a learner who never opens the page
sees no change ("say less"). The question side is the client's to gate
by direction (frontend/src/domain/cardContents.js): a field that would
answer the card (a sentence on a meaning → word card, furigana on a
reading card) is never shown, whatever was chosen. Pure here;
routes/profile.py stores it, routes/card_extras.py serves what it
asks for (study/card_extras.py).
"""

# The fields each line offers, in the page's order.
FIELDS: dict[str, dict[str, tuple[str, ...]]] = {
    "vocab": {
        "question": ("furigana", "sentence"),
        "answer": ("example", "kanji", "meanings", "pair", "verb"),
    },
    "kanji": {
        "question": (),
        "answer": ("words", "radical", "strokes"),
    },
}
LINES = tuple(FIELDS)


def _all(line: str) -> tuple[str, ...]:
    return FIELDS[line]["question"] + FIELDS[line]["answer"]


def clean(value):
    """A client's {line: [field, ...]} -> the stored map, each list in the
    page's order without repeats; None stays None (the field was not
    sent). Raises ValueError on a line or a field that is not on offer,
    so a validator can hand it straight on."""
    if value is None:
        return None
    if not isinstance(value, dict):
        raise ValueError("must be a map of line to fields")
    out = {}
    for line, fields in value.items():
        if line not in FIELDS:
            raise ValueError(f"unknown line {line!r}; must be among {', '.join(LINES)}")
        if not isinstance(fields, list):
            raise ValueError(f"{line} must be a list of fields")
        offered = _all(line)
        for f in fields:
            if f not in offered:
                raise ValueError(f"{f!r} is not a field of {line}")
        out[line] = [f for f in offered if f in fields]
    return out


def resolve(stored) -> dict[str, list[str]]:
    """Every line answered: what the learner chose, nothing where they
    chose nothing. A stored field no longer offered is dropped."""
    stored = stored if isinstance(stored, dict) else {}
    return {
        line: [f for f in _all(line) if f in (stored.get(line) or [])]
        for line in LINES
    }


def choices() -> dict[str, dict[str, list[str]]]:
    return {line: {side: list(fs) for side, fs in sides.items()} for line, sides in FIELDS.items()}
