"""
Single source of truth for the quiz mode keys used by kana/vocab/kanji
study sessions. vocab.py, kanji.py, and stats.py all import from here —
add a mode, rename a key, or change what qualifies as valid, and every
place that cares picks it up automatically instead of needing to be
kept in sync by hand.
"""

# format: "qcm" | "flashcard" — how the prompt/choices are presented.
# direction: "kj-m" (word/kanji shown, recall the meaning) |
#            "m-kj" (meaning shown, recall the word/kanji)
QCM_FLASHCARD_MODES = {
    "qcm-kj-m":       ("qcm", "kj-m"),
    "qcm-m-kj":       ("qcm", "m-kj"),
    "flashcard-kj-m": ("flashcard", "kj-m"),
    "flashcard-m-kj": ("flashcard", "m-kj"),
}

KANA_MODES  = ["qcm", "flashcard", "write"]
VOCAB_MODES = list(QCM_FLASHCARD_MODES)
# Kanji has a 5th mode (drawing practice) that vocab doesn't have.
KANJI_MODES = VOCAB_MODES + ["write"]

# Representative mode used to gauge "do I know this word/kanji" for
# dictionary status badges (see card_lookup.py) — qcm-kj-m (see the
# word/kanji, recognize the meaning among choices) is the closest proxy
# for "do I know what this means when I read it".
STATUS_MODE = "qcm-kj-m"