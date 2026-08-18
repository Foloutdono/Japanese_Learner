"""
Splitting a kanji's packed `kana` field into its 音読み and 訓読み.

The deck stores every reading in one ・-separated string, e.g. 土 is
"ド・ト・つち". The split is by SCRIPT, which is the standard convention
in Japanese reference works rather than a heuristic: on-readings (from
Chinese) are written in katakana, kun-readings (native Japanese) in
hiragana. Measured over the 2,235-kanji deck: 99% have at least one
on-reading, 82% at least one kun, and none have neither.

The "." inside a kun-reading marks the okurigana boundary -- ま.ず is the
reading "mazu" of which only "ま" is written inside the kanji. It is kept
in the stored form and stripped for display/comparison, since a learner
typing "mazu" has not made a mistake.
"""
import re

_KATAKANA = re.compile(r"[\u30a0-\u30ff]")
_HIRAGANA = re.compile(r"[\u3040-\u309f]")

ON = "on"
KUN = "kun"


def split_readings(packed: str | None) -> dict[str, list[str]]:
    """
    {"on": [...], "kun": [...]} from the deck's packed reading string.
    A reading with neither script (a stray romaji or symbol) is dropped
    rather than guessed at.
    """
    out: dict[str, list[str]] = {ON: [], KUN: []}
    for part in (packed or "").split("・"):
        part = part.strip()
        if not part:
            continue
        # Katakana first: a katakana reading never contains hiragana, but
        # a few entries carry a trailing hiragana okurigana on an on-form.
        if _KATAKANA.search(part):
            out[ON].append(part)
        elif _HIRAGANA.search(part):
            out[KUN].append(part)
    return out


# Markers the deck carries inside a reading, none of which are sounds:
#   "."  okurigana boundary  -- ま.ず is read "mazu", ま is inside the kanji
#   "~"  bound form          -- ~び occurs only as a suffix, ほ~ as a prefix
# 2,532 readings carry a dot and 402 a tilde. Both are worth keeping in the
# stored form, because they say something true about how the reading is
# used; neither belongs in what a learner types.
_MARKERS = str.maketrans("", "", ".~-")


def display_reading(reading: str) -> str:
    """The reading as a learner would say it, with the markers removed."""
    return reading.translate(_MARKERS)
