"""
How many strokes a kana takes, counted from the diagram the app already
ships.

KANJIDIC2 gives every kanji a stroke count; nothing gives the kana one,
and the syllabary lists (content/kana_data.py) carry kana / romaji /
group and no drawing facts at all. That is why the dictionary's form
block collapses to a single full-width sheet for a kana while a kanji
gets the sheet with its figures beside it: there was no second figure
to print.

The count is not authored here, because it is already written down.
`backend/kanjivg/` holds one SVG per character and each `<path>` in it
IS one stroke — the same file `StrokeOrderAnimation` draws one stroke at
a time on the frontend. Reading it back is therefore the one source of
truth rather than a second table to keep in step with the diagrams.

Read lazily and cached per character: a syllabary browse touches at most
the page it serves, and the whole collection is 238 characters, so
nothing here is worth paying for at import.

A kana of two characters (きゃ, えい) has no sheet either — a diagram is
one character's — and gets no count for the same reason. The panel
already draws that case (DictionaryDetail's `hasSheet`).
"""
import os
import re
from functools import lru_cache

# backend/content/kana_strokes.py -> backend/kanjivg
_KANJIVG_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "kanjivg"
)

# One <path> per stroke. KanjiVG's files carry nothing else that opens a
# path element -- the stroke numerals ride in a sibling <text> layer --
# so counting the tag is counting the strokes.
_PATH = re.compile(rb"<path[\s>]")


@lru_cache(maxsize=512)
def stroke_count(kana: str) -> int | None:
    """Strokes in this character's KanjiVG diagram, or None where there
    is no diagram: a multi-character kana, or a file that never shipped.
    """
    if not kana or len(kana) != 1:
        return None
    path = os.path.join(_KANJIVG_DIR, f"{ord(kana):05x}.svg")
    try:
        with open(path, "rb") as fh:
            found = len(_PATH.findall(fh.read()))
    except OSError:
        return None
    return found or None
