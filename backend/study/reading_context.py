"""
The readings UniDic gets wrong in context, put right.

study/morphology.tokenize hands every morpheme a reading, and that
reading is the furigana over every sentence the app prints (an example
in the dictionary, a grammar lesson's sentences, a tutor's correction,
the analyser's rows). The tokenizer reads word by word, and some readings
are only decided by the word beside it -- which is exactly where it goes
wrong, and where a learner cannot tell:

  お母さん    お|母|さん, 母 read はは: the dictionary entry for 母 alone.
              In お母さん, 母さん, お母様 it is かあ; so 父 とう, 兄 にい,
              姉 ねえ (and 祖母 ばあ, 祖父 じい after お).
  counters    一本 comes back いち|ぽん, 三本 さん|ぽん, 四日 よん|にち,
              九時 きゅう|じ: the numeral and the counter each in their
              citation form, where Japanese joins them -- いっぽん,
              さんぼん, よっか, くじ. The table below is the textbook's.
  何          なん before a particle, where it is なに: 何を, 何が, 何も.
  〜中        ちゅう where it is じゅう, "all through": 世界中, 一日中.
  曜日        日曜|日 with 日 read ひ: にちようび.
  and a few   日本 にっぽん (the school reading is にほん), 明日 あす
  whole words (あした), 私 わたくし (わたし), 言う ゆう (いう), 何時
              なんどき (なんじ), 絵を描く えがく (かく), 実を結ぶ じつ (み).

Each rule rewrites a reading only where the context it names is there,
so a word the tokenizer reads right is never touched: a rule that cannot
be sure leaves the tokenizer's reading. Measured on the dictation bank,
whose hand-written kana is the one gold reading the repo holds
(content/listening_clips.py; tests/test_furigana_context.py).

Pure: it takes the morphemes' fields and returns the readings, so the
rules are testable without the tokenizer and morphology.py stays the
only thing that talks to MeCab.
"""
from __future__ import annotations

import re

# ── Numerals and counters ───────────────────────────────────────

_KANJI_DIGIT = {
    "〇": 0, "一": 1, "二": 2, "三": 3, "四": 4,
    "五": 5, "六": 6, "七": 7, "八": 8, "九": 9,
}
_NUMERAL_CHARS = set(_KANJI_DIGIT) | set("十百千万何")
_ARABIC = re.compile(r"^[0-9０-９]+$")


def _is_numeral(surface: str) -> bool:
    return bool(surface) and (
        all(c in _NUMERAL_CHARS for c in surface) or bool(_ARABIC.match(surface))
    )


def _numeral_class(surface: str):
    """What a numeral ENDS in when spoken, which is all a counter hears:
    1-9 for a final digit, 10/100/1000/10000 for a final unit, "nan"
    for 何. None for anything else (a bare 0)."""
    if not surface:
        return None
    last = surface[-1]
    if last == "何":
        return "nan"
    if last in _KANJI_DIGIT:
        return _KANJI_DIGIT[last] or None
    units = {"十": 10, "百": 100, "千": 1000, "万": 10000}
    if last in units:
        return units[last]
    digits = surface.translate(str.maketrans("０１２３４５６７８９", "0123456789"))
    if not digits.isdigit():
        return None
    n = int(digits)
    if n == 0:
        return None
    if n % 10:
        return n % 10
    if n % 100:
        return 10
    if n % 1000:
        return 100
    if n % 10000:
        return 1000
    return 10000


# The numeral's final element as it geminates before a counter:
# いち -> いっ, ろく -> ろっ, はち -> はっ, じゅう -> じゅっ, ひゃく -> ひゃっ.
_GEMINATE = (("いち", "いっ"), ("ろく", "ろっ"), ("はち", "はっ"),
             ("じゅう", "じゅっ"), ("ひゃく", "ひゃっ"))


def _geminate(reading: str) -> str:
    for plain, short in _GEMINATE:
        if reading.endswith(plain):
            return reading[: -len(plain)] + short
    return reading


def _swap_tail(reading: str, old: str, new: str) -> str:
    return reading[: -len(old)] + new if reading.endswith(old) else reading


# Counters whose first mora is h-: p after a geminate, b after ん for
# the rendaku ones, h otherwise.
_H_COUNTERS = {
    # counter: (base, after 3/何/千/万)
    "本": ("ほん", "ぼん"),
    "杯": ("はい", "ばい"),
    "匹": ("ひき", "びき"),
}
# k/s/t-initial counters: the numeral geminates (いっかい, はっさい).
# The value is the reading after 3/何 where it voices, else None.
_KST_COUNTERS = {
    "回": None, "個": None, "階": "がい", "冊": None, "歳": None, "才": None,
    "足": "ぞく", "軒": "げん", "曲": None, "着": None, "通": None, "頭": None,
    "点": None, "週間": None, "周": None, "件": None, "課": None, "か月": None,
    "ヶ月": None, "ケ月": None, "箇月": None, "カ月": None, "キロ": None,
    "センチ": None, "回目": None, "種類": None,
}
# Gemination happens before a voiceless consonant only.
_VOICELESS = set("かきくけこさしすせそたちつてとぱぴぷぺぽ")
# A counter's own reading, for a token UniDic did not read as one.
_COUNTER_BASE = {"本": "ほん", "杯": "はい", "匹": "ひき", "分": "ふん", "回": "かい",
                 "個": "こ", "階": "かい", "冊": "さつ", "歳": "さい", "才": "さい",
                 "足": "そく", "軒": "けん", "時": "じ", "時間": "じかん", "月": "がつ",
                 "人": "にん", "年": "ねん", "円": "えん", "日": "にち"}
_GEMINATING = {1, 8, 10}          # before any k/s/t/p counter
_GEMINATING_K = {6, 100}          # before a k- or p- counter only

# Counters that take the native ひと / ふた: 一切れ, 一口, 一言.
_NATIVE_COUNTERS = {"切れ", "口", "言", "息", "晩", "組", "箱", "皿", "袋"}

# 一つ ... 九つ.
_TSU = {1: "ひと", 2: "ふた", 3: "みっ", 4: "よっ", 5: "いつ",
        6: "むっ", 7: "なな", 8: "やっ", 9: "ここの"}


def _numeral_value(surface: str):
    """The number a numeral spells: 四, 十四, 二十, 三百五, 24, ２４.
    None for 何 or anything else that is not a plain number."""
    digits = surface.translate(str.maketrans("０１２３４５６７８９", "0123456789"))
    if digits.isdigit():
        return int(digits)
    total, pending = 0, None
    for c in surface:
        if c in _KANJI_DIGIT:
            if pending is not None:
                return None
            pending = _KANJI_DIGIT[c]
        elif c in "十百千":
            unit = {"十": 10, "百": 100, "千": 1000}[c]
            total += (1 if pending is None else pending) * unit
            pending = None
        else:
            return None
    return total + (pending or 0) if surface else None


_DIGIT_READING = {1: "いち", 2: "に", 3: "さん", 4: "よん", 5: "ご",
                  6: "ろく", 7: "なな", 8: "はち", 9: "きゅう"}
_HUNDREDS = {1: "ひゃく", 3: "さんびゃく", 6: "ろっぴゃく", 8: "はっぴゃく"}
_THOUSANDS = {1: "せん", 3: "さんぜん", 8: "はっせん"}


def read_numeral(surface: str) -> str | None:
    """The reading of a kanji numeral up to 9999 (三百五十 さんびゃくごじゅう),
    or None for anything else."""
    value = _numeral_value(surface)
    if value is None or not 0 < value < 10000 or not all(c in _NUMERAL_CHARS for c in surface):
        return None
    out = []
    thousands, rest = divmod(value, 1000)
    hundreds, rest = divmod(rest, 100)
    tens, ones = divmod(rest, 10)
    if thousands:
        out.append(_THOUSANDS.get(thousands) or _DIGIT_READING[thousands] + "せん")
    if hundreds:
        out.append(_HUNDREDS.get(hundreds) or _DIGIT_READING[hundreds] + "ひゃく")
    if tens:
        out.append(("" if tens == 1 else _DIGIT_READING[tens]) + "じゅう")
    if ones:
        out.append(_DIGIT_READING[ones])
    return "".join(out)


# The days of the month (and N days), which are their own words.
_DAYS = {
    2: "ふつ", 3: "みっ", 4: "よっ", 5: "いつ", 6: "むい",
    7: "なの", 8: "よう", 9: "ここの", 10: "とお",
}


def _counter_readings(num_surface, num_reading, ctr_surface, ctr_reading, ctr_pos,
                      whole=True, after=()):
    """(numeral reading, counter reading) with the euphony a counter
    takes, or None where nothing here applies.

    `num_surface` is the whole numeral, which may be several tokens
    (十|四); `num_reading` is the reading of its LAST token, the only
    one a counter changes, and `whole` says whether that token is the
    whole numeral. `after` is the surfaces that follow the counter."""
    cls = _numeral_class(num_surface)
    if cls is None:
        return None
    n_read, c_read = num_reading, ctr_reading
    geminates = cls in _GEMINATING
    ends_in_n = cls in ("nan", 3, 1000, 10000)

    if ctr_surface in _H_COUNTERS:
        base, voiced = _H_COUNTERS[ctr_surface]
        pushed = "ぱぴぷぺぽ"["はひふへほ".index(base[0])] + base[1:]
        if _to_hira(c_read) not in (base, voiced, pushed):
            return None  # not the counter: 三本木, a name
        if geminates or cls in _GEMINATING_K:
            return _geminate(n_read), pushed
        if ends_in_n:
            return n_read, voiced
        return n_read, base

    if ctr_surface in ("分", "分間", "泊"):
        head = {"分": "ふん", "分間": "ふんかん", "泊": "はく"}[ctr_surface]
        pushed = "ぷ" + head[1:] if head[0] == "ふ" else "ぱ" + head[1:]
        fraction = len(after) > 1 and after[0] == "の" and _is_numeral(after[1])
        if fraction or _to_hira(c_read) not in (head, pushed, "ぶん"):
            return None  # 三分の一 さんぶんのいち: a share, not minutes
        if geminates or cls in _GEMINATING_K:
            return _geminate(n_read), pushed
        if ends_in_n or cls == 4:
            return n_read, pushed
        return n_read, head

    if ctr_surface in _KST_COUNTERS:
        voiced = _KST_COUNTERS[ctr_surface]
        head = _to_hira(c_read)[:1]
        k_row = head in "かきくけこ"
        if head not in _VOICELESS:
            return None
        if geminates or (cls in _GEMINATING_K and k_row):
            return _geminate(n_read), c_read
        if voiced and cls in (3, "nan"):
            return n_read, voiced
        return n_read, c_read

    if ctr_surface in _NATIVE_COUNTERS and whole and num_surface in ("一", "二"):
        # 一切れ ひときれ, 二口 ふたくち: the native number.
        return ("ひと" if num_surface == "一" else "ふた"), c_read

    if ctr_surface == "つ" and whole and len(num_surface) == 1 and num_surface in _KANJI_DIGIT:
        # 一つ ... 九つ, the native numbers: UniDic reads 六つ むい, 八つ よう.
        native = _TSU.get(_KANJI_DIGIT[num_surface])
        return (native, c_read) if native else None

    if ctr_surface == "日" and ctr_pos in ("suffix", "noun"):
        # The days of the month (and N days) are words of their own from
        # 2 to 10, and 14, 20, 24; the rest are にち. 一日 is a token of
        # its own (ついたち / いちにち).
        value = _numeral_value(num_surface)
        if value is None:
            return None
        spelled = any(c in _NUMERAL_CHARS for c in num_surface)
        if not (2 <= value <= 10 or value in (14, 20, 24)):
            return n_read, "にち"
        if not spelled:
            return n_read, "か"
        if value % 10 == 4:
            return _swap_tail(n_read, "よん", "よっ"), "か"
        if value <= 10 and len(num_surface) == 1:
            return _DAYS[value], "か"
        if value == 20 and whole:
            return "はつ", "か"
        return None

    if ctr_surface in ("時", "時間"):
        if cls == 4:
            return _swap_tail(n_read, "よん", "よ"), c_read
        if cls == 9:
            return _swap_tail(n_read, "きゅう", "く"), c_read
        if cls == 7 and ctr_surface == "時":
            return _swap_tail(n_read, "なな", "しち"), c_read
        return None

    if ctr_surface == "月" and _to_hira(c_read) == "がつ":
        if cls == 4:
            return _swap_tail(n_read, "よん", "し"), c_read
        if cls == 7:
            return _swap_tail(n_read, "なな", "しち"), c_read
        if cls == 9:
            return _swap_tail(n_read, "きゅう", "く"), c_read
        return None

    if ctr_surface in ("人", "年", "円") and cls == 4:
        return _swap_tail(n_read, "よん", "よ"), c_read

    return None


# ── Family words ────────────────────────────────────────────────

# 母 read かあ before さん/ちゃん/様 -- the address, not the relation.
_FAMILY = {"母": "かあ", "父": "とう", "兄": "にい", "姉": "ねえ",
           "祖母": "ばあ", "祖父": "じい"}
# The whole family word as one token, which UniDic sometimes makes.
_FAMILY_WORDS = {
    "お母さん": "おかあさん", "お父さん": "おとうさん",
    "お兄さん": "おにいさん", "お姉さん": "おねえさん",
    "母さん": "かあさん", "父さん": "とうさん",
    "兄さん": "にいさん", "姉さん": "ねえさん",
    "お母様": "おかあさま", "お父様": "おとうさま",
    "お兄様": "おにいさま", "お姉様": "おねえさま",
    "お祖母さん": "おばあさん", "お祖父さん": "おじいさん",
    "お母ちゃん": "おかあちゃん", "お父ちゃん": "おとうちゃん",
}
_HONORIFIC = {"さん", "ちゃん", "様", "さま"}

# ── Whole words UniDic reads in a register the app does not teach ──

_WHOLE = {
    "日本": ("にっぽん", "にほん"),
    "明日": ("あす", "あした"),
    "私": ("わたくし", "わたし"),
    "何時": (None, "なんじ"),
    "何人": (None, "なんにん"),
    "何日": (None, "なんにち"),
    "何年": (None, "なんねん"),
    "何曜日": (None, "なんようび"),
    # かみて / しもて are the stage's sides; the words taught are じょうず, へた.
    "上手": ("かみて", "じょうず"),
    "下手": ("しもて", "へた"),
}

# A spelling UniDic's lighter dictionary gets wrong at the head of an
# inflecting word: 丸い マリイ. (head of the surface, wrong, right)
_HEADS = (("言", "ゆ", "い"), ("丸", "まり", "まる"), ("込", "ご", "こ"))

# 何 before one of these is なに: 何を, 何が, 何も, 何か, 何に, 何へ,
# 何から, 何まで, 何より, 何や. Not で (なんで "why" is a word), the
# copula (何だ, 何です are なん) or の (何の is なんの).
_NANI_BEFORE = {"を", "が", "も", "か", "に", "へ", "から", "まで", "より",
                "や", "とか", "しか", "でも"}

# 〜中 read じゅう, "all through": after these it is never ちゅう.
_JUU_AFTER = {
    "世界", "日本", "国", "家", "町", "村", "体", "年", "日", "晩", "夜",
    "部屋", "学校", "会社", "街", "市", "県", "今日", "今年", "一日",
    "一年", "一晩", "世", "島", "店", "顔", "町内", "国内", "区",
}

# The things one draws: 描く is かく after them (絵を描く), えがく for
# the figurative sense (心に描く), which is UniDic's default.
_DRAWN = {"絵", "図", "漫画", "地図", "線", "円", "丸", "イラスト", "似顔絵", "顔"}

# What has a peak: 盛り after one and の is さかり (花の盛り, 夏の盛り,
# 人生の盛り); after anything else it may be a serving (ご飯の盛り).
_PEAK_OF = {"花", "桜", "梅", "紅葉", "春", "夏", "秋", "冬", "暑さ", "寒さ",
            "季節", "人生", "青春", "若さ"}

# The periods and events 今 is the prefix こん before: 今世紀, 今学期.
_KON_BEFORE = {
    "世紀", "学期", "年度", "大会", "回", "季", "期", "シーズン", "週末",
    "月末", "年末", "夏", "冬", "春", "秋", "国会", "次", "日", "晩", "朝",
    "夜", "週", "月", "年", "会期", "場所", "作", "号", "般", "後", "上半期",
    "下半期", "年間", "世", "生", "度", "戦", "大戦",
}

_PUNCT = set("。、！？!?,.，．「」『』（）()…・ 　")


def _to_hira(s: str) -> str:
    return "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in s or "")


def _is_kanji(c: str) -> bool:
    return "一" <= c <= "龯"


# What may follow a noun standing on its own: a case or binding particle.
_PARTICLE_AFTER = {"を", "が", "は", "も", "へ", "に", "で", "と", "の", "から",
                   "まで", "より", "や", "こそ", "さえ", "しか", "だけ"}


def _stands_alone(tokens: list[dict], i: int, after_adjectival: bool = False) -> bool:
    """Is the token at `i` a word of its own rather than the tail of a
    compound? A particle follows it, and what comes before it cannot
    take a suffix: nothing, punctuation, a particle, a verb, an
    adjective, an adverb, a pre-noun (この) -- or a noun that is itself
    adverbial (以来, 来月), which UniDic joins a suffix onto.
    `after_adjectival` counts a na-adjective's stem (一生懸命) as a
    word a noun can stand after; a suffix can, so it is off by default
    (積極|的)."""
    if i + 1 >= len(tokens) or tokens[i + 1]["surface"] not in _PARTICLE_AFTER:
        return False
    if i == 0:
        return True
    before = tokens[i - 1]
    if before["surface"] in _PUNCT:
        return True
    b1, _b2, b3 = before.get("tags") or ("", "", "")
    if b1 == "形状詞" and after_adjectival:
        return True
    if b1 in ("名詞", "代名詞", "接頭辞", "形状詞", "接尾辞", ""):
        return b1 == "名詞" and b3 == "副詞可能" and not _is_numeral(before["surface"])
    return True


# One-kanji nouns UniDic reads by a reading the word alone never has in
# the app's sentences: (UniDic's, the word's).
_NOUN_ALONE = {
    "体": ("たい", "からだ"),
    "露": ("ろ", "つゆ"),
    "米": ("べい", "こめ"),
    "間": ("かん", "あいだ"),
}


_WORD_READINGS: dict[str, list[str]] | None = None


def deck_word_reading(char: str) -> list[str]:
    """The readings the vocab deck teaches for `char` as a word of its
    own (酒 さけ, 体 からだ・てい), in the deck's order."""
    global _WORD_READINGS
    if _WORD_READINGS is None:
        from content.vocab_data import VOCAB_BY_LEVEL

        table: dict[str, list[str]] = {}
        for entries in VOCAB_BY_LEVEL.values():
            for e in entries:
                k, kana = e.get("kanji") or "", e.get("kana") or ""
                if len(k) == 1 and kana:
                    for r in re.split(r"[;；/・、]", kana):
                        r = r.strip()
                        if r and r not in table.setdefault(k, []):
                            table[k].append(r)
        _WORD_READINGS = table
    return _WORD_READINGS.get(char, [])


def correct_readings(tokens: list[dict], word_reading=deck_word_reading) -> list[str]:
    """The readings of `tokens`, each put right where its context says.

    `tokens` are dicts with surface, reading (hiragana), pos, lemma and
    `tags` (UniDic's pos1-3) -- a sentence's morphemes in order.
    Returns one reading per token, the tokenizer's own wherever no rule
    applies. `word_reading` gives a kanji's readings as a word of its
    own; the vocab deck's by default.
    """
    out = [t["reading"] for t in tokens]
    surf = [t["surface"] for t in tokens]
    n = len(tokens)

    def nxt(i):
        return surf[i + 1] if i + 1 < n else ""

    def prev(i):
        return surf[i - 1] if i > 0 else ""

    for i, t in enumerate(tokens):
        s, r = surf[i], out[i]

        # Whole words.
        if s in _FAMILY_WORDS:
            out[i] = _FAMILY_WORDS[s]
            continue
        if s in _WHOLE:
            wrong, right = _WHOLE[s]
            if wrong is None or r == wrong:
                out[i] = right
            continue

        # 言う read ゆう: every form of 言 is い-. 込む is never ごむ on
        # its own (and 〜込む compounds are one token, こむ).
        head = next(((w, ok) for c, w, ok in _HEADS if s.startswith(c) and r.startswith(w)), None)
        if head:
            out[i] = head[1] + r[len(head[0]):]
            continue

        # お母さん / 母さん / お母様 ...
        if s in _FAMILY and (
            nxt(i) in ("さん", "ちゃん") or (nxt(i) in _HONORIFIC and prev(i) == "お")
        ):
            if s not in ("祖母", "祖父") or prev(i) == "お":
                out[i] = _FAMILY[s]
            continue

        # 何 before a particle.
        if s == "何" and r == "なん":
            after = nxt(i)
            if after in _NANI_BEFORE or after == "" or after in _PUNCT:
                out[i] = "なに"
            continue

        # 日曜日: 日 after 曜 is び.
        if s == "日" and r == "ひ" and (prev(i).endswith("曜") or prev(i).endswith("よう")):
            out[i] = "び"
            continue

        # 〜中 "all through".
        if s == "中" and r == "ちゅう" and prev(i) in _JUU_AFTER:
            out[i] = "じゅう"
            continue
        if s in ("日中", "年中", "晩中") and i > 0 and _numeral_class(prev(i)) == 1:
            out[i] = {"日中": "にちじゅう", "年中": "ねんじゅう", "晩中": "ばんじゅう"}[s]
            continue

        # 家 read as the suffix か (専門家) straight after 〜中: 一日中家に.
        if s == "家" and r == "か" and prev(i).endswith("中"):
            out[i] = "いえ"
            continue

        # 絵を描く.
        if s.startswith("描") and r.startswith("えが"):
            if any(surf[j] in _DRAWN for j in range(max(0, i - 3), i)):
                out[i] = "か" + r[2:]
            continue

        # 実を結ぶ, 実がなる: the fruit, not じつ.
        if s == "実" and r == "じつ" and nxt(i) in ("を", "が"):
            out[i] = "み"
            continue

        # 盛り on its own is もり to UniDic, a serving (ご飯の盛り, 盛りが
        # いい); it is さかり, the peak, where the sentence says so: 〜が
        # 盛りだ, 今を盛りと, 盛りを過ぎる, 盛りがつく, and the season or the
        # life before の. UniDic reads its compounds right itself (花盛り,
        # 働き盛り, 真っ盛り, 大盛り). Plan 152.
        if s == "盛り" and r == "もり":
            after2 = surf[i + 2] if i + 2 < n else ""
            before2 = surf[i - 2] if i > 1 else ""
            if ((prev(i) == "が" and (nxt(i) in ("だ", "です", "だっ", "でし", "") or nxt(i) in _PUNCT))
                    or (prev(i) == "を" and before2 == "今")
                    or (nxt(i) == "を" and after2.startswith("過ぎ"))
                    or (nxt(i) in ("が", "の") and after2.startswith(("つ", "付")))
                    or (prev(i) == "の" and before2 in _PEAK_OF)):
                out[i] = "さかり"
            continue

        # A kanji standing alone as a word, read as if it were part of
        # one: 以来|酒 (シュ, UniDic's suffix of 日本酒), 来月|国 (コク),
        # いい|形 (ガタ) -- a suffix with nothing to be the suffix of,
        # read as the word the deck teaches for it, where UniDic's
        # reading is not one of the deck's own -- and the few nouns
        # UniDic reads by a reading they never have alone: 一生懸命|体
        # (タイ), この|間 (カン), 露 (ロ), 米 (ベイ).
        pos1 = (t.get("tags") or ("",))[0]
        if len(s) == 1 and pos1 == "接尾辞" and _stands_alone(tokens, i):
            taught = word_reading(s)
            if taught and r not in taught:
                out[i] = taught[0]
            continue
        if s in _NOUN_ALONE and r == _NOUN_ALONE[s][0] and _stands_alone(
                tokens, i, after_adjectival=True):
            out[i] = _NOUN_ALONE[s][1]
            continue

        # 今 as the prefix こん (今世紀, 今学期) before a word that is
        # not a period: 今|地下, 今|論議 are "now", いま.
        if s == "今" and r == "こん" and pos1 == "接頭辞" and nxt(i) not in _KON_BEFORE:
            out[i] = "いま"
            continue

        # 数日, 何日: days, にち -- UniDic reads the suffix じつ.
        if s == "日" and r == "じつ" and (prev(i) in ("数", "何") or _is_numeral(prev(i))):
            out[i] = "にち"
            continue

    # A numeral and its counter as ONE token UniDic read as something
    # else -- 三本 alone is the surname みもと. Read as the two they are,
    # where UniDic's reading does not even begin with the number's.
    for i in range(n):
        s = surf[i]
        for split in range(len(s) - 1, 0, -1):
            num, ctr = s[:split], s[split:]
            if not all(c in _NUMERAL_CHARS - {"何"} for c in num):
                continue
            n_read = read_numeral(num)
            if n_read and not out[i].startswith(n_read[:1]):
                base = _COUNTER_BASE.get(ctr)
                fixed = base and _counter_readings(num, n_read, ctr, base, "suffix")
                if fixed:
                    out[i] = fixed[0] + fixed[1]
            break

    # Counters last: they read the numeral before them, and a numeral's
    # reading is only ever changed here.
    for i in range(1, n):
        if not _is_numeral(surf[i - 1]) or _is_numeral(surf[i]):
            continue
        start = i - 1
        while start > 0 and _is_numeral(surf[start - 1]):
            start -= 1
        fixed = _counter_readings("".join(surf[start:i]), out[i - 1], surf[i], out[i],
                                  tokens[i].get("pos", ""), whole=start == i - 1,
                                  after=surf[i + 1:i + 3])
        if fixed:
            out[i - 1], out[i] = fixed
    return out
