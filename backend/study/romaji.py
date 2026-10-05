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


# ── The reading in context, the furigana's (plan 184) ──
# UniDic reads word by word, and some readings are decided by the word
# beside it: 十本 じゅっぽん, 九時 くじ, 明日 あした, 日本 にほん, 何を
# なに, 世界中 じゅう, お母さん かあ. study/reading_context.py puts them
# right, and morphology.tokenize hands the result on as each morpheme's
# `reading` -- the furigana over every sentence the app prints. This
# module romanized UniDic's raw `kana` instead, with a table of its own
# for two counters (時 and 分), so the romaji under a sentence could
# disagree with the reading over it: "juupon" under じゅっぽん, "asu"
# under あした, "nippongo" under にほんご, "6pon" under ろっぽん.
#
# So the romaji reads what the furigana reads: a word written with a
# kanji takes its `reading` in context (spelled out as the furigana spells
# it, おおきい and not おうきい: see morphology._spelled_reading), and a
# number written in digits the reading study/furigana gives it with its
# counter (plan 177: 6本 ろっぽん, 100円 ひゃくえん, 3日 みっか). A word
# written in kana keeps its own spelling, `kana`.


def _katakana(hira: str) -> str:
    return "".join(chr(ord(c) + 0x60) if "ぁ" <= c <= "ゖ" else c for c in hira)


def _kana_in_context(morphemes) -> list[tuple]:
    """[(morpheme, kana)] for the sentence, the kana each is romanized
    from: its reading in context where it is written with a kanji, its
    own spelling where it is written in kana, and a number in digits
    joined with its counter into one, read as the furigana reads it."""
    from dataclasses import replace

    from study import furigana

    spans = furigana._number_spans(morphemes)
    out: list[tuple] = []
    i = 0
    while i < len(morphemes):
        numbered = furigana._numeral_parts(morphemes, i, spans[i]) if i in spans else None
        if numbered is not None:
            parts, i_next = numbered
            surface = "".join(m.surface for m in morphemes[i:i_next])
            kana = _katakana("".join(p.get("reading") or p["text"] for p in parts))
            out.append((replace(morphemes[i], surface=surface, pos="noun", conjunctive=False), kana))
            i = i_next
            continue
        m = morphemes[i]
        kana = m.kana
        if _KANJI.search(m.surface) and m.reading and not _KANJI.search(m.reading):
            kana = _katakana(m.reading)
        out.append((m, kana))
        i += 1
    return out


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
    to_romaji's own _PARTICLE table exists for. A word written with a
    kanji is romanized from its reading in context instead -- the
    furigana's, put right by study/reading_context.py: 九時 くじ, 十本
    じゅっぽん, 日曜日 にちようび, 明日 あした -- and a number in digits
    from the reading the furigana gives it (_kana_in_context above).

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
      * a prefix glues onto the word after it (お母さん -> "okaasan")
      * a trailing っ/ッ is never left to end a group on its own, since
        it geminates whatever comes next (行っ + て read apart would
        give "itsu te" instead of "itte")
    Everything else starts a new word, which is what a case particle,
    an unrelated noun or a fresh verb should do anyway.
    """
    words = sentence_words(text)
    if words is None:
        return to_romaji(text)
    return " ".join(w["romaji"] for w in words)


def _hiragana(kana: str) -> str:
    return "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in kana)


_KANJI = re.compile(r"[\u3400-\u9fff\uf900-\ufaff々〆ヶ]")


def _written(surface: str, kana: str) -> str:
    """A morpheme's reading as a learner is shown it: a word written
    with a kanji read in hiragana, one written in kana as it is written
    (コーヒー stays in katakana, the particle は stays は)."""
    return _hiragana(kana) if _KANJI.search(surface) else surface


def sentence_words(text: str) -> list[dict] | None:
    """The words sentence_romaji spaces, each with its place in the
    sentence (plan 184): `text`, the characters it is written with --
    every word's text, in order, spelling the sentence back exactly --
    its reading as written in hiragana (`kana`; は, not the わ a
    listener hears) and its `romaji` as sentence_romaji prints it. The
    practice card reads a learner's romaji against these words, so a
    miss can be underlined where it stands in the Japanese and the word
    missed named with its reading.

    A mark or a symbol the romanizer leaves out joins the word before it
    (the 。 of a sentence's end), or the next one at the start. None when
    the tokenizer is not installed, or when its words do not spell the
    sentence back (a space it dropped): a caller that cannot place a
    word places none rather than the wrong one.
    """
    from study import morphology  # see furigana.py's own note: MeCab is
    # a 250MB optional dependency callers who already have the reading
    # (dictation, which hand-writes it) never need to pay for.

    morphemes = morphology.tokenize(text)
    if morphemes is None:
        return None

    # Each morpheme with its kana as SAID: は is wa, and a word written
    # with a kanji read in context (_kana_in_context). The reading a
    # learner is shown is the written one, worked out at the end.
    groups: list[list[list]] = []
    force_glue = False
    for m, kana in _kana_in_context(morphemes):
        if m.pos == "particle" and m.surface in _SAID_KANA:
            kana = _SAID_KANA[m.surface]

        glue = force_glue or (
            bool(groups) and (
                m.pos in ("auxiliary", "suffix")
                or m.conjunctive
                or (groups[-1][-1][0].pos == "noun" and m.pos == "noun")
                # A prefix is half a word: お母さん okaasan, ご飯 gohan.
                or groups[-1][-1][0].pos == "prefix"
            )
        )
        if glue:
            groups[-1].append([m, kana])
        else:
            groups.append([[m, kana]])
        force_glue = kana[-1:] in ("っ", "ッ")

    words: list[dict] = []
    lead = ""
    for g in groups:
        surface = "".join(m.surface for m, _ in g)
        chunk = "".join(kana for _, kana in g)
        written = "".join(_written(m.surface, kana) for m, kana in g)
        h = "".join(item["hepburn"] for item in _kakasi.convert(chunk) if item["hepburn"])
        if not h:
            if words:
                words[-1]["text"] += surface
            else:
                lead += surface
            continue
        if words and (h[0] in _NO_SPACE_BEFORE or words[-1]["romaji"][-1] in _NO_SPACE_AFTER):
            words[-1]["text"] += surface
            words[-1]["kana"] += written
            words[-1]["romaji"] += h
        else:
            words.append({"text": lead + surface, "kana": written, "romaji": h})
            lead = ""
    if not words or "".join(w["text"] for w in words) + lead != text:
        return None
    if lead:
        words[-1]["text"] += lead
    return words


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


# ── The other way: a sentence typed in romaji, read back as kana ──
# 作文 (composition) takes a sentence the learner WROTE, and most
# learners write it in the alphabet (the note at the top). The
# breakdown and the grammar detector read Japanese and nothing else:
# handed "mizu to gohan wo tabemashita" the breakdown drew five rows of
# Latin letters with no card and no rule, and the detector said the
# point was not there. The tutor writes the sentence out in kanji and
# kana (routes/composition.py); this is what stands in for it when
# there is no tutor to ask -- the day's reviews spent, no provider, a
# failed call -- and what the free check reads meanwhile.
#
# Kana only: which kanji a learner meant is a guess this module has no
# way to make, and the tokenizer reads みずとごはんをたべました well
# enough to find the particles, the verb and its ending. The syllable
# table is the dictionary search's (study/search_match.to_kana), which
# already takes both romanizations; what a SENTENCE adds is its
# particles, written as they are said (wa, wo/o, e), and its marks.
_JAPANESE = re.compile(r"[぀-ヿ㐀-鿿豈-﫿ｦ-ﾟ]")
_KANA_PARTICLES = {"wa": "は", "wo": "を", "o": "を", "e": "へ", "he": "へ"}
_KANA_MARKS = {".": "。", ",": "、", "?": "？", "!": "！"}
_SENTENCE_PIECE = re.compile(r"([^\W\d_](?:[^\W\d_]|['’\-](?=[^\W\d_]))*)|([.,?!])|(\S)")
# Tanaka-san: a hyphen before a title joins it, where in ra-men it is
# the long vowel.
_TITLES = {"san", "sama", "kun", "chan", "sensei", "senpai"}


def is_romaji(text: str) -> bool:
    """Whether a sentence is written in the alphabet: letters, and not a
    single kana or kanji among them."""
    if not isinstance(text, str) or _JAPANESE.search(text):
        return False
    return any(c.isalpha() for c in text)


def _word_kana(word: str) -> str | None:
    from study.search_match import _ROMAJI, fold as latin, to_kana

    # kon'nichiwa: the apostrophe only closes the ん, where
    # "konnichiwa" would have to guess; ra-men's hyphen is its long vowel.
    pieces = re.split(r"([-'’])", latin(word))
    out = ""
    for i in range(0, len(pieces), 2):
        part = pieces[i]
        kana = _ROMAJI.get(part) if len(part) == 1 else (to_kana(part) or (None,))[0]
        if kana is None:
            return None
        joint = pieces[i - 1] if i else ""
        out += ("ー" if joint == "-" and part not in _TITLES else "") + kana
    return out or None


def kana_of(text: str) -> str | None:
    """A sentence typed in romaji as hiragana, with no spaces, or None
    when it is not romaji, or when no word of it reads as kana. A word
    that does not (a name, an English word) is kept as typed."""
    if not is_romaji(text):
        return None
    out = []
    read = 0
    for word, mark, other in _SENTENCE_PIECE.findall(text):
        if mark:
            out.append(_KANA_MARKS[mark])
            continue
        if other:
            out.append(other)
            continue
        # A particle is a word of its own after another word: は, not わ.
        particle = _KANA_PARTICLES.get(word.lower()) if out else None
        kana = particle or _word_kana(word)
        if kana is None:
            out.append(word)
            continue
        out.append(kana)
        read += 1
    return "".join(out) if read else None
