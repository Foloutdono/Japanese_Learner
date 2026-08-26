"""Normalisation shared by every producer of recognized Japanese text.

Mirrors frontend/src/lib/ocr.js exactly, on purpose: the client-side
tesseract tier and the server-side vision tier must hand the analyzer
the same shape of text, or the same photo would segment differently
depending on which engine read it.
"""
import re

# Hiragana, katakana, CJK unified ideographs -- the same range
# frontend/src/lib/ocr.js uses for JAPANESE_SCRIPT_RE.
JAPANESE_SCRIPT = r"[぀-ゟ゠-ヿ一-鿿]"

# Recognizers insert a space between CJK "words" they segment, an
# artifact of a space-delimited-language assumption that does not hold
# for Japanese.
#
# [ \t]+ rather than \s+ deliberately -- \s also matches newlines, and a
# newline between two Japanese characters is a genuine line break the
# recognizer detected (paragraph/line structure), not an inserted word
# separator. Matching \s+ here silently eats those breaks. This exact
# bug was written and caught once already, in the JS twin; the comment
# travels with the rule so it is not rediscovered a third time.
_INTER_CJK_SPACE_RE = re.compile(
    f"({JAPANESE_SCRIPT})[ \t]+(?={JAPANESE_SCRIPT})"
)

_BLANK_LINES_RE = re.compile(r"\n{2,}")

# Models sometimes wrap output in a markdown fence despite being told
# not to. Same treatment as routes/phrase.py's own fence stripping.
_FENCE_RE = re.compile(r"^```(?:\w+)?|```$", re.MULTILINE)


def strip_inter_cjk_spaces(text: str) -> str:
    return _INTER_CJK_SPACE_RE.sub(r"\1", text)


def collapse_blank_lines(text: str) -> str:
    return _BLANK_LINES_RE.sub("\n", text).strip()


def strip_code_fences(text: str) -> str:
    return _FENCE_RE.sub("", text.strip()).strip()


def normalize_recognized_text(text: str) -> str:
    """Fence-strip, de-space, and collapse blank lines, in that order."""
    return collapse_blank_lines(strip_inter_cjk_spaces(strip_code_fences(text)))


def japanese_ratio(text: str) -> float:
    """Share of non-whitespace characters that are Japanese script.
    Returns 1.0 for empty input so "nothing recognized" never reads as
    "recognized the wrong script"."""
    chars = [c for c in text if not c.isspace()]
    if not chars:
        return 1.0
    hits = len(re.findall(JAPANESE_SCRIPT, "".join(chars)))
    return hits / len(chars)
