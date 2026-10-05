# study/romaji.sentence_romaji is what reading practice shows as the
# reference reading at the reveal (ReadingRun.jsx), and the learner
# grades themselves against it (docs/adr/0013). That makes a wrong
# reading worse than no reading: someone who read 九時 correctly as
# くじ is shown "kyuuji" and marks their own right answer wrong.
#
# UniDic tokenizes a numeral and its counter apart and gives each its
# citation reading, so the compounds whose reading is irregular came
# back as the sum of their parts. Pinned here because the correction is
# a table and a table is exactly the thing that quietly loses a row.
# Since plan 184 the table is the furigana's (study/reading_context.py),
# which the romaji now reads too, so the two can no longer disagree --
# ContextTests below holds the words that table puts right beyond the
# hour and the minute.
#
# The app's own hand-written banks are the authority for each figure:
# content/listening_clips.py writes 九時 くじ, 十分 じゅっぷん and
# 三十分 さんじゅっぷん, and every one of those lines is read aloud by
# the voice engine, so they are what a learner actually hears.
import unittest

from study import morphology
from study.romaji import fold, sentence_romaji


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs fugashi/unidic-lite")
class HourTests(unittest.TestCase):
    """四時 よじ, 七時 しちじ, 九時 くじ -- the three the counting
    readings (よん, なな, きゅう) get wrong."""

    def test_the_three_irregular_hours(self) -> None:
        for jp, expected in (
            ("四時です。", "yojidesu."),
            ("七時です。", "shichijidesu."),
            ("九時です。", "kujidesu."),
        ):
            with self.subTest(jp=jp):
                self.assertEqual(sentence_romaji(jp), expected)

    def test_the_regular_hours_are_left_alone(self) -> None:
        for jp, expected in (
            ("一時です。", "ichijidesu."),
            ("二時です。", "nijidesu."),
            ("三時です。", "sanjidesu."),
            ("五時です。", "gojidesu."),
            ("六時です。", "rokujidesu."),
            ("八時です。", "hachijidesu."),
            ("十時です。", "juujidesu."),
            ("何時ですか。", "nanjidesu ka."),
        ):
            with self.subTest(jp=jp):
                self.assertEqual(sentence_romaji(jp), expected)

    def test_a_compound_hour_takes_the_last_digit(self) -> None:
        """十一時 じゅういちじ keeps いち; 十四時 じゅうよじ does not keep
        よん. The fix reads the number immediately before the counter,
        not the whole numeral."""
        self.assertEqual(sentence_romaji("十一時です。"), "juuichijidesu.")
        self.assertEqual(sentence_romaji("十四時です。"), "juuyojidesu.")

    def test_the_n5_sentence_that_found_this(self) -> None:
        self.assertEqual(
            sentence_romaji("九時から五時まで会社にいます。"),
            "kuji kara goji made kaisha ni imasu.",
        )
        self.assertEqual(
            sentence_romaji("七時に学校へ行きます。"),
            "shichiji ni gakkou e ikimasu.",
        )


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs fugashi/unidic-lite")
class MinuteTests(unittest.TestCase):
    """〜分 is ぷん after a number ending ん and after one that
    geminates, ふん otherwise -- and the number moves too."""

    def test_the_geminating_numbers(self) -> None:
        for jp, expected in (
            ("一分。", "ippun."),
            ("六分。", "roppun."),
            ("八分。", "happun."),
            ("十分ほどかかります。", "juppun hodo kakarimasu."),
            ("百分。", "hyappun."),
        ):
            with self.subTest(jp=jp):
                self.assertEqual(sentence_romaji(jp), expected)

    def test_a_number_ending_in_n_voices_the_counter_without_geminating(self) -> None:
        for jp, expected in (
            ("三分。", "sanpun."),
            ("四分。", "yonpun."),
            ("何分ですか。", "nanpundesu ka."),
        ):
            with self.subTest(jp=jp):
                self.assertEqual(sentence_romaji(jp), expected)

    def test_the_rest_stay_fun(self) -> None:
        for jp, expected in (
            ("二分。", "nifun."),
            ("五分。", "gofun."),
            ("七分。", "nanafun."),
            ("九分。", "kyuufun."),
        ):
            with self.subTest(jp=jp):
                self.assertEqual(sentence_romaji(jp), expected)

    def test_a_multiple_of_ten_geminates_on_its_own_tail(self) -> None:
        """三十分 さんじゅっぷん, but 十五分 じゅうごふん -- the number
        immediately before the counter is 五, not 十五."""
        self.assertEqual(sentence_romaji("三十分。"), "sanjuppun.")
        self.assertEqual(sentence_romaji("二十分。"), "nijuppun.")
        self.assertEqual(sentence_romaji("十五分。"), "juugofun.")

    def test_the_bank_sentences(self) -> None:
        self.assertEqual(
            sentence_romaji("駅までは歩いて三十分かかるかもしれません。"),
            "eki made wa aruite sanjuppun kakaru ka mo shiremasen.",
        )
        self.assertEqual(
            sentence_romaji("駅まで五分ぐらいかかります。"),
            "eki made gofun gurai kakarimasu.",
        )


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs fugashi/unidic-lite")
class NotACounterTests(unittest.TestCase):
    """The rule fires on a numeral and an irregular counter, and on
    nothing else. 分 and 時 are ordinary words far more often than they
    are counters."""

    def test_fun_that_is_not_the_minute_counter(self) -> None:
        for jp, expected in (
            ("半分ください。", "hanbun kudasai."),
            ("分かりますか。", "wakarimasu ka."),
            ("この部分です。", "kono bubundesu."),
        ):
            with self.subTest(jp=jp):
                self.assertEqual(sentence_romaji(jp), expected)

    def test_ji_that_is_not_the_hour_counter(self) -> None:
        self.assertEqual(sentence_romaji("一時間かかります。"), "ichijikan kakarimasu.")
        self.assertEqual(sentence_romaji("五分間待ちます。"), "gofunkan machimasu.")

    def test_the_adverb_juubun_is_left_alone(self) -> None:
        """十分 is じゅうぶん ("enough") as often as it is じゅっぷん, and
        which one it is, is the tokenizer's word-sense call rather than
        this module's. Where UniDic splits it into 十 + 分 the rule
        above applies; where it reads one adverb, nothing here touches
        it -- see study/romaji.py's note."""
        self.assertEqual(sentence_romaji("十分な時間があります。"), "juubunna jikan ga arimasu.")
        self.assertEqual(sentence_romaji("十分に休みました。"), "juubunni yasumimashita.")

    def test_the_particles_and_the_weekday_still_work(self) -> None:
        """The reading in context sits in the same chain as _SAID_KANA,
        and the 〜曜日 rendaku is now the context table's, so it is worth
        proving neither was lost."""
        self.assertEqual(sentence_romaji("わたしは学生です。"), "watashi wa gakuseidesu.")
        self.assertEqual(sentence_romaji("日よう日に来ます。"), "nichiyoubi ni kimasu.")


@unittest.skipUnless(morphology.MORPHOLOGY_AVAILABLE, "needs fugashi/unidic-lite")
class ContextTests(unittest.TestCase):
    """The romaji reads what the furigana reads (plan 184): every word
    study/reading_context.py puts right in context, and every number in
    digits read with its counter (plan 177). Before, the romaji under a
    sentence said "juupon" where the reading over it said じゅっぽん."""

    def test_the_counters_beyond_the_hour_and_the_minute(self) -> None:
        for jp, expected in (
            ("百円の花を十本買いました。", "hyakuen no hana o juppon kaimashita."),
            ("水を一本ください。", "mizu o ippon kudasai."),
            ("三本あります。", "sanbon arimasu."),
            ("七月です。", "shichigatsudesu."),
            ("この本を一晩で読み通すつもりだ。", "kono hon o hitoban de yomi toosu tsumorida."),
        ):
            with self.subTest(jp=jp):
                self.assertEqual(sentence_romaji(jp), expected)

    def test_a_number_in_digits_is_read(self) -> None:
        for jp, expected in (
            ("りんごを6本買いました。", "ringo o roppon kaimashita."),
            ("100円です。", "hyakuendesu."),
            ("3日に会いましょう。", "mikka ni aimashou."),
        ):
            with self.subTest(jp=jp):
                self.assertEqual(sentence_romaji(jp), expected)

    def test_the_words_read_by_their_neighbours(self) -> None:
        for jp, expected in (
            ("明日、日本語を話します。", "ashita, nihongo o hanashimasu."),
            ("何をしますか。", "nani o shimasu ka."),
            ("今、何時ですか。", "ima, nanjidesu ka."),
            ("世界中を旅しています。", "sekaijuu o tabi shite imasu."),
            ("お母さんは大きい。", "okaasan wa ookii."),
        ):
            with self.subTest(jp=jp):
                self.assertEqual(sentence_romaji(jp), expected)

    def test_the_romaji_spells_the_furigana(self) -> None:
        """Word for word, the romaji is the furigana's reading: what is
        printed over a sentence and under it never disagree."""
        from study.furigana import align_sentence
        from study.romaji import to_romaji
        for jp in ("百円の花を十本買いました。", "明日の朝、駅で待っています。", "6本と3日。"):
            with self.subTest(jp=jp):
                reading = "".join(p.get("reading") or p["text"] for p in align_sentence(jp))
                self.assertEqual(fold(sentence_romaji(jp)), fold(to_romaji(reading)))

    def test_the_dictation_bank_agrees(self) -> None:
        """書取's romaji is written by hand from what the clip says, so
        it is the one gold romaji the repo holds. Every line agrees with
        the generated one but 十分 in 駅までバスで十分です, which UniDic reads
        as the adverb じゅうぶん, as the furigana does: the tokenizer's call
        (see test_the_adverb_juubun_is_left_alone)."""
        from content.listening_clips import BY_LEVEL
        off = [row["jp"] for rows in BY_LEVEL.values() for row in rows
               if fold(row["romaji"]) != fold(sentence_romaji(row["jp"]))]
        self.assertEqual(off, ["駅までバスで十分です。"])


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
