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
mistake: the learner grades themselves (docs/adr/0013) and this only
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


# pykakasi hands back Japanese punctuation as its own token —
# 。「」！ become . ( ) ! — so joining every token with a plain space
# put a space in front of every full stop, comma and closing bracket
# ("dema shita ." instead of "dema shita."). These glue onto the
# neighbour they punctuate rather than standing apart as their own word.
_NO_SPACE_BEFORE = set(".,!?)")
_NO_SPACE_AFTER = set("(")


def to_romaji(text: str) -> str:
    """Deterministic Japanese -> Hepburn, space-separated by word.

    Fed a KANA reading wherever the caller has one. pykakasi's kanji
    readings are dictionary-based and not context-aware, so it picks the
    wrong one often enough to matter — over the listening bank it reads
    十時 as "totoki", 人 as "nin" and 今日 as "konnichi", 21 lines of 92
    — and handing it kana removes that guess entirely. (reading.py has
    no kana for a corpus sentence and accepts the guess; see its note.)
    """
    words = []
    for item in _kakasi.convert(text):
        h = item["hepburn"]
        if not h:
            continue
        if words and (h[0] in _NO_SPACE_BEFORE or words[-1][-1] in _NO_SPACE_AFTER):
            words[-1] += h
        else:
            words.append(h)
    return " ".join(words)


# は/へ/を read aloud as わ/え/お (see the bigger _PARTICLE table below,
# which corrects the same three once they have already become romaji
# letters). sentence_romaji corrects them a stage earlier, in kana,
# because it sources its spelling from UniDic's own `kana` field rather
# than the sound -- see that function's docstring for why.
_SAID_KANA = {"は": "ワ", "へ": "エ", "を": "オ"}


def sentence_romaji(text: str) -> str:
    """Context-aware Japanese -> Hepburn for a whole sentence, via the
    same morphological tokenizer the furigana/card-lookup code already
    uses (study/morphology.py) rather than pykakasi's own dictionary
    lookup. to_romaji()'s own docstring names the failure mode this
    fixes -- 十時 as "totoki" -- and reading practice hits the same one
    on hand-written N5 sentences it cannot afford to get wrong: 六時に
    ("at six o'clock") came back "roku tokini" because pykakasi's kanji
    dictionary has no notion that 時 after a number is the hour counter
    (じ), not the noun "time" (とき). MeCab/UniDic resolves it correctly
    because it looks at what is actually next to the kanji.

    Falls back to to_romaji() when the tokenizer is unavailable or fails
    on this input -- the same graceful-degradation contract every other
    morphology.py caller in this app already follows -- so this is safe
    to call unconditionally.

    Romanizes off each morpheme's `kana` (spelling) rather than its
    `reading` (sound): the two differ on exactly the words a learner
    needs written right. `reading` collapses every long vowel to one
    mark, so a native-word exception -- 大きい is おおきい, not おうきい,
    the same family as 十/遠い/通る/氷 -- comes back wrong as often as it
    comes back right (this was tried; "oukii" started showing up for
    "ookii" everywhere). `kana` keeps each word's real spelling, so
    pykakasi (still doing the actual kana -> Hepburn letters, which was
    never the problem) sees オオキイ where it should and オウ nowhere it
    should not. The trade is `kana` also spells は/へ/を as WRITTEN
    rather than SAID (ハ, not the ワ a listener hears) -- _SAID_KANA
    above corrects exactly those three, the same particle-only case
    to_romaji's own _PARTICLE table exists for, and a second, narrower
    one below corrects 日 after よう/曜 (日曜日, and 土よう日 where a
    level cap has swapped 曜 for hiragana): the tokenizer does not treat
    either spelling of a weekday name as one word, so it reads a
    trailing bare 日 standalone (ひ) rather than with the rendaku a real
    〜曜日 always takes (び).

    Word spacing does not come from pykakasi either -- handed a bare
    kana string it cannot space words at all (see
    content/listening_clips.py's note on why ITS romaji is hand-written
    rather than generated from `kana` for exactly this reason) -- but
    from the morphemes' own grammar, grouped before any of it reaches
    pykakasi:
      * an auxiliary or suffix (ました, 十本の本) glues onto the word
        before it
      * a 接続助詞 -- a particle joining a verb/adjective onto what
        follows (て/で in 読んで, 大きくて) -- glues the same way; a
        case particle spelled identically (電車で "by train") does not,
        because UniDic tags the two differently
      * a number glues onto the counter right after it (六 + 時 ->
        "rokuji"), and so does anything else that glues two nouns into
        one written word
      * a trailing っ/ッ is never left to end a group on its own, since
        it geminates whatever comes next (行っ + て read apart would
        give "itsu te" instead of "itte")
    Everything else starts a new word, which is what a case particle,
    an unrelated noun or a fresh verb should do anyway.
    """
    from study import morphology  # see furigana.py's own note: MeCab is
    # a 250MB optional dependency callers who already have the reading
    # (dictation, which hand-writes it) never need to pay for.

    morphemes = morphology.tokenize(text)
    if morphemes is None:
        return to_romaji(text)

    groups: list[list[tuple]] = []
    force_glue = False
    for m in morphemes:
        kana = m.kana
        if m.pos == "particle" and m.surface in _SAID_KANA:
            kana = _SAID_KANA[m.surface]
        elif (
            m.surface == "日" and kana == "ヒ"
            and groups and groups[-1][-1][1].endswith("ヨウ")
        ):
            kana = "ビ"

        glue = force_glue or (
            bool(groups) and (
                m.pos in ("auxiliary", "suffix")
                or m.conjunctive
                or (groups[-1][-1][0].pos == "noun" and m.pos == "noun")
            )
        )
        if glue:
            groups[-1].append((m, kana))
        else:
            groups.append([(m, kana)])
        force_glue = kana[-1:] in ("っ", "ッ")

    words: list[str] = []
    for g in groups:
        chunk = "".join(kana for _, kana in g)
        h = "".join(item["hepburn"] for item in _kakasi.convert(chunk) if item["hepburn"])
        if not h:
            continue
        if words and (h[0] in _NO_SPACE_BEFORE or words[-1][-1] in _NO_SPACE_AFTER):
            words[-1] += h
        else:
            words.append(h)
    return " ".join(words)


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
