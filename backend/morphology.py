"""
Thin shared wrapper around a real Japanese morphological analyzer
(fugashi, wrapping MeCab, + the unidic-lite dictionary), used by both
card_lookup.py (word/particle segmentation for reading-practice badges)
and vocab_extras.py (furigana generation for card-detail example
sentences).

WHY THIS EXISTS (2026-08): both call sites previously did dictionary-
substring matching — a greedy longest-match scan against the deck's own
kanji/kana spellings in card_lookup.py, and a similar longest-match
lookup with a per-character kanji-reading fallback for furigana in
vocab_extras.py. Both are fundamentally guessing at word boundaries and
readings without any notion of Japanese grammar, and that breaks down
constantly on ordinary sentences, not just edge cases:

  - A conjugated verb/adjective doesn't literally contain its
    dictionary form (要る -> いらない, 温い -> ぬるい), so exact/variant
    substring matching either misses it or needs an ever-growing pile
    of special-cased spelling variants to catch up.
  - A topic particle can combine with the start of the next word to
    spell out an unrelated word by coincidence (お金は|いらない
    matching はい "yes"; ち|また|では matching また "again" inside 巷).
  - The exact same string can be two different words depending on
    context (今日は = "today" + topic particle in most sentences, but
    also the fixed greeting こんにちは when written with those kanji —
    telling them apart needs to look at what's around it, not just
    the string itself).
  - A single kanji can have a completely different reading depending
    on whether it's a standalone noun or a verb stem (上 as うえ "top"
    vs. the のぼ- in 上る "to climb") — no per-character reading table
    can get both right, because both are correct in different contexts.

No amount of extra hand-written heuristics closes all of these — they
need actual part-of-speech-aware tokenization, which is what a real
morphological analyzer (MeCab, here) exists to do.

DEPLOY WEIGHT: fugashi+unidic-lite is ~250MB on disk, which sounds like
exactly the kind of thing vocab_jmdict_data.py's own docstring warns
against for a memory-constrained deploy — but it is NOT the same
problem. That earlier issue was eagerly parsing ~30MB of JSON into
several times that much in live Python objects, all resident in RAM at
once. MeCab's dictionary is an on-disk binary trie that gets
memory-mapped and paged in on demand; measured RSS overhead after
loading the tagger is on the order of single-digit MB, not hundreds.
The disk/build-image weight is real (github/pip download size, image
layer size) but that's a different budget than the runtime-memory one
vocab_jmdict_data.py was fixing.

GRACEFUL DEGRADATION: this module is written so neither caller has a
hard dependency on it. MORPHOLOGY_AVAILABLE is False if fugashi/
unidic-lite aren't installed (or fail to load for any reason), and both
card_lookup.py and vocab_extras.py fall back to their previous
substring-matching logic in that case — worse results, but the app
still runs. `pip install fugashi unidic-lite` to enable this.

Public surface:
    MORPHOLOGY_AVAILABLE: bool
    tokenize(text) -> list[Morpheme] | None  (None if unavailable, or
        if this specific call failed — MeCab is generally very robust,
        but callers should treat None as "fall back", not "crash")
    Morpheme: surface, start, end, lemma, reading, lemma_reading, pos
        - surface: literal text of this token as it appears
        - start/end: character offsets into the ORIGINAL text
        - lemma: dictionary (base) form, e.g. "上る" for surface "上れ"
        - reading: hiragana reading of `surface` AS INFLECTED (のぼれ)
        - lemma_reading: hiragana reading of `lemma`, i.e. of the
          DICTIONARY form (のぼる) — this is what should be compared
          against a deck entry's own kana field, since that field is
          always the dictionary-form reading too
        - pos: coarse part-of-speech ("verb", "particle", "noun", ...)
"""
import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

try:
    import fugashi
    _tagger = fugashi.Tagger()
    MORPHOLOGY_AVAILABLE = True
except Exception:  # pragma: no cover - defensive only, always present in prod
    _tagger = None
    MORPHOLOGY_AVAILABLE = False
    logger.warning(
        "fugashi/unidic-lite not available — falling back to substring-"
        "based matching in card_lookup.py / vocab_extras.py. "
        "`pip install fugashi unidic-lite` to enable real tokenization."
    )


# ── Katakana -> hiragana, including the long-vowel mark ──────
# fugashi/UniDic readings come back in katakana. A plain per-character
# shift (アイウエオ -> あいうえお) is wrong for the katakana long-vowel
# mark ー: native Japanese words spell a long vowel by repeating the
# actual vowel kana (今日 -> きょう, not きょー), so ー needs to resolve
# to whichever hiragana vowel continues the sound of the kana before
# it. This table is the standard gojuon-row -> vowel mapping; げ/え-row
# long vowels are conventionally written い in most native words
# (けい not けー) and お-row long vowels conventionally う (がっこう
# not がっこお), so those are what ー resolves to here. Real orthography
# has a handful of native-word exceptions to the え/お rule (お姉さん),
# too small and irregular to be worth encoding — this is the right
# default in the overwhelming majority of cases.
_A_DAN = "あかさたなはまやらわがざだばぱゃゎ"
_I_DAN = "いきしちにひみりぎじぢびぴ"
_U_DAN = "うくすつぬふむゆるぐずづぶぷゅっ"
_E_DAN = "えけせてねへめれげぜでべぺ"
_O_DAN = "おこそとのほもよろごぞどぼぽょ"

_VOWEL_OF = {}
for _ch in _A_DAN:
    _VOWEL_OF[_ch] = "あ"
for _ch in _I_DAN:
    _VOWEL_OF[_ch] = "い"
for _ch in _U_DAN:
    _VOWEL_OF[_ch] = "う"
for _ch in _E_DAN:
    _VOWEL_OF[_ch] = "い"
for _ch in _O_DAN:
    _VOWEL_OF[_ch] = "う"


def kata_to_hira(s: str) -> str:
    out = []
    for c in s or "":
        if c == "\u30fc":  # ー, katakana-hiragana prolonged sound mark
            prev = out[-1] if out else None
            out.append(_VOWEL_OF.get(prev, "\u30fc"))
            continue
        if "\u30a1" <= c <= "\u30f6":
            out.append(chr(ord(c) - 0x60))
        else:
            out.append(c)
    return "".join(out)


_POS_MAP = {
    "動詞": "verb", "形容詞": "adjective", "名詞": "noun",
    "助詞": "particle", "助動詞": "auxiliary", "副詞": "adverb",
    "連体詞": "adnominal", "接続詞": "conjunction", "感動詞": "interjection",
    "接頭辞": "prefix", "接尾辞": "suffix", "代名詞": "pronoun",
    "補助記号": "symbol", "記号": "symbol", "フィラー": "filler",
}


@dataclass
class Morpheme:
    surface: str
    start: int
    end: int
    lemma: str
    reading: str        # hiragana reading of `surface`, as inflected
    lemma_reading: str  # hiragana reading of `lemma` (dictionary form)
    pos: str
    auxiliary_use: bool  # True when UniDic marks this token's usage as
    # grammaticalized/non-independent (pos2 == 非自立可能) — e.g. 居る
    # used as the ~ている progressive marker rather than as the
    # standalone verb "to exist". Reading-based (as opposed to
    # lemma-text-based) deck matching should generally skip these: a
    # bare reading alone can't disambiguate real homophones (要る vs
    # 居る, both いる), and the auxiliary use of a verb is both far more
    # frequent in ordinary text than its independent use AND the case
    # where getting the wrong homophone is most visible/confusing, so
    # this flag lets callers stay conservative there while still
    # trusting reading-based matches for words actually being used on
    # their own (あなた, 上る/上れ, etc., which are pos2 "*"/"一般").


def _clean_lemma(raw: str, fallback: str) -> str:
    """UniDic sometimes suffixes a lemma with "-<gloss>" for loanwords
    (コーヒー-coffee) or an alternate-reading disambiguator — the part
    before the first "-" is the actual dictionary-form text we want to
    compare against a deck's kanji field. "-" isn't a Japanese
    character, so splitting on it is safe."""
    if not raw:
        return fallback
    return raw.split("-", 1)[0] or fallback


def tokenize(text: str) -> list[Morpheme] | None:
    """Full-sentence tokenization, or None if the analyzer isn't
    available (see MORPHOLOGY_AVAILABLE) or this specific call failed.
    Callers must have a fallback path for the None case — MeCab is
    robust, but this is deliberately not treated as something that
    should ever raise into caller code."""
    if not MORPHOLOGY_AVAILABLE or not text:
        return None
    try:
        morphemes = []
        cursor = 0
        for w in _tagger(text):
            surface = w.surface
            start = cursor
            end = cursor + len(surface)
            cursor = end
            feat = w.feature
            pron = getattr(feat, "pron", None) or getattr(feat, "kana", None) or ""
            lform = getattr(feat, "lForm", None) or pron
            lemma = _clean_lemma(getattr(feat, "lemma", None), surface)
            pos1 = getattr(feat, "pos1", None)
            pos2 = getattr(feat, "pos2", None)
            morphemes.append(Morpheme(
                surface=surface,
                start=start,
                end=end,
                lemma=lemma,
                reading=kata_to_hira(pron) or surface,
                lemma_reading=kata_to_hira(lform) or lemma,
                pos=_POS_MAP.get(pos1, "other"),
                auxiliary_use=(pos2 == "非自立可能"),
            ))
        return morphemes
    except Exception:  # pragma: no cover - defensive only
        logger.warning("morphology.tokenize failed on input; caller should fall back", exc_info=True)
        return None