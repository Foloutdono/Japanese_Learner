"""
Furigana a learner can trust, end to end.

The furigana over every sentence the app prints comes from the
tokenizer (study/morphology.tokenize), put right in context
(study/reading_context.py), divided per kanji (study/furigana.py) and,
in a dictionary entry's examples, read the way the entry reads its own
headword (content/vocab_extras._read_as_headword). A wrong reading at
any of those steps is taught: the learner has no way to know better.

Four kinds of test here:

  * the context rules one by one, on hand-made tokens, so each is
    pinned down without the tokenizer and so is where it must NOT fire;
  * whole sentences through the real tokenizer, for the readings that
    went wrong (お母さん read おははさん, 大きい おうきい, 一本 いちぽん,
    日曜日 にちようひ ...) and their neighbours that must stay right;
  * the dictation bank, whose hand-written kana is the one gold reading
    the repo holds: every line's furigana must spell it;
  * every sentence the app ships, held to the shape the renderer needs:
    the parts spell the sentence, a reading is kana over a kanji, and a
    word's parts say which word they are.
"""
import glob
import json
import os
import re
import unittest

from study import morphology
from study.furigana import align, align_deck, align_sentence
from study.reading_context import correct_readings, read_numeral

NEEDS_TOKENIZER = unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs fugashi/unidic-lite")

_KANJI = re.compile(r"[一-鿿々]")
_KANA = re.compile(r"^[ぁ-ゖァ-ヺー]+$")


def _tok(surface, reading, pos1="名詞", pos2="普通名詞", pos3="一般", pos="noun"):
    return {"surface": surface, "reading": reading, "pos": pos, "lemma": surface,
            "tags": (pos1, pos2, pos3)}


def _particle(surface):
    return _tok(surface, surface, "助詞", "格助詞", "*", "particle")


def _read(*tokens, word_reading=lambda c: []):
    return correct_readings(list(tokens), word_reading=word_reading)


def _ruby(sentence):
    """The sentence's readings as 'kanji[reading]' words, joined by
    word: 'お母[かあ]' reads 母 with かあ. What a learner sees above the
    line, and nothing else."""
    words, current = [], None
    for part in align_sentence(sentence):
        if part.get("reading") is None:
            current = None
            continue
        if current is not None and part.get("word") == current:
            words[-1] += f"{part['text']}[{part['reading']}]"
        else:
            words.append(f"{part['text']}[{part['reading']}]")
        current = part.get("word")
    return " ".join(words)


class ContextRuleTests(unittest.TestCase):
    """Each rule on its own tokens: where it fires, and where it must not."""

    def test_family_words_before_an_honorific(self) -> None:
        for kanji, reading in (("母", "かあ"), ("父", "とう"), ("兄", "にい"), ("姉", "ねえ")):
            with self.subTest(kanji):
                got = _read(_tok("お", "お", "接頭辞", "*", "*", "prefix"),
                            _tok(kanji, "x"), _tok("さん", "さん", "接尾辞", "名詞的"))
                self.assertEqual(got[1], reading)
                # Without お too: 母さん is かあさん.
                self.assertEqual(_read(_tok(kanji, "x"), _tok("さん", "さん", "接尾辞"))[0], reading)
                # And お〜様 / お〜ちゃん.
                self.assertEqual(_read(_tok("お", "お", "接頭辞"), _tok(kanji, "x"), _tok("様", "さま"))[1], reading)

    def test_family_word_alone_keeps_its_own_reading(self) -> None:
        # 母は -- the relation, not the address.
        self.assertEqual(_read(_tok("母", "はは"), _particle("は")), ["はは", "は"])
        # 母様 without お: ははさま is a word; nothing to put right.
        self.assertEqual(_read(_tok("母", "はは"), _tok("様", "さま"))[0], "はは")

    def test_grandparents_only_after_o(self) -> None:
        self.assertEqual(_read(_tok("お", "お", "接頭辞"), _tok("祖母", "そぼ"), _tok("さん", "さん"))[1], "ばあ")
        self.assertEqual(_read(_tok("祖母", "そぼ"), _tok("さん", "さん"))[0], "そぼ")

    def test_family_word_as_one_token(self) -> None:
        self.assertEqual(_read(_tok("お母さん", "おははさん")), ["おかあさん"])
        self.assertEqual(_read(_tok("お姉さん", "おあねさん")), ["おねえさん"])

    def test_nani_before_a_particle(self) -> None:
        for after in ("を", "が", "も", "か", "に", "へ", "から", "まで"):
            with self.subTest(after):
                self.assertEqual(_read(_tok("何", "なん", "代名詞", "*", "*"), _particle(after))[0], "なに")
        # At the end of a question too: 何？
        self.assertEqual(_read(_tok("何", "なん"), _tok("？", "？", "補助記号"))[0], "なに")
        self.assertEqual(_read(_tok("何", "なん"))[0], "なに")

    def test_nan_stays_where_it_is_nan(self) -> None:
        for after in ("の", "で", "です", "だ", "と", "本", "時", "人"):
            with self.subTest(after):
                self.assertEqual(_read(_tok("何", "なん"), _tok(after, "x"))[0], "なん")

    def test_youbi(self) -> None:
        self.assertEqual(_read(_tok("日曜", "にちよう"), _tok("日", "ひ"))[1], "び")
        self.assertEqual(_read(_tok("何よう", "なによう"), _tok("日", "ひ"))[1], "び")
        # 日 after anything else keeps UniDic's reading.
        self.assertEqual(_read(_tok("毎", "まい"), _tok("日", "ひ"))[1], "ひ")

    def test_juu_all_through(self) -> None:
        for before in ("世界", "日本", "一日", "今日", "家", "年"):
            with self.subTest(before):
                self.assertEqual(_read(_tok(before, "x"), _tok("中", "ちゅう", "接尾辞"))[1], "じゅう")
        # "during": 工事中, 会議中, 午前中 stay ちゅう.
        for before in ("工事", "会議", "午前", "来月", "授業"):
            with self.subTest(before):
                self.assertEqual(_read(_tok(before, "x"), _tok("中", "ちゅう", "接尾辞"))[1], "ちゅう")

    def test_ichinichijuu_split_by_the_tokenizer(self) -> None:
        self.assertEqual(_read(_tok("一", "いち", "名詞", "数詞"), _tok("日中", "にっちゅう"))[1], "にちじゅう")
        # 日中 alone is にっちゅう, the daytime.
        self.assertEqual(_read(_tok("日中", "にっちゅう"))[0], "にっちゅう")

    def test_ie_after_juu(self) -> None:
        self.assertEqual(_read(_tok("日中", "にちじゅう"), _tok("家", "か", "接尾辞"))[1], "いえ")
        # 専門家 keeps か.
        self.assertEqual(_read(_tok("専門", "せんもん"), _tok("家", "か", "接尾辞"))[1], "か")

    def test_whole_words(self) -> None:
        self.assertEqual(_read(_tok("日本", "にっぽん"))[0], "にほん")
        self.assertEqual(_read(_tok("明日", "あす"))[0], "あした")
        self.assertEqual(_read(_tok("私", "わたくし", "代名詞"))[0], "わたし")
        self.assertEqual(_read(_tok("何時", "なんどき"))[0], "なんじ")
        self.assertEqual(_read(_tok("上手", "かみて"))[0], "じょうず")
        self.assertEqual(_read(_tok("下手", "しもて"))[0], "へた")
        # A reading that is already right is left: 私 わたし, 日本 にほん.
        self.assertEqual(_read(_tok("私", "わたし"))[0], "わたし")
        self.assertEqual(_read(_tok("日本", "にほん"))[0], "にほん")

    def test_heads(self) -> None:
        self.assertEqual(_read(_tok("言う", "ゆう", "動詞"))[0], "いう")
        self.assertEqual(_read(_tok("言っ", "いっ", "動詞"))[0], "いっ")
        self.assertEqual(_read(_tok("丸い", "まりい", "形容詞"))[0], "まるい")
        self.assertEqual(_read(_tok("込む", "ごむ", "動詞"))[0], "こむ")

    def test_kaku_a_picture(self) -> None:
        got = _read(_tok("絵", "え"), _particle("を"), _tok("描く", "えがく", "動詞"))
        self.assertEqual(got[2], "かく")
        # 心に描く, the figurative one, stays えがく.
        got = _read(_tok("心", "こころ"), _particle("に"), _tok("描く", "えがく", "動詞"))
        self.assertEqual(got[2], "えがく")

    def test_mi_the_fruit(self) -> None:
        self.assertEqual(_read(_tok("実", "じつ"), _particle("を"))[0], "み")
        # 実の母, 実は: じつ.
        self.assertEqual(_read(_tok("実", "じつ"), _particle("の"))[0], "じつ")
        self.assertEqual(_read(_tok("実", "じつ"), _particle("は"))[0], "じつ")

    def test_sakari_the_peak(self) -> None:
        """盛り alone is もり to UniDic, a serving; the peak where the
        sentence says so (plan 152)."""
        mori = lambda: _tok("盛り", "もり")
        cop = _tok("だ", "だ", "助動詞", "*", "*", "auxiliary")
        self.assertEqual(_read(_particle("が"), mori(), cop)[1], "さかり")
        self.assertEqual(_read(_tok("今", "いま"), _particle("を"), mori(), _particle("と"))[2], "さかり")
        self.assertEqual(_read(mori(), _particle("を"), _tok("過ぎ", "すぎ", "動詞"))[0], "さかり")
        self.assertEqual(_read(mori(), _particle("の"), _tok("つい", "つい", "動詞"))[0], "さかり")
        self.assertEqual(_read(_tok("夏", "なつ"), _particle("の"), mori())[2], "さかり")
        # A serving: ご飯の盛り, 盛りがいい -- untouched.
        self.assertEqual(_read(_tok("ご飯", "ごはん"), _particle("の"), mori())[2], "もり")
        self.assertEqual(_read(mori(), _particle("が"), _tok("いい", "いい", "形容詞"))[0], "もり")

    def test_a_suffix_with_nothing_to_attach_to(self) -> None:
        taught = {"酒": ["さけ"], "国": ["くに"], "形": ["かたち"], "的": ["まと"]}.get
        # 以来|酒を: 以来 is adverbial, so 酒 is a word, さけ.
        got = _read(_tok("以来", "いらい", "名詞", "普通名詞", "副詞可能"),
                    _tok("酒", "しゅ", "接尾辞", "名詞的"), _particle("を"),
                    word_reading=lambda c: taught(c) or [])
        self.assertEqual(got[1], "さけ")
        # いい|形と: after a verb.
        got = _read(_tok("いい", "いい", "動詞", "一般", "*", "verb"),
                    _tok("形", "がた", "接尾辞", "名詞的"), _particle("と"),
                    word_reading=lambda c: taught(c) or [])
        self.assertEqual(got[1], "かたち")
        # 日本|酒: a real suffix on a real noun -- untouched.
        got = _read(_tok("日本", "にほん", "名詞", "固有名詞", "地名"),
                    _tok("酒", "しゅ", "接尾辞", "名詞的"), _particle("を"),
                    word_reading=lambda c: taught(c) or [])
        self.assertEqual(got[1], "しゅ")
        # 積極|的に after a na-adjective's stem: a suffix, てき.
        got = _read(_tok("積極", "せっきょく", "形状詞", "一般", "*"),
                    _tok("的", "てき", "接尾辞", "形状詞的"), _particle("に"),
                    word_reading=lambda c: taught(c) or [])
        self.assertEqual(got[1], "てき")
        # And a suffix whose reading the deck already knows is left.
        got = _read(_tok("来月", "らいげつ", "名詞", "普通名詞", "副詞可能"),
                    _tok("国", "くに", "接尾辞"), _particle("へ"),
                    word_reading=lambda c: taught(c) or [])
        self.assertEqual(got[1], "くに")

    def test_nouns_alone(self) -> None:
        self.assertEqual(_read(_tok("この", "この", "連体詞", "*", "*"), _tok("間", "かん"), _particle("の"))[1], "あいだ")
        self.assertEqual(_read(_tok("懸命", "けんめい", "形状詞"), _tok("体", "たい"), _particle("を"))[1], "からだ")
        self.assertEqual(_read(_tok("米", "べい"), _particle("を"))[0], "こめ")
        # 一週|間, 日米: part of a compound, untouched.
        self.assertEqual(_read(_tok("一週", "いっしゅう"), _tok("間", "かん"), _particle("の"))[1], "かん")
        # Without a particle after, it is not known to stand alone.
        self.assertEqual(_read(_tok("この", "この", "連体詞"), _tok("間", "かん"))[1], "かん")

    def test_ima(self) -> None:
        self.assertEqual(_read(_tok("今", "こん", "接頭辞", "*", "*"), _tok("地下", "ちか"))[0], "いま")
        for period in ("世紀", "学期", "年度", "大会"):
            with self.subTest(period):
                self.assertEqual(_read(_tok("今", "こん", "接頭辞"), _tok(period, "x"))[0], "こん")

    def test_nothing_to_put_right_changes_nothing(self) -> None:
        tokens = [_tok("学校", "がっこう"), _particle("へ"), _tok("行く", "いく", "動詞"),
                  _tok("。", "。", "補助記号")]
        self.assertEqual(_read(*tokens), [t["reading"] for t in tokens])
        self.assertEqual(_read(), [])


class CounterTests(unittest.TestCase):
    """A numeral and a counter are read together: いっぽん, さんぼん,
    よっか, くじ. UniDic reads each in its citation form."""

    def _pair(self, numeral, counter, num_reading=None, ctr_reading="", pos="suffix"):
        num_reading = num_reading or read_numeral(numeral) or numeral
        got = _read(_tok(numeral, num_reading, "名詞", "数詞"), _tok(counter, ctr_reading, pos=pos))
        return got[0] + got[1] if any(c in "一二三四五六七八九十百千万何" for c in numeral) else got[1]

    def test_hon(self) -> None:
        expected = {"一": "いっぽん", "二": "にほん", "三": "さんぼん", "四": "よんほん",
                    "五": "ごほん", "六": "ろっぽん", "七": "ななほん", "八": "はっぽん",
                    "九": "きゅうほん", "十": "じゅっぽん", "百": "ひゃっぽん", "千": "せんぼん",
                    "何": "なんぼん"}
        for numeral, reading in expected.items():
            with self.subTest(numeral):
                self.assertEqual(self._pair(numeral, "本", "なん" if numeral == "何" else None, "ぽん"), reading)

    def test_fun(self) -> None:
        expected = {"一": "いっぷん", "二": "にふん", "三": "さんぷん", "四": "よんぷん",
                    "五": "ごふん", "六": "ろっぷん", "七": "ななふん", "八": "はっぷん",
                    "九": "きゅうふん", "十": "じゅっぷん", "二十": "にじゅっぷん",
                    "三十": "さんじゅっぷん", "何": "なんぷん"}
        for numeral, reading in expected.items():
            with self.subTest(numeral):
                self.assertEqual(self._pair(numeral, "分", "なん" if numeral == "何" else None, "ふん"), reading)

    def test_hai_and_hiki(self) -> None:
        self.assertEqual(self._pair("一", "杯", None, "はい"), "いっぱい")
        self.assertEqual(self._pair("三", "杯", None, "はい"), "さんばい")
        self.assertEqual(self._pair("六", "匹", None, "ひき"), "ろっぴき")
        self.assertEqual(self._pair("三", "匹", None, "ひき"), "さんびき")
        self.assertEqual(self._pair("二", "匹", None, "ひき"), "にひき")

    def test_kst_counters_geminate(self) -> None:
        cases = [("一", "回", "かい", "いっかい"), ("六", "回", "かい", "ろっかい"),
                 ("八", "回", "かい", "はっかい"), ("十", "回", "かい", "じゅっかい"),
                 ("百", "回", "かい", "ひゃっかい"), ("二", "回", "かい", "にかい"),
                 ("一", "冊", "さつ", "いっさつ"), ("六", "冊", "さつ", "ろくさつ"),
                 ("八", "冊", "さつ", "はっさつ"), ("一", "個", "こ", "いっこ"),
                 ("六", "個", "こ", "ろっこ"), ("一", "歳", "さい", "いっさい"),
                 ("十", "歳", "さい", "じゅっさい"), ("三", "階", "かい", "さんがい"),
                 ("何", "階", "かい", "なんがい"), ("三", "足", "そく", "さんぞく"),
                 ("三", "軒", "けん", "さんげん"), ("一", "週間", "しゅうかん", "いっしゅうかん")]
        for numeral, counter, base, reading in cases:
            with self.subTest(numeral + counter):
                self.assertEqual(self._pair(numeral, counter, "なん" if numeral == "何" else None, base), reading)

    def test_days(self) -> None:
        cases = {"二": "ふつか", "三": "みっか", "四": "よっか", "五": "いつか", "六": "むいか",
                 "七": "なのか", "八": "ようか", "九": "ここのか", "十": "とおか", "二十": "はつか"}
        for numeral, reading in cases.items():
            with self.subTest(numeral):
                self.assertEqual(self._pair(numeral, "日", None, "にち"), reading)
        # 11, 12, 13, 15: にち.
        self.assertEqual(self._pair("十一", "日", None, "か"), "じゅういちにち")
        self.assertEqual(self._pair("十五", "日", None, "か"), "じゅうごにち")
        # 14 split by the tokenizer: 十|四|日.
        got = _read(_tok("十", "じゅう", "名詞", "数詞"), _tok("四", "よん", "名詞", "数詞"), _tok("日", "にち"))
        self.assertEqual("".join(got), "じゅうよっか")
        # 十|二|日 is the twelfth, never ふつか.
        got = _read(_tok("十", "じゅう", "名詞", "数詞"), _tok("二", "に", "名詞", "数詞"), _tok("日", "か"))
        self.assertEqual("".join(got), "じゅうににち")

    def test_days_after_arabic_digits(self) -> None:
        # The digits carry no furigana; the 日 over them still must be right.
        for digits, reading in (("8", "か"), ("１０", "か"), ("20", "か"), ("24", "か"),
                                ("12", "にち"), ("40", "にち"), ("31", "にち")):
            with self.subTest(digits):
                self.assertEqual(self._pair(digits, "日", digits, "じつ"), reading)

    def test_counters_after_arabic_digits(self) -> None:
        for digits, counter, base, reading in (("3", "本", "ぽん", "ぼん"), ("1", "本", "ほん", "ぽん"),
                                               ("10", "分", "ふん", "ぷん"), ("2", "分", "ぷん", "ふん"),
                                               ("１", "匹", "ひき", "ぴき"), ("100", "本", "ほん", "ぽん")):
            with self.subTest(digits + counter):
                self.assertEqual(self._pair(digits, counter, digits, base), reading)

    def test_hours_months_and_people(self) -> None:
        self.assertEqual(self._pair("四", "時", None, "じ"), "よじ")
        self.assertEqual(self._pair("七", "時", None, "じ"), "しちじ")
        self.assertEqual(self._pair("九", "時", None, "じ"), "くじ")
        self.assertEqual(self._pair("四", "時間", None, "じかん"), "よじかん")
        self.assertEqual(self._pair("九", "時間", None, "じかん"), "くじかん")
        self.assertEqual(self._pair("四", "月", None, "がつ"), "しがつ")
        self.assertEqual(self._pair("七", "月", None, "がつ"), "しちがつ")
        self.assertEqual(self._pair("九", "月", None, "がつ"), "くがつ")
        self.assertEqual(self._pair("四", "人", None, "にん"), "よにん")
        self.assertEqual(self._pair("四", "年", None, "ねん"), "よねん")
        self.assertEqual(self._pair("四", "円", None, "えん"), "よえん")
        # The ones that need nothing.
        self.assertEqual(self._pair("三", "時", None, "じ"), "さんじ")
        self.assertEqual(self._pair("十", "月", None, "がつ"), "じゅうがつ")
        # 月 read つき is not the month's name.
        self.assertEqual(self._pair("四", "月", None, "つき"), "よんつき")

    def test_native_numbers(self) -> None:
        for numeral, reading in (("一", "ひと"), ("二", "ふた"), ("三", "みっ"), ("四", "よっ"),
                                 ("五", "いつ"), ("六", "むっ"), ("七", "なな"), ("八", "やっ"),
                                 ("九", "ここの")):
            with self.subTest(numeral):
                self.assertEqual(_read(_tok(numeral, "x", "名詞", "数詞"), _tok("つ", "つ", "接尾辞"))[0], reading)

    def test_a_numeral_and_counter_read_as_a_name(self) -> None:
        # UniDic reads 三本 alone as the surname みもと.
        self.assertEqual(_read(_tok("三本", "みもと", "名詞", "固有名詞")), ["さんぼん"])
        # One it read right is left: 一杯 いっぱい, 千本 せんぼん.
        self.assertEqual(_read(_tok("一杯", "いっぱい")), ["いっぱい"])
        self.assertEqual(_read(_tok("千本", "せんぼん")), ["せんぼん"])

    def test_what_is_not_a_counter_is_left(self) -> None:
        # 三分の一 is a third: さんぶんのいち, never さんぷん.
        got = _read(_tok("三", "さん", "名詞", "数詞"), _tok("分", "ぶん"), _particle("の"),
                    _tok("一", "いち", "名詞", "数詞"))
        self.assertEqual(got[:2], ["さん", "ぶん"])
        # 十分の休憩 is a ten-minute break.
        got = _read(_tok("十", "じゅう", "名詞", "数詞"), _tok("分", "ぶん"), _particle("の"),
                    _tok("休憩", "きゅうけい"))
        self.assertEqual(got[:2], ["じゅっ", "ぷん"])
        # 本 read もと is not the counter (三本木, a name).
        self.assertEqual(_read(_tok("三", "さん", "名詞", "数詞"), _tok("本", "もと"))[1], "もと")
        # A voiced counter never makes the numeral geminate.
        self.assertEqual(_read(_tok("一", "いち", "名詞", "数詞"), _tok("通", "どおり"))[0], "いち")

    def test_native_one_and_two(self) -> None:
        self.assertEqual(_read(_tok("一", "いち", "名詞", "数詞"), _tok("切れ", "きれ"))[0], "ひと")
        self.assertEqual(_read(_tok("二", "に", "名詞", "数詞"), _tok("口", "くち"))[0], "ふた")
        self.assertEqual(_read(_tok("一", "いち", "名詞", "数詞"), _tok("晩", "ばん"))[0], "ひと")
        # 一月 is January, いちがつ.
        self.assertEqual(_read(_tok("一", "いち", "名詞", "数詞"), _tok("月", "がつ"))[0], "いち")
        # 三切れ is さんきれ: the native number stops at two.
        self.assertEqual(_read(_tok("三", "さん", "名詞", "数詞"), _tok("切れ", "きれ"))[0], "さん")

    def test_read_numeral(self) -> None:
        for numeral, reading in (("一", "いち"), ("十", "じゅう"), ("十一", "じゅういち"),
                                 ("二十", "にじゅう"), ("百", "ひゃく"), ("三百", "さんびゃく"),
                                 ("六百", "ろっぴゃく"), ("八百", "はっぴゃく"), ("千", "せん"),
                                 ("三千", "さんぜん"), ("八千", "はっせん"),
                                 ("二千二十六", "にせんにじゅうろく")):
            with self.subTest(numeral):
                self.assertEqual(read_numeral(numeral), reading)
        for not_a_number in ("何", "", "一万", "一二", "本"):
            self.assertIsNone(read_numeral(not_a_number), not_a_number)


@NEEDS_TOKENIZER
class SentenceReadingTests(unittest.TestCase):
    """Whole sentences through the real tokenizer: what the learner sees."""

    CASES = {
        # The screenshot's two sentences.
        "お母さんに口答えしてはいけませんよ。": "母[かあ] 口[くち]答[ごた]",
        "彼は毎年軽井沢へ行く。": "彼[かれ] 毎[まい]年[とし] 軽[かる]井[い]沢[ざわ] 行[い]",
        # Spelled, not pronounced.
        "この魚はとても大きいです。": "魚[さかな] 大[おお]",
        "この道は工事中なので、通れません。": "道[みち] 工[こう]事[じ] 中[ちゅう] 通[とお]",
        "気温が下がると道路が凍る。": "気[き]温[おん] 下[さ] 道[どう]路[ろ] 凍[こお]",
        "残業が続きそうだ。": "残[ざん]業[ぎょう] 続[つづ]",
        "十日に会いましょう。": "十[とお] 日[か] 会[あ]",
        # The family.
        "お父さんとお兄さんとお姉さん": "父[とう] 兄[にい] 姉[ねえ]",
        "母は元気です。": "母[はは] 元[げん]気[き]",
        # Counters.
        "水を一本ください。": "水[みず] 一[いっ] 本[ぽん]",
        "花を三本ずつ買いました。": "花[はな] 三[さん] 本[ぼん] 買[か]",
        "駅までは歩いて三十分かかる。": "駅[えき] 歩[ある] 三[さん]十[じゅっ] 分[ぷん]",
        "学校は九時からです。": "学[がっ]校[こう] 九[く] 時[じ]",
        "四月四日に四人で来た。": "四[し] 月[がつ] 四[よっ] 日[か] 四[よ] 人[にん] 来[き]",
        "りんごが八つある。": "八[やっ]",
        # 何.
        "何を食べますか。": "何[なに] 食[た]",
        "これは何ですか。": "何[なん]",
        "今、何時ですか。": "今[いま] 何[なん]時[じ]",
        # Whole words.
        "明日、日本へ行きます。": "明日[あした] 日本[にほん] 行[い]",
        "日曜日は休みです。": "日[にち]曜[よう] 日[び] 休[やす]",
        "あの人は世界中を旅しています。": "人[ひと] 世[せ]界[かい] 中[じゅう] 旅[たび]",
        "一日中家にいた。": "一[いち] 日[にち]中[じゅう] 家[いえ]",
        "私たちは学生です。": "私[わたし] 学[がく]生[せい]",
        "絵を描くのが好きです。": "絵[え] 描[か] 好[す]",
        "努力が実を結んだ。": "努[ど]力[りょく] 実[み] 結[むす]",
        "桜の花は４月が盛りだ。": "桜[さくら] 花[はな] 月[がつ] 盛[さか]",
        "彼はもう盛りを過ぎた。": "彼[かれ] 盛[さか] 過[す]",
        "ご飯の盛りが少ない。": "飯[はん] 盛[も] 少[すく]",
        "言うまでもない。": "言[い]",
    }

    def test_sentences(self) -> None:
        for sentence, expected in self.CASES.items():
            with self.subTest(sentence):
                self.assertEqual(_ruby(sentence), expected)

    def test_the_dictation_bank_reads_as_written(self) -> None:
        # content/listening_clips.py's kana is written by hand, line by
        # line: the one gold reading in the repo. Every line's furigana,
        # read out with the kana it sits among, must spell it -- only a
        # line that is ambiguous in writing is let off, and named.
        from content import listening_clips

        # 十分 is じゅうぶん (enough) or じゅっぷん (ten minutes); the
        # writing does not say which.
        ambiguous = {"駅までバスで十分です。"}

        def plain(s):
            s = "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in s)
            return re.sub(r"[\s、。！？!?「」,.]", "", s)

        wrong = []
        rows = [row for level in listening_clips.BY_LEVEL.values() for row in level]
        for row in rows:
            if row["jp"] in ambiguous:
                continue
            said = "".join(p.get("reading") or p["text"] for p in align_sentence(row["jp"]))
            if plain(said) != plain(row["kana"]):
                wrong.append((row["jp"], plain(said), plain(row["kana"])))
        self.assertGreater(len(rows), 100, "the bank would pass vacuously")
        self.assertEqual(wrong, [])

    def test_the_analyser_reads_as_spelled(self) -> None:
        # The breakdown's rows print a word's reading beside it.
        from study.analysis import analyze_local

        tokens = {t["surface"]: t for t in analyze_local("大きい通りを通った。")["tokens"]}
        self.assertEqual(tokens["大きい"]["reading"], "おおきい")
        self.assertEqual([(p["text"], p.get("reading")) for p in tokens["大きい"]["furigana"]],
                         [("大", "おお"), ("きい", None)])


class AlignEdgeTests(unittest.TestCase):
    """align() is given readings from many places; none of them may make
    it print a wrong one."""

    def test_a_reading_holding_a_kanji_is_no_reading(self) -> None:
        # An unknown word the tokenizer echoes back: 軽鴨 over 軽鴨 would
        # teach nothing, and dividing it as if it were kana is worse.
        self.assertEqual(align_deck("軽鴨", "軽鴨"), [{"text": "軽鴨"}])
        self.assertEqual(align_deck("軽鴨です", "かる鴨です"), [{"text": "軽鴨です"}])

    def test_kana_only_text_has_no_furigana(self) -> None:
        self.assertEqual(align_deck("ひらがな", "ひらがな"), [{"text": "ひらがな"}])
        self.assertEqual(align_deck("カタカナ", "かたかな"), [{"text": "カタカナ"}])

    def test_no_reading(self) -> None:
        self.assertEqual(align_deck("学校", ""), [{"text": "学校"}])
        self.assertEqual(align_deck("", "がっこう"), [])

    def test_the_parts_always_spell_the_text(self) -> None:
        cases = [("食べる", "たべる"), ("食べる", "たべた"), ("お母さん", "おかあさん"),
                 ("時々", "ときどき"), ("取り扱い", "とりあつかい"), ("今朝", "けさ"),
                 ("大人", "おとな"), ("五つ", "いつつ"), ("日本", "にほん"),
                 ("見る", "みる"), ("一人々々", "ひとりひとり"), ("ＡＢＣ", "えーびーしー"),
                 ("学校へ行く", "がっこうへいく"), ("行く", "")]
        for text, reading in cases:
            with self.subTest(text):
                parts = align_deck(text, reading)
                self.assertEqual("".join(p["text"] for p in parts), text)
                for p in parts:
                    if p.get("reading"):
                        self.assertTrue(_KANJI.search(p["text"]), p)
                        self.assertTrue(_KANA.match(p["reading"]), p)

    def test_okurigana_is_never_read_twice(self) -> None:
        # べる over 食べる's べる would print the kana twice.
        parts = align_deck("食べる", "たべる")
        self.assertEqual([(p["text"], p.get("reading")) for p in parts], [("食", "た"), ("べる", None)])

    def test_iteration_mark(self) -> None:
        self.assertEqual([(p["text"], p.get("reading")) for p in align_deck("人々", "ひとびと")],
                         [("人", "ひと"), ("々", "びと")])


@NEEDS_TOKENIZER
class HeadwordExampleTests(unittest.TestCase):
    """A dictionary entry's examples read its headword as the entry does."""

    def _annotate(self, sentence, kanji, kana):
        from content.vocab_extras import _annotate_sentence

        return _annotate_sentence(sentence, kanji, kana)

    def _rubies(self, parts):
        return [(p["text"], p["reading"], p["highlight"]) for p in parts if p.get("reading")]

    def test_the_entrys_reading_wins_over_its_headword(self) -> None:
        parts = self._annotate("お母さんに口答えしてはいけませんよ。", "お母さん", "おかあさん")
        self.assertIn(("母", "かあ", True), self._rubies(parts))

    def test_the_same_kanji_inside_an_honorific_is_not_the_entry(self) -> None:
        # The entry 母 (はは) does not make お母さん's 母 はは.
        parts = self._annotate("母はお母さんではない。", "母", "はは")
        self.assertEqual(self._rubies(parts)[:2], [("母", "はは", True), ("母", "かあ", False)])

    def test_a_reading_the_tokenizer_agrees_with_is_kept(self) -> None:
        # 毎月 is まいげつ or まいつき; the tokenizer's is one of them.
        parts = self._annotate("毎月一回行く。", "毎月", "まいげつ/まいつき")
        self.assertEqual(self._rubies(parts)[:2], [("毎", "まい", True), ("月", "つき", True)])
        parts = self._annotate("昨夜は雨だった。", "昨夜", "ゆうべ/さくや")
        self.assertEqual("".join(r for _t, r, _h in self._rubies(parts)[:2]), "さくや")

    def test_an_inflected_headword(self) -> None:
        parts = self._annotate("昨日は大きかった。", "大きい", "おおきい")
        self.assertIn(("大", "おお", True), self._rubies(parts))

    def test_a_words_parts_share_its_word_and_the_next_word_does_not(self) -> None:
        parts = self._annotate("彼は毎年軽井沢へ行く。", "毎年", "まいとし/まいねん")
        words = {p["text"]: p["word"] for p in parts if p.get("reading")}
        self.assertEqual(words["毎"], words["年"])
        self.assertEqual(words["軽"], words["井"])
        self.assertEqual(words["井"], words["沢"])
        self.assertNotEqual(words["年"], words["軽"])
        self.assertNotEqual(words["彼"], words["毎"])


def _shipped_sentences() -> list[str]:
    """Every Japanese sentence the app ships in its content: the grammar
    catalogue's, the reading bank's, the dictation bank's and the
    comprehension seeds'."""
    here = os.path.join(os.path.dirname(__file__), "..", "content")
    found: set[str] = set()

    def walk(node):
        if isinstance(node, dict):
            for key, value in node.items():
                if key in ("jp", "ja", "sentence") and isinstance(value, str):
                    found.add(value)
                else:
                    walk(value)
        elif isinstance(node, (list, tuple)):
            for value in node:
                walk(value)

    for path in glob.glob(os.path.join(here, "grammar", "N*.json")) + glob.glob(
            os.path.join(here, "comprehension", "*.json")):
        with open(path, encoding="utf-8") as f:
            walk(json.load(f))
    from content import listening_clips, reading_sentences

    walk(reading_sentences.BY_LEVEL)
    walk(listening_clips.BY_LEVEL)
    return sorted(s for s in found if _KANJI.search(s))


@NEEDS_TOKENIZER
class ShippedSentenceTests(unittest.TestCase):
    """Every sentence the app ships, held to the shape the renderer
    relies on. A break in any of these is furigana that prints wrong."""

    @classmethod
    def setUpClass(cls) -> None:
        cls.sentences = _shipped_sentences()

    def test_there_are_sentences(self) -> None:
        self.assertGreater(len(self.sentences), 1500, "every check below would pass vacuously")

    def test_every_sentence_is_well_formed(self) -> None:
        problems = []
        for sentence in self.sentences:
            parts = align_sentence(sentence)
            if "".join(p["text"] for p in parts) != sentence:
                problems.append((sentence, "the parts do not spell the sentence"))
                continue
            last_word = -1
            for a, b in zip(parts, parts[1:]):
                if a.get("reading") is None and b.get("reading") is None:
                    problems.append((sentence, f"two bare parts side by side: {a['text']}|{b['text']}"))
            for p in parts:
                reading = p.get("reading")
                if reading is None:
                    continue
                if not _KANJI.search(p["text"]):
                    problems.append((sentence, f"a reading over kana: {p}"))
                if not _KANA.match(reading):
                    problems.append((sentence, f"a reading that is not kana: {p}"))
                if reading == p["text"]:
                    problems.append((sentence, f"a reading equal to its text: {p}"))
                if not isinstance(p.get("word"), int):
                    problems.append((sentence, f"a part that does not say its word: {p}"))
                elif p["word"] < last_word:
                    problems.append((sentence, f"a word's parts out of order: {p}"))
                else:
                    last_word = p["word"]
        self.assertEqual(problems, [])

    def test_no_reading_is_the_sound_instead_of_the_spelling(self) -> None:
        # The tokenizer's `pron` spells a long vowel as it sounds (おう
        # for 大's おお, とう for 通's とお, ず for 続's づ); a kanji's
        # reading is never that where the kanji's own readings say
        # otherwise: 大 is だい, たい or おお and never おう. Checked over
        # the kanji whose readings have a spelling the sound loses.
        sounded = {"大": "おう", "多": "おう", "通": "とう", "遠": "とう", "氷": "こう",
                   "凍": "こう", "続": "つず", "十": "とう"}
        wrong = []
        for sentence in self.sentences:
            for p in align_sentence(sentence):
                reading = p.get("reading") or ""
                if p["text"] in sounded and reading.startswith(sounded[p["text"]]):
                    wrong.append((sentence, p["text"], reading))
        self.assertEqual(wrong, [])


if __name__ == "__main__":
    unittest.main()
