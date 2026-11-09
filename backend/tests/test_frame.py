# 骨組み (plan 311): a line's construction as its parts, held to the line
# (study/frame.py). The model writes the frame; nothing in it reaches a
# learner that the line, or the line before or after it, does not hold.
import unittest

from study.frame import DROPPED, MAX_PARTS, ROLES, clean_frame, context_sides, frame_text

LINE = "それらしくするのでかかりきりになるんだ"
REASON = {"jp": "それらしくするので", "role": "reason", "say": "それらしい in its く form describes する."}
PREDICATE = {"jp": "かかりきりになるんだ", "role": "predicate", "say": "かかりきり, then になる and んだ."}


class PartsTests(unittest.TestCase):
    def test_each_part_is_a_run_of_the_line_in_order(self) -> None:
        frame = clean_frame([REASON, PREDICATE], LINE)
        self.assertEqual([p["jp"] for p in frame], ["それらしくするので", "かかりきりになるんだ"])
        self.assertEqual([(p["start"], p["end"]) for p in frame], [(0, 9), (9, 19)])
        self.assertEqual([p["role"] for p in frame], ["reason", "predicate"])

    def test_the_text_is_the_line_s_not_the_model_s(self) -> None:
        # The model left out the comma and the full stop and wrote the
        # verb in half-width kana: the parts print the line as written,
        # each reaching over the marks after it.
        line = "雨がフッたので、出かけなかった。"
        frame = clean_frame([{"jp": "雨がﾌｯたので", "role": "reason"},
                             {"jp": "出かけなかった", "role": "predicate"}], line)
        self.assertEqual([p["jp"] for p in frame], ["雨がフッたので、", "出かけなかった。"])
        self.assertEqual("".join(line[p["start"]:p["end"]] for p in frame), line)

    def test_a_part_out_of_order_or_not_in_the_line_is_dropped(self) -> None:
        frame = clean_frame([PREDICATE, REASON, {"jp": "大人は", "role": "topic"}], LINE)
        self.assertEqual([p["jp"] for p in frame], ["かかりきりになるんだ"])

    def test_a_frame_that_misses_most_of_the_line_is_none(self) -> None:
        self.assertEqual(clean_frame([{"jp": "ので", "role": "reason"}], LINE), [])
        self.assertEqual(clean_frame("A paragraph instead.", LINE), [])
        self.assertEqual(clean_frame([], LINE), [])

    def test_a_role_outside_the_list_keeps_its_part_unnamed(self) -> None:
        frame = clean_frame([{**REASON, "role": "Raison"}, PREDICATE], LINE)
        self.assertEqual(frame[0]["role"], "")
        self.assertIn("predicate", ROLES)

    def test_a_long_note_is_cut(self) -> None:
        frame = clean_frame([{**REASON, "say": "word " * 200}, PREDICATE], LINE)
        self.assertLessEqual(len(frame[0]["say"]), 281)

    def test_a_reply_cut_too_fine_keeps_its_first_parts(self) -> None:
        line = "あいうえおかきくけこさしすせそ"
        frame = clean_frame([{"jp": c, "role": "modifier"} for c in line], line)
        self.assertEqual(len(frame), MAX_PARTS)


class LeftOutTests(unittest.TestCase):
    """What the line does not say: a copula or a particle it drops, a
    part a neighbouring line carries. Never anything else."""

    def test_a_dropped_copula_rides_on_its_part(self) -> None:
        frame = clean_frame([{"jp": "関心は", "role": "topic"}, {"jp": "まだ", "role": "modifier"},
                             {"jp": "僕ら", "role": "predicate", "dropped": "だ"}], "関心はまだ僕ら")
        self.assertEqual(frame[-1]["dropped"], "だ")
        self.assertIn("だ", DROPPED)

    def test_only_a_copula_or_a_particle_is_ever_left_out(self) -> None:
        # The paragraph this replaces supplied "the unstated negative".
        frame = clean_frame([{"jp": "関心はまだ", "role": "topic"},
                             {"jp": "僕ら", "role": "predicate", "dropped": "ない"}], "関心はまだ僕ら")
        self.assertNotIn("dropped", frame[-1])

    def test_a_word_the_line_has_is_not_left_out(self) -> None:
        frame = clean_frame([{"jp": "僕ら", "role": "predicate", "dropped": "だ"}], "僕らだ")
        self.assertNotIn("dropped", frame[0])

    def test_a_carried_part_stands_in_the_line_it_comes_from(self) -> None:
        before = "じっと見ないで / きっと大人は"
        frame = clean_frame([{"jp": "大人は", "role": "topic", "from": "before"}, REASON, PREDICATE],
                            LINE, before=before)
        self.assertEqual(frame[0], {"jp": "大人は", "role": "topic", "say": "", "from": "before"})
        self.assertEqual([p.get("from") for p in frame], ["before", None, None])

    def test_a_carried_part_no_line_holds_is_dropped(self) -> None:
        for carried, before in (("子供は", "きっと大人は"), ("大人は", ""), ("それらしく", "それらしく")):
            frame = clean_frame([{"jp": carried, "role": "topic", "from": "before"}, REASON, PREDICATE],
                                LINE, before=before)
            self.assertFalse(any(p.get("from") for p in frame), carried)

    def test_a_part_carried_from_after_comes_last(self) -> None:
        frame = clean_frame([{"jp": "歌う", "role": "predicate", "from": "after"}, REASON, PREDICATE],
                            LINE, after="一緒に歌う")
        self.assertEqual(frame[-1]["from"], "after")


class TextTests(unittest.TestCase):
    def test_the_frame_as_text_is_a_part_a_line(self) -> None:
        frame = clean_frame([{"jp": "大人は", "role": "topic", "from": "before"},
                             {"jp": "関心は", "role": "topic", "say": "The topic."},
                             {"jp": "まだ僕ら", "role": "predicate", "dropped": "だ"}],
                            "関心はまだ僕ら", before="大人は")
        self.assertEqual(frame_text(frame), "関心は — The topic.\nまだ僕ら（だ）")
        self.assertEqual(frame_text([]), "")

    def test_the_sides_are_read_off_the_context_block(self) -> None:
        context = "Intro.\n- From a song.\n- Before it: 一 / 二\n- After it: 三"
        self.assertEqual(context_sides(context), ("一 / 二", "三"))
        self.assertEqual(context_sides(""), ("", ""))
