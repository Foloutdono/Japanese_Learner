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
        - reading: hiragana reading of `surface` AS INFLECTED (のぼれ),
          spelled rather than pronounced where it has a kanji (大きい
          おおきい, not おうきい) and put right in context (お母さん's
          母 かあ, 一本 いっぽん; study/reading_context.py)
        - lemma_reading: hiragana reading of `lemma`, i.e. of the
          DICTIONARY form (のぼる) — this is what should be compared
          against a deck entry's own kana field, since that field is
          always the dictionary-form reading too
        - pos: coarse part-of-speech ("verb", "particle", "noun", ...)
        - ctype / cform: UniDic's conjugation type and form, as
          written ("下一段-マ行", "意志推量形"), "" where the token does
          not conjugate. What tells 読める (読む conjugating as 下一段,
          the potential) from 食べる, and names the volitional and the
          imperative -- study/grammar_detect's second pass reads them.
"""
import logging
from dataclasses import dataclass
from functools import lru_cache

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


def _with_kana_lexicon(plain):
    """The tagger with the deck's kana spellings beside UniDic (plan 272,
    study/kana_lexicon.py): としょかん one word, 図書館's, where UniDic
    alone cut it into と + しょ + かん. The plain tagger where the user
    dictionary cannot be made -- the tokenizer as it was, never none."""
    import os

    try:
        from study import kana_lexicon

        dicdir = os.path.dirname(plain.dictionary_info[0]["filename"])
        path = kana_lexicon.build(plain, dicdir)
        if path:
            return fugashi.Tagger(f"-u {path}")
    except Exception:  # pragma: no cover - defensive only
        logger.warning("kana lexicon unavailable; UniDic alone", exc_info=True)
    return plain


# UniDic alone: what the kana lexicon is built from, and what a caller
# that must see the dictionary's own reading asks (kana_lexicon.rows).
_plain_tagger = _tagger
if MORPHOLOGY_AVAILABLE:
    _tagger = _with_kana_lexicon(_plain_tagger)


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
    # A space (空白): the full-width one a lyric or a subtitle writes
    # between its phrases is a mark, never a word (plan 272).
    "空白": "symbol",
}


@dataclass
class Morpheme:
    surface: str
    start: int
    end: int
    lemma: str
    reading: str        # hiragana reading of `surface`, as inflected
    lemma_reading: str  # hiragana reading of `lemma` (dictionary form)
    kana: str           # `surface` spelled out in katakana AS WRITTEN,
    # long vowels included -- unlike `reading`, which is the sound
    # (kata_to_hira's ー resolves to the row's usual vowel), this keeps
    # each word's own real spelling: 大きい keeps オオキイ (おお, a native-
    # word exception to that usual row) where 学校 keeps ガッコウ (おう).
    # study/romaji.py romanizes off this rather than `reading` for
    # exactly that reason; card-matching callers want the sound, not the
    # spelling, so they stay on `reading`/`lemma_reading`.
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
    conjunctive: bool  # True for a 接続助詞 -- a particle that joins a verb
    # or adjective onto what follows it (て/で in 読んで, 大きくて) rather
    # than marking a noun's role in the sentence, which is the SAME
    # surface text tagged differently (で is 格助詞 "by train" in 電車で,
    # 接続助詞 in 読んで). study/romaji.py glues one of these onto the
    # word before it when building a word-spaced reading; a case particle
    # stays its own word either way.
    ctype: str = ""  # UniDic's cType, the conjugation class: 五段-カ行,
    # 下一段-マ行, 助動詞-レル. A verb whose dictionary form is 五段 but
    # conjugates as 下一段 is the potential (読める, lemma 読む) -- the
    # one thing that tells it from a plain 下一段 verb (食べる).
    cform: str = ""  # UniDic's cForm, the conjugation form: 連用形-一般,
    # 意志推量形 (帰ろう), 命令形 (起きろ). Both "" for a word that does
    # not conjugate, where UniDic writes "*".
    goshu: str = ""  # UniDic's 語種, where the word comes from: 和 (native),
    # 漢 (Sino-Japanese), 外 (a loanword), 混 (mixed). センス is 外 and
    # 扇子 is 漢: a reading alone joins them, the origin does not (plan
    # 149). ダメ and キレイ, native words written in katakana, stay 混／漢.
    proper: bool = False  # UniDic's 固有名詞: a name, of a person or a
    # place. JMdict, the pool, files almost none, so the commonest row of
    # a name's spelling is another word (plan 236: 博 read ひろし is no 博
    # read はく, "doctor").
    name_kind: str = ""  # Which name a 固有名詞 is, read off UniDic's
    # pos3 and pos4 (plan 266): "family" (人名-姓, 田中), "given"
    # (人名-名, ゆき), "person" (人名-一般, マルタン), "place" (地名,
    # 新宿) or "other" (ポチ); "" for any other word. What a breakdown
    # says of a name the course has no card for.
    counter: bool = False  # UniDic's 助数詞 or 助数詞可能 (pos3): a word that
    # counts what a number before it numbers -- 回, 枚, 円, 年 (plan 272).
    unknown: bool = False  # Letters the dictionary has no word for (plan
    # 272): MeCab's own unknown word (a katakana name it never met), or a
    # stretch of kana it cut into marks and stray letters, read back as
    # the one word it is (_unknown_words: ぷらそにか, a choir's name, was
    # ぷ + ら + そ + に + か). Most often a name.
    adjectival: bool = False  # UniDic's 形状詞可能 (pos3): a noun that is a
    # な-adjective too -- 残酷, 楽, 元気 -- whose で before a comma is the
    # adjective's て form (plan 272).


def _name_kind(pos2: str, pos3: str, pos4: str) -> str:
    if pos2 != "固有名詞":
        return ""
    if pos3 == "人名":
        return {"姓": "family", "名": "given"}.get(pos4, "person")
    return "place" if pos3 == "地名" else "other"


def _conjugation(raw) -> str:
    """UniDic writes "*" where a field does not apply; "" is what a
    caller can test for."""
    return "" if not raw or raw == "*" else str(raw)


def _clean_lemma(raw: str, fallback: str) -> str:
    """UniDic sometimes suffixes a lemma with "-<gloss>" for loanwords
    (コーヒー-coffee) or an alternate-reading disambiguator — the part
    before the first "-" is the actual dictionary-form text we want to
    compare against a deck's kanji field. "-" isn't a Japanese
    character, so splitting on it is safe."""
    if not raw:
        return fallback
    return raw.split("-", 1)[0] or fallback


_DEMONSTRATIVES = frozenset({"この", "その", "あの", "どの"})


def _demonstratives(morphemes: list[Morpheme]) -> None:
    """UniDic tags a sentence's first あの as the interjection "um"
    even before a noun: あの店に行った, あの人はだれですか, あの高い山.
    Before a noun, or an adjective on one, it is the demonstrative,
    whatever opens the sentence -- the "um" is set off (あの、すみません)
    or goes before a verb (あのすみません) (plan 151)."""
    for m, nxt in zip(morphemes, morphemes[1:]):
        if (m.pos == "interjection" and m.surface in _DEMONSTRATIVES
                and nxt.pos in ("noun", "pronoun", "prefix", "suffix", "other", "adjective", "adnominal")):
            m.pos = "adnominal"


def _picture(morphemes: list[Morpheme]) -> None:
    """え read as the interjection "eh?" where it is a noun (plan 272):
    だれがこのえをかいたか is 絵, "picture" -- after この, or before the を
    or が a noun takes. Never the え that opens an utterance or a reply
    (え、本当？)."""
    for k, m in enumerate(morphemes):
        if m.pos != "interjection" or m.surface != "え":
            continue
        before = morphemes[k - 1] if k > 0 else None
        nxt = morphemes[k + 1] if k + 1 < len(morphemes) else None
        if (before is not None and before.pos == "adnominal") or (
                nxt is not None and nxt.pos == "particle" and nxt.surface in ("を", "が")):
            m.pos, m.lemma, m.reading, m.lemma_reading, m.goshu = "noun", "絵", "え", "え", "漢"


# A noun of one kana a first-year page writes in kana (plan 272), read as
# a mark, a particle or a rarer word by UniDic: はがいたい (歯), てをあらう
# (手), きのした (木), ひがくれる (日), めがいたい (目). The commonest noun
# spelled so, and where another is as plain, the one the words beside it
# name: (kanji, reading, the words that name it).
_ONE_KANA_NOUNS = {
    "は": (("葉", frozenset({"木", "き", "緑", "みどり", "落ちる", "おちる", "秋", "あき", "赤い", "あかい", "黄色い",
                            "きいろい", "枯れる", "かれる", "散る", "ちる"})), ("歯", None)),
    "め": (("目", None),),
    "て": (("手", None),),
    "き": (("気", frozenset({"つける", "付ける", "つけ", "する", "し", "なる", "なっ", "なり", "つく", "付く", "つい",
                            "使う", "つかう", "入る", "いる", "合う", "あう", "楽", "らく", "短い", "長い", "強い", "弱い",
                            "小さい", "大きい"})), ("木", None)),
    "ひ": (("火", frozenset({"つける", "つけ", "消す", "けす", "けし", "けして", "燃える", "もえる", "もえ", "あつい",
                            "熱い", "ストーブ", "たばこ", "ガス", "マッチ"})), ("日", None)),
    "ち": (("血", None),),
    "け": (("毛", None),),
    "せ": (("背", None),),
}
_ONE_KANA_AFTER = frozenset({"が", "を", "に", "で", "の", "は", "も", "と", "へ", "から", "まで"})

# Nouns in kana UniDic reads as a form of a verb before a case particle,
# which no such form takes (plan 272): いえにきた is 家, never 言える.
_KANA_NOUN_NOT_VERB = {"いえ": "家"}


def _one_kana_nouns(morphemes: list[Morpheme]) -> None:
    """A noun of one kana UniDic read as something else, read back as the
    noun (_ONE_KANA_NOUNS) where only a noun can stand: before a case
    particle, and after the start, a mark, この or a noun's の -- a
    particle stacks on neither (は + が, て + を)."""
    for k, m in enumerate(morphemes):
        if m.surface in _KANA_NOUN_NOT_VERB and m.pos == "verb" and k + 1 < len(morphemes) \
                and morphemes[k + 1].pos == "particle" and morphemes[k + 1].surface in _ONE_KANA_AFTER \
                and _glued(m, morphemes[k + 1]):
            m.pos, m.lemma, m.reading, m.lemma_reading = "noun", _KANA_NOUN_NOT_VERB[m.surface], m.surface, m.surface
            m.ctype, m.cform, m.goshu, m.auxiliary_use = "", "", "和", False
            continue
        if m.surface not in _ONE_KANA_NOUNS or k + 1 >= len(morphemes):
            continue
        nxt = morphemes[k + 1]
        if nxt.pos != "particle" or nxt.surface not in _ONE_KANA_AFTER or not _glued(m, nxt):
            continue
        before = morphemes[k - 1] if k > 0 else None
        if not (before is None or before.pos in ("symbol", "adnominal")
                or (before.surface == "の" and before.pos == "particle")
                # (After an adjective, a noun it describes: あかいはが. Never
                # て, the particle after a predicate wherever MeCab cut it.)
                or (before.pos in ("verb", "adjective") and before.cform.startswith(("連体形", "終止形"))
                    and m.surface != "て")):
            continue
        words = {w for u in morphemes for w in (u.surface, u.lemma) if u is not m}
        kanji = next(kj for kj, partners in _ONE_KANA_NOUNS[m.surface] if partners is None or partners & words)
        if m.pos == "noun" and m.lemma == kanji:
            continue
        m.pos, m.lemma, m.reading, m.lemma_reading, m.goshu = "noun", kanji, m.surface, m.surface, "和"
        m.kana = chr(ord(m.surface) + 0x60)


def _notice(morphemes: list[Morpheme], tags: list[tuple]) -> tuple[list, list]:
    """きがつく, "to notice", read as 飢餓, "starvation", and the verb
    (plan 272): the idiom 気がつく written in kana, き and が."""
    from dataclasses import replace

    out, out_t = [], []
    for k, m in enumerate(morphemes):
        nxt = morphemes[k + 1] if k + 1 < len(morphemes) else None
        if (m.surface == "きが" and m.lemma == "飢餓" and nxt is not None and nxt.pos == "verb"
                and nxt.lemma_reading == "つく"):
            out.append(replace(m, surface="き", end=m.start + 1, lemma="気", reading="き", lemma_reading="き",
                               kana="キ", goshu="漢"))
            out.append(replace(m, surface="が", start=m.start + 1, lemma="が", reading="が", lemma_reading="が",
                               kana="ガ", pos="particle", goshu="和", ctype="", cform=""))
            out_t += [("名詞", "普通名詞", "一般"), ("助詞", "格助詞", "")]
            continue
        if (m.surface == "けして" and m.pos == "adverb" and k > 0 and morphemes[k - 1].surface == "を"):
            # 火をけして is 消して, never 決して, "never": an adverb takes no を.
            out.append(replace(m, surface="けし", end=m.start + 2, pos="verb", lemma="消す", reading="けし",
                               lemma_reading="けす", kana="ケシ", ctype="五段-サ行", cform="連用形-一般", goshu="和"))
            out.append(replace(m, surface="て", start=m.start + 2, pos="particle", lemma="て", reading="て",
                               lemma_reading="て", kana="テ", ctype="", cform="", goshu="和", conjunctive=True))
            out_t += [("動詞", "一般", ""), ("助詞", "接続助詞", "")]
            continue
        out.append(m)
        out_t.append(tags[k])
    return out, out_t


# Where it hurts: a part of the body, which 痛い says of it.
_BODY = frozenset({"あたま", "頭", "おなか", "お腹", "はら", "腹", "は", "歯", "のど", "喉", "あし", "足", "め", "目",
                   "みみ", "耳", "て", "手", "こし", "腰", "せなか", "背中", "むね", "胸", "かた", "肩", "うで", "腕",
                   "ひざ", "膝", "からだ", "体", "きず", "傷", "ゆび", "指", "くび", "首", "かお", "顔"})
_PAIN_FORMS = {"たい": ("いたい", "終止形-一般"), "たく": ("いたく", "連用形-一般"),
               "たかっ": ("いたかっ", "連用形-促音便"), "たけれ": ("いたけれ", "仮定形-一般")}


def _pain(morphemes: list[Morpheme], tags: list[tuple]) -> tuple[list, list]:
    """痛い in kana read as 居る + たい, "to want to be" (plan 272):
    あたまがいたかった is "my head hurt", never "the head wanted to be".
    Only after a part of the body and its が, は or も."""
    from dataclasses import replace

    out, out_t = [], []
    k = 0
    while k < len(morphemes):
        m = morphemes[k]
        nxt = morphemes[k + 1] if k + 1 < len(morphemes) else None
        if (m.surface == "い" and m.pos == "verb" and m.lemma == "居る" and nxt is not None
                and nxt.pos == "auxiliary" and nxt.surface in _PAIN_FORMS and k >= 2
                and morphemes[k - 1].surface in ("が", "は", "も") and morphemes[k - 2].surface in _BODY):
            surface, cform = _PAIN_FORMS[nxt.surface]
            out.append(replace(m, surface=surface, end=nxt.end, pos="adjective", lemma="痛い", reading=surface,
                               lemma_reading="いたい", kana="".join(chr(ord(c) + 0x60) for c in surface),
                               ctype="形容詞", cform=cform, auxiliary_use=False, goshu="和"))
            out_t.append(("形容詞", "一般", ""))
            k += 2
            continue
        out.append(m)
        out_t.append(tags[k])
        k += 1
    return out, out_t


# The endings a verb's stem takes, which never follow the particle ね
# (plan 272), and the form of 寝る each asks.
_SLEEP_ENDINGS = {"ます": "連用形-一般", "まし": "連用形-一般", "ませ": "連用形-一般", "ましょう": "連用形-一般",
                  "た": "連用形-一般", "たら": "連用形-一般", "たり": "連用形-一般", "たい": "連用形-一般",
                  "たく": "連用形-一般", "たかっ": "連用形-一般", "なさい": "連用形-一般"}


def _sleep(morphemes: list[Morpheme], tags: list[tuple]) -> tuple[list, list]:
    """寝る written in kana after an adverb, read as the particle ね and an
    ending (plan 272): 早くねます is ね + ます to UniDic, 早くねよう ね + よ +
    う, はやくねなさい ね + なさる -- and a particle takes no verb's ending.
    The ね is 寝る, "to go to bed", in the form its ending asks; よう after
    it is the volitional (寝よう, "let's sleep")."""
    from dataclasses import replace

    out, out_t = list(morphemes), list(tags)
    for i, m in enumerate(out[:-1]):
        nxt = out[i + 1]
        if (m is not None and m.surface == "ない" and m.pos == "adjective" and m.lemma == "無い"
                and m.cform.startswith("終止形") and nxt is not None and _glued(m, nxt)
                and ((nxt.surface == "て" and nxt.pos == "particle") or (nxt.surface == "た" and nxt.pos == "auxiliary"))):
            # 泣いて, 泣いた written in kana: ない + て to UniDic, and ない's
            # own forms are なくて and なかった (plan 272).
            out[i] = replace(m, pos="verb", lemma="泣く", reading="ない", lemma_reading="なく", ctype="五段-カ行",
                             cform="連用形-イ音便", goshu="和")
            out_t[i] = ("動詞", "一般", "")
            continue
        if m is None or m.surface != "ね" or m.pos != "particle" or out[i + 1] is None or not _glued(m, out[i + 1]):
            continue
        nxt = out[i + 1]
        if nxt.surface in _SLEEP_ENDINGS and nxt.pos in ("auxiliary", "verb"):
            out[i] = replace(m, pos="verb", lemma="寝る", reading="ね", lemma_reading="ねる", kana="ネ",
                             ctype="下一段-ナ行", cform=_SLEEP_ENDINGS[nxt.surface], goshu="和")
            out_t[i] = ("動詞", "一般", "")
        elif nxt.surface == "よう" and nxt.pos == "particle" and (i + 2 >= len(out) or out[i + 2].pos == "symbol"):
            out[i] = replace(m, surface="ねよう", end=nxt.end, pos="verb", lemma="寝る", reading="ねよう",
                             lemma_reading="ねる", kana="ネヨウ", ctype="下一段-ナ行", cform="意志推量形", goshu="和")
            out_t[i] = ("動詞", "一般", "")
            out[i + 1] = None
    keep = [k for k, m in enumerate(out) if m is not None]
    return [out[k] for k in keep], [out_t[k] for k in keep]


def _went(morphemes: list[Morpheme]) -> list[Morpheme]:
    """行っ read as 行う, "to carry out", where nothing is carried out
    (plan 272). 行った and 行って are 行く's forms and 行う's alike, and
    UniDic took 二人で行った and 隣の町へも行った for 行う: 行う takes what
    is carried out with を (アンケートを行った), and where the clause before
    it holds no を, the verb is 行く, "went"."""
    from dataclasses import replace

    out = list(morphemes)
    for i, m in enumerate(out):
        if m.surface != "行っ" or m.lemma != "行う":
            continue
        j = i - 1
        while j >= 0 and out[j].pos not in ("verb", "auxiliary", "adjective") \
                and not (out[j].pos == "symbol" and out[j].surface in "、。！？!?「」"):
            if out[j].surface == "を" and out[j].pos == "particle":
                break
            j -= 1
        if j >= 0 and out[j].surface == "を":
            continue
        out[i] = replace(m, lemma="行く", reading="いっ", lemma_reading="いく", kana="イッ", ctype="五段-カ行")
    return out


# What follows 何分 when it asks how many minutes: a verb (何分待たせる),
# a measure (ぐらい, ほど), a time (後, 前), the copula or a particle a span
# takes; and what follows the adverb 何分, "anyway, please".
_MINUTES_AFTER = frozenset({"ぐらい", "くらい", "ほど", "間", "後", "前", "で", "に", "も", "か",
                            "まで", "から", "です", "だ", "でし", "だっ",
                            "かかる", "掛かる", "経つ", "たつ", "過ぎる"})
_ANYWAY_BEFORE = frozenset({"よろしく", "宜しく"})


def _how_many_minutes(morphemes: list[Morpheme], tags: list[tuple]) -> tuple[list, list]:
    """何分, read by what follows it (plan 272): なんぷん, "how many
    minutes", before a verb or what measures a span; なにぶん, "anyway,
    please", before よろしく and in 何分にも. UniDic reads it either way
    in either place: おい、何分待たせる気だよ as the adverb, 何分よろしく as
    何 and the counter."""
    out_m, out_t = [], []
    i = 0
    while i < len(morphemes):
        m = morphemes[i]
        whole = m.surface == "何分"
        cut = m.surface == "何" and i + 1 < len(morphemes) and morphemes[i + 1].surface == "分"
        k = i + (1 if whole else 2)
        nxt = morphemes[k] if (whole or cut) and k < len(morphemes) else None
        after = morphemes[k + 1] if nxt is not None and k + 1 < len(morphemes) else None
        anyway = nxt is not None and (nxt.surface in _ANYWAY_BEFORE or (
            nxt.surface == "に" and after is not None and after.surface == "も"))
        minutes = nxt is not None and not anyway and (
            nxt.pos == "verb" or nxt.surface in _MINUTES_AFTER or nxt.lemma in _MINUTES_AFTER)
        # 何分の一, "what fraction": なんぶん.
        share = nxt is not None and nxt.surface == "の" and after is not None and bool(after.surface) \
            and all(c in "一二三四五六七八九十百千0123456789０１２３４５６７８９" for c in after.surface)
        if whole and (minutes or share):
            out_m.append(Morpheme(
                surface="何", start=m.start, end=m.start + 1, lemma="何", reading="なん",
                lemma_reading="なん", kana="ナン", pos="noun", auxiliary_use=False, conjunctive=False))
            out_t.append(("名詞", "数詞", ""))
            out_m.append(Morpheme(
                surface="分", start=m.start + 1, end=m.end, lemma="分", reading="ぶん" if share else "ぷん",
                lemma_reading="ぶん" if share else "ふん", kana="ブン" if share else "プン", pos="noun",
                auxiliary_use=False, conjunctive=False, counter=True))
            out_t.append(("名詞", "普通名詞", "助数詞可能"))
            i += 1
            continue
        if cut and anyway:
            out_m.append(Morpheme(
                surface="何分", start=m.start, end=morphemes[i + 1].end, lemma="何分", reading="なにぶん",
                lemma_reading="なにぶん", kana="ナニブン", pos="adverb", auxiliary_use=False, conjunctive=False))
            out_t.append(("副詞", "", ""))
            i += 2
            continue
        out_m.append(m)
        out_t.append(tags[i])
        i += 1
    return out_m, out_t


@lru_cache(maxsize=2048)
def _one_verb(kana: str):
    """The ichidan verb `kana` (a dictionary form) is when UniDic reads it
    alone as one -- つかれる is 疲れる -- as (lemma, cType), or None."""
    words = list(_plain_tagger(kana)) if MORPHOLOGY_AVAILABLE else []
    if len(words) != 1 or words[0].feature.pos1 != "動詞" or "一段" not in (words[0].feature.cType or ""):
        return None
    return words[0].feature.lemma, words[0].feature.cType


def _not_a_passive(morphemes: list[Morpheme], tags: list[tuple]) -> tuple[list, list]:
    """A verb in kana and the passive れる that spell one verb of their own
    read back as that verb (plan 272): UniDic cuts つかれた, "tired", into
    つか (突く, "to stab") and the passive -- "was stabbed" -- wherever it
    stands. Only where the letters with れる are a verb UniDic itself reads
    whole (つかれる); いぬにかまれた stays 噛む in the passive, "bitten"."""
    out_m, out_t = [], []
    i = 0
    while i < len(morphemes):
        m = morphemes[i]
        nxt = morphemes[i + 1] if i + 1 < len(morphemes) else None
        if (nxt is not None and m.pos == "verb" and m.cform.startswith("未然形") and m.ctype.startswith("五段")
                and all("\u3041" <= c <= "\u309f" for c in m.surface) and nxt.pos == "auxiliary"
                and nxt.lemma == "れる" and nxt.start == m.end and nxt.surface.startswith("れ")):
            verb = _one_verb(m.surface + "れる")
            if verb is not None:
                surface = m.surface + nxt.surface
                out_m.append(Morpheme(
                    surface=surface, start=m.start, end=nxt.end, lemma=verb[0],
                    reading=surface, lemma_reading=m.surface + "れる",
                    kana="".join(chr(ord(c) + 0x60) for c in surface), pos="verb",
                    auxiliary_use=False, conjunctive=False, ctype=_conjugation(verb[1]), cform=nxt.cform))
                out_t.append(("動詞", "一般", ""))
                i += 2
                continue
        out_m.append(m)
        out_t.append(tags[i])
        i += 1
    return out_m, out_t


# What a noun before a copula's て is, where the copula is what it says
# (急なお願いで、すみません, "it is a sudden request, and"): a reason or a
# plan is said of, a person or a role is someone (先輩で).
_COPULA_NOUNS = frozenset({
    "おかげ", "お陰", "もの", "物", "こと", "事", "ため", "為", "予定", "つもり", "はず", "わけ", "訳", "願い",
    "そう", "よう", "様", "みたい", "ところ", "所", "次第", "ほど", "程", "まま", "儘",
    "続き", "せい", "様子", "感じ", "状態", "具合", "調子", "最中", "途中", "一方", "以上", "通り",
    "先輩", "後輩", "学生", "先生", "社員", "医者", "人", "方", "子", "友達", "友だち", "仲間", "同僚", "上司",
    "部下", "家族", "兄", "姉", "弟", "妹", "父", "母", "息子", "娘", "夫", "妻", "彼", "彼女", "私", "僕", "俺",
})
_TOPICS = frozenset({"は", "が", "も", "って", "とは", "なら"})


def _place_de(morphemes: list[Morpheme], tags: list[tuple]) -> None:
    """で after a noun read back as the particle where UniDic took it for
    the copula's て form (plan 272): うみで、かいがらをひろいました is "at
    the sea", この一回のテイクで "in this one take" -- a noun that opens
    its clause with no topic and no subject before it, and the clause
    breaks after it. Never where the noun is what the copula says of
    something (_COPULA_NOUNS): 急なお願いで、すみません, 先輩で -- nor after
    one that is a な-adjective too (便利で、)."""
    from dataclasses import replace

    for i in range(1, len(morphemes)):
        m, prev = morphemes[i], morphemes[i - 1]
        if not (m.surface == "で" and m.pos == "auxiliary" and m.lemma == "だ" and m.cform.startswith("連用形")):
            continue
        if prev.pos not in ("noun", "pronoun") or prev.surface in _COPULA_NOUNS or prev.lemma in _COPULA_NOUNS \
                or prev.adjectival:
            # (A noun that is a な-adjective too takes the copula's て form:
            # 便利で、安い, 残酷で、, the 〜くて／〜で of it.)
            continue
        nxt = morphemes[i + 1] if i + 1 < len(morphemes) else None
        if nxt is not None and not (nxt.pos == "symbol" and nxt.surface in "、，,"):
            continue
        start = 0
        for k in range(i - 1, -1, -1):
            if morphemes[k].pos == "symbol" and morphemes[k].surface in "。！？!?「『、，,":
                start = k + 1
                break
        clause = morphemes[start:i - 1]
        if any(t.pos == "particle" and t.surface in _TOPICS for t in clause) \
                or any(t.pos == "auxiliary" and t.surface == "な" for t in clause[-1:]):
            continue
        morphemes[i] = replace(m, lemma="で", lemma_reading="で", pos="particle", ctype="", cform="")
        tags[i] = ("助詞", "格助詞", "*")


# An adjective's く form after の is the noun it makes: おおさかのちかく,
# "near Osaka" -- no adjective follows の.
_KU_NOUNS = {"近い": ("近く", "ちかく"), "遠い": ("遠く", "とおく")}
_UTTERANCE_MARKS = frozenset("。！？!?「『（(…‥")


def _spoken_kana(morphemes: list[Morpheme], tags: list[tuple]) -> tuple[list, list]:
    """Kana UniDic read as another word where the sentence says which
    (plan 272):

    - ちかく after の is the noun 近く, "the vicinity", never the
      adjective 近い (no adjective follows の);
    - ま opening what is said, before its comma, is まあ, "well...", no
      間, "space": ……ま、嫌いじゃねえけど;
    - ねー after an adverb or an exclamation is ね drawn out, no ない:
      またねー, "see you!" (金がねえ is ない, "there isn't");
    - まじか opening what is said is まじ and か, "seriously?", no 間近,
      "near"."""
    from dataclasses import replace

    out_m, out_t = [], []
    for i, m in enumerate(morphemes):
        prev = morphemes[i - 1] if i > 0 else None
        nxt = morphemes[i + 1] if i + 1 < len(morphemes) else None
        opens = prev is None or (prev.pos == "symbol" and prev.surface in _UTTERANCE_MARKS)
        if (m.pos == "adjective" and m.lemma in _KU_NOUNS and m.surface.endswith("く")
                and prev is not None and prev.surface == "の" and prev.pos == "particle"):
            lemma, reading = _KU_NOUNS[m.lemma]
            m = replace(m, pos="noun", lemma=lemma, lemma_reading=reading, ctype="", cform="")
            tags = tags[:i] + [("名詞", "普通名詞", "副詞可能")] + tags[i + 1:]
        elif m.surface == "ま" and m.pos == "noun" and opens and nxt is not None and nxt.surface in ("、", "，", ","):
            m = replace(m, pos="interjection", lemma="まあ", lemma_reading="まあ")
            tags = tags[:i] + [("感動詞", "一般", "*")] + tags[i + 1:]
        elif (m.surface in ("ねー", "ねえ", "ねぇ", "ねーー") and m.pos == "adjective" and m.lemma in ("無い", "ない")
              and prev is not None and prev.pos in ("adverb", "interjection", "conjunction")):
            m = replace(m, pos="particle", lemma="ね", lemma_reading="ね", ctype="", cform="")
            tags = tags[:i] + [("助詞", "終助詞", "*")] + tags[i + 1:]
        elif (m.surface in ("ねえ", "ねー", "ねぇ") and m.pos == "particle" and prev is not None
              and prev.pos == "particle" and prev.surface in ("が", "は", "も", "しか", "なんか", "こそ")
              and (nxt is None or nxt.surface in ("。", "！", "!", "？", "?", "よ", "ぞ", "な", "し", "から", "けど"))):
            # 金がねえ, "there's no money": ない said roughly, which UniDic
            # takes for ね drawn out (これはねえ、 is the filler).
            m = replace(m, pos="adjective", lemma="無い", lemma_reading="ない", ctype="形容詞", cform="終止形-一般")
            tags = tags[:i] + [("形容詞", "非自立可能", "*")] + tags[i + 1:]
        elif (m.surface in ("ばいばい", "バイバイ") and m.lemma == "売買" and opens
              and (nxt is None or nxt.pos in ("symbol", "particle"))):
            # ばいばい said on its own is "bye-bye", no 売買, "trade".
            m = replace(m, pos="interjection", lemma="バイバイ", lemma_reading="ばいばい")
            tags = tags[:i] + [("感動詞", "一般", "*")] + tags[i + 1:]
        elif m.surface in ("まじか", "マジか") and m.lemma == "間近" and opens:
            head = m.surface[:-1]
            out_m.append(replace(m, surface=head, end=m.start + len(head), lemma="まじ", reading="まじ",
                                 lemma_reading="まじ", kana="マジ", pos="noun", ctype="", cform=""))
            out_t.append(("名詞", "普通名詞", "形状詞可能"))
            out_m.append(replace(m, surface="か", start=m.start + len(head), lemma="か", reading="か",
                                 lemma_reading="か", kana="カ", pos="particle", ctype="", cform=""))
            out_t.append(("助詞", "終助詞", "*"))
            continue
        out_m.append(m)
        out_t.append(tags[i])
    return out_m, out_t


def _katakana_adjectives(morphemes: list[Morpheme], tags: list[tuple]) -> tuple[list, list]:
    """A slang adjective in katakana read back as one word where UniDic
    cut it into letters (plan 272): エモくない was エ + モ + く, three
    marks; エモい, "moving", is a word JMdict holds."""
    from dataclasses import replace

    import content.vocab_jmdict_data as jmdict_db

    out_m, out_t = [], []
    i = 0
    while i < len(morphemes):
        j = i
        while j < len(morphemes) and morphemes[j].pos == "symbol" and len(morphemes[j].surface) == 1 \
                and "\u30a1" <= morphemes[j].surface <= "\u30fa" and (j == i or morphemes[j].start == morphemes[j - 1].end):
            j += 1
        if j - i >= 2 and j < len(morphemes) and morphemes[j].start == morphemes[j - 1].end \
                and morphemes[j].surface in ("く", "い", "かっ", "けれ"):
            stem = "".join(m.surface for m in morphemes[i:j])
            row = jmdict_db.get_by_key("", stem + "い")
            tagged = row is not None and "adj-i" in {
                t for sense in jmdict_db.get_senses("", stem + "い") or [] for t in sense.get("tags") or ()}
            if tagged:
                ending = morphemes[j].surface
                surface = stem + ending
                first = morphemes[i]
                out_m.append(replace(
                    first, surface=surface, end=morphemes[j].end, lemma=stem + "い",
                    reading=kata_to_hira(stem) + ending, lemma_reading=kata_to_hira(stem) + "い",
                    kana=stem + "".join(chr(ord(c) + 0x60) for c in ending), pos="adjective",
                    ctype="形容詞", cform={"く": "連用形-一般", "い": "終止形-一般", "かっ": "連用形-促音便",
                                          "けれ": "仮定形-一般"}[ending], goshu="外"))
                out_t.append(("形容詞", "一般", "*"))
                i = j + 1
                continue
        out_m.append(morphemes[i])
        out_t.append(tags[i])
        i += 1
    return out_m, out_t


def _is_kanji(c: str) -> bool:
    return "\u4e00" <= c <= "\u9fff" or c == "\u3005"  # 々


_FULLWIDTH_DIGITS = str.maketrans("０１２３４５６７８９", "0123456789")


def _reading_of(surface: str, kana: str, pron: str) -> str:
    """A morpheme's reading in hiragana, AS SPELLED where the surface
    carries a kanji.

    UniDic's `pron` is the sound, and the sound is not the spelling:
    大きい is pronounced オーキー, 通り トーリ, 続く ツズク, and
    kata_to_hira turns the first two into おうきい and とうり -- which
    was the furigana over every sentence (study/furigana.align_sentence)
    until it was measured against the dictation bank's hand-written kana.
    `kana` is the spelling (オオキイ, トオリ, ツヅク), so a word written
    with a kanji takes its reading from that, shifted to hiragana with
    no ー resolution (a kanji word spells its long vowels out). A word
    written in kana keeps the old reading, which card matching and the
    grammar detector were written against -- except a word written in
    hiragana whose sound draws a vowel out: \u304a\u304a\u304d\u306a, \u306d\u3048 and \u3078\u3048 are
    pronounced \u30aa\u30fc\u30ad\u30ca, \u30cd\u30fc and \u30d8\u30fc, which kata_to_hira read
    \u304a\u3046\u304d\u306a, \u306d\u3044 and \u3078\u3044, a word that is not on the page (plan 272).
    Their reading is the page's own. A reading that still holds a kanji
    (an unknown word UniDic echoes back) is no reading at all.
    """
    spelled = "".join(
        chr(ord(c) - 0x60) if "\u30a1" <= c <= "\u30f6" else c for c in kana
    )
    if any(_is_kanji(c) for c in surface):
        if spelled and not any(_is_kanji(c) for c in spelled):
            return spelled
        sound = kata_to_hira(pron)
        if sound and not any(_is_kanji(c) for c in sound):
            return sound
        return ""
    if all("\u3041" <= c <= "\u309f" or c in "\u30fc〜～" for c in surface) and (
            any(c in "\u30fc〜～" for c in surface) or ("\u30fc" in pron and spelled == surface)):
        return surface
    return kata_to_hira(pron) or surface


def _in_context(morphemes: list[Morpheme], tags: list[tuple]) -> list[Morpheme]:
    """The readings a word only takes beside its neighbours -- お母さん's
    かあ, 一本's いっぽん -- put right (study/reading_context.py).
    `tags` are UniDic's pos1-3 per morpheme, which the rules read and
    Morpheme does not carry."""
    from dataclasses import replace

    from study.reading_context import correct_readings

    try:
        fixed = correct_readings([
            {"surface": m.surface, "reading": m.reading, "pos": m.pos,
             "lemma": m.lemma, "tags": tag}
            for m, tag in zip(morphemes, tags)
        ])
    except Exception:  # pragma: no cover - defensive only
        # A rule that breaks costs its corrections, never the sentence.
        logger.warning("reading_context failed; readings left as UniDic's", exc_info=True)
        return morphemes
    return [
        m if r == m.reading else replace(m, reading=r)
        for m, r in zip(morphemes, fixed)
    ]


# The marks that draw a word out in speech (plan 272): すごーい, ただいまー,
# おはよ〜, and the small っ a word is cut short with (やばっ, うわっ).
_DRAWN_MARKS = frozenset("ー〜～")
_CUT_SHORT = frozenset("っッ")
_SPOKEN_ENDS = frozenset("、。，．！？!?…‥」』）) 　\n")
# A long vowel as a native word spells it: お-row おう, え-row えい
# (おはよう, せんせい), the rest its own vowel (かあ, いい, くう).
_SPELLED_VOWEL = {**{c: "う" for c in "おこそとのほもよろごぞどぼぽょ"},
                  **{c: "い" for c in "えけせてねへめれげぜでべぺ"},
                  **{c: "あ" for c in "あかさたなはまやらわがざだばぱゃ"},
                  **{c: "い" for c in "いきしちにひみりぎじぢびぴ"},
                  **{c: "う" for c in "うくすつぬふむゆるぐずづぶぷゅ"}}


def _drawn_sites(text: str) -> list[int]:
    """Where a word of `text` is drawn out after a hiragana letter, or
    cut short before a mark: the places MeCab, which reads the written
    word, may read nothing at all -- おはよー as お + は + よー, ばいばーい
    as an unknown word."""
    sites = []
    for p, c in enumerate(text):
        if p == 0 or not ("\u3041" <= text[p - 1] <= "\u3096" or text[p - 1] in _DRAWN_MARKS):
            continue
        if c in _DRAWN_MARKS and not (text[p - 1] in _DRAWN_MARKS and p - 1 in sites):
            sites.append(p)
        elif c in _CUT_SHORT and (p + 1 == len(text) or text[p + 1] in _SPOKEN_ENDS):
            sites.append(p)
    return sites


def _spoken_reading(text: str, tagger) -> tuple[str, list[int]]:
    """The text MeCab is given for `text`, and for each of its letters the
    index of the letter of `text` it reads (plan 272).

    A word drawn out (すごーい, ただいまー, おはよー) or cut short (やばっ)
    is read three ways -- as written, with the marks dropped, and with a
    long vowel spelled as a native word spells it (おはよう) -- and the one
    MeCab reads into the fewest words it knows is kept, as written when it
    ties: すごーい is a word to UniDic as it stands, ただいまー is ただいま,
    おはよー おはよう. The page keeps its letters (_tag): only what MeCab
    reads changes."""
    sites = _drawn_sites(text)
    read, origin = text, list(range(len(text)))
    if not sites:
        return read, origin

    def score(candidate: str) -> tuple[int, int, int]:
        words = list(tagger(candidate))
        unknown = sum(1 for w in words if getattr(w, "is_unk", False))
        stray = sum(1 for w in words if len(w.surface) == 1 and "\u3041" <= w.surface <= "\u3096"
                    and getattr(w.feature, "pos1", "") not in ("助詞", "助動詞"))
        return unknown, len(words), stray

    for site in sites:
        k = origin.index(site)
        run = 1
        while k + run < len(read) and read[k + run] in _DRAWN_MARKS and read[k + run] == read[k]:
            run += 1
        options = [(read, origin)]
        options.append((read[:k] + read[k + run:], origin[:k] + origin[k + run:]))
        if read[k] in _DRAWN_MARKS and k > 0 and read[k - 1] in _SPELLED_VOWEL:
            options.append((read[:k] + _SPELLED_VOWEL[read[k - 1]] + read[k + run:],
                            origin[:k] + [origin[k]] + origin[k + run:]))
        best = min(options, key=lambda o: score(o[0]))
        read, origin = best
    return read, origin


def _tag(text: str, offset: int = 0, tagger=None) -> tuple[list[Morpheme], list[tuple]]:
    """MeCab's morphemes for `text`, their offsets counted from `offset`
    (where `text` stands in the sentence), with UniDic's pos1-3 for each
    -- what _in_context's rules read and Morpheme does not carry.
    `tagger` is the kana lexicon's (the default) or UniDic's alone."""
    tagger = tagger or _tagger
    morphemes = []
    tags = []
    # Digits are read in half width (plan 272): UniDic lists a few full-
    # width figures as words of their own -- １０ テン, ４０ フォーティー, １日
    # ついたち wherever it stands -- and reads any half-width figure as
    # itself. One letter for one. And a word drawn out in speech is read
    # as the word it draws out (_spoken_reading). Each word keeps the
    # page's own letters, and the marks MeCab was not given ride the word
    # before them.
    read, origin = _spoken_reading(text.translate(_FULLWIDTH_DIGITS), tagger)
    at = 0
    for w in tagger(read):
        # MeCab drops ASCII whitespace between words and hands it
        # back as the next word's `white_space`. Uncounted, every
        # offset after a space was short by it -- and a subtitle
        # line is usually several phrases with spaces between them:
        # the grammar detector, which matches the raw text and
        # anchors on these offsets, lost every particle after the
        # first space, and a cloze blanked the wrong letters.
        a = at + len(getattr(w, "white_space", "") or "")
        b = a + len(w.surface)
        at = b
        lo, hi = origin[a], origin[b - 1] + 1
        while hi < len(text) and (b >= len(origin) or origin[b] > hi) and (
                text[hi] in _DRAWN_MARKS or text[hi] in _CUT_SHORT):
            hi += 1
        surface = text[lo:hi]
        start, end = offset + lo, offset + hi
        feat = w.feature
        pron = getattr(feat, "pron", None) or getattr(feat, "kana", None) or ""
        kana = getattr(feat, "kana", None) or ""
        lform = getattr(feat, "lForm", None) or pron
        lemma = _clean_lemma(getattr(feat, "lemma", None), surface)
        digits = surface.translate(_FULLWIDTH_DIGITS)
        if digits.isascii() and digits.isdigit():
            # A number in digits is read as itself, as UniDic reads 30 and
            # any figure it does not list -- and it lists a few in full
            # width as English: １０ テン, ４０ フォーティー (plan 272). Its
            # Japanese reading is made beside its counter
            # (reading_context.numeral_furigana).
            pron = kana = lform = lemma = surface
        pos1 = getattr(feat, "pos1", None)
        pos2 = getattr(feat, "pos2", None)
        tags.append((pos1 or "", pos2 or "", getattr(feat, "pos3", None) or ""))
        morphemes.append(Morpheme(
            surface=surface,
            start=start,
            end=end,
            lemma=lemma,
            reading=_reading_of(surface, kana, pron),
            lemma_reading=kata_to_hira(lform) or lemma,
            kana=kana or surface,
            pos=_POS_MAP.get(pos1, "other"),
            auxiliary_use=(pos2 == "非自立可能"),
            conjunctive=(pos2 == "接続助詞"),
            ctype=_conjugation(getattr(feat, "cType", None)),
            cform=_conjugation(getattr(feat, "cForm", None)),
            goshu=_conjugation(getattr(feat, "goshu", None)),
            proper=(pos2 == "固有名詞"),
            name_kind=_name_kind(pos2 or "", getattr(feat, "pos3", None) or "",
                                 getattr(feat, "pos4", None) or ""),
            counter=(getattr(feat, "pos3", None) or "") in ("助数詞", "助数詞可能"),
            unknown=bool(getattr(w, "is_unk", False)),
            adjectival=(getattr(feat, "pos3", None) or "") == "形状詞可能",
        ))
    return morphemes, tags


# What a quotation closes on, so what stands before its と (「…」と言った).
_CLOSING_QUOTES = frozenset("」』")


def _quotative_to(text: str, morphemes: list[Morpheme], tags: list[tuple], tagger=None) -> tuple[list, list]:
    """The quotative と handed back to the particle it is (plan 236).

    UniDic carries the mixed-script spellings a word is printed in when
    one of its kanji is left in kana -- と博 for 賭博 "gambling", と殺 for
    屠殺 -- and after a quotation MeCab can take the quotative と for the
    first kana of one: 「…緊張するよ」と博がいいます came back と博, 賭博,
    where it says と and the name 博 (Hiroshi), so 緊張's example put ばく
    over the name and its breakdown looked up gambling. After a closing
    quote, a token that opens on と and goes on in kanji is that particle
    and the start of the next word: the と is cut off and the rest of the
    sentence tagged again from there, where MeCab reads 博 as the name it
    is. A mixed-script word anywhere else (とり肉, 違法なと博) stays whole.
    """
    for i, m in enumerate(morphemes):
        if (len(m.surface) > 1 and m.surface[0] == "と"
                and any(_is_kanji(c) for c in m.surface[1:])
                and m.start > 0 and text[m.start - 1] in _CLOSING_QUOTES):
            to = Morpheme(
                surface="と", start=m.start, end=m.start + 1, lemma="と",
                reading="と", lemma_reading="と", kana="ト", pos="particle",
                auxiliary_use=False, conjunctive=False, goshu="和",
            )
            rest, rest_tags = _tag(text[m.start + 1:], m.start + 1, tagger)
            rest, rest_tags = _quotative_to(text, rest, rest_tags, tagger)
            return morphemes[:i] + [to] + rest, tags[:i] + [("助詞", "格助詞", "*")] + rest_tags
    return morphemes, tags


# ── Letters the dictionary has no word for (plan 272) ──────────────
# Where a stretch of kana is no word UniDic knows -- a name written in
# hiragana (ぷらそにか, あいみょん), a word of the street (ぴえん) -- MeCab
# does not say so: every kana is also a dictionary entry of its own, a
# mark (記号) it falls back on when nothing longer fits, so the letters
# came out as marks, stray particles and fillers, and the breakdown
# showed ぷらそにか as ぷ, ら, the archaic pronoun そ ("that") and two
# particles with their grammar cards. The signs are always the same: a
# kana read as a mark, a word that would begin with a small kana (no
# word does: あいみょん came out いみ + ょ + ん), MeCab's own unknown word.
# What no word begins with, and is always the end of the letter before
# it: ゃ, ゅ, ょ (あいみょん's みょ).
_NEVER_FIRST = frozenset("ゃゅょゎ")
# A small vowel lengthens the word before it (すごいぃ, でしょぉ) or ends
# the letters of one cut short (やべぇ, うめぇ): only the second is glued
# back, after a token of two letters or less that is no ending.
_SMALL_VOWELS = frozenset("ぁぃぅぇぉ")
# What begins no word when MeCab reads it as a filler or a mark: the ん of
# あいみょん and ゆるりんず. (The ん of ません and of なんだ is an ending and
# a particle, and stays one; っ begins って, っす and っけ.)
_TAIL_WHEN_STRAY = frozenset("ん")
_OPEN_QUOTES = frozenset("「『（(〈《【\"'“‘")
_CLOSE_QUOTES = frozenset("」』）)〉》】\"'”’")
# What a stretch may end on and leave to the sentence: the particles a
# word stands before, alone or in their usual pairs (ぷらそにか + の,
# ぷらそにか + に + は, ぴえん + よ + ね).
_PARTICLE_TAILS = frozenset({
    "", "の", "が", "を", "に", "へ", "と", "で", "は", "も", "や", "か", "ね", "よ", "な", "わ", "さ", "ぞ", "ぜ",
    "には", "では", "とは", "への", "での", "との", "にも", "でも", "とも", "のは", "のも", "かな", "よね",
    "わね", "かも", "がね",
})


def _kana_letters(text: str) -> bool:
    return bool(text) and all("\u3041" <= c <= "\u309f" for c in text)


def _glued(a: Morpheme, b: Morpheme) -> bool:
    return a.end == b.start


@lru_cache(maxsize=1)
def _deck_kana() -> dict[str, frozenset[str]]:
    """Every reading of the deck, in hiragana, and the spellings it is
    the reading of: the words a learner's page is made of."""
    from content.vocab_data import VOCAB_BY_LEVEL

    out: dict[str, set[str]] = {}
    for entries in VOCAB_BY_LEVEL.values():
        for entry in entries:
            for reading in (entry.get("kana") or "").replace(";", "/").split("/"):
                if reading.strip():
                    out.setdefault(kata_to_hira(reading.strip()), set()).add(entry.get("kanji") or reading.strip())
    return {k: frozenset(v) for k, v in out.items()}


def _known(text: str) -> str | None:
    """The spelling of the word of the deck or of JMdict read `text`, or
    None: the deck's where one card is read so (あに, 兄), the commonest
    JMdict row's otherwise (おゆ, お湯; のうぜい, 納税), the letters
    themselves where several cards are."""
    if len(text) < 2:
        return None
    spellings = _deck_kana().get(text)
    if spellings:
        return next(iter(spellings)) if len(spellings) == 1 else text
    from content import vocab_jmdict_data

    rows = vocab_jmdict_data.by_kana(text, limit=1)
    return (rows[0].get("kanji") or rows[0].get("kana") or text) if rows else None


def _unknown_words(text: str, morphemes: list[Morpheme], tags: list[tuple]) -> tuple[list, list]:
    """Each stretch of kana MeCab cut into nothing, as the one word it is.

    1. A token no word begins as -- ゃ, ゅ, ょ; a small vowel after a
       short token that is no ending; a ん MeCab read as a filler or a
       mark -- is the tail of the kana before it.
    2. A seed is a kana read as a mark (not one quoted on its own, 「ぷ」),
       a token step 1 put back together, or MeCab's own unknown word.
    3. Around it, the stretch: to its left the one-letter kana that are
       no particle and no word of their own (あいみょん's あ), to its right
       every one-letter particle or stray letter up to a word, a mark or
       the end. A one-letter noun is a word (the せ of あにはせが) and a
       word of two letters or more bounds it (そして of そしてぷらそにか).
    4. Its edges: the letters left over at its end must be particles the
       sentence may stand them as (ぷらそにか + の); where a word of the
       deck or of JMdict fits, the longest such word (あに + は, お湯's おゆ
       + に; のうぜい, 納税, takes the の before it, at four letters or
       more), else the shortest stretch that leaves such a tail. A word
       the dictionary knows is read by its reading (あに is 兄); the rest
       is `unknown`, most often a name.
    A seed that stays one token is left as MeCab read it: UniDic files
    せい, "fault", as a mark, and 〜せいで reads it there."""
    if not morphemes:
        return morphemes, tags
    ms, ts = list(morphemes), list(tags)
    seeds: set[int] = set()

    def kana(i: int) -> bool:
        return 0 <= i < len(ms) and _kana_letters(ms[i].surface)

    i = 1
    while i < len(ms):
        m, prev = ms[i], ms[i - 1]
        first = m.surface[:1]
        tail = (first in _NEVER_FIRST
                or (first in _SMALL_VOWELS and (len(prev.surface) == 1
                                                or (len(prev.surface) == 2 and prev.pos != "auxiliary")))
                or (first in _TAIL_WHEN_STRAY and (ts[i][1] == "フィラー" or ts[i][0] in ("記号", "補助記号"))))
        if tail and kana(i) and kana(i - 1) and _glued(prev, m):
            ms[i - 1] = _merged([prev, m], unknown=True)
            ts[i - 1] = ("名詞", "普通名詞", "一般")
            del ms[i], ts[i]
            seeds = {s - 1 if s > i else s for s in seeds if s != i}
            seeds.add(i - 1)
            continue
        i += 1

    for i, m in enumerate(ms):
        if not kana(i):
            continue
        before = ms[i - 1] if i > 0 else None
        after = ms[i + 1] if i + 1 < len(ms) else None
        if ts[i][0] in ("記号", "補助記号"):
            quoted = (before is not None and before.surface in _OPEN_QUOTES
                      and after is not None and after.surface in _CLOSE_QUOTES)
            if not quoted:
                seeds.add(i)
        elif m.unknown:
            seeds.add(i)
    if not seeds:
        return ms, ts

    def stray(i: int, left: bool = False) -> bool:
        # A one-letter kana that is no word of its own: a filler, a mark,
        # an archaic pronoun (そ, 其) -- and on the left, an ending with
        # no word before it (the や of やべぇ).
        if len(ms[i].surface) != 1:
            return False
        if left:
            # (An ending after the word it ends is that word's: the た of
            # よかったせいで, which read with せい was 他姓, a surname.)
            if ms[i].pos == "auxiliary" and i > 0 and _glued(ms[i - 1], ms[i]) \
                    and ms[i - 1].pos in ("verb", "adjective", "auxiliary"):
                return False
            return ms[i].pos not in ("particle", "noun")
        return ms[i].pos not in ("particle", "auxiliary", "noun", "verb", "adjective")

    spans = []
    taken: set[int] = set()
    for seed in sorted(seeds):
        if seed in taken:
            continue
        lo = hi = seed
        while lo - 1 >= 0 and lo - 1 not in taken and kana(lo - 1) and _glued(ms[lo - 1], ms[lo]) \
                and (lo - 1 in seeds or stray(lo - 1, left=True)):
            lo -= 1
        while hi + 1 < len(ms) and kana(hi + 1) and _glued(ms[hi], ms[hi + 1]) \
                and (hi + 1 in seeds or stray(hi + 1) or (len(ms[hi + 1].surface) == 1 and ms[hi + 1].pos == "particle")):
            hi += 1
        last_seed = max(k for k in range(lo, hi + 1) if k in seeds)

        def tail_ok(b: int) -> bool:
            rest = ms[b + 1:hi + 1]
            return all(r.pos == "particle" for r in rest) and "".join(r.surface for r in rest) in _PARTICLE_TAILS

        chosen = None
        best_known = None
        for b in range(last_seed, hi + 1):
            if not tail_ok(b):
                continue
            for a in (lo - 1, lo):
                if a < 0 or (a < lo and not (kana(a) and _glued(ms[a], ms[lo]) and len(ms[a].surface) == 1)):
                    continue
                word = "".join(m.surface for m in ms[a:b + 1])
                spelled = _known(word) if (a == lo or len(word) >= 4) else None
                if spelled and (best_known is None or len(word) > best_known[2]):
                    best_known = (a, b, len(word), spelled)
            if chosen is None:
                chosen = (lo, b)
        if best_known is not None:
            a, b, _, spelled = best_known
            spans.append((a, b, spelled))
        elif chosen is not None:
            spans.append((chosen[0], chosen[1], None))
        else:
            continue
        taken.update(range(spans[-1][0], spans[-1][1] + 1))

    out_m, out_t = [], []
    starts = {a: (b, spelled) for a, b, spelled in spans if b > a}
    i = 0
    while i < len(ms):
        if i in starts:
            b, spelled = starts[i]
            out_m.append(_merged(ms[i:b + 1], unknown=spelled is None, lemma=spelled))
            out_t.append(("名詞", "普通名詞", "一般"))
            i = b + 1
            continue
        out_m.append(ms[i])
        out_t.append(ts[i])
        i += 1
    return out_m, out_t


_HONORIFIC_ENDS = ("くん", "ちゃん", "さん", "さま", "ちゃま")


def _kana_names(morphemes: list[Morpheme], tags: list[tuple]) -> tuple[list, list]:
    """A name in hiragana MeCab cut into words it is not (plan 272):

    - こんた + くん read as こん + たくん, 巧む's sound change -- a verb that
      ends in an honorific's letters, before no て or た, is the name and
      the honorific;
    - そうた read as そう + the past た, which no adverb takes: one word;
    - たろう after a mark read as an ending, which opens nothing: a word.

    Each is read back as one word the dictionary does not know (`unknown`,
    most often a name), and an honorific after it as the honorific."""
    from dataclasses import replace

    ms, ts = list(morphemes), list(tags)
    out, out_t = [], []
    k = 0
    while k < len(ms):
        m = ms[k]
        nxt = ms[k + 1] if k + 1 < len(ms) else None
        honorific = next((h for h in _HONORIFIC_ENDS if m.surface.endswith(h) and len(m.surface) > len(h)), None)
        if (honorific and m.pos == "verb" and _kana_letters(m.surface)
                and not (nxt is not None and nxt.surface[:1] in "てでただ")):
            # Take back the kana words glued before it, as far as the
            # name goes (こん of こんたくん), never across a particle.
            j = k
            while j - 1 >= 0 and len(out) > 0 and _kana_letters(ms[j - 1].surface) and _glued(ms[j - 1], ms[j]) \
                    and ms[j - 1].pos not in ("particle", "auxiliary", "symbol") and k - j < 2:
                j -= 1
            head = ms[j:k] + [replace(m, surface=m.surface[:-len(honorific)], end=m.end - len(honorific))]
            del out[len(out) - (k - j):]
            del out_t[len(out_t) - (k - j):]
            out.append(replace(_merged(head, unknown=True), proper=True, name_kind="person"))
            out_t.append(("名詞", "固有名詞", "人名"))
            out.append(replace(m, surface=honorific, start=m.end - len(honorific),
                               lemma={"くん": "君", "さま": "様"}.get(honorific, honorific),
                               reading=honorific, lemma_reading=honorific,
                               kana="".join(chr(ord(c) + 0x60) for c in honorific),
                               pos="suffix", ctype="", cform="", auxiliary_use=False, goshu="和"))
            out_t.append(("接尾辞", "名詞的", "一般"))
            if nxt is not None and nxt.pos == "particle" and nxt.conjunctive:
                # (The が after the verb it was read as joined clauses; after
                # a name it marks the subject.)
                ms[k + 1] = replace(nxt, conjunctive=False)
                ts[k + 1] = ("助詞", "格助詞", "")
            k += 1
            continue
        if (m.pos == "auxiliary" and m.surface == "た" and out and out[-1].pos in ("adverb", "noun", "pronoun")
                and _kana_letters(out[-1].surface) and _kana_letters(m.surface) and _glued(out[-1], m)
                and nxt is not None and nxt.pos == "particle"):
            out[-1] = _merged([out[-1], m], unknown=True)
            out_t[-1] = ("名詞", "固有名詞", "人名")
            k += 1
            continue
        if (m.pos == "auxiliary" and len(m.surface) >= 3 and _kana_letters(m.surface)
                and (not out or out[-1].pos == "symbol") and nxt is not None and nxt.pos == "particle"):
            out.append(_merged([m], unknown=True))
            out_t.append(("名詞", "固有名詞", "人名"))
            k += 1
            continue
        out.append(m)
        out_t.append(ts[k])
        k += 1
    return out, out_t


def _merged(run: list[Morpheme], unknown: bool, lemma: str | None = None) -> Morpheme:
    """One word of kana letters, read as written, and filed under the
    word the dictionary spells it as (`lemma`), where it knows one."""
    surface = "".join(m.surface for m in run)
    reading = kata_to_hira(surface)
    return Morpheme(
        surface=surface, start=run[0].start, end=run[-1].end, lemma=lemma or surface,
        reading=reading, lemma_reading=reading,
        kana="".join(chr(ord(c) + 0x60) if "\u3041" <= c <= "\u3096" else c for c in surface),
        pos="noun", auxiliary_use=False, conjunctive=False, unknown=unknown,
    )


def tokenize(text: str, plain: bool = False, before: str = "", after: str = "") -> list[Morpheme] | None:
    """Full-sentence tokenization, or None if the analyzer isn't
    available (see MORPHOLOGY_AVAILABLE) or this specific call failed.
    Callers must have a fallback path for the None case — MeCab is
    robust, but this is deliberately not treated as something that
    should ever raise into caller code.

    `plain` reads with UniDic alone, without the deck's kana spellings
    (plan 272): the lookups' indexes are keyed by UniDic's own lemma for
    a written form, and a sentence's tokens never need it.

    `before` and `after` are the text either side of `text` where it is
    one line of a longer one (plan 272): a subtitle's line, a piece of a
    cue cut to the line width. MeCab chooses each word by its neighbours,
    and a line read alone lost them -- この一回のテイクで, cut from …テイクで
    気持ちを込めて歌います, ended on the copula's で rather than the
    particle "with". The line is read inside its context and keeps its
    own morphemes, their offsets the line's; where a word straddles the
    line's edge, the line is read alone, as before."""
    if not MORPHOLOGY_AVAILABLE or not text:
        return None
    if before or after:
        return _within(text, before, after, plain)
    tagger = _plain_tagger if plain else _tagger
    try:
        morphemes, tags = _quotative_to(text, *_tag(text, 0, tagger), tagger)
        morphemes, tags = _unknown_words(text, morphemes, tags)
        morphemes, tags = _kana_names(morphemes, tags)
        _demonstratives(morphemes)
        _picture(morphemes)
        morphemes, tags = _notice(morphemes, tags)
        _one_kana_nouns(morphemes)
        morphemes, tags = _sleep(morphemes, tags)
        morphemes, tags = _pain(morphemes, tags)
        morphemes = _went(morphemes)
        morphemes, tags = _how_many_minutes(morphemes, tags)
        morphemes, tags = _not_a_passive(morphemes, tags)
        _place_de(morphemes, tags)
        morphemes, tags = _spoken_kana(morphemes, tags)
        morphemes, tags = _katakana_adjectives(morphemes, tags)
        return _in_context(morphemes, tags)
    except Exception:  # pragma: no cover - defensive only
        logger.warning("morphology.tokenize failed on input; caller should fall back", exc_info=True)
        return None

def _within(text: str, before: str, after: str, plain: bool) -> list[Morpheme] | None:
    """`text`'s morphemes as read inside before + text + after (tokenize)."""
    from dataclasses import replace

    whole = tokenize(before + text + after, plain)
    if whole is None:
        return tokenize(text, plain)
    lo, hi = len(before), len(before) + len(text)
    if any(m.start < lo < m.end or m.start < hi < m.end for m in whole):
        return tokenize(text, plain)
    inside = [replace(m, start=m.start - lo, end=m.end - lo) for m in whole if lo <= m.start and m.end <= hi]
    return inside or tokenize(text, plain)
