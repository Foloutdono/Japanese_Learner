"""
study/kanji_words.py -- which words use a kanji, and with which reading.

Pure: the deck's own data through the furigana aligner, no database and
no client. The readings panel behind the dictionary plate's "+N" is only
as good as this filing, so the cases are the three things the aligner
knows and this must not lose: an on-reading written in katakana in the
deck, a kun-reading's okurigana stem, and a non-initial element voicing
or geminating.
"""
from content.kanji_data import KANJI_BY_LEVEL
from study.furigana import reading_stem, reading_token_for
from study.kanji_words import kanji_words, reading_tokens, MAX_WORDS


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

    def test_a_word_the_aligner_cannot_place_is_still_a_ledger_example_last(self):
        # Nothing is ever filed under a reading it cannot vouch for, but
        # the ledger may still print it once the filed readings run out.
        out = kanji_words("木", "en")
        filed = {(w["kanji"], w["kana"]) for r in out["readings"] for w in r["words"]}
        unplaced = [w for w in out["examples"] if (w["kanji"], w["kana"]) not in filed]
        if unplaced:
            assert out["examples"].index(unplaced[0]) >= len(out["examples"]) - len(unplaced)

    def test_a_kanji_outside_the_deck_has_no_readings_and_no_words(self):
        assert kanji_words("鰻", "en") == {"readings": [], "examples": []}

    def test_french_glosses_follow_the_language(self):
        en = kanji_words("木", "en")["readings"][1]["words"][0]["meaning"]
        fr = kanji_words("木", "fr")["readings"][1]["words"][0]["meaning"]
        assert en and fr
