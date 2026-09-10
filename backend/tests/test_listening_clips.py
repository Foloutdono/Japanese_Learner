"""The listening collection, held to its own rules.

content/listening_clips.py carries those rules in problems() -- a bank
is worth exactly as much as the promise that its lines are at the level
they claim, and a dictation bank has a second promise on top of it: the
reading beside each line is what the learner is graded against, so a
mistyped one marks a correct transcription wrong and there is nothing
on the screen that would let anyone notice.
"""
import unittest

from content.listening_clips import BY_LEVEL, LENGTH_CAP, LEVELS, all_clips
from content.listening_clips import problems
from study import dictation


class BankTests(unittest.TestCase):
    def test_every_line_follows_the_bank_rules(self) -> None:
        found = problems()
        self.assertEqual(found, [], "\n".join(found))

    def test_every_level_has_enough_to_practise_with(self) -> None:
        """A session serves batches of five and excludes what it has
        already played. Below about fifteen the same line comes round
        inside one sitting, which for a dictation is not practice at
        all -- the second hearing is a memory test."""
        for level in LEVELS:
            with self.subTest(level=level):
                self.assertGreaterEqual(len(BY_LEVEL[level]), 15)

    def test_the_caps_get_longer_with_the_level(self) -> None:
        caps = [LENGTH_CAP[level] for level in LEVELS]
        self.assertEqual(caps, sorted(caps))
        self.assertEqual(len(caps), len(set(caps)))

    def test_every_line_carries_a_level(self) -> None:
        for row in all_clips():
            self.assertIn(row["level"], LEVELS)


class ClipIdentityTests(unittest.TestCase):
    """The collection has no manifest and no id column: a line's id IS
    the content key of its own audio. These are the properties that
    arrangement stands on."""

    def test_ids_are_unique_across_the_whole_collection(self) -> None:
        ids = [dictation.clip_id(row["jp"]) for row in all_clips()]
        self.assertEqual(len(ids), len(set(ids)))

    def test_an_id_resolves_back_to_its_own_line(self) -> None:
        for row in all_clips():
            with self.subTest(jp=row["jp"]):
                found = dictation.entry_for(dictation.clip_id(row["jp"]))
                self.assertIsNotNone(found)
                self.assertEqual(found["jp"], row["jp"])

    def test_an_id_is_derived_from_the_text_and_nothing_else(self) -> None:
        """Two runs, two processes, a fresh clone: the same line names
        the same file. This is what lets a dictation_log row from a year
        ago still point at its clip, and what makes the build script's
        'already there' check meaningful."""
        row = BY_LEVEL["N5"][0]
        self.assertEqual(dictation.clip_id(row["jp"]), dictation.clip_id(row["jp"]))
        self.assertNotEqual(dictation.clip_id(row["jp"]), dictation.clip_id(row["jp"] + "。"))

    def test_the_url_names_the_file_the_repair_path_looks_up(self) -> None:
        """main.py serves /exam-audio/<key>.mp3 and, on a 404, hands the
        filename to study/exam_audio_repair.restore_clip, which strips
        the key back off and asks dictation.restore to re-make it. That
        round trip has to close, and the key it closes on has to be the
        one the URL carried."""
        row = BY_LEVEL["N3"][0]
        key = dictation.clip_id(row["jp"])
        self.assertEqual(dictation.clip_url(row["jp"]), f"/exam-audio/{key}.mp3")

        made = []
        original = dictation.ensure_clip
        dictation.ensure_clip = lambda jp: made.append(jp) or "/exam-audio/x.mp3"
        try:
            self.assertTrue(dictation.restore(key))
        finally:
            dictation.ensure_clip = original
        self.assertEqual(made, [row["jp"]])

    def test_an_unknown_key_restores_nothing(self) -> None:
        self.assertFalse(dictation.restore("0" * 24))
        self.assertIsNone(dictation.entry_for("not-a-key"))


if __name__ == "__main__":
    unittest.main()
