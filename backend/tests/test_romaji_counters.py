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
#
# The app's own hand-written banks are the authority for each figure:
# content/listening_clips.py writes 九時 くじ, 十分 じゅっぷん and
# 三十分 さんじゅっぷん, and every one of those lines is read aloud by
# the voice engine, so they are what a learner actually hears.
import unittest

from study import morphology
from study.romaji import sentence_romaji


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
        """The counter fix sits in the same chain as _SAID_KANA and the
        〜曜日 rendaku, so it is worth proving it did not displace
        either."""
        self.assertEqual(sentence_romaji("わたしは学生です。"), "watashi wa gakuseidesu.")
        self.assertEqual(sentence_romaji("日よう日に来ます。"), "nichiyoubi ni kimasu.")


if __name__ == "__main__":  # pragma: no cover
    unittest.main()
