"""
study/kanji_words.py -- which words use a kanji, and with which reading.

Pure: the deck's own data through the furigana aligner, no database and
no client. The readings panel behind the dictionary plate's "+N" is only
as good as this filing, so the cases are the three things the aligner
knows and this must not lose: an on-reading written in katakana in the
deck, a kun-reading's okurigana stem, and a non-initial element voicing
or geminating.
"""
import content.vocab_jmdict_data as jmdict_db
from content.kanji_data import KANJI_BY_LEVEL
from study.furigana import reading_stem, reading_token_for
from study.kanji_words import kanji_as_word, kanji_words, reading_tokens, MAX_WORDS


class TestReadingTokenFor:
    def test_an_on_reading_is_matched_across_scripts(self):
        # 木曜日: 木 read もく, the deck writes モク.
        assert reading_token_for("もく", ["ボク", "モク", "き", "こ~"], first=True) == "モク"

    def test_a_kun_reading_matches_by_its_stem(self):
        # 生きる: 生 read い, the deck writes い.きる (okurigana outside).
        tokens = reading_tokens("生")
        assert reading_token_for("い", tokens, first=True) == "い.きる"

    def test_an_explicit_bound_form_owns_its_word_before_rendaku_does(self):
        # 日 read び in 木曜日: the deck lists ~び itself, so ひ does not
        # claim the word through voicing.
        assert reading_token_for("び", ["ニチ", "ジツ", "ひ", "~び", "~か"], first=False) == "~び"

    def test_rendaku_is_a_second_pass_for_a_non_initial_element(self):
        # No bound form listed: the voiced surface still files under the
        # plain reading, but only when the kanji is not word-initial.
        assert reading_token_for("ざん", ["サン", "やま"], first=False) == "サン"
        assert reading_token_for("ざん", ["サン", "やま"], first=True) is None

    def test_gemination_files_under_the_full_reading(self):
        # 学校 がっこう: 学 read がっ, the deck writes ガク.
        assert reading_token_for("がっ", ["ガク", "まな.ぶ"], first=True) == "ガク"

    def test_nothing_matches_nothing(self):
        assert reading_token_for("", ["ガク"], first=True) is None
        assert reading_token_for(None, ["ガク"], first=True) is None
        assert reading_token_for("ねこ", ["ガク", "まな.ぶ"], first=True) is None


class TestReadingStem:
    def test_strips_okurigana_and_markers_and_reads_in_hiragana(self):
        assert reading_stem("い.きる") == "い"
        assert reading_stem("うま.れる") == "うま"
        assert reading_stem("~び") == "び"
        assert reading_stem("なま~") == "なま"
        assert reading_stem("セイ") == "せい"
        assert reading_stem("") == ""


class TestKanjiWords:
    def test_every_reading_is_listed_in_the_decks_order(self):
        out = kanji_words("木", "en")
        assert [r["reading"] for r in out["readings"]] == reading_tokens("木") == ["ボク", "モク", "き", "こ~"]

    def test_words_are_filed_under_the_reading_they_use(self):
        by = {r["reading"]: r["words"] for r in kanji_words("木", "en")["readings"]}
        assert any(w["kanji"] == "木曜日" for w in by["モク"])
        # The bare word 木 (き) files under the kun reading, after the compounds.
        assert any(w["kanji"] == "木" and w["kana"] == "き" for w in by["き"])
        assert not any(w["kanji"] == "木曜日" for w in by["き"])

    def test_each_word_carries_what_a_row_prints(self):
        word = kanji_words("木", "en")["readings"][1]["words"][0]
        assert set(word) == {"kanji", "kana", "meaning", "level", "furigana"}
        assert word["meaning"]
        assert word["furigana"]

    def test_a_reading_has_at_most_max_words(self):
        for r in kanji_words("生", "en")["readings"]:
            assert len(r["words"]) <= MAX_WORDS

    @staticmethod
    def _stems_of_examples(out):
        """The stem each ledger word demonstrates, from the panel's filing."""
        by_key = {}
        for r in out["readings"]:
            for w in r["words"]:
                by_key.setdefault((w["kanji"], w["kana"]), reading_stem(r["reading"]))
        return [by_key.get((w["kanji"], w["kana"])) for w in out["examples"]]

    def test_the_ledger_spreads_its_slots_across_readings(self):
        # 生 has twenty readings in the deck; by level alone its four
        # examples were セイ four times. Round-robin across the filed
        # readings, one per stem.
        out = kanji_words("生", "en")
        stems = self._stems_of_examples(out)
        assert len(out["examples"]) == MAX_WORDS
        assert len(set(s for s in stems if s is not None)) == MAX_WORDS

    def test_the_ledger_never_repeats_a_stem_while_another_has_words(self):
        # Every kanji in the two commonest levels: the ledger's stems are
        # as many as it could possibly show -- one per filed stem, up to
        # its four slots -- before any stem gets a second word.
        for level in ("N5", "N4"):
            for entry in KANJI_BY_LEVEL[level]:
                out = kanji_words(entry["kanji"], "en")
                available = {reading_stem(r["reading"]) for r in out["readings"] if r["words"]}
                shown = [s for s in self._stems_of_examples(out) if s is not None]
                want = min(MAX_WORDS, len(available))
                assert len(set(shown[:want])) == want, (entry["kanji"], shown, available)

    def test_a_word_the_aligner_cannot_place_waits_for_every_placed_word(self):
        # Nothing is ever filed under a reading it cannot vouch for, and
        # the ledger prints such a word only once the filed readings have
        # no word left -- not in the first round's spare slot, which is
        # how 今朝 came before 今週.
        for level in ("N5", "N4"):
            for entry in KANJI_BY_LEVEL[level]:
                out = kanji_words(entry["kanji"], "en")
                filed = {(w["kanji"], w["kana"]) for r in out["readings"] for w in r["words"]}
                shown = [(w["kanji"], w["kana"]) for w in out["examples"]]
                unplaced = [k for k in shown if k not in filed]
                if unplaced:
                    assert filed <= set(shown), (entry["kanji"], shown)
                    assert shown[-len(unplaced):] == unplaced, (entry["kanji"], shown)

    def test_a_whole_word_reading_does_not_crowd_out_a_real_one(self):
        # The four words that reported this: each reads its kanji as part
        # of a whole (今朝 けさ, 時計 とけい, 火傷 やけど, 不山戯る ふざける),
        # and each kanji has more placed words than the ledger has slots.
        for char, word in (("今", "今朝"), ("時", "時計"), ("火", "火傷"), ("山", "不山戯る")):
            shown = [w["kanji"] for w in kanji_words(char, "en")["examples"]]
            assert word not in shown, (char, shown)

    def test_a_word_written_in_kana_goes_after_the_rest_of_its_reading(self):
        # 葉書 is N5 but written はがき; the words that write 書 as が(き)
        # come first, whatever their level.
        by = {r["reading"]: r["words"] for r in kanji_words("書", "en")["readings"]}
        words = [w["kanji"] for w in by["~が.き"]]
        assert "葉書" in words
        assert words.index("葉書") > words.index("下書き")

    def test_a_kanji_outside_the_deck_has_no_readings_and_no_words(self):
        assert kanji_words("鰻", "en") == {"readings": [], "examples": []}

    def test_french_glosses_follow_the_language(self):
        en = kanji_words("木", "en")["readings"][1]["words"][0]["meaning"]
        fr = kanji_words("木", "fr")["readings"][1]["words"][0]["meaning"]
        assert en and fr


class TestKanjiAsWord:
    """A character that is a word on its own, and how it is read as one.

    The catalogue tile prints one reading as furigana over the
    character, and 山's own list starts サン・セン: a tile that shows the
    first of them says nothing about the word やま, which is what a
    single character on a card usually means.
    """

    def test_reads_a_character_that_is_a_word(self):
        assert kanji_as_word("山") == "やま"
        assert kanji_as_word("水") == "みず"
        assert kanji_as_word("駅") == "えき"

    def test_none_for_a_character_the_deck_has_no_word_for(self):
        # 食 is only ever part of a word in the deck (食べる, 食事).
        assert kanji_as_word("食") is None
        assert kanji_as_word("々") is None

    def test_the_commoner_word_wins_where_a_character_is_two(self):
        # 日 is ひ at N4 and にち at N3; the lower level is the commoner
        # word, and the one a tile of 日 most likely means.
        assert kanji_as_word("日") == "ひ"

    def test_never_a_multi_character_word(self):
        # The index is built from the vocab deck, where most entries are
        # compounds — none of them may leak in under a single character.
        from study.kanji_words import _SINGLE_KANJI_WORDS
        assert all(len(char) == 1 for char in _SINGLE_KANJI_WORDS)
        assert all(kana for kana in _SINGLE_KANJI_WORDS.values())


class TestPoolWords:
    """Plan 175: a reading the deck has no word for is filled from the
    JMdict pool, behind the deck's own words."""

    def test_the_index_answers_for_a_character_in_commonest_order(self):
        rows = jmdict_db.by_kanji_char("桃")
        assert [(r["kanji"], r["kana"]) for r in rows[:2]] == [("桃", "もも"), ("桃色", "ももいろ")]
        assert [r["freq_rank"] for r in rows] == sorted(r["freq_rank"] for r in rows)
        assert all("桃" in r["kanji"] for r in rows)

    def test_the_index_is_capped_and_empty_for_a_character_no_word_has(self):
        assert len(jmdict_db.by_kanji_char("生")) <= jmdict_db.KANJI_INDEX_CAP
        assert len(jmdict_db.by_kanji_char("生", limit=5)) == 5
        assert jmdict_db.by_kanji_char("a") == []
        assert jmdict_db.by_kanji_char("") == []

    def test_a_reading_the_deck_has_no_word_for_gets_pool_words(self):
        # 桃 (peach): the deck has no word for it at all, and the plate
        # used to print もも as a bare chip.
        out = kanji_words("桃", "en")
        by = {r["reading"]: r["words"] for r in out["readings"]}
        assert [w["kanji"] for w in by["もも"]][:2] == ["桃", "桃色"]
        assert by["トウ"], by
        for words in by.values():
            for w in words:
                assert w["level"] is None
                assert w["furigana"] and w["meaning"]
                assert set(w) == {"kanji", "kana", "meaning", "level", "furigana"}

    def test_the_ledger_shows_the_pool_words_too(self):
        shown = {w["kanji"] for w in kanji_words("桃", "en")["examples"]}
        assert "桃" in shown and shown & {"黄桃", "桃源郷", "白桃", "武陵桃源"}

    def test_the_deck_words_stay_ahead_of_the_pool(self):
        # 生: the deck's N5 words open セイ, whatever the pool holds.
        words = {r["reading"]: r["words"] for r in kanji_words("生", "en")["readings"]}["セイ"]
        assert [w["level"] for w in words] == ["N5"] * len(words)
        for r in kanji_words("生", "en")["readings"]:
            levels = [w["level"] is None for w in r["words"]]
            assert levels == sorted(levels), (r["reading"], levels)

    def test_no_word_is_listed_twice_across_readings(self):
        for char in ("生", "桃", "日", "人"):
            seen = [(w["kanji"], w["kana"]) for r in kanji_words(char, "en")["readings"] for w in r["words"]]
            assert len(seen) == len(set(seen)), char

    def test_a_pool_word_is_glossed_as_jmdict_wrote_it_in_either_language(self):
        # vocab_fr is the deck's; a pool homograph would collect the deck
        # word's French (routes/dictionary.py serves the pool the same way).
        fr = {r["reading"]: r["words"] for r in kanji_words("桃", "fr")["readings"]}["もも"][0]
        en = {r["reading"]: r["words"] for r in kanji_words("桃", "en")["readings"]}["もも"][0]
        assert fr["meaning"] == en["meaning"]

    def test_a_pool_word_is_filed_under_the_okurigana_it_writes(self):
        # 生かす and 生ける are both い; they used to file under the first
        # い.* of the list, so い.かす and い.ける stayed bare chips.
        by = {r["reading"]: [w["kanji"] for w in r["words"]] for r in kanji_words("生", "en")["readings"]}
        assert "生かす" in by["い.かす"]
        assert "生ける" in by["い.ける"]
        assert "生きる" in by["い.きる"] and "生きる" not in by["い.かす"]
        assert "生まれる" in by["う.まれる"] and "生まれ" in by["う.まれ"]
