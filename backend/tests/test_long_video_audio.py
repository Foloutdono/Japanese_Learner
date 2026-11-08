"""The long videos' mix (plan 233, scripts/long_video_audio.py): a line
lands where the timeline says, nothing plays under it (no video carries
music since plan 273), and the file is as long as the video. No voice
engine: the cache is written here by hand."""
import json
import wave

import pytest

# numpy is the mix's, an operator script's (scripts/long_video_audio.py
# imports it where it mixes), and no dependency of the backend: CI does
# not install it, and an import here at the top failed the suite's
# collection whole. Without it, these tests are skipped.
np = pytest.importorskip("numpy")

from scripts import long_video_audio as lva  # noqa: E402
from study import voice_engine


def _tone(path, seconds, rate, hz=440.0, amp=0.5):
    t = np.arange(int(seconds * rate)) / rate
    pcm = (np.sin(2 * np.pi * hz * t) * amp * 32767).astype("<i2").tobytes()
    lva.write_wav(path, pcm, rate)


def _rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-12)


def test_cue_key_is_long_js_own():
    assert lva.cue_key({"who": "reader", "text": "あ"}) == "reader||あ"
    assert lva.cue_key({"who": "me", "slow": True, "text": "はい"}) == "me|slow|はい"
    # A new voice is a new clip, never the old one replayed.
    cue = {"who": "reader", "text": "がっこう"}
    assert lva.clip_name(cue, "a") != lva.clip_name(cue, "b")


def test_a_lone_syllable_is_the_kana_decks_recording():
    for text, name in [("に", "ni"), ("ニ", "ni"), ("め", "me"), ("きゃ", "kya"), ("を", "wo")]:
        assert lva.kana_clip(text) == lva.KANAS / f"{name}.mp3"
    for text in ["にほん", "コウ", "〜て", "学"]:
        assert lva.kana_clip(text) is None
    # Filed under the recording, not the engine's revision.
    cue = {"who": "reader", "text": "に"}
    assert lva.clip_name(cue, "a") == lva.clip_name(cue, "b")
    pcm = np.frombuffer(lva.from_kana_clip(lva.kana_clip("に")), dtype="<i2").astype(np.float64) / 32768
    assert 0.1 < len(pcm) / lva.VOICE_RATE < 2.0
    speech = pcm[np.abs(pcm) >= lva.GATE]
    assert abs(np.sqrt(np.mean(speech ** 2)) - lva.SPEECH_RMS) < 0.01
    # It starts on its sound, a breath in.
    assert np.flatnonzero(np.abs(pcm) >= lva.GATE)[0] <= int(0.06 * lva.VOICE_RATE)


def _f0(x, rate):
    """The pitch at each 50ms of voiced sound, by autocorrelation."""
    out = []
    for i in range(0, len(x) - 1200, 600):
        f = x[i:i + 1200] - x[i:i + 1200].mean()
        if np.sqrt(np.mean(f ** 2)) < 0.02:
            continue
        c = np.correlate(f, f, "full")[1199:]
        lo, hi = rate // 400, rate // 80
        out.append(rate / (lo + np.argmax(c[lo:hi])))
    return out


def test_a_sung_syllable_is_said():
    # The deck holds each syllable half a second on one pitch, to teach it;
    # in a video it is let go sooner and falls, as a word said alone does.
    path = lva.kana_clip("は")
    pcm = np.frombuffer(lva.from_kana_clip(path), dtype="<i2").astype(np.float64) / 32768
    assert len(pcm) / lva.VOICE_RATE <= lva.SPOKEN_S + lva.FADE_S + 0.06
    pitch = _f0(pcm, lva.VOICE_RATE)
    assert 12 * np.log2(np.mean(pitch[:3]) / np.mean(pitch[-3:])) > 1.5
    # A new tuning is a new file in the cache.
    assert lva.TUNE in f"kana|{lva.TUNE}|"


def test_a_line_lands_on_its_time_over_silence(tmp_path):
    cache, sfx = tmp_path / "cache", tmp_path / "sfx"
    cache.mkdir()
    sfx.mkdir()
    cue = {"at": 4.0, "text": "テスト", "who": "reader"}
    _tone(cache / lva.clip_name(cue, voice_engine.VOICE_REV), 1.0, lva.VOICE_RATE)
    timeline = {"seconds": 12.0, "cues": [cue], "sfx": [{"at": 1.0, "key": "click"}]}
    (tmp_path / "tl.json").write_text(json.dumps(timeline), encoding="utf-8")
    out = tmp_path / "mix.wav"
    assert lva.mix(tmp_path / "tl.json", cache, sfx, out) == 0
    with wave.open(str(out)) as w:
        assert (w.getnchannels(), w.getframerate()) == (2, lva.RATE)
        assert abs(w.getnframes() / w.getframerate() - 12.0) < 0.01
        data = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float64) / 32768
    left = data[0::2]
    rate = lva.RATE
    assert _rms_db(left[int(4.2 * rate):int(4.8 * rate)]) > -40
    # No music: between the sounds and the lines, silence.
    assert np.abs(left[int(6.5 * rate):int(9.5 * rate)]).max() == 0


def test_a_lines_syllables_start_where_the_engine_lays_them():
    # A reading challenge read along (plan 247) lights each word as the
    # voice reaches it: the lead-in, each mora's consonant and vowel and
    # each pause, all at the speed the line is said.
    query = {"prePhonemeLength": 0.1, "accent_phrases": [
        {"moras": [{"text": "マ", "consonant_length": 0.05, "vowel_length": 0.1}, {"text": "イ", "vowel_length": 0.1}],
         "pause_mora": {"text": "、", "vowel_length": 0.3}},
        {"moras": [{"text": "ニ", "consonant_length": 0.04, "vowel_length": 0.08}]},
    ]}
    marks = lva.mora_marks(query, 1.0)
    assert [m["k"] for m in marks] == ["マ", "イ", "、", "ニ"]
    assert [m["t"] for m in marks] == [0.1, 0.25, 0.35, 0.65]
    assert [m.get("p") for m in marks] == [None, None, 1, None]
    # Said slower, every syllable later, in proportion.
    assert [m["t"] for m in lva.mora_marks(query, 0.5)] == [0.2, 0.5, 0.7, 1.3]


def test_the_mix_closes_on_a_fade(tmp_path):
    # A sound still ringing as the video ends is faded out, never cut.
    cache, sfx = tmp_path / "cache", tmp_path / "sfx"
    cache.mkdir()
    sfx.mkdir()
    _tone(sfx / "chime.wav", 8.0, lva.RATE, hz=440.0, amp=0.9)
    (tmp_path / "tl.json").write_text(json.dumps({"seconds": 8.0, "cues": [], "sfx": [{"at": 0.0, "key": "chime"}]}), encoding="utf-8")
    out = tmp_path / "mix.wav"
    assert lva.mix(tmp_path / "tl.json", cache, sfx, out) == 0
    with wave.open(str(out)) as w:
        assert abs(w.getnframes() / w.getframerate() - 8.0) < 0.01
        data = np.frombuffer(w.readframes(w.getnframes()), dtype="<i2").astype(np.float64) / 32768
    left = data[0::2]
    assert _rms_db(left[int(7.0 * lva.RATE):int(7.5 * lva.RATE)]) > -40
    assert abs(left[-20:]).max() < 0.01


def test_no_video_carries_music():
    # Plan 273: no bed made up, no track laid under, no flag for either.
    assert not hasattr(lva, "bed") and not hasattr(lva, "recorded_bed")
    import inspect
    assert list(inspect.signature(lva.mix).parameters) == ["tl_path", "cache", "sfx", "out"]
