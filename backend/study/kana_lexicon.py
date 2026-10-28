"""The deck's words as a beginner's page writes them: in kana (plan 272).

UniDic knows a word's kanji spelling and, for the commonest words, its
kana one too (ごはん, ひらがな, かわいい). A first-year page writes far
more in kana than that -- 図書館 as としょかん, 喫茶店 as きっさてん,
辞書 as じしょ -- and where MeCab finds no word it cuts the letters into
whatever words it has: と + しょ + かん, きっさ (喫する "to eat") + て +
ん, じ + しょ. Measured over the deck, 136 of the 318 N5 nouns and
adjectives of three kana or more came apart written in kana, and the
breakdown of 午後はとしょかんでべんきょうします -- one of the app's own N5
comprehension texts -- was はと ("pigeon") + しょ + か + んで.

So the deck's kana spellings are given to MeCab as a user dictionary:
every noun, な-adjective and adverb of the deck whose kana spelling the
tokenizer does not already read as one word, with the kanji word's own
features -- its part of speech and its lemma, so the lookups find the
card by it (resolve_lemma) exactly as they find 図書館 written in kanji.
MeCab still chooses: an entry is a word it may take, at a cost, and the
cost is set where a word the page really wrote in kana wins over letters
cut into nothing, and loses to real words beside each other -- the せい
and か of 年齢のせいか stay the noun and the particle, never 成果 read
せいか; the おく + が + いたく of 右のおくがいたくなる never 屋外. Measured
over the 7,625 sentences the app teaches and 8,000 of Tatoeba's, every
change the dictionary makes at these costs is a word put back together.

Built at import, against the dictionary installed beside it (its context
ids come from that dictionary's own definitions), in a few hundredths of
a second, and kept in the temp directory under a digest of its entries.
Nothing here is required: an entry list that will not compile, or a
fugashi without the compiler, leaves the tokenizer as it was.
"""
import contextlib
import csv
import hashlib
import io
import logging
import os
import tempfile

logger = logging.getLogger(__name__)

# The parts of speech a kanji spelling may be made of to be entered: the
# words that do not conjugate. A verb or an い-adjective written in kana
# is a dozen forms to UniDic, each an entry of its own, and the kana
# spellings of the commonest are already there.
_ENTERED_POS = frozenset({"名詞", "接尾辞", "接頭辞", "形状詞", "副詞"})

# The cost of an entry, by its level and its length in kana (_cost).
# MeCab's word costs run from about -5,000 for a particle to 15,000 for
# the rarest words; a cut into nothing (a kana read as a mark, a filler
# mid-word) costs more than these, real words beside each other less.
# Three kana are the likeliest to be the letters of two words (のせい +
# か, ね + たほう), and pay the most.
_MIN_KANA = 3

# A spelling the page writes for something else far more often than for
# the deck's word, whatever the cost: きって is 切手 "stamp" in
# きってを二枚ください but the first letters of the set phrase 〜きっての
# ("the best in ...", 県きっての名医) as often, where the stamp is wrong.
_NOT_ENTERED = frozenset({"きって"})



def _cost(kana: str, level: str) -> int | None:
    """What an entry costs MeCab, or None for a spelling not entered.

    A first-year page's words (N5 to N3) from three kana. Past N3 a word
    in kana is rarer than the letters of other words it would swallow --
    the three-kana N1 and N2 entries were nearly all of what misread
    ordinary text (他方 for the ね + たほう of ねたほうがいい, 把握 for the
    は + あく of 窓はあく) -- so those come in from four kana, dearer: a
    longer word is the one that keeps a shorter entry from matching
    inside it (かいがら, 貝殻, which 絵画 read かいが took otherwise)."""
    n = len(kana)
    if level in ("N5", "N4", "N3"):
        return 12000 if n == 3 else 11000 if n == 4 else 10000
    if n < 4:
        return None
    return 13000 if n == 4 else 12000

# Words of a child's day that a picture book writes in kana and the deck
# has no card for (the pool's), entered as a first-year word is: MeCab
# cut ほいくえん into ほいく + え + んで, みずたまり into み + ず + たまり
# (見る's negative), おえかき into two interjections and a fence (plan 272).
_PAGE_WORDS = (("保育園", "ほいくえん"), ("水たまり", "みずたまり"), ("お絵かき", "おえかき"))

# A word written from a numeral is its numeral and its counter to the
# tokenizer, in kana as in kanji (いち + ど), and its spelling is too often
# something else: いつか is "someday" far more often than 五日, ようか the
# よう + か of しようか more often than 八日.
_NUMERALS = frozenset("一二三四五六七八九十百千万億")


def _hiragana(text: str) -> bool:
    return bool(text) and all("ぁ" <= c <= "ゟ" for c in text)


def _katakana(text: str) -> str:
    return "".join(chr(ord(c) + 0x60) if "ぁ" <= c <= "ゖ" else c for c in text)


def _readings(kana_field: str) -> list[str]:
    # The deck joins several readings with "/" (毎月 まいげつ/まいつき).
    return [r.strip() for r in (kana_field or "").replace(";", "/").split("/") if r.strip()]


_LEVEL_RANK = {"N5": 0, "N4": 1, "N3": 2, "N2": 3, "N1": 4}

_GLOSS_STOP = frozenset({"to", "the", "a", "an", "of", "in", "on", "at", "for", "and", "or", "be", "one",
                         "esp", "etc", "something", "someone", "with", "by", "as", "from"})


def _gloss_words(text: str) -> set[str]:
    import re
    words = {w.strip(".") for w in re.findall(r"[a-z][a-z'.]*", (text or "").lower())}
    return {w[:-1] if len(w) > 3 and w.endswith("s") and not w.endswith("ss") else w
            for w in words if len(w) > 2 and w not in _GLOSS_STOP}


_SPEECH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "datas", "vocab", "sources",
                       "opensubtitles_ja_50k.txt")
# A word the subtitles say this often is one a page may well mean.
_SPOKEN = 30


def _spoken_counts() -> dict[str, int]:
    """How often each word is said in the OpenSubtitles list the deck is
    measured against (plan 109): a word's place in speech, where JMdict's
    rank is a newspaper's (幹事, "organiser", is its ninth)."""
    out: dict[str, int] = {}
    try:
        with open(_SPEECH, encoding="utf-8") as f:
            for line in f:
                word, _, count = line.rstrip("\n").rpartition(" ")
                if word and count.isdigit():
                    out[word] = int(count)
    except OSError:
        pass
    return out


def _homophone(kana: str, entry: dict, spelled: dict, spoken: dict, strict: bool = False) -> bool:
    """Whether the page may well mean another word by `kana` (a missing
    meaning beats a guessed one): a deck card or a JMdict word read so,
    with a gloss that shares nothing with this one's, said at least a
    third as often as this word's own spelling in the subtitles, and
    often at all. がっき is 楽器 as often as 学期, じしん 自信 and 自身
    more than 地震, ふくしゅう 復讐 "revenge" more than 復習 "review"; but
    こうえん is 公園, whatever 講演 and 後援, and しょうひん 商品, whatever
    賞品. The same word in another spelling (受け付け beside 受付) shares
    a gloss word and is no rival.

    `strict`, for a word past a first-year text's (N2, N1): any rival at
    all. The subtitles' count is a film's -- せんとう is 戦闘 "battle" there
    -- and a page that writes such a word in kana is a child's, where
    せんとう is 銭湯, the public bath."""
    from content import vocab_jmdict_data as jmdict

    kanji = entry.get("kanji") or ""
    mine = _gloss_words(entry.get("meaning") or "")
    floor = 0 if strict else max(_SPOKEN, spoken.get(kanji, 0) / 3)
    rivals = [(other.get("kanji") or "", other.get("meaning") or "") for other in spelled.get(kana, ())]
    rivals += [(row.get("kanji") or "", row.get("meaning") or "") for row in jmdict.by_kana(kana, limit=12)]
    return any(written and written != kanji and spoken.get(written, 0) >= floor
               and not _same_word(kanji, mine, written, meaning)
               for written, meaning in rivals)


def _kanji_of(text: str) -> set[str]:
    return {c for c in text if "\u4e00" <= c <= "\u9fff" or c == "\u3005"}


def _same_word(kanji: str, gloss: set[str], written: str, meaning: str) -> bool:
    """Whether a rival read alike is this word in another spelling: one of
    its kanji written in kana (貝がら beside 貝殻, 受け付け beside 受付),
    or a gloss sharing a word with this one's."""
    mine, theirs = _kanji_of(kanji), _kanji_of(written)
    if theirs and mine and (theirs <= mine or mine <= theirs):
        return True
    return bool(gloss & _gloss_words(meaning))


# The endings a verb or an adjective takes, as UniDic writes them.
_ENDINGS = frozenset({"ない", "た", "だ", "て", "で", "ます", "ば", "たら", "だら", "ず", "ぬ", "う", "よう",
                      "れる", "られる", "せる", "させる", "たい", "ちゃう", "じゃう", "ても", "でも", "たり", "だり"})


def _conjugated(parts) -> bool:
    """Whether UniDic reads the letters as a verb or an adjective and its
    endings: いない is the い + ない of 誰もいない far more often than 以内,
    あいて the 開いて of ドアがあいて than 相手 -- but かい + がら is no form
    of 買う (the かいがら it cut is 貝殻), nor きっさ + て + ん one of 喫する
    (きっさてん is 喫茶店)."""
    return (bool(parts) and parts[0].feature.pos1 in ("動詞", "形容詞")
            and all((p.feature.pos1 == "助動詞" or p.feature.pos2 == "接続助詞")
                    and (p.feature.orthBase or p.surface) in _ENDINGS for p in parts[1:]))


def rows(tagger) -> list[list[str]]:
    """The user dictionary's entries, as MeCab's CSV rows (surface, left
    and right context ids left for the compiler to fill in, cost, then
    UniDic's 26 feature fields), sorted. `tagger` is a plain one, without
    this dictionary: what MeCab reads WITHOUT it is what decides."""
    from content.vocab_data import VOCAB_BY_LEVEL

    spelled: dict[str, list[dict]] = {}
    for entries in VOCAB_BY_LEVEL.values():
        for entry in entries:
            for kana in _readings(entry.get("kana") or ""):
                spelled.setdefault(kana, []).append(entry)
    spoken = _spoken_counts()

    chosen: dict[str, tuple[int, str, list, int]] = {}
    for level in ("N5", "N4", "N3", "N2", "N1"):
        rank = _LEVEL_RANK[level]
        for entry in VOCAB_BY_LEVEL.get(level, ()):
            kanji = entry.get("kanji") or ""
            # One kanji is a short spelling many words share (ちゅう is 中
            # and the ちゅう of every 〜ちゅう), and a numeral's is its own.
            if len(kanji) < 2 or kanji[0] in _NUMERALS:
                continue
            for kana in _readings(entry.get("kana") or ""):
                cost = _cost(kana, level)
                if cost is None or not _hiragana(kana) or len(kana) < _MIN_KANA or kana in _NOT_ENTERED:
                    continue
                if _homophone(kana, entry, spelled, spoken, strict=level in ("N2", "N1")):
                    continue
                parts = list(tagger(kanji))
                if not parts or any(p.feature.cType not in (None, "*") or p.feature.pos1 not in _ENTERED_POS
                                    for p in parts):
                    continue
                alone = list(tagger(kana))
                if len(alone) == 1 and not alone[0].is_unk:
                    # MeCab reads it as a word already (ないしょ, ひらがな,
                    # うるさい), and may read it as that word on the page.
                    continue
                if _conjugated(alone):
                    continue
                held = chosen.get(kana)
                # The commonest of the words a spelling may be: the lowest
                # level, then the deck's order.
                if held is None or rank < held[0]:
                    chosen[kana] = (rank, kanji, parts, cost)
    for kanji, kana in _PAGE_WORDS:
        # (the few a picture book writes in kana that the deck has no
        # card for: ほいくえんで was ほいく + え + んで, plan 272)
        parts = list(tagger(kanji))
        if kana not in chosen and parts and all(p.feature.cType in (None, "*") for p in parts):
            chosen[kana] = (_LEVEL_RANK["N4"], kanji, parts, _cost(kana, "N4"))
    out = []
    for kana, (_, kanji, parts, cost) in sorted(chosen.items()):
        out.append(_row(kana, kanji, parts, cost))
    return out


def _row(kana: str, kanji: str, parts: list, cost: int) -> list[str]:
    head = parts[0].feature
    if len(parts) == 1:
        pos = [head.pos1, head.pos2, head.pos3, head.pos4]
        accent = head.aType or "*"
    else:
        # A compound the short unit cuts in two (喫茶 + 店) is one noun
        # written in kana.
        pos = ["名詞", "普通名詞", "一般", "*"]
        accent = "*"
    spelled = _katakana(kana)
    features = [
        *(p or "*" for p in pos),
        "*", "*",            # cType, cForm: none
        spelled, kanji,      # lForm, lemma
        kana, spelled,       # orth, pron
        kana, spelled,       # orthBase, pronBase
        head.goshu or "*",   # goshu
        "*", "*", "*", "*",  # iType, iForm, fType, fForm
        spelled, spelled,    # kana, kanaBase
        spelled, spelled,    # form, formBase
        "*", "*",            # iConType, fConType
        accent, "*", "*",    # aType, aConType, aModType
    ]
    return [kana, "", "", str(cost), *features]


@contextlib.contextmanager
def _quiet():
    """The compiler reports its progress on the process's own stdout and
    stderr, past Python's streams: a boot log is no place for a progress
    bar."""
    saved = []
    try:
        for fd in (1, 2):
            saved.append((fd, os.dup(fd)))
            devnull = os.open(os.devnull, os.O_WRONLY)
            os.dup2(devnull, fd)
            os.close(devnull)
        yield
    finally:
        for fd, copy in saved:
            os.dup2(copy, fd)
            os.close(copy)


def build(tagger, dicdir: str) -> str | None:
    """The compiled user dictionary's path, or None where it cannot be
    made. Kept under a digest of the entries and of the dictionary it is
    compiled against, so a deck or a dictionary that changes is a new
    file, and a second process finds the first one's."""
    import fugashi

    entries = rows(tagger)
    if not entries:
        return None
    text = io.StringIO()
    writer = csv.writer(text, lineterminator="\n")
    for row in entries:
        writer.writerow(row)
    source = text.getvalue()
    try:
        with open(os.path.join(dicdir, "sys.dic"), "rb") as f:
            stamp = str(os.fstat(f.fileno()).st_size)
    except OSError:
        stamp = ""
    digest = hashlib.sha256((stamp + "\n" + source).encode("utf-8")).hexdigest()[:20]
    home = os.path.join(tempfile.gettempdir(), "tsuji-kana-lexicon")
    path = os.path.join(home, f"kana-{digest}.dic")
    if os.path.exists(path):
        return path
    os.makedirs(home, exist_ok=True)
    csv_path = os.path.join(home, f"kana-{digest}.{os.getpid()}.csv")
    partial = os.path.join(home, f"kana-{digest}.{os.getpid()}.part")
    with open(csv_path, "w", encoding="utf-8") as f:
        f.write(source)
    try:
        with _quiet():
            fugashi.build_dictionary(
                f'mecab-dict-index -d "{dicdir}" -u "{partial}" -f utf-8 -t utf-8 "{csv_path}"')
        os.replace(partial, path)
    finally:
        for leftover in (csv_path, partial):
            with contextlib.suppress(OSError):
                os.remove(leftover)
    return path if os.path.exists(path) else None
