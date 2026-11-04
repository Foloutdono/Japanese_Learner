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
import re
from dataclasses import dataclass, replace
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


def _all_through(morphemes: list[Morpheme], tags: list) -> None:
    """中 glued after a span of time (a noun UniDic files as countable or
    adverbial: 日, 年, 晩) is the suffix じゅう, "all through", wherever
    UniDic took it for the prefix of the noun after it: 一日中さいふを is
    一日 + 中 + さいふ, no 中- of さいふ; 一晩中勤務 (plan 296). A prefix 中
    opens its word (中学年, 中・高一貫校, 中１), after a place too: 東中学校
    is a school."""
    for k, m in enumerate(morphemes):
        if m.surface == "中" and m.pos == "prefix" and k > 0 and tags[k - 1][2] in ("助数詞可能", "副詞可能") \
                and morphemes[k - 1].pos in ("noun", "suffix") and _glued(morphemes[k - 1], m):
            m.pos, m.reading = "suffix", "じゅう"
            tags[k] = ("接尾辞", "名詞的", "副詞可能")


# What a floor is said of (plan 296): its places, a motion to it, what is
# done or found on it.
_ON_A_FLOOR = frozenset({"入り口", "入口", "出口", "売り場", "部屋", "へや", "教室", "トイレ", "ロビー", "受付",
                         "フロア", "窓", "まど", "ベランダ", "店", "みせ", "レストラン", "会議室", "事務所"})
_TO_A_FLOOR = frozenset({"行く", "来る", "上がる", "下りる", "降りる", "戻る", "着く", "上る", "登る", "移る",
                         "待つ", "売る", "有る", "ある", "居る", "いる", "住む", "集まる"})


def _jiru_not_zuru(morphemes: list[Morpheme]) -> None:
    """A verb UniDic files under its literary ずる, written without a ず,
    is the じる verb the page conjugates (plan 296): 信じ, 信じれば and
    信じる are 信じる -- 信ずる's are 信ずれば, 信ずる; 感じる, 通じる."""
    for m in morphemes:
        if m.pos == "verb" and m.lemma.endswith("ずる") and m.lemma_reading.endswith("ずる") and "ず" not in m.surface:
            m.lemma = m.lemma[:-2] + "じる"
            m.lemma_reading = m.lemma_reading[:-2] + "じる"
            m.ctype = "上一段-ザ行"
            m.written, m.written_reading = m.lemma, m.lemma_reading


# How soon or how gradually one gets used to a thing, the one word
# before 慣れる where なれる of becoming would need what it becomes (plan
# 296): すぐになれる, もうなれた, だんだんなれて.
_SOON = frozenset({"直ぐ", "すぐ", "じき", "次第", "段々", "だんだん", "徐々", "ずつ", "もう", "早く", "すっかり",
                   "やっと", "ようやく"})
# What follows a feeling one cannot help (plan 296): 思えてならない is 思える,
# "it seems", said of itself -- no "can think".
_CANNOT_HELP = ("ならない", "ならぬ", "たまらない", "しかたがない", "仕方がない", "しかたない", "仕方ない",
                "しょうがない", "しようがない")
# The ichidan verbs UniDic files a kana stem under where the godan verb
# beside them takes an object (plan 296): ピアノがひけない is 弾く's
# potential, no 引ける "to close early"; 写真はとれません 撮る's, no 取れる
# "to come off". Each godan verb with what it is done to.
_E_STEM_OF = {
    "引ける": ("引く", {"弾く": frozenset({"ピアノ", "ギター", "バイオリン", "曲", "きょく", "楽器", "がっき", "琴", "こと"}),
                     "引く": frozenset({"線", "せん", "くじ", "辞書", "じしょ", "風邪", "かぜ"})}),
    "取れる": ("取る", {"撮る": frozenset({"写真", "しゃしん", "ビデオ", "動画", "どうが", "映像"})}),
}
_E_ROW_OF = {"う": "え", "く": "け", "ぐ": "げ", "す": "せ", "つ": "て", "ぬ": "ね", "ぶ": "べ", "む": "め", "る": "れ"}


def _a_godan_potential(m: Morpheme) -> bool:
    """Whether `m` is a godan verb's potential as UniDic files it: the
    godan lemma, conjugating as 下一段 on its え-row stem (読め of 読む)."""
    if m.pos != "verb" or not m.ctype.startswith("下一段"):
        return False
    said, stem = kata_to_hira(m.lemma_reading), kata_to_hira(m.reading)
    stem = stem[:-1] if m.cform.startswith(("終止形", "連体形")) and stem.endswith("る") else stem
    return len(said) >= 2 and stem[:-1] == said[:-1] and _E_ROW_OF.get(said[-1]) == stem[-1:]


def _ichidan_spelled(stem: str, lemma: str) -> tuple[str, str] | None:
    """(kanji, kana) of the deck's or the dictionary's ichidan verb read
    `stem` + る and written with `lemma`'s first kanji: 近付ける for 近付く's
    ちかづけ."""
    import content.vocab_jmdict_data as jmdict_db

    kana = stem + "る"
    for kanji, said in sorted(_deck_forms()):
        if said == kana and kanji[:1] == lemma[:1]:
            return kanji, kana
    rows = [r for r in jmdict_db.by_kana(kana, limit=8) if r.get("kana") == kana and (r.get("kanji") or "")[:1] == lemma[:1]]
    return (rows[0]["kanji"], kana) if rows else None


def _own_clause(morphemes: list[Morpheme], i: int) -> list[Morpheme]:
    """What stands before morphemes[i] in its own clause: back to a mark,
    or a verb, an adjective or an ending of another."""
    out = []
    for u in reversed(morphemes[:i]):
        if (u.pos == "symbol" and u.surface in "、。！？!?「」") or u.pos in ("verb", "adjective", "auxiliary"):
            break
        out.append(u)
    return out[::-1]


def _which_verb(morphemes: list[Morpheme]) -> None:
    """The verb an え-row stem belongs to, read off its clause (plan 296).

    - なれる in kana with nothing it becomes, only how soon, is 慣れる:
      ポチは…すぐになれると思っていました (先生になれる keeps 成る's).
    - A godan potential that takes られる, or a を while its godan verb
      takes none, is the ichidan verb spelled so: 制度を…近づけられる is
      近付ける, never 近付く's "can approach".
    - 思えてならない, 思えてしかたがない: 思える, "it seems" of itself.
    - 気が引ける: 引ける, "to feel awkward", no "can pull".
    - A kana stem UniDic files under 引ける or 取れる is the godan verb's
      potential where its clause has a を (neither ichidan verb takes one:
      線をひけますか) or what the godan verb is done to (ピアノがひけない,
      写真はとれません) -- 魚がとれる and ボタンがとれた keep 取れる."""
    for i, m in enumerate(morphemes):
        if m.pos != "verb":
            continue
        nxt = morphemes[i + 1] if i + 1 < len(morphemes) else None
        prev = morphemes[i - 1] if i > 0 else None
        if m.lemma == "成る" and m.ctype.startswith("下一段") and _hiragana_only(m.surface):
            k = i - 2 if prev is not None and prev.surface == "に" and prev.pos == "particle" else i - 1
            if k >= 0 and (morphemes[k].lemma in _SOON or morphemes[k].surface in _SOON) \
                    and morphemes[k].pos in ("adverb", "particle", "adjective"):
                m.lemma, m.lemma_reading, m.written, m.written_reading = "慣れる", "なれる", "慣れる", "なれる"
            continue
        if _a_godan_potential(m):
            stem = kata_to_hira(m.reading)
            stem = stem[:-1] if m.cform.startswith(("終止形", "連体形")) else stem
            takes = nxt is not None and nxt.pos == "auxiliary" and nxt.lemma_reading in ("られる", "させる") \
                and _glued(m, nxt)
            if not takes and any(u.surface == "を" and u.pos == "particle" for u in _own_clause(morphemes, i)):
                from study.grammar_detect import _intransitive
                takes = _intransitive(m.lemma, m.lemma_reading)
            if takes:
                own = _ichidan_spelled(stem, m.lemma)
                if own is not None:
                    m.lemma, m.lemma_reading = own
                    m.written, m.written_reading = own
                    continue
            if m.lemma == "思う" and nxt is not None and nxt.surface == "て" \
                    and "".join(u.surface for u in morphemes[i + 2:i + 6]).startswith(_CANNOT_HELP):
                m.lemma, m.lemma_reading, m.written, m.written_reading = "思える", "おもえる", "思える", "おもえる"
                continue
            if m.lemma == "引く" and prev is not None and prev.surface == "が" and i >= 2 and morphemes[i - 2].surface == "気":
                m.lemma, m.lemma_reading, m.written, m.written_reading = "引ける", "ひける", "引ける", "ひける"
            continue
        if m.lemma in _E_STEM_OF and _hiragana_only(m.surface) and m.ctype.startswith("下一段"):
            # (in a form a potential takes: before ない, ます, そう, or
            # ending its clause or a noun's)
            if not (m.cform.startswith(("終止形", "連体形")) or (
                    nxt is not None and nxt.lemma in ("ない", "ず", "ぬ", "ます", "そう"))):
                continue
            godan, objects = _E_STEM_OF[m.lemma]
            clause = _own_clause(morphemes, i)
            named = {verb for verb, words in objects.items()
                     for q, u in enumerate(clause[:-1]) if u.surface in words
                     and clause[q + 1].pos == "particle" and clause[q + 1].surface in ("を", "が", "は", "も")}
            if len(named) > 1:
                continue
            if named or any(u.surface == "を" and u.pos == "particle" for u in clause):
                verb = next(iter(named), godan)
                said = kata_to_hira(m.reading)
                said = said[:-2] if m.cform.startswith(("終止形", "連体形")) else said[:-1]
                m.lemma, m.lemma_reading = verb, said + {"け": "く", "れ": "る"}[kata_to_hira(m.reading)[len(said)]]
                m.written, m.written_reading = verb, m.lemma_reading


def _someone(m: Morpheme) -> bool:
    """Whether `m` names a person or an animal -- someone made to do a
    thing; a vehicle is moved, and is no one (この車を動かせない)."""
    if m.proper or m.pos == "pronoun" or m.surface in ("さん", "くん", "ちゃん", "様", "さま", "たち", "達"):
        return True
    meaning = _noun_meaning(m.surface, kata_to_hira(m.reading))
    return bool(_ALIVE.search(meaning)) and not _VEHICLES.search(meaning.split(";")[0])


_VEHICLES = re.compile(r"\b(train|bus|car|ship|boat|plane|aircraft|vehicle|automobile)\b")


def _the_transitive_can(morphemes: list[Morpheme], tags: list[tuple]) -> tuple[list, list]:
    """A godan verb's 未然形 + せ(る), where its す verb is the deck's and
    what is acted on is a thing, as that す verb's potential (plan 296):
    食費は減らせっこない is 減らす's "can't reduce", never 減る + the
    causative -- a thing made to decrease is 減らした, and the causative of
    an intransitive verb is said of someone made to do it (子どもを泣かせる
    keeps it)."""
    out_m, out_t = [], []
    i = 0
    while i < len(morphemes):
        m = morphemes[i]
        nxt = morphemes[i + 1] if i + 1 < len(morphemes) else None
        if (m.pos == "verb" and m.ctype.startswith("五段") and m.cform.startswith("未然形") and nxt is not None
                and nxt.pos == "auxiliary" and nxt.lemma == "せる" and _glued(m, nxt) and m.lemma):
            stem = kata_to_hira(m.reading)
            forms = sorted(_deck_forms())
            own = next(((k, said) for k, said in forms if said == stem + "す" and k[:1] == m.lemma[:1]
                        and k != m.lemma), None)
            # (宿題を済ませた: the deck's 済ませる, "to finish", a verb of
            # its own -- neither 済む's causative nor 済ます's potential)
            ichidan = next(((k, said) for k, said in forms if said == stem + "せる" and k[:1] == m.lemma[:1]), None)
            clause = _own_clause(morphemes, i)
            someone = any(u.surface in ("を", "に") and u.pos == "particle" and q > 0 and _someone(clause[q - 1])
                          for q, u in enumerate(clause))
            after = morphemes[i + 2] if i + 2 < len(morphemes) else None
            # (...where the sentence says "can't": 動かせない, 減らせっこない --
            # 頭を悩ませている, 胸を膨らませていた are the す verb said as
            # 下一段, "rack", "swell", and stay as read)
            cannot = after is not None and (after.lemma in ("ない", "ず", "ぬ") or after.surface.startswith("っこ")
                                            or (after.lemma == "ます" and i + 3 < len(morphemes)
                                                and morphemes[i + 3].lemma in ("ず", "ぬ")))
            if (ichidan is not None or (own is not None and cannot)) and not someone:
                lemma, said = ichidan or own
                out_m.append(replace(m, surface=m.surface + nxt.surface, end=nxt.end, lemma=lemma, lemma_reading=said,
                                     reading=stem + kata_to_hira(nxt.reading), kana=m.kana + nxt.kana,
                                     ctype="下一段-サ行", cform=nxt.cform, auxiliary_use=False, written=lemma,
                                     written_reading=said))
                out_t.append(("動詞", "一般", "*"))
                i += 2
                continue
        out_m.append(m)
        out_t.append(tags[i])
        i += 1
    return out_m, out_t


def _whether_or_not(morphemes: list[Morpheme], tags: list[tuple]) -> tuple[list, list]:
    """〜ようが〜まいが, one verb said twice (plan 296): 伏せようが伏せ
    まいが, 参加しようがしまいが, 食べようが食べまいが. UniDic reads the
    first half's よう as 様, "way", after an ichidan verb's stem or する's
    し (and 伏せ as the noun "lying down"), and the second half's しまい
    as 仕舞い, "end": where the まい half follows, the first is that verb's
    volitional, one word as UniDic writes 食べよう, and しまい is し + まい.
    Without the まい half, 書きようがない keeps 様, 〜ようがない's own."""
    morphemes, tags = list(morphemes), list(tags)
    # し + まい first, where a が or と follows it and a よう half stands before it
    for i in range(len(morphemes) - 1, 0, -1):
        m = morphemes[i]
        if m.surface == "しまい" and m.pos == "noun" and i + 1 < len(morphemes) \
                and morphemes[i + 1].surface in ("が", "と") \
                and any(u.surface == "よう" and k + 1 < len(morphemes) and morphemes[k + 1].surface in ("が", "と")
                        for k, u in enumerate(morphemes[:i])):
            morphemes[i:i + 1] = [
                replace(m, surface="し", end=m.start + 1, lemma="為る", reading="し", lemma_reading="する",
                        kana="シ", pos="verb", ctype="サ行変格", cform="未然形-一般", written="為る",
                        written_reading="する"),
                replace(m, surface="まい", start=m.start + 1, lemma="まい", reading="まい", lemma_reading="まい",
                        kana="マイ", pos="auxiliary", ctype="助動詞-マイ", cform="終止形-一般", written="まい",
                        written_reading="まい")]
            tags[i:i + 1] = [("動詞", "非自立可能", "*"), ("助動詞", "*", "*")]
    i = 1
    while i < len(morphemes) - 1:
        m, stem, nxt = morphemes[i], morphemes[i - 1], morphemes[i + 1]
        if m.surface == "よう" and m.pos == "suffix" and nxt.surface in ("が", "と") and stem.end == m.start:
            second = next((morphemes[k - 1] for k in range(i + 2, len(morphemes))
                           if morphemes[k].surface == "まい" and morphemes[k].pos == "auxiliary"
                           and morphemes[k - 1].surface == stem.surface and morphemes[k - 1].pos == "verb"), None)
            if second is not None:
                # (来る's volitional is こよう, its 未然形's こ -- never the
                # stem's き)
                said = "こよう" if second.lemma == "来る" else stem.reading + "よう"
                morphemes[i - 1:i + 1] = [replace(
                    stem, surface=stem.surface + "よう", end=m.end, lemma=second.lemma,
                    reading=said, lemma_reading=second.lemma_reading,
                    kana=stem.kana + "ヨウ", pos="verb", ctype=second.ctype, cform="意志推量形",
                    written=second.written, written_reading=second.written_reading)]
                tags[i - 1:i + 1] = [("動詞", "一般", "*")]
                continue
        i += 1
    return morphemes, tags


def _apart_inside_a_clause(morphemes: list[Morpheme], tags: list[tuple]) -> tuple[list, list]:
    """Two words UniDic writes as one conjunction or adverb, where the
    clause shows them apart (plan 296): ですから after a word or a blank
    is the copula and から, "because" -- ＿＿＿ですから、…てください; the
    conjunction "therefore" opens its sentence -- and かえって after a
    subject and its が, closing its clause with a comma, is 帰る's て form
    (母がかえって、「…」と言いました), never 却って, "rather", which leads
    into the predicate after it."""
    out_m, out_t = [], []
    for i, m in enumerate(morphemes):
        prev = morphemes[i - 1] if i > 0 else None
        nxt = morphemes[i + 1] if i + 1 < len(morphemes) else None
        if m.surface == "ですから" and prev is not None and (prev.pos != "symbol" or prev.surface.startswith("＿")):
            out_m += [replace(m, surface="です", end=m.start + 2, lemma="です", reading="です", lemma_reading="です",
                              kana="デス", pos="auxiliary", ctype="助動詞-デス", cform="終止形-一般",
                              conjunctive=False, written="です", written_reading="です"),
                      replace(m, surface="から", start=m.start + 2, lemma="から", reading="から", lemma_reading="から",
                              kana="カラ", pos="particle", ctype="", cform="", conjunctive=True,
                              written="から", written_reading="から")]
            out_t += [("助動詞", "*", "*"), ("助詞", "接続助詞", "*")]
            continue
        if m.pos == "adjective" and m.lemma in _HODO_ADJECTIVES and m.surface.startswith(("ほど", "程")) \
                and prev is not None and prev.pos != "particle" and prev.pos != "symbol":
            # それほどとおくもありません, 前ほどちかく感じない: ほど and the
            # adjective -- 程遠い, 程近い follow a particle (完成には程遠い,
            # 駅から程近い), plan 296
            cut = 2 if m.surface.startswith("ほど") else 1
            lemma, said = _HODO_ADJECTIVES[m.lemma]
            out_m += [replace(m, surface=m.surface[:cut], end=m.start + cut, lemma="程", reading="ほど",
                              lemma_reading="ほど", kana="ホド", pos="particle", ctype="", cform="", conjunctive=False,
                              written=m.surface[:cut], written_reading="ほど"),
                      replace(m, surface=m.surface[cut:], start=m.start + cut, lemma=lemma,
                              reading=kata_to_hira(m.reading)[2:], lemma_reading=said,
                              kana=m.kana[2:], written=lemma, written_reading=said)]
            out_t += [("助詞", "副助詞", "*"), tags[i]]
            continue
        if m.surface == "別に" and m.pos == "adverb" and apart(morphemes, i):
            # お茶は、別にはらいます: 別 and に, "separately" -- 別に何も言わ
            # なかった, 別にいいよ keep the adverb, "not particularly" (plan 296)
            out_m += [replace(m, surface="別", end=m.start + 1, lemma="別", reading="べつ", lemma_reading="べつ",
                              kana="ベツ", pos="noun", ctype="", cform="", written="別", written_reading="べつ"),
                      replace(m, surface="に", start=m.start + 1, lemma="に", reading="に", lemma_reading="に",
                              kana="ニ", pos="particle", ctype="", cform="", conjunctive=False,
                              written="に", written_reading="に")]
            out_t += [("名詞", "普通名詞", "一般"), ("助詞", "格助詞", "*")]
            continue
        if m.surface == "かえって" and m.pos == "adverb" and prev is not None and prev.surface == "が" \
                and prev.pos == "particle" and nxt is not None and nxt.surface in ("、", "，"):
            out_m += [replace(m, surface="かえっ", end=m.start + 3, lemma="帰る", reading="かえっ",
                              lemma_reading="かえる", kana="カエッ", pos="verb", ctype="五段-ラ行",
                              cform="連用形-促音便", written="帰る", written_reading="かえる"),
                      replace(m, surface="て", start=m.start + 3, lemma="て", reading="て", lemma_reading="て",
                              kana="テ", pos="particle", ctype="", cform="", conjunctive=True,
                              written="て", written_reading="て")]
            out_t += [("動詞", "一般", "*"), ("助詞", "接続助詞", "*")]
            continue
        out_m.append(m)
        out_t.append(tags[i])
    return out_m, out_t


def _soko_de_aru(morphemes: list[Morpheme]) -> None:
    """そこである町は, opening a sentence, is そこで, "so", and ある, "a
    certain", before its noun (plan 296) -- never そこ and the copula
    である, "it is there", which UniDic read: a copula takes no noun
    after it."""
    for i in range(len(morphemes) - 3):
        so, de, aru, noun = morphemes[i:i + 4]
        if so.surface == "そこ" and so.pos == "pronoun" and (i == 0 or morphemes[i - 1].pos == "symbol") \
                and de.surface == "で" and de.pos == "auxiliary" and aru.surface == "ある" and aru.pos == "verb" \
                and noun.pos == "noun":
            de.pos, de.lemma, de.lemma_reading, de.ctype, de.cform = "particle", "で", "で", "", ""
            aru.pos, aru.lemma, aru.lemma_reading, aru.ctype, aru.cform = "adnominal", "或る", "ある", "", ""
            aru.auxiliary_use = False
            aru.written, aru.written_reading = aru.lemma, aru.lemma_reading


def _radical_hen(morphemes: list[Morpheme]) -> None:
    """A へん glued to a noun is a kanji's left-hand radical, 偏 (plan
    296): いしへん, くちへん, ふねへん -- the west's negative へん, which
    UniDic reads after some, follows a verb (行かへん), and the area, 辺,
    which it reads after others, a demonstrative (このへん, ここらへん)."""
    for i, m in enumerate(morphemes):
        if m.surface == "へん" and (m.pos == "auxiliary" or (m.pos == "noun" and m.lemma == "辺")) and i > 0 \
                and morphemes[i - 1].pos == "noun" and morphemes[i - 1].end == m.start:
            m.pos, m.lemma, m.lemma_reading = "noun", "偏", "へん"
            m.ctype, m.cform, m.auxiliary_use, m.conjunctive = "", "", False, False
            m.written, m.written_reading = m.lemma, m.lemma_reading


def _times_or_floor(morphemes: list[Morpheme], tags: list[tuple]) -> tuple[list, list]:
    """かい written in kana after a number is 回, "times", which UniDic
    files under 階, "floor" (plan 296): 三かいしましたが, 二かいかぞえます,
    会が二かいになって, 一日三かい, 一かい三百円. It is the floor only where
    something is or is done on it -- ビルの三かい, 一かいの入り口, 二かいで
    待つ, おてあらいは二かいです, 二かいには…へやがあります, 三かいに行く,
    五かいから. And 何 + か + い before a deed or a noun is 何かい, 何回
    (何かい書いても, 何かいれんしゅうしても), never 何か + いい."""
    out_m, out_t, skip = [], [], 0
    for i, m in enumerate(morphemes):
        if skip:
            skip -= 1
            continue
        nxt = morphemes[i + 1] if i + 1 < len(morphemes) else None
        after = morphemes[i + 2] if i + 2 < len(morphemes) else None
        if (m.surface == "何" and nxt is not None and nxt.surface == "か" and nxt.pos == "particle"
                and after is not None and after.surface == "い" and _glued(m, nxt) and _glued(nxt, after)
                and i + 3 < len(morphemes) and morphemes[i + 3].pos in ("verb", "noun")):
            out_m += [m, replace(nxt, surface="かい", end=after.end, lemma="回", reading="かい", lemma_reading="かい",
                                 kana="カイ", pos="suffix", ctype="", cform="", conjunctive=False, counter=True,
                                 written="回", written_reading="かい")]
            out_t += [tags[i], ("接尾辞", "名詞的", "助数詞")]
            skip = 2
            continue
        if (m.surface == "十分" and nxt is not None and nxt.surface == "の" and after is not None
                and all(c in "一二三四五六七八九十百千0123456789０１２３４５６７８９" for c in after.surface)):
            # 十分の一, a tenth: 十 and the 分 of a share, never 十分, "enough"
            # -- a number of parts, の, and how many (plan 296)
            out_m += [replace(m, surface="十", end=m.start + 1, lemma="十", reading="じゅう", lemma_reading="じゅう",
                              kana="ジュウ", pos="noun", ctype="", cform="", adjectival=False),
                      replace(m, surface="分", start=m.start + 1, lemma="分", reading="ぶん", lemma_reading="ぶん",
                              kana="ブン", pos="suffix", ctype="", cform="", adjectival=False, counter=True)]
            out_t += [("名詞", "数詞", "*"), ("接尾辞", "名詞的", "助数詞")]
            continue
        if (m.surface == "駅前" and i > 0 and _glued(morphemes[i - 1], m)
                and all(c in "一二三四五六七八九十何0123456789０１２３４５６７８９" for c in morphemes[i - 1].surface)):
            # 一駅前で降りる: one station before, 一駅 and 前 -- no 駅前, the
            # station square, after a number (plan 296)
            out_m += [replace(m, surface="駅", end=m.start + 1, lemma="駅", reading="えき", lemma_reading="えき",
                              kana="エキ", pos="suffix", counter=True),
                      replace(m, surface="前", start=m.start + 1, lemma="前", reading="まえ", lemma_reading="まえ",
                              kana="マエ", pos="noun", counter=False)]
            out_t += [("接尾辞", "名詞的", "助数詞"), ("名詞", "普通名詞", "副詞可能")]
            continue
        if (m.surface == "かい" and m.lemma == "階" and i > 0 and _glued(morphemes[i - 1], m)
                and (morphemes[i - 1].surface == "何" or all(c in "一二三四五六七八九十百何0123456789０１２３４５６７８９"
                                                             for c in morphemes[i - 1].surface))):
            # (where something is or is done: ビルの三かい, 一かいの入り口,
            # 二かいで待つ, 五かいです, 二かいには…へやがあります, 三かいに行く)
            building = i >= 3 and morphemes[i - 2].surface == "の" and morphemes[i - 3].pos == "noun"
            rest = [u.lemma for u in morphemes[i + 1:i + 8]]
            floor = building or (nxt is not None and (
                nxt.surface in ("から", "まで", "の", "で")
                or (nxt.pos == "auxiliary" and nxt.lemma in ("だ", "です"))
                or (nxt.surface in ("に", "へ") and after is not None
                    and (after.lemma in _TO_A_FLOOR or (after.surface == "は" and any(r in ("有る", "ある", "居る", "いる")
                                                                                      for r in rest))))))
            if not floor:
                m = replace(m, lemma="回", lemma_reading="かい", written="回", written_reading="かい")
        out_m.append(m)
        out_t.append(tags[i])
    return out_m, out_t


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
                      "電流", "空気", "鼻", "筋", "線路", "トラック", "人", "車両",
                      # (鉄道が通っていない: a line runs there, plan 296)
                      "鉄道", "道路", "地下鉄", "新幹線", "路線", "水道", "国道"})


# What gets through, its が said anywhere in 通っ's clause (plan 296): an
# order, a request or a plan reaches where it goes, or is accepted
# (ご注文がキッチンに通っていなかった, 意見が会議で通った) -- never a person,
# who commutes (人が毎日学校に通っている).
_GETS_THROUGH = frozenset({"注文", "要求", "要望", "希望", "願い", "提案", "企画", "予約", "申請", "申し込み", "意見",
                           "法案", "意味", "理屈", "主張", "予算", "案", "計画"})


# What is passed, an exam (試験に通った, plan 296).
_EXAMS = ("試験", "テスト", "面接", "審査", "選考", "予選", "オーディション", "検定")
# What one passes over or through, said of by 通った (さっき車で通った橋, plan
# 296) -- never a school or a shop, which one attends (通っていた小学校).
_PASSAGES = frozenset({"橋", "道", "道路", "トンネル", "門", "改札", "交差点", "廊下", "踏切", "路地", "通路", "峠"})


def _gets_through(morphemes, i: int) -> bool:
    """Whether 通っ's own clause sets a thing that gets through
    (_GETS_THROUGH) as its subject or topic: 注文が, 注文は, ご注文、."""
    for k in range(i - 1, 0, -1):
        u = morphemes[k]
        if u.pos in ("verb", "adjective", "auxiliary") or (u.pos == "symbol" and u.surface in "。！？!?「」"):
            return False
        if ((u.pos == "particle" and u.surface in ("が", "は", "も")) or (u.pos == "symbol" and u.surface in "、，,")) \
                and morphemes[k - 1].surface in _GETS_THROUGH:
            return True
    return False


# What marks a sentence as said in the west, where や after a noun is
# the copula (plan 296): 泣き虫やったんやで, 休みやったら…行かへん.
_KANSAI_SURFACES = frozenset({"ほんま", "ほんまに", "ホンマ", "めっちゃ", "あかん", "ちゃう", "ちゃうちゃう", "おおきに",
                              "ええ", "なんぼ", "せや", "そや", "かまへん", "あかへん", "やん", "ねん", "へん", "ひん",
                              "やろ", "やで", "やねん", "わい", "うち"})


def _said_in_the_west(morphemes, skip: int) -> bool:
    """Whether a sentence speaks the west's Japanese: a word only it says
    (ほんま, へん, ねん), or its copula や elsewhere (んやで)."""
    for k, u in enumerate(morphemes):
        if k == skip:
            continue
        if u.surface in _KANSAI_SURFACES and u.surface not in ("ええ", "うち"):
            return True
        if u.surface == "ええ" and u.pos == "adjective":
            return True                 # (ええのに, ええ天気: 良い said ええ, never the "yes")
        if u.pos == "auxiliary" and u.lemma in ("や", "へん", "ひん") and k != skip + 1:
            return True
    return False


# Where one drops in on the way, 寄る, never what one goes by (plan 296):
# 本屋によると, としょかんによって -- 天気予報によると, 国によって.
_STOPS = frozenset({"本屋", "ほんや", "店", "みせ", "お店", "おみせ", "図書館", "としょかん", "銀行", "ぎんこう",
                    "郵便局", "ゆうびんきょく", "コンビニ", "スーパー", "喫茶店", "きっさてん", "カフェ", "病院",
                    "びょういん", "薬局", "やっきょく", "デパート", "公園", "こうえん", "交番", "こうばん", "実家",
                    "じっか", "友達の家", "パン屋", "ぱんや", "花屋", "はなや", "八百屋", "やおや", "本屋さん",
                    "美術館", "びじゅつかん", "博物館", "はくぶつかん", "神社", "じんじゃ", "お寺", "おてら",
                    "寺", "てら", "ホテル", "旅館", "りょかん", "市役所", "しやくしょ", "区役所", "くやくしょ",
                    "家", "いえ", "うち", "お宅", "おたく", "町", "まち", "村", "むら", "スーパー", "本屋さん",
                    "店", "コンビニ", "ファミレス", "ドラッグストア", "画廊", "がろう", "古本屋", "ふるほんや"})
_HEARSAY = frozenset({"そう", "らしい", "という", "とのこと", "って", "ようだ", "みたい", "とか"})
_DIFFERS = ("違", "ちが", "異な", "変わ", "かわ", "様々", "さまざま", "まちまち", "差", "決ま", "きま")


def _spells(morphemes, i: int, word: str) -> int:
    """How many glued morphemes from morphemes[i] spell exactly `word`,
    or 0."""
    text, n = "", 0
    while i + n < len(morphemes) and len(text) < len(word):
        if n and not _glued(morphemes[i + n - 1], morphemes[i + n]):
            return 0
        text += morphemes[i + n].surface
        n += 1
    return n if text == word else 0


def _drops_in(morphemes, i: int) -> bool:
    """Whether the よる at morphemes[i], after に (or には, にも) and a
    place one stops at, is 寄る, "drop in": its と finds something
    (本屋によると、画集が並んでいた) where no word of hearsay closes the
    sentence, its て goes on to a deed where nothing differs or is done
    by it (としょかんによってほんをかりた, never 銀行によって手数料が違う),
    its past, its polite stem, its negative and its will are visits
    (家によりました, よらないで, 神社によろうか), and it ends what is said
    or meets a こと (町によることにした) -- never before a noun it says
    the cause of (町による違い)."""
    k = i - 1
    if k >= 1 and morphemes[k].surface in ("は", "も") and morphemes[k].pos == "particle":
        k -= 1
    if k < 1 or morphemes[k].surface != "に" or morphemes[k].pos != "particle":
        return False
    place = morphemes[k - 1]
    if not (place.surface in _STOPS or (place.pos in ("noun", "suffix")
                                         and place.surface.endswith(("屋", "屋さん", "店")))):
        return False
    m = morphemes[i]
    nxt = morphemes[i + 1] if i + 1 < len(morphemes) else None
    rest = morphemes[i + 1:]
    differs = any(u.surface.startswith(_DIFFERS) or (u.pos == "auxiliary" and u.lemma in ("れる", "られる"))
                  for u in rest)
    if m.surface == "よろう" or m.cform.startswith("意志推量形"):
        return True                     # (神社によろうか)
    if nxt is None or nxt.pos == "symbol" or nxt.surface in ("か", "よ", "ね", "の", "ん"):
        return m.surface == "よる"        # (帰りに本屋による。)
    if nxt.pos == "auxiliary" and nxt.lemma in ("た", "ます", "たい"):
        return True                     # (帰りに本屋によった, 家によりました)
    if nxt.surface == "と":
        return not any(u.surface in _HEARSAY or (u.lemma == "そう" and u.pos != "adverb") for u in rest)
    if nxt.surface == "て":
        return not differs
    if nxt.pos == "auxiliary" and nxt.lemma in ("ない", "ず") and m.surface == "よら":
        return nxt.lemma == "ない" and not differs     # (コンビニにはよらないで; 店によらず is "regardless")
    if m.surface == "よる" and nxt.surface in ("こと", "事", "つもり", "予定", "ところ"):
        return True                     # (町によることにした)
    return False


# What is done whole, before やった with no を (plan 296): 全部やった.
_DONE_WHOLE = frozenset({"全部", "全て", "すべて", "何もかも", "宿題", "仕事", "一通り", "いろいろ", "色々", "ゲーム",
                         "スポーツ", "テニス", "サッカー", "野球"})


# What follows 泣き in its compounds (plan 296): 泣き出す, 泣き続ける.
_AFTER_A_CRY = frozenset({"出す", "続ける", "止む", "やむ", "叫ぶ", "崩れる", "じゃくる", "始める", "疲れる", "わめく",
                          "明かす", "暮らす", "つく", "付く", "寝入る", "濡れる"})


# What a の before 或る names: an age, a time, a place (plan 296) -- never
# a thing one may have, 学校のある日 being a day with school.
_FRAME_ENDINGS = ("代", "歳", "才", "年", "時代", "世紀", "土地", "町", "村", "国", "市", "県", "地方", "日", "月", "夜",
                  "朝", "春", "夏", "秋", "冬", "頃", "都内", "県内", "市内", "国内", "町内", "社内", "地域", "都市")


def _a_frame(m) -> bool:
    return m.pos in ("noun", "suffix") and m.surface.endswith(_FRAME_ENDINGS) and not m.verbal


def _sent_somewhere(morphemes, i: int) -> bool:
    """Whether 放っ's own clause names where it sends something, a noun
    and に: 敵の城に間者を放っておいた."""
    for k in range(i - 1, 0, -1):
        u = morphemes[k]
        if u.pos in ("verb", "adjective", "auxiliary") or (u.pos == "symbol" and u.surface in "、。！？!?「」"):
            return False
        if u.pos == "particle" and u.surface == "に" and morphemes[k - 1].pos in ("noun", "pronoun"):
            return True
    return False


def apart(morphemes, i: int) -> bool:
    """Whether 別に, ending at morphemes[i], is 別 and に, "separately": no
    comma after it, the first predicate after it a verb (払う, 用意する), and
    nothing denied to its sentence's end -- 別に何も言わなかった and
    別にいい, 別に、 are the adverb, "not particularly"."""
    at = i if morphemes[i].surface == "別に" else i - 1
    before = morphemes[at - 1] if at >= 1 else None
    if before is not None and before.pos == "particle" and (
            before.surface == "と" or (before.surface == "は" and at >= 2 and morphemes[at - 2].surface == "と")):
        return True                         # (それとは別に、, 財布と別に: "apart from", plan 296)
    if i + 1 >= len(morphemes) or morphemes[i + 1].pos == "symbol":
        return False
    first = None
    for u in morphemes[i + 1:]:
        if u.pos == "symbol" and u.surface in "。！？!?":
            break
        if first is None and u.pos in ("verb", "adjective", "auxiliary"):
            first = u
        if (u.lemma in ("無い", "ない") and u.pos in ("adjective", "auxiliary")) or u.lemma in ("ぬ", "ず") \
                or (u.lemma == "ます" and u.surface == "ませ"):
            return False
    return first is not None and first.pos == "verb"


def _hiragana_only(text: str) -> bool:
    return bool(text) and all("\u3041" <= c <= "\u309f" for c in text)


@lru_cache(maxsize=1024)
def _row_of(kanji: str, kana: str) -> bool:
    """Whether the dictionary holds a word written `kanji` read `kana`."""
    import content.vocab_jmdict_data as jmdict_db

    return jmdict_db.get_by_key(kanji, kana) is not None


def _adjective_cut_short(morphemes, i: int):
    """(morphemes, lemma, lemma reading) where morphemes[i:] spell an い-
    adjective's stem and っ, crying out on its own (やばっ, いたっ, うまっ,
    あつっ), the adjective the deck or the dictionary holds, or None;
    None too where UniDic read it so already (すごっ)."""
    m = morphemes[i]
    if m.pos == "adjective" and m.cform.startswith("語幹"):
        return None
    if i > 0 and not (morphemes[i - 1].pos in ("symbol", "particle")):
        return None
    for n in (1, 2):
        run = morphemes[i:i + n]
        if len(run) < n or any(a.end != b.start for a, b in zip(run, run[1:])):
            break
        joined = "".join(u.surface for u in run)
        after = morphemes[i + n] if i + n < len(morphemes) else None
        if not (3 <= len(joined) <= 5 and joined.endswith("っ") and _hiragana_only(joined[:-1])
                and (after is None or after.pos == "symbol")):
            continue
        found = _adjective_of_stem(joined[:-1])
        if found is not None:
            return (n, *found)
    return None


@lru_cache(maxsize=1024)
def _adjective_of_stem(stem: str):
    """(lemma, reading) of the い-adjective `stem` + い: the deck's one
    spelling of it (痛い), its kana where it has several (あつい: 熱い,
    厚い, 暑い), or the dictionary's (やばい), or None."""
    import content.vocab_jmdict_data as jmdict_db

    said = stem + "い"
    spellings = [sp for sp in _deck_kana().get(said, ()) if sp.endswith("い")]
    if spellings:
        return (spellings[0] if len(spellings) == 1 else said), said
    for row in jmdict_db.by_kana(said) or []:
        senses = (jmdict_db.get_senses(row.get("kanji", ""), said) or []) if row.get("kana") == said else []
        if senses and "adj-i" in (senses[0].get("tags") or ()):
            return said, said
    return None


@lru_cache(maxsize=2048)
def _a_noun_spelled(written: str, said: str) -> bool:
    """Whether the deck or the dictionary holds `written`, read `said`,
    as a noun (勝ち, 休み, 低め, 立ち合い)."""
    import content.vocab_jmdict_data as jmdict_db

    if (written, said) in _deck_forms() and not written.endswith(("る", "う", "く", "す", "つ", "ぬ", "ぶ", "む", "ぐ")):
        return True
    senses = jmdict_db.get_senses(written, said) if jmdict_db.get_by_key(written, said) else None
    return bool(senses) and "n" in (senses[0].get("tags") or ())


# What opens and shuts, whose が makes あかん 開く's negative: ドアがあかん,
# "the door won't open" (plan 272).
_OPENS_AND_SHUTS = frozenset({"ドア", "戸", "扉", "窓", "まど", "ふた", "蓋", "箱", "鍵", "かぎ", "缶", "瓶", "門", "口",
                              "目", "店", "引き出し", "金庫", "ロッカー", "トランク", "カーテン"})


# What one asks of a word, after which an opening なんて is 何と (plan 272).
_ASKED_OF_A_WORD = frozenset({"言う", "読む", "書く", "呼ぶ", "聞こえる", "聞く", "答える", "訳す", "名乗る", "伝える",
                              "呼べる", "読める", "書ける", "言える"})


def _akan_at(morphemes, i: int):
    """"あかん" where morphemes[i] and the next spell it (あ + かん, あか +
    ん), "じゃ" where じゃあ + かん spell じゃ + あかん, else ""."""
    m = morphemes[i]
    nxt = morphemes[i + 1] if i + 1 < len(morphemes) else None
    if nxt is None or nxt.start != m.end:
        return ""
    after = morphemes[i + 2] if i + 2 < len(morphemes) else None
    if after is not None and after.pos in ("noun", "verb") and after.start == nxt.end:
        return ""                       # (あかんぼう and the like, a word going on)
    prev = morphemes[i - 1] if i > 0 else None
    if prev is not None and prev.surface == "が" and i >= 2 and morphemes[i - 2].surface in _OPENS_AND_SHUTS:
        return ""                       # ドアがあかん: it won't open
    if (m.surface, nxt.surface) == ("あ", "かん") or (
            m.surface == "あか" and nxt.surface == "ん" and m.lemma in ("明く", "開く", "あく")):
        return "あかん"
    if (m.surface, nxt.surface) == ("じゃあ", "かん"):
        return "じゃ"
    return ""


# A godan verb's last kana and its お-row, which its volitional ends on.
_O_ROW = {"う": "お", "く": "こ", "ぐ": "ご", "す": "そ", "つ": "と", "ぬ": "の", "ぶ": "ぼ", "む": "も", "る": "ろ"}


@lru_cache(maxsize=1024)
def _volitional_of_a_deck_verb(kana: str):
    """(lemma, ctype) of a deck verb whose volitional `kana` spells --
    ひこう is 弾く's or 引く's -- read by the tagger off the card's own
    spelling, or None (plan 272)."""
    if len(kana) < 3 or not kana.endswith("う"):
        return None
    for dictionary, ending in [(kana[:-2] + u, kana[-2:]) for u, o in _O_ROW.items() if kana[-2] == o] + (
            [(kana[:-2] + "る", "よう")] if kana.endswith("よう") else []):
        for written, reading in sorted(_deck_forms()):
            if reading != dictionary or not written or written[-1:] != dictionary[-1:]:
                continue
            tagged, _ = _tag(written[:-1] + ending if ending != "よう" else written[:-1] + "よう", 0, _plain_tagger)
            if len(tagged) == 1 and tagged[0].pos == "verb" and tagged[0].cform.startswith("意志推量形"):
                return tagged[0].lemma, tagged[0].ctype
    return None


@lru_cache(maxsize=1024)
def _adverb_in_ya(written: str, said: str):
    """The dictionary's (kanji, kana) of an adverb ending in や -- もしや,
    今や -- that MeCab cut as a word and the particle (もし + や), or None
    (plan 272)."""
    import content.vocab_jmdict_data as jmdict_db

    for row in jmdict_db.by_kana(said) or []:
        if written not in (row.get("kanji"), row.get("kana")):
            continue
        senses = jmdict_db.get_senses(row.get("kanji") or row.get("kana"), row.get("kana")) or []
        if senses and "adv" in (senses[0].get("tags") or ()):
            return row.get("kanji") or row.get("kana"), row.get("kana")
    return None


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
                     # (たんぽぽ薬局, すずらん美容院, plan 272)
                     "薬局", "美容院", "美容室", "理容室", "医院", "歯科", "クリニック", "整骨院", "接骨院",
                     # (みどり商事, サクラ航空: a firm's, plan 272)
                     "商事", "航空", "商会", "物産", "企画", "出版", "製菓", "電機"})
_HOUSES_NAMED = _HOUSES | {"店", "お店", "会社", "レストラン", "喫茶店", "カフェ", "バー", "宿", "民宿", "美容院"}


def named_alone(morphemes, i: int) -> bool:
    """Whether morphemes[i], a word in hiragana, is a given name UniDic
    reads alone, opening what is said of the one it names (plan 272):
    あおいが今日来れないって, where the deck's あおい is the adjective 青い.
    Or a name a letter is signed with, alone before より (plan 296):
    アナより."""
    m = morphemes[i]
    words = [u for u in morphemes if u.pos != "symbol"]
    if m.proper and m.name_kind in ("given", "family", "person") and len(words) == 2 and words[0] is m \
            and words[1].surface == "より":
        return True
    prev = morphemes[i - 1] if i > 0 else None
    nxt = morphemes[i + 1] if i + 1 < len(morphemes) else None
    opens = prev is None or prev.surface in ("、", "。", "「", "！", "？") or prev.pos == "adverb" or (
        # (実はあおいが入院した: a sentence's own adverb before, plan 272)
        prev.surface == "は" and i >= 2 and morphemes[i - 2].surface == "実") or (
        # (ゆうたとけんたは友だちです: a name joined to a name read as one,
        # never the pool's けんた, "KFC", plan 296)
        prev.surface in ("と", "や") and prev.pos == "particle" and i >= 2 and morphemes[i - 2].proper
        and morphemes[i - 2].name_kind == "given" and _hiragana_only(morphemes[i - 2].surface)
        and named_alone(morphemes, i - 2))
    if not (m.pos == "noun" and _hiragana_only(m.surface) and 3 <= len(m.surface) <= 4 and opens
            and nxt is not None and nxt.pos == "particle" and not nxt.conjunctive and nxt.surface in ("が", "は", "も", "と")
            and _a_name_alone(m.surface)):
        return False
    # (みのりが少ない, かおりが強い: 実り and 香り, common nouns -- unless
    # what follows is what only a person does: かおりは来ないの？, plan 272)
    return not _a_common_noun_in_kana(m.surface) or any(
        u.pos == "verb" and u.lemma in _A_PERSON_DOES for u in morphemes[i + 2:i + 8])


# What only a person does, which tells a name from a noun read alike
# (named_alone, plan 272).
_A_PERSON_DOES = frozenset({"来る", "行く", "言う", "話す", "笑う", "泣く", "帰る", "怒る", "喜ぶ", "歌う", "寝る",
                            "起きる", "食べる", "飲む", "遊ぶ", "働く", "勉強", "結婚", "入院", "書く", "読む",
                            "思う", "知る", "待つ", "会う", "住む", "走る", "休む", "見る"})


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
    if not (i + 1 < len(morphemes) and morphemes[i + 1].surface in _FIRMS and morphemes[i + 1].start == morphemes[i].end):
        return False
    # (まんが出版 is 漫画's publishing and てづくり企画 a handmade project:
    # a common noun compounds with 出版 and 企画, plan 272)
    return not (morphemes[i + 1].surface in ("出版", "企画") and _hiragana_only(morphemes[i].surface)
                and _a_common_noun_in_kana(morphemes[i].surface))


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
        # (幼稚 + 園; never まんが出版, てづくり企画: _a_firm_after)
        return nxt.surface not in _FIRMS or _a_firm_after(morphemes, i)
    if nxt.surface == "と" and i + 3 < len(morphemes) and morphemes[i + 2].lemma in ("言う", "いう") \
            and morphemes[i + 3].surface in _HOUSES_NAMED:
        return True
    # (はい、さくらでございます: a firm answering the phone -- where a call
    # is said, or the word is no common noun; はい、ほんものでございます is
    # 本物, "genuine", plan 272)
    on_the_phone = any(u.surface in ("もしもし", "電話", "お電話") for u in morphemes)
    return (nxt.surface == "で" and i + 2 < len(morphemes) and morphemes[i + 2].surface == "ござい"
            and (i == 0 or morphemes[i - 1].surface in ("、", "。", "はい")) and (
                i < 2 or morphemes[i - 2].surface in ("はい", "、", "。", "ます", "ありがとう"))
            and (on_the_phone or not _a_common_noun_in_kana(morphemes[i].surface)))


@lru_cache(maxsize=2048)
def _a_common_noun_in_kana(kana: str) -> bool:
    """Whether `kana` is the reading of a common noun the deck or the
    dictionary writes with a kanji -- 本物, 香り, 実り, 漫画 -- so a name
    spelled with it needs more than its letters (plan 272). An adjective
    or a verb (青い, 光る) is no such noun: no が or は follows one."""
    import content.vocab_jmdict_data as jmdict_db

    if any(_has_kanji_char(sp) and sp[-1:] not in "いうくぐすつぬぶむる" for sp in _deck_kana().get(kana, ())):
        return True
    for row in jmdict_db.by_kana(kana) or []:
        if row.get("kana") != kana or not row.get("kanji"):
            continue
        senses = jmdict_db.get_senses(row["kanji"], kana) or []
        if senses and "n" in (senses[0].get("tags") or ()) and "⭐" in (senses[0].get("term_tags") or ()):
            return True
    return False


@lru_cache(maxsize=1024)
def _deck_spelled_half_in_kana(head: str, tail: str):
    """(kanji, kana) of the one two-kanji deck word whose first kanji is
    `head` and whose reading ends with `tail`, the second kanji written
    in kana as a learner's text does (野さい, plan 272), or None."""
    found = {(k, r) for k, r in _deck_forms() if len(k) == 2 and k[0] == head and _has_kanji_char(k[1])
             for r in [r] if r.endswith(tail) and len(r) > len(tail)}
    return next(iter(found)) if len(found) == 1 else None


# What opens out rather than open (開く ひらく with no object): a flower,
# a bud, an umbrella, a gap (plan 296).
_OPENS_OUT = frozenset({"花", "はな", "つぼみ", "蕾", "傘", "かさ", "差", "心", "扇", "翼", "羽"})


def _opens_of_itself(morphemes: list[Morpheme], tags: list[tuple]) -> None:
    """開く read あく, "to open (by itself)", where the sentence says so
    (plan 296): UniDic reads every 開く ひらく, the deck's "to open (a book,
    a shop), to hold (an event)", and ドアが開いた, 店は九時まで開いています,
    銀行は何時に開きますか were taught as opening something. With no object
    in its own clause and no passive, it is あく where it stands open
    (開いている, 何時まで開いていますか), beside 閉まる (the deck's pair: あく
    and しまる, ひらく and とじる), or where its own clause names a thing that
    opens and shuts (ドアが, 窓が, 店が). A bank at its hour is either
    (銀行は何時に開きますか: the dictation bank reads ひらきます) and is left
    as UniDic reads it. ひらく keeps an object (店を開く),
    the passive of an event (大会が開かれる), an event (フリーマーケットは日曜日
    に開きます: held), what opens out (花が開く, 傘が開く), a shop that opened
    on a date (先月開いたばかり: founded) and anything that says none of it
    (日曜日に開きます)."""
    for i, m in enumerate(morphemes):
        if not (m.pos == "verb" and m.lemma == "開く" and kata_to_hira(m.reading).startswith("ひら")):
            continue
        nxt = morphemes[i + 1] if i + 1 < len(morphemes) else None
        if nxt is not None and nxt.lemma in ("れる", "られる", "せる", "させる"):
            continue
        if nxt is not None and nxt.surface in ("に", "のに") and i + 2 < len(morphemes) \
                and morphemes[i + 2].surface.startswith(("際", "当た", "あた")):
            continue                    # (店を開くに際して: the act of opening one)
        own = []
        for k in range(i - 1, -1, -1):
            u = morphemes[k]
            if u.pos in ("verb", "adjective", "auxiliary") or (u.pos == "symbol" and u.surface in "。！？!?、"):
                break
            own.append(u)
        if any(u.surface == "を" and u.pos == "particle" for u in own):
            continue
        subjects = [own[q + 1] for q, u in enumerate(own) if u.surface in ("が", "は", "も") and u.pos == "particle"
                    and q + 1 < len(own) and own[q + 1].pos in ("noun", "pronoun")]
        if not subjects:
            # (ジャムの瓶のふたが固くて、どうしても開かない: the clause before
            # names what it says of, plan 296)
            head = _sentence_head(morphemes, i)
            subjects = [morphemes[k - 1] for k in range(head + 1, i) if morphemes[k].pos == "particle"
                        and morphemes[k].surface in ("が", "は", "も") and morphemes[k - 1].surface in _SHUTS]
        if any(u.lemma in _OPENS_OUT or u.surface.endswith(_EVENTS) for u in subjects):
            continue
        if m.cform.startswith("連用") and nxt is not None and nxt.surface in ("た", "だ") \
                and any(u.lemma in _PAST_DATES for u in own):
            continue                    # (この店は先月開いたばかり: founded)
        standing = (nxt is not None and nxt.surface in ("て", "で") and i + 2 < len(morphemes)
                    and morphemes[i + 2].lemma in ("居る", "いる", "おる", "る")) \
            or (nxt is not None and nxt.pos == "auxiliary" and nxt.lemma in ("てる", "でる"))  # (開いてる, plan 296)
        closes = any(u.surface.startswith(("閉ま", "しま")) and u.pos == "verb" and u.lemma in ("閉まる", "締まる")
                     for u in morphemes)
        # (店が開くか開かないか: the sentence's own reading of the first; and
        # まどを開けようとしたが、開かなかった: 開ける's own, plan 296)
        again = any((u.lemma == "開く" and u.lemma_reading == "あく") or (u.lemma == "開ける" and u.pos == "verb")
                    for u in morphemes[_sentence_head(morphemes, i):i])
        shuts = any(u.surface in _SHUTS for u in subjects)
        # (開いた口がふさがらない, 開いた窓: what stands open, said of it,
        # plan 296 -- never 店, 先月開いた店 is founded)
        held = m.cform.startswith("連用") and nxt is not None and nxt.surface == "た" and i + 2 < len(morphemes) \
            and morphemes[i + 2].surface in _SHUTS - {"店", "窓口"}
        if not (standing or closes or again or shuts or held):
            continue
        said = kata_to_hira(m.reading)
        m.reading = "あ" + said[2:]
        m.lemma_reading = "あく"
        m.kana = "ア" + m.kana[2:] if m.kana.startswith("ヒラ") else m.kana


def _sentence_head(morphemes, i: int) -> int:
    """Where the sentence of morphemes[i] begins."""
    return next((k + 1 for k in range(i - 1, -1, -1)
                 if morphemes[k].pos == "symbol" and morphemes[k].surface in "。！？!?"), 0)


# What opens and shuts of itself, whose 開く is あく (plan 296) -- never a
# bank or an office at its hour, 銀行は何時に開きますか, which the dictation
# bank reads ひらきます and either is.
_SHUTS = _OPENS_AND_SHUTS | {"シャッター", "改札", "窓口", "ゲート", "障子", "ふすま"}
# An event, which is held (ひらく), never opens by itself (plan 296): 会
# ends 大会, 説明会, 食事会.
_EVENTS = ("会", "パーティー", "祭り", "まつり", "マーケット", "市", "市場", "教室", "式", "コンサート", "試合")
# The dates a shop opened on, once: 開いた after them is its founding.
_PAST_DATES = frozenset({"先月", "先週", "去年", "昨年", "先日", "先年", "昨日"})


# What follows a verb's stem in the forms a potential takes (plan 296):
# the polite and negative endings and そう -- never a て, a たい, a past
# (入れた says either), a volitional or a request.
_CAN_ENDINGS = frozenset({"ます", "ない", "ん", "ず", "ぬ", "そう"})
# What a potential never stands before: the forbidden (〜ないで), the
# needless (〜なくてもいい) and the deliberate (〜ようにする).
_NOT_A_POTENTIAL = re.compile(r"^(ないで|なくて|(ない|ます|ません)?ように?(し|す))")


# The nouns UniDic files as adverbial (副詞可能) that say where, not when:
# 中に入れる and パンの間に入れる are places a thing goes into.
_RELATIONAL_PLACES = frozenset({"中", "上", "下", "前", "後", "後ろ", "外", "内", "間", "先", "横", "奥", "隣", "側",
                                "辺", "周り", "近く", "所", "うち", "裏", "表", "底"})
# The counters of time among the nouns UniDic files as countable (助数詞可能,
# where 袋 and 箱 are too): 週に三日, 閉店までの時間に.
_TIME_UNITS = frozenset({"週", "時間", "日", "月", "年", "分", "秒", "時", "日間", "週間", "年間", "月間"})


def _a_time_word(m: Morpheme, tag: tuple) -> bool:
    """A noun that says when or how often: 日曜日, 午後, 今, 週."""
    third = (tag or ("", "", ""))[2] if len(tag or ()) > 2 else ""
    return m.pos == "noun" and ((third == "副詞可能" and m.lemma not in _RELATIONAL_PLACES)
                                or (third == "助数詞可能" and m.lemma in _TIME_UNITS))


# The pronouns that point at a place or a thing, never at who: ここに
# 入れる is where a thing goes.
_PLACE_AND_THING_PRONOUNS = frozenset({"此処", "其処", "彼処", "何処", "此れ", "其れ", "彼れ", "何れ", "何", "此方",
                                       "其方", "彼方"})


def _a_person(m: Morpheme) -> bool:
    """A word that names who: a pronoun of a person (私, 誰, どなた), 人
    (or a count of people, 四人), a name's さん."""
    return (m.pos == "pronoun" and m.lemma not in _PLACE_AND_THING_PRONOUNS
            and m.surface not in ("どちら", "どっち", "こちら", "そちら", "あちら")) \
        or m.lemma in ("人", "方", "皆", "誰", "さん", "様", "くん", "ちゃん") \
        or (m.pos in ("noun", "suffix") and m.surface.endswith("人") and len(m.surface) <= 3)


def _enters(morphemes, i: int, tags=None) -> bool:
    """Whether 入れ at morphemes[i] is 入る's はいれる, "can enter": nothing
    is put in (no を in its clause), and someone or somewhere is (誰でも,
    中には, 一日から) -- この店は誰でも入れます (plan 272).

    Plan 296 holds it to what any sentence says: the を that rules it out
    is its own clause's (きっぷを持っている人しか入れない: the ticket is held,
    no one puts it in), it stands in a form a potential takes (no 入れて
    ください, 入れすぎ, 入れたい, 入れないようにする, 入れなくてもいい), and its
    phrase may say who or when by a time, a count or a person (日曜日なら
    入れる, 週に三日, 人しか, 四人では) or what one cannot without (きっぷが
    ないと, 待たずに). A thing said as the topic is what is put in (ねぎは
    入れますか), and a place, but for には before it, is where (袋に入れる)."""
    tags = tags if tags is not None else [("", "", "")] * len(morphemes)
    m, nxt = morphemes[i], (morphemes[i + 1] if i + 1 < len(morphemes) else None)
    if _NOT_A_POTENTIAL.match("".join(u.surface for u in morphemes[i + 1:i + 6])):
        return False
    if m.cform.startswith(("終止形", "連体形")):
        if nxt is not None and (nxt.pos == "verb" or nxt.lemma in ("過ぎる", "すぎる") or (
                # (入れる方がいい compares putting in; 時間に入れる方を探して
                # is who can come in, plan 296)
                nxt.lemma == "方" and i + 2 < len(morphemes) and morphemes[i + 2].surface == "が")):
            return False
    elif m.cform.startswith(("未然形", "連用形")):
        if nxt is None or nxt.lemma not in _CAN_ENDINGS or nxt.cform.startswith(("意志", "命令")):
            return False
    elif m.cform:
        return False
    k = i - 1
    clause = []
    while k >= 0 and not (morphemes[k].pos == "symbol" and morphemes[k].surface in "。！？!?、"):
        clause.append(morphemes[k])
        k -= 1
    phrase_at = k + 1
    if k >= 1 and morphemes[k].surface == "、" and morphemes[k - 1].surface == "を" and morphemes[k - 1].pos == "particle":
        return False                    # (言葉を、…一つは入れること: what is put in, past its comma, plan 296)
    # Its own clause: back to the verb, adjective or ending before it.
    own = []
    for u in clause:
        if u.pos in ("verb", "adjective", "auxiliary"):
            break
        own.append(u)
    if any(u.surface == "を" and u.pos == "particle" for u in own):
        return False
    # (お風呂に入れますか: a place one goes into, no を, plan 296)
    gone_into = any(u.surface == "に" and u.pos == "particle" and q + 1 < len(own) and own[q + 1].lemma in _ENTERED
                    and own[q + 1].lemma not in ("中", "なか", "車", "電車", "バス") for q, u in enumerate(own))
    if not gone_into and any(
            u.surface in ("に", "へ") and u.pos == "particle" and q + 1 < len(own)
            and (own[q + 1].pos == "noun" or (own[q + 1].pos == "pronoun" and not _a_person(own[q + 1])))
            # (代わりに, "instead", says where nothing goes, plan 296)
            and own[q + 1].lemma not in ("代わり", "代り", "かわり")
            and not _a_time_word(own[q + 1], tags[i - q - 2]) for q, u in enumerate(own)):
        if not (len(clause) >= 2 and clause[0].surface == "は" and clause[1].surface == "に"):
            return False                # (コーヒーに砂糖、誰が入れたの？: what it goes in, plan 272)
    # (a thing said as the topic is what goes in, 砂糖は毎日入れます -- where
    # no one is said to enter: この店は誰でも入れます, plan 296)
    thing_topic = any(u.surface in ("は", "も") and q + 1 < len(own) and own[q + 1].pos == "noun"
                      and not _a_time_word(own[q + 1], tags[i - q - 2]) and not _a_person(own[q + 1])
                      and not _alive_or_moving(own[q + 1]) and tags[i - q - 2][1] != "数詞"
                      for q, u in enumerate(own))
    # (誰でも, 子どもでも, 18歳未満の方は: who may enter -- never 誰が, who
    # put it in, plan 272)
    anyone = any(a.surface in ("誰", "だれ") and b.surface == "でも" or (a.surface in ("誰", "だれ") and b.surface == "で")
                 for b, a in zip(clause, clause[1:]))
    head = 2 if len(clause) >= 3 and clause[0].surface == "も" and clause[1].surface == "で" else 1
    a_person = len(clause) > head and clause[0].surface in ("でも", "は", "も") and clause[0].pos == "particle" \
        and _alive_or_moving(clause[head])            # (子ども + で + も)
    phrase = morphemes[phrase_at:i]
    who = any(_a_person(u) for u in phrase)
    without = any(phrase[q].surface in ("ない", "ず") and q + 1 < len(phrase) and phrase[q + 1].surface in ("と", "に")
                  for q in range(len(phrase)))
    when = any(_a_time_word(u, tags[phrase_at + q]) for q, u in enumerate(phrase)) and not thing_topic
    # (日曜日に入る予定だった田中さんが…。代わりに入れない？: the text has
    # said 入る already, of the same shift, plan 296)
    said_before = not thing_topic and any(u.lemma == "入る" and u.lemma_reading == "はいる" and u.pos == "verb"
                                          for u in morphemes[:phrase_at])
    return anyone or a_person or who or without or when or (gone_into and not thing_topic) or said_before \
        or (len(clause) >= 2 and clause[0].surface == "は" and clause[1].surface == "に") \
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
        if i > 0 and out[i - 1].surface in ("うまく", "上手く", "旨く") and m.surface == "行っ":
            # (交渉は思ったよりうまく行った: うまくいく, "go well", whatever
            # is the topic, plan 296)
            if m.lemma == "行う":
                out[i] = replace(m, lemma="行く", reading="いっ", lemma_reading="いく", kana="イッ", ctype="五段-カ行")
            continue
        if m.surface == "行っ" and _a_deed_said_of(out, i):
            # (三年前に行った調査: the clause says what the survey is, one
            # carried out -- nobody goes to a survey, plan 296)
            if m.lemma == "行く":
                out[i] = replace(m, lemma="行う", reading="おこなっ", lemma_reading="おこなう", kana="オコナッ",
                                 ctype="五段-ワア行")
            continue
        if m.surface == "行っ" and m.lemma == "行く" and _a_deed_as_topic(out, i):
            # (返品の手続きは、マイページから行っていただけます: what is
            # carried out set as the topic, no place to go to, plan 272)
            out[i] = replace(m, lemma="行う", reading="おこなっ", lemma_reading="おこなう", kana="オコナッ",
                             ctype="五段-ワア行")
            continue
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
        if _a_deed_as_topic(out, i):
            continue                    # 返品の手続きは、マイページから行っていただけます (plan 272)
        out[i] = replace(m, lemma="行く", reading="いっ", lemma_reading="いく", kana="イッ", ctype="五段-カ行")
    return out


# Nouns of a thing done, which 行う takes as its topic as often as with を
# (plan 272): 手続きは…行っていただけます.
_DEEDS = frozenset({"手続き", "手続", "会議", "式", "試験", "検査", "調査", "工事", "授業", "抽選", "選挙", "投票",
                    "祭り", "催し", "説明会", "面接", "点検", "訓練", "儀式", "行事", "作業", "処理", "取引", "交渉"})


# What is carried out and never gone to, whose 行った before it is 行う's
# (plan 296): not a meeting, a test, a class or an election, which one
# goes to as well (先週行った面接).
_CARRIED_OUT = frozenset({"調査", "実験", "研究", "検査", "点検", "工事", "処理", "分析", "審査", "評価", "アンケート",
                          "改革", "手術", "治療", "抽選", "作業", "取引", "交渉", "手続き", "訓練", "修理", "測定",
                          "観測", "調整", "検証", "改修", "実施"})


# What is given or held, said of by 行った as a deed is (plan 296):
# 会議で行った説明, 毎年行っている清掃活動.
_DONE_AS_WELL = frozenset({"説明", "発表", "清掃", "講演", "会見", "撮影"})


def _a_deed_said_of(morphemes, i: int) -> bool:
    """Whether 行っ at morphemes[i], as 行った or 行っている, says of a deed
    carried out: the nouns it modifies hold one (調査, 清掃活動)."""
    after = [u.surface for u in morphemes[i + 1:i + 4]]
    if after[:1] == ["た"]:
        k = i + 2
    elif after[:2] == ["て", "いる"]:
        k = i + 3
    elif after[:3] == ["て", "い", "た"]:
        k = i + 4
    else:
        return False
    run = []
    for u in morphemes[k:]:
        if u.pos not in ("noun", "suffix"):
            break
        run.append(u.surface)
    return any(w in _CARRIED_OUT or w in _DONE_AS_WELL for w in run)


def _a_deed_as_topic(morphemes, i: int) -> bool:
    """Whether the sentence before morphemes[i] sets a deed as its topic
    (Xは, Xも) -- a noun of a thing done (_DEEDS) or one that takes する --
    and marks no place the verb would go to (へ, or に after a place)."""
    for k in range(i - 1, 0, -1):
        u = morphemes[k]
        if u.pos == "symbol" and u.surface in "。！？!?":
            return False
        if u.pos == "particle" and u.surface == "へ":
            return False
        if u.pos == "particle" and u.surface == "に" and morphemes[k - 1].pos in ("noun", "pronoun"):
            return False                # (店に行った: a place gone to)
        if u.pos == "particle" and u.surface in ("は", "も") and morphemes[k - 1].pos == "noun" \
                and (morphemes[k - 1].surface in _DEEDS
                     or (morphemes[k - 1].verbal and morphemes[k - 1].surface not in _GONE_ON)):
            return True
    return False


# The things one goes on, which 行く takes as its topic (旅行は二人で行った).
_GONE_ON = frozenset({"旅行", "散歩", "出張", "留学", "外出", "通学", "通勤", "買い物", "見学", "遠足", "帰省",
                      "観光", "登山", "参拝", "訪問", "見物", "旅", "遊び", "勉強", "練習", "仕事", "応援"})


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
def _one_adjective(written: str):
    """The い-adjective `written` (a dictionary form) is when UniDic reads
    it alone as one -- 重い -- as (lemma, its reading), or None."""
    words = list(_plain_tagger(written)) if MORPHOLOGY_AVAILABLE else []
    if len(words) != 1 or words[0].feature.pos1 != "形容詞":
        return None
    return words[0].feature.lemma, kata_to_hira(words[0].feature.kana or "")


def _looks_so(morphemes: list[Morpheme], tags: list[tuple]) -> tuple[list, list]:
    """An adjective's stem and the そう of 〜そうです, which UniDic read as
    a noun the page does not spell (plan 272): 重そうですね is 重曹,
    "baking soda", to it. Where a noun ends in そう, its lemma is written
    otherwise, and the letters before そう with い are an adjective UniDic
    reads whole, the two are read apart, as 高そう is."""
    out_m, out_t = [], []
    for k, m in enumerate(morphemes):
        stem = m.surface[:-2]
        found = _one_adjective(stem + "い") if (
            m.pos == "noun" and m.surface.endswith("そう") and m.lemma != m.surface and stem
            and any(_is_kanji(c) for c in stem) and m.lemma.startswith(stem[:1])) else None
        if found is None:
            out_m.append(m)
            out_t.append(tags[k])
            continue
        lemma, said = found
        cut = m.start + len(stem)
        out_m.append(Morpheme(
            surface=stem, start=m.start, end=cut, lemma=lemma, reading=said[:-1], lemma_reading=said,
            kana="".join(chr(ord(c) + 0x60) for c in said[:-1]), pos="adjective", auxiliary_use=False,
            conjunctive=False, ctype="形容詞", cform="語幹-一般"))
        out_t.append(("形容詞", "一般", ""))
        out_m.append(Morpheme(
            surface="そう", start=cut, end=m.end, lemma="そう", reading="そう", lemma_reading="そう",
            kana="ソウ", pos="other", auxiliary_use=False, conjunctive=False))
        out_t.append(("形状詞", "助動詞語幹", ""))
    return out_m, out_t


def _done_after_an_adverb(morphemes: list[Morpheme], tags: list[tuple]) -> tuple[list, list]:
    """A noun in kana ending in た after an adverb, read as the verb's past
    its letters spell (plan 272): UniDic read よくねたほうがいい as ねた,
    "material", and an adverb says how a deed is done -- the letters are
    寝る's ね and た. Only where the letters before た with る are an
    ichidan verb UniDic reads whole."""
    out_m, out_t = [], []
    for k, m in enumerate(morphemes):
        prev = morphemes[k - 1] if k > 0 else None
        verb = _one_verb(m.surface[:-1] + "る") if (
            prev is not None and prev.pos == "adverb" and m.pos == "noun" and len(m.surface) >= 2
            and m.surface.endswith("た") and all("\u3041" <= c <= "\u309f" for c in m.surface)) else None
        if verb is None:
            out_m.append(m)
            out_t.append(tags[k])
            continue
        stem = m.surface[:-1]
        cut = m.start + len(stem)
        out_m.append(Morpheme(
            surface=stem, start=m.start, end=cut, lemma=verb[0], reading=stem, lemma_reading=stem + "る",
            kana="".join(chr(ord(c) + 0x60) for c in stem), pos="verb", auxiliary_use=False, conjunctive=False,
            ctype=_conjugation(verb[1]), cform="連用形-一般"))
        out_t.append(("動詞", "一般", ""))
        out_m.append(Morpheme(
            surface="た", start=cut, end=m.end, lemma="た", reading="た", lemma_reading="た", kana="タ",
            pos="auxiliary", auxiliary_use=False, conjunctive=False, ctype="助動詞-タ", cform="連体形-一般"))
        out_t.append(("助動詞", "", ""))
    return out_m, out_t


def _no_honorific_after_a_stem(morphemes: list[Morpheme], tags: list[tuple]) -> tuple[list, list]:
    """出さん after a verb's stem read as 出す's negative (plan 272): UniDic
    cut 泣き出さんばかり into 出, "coming out", and the honorific さん --
    and さん follows a person, never a verb's stem. The letters are 出さ,
    出す's 未然形, and ん, the negative said short (= 出さない)."""
    out_m, out_t = [], []
    i = 0
    while i < len(morphemes):
        m = morphemes[i]
        prev = morphemes[i - 1] if i > 0 else None
        nxt = morphemes[i + 1] if i + 1 < len(morphemes) else None
        if (prev is not None and prev.pos == "verb" and prev.cform.startswith("連用形") and m.surface == "出"
                and m.pos == "suffix" and nxt is not None and nxt.surface == "さん" and nxt.pos == "suffix"
                and _glued(prev, m) and _glued(m, nxt)):
            out_m.append(Morpheme(
                surface="出さ", start=m.start, end=nxt.start + 1, lemma="出す", reading="ださ", lemma_reading="だす",
                kana="ダサ", pos="verb", auxiliary_use=True, conjunctive=False, ctype="五段-サ行", cform="未然形-一般"))
            out_t.append(("動詞", "非自立可能", ""))
            out_m.append(Morpheme(
                surface="ん", start=nxt.start + 1, end=nxt.end, lemma="ず", reading="ん", lemma_reading="ず",
                kana="ン", pos="auxiliary", auxiliary_use=False, conjunctive=False, ctype="助動詞-ヌ",
                cform="終止形-撥音便"))
            out_t.append(("助動詞", "", ""))
            i += 2
            continue
        out_m.append(m)
        out_t.append(tags[i])
        i += 1
    return out_m, out_t


def _lost(morphemes: list[Morpheme], tags: list[tuple]) -> tuple[list, list]:
    """なくし, "lost", which UniDic cut into ない's なく and する's し (plan
    272): 片方なくしてしまい is 無くす before しまう, where 努力なくして is
    〜なくして, "without". Only before a verb the て hangs off in its
    auxiliary use (しまう, いる, おく), which 〜なくして never takes."""
    out_m, out_t = [], []
    i = 0
    while i < len(morphemes):
        m = morphemes[i]
        run = morphemes[i:i + 4]
        if (len(run) == 4 and m.surface == "なく" and m.pos == "adjective" and run[1].surface == "し"
                and run[1].lemma in ("為る", "する") and run[2].surface == "て" and run[2].conjunctive
                and run[3].pos == "verb" and run[3].auxiliary_use):
            out_m.append(Morpheme(
                surface="なくし", start=m.start, end=run[1].end, lemma="無くす", reading="なくし",
                lemma_reading="なくす", kana="ナクシ", pos="verb", auxiliary_use=False, conjunctive=False,
                ctype="五段-サ行", cform="連用形-一般"))
            out_t.append(("動詞", "一般", ""))
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
        # (...never after a を: the verbs it reads whole take none, so うそを
        # つかれた is つく's passive, "was lied to", plan 296)
        taken = i > 0 and morphemes[i - 1].pos == "particle" and morphemes[i - 1].surface == "を"
        if (nxt is not None and m.pos == "verb" and m.cform.startswith("未然形") and m.ctype.startswith("五段")
                and all("\u3041" <= c <= "\u309f" for c in m.surface) and nxt.pos == "auxiliary"
                and nxt.lemma == "れる" and nxt.start == m.end and nxt.surface.startswith("れ") and not taken):
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


# What carries a copula's て form on (plan 296): 元気でいる, 学生である,
# 件でいらっしゃいます, 不安でならない -- the で before them is the copula's.
_COPULA_GOES_ON = frozenset({"居る", "いる", "おる", "有る", "ある", "御座る", "ござる", "いらっしゃる", "成る", "なる",
                             "無い", "ない"})
_FORMAL_NOUNS = frozenset({"もの", "物", "こと", "事", "よう", "様", "そう", "みたい", "わけ", "訳", "はず", "ため",
                           "為", "つもり", "まま", "儘", "ところ", "所", "おかげ", "お陰", "せい", "ほう", "方"})
_DIGITS = "0123456789０１２３４５６７８９一二三四五六七八九十百千万何数"
# A state a suffix makes of a deed, whose で is the copula's (開けっぱなしで
# 外出した, 間違いだらけで).
_STATE_SUFFIXES = ("っぱなし", "っ放し", "だらけ", "ずくめ", "まみれ", "がち", "気味", "ぎみ")


def _topic_in_clause(morphemes: list[Morpheme], k: int) -> bool:
    """Whether a topic (は, も, って, とは) stands in the clause that ends
    at morphemes[k], back to the sentence's start or its last comma."""
    while k >= 0 and not (morphemes[k].pos == "symbol" and morphemes[k].surface in "。！？!?、，,「『"):
        if morphemes[k].pos == "particle" and morphemes[k].surface in _TOPICS and morphemes[k].surface not in ("が", "なら"):
            return True
        k -= 1
    return False


_GODAN_ROW = {"う": "ワア行", "く": "カ行", "ぐ": "ガ行", "す": "サ行", "つ": "タ行", "ぬ": "ナ行", "ぶ": "バ行", "む": "マ行",
              "る": "ラ行"}
_I_ROW_TO_U = dict(zip("いきぎしちにびみり", "うくぐすつぬぶむる"))
_KANA_ROW = {**{c: "ア行" for c in "あいうえお"}, **{c: "カ行" for c in "かきくけこ"}, **{c: "ガ行" for c in "がぎぐげご"},
             **{c: "サ行" for c in "さしすせそ"}, **{c: "ザ行" for c in "ざじずぜぞ"}, **{c: "タ行" for c in "たちつてと"},
             **{c: "ダ行" for c in "だぢづでど"}, **{c: "ナ行" for c in "なにぬねの"}, **{c: "ハ行" for c in "はひふへほ"},
             **{c: "バ行" for c in "ばびぶべぼ"}, **{c: "マ行" for c in "まみむめも"}, **{c: "ラ行" for c in "らりるれろ"}}
# A flower, whose kana さく is 咲く, never the noun 柵 (plan 296).
_FLOWERS = frozenset({"花", "はな", "さくら", "桜", "梅", "うめ", "ばら", "バラ", "ひまわり", "チューリップ", "つぼみ",
                      "あじさい", "菊", "きく", "たんぽぽ", "ゆり", "百合"})


def _verb_of_a_stem(m: Morpheme) -> tuple[str, str, str] | None:
    """(lemma, lemma reading, ctype) of the deck verb a noun is the stem of
    -- のり 乗る, 並び 並ぶ, 返し 返す, 寄せ 寄せる -- at the lowest level that
    has one, its kanji the stem's where it shows any; or None."""
    said = kata_to_hira(m.reading)
    kanji = [c for c in m.surface if _is_kanji(c)]
    tries = []
    if said[-1:] in _I_ROW_TO_U:
        tries.append((said[:-1] + _I_ROW_TO_U[said[-1]], "五段-" + _GODAN_ROW[_I_ROW_TO_U[said[-1]]]))
    if said[-1:] in _KANA_ROW:
        tries.append((said + "る", ("上一段-" if said[-1] in "いきぎしじちにひびみり" else "下一段-") + _KANA_ROW[said[-1]]))
    from content.vocab_data import VOCAB_BY_LEVEL

    for kana, ctype in tries:
        # (A stem in kana takes the lowest verb the deck spells in kanji --
        # おかけになる 掛ける, N4, before the N5 かける "to call" -- and a
        # card in kana only where the deck spells none.)
        found = [entry.get("kanji") or kana for level in ("N5", "N4", "N3", "N2", "N1")
                 for entry in VOCAB_BY_LEVEL.get(level, [])
                 if kana in (kata_to_hira(k.strip()) for k in (entry.get("kana") or "").replace(";", "/").split("/"))]
        found = [sp for sp in found if sp[-1:] == kana[-1:] and all(c in sp for c in kanji) and sp != kana[:-1]]
        spelled = next((sp for sp in found if any(_is_kanji(c) for c in sp)), found[0] if found else None)
        if spelled is not None:
            return spelled, kana, ctype
    return None


@lru_cache(maxsize=512)
def _an_o_word(said: str) -> bool:
    """Whether the dictionary holds a word read `said` that is お + a noun
    of its own and is written in kana alone (おしまい, "the end") -- never
    お帰り, お作り or お手伝い, which a verb's stem said up spells too."""
    import content.vocab_jmdict_data as jmdict_db

    return any(r.get("kana") == said and not r.get("kanji") for r in jmdict_db.by_kana(said, limit=6))


def an_o_noun(prefix: Morpheme, stem: Morpheme) -> bool:
    """Whether お + a stem written in kana is the dictionary's word of its
    own (おしまい): no verb said up (plan 296)."""
    return prefix.surface == "お" and _hiragana_only(stem.surface) and _an_o_word("お" + kata_to_hira(stem.reading))


def _verb_stems(morphemes: list[Morpheme], tags: list[tuple]) -> None:
    """A verb's stem or a noun, by what follows it (plan 296).

    - A noun after お or ご and before に + なる is a verb's stem, お〜になる
      said up: おのりになりますか is 乗る, no 糊; お並びになる 並ぶ.
    - A noun before the つ of 〜つ〜つ is one: 寄せ＿＿＿返しつ is 返す.
    - A verb's 連用形 before の, が or を (or は, も not before する) is the
      deck's noun read so: ひっこしの日 is 引越し, "the move" -- a verb
      takes no の; 食べもしない keeps its verb, and a stem said up
      (おすすめの) is the prefix's to read.
    - A verb in kana before ある is the deck's noun: さしつかえありません is
      差し支え, "hindrance", as 差し支えありません is.
    - さく ending a clause whose subject is a flower is 咲く: さくらも、もう
      すぐさくかな -- 庭のさくをなおした keeps 柵."""
    for i, m in enumerate(morphemes):
        prev = morphemes[i - 1] if i > 0 else None
        nxt = morphemes[i + 1] if i + 1 < len(morphemes) else None
        after = morphemes[i + 2] if i + 2 < len(morphemes) else None
        if m.pos == "noun" and nxt is not None and _glued(m, nxt) and (
                (prev is not None and prev.pos == "prefix" and prev.surface in ("お", "ご", "御") and _glued(prev, m)
                 and nxt.surface == "に" and after is not None and after.lemma in ("成る", "なる"))
                or (nxt.surface == "つ" and (nxt.pos == "particle" or nxt.lemma == "つう"))):
            verb = _verb_of_a_stem(m)
            if verb is not None and nxt.surface == "に" and an_o_noun(prev, m):
                continue                # (これでおしまいになります: the noun おしまい, "the end")
            if verb is not None:
                m.pos, m.lemma, m.lemma_reading, m.ctype, m.cform = "verb", verb[0], verb[1], verb[2], "連用形-一般"
                m.written, m.written_reading = verb[0], verb[1]
                tags[i] = ("動詞", "一般", "*")
            continue
        if m.pos == "verb" and _hiragana_only(m.surface) and m.cform.startswith(("連用形-一般", "未然形-一般")) \
                and nxt is not None and _glued(m, nxt) and not (prev is not None and prev.pos == "prefix") and (
                    (nxt.pos == "particle" and (nxt.surface in ("の", "が", "を") or (
                        nxt.surface in ("は", "も") and not (after is not None and after.pos == "verb"))))
                    or (nxt.pos == "verb" and nxt.lemma == "有る")):
            said = kata_to_hira(m.reading)
            spellings, level = _first_cards(said)
            noun = next((sp for sp in spellings if level is not None and sp != said and sp[-1:] == said[-1:]), None)
            if noun is not None and m.cform.startswith("連用形") or (noun is not None and nxt.lemma == "有る"):
                m.pos, m.lemma, m.lemma_reading, m.ctype, m.cform = "noun", noun, said, "", ""
                m.written, m.written_reading = noun, said
                tags[i] = ("名詞", "普通名詞", "一般")
            continue
        if m.surface == "さく" and m.pos == "noun" and (nxt is None or (nxt.pos in ("particle", "symbol", "auxiliary")
                                                                    and nxt.surface not in ("を", "が", "の", "に", "で", "は", "も"))):
            clause = _own_clause(morphemes, i)
            k = len(clause) - 1
            whole = list(reversed(morphemes[:i]))
            subject = any(u.surface in _FLOWERS and q > 0 and whole[q - 1].surface in ("が", "は", "も")
                          for q, u in enumerate(whole[:12]))
            if subject:
                m.pos, m.lemma, m.lemma_reading, m.ctype, m.cform = "verb", "咲く", "さく", "五段-カ行", "終止形-一般"
                m.written, m.written_reading = "咲く", "さく"
                tags[i] = ("動詞", "一般", "*")


def _how_one_goes(morphemes: list[Morpheme]) -> None:
    """行く and 来る after どうやって, こうやって are the verbs themselves
    (plan 296): どうやって行く is "how do I go", どうやって + 行く, no going
    on -- UniDic marks a verb after て as its auxiliary use, which takes
    its card away."""
    for i, m in enumerate(morphemes[3:], start=3):
        if m.pos == "verb" and m.lemma in ("行く", "来る") and morphemes[i - 1].surface == "て" \
                and morphemes[i - 2].lemma in ("遣る", "やる") and morphemes[i - 3].surface in ("どう", "こう", "そう", "ああ"):
            m.auxiliary_use = False


def _how_by_doing(morphemes: list[Morpheme], tags: list[tuple]) -> tuple[list, list]:
    """どうやって, こうやって, そうやって, ああやって: the one adverb the
    dictionary holds, "how", "like this" (plan 296) -- never どう, やる's
    て form and a clause the て joins to the next."""
    out_m, out_t = [], []
    i = 0
    while i < len(morphemes):
        m = morphemes[i]
        if i + 2 < len(morphemes) and m.surface in ("どう", "こう", "そう", "ああ") \
                and morphemes[i + 1].lemma in ("遣る", "やる") and morphemes[i + 1].surface == "やっ" \
                and morphemes[i + 2].surface == "て" and _glued(m, morphemes[i + 1]) and _glued(morphemes[i + 1], morphemes[i + 2]):
            surface = m.surface + "やって"
            out_m.append(replace(m, surface=surface, end=morphemes[i + 2].end, lemma=surface, reading=surface,
                                 lemma_reading=surface, kana=m.kana + "ヤッテ", pos="adverb", ctype="", cform="",
                                 auxiliary_use=False, conjunctive=False, written=surface, written_reading=surface))
            out_t.append(("副詞", "*", "*"))
            i += 3
            continue
        out_m.append(m)
        out_t.append(tags[i])
        i += 1
    return out_m, out_t


def _toii_toii(morphemes: list[Morpheme], tags: list[tuple]) -> None:
    """Two nouns each followed by と + いい are 〜といい〜といい, and both
    いい are 言う's 連用形 (plan 296): 重さといい手ざわりといい is "be it
    the weight or the feel", no 良い, "good"."""
    pairs = [i for i, m in enumerate(morphemes)
             if m.surface in ("いい", "言い") and i >= 2 and morphemes[i - 1].surface == "と"
             and morphemes[i - 1].pos == "particle" and morphemes[i - 2].pos in ("noun", "suffix", "pronoun")]
    if len(pairs) < 2:
        return
    for i in pairs:
        m = morphemes[i]
        m.pos, m.lemma, m.lemma_reading, m.ctype, m.cform = "verb", "言う", "いう", "五段-ワア行", "連用形-一般"
        m.written, m.written_reading, m.auxiliary_use = "言う", "いう", False
        tags[i] = ("動詞", "一般", "*")


def _first_time(morphemes: list[Morpheme]) -> None:
    """初めて before でも is a noun, "the first time" (plan 296): はじめて
    でもだいじょうぶ is "even a first time is fine", 〜でも's "even" as in
    子どもでも -- no adverb and も "also"."""
    for i, m in enumerate(morphemes[:-2]):
        if m.pos == "adverb" and m.lemma == "初めて" and morphemes[i + 1].surface == "で" \
                and morphemes[i + 2].surface == "も" and _glued(m, morphemes[i + 1]):
            m.pos = "noun"


def _ni_of_a_noun(morphemes: list[Morpheme], tags: list[tuple]) -> None:
    """だ's に after a word UniDic files as a な-adjective, or a noun that
    may be one, read as the case particle where the sentence makes the
    word a noun (plan 296): modified as only a noun is -- by の (命の危険に
    つながる, お客様の安全に), an adnominal (このへんにコンビニが) or a
    clause before it (春めく陽気に誘われて, 大きく見える危険にまで及ぶ).
    An adjective said adverbially takes none of them: 安全に運転する, 静かに
    話す keep the adverb's に. Never よう, みたい, そう or ふう, whose に
    is their own (彼のように, あんなふうに), nor before なる or する, whose
    〜になる and 〜にする the noun keeps, nor before an adjective, which a
    degree's に says how much of (芭蕉の非常に有名な俳句)."""
    for i, m in enumerate(morphemes):
        if not (m.surface == "に" and m.pos == "auxiliary" and m.lemma == "だ" and i >= 2):
            continue
        word, before = morphemes[i - 1], morphemes[i - 2]
        if word.pos not in ("noun", "other") or word.lemma in ("様", "みたい", "そう", "風") \
                or word.surface in ("よう", "みたい", "そう", "ふう") or not _glued(before, word):
            continue                    # (あんなふうに話す: the manner's own に)
        after = next((u for u in morphemes[i + 1:] if not (u.pos == "particle" and u.surface in ("は", "も", "まで", "さえ"))),
                     None)
        if after is not None and (after.lemma in ("成る", "なる", "為る", "する") or after.pos in ("adjective", "other")
                                  or (after.pos == "noun" and after.adjectival)):
            continue                    # (芭蕉の非常に有名な俳句: "very", said of 有名)
        if (before.surface == "の" and before.pos == "particle") or before.pos == "adnominal" \
                or (before.pos in ("verb", "adjective", "auxiliary", "suffix") and before.cform.startswith("連体形")):
            m.pos, m.lemma, m.lemma_reading, m.ctype, m.cform = "particle", "に", "に", "", ""
            m.written, m.written_reading = "に", "に"
            tags[i] = ("助詞", "格助詞", "*")


def _case_de(morphemes: list[Morpheme], tags: list[tuple]) -> None:
    """で read back as the case particle where UniDic took it for the
    copula's て form and what follows says it is one (plan 296): a plain
    noun's で before a word that goes on with its own clause (仕事で忙しい,
    一杯で千円, 旅でぐったり, ホットでお願いします); で before は, のみ or しか
    with no negative after it (仕事ではメールしか使わない, 窓口でのみ行う,
    頭でしか知らない -- never 学生ではない, 愚か者でしかない); a deed and
    ことで, "by doing" (教えあうことで、成績が上がった); だけで after a deed
    with no topic before it, "just by" (一台置くだけで、売り続けてくれる --
    never したただけで, "only did", nor 東京は大きいだけで、); and a count of people with no topic before it (父と母と
    三人で、行きました -- never 人口は三百万人で、). A noun that is a
    な-adjective too keeps the copula (元気で友人も多い), and so does a noun
    the copula says of something (もので、, 金持ちで、), and so does what
    carries a copula's て form on (元気でいる, 件でいらっしゃいます)."""
    from dataclasses import replace

    def particle(i: int) -> None:
        morphemes[i] = replace(morphemes[i], lemma="で", lemma_reading="で", pos="particle", ctype="", cform="")
        tags[i] = ("助詞", "格助詞", "*")

    def negative_or_being(k: int) -> bool:
        return k < len(morphemes) and (morphemes[k].lemma in _COPULA_GOES_ON
                                       or morphemes[k].surface.startswith(("あり", "ござ")))

    for i in range(1, len(morphemes) - 1):
        m, prev, nxt = morphemes[i], morphemes[i - 1], morphemes[i + 1]
        if not (m.surface == "で" and m.pos == "auxiliary" and m.lemma == "だ" and m.cform.startswith("連用形")):
            continue
        if prev.surface in ("仕事", "しごと", "用事", "ようじ", "出張", "留守") and nxt.lemma in ("居る", "いる", "おる") \
                and i + 2 < len(morphemes) and (morphemes[i + 2].lemma in ("無い", "ない")
                                                or morphemes[i + 2].surface.startswith("ませ")):
            particle(i)                   # 母はしごとでいませんでした: away for work
            continue
        if negative_or_being(i + 1):
            continue                      # 情熱でなくてなんだろう, 無料でなければ, 元気でいる
        plain = prev.pos in ("noun", "pronoun", "suffix") and not prev.adjectival and not prev.proper \
            and prev.surface not in _COPULA_NOUNS and prev.lemma not in _COPULA_NOUNS \
            and prev.surface not in _FORMAL_NOUNS and not prev.surface.endswith(_STATE_SUFFIXES)
        if nxt.pos == "particle" and nxt.surface in ("は", "のみ", "しか") and prev.pos in ("noun", "pronoun", "suffix") \
                and not prev.adjectival and prev.surface not in _FORMAL_NOUNS and not negative_or_being(i + 2):
            particle(i)                   # 仕事では, 窓口でのみ, 頭でしか
            continue
        if plain and (nxt.pos in ("adjective", "adverb", "noun", "pronoun", "other")
                      or (nxt.pos == "verb" and nxt.lemma not in _COPULA_GOES_ON)
                      or (nxt.pos == "prefix" and i + 2 < len(morphemes) and morphemes[i + 2].pos in ("noun", "verb"))):
            particle(i)                   # 仕事で忙しい, 一杯で千円, 旅でぐったり, ホットでお願い
            continue
        if negative_or_being(i + 1) or (nxt.pos == "particle" and nxt.surface in ("は", "も") and negative_or_being(i + 2)):
            continue
        before = morphemes[i - 2] if i >= 2 else None
        if prev.surface in ("こと", "事") and before is not None and before.pos in ("verb", "auxiliary") \
                and before.lemma not in ("有る", "ある", "居る", "いる", "だ", "です"):
            particle(i)                   # 教えあうことで、成績が上がった
            continue
        if prev.surface == "だけ" and prev.pos == "particle" and before is not None \
                and (before.pos == "verb" or (before.pos == "auxiliary" and before.lemma == "ない")) \
                and not _topic_in_clause(morphemes, i - 2):
            particle(i)                   # 一台置くだけで、; never 東京は大きいだけで、, したただけで
            continue
        if prev.surface == "人" and before is not None and before.surface and all(c in _DIGITS for c in before.surface) \
                and nxt.pos == "symbol" and nxt.surface in "、，,":
            start = i - 2
            while start > 0 and not (morphemes[start - 1].pos == "symbol" and morphemes[start - 1].surface in "。！？!?「『、，,"):
                start -= 1
            rest = []
            for t in morphemes[i + 2:]:
                if t.pos == "symbol" and t.surface in "。！？!?":
                    break
                rest.append(t)
            # (...and only where what follows has a deed they do together:
            # 五人で、一人は単品, a booking's note, says no more than how many)
            if not any(t.pos == "particle" and t.surface in _TOPICS for t in morphemes[start:i - 1]) \
                    and any(t.pos == "verb" and not (n > 0 and rest[n - 1].conjunctive and rest[n - 1].surface in ("て", "で"))
                            for n, t in enumerate(rest)):
                particle(i)               # 父と母と三人で、 -- never 人口は三百万人で、


# A means or a medium a で after it takes (plan 296): 電話で、, バスで、.
_MEANS = frozenset({"電話", "メール", "手紙", "車", "バス", "電車", "自転車", "飛行機", "船", "タクシー", "地下鉄",
                    "徒歩", "歩き", "声", "大声", "口", "手", "ペン", "鉛筆", "はし", "箸", "ネット", "テレビ", "ラジオ"})
_PLACE_ENDINGS = tuple("機店館局駅室所場港院園器国町市村県区校社屋")
# The nouns a construction ends on with its で (〜一方で, 〜せいで): the
# construction's, whatever the clause after it says.
_CONSTRUCTION_NOUNS = frozenset({"一方", "反面", "せい", "おかげ", "お陰", "ため", "為", "結果", "代わり", "上", "うえ",
                                 "ところ", "所", "次第", "ついで", "最中", "途中", "わり", "割", "以上"})
_PLACE_WORDS = frozenset({"家", "うち", "いえ", "海", "山", "川", "庭", "外", "部屋", "へや", "教室", "台所", "道",
                          "ここ", "そこ", "あそこ", "どこ", "こちら", "そちら", "あちら", "日本", "東京", "大阪",
                          "京都", "外国", "田舎", "都会", "世界", "空", "森", "島", "湖", "池"})


def _copula_de(morphemes: list[Morpheme], tags: list[tuple]) -> None:
    """で read back as the copula's て form where UniDic took it for the
    particle and the sentence joins two things said (plan 296): a topic,
    the noun said of it and its で, a comma, then a clause with a topic
    or a subject of its own -- 小さいじしょは千九百円で、ことばは少ない,
    私もその一人で、ひまがあると, 針は止まったままで、ガラスには, のは
    「時間がない」で、二番目は. Never a place, a means or a medium (私は
    駅で、友達に会った; 彼は電話で、私が行くと言った; 私はバスで、妹は電車
    で来た)."""
    from dataclasses import replace

    # (Never card_lookup's places: it tokenizes the deck as it loads, and an
    # import from here, mid-build, fails every word it reads.)
    for i in range(1, len(morphemes) - 2):
        m, prev, nxt = morphemes[i], morphemes[i - 1], morphemes[i + 1]
        if not (m.surface == "で" and m.pos == "particle" and not m.conjunctive) \
                or not (nxt.pos == "symbol" and nxt.surface in "、，,"):
            continue
        quoted = prev.pos == "symbol" and prev.surface in "」』"
        if not (quoted or prev.pos in ("noun", "suffix", "pronoun")):
            continue
        if not quoted and ((prev.proper and prev.name_kind == "place") or prev.surface in _PLACE_WORDS
                           or prev.surface in _CONSTRUCTION_NOUNS
                           or prev.surface in _RELATIONAL_PLACES or prev.surface in _MEANS
                           or prev.surface.endswith(_PLACE_ENDINGS) or prev.surface.endswith("語")
                           or (prev.counter and not prev.surface.endswith(("円", "歳", "さい", "人")))):
            continue
        start = i - 1
        while start > 0 and not (morphemes[start - 1].pos == "symbol" and morphemes[start - 1].surface in "。！？!?、，,「『"):
            start -= 1
        clause = morphemes[start:i - 1]
        # (...or a time it holds from, with no deed in it: あさからいい天気で、
        # -- never 蛇口から漏れた水で、, a cause)
        # (never the は of ならでは, 仕事では: a は after で sets a scope)
        topic = any(t.pos == "particle" and t.surface in ("は", "も", "って", "とは")
                    and not (n > 0 and clause[n - 1].surface == "で") for n, t in enumerate(clause)) or (
            len(clause) >= 2 and clause[1].surface == "から" and clause[0].pos == "noun"
            and not any(t.pos == "verb" for t in clause))
        if not topic:
            continue
        own = False
        for t in morphemes[i + 2:]:
            if t.pos == "symbol" and t.surface in "。！？!?":
                break
            if t.pos == "particle" and t.surface in ("は", "が", "も") and not t.conjunctive:
                own = True
                continue
            if t.pos in ("verb", "adjective") or (t.pos == "auxiliary" and t.lemma in ("だ", "です")):
                break
        if own:
            morphemes[i] = replace(m, lemma="だ", lemma_reading="だ", pos="auxiliary", ctype="助動詞-ダ",
                                   cform="連用形-一般", conjunctive=False)
            tags[i] = ("助動詞", "*", "*")


# An adjective's く form after の is the noun it makes: おおさかのちかく,
# "near Osaka" -- no adjective follows の.
_KU_NOUNS = {"近い": ("近く", "ちかく"), "遠い": ("遠く", "とおく")}
# 程遠い and 程近い, read as ほど and the adjective where no particle
# stands before them (plan 296).
_HODO_ADJECTIVES = {"程遠い": ("遠い", "とおい"), "程近い": ("近い", "ちかい")}
_KU_ADJECTIVES = {noun: (adjective, reading[:-1] + "い") for adjective, (noun, reading) in _KU_NOUNS.items()}
# The case particles a noun takes and a く form never does (plan 296).
_KU_NOUN_CASES = frozenset({"に", "で", "へ", "まで", "から", "を", "が"})


def _negated_at(morphemes, k: int) -> bool:
    """Whether a denial stands at morphemes[k]: ない, なかった, ありません."""
    if k >= len(morphemes):
        return False
    u = morphemes[k]
    if u.lemma in ("無い", "ない") and u.pos in ("adjective", "auxiliary"):
        return True
    return (u.lemma in ("有る", "ある") and k + 2 < len(morphemes) and morphemes[k + 1].lemma == "ます"
            and morphemes[k + 2].surface in ("ん", "ず"))
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
        joined = m.surface == "ガチ" and m.unknown      # (the two marks _katakana_marks joined, plan 296)
        if joined or (m.surface == "ガ" and m.pos == "symbol" and nxt is not None and nxt.surface == "チ"
                      and _glued(m, nxt)):
            # ガチ, "for real" (slang), which UniDic cuts into two marks;
            # ガチで, "seriously" (plan 272).
            tail, following = (m, nxt) if joined else (nxt, after)
            with_de = following is not None and following.surface == "で" and _glued(tail, following)
            last = following if with_de else tail
            surface = "ガチで" if with_de else "ガチ"
            out_m.append(replace(m, surface=surface, end=last.end, lemma=surface, reading=kata_to_hira(surface),
                                 lemma_reading=kata_to_hira(surface), kana=surface.replace("で", "デ"),
                                 pos="adverb" if with_de else "noun", ctype="", cform="", unknown=False))
            out_t.append(("副詞", "*", "*") if with_de else ("名詞", "普通名詞", "一般"))
            skip.update(({i + 1} if with_de else set()) if joined else ({i + 1, i + 2} if with_de else {i + 1}))
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
                     or (nxt is not None and nxt.surface == "の" and nxt.pos == "particle")
                     # (...and before a case particle, which no く form takes:
                     # ちかくにいませんでした, the vicinity, plan 296)
                     or (nxt is not None and nxt.pos == "particle" and nxt.surface in _KU_NOUN_CASES))):
            lemma, reading = _KU_NOUNS[m.lemma]
            m = replace(m, pos="noun", lemma=lemma, lemma_reading=reading, ctype="", cform="")
            tags = tags[:i] + [("名詞", "普通名詞", "副詞可能")] + tags[i + 1:]
        elif (m.pos == "adverb" and m.surface in ("よく", "良く") and nxt is not None and nxt.pos == "particle"
              and nxt.surface in ("は", "も") and _negated_at(morphemes, i + 2)):
            # 体によくはない: 良い's く form denied, "not good" -- よくはわから
            # ない keeps the adverb, "not well" (plan 296)
            m = replace(m, pos="adjective", lemma="良い", lemma_reading="よい", ctype="形容詞", cform="連用形-一般")
            tags = tags[:i] + [("形容詞", "非自立可能", "*")] + tags[i + 1:]
        elif (m.pos == "noun" and m.lemma in _KU_ADJECTIVES and nxt is not None and nxt.pos == "particle"
              and nxt.surface in ("は", "も") and after is not None and _negated_at(morphemes, i + 2)):
            # 近くはない, 遠くもありません: the adjective's く form denied --
            # "not near", no "the vicinity" (plan 296)
            lemma, reading = _KU_ADJECTIVES[m.lemma]
            m = replace(m, pos="adjective", lemma=lemma, lemma_reading=reading, ctype="形容詞", cform="連用形-一般")
            tags = tags[:i] + [("形容詞", "一般", "*")] + tags[i + 1:]
        elif (m.pos == "adjective" and m.lemma == "危うい" and m.surface in ("危うく", "あやうく") and nxt is not None
              and not (nxt.lemma in ("成る", "なる", "為る", "する") or nxt.surface in ("て", "も", "は", "ない", "なく"))):
            # 危うく自転車にぶつかるところだった: the adverb, "nearly" -- 危うい
            # becomes or is made so (危うくなった) only before なる, する (plan 296)
            m = replace(m, pos="adverb", lemma="危うく", lemma_reading="あやうく", ctype="", cform="")
            tags = tags[:i] + [("副詞", "*", "*")] + tags[i + 1:]
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
    katakana = _katakana_only(m.surface)
    if i < 2 or not (_kana_letters(m.surface) or katakana) or len(m.surface) < 2 \
            or m.pos not in ("noun", "adverb", "interjection"):
        return False
    of, animal = morphemes[i - 1], morphemes[i - 2]
    if not (of.surface == "の" and of.pos == "particle" and (animal.surface in NAMED_ANIMALS or animal.lemma in NAMED_ANIMALS)):
        return False
    nxt = morphemes[i + 1] if i + 1 < len(morphemes) else None
    if nxt is not None and nxt.surface in _HONORIFIC_ENDS:
        return True
    if katakana:
        # (犬のポチを: a word in katakana the deck does not teach is its
        # name -- 犬のエサ is its food, plan 296)
        return nxt is not None and nxt.pos == "particle" and nxt.surface in _NAME_PARTICLES \
            and kata_to_hira(m.surface) not in _deck_kana()
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


# The colours a pet is named by (クロ, シロ, チャ).
_COLOURS = frozenset({"黒", "白", "茶", "赤", "灰", "金", "銀", "三毛"})
# What a person or an animal does, which a colour or a dot never does
# (plan 296): クロは…ねていました is the cat, ポチは…走りはじめました the dog.
_AN_ANIMAL_DOES = _A_PERSON_DOES | {"鳴く", "吠える", "ほえる", "飛ぶ", "泳ぐ", "逃げる", "眠る", "なれる", "慣れる",
                                   "喜ぶ", "隠れる", "噛む", "かむ", "なく", "はしる", "ねる"}


def _pet_names(morphemes: list[Morpheme], tags: list[tuple]) -> tuple[list, list]:
    """A word in katakana that cannot itself be the one who does it -- an
    adverb (ぽち), a colour (黒, 白), a proper noun UniDic names no person
    nor place (ポチ, タマ) -- and stands as the topic or the subject of
    what only a person or an animal does is a name, the way a page names its pet:
    ポチは急に元気になって、にわを走りはじめました is Pochi, no ぽち "a dot";
    クロはベッドの上でねていました the cat, no 黒 (plan 296). クロは好きな色
    です does nothing; カラスが鳴く is the crow, its name in katakana as
    animals' are; ロボットは歩く, ペンギンが泳ぐ are loanwords."""
    from dataclasses import replace

    out_m, out_t = list(morphemes), list(tags)
    for i, m in enumerate(morphemes):
        if not (_katakana_only(m.surface) and 2 <= len(m.surface) <= 4 and not m.unknown and i + 1 < len(morphemes)
                and morphemes[i + 1].surface in ("は", "が", "も") and morphemes[i + 1].pos == "particle"):
            continue
        # (what cannot be the one who does it: an adverb, a proper noun
        # UniDic can call no person nor place (ポチ, タマ), a colour --
        # カラスが鳴く is the crow, written in katakana as animals are,
        # and トム, スイス are UniDic's names already)
        if not (m.pos == "adverb" or (m.proper and m.name_kind == "other") or m.lemma in _COLOURS):
            continue
        rest = []
        for u in morphemes[i + 2:]:
            if u.pos == "symbol" and u.surface in "。！？!?":
                break
            rest.append(u)
        if any(u.pos == "verb" and (u.lemma in _AN_ANIMAL_DOES or u.written in _AN_ANIMAL_DOES) for u in rest):
            out_m[i] = replace(m, pos="noun", proper=True, name_kind="given", unknown=True, ctype="", cform="")
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
        # (by its letters, whatever the cut: でーじ is で + ーじ before な
        # and でー + じ before 暑い, plan 272)
        letters, n, at = "".join(parts), 0, morphemes[i].start
        while i + n < len(morphemes) and morphemes[i + n].start == at and len(letters) > at - morphemes[i].start:
            at = morphemes[i + n].end
            n += 1
        if n >= 2 and "".join(u.surface for u in morphemes[i:i + n]) == letters:
            return n, word, (lemma[0] if lemma else word), pos, said
    return None


# What is opened on a screen or a page (開く read ひらく, 開けない "cannot
# open"), plan 272.
_OPENED_ON_SCREEN = ("ファイル", "ページ", "アプリ", "リンク", "サイト", "画面", "メール", "添付", "フォルダ", "フォルダー",
                     # (写真が開けない, Wordの文書が開けない: a file, plan 272)
                     "写真", "画像", "動画", "文書", "データ", "資料", "書類", "ドキュメント", "URL", "ＵＲＬ",
                     "PDF", "ＰＤＦ", "本", "ノート", "教科書")

# What comes back as an answer comes back (返る), where a person comes
# home (帰る): こたえが かえって きた, an echo's "hello" (plan 272).
_COMES_BACK = frozenset({"答え", "返事", "返答", "反応", "声", "こだま", "木霊", "山彦", "やまびこ", "メール", "手紙",
                         "お金", "金", "お釣り", "釣り", "ボール"})


# What comes home (帰る) where a thing comes back (返る): the people, the
# animals and the vehicles a page names (plan 272).
_ALIVE = re.compile(r"\b(person|people|man|woman|men|women|child|children|kid|boy|girl|baby|father|mother|parent|"
                    r"son|daughter|brother|sister|husband|wife|friend|teacher|student|family|grand\w+|uncle|aunt|"
                    r"dog|cat|bird|animal|pet|horse|everyone|everybody|guest|customer|boss|"
                    r"train|bus|car|ship|boat|plane|aircraft)\b")


def _alive_or_moving(m) -> bool:
    """Whether morphemes[k], a subject, is someone or something that comes
    home: a name, a pronoun, a word with its honorific, or a noun the
    dictionary calls a person, an animal or a vehicle."""
    if m.proper or m.pos == "pronoun" or m.surface in ("さん", "くん", "ちゃん", "様", "さま", "たち", "達"):
        return True
    return bool(_ALIVE.search(_noun_meaning(m.surface, kata_to_hira(m.reading))))


@lru_cache(maxsize=2048)
def _noun_meaning(written: str, said: str) -> str:
    """The first sense of a noun as the deck or the dictionary gives it."""
    import content.vocab_jmdict_data as jmdict_db
    from content.vocab_data import VOCAB_BY_LEVEL

    for entries in VOCAB_BY_LEVEL.values():
        for entry in entries:
            if written in (entry.get("kanji"), entry.get("kana")):
                return (entry.get("meaning") or "").lower().split(";")[0]
    row = jmdict_db.get_by_key(written if _has_kanji_char(written) else "", said)
    return (row.get("meaning") or "").lower() if row else ""


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
                and prev is not None and (prev.surface in ("で", "は", "ちゃ", "じゃ", "そりゃ", "こりゃ", "たら", "と", "ば")
                                          or prev.pos == "symbol")
                and not (prev.surface == "は" and i >= 2 and (
                    morphemes[i - 2].surface in ("へ", "に") or morphemes[i - 2].pos == "pronoun"
                    or morphemes[i - 2].name_kind in ("family", "given")))):
            # (学校へはいかん, わしはいかん: 行く's negative, where it goes
            # and who goes are said, plan 272)
            # せっかちでいかんのう, そりゃいかん: "won't do" (= いけない), no
            # 行く's negative (plan 272)
            out_m.append(replace(m, surface="いかん", end=nxt.end, lemma="いかん", reading="いかん",
                                 lemma_reading="いかん", kana="イカン", pos="adjective", ctype="", cform="",
                                 auxiliary_use=False, written="いかん", written_reading="いかん"))
            out_t.append(("形容詞", "一般", "*"))
            skip.add(i + 1)
            continue
        if (m.surface in ("立て", "育て") and (m.pos == "verb" and m.lemma in ("立てる", "育てる") or m.pos == "noun")
                and (prev is None or prev.surface in ("。", "！", "!", "「", "、") or prev.pos == "adverb"
                     or (prev.pos == "adjective" and prev.surface.endswith("く")))
                and nxt is not None and nxt.surface in ("、", "！", "!", "。", "よ", "」")
                and not (prev is not None and prev.surface == "「" and nxt.surface == "」"
                         and (after is None or after.surface not in ("と", "って")))):
            # 立て、ジン。, 早く立て！, 大きく育てよ: 立つ's and 育つ's command,
            # "stand up!" -- no 立てる with nothing to stand up, whether
            # UniDic calls it the verb or a noun (plan 272); 「育て」は, the
            # word quoted as itself, stays
            base = "立" if m.surface == "立て" else "育"
            said = "たつ" if base == "立" else "そだつ"
            out_m.append(replace(m, pos="verb", lemma=base + "つ", lemma_reading=said, ctype="五段-タ行",
                                 cform="命令形", written=base + "つ", written_reading=said))
            out_t.append(("動詞", "一般", "*"))
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
        if (m.surface == "よう" and m.lemma in ("様", "よう") and m.pos in ("suffix", "noun", "other") and prev is not None
                and nxt is not None and nxt.surface not in ("に", "な", "だ", "で", "です", "の", "や", "じゃ")
                and nxt.pos != "symbol"
                # (any word of how often, 毎晩よう飲む, or よう straight before
                # a verb, which no likeness stands before, plan 272)
                and (prev.surface.startswith("毎") or prev.surface in ("いつも", "ほんま", "ほんまに", "昔から", "年中")
                     or (nxt.pos == "verb" and prev.pos not in ("verb", "auxiliary", "adnominal")
                         and prev.surface not in ("の", "な", "この", "その", "あの", "どの")))):
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
                and _deck_word(m.surface + "い") and prev is not None
                and (prev.pos in ("symbol", "particle", "pronoun") or (prev.pos == "auxiliary" and prev.surface == "に"))
                # (青ないで, 白ないの？: a colour or a shape, a noun too --
                # "there is no blue", plan 272)
                and m.surface not in ("青", "白", "赤", "黒", "丸")):
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
        if (m.pos in ("adverb", "noun") and nxt is not None and nxt.surface == "や" and nxt.pos == "particle"
                and _glued(m, nxt) and (found := _adverb_in_ya(m.surface + "や", kata_to_hira(m.reading) + "や"))):
            # もしや、田中さん？, 今や誰でも使える: one adverb, "by any
            # chance", "now (as never before)" -- no "if" and a listing や
            # (plan 272)
            lemma, said = found
            out_m.append(replace(m, surface=m.surface + "や", end=nxt.end, lemma=lemma, reading=said,
                                 lemma_reading=said, kana=kata_of(said), pos="adverb", ctype="", cform="",
                                 written=lemma, written_reading=said))
            out_t.append(("副詞", "*", "*"))
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
        cut = _adjective_cut_short(morphemes, i)
        if cut is not None:
            # やばっ、, いたっ！, うまっ: an adjective cut short on its stem as
            # one cries out -- no やる + ば, 居る + た or 埋まる (plan 272)
            n, lemma, said = cut
            surface = "".join(u.surface for u in morphemes[i:i + n])
            out_m.append(replace(m, surface=surface, end=morphemes[i + n - 1].end, lemma=lemma, reading=surface[:-1],
                                 lemma_reading=said, kana=kata_of(surface[:-1]), pos="adjective", ctype="形容詞",
                                 cform="語幹-一般", auxiliary_use=False, conjunctive=False, proper=False,
                                 name_kind="", unknown=False, written=lemma, written_reading=said))
            out_t.append(("形容詞", "一般", "*"))
            skip.update(range(i + 1, i + n))
            continue
        if (m.surface == "あり" and m.pos == "noun" and m.lemma in ("有り", "在り") and prev is not None
                and prev.pos in ("noun", "suffix") and _glued(prev, m)
                and (nxt is None or (nxt.pos == "symbol" and nxt.surface in ("、", "。", "！", "」", "』")))):
            # 転勤の可能性あり, 礼儀あり: ある, said as a notice or a saying
            # writes it -- no noun "ant" or "existence" (plan 272)
            out_m.append(replace(m, pos="verb", lemma="有る", lemma_reading="ある", ctype="五段-ラ行",
                                 cform="連用形-一般", written="ある", written_reading="ある"))
            out_t.append(("動詞", "非自立可能", "*"))
            continue
        if (m.pos == "verb" and m.cform == "連用形-一般" and m.lemma not in ("為る", "する", "出来る", "できる")
                and _has_kanji_char(m.surface) and nxt is not None and nxt.pos == "symbol"
                and nxt.surface in ("、", "，", "。", "！", "？", "!", "?")
                and (prev is None or prev.pos == "symbol" or (prev.surface == "の" and prev.pos == "particle"))
                and _a_noun_spelled(m.surface, kata_to_hira(m.reading))):
            # 大関の勝ち、, 立ち合い、: the stem a noun, as the deck and the
            # dictionary write it, after の or opening the sentence -- no
            # verb with nothing to do it to (plan 272). After a noun it is
            # a headline's verb as often (車突っ込み、児童けが), and stays one.
            out_m.append(replace(m, pos="noun", lemma=m.surface, lemma_reading=m.reading, ctype="", cform="",
                                 written=m.surface, written_reading=kata_to_hira(m.reading)))
            out_t.append(("名詞", "普通名詞", "一般"))
            continue
        if (m.pos == "noun" and _hiragana_only(m.surface) and len(m.surface) >= 3 and m.surface.endswith("う")
                and prev is not None and prev.surface == "を" and prev.pos == "particle"
                and (nxt is None or nxt.pos == "symbol" or nxt.surface in ("よ", "ね", "か", "と", "って", "ぜ"))
                and (said := _volitional_of_a_deck_verb(m.surface))):
            # ピアノをひこう: 弾く's volitional, what one means to do -- no
            # 飛行 "flight" after a を (plan 272)
            lemma, ctype = said
            out_m.append(replace(m, pos="verb", lemma=lemma, ctype=ctype, cform="意志推量形", proper=False,
                                 name_kind="", written=lemma))
            out_t.append(("動詞", "一般", "*"))
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
                and (prev.pos in ("noun", "other") or (prev.pos == "particle" and prev.surface in ("ん", "の")))
                and (after is None or after.surface in ("？", "?", "。", "w", "ｗ"))):
            # (違うんじゃね？: the explaining ん before it too, plan 272)
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
            # (A thing comes back, 貸した本がかえってきた; a person, an animal
            # or a vehicle comes home -- and with no one named, one does,
            # plan 272.)
            who = morphemes[i - 2] if prev is not None and prev.surface in ("が", "は", "も") and i >= 2 else None
            back = who is not None and (who.lemma in _COMES_BACK or not _alive_or_moving(who))
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
                and (prev is None or prev.pos == "symbol"
                     # (くろとしろのねこ: after another colour and its と／や, plan 272)
                     or (prev.surface in ("と", "や", "も") and i >= 2
                         and morphemes[i - 2].surface in ("くろ", "あか", "あお", "きいろ", "みどり", "黒", "赤", "青")))
                and nxt is not None and nxt.pos == "particle"
                and nxt.surface not in ("よ", "ね", "な", "わ", "ぞ", "ぜ", "って", "ってば", "よな", "てば")
                # (しろと言われても, しろとは言ってない: an order quoted, plan 272)
                and not (nxt.surface in ("と", "とは", "って") and any(
                    u.lemma in ("言う", "いう", "思う", "命じる", "頼む") for u in morphemes[i + 2:i + 5]))):
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
                and prev is not None and _glued(prev, m) and ((prev.surface in _PAIRS or (
                    prev.pos == "suffix" and i >= 2 and morphemes[i - 2].surface in _PAIRS))
                and after is not None and after.pos in ("noun", "adjective", "other", "adverb", "symbol",
                                                        "pronoun", "prefix")
                    or _all_counted(morphemes, i))):
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
        if (m.surface == "やす" and m.lemma == "易い" and prev is not None and prev.pos == "verb"
                and prev.cform.startswith("連用形") and _glued(prev, m) and out_m and out_m[-1].start == prev.start
                and (prev.surface.startswith("お") or (i >= 2 and morphemes[i - 2].surface in ("お", "御")
                                                       and morphemes[i - 2].pos == "prefix"))
                and (nxt is None or nxt.pos == "symbol" or (nxt.pos == "particle" and nxt.surface in (
                    "ね", "え", "な", "や", "よ")))):
            # おこしやす, おかえりやす: Kyoto's polite request, no 〜やすい
            # "easy to" -- which takes its い (お越しやすい町, plan 272).
            if prev.surface == "おこし":
                out_m[-1] = replace(out_m[-1], lemma="お越し", reading="おこし", lemma_reading="おこし", pos="noun",
                                    ctype="", cform="", written="お越し", written_reading="おこし")
                out_t[-1] = ("名詞", "普通名詞", "一般")
            out_m.append(replace(m, lemma="やす", lemma_reading="やす", pos="auxiliary", ctype="", cform="",
                                 auxiliary_use=False, written="やす", written_reading="やす"))
            out_t.append(("助動詞", "*", "*"))
            continue
        if (m.surface == "その" and m.pos == "adnominal" and nxt is not None and nxt.surface == "他" and _glued(m, nxt)
                and nxt.pos == "noun"):
            # 民法その他の法令, その他大勢: その他, "and the rest, et
            # cetera" -- one word, no "that" and "other" (plan 272).
            said = "そのほか" if nxt.reading == "ほか" else "そのた"
            out_m.append(replace(m, surface="その他", end=nxt.end, lemma="その他", reading=said, lemma_reading="そのほか",
                                 kana=kata_of(said), pos="noun", ctype="", cform="", written="その他",
                                 written_reading=said))
            out_t.append(("名詞", "普通名詞", "一般"))
            skip.add(i + 1)
            continue
        if (m.surface == "築" and nxt is not None and nxt.surface == "浅" and _glued(m, nxt)
                and (after is None or after.surface in ("の", "で", "な", "だ", "です", "物件", "マンション"))):
            # 築浅のマンション: "recently built", the listings' word -- no
            # 浅い "shallow" (plan 272).
            out_m.append(replace(m, surface="築浅", end=nxt.end, lemma="築浅", reading="ちくあさ", lemma_reading="ちくあさ",
                                 kana="チクアサ", pos="noun", ctype="", cform="", written="築浅",
                                 written_reading="ちくあさ"))
            out_t.append(("名詞", "普通名詞", "一般"))
            skip.add(i + 1)
            continue
        if (m.surface == "なんて" and nxt is not None and nxt.pos == "verb" and _glued(m, nxt)
                and nxt.lemma in _ASKED_OF_A_WORD
                and (prev is None or prev.pos == "symbol" or (prev.pos == "particle" and prev.surface in (
                    "は", "を", "も", "に", "って")))):
            # なんて呼べばいい？, 今、なんて聞こえた？: 何と, "what", and the
            # quotation's て -- no "such a thing as", which follows what it
            # makes light of (勉強なんて, 嫌いだなんて言わないで, plan 272).
            out_m.append(replace(m, surface="なん", end=m.start + 2, lemma="何", reading="なん", lemma_reading="なに",
                                 kana="ナン", pos="pronoun", ctype="", cform="", auxiliary_use=False, conjunctive=False,
                                 written="何", written_reading="なん"))
            out_t.append(("代名詞", "*", "*"))
            out_m.append(replace(m, surface="て", start=m.start + 2, lemma="て", reading="て", lemma_reading="て",
                                 kana="テ", pos="particle", ctype="", cform="", auxiliary_use=False, conjunctive=False,
                                 written="て", written_reading="て"))
            out_t.append(("助詞", "格助詞", "*"))
            continue
        akan = _akan_at(morphemes, i)
        if akan:
            # あかん, "no good, don't" (Kansai), whatever UniDic cut it into
            # -- あ + かん, あか + ん, じゃあ + かん (plan 272): no "ah" and
            # a bell, no 開く's negative, which a door takes (ドアがあかん)
            if akan == "じゃ":
                out_m.append(replace(m, surface="じゃ", end=m.start + 1, lemma="では", reading="じゃ", lemma_reading="じゃ",
                                     kana="ジャ", pos="particle", ctype="", cform="", written="じゃ", written_reading="じゃ"))
                out_t.append(("助詞", "係助詞", "*"))
            out_m.append(replace(m, surface="あかん", start=nxt.end - 3, end=nxt.end, lemma="あかん", reading="あかん",
                                 lemma_reading="あかん", kana="アカン", pos="interjection", ctype="", cform="",
                                 auxiliary_use=False, written="あかん", written_reading="あかん"))
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
                and (prev is None or prev.pos == "symbol") and after is not None and after.pos != "symbol"):
            # はよ帰りたい, はよせんと, はよ家に入らんね: 早よ, "quickly"
            # (western Japan) -- a は that opens its clause tops nothing,
            # and no よ follows it (plan 272).
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
        if m.surface == "もったい" and nxt is not None and nxt.lemma in ("無い", "ない") and nxt.pos == "adjective" \
                and _glued(m, nxt):
            # もったいない, もったいなく: one adjective, no 勿体 and ない (plan 296)
            out_m.append(replace(m, surface=m.surface + nxt.surface, end=nxt.end, lemma="勿体無い",
                                 reading="もったい" + nxt.reading, lemma_reading="もったいない",
                                 kana="モッタイ" + nxt.kana, pos="adjective", ctype="形容詞", cform=nxt.cform,
                                 written="もったいない", written_reading="もったいない"))
            out_t.append(("形容詞", "一般", "*"))
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
        if (m.surface == "今日" and kata_to_hira(m.reading) == "こんにち" and not (
                nxt is not None and (nxt.lemma in ("至る", "いたる") or nxt.surface == "的"
                                     or (nxt.surface == "に" and after is not None and after.lemma in ("至る", "いたる"))))):
            # 今日本当に寒いね: きょう, "today" -- UniDic chose こんにち,
            # "nowadays", by the word after it; that one is said before
            # では and に至る alone (plan 272)
            out_m.append(replace(m, reading="きょう", lemma_reading="きょう", kana="キョウ", written_reading="きょう"))
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
        if (m.surface.startswith("入れ") and m.lemma == "入れる" and m.pos == "verb"
                and _enters(morphemes, i, tags)):
            # この店は誰でも入れます, 中には入れません: 入る's はいれる, "can
            # enter", no 入れる "to put in" -- 入る conjugating as 下一段,
            # the potential's own shape, so 可能形 is lit (plan 296)
            out_m.append(replace(m, lemma="入る", reading="はい" + kata_to_hira(m.reading)[1:], lemma_reading="はいる",
                                 kana="ハイ" + m.kana[1:] if m.kana else m.kana, written="入る",
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
                     or (prev.surface == "が" and i >= 2 and morphemes[i - 2].surface in _PASSING)
                     or (prev.surface == "に" and i >= 2 and morphemes[i - 2].surface.endswith(_EXAMS))
                     or (nxt is not None and nxt.surface == "た" and after is not None and after.surface in _PASSAGES)
                     or _gets_through(morphemes, i))):
            # 火が通っている, 公園を通って: 通る, とおる -- no 通う, "commute"
            # (and ご注文がキッチンに通っていなかった: an order gets through, plan 296)
            out_m.append(replace(m, lemma="通る", reading="とおっ", lemma_reading="とおる", kana="トオッ",
                                 ctype="五段-ラ行", written="通る", written_reading="とおる"))
            out_t.append(tags[i])
            continue
        if m.surface == "園" and m.pos == "noun" and kata_to_hira(m.reading or "") == "その" \
                and not (prev is not None and prev.surface == "の"):
            # 園は…考えている, 園の子どもたち: えん, the zoo or the nursery
            # itself -- その is the garden of 学びの園, エデンの園 (plan 296)
            out_m.append(replace(m, reading="えん", lemma_reading="えん", kana="エン", written_reading="えん"))
            out_t.append(tags[i])
            continue
        if (m.surface == "ある" and m.pos == "verb" and m.lemma in ("有る", "ある") and m.cform.startswith("連体形")
                and nxt is not None and nxt.pos == "noun" and prev is not None and prev.surface == "の"
                and prev.pos == "particle" and i >= 2 and _a_frame(morphemes[i - 2])):
            # 七十代のある女性, ある時代のある土地: 或る, "a certain" -- the
            # の before it names an age, a time, a place, nothing one has
            # (問題のある人 is "with problems", the verb, plan 296)
            out_m.append(replace(m, pos="adnominal", lemma="或る", lemma_reading="ある", ctype="", cform="",
                                 written="或る", written_reading="ある"))
            out_t.append(("連体詞", "*", "*"))
            continue
        if (m.pos == "verb" and len(m.surface) >= 2 and m.surface.endswith("で") and m.cform.startswith("未然形")
                and nxt is not None and nxt.surface == "なく" and nxt.lemma in ("ない", "無い") and after is not None
                and after.surface == "て" and not (prev is not None and prev.surface == "を")
                and i + 4 < len(morphemes) and morphemes[i + 3].surface in ("なん", "何", "な")
                and any(x.lemma in ("だ", "です") for x in morphemes[i + 4:i + 6])):
            # これが愛でなくてなんだろう: 愛 and the copula's で, "if this is
            # not love, what is?" -- no 愛でる, "to admire" (plan 296)
            noun = m.surface[:-1]
            alone = _tag(noun)[0] if _tagger is not None else []
            if len(alone) == 1 and alone[0].pos == "noun" and alone[0].reading:
                said = alone[0].reading
                cut = m.start + len(noun)
                out_m.append(replace(m, surface=noun, end=cut, lemma=noun, reading=said, lemma_reading=said,
                                     kana=alone[0].kana, pos="noun", ctype="", cform="", written=noun, written_reading=said))
                out_t.append(("名詞", "普通名詞", "一般"))
                out_m.append(replace(m, surface="で", start=cut, lemma="だ", reading="で", lemma_reading="だ", kana="デ",
                                     pos="auxiliary", ctype="助動詞-ダ", cform="連用形-一般", written="だ",
                                     written_reading="だ"))
                out_t.append(("助動詞", "*", "*"))
                out_m.append(replace(nxt, lemma="無い", pos="adjective", auxiliary_use=True, ctype="形容詞"))
                out_t.append(("形容詞", "非自立可能", "*"))
                skip.add(i + 1)
                continue
        if (m.surface == "な" and m.pos == "auxiliary" and m.lemma == "だ" and nxt is not None and nxt.surface == "ん"
                and nxt.pos == "particle" and _glued(m, nxt) and after is not None and after.lemma in ("だ", "です")
                and prev is not None and ((prev.pos == "symbol" and prev.surface in ("、", "「", "『", "（"))
                                          or (prev.pos == "particle" and prev.surface in ("は", "も", "って"))
                                          or prev.surface in ("いったい", "一体")
                                          or (prev.surface == "て" and prev.pos == "particle" and i >= 2
                                              and morphemes[i - 2].lemma in ("無い", "ない")))):
            # これが愛でなくてなんだろう, 「なんだろう: 何, "what" -- no copula
            # stands after a clause's て or a mark (plan 296)
            out_m.append(replace(m, surface="なん", end=nxt.end, lemma="何", reading="なん", lemma_reading="なに",
                                 kana="ナン", pos="pronoun", ctype="", cform="", written="何", written_reading="なに"))
            out_t.append(("代名詞", "*", "*"))
            skip.add(i + 1)
            continue
        if (m.surface in ("なん", "何") and m.pos == "pronoun" and nxt is not None and nxt.surface == "だ"
                and after is not None and after.surface in ("かん", "彼") and i + 3 < len(morphemes)
                and morphemes[i + 3].surface == "だ" and _glued(m, nxt) and _glued(nxt, after)
                and _glued(after, morphemes[i + 3])):
            # なんだかんだ言っても: 何だかんだ, "one thing or another", one
            # word -- no copula twice and no 彼 (plan 296)
            last = morphemes[i + 3]
            out_m.append(replace(m, surface=m.surface + "だかんだ", end=last.end, lemma="何だかんだ",
                                 reading="なんだかんだ", lemma_reading="なんだかんだ", kana="ナンダカンダ", pos="adverb",
                                 ctype="", cform="", written="何だかんだ", written_reading="なんだかんだ"))
            out_t.append(("副詞", "*", "*"))
            skip.update({i + 1, i + 2, i + 3})
            continue
        if m.surface == "お" and _spells(morphemes, i, "おおかれすくなかれ"):
            # おおかれすくなかれ in kana: 多かれ少なかれ, one word (plan 296)
            n = _spells(morphemes, i, "おおかれすくなかれ")
            last = morphemes[i + n - 1]
            out_m.append(replace(m, surface="おおかれすくなかれ", end=last.end, lemma="多かれ少なかれ",
                                 reading="おおかれすくなかれ", lemma_reading="おおかれすくなかれ", kana="オオカレスクナカレ",
                                 pos="adverb", ctype="", cform="", written="多かれ少なかれ",
                                 written_reading="おおかれすくなかれ"))
            out_t.append(("副詞", "*", "*"))
            skip.update(range(i + 1, i + n))
            continue
        if (m.surface == "その" and nxt is not None and nxt.surface == "通り" and _glued(m, nxt)
                and (after is None or (after.pos == "symbol" and after.surface in ("。", "！", "!", "？", "」", "、", "…"))
                     or after.lemma in ("だ", "です"))):
            # 「その通り。」, その通りです: "exactly", the reply -- no street
            # (plan 296)
            out_m.append(replace(m, surface="その通り", end=nxt.end, lemma="その通り", reading="そのとおり",
                                 lemma_reading="そのとおり", kana="ソノトオリ", pos="noun", ctype="", cform="",
                                 written="その通り", written_reading="そのとおり"))
            out_t.append(("名詞", "普通名詞", "一般"))
            skip.add(i + 1)
            continue
        if (m.surface == "かん" and m.pos == "pronoun" and nxt is not None and nxt.pos == "suffix"
                and nxt.surface in ("ちゃん", "くん", "さん", "君") and _glued(m, nxt)):
            # かんちゃん: a name before its honorific -- no 彼 (plan 296)
            out_m.append(replace(m, pos="noun", proper=True, name_kind="given", lemma=m.surface, written=m.surface))
            out_t.append(("名詞", "固有名詞", "人名"))
            continue
        if m.surface == "まめ" and m.pos == "other" and nxt is not None and nxt.surface in ("を", "が", "は", "も", "の"):
            # 鬼に向かってまめをまいた: 豆, "beans", a thing -- まめに, まめな
            # are 忠実 (plan 296)
            out_m.append(replace(m, pos="noun", lemma="豆", written="豆", written_reading="まめ"))
            out_t.append(("名詞", "普通名詞", "一般"))
            continue
        if (m.surface in ("なん", "何") and m.pos == "pronoun" and nxt is not None and nxt.surface == "の"
                and after is not None and after.surface in ("かん", "彼") and i + 3 < len(morphemes)
                and morphemes[i + 3].surface == "の" and _glued(m, nxt) and _glued(nxt, after)
                and _glued(after, morphemes[i + 3])):
            # なんのかんのと: 何のかんの, "this and that", one phrase -- no
            # 何, 彼 and two の (plan 296)
            last = morphemes[i + 3]
            out_m.append(replace(m, surface=m.surface + "のかんの", end=last.end, lemma="何のかんの",
                                 reading="なんのかんの", lemma_reading="なんのかんの", kana="ナンノカンノ", pos="noun",
                                 ctype="", cform="", written="何のかんの", written_reading="なんのかんの"))
            out_t.append(("名詞", "普通名詞", "一般"))
            skip.update({i + 1, i + 2, i + 3})
            continue
        if (m.surface == "多かれ" and nxt is not None and nxt.surface == "少なかれ" and _glued(m, nxt)):
            # 多かれ少なかれ: "more or less", one phrase (plan 296)
            out_m.append(replace(m, surface="多かれ少なかれ", end=nxt.end, lemma="多かれ少なかれ",
                                 reading="おおかれすくなかれ", lemma_reading="おおかれすくなかれ", kana="オオカレスクナカレ",
                                 pos="adverb", ctype="", cform="", written="多かれ少なかれ",
                                 written_reading="おおかれすくなかれ"))
            out_t.append(("副詞", "*", "*"))
            skip.add(i + 1)
            continue
        if (m.surface == "なく" and m.pos == "adjective" and m.lemma in ("無い", "ない") and i + 4 < len(morphemes)
                and [u.surface for u in morphemes[i + 1:i + 5]] == ["て", "は", "なら", "ない"]
                and all(_glued(morphemes[k], morphemes[k + 1]) for k in range(i, i + 4))
                and not (prev is not None and prev.pos in ("verb", "auxiliary", "adjective"))):
            # この地域ではなくてはならない, 生活になくてはならない: 無くては
            # ならない, "indispensable", one word -- the verb's own
            # 行かなくてはならない keeps its point (plan 296)
            last = morphemes[i + 4]
            out_m.append(replace(m, surface="なくてはならない", end=last.end, lemma="無くてはならない",
                                 reading="なくてはならない", lemma_reading="なくてはならない", kana="ナクテハナラナイ",
                                 ctype="形容詞", cform=last.cform, written="無くてはならない",
                                 written_reading="なくてはならない"))
            out_t.append(("形容詞", "一般", "*"))
            skip.update({i + 1, i + 2, i + 3, i + 4})
            continue
        if (m.surface == "やっ" and m.pos == "verb" and m.lemma in ("遣る", "やる") and nxt is not None
                and nxt.surface == "た" and nxt.pos == "auxiliary" and (prev is None or (prev.pos == "symbol"
                                                                                   and prev.surface in ("「", "『", "（")))
                and (after is None or (after.pos == "symbol" and after.surface in ("、", "！", "!", "。", "」", "…", "ー")))):
            # やった、ついに合格だ！: "hooray", the cry -- no やる (plan 296)
            out_m.append(replace(m, surface="やった", end=nxt.end, lemma="やった", reading="やった", lemma_reading="やった",
                                 kana="ヤッタ", pos="interjection", ctype="", cform="", written="やった",
                                 written_reading="やった"))
            out_t.append(("感動詞", "一般", "*"))
            skip.add(i + 1)
            continue
        if (m.surface == "やっ" and m.pos in ("verb", "auxiliary") and m.lemma in ("遣る", "やる", "や")
                and nxt is not None and nxt.pos == "auxiliary" and nxt.lemma == "た" and prev is not None
                and _glued(prev, m) and ((prev.pos in ("noun", "pronoun", "suffix") and _said_in_the_west(morphemes, i))
                                         # (休みやったら: a verb's stem takes no やる after it --
                                         # the noun it spells and the west's copula, plan 296)
                                         or (prev.pos == "verb" and prev.cform == "連用形-一般"))):
            # 泣き虫やったんやで, 休みやったら…行かへん: the west's copula や,
            # "was" -- no やる after a noun where the sentence speaks the
            # west's Japanese (plan 296)
            if prev.pos == "verb" and out_m:
                said = kata_to_hira(prev.reading or "")
                out_m[-1] = replace(prev, pos="noun", lemma=prev.surface, lemma_reading=said, ctype="", cform="",
                                    written=prev.surface, written_reading=said)
                out_t[-1] = ("名詞", "普通名詞", "一般")
            out_m.append(replace(m, pos="auxiliary", lemma="や", lemma_reading="や", ctype="助動詞-ヤ",
                                 cform="連用形-促音便", written="や", written_reading="や"))
            out_t.append(("助動詞", "*", "*"))
            continue
        if (m.surface == "せん" and m.pos == "noun" and nxt is not None and nxt.surface == "が"
                and after is not None and after.surface in ("ため", "為") and prev is not None
                and (prev.pos == "particle" or (prev.pos == "auxiliary" and prev.surface == "に") or prev.verbal)):
            # 明らかにせんがため: せ, する's old stem, and ん, the old
            # volitional む, "in order to" -- no 千 (plan 296)
            cut = m.start + 1
            out_m.append(replace(m, surface="せ", end=cut, lemma="為る", reading="せ", lemma_reading="する", kana="セ",
                                 pos="verb", ctype="サ行変格", cform="未然形-セ", written="する", written_reading="する"))
            out_t.append(("動詞", "非自立可能", "*"))
            out_m.append(replace(m, surface="ん", start=cut, lemma="む", reading="ん", lemma_reading="む", kana="ン",
                                 pos="auxiliary", ctype="助動詞-ム", cform="終止形-撥音便", written="む",
                                 written_reading="む"))
            out_t.append(("助動詞", "*", "*"))
            continue
        if (m.pos == "verb" and ((m.lemma in ("因る", "依る", "拠る", "由る")
                                  and m.surface in ("よる", "よっ", "より", "よら"))
                                 or (m.lemma == "鎧う" and m.surface == "よろう"))
                and _drops_in(morphemes, i)):
            # 本屋によると、画集が並んでいた, 神社によろうか: 寄る, "drop in"
            # (plan 296)
            if m.surface == "よろう":
                out_m.append(replace(m, lemma="寄る", lemma_reading="よる", ctype="五段-ラ行", cform="意志推量形",
                                     written="寄る", written_reading="よる"))
            else:
                out_m.append(replace(m, lemma="寄る", written="寄る", written_reading="よる"))
            out_t.append(tags[i])
            continue
        if (m.surface == "よる" and m.pos == "verb" and m.lemma in ("因る", "寄る", "依る", "拠る")
                and not (prev is not None and prev.surface in ("に", "には", "にも")) and nxt is not None
                and nxt.pos == "particle" and nxt.surface in ("に", "は", "も", "が", "の", "まで", "から")):
            # おばけはよるにしか出てこない: 夜, "night" -- no 因る or 寄る
            # takes no に before it (plan 296)
            out_m.append(replace(m, pos="noun", lemma="夜", lemma_reading="よる", ctype="", cform="", written="夜",
                                 written_reading="よる"))
            out_t.append(("名詞", "普通名詞", "副詞可能"))
            continue
        if (m.surface == "何に" and m.pos == "pronoun" and nxt is not None and nxt.surface == "も"
                and after is not None and after.surface in ("まして", "増して")):
            # 何にもまして: 何 and 〜にもまして's に, "above all" (plan 296)
            cut = m.start + 1
            out_m.append(replace(m, surface="何", end=cut, reading="なに", kana="ナニ", written_reading="なに"))
            out_t.append(tags[i])
            out_m.append(replace(m, surface="に", start=cut, lemma="に", reading="に", lemma_reading="に", kana="ニ",
                                 pos="particle", ctype="", cform="", written="に", written_reading="に"))
            out_t.append(("助詞", "格助詞", "*"))
            continue
        if (m.surface == "まして" and m.pos == "adverb" and prev is not None and prev.surface == "も" and i >= 2
                and morphemes[i - 2].surface in ("に", "何に")):
            # 去年にもまして: 増す's て form, "more than" -- no 況して,
            # "let alone" (plan 296)
            out_m.append(replace(m, lemma="増す", lemma_reading="ます", pos="verb", ctype="五段-サ行",
                                 cform="連用形-一般", written="増す", written_reading="ます"))
            out_t.append(("動詞", "一般", "*"))
            continue
        if (m.surface in ("なくなる", "なくなっ", "なくなり", "なくなら", "なくなれ") and m.pos == "verb"
                and m.lemma in ("無くなる", "なくなる") and prev is not None
                and ((prev.pos == "particle" and prev.surface in ("は", "も") and i >= 2
                      and morphemes[i - 2].surface == "で" and morphemes[i - 2].pos == "auxiliary")
                     or (prev.pos in ("adjective", "auxiliary") and prev.surface.endswith("く")))):
            # 楽ではなくなってきた: ない's く and なる, "stopped being (easy)"
            # -- no 無くなる, "be lost", after the copula's では (plan 296)
            cut = m.start + 2
            out_m.append(replace(m, surface="なく", end=cut, lemma="無い", reading="なく", lemma_reading="ない",
                                 kana="ナク", pos="adjective", auxiliary_use=True, ctype="形容詞", cform="連用形-一般",
                                 written="ない", written_reading="ない"))
            out_t.append(("形容詞", "非自立可能", "*"))
            rest = m.surface[2:]
            out_m.append(replace(m, surface=rest, start=cut, lemma="成る", reading=rest, lemma_reading="なる",
                                 kana="".join(chr(ord(c) + 0x60) for c in rest), written="なる", written_reading="なる"))
            out_t.append(("動詞", "非自立可能", "*"))
            continue
        if m.surface == "まめ" and m.pos == "other" and nxt is not None and nxt.surface in ("に", "な", "だ", "で", "さ"):
            # 連絡をまめにする: 忠実, "diligent", the 形状詞 -- no 豆, "beans"
            # (plan 296)
            out_m.append(replace(m, lemma="忠実", written="忠実"))
            out_t.append(tags[i])
            continue
        if (m.surface == "に" and m.pos == "particle" and prev is not None
                and prev.surface in ("適当", "てきとう", "いい加減", "大雑把", "おおざっぱ", "丁寧", "ていねい", "真面目",
                                     "まじめ", "慎重", "熱心", "真剣", "必死", "懸命")
                and nxt is not None and (nxt.lemma in ("為る", "する") or (nxt.pos == "verb" and prev.pos == "noun"))):
            # 片付けを適当にした, 適当に書いて: the な-adjective's に, "sloppily" -- no case
            # particle (plan 296)
            if out_m and out_m[-1] is prev and prev.pos == "noun":
                out_m[-1] = replace(prev, adjectival=True)
            out_m.append(replace(m, lemma="だ", lemma_reading="だ", pos="auxiliary", ctype="助動詞-ダ", cform="連用形-ニ",
                                 written="だ", written_reading="だ"))
            out_t.append(("助動詞", "*", "*"))
            continue
        if (m.surface == "幸多" and m.pos == "noun" and nxt is not None and nxt.surface == "かれ" and _glued(m, nxt)
                and (after is None or after.pos in ("particle", "symbol"))):
            # 幸多かれと祈り: 幸 さち, "happiness", and 多かれ, 多い's old
            # imperative, "may it be full of" -- no name and no 彼 (plan 296)
            cut = m.start + 1
            out_m.append(replace(m, surface="幸", end=cut, lemma="幸", reading="さち", lemma_reading="さち", kana="サチ",
                                 proper=False, name_kind="", written="幸", written_reading="さち"))
            out_t.append(("名詞", "普通名詞", "一般"))
            out_m.append(replace(nxt, surface="多かれ", start=cut, lemma="多い", reading="おおかれ", lemma_reading="おおい",
                                 kana="オオカレ", pos="adjective", ctype="形容詞", cform="命令形", written="多い",
                                 written_reading="おおい"))
            out_t.append(("形容詞", "一般", "*"))
            skip.add(i + 1)
            continue
        if (m.surface == "よる" and m.pos == "verb" and m.lemma in ("因る", "寄る", "依る", "拠る") and nxt is not None
                and nxt.surface in ("、", "，") and (prev is None or prev.pos == "symbol")):
            # よる、母が…: 夜, "at night", heading the sentence -- no verb
            # stands alone before a comma there (plan 296)
            out_m.append(replace(m, pos="noun", lemma="夜", lemma_reading="よる", ctype="", cform="", written="夜",
                                 written_reading="よる"))
            out_t.append(("名詞", "普通名詞", "副詞可能"))
            continue
        if (m.surface == "やっ" and m.pos == "auxiliary" and m.lemma == "や" and nxt is not None
                and nxt.surface in ("た", "て", "たら", "たり") and prev is not None
                and (prev.pos in ("particle", "symbol", "adverb", "pronoun") or prev.verbal
                     or prev.surface in _DONE_WHOLE)):
            # 全部やった, 宿題やった？: やる, "to do" -- no Kansai copula や
            # after what is done (plan 296)
            out_m.append(replace(m, pos="verb", lemma="遣る", lemma_reading="やる", ctype="五段-ラ行", cform="連用形-促音便",
                                 written="やる", written_reading="やる"))
            out_t.append(("動詞", "非自立可能", "*"))
            continue
        if (m.surface == "ん" and m.pos == "auxiliary" and m.lemma == "ず" and nxt is not None and nxt.surface == "が"
                and after is not None and after.surface in ("ため", "為")):
            # 助けんがため: む, the old volitional, "in order to" -- no
            # negative (plan 296)
            out_m.append(replace(m, lemma="む", lemma_reading="む", ctype="助動詞-ム", written="む", written_reading="む"))
            out_t.append(tags[i])
            continue
        if m.surface == "亡き" and m.lemma in ("無い", "ない"):
            # 亡き姉, 亡き父: "the late", a word of its own -- no 無い, "not"
            # (plan 296)
            out_m.append(replace(m, pos="adnominal", lemma="亡き", lemma_reading="なき", ctype="", cform="",
                                 written="亡き", written_reading="なき"))
            out_t.append(("連体詞", "*", "*"))
            continue
        if (m.surface == "なき" and m.lemma in ("無い", "ない") and nxt is not None and nxt.pos == "verb"
                and nxt.lemma in _AFTER_A_CRY):
            # 母はなき出しました: 泣く's stem and 出す, "burst into tears" --
            # no 無い (plan 296); and 大きな声でなき出した's で is the means
            # particle, no copula before a negative
            if out_m and prev is not None and prev.surface == "で" and prev.pos == "auxiliary":
                out_m[-1] = replace(prev, lemma="で", lemma_reading="で", pos="particle", ctype="", cform="",
                                    written="で", written_reading="で")
                out_t[-1] = ("助詞", "格助詞", "*")
            out_m.append(replace(m, pos="verb", lemma="泣く", lemma_reading="なく", ctype="五段-カ行",
                                 cform="連用形-一般", written="泣く", written_reading="なく"))
            out_t.append(("動詞", "一般", "*"))
            continue
        if (m.surface == "名" and prev is not None and nxt is not None and nxt.surface == "も" and after is not None
                and after.lemma in ("無い", "ない")):
            # 名もなき家事, 名もない花: な, "a name" -- no めい, a counter (plan 296)
            out_m.append(replace(m, reading="な", lemma_reading="な", kana="ナ", written_reading="な"))
            out_t.append(tags[i])
            continue
        if (m.surface == "放っ" and m.lemma == "放つ" and nxt is not None
                and ((nxt.surface == "て" and after is not None and after.lemma == "置く")
                     or (nxt.pos == "auxiliary" and nxt.lemma in ("とく", "どく")))
                # (敵の城に間者を放っておいた: sent in, 放つ, plan 296)
                and not _sent_somewhere(morphemes, i)):
            # 放っておく, 放っとけ: 放る, ほうる, "leave alone" -- 放つ, "to
            # fire, to release", takes no おく (矢を放った, plan 296)
            out_m.append(replace(m, lemma="放る", reading="ほうっ", lemma_reading="ほうる", kana="ホウッ",
                                 ctype="五段-ラ行", written="放る", written_reading="ほうる"))
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
_COUNTED_ALL = frozenset({"人", "つ", "匹", "頭", "台", "本", "冊", "枚", "個", "社", "校", "チーム", "名", "羽", "軒"})
_NUMERALS = re.compile(r"^[0-9０-９一二三四五六七八九十百千万何数]+$")


def _all_counted(morphemes, i: int) -> bool:
    """Whether the と at i and its も say "all of them" after a count:
    三人とも来なかった, 二つとも -- a number and its counter (plan 272)."""
    prev = morphemes[i - 1]
    return i >= 2 and prev.surface in _COUNTED_ALL and bool(_NUMERALS.match(morphemes[i - 2].surface)) \
        and morphemes[i - 2].surface not in ("何", "数")


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
    sound = kata_to_hira(pron)
    if spelled and len(sound) == len(spelled) and sound != spelled and all(
            a == b or (a, b) in (("\u305a", "\u3065"), ("\u3058", "\u3062")) for a, b in zip(sound, spelled)):
        # The sound merged づ into ず and ぢ into じ, the spelling keeps
        # them (plan 296): つづら is pronounced ツズラ, and the reading
        # printed over 働きつづけ was はたらきつずけ, a spelling no page has.
        return spelled
    return sound or surface


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
             "lemma": m.lemma, "tags": tag, "start": m.start, "end": m.end}
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
        if site not in origin:
            continue                    # (dropped with the run before it: うわわ〜〜〜っ)
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


def _tag(text: str, offset: int = 0, tagger=None, nodes=None) -> tuple[list[Morpheme], list[tuple]]:
    """MeCab's morphemes for `text`, their offsets counted from `offset`
    (where `text` stands in the sentence), with UniDic's pos1-3 for each
    -- what _in_context's rules read and Morpheme does not carry.
    `tagger` is the kana lexicon's (the default) or UniDic's alone.
    `nodes` is one of MeCab's other readings of the same letters, which
    _next_best asked for, read in place of its best."""
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
    for w in (tagger(read) if nodes is None else nodes):
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


def _compound_verb_at(m, nxt):
    """(lemma, lemma_reading) of the one verb a verb's stem and the verb
    glued after it spell, where the deck or the dictionary holds it as
    a verb -- 言い + 出す, 疲れ + 切る, 見つめ + 直す, はね + 回る -- or
    of a noun and する the deck writes as one (値する); None elsewhere
    (plan 272). 降り出した stays apart: no row writes 降り出す? It does,
    and is joined; 食べ始めた, which no row holds, stays two."""
    if nxt is None or nxt.pos != "verb" or not _glued(m, nxt):
        return None
    if m.pos == "verb" and m.cform.startswith("連用形") and not m.auxiliary_use:
        return _compound_verb(m.surface, kata_to_hira(m.reading), nxt.lemma, kata_to_hira(nxt.lemma_reading), False)
    if m.pos == "noun" and len(m.surface) == 1 and _has_kanji_char(m.surface) and nxt.lemma in ("為る", "する"):
        return _compound_verb(m.surface, kata_to_hira(m.reading), "する", "する", True)
    return None


@lru_cache(maxsize=8192)
def _compound_verb(first: str, first_reading: str, second: str, second_reading: str, deck_only: bool):
    import content.vocab_jmdict_data as jmdict_db
    from content.vocab_data import VOCAB_BY_LEVEL

    reading = first_reading + second_reading
    written = first + second
    for entries in VOCAB_BY_LEVEL.values():
        for entry in entries:
            kanji = entry.get("kanji") or ""
            if kanji == written and reading in kata_to_hira(entry.get("kana") or "").replace(";", "/").split("/"):
                return kanji, reading
    if _kana_letters(first):
        # (A first verb in kana is any verb read so: the deck's one card of
        # the whole reading that ends on the second, 雨がふり出した 降り出す,
        # before JMdict's commonest row, 振り出す, plan 296.)
        mine = {entry.get("kanji") for entries in VOCAB_BY_LEVEL.values() for entry in entries
                if (entry.get("kanji") or "").endswith(second) and len(entry.get("kanji") or "") > len(second)
                and reading in kata_to_hira(entry.get("kana") or "").replace(";", "/").split("/")}
        if len(mine) == 1:
            return next(iter(mine)), reading
    if deck_only:
        return None
    rows = [r for r in jmdict_db.by_kana(reading) or [] if r.get("kana") == reading]
    for row in rows:
        kanji = row.get("kanji") or ""
        # (spelled as the page spells it, or with the page's kana stem
        # in the dictionary's kanji: はね + 回る is 跳ね回る)
        if kanji not in (written, first + second_reading) and not (kanji.endswith(second) and len(kanji) > len(second)):
            continue                   # (疲れきる: the second verb in kana)
        tags = {t for sense in jmdict_db.get_senses(kanji, reading) or [] for t in sense.get("tags") or ()}
        if any(t.startswith(("v1", "v5")) for t in tags):
            return kanji, reading
    return None


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
    return _first_card(reading)[0]


def _first_card(reading: str) -> tuple[str, str | None]:
    """(spelling, level) of the deck's lowest-level card read `reading`;
    (reading, None) where no card is read so."""
    spellings, level = _first_cards(reading)
    return spellings[0], level


@lru_cache(maxsize=4096)
def _first_cards(reading: str) -> tuple[tuple[str, ...], str | None]:
    """The spellings of the deck's cards read `reading` at the lowest
    level that has one, in the deck's order, and that level: ふく is 吹く
    and 服 (N5), えん 円 alone (N5, before 園 and 縁)."""
    from content.vocab_data import VOCAB_BY_LEVEL

    for level in ("N5", "N4", "N3", "N2", "N1"):
        found = tuple(entry.get("kanji") or reading for entry in VOCAB_BY_LEVEL.get(level, [])
                      if reading in (kata_to_hira(k.strip())
                                     for k in (entry.get("kana") or "").replace(";", "/").split("/")))
        if found:
            return found, level
    return (reading,), None


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
# first letter of a word UniDic cut, and a は, which marks what comes
# before it, has nothing there to mark. (で and と open a phrase as
# words of their own: で、 "so", 「…」、と言った's quotative.)
_NO_OPENER = frozenset("かがをにのへもやは")
_PHRASE_OPENS = frozenset("。！？!?「『（(…‥、，,\u3000 ")


# How many of MeCab's readings _next_best looks through: the one a rule
# wants came within the first ten on every line it was written for.
_NBEST = 10


def _next_best(text: str, morphemes: list[Morpheme], i: int, tagger, wanted):
    """MeCab's best reading of the phrase morpheme i stands in, among
    its _NBEST, where `wanted` finds the word a rule is looking for --
    what MeCab itself reads next when its first reading is one the page
    cannot mean (plan 295). `wanted(alt)` is the (start, end) of that
    word in a reading, or None. Returns (k, j, morphemes, tags): what
    replaces morphemes[k:j], the stretch where the two readings differ;
    None where no reading has the word.

    The phrase runs from the mark before morpheme i to the first mark
    after it, so MeCab reads it as it stood, and never across a space,
    which its other readings do not hand back."""
    k = i
    while k > 0 and _glued(morphemes[k - 1], morphemes[k]) and not (
            morphemes[k - 1].pos == "symbol" and morphemes[k - 1].surface in _PHRASE_OPENS):
        k -= 1
    j = i + 1
    while j < len(morphemes) and _glued(morphemes[j - 1], morphemes[j]) \
            and not (morphemes[j - 1].pos == "symbol" and j - 1 > i):
        j += 1
    lo, hi = morphemes[k].start, morphemes[j - 1].end
    window = text[lo:hi]
    if any(c.isspace() and c != "\u3000" for c in window):
        return None
    read, _ = _spoken_reading(window.translate(_FULLWIDTH_DIGITS), tagger)
    for parse in tagger.nbestToNodeList(read, _NBEST):
        alt, alt_tags = _tag(window, lo, tagger, nodes=parse)
        span = wanted(alt)
        if not span:
            continue
        # The shortest stretch both readings begin and end a word on.
        mine = morphemes[k:j]
        left = max((e for e in {u.start for u in mine} & {u.start for u in alt} if e <= span[0]), default=None)
        right = min((e for e in {u.end for u in mine} & {u.end for u in alt} if e >= span[1]), default=None)
        if left is None or right is None:
            return None
        a = k + next(n for n, u in enumerate(mine) if u.start == left)
        b = k + next(n for n, u in enumerate(mine) if u.end == right) + 1
        keep = [n for n, u in enumerate(alt) if left <= u.start and u.end <= right]
        return a, b, [alt[n] for n in keep], [alt_tags[n] for n in keep]
    return None


def _a_deck_noun_at(alt: list[Morpheme], start: int, past: int):
    """(start, end) of a noun of the deck written in kana that begins at
    `start` and runs past `past` in a reading, before a particle, a mark
    or the end: the word _next_best's callers look for."""
    for n, u in enumerate(alt):
        if u.start == start and u.end > past and u.pos == "noun" and not u.unknown \
                and _kana_letters(u.surface) and u.surface in _deck_kana():
            after = alt[n + 1] if n + 1 < len(alt) else None
            if after is None or after.pos in ("particle", "symbol"):
                return u.start, u.end
    return None


def _opened_on_a_particle(morphemes: list[Morpheme], tags: list[tuple], text: str = "",
                          tagger=None) -> tuple[list, list]:
    """A kana word MeCab cut into a particle and the letters after it,
    where what is said opens and no particle can stand (plan 272): かお
    いろが悪い is 顔色, "complexion", which UniDic reads か + お + いろ.
    The longest run of three kana or more from the particle that spells a
    word of the deck or of JMdict (_known) and ends before a particle or
    a mark is read as that word. Where no run of whole words spells one
    after a は, MeCab's next reading that begins a noun of the deck on it
    is taken (plan 295): はこの中には is はこ + の, the box, never は + この."""
    from dataclasses import replace

    out_m, out_t = [], []
    i = 0
    while i < len(morphemes):
        m = morphemes[i]
        opens = i == 0 or (morphemes[i - 1].pos == "symbol" and morphemes[i - 1].surface in _PHRASE_OPENS)
        best = None
        if opens and m.pos == "particle":
            # A phrase of particles alone, closed by a mark, says nothing:
            # its letters are a word the deck writes in kanji where they
            # spell one -- かさ、持ってきた？ is 傘, never か + さ (plan 296).
            # (では、 and でも、 are the deck's conjunctions, written in kana
            # and read as MeCab reads them; a pattern the catalogue writes
            # from its particle, にしか, stands alone, with no mark.)
            j = i
            while j < len(morphemes) and morphemes[j].pos == "particle" and _kana_letters(morphemes[j].surface) \
                    and (j == i or _glued(morphemes[j - 1], morphemes[j])):
                j += 1
            joined = "".join(u.surface for u in morphemes[i:j])
            spellings = _deck_kana().get(joined, ())
            if j - i >= 2 and j < len(morphemes) and morphemes[j].pos == "symbol" \
                    and len(spellings) == 1 and _has_kanji_char(next(iter(spellings))):
                best = (j, joined, next(iter(spellings)))
        if not best and opens and m.pos == "particle" and m.surface in _NO_OPENER:
            j = i + 1
            while j < len(morphemes) and j - i < 5 and _kana_letters(morphemes[j].surface) \
                    and _glued(morphemes[j - 1], morphemes[j]):
                j += 1
                joined = "".join(u.surface for u in morphemes[i:j])
                after = morphemes[j] if j < len(morphemes) else None
                spelled = _known(joined) if len(joined) >= 3 else None
                if spelled and (after is None or after.pos in ("particle", "symbol")):
                    best = (j, joined, spelled)
            # (は alone: it marks what stands before it, so nothing it opens
            # is a fragment of the catalogue's patterns, which open on the
            # others as written -- にちがいない, にしか, のきっての, where
            # MeCab's next reading takes a shorter noun, にち, にし, のき.)
            if not best and text and m.surface == "は":
                start, end = m.start, m.end
                again = _next_best(text, morphemes, i, tagger or _tagger,
                                   lambda alt: _a_deck_noun_at(alt, start, end))
                if again and again[0] == i:
                    _, j, new_m, new_t = again
                    out_m.extend(new_m)
                    out_t.extend(new_t)
                    i = j
                    continue
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


def _no_word_after_the_topic(morphemes: list[Morpheme], tags: list[tuple], text: str,
                             tagger=None) -> tuple[list, list]:
    """What no word can be after the topic は, read as the end of a word
    the は begins (plan 295). Written こ, a child stands after what says
    whose or which -- このこ, うちのこ, いいこ -- and a topic marker says
    neither, so UniDic's 子 standing bare after it is the last letter of
    that word: 二人ではこを運んだ is 二人で + はこ, the box, where MeCab
    read では + 子. So is a kana MeCab read as no word at all, a mark (run
    before _unknown_words glues it to the letters after it): ここではこが
    うれる, では + こ + が. MeCab's next reading that begins a noun of the
    deck on the は is taken; with none (今日はこない's こ is 来る, ではこれで's
    これ, わたしはぷらそにかが's name), the sentence stays as it was read."""
    i = 1
    while i < len(morphemes):
        m, before = morphemes[i], morphemes[i - 1]
        bare = (m.surface == "こ" and m.pos == "noun" and m.lemma == "子") or (
            _kana_letters(m.surface) and (m.unknown or tags[i][0] in ("記号", "補助記号")))
        if bare and before.surface == "は" and before.pos == "particle" and _glued(before, m):
            start, past = before.start, before.end
            again = _next_best(text, morphemes, i, tagger or _tagger,
                               lambda alt: _a_deck_noun_at(alt, start, past))
            if again:
                a, b, new_m, new_t = again
                morphemes = morphemes[:a] + new_m + morphemes[b:]
                tags = tags[:a] + new_t + tags[b:]
                i = a + len(new_m)
                continue
        i += 1
    return morphemes, tags


# The particles of one letter a sentence is made of, which a word cut back
# together may leave beside it (こうえん + で, まど + の).
_ONE_LETTER_PARTICLES = frozenset("のにをがはでともへやかねよなさわぞぜ")


def _a_letter_alone(m: Morpheme, tag: tuple) -> bool:
    """A hiragana letter MeCab read as no word: an interjection or a mark
    of one letter (the え of こう + え + んで)."""
    return len(m.surface) == 1 and _kana_letters(m.surface) and (
        (tag or ("",))[0] in ("感動詞", "記号", "補助記号") or m.pos in ("interjection", "symbol"))


def _no_letter_alone(morphemes: list[Morpheme], tags: list[tuple], text: str,
                     tagger=None) -> tuple[list, list]:
    """A letter MeCab left standing alone between two words, read inside
    the word it belongs to (plan 296). Where a page writes in kana, MeCab
    can find no word for a stretch and strands one letter as an
    interjection or a mark, cutting the words on either side wrongly:
    こうえんで as こう + え + んで, このあかいふく as この + あ + かいふく
    ("recovery"), からいカレー as から + い, まどのそと as ま + どの. A
    one-letter interjection never stands glued between two words, nor
    opens a line glued to the next one (あ、そうだ takes its comma), so its
    letter is taken from MeCab's next reading that puts it in a noun or an
    adjective a first-year page writes in kana (_a_first_year_word), with
    every other word of that reading the deck's own and no word cut that
    the letter did not touch, and that leaves fewer letters alone than it
    found (こうえん + で, この + あかい + ふく, まど + の). With none, the line
    stays as read, for _unknown_words, after this, to take."""
    i = 0
    while i < len(morphemes) - 1:
        m = morphemes[i]
        # (between two words, or opening what is said glued to the word
        # after it: まどのそと as ま + どの -- an interjection that opens a
        # line is followed by its comma, あ、そうだ)
        opens = i == 0 or morphemes[i - 1].pos == "symbol"
        if not (_a_letter_alone(m, tags[i]) and _glued(m, morphemes[i + 1]) and morphemes[i + 1].pos != "symbol"
                and (opens or _glued(morphemes[i - 1], m))):
            i += 1
            continue
        at = m.start

        def wanted(alt, at=at, morphemes=morphemes, tags=tags):
            lo, hi = alt[0].start, alt[-1].end
            alone = sum(1 for u, t in zip(morphemes, tags) if lo <= u.start < hi and _a_letter_alone(u, t))
            if any(u.unknown for u in alt) or sum(1 for u in alt if _a_letter_alone(u, ())) >= alone:
                return None
            for n_, u in enumerate(alt):
                if u.start <= at < u.end and _a_first_year_word(u):
                    # (an adjective's stem only with its ending after it:
                    # あま + すぎる, never なが + の or あつ + まる)
                    after = alt[n_ + 1] if n_ + 1 < len(alt) else None
                    if u.pos == "adjective" and u.cform.startswith("語幹") and not (
                            after is not None and (after.pos in ("auxiliary", "suffix")
                                                   or after.lemma in ("過ぎる", "すぎる"))):
                        return None
                    return u.start, u.end
            return None

        again = _next_best(text, morphemes, i, tagger or _tagger, wanted)
        # (only the letter, the words either side of it and what the word
        # that takes it takes in (あ + し + た as あした) -- まどがわもつうろ
        # がわ is never re-read as もつ + うろ -- none left alone in what
        # it puts back, nor a letter of junk: じむしつ as じ + むし + つ
        # resolves one mark and leaves one)
        taker = next((u for u in again[2] if u.start <= at < u.end), None) if again else None
        if again and taker is not None \
                and all(abs(k - i) <= 1 or (taker.start <= u.start and u.end <= taker.end)
                        for k, u in enumerate(morphemes[again[0]:again[1]], again[0])) \
                and not any(_a_letter_alone(u, t) for u, t in zip(again[2], again[3])) \
                and all(len(u.surface) > 1 or u.pos == "auxiliary"
                        or (u.pos == "particle" and u.surface in _ONE_LETTER_PARTICLES) for u in again[2]) \
                and all(_as_the_deck_spells_it(u) for u in again[2]) \
                and not _cuts_a_word([u for k, u in enumerate(morphemes[again[0]:again[1]], again[0])
                                      if abs(k - i) > 1], again[2]):
            a, b, new_m, new_t = again
            morphemes = morphemes[:a] + new_m + morphemes[b:]
            tags = tags[:a] + new_t + tags[b:]
            i = a + len(new_m)
            continue
        i += 1
    return morphemes, tags


# What a case particle is: after one, a と is a word's last letter (plan 296).
_CASE_AFTER_TO = frozenset({"へ", "まで", "を", "が", "に", "で", "から", "より"})


def _a_word_before_its_particle(morphemes: list[Morpheme], tags: list[tuple]) -> tuple[list, list]:
    """A word in kana MeCab cut on its last letter と, read whole where a
    case particle follows (plan 296): きょう + と + へ is きょうと, 京都,
    then へ; せい + と + に is せいと, 生徒, then に. A と that joins, goes
    with or quotes takes no case particle after it -- nobody says 友だちと
    へ -- so it is the last letter of what the deck, or JMdict's commonest
    row, spells (_known): きょうとではなく, きょうとまで."""
    out_m, out_t, skip = [], [], False
    for i, m in enumerate(morphemes):
        if skip:
            skip = False
            continue
        nxt = morphemes[i + 1] if i + 1 < len(morphemes) else None
        after = morphemes[i + 2] if i + 2 < len(morphemes) else None
        if (m.pos in ("noun", "pronoun") and _kana_letters(m.surface) and nxt is not None and nxt.surface == "と"
                and nxt.pos == "particle" and not nxt.conjunctive and after is not None
                and after.surface in _CASE_AFTER_TO and after.pos in ("particle", "auxiliary")
                and _glued(m, nxt) and _glued(nxt, after)):
            joined = m.surface + "と"
            word = _known(joined) if len(joined) >= 3 else None
            if word:
                out_m.append(replace(m, surface=joined, end=nxt.end, lemma=word, reading=joined, lemma_reading=joined,
                                     kana=m.kana + nxt.kana, pos="noun", ctype="", cform="", proper=False,
                                     name_kind="", unknown=False, written="", written_reading=""))
                out_t.append(("名詞", "普通名詞", "一般"))
                skip = True
                continue
        out_m.append(m)
        out_t.append(tags[i])
    return out_m, out_t


def _deck_level_of(u: Morpheme) -> str | None:
    """The level of the deck's card a verb or an adjective is, by its lemma
    and its reading; None where the deck has none."""
    spellings, level = _first_cards(kata_to_hira(u.lemma_reading or ""))
    return level if level and (u.lemma in spellings or kata_to_hira(u.lemma_reading or "") in spellings) else None


_RANKS = {"N5": 0, "N4": 1, "N3": 2, "N2": 3, "N1": 4}


def _particle_in_a_verb(morphemes: list[Morpheme], tags: list[tuple], text: str,
                        tagger=None) -> tuple[list, list]:
    """A は or も MeCab took for the first letter of a verb, read back as
    the particle where its next reading leaves a verb the deck teaches,
    where the one it read has none, or after a noun one three levels
    above it (plan 296): 友だちには + かさない, 貸す (N5) where it read はかさ,
    穿かす, which the deck has no card for; どこにも + とまらずに, 止まる
    over もとまら, 求まる; 今夜は + ねない, 寝る (N5) over はね, 跳ねる (N2).
    Only where a particle can stand: after a noun or a case particle."""
    if tagger is None:
        return morphemes, tags
    i = 1
    while i < len(morphemes):
        m, prev = morphemes[i], morphemes[i - 1]
        nxt = morphemes[i + 1] if i + 1 < len(morphemes) else None
        # (...or an adverb before a case particle, which no adverb takes:
        # 足 + もう + で + も is 足 + も + うで + も, legs and arms)
        adverb = m.pos == "adverb" and nxt is not None and nxt.pos == "particle" \
            and nxt.surface in ("で", "を", "が", "に") and _glued(m, nxt)
        if not ((m.pos in ("verb", "adjective") or adverb) and m.surface[:1] in ("は", "も") and len(m.surface) >= 2
                and _kana_letters(m.surface) and _glued(prev, m)
                and (prev.pos in ("noun", "pronoun", "suffix")
                     or (prev.pos == "particle" and prev.surface in ("に", "で", "と", "から", "まで", "へ", "より")))):
            i += 1
            continue
        mine = None if adverb else _deck_level_of(m)
        at, end, after_noun = m.start, m.end, prev.pos in ("noun", "pronoun", "suffix")

        def wanted(alt, at=at, end=end, mine=mine, adverb=adverb, after_noun=after_noun):
            for n_, u in enumerate(alt[:-1]):
                v = alt[n_ + 1]
                if not (u.start == at and u.pos == "particle" and len(u.surface) == 1 and v.start == at + 1):
                    continue
                if adverb and v.pos == "noun" and _a_first_year_word(v):
                    return u.start, v.end
                # (the verb is the rest of the word, read as its own reading
                # begins: never もどる as も + 取る voiced, はさんだ as は + さ
                # + ん)
                said, own = kata_to_hira(v.reading or ""), kata_to_hira(v.lemma_reading or "")
                if adverb or v.pos not in ("verb", "adjective") or v.end != end or said[:1] != own[:1]:
                    continue
                level = _deck_level_of(v)
                # (a card the deck has over a word it has none for -- はかさ,
                # 穿かす; もとまら, 求まる -- or one three levels above after
                # a noun: 今夜は + 寝る over 跳ねる, never 若者には + やる over
                # 流行る, nor 道からは + 慣れる over 離れる)
                if level and (mine is None or (after_noun and _RANKS[mine] - _RANKS[level] >= 3)):
                    return u.start, v.end
            return None

        again = _next_best(text, morphemes, i, tagger, wanted)
        if again and again[0] >= i - 1 and again[1] <= i + 2:
            morphemes = morphemes[:again[0]] + again[2] + morphemes[again[1]:]
            tags = tags[:again[0]] + again[3] + tags[again[1]:]
        i += 1
    return morphemes, tags


# What follows a name and keeps it one (plan 296).
_HONORIFICS_AFTER = frozenset({"さん", "くん", "君", "ちゃん", "様", "さま", "先生", "せんせい", "殿", "氏", "選手"})


def _not_a_full_name(morphemes: list[Morpheme], tags: list[tuple], text: str, tagger=None) -> tuple[list, list]:
    """A family name and a given name MeCab read in a learner's kana where
    the letters are common words (plan 296): まえのせきが高い is 前の席,
    はしのせき 端の席, 高いへいの上 高い and 塀 -- a full name, partly in
    hiragana, no honorific after it, read again as MeCab's next reading
    that names no one, knows every word and leaves no letter alone.
    けんたが and ゆうたと, a given name alone, stay names, as does a name an
    honorific follows."""
    if tagger is None:
        return morphemes, tags

    def kana(word: str) -> bool:
        return bool(word) and all("ぁ" <= c <= "ゖ" or c == "ー" for c in word)

    i = 0
    while i < len(morphemes) - 1:
        m, n = morphemes[i], morphemes[i + 1]
        after = morphemes[i + 2] if i + 2 < len(morphemes) else None
        if not (m.proper and n.proper and m.name_kind == "family" and n.name_kind == "given" and _glued(m, n)
                and (kana(m.surface) or kana(n.surface))
                and not (after is not None and after.surface in _HONORIFICS_AFTER)):
            i += 1
            continue

        def wanted(alt, lo=m.start, hi=n.end):
            over = [u for u in alt if u.start < hi and lo < u.end]
            if not over or any(u.proper or u.unknown for u in over) or not any(u.pos == "noun" for u in over):
                return None
            if any(len(u.surface) == 1 and u.pos not in ("particle", "auxiliary") for u in over):
                return None
            return over[0].start, over[-1].end

        again = _next_best(text, morphemes, i, tagger, wanted)
        if again and again[0] >= i - 1 and again[1] <= i + 3:
            morphemes = morphemes[:again[0]] + again[2] + morphemes[again[1]:]
            tags = tags[:again[0]] + again[3] + tags[again[1]:]
        i += 1
    return morphemes, tags


def _addressee(morphemes: list[Morpheme], tags: list[tuple], text: str, tagger=None) -> tuple[list, list]:
    """The name a letter opens on (plan 296): 森様、二週間の…では is Mr
    Mori, never "forest" -- a noun with 様 or さん and a comma, opening the
    text or a quotation, read as MeCab's next reading of it as a family
    name, where it has one. (Not in running text, where a title follows
    common words: お客様, 神様, 皆様.)"""
    if tagger is None or len(morphemes) < 3:
        return morphemes, tags
    m = morphemes[0]
    if not (m.pos == "noun" and not m.proper and any("\u4e00" <= c <= "\u9fff" for c in m.surface)
            and morphemes[1].surface in ("様", "さま", "さん") and morphemes[2].surface in ("、", "，")):
        return morphemes, tags

    def wanted(alt, lo=m.start, hi=m.end):
        hit = next((u for u in alt if u.start == lo and u.end == hi), None)
        return (lo, hi) if hit is not None and hit.proper and hit.name_kind == "family" else None

    again = _next_best(text, morphemes, 0, tagger, wanted)
    if again and again[0] == 0 and again[1] <= 2:
        morphemes = again[2] + morphemes[again[1]:]
        tags = again[3] + tags[again[1]:]
    return morphemes, tags


def _signature(morphemes: list[Morpheme], tags: list[tuple], text: str, tagger=None) -> tuple[list, list]:
    """The name a letter is signed with (plan 296): アナより, alone on its
    line, is from Ana, never "announcer" -- a noun and より and nothing
    else, read as MeCab's next reading of the noun as a name, where it has
    one (コーヒーより, an exam's "than coffee", has none) and the course
    has no card for it."""
    words = [u for u in morphemes if u.pos != "symbol"]
    if tagger is None or len(words) != 2 or words[0].pos != "noun" or words[0].proper \
            or words[1].surface != "より" or words[1].pos != "particle":
        return morphemes, tags
    m = words[0]
    i = morphemes.index(m)
    # (A word the course teaches keeps its card: 心より, "from the heart",
    # 母より, from Mother.)
    if _deck_word(m.surface) or any(not kanji and kana == m.surface for kanji, kana in _deck_forms()):
        return morphemes, tags

    def wanted(alt, lo=m.start, hi=m.end):
        hit = next((u for u in alt if u.start == lo and u.end == hi), None)
        return (lo, hi) if hit is not None and hit.proper and hit.name_kind in ("given", "family", "person") else None

    again = _next_best(text, morphemes, i, tagger, wanted)
    if again and again[0] == i and again[1] <= i + 1:
        morphemes = morphemes[:i] + again[2] + morphemes[again[1]:]
        tags = tags[:i] + again[3] + tags[again[1]:]
    return morphemes, tags


def _it_hurts(morphemes: list[Morpheme], tags: list[tuple], text: str, tagger=None) -> tuple[list, list]:
    """いたい after a が is 痛い, "it hurts", where MeCab read 居る's い and
    たい, "want to be" (plan 296): 足が少しいたい. 居たい is said of who
    wants to stay somewhere (ここにいたい), never of a thing that has a が
    and no place. Before なる, いたく is 痛い's く form, never the adverb
    痛く, "deeply" (うでもいたくなりました; いたく感動した keeps it)."""
    i = 0
    while i < len(morphemes) - 1:
        m, nxt = morphemes[i], morphemes[i + 1]
        if m.surface == "いたく" and m.pos == "adverb" and nxt.lemma in ("成る", "なる"):
            morphemes[i] = replace(m, lemma="痛い", lemma_reading="いたい", pos="adjective", ctype="形容詞",
                                   cform="連用形-一般", written="痛い", written_reading="いたい")
            tags[i] = ("形容詞", "一般", "*")
            i += 1
            continue
        if not (m.surface == "い" and m.lemma in ("居る", "いる") and nxt.surface.startswith("た")
                and nxt.lemma == "たい" and _glued(m, nxt) and tagger is not None):
            i += 1
            continue
        k = i - 1
        while k >= 0 and morphemes[k].pos == "adverb":
            k -= 1
        if not (k >= 0 and morphemes[k].surface == "が" and morphemes[k].pos == "particle"
                and not any(u.surface == "に" and u.pos == "particle" for u in morphemes[max(0, k - 3):k])):
            i += 1
            continue
        at = m.start

        def wanted(alt, at=at):
            return next(((u.start, u.end) for u in alt if u.start == at and u.pos == "adjective"
                         and u.lemma == "痛い"), None)

        again = _next_best(text, morphemes, i, tagger, wanted)
        if again and again[0] >= i - 1 and again[1] <= i + 3:
            morphemes = morphemes[:again[0]] + again[2] + morphemes[again[1]:]
            tags = tags[:again[0]] + again[3] + tags[again[1]:]
        i += 1
    return morphemes, tags


def _a_first_year_word(u: Morpheme) -> bool:
    """A noun or an adjective of two letters or more that a first-year
    page writes in kana (N5, N4), spelled as the deck spells it: the word
    a letter left alone is taken into (こうえん 公園, あかい 赤い, まど 窓)
    -- never a verb's stem MeCab offers in its place (にかい as に + 買い)."""
    if len(u.surface) < 2 or u.pos not in ("noun", "adjective") or u.unknown:
        return False
    said = kata_to_hira(u.lemma_reading or "")
    spellings, level = _first_cards(said)
    # (a card the deck writes in kana is the word read so, whatever kanji
    # UniDic files it under: うそ, 嘘 to UniDic)
    return level in ("N5", "N4") and (u.lemma in spellings or said in spellings)


def _cuts_a_word(mine: list[Morpheme], theirs: list[Morpheme]) -> bool:
    """Whether another reading cuts a word of two letters or more the
    first one read -- ながねん (長年) as なが + ねん -- where it was only to
    take a letter left alone into the word it belongs to. (The caller
    leaves out the words either side of that letter, which MeCab misread
    around it: この + あ + かいふく's かいふく is cut for あかい + ふく.)"""
    edges = {u.start for u in theirs} | {u.end for u in theirs}
    return any(len(u.surface) >= 2 and u.pos in ("noun", "verb", "adjective", "adverb") and not u.unknown
               and any(u.start < e < u.end for e in edges) for u in mine)


def _as_the_deck_spells_it(u: Morpheme) -> bool:
    """Whether a word of MeCab's other reading is the one a page in kana
    means: a particle or an ending, or a word the deck teaches under that
    reading, spelled as one of the deck's commonest cards read so spells
    it (こうえん is 公園, あかい 赤い, ふく 服 or 吹く). MeCab's other readings of kana take any word read
    so -- ごふん as 御 + 糞, えん as 園, かえさ as 孵す -- and a missing
    meaning beats a guessed one (plan 296)."""
    if u.pos in ("particle", "auxiliary"):
        return not u.unknown
    # (a suffix or a prefix too: えん as the suffix 園, ご as 御 before
    # ほんにん, where the page said 円 and 五)
    said = kata_to_hira(u.lemma_reading or "")
    spellings, level = _first_cards(said)
    return level is not None and (u.lemma in spellings or said in spellings)


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


def _katakana_marks(morphemes: list[Morpheme], tags: list[tuple]) -> tuple[list, list]:
    """Katakana letters MeCab read as marks, one by one, as the one word
    they spell (plan 296): the kettle 「ミナモ」 came out ミ, ナ, モ, three
    symbols the breakdown dropped. The katakana twin of _unknown_words,
    which reads hiragana alone: a glued run of two or more one-letter
    katakana UniDic files as 記号, a word no dictionary has, most often a
    name."""
    out_m, out_t = [], []
    i = 0
    while i < len(morphemes):
        j = i
        while (j < len(morphemes) and len(morphemes[j].surface) == 1 and _katakana_only(morphemes[j].surface)
               and morphemes[j].surface != "ー" and tags[j][0] == "記号" and (j == i or _glued(morphemes[j - 1], morphemes[j]))):
            j += 1
        if j - i >= 2:
            out_m.append(_merged(morphemes[i:j], unknown=True))
            out_t.append(("名詞", "普通名詞", "一般"))
            i = j
            continue
        out_m.append(morphemes[i])
        out_t.append(tags[i])
        i += 1
    return out_m, out_t


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
        morphemes, tags = _no_word_after_the_topic(morphemes, tags, text, tagger)
        morphemes, tags = _no_letter_alone(morphemes, tags, text, tagger)
        morphemes, tags = _unknown_words(text, morphemes, tags)
        morphemes, tags = _katakana_marks(morphemes, tags)
        morphemes, tags = _opened_on_a_particle(morphemes, tags, text, tagger)
        morphemes, tags = _a_word_before_its_particle(morphemes, tags)
        morphemes, tags = _particle_in_a_verb(morphemes, tags, text, tagger)
        morphemes, tags = _it_hurts(morphemes, tags, text, tagger)
        morphemes, tags = _not_a_full_name(morphemes, tags, text, tagger)
        morphemes, tags = _addressee(morphemes, tags, text, tagger)
        morphemes, tags = _signature(morphemes, tags, text, tagger)
        morphemes, tags = _kana_names(morphemes, tags)
        _demonstratives(morphemes)
        _picture(morphemes)
        morphemes, tags = _notice(morphemes, tags)
        _one_kana_nouns(morphemes)
        _all_through(morphemes, tags)
        morphemes, tags = _times_or_floor(morphemes, tags)
        _jiru_not_zuru(morphemes)
        _which_verb(morphemes)
        morphemes, tags = _the_transitive_can(morphemes, tags)
        _radical_hen(morphemes)
        _soko_de_aru(morphemes)
        morphemes, tags = _apart_inside_a_clause(morphemes, tags)
        morphemes, tags = _whether_or_not(morphemes, tags)
        _shops(morphemes, tags)
        morphemes, tags = _sleep(morphemes, tags)
        morphemes, tags = _pain(morphemes, tags)
        morphemes = _went(morphemes)
        morphemes, tags = _how_many_minutes(morphemes, tags)
        morphemes, tags = _not_a_passive(morphemes, tags)
        _opens_of_itself(morphemes, tags)
        morphemes, tags = _looks_so(morphemes, tags)
        morphemes, tags = _lost(morphemes, tags)
        morphemes, tags = _no_honorific_after_a_stem(morphemes, tags)
        morphemes, tags = _done_after_an_adverb(morphemes, tags)
        _place_de(morphemes, tags)
        _case_de(morphemes, tags)
        _ni_of_a_noun(morphemes, tags)
        _first_time(morphemes)
        _verb_stems(morphemes, tags)
        _toii_toii(morphemes, tags)
        _how_one_goes(morphemes)
        morphemes, tags = _how_by_doing(morphemes, tags)
        _copula_de(morphemes, tags)
        morphemes, tags = _spoken_kana(morphemes, tags)
        morphemes, tags = _katakana_adjectives(morphemes, tags)
        morphemes, tags = _zu_words(morphemes, tags)
        morphemes, tags = _cut_words(morphemes, tags)
        morphemes, tags = _introduced(morphemes, tags)
        morphemes, tags = _no_names(morphemes, tags)
        morphemes, tags = _named_animals(morphemes, tags)
        morphemes, tags = _pet_names(morphemes, tags)
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
