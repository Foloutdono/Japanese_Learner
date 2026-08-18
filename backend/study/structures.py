"""
What a personal card looks like, per deck structure.

A deck has one structure (see routes/decks.py's STRUCTURES), and a card
written into it has that structure's shape. This is the single definition
of that shape: the API validates against it, and the add-card form is
GENERATED from it (GET /api/decks/structures), so there is no
hand-synced frontend copy to drift.

Why structures at all: a personal card used to be a front/back pair and
nothing else, so it could only ever be a flashcard. Giving it the shape of
a kanji entry means it can be studied the way kanji are -- write it,
recall its readings, name its radical -- instead of being a second-class
card in its own deck.

`hint` is gone. It was shown during a quiz, which makes it a hint the
learner never chose (see components/study/HintBar.jsx for why help has to
be opt-in). `notes` stays, on every structure, and is never shown mid-card.
"""
from dataclasses import dataclass, field


@dataclass(frozen=True)
class Field:
    key: str
    # 'text' | 'number' | 'lines' -- what the generated form renders.
    # 'lines' is a repeatable text row (grammar's sentences).
    kind: str = "text"
    required: bool = False
    # For 'number': the picker to open instead of a bare input.
    picker: str | None = None


@dataclass(frozen=True)
class Structure:
    key: str
    # The registry source its cards study under. A kanji-structure card
    # gets kanji's modes, which is the entire point of the structure.
    source: str
    fields: tuple[Field, ...] = field(default_factory=tuple)
    # Which field carries the Japanese side, and which the meaning --
    # so the card builder can produce a front/back without knowing the
    # structure.
    front_key: str = ""
    back_key: str = ""


STRUCTURES: dict[str, Structure] = {
    "standard": Structure(
        key="standard", source="standard", front_key="front", back_key="back",
        fields=(
            Field("front", required=True),
            Field("back", required=True),
        ),
    ),
    "kanji": Structure(
        key="kanji", source="kanji", front_key="kanji", back_key="meaning",
        fields=(
            Field("kanji", required=True),
            Field("meaning", required=True),
            Field("readings", required=True),
            # The Kangxi radical number. A picker rather than a free
            # number: 214 of them, and nobody remembers that 言 is 149.
            Field("radical", kind="number", required=True, picker="radical"),
        ),
    ),
    "vocab": Structure(
        key="vocab", source="vocab", front_key="word", back_key="meaning",
        fields=(
            Field("word", required=True),
            Field("meaning", required=True),
            # Optional: a kana-only word is already its own reading.
            Field("reading"),
        ),
    ),
    "grammar": Structure(
        key="grammar", source="grammar", front_key="rule", back_key="meaning",
        fields=(
            Field("rule", required=True),
            Field("meaning", required=True),
            # Optional, and repeatable. A sentence that does not contain
            # the rule is kept but excluded from fill_in -- see
            # usable_sentences.
            Field("sentences", kind="lines"),
        ),
    ),
}

ALL_KEYS = tuple(STRUCTURES)


def structure_for(key: str) -> Structure:
    return STRUCTURES.get(key) or STRUCTURES["standard"]


def normalise(key: str, raw: dict) -> dict:
    """
    The submitted fields, trimmed and restricted to the structure's own.

    Anything not in the spec is DROPPED rather than stored: a card is
    read back by the same spec that wrote it, so an extra key would be
    invisible storage nobody ever renders.
    """
    spec = structure_for(key)
    out: dict = {}
    for f in spec.fields:
        value = raw.get(f.key)
        if f.kind == "lines":
            items = value if isinstance(value, list) else ([value] if value else [])
            out[f.key] = [str(v).strip() for v in items if str(v).strip()]
        elif f.kind == "number":
            try:
                out[f.key] = int(value)
            except (TypeError, ValueError):
                out[f.key] = None
        else:
            out[f.key] = str(value or "").strip()
    return out


def missing_required(key: str, fields: dict) -> list[str]:
    """Required fields the card does not carry. Empty means valid."""
    spec = structure_for(key)
    missing = []
    for f in spec.fields:
        if not f.required:
            continue
        value = fields.get(f.key)
        if value is None or (isinstance(value, (str, list)) and not value):
            missing.append(f.key)
    return missing


def usable_sentences(fields: dict) -> list[str]:
    """
    Grammar sentences that verifiably contain their own rule.

    A sentence that does not is not an example of anything, and fill_in
    would ask which rule is at work in a sentence where it isn't. Checked
    explicitly rather than assumed, and the card is excluded from fill_in
    rather than served a question with no answer.
    """
    from study.grammar_match import contains_pattern, verifiable

    rule = fields.get("rule") or ""
    sentences = fields.get("sentences") or []
    if not verifiable(rule):
        return []
    return [s for s in sentences if contains_pattern(s, rule)]


def describe() -> list[dict]:
    """The spec as JSON, for the generated add-card form."""
    return [
        {
            "key": s.key,
            "source": s.source,
            "front_key": s.front_key,
            "back_key": s.back_key,
            "fields": [
                {"key": f.key, "kind": f.kind, "required": f.required, "picker": f.picker}
                for f in s.fields
            ],
        }
        for s in STRUCTURES.values()
    ]
