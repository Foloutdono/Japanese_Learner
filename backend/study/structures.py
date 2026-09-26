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
    # What the generated form renders:
    #   'text'     one line
    #   'long'     a paragraph (a textarea): a grammar card's lesson steps,
    #              where "- " lines make a list, as in the catalogue's own
    #   'choice'   one of `options`, or nothing
    #   'number'   an integer, through `picker`
    #   'lines'    a repeatable text row
    #   'pairs'    a repeatable row of two named `parts` -- a grammar
    #              card's sentence over its translation, or a rival rule
    #              beside what tells it apart
    #   'readings' TWO repeatable groups, on'yomi and kun'yomi -- the
    #              same shape kanji.readings itself asks the learner to
    #              produce, so a personal kanji card can be studied that
    #              way too. See ReadingsField (DeckDetailScreen.jsx) for
    #              the editable form and ReadingsInput
    #              (components/study/ReadingsInput.jsx) for the quiz that
    #              consumes it.
    kind: str = "text"
    required: bool = False
    # For 'number': the picker to open instead of a bare input.
    picker: str | None = None
    # For 'choice': the keys it may hold.
    options: tuple[str, ...] = ()
    # For 'pairs': the two keys of a row, the first the one it needs.
    parts: tuple[str, ...] = ()


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


# The catalogue's registers (content/grammar/README.md), the same keys
# the lesson's tags are localised from (t.glRegister).
REGISTERS = ("neutral", "polite", "casual", "formal", "written")

STRUCTURES: dict[str, Structure] = {
    "standard": Structure(
        key="standard", source="standard", front_key="front", back_key="back",
        fields=(
            Field("front", required=True),
            Field("back", required=True),
        ),
    ),
    # The syllabary's own shape: a character and the sound it spells.
    # There is no meaning to translate — a kana is not a word — so the
    # back is the romaji, which is exactly what kana.write_romaji asks
    # the learner to produce and what the flashcard directions turn over.
    "kana": Structure(
        key="kana", source="kana", front_key="kana", back_key="romaji",
        fields=(
            Field("kana", required=True),
            Field("romaji", required=True),
        ),
    ),
    "kanji": Structure(
        key="kanji", source="kanji", front_key="kanji", back_key="meaning",
        fields=(
            Field("kanji", required=True),
            Field("meaning", required=True),
            Field("readings", kind="readings", required=True),
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
    # The catalogue's own shape (content/grammar/*.json), so a point a
    # learner writes is taught the way the app's are: the rule and its
    # gloss, the formation over it, the register it belongs to, the
    # lesson's three steps (the rule, its uses, its trap), sentences with
    # their translations and the rivals it is confused with. Only the
    # rule and the meaning are asked for; the rest is the lesson behind
    # the card's door (grammar_lesson below), printed by the same
    # GrammarLesson the catalogue's points are.
    "grammar": Structure(
        key="grammar", source="grammar", front_key="rule", back_key="meaning",
        fields=(
            Field("rule", required=True),
            Field("meaning", required=True),
            Field("structure"),
            Field("register", kind="choice", options=REGISTERS),
            Field("explanation", kind="long"),
            Field("usage", kind="long"),
            Field("careful", kind="long"),
            # Repeatable. A sentence that does not contain the rule is
            # kept but excluded from fill_in -- see usable_sentences. A
            # card written before sentences had translations holds bare
            # strings; sentence_pairs reads both.
            Field("sentences", kind="pairs", parts=("jp", "tr")),
            Field("compare", kind="pairs", parts=("pattern", "text")),
        ),
    ),
}

ALL_KEYS = tuple(STRUCTURES)

# Same cap ReadingsInput.jsx enforces on the quiz side (see that
# component's own comment) -- not a scoring rule, just a stop against a
# form growing without bound. Applied on save so it holds regardless of
# which client wrote the card.
MAX_READINGS = 15

# The same kind of stop for a repeatable row: twenty sentences is already
# more than any lesson in the catalogue prints, and an import pasting a
# column of a thousand into one card is a mistake, not a lesson.
MAX_ROWS = 20


def structure_for(key: str) -> Structure:
    return STRUCTURES.get(key) or STRUCTURES["standard"]


def decode_readings(value) -> dict:
    """
    A 'readings' field as {"on": [...], "kun": [...]}, from whatever shape
    is actually stored.

    Cards written before this field existed as two groups hold one
    ・-joined string (e.g. "ケン・いぬ", the old free-text convention) --
    those are re-split by SCRIPT the exact same way the deck's own packed
    readings are (content/kanji_readings.split_readings), so a card
    written before this change still studies and displays correctly
    without a data migration or ever losing what was typed.
    """
    if isinstance(value, dict):
        return {
            "on":  [str(v).strip() for v in (value.get("on") or []) if str(v).strip()],
            "kun": [str(v).strip() for v in (value.get("kun") or []) if str(v).strip()],
        }
    if isinstance(value, str) and value.strip():
        from content.kanji_readings import split_readings

        return split_readings(value)
    return {"on": [], "kun": []}


def decode_pairs(value, parts: tuple[str, ...]) -> list[dict]:
    """
    A 'pairs' field as a list of {parts[0]: str, parts[1]: str}, from
    whatever shape is stored or sent.

    A row is kept only when its first part is there -- a translation with
    no sentence is nothing to show. A bare string is a row whose second
    part is empty: that is how a grammar card's sentences were stored
    before they carried translations, so those cards read on unchanged.
    """
    first, second = parts
    items = value if isinstance(value, list) else ([value] if value else [])
    out = []
    for item in items:
        if isinstance(item, dict):
            a, b = str(item.get(first) or "").strip(), str(item.get(second) or "").strip()
        else:
            a, b = str(item or "").strip(), ""
        if a:
            out.append({first: a, second: b})
    return out


def sentence_pairs(fields: dict) -> list[dict]:
    """A grammar card's sentences as [{jp, tr}], old and new cards alike."""
    return decode_pairs(fields.get("sentences"), ("jp", "tr"))


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
            out[f.key] = [str(v).strip() for v in items if str(v).strip()][:MAX_ROWS]
        elif f.kind == "pairs":
            out[f.key] = decode_pairs(value, f.parts)[:MAX_ROWS]
        elif f.kind == "choice":
            text = str(value or "").strip()
            out[f.key] = text if text in f.options else ""
        elif f.kind == "readings":
            readings = decode_readings(value)
            # The cap is on the COMBINED count, same as the quiz form --
            # on'yomi and kun'yomi share one budget, not 15 each. Trimmed
            # from the end of kun first, then on, so a card that's over
            # loses its LAST-added entries rather than an arbitrary mix.
            over = len(readings["on"]) + len(readings["kun"]) - MAX_READINGS
            if over > 0:
                cut_kun = min(over, len(readings["kun"]))
                if cut_kun:
                    readings["kun"] = readings["kun"][:-cut_kun]
                over -= cut_kun
                if over > 0:
                    readings["on"] = readings["on"][:max(0, len(readings["on"]) - over)]
            out[f.key] = readings
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
        if f.kind == "readings":
            readings = decode_readings(value)
            if not readings["on"] and not readings["kun"]:
                missing.append(f.key)
        elif value is None or (isinstance(value, (str, list)) and not value):
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
    if not verifiable(rule):
        return []
    return [p["jp"] for p in sentence_pairs(fields) if contains_pattern(p["jp"], rule)]


def grammar_lesson(fields: dict) -> dict:
    """
    A personal grammar card's lesson, in the shape GrammarLesson draws a
    catalogue point in (study/grammar_lesson.lesson_payload): the card's
    formation, gloss and register, its steps in the catalogue's order
    (rule, use, careful), its rivals and its sentences, each with the
    rule marked in it where it can be found honestly.

    Already in the learner's language, because the learner wrote it:
    there is nothing to localise, and no `raw_id` on a rival -- it names
    no catalogue point, so its row is not a door.
    """
    from study.grammar_examples import highlight_span, parts_with_span

    rule = fields.get("rule") or ""
    steps = [
        {"kind": kind, "text": fields.get(key)}
        for kind, key in (("rule", "explanation"), ("use", "usage"), ("careful", "careful"))
        if fields.get(key)
    ]
    compare = [
        {"pattern": p["pattern"], "text": p["text"]}
        for p in decode_pairs(fields.get("compare"), ("pattern", "text"))
    ]
    examples = [
        {"jp": p["jp"], "tr": p["tr"],
         "furigana": parts_with_span(p["jp"], highlight_span(p["jp"], rule), "highlight")}
        for p in sentence_pairs(fields)
    ]
    return {
        "pattern": rule,
        "structure": fields.get("structure") or "",
        "meaning": fields.get("meaning") or "",
        "register": fields.get("register") or None,
        "steps": steps,
        "compare": compare,
        "examples": examples,
    }


def describe() -> list[dict]:
    """The spec as JSON, for the generated add-card form."""
    return [
        {
            "key": s.key,
            "source": s.source,
            "front_key": s.front_key,
            "back_key": s.back_key,
            "fields": [
                {"key": f.key, "kind": f.kind, "required": f.required, "picker": f.picker,
                 **({"options": list(f.options)} if f.options else {}),
                 **({"parts": list(f.parts)} if f.parts else {})}
                for f in s.fields
            ],
        }
        for s in STRUCTURES.values()
    ]
