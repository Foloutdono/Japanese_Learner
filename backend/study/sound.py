"""
Sound effects using Python's built-in winsound (Windows) or
cross-platform beep via tkinter bell. Generates simple tones
with wave + audioop for correct/wrong/rating sounds.
Toggle-able at runtime.
"""

import sys
import os
import threading
import struct
import wave
import tempfile


class SoundManager:
    """
    Plays short sound effects for correct / wrong / rating.
    Falls back gracefully if audio is unavailable.
    Sounds are generated on the fly (no external files needed).
    """

    def __init__(self):
        self.enabled = True
        self._backend = self._detect_backend()
        self._cache: dict[str, str] = {}  # name -> tmp wav path
        if self._backend == "wave":
            self._generate_sounds()

    def _detect_backend(self) -> str:
        if sys.platform == "win32":
            try:
                import winsound  # noqa
                return "wave"
            except ImportError:
                pass
        try:
            import subprocess
            if sys.platform == "darwin":
                return "afplay"
            # Linux: try aplay
            result = subprocess.run(["which", "aplay"], capture_output=True)
            if result.returncode == 0:
                return "aplay"
        except Exception:
            pass
        return "none"

    def _sine_wave(self, freq: float, duration: float,
                   volume: float = 0.4, sample_rate: int = 22050) -> bytes:
        """Generate a sine wave as raw 16-bit PCM bytes."""
        import math
        n_samples = int(sample_rate * duration)
        data = []
        for i in range(n_samples):
            t = i / sample_rate
            # Slight fade-out to avoid clicks
            fade = 1.0 if i < n_samples * 0.85 else (n_samples - i) / (n_samples * 0.15)
            sample = int(32767 * volume * fade * math.sin(2 * math.pi * freq * t))
            data.append(struct.pack("<h", max(-32767, min(32767, sample))))
        return b"".join(data)

    def _make_wav(self, name: str, segments: list[tuple[float, float, float]]):
        """segments: list of (freq, duration, volume)"""
        sample_rate = 22050
        pcm = b"".join(self._sine_wave(f, d, v, sample_rate) for f, d, v in segments)
        tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
        with wave.open(tmp.name, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            wf.writeframes(pcm)
        self._cache[name] = tmp.name

    def _generate_sounds(self):
        # Correct: pleasant ascending two-tone
        self._make_wav("correct", [(523, 0.07, 0.35), (659, 0.12, 0.35)])
        # Perfect: bright three-note chord arpeggio
        self._make_wav("perfect", [(523, 0.06, 0.3), (659, 0.06, 0.3), (784, 0.14, 0.3)])
        # Wrong: low dull thud
        self._make_wav("wrong",   [(220, 0.08, 0.3), (196, 0.12, 0.25)])
        # Hint: soft neutral blip
        self._make_wav("hint",    [(440, 0.09, 0.2)])
        # Rating: soft tick
        self._make_wav("tick",    [(880, 0.05, 0.15)])

    def play(self, name: str):
        if not self.enabled:
            return
        threading.Thread(target=self._play, args=(name,), daemon=True).start()

    def _play(self, name: str):
        try:
            path = self._cache.get(name)
            if self._backend == "wave" and path and sys.platform == "win32":
                import winsound
                winsound.PlaySound(path, winsound.SND_FILENAME | winsound.SND_ASYNC)
            elif self._backend == "afplay" and path:
                import subprocess
                subprocess.run(["afplay", path], capture_output=True)
            elif self._backend == "aplay" and path:
                import subprocess
                subprocess.run(["aplay", "-q", path], capture_output=True)
        except Exception:
            pass

    def toggle(self) -> bool:
        self.enabled = not self.enabled
        return self.enabled

    def cleanup(self):
        for path in self._cache.values():
            try:
                os.unlink(path)
            except Exception:
                pass


# Global singleton
sound = SoundManager()
