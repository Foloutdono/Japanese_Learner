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


# ── What the page prints is what is said (plan 311) ──────────────
# The engine is handed a line as text and reads a kanji word its own
# way (米 べい under こめ); a line that carries its words is held to the
# reading the page prints. The engine here is a fake that reads as told.

def _query(*morae):
    """An audio query saying `morae` (kana_morae's terms), in one phrase."""
    def mora(m):
        if m == "N":
            return {"text": "ン", "consonant": None, "vowel": "N"}
        if m == "Q":
            return {"text": "ッ", "consonant": None, "vowel": "cl"}
        return {"text": "", "consonant": m[:-1] or None, "vowel": m[-1], "consonant_length": 0.05 if m[:-1] else None,
                "vowel_length": 0.1}
    return {"prePhonemeLength": 0.1, "accent_phrases": [{"moras": [mora(m) for m in morae]}]}


def _heard(kana, unvoiced=()):
    """The query a fake engine makes of a reading in kana."""
    morae = lva.kana_morae(kana)
    return _query(*[m[:-1] + m[-1].upper() if i in unvoiced else m for i, m in enumerate(morae)])


RICE = [["この", "この", 0], ["村", "むら", 0], ["は", "は", 1], ["県", "けん", 0], ["きって", "きって", 0],
        ["の", "の", 1], ["米", "こめ", 0], ["の", "の", 1], ["産地", "さんち", 0], ["です", "です", 0], ["。", "", 0]]
RICE_TEXT = "この村は県きっての米の産地です。"


def test_a_reading_is_held_in_the_engines_own_phonemes():
    assert lva.kana_morae("きゃく") == ["kya", "ku"]
    assert lva.kana_morae("がっこう") == ["ga", "Q", "ko", "u"]
    assert lva.kana_morae("しんぶん") == ["shi", "N", "bu", "N"]
    assert lva.kana_morae("ファイル") == ["fa", "i", "ru"]
    assert lva.kana_morae("パーティー") == ["pa", "-", "ti", "-"]
    assert lva.kana_morae("ぢづ") == ["ji", "zu"]
    assert lva.kana_morae("CD") is None
    assert lva.kana_morae("学校") is None
    # A vowel said without voice (す in です) is the same mora.
    assert lva.heard_morae(_heard("です", unvoiced={1})) == ["de", "su"]


def test_a_word_the_engine_reads_otherwise_is_found():
    assert lva.misread(RICE, _heard("このむらわけんきってのこめのさんちです")) == set()
    # 米 read べい, as Open JTalk reads it alone: the word, and only it.
    assert lva.misread(RICE, _heard("このむらわけんきってのべえのさんちです")) == {6}
    # は said ha would be the engine's, not a kanji's: never handed over.
    assert lva.misread(RICE, _heard("このむらはけんきってのこめのさんちです")) == set()


def test_what_sounds_alike_reads_alike():
    # A long vowel however it is spelt, a particle as it is said.
    words = [["学校", "がっこう", 0], ["へ", "へ", 1], ["行きます", "いきます", 0], ["。", "", 0]]
    assert lva.misread(words, _heard("がっこおえいきます")) == set()
    words = [["先生", "せんせい", 0], ["を", "を", 1], ["呼んだ", "よんだ", 0]]
    assert lva.misread(words, _heard("せんせえおよんだ")) == set()
    # 実は is printed じつは and said じつわ: the particle grown into the word.
    words = [["実は", "じつは", 0], ["行かない", "いかない", 0]]
    assert lva.misread(words, _heard("じつわいかない")) == set()
    assert lva.misread(words, _heard("じつはいかない")) == {0}
    # A word in kana is read as written: または is the engine's to say.
    words = [["黒", "くろ", 0], ["または", "または", 0], ["青", "あお", 0]]
    assert lva.misread(words, _heard("くろまたわあお")) == set()
    # A morae run in where none is printed is a word either side's: 眠そう said ねむらそう.
    words = [["とても", "とても", 0], ["眠", "ねむ", 0], ["そう", "そう", 0], ["です", "です", 0]]
    assert lva.misread(words, _heard("とてもねむらそうです")) == {1}


def test_a_quotation_is_said_as_a_speaker_says_it():
    # The engine took both marks for commas: …来ます、と言いました.
    assert lva.said_text("友だちは「また来ます」と言いました。") == "友だちは、また来ますと言いました。"
    assert lva.said_text("「人込み」というのは、混雑のことだ。") == "人込みというのは、混雑のことだ。"
    assert lva.said_text("彼は、「はい」と答えた。") == "彼は、はいと答えた。"
    assert lva.said_text("三千円です。") == "三千円です。"


def _reader(misreads):
    """A fake engine_query: each written form in `misreads` read as its
    wrong kana, everything else as the page prints it (RICE)."""
    asked = []

    def query(text, style):
        asked.append(text)
        heard = text
        for written, wrong in misreads.items():
            heard = heard.replace(written, wrong)
        for t, r, _ in RICE:
            heard = heard.replace(t, r) if r else heard.replace(t, "")
        return _heard(heard.replace("は", "わ", 1))
    return query, asked


def test_a_misread_word_is_handed_over_in_kana(monkeypatch):
    query, asked = _reader({"米": "べえ"})
    monkeypatch.setattr(lva, "engine_query", query)
    said, q, wrong = lva.held_query(RICE_TEXT, RICE, 0)
    assert said == "この村は県きってのこめの産地です。"
    assert wrong == set()
    assert asked == [RICE_TEXT, said]
    # Said from the query that reads as printed: its syllables are the text's.
    assert len(lva.heard_morae(q)) == len(lva.kana_morae("このむらわけんきってのこめのさんちです"))


def test_katakana_is_tried_where_hiragana_is_misread_too(monkeypatch):
    query, asked = _reader({"米": "べえ", "この村は県きってのこめ": "この村は県きってのごめ"})
    monkeypatch.setattr(lva, "engine_query", query)
    said, _, wrong = lva.held_query(RICE_TEXT, RICE, 0)
    assert said == "この村は県きってのコメの産地です。"
    assert wrong == set()
    assert len(asked) == 3


def test_a_line_read_as_printed_is_handed_over_as_written(monkeypatch):
    query, asked = _reader({})
    monkeypatch.setattr(lva, "engine_query", query)
    assert lva.held_query(RICE_TEXT, RICE, 0)[0] == RICE_TEXT
    assert asked == [RICE_TEXT]
    # Words that are not the text's are no reading to hold it to.
    assert lva.held_query("米です。", RICE, 0)[2] == set()


def test_a_line_held_to_its_words_is_a_clip_of_its_own():
    plain = {"who": "reader", "slow": True, "text": RICE_TEXT}
    held = {**plain, "words": RICE}
    assert lva.held(held) and not lva.held(plain)
    assert lva.clip_name(held, "a") != lva.clip_name(plain, "a")
    # A reading corrected on the page is a new clip, and a new voice too.
    other = {**plain, "words": [w if w[0] != "米" else ["米", "べい", 0] for w in RICE]}
    assert lva.clip_name(held, "a") != lva.clip_name(other, "a")
    assert lva.clip_name(held, "a") != lva.clip_name(held, "b")
    # The key the video looks a line up by is the line's alone.
    assert lva.cue_key(held) == lva.cue_key(plain)


def test_a_held_line_is_said_and_marked_from_the_query_that_reads_as_printed(tmp_path, monkeypatch):
    query, _ = _reader({"米": "べえ"})
    monkeypatch.setattr(lva, "engine_query", query)
    spoken = []

    def synthesize(q, style, *, speed, sample_rate):
        spoken.append(q)
        return voice_engine.Pcm(b"\x00\x00" * int(sample_rate * 1.5), sample_rate)

    def say(*a, **k):
        raise AssertionError("a held line is said from its query, never re-read from its text")

    monkeypatch.setattr(voice_engine, "style_for_slot", lambda slot: 7)
    monkeypatch.setattr(voice_engine, "synthesize", synthesize)
    monkeypatch.setattr(voice_engine, "say", say)
    cue = {"who": "reader", "slow": True, "text": RICE_TEXT, "marks": True, "words": RICE}
    (tmp_path / "cues.json").write_text(json.dumps([cue], ensure_ascii=False), encoding="utf-8")
    assert lva.voice(tmp_path / "cues.json", tmp_path / "cache", tmp_path / "durs.json") == 0
    out = json.loads((tmp_path / "durs.json").read_text(encoding="utf-8"))
    assert out["durs"][lva.cue_key(cue)] == 1.5
    assert (tmp_path / "cache" / lva.clip_name(cue, voice_engine.VOICE_REV)).exists()
    said = lva.heard_morae(spoken[0])
    assert said == lva.kana_morae("このむらわけんきってのこめのさんちです")
    # Each syllable marked is one the voice says, the line's count of them.
    assert len([m for m in out["marks"][lva.cue_key(cue)] if not m.get("p")]) == len(said)
