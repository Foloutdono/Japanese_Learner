"""
Japanese in Latin letters: how this app writes it, and how it measures
two people's spellings of the same sentence against each other.

── Why the app needs the second one ──────────────────────────
Most learners cannot type Japanese. An IME is a separate install on a
laptop and a separate keyboard on a phone, and a beginner practising
listening has not got that far — they write what they heard in the
alphabet they already have. Reading practice has assumed this from the
start (its field says "in romaji"), and 書取 assumes it too.

That makes a comparison necessary, and a comparison is where romaji
gets hard: there is no single right spelling. しんぶん is shinbun or
shimbun; ちいさい is chiisai, chīsai or chisai; し is shi or si; つ is
tsu or tu. None of those is a listening mistake.

`fold` collapses every one of those into one form. It is deliberately
MORE forgiving than routes/reading.py's own normalize_romaji, which
keeps exact spelling variants apart — that one was written when reading
practice still auto-graded, and the note left where it was retired says
the auto-grading was too brittle. Dictation does not repeat that
mistake: the learner grades themselves (docs/adr/0012) and this only
produces the accuracy figure shown to help them. So where it is unsure
it merges, because a figure that reads low for a right answer teaches a
learner to distrust an ear that was correct.

Nothing folded here is ever DISPLAYED. The screen shows the line's own
romaji (content/listening_clips.py) and the learner's own typing, both
untouched; this module's output is a number.
"""
import re
import unicodedata
from functools import lru_cache

import pykakasi

# One instance for the process. pykakasi builds its dictionaries at
# construction, and routes/reading.py used to hold a second copy of
# exactly this; it imports from here now so the cost is paid once.
_kakasi = pykakasi.kakasi()


def to_romaji(text: str) -> str:
    """Deterministic Japanese -> Hepburn, space-separated by word.

    Fed a KANA reading wherever the caller has one. pykakasi's kanji
    readings are dictionary-based and not context-aware, so it picks the
    wrong one often enough to matter — over the listening bank it reads
    十時 as "totoki", 人 as "nin" and 今日 as "konnichi", 21 lines of 92
    — and handing it kana removes that guess entirely. (reading.py has
    no kana for a corpus sentence and accepts the guess; see its note.)
    """
    return " ".join(item["hepburn"] for item in _kakasi.convert(text) if item["hepburn"])


# ── The particles, which are spelled one way and said another ──
# は is written ha and said wa; へ is he and said e; を is wo and said
# o. A learner transcribing what they HEARD writes the sound, and one
# who knows the writing may write the spelling. Both are right.
#
# Done on the spaced text, before the letters are run together below, so
# only a WHOLE WORD is rewritten: folding every "ha" would turn shashin
# into swashin and hana into wana, which costs real distinctions for a
# case this catches precisely.
_PARTICLE = {"ha": "wa", "he": "e", "wo": "o"}

# Kunrei and Nihon-shiki spellings, mapped onto the Hepburn one. Order
# matters: the three-letter digraphs go before the two-letter singles,
# or the `si` inside `sya` is rewritten first and the rule below never
# matches what it was written for.
_SPELLINGS = [
    ("sya", "sha"), ("syu", "shu"), ("syo", "sho"),
    ("tya", "cha"), ("tyu", "chu"), ("tyo", "cho"),
    ("zya", "ja"), ("zyu", "ju"), ("zyo", "jo"),
    ("dya", "ja"), ("dyu", "ju"), ("dyo", "jo"),
    ("jya", "ja"), ("jyu", "ju"), ("jyo", "jo"),
    ("si", "shi"), ("ti", "chi"), ("tu", "tsu"),
    ("zi", "ji"), ("di", "ji"), ("du", "zu"),
    # を run together with its noun ("honwo") never reaches the particle
    # rule above, and no Japanese word spells "wo" any other way, so
    # this one is safe to apply anywhere.
    ("wo", "o"),
]

# ふ, and NOT the ふ inside しゅ or ちゅ. A plain "hu" -> "fu" replace
# rewrote every shuu and chuu in the bank ("senshuu" -> "sensfuu"),
# which the listening bank's own romaji check caught: "hu" really is a
# substring of "shu" and "chu".
_HU = re.compile(r"(?<![sc])hu")

# ん before a labial is written m by Hepburn and n by everyone else:
# shimbun / shinbun. One mora either way.
_LABIAL_N = re.compile(r"m(?=[bpm])")

# Long vowels, in every spelling this app is likely to be handed: ou/oo
# for おう and おお, ii for いい, ei for えい (a macron has already gone
# with its combining mark). Collapsed to the SHORT vowel rather than to
# a marked long one, so a learner who simply did not hear the length is
# not marked down for it — length is the commonest thing a beginner's
# ear drops and it is not what a dictation is testing.
_LONG = [("ou", "o"), ("ei", "e"), ("aa", "a"), ("ii", "i"),
         ("uu", "u"), ("ee", "e"), ("oo", "o")]


@lru_cache(maxsize=4096)
def fold(text: str) -> str:
    """The form two romanizations of one sentence are compared in.

    Everything that is a spelling choice goes; everything that is a
    sound stays. A doubled CONSONANT is left alone on purpose — きって
    and きて are different words and audibly different, so a dropped っ
    is a real miss and should cost the figure.
    """
    if not isinstance(text, str):
        return ""
    # Macrons and every other combining mark: ō -> o, before the a-z
    # filter throws away what it cannot classify.
    decomposed = unicodedata.normalize("NFKD", text.lower())
    plain = "".join(c for c in decomposed if not unicodedata.combining(c))

    # Particles first, while the words are still separable.
    words = [_PARTICLE.get(w, w) for w in re.split(r"[^a-z]+", plain) if w]
    letters = "".join(words)

    for kunrei, hepburn in _SPELLINGS:
        letters = letters.replace(kunrei, hepburn)
    letters = _HU.sub("fu", letters)
    letters = _LABIAL_N.sub("n", letters)
    # nn -> n after the labial rule, so shimbun and shinnbun meet.
    letters = re.sub(r"n{2,}", "n", letters)
    for spelling, vowel in _LONG:
        letters = letters.replace(spelling, vowel)
    return letters


def is_latin(text: str) -> bool:
    """Did the learner answer in the alphabet rather than in kana? True
    when there is at least one Latin letter and no Japanese script at
    all — a mixed answer counts as Japanese, since the kana in it is the
    part worth comparing."""
    if not text:
        return False
    has_latin = any("a" <= c <= "z" for c in text.lower())
    has_japanese = any(
        "ぁ" <= c <= "ゟ" or "ァ" <= c <= "ヿ" or "一" <= c <= "鿿"
        for c in text
    )
    return has_latin and not has_japanese
