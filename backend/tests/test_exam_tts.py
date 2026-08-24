import importlib
import os
import unittest


class ExamAudioDirTests(unittest.TestCase):
    """study/exam_tts.py's writer and main.py's StaticFiles mount must
    resolve EXAM_AUDIO_DIR identically, or files get written to one place
    and served from another -- exactly the split that caused the original
    bug (write path was __file__-relative, mount path was cwd-relative,
    and neither read the disk env var at all)."""

    def test_env_var_overrides_default_dir(self) -> None:
        os.environ["EXAM_AUDIO_DIR"] = "/tmp/custom-exam-audio-test"
        try:
            import study.exam_tts as tts
            importlib.reload(tts)
            self.assertEqual(tts._AUDIO_DIR, "/tmp/custom-exam-audio-test")
        finally:
            del os.environ["EXAM_AUDIO_DIR"]
            importlib.reload(tts)

    def test_main_mount_reads_same_env_var(self) -> None:
        main_src = (
            __import__("pathlib").Path(__file__).resolve().parents[1] / "main.py"
        ).read_text(encoding="utf-8")
        self.assertIn('os.environ.get("EXAM_AUDIO_DIR")', main_src)
