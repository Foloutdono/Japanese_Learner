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


def kata_of(s: str) -> str:
    """`s` with its hiragana in katakana."""
    return "".join(chr(ord(c) + 0x60) if "\u3041" <= c <= "\u3096" else c for c in s)


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
    verbal: bool = False  # UniDic's サ変可能 (pos3): a noun that takes する
    # -- 勉強, 散歩, スキー -- the "noun alone" 〜に行きます's lesson names
    # (スキーに行く, plan 272).
    adjectival: bool = False  # UniDic's 形状詞可能 (pos3): a noun that is a
    # な-adjective too -- 残酷, 楽, 元気 -- whose で before a comma is the
    # adjective's て form (plan 272).
    written: str = ""  # UniDic's orthBase: the dictionary form in the
    # page's own spelling, where the lemma is the lexeme's (plan 272):
    # 突っ込み is 突き込む's and written 突っ込む, 溶きほぐし 溶き解す's
    # and written 溶きほぐす. "" where UniDic gives none. An adjuster that
    # joins or respells a morpheme leaves it stale: written_form() says
    # whether it still spells the surface.
    written_reading: str = ""  # its reading, in hiragana (kanaBase):
    # つっこむ, where the lemma reads つきこむ.


def written_form(m: "Morpheme") -> str:
    """The page's own dictionary form of a verb or an adjective
    (Morpheme.written), or "" where the morpheme has none or an adjuster
    left it stale: it must begin as the surface does, its stem being the
    surface's (突っ込み, 突っ込む; 流し入れ, 流し入れる)."""
    w = m.written
    if not w or m.pos not in ("verb", "adjective") or len(m.surface) < 2 or not w.startswith(m.surface[:-1]):
        return ""
    # The lemma written otherwise, never another form of it: 聞き取れ is
    # 聞き取る's potential (聞き取れる), 亡き the old 亡し of 無い.
    if not m.lemma or w[-1] != m.lemma[-1] or (
            m.written_reading and m.lemma_reading and len(m.written_reading) != len(m.lemma_reading)):
        return ""
    return w


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
    or goes before a verb (あのすみません) (plan 151). And こんな, そんな,
    あんな, どんな before an adjective, which UniDic reads as its 形状詞."""
    for m, nxt in zip(morphemes, morphemes[1:]):
        if (m.pos == "interjection" and m.surface in _DEMONSTRATIVES
                and nxt.pos in ("noun", "pronoun", "prefix", "suffix", "other", "adjective", "adnominal")):
            m.pos = "adnominal"
        elif (m.pos == "other" and m.surface in ("こんな", "そんな", "あんな", "どんな")
              and nxt.pos in ("noun", "pronoun", "prefix", "adjective", "adnominal")):
            # あんなひどいこと: UniDic's 形状詞 before an adjective is the
            # adnominal "such" all the same (plan 272).
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


# What may follow a shop's 屋 written や, and never the や of a list, which
# a second noun follows (パンやケーキ): a case or topic particle, さん, the
# copula.
_SHOP_PARTICLES = frozenset({"格助詞", "係助詞"})


_VOICED_KANA = frozenset("がぎぐげござじずぜぞだぢづでどばびぶべぼ")
# What passes through, whose 通っ is 通る (plan 272): 火が通る, 車が通る.
_PASSING = frozenset({"火", "車", "電車", "バス", "道", "声", "風", "光", "列車", "船", "話", "意見", "法案", "電気",
                      "電流", "空気", "鼻", "筋", "線路", "トラック", "人", "車両"})


def _hiragana_only(text: str) -> bool:
    return bool(text) and all("\u3041" <= c <= "\u309f" for c in text)


@lru_cache(maxsize=1024)
@lru_cache(maxsize=1024)
def _row_of(kanji: str, kana: str) -> bool:
    """Whether the dictionary holds a word written `kanji` read `kana`."""
    import content.vocab_jmdict_data as jmdict_db

    return jmdict_db.get_by_key(kanji, kana) is not None


@lru_cache(maxsize=256)
def _deck_godan(verb: str) -> bool:
    """Whether the deck teaches `verb` written so (plan 272)."""
    return any(kanji == verb for kanji, _kana in _deck_forms())


# Where one goes in, whose はいる after it is 入る said without its に
# (plan 272): お風呂はいる.
_ENTERED = frozenset({"風呂", "ふろ", "部屋", "へや", "家", "うち", "中", "なか", "学校", "会社", "店", "布団", "ふとん",
                      "温泉", "車", "教室", "トイレ", "病院", "大学", "電車", "バス"})


def _has_kanji_char(text: str) -> bool:
    return any("\u4e00" <= c <= "\u9fff" for c in text)


@lru_cache(maxsize=1024)
def _deck_word(surface: str) -> bool:
    """Whether the deck teaches a word written `surface` (休み, a day off:
    休みだし is the noun and the copula, plan 272 -- never 降りだし)."""
    return any(kanji == surface for kanji, _kana in _deck_forms())


# What a house is named for (plan 272): a name in kana stands straight
# before it (さくら旅館, ひまわり幼稚園) or before と言う and it (さくら
# という店); a firm answers the phone with its own (はい、さくらで
# ございます). Never 病院 or 学校, which a common word can stand before
# (こども病院).
_HOUSES = frozenset({"旅館", "ホテル", "荘", "亭", "幼稚園", "保育園", "食堂", "書店", "商店", "温泉", "号",
                     # (みどり商事, サクラ航空: a firm's, plan 272)
                     "商事", "航空", "商会", "物産", "企画", "出版", "製菓", "電機"})
_HOUSES_NAMED = _HOUSES | {"店", "お店", "会社", "レストラン", "喫茶店", "カフェ", "バー", "宿", "民宿", "美容院"}


def named_alone(morphemes, i: int) -> bool:
    """Whether morphemes[i], a word in hiragana, is a given name UniDic
    reads alone, opening what is said of the one it names (plan 272):
    あおいが今日来れないって, where the deck's あおい is the adjective 青い."""
    m = morphemes[i]
    prev = morphemes[i - 1] if i > 0 else None
    nxt = morphemes[i + 1] if i + 1 < len(morphemes) else None
    return (m.pos == "noun" and _hiragana_only(m.surface) and 3 <= len(m.surface) <= 4
            and (prev is None or prev.surface in ("、", "。", "「", "！", "？")) and nxt is not None
            and nxt.pos == "particle" and not nxt.conjunctive and nxt.surface in ("が", "は", "も", "と")
            and _a_name_alone(m.surface))


@lru_cache(maxsize=1024)
def _a_name_alone(kana: str) -> bool:
    """Whether UniDic reads `kana` alone as a given name and the deck has
    no noun spelled with it (あおい: only the adjective 青い)."""
    alone, _ = _tag(kana, 0, _plain_tagger)
    if len(alone) != 1 or not (alone[0].proper and alone[0].name_kind == "given"):
        return False
    return not any(spelling[-1:] and not _hiragana_only(spelling[-1:]) for spelling in _deck_kana().get(kana, ()))


# A firm's word after its name (みどり商事, サクラ航空), which a place's or
# a word in katakana may stand before too (plan 272).
_FIRMS = frozenset({"商事", "航空", "商会", "物産", "企画", "出版", "製菓", "電機"})


def _a_firm_after(morphemes, i: int) -> bool:
    return i + 1 < len(morphemes) and morphemes[i + 1].surface in _FIRMS and morphemes[i + 1].start == morphemes[i].end


def _a_house_name(morphemes, i: int) -> bool:
    nxt = morphemes[i + 1] if i + 1 < len(morphemes) else None
    prev = morphemes[i - 1] if i > 0 else None
    if prev is not None and prev.end == morphemes[i].start and prev.surface.endswith("屋") and i >= 2 \
            and (len(prev.surface) >= 2 or morphemes[i - 2].end == prev.start) \
            and _hiragana_only(morphemes[i].surface) and len(morphemes[i].surface) >= 3 \
            and (nxt is None or nxt.surface in ("、", "。", "の", "は", "が", "で", "に", "へ", "も", "さん")):
        return True                     # パン屋こむぎ, 居酒屋さくら: the shop's own name after its kind
    if nxt is None:
        return False
    if nxt.start == morphemes[i].end and (nxt.surface in _HOUSES or (
            i + 2 < len(morphemes) and nxt.surface + morphemes[i + 2].surface in _HOUSES)):
        return True                     # (幼稚 + 園)
    if nxt.surface == "と" and i + 3 < len(morphemes) and morphemes[i + 2].lemma in ("言う", "いう") \
            and morphemes[i + 3].surface in _HOUSES_NAMED:
        return True
    return (nxt.surface == "で" and i + 2 < len(morphemes) and morphemes[i + 2].surface == "ござい"
            and (i == 0 or morphemes[i - 1].surface in ("、", "。", "はい")) and (
                i < 2 or morphemes[i - 2].surface in ("はい", "、", "。", "ます", "ありがとう")))


@lru_cache(maxsize=1024)
def _deck_spelled_half_in_kana(head: str, tail: str):
    """(kanji, kana) of the one two-kanji deck word whose first kanji is
    `head` and whose reading ends with `tail`, the second kanji written
    in kana as a learner's text does (野さい, plan 272), or None."""
    found = {(k, r) for k, r in _deck_forms() if len(k) == 2 and k[0] == head and _has_kanji_char(k[1])
             for r in [r] if r.endswith(tail) and len(r) > len(tail)}
    return next(iter(found)) if len(found) == 1 else None


def _enters(morphemes, i: int) -> bool:
    """Whether 入れ at morphemes[i] is 入る's はいれる, "can enter": nothing
    is put in (no を in its clause), and someone or somewhere is (誰でも,
    中には, 一日から) -- この店は誰でも入れます (plan 272)."""
    k = i - 1
    clause = []
    while k >= 0 and not (morphemes[k].pos == "symbol" and morphemes[k].surface in "。！？!?、"):
        clause.append(morphemes[k])
        k -= 1
    if any(u.surface == "を" and u.pos == "particle" for u in clause):
        return False
    words = [u.surface for u in clause]
    return "誰" in words or "だれ" in words or (len(clause) >= 2 and clause[0].surface == "は" and clause[1].surface == "に") \
        or (len(clause) >= 2 and clause[0].surface == "から" and clause[1].surface in ("一日", "日"))


# What a thing is that one stands below (plan 272): 街灯の下, 木の下 --
# never the 下 of guidance, 先生の下で, read もと.
_THINGS_ABOVE = frozenset({"街灯", "電灯", "木", "桜", "橋", "机", "テーブル", "ベッド", "空", "星空", "傘", "屋根", "窓",
                           "月", "太陽", "雲", "看板", "階段", "岩", "石", "椅子", "いす"})


def _one_row_read(kana: str) -> str | None:
    """The written form of the one dictionary word read `kana` (plan
    272), or None where there is none or more than one."""
    import content.vocab_jmdict_data as jmdict_db

    rows = [r for r in jmdict_db.by_kana(kana, limit=3) if r.get("kana") == kana and r.get("kanji")]
    return rows[0]["kanji"] if len(rows) == 1 else None


@lru_cache(maxsize=1024)
def _a_word_with(noun: str, suffix: str) -> bool:
    """Whether noun + suffix is a word the deck or the dictionary holds:
    芸術家, 作家 (plan 272)."""
    import content.vocab_jmdict_data as jmdict_db

    word = noun + suffix
    return jmdict_db.has_form(word) or any(kanji == word for kanji, _kana in _deck_forms())


@lru_cache(maxsize=1024)
def _a_shop(noun: str) -> bool:
    """Whether noun + 屋 is a word the deck or the dictionary holds:
    パン屋, 靴屋, 本屋."""
    import content.vocab_jmdict_data as jmdict_db

    word = noun + "屋"
    return jmdict_db.has_form(word) or any(kanji == word for kanji, _kana in _deck_forms())


def _shops(morphemes: list[Morpheme], tags: list[tuple]) -> None:
    """A shop written in kana, パンや, くつや, read as a noun and the
    particle や, "and", where nothing follows for it to join (plan 274):
    パンやがあります, くつやへ行きました. UniDic reads パン屋 and 本やさん
    as a noun and the suffix 屋; so is や here, after a common noun and
    before a particle, さん or the copula, where noun + 屋 is a word the
    deck or the dictionary holds (_a_shop: さくやの is 昨夜, read apart).
    Before a noun (ふくやくつ) or a comma (花や、かばんや) it stays the
    list's."""
    for k in range(1, len(morphemes) - 1):
        m, before, nxt = morphemes[k], morphemes[k - 1], morphemes[k + 1]
        if m.surface != "や" or tags[k][:2] != ("助詞", "副助詞") or tags[k - 1][:2] != ("名詞", "普通名詞") \
                or before.counter or not (_glued(before, m) and _glued(m, nxt)) or not _a_shop(before.lemma):
            continue
        if not ((tags[k + 1][0] == "助詞" and tags[k + 1][1] in _SHOP_PARTICLES) or nxt.lemma == "さん"
                or (nxt.pos == "auxiliary" and nxt.lemma in ("です", "だ"))):
            continue
        m.pos, m.lemma, m.reading, m.lemma_reading, m.kana, m.goshu = "suffix", "屋", "や", "や", "ヤ", "和"
        tags[k] = ("接尾辞", "名詞的", "一般")


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


# What 辛い, "spicy", is said of (plan 272).
_FOODS = frozenset({"食べ物", "料理", "カレー", "ラーメン", "味", "スープ", "ソース", "キムチ", "唐辛子", "麻婆豆腐",
                    "鍋", "たれ", "タレ", "辛子", "からし", "わさび", "ワサビ", "ピザ", "パスタ", "チキン", "肉",
                    "おかず", "お菓子", "スナック", "ポテチ", "メニュー", "唐揚げ", "ルー", "これ", "それ"})


def _said_of_food(morphemes, i: int) -> bool:
    if any(u.surface in ("からっ", "辛っ", "激辛", "辛口") for u in morphemes):
        return True                     # (うわ、からっ！…普通に辛い: the cry says which, plan 272)
    nxt = morphemes[i + 1] if i + 1 < len(morphemes) else None
    if nxt is not None and nxt.pos == "noun" and nxt.surface in _FOODS - {"これ", "それ"}:
        return True
    for k in range(i - 1, max(-1, i - 4), -1):
        u = morphemes[k]
        if u.pos == "particle" and u.surface in ("が", "は", "も") and k >= 1 and morphemes[k - 1].surface in _FOODS \
                and morphemes[k - 1].surface not in ("これ", "それ"):
            return True
        if u.pos == "symbol":
            break
    return False


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
      "near"; マジで is one word, "seriously", no まじ and the copula's
      て form;
    - てか opening what is said, before its comma, is one word, "I mean"
      (というか said short), no て and a question's か;
    - a verb's stem and せ standing alone is the imperative of the verb
      in す the deck or JMdict holds: 鳴らせ　鳴らせ, "ring it!", no
      鳴る's causative, "let it ring"."""
    from dataclasses import replace

    out_m, out_t = [], []
    skip = set()
    for i, m in enumerate(morphemes):
        if i in skip:
            continue
        prev = morphemes[i - 1] if i > 0 else None
        nxt = morphemes[i + 1] if i + 1 < len(morphemes) else None
        opens = prev is None or (prev.pos == "symbol" and prev.surface in _UTTERANCE_MARKS)
        after = morphemes[i + 2] if i + 2 < len(morphemes) else None
        if (m.surface == "推し" and m.pos == "verb" and m.cform.startswith("連用形")
                and (nxt is None or nxt.pos == "symbol" or (nxt.pos == "particle" and nxt.surface in (
                    "が", "を", "の", "は", "も", "と", "って", "に", "で", "とか", "だけ")))):
            # 推しが尊い: the noun 推し, "one's favourite" (an idol, a
            # player), no 推す, "to recommend" (plan 272); its が is the
            # subject's.
            out_m.append(replace(m, pos="noun", lemma="推し", lemma_reading="おし", ctype="", cform="",
                                 auxiliary_use=False, written="推し", written_reading="おし"))
            out_t.append(("名詞", "普通名詞", "一般"))
            if nxt is not None and nxt.surface == "が" and nxt.conjunctive:
                out_m.append(replace(nxt, conjunctive=False))
                out_t.append(("助詞", "格助詞", "*"))
                skip.add(i + 1)
            continue
        if (m.surface == "もう" and m.pos == "adverb" and prev is not None and prev.surface == "と"
                and prev.pos == "particle" and nxt is not None and nxt.lemma == "為る" and nxt.surface == "し"
                and _glued(m, nxt) and after is not None and after.lemma == "ます"):
            # 田中ともうします, "my name is Tanaka": 申す in kana, no もう
            # "already" and する (plan 272).
            out_m.append(replace(m, surface="もうし", end=nxt.end, pos="verb", lemma="申す", reading="もうし",
                                 lemma_reading="もうす", kana="モウシ", ctype="五段-サ行", cform="連用形-一般",
                                 written="申し", written_reading="もうし"))
            out_t.append(("動詞", "一般", "*"))
            skip.add(i + 1)
            continue
        if (m.surface == "なさ" and m.pos == "verb" and m.lemma in ("成す", "為す") and nxt is not None
                and nxt.lemma == "過ぎる" and _glued(m, nxt)):
            # 変わってなさすぎて, "so unchanged": ない's stem before すぎる,
            # no 為す, "to accomplish" (plan 272).
            out_m.append(replace(m, pos="adjective", lemma="無い", lemma_reading="ない", ctype="形容詞",
                                 cform="語幹-一般", written="なさ", written_reading="なさ"))
            out_t.append(("形容詞", "非自立可能", "*"))
            continue
        if m.lemma == "辛い" and m.pos == "adjective" and m.reading.startswith("つら") and _said_of_food(morphemes, i):
            # 辛い食べ物, このカレーは辛い: からい, "spicy" -- said of
            # anything else it is つらい, "hard to bear" (plan 272).
            said = "から" + m.reading[2:]
            out_m.append(replace(m, reading=said, lemma_reading="からい", kana=said, written_reading=said))
            out_t.append(tags[i])
            continue
        if (m.surface in ("－", "−", "ー") and m.lemma == "対" and not (prev is not None and prev.surface[-1:].isdigit()
                                                                     and nxt is not None and nxt.surface[:1].isdigit())
                and any(u.surface in ("＋", "+") for u in morphemes)):
            # ＋と－の向き: the minus, a battery's negative pole -- no 対, the
            # "versus" of a score (3－2), plan 272.
            out_m.append(replace(m, lemma="マイナス", reading="まいなす", lemma_reading="まいなす", kana="マイナス",
                                 written="マイナス", written_reading="まいなす"))
            out_t.append(("名詞", "普通名詞", "一般"))
            continue
        if (m.surface == "あれ" and m.pos == "pronoun" and (prev is None or (prev.pos == "symbol"
                                                                            and prev.surface in _UTTERANCE_MARKS))
                and nxt is not None and nxt.surface in ("、", "，", "？", "?", "っ")
                and any(u.surface in ("？", "?", "っけ") for u in morphemes[i + 1:])):
            # あれ、今日って何曜日だっけ？: "huh?", a cry of one trying to
            # remember, no "that one" (plan 272).
            out_m.append(replace(m, pos="interjection", lemma="あれ", written="あれ", written_reading="あれ"))
            out_t.append(("感動詞", "一般", "*"))
            continue
        if m.surface in ("ほんま", "ホンマ") and nxt is not None and nxt.surface == "に" and _glued(m, nxt):
            # ほんまに？, "really?" (Kansai, = 本当に): one adverb (plan 272).
            out_m.append(replace(m, surface=m.surface + "に", end=nxt.end, pos="adverb", lemma="ほんまに",
                                 reading="ほんまに", lemma_reading="ほんまに", kana="ホンマニ", ctype="", cform="",
                                 written="ほんまに", written_reading="ほんまに"))
            out_t.append(("副詞", "*", "*"))
            skip.add(i + 1)
            continue
        if (m.surface == "帰り" and m.pos == "noun" and nxt is not None and nxt.surface == "や" and nxt.pos == "auxiliary"
                and _glued(m, nxt) and (after is None or after.pos == "symbol")):
            # 気ぃつけて帰りや, "get home safe": 帰る's stem before the west's
            # gentle order, no 帰り, "the way home" (plan 272).
            out_m.append(replace(m, pos="verb", lemma="帰る", lemma_reading="かえる", ctype="五段-ラ行",
                                 cform="連用形-一般", written="帰り", written_reading="かえり"))
            out_t.append(("動詞", "一般", "*"))
            continue
        if (m.surface == "とき" and m.pos == "noun" and prev is not None and prev.pos == "verb"
                and prev.cform.startswith("連用形") and _glued(prev, m) and nxt is not None
                and nxt.surface in ("や", "な", "なさい") and (after is None or after.pos == "symbol")):
            # 返しときや, "make sure you give it back": 〜ておく said short
            # (とく's stem), no 時 (plan 272).
            out_m.append(replace(m, pos="auxiliary", lemma="とく", lemma_reading="とく", ctype="五段-カ行",
                                 cform="連用形-一般", auxiliary_use=True, written="とき", written_reading="とき"))
            out_t.append(("助動詞", "*", "*"))
            continue
        if (m.surface == "し" and m.lemma == "為る" and m.pos == "verb" and nxt is not None and nxt.surface == "よ"
                and nxt.pos == "particle" and _glued(m, nxt) and prev is not None and prev.pos == "noun"
                and _glued(prev, m) and (after is None or after.pos == "symbol" or after.surface in ("か", "っか"))):
            # 休憩しよ, "let's take a break": する's volitional said short
            # (しよう), no し and よ (plan 272).
            out_m.append(replace(m, surface="しよ", end=nxt.end, reading="しよ", kana="シヨ", cform="意志推量形"))
            out_t.append(("動詞", "非自立可能", "*"))
            skip.add(i + 1)
            continue
        if (m.surface == "正しく" and m.pos == "adverb" and nxt is not None
                and (nxt.pos == "verb" or (nxt.pos == "prefix" and nxt.surface in ("お", "ご")))):
            # 正しくお使いください, 正しく入れる: 正しい's adverbial form,
            # "correctly", no まさしく, "surely" (plan 272).
            out_m.append(replace(m, pos="adjective", lemma="正しい", reading="ただしく", lemma_reading="ただしい",
                                 kana="タダシク", ctype="形容詞", cform="連用形-一般", written="正しく",
                                 written_reading="ただしく"))
            out_t.append(("形容詞", "一般", "*"))
            continue
        if (m.surface == "金貸" and prev is not None and prev.surface == "お" and prev.pos == "prefix"
                and nxt is not None and nxt.lemma == "為る" and _glued(prev, m) and _glued(m, nxt)):
            # お金貸して, "lend me some money": お金 and 貸す, no お + 金貸し,
            # "moneylending", and する (plan 272).
            out_m[-1] = replace(prev, surface="お金", end=prev.end + 1, pos="noun", lemma="お金", reading="おかね",
                                lemma_reading="おかね", kana="オカネ", written="お金", written_reading="おかね")
            out_t[-1] = ("名詞", "普通名詞", "一般")
            out_m.append(replace(m, surface="貸し", start=m.start + 1, end=nxt.end, pos="verb", lemma="貸す",
                                 reading="かし", lemma_reading="かす", kana="カシ", ctype="五段-サ行", cform="連用形-一般",
                                 written="貸し", written_reading="かし"))
            out_t.append(("動詞", "一般", "*"))
            skip.add(i + 1)
            continue
        if (m.surface == "家" and m.pos == "suffix" and m.reading in ("か", "け") and nxt is not None
                and nxt.pos == "particle" and nxt.surface in ("に", "へ", "から", "まで", "で", "を")
                and prev is not None and prev.pos == "noun" and not _a_word_with(prev.surface, "家")):
            # 財布家に忘れた, "left my wallet at home": the noun 家, no -家,
            # "-ist" -- never 芸術家 or 作家, which are words (plan 272).
            out_m.append(replace(m, pos="noun", lemma="家", reading="いえ", lemma_reading="いえ", kana="イエ",
                                 written="家", written_reading="いえ"))
            out_t.append(("名詞", "普通名詞", "一般"))
            continue
        if (m.surface == "推し" and nxt is not None and nxt.surface == "活" and _glued(m, nxt)):
            # #推し活, "supporting one's fave": one word (plan 272).
            out_m.append(replace(m, surface="推し活", end=nxt.end, pos="noun", lemma="推し活", reading="おしかつ",
                                 lemma_reading="おしかつ", kana="オシカツ", ctype="", cform="", written="推し活",
                                 written_reading="おしかつ"))
            out_t.append(("名詞", "普通名詞", "一般"))
            skip.add(i + 1)
            continue
        if (m.surface == "あっ" and nxt is not None and nxt.surface == "と" and after is not None
                and after.surface == "いう" and i + 3 < len(morphemes) and morphemes[i + 3].surface == "間"
                and _glued(m, nxt) and _glued(nxt, after) and _glued(after, morphemes[i + 3])):
            # あっという間に, "in no time": one expression, no 〜という
            # (plan 272).
            last = morphemes[i + 3]
            out_m.append(replace(m, surface="あっという間", end=last.end, pos="noun", lemma="あっという間",
                                 reading="あっというま", lemma_reading="あっというま", kana="アットイウマ", ctype="",
                                 cform="", written="あっという間", written_reading="あっというま"))
            out_t.append(("名詞", "普通名詞", "一般"))
            skip.update({i + 1, i + 2, i + 3})
            continue
        if (m.surface == "お" and m.pos == "interjection" and nxt is not None and nxt.pos == "noun" and _glued(m, nxt)
                and prev is not None and prev.pos in ("particle", "symbol")):
            # ご住所とお電話番号: the polite prefix, no "oh!" (plan 272).
            out_m.append(replace(m, pos="prefix", lemma="御", lemma_reading="お", written="お", written_reading="お"))
            out_t.append(("接頭辞", "*", "*"))
            continue
        if (m.surface == "気" and nxt is not None and nxt.surface in ("ぃ", "ィ") and _glued(m, nxt)):
            # 気ぃつけて: 気 drawn out, as the west says it (plan 272).
            out_m.append(replace(m, surface="気ぃ", end=nxt.end, reading="きぃ", kana="キィ"))
            out_t.append(("名詞", "普通名詞", "一般"))
            skip.add(i + 1)
            continue
        if (m.surface == "この" and nxt is not None and nxt.surface == "前" and _glued(m, nxt) and after is not None
                and (after.surface in ("は", "も", "、", "，") or (after.surface == "の" and i + 3 < len(morphemes)
                                                                 and morphemes[i + 3].pos == "noun"))):
            # この前は, "the other day" -- この前に, "in front of this",
            # stays two words (plan 272).
            out_m.append(replace(m, surface="この前", end=nxt.end, pos="noun", lemma="この前", reading="このまえ",
                                 lemma_reading="このまえ", kana="コノマエ", ctype="", cform="",
                                 written="この前", written_reading="このまえ"))
            out_t.append(("名詞", "普通名詞", "副詞可能"))
            skip.add(i + 1)
            continue
        if (m.surface == "なん" and m.pos == "pronoun" and nxt is not None and nxt.surface == "と" and _glued(m, nxt)
                and (prev is None or (prev.pos == "symbol" and prev.surface in _UTTERANCE_MARKS))
                and after is not None and after.surface in ("、", "，", "！", "!")):
            # なんと、「炎の剣」を手に入れた！: "lo and behold", one word
            # (plan 272).
            out_m.append(replace(m, surface="なんと", end=nxt.end, pos="adverb", lemma="何と", reading="なんと",
                                 lemma_reading="なんと", kana="ナント", written="何と", written_reading="なんと"))
            out_t.append(("副詞", "*", "*"))
            skip.add(i + 1)
            continue
        if (m.surface == "よく" and nxt is not None and nxt.surface == "ぞ" and _glued(m, nxt) and after is not None
                and after.pos not in ("symbol",)):
            # よくぞここまで, "you have done well to…": one word (plan 272).
            out_m.append(replace(m, surface="よくぞ", end=nxt.end, pos="adverb", lemma="よくぞ", reading="よくぞ",
                                 lemma_reading="よくぞ", kana="ヨクゾ", ctype="", cform="",
                                 written="よくぞ", written_reading="よくぞ"))
            out_t.append(("副詞", "*", "*"))
            skip.add(i + 1)
            continue
        if m.surface == "どん" and nxt is not None and nxt.surface == "だけ" and _glued(m, nxt):
            # どんだけ, "how much" (= どれだけ), no 殿 and だけ (plan 272).
            out_m.append(replace(m, surface="どんだけ", end=nxt.end, pos="adverb", lemma="どんだけ", reading="どんだけ",
                                 lemma_reading="どんだけ", kana="ドンダケ", ctype="", cform="",
                                 written="どんだけ", written_reading="どんだけ"))
            out_t.append(("副詞", "*", "*"))
            skip.add(i + 1)
            continue
        if (m.surface == "その" and nxt is not None and nxt.surface == "もの" and _glued(m, nxt) and prev is not None
                and prev.pos in ("noun", "suffix") and _glued(prev, m)):
            # 暮らし方そのもの, "the way of life itself": one word (plan 272).
            out_m.append(replace(m, surface="そのもの", end=nxt.end, pos="noun", lemma="その物", reading="そのもの",
                                 lemma_reading="そのもの", kana="ソノモノ", ctype="", cform="",
                                 written="そのもの", written_reading="そのもの"))
            out_t.append(("名詞", "普通名詞", "一般"))
            skip.add(i + 1)
            continue
        if (m.surface == "あり" and m.pos == "verb" and nxt is not None and nxt.surface in ("さん", "ちゃん")
                and _glued(m, nxt)):
            # ありさんたちは, "the ants" (a picture book's): 蟻, no ある (plan 272).
            out_m.append(replace(m, pos="noun", lemma="蟻", lemma_reading="あり", ctype="", cform="",
                                 written="蟻", written_reading="あり"))
            out_t.append(("名詞", "普通名詞", "一般"))
            continue
        if m.surface == "久し" and m.pos == "adjective" and nxt is not None and nxt.surface == "ぶり" and _glued(m, nxt):
            # 久しぶり, "it's been a while": one word, the deck's (plan 272).
            out_m.append(replace(m, surface="久しぶり", end=nxt.end, pos="noun", lemma="久し振り", reading="ひさしぶり",
                                 lemma_reading="ひさしぶり", kana="ヒサシブリ", ctype="", cform="",
                                 written="久しぶり", written_reading="ひさしぶり"))
            out_t.append(("名詞", "普通名詞", "一般"))
            skip.add(i + 1)
            continue
        if (m.surface == "背伸び" and m.pos == "noun" and nxt is not None and nxt.pos == "auxiliary"
                and nxt.lemma in ("た", "ない", "ます") and _glued(m, nxt)):
            # 背伸びた, "you've grown taller": 背 and 伸びる, no 背伸び, "on
            # tiptoe", which takes する (plan 272).
            out_m.append(replace(m, surface="背", end=m.start + 1, lemma="背", reading="せ", lemma_reading="せ", kana="セ",
                                 written="背", written_reading="せ"))
            out_t.append(("名詞", "普通名詞", "一般"))
            out_m.append(replace(m, surface="伸び", start=m.start + 1, pos="verb", lemma="伸びる", reading="のび",
                                 lemma_reading="のびる", kana="ノビ", ctype="上一段-バ行", cform="連用形-一般",
                                 written="伸び", written_reading="のび"))
            out_t.append(("動詞", "一般", "*"))
            continue
        if (m.pos == "prefix" and len(m.surface) == 1 and _is_kanji(m.surface) and prev is not None
                and prev.pos == "noun" and _glued(prev, m)
                and (nxt is None or nxt.pos not in ("noun", "verb", "adjective", "prefix", "suffix", "other"))):
            # 朝活はじめて: a kanji with nothing after it to prefix is the
            # noun's tail (朝 + 活, 朝活), plan 272.
            out_m.append(replace(m, pos="suffix"))
            out_t.append(("接尾辞", "名詞的", "一般"))
            continue
        if (m.surface == "エ" and m.pos == "symbol" and nxt is not None and nxt.surface == "モ" and after is not None
                and after.surface in ("かっ", "い", "く", "すぎ") and _glued(m, nxt) and _glued(nxt, after)):
            # エモかった, エモい, "so moving" (slang), no エ, も and 買う
            # (plan 272).
            cform = {"かっ": "連用形-促音便", "い": "終止形-一般", "く": "連用形-一般", "すぎ": "語幹-一般"}[after.surface]
            surface = "エモ" + ("かっ" if after.surface == "かっ" else "い" if after.surface == "い"
                                else "く" if after.surface == "く" else "")
            last = after if after.surface != "すぎ" else nxt
            out_m.append(replace(m, surface=surface, end=last.end, pos="adjective", lemma="エモい", reading=kata_to_hira(surface),
                                 lemma_reading="えもい", kana=surface, ctype="形容詞", cform=cform,
                                 written=surface, written_reading=kata_to_hira(surface)))
            out_t.append(("形容詞", "一般", "*"))
            skip.update({i + 1, i + 2} if after.surface != "すぎ" else {i + 1})
            continue
        if (m.pos == "noun" and m.surface.isascii() and m.surface.isalpha() and nxt is not None and nxt.surface in ("-", "－")
                and after is not None and after.surface.isascii() and after.surface.isalpha()
                and len(m.surface) + len(after.surface) >= 4 and _glued(m, nxt) and _glued(nxt, after)):
            # Wi-Fi, e-mail: one word, its hyphen inside (plan 272).
            surface = m.surface + "-" + after.surface
            out_m.append(replace(m, surface=m.surface + nxt.surface + after.surface, end=after.end, lemma=surface,
                                 reading=surface, lemma_reading=surface, kana=surface, written=surface,
                                 written_reading=surface))
            out_t.append(("名詞", "普通名詞", "一般"))
            skip.update({i + 1, i + 2})
            continue
        if m.surface in ("あ", "え", "お") and m.pos == "symbol":
            # …あ、じゃあカードで: a cry UniDic can take for a mark (plan 272).
            out_m.append(replace(m, pos="interjection", lemma=m.surface, lemma_reading=m.surface,
                                 written=m.surface, written_reading=m.surface))
            out_t.append(("感動詞", "一般", "*"))
            continue
        if m.surface == "せい" and m.pos == "symbol":
            # ラーメンのせい, "the ramen's fault": the noun 所為, which UniDic
            # can tag as a mark (plan 272).
            out_m.append(replace(m, pos="noun", lemma="所為", lemma_reading="せい", written="所為",
                                 written_reading="せい"))
            out_t.append(("名詞", "普通名詞", "一般"))
            continue
        if (m.surface == "ほん" and m.pos == "pronoun" and nxt is not None and nxt.pos == "particle"
                and nxt.surface in ("を", "が", "は", "も", "の", "や", "と", "に", "が", "って")):
            # ほんをよむ: the noun 本, "a book", no それ said in the west
            # (ほんで, ほんなら stay それ's), plan 272.
            out_m.append(replace(m, pos="noun", lemma="本", lemma_reading="ほん", written="本",
                                 written_reading="ほん"))
            out_t.append(("名詞", "普通名詞", "一般"))
            continue
        if (m.surface == "ね" and m.pos == "particle" and prev is not None and prev.pos == "adjective"
                and prev.cform.startswith("連用形") and prev.surface.endswith("く") and _glued(prev, m)
                and (nxt is None or nxt.pos == "symbol")):
            # えぐくね？, すごくね？: ない said short, "isn't it…?", no ね
            # (plan 272).
            out_m.append(replace(m, pos="adjective", lemma="無い", lemma_reading="ない", ctype="形容詞",
                                 cform="終止形-一般", conjunctive=False, written="ない", written_reading="ない"))
            out_t.append(("形容詞", "非自立可能", "*"))
            continue
        if (m.surface == "それ" and m.pos == "pronoun" and opens and nxt is not None and _glued(m, nxt)
                and nxt.pos == "particle" and nxt.surface.rstrip("〜ー～") == "な"
                and (nxt.surface != "な" or after is None or after.pos == "symbol" or not _glued(nxt, after))):
            # それな, "right?!, exactly" (plan 272).
            out_m.append(replace(m, surface=m.surface + nxt.surface, end=nxt.end, lemma="それな",
                                 lemma_reading="それな", reading="それな", kana="ソレナ", pos="interjection"))
            out_t.append(("感動詞", "一般", "*"))
            skip.add(i + 1)
            continue
        if (m.surface == "ガ" and m.pos == "symbol" and nxt is not None and nxt.surface == "チ" and _glued(m, nxt)):
            # ガチ, "for real" (slang), which UniDic cuts into two marks;
            # ガチで, "seriously" (plan 272).
            with_de = after is not None and after.surface == "で" and _glued(nxt, after)
            last = after if with_de else nxt
            surface = "ガチで" if with_de else "ガチ"
            out_m.append(replace(m, surface=surface, end=last.end, lemma=surface, reading=kata_to_hira(surface),
                                 lemma_reading=kata_to_hira(surface), kana=surface.replace("で", "デ"),
                                 pos="adverb" if with_de else "noun", ctype="", cform=""))
            out_t.append(("副詞", "*", "*") if with_de else ("名詞", "普通名詞", "一般"))
            skip.update({i + 1, i + 2} if with_de else {i + 1})
            continue
        if ((m.surface == "あ" and nxt is not None and nxt.surface in ("ざす", "ざーす", "ざっす"))
                or (m.surface == "あざ" and nxt is not None and nxt.surface == "っす")) and _glued(m, nxt):
            # あざす, あざっす: ありがとうございます said short (plan 272).
            surface = m.surface + nxt.surface
            out_m.append(replace(m, surface=surface, end=nxt.end, lemma="あざす", reading=surface,
                                 lemma_reading="あざす", kana=surface, pos="interjection", ctype="", cform=""))
            out_t.append(("感動詞", "一般", "*"))
            skip.add(i + 1)
            continue
        if (m.surface == "て" and m.pos == "conjunction" and opens and nxt is not None and _glued(m, nxt)
                and nxt.surface in ("へっ", "へ", "へへ")):
            # てへっ, the embarrassed "ehehe" (plan 272).
            out_m.append(replace(m, surface=m.surface + nxt.surface, end=nxt.end, lemma="てへ", reading="てへ",
                                 lemma_reading="てへ", kana="テヘ", pos="interjection"))
            out_t.append(("感動詞", "一般", "*"))
            skip.add(i + 1)
            continue
        if (m.pos == "noun" and m.proper and _katakana_word(m.surface) and nxt is not None
                and nxt.surface in ("ッ", "っ") and _glued(m, nxt) and (after is None or after.pos == "symbol")):
            # バキッ！: a sound, cut off -- UniDic's バキ, a name, and a
            # stray ッ (plan 272).
            out_m.append(replace(m, surface=m.surface + nxt.surface, end=nxt.end, lemma=m.surface + nxt.surface,
                                 reading=m.reading + "っ", kana=m.kana + "ッ",
                                 pos="adverb", proper=False, name_kind="", unknown=False))
            out_t.append(("副詞", "*", "*"))
            skip.add(i + 1)
            continue
        if (m.surface in ("w", "ｗ", "W", "Ｗ") and prev is not None and prev.pos != "symbol"
                and any("\u3041" <= c <= "\u9fff" for c in prev.surface)):
            # 喉死んだｗ: one w is a laugh too (plan 272).
            out_m.append(replace(m, pos="interjection", proper=False, name_kind="", unknown=False))
            out_t.append(("感動詞", "一般", "*"))
            continue
        if (m.surface in ("こう", "そう", "ああ", "どう") and nxt is not None and after is not None
                and _glued(m, nxt) and _glued(nxt, after) and after.surface == "た"
                and ((nxt.lemma in ("為る", "する") and nxt.surface == "し") or nxt.surface == "いっ")
                and i + 3 < len(morphemes) and morphemes[i + 3].pos in ("noun", "prefix")):
            # こうした状況, どういったご用件: the adnominal "such", "what
            # kind of", no past of する or 言う (plan 272).
            surface = m.surface + nxt.surface + after.surface
            out_m.append(replace(m, surface=surface, end=after.end, lemma=_known(surface) or surface, reading=surface,
                                 lemma_reading=surface, kana="".join(u.kana for u in (m, nxt, after)),
                                 pos="adnominal", ctype="", cform=""))
            out_t.append(("連体詞", "*", "*"))
            skip.update({i + 1, i + 2})
            continue
        if (m.surface == "参っ" and m.lemma == "参る" and opens and nxt is not None and nxt.lemma == "た"
                and _glued(m, nxt) and (after is None or after.pos == "symbol"
                                        or (after.pos == "particle" and after.surface in ("な", "なあ", "ね", "よ", "わ")))):
            # 参ったな, "I'm beaten, I give up" -- said alone, no humble
            # "came" (plan 272).
            out_m.append(replace(m, surface="参った", end=nxt.end, lemma="参った", reading="まいった",
                                 lemma_reading="まいった", kana="マイッタ", pos="interjection", ctype="", cform=""))
            out_t.append(("感動詞", "一般", "*"))
            skip.add(i + 1)
            continue
        if (m.pos == "adjective" and prev is not None and prev.pos in ("particle", "symbol")
                and m.reading[:1] in _UNVOICE and any(_is_kanji(c) for c in m.surface)
                and ((m.lemma or ""), _UNVOICE[m.reading[0]] + m.lemma_reading[1:]) in _deck_forms()):
            # わかりみが深い: ふかい -- UniDic's ぶかい is the 深い of 興味深い,
            # a compound's second half (plan 272).
            unvoiced = _UNVOICE[m.reading[0]]
            m = replace(m, reading=unvoiced + m.reading[1:], lemma_reading=unvoiced + m.lemma_reading[1:],
                        kana=chr(ord(unvoiced) + 0x60) + m.kana[1:])
        if (m.pos == "adjective" and m.lemma in ("深い", "ふかい") and prev is not None and prev.pos == "noun"
                and _glued(prev, m) and m.reading.startswith("ふ")):
            # 興味深い, 注意深い: the compound's ぶかい (plan 272).
            m = replace(m, reading="ぶ" + m.reading[1:], kana="ブ" + m.kana[1:])
        if (m.surface == "札" and m.reading == "さつ" and prev is not None and prev.pos == "noun" and _glued(prev, m)
                and not prev.counter and prev.surface not in ("円", "千", "万", "百", "ドル", "ユーロ")
                and not any(c in "0123456789０１２３４５６７８９一二三四五六七八九十" for c in prev.surface)):
            # 番号札, 名札: a tag, ふだ -- さつ is a banknote, after its
            # amount (千円札) (plan 272).
            m = replace(m, reading="ふだ", lemma_reading="ふだ", kana="フダ", written_reading="ふだ")
        if m.surface == "楓" and m.reading == "ふう":
            # 楓, the maple and the name, is かえで; ふう is the sweetgum
            # of botany (plan 272).
            m = replace(m, reading="かえで", lemma_reading="かえで", kana="カエデ", written_reading="かえで")
        if (m.surface == "鶏" and m.reading == "にわとり" and nxt is not None and _glued(m, nxt)
                and nxt.surface in ("もも肉", "もも", "肉", "むね肉", "むね", "胸肉", "ささみ", "ひき肉", "ガラ", "皮",
                                    "手羽", "手羽先", "手羽元", "腿肉", "レバー")):
            # 鶏もも肉: the meat is とり (plan 272).
            m = replace(m, reading="とり", lemma_reading="とり", kana="トリ", written_reading="とり")
        if (m.surface == "切り" and m.pos == "suffix" and m.reading == "きり" and prev is not None
                and prev.pos == "noun" and _glued(prev, m)):
            # みじん切り, 千切り: a cut, voiced (plan 272).
            m = replace(m, reading="ぎり", kana="ギリ")
        then = morphemes[i + 2] if i + 2 < len(morphemes) else None
        if (m.surface in ("ま", "間") and m.pos == "noun" and nxt is not None and nxt.surface == "も"
                and then is not None and then.surface == "なく" and _glued(m, nxt) and _glued(nxt, then)
                and not (prev is not None and (prev.pos in ("verb", "adjective", "auxiliary") or prev.surface == "の"))):
            # まもなく閉館, 電車はまもなく到着します: 間も無く, "soon", the
            # N2 card -- never 休む間もなく, "without a moment to rest", the
            # noun 間 a verb describes (plan 272).
            surface = m.surface + "もなく"
            out_m.append(replace(m, surface=surface, end=then.end, lemma="間も無く", reading="まもなく",
                                 lemma_reading="まもなく", kana="マモナク", pos="adverb", ctype="", cform="",
                                 written="間も無く", written_reading="まもなく"))
            out_t.append(("副詞", "*", "*"))
            skip.update({i + 1, i + 2})
            continue
        if (m.surface in ("何時ごろ", "何時頃") and m.pos == "noun"):
            # 何時ごろ, "around what time": the N5 何時 read なんじ and ごろ,
            # 〜ごろ's lesson (何時ごろかえりますか) -- UniDic's one word
            # いつごろ said nothing (plan 272).
            out_m.extend([
                replace(m, surface="何時", end=m.start + 2, lemma="何時", reading="なんじ", lemma_reading="なんじ",
                        kana="ナンジ", written="何時", written_reading="なんじ"),
                replace(m, surface=m.surface[2:], start=m.start + 2, lemma="頃", reading="ごろ", lemma_reading="ころ",
                        kana="ゴロ", written="頃", written_reading="ころ"),
            ])
            out_t.extend([("名詞", "普通名詞", "一般"), ("名詞", "普通名詞", "副詞可能")])
            continue
        if (m.surface == "相" and m.pos == "prefix" and nxt is not None and nxt.pos == "verb" and _glued(m, nxt)
                and _written_word("相" + nxt.lemma)):
            # 相次ぐ, "to follow one after another": one verb, no 相 and
            # 次ぐ "to rank next" -- and 相次いで, before what happens, the
            # adverb "one after another" (plan 272).
            verb = replace(nxt, surface="相" + nxt.surface, start=m.start, lemma="相" + nxt.lemma,
                           reading="あい" + nxt.reading, lemma_reading="あい" + nxt.lemma_reading,
                           kana="アイ" + nxt.kana, written="相" + nxt.lemma, written_reading="あい" + nxt.lemma_reading)
            te = after if after is not None and after.surface == "で" and _glued(nxt, after) else None
            then = morphemes[i + 3] if i + 3 < len(morphemes) else None
            if te is not None and _written_word(verb.surface + "で") and not (
                    then is not None and then.pos == "verb" and then.auxiliary_use):
                out_m.append(replace(verb, surface=verb.surface + "で", end=te.end, lemma=verb.surface + "で",
                                     reading=verb.reading + "で", lemma_reading=verb.reading + "で",
                                     kana=verb.kana + "デ", pos="adverb", ctype="", cform="",
                                     written=verb.surface + "で", written_reading=verb.reading + "で"))
                out_t.append(("副詞", "*", "*"))
                skip.update({i + 1, i + 2})
                continue
            out_m.append(verb)
            out_t.append(tags[i + 1])
            skip.add(i + 1)
            continue
        if (m.pos in ("other", "adverb") and nxt is not None and nxt.pos == "auxiliary"
                and nxt.surface.startswith("らし") and _glued(m, nxt) and _written_word(m.lemma + "らしい")):
            # 尤もらしい, "plausible"; わざとらしい: one adjective (plan 272).
            ending = nxt.surface[2:]
            out_m.append(replace(m, surface=m.surface + nxt.surface, end=nxt.end, lemma=m.lemma + "らしい",
                                 reading=m.reading + nxt.reading, lemma_reading=m.lemma_reading + "らしい",
                                 kana=m.kana + nxt.kana, pos="adjective", ctype="形容詞", cform=nxt.cform))
            out_t.append(("形容詞", "一般", "*"))
            skip.add(i + 1)
            continue
        if (m.proper and m.name_kind == "place" and nxt is not None
                and nxt.surface in ("くん", "君", "ちゃん", "さん", "様", "さま")):
            # 湊くん: the name of the one くん is said to, no harbour (plan 272).
            m = replace(m, name_kind="given")
        if (_kana_letters(m.surface) and nxt is not None and nxt.proper and nxt.name_kind in ("given", "person")
                and _kana_letters(nxt.surface) and _glued(m, nxt) and len(m.surface + nxt.surface) >= 4
                and _known(m.surface + nxt.surface)):
            # わか + りみ is わかりみ, "so relatable", and しゅう + まつ 週末 --
            # no names (plan 272).
            joined = m.surface + nxt.surface
            out_m.append(replace(m, surface=joined, end=nxt.end, lemma=_known(joined), reading=joined,
                                 lemma_reading=joined, kana=m.kana + nxt.kana, pos="noun", ctype="", cform="",
                                 proper=False, name_kind="", unknown=False))
            out_t.append(("名詞", "普通名詞", "一般"))
            skip.add(i + 1)
            continue
        if (m.surface == "おか" and m.pos == "verb" and nxt is not None and nxt.surface == "けして"
                and nxt.pos == "adverb" and _glued(m, nxt)):
            # お手数をおかけして, ご迷惑をおかけして: the humble お + 掛ける
            # + して, which UniDic cuts as 置く and 決して, "never" (plan
            # 272). おかけします it reads right.
            at = m.start
            out_m.extend([
                replace(m, surface="お", end=at + 1, lemma="御", reading="お", lemma_reading="お", kana="オ",
                        pos="prefix", ctype="", cform="", auxiliary_use=False, written="お", written_reading="お"),
                replace(m, surface="かけ", start=at + 1, end=at + 3, lemma="掛ける", reading="かけ",
                        lemma_reading="かける", kana="カケ", pos="verb", ctype="下一段-カ行", cform="連用形-一般",
                        auxiliary_use=False, written="掛ける", written_reading="かける"),
                replace(nxt, surface="し", start=at + 3, end=at + 4, lemma="為る", reading="し", lemma_reading="する",
                        kana="シ", pos="verb", ctype="サ行変格", cform="連用形-一般", auxiliary_use=True,
                        written="する", written_reading="する"),
                replace(nxt, surface="て", start=at + 4, end=nxt.end, lemma="て", reading="て", lemma_reading="て",
                        kana="テ", pos="particle", ctype="", cform="", conjunctive=True, auxiliary_use=False,
                        written="て", written_reading="て"),
            ])
            out_t.extend([("接頭辞", "*", "*"), ("動詞", "一般", "*"), ("動詞", "非自立可能", "*"),
                          ("助詞", "接続助詞", "*")])
            skip.add(i + 1)
            continue
        if (m.surface == "よる" and m.pos == "verb" and prev is not None and prev.surface == "の"
                and prev.pos == "particle"):
            # 八月十五日のよる八時, きのうのよる: 夜, "night" -- 因る takes に
            # (人による), never の (plan 272).
            m = replace(m, pos="noun", lemma="夜", lemma_reading="よる", ctype="", cform="", written="夜",
                        written_reading="よる")
            tags = tags[:i] + [("名詞", "普通名詞", "副詞可能")] + tags[i + 1:]
        if (m.pos == "adjective" and m.lemma in _KU_NOUNS and m.surface.endswith("く")
                and ((prev is not None and prev.surface == "の" and prev.pos == "particle")
                     # (...and before one: ちかくのこうえん, the park nearby, plan 272)
                     or (nxt is not None and nxt.surface == "の" and nxt.pos == "particle"))):
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
        elif (m.surface in ("マジ", "まじ") and nxt is not None and nxt.surface == "で"
              and (i + 2 >= len(morphemes) or morphemes[i + 2].surface != "す")):
            out_m.append(replace(m, surface=m.surface + "で", end=nxt.end, lemma="まじで", reading="まじで",
                                 lemma_reading="まじで", kana=m.kana + "デ", pos="adverb", ctype="", cform="",
                                 conjunctive=False, adjectival=False))
            out_t.append(("副詞", "*", "*"))
            skip.add(i + 1)
            continue
        elif (m.surface in ("て", "って") and opens and nxt is not None and nxt.surface == "か"
              and i + 2 < len(morphemes) and morphemes[i + 2].surface in ("、", "，", ",", "\u3000", " ")):
            out_m.append(replace(m, surface=m.surface + "か", end=nxt.end, lemma="てか", reading="てか",
                                 lemma_reading="てか", kana=m.kana + "カ", pos="conjunction", ctype="", cform="",
                                 conjunctive=False, auxiliary_use=False))
            out_t.append(("接続詞", "*", "*"))
            skip.add(i + 1)
            continue
        elif (m.pos == "verb" and m.cform.startswith("未然形") and nxt is not None and nxt.surface == "せ"
              and nxt.pos == "auxiliary" and nxt.lemma == "せる"
              and (i + 2 >= len(morphemes) or morphemes[i + 2].pos == "symbol"
                   or morphemes[i + 2].surface in ("よ", "や", "ぞ"))
              and (lemma := _imperative_in_su(m)) is not None):
            out_m.append(replace(m, surface=m.surface + "せ", end=nxt.end, lemma=lemma,
                                 reading=m.reading + "せ", lemma_reading=kata_to_hira(m.reading) + "す",
                                 kana=m.kana + "セ", ctype="五段-サ行", cform="命令形"))
            out_t.append(("動詞", "一般", "*"))
            skip.add(i + 1)
            continue
        elif (m.pos == "adverb" and nxt is not None and nxt.surface == m.surface and nxt.pos == "adverb"
              and _kana_letters(m.surface) and len(m.surface) >= 2 and _glued(m, nxt)
              and _known(m.surface * 2) and i + 2 < len(morphemes) and morphemes[i + 2].surface == "と"):
            # もう + もう + と is もうもうと, "thickly (of smoke)", no もう
            # "already" twice (plan 272).
            out_m.append(replace(m, surface=m.surface * 2, end=nxt.end, lemma=_known(m.surface * 2),
                                 reading=m.reading * 2, lemma_reading=m.lemma_reading * 2, kana=m.kana * 2))
            out_t.append(tags[i])
            skip.add(i + 1)
            continue
        elif (m.surface == "よう" and m.pos == "adverb" and out_m and len(out_m[-1].surface) == 1
              and _kana_letters(out_m[-1].surface) and _glued(out_m[-1], m)
              and kata_to_hira(out_m[-1].surface) + "る" in _deck_kana()
              and (nxt is None or nxt.surface in ("と", "か", "。", "！", "!", "よ", "ね"))):
            # 早くねようという: 寝る's volitional, which UniDic cut into the
            # particle ね and よう, "well" (plan 272).
            head = out_m.pop()
            out_t.pop()
            verb = kata_to_hira(head.surface) + "る"
            out_m.append(replace(head, surface=head.surface + "よう", end=m.end, lemma=_first_spelling(verb),
                                 reading=kata_to_hira(head.surface) + "よう", lemma_reading=verb,
                                 kana=head.kana + "ヨウ", pos="verb", ctype="下一段-ナ行", cform="意志推量形",
                                 conjunctive=False, auxiliary_use=False))
            out_t.append(("動詞", "一般", "*"))
            continue
        elif (m.surface == "ある" and m.pos == "adnominal" and prev is not None and prev.pos == "noun"
              and _glued(prev, m) and nxt is not None and nxt.pos == "noun"):
            # 名誉ある賞, 歴史ある町: the verb ある, "having", after the noun it
            # has -- 或る, "a certain", opens its phrase (ある日) (plan 272).
            m = replace(m, pos="verb", lemma="有る", lemma_reading="ある", ctype="五段-ラ行", cform="連体形-一般",
                        written="ある", written_reading="ある")
            tags = tags[:i] + [("動詞", "非自立可能", "*")] + tags[i + 1:]
        elif m.surface == "あに" and m.pos == "adverb":
            # 豈, "how could…", is classical; a page's あに is 兄, "older
            # brother": あにといもうと (plan 272).
            m = replace(m, pos="noun", lemma="兄", lemma_reading="あに")
            tags = tags[:i] + [("名詞", "普通名詞", "一般")] + tags[i + 1:]
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


@lru_cache(maxsize=1)
def _deck_forms() -> frozenset:
    """Every (kanji, kana) the deck spells a card as, and each kana alone
    as ("", kana): read off the deck itself, never through card_lookup,
    whose indexes are built by this module's tokenize."""
    from content.vocab_data import VOCAB_BY_LEVEL

    out = set()
    for entries in VOCAB_BY_LEVEL.values():
        for entry in entries:
            for kana in (entry.get("kana") or "").split("/"):
                out.add((entry.get("kanji") or "", kana))
                out.add(("", kana))
    return frozenset(out)


# What opens a speaker's own introduction: どうも、…です, はいどうも、….
_GREETINGS = frozenset({"どうも", "ども", "どーも", "はいどうも", "こんにちは", "こんちは", "こんばんは",
                        "はじめまして", "初めまして", "おはようございます", "どうもこんにちは"})
_INTRO_ENDS = frozenset("。！？!?…　 ")


# A voiced first kana, and the one it voices (ぶ is ふ's).
_UNVOICE = dict(zip("がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽ",
                    "かきくけこさしすせそたちつてとはひふへほはひふへほ"))


def _katakana_word(text: str) -> bool:
    return len(text) >= 2 and all("\u30a1" <= c <= "\u30fc" for c in text)


def _kana_word(text: str) -> bool:
    """Whether `text` is two kana or more, hiragana or katakana (ー too)."""
    return len(text) >= 2 and all("\u3041" <= c <= "\u30ff" for c in text)


def _introduced(morphemes: list[Morpheme], tags: list[tuple]) -> tuple[list, list]:
    """The name a speaker gives themselves (plan 272): after a greeting,
    どうもー、ゲーム実況のカイトです is Kaito, no "kite"; and before と申し
    ます anywhere. Only a word in kana the deck has no card for: どうも、
    学生です is a student."""
    from dataclasses import replace

    out_m, out_t = list(morphemes), list(tags)
    for i, m in enumerate(morphemes):
        if m.pos != "noun" or m.proper or not _kana_word(m.surface) or i + 1 >= len(morphemes):
            continue
        nxt, after = morphemes[i + 1], morphemes[i + 2:]
        humble = (nxt.surface == "と" and len(after) >= 2 and after[0].lemma == "申す" and after[1].lemma == "ます")
        closes = nxt.surface == "です" and (not after or after[0].surface in _INTRO_ENDS
                                           or after[0].surface in ("ね", "よ", "ー"))
        if not (humble or closes):
            continue
        if closes and not humble:
            # Back over what the speaker is of (ゲーム実況の) and a comma, to
            # the greeting that opens the line.
            k = i - 1
            if k >= 0 and morphemes[k].surface == "の" and morphemes[k].pos == "particle":
                k -= 1
                while k >= 0 and morphemes[k].pos in ("noun", "suffix", "prefix"):
                    k -= 1
            while k >= 0 and morphemes[k].pos == "symbol":
                k -= 1
            start = k
            while start >= 0 and not (morphemes[start].pos == "symbol" and morphemes[start].surface in _INTRO_ENDS):
                start -= 1
            said = "".join(u.surface for u in morphemes[start + 1:k + 1] if u.pos != "symbol").replace("ー", "")
            if k < 0 or said not in _GREETINGS:
                continue
        if ("", kata_to_hira(m.surface)) in _deck_forms() or ("", m.surface) in _deck_forms():
            continue
        out_m[i] = replace(m, proper=True, name_kind="given", unknown=True)
        out_t[i] = ("名詞", "固有名詞", "人名")
    return out_m, out_t


# The animals a picture book names, いぬの ぽち (plan 272), as written in
# kana or kanji.
NAMED_ANIMALS = frozenset({"いぬ", "犬", "ねこ", "猫", "うさぎ", "兎", "ふくろう", "梟", "くま", "熊", "さる", "猿",
                           "とり", "鳥", "ぶた", "豚", "こぶた", "子豚", "きつね", "狐", "たぬき", "狸", "かえる", "蛙",
                           "かめ", "亀", "ねずみ", "鼠", "りす", "栗鼠", "ぞう", "象", "ひよこ", "あひる", "はと", "鳩",
                           "からす", "烏", "こいぬ", "子犬", "こねこ", "子猫", "いるか", "くじら", "ペンギン", "パンダ"})
_NAME_PARTICLES = frozenset({"が", "は", "を", "と", "も", "に", "の", "や"})


def named_animal(morphemes, i: int) -> bool:
    """Whether morphemes[i], a word in hiragana, is the name of the animal
    before it and its の: いぬの ぽちが, ねこの みいちゃん (plan 272)."""
    m = morphemes[i]
    if i < 2 or not _kana_letters(m.surface) or len(m.surface) < 2 or m.pos not in ("noun", "adverb", "interjection"):
        return False
    of, animal = morphemes[i - 1], morphemes[i - 2]
    if not (of.surface == "の" and of.pos == "particle" and (animal.surface in NAMED_ANIMALS or animal.lemma in NAMED_ANIMALS)):
        return False
    nxt = morphemes[i + 1] if i + 1 < len(morphemes) else None
    if nxt is not None and nxt.surface in _HONORIFIC_ENDS:
        return True
    # (Without an honorific only a word no noun could be: いぬの はなが is
    # the dog's nose.)
    return (nxt is not None and nxt.pos == "particle" and nxt.surface in _NAME_PARTICLES
            and (m.pos != "noun" or m.unknown))


def _named_animals(morphemes: list[Morpheme], tags: list[tuple]) -> tuple[list, list]:
    """The name a picture book gives its animal, read as a name: いぬの
    ぽちが is Pochi, no ぽち, "a dot"; ふくろうの ほうほうさん no 方法."""
    from dataclasses import replace

    out_m, out_t = list(morphemes), list(tags)
    for i in range(len(morphemes)):
        if named_animal(morphemes, i):
            out_m[i] = replace(morphemes[i], pos="noun", proper=True, name_kind="given", unknown=True,
                               ctype="", cform="")
            out_t[i] = ("名詞", "固有名詞", "人名")
    return out_m, out_t


def _names_kept(morphemes: list[Morpheme], tags: list[tuple]) -> tuple[list, list]:
    """A name in hiragana the window reads as a name once is the name
    wherever it stands in it (plan 272): ゆうしゃ　たろうは…, then たろうの
    こうげき！ -- the hero's attack, never "first son"'s. (One in katakana
    UniDic tags as it meets it.)"""
    from dataclasses import replace

    names = {m.surface for m, t in zip(morphemes, tags)
             if _kana_letters(m.surface) and len(m.surface) >= 2 and (tuple(t[1:3]) == ("固有名詞", "人名")
                                                                    or m.name_kind in ("person", "given", "family"))}
    if not names:
        return morphemes, tags
    out_m, out_t = [], []
    for m, t in zip(morphemes, tags):
        if m.surface in names and m.pos == "noun" and tuple(t[1:3]) != ("固有名詞", "人名"):
            m = replace(m, proper=True, name_kind="given", unknown=True)
            t = ("名詞", "固有名詞", "人名")
        out_m.append(m)
        out_t.append(t)
    return out_m, out_t


def _no_names(morphemes: list[Morpheme], tags: list[tuple]) -> tuple[list, list]:
    """A name written with a katakana ノ between its kanji, read as one
    (plan 272): 大関・霧ノ海 is the wrestler Kirinoumi, no "fog", の and
    "sea". The particle is written の; a ノ between kanji is a name's
    (一ノ瀬, which UniDic knows)."""
    from dataclasses import replace

    out_m, out_t = [], []
    i = 0
    while i < len(morphemes):
        m = morphemes[i]
        run = morphemes[i:i + 3]
        if (len(run) == 3 and run[1].surface == "ノ" and m.pos in ("noun", "prefix") and run[2].pos in ("noun", "suffix")
                and all(_is_kanji(c) for c in m.surface + run[2].surface)
                and m.end == run[1].start and run[1].end == run[2].start):
            surface = "".join(u.surface for u in run)
            reading = kata_to_hira(m.reading) + "の" + kata_to_hira(run[2].reading)
            out_m.append(replace(m, surface=surface, end=run[2].end, lemma=surface, reading=reading,
                                 lemma_reading=reading, pos="noun", ctype="", cform="", proper=True,
                                 name_kind="other", unknown=False, auxiliary_use=False, conjunctive=False))
            out_t.append(("名詞", "固有名詞", "一般"))
            i += 3
            continue
        out_m.append(m)
        out_t.append(tags[i])
        i += 1
    return out_m, out_t


def _imperative_in_su(m: Morpheme) -> str | None:
    """The verb in す whose imperative a stem and せ spell -- 鳴ら + せ is
    鳴らす's 鳴らせ -- where the deck or JMdict holds it, or None."""
    if not m.surface or kata_to_hira(m.reading)[-1:] not in "あかさたなはまやらわがざだばぱ":
        return None
    lemma, reading = m.surface + "す", kata_to_hira(m.reading) + "す"
    import content.vocab_jmdict_data as jmdict_db
    if (lemma, reading) in _deck_forms() or jmdict_db.get_by_key(lemma, reading):
        return lemma
    return None


@lru_cache(maxsize=4096)
def _written_word(surface: str) -> str:
    """"adverb", "adnominal" or "noun" where the deck or JMdict holds
    `surface` as a word, else "": 親知らず, a wisdom tooth; 相変わらず, "as
    usual"; 見知らぬ, "unfamiliar". A deck word is what UniDic reads it as
    alone (思わず, an adverb)."""
    import content.vocab_jmdict_data as jmdict_db

    rows = jmdict_db.by_kanji(surface, limit=3) if any(_is_kanji(c) for c in surface) else jmdict_db.by_kana(surface)
    deck = any(kanji == surface for kanji, _kana in _deck_forms()) or ("", surface) in _deck_forms()
    if not rows and not deck:
        return ""
    if deck and not rows:
        alone, _tags = _tag(surface, 0, _plain_tagger)
        return {"adverb": "adverb", "adnominal": "adnominal"}.get(alone[0].pos, "noun") if len(alone) == 1 else "noun"
    for row in rows[:1]:
        tags = {t for sense in jmdict_db.get_senses(row.get("kanji", ""), row.get("kana", "")) or []
                for t in sense.get("tags") or ()}
        if tags & {"adv", "adv-to"} and "n" not in tags:
            return "adverb"
        if tags & {"adj-pn", "adj-f"}:
            return "adnominal"
    return "noun"


# The ず words a grammar point is written with after its particle
# (〜にかかわらず, 〜に限らず, 〜を問わず, 〜によらず): the point's, never a
# word of their own (plan 272). 運営に至らぬ点 is the word 至らぬ.
_POINTS_ZU = frozenset({"かかわらず", "拘わらず", "関わらず", "拘らず", "限らず", "かぎらず", "問わず", "とわず",
                        "よらず", "寄らず", "因らず", "依らず", "構わず", "かまわず", "関せず", "せず"})


# The verbs a conjunctive て/で hands to a grammar point in their
# auxiliary use (〜ている, 〜てある, 〜ておく, 〜てしまう, 〜てみる, 〜てくる,
# 〜ていく, 〜てあげる／くれる／もらう, 〜てくださる／いただく, 〜ております,
# 〜てございます, 〜てまいります, 〜ていらっしゃる, 〜てさしあげる, 〜てならない,
# 〜てたまらない, 〜てほしい), by UniDic's lemma (plan 272). UniDic files
# 出す, 切れる and 渡る as possible auxiliaries too (書き出す, 使い切れる),
# and after a て they are the verbs themselves: まとめて出しとく.
TE_AUXILIARIES = frozenset({
    "居る", "いる", "有る", "ある", "置く", "おく", "仕舞う", "しまう", "見る", "みる", "来る", "くる",
    "行く", "いく", "上げる", "あげる", "呉れる", "くれる", "貰う", "もらう", "下さる", "くださる",
    "頂く", "いただく", "御座る", "ござる", "参る", "まいる", "居らっしゃる", "いらっしゃる",
    "差し上げる", "さしあげる", "成る", "なる", "堪る", "たまる", "頂戴", "おる", "欲しい", "ほしい",
})


def _zu_words(morphemes: list[Morpheme], tags: list[tuple]) -> tuple[list, list]:
    """A word that ends in the negative ず, which UniDic cuts into a verb
    and ず (plan 272): 親 + 知ら + ず is 親知らず, a wisdom tooth, never "not
    knowing a parent"; 相 + 変わら + ず is 相変わらず, "as usual". The
    longest run the deck or JMdict writes so is that word, and a が after
    it is the subject's (親知らずが痛む)."""
    from dataclasses import replace

    out_m, out_t = [], []
    for i, m in enumerate(morphemes):
        if not (m.pos == "auxiliary" and m.lemma == "ず" and m.surface in ("ず", "ぬ") and len(out_m) >= 1
                and out_m[-1].pos == "verb" and _glued(out_m[-1], m)):
            out_m.append(m)
            out_t.append(tags[i])
            continue
        joined = None
        after = morphemes[i + 1] if i + 1 < len(morphemes) else None
        for n in (3, 2):
            if after is not None and (after.surface in ("に", "には", "にも", "とも", "して") or (
                    after.surface == "し" and i + 2 < len(morphemes) and morphemes[i + 2].surface == "て")):
                break                  # 思わずにはいられない, 意図せずして: 〜ずに's, 〜ずして's
            if len(out_m) < n - 1:
                continue
            run = out_m[len(out_m) - (n - 1):] + [m]
            if not all(_glued(a, b) for a, b in zip(run, run[1:])):
                continue
            if n == 3 and run[0].pos not in ("noun", "prefix"):
                continue
            before = out_m[len(out_m) - n] if len(out_m) >= n else None
            if n == 2 and before is not None and before.pos == "particle" and (
                    "".join(u.surface for u in run) in _POINTS_ZU
                    or not (after is not None and after.pos in ("noun", "prefix") or _written_word(
                        "".join(u.surface for u in run)) == "adverb")):
                # (年齢に拘わらず: the verb takes its に (〜にかかわらず); してはならぬ
                # is 〜てはならない's. 運営に至らぬ点 is a word before its noun,
                # 姉に劣らず an adverb, plan 272.)
                continue
            surface = "".join(u.surface for u in run)
            kind = _written_word(surface)
            quantity = n == 2 and before is not None and (before.counter or before.surface.translate(_FULLWIDTH_DIGITS).isdigit())
            if kind and (n == 3 or kind in ("adverb", "adnominal") or quantity):
                # (...or after an amount: １００ドル足らず, "a little under
                # $100".)
                # (Two pieces only as an adverb or a word that describes a
                # noun: せず of 努力せずして and 知らず of いざ知らず are
                # their points'.)
                joined = (run, surface, kind)
                break
        if joined is None:
            out_m.append(m)
            out_t.append(tags[i])
            continue
        run, surface, kind = joined
        del out_m[len(out_m) - (len(run) - 1):]
        del out_t[len(out_t) - (len(run) - 1):]
        reading = "".join(u.reading for u in run)
        out_m.append(replace(run[0], surface=surface, end=m.end, lemma=surface, reading=reading,
                             lemma_reading=reading, kana="".join(u.kana for u in run), pos=kind, ctype="", cform="",
                             auxiliary_use=False, conjunctive=False, written=surface, written_reading=reading))
        out_t.append(("副詞", "*", "*") if kind == "adverb" else ("名詞", "普通名詞", "一般"))
    # (The が after the word is the subject's: UniDic, reading a verb's ず,
    # took it for "but".)
    for k in range(1, len(out_m)):
        if out_m[k].surface == "が" and out_m[k].conjunctive and out_m[k - 1].pos == "noun" \
                and out_m[k - 1].lemma.endswith(("ず", "ぬ")):
            out_m[k] = replace(out_m[k], conjunctive=False)
            out_t[k] = ("助詞", "格助詞", "*")
    return out_m, out_t


def _katakana_only(text: str) -> bool:
    return bool(text) and all("\u30a1" <= c <= "\u30fa" or c == "ー" for c in text)


def _calls_out(m) -> bool:
    """Whether `m` is what is said to someone before their name and a
    comma: a command (立て、ジン), a call (おい、ねえ)."""
    return (m.pos == "verb" and m.cform.startswith("命令形")) \
        or m.surface in ("おい", "ねえ", "なあ", "ほら", "こら", "さあ")


# (surfaces, the word, its part of speech, its reading) for the regional
# words _regional_word puts back together (plan 272).
_REGIONAL_WORDS = (
    # (a laugh and a roar UniDic cut in two: おーっほっほ, うおおおっ)
    (("おーっ", "ほっほ"), "おーっほっほ", "interjection", "おーっほっほ"),
    (("うおお", "おっ"), "うおおおっ", "interjection", "うおおおっ"),
    (("おみ", "ゃー", "さん"), "おみゃーさん", "pronoun", "おみゃーさん"),
    (("なん", "くる", "ない"), "なんくるない", "interjection", "なんくるない"),
    (("で", "ーじ"), "でーじ", "adverb", "でーじ"),
    (("そっ", "たなご", "ど"), "そったなごど", "noun", "そったなごど"),
    # (a kitchen tool the dictionary spells 泡だて器, plan 272)
    (("泡立て", "器"), "泡立て器", "noun", "あわだてき", "泡だて器"),
)


def _regional_word(morphemes, i: int):
    """(how many morphemes, surface, lemma, pos, reading) for a regional
    word UniDic cut apart at morphemes[i], or None."""
    for parts, word, pos, said, *lemma in _REGIONAL_WORDS:
        run = morphemes[i:i + len(parts)]
        if tuple(u.surface for u in run) == parts and all(a.end == b.start for a, b in zip(run, run[1:])):
            return len(parts), word, (lemma[0] if lemma else word), pos, said
    return None


# What is opened on a screen or a page (開く read ひらく, 開けない "cannot
# open"), plan 272.
_OPENED_ON_SCREEN = ("ファイル", "ページ", "アプリ", "リンク", "サイト", "画面", "メール", "添付", "フォルダ", "フォルダー",
                     "PDF", "ＰＤＦ", "本", "ノート", "教科書")

# What comes back as an answer comes back (返る), where a person comes
# home (帰る): こたえが かえって きた, an echo's "hello" (plan 272).
_COMES_BACK = frozenset({"答え", "返事", "返答", "反応", "声", "こだま", "木霊", "山彦", "やまびこ", "メール", "手紙",
                         "お金", "金", "お釣り", "釣り", "ボール"})


def _cut_words(morphemes: list[Morpheme], tags: list[tuple]) -> tuple[list, list]:
    """Words UniDic cuts or joins where the sentence says otherwise
    (plan 272):

    - お + しら + せ is the noun お知らせ, "notice", where no する makes it
      the humble お〜する (おしらせします);
    - い + やがる after a を is いやがる, 嫌がる, "to dislike": 居る takes no
      を, and its rude やがる is no word of a page that writes を before it;
    - a verb that is no word alone and ない is the adjective the two
      spell: 思いがけない, "unexpected";
    - 家の子, "a retainer" to UniDic, is 家, の and 子: 貧しい家の子;
    - a noun of ごろ (初めごろ) no dictionary holds is the noun and ごろ;
      何線 is 何 and 線, "which line";
    - し + かね after an amount is しか and a kana verb: 三時間しかねられ
      なかった is 寝る, never 兼ねる;
    - どう + し + て is どうして, "why", but before いい, も, いる, もらう
      (どうしていいか, "what to do")."""
    from dataclasses import replace

    out_m, out_t = [], []
    skip = set()
    for i, m in enumerate(morphemes):
        if i in skip:
            continue
        prev = morphemes[i - 1] if i > 0 else None
        nxt = morphemes[i + 1] if i + 1 < len(morphemes) else None
        after = morphemes[i + 2] if i + 2 < len(morphemes) else None
        if (m.surface == "お" and m.pos == "prefix" and nxt is not None and nxt.surface == "しら"
                and after is not None and after.surface == "せ" and _glued(m, nxt) and _glued(nxt, after)
                and not (i + 3 < len(morphemes) and morphemes[i + 3].lemma in ("為る", "する", "致す", "いたす"))):
            out_m.append(replace(m, surface="おしらせ", end=after.end, lemma="お知らせ", reading="おしらせ",
                                 lemma_reading="おしらせ", kana="オシラセ", pos="noun", ctype="", cform="",
                                 written="お知らせ", written_reading="おしらせ"))
            out_t.append(("名詞", "普通名詞", "一般"))
            skip.update({i + 1, i + 2})
            continue
        if (m.surface == "だ" and m.pos == "auxiliary" and m.lemma == "た" and prev is not None
                and prev.cform.startswith("意志推量形") and nxt is not None and nxt.surface in ("なんて", "なんか", "と")):
            # 勝とうだなんて: the copula after what one meant to do, "that you'd
            # try to beat me" -- no past (plan 272)
            out_m.append(replace(m, lemma="だ", lemma_reading="だ", ctype="助動詞-ダ", cform="終止形-一般",
                                 written="だ", written_reading="だ"))
            out_t.append(("助動詞", "*", "*"))
            continue
        if (m.surface == "お" and m.pos == "interjection" and nxt is not None and nxt.pos == "verb" and _glued(m, nxt)
                and nxt.cform.startswith("連用形") and after is not None
                and after.lemma in ("為る", "する", "致す", "いたす", "申し上げる", "頂く", "いただく", "下さる", "くださる")):
            # お呼びするまで: the humble お of お〜する, no "oh!" (plan 272)
            out_m.append(replace(m, pos="prefix", lemma="御", lemma_reading="お", written="御", written_reading="お"))
            out_t.append(("接頭辞", "*", "*"))
            continue
        if (m.surface == "かけ" and m.pos == "noun" and prev is not None and prev.surface == "お" and _glued(prev, m)
                and nxt is not None and ((nxt.surface == "に" and after is not None and after.lemma in ("成る", "なる"))
                                         or nxt.lemma in ("下さる", "くださる"))):
            # おかけになって, おかけください: 掛ける, to take a seat, said up --
            # no 欠け, a chip (plan 272)
            out_m.append(replace(m, pos="verb", lemma="掛ける", lemma_reading="かける", ctype="下一段-カ行",
                                 cform="連用形-一般", written="掛ける", written_reading="かける"))
            out_t.append(("動詞", "一般", "*"))
            continue
        if (m.surface == "長押" and nxt is not None and nxt.surface == "し" and nxt.lemma in ("為る", "する") and _glued(m, nxt)
                and after is not None and after.lemma in ("為る", "する")):
            # 3秒以上長押しすると: a long press, ながおし -- no 長押 (なげし), a
            # beam, and two する (plan 272)
            out_m.append(replace(m, surface="長押し", end=nxt.end, lemma="長押し", reading="ながおし",
                                 lemma_reading="ながおし", kana="ナガオシ", written="長押し", written_reading="ながおし"))
            out_t.append(("名詞", "普通名詞", "サ変可能"))
            skip.add(i + 1)
            continue
        if (m.surface == "やっ" and m.lemma == "遣る" and nxt is not None and nxt.surface in ("べ", "べえ") and _glued(m, nxt)
                and (prev is None or prev.pos == "symbol") and (after is None or after.pos == "symbol")):
            # やっべ、終電もう出ちゃってんじゃん: やばい said in alarm (plan 272)
            out_m.append(replace(m, surface=m.surface + nxt.surface, end=nxt.end, lemma="やっべ",
                                 reading=m.reading + nxt.surface, lemma_reading="やっべ", kana="ヤッベ",
                                 pos="interjection", ctype="", cform="", auxiliary_use=False,
                                 written="やっべ", written_reading="やっべ"))
            out_t.append(("感動詞", "一般", "*"))
            skip.add(i + 1)
            continue
        if (m.surface == "いか" and m.lemma == "行く" and nxt is not None and nxt.surface == "ん" and _glued(m, nxt)
                and (after is None or after.pos == "symbol" or after.surface in ("のう", "のぉ", "な", "ぞ", "よ", "わ", "ね"))
                and prev is not None and (prev.surface in ("で", "は", "ちゃ", "じゃ", "そりゃ", "こりゃ") or prev.pos == "symbol")):
            # せっかちでいかんのう, そりゃいかん: "won't do" (= いけない), no
            # 行く's negative (plan 272)
            out_m.append(replace(m, surface="いかん", end=nxt.end, lemma="いかん", reading="いかん",
                                 lemma_reading="いかん", kana="イカン", pos="adjective", ctype="", cform="",
                                 auxiliary_use=False, written="いかん", written_reading="いかん"))
            out_t.append(("形容詞", "一般", "*"))
            skip.add(i + 1)
            continue
        if (m.surface in ("立て", "育て") and m.pos == "verb" and m.lemma in ("立てる", "育てる")
                and (prev is None or prev.surface in ("。", "！", "!", "「", "、")) and nxt is not None
                and nxt.surface in ("、", "！", "!", "。", "よ", "」")):
            # 立て、ジン。: 立つ's command, "stand up!" -- no 立てる with
            # nothing to stand up (plan 272)
            out_m.append(replace(m, lemma=m.lemma[:-2] + "つ", lemma_reading=m.lemma_reading[:-2] + "つ",
                                 ctype="五段-タ行", cform="命令形", written=m.lemma[:-2] + "つ",
                                 written_reading=m.lemma_reading[:-2] + "つ"))
            out_t.append(tags[i])
            continue
        if (m.pos == "noun" and not m.proper and 2 <= len(m.surface) <= 4 and _katakana_only(m.surface)
                and prev is not None and prev.surface == "、" and len(out_m) >= 2 and _calls_out(out_m[-2])
                and (nxt is None or nxt.surface in ("。", "！", "!", "？", "?", "」"))):
            # 立て、ジン。: the one called to, a name -- no ジン "gin" (plan 272)
            out_m.append(replace(m, proper=True, name_kind="given", unknown=True))
            out_t.append(("名詞", "固有名詞", "人名"))
            continue
        # Regional words UniDic cuts into other words (plan 272): Nagoya's
        # おみゃーさん, Okinawa's なんくるない and でーじ, Tōhoku's そったな
        # ごど; and Kansai's 毎日よう (よく), where it read 日曜.
        joined = _regional_word(morphemes, i)
        if joined is not None:
            n, surface, lemma, pos, said = joined
            out_m.append(replace(m, surface=surface, end=morphemes[i + n - 1].end, lemma=lemma, reading=said,
                                 lemma_reading=said, kana=kata_of(said), pos=pos, ctype="", cform="",
                                 auxiliary_use=False, proper=False, name_kind="", unknown=False,
                                 written=lemma, written_reading=said))
            out_t.append({"noun": ("名詞", "普通名詞", "一般"), "pronoun": ("代名詞", "*", "*"),
                          "adverb": ("副詞", "*", "*"), "interjection": ("感動詞", "一般", "*"),
                          "particle": ("助詞", "終助詞", "*")}[pos])
            skip.update(range(i + 1, i + n))
            continue
        if (m.surface == "よう" and m.lemma in ("様", "よう") and m.pos in ("suffix", "noun") and prev is not None
                and prev.surface in ("毎日", "毎週", "毎朝", "いつも", "ほんま") and nxt is not None
                and nxt.surface not in ("に", "な", "だ", "で", "です", "の", "や", "じゃ") and nxt.pos != "symbol"):
            # 毎日ようお稽古しはって: the west's よう (= よく), "so diligently"
            # -- no likeness of every day (plan 272)
            out_m.append(replace(m, lemma="良く", lemma_reading="よう", pos="adverb", ctype="", cform="",
                                 written="よう", written_reading="よう"))
            out_t.append(("副詞", "*", "*"))
            continue
        if (m.surface == "わ" and m.pos == "particle" and nxt is not None and nxt.surface == "い" and _glued(m, nxt)
                and prev is not None and (prev.surface == "ん" or prev.pos in ("verb", "auxiliary", "adjective"))
                and (after is None or after.pos == "symbol")):
            # 修行が足りんわい: an old man's わい, closing what he says (plan 272)
            out_m.append(replace(m, surface="わい", end=nxt.end, lemma="わい", reading="わい", lemma_reading="わい",
                                 kana="ワイ", written="わい", written_reading="わい"))
            out_t.append(("助詞", "終助詞", "*"))
            skip.add(i + 1)
            continue
        if (m.pos == "noun" and len(m.surface) == 1 and _has_kanji_char(m.surface) and nxt is not None
                and nxt.surface == "ない" and _glued(m, nxt) and (after is None or after.pos in ("symbol", "particle"))
                and _deck_word(m.surface + "い") and prev is not None and prev.pos in ("symbol", "particle", "pronoun")):
            # それ、安ないで: the west's 安くない, the adjective's stem and ない
            # -- no 安 "cheapness" (plan 272)
            said = next((k for w, k in _deck_forms() if w == m.surface + "い"), m.reading + "い")
            out_m.append(replace(m, pos="adjective", lemma=m.surface + "い", reading=said[:-1], lemma_reading=said,
                                 kana=kata_of(said[:-1]), ctype="形容詞", cform="語幹-一般", written=m.surface + "い",
                                 written_reading=said))
            out_t.append(("形容詞", "一般", "*"))
            continue
        if (m.surface == "毎" and nxt is not None and nxt.surface == "日よう" and _glued(m, nxt)):
            # 毎日ようお稽古しはって: 毎日 and the west's よう (= よく) -- no 日曜
            out_m += [replace(m, surface="毎日", end=nxt.start + 1, lemma="毎日", reading="まいにち",
                              lemma_reading="まいにち", kana="マイニチ", pos="noun", written="毎日",
                              written_reading="まいにち"),
                      replace(nxt, surface="よう", start=nxt.start + 1, lemma="良く", reading="よう",
                              lemma_reading="よう", kana="ヨウ", pos="adverb", ctype="", cform="",
                              written="よう", written_reading="よう")]
            out_t += [("名詞", "普通名詞", "副詞可能"), ("副詞", "*", "*")]
            skip.add(i + 1)
            continue
        if (_katakana_only(m.surface) and 2 <= len(m.surface) <= 4 and m.surface.endswith("ッ")
                and _has_kanji_char(m.lemma) and nxt is not None and nxt.surface == "と" and nxt.pos == "particle"
                and _glued(m, nxt)):
            # おやつをガッと取った: a sound cut short and its と, "with a
            # grab" -- no 月 read がつ (plan 272)
            surface = m.surface + "と"
            said = kata_to_hira(m.surface) + "と"
            out_m.append(replace(m, surface=surface, end=nxt.end, lemma=surface, reading=said, lemma_reading=said,
                                 kana=m.surface + "ト", pos="adverb", ctype="", cform="", proper=False,
                                 name_kind="", unknown=True, written=surface, written_reading=said))
            out_t.append(("副詞", "*", "*"))
            skip.add(i + 1)
            continue
        if (m.surface in ("たろ", "だろ") and m.pos == "auxiliary" and m.cform == "意志推量形" and prev is not None
                and prev.pos == "verb" and prev.cform.startswith(("連用形-促音便", "連用形-撥音便", "連用形-イ音便"))
                and _glued(prev, m) and nxt is not None and nxt.surface == "か" and _glued(m, nxt)
                and (after is None or after.pos == "symbol")):
            # 歩いて帰ったろか: the west's てやろう, "shall I just walk
            # home?" -- no past, and no だろう (plan 272)
            out_m.append(replace(m, lemma="たろ", lemma_reading="たろ", written="たろ", written_reading="たろ"))
            out_t.append(("助動詞", "*", "*"))
            continue
        if (m.surface == "見" and m.pos == "noun" and nxt is not None and nxt.surface == "で" and _glued(m, nxt)
                and after is not None and after.surface.startswith(("でけ", "でく", "でけろ")) and _glued(nxt, after)):
            # ストーブ見ででけろな: the north's 見て, voiced, and でけろ (= てくれ),
            # "watch the stove for me" -- no 見 "looking" and 出来る (plan 272)
            out_m += [replace(m, pos="verb", lemma="見る", lemma_reading="みる", ctype="上一段-マ行",
                              cform="連用形-一般", written="見る", written_reading="みる"),
                      replace(nxt, lemma="て", lemma_reading="て", pos="particle", conjunctive=True,
                              written="て", written_reading="て"),
                      replace(after, lemma="けろ", lemma_reading="けろ", pos="auxiliary", ctype="", cform="命令形",
                              written="けろ", written_reading="けろ")]
            out_t += [("動詞", "一般", "*"), ("助詞", "接続助詞", "*"), ("助動詞", "*", "*")]
            skip.update({i + 1, i + 2})
            continue
        if (m.surface == "じゃ" and nxt is not None and nxt.surface == "ね" and _glued(m, nxt) and prev is not None
                and prev.pos in ("noun", "other") and (after is None or after.surface in ("？", "?", "。", "w", "ｗ"))):
            # ワンチャン休講じゃね？: じゃない？ said short, "isn't it?" (plan 272)
            out_m.append(replace(m, surface="じゃね", end=nxt.end, lemma="じゃね", reading="じゃね", lemma_reading="じゃね",
                                 kana="ジャネ", pos="particle", ctype="", cform="", written="じゃね",
                                 written_reading="じゃね"))
            out_t.append(("助詞", "終助詞", "*"))
            skip.add(i + 1)
            continue
        if (m.lemma == "開ける" and m.surface.startswith("開け") and prev is not None and prev.surface in ("が", "は", "も")
                and i >= 2 and morphemes[i - 2].surface.endswith(_OPENED_ON_SCREEN)):
            # 添付ファイルが開けない: 開く (ひらく) as it can be done, a file
            # or a page opened -- no 開ける (あける), which takes a を (plan 272)
            said = "ひらけ" + m.reading[2:]
            out_m.append(replace(m, lemma="開く", reading=said, lemma_reading="ひらく", kana=kata_of(said),
                                 written="開く", written_reading="ひらく"))
            out_t.append(tags[i])
            continue
        if (m.surface == "かえっ" and m.pos == "verb" and nxt is not None and nxt.surface == "て" and _glued(m, nxt)
                and (prev is None or prev.surface in ("、", "。", "が", "は", "も")) and after is not None
                and (after.pos == "adjective" or (after.pos == "other" and _has_kanji_char(after.surface)))):
            # かえって良くなった, かえって危険だ: 却って, "on the contrary",
            # before what it turns round -- no 帰る (plan 272)
            out_m.append(replace(m, surface="かえって", end=nxt.end, lemma="却って", reading="かえって",
                                 lemma_reading="かえって", kana="カエッテ", pos="adverb", ctype="", cform="",
                                 auxiliary_use=False, written="却って", written_reading="かえって"))
            out_t.append(("副詞", "*", "*"))
            skip.add(i + 1)
            continue
        if (m.surface == "かえって" and m.lemma == "却って" and nxt is not None and nxt.pos == "verb"
                and nxt.lemma in ("来る", "行く") and nxt.surface[:1] in ("き", "く", "こ", "来", "い", "行")):
            # こたえが かえって きました: 返る and the て of 〜てくる, "came
            # back" -- no 却って, "on the contrary" (plan 272). 帰る where
            # a person comes home.
            back = prev is not None and prev.surface in ("が", "は", "も") and i >= 2 \
                and morphemes[i - 2].lemma in _COMES_BACK
            verb, said = ("返る", "かえる") if back else ("帰る", "かえる")
            out_m += [replace(m, surface="かえっ", end=m.end - 1, lemma=verb, reading="かえっ", lemma_reading=said,
                              kana="カエッ", pos="verb", ctype="五段-ラ行", cform="連用形-促音便", auxiliary_use=False,
                              written=verb, written_reading=said),
                      replace(m, surface="て", start=m.end - 1, lemma="て", reading="て", lemma_reading="て",
                              kana="テ", pos="particle", ctype="", cform="", conjunctive=True, auxiliary_use=False,
                              written="て", written_reading="て")]
            out_t += [("動詞", "一般", "*"), ("助詞", "接続助詞", "*")]
            continue
        if (m.surface == "い" and m.pos == "verb" and m.lemma == "居る" and nxt is not None
                and nxt.lemma == "やがる" and _glued(m, nxt) and prev is not None and prev.surface == "を"):
            surface = m.surface + nxt.surface
            out_m.append(replace(m, surface=surface, end=nxt.end, lemma="嫌がる", reading=surface,
                                 lemma_reading="いやがる", kana=m.kana + nxt.kana, ctype="五段-ラ行",
                                 cform=nxt.cform, auxiliary_use=False, written="嫌がる", written_reading="いやがる"))
            out_t.append(("動詞", "一般", "*"))
            skip.add(i + 1)
            continue
        if (m.pos == "verb" and nxt is not None and nxt.pos == "auxiliary" and nxt.lemma == "ない"
                and _glued(m, nxt) and m.cform.startswith("未然形") and any(_is_kanji(c) for c in m.surface)
                and not _written_word(m.lemma) and _an_adjective(m.surface + "ない")):
            surface = m.surface + nxt.surface
            out_m.append(replace(m, surface=surface, end=nxt.end, lemma=m.surface + "ない",
                                 reading=m.reading + nxt.reading, lemma_reading=m.reading + "ない",
                                 kana=m.kana + nxt.kana, pos="adjective", ctype="形容詞", cform=nxt.cform,
                                 auxiliary_use=False, written=m.surface + "ない",
                                 written_reading=m.reading + "ない"))
            out_t.append(("形容詞", "一般", "*"))
            skip.add(i + 1)
            continue
        if (m.pos == "verb" and m.lemma.endswith("せる") and len(m.lemma) >= 4 and m.lemma[-3] in _A_TO_U
                and m.surface.startswith(m.lemma[:-2]) and m.surface[len(m.lemma) - 2:len(m.lemma) - 1] == "せ"
                and not _written_word(m.lemma) and _written_word(m.lemma[:-3] + _A_TO_U[m.lemma[-3]])):
            # 習わせられた: 習う's causative, UniDic's 習わせる -- no word of
            # its own (知らせる, 見せる, 聞かせる are), so the verb and せる
            # (plan 272), and 〜させられる is lit.
            base = m.lemma[:-3] + _A_TO_U[m.lemma[-3]]
            base_said = m.lemma_reading[:-3] + _A_TO_U[m.lemma[-3]]
            stem_len = len(m.lemma) - 2
            tail = m.surface[stem_len:]
            cut = m.start + stem_len
            out_m += [replace(m, surface=m.surface[:stem_len], end=cut, lemma=base, reading=m.reading[:-len(tail)],
                              lemma_reading=base_said, kana=m.kana[:-len(tail)], ctype="五段", cform="未然形-一般",
                              auxiliary_use=False, written=base, written_reading=base_said),
                      replace(m, surface=tail, start=cut, lemma="せる", reading=tail, lemma_reading="せる",
                              kana=m.kana[-len(tail):], pos="auxiliary", ctype="助動詞-セル",
                              auxiliary_use=False, goshu="和", written="せる", written_reading="せる")]
            out_t += [("動詞", "一般", "*"), ("助動詞", "*", "*")]
            continue
        if (m.pos == "noun" and not m.proper and len(m.surface) >= 2 and all(_is_kanji(c) for c in m.surface)
                and not _written_word(m.surface)):
            alone, _alone_tags = _tag(m.surface, 0, _plain_tagger)
            if len(alone) == 1 and alone[0].proper and alone[0].name_kind in ("family", "person"):
                # 大家の山田に言ってください: a surname UniDic read as a noun
                # in its sentence and as the name alone (plan 272).
                m = replace(m, proper=True, name_kind=alone[0].name_kind)
        if (m.pos == "noun" and i == 0 and all("\u3041" <= c <= "\u309f" for c in m.surface)
                and 2 <= len(m.surface) <= 4 and nxt is not None and nxt.surface == "より"
                and all(u.pos == "symbol" for u in morphemes[i + 2:]) and not _deck_kana().get(m.surface)):
            # ゆいより: a letter's signature, "from Yui" (plan 272).
            m = replace(m, proper=True, name_kind="given", unknown=True)
        if (m.surface == "しろ" and m.pos == "verb" and m.lemma in ("為る", "する") and m.cform.startswith("命令形")
                and (prev is None or prev.pos == "symbol") and nxt is not None and nxt.pos == "particle"
                and nxt.surface not in ("よ", "ね", "な", "わ", "ぞ", "ぜ", "って", "ってば", "よな", "てば")):
            # しろとあおがあります: 白, "white", written in kana -- an order
            # opens no phrase before its particle (plan 272).
            m = replace(m, pos="noun", lemma="白", lemma_reading="しろ", kana="シロ", ctype="", cform="",
                        auxiliary_use=False, written="白", written_reading="しろ")
            out_m.append(m)
            out_t.append(("名詞", "普通名詞", "一般"))
            continue
        if (m.pos == "noun" and m.surface in ("父", "母", "兄", "姉") and nxt is not None and nxt.surface == "上"
                and nxt.pos == "suffix" and _glued(m, nxt)):
            # 父上, 母上: "father", said with respect, read うえ (plan 272).
            surface, said = m.surface + "上", m.reading + "うえ"
            out_m.append(replace(m, surface=surface, end=nxt.end, lemma=surface, reading=said, lemma_reading=said,
                                 kana=m.kana + "ウエ", written=surface, written_reading=said))
            out_t.append(("名詞", "普通名詞", "一般"))
            skip.add(i + 1)
            continue
        if (m.surface == "それ" and m.pos == "pronoun" and nxt is not None and nxt.surface == "と" and after is not None
                and after.surface == "も" and _glued(m, nxt) and _glued(nxt, after)
                and (prev is None or prev.pos == "symbol" or prev.surface == "か")
                and (i + 3 >= len(morphemes) or morphemes[i + 3].pos in ("symbol", "noun", "prefix", "pronoun",
                                                                          "verb", "adjective", "adverb"))):
            # それとも, "or": no それ and the と and も of "with it too"
            # (plan 272).
            out_m.append(replace(m, surface="それとも", end=after.end, lemma="其れとも", reading="それとも",
                                 lemma_reading="それとも", kana="ソレトモ", pos="conjunction",
                                 written="それとも", written_reading="それとも"))
            out_t.append(("接続詞", "*", "*"))
            skip.update({i + 1, i + 2})
            continue
        if (m.surface == "その" and m.pos == "adnominal" and prev is not None and prev.pos == "noun" and _glued(prev, m)
                and nxt is not None and nxt.surface == "もの" and _glued(m, nxt)):
            # 機会そのもの, "the chance itself" (plan 272).
            out_m.append(replace(m, surface="そのもの", end=nxt.end, lemma="其の物", reading="そのもの",
                                 lemma_reading="そのもの", kana="ソノモノ", pos="noun", written="其の物",
                                 written_reading="そのもの"))
            out_t.append(("名詞", "普通名詞", "一般"))
            skip.add(i + 1)
            continue
        if (m.surface == "と" and m.pos == "particle" and nxt is not None and nxt.surface == "も" and _glued(m, nxt)
                and prev is not None and _glued(prev, m) and (prev.surface in _PAIRS or (
                    prev.pos == "suffix" and i >= 2 and morphemes[i - 2].surface in _PAIRS))
                and after is not None and after.pos in ("noun", "adjective", "other", "adverb", "symbol",
                                                        "pronoun", "prefix")):
            # 上下線とも, 両方とも: "both" (共), no と and も, before what
            # UniDic reads 両親とも元気 on -- never a verb (両親とも話した,
            # "with my parents too", plan 272).
            out_m.append(replace(m, surface="とも", end=nxt.end, lemma="共", reading="とも", lemma_reading="とも",
                                 kana="トモ", pos="suffix", conjunctive=False, written="共", written_reading="とも"))
            out_t.append(("接尾辞", "名詞的", "一般"))
            skip.add(i + 1)
            continue
        if m.surface == "草" and m.reading == "そう" and (
                (prev is not None and _a_laugh_typed(prev.surface)) or (nxt is not None and nxt.lemma in ("生える", "不可避"))):
            # 草生える, ｗｗｗ 草: net slang's くさ, "lol" (plan 272).
            m = replace(m, reading="くさ", lemma_reading="くさ", kana="クサ", written_reading="くさ")
        if (m.surface == "お" and m.pos == "prefix" and nxt is not None and nxt.surface == "いで" and nxt.lemma == "出でる"
                and _glued(m, nxt)
                and not (after is not None and after.lemma in ("下さる", "くださる", "成る", "なる", "為さる", "なさる"))):
            # よくおいでくださいました, こっちにおいで: お出で, coming (said
            # with respect), no 出でる "to go out" (plan 272).
            out_m.append(replace(m, surface="おいで", end=nxt.end, lemma="お出で", reading="おいで", lemma_reading="おいで",
                                 kana="オイデ", pos="noun", written="お出で", written_reading="おいで"))
            out_t.append(("名詞", "普通名詞", "一般"))
            skip.add(i + 1)
            continue
        if m.surface == "はっぱ" and m.lemma == "発破":
            # はっぱ written in kana is 葉っぱ, "leaf"; 発破, "a blast", is
            # written in kanji (plan 272).
            m = replace(m, lemma="葉っぱ", written="葉っぱ")
        if (m.surface == "あ" and nxt is not None and nxt.surface == "かん" and _glued(m, nxt)
                and (prev is None or prev.pos == "symbol"
                     or (prev.surface == "かん" and i >= 2 and morphemes[i - 2].surface == "あ"))):
            # あかん, "no good, don't" (Kansai): no あ and かん (plan 272).
            out_m.append(replace(m, surface="あかん", end=nxt.end, lemma="あかん", reading="あかん", lemma_reading="あかん",
                                 kana="アカン", pos="interjection", written="あかん", written_reading="あかん"))
            out_t.append(("感動詞", "一般", "*"))
            skip.add(i + 1)
            continue
        if (m.surface == "あか" and m.lemma in ("明く", "開く") and m.cform.startswith("未然形") and nxt is not None
                and nxt.surface == "ん" and nxt.lemma == "ず" and _glued(m, nxt)
                and prev is not None and prev.surface in ("は", "も") and prev.pos == "particle"
                and (after is None or after.pos == "symbol" or (after.pos == "particle" and after.surface in (
                    "で", "よ", "わ", "て", "な", "ねん", "のに", "けど", "から", "って", "やん", "ぞ")))):
            # それはあかん, "that's no good" (Kansai): no 開く's negative,
            # which a door takes with が (ドアがあかん) (plan 272).
            out_m.append(replace(m, surface="あかん", end=nxt.end, lemma="あかん", reading="あかん", lemma_reading="あかん",
                                 kana="アカン", pos="interjection", ctype="", cform="", written="あかん",
                                 written_reading="あかん"))
            out_t.append(("感動詞", "一般", "*"))
            skip.add(i + 1)
            continue
        if (m.surface == "や" and nxt is not None and nxt.surface == "ん" and nxt.pos == "particle" and _glued(m, nxt)
                and prev is not None and _glued(prev, m)
                and (prev.pos in ("adjective", "verb", "noun", "other") or prev.surface in ("ええ", "いい"))
                and (after is None or after.pos == "symbol" or (after.pos == "particle" and after.surface in (
                    "か", "け", "けど", "な", "ね", "なあ", "ねえ")))):
            # 美味しいやん, ええやん: the Kansai "isn't it!" (= じゃない),
            # no や and の (plan 272).
            # (...and やんか, じゃないか: しゃあないやんか, plan 272)
            ka = after is not None and after.surface == "か" and after.pos == "particle" and _glued(nxt, after) and (
                i + 3 >= len(morphemes) or morphemes[i + 3].pos == "symbol")
            said = "やんか" if ka else "やん"
            out_m.append(replace(m, surface=said, end=(after if ka else nxt).end, pos="particle", lemma=said,
                                 reading=said, lemma_reading=said, kana=kata_of(said), ctype="", cform="",
                                 auxiliary_use=False, conjunctive=False, written=said, written_reading=said))
            out_t.append(("助詞", "終助詞", "*"))
            skip.update({i + 1, i + 2} if ka else {i + 1})
            continue
        if (m.surface == "は" and m.pos == "particle" and nxt is not None and nxt.surface == "よ" and _glued(m, nxt)
                and (prev is None or prev.pos == "symbol") and after is not None
                and (after.pos == "verb" or (after.lemma in ("為る", "する")))):
            # はよ帰りたい, はよせんと: 早よ, "quickly" (western Japan),
            # no topic は and よ (plan 272).
            out_m.append(replace(m, surface="はよ", end=nxt.end, lemma="早よ", reading="はよ", lemma_reading="はよ",
                                 kana="ハヨ", pos="adverb", written="早よ", written_reading="はよ"))
            out_t.append(("副詞", "*", "*"))
            skip.add(i + 1)
            continue
        three = (m.surface == "あり" and m.lemma == "有る" and nxt is not None and nxt.surface == "え"
                 and nxt.lemma == "得る" and after is not None and after.surface in ("ん", "へん", "ねえ", "ねー")
                 and _glued(m, nxt) and _glued(nxt, after))
        if three or (m.surface == "あり" and nxt is not None and nxt.surface in ("えん", "えへん", "えねえ", "えねー")
                     and _glued(m, nxt)):
            # ありえん, ありえへん, "no way, impossible" (= ありえない), no
            # 円 nor the interjection えへん (plan 272).
            last = after if three else nxt
            surface = m.surface + (nxt.surface + after.surface if three else nxt.surface)
            out_m.append(replace(m, surface=surface, end=last.end, lemma="有り得ない", reading=surface,
                                 lemma_reading="ありえない", kana="".join(chr(ord(c) + 0x60) for c in surface), pos="adjective", ctype="",
                                 cform="", written="有り得ない", written_reading="ありえない"))
            out_t.append(("形容詞", "一般", "*"))
            skip.update({i + 1, i + 2} if three else {i + 1})
            continue
        three = (m.surface == "つら" and nxt is not None and nxt.surface == "た" and after is not None
                 and after.surface == "ん" and _glued(m, nxt) and _glued(nxt, after))
        if three or (m.surface == "つら" and nxt is not None and nxt.surface == "たん" and _glued(m, nxt)):
            # つらたん, slang for つらい, "it's tough" (plan 272) -- cut つら
            # + た + ん too.
            last = after if three else nxt
            out_m.append(replace(m, surface="つらたん", end=last.end, lemma="つらたん", reading="つらたん",
                                 lemma_reading="つらたん", kana="ツラタン", pos="adjective", ctype="", cform="",
                                 written="つらたん", written_reading="つらたん"))
            out_t.append(("形容詞", "一般", "*"))
            skip.update({i + 1, i + 2} if three else {i + 1})
            continue
        if (m.surface == "へん" and m.pos == "noun" and prev is not None and _glued(prev, m)
                and (prev.cform.startswith("未然形") or (prev.conjunctive and prev.surface in ("て", "で"))
                     or prev.pos == "auxiliary" and prev.surface in ("て", "で"))):
            # 聞いてへん, 知らへん: the Kansai negative, no 辺 (plan 272).
            out_m.append(replace(m, pos="auxiliary", lemma="へん", lemma_reading="へん", ctype="", cform="",
                                 written="へん", written_reading="へん"))
            out_t.append(("助動詞", "*", "*"))
            continue
        if (m.surface == "え" and m.pos == "interjection" and nxt is not None and nxt.surface == "え"
                and nxt.pos == "interjection" and _glued(m, nxt) and after is not None and _glued(nxt, after)
                and (after.surface in ("やん", "やろ", "やろう", "や", "やで", "やね", "やな", "な", "なあ", "よ", "ね",
                                       "ねん", "わ", "の", "けど", "から", "し", "で", "ん"))):
            # まだええやん, "it's fine, isn't it": the west's いい, no two
            # cries of "eh" (plan 272); its やん is "isn't it!".
            attributive = after.surface in ("の", "ん")
            out_m.append(replace(m, surface="ええ", end=nxt.end, pos="adjective", lemma="良い", reading="ええ",
                                 lemma_reading="よい", kana="エエ", ctype="形容詞",
                                 cform="連体形-一般" if attributive else "終止形-一般",
                                 written="ええ", written_reading="ええ"))
            out_t.append(("形容詞", "非自立可能", "*"))
            skip.add(i + 1)
            if after.surface == "やん" and after.lemma == "遣る":
                out_m.append(replace(after, pos="particle", lemma="やん", lemma_reading="やん", ctype="", cform="",
                                     auxiliary_use=False, written="やん", written_reading="やん"))
                out_t.append(("助詞", "終助詞", "*"))
                skip.add(i + 2)
            continue
        if (m.surface == "やん" and (m.pos == "particle" or m.lemma == "遣る") and prev is not None
                and prev.pos == "noun" and _glued(prev, m)
                and nxt is not None and nxt.surface == "な" and _glued(m, nxt)
                and after is not None and after.surface == "よ"):
            # 宿題やんなよ, "do your homework!": やる's stem said short
            # before the casual order's な (やりなよ), no Kansai やん
            # (plan 272).
            out_m.append(replace(m, pos="verb", lemma="遣る", lemma_reading="やる", ctype="五段-ラ行",
                                 cform="連用形-撥音便", written="やん", written_reading="やん"))
            out_t.append(("動詞", "非自立可能", "*"))
            continue
        if (m.surface == "やん" and m.lemma == "遣る" and prev is not None and _glued(prev, m)
                and prev.pos in ("adjective", "auxiliary", "verb", "noun") and (nxt is None or nxt.pos in ("symbol", "particle"))):
            # 美味しいやん: the Kansai "isn't it!" (= じゃない), no やる
            # (plan 272).
            out_m.append(replace(m, pos="particle", lemma="やん", lemma_reading="やん", ctype="", cform="",
                                 auxiliary_use=False, written="やん", written_reading="やん"))
            out_t.append(("助詞", "終助詞", "*"))
            continue
        if (m.pos == "verb" and m.cform.startswith("連用形") and prev is not None and prev.pos == "noun"
                and m.lemma not in ("為る", "する", "出来る", "できる") and _glued(prev, m)
                and any(_is_kanji(c) for c in prev.surface + m.surface)
                and (nxt is None or nxt.pos == "symbol" or (nxt.pos == "particle" and not nxt.conjunctive)
                     or nxt.lemma in ("だ", "です"))
                and _noun_of_two(prev.surface + m.surface)):
            # 通行止め, "road closed": a noun JMdict holds as one, read
            # with its sound change, never 通行 and the verb 止める (plan 272).
            row = _noun_of_two(prev.surface + m.surface)
            last = out_m.pop()
            out_t.pop()
            out_m.append(replace(last, surface=last.surface + m.surface, end=m.end, lemma=row[0], reading=row[1],
                                 lemma_reading=row[1], kana=last.kana + m.kana, pos="noun", ctype="", cform="",
                                 written=row[0], written_reading=row[1]))
            out_t.append(("名詞", "普通名詞", "一般"))
            continue
        if (m.proper and m.name_kind in ("person", "family", "given") and nxt is not None and _glued(m, nxt)
                and nxt.surface in ("行き", "方面", "駅", "発")):
            # 高尾行き: a place the train goes to, no person (plan 272).
            m = replace(m, name_kind="place")
        if (m.surface in ("N", "Ｎ") and nxt is not None and nxt.surface in tuple("12345１２３４５") and _glued(m, nxt)
                and (after is None or not after.surface[:1].isdigit())):
            # N3, the JLPT's level, one word (plan 272).
            surface = m.surface + nxt.surface
            out_m.append(replace(m, surface=surface, end=nxt.end, lemma=surface, reading=surface,
                                 lemma_reading=surface, kana=surface, pos="noun", proper=False, name_kind="",
                                 unknown=False, written=surface, written_reading=surface))
            out_t.append(("名詞", "普通名詞", "一般"))
            skip.add(i + 1)
            continue
        if (m.surface == "勝目" and prev is not None and prev.surface[-1:].isdigit() and _glued(prev, m)):
            # 10勝目, the tenth win: 勝, the counter, then 目 (plan 272), no
            # 勝ち目, "a chance of winning".
            out_m += [replace(m, surface="勝", end=m.start + 1, lemma="勝", reading="しょう", lemma_reading="しょう",
                              kana="ショウ", pos="suffix", counter=True, written="勝", written_reading="しょう"),
                      replace(m, surface="目", start=m.start + 1, lemma="目", reading="め", lemma_reading="め",
                              kana="メ", pos="suffix", written="目", written_reading="め")]
            out_t += [("接尾辞", "名詞的", "助数詞"), ("接尾辞", "名詞的", "一般")]
            continue
        if (m.surface == "に" and m.pos == "auxiliary" and nxt is not None and nxt.lemma in ("因る", "依る", "よる")
                and nxt.surface.startswith("よ") and _glued(m, nxt)):
            # 不手際により: the particle に of により, no copula's (plan 272).
            m = replace(m, pos="particle", lemma="に", lemma_reading="に", ctype="", cform="", written="に",
                        written_reading="に")
            out_m.append(m)
            out_t.append(("助詞", "格助詞", "*"))
            continue
        if (m.surface == "ざる" and m.pos == "noun" and prev is not None and prev.pos in ("verb", "auxiliary")
                and _glued(prev, m) and prev.cform.startswith(("未然形", "連用形"))):
            # 断じざるを得ない: ず's attributive, no 笊, "a basket" (plan 272).
            m = replace(m, pos="auxiliary", lemma="ず", lemma_reading="ず", ctype="助動詞-ヌ", cform="連体形-一般",
                        written="ず", written_reading="ず")
            out_m.append(m)
            out_t.append(("助動詞", "*", "*"))
            continue
        if (m.pos == "verb" and all("\u3041" <= c <= "\u309f" for c in m.surface) and prev is not None
                and prev.surface == "の" and prev.pos == "particle" and nxt is not None and nxt.pos == "particle"
                and nxt.surface in ("から", "に", "で", "へ", "まで", "の", "は", "が", "を", "も")
                and m.cform.startswith("終止形") and _a_deck_noun(m.surface)):
            # もりのおくから: 奥, a noun after の and before a particle --
            # a verb takes a noun after it there (雨の降る日), never から
            # (plan 272).
            m = replace(m, pos="noun", lemma=_a_deck_noun(m.surface), lemma_reading=m.surface, ctype="", cform="",
                        auxiliary_use=False, written=_a_deck_noun(m.surface), written_reading=m.surface)
            out_m.append(m)
            out_t.append(("名詞", "普通名詞", "一般"))
            continue
        if (m.pos == "noun" and m.surface.endswith("ん") and len(m.surface) >= 3
                and all("\u3041" <= c <= "\u309f" for c in m.surface) and nxt is not None and nxt.surface == "で"
                and _glued(m, nxt) and after is not None and (after.surface in ("ない", "いる", "いない", "ある", "ください",
                                                                                 "しまう", "おく", "も", "は")
                                                               or after.lemma in ("居る", "無い", "下さる", "仕舞う", "置く"))
                and _verb_of_n(m.surface)):
            # たたんでない: 畳む's て-form, no 多端, "many items" (plan 272).
            verb, said = _verb_of_n(m.surface)
            out_m.append(replace(m, pos="verb", lemma=verb, lemma_reading=said, ctype="五段", cform="連用形-撥音便",
                                 written=verb, written_reading=said))
            out_t.append(("動詞", "一般", "*"))
            out_m.append(replace(nxt, pos="particle", lemma="て", lemma_reading="て", conjunctive=True, cform="",
                                 ctype="", written="て", written_reading="て"))
            out_t.append(("助詞", "接続助詞", "*"))
            skip.add(i + 1)
            continue
        # ── words given another word's reading, or cut apart (plan 272) ──
        text_here = "".join(u.surface for u in morphemes)
        two = after is not None and nxt is not None
        if m.surface == "そら" and m.pos == "pronoun" and nxt is not None and nxt.pos == "particle" \
                and nxt.surface in ("を", "に", "が", "の", "へ", "は", "も", "で"):
            m = replace(m, pos="noun", lemma="空", lemma_reading="そら", written="空", written_reading="そら")
        if m.surface == "かめ" and any(w in text_here for w in ("うさぎ", "ウサギ", "兎", "かめさん", "かめくん")):
            m = replace(m, lemma="亀", lemma_reading="かめ", written="亀", written_reading="かめ")
        if m.surface == "はる" and m.pos == "auxiliary" and nxt is not None and nxt.pos == "particle" \
                and nxt.surface in ("が", "は", "を", "の", "に", "も") and (prev is None or prev.pos in ("symbol", "particle")):
            m = replace(m, pos="noun", lemma="春", lemma_reading="はる", ctype="", cform="", written="春",
                        written_reading="はる")
        if m.surface == "米" and m.reading == "べい" and nxt is not None and (
                nxt.surface[:1].isdigit() or nxt.pos in ("particle", "symbol")) and not (
                prev is not None and prev.surface in ("日", "欧", "中", "対", "訪", "駐", "在", "全", "北", "南", "親", "反")):
            m = replace(m, reading="こめ", lemma_reading="こめ", kana="コメ", written_reading="こめ")   # 米2合を研ぐ
        if m.surface == "風" and m.reading == "ふう" and (prev is None or prev.pos in ("particle", "symbol")):
            m = replace(m, reading="かぜ", lemma_reading="かぜ", kana="カゼ", pos="noun", written_reading="かぜ")
        if (m.surface in ("下り", "上り") and nxt is not None and (nxt.surface in ("線", "車線", "方面", "列車", "電車")
                or (nxt.pos == "particle" and not nxt.conjunctive and nxt.surface in ("は", "が", "の", "も", "で", "を", "に")
                    and any(w in text_here for w in ("渋滞", "車線", "方面", "高速", "道", "線")))
                # (中央道下り、: after a road's name, plan 272)
                or (prev is not None and _glued(prev, m) and prev.surface.endswith(("高速", "道", "線"))
                    and any(w in text_here for w in ("渋滞", "車線", "方面", "トンネル", "インター", "先頭"))))):
            said = "くだり" if m.surface == "下り" else "のぼり"
            m = replace(m, pos="noun", lemma=m.surface, reading=said, lemma_reading=said, ctype="", cform="",
                        written=m.surface, written_reading=said)
        if m.surface == "道" and m.reading == "みち" and prev is not None and _glued(prev, m) \
                and prev.surface in _EXPRESSWAYS:
            m = replace(m, reading="どう", lemma_reading="どう", kana="ドウ", written_reading="どう")   # 東北道
        if m.surface == "上" and m.reading == "じょう" and prev is not None and prev.surface in (
                "サイズ", "ランク", "レベル", "グレード", "段", "学年", "クラス"):
            m = replace(m, reading="うえ", lemma_reading="うえ", kana="ウエ", pos="noun", written_reading="うえ")
        if m.surface == "殿" and m.pos == "suffix" and prev is not None and prev.pos in ("noun", "suffix") \
                and m.reading != "どの":
            m = replace(m, reading="どの", lemma_reading="どの", kana="ドノ", written_reading="どの")   # 家老殿
        joins = None
        if m.surface == "先" and nxt is not None and nxt.surface == "ほど" and _glued(m, nxt) \
                and (prev is None or prev.pos in ("symbol", "particle") or prev.surface in ("つい", "ほんの")):
            joins = (2, "先ほど", "先程", "さきほど", "noun")
        elif m.surface == "何" and nxt is not None and nxt.surface == "ら" and _glued(m, nxt) \
                and (after is None or after.surface != "か"):
            joins = (2, "何ら", "何ら", "なんら", "adverb")
        elif m.surface == "てる" and nxt is not None and nxt.surface == "てる" and after is not None \
                and after.surface in ("ぼうず", "坊主") and _glued(nxt, after):
            joins = (3, "てるてる" + after.surface, "てるてる坊主", "てるてるぼうず", "noun")
        elif m.surface == "ゆき" and nxt is not None and nxt.surface == "だるま" and _glued(m, nxt):
            joins = (2, "ゆきだるま", "雪だるま", "ゆきだるま", "noun")
        elif m.surface == "こと" and two and nxt.surface == "の" and after.surface == "ほか" and _glued(nxt, after) \
                and i + 3 < len(morphemes) and morphemes[i + 3].pos in ("adjective", "adverb", "verb", "other"):
            joins = (3, "ことのほか", "殊の外", "ことのほか", "adverb")
        elif m.surface == "御" and nxt is not None and nxt.surface == "社" and _glued(m, nxt):
            joins = (2, "御社", "御社", "おんしゃ", "noun")
        elif m.surface == "上" and nxt is not None and nxt.surface == "様" and _glued(m, nxt) \
                and (prev is None or prev.pos in ("symbol", "particle")):
            joins = (2, "上様", "上様", "うえさま", "noun")
        elif m.surface == "例" and nxt is not None and nxt.surface == "の" and _glued(m, nxt) and after is not None \
                and after.pos in ("noun", "prefix") and (prev is None or prev.pos in ("symbol", "particle")):
            joins = (2, "例の", "例の", "れいの", "adnominal")            # 例の店
        elif (m.surface in ("ゆき", "ゆう", "たく", "けん", "しょう", "ひろ", "まさ", "かず", "たか", "ひで")
              and nxt is not None and nxt.surface == "お" and after is not None and after.surface == "くん"
              and _glued(m, nxt) and _glued(nxt, after)):
            # ゆきおくん: the name ゆきお and くん (plan 272).
            out_m.append(_joined(m, nxt, m.surface + "お", m.surface + "お", m.surface + "お", "noun"))
            out_m[-1] = replace(out_m[-1], proper=True, name_kind="given", unknown=True)
            out_t.append(("名詞", "固有名詞", "人名"))
            out_m.append(replace(after, pos="suffix", lemma="君", lemma_reading="くん", reading="くん", ctype="",
                                 cform="", written="君", written_reading="くん"))
            out_t.append(("接尾辞", "名詞的", "一般"))
            skip.update({i + 1, i + 2})
            continue
        if joins is not None:
            n, surface, lemma, said, pos = joins
            out_m.append(_joined(m, morphemes[i + n - 1], surface, lemma, said, pos))
            out_t.append(_TAGS.get(pos, ("名詞", "普通名詞", "一般")))
            skip.update(range(i + 1, i + n))
            continue
        # ── speech the fifth review found cut or misread (plan 272) ──
        two = after is not None and nxt is not None
        joins = None
        if m.surface == "て" and m.pos == "particle" and nxt is not None and nxt.surface == "か" and _glued(m, nxt) \
                and (prev is None or prev.pos == "symbol" or prev.end < m.start) and after is not None:
            joins = (2, "てか", "てか", "てか", "conjunction")            # ウケるwww てかなんで知ってんの
        elif m.surface == "いい" and nxt is not None and nxt.surface == "ね" and _glued(m, nxt) and after is not None \
                and (after.lemma in ("押す", "付ける", "つける") or after.surface in ("を", "が", "ボタン", "数", "して",
                                                                                 "し", "くれ", "ください")):
            joins = (2, "いいね", "いいね", "いいね", "noun")             # いいね押してってくれ
        elif m.surface == "お" and nxt is not None and nxt.surface == "わた" and _glued(m, nxt) \
                and (after is None or after.pos == "symbol" or _a_laugh_typed(after.surface)):
            joins = (2, "おわた", "おわた", "おわた", "interjection")       # 寝坊したおわた
        elif m.surface == "おけ" and nxt is not None and nxt.surface.startswith("まる") and _glued(m, nxt):
            joins = (2, m.surface + nxt.surface, "おけまる", "おけまる", "interjection")
        elif m.surface in ("なーん", "なあん") and nxt is not None and nxt.surface == "だ" and _glued(m, nxt) \
                and (prev is None or prev.pos == "symbol"):
            joins = (2, m.surface + "だ", "なーんだ", m.surface + "だ", "interjection")
        elif m.surface == "へ" and nxt is not None and nxt.surface in ("へっ", "へ", "へへ") and _glued(m, nxt) \
                and (prev is None or prev.pos == "symbol"):
            joins = (2, m.surface + nxt.surface, "へへっ", m.surface + nxt.surface, "interjection")
        elif m.surface == "ポチ" and nxt is not None and nxt.surface in ("り", "っ", "る", "ら", "れ") and _glued(m, nxt):
            joins = (2, "ポチ" + nxt.surface, "ポチる", "ぽち" + nxt.surface, "verb")
        elif m.surface == "ほい" and two and nxt.surface == "じゃ" and after.surface == "けえ" \
                and _glued(m, nxt) and _glued(nxt, after):
            joins = (3, "ほいじゃけえ", "じゃけえ", "ほいじゃけえ", "conjunction")
        elif m.surface == "じゃ" and nxt is not None and nxt.surface == "けえ" and _glued(m, nxt):
            joins = (2, "じゃけえ", "じゃけえ", "じゃけえ", "conjunction")
        elif m.surface == "ど" and two and nxt.surface.startswith("えりゃ") and _glued(m, nxt) and _glued(nxt, after) \
                and after.surface.startswith("あ"):
            joins = (3, "ど" + nxt.surface + after.surface, "どえりゃあ", "どえりゃあ", "adverb")
        elif m.surface == "いぎ" and nxt is not None and nxt.surface == "なり" and _glued(m, nxt):
            joins = (2, "いぎなり", "いぎなり", "いぎなり", "adverb")
        elif m.surface == "おばん" and nxt is not None and nxt.surface in ("です", "でした") and _glued(m, nxt):
            joins = (2, "おばん" + nxt.surface, "おばんです", "おばん" + nxt.surface, "interjection")
        elif m.surface == "ずん" and two and nxt.surface == "だ" and _glued(m, nxt):
            joins = (2, "ずんだ", "ずんだ", "ずんだ", "noun")
        elif m.surface == "てけ" and nxt is not None and nxt.surface == "らいん" and _glued(m, nxt):
            joins = (2, "てけらいん", "てけらいん", "てけらいん", "auxiliary")
        elif m.surface == "が" and m.pos == "particle" and nxt is not None and nxt.surface == "ね" and _glued(m, nxt) \
                and prev is not None and prev.pos in ("verb", "auxiliary", "adjective") \
                and (after is None or after.pos == "symbol"):
            joins = (2, "がね", "がね", "がね", "particle")               # 怒られてまうがね。
        elif m.surface == "ど" and m.pos == "particle" and nxt is not None and nxt.surface == "こう" and _glued(m, nxt) \
                and prev is not None and prev.cform.endswith("撥音便"):
            joins = (2, "どこう", "とく", "どこう", "auxiliary")             # 取り込んどこう
        elif m.surface == "ん" and m.pos == "particle" and nxt is not None and nxt.surface == "で" and _glued(m, nxt) \
                and prev is not None and prev.pos == "auxiliary" and after is not None and after.surface in ("、", "，"):
            joins = (2, "んで", "ので", "んで", "particle")                 # お留守だったんで、
        elif m.surface == "し" and m.lemma in ("為る", "する") and nxt is not None and nxt.surface == "ぬ" \
                and nxt.lemma == "ず" and _glued(m, nxt) and prev is not None and prev.conjunctive \
                and prev.surface in ("て", "で") and (after is None or after.pos == "symbol"):
            joins = (2, "しぬ", "死ぬ", "しぬ", "verb")                     # 眠すぎてしぬ
        if joins is not None:
            n, surface, lemma, said, pos = joins
            last = morphemes[i + n - 1]
            # (a verb joined keeps the form its last kana says: ポチり, the
            # stem ました follows; ポチっ, the て-form's)
            form = {"り": "連用形-一般", "っ": "連用形-促音便", "ら": "未然形-一般", "れ": "仮定形-一般"}.get(
                surface[-1:], "終止形-一般") if pos == "verb" else ""
            out_m.append(_joined(m, last, surface, lemma, said, pos, cform=form, ctype="五段" if pos == "verb" else ""))
            out_t.append(_TAGS[pos])
            skip.update(range(i + 1, i + n))
            continue
        if m.surface == "笑" and m.pos == "noun" and (nxt is None or nxt.pos == "symbol") and prev is not None \
                and (prev.pos != "symbol" or prev.surface in "？！?!"):
            # 知ってんの笑: a laugh typed after the line, read わら (plan 272).
            m = replace(m, reading="わら", kana="ワラ")
        if m.surface == "りょ" and (nxt is None or nxt.pos == "symbol"):
            m = replace(m, proper=False, name_kind="", unknown=False)     # りょ: 了解, "got it" (slang)
        if m.surface and all(c in "wWｗＷ" for c in m.surface) and len(m.surface) >= 2:
            m = replace(m, proper=False, name_kind="", unknown=False)     # www: a laugh, no name
        if m.surface == "てん" and m.pos == "noun" and prev is not None and prev.pos in ("verb", "auxiliary") \
                and _glued(prev, m) and prev.cform.startswith("連用形") and nxt is not None \
                and nxt.surface in ("の", "だ", "や", "ねん", "じゃ", "じゃん", "だろ", "だよ", "よ"):
            # 知ってんの: てる said before の, no 点 (plan 272).
            m = replace(m, pos="auxiliary", lemma="てる", lemma_reading="てる", ctype="", cform="連体形-撥音便",
                        written="てる", written_reading="てる")
        if m.surface == "けえ" and m.lemma == "濃い" and prev is not None and _glued(prev, m) \
                and (prev.pos in ("verb", "auxiliary") or prev.surface in ("じゃ", "ん")) \
                and (nxt is None or nxt.pos in ("symbol", "particle")):
            # 知らんけえね: Hiroshima's "because", no 濃い (plan 272).
            m = replace(m, pos="particle", lemma="けえ", lemma_reading="けえ", ctype="", cform="", written="けえ",
                        written_reading="けえ")
        if (m.pos == "verb" and m.surface == "かけん" and prev is not None and prev.pos == "adjective"
                and prev.cform.startswith("語幹") and _glued(prev, m)):
            # うまかけん: Kyūshū's うまか, "tasty", and けん, "because" (plan 272).
            last = out_m.pop()
            out_t.pop()
            out_m.append(replace(last, surface=last.surface + "か", end=m.start + 1, reading=last.reading + "か",
                                 cform="終止形-一般"))
            out_t.append(("形容詞", "一般", "*"))
            out_m.append(replace(m, surface="けん", start=m.start + 1, lemma="けん", reading="けん", lemma_reading="けん",
                                 kana="ケン", pos="particle", ctype="", cform="", written="けん", written_reading="けん"))
            out_t.append(("助詞", "接続助詞", "*"))
            continue
        if m.surface == "らん" and m.lemma == "らむ" and prev is not None and prev.pos == "verb" and _glued(prev, m):
            m = replace(m, lemma="らん", lemma_reading="らん")              # みらん: Kyūshū's 見ない
        if (m.surface == "ことし" and m.lemma == "今年" and prev is not None and prev.pos == "adnominal"
                and nxt is not None and nxt.lemma in ("取る", "とる") and nxt.surface[:1] == "と" and _glued(m, nxt)):
            # そんなことしとったら: こと and する, then the west's とる (= ている),
            # no 今年, "this year" (plan 272).
            out_m += [replace(m, surface="こと", end=m.start + 2, lemma="事", reading="こと", lemma_reading="こと",
                              kana="コト", written="こと", written_reading="こと"),
                      replace(m, surface="し", start=m.start + 2, lemma="為る", reading="し", lemma_reading="する",
                              kana="シ", pos="verb", ctype="サ行変格", cform="連用形-一般", written="する",
                              written_reading="する")]
            out_t += [("名詞", "普通名詞", "一般"), ("動詞", "非自立可能", "*")]
            continue
        if (m.lemma in ("取る", "とる") and m.surface[:1] == "と" and all("\u3041" <= c <= "\u309f" for c in m.surface)
                and prev is not None and _glued(prev, m) and prev.pos == "verb" and prev.cform.startswith("連用形")
                and (out_m and out_m[-1].surface == "し" or prev.surface.endswith(("し", "べ", "て")))):
            m = replace(m, pos="auxiliary", lemma="とる", lemma_reading="とる")   # しとった: ている
        if m.surface == "ちょう" and m.pos == "noun" and prev is not None and prev.conjunctive \
                and prev.surface in ("て", "で") and (nxt is None or nxt.pos == "symbol"):
            m = replace(m, surface="ちょう", pos="auxiliary", lemma="てちょう", lemma_reading="てちょう")
        if m.surface == "っぺ" and prev is not None and prev.pos == "verb" and _glued(prev, m):
            m = replace(m, pos="auxiliary", lemma="っぺ", lemma_reading="っぺ")
        if m.surface == "っちゃ" and prev is not None and prev.pos in ("adjective", "verb", "auxiliary") \
                and (nxt is None or nxt.pos == "symbol"):
            m = replace(m, pos="particle", lemma="っちゃ", lemma_reading="っちゃ", conjunctive=False)
        if (m.surface == "寒" and nxt is not None and nxt.surface == "ぐ" and _glued(m, nxt) and after is not None
                and after.lemma in ("成る", "なる")):
            # 寒ぐなった: Tōhoku's 寒く, voiced (plan 272).
            out_m.append(replace(m, surface="寒ぐ", end=nxt.end, lemma="寒い", reading="さむぐ", lemma_reading="さむい",
                                 kana="サムグ", pos="adjective", ctype="形容詞", cform="連用形-一般", written="寒い",
                                 written_reading="さむい"))
            out_t.append(("形容詞", "一般", "*"))
            skip.add(i + 1)
            continue
        if (m.surface == "ひ" and two and nxt.surface == "が" and after.surface == "ね" and _glued(m, nxt)
                and _glued(nxt, after) and prev is not None and prev.surface == "風邪"):
            # 風邪ひがね: Tōhoku's 引かねえ, "not catch (a cold)" (plan 272).
            out_m.append(replace(m, surface="ひがね", end=after.end, lemma="引く", reading="ひがね", lemma_reading="ひく",
                                 kana="ヒガネ", pos="verb", ctype="五段", cform="終止形-一般", written="引く",
                                 written_reading="ひく"))
            out_t.append(("動詞", "一般", "*"))
            skip.update({i + 1, i + 2})
            continue
        if (m.surface == "果たして" and m.pos == "adverb" and nxt is not None and nxt.lemma in (
                "見せる", "みせる", "居る", "いる", "仕舞う", "しまう", "置く", "おく", "下さる", "くださる", "呉れる",
                "くれる", "貰う", "もらう", "見る", "みる")):
            # 果たしてみせよう: 果たす's て-form, no "as expected" (plan 272).
            out_m += [replace(m, surface="果たし", end=m.end - 1, lemma="果たす", reading="はたし", lemma_reading="はたす",
                              kana="ハタシ", pos="verb", ctype="五段", cform="連用形-一般", written="果たす",
                              written_reading="はたす"),
                      replace(m, surface="て", start=m.end - 1, lemma="て", reading="て", lemma_reading="て", kana="テ",
                              pos="particle", ctype="", cform="", conjunctive=True, written="て", written_reading="て")]
            out_t += [("動詞", "一般", "*"), ("助詞", "接続助詞", "*")]
            continue
        if (m.pos == "auxiliary" and m.lemma in ("てる", "でる") and m.cform.startswith("意志推量形")
                and len(m.surface) >= 3 and m.surface[1] == "よ" and m.surface[2:].strip("ー〜～") == ""
                and prev is not None and prev.pos == "verb"):
            # やめてよー, "stop it!": the request's て and よ drawn out, no
            # ていよう (plan 272).
            te = m.surface[0]
            out_m += [replace(m, surface=te, end=m.start + 1, lemma="て", reading=te, lemma_reading="て",
                              kana="テ" if te == "て" else "デ", pos="particle", ctype="", cform="",
                              conjunctive=True, auxiliary_use=False, written="て", written_reading="て"),
                      replace(m, surface=m.surface[1:], start=m.start + 1, lemma="よ", reading=m.surface[1:],
                              lemma_reading="よ", kana="ヨ" + m.surface[2:], pos="particle", ctype="", cform="",
                              conjunctive=False, auxiliary_use=False, written="よ", written_reading="よ")]
            out_t += [("助詞", "接続助詞", "*"), ("助詞", "終助詞", "*")]
            continue
        if (m.pos == "verb" and m.cform == "連用形-一般" and nxt is not None and nxt.pos == "noun" and _glued(m, nxt)
                and _hiragana_only(m.surface) and _hiragana_only(nxt.surface) and nxt.surface[:1] in _VOICED_KANA):
            # かきごおり, かき氷: a stem in kana and a noun its compound voiced
            # (こおり → ごおり) are one word -- where the dictionary holds one
            # row read so (plan 272). UniDic read 掻く and 氷.
            row = _one_row_read(m.surface + nxt.surface)
            if row is not None:
                said = m.surface + nxt.surface
                out_m.append(replace(m, surface=said, end=nxt.end, lemma=row, reading=said, lemma_reading=said,
                                     kana="".join(chr(ord(c) + 0x60) for c in said), pos="noun", ctype="", cform="",
                                     written=row, written_reading=said))
                out_t.append(("名詞", "普通名詞", "一般"))
                skip.add(i + 1)
                continue
        after = morphemes[i + 2] if i + 2 < len(morphemes) else None
        kata = lambda said: "".join(chr(ord(c) + 0x60) if "\u3041" <= c <= "\u3096" else c for c in said)
        # (plan 272: what an eighth review found cut or read wrong, each by
        # the shape the sentence gives it)
        if (m.surface == "か" and m.pos == "particle" and nxt is not None and nxt.surface == "さ" and nxt.pos == "particle"
                and _glued(m, nxt) and prev is not None and prev.pos in ("adjective", "adnominal")):
            # あおい かさ: 傘, "umbrella", no question's か and a filler
            out_m.append(replace(m, surface="かさ", end=nxt.end, lemma="傘", reading="かさ", lemma_reading="かさ",
                                 kana="カサ", pos="noun", ctype="", cform="", written="傘", written_reading="かさ"))
            out_t.append(("名詞", "普通名詞", "一般"))
            skip.add(i + 1)
            continue
        if (m.surface == "ま" and m.pos == "symbol" and nxt is not None and nxt.surface == "って" and _glued(m, nxt)
                and (prev is None or prev.surface in ("「", "『", "　", " ", "、"))):
            # 「まって まって」: 待って, the request, no ま and a quote's って
            out_m += [replace(m, surface="まっ", end=nxt.start + 1, lemma="待つ", reading="まっ", lemma_reading="まつ",
                              kana="マッ", pos="verb", ctype="五段-タ行", cform="連用形-促音便", written="待つ",
                              written_reading="まつ"),
                      replace(nxt, surface="て", start=nxt.start + 1, lemma="て", reading="て", lemma_reading="て",
                              kana="テ", pos="particle", conjunctive=True, written="て", written_reading="て")]
            out_t += [("動詞", "一般", "*"), ("助詞", "接続助詞", "*")]
            skip.add(i + 1)
            continue
        if (m.surface == "つ" and m.pos == "particle" and nxt is not None and nxt.surface == "く" and _glued(m, nxt)
                and prev is not None and prev.surface.endswith("息")):
            # ひと息つく: 吐く, "to let out (a breath)", no つ and 九
            out_m.append(replace(m, surface="つく", end=nxt.end, lemma="吐く", reading="つく", lemma_reading="つく",
                                 kana="ツク", pos="verb", ctype="五段-カ行", cform="終止形-一般", written="吐く",
                                 written_reading="つく"))
            out_t.append(("動詞", "一般", "*"))
            skip.add(i + 1)
            continue
        if m.surface == "もったい" and nxt is not None and nxt.surface == "ないし" and _glued(m, nxt):
            # もったいないし: もったいない and the し that lists a reason, no 乃至
            out_m += [replace(m, surface="もったいない", end=nxt.start + 2, lemma="勿体無い", reading="もったいない",
                              lemma_reading="もったいない", kana="モッタイナイ", pos="adjective", ctype="形容詞",
                              cform="終止形-一般", written="もったいない", written_reading="もったいない"),
                      replace(nxt, surface="し", start=nxt.start + 2, lemma="し", reading="し", lemma_reading="し",
                              kana="シ", pos="particle", conjunctive=True, written="し", written_reading="し")]
            out_t += [("形容詞", "一般", "*"), ("助詞", "接続助詞", "*")]
            skip.add(i + 1)
            continue
        if (m.surface == "かえっ" and m.pos == "verb" and nxt is not None and nxt.surface == "て" and after is not None
                and after.pos in ("verb", "adjective") and prev is not None and prev.pos == "particle"
                and prev.surface in ("を", "が", "は", "も")):
            # 負担をかえって増やす: 却って, "on the contrary", no 帰る or 孵る
            out_m.append(replace(m, surface="かえって", end=nxt.end, lemma="却って", reading="かえって",
                                 lemma_reading="かえって", kana="カエッテ", pos="adverb", ctype="", cform="",
                                 written="却って", written_reading="かえって"))
            out_t.append(("副詞", "*", "*"))
            skip.add(i + 1)
            continue
        if m.surface == "もっか" and nxt is not None and nxt.surface == "い" and _glued(m, nxt) and m.start == 0 or (
                m.surface == "もっか" and nxt is not None and nxt.surface == "い" and _glued(m, nxt)
                and prev is not None and (prev.pos in ("symbol", "particle", "adverb") or not _glued(prev, m))):
            # もっかい言って: もう一回 said short, no 目下 and いい
            out_m.append(replace(m, surface="もっかい", end=nxt.end, lemma="もっかい", reading="もっかい",
                                 lemma_reading="もっかい", kana="モッカイ", pos="adverb", ctype="", cform="",
                                 written="もっかい", written_reading="もっかい"))
            out_t.append(("副詞", "*", "*"))
            skip.add(i + 1)
            continue
        if (m.surface == "話し" and m.pos == "verb" and prev is not None and prev.surface == "の" and prev.pos == "particle"
                and nxt is not None and nxt.surface[:1] in ("て", "た")):
            # なんの話してた: 話, "talk", and する -- no 話す after の
            out_m += [replace(m, surface="話", end=m.start + 1, lemma="話", reading="はなし", lemma_reading="はなし",
                              kana="ハナシ", pos="noun", ctype="", cform="", written="話", written_reading="はなし"),
                      replace(m, surface="し", start=m.start + 1, lemma="為る", reading="し", lemma_reading="する",
                              kana="シ", pos="verb", ctype="サ行変格", cform="連用形-一般", written="する",
                              written_reading="する")]
            out_t += [("名詞", "普通名詞", "一般"), ("動詞", "非自立可能", "*")]
            continue
        if (m.surface in ("そう", "こう", "ああ", "どう") and m.pos == "adverb" and nxt is not None and nxt.surface == "いう"
                and _glued(m, nxt) and after is not None and after.pos in ("noun", "pronoun", "prefix")):
            # そういう人: そういう, "such", no "to say"
            said = m.surface + "いう"
            out_m.append(replace(m, surface=said, end=nxt.end, lemma=said, reading=said, lemma_reading=said,
                                 kana=kata(said), pos="adnominal", ctype="", cform="", written=said,
                                 written_reading=said))
            out_t.append(("連体詞", "*", "*"))
            skip.add(i + 1)
            continue
        if (m.surface == "恐れ" and nxt is not None and nxt.surface == "ながら" and after is not None
                and after.lemma in ("申し上げる", "申す", "言う") and (prev is None or prev.pos == "symbol")):
            # 恐れながら申し上げます: the set phrase, "with all due respect"
            out_m.append(replace(m, surface="恐れながら", end=nxt.end, lemma="恐れながら", reading="おそれながら",
                                 lemma_reading="おそれながら", kana="オソレナガラ", pos="adverb", ctype="", cform="",
                                 written="恐れながら", written_reading="おそれながら"))
            out_t.append(("副詞", "*", "*"))
            skip.add(i + 1)
            continue
        if m.surface == "瞬く" and nxt is not None and nxt.surface == "間" and _glued(m, nxt):
            # 瞬く間に: in the blink of an eye, またたくま
            out_m.append(replace(m, surface="瞬く間", end=nxt.end, lemma="瞬く間", reading="またたくま",
                                 lemma_reading="またたくま", kana="マタタクマ", pos="noun", ctype="", cform="",
                                 written="瞬く間", written_reading="またたくま"))
            out_t.append(("名詞", "普通名詞", "副詞可能"))
            skip.add(i + 1)
            continue
        if (m.surface == "もやし" and m.pos == "verb" and nxt is not None and nxt.pos == "noun"):
            # もやし生活: 萌やし, bean sprouts, no 燃やす before a noun
            out_m.append(replace(m, lemma="萌やし", lemma_reading="もやし", pos="noun", ctype="", cform="",
                                 written="萌やし", written_reading="もやし"))
            out_t.append(("名詞", "普通名詞", "一般"))
            continue
        if m.surface == "上手" and prev is not None and prev.surface == "枚":
            # 一枚上手, "a cut above": うわて, no じょうず
            out_m.append(replace(m, reading="うわて", lemma_reading="うわて", kana="ウワテ", pos="noun",
                                 written_reading="うわて"))
            out_t.append(("名詞", "普通名詞", "一般"))
            continue
        if (m.surface == "今日" and nxt is not None and nxt.surface == "で" and after is not None and after.surface == "は"):
            # 今日では, "nowadays": こんにち
            out_m.append(replace(m, reading="こんにち", lemma_reading="こんにち", kana="コンニチ", written_reading="こんにち"))
            out_t.append(tags[i])
            continue
        if (m.pos == "noun" and nxt is not None and nxt.pos == "noun" and _glued(m, nxt) and _katakana_word(m.surface)
                and _katakana_word(nxt.surface) and nxt.lemma != nxt.surface and _row_of(m.surface + nxt.lemma,
                                                                                kata_to_hira(m.surface + nxt.surface))):
            # ダンゴムシ: one creature, the dictionary's ダンゴ虫, no dumpling and insect
            said, row = m.surface + nxt.surface, m.surface + nxt.lemma
            out_m.append(replace(m, surface=said, end=nxt.end, lemma=row, reading=kata_to_hira(said),
                                 lemma_reading=kata_to_hira(said), kana=said, written=row,
                                 written_reading=kata_to_hira(said)))
            out_t.append(("名詞", "普通名詞", "一般"))
            skip.add(i + 1)
            continue
        if (m.pos == "noun" and _hiragana_only(m.surface) and nxt is not None and nxt.surface == "し" and nxt.pos == "verb"
                and _glued(m, nxt) and after is not None and after.pos == "suffix" and after.surface in ("さん", "たち")
                and _one_row_read(m.surface + "し")):
            # しょうぼうしさん: 消防士, a firefighter, no 消防 and する
            said = m.surface + "し"
            row = _one_row_read(said)
            out_m.append(replace(m, surface=said, end=nxt.end, lemma=row, reading=said, lemma_reading=said,
                                 kana=kata(said), written=row, written_reading=said))
            out_t.append(("名詞", "普通名詞", "一般"))
            skip.add(i + 1)
            continue
        if (m.surface == "なん" and m.pos == "particle" and nxt is not None and nxt.surface.startswith("つっ")
                and nxt.lemma == "つう" and _glued(m, nxt)):
            # なんつった: 何て言った said roughly -- 何, then つった
            out_m.append(replace(m, lemma="何", lemma_reading="なに", pos="pronoun", written="何", written_reading="なに"))
            out_t.append(("代名詞", "*", "*"))
            continue
        if (m.surface == "ぽん" and nxt is not None and nxt.surface == "ぽこ" and _glued(m, nxt)):
            # おなかをぽんぽこたたく: the drumming of a belly, one sound
            out_m.append(replace(m, surface="ぽんぽこ", end=nxt.end, lemma="ぽんぽこ", reading="ぽんぽこ",
                                 lemma_reading="ぽんぽこ", kana="ポンポコ", pos="adverb", written="ぽんぽこ",
                                 written_reading="ぽんぽこ"))
            out_t.append(("副詞", "*", "*"))
            skip.add(i + 1)
            continue
        if (m.surface == "つき" and m.pos == "verb" and prev is not None and prev.surface == "お" and prev.pos == "prefix"
                and nxt is not None and nxt.surface in ("さま", "様", "さん")):
            # おつきさま: お月様, the moon, no 付く
            out_m.append(replace(m, lemma="月", lemma_reading="つき", pos="noun", ctype="", cform="", written="月",
                                 written_reading="つき"))
            out_t.append(("名詞", "普通名詞", "一般"))
            continue
        if (m.pos == "auxiliary" and m.lemma == "む" and m.surface == "ん" and prev is not None and prev.pos == "verb"
                and prev.cform.startswith("未然形") and not any(u.surface == "いざ" for u in morphemes[max(0, i - 4):i])):
            # 間に合わんかも: the negative said short (= ない), no "shall"
            out_m.append(replace(m, lemma="ず", lemma_reading="ず", written="ず", written_reading="ず", ctype="助動詞-ヌ"))
            out_t.append(tags[i])
            continue
        if (m.pos == "verb" and m.cform.startswith("連用形") and m.surface.endswith("け") and (prev is None or prev.pos == "symbol")
                and nxt is not None and (nxt.surface in ("！", "!") or (nxt.surface in ("、", "，") and after is not None
                                                                     and after.surface == "と"))
                and _deck_godan(m.surface[:-1] + "く")):
            # 抜け、と申しておる: 抜く's order, "draw!", no 抜ける
            out_m.append(replace(m, lemma=m.surface[:-1] + "く", ctype="五段-カ行", cform="命令形",
                                 written=m.surface[:-1] + "く", lemma_reading=kata_to_hira(m.reading)[:-1] + "く"))
            out_t.append(tags[i])
            continue
        if (m.surface == "下" and kata_to_hira(m.reading) == "もと" and prev is not None and prev.surface == "の"
                and i >= 2 and morphemes[i - 2].pos == "noun" and morphemes[i - 2].surface in _THINGS_ABOVE):
            # 街灯の下で: below the thing, した, no もと of guidance
            out_m.append(replace(m, reading="した", lemma_reading="した", kana="シタ", written_reading="した"))
            out_t.append(tags[i])
            continue
        if m.pos == "particle" and len(m.surface) >= 2 and m.surface[-1] in "〜～" \
                and m.surface[:-1] in ("か", "で", "に", "を", "が", "と", "へ", "は", "も", "から", "まで"):
            # 誰か〜！, 次の動画で〜: the particle, then the line drawn out
            base = m.surface[:-1]
            out_m += [replace(m, surface=base, end=m.start + len(base), lemma=base, reading=base, lemma_reading=base,
                              kana=kata(base), written=base, written_reading=base),
                      replace(m, surface=m.surface[-1], start=m.start + len(base), lemma=m.surface[-1],
                              reading=m.surface[-1], lemma_reading=m.surface[-1], kana=m.surface[-1], pos="symbol",
                              ctype="", cform="", conjunctive=False, written=m.surface[-1],
                              written_reading=m.surface[-1])]
            out_t += [tags[i], ("補助記号", "一般", "*")]
            continue
        if (m.surface == "あ" and nxt is not None and nxt.surface == "かん" and _glued(m, nxt)
                and (after is None or after.pos in ("particle", "symbol", "auxiliary"))
                and prev is not None and (prev.surface in ("たら", "だら", "ては", "では", "と", "ちゃ", "じゃ")
                                          or prev.pos in ("particle", "auxiliary"))):
            # しとったらあかんで: the west's "no good, mustn't", no "ah" and a bell
            out_m.append(replace(m, surface="あかん", end=nxt.end, lemma="あかん", reading="あかん",
                                 lemma_reading="あかん", kana="アカン", pos="noun", ctype="", cform="",
                                 written="あかん", written_reading="あかん"))
            out_t.append(("名詞", "普通名詞", "一般"))
            skip.add(i + 1)
            continue
        if (m.surface == "し" and m.pos == "particle" and prev is not None and prev.pos in ("pronoun", "noun")
                and nxt is not None and nxt.lemma in ("因る", "寄る") and nxt.surface.startswith("よ") and _glued(m, nxt)):
            # なにしよるん: する and the west's よる, "is doing" (= している)
            out_m += [replace(m, lemma="為る", reading="し", lemma_reading="する", kana="シ", pos="verb",
                              ctype="サ行変格", cform="連用形-一般", written="する", written_reading="する"),
                      replace(nxt, lemma="よる", lemma_reading="よる", pos="auxiliary", ctype="", written="よる",
                              written_reading="よる")]
            out_t += [("動詞", "非自立可能", "*"), ("助動詞", "*", "*")]
            skip.add(i + 1)
            continue
        if m.surface == "来ん" and m.lemma == "来る" and kata_to_hira(m.reading) == "くん":
            # はよ来んと: 来ない said short, こん
            out_m.append(replace(m, reading="こん", kana="コン", written_reading="こん"))
            out_t.append(tags[i])
            continue
        if m.surface == "いらん" and m.pos == "noun":
            # 飲み物いらん: 要らない said short -- 要る and the negative ん
            out_m += [replace(m, surface="いら", end=m.start + 2, lemma="要る", reading="いら", lemma_reading="いる",
                              kana="イラ", pos="verb", ctype="五段-ラ行", cform="未然形-一般", written="要る",
                              written_reading="いる"),
                      replace(m, surface="ん", start=m.start + 2, lemma="ず", reading="ん", lemma_reading="ず", kana="ン",
                              pos="auxiliary", ctype="助動詞-ヌ", cform="終止形-撥音便", written="ず", written_reading="ず")]
            out_t += [("動詞", "一般", "*"), ("助動詞", "*", "*")]
            continue
        if (m.surface == "なし" and m.pos == "verb" and nxt is not None and nxt.surface == "て" and _glued(m, nxt)
                and (prev is None or prev.pos == "symbol") and after is not None and after.pos == "verb"):
            # なして黙ってたの: the north's "why?" (= どうして), no 為す
            out_m.append(replace(m, surface="なして", end=nxt.end, lemma="なして", reading="なして",
                                 lemma_reading="なして", kana="ナシテ", pos="adverb", ctype="", cform="",
                                 conjunctive=False, written="なして", written_reading="なして"))
            out_t.append(("副詞", "*", "*"))
            skip.add(i + 1)
            continue
        if (m.surface == "っ" and nxt is not None and nxt.surface == "しゃ" and _glued(m, nxt)
                and (after is None or after.pos == "symbol") and prev is not None and prev.surface == "の"):
            # 黙ってたのっしゃ: the north's sentence end
            out_m.append(replace(m, surface="っしゃ", end=nxt.end, lemma="っしゃ", reading="っしゃ",
                                 lemma_reading="っしゃ", kana="ッシャ", pos="particle", ctype="", cform="",
                                 written="っしゃ", written_reading="っしゃ"))
            out_t.append(("助詞", "終助詞", "*"))
            skip.add(i + 1)
            continue
        if (m.surface == "ん" and (prev is None or prev.pos == "symbol") and nxt is not None and nxt.surface == "だん"
                and after is not None and after.surface == "だ" and _glued(m, nxt) and _glued(nxt, after)):
            # んだんだ: the north's "that's right" (= そうだそうだ)
            out_m.append(replace(m, surface="んだんだ", end=after.end, lemma="んだんだ", reading="んだんだ",
                                 lemma_reading="んだんだ", kana="ンダンダ", pos="interjection", ctype="", cform="",
                                 written="んだんだ", written_reading="んだんだ"))
            out_t.append(("感動詞", "一般", "*"))
            skip.update({i + 1, i + 2})
            continue
        if (m.surface == "やん" and nxt is not None and nxt.surface == "か" and _glued(m, nxt)
                and (after is None or after.pos == "symbol")):
            # しゃあないやんか: the west's じゃないか
            out_m.append(replace(m, surface="やんか", end=nxt.end, lemma="やんか", reading="やんか",
                                 lemma_reading="やんか", kana="ヤンカ", pos="particle", ctype="", cform="",
                                 written="やんか", written_reading="やんか"))
            out_t.append(("助詞", "終助詞", "*"))
            skip.add(i + 1)
            continue
        if (m.surface == "か" and m.pos == "particle" and prev is not None and prev.pos == "auxiliary" and prev.lemma == "た"
                and nxt is not None and nxt.surface == "て" and _glued(m, nxt)
                and (after is None or after.pos == "symbol")):
            # 言うたかて: the west's "even if" (= たって)
            out_m.append(replace(m, surface="かて", end=nxt.end, lemma="かて", reading="かて", lemma_reading="かて",
                                 kana="カテ", pos="particle", ctype="", cform="", conjunctive=False, written="かて",
                                 written_reading="かて"))
            out_t.append(("助詞", "接続助詞", "*"))
            skip.add(i + 1)
            continue
        # (plan 272: what a sense review of the app's own sentences found
        # cut or read as another word)
        if (m.surface == "あ" and m.pos == "interjection" and prev is not None and prev.surface in ("また", "又")
                and nxt is not None and nxt.surface == "し" and after is not None and after.surface == "た"
                and _glued(m, nxt) and _glued(nxt, after)):
            # またあした: 明日, "tomorrow", no "ah" and a past する
            out_m.append(replace(m, surface="あした", end=after.end, lemma="明日", reading="あした", lemma_reading="あした",
                                 kana="アシタ", pos="noun", ctype="", cform="", written="明日", written_reading="あした"))
            out_t.append(("名詞", "普通名詞", "副詞可能"))
            skip.update({i + 1, i + 2})
            continue
        last = out_m[-1] if out_m else None
        if (m.pos == "verb" and m.lemma == "入る" and m.surface.startswith("はい") and _hiragana_only(m.surface)
                and last is not None and last.pos == "noun" and _glued(last, m)
                and last.surface not in _ENTERED and last.surface.lstrip("お") not in _ENTERED):
            # お箸はいりますか, おつりはいりません: は and 要る, "do you need",
            # no 入る -- where nothing is gone into
            said = m.surface[1:]
            out_m += [replace(m, surface="は", end=m.start + 1, lemma="は", reading="わ", lemma_reading="は", kana="ハ",
                              pos="particle", ctype="", cform="", conjunctive=False, written="は", written_reading="は"),
                      replace(m, surface=said, start=m.start + 1, lemma="要る", reading=said, lemma_reading="いる",
                              kana=kata(said), written="要る", written_reading="いる")]
            out_t += [("助詞", "係助詞", "*"), tags[i]]
            continue
        if (m.surface == "つり" and m.pos == "verb" and prev is not None and prev.surface == "お" and prev.pos == "prefix"):
            # おつりです: お釣り, "change", no 吊る
            out_m.append(replace(m, lemma="釣り", lemma_reading="つり", pos="noun", ctype="", cform="", written="釣り",
                                 written_reading="つり"))
            out_t.append(("名詞", "普通名詞", "一般"))
            continue
        if (m.lemma == "呉れる" and m.pos == "verb" and m.surface.startswith("くれ") and prev is not None
                and prev.surface == "お" and prev.pos == "prefix" and _glued(prev, m)):
            # おくれる場合は: 遅れる, "to be late", no お and くれる
            out_m[-1:] = [replace(prev, surface="お" + m.surface, end=m.end, lemma="遅れる", reading="お" + m.reading,
                                  lemma_reading="おくれる", kana=kata("お" + kata_to_hira(m.reading)), pos="verb",
                                  ctype="下一段-ラ行", cform=m.cform, conjunctive=m.conjunctive, written="遅れる",
                                  written_reading="おくれる")]
            out_t[-1:] = [("動詞", "一般", "*")]
            continue
        if (m.pos == "noun" and len(m.surface) == 1 and _has_kanji_char(m.surface) and nxt is not None and _glued(m, nxt)
                and _hiragana_only(nxt.surface) and len(nxt.surface) >= 2 and nxt.pos == "noun"):
            word = _deck_spelled_half_in_kana(m.surface, nxt.surface)
            if word is not None:
                # 野さい: 野菜, its second kanji in kana, no 野 and 際
                kanji, kana = word
                out_m.append(replace(m, surface=m.surface + nxt.surface, end=nxt.end, lemma=kanji, reading=kana,
                                     lemma_reading=kana, kana=kata(kana), written=kanji, written_reading=kana))
                out_t.append(("名詞", "普通名詞", "一般"))
                skip.add(i + 1)
                continue
        if (m.surface == "中央" and nxt is not None and _glued(m, nxt) and (nxt.surface in ("線", "道") or (
                nxt.surface[:1] in "一二三四五六七八九十0123456789" and after is not None and after.surface.startswith("丁目")))):
            # 中央線, 中央道, 中央三丁目: a line's, a road's and a district's name
            if nxt.surface in ("線", "道"):
                said = "ちゅうおう" + ("せん" if nxt.surface == "線" else "どう")
                out_m.append(replace(m, surface="中央" + nxt.surface, end=nxt.end, lemma="中央" + nxt.surface,
                                     reading=said, lemma_reading=said, kana=kata(said), proper=True, name_kind="place",
                                     written="中央" + nxt.surface, written_reading=said))
                out_t.append(("名詞", "固有名詞", "地名"))
                skip.add(i + 1)
            else:
                out_m.append(replace(m, proper=True, name_kind="place"))
                out_t.append(("名詞", "固有名詞", "地名"))
            continue
        if (m.pos == "noun" and not m.proper and (_hiragana_only(m.surface)
                                                   or (_katakana_only(m.surface) and not _deck_kana().get(kata_to_hira(m.surface))
                                                       and not _deck_kana().get(m.surface)))
                and 2 <= len(m.surface) <= 5 and out_m and out_m[-1].proper and out_m[-1].name_kind == "family"
                and not _hiragana_only(out_m[-1].surface) and _glued(out_m[-1], m)):
            # 上原あかり: a family name and the given one, no 明かり "light"
            # (plan 272)
            out_m.append(replace(m, proper=True, name_kind="given", unknown=False))
            out_t.append(("名詞", "固有名詞", "人名"))
            continue
        if (m.pos == "noun" and _katakana_only(m.surface) and 2 <= len(m.surface) <= 4 and nxt is not None
                and nxt.surface in ("た", "すけ", "まる", "ぞう", "きち", "ろう", "こ") and _glued(m, nxt)
                and after is not None and after.surface in ("は", "が", "も", "の", "と", "、", "！", "に", "を")):
            # ねずみの チュウたは: a name, a sound and a boy's ending -- no
            # past た after a noun, no ちゅう "kiss" (plan 272)
            surface = m.surface + nxt.surface
            said = m.reading + nxt.surface
            out_m.append(replace(m, surface=surface, end=nxt.end, lemma=surface, reading=said, lemma_reading=said,
                                 kana=m.kana + kata_of(nxt.surface), proper=True, name_kind="given", unknown=True,
                                 written=surface, written_reading=said))
            out_t.append(("名詞", "固有名詞", "人名"))
            skip.add(i + 1)
            continue
        if not m.proper and named_alone(morphemes, i):
            # あおいが今日来れないって: Aoi, a name UniDic reads alone --
            # no 青い, an adjective, which takes no が (plan 272)
            out_m.append(replace(m, proper=True, name_kind="given", unknown=False))
            out_t.append(("名詞", "固有名詞", "人名"))
            continue
        if (m.pos == "noun" and _katakana_only(m.surface) and nxt is not None and nxt.surface == "ノ"
                and _glued(m, nxt) and _a_firm_after(morphemes, i + 1)):
            # ハルノ企画の田中です: a firm's name, its ノ in it -- no name
            # Haru and a ノ left over (plan 272)
            surface = m.surface + nxt.surface
            said = kata_to_hira(m.kana) + "の"
            out_m.append(replace(m, surface=surface, end=nxt.end, lemma=surface, reading=said, lemma_reading=said,
                                 kana=m.kana + "ノ", proper=True, name_kind="business", unknown=False,
                                 written=surface, written_reading=said))
            out_t.append(("名詞", "固有名詞", "一般"))
            skip.add(i + 1)
            continue
        if m.pos == "noun" and len(m.surface) >= 2 and (
                (_hiragana_only(m.surface) and (m.name_kind != "place" or _a_firm_after(morphemes, i)))
                or (_katakana_only(m.surface) and _has_kanji_char(m.lemma) and _a_firm_after(morphemes, i))) \
                and _a_house_name(morphemes, i):
            # さくら旅館, さくらという店, はい、さくらでございます, みどり商事,
            # サクラ航空, パン屋こむぎ: the name of an inn, a shop, a firm, no
            # 桜 "cherry blossom"; のぞみ号, a train's
            vessel = i + 1 < len(morphemes) and morphemes[i + 1].surface == "号"
            out_m.append(replace(m, proper=True, name_kind="vessel" if vessel else "business", unknown=False))
            out_t.append(("名詞", "固有名詞", "一般"))
            continue
        if (m.surface == "一日" and prev is not None and prev.surface == "の" and i >= 2
                and len(morphemes[i - 2].surface) > 1 and morphemes[i - 2].surface.endswith("月")
                and kata_to_hira(m.reading) != "ついたち"):
            # 来月の一日から: the first of the month, ついたち
            out_m.append(replace(m, reading="ついたち", lemma_reading="ついたち", kana="ツイタチ",
                                 written_reading="ついたち"))
            out_t.append(tags[i])
            continue
        if (m.surface == "年" and m.pos == "noun" and kata_to_hira(m.reading) == "ねん" and nxt is not None
                and nxt.pos == "particle" and nxt.surface in ("の", "が", "を", "は", "も") and _glued(m, nxt)
                and not (prev is not None and (prev.surface[-1:] in "一二三四五六七八九十百千万何数0123456789毎去今来昨"
                                               or prev.pos in ("noun", "prefix", "suffix") and _glued(prev, m)))):
            # 年のわりに, 年のせいか, 年をとる: とし, a person's years
            out_m.append(replace(m, reading="とし", lemma_reading="とし", kana="トシ", written_reading="とし"))
            out_t.append(tags[i])
            continue
        if (m.surface == "正しく" and m.pos == "adverb" and nxt is not None and nxt.pos in ("verb", "noun")
                and nxt.surface not in ("それ", "これ") and not nxt.proper):
            # 正しく判断する: 正しい's ただしく, "correctly", no まさしく
            out_m.append(replace(m, lemma="正しい", reading="ただしく", lemma_reading="ただしい", kana="タダシク",
                                 pos="adjective", ctype="形容詞", cform="連用形-一般", written="正しい",
                                 written_reading="ただしい"))
            out_t.append(("形容詞", "一般", "*"))
            continue
        if (m.surface.startswith("入れ") and m.lemma == "入れる" and m.pos == "verb" and _enters(morphemes, i)):
            # この店は誰でも入れます, 中には入れません: 入る's はいれる, "can
            # enter", no 入れる "to put in"
            out_m.append(replace(m, lemma="入る", reading="はい" + kata_to_hira(m.reading)[1:], lemma_reading="はいる",
                                 kana="ハイ" + m.kana[1:] if m.kana else m.kana, ctype="五段-ラ行", written="入る",
                                 written_reading="はいる"))
            out_t.append(tags[i])
            continue
        if (m.surface == "十分" and nxt is not None and _glued(m, nxt)
                and nxt.surface.startswith(("おき", "後", "前", "ほど", "くらい", "ぐらい", "間", "以内", "程"))):
            # 十分おきに: ten minutes, じゅっぷん, no じゅうぶん "enough"
            out_m += [replace(m, surface="十", end=m.start + 1, lemma="十", reading="じゅっ", lemma_reading="じゅう",
                              kana="ジュッ", pos="noun", ctype="", cform="", written="十", written_reading="じゅう"),
                      replace(m, surface="分", start=m.start + 1, lemma="分", reading="ぷん", lemma_reading="ふん",
                              kana="プン", pos="suffix", ctype="", cform="", written="分", written_reading="ふん")]
            out_t += [("名詞", "数詞", "*"), ("接尾辞", "名詞的", "助数詞")]
            continue
        if m.surface == "週" and nxt is not None and nxt.surface == "まつ" and _glued(m, nxt):
            # 週まつ: 週末, "the weekend", no 待つ
            out_m.append(replace(m, surface="週まつ", end=nxt.end, lemma="週末", reading="しゅうまつ",
                                 lemma_reading="しゅうまつ", kana="シュウマツ", pos="noun", written="週末",
                                 written_reading="しゅうまつ"))
            out_t.append(("名詞", "普通名詞", "一般"))
            skip.add(i + 1)
            continue
        if (m.surface == "だし" and m.pos == "verb" and m.lemma == "出す" and prev is not None and _glued(prev, m)
                and (prev.pos in ("noun", "other") or (prev.pos == "verb" and _deck_word(prev.surface)))
                and (nxt is None or nxt.pos == "symbol")):
            # 休みだし、: the copula and 〜し, "it's a day off, and", no 出す
            if prev.pos == "verb" and out_m:
                out_m[-1] = replace(out_m[-1], pos="noun", lemma=prev.surface, lemma_reading=kata_to_hira(prev.reading),
                                    ctype="", cform="", conjunctive=False, written=prev.surface,
                                    written_reading=kata_to_hira(prev.reading))
                out_t[-1] = ("名詞", "普通名詞", "一般")
            out_m += [replace(m, surface="だ", end=m.start + 1, lemma="だ", reading="だ", lemma_reading="だ", kana="ダ",
                              pos="auxiliary", ctype="助動詞-ダ", cform="終止形-一般", written="だ", written_reading="だ"),
                      replace(m, surface="し", start=m.start + 1, lemma="し", reading="し", lemma_reading="し", kana="シ",
                              pos="particle", ctype="", cform="", conjunctive=True, written="し", written_reading="し")]
            out_t += [("助動詞", "*", "*"), ("助詞", "接続助詞", "*")]
            continue
        if (m.surface == "見" and m.lemma == "見る" and nxt is not None and nxt.surface == "た" and after is not None
                and after.surface == "目" and _glued(m, nxt) and _glued(nxt, after)):
            # 見た目で判断する: 見た目, "looks", no saw + eye
            out_m.append(replace(m, surface="見た目", end=after.end, lemma="見た目", reading="みため", lemma_reading="みため",
                                 kana="ミタメ", pos="noun", ctype="", cform="", written="見た目", written_reading="みため"))
            out_t.append(("名詞", "普通名詞", "一般"))
            skip.update({i + 1, i + 2})
            continue
        if (m.surface == "くらい" and m.pos == "particle" and prev is not None and prev.pos == "adverb"
                and prev.surface in ("もう", "まだ", "とても", "すごく", "少し", "すこし", "ちょっと", "まだまだ", "かなり")
                and (nxt is None or nxt.pos == "symbol" or nxt.surface in ("みたい", "です", "ね", "よ", "な", "なあ", "し",
                                                                         "から", "ので", "けど", "そう"))):
            # 外はもうくらいみたいだ: 暗い, "dark", no "about"
            out_m.append(replace(m, lemma="暗い", lemma_reading="くらい", pos="adjective", ctype="形容詞",
                                 cform="終止形-一般", written="暗い", written_reading="くらい"))
            out_t.append(("形容詞", "一般", "*"))
            continue
        if m.surface == "付" and m.pos == "suffix" and prev is not None and prev.surface.endswith("日") and _glued(prev, m):
            # 本日付で, "as of today": づけ, the date a thing bears
            out_m.append(replace(m, reading="づけ", lemma_reading="づけ", kana="ヅケ", written_reading="づけ"))
            out_t.append(tags[i])
            continue
        if m.surface == "私事" and nxt is not None and nxt.surface in ("で", "です", "ながら", "では"):
            # 私事で恐縮ですが, a letter's "a personal matter": わたくしごと
            out_m.append(replace(m, reading="わたくしごと", lemma_reading="わたくしごと", kana="ワタクシゴト",
                                 written_reading="わたくしごと"))
            out_t.append(tags[i])
            continue
        if m.surface in ("上り", "下り") and m.pos == "verb" and prev is not None and _glued(prev, m) and (
                prev.surface.endswith(("高速", "線", "道", "方面")) or (
                    nxt is not None and nxt.surface in ("線", "列車", "電車", "車線", "方面"))):
            # 名神高速上り, 上り線: the direction toward the capital, the deck's noun
            out_m.append(replace(m, pos="noun", lemma=m.surface, cform="", conjunctive=False))
            out_t.append(("名詞", "普通名詞", "一般"))
            continue
        if m.surface == "雨" and m.reading == "う" and prev is not None and prev.surface in ("時", "時々"):
            # 曇り一時雨, "showers at times": あめ, no 雷雨's う
            out_m.append(replace(m, reading="あめ", lemma_reading="あめ", kana="アメ", pos="noun", written_reading="あめ"))
            out_t.append(("名詞", "普通名詞", "一般"))
            continue
        if m.surface == "山手" and nxt is not None and nxt.surface == "線" and _glued(m, nxt):
            # 山手線: Tokyo's やまのて line
            out_m.append(replace(m, reading="やまのて", lemma_reading="やまのて", kana="ヤマノテ", written_reading="やまのて"))
            out_t.append(tags[i])
            continue
        if (m.surface == "通っ" and m.lemma == "通う" and prev is not None
                and ((prev.surface == "を" and prev.pos == "particle")
                     or (prev.surface == "が" and i >= 2 and morphemes[i - 2].surface in _PASSING))):
            # 火が通っている, 公園を通って: 通る, とおる -- no 通う, "commute"
            out_m.append(replace(m, lemma="通る", reading="とおっ", lemma_reading="とおる", kana="トオッ",
                                 ctype="五段-ラ行", written="通る", written_reading="とおる"))
            out_t.append(tags[i])
            continue
        if (m.surface == "あれ" and m.pos == "pronoun" and nxt is not None and nxt.surface == "まあ"
                and (prev is None or prev.pos == "symbol")):
            # あれまあ: "oh my!", no "that one"
            out_m.append(replace(m, pos="interjection", lemma="あれ", lemma_reading="あれ"))
            out_t.append(("感動詞", "一般", "*"))
            continue
        if (m.surface == "二" and nxt is not None and nxt.surface == "次" and after is not None and after.surface == "会"):
            # 二次会, "the after-party": one word, no count
            out_m.append(replace(m, surface="二次会", end=after.end, lemma="二次会", reading="にじかい",
                                 lemma_reading="にじかい", kana="ニジカイ", pos="noun", ctype="", cform="",
                                 written="二次会", written_reading="にじかい"))
            out_t.append(("名詞", "普通名詞", "一般"))
            skip.update({i + 1, i + 2})
            continue
        if (nxt is not None and nxt.pos == "symbol" and _hiragana_only(nxt.surface) and _hiragana_only(m.surface)
                and _glued(m, nxt)):
            # はいしゃ, 歯医者: UniDic read はい, "yes", and a fragment it has
            # no word for (plan 272). Joined where one deck word, no verb, is
            # read so.
            said = m.surface + nxt.surface
            words = sorted({k for k, r in _deck_forms() if r == said and k})
            if len(words) == 1:
                out_m.append(replace(m, surface=said, end=nxt.end, lemma=words[0], reading=said, lemma_reading=said,
                                     kana="".join(chr(ord(c) + 0x60) for c in said), pos="noun", ctype="", cform="",
                                     auxiliary_use=False, conjunctive=False, written=words[0], written_reading=said))
                out_t.append(("名詞", "普通名詞", "一般"))
                skip.add(i + 1)
                continue
        if (m.surface == "で" and m.pos == "auxiliary" and m.lemma == "だ" and nxt is not None and nxt.surface == "は"
                and prev is not None and prev.pos in ("noun", "pronoun", "suffix") and not prev.adjectival
                and i + 2 < len(morphemes) and morphemes[i + 2].surface in ("、", "，")
                and not (i + 3 < len(morphemes) and morphemes[i + 3].lemma in ("無い", "ない", "有る", "ある"))):
            # 課長の話では、, 私の考えでは、: the particle で, "by, from", and
            # は -- no copula, which ない or ある would follow (plan 272).
            out_m.append(replace(m, pos="particle", lemma="で", lemma_reading="で", ctype="", cform="",
                                 conjunctive=False, auxiliary_use=False, written="で", written_reading="で"))
            out_t.append(("助詞", "格助詞", "*"))
            continue
        if m.surface == "毎" and nxt is not None and _glued(m, nxt):
            # 毎ばん, as a graded text writes 毎晩: UniDic's ばん is "bang",
            # 毎しゅう 毎 + 周, 毎とし 毎 + と + し (plan 272). Only where the
            # deck spells 毎 + the kana so.
            joined = None
            for n in (2, 1):
                run = morphemes[i + 1:i + 1 + n]
                if len(run) < n or not all(r.surface and all("\u3041" <= c <= "\u309f" for c in r.surface)
                                           for r in run) or not all(_glued(a, b) for a, b in zip([m] + run, run)):
                    continue
                said = "まい" + "".join(r.surface for r in run)
                word = next((k for k, r in sorted(_deck_forms()) if r == said and k.startswith("毎") and len(k) == 2),
                            None)
                if word is not None:
                    joined = (run, said, word)
                    break
            if joined is not None:
                run, said, word = joined
                out_m.append(replace(m, surface=m.surface + "".join(r.surface for r in run), end=run[-1].end,
                                     lemma=word, reading=said, lemma_reading=said,
                                     kana="".join(chr(ord(c) + 0x60) for c in said), pos="noun", ctype="", cform="",
                                     written=word, written_reading=said))
                out_t.append(("名詞", "普通名詞", "副詞可能"))
                skip.update(range(i + 1, i + 1 + len(run)))
                continue
        if m.pos == "noun" and m.surface == "家の子" and m.lemma == "家の子":
            at = m.start
            out_m += [replace(m, surface="家", end=at + 1, lemma="家", reading="いえ", lemma_reading="いえ",
                              kana="イエ", written="家", written_reading="いえ"),
                      replace(m, surface="の", start=at + 1, end=at + 2, lemma="の", reading="の",
                              lemma_reading="の", kana="ノ", pos="particle", goshu="和", written="の",
                              written_reading="の"),
                      replace(m, surface="子", start=at + 2, end=at + 3, lemma="子", reading="こ",
                              lemma_reading="こ", kana="コ", written="子", written_reading="こ")]
            out_t += [("名詞", "普通名詞", "一般"), ("助詞", "格助詞", "*"), ("名詞", "普通名詞", "一般")]
            continue
        if (m.pos == "noun" and len(m.surface) >= 3 and m.surface.endswith(("ごろ", "頃"))
                and not m.proper and not _written_word(m.surface) and not _written_word(m.lemma)):
            tail = "ごろ" if m.surface.endswith("ごろ") else "頃"
            head = m.surface[:-len(tail)]
            if head != "何時" and _written_word(head):
                cut = m.start + len(head)
                said = m.reading[:-2] if m.reading.endswith("ごろ") else m.reading
                out_m += [replace(m, surface=head, end=cut, lemma=head, reading=said, lemma_reading=said,
                                  kana=m.kana[:len(said)], written=head, written_reading=said),
                          replace(m, surface=tail, start=cut, lemma="頃", reading="ごろ", lemma_reading="ころ",
                                  kana="ゴロ", written="頃", written_reading="ころ")]
                out_t += [("名詞", "普通名詞", "一般"), ("名詞", "普通名詞", "副詞可能")]
                continue
        if (m.pos == "noun" and len(m.surface) == 2 and m.surface[0] == "何" and _is_kanji(m.surface[1])
                and not m.proper and not _written_word(m.surface) and _written_word(m.surface[1])
                and m.reading.startswith(("なに", "なん"))):
            said = m.reading[:2]
            out_m += [replace(m, surface="何", end=m.start + 1, lemma="何", reading=said, lemma_reading="なに",
                              kana="ナニ" if said == "なに" else "ナン", pos="pronoun", written="何",
                              written_reading="なに"),
                      replace(m, surface=m.surface[1], start=m.start + 1, lemma=m.surface[1], reading=m.reading[2:],
                              lemma_reading=m.reading[2:], kana=m.kana[2:], written=m.surface[1],
                              written_reading=m.reading[2:])]
            out_t += [("代名詞", "*", "*"), ("名詞", "普通名詞", "一般")]
            continue
        if (m.surface == "し" and m.lemma in ("為る", "する") and nxt is not None and nxt.surface == "かね"
                and after is not None and after.surface == "られ" and prev is not None
                and (prev.counter or prev.surface in ("時間", "分", "日", "回", "人", "度", "円", "個", "つ")
                     or prev.surface.translate(_FULLWIDTH_DIGITS).isdigit())
                and _glued(m, nxt) and _glued(nxt, after)):
            out_m += [replace(m, surface="しか", end=nxt.start + 1, lemma="しか", reading="しか",
                              lemma_reading="しか", kana="シカ", pos="particle", ctype="", cform="",
                              conjunctive=False, auxiliary_use=False, written="しか", written_reading="しか"),
                      replace(nxt, surface="ね", start=nxt.start + 1, lemma="寝る", reading="ね",
                              lemma_reading="ねる", kana="ネ", pos="verb", ctype="下一段-ナ行",
                              cform="未然形-一般", auxiliary_use=False, written="寝る", written_reading="ねる")]
            out_t += [("助詞", "副助詞", "*"), ("動詞", "一般", "*")]
            skip.add(i + 1)
            continue
        if (m.surface == "どう" and m.pos == "adverb" and nxt is not None and nxt.surface == "し"
                and after is not None and after.surface == "て" and _glued(m, nxt) and _glued(nxt, after)):
            then = morphemes[i + 3] if i + 3 < len(morphemes) else None
            if then is None or not (then.surface in ("も", "いい", "よい", "良い", "ほしい", "欲しい")
                                    or then.lemma in ("居る", "いる", "良い", "貰う", "もらう", "呉れる", "くれる",
                                                      "居らっしゃる", "おる", "てる", "置く")
                                    or then.surface in ("る", "た", "ん", "て", "た")):
                out_m.append(replace(m, surface="どうして", end=after.end, lemma="どうして", reading="どうして",
                                     lemma_reading="どうして", kana="ドウシテ", written="どうして",
                                     written_reading="どうして"))
                out_t.append(("副詞", "*", "*"))
                skip.update({i + 1, i + 2})
                continue
        out_m.append(m)
        out_t.append(tags[i])
    return out_m, out_t


_A_TO_U = dict(zip("わかがさたなばまら", "うくぐすつぬぶむる"))


def _joined(m, last, surface: str, lemma: str, reading: str, pos: str, **more):
    """One morpheme for m … last, read `reading`."""
    from dataclasses import replace

    kana = "".join(chr(ord(c) + 0x60) if "\u3041" <= c <= "\u3096" else c for c in reading)
    return replace(m, surface=surface, end=last.end, lemma=lemma, reading=reading, lemma_reading=reading,
                   kana=kana, pos=pos, ctype=more.get("ctype", ""), cform=more.get("cform", ""),
                   auxiliary_use=False, proper=False, name_kind="", unknown=False, conjunctive=False,
                   written=more.get("written", lemma), written_reading=reading)


# The expressways whose 道 is read どう: 東北道, 関越道 (plan 272).
_EXPRESSWAYS = frozenset({"東北", "関越", "東名", "名神", "中央", "北陸", "常磐", "磐越", "上信越", "東関東", "外環",
                          "圏央", "京葉", "山陽", "九州", "東海北陸", "新東名", "新名神", "長野", "道央", "道東",
                          "中国", "山陰", "北関東", "東九州", "秋田", "山形", "八戸", "館山", "京奈和"})

_TAGS = {"adnominal": ("連体詞", "*", "*"),
         "noun": ("名詞", "普通名詞", "一般"), "interjection": ("感動詞", "一般", "*"), "adverb": ("副詞", "*", "*"),
         "conjunction": ("接続詞", "*", "*"), "particle": ("助詞", "終助詞", "*"), "auxiliary": ("助動詞", "*", "*"),
         "verb": ("動詞", "一般", "*"), "adjective": ("形容詞", "一般", "*")}


@lru_cache(maxsize=1024)
def _a_deck_noun(reading: str) -> str:
    """The spelling of a deck noun read `reading` written with a kanji,
    or "": おく is 奥."""
    from content.vocab_data import VOCAB_BY_LEVEL

    for level in ("N5", "N4", "N3", "N2", "N1"):
        for entry in VOCAB_BY_LEVEL.get(level, []):
            kanji = entry.get("kanji") or ""
            if kanji and len(kanji) == 1 and _is_kanji(kanji) and reading in (entry.get("kana") or "").split("/") \
                    and "verb" not in (entry.get("type") or entry.get("pos") or "").lower():
                return kanji
    return ""


@lru_cache(maxsize=1024)
def _verb_of_n(word: str):
    """(spelling, reading) of the deck's godan verb in む, ぶ or ぬ whose
    て-form stem `word` is (たたん: 畳む), or None."""
    from content.vocab_data import VOCAB_BY_LEVEL

    stem = word[:-1]
    for ending in "むぶぬ":
        said = stem + ending
        for level in ("N5", "N4", "N3", "N2", "N1"):
            for entry in VOCAB_BY_LEVEL.get(level, []):
                if said in (entry.get("kana") or "").split("/") and (entry.get("kanji") or "").endswith(ending):
                    return entry["kanji"], said
    return None

# The pairs とも says "both" of (plan 272): 上下線とも, 両方とも.
_PAIRS = frozenset({"上下", "両方", "双方", "両者", "男女", "左右", "前後", "夫婦", "兄弟", "姉妹", "親子", "両親",
                    "上下線", "往復", "公私", "心身", "内外"})


def _a_laugh_typed(text: str) -> bool:
    return bool(text) and all(c in "wWｗＷ" for c in text)


@lru_cache(maxsize=2048)
def _noun_of_two(surface: str):
    """(kanji, reading) of the one JMdict noun `surface` spells, or None."""
    import content.vocab_jmdict_data as jmdict_db

    rows = jmdict_db.by_kanji(surface, limit=2)
    if len(rows) != 1 or rows[0].get("kanji") != surface:
        return None
    tags = {t for sense in jmdict_db.get_senses(rows[0]["kanji"], rows[0]["kana"]) or [] for t in sense.get("tags") or ()}
    return (rows[0]["kanji"], kata_to_hira(rows[0]["kana"])) if "n" in tags else None


@lru_cache(maxsize=2048)
def _an_adjective(surface: str) -> bool:
    """Whether the deck or JMdict holds `surface` as an い-adjective."""
    import content.vocab_jmdict_data as jmdict_db

    if any(kanji == surface for kanji, _kana in _deck_forms()):
        return True
    for row in jmdict_db.by_kanji(surface, limit=2):
        tags = {t for sense in jmdict_db.get_senses(row.get("kanji", ""), row.get("kana", "")) or []
                for t in sense.get("tags") or ()}
        if "adj-i" in tags:
            return True
    return False


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
        if j == i and morphemes[i].pos == "noun" and len(morphemes[i].surface) >= 2 \
                and all("\u30a1" <= c <= "\u30fc" for c in morphemes[i].surface):
            # A loanword UniDic holds as a noun, and its い (ラグ + い: ラグい,
            # "laggy", plan 272).
            j = i + 1
        if j - i >= 1 and j < len(morphemes) and morphemes[j].start == morphemes[j - 1].end \
                and morphemes[j].surface in ("く", "い", "かっ", "けれ") and (j - i >= 2 or morphemes[i].pos == "noun"):
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
            verbal=(getattr(feat, "pos3", None) or "") == "サ変可能",
            written=_clean_lemma(getattr(feat, "orthBase", None), surface) if not digits.isdigit() else surface,
            written_reading=kata_to_hira(getattr(feat, "kanaBase", None) or "") if not digits.isdigit() else surface,
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


@lru_cache(maxsize=4096)
def _first_spelling(reading: str) -> str:
    """The spelling of the deck's lowest-level card read `reading`: ねる is
    寝る (N5) before 練る (N1)."""
    from content.vocab_data import VOCAB_BY_LEVEL

    for level in ("N5", "N4", "N3", "N2", "N1"):
        for entry in VOCAB_BY_LEVEL.get(level, []):
            if reading in (kata_to_hira(k.strip()) for k in (entry.get("kana") or "").replace(";", "/").split("/")):
                return entry.get("kanji") or reading
    return reading


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


# One-letter particles nothing said opens on: a か, が or を there is the
# first letter of a word UniDic cut.
_NO_OPENER = frozenset("かがをにのへもや")
_PHRASE_OPENS = frozenset("。！？!?「『（(…‥、，,\u3000 ")


def _opened_on_a_particle(morphemes: list[Morpheme], tags: list[tuple]) -> tuple[list, list]:
    """A kana word MeCab cut into a particle and the letters after it,
    where what is said opens and no particle can stand (plan 272): かお
    いろが悪い is 顔色, "complexion", which UniDic reads か + お + いろ.
    The longest run of three kana or more from the particle that spells a
    word of the deck or of JMdict (_known) and ends before a particle or
    a mark is read as that word."""
    from dataclasses import replace

    out_m, out_t = [], []
    i = 0
    while i < len(morphemes):
        m = morphemes[i]
        opens = i == 0 or (morphemes[i - 1].pos == "symbol" and morphemes[i - 1].surface in _PHRASE_OPENS)
        best = None
        if opens and m.pos == "particle" and m.surface in _NO_OPENER:
            j = i + 1
            while j < len(morphemes) and j - i < 5 and _kana_letters(morphemes[j].surface) \
                    and _glued(morphemes[j - 1], morphemes[j]):
                j += 1
                joined = "".join(u.surface for u in morphemes[i:j])
                after = morphemes[j] if j < len(morphemes) else None
                spelled = _known(joined) if len(joined) >= 3 else None
                if spelled and (after is None or after.pos in ("particle", "symbol")):
                    best = (j, joined, spelled)
        if best:
            j, joined, spelled = best
            out_m.append(replace(m, surface=joined, end=morphemes[j - 1].end, lemma=spelled, reading=joined,
                                 lemma_reading=joined, kana="".join(chr(ord(c) + 0x60) for c in joined),
                                 pos="noun", ctype="", cform="", conjunctive=False, auxiliary_use=False))
            out_t.append(("名詞", "普通名詞", "一般"))
            i = j
            continue
        out_m.append(m)
        out_t.append(tags[i])
        i += 1
    return out_m, out_t


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
        morphemes, tags = _opened_on_a_particle(morphemes, tags)
        morphemes, tags = _kana_names(morphemes, tags)
        _demonstratives(morphemes)
        _picture(morphemes)
        morphemes, tags = _notice(morphemes, tags)
        _one_kana_nouns(morphemes)
        _shops(morphemes, tags)
        morphemes, tags = _sleep(morphemes, tags)
        morphemes, tags = _pain(morphemes, tags)
        morphemes = _went(morphemes)
        morphemes, tags = _how_many_minutes(morphemes, tags)
        morphemes, tags = _not_a_passive(morphemes, tags)
        _place_de(morphemes, tags)
        morphemes, tags = _spoken_kana(morphemes, tags)
        morphemes, tags = _katakana_adjectives(morphemes, tags)
        morphemes, tags = _zu_words(morphemes, tags)
        morphemes, tags = _cut_words(morphemes, tags)
        morphemes, tags = _introduced(morphemes, tags)
        morphemes, tags = _no_names(morphemes, tags)
        morphemes, tags = _named_animals(morphemes, tags)
        morphemes, tags = _names_kept(morphemes, tags)
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
