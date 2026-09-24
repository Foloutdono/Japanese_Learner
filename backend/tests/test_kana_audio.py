"""
かな — the kana deck's clips (frontend/public/sounds/kanas/, plans 113
and 113b).

The files are made by scripts/build_kana_audio.py -- cut from a recorded
voicebank (scripts/kana_bank.py), or synthesized by the voice engine --
and committed; nothing at runtime checks them, and a missing one is not
an error anywhere -- the card is just silent. That is how the old set
came to have 24 of the deck's sounds missing and ウォ saying を. These
tests are the check:

  - every kana the deck teaches has its clip, and no clip is orphaned;
  - two kana share a clip only when they are the same sound;
  - every clip is one the generator made (48 kHz mono, constant bitrate)
    rather than a leftover from the recordings it replaced;
  - the frontend asks for the voice revision the backend makes;
  - every voice sources.json says made a clip is credited on the
    Credits page and in THIRD_PARTY_NOTICES.md -- a condition of both
    voices' terms, and the one thing a recorded voice's arrival could
    otherwise forget;
  - and the bank importer, run on banks built here out of sine tones --
    one syllable a file, and joined strings the way 波音リツ's is
    recorded -- makes the whole set from the syllables the recipes
    name, never letting the next sound in a string into a clip.
"""
import json
import logging
import math
import re
import shutil
import unicodedata
import wave
from array import array
from pathlib import Path

import pytest

import study.voice_engine as engine
from content.kana_data import get_all_kana, sound_of
from scripts import build_kana_audio, kana_bank
from scripts.build_kana_audio import KBPS, OUT_DIR, RATE, SOURCES, plan, read_sources

REPO = Path(__file__).resolve().parents[2]
FRONTEND = REPO / "frontend"


def test_every_kana_has_a_clip_and_every_clip_a_kana():
    wanted = {sound_of(entry) for entry in get_all_kana()}
    present = {path.stem for path in OUT_DIR.glob("*.mp3")}
    assert sorted(wanted - present) == [], "kana with no clip: run scripts.build_kana_audio"
    assert sorted(present - wanted) == [], "clips no kana is filed under"


def test_a_clip_name_is_a_plain_file_name():
    for entry in get_all_kana():
        assert re.fullmatch(r"[a-z_]+", sound_of(entry)), entry


def test_kana_share_a_clip_only_when_they_share_a_sound():
    # plan() refuses outright when two entries filed under one name would
    # need different notations -- ウォ and を before ウォ had its own.
    sounds = plan()
    assert sounds["wo"]["notation"] == "ヲ'" and sounds["wo_foreign"]["notation"] == "ウォ'"
    assert set(sounds["wo"]["kana"]) == {"を", "ヲ"}
    assert set(sounds["ji"]["kana"]) == {"じ", "ぢ", "ジ", "ヂ"}


def test_the_long_vowels_are_taught_as_they_are_said():
    sounds = plan()
    # The lesson (kana_data.py, 長音) reads えい as ē and おう as ō.
    assert sounds["ei"]["notation"] == "エ'エ"
    assert sounds["ou"]["notation"] == "オ'オ"
    assert sounds["aa"]["notation"] == "ア'ア"          # ああ and アー alike
    assert sounds["ai"]["notation"] == "ア'イ"


@pytest.mark.parametrize("path", sorted(OUT_DIR.glob("*.mp3")), ids=lambda p: p.stem)
def test_every_clip_is_one_the_generator_made(path):
    # The recordings it replaced were 44.1 kHz; a file at that rate is one
    # the regeneration missed.
    info = engine.mp3_summary(path.read_bytes())
    assert (info["sample_rate"], info["channels"], info["kbps"]) == (RATE, 1, [KBPS])
    assert 0.2 <= info["seconds"] <= 1.2


def test_every_voice_that_made_a_clip_is_credited():
    # A clip with no source is a clip nobody can say the terms of -- the
    # state the recordings plan 113 replaced were in. And each voice's
    # terms make its credit a condition (VOICEVOX Nemo's; あみたろ's,
    # "クレジットを書かずに使うのは禁止"), so a set cut from a new voice
    # cannot land without its row.
    sources = read_sources(OUT_DIR)
    assert set(sources) == {path.stem for path in OUT_DIR.glob("*.mp3")}, f"run build_kana_audio: {SOURCES}"
    rows = dict(re.findall(r"\{ id: '([^']+)',.*?url: '([^']+)' \}",
                           (FRONTEND / "src" / "domain" / "attributions.js").read_text(encoding="utf-8")))
    notices = (REPO / "THIRD_PARTY_NOTICES.md").read_text(encoding="utf-8")
    for credit in sorted(set(sources.values())):
        assert credit in rows, f"{credit} made kana clips but has no row in attributions.js"
        assert rows[credit] in notices, f"{credit} made kana clips but THIRD_PARTY_NOTICES.md has no section"


def test_the_frontend_asks_for_the_voice_the_backend_makes():
    # A clip's URL carries the voice revision so browser and service-worker
    # caches cannot replay an old voice (lib/audio/speech.js); the two
    # constants have to move together.
    source = (FRONTEND / "src" / "lib" / "audio" / "speech.js").read_text(encoding="utf-8")
    match = re.search(r"export const VOICE_REV = '([^']+)'", source)
    assert match, "speech.js no longer declares VOICE_REV"
    assert match.group(1) == engine.VOICE_REV


# ── The bank importer (plans 113b and 113c) ──────────────────────

BANK_RATE = 44100


def _write(path: Path, data: array) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as clip:
        clip.setnchannels(1)
        clip.setsampwidth(2)
        clip.setframerate(BANK_RATE)
        clip.writeframes(data.tobytes())


def _tone(path: Path, *, freq: float = 392.0, phase: float = 0.0, lead: float = 0.1,
          seconds: float = 0.8, amp: float = 0.5) -> None:
    """A stand-in for a sung syllable: `lead` of silence, then a steady
    tone at G4, 16-bit mono at the rate a UTAU bank is recorded at."""
    data = array("h", [0] * int(lead * BANK_RATE))
    data.extend(int(amp * 32767 * math.sin(2 * math.pi * freq * i / BANK_RATE + phase))
                for i in range(int(seconds * BANK_RATE)))
    _write(path, data)


def _string(path: Path, notes: list[tuple[float, float, float]], *, lead: float = 0.1) -> list[float]:
    """A stand-in for a joined (連続音) recording: `lead` of silence, then
    each (seconds, frequency, amplitude) note in turn, with no break in
    phase between them. Returns where each note starts, in ms."""
    data, starts, phase = array("h", [0] * int(lead * BANK_RATE)), [], 0.0
    for seconds, freq, amp in notes:
        starts.append(len(data) / BANK_RATE * 1000)
        for _ in range(int(seconds * BANK_RATE)):
            data.append(int(amp * 32767 * math.sin(phase)))
            phase += 2 * math.pi * freq / BANK_RATE
    _write(path, data)
    return starts


def _oto(folder: Path, lines: list[str]) -> None:
    """An oto.ini (file=alias,offset,consonant,cutoff,preutterance,
    overlap), in Shift_JIS like the banks' own."""
    (folder / "oto.ini").write_bytes("\n".join(lines).encode("cp932"))


def _bank_syllables() -> set[str]:
    """Every syllable some recipe would take first -- which is the whole
    ゔ row too, since the fallback is only the second choice."""
    return {choices[0] for recipe in kana_bank.recipes(plan()).values() for choices in recipe.parts}


def _flatness(pcm: engine.Pcm, fade_s: float = kana_bank.FADE_OUT_S) -> float:
    """The quietest 5 ms of a clip's steady part against its median: 1.0
    is an even tone, and a join that cancels shows as a dip."""
    samples, window = array("h", pcm.frames), int(0.005 * pcm.rate)
    start = next(i for i, s in enumerate(samples) if abs(s) > 300) + int(0.01 * pcm.rate)
    end = len(samples) - int((fade_s + 0.01) * pcm.rate)
    levels = [math.sqrt(sum(x * x for x in samples[i:i + window]) / window)
              for i in range(start, end - window, window // 2)]
    return min(levels) / sorted(levels)[len(levels) // 2]


def test_every_sound_is_cut_from_its_own_syllable_but_the_documented_few():
    # A recipe that quietly took another syllable would teach the wrong
    # sound in a real voice, which is worse than silence. The exceptions
    # are the ones kana_bank's docstring gives a reason for.
    sounds = plan()
    recipes = kana_bank.recipes(sounds)
    assert set(recipes) == set(sounds)
    own = {name for name, recipe in recipes.items()
           if recipe.parts == ((kana_bank.to_hiragana(sounds[name]["kana"][0]),),)}
    assert sorted(set(sounds) - own) == sorted(
        ["aa", "ii", "uu", "ee", "ei", "oo", "ou", "ai", "oi", "wo", "va", "vi", "vu", "ve", "vo"])
    # ē and ō, as the lesson teaches: the bank's long tone, else the vowel.
    assert recipes["ei"] == kana_bank.Recipe("long", (("えー", "え"),))
    assert recipes["ou"] == kana_bank.Recipe("long", (("おー", "お"),))
    assert recipes["aa"] == kana_bank.recipe_for("アー")
    assert recipes["ai"] == kana_bank.Recipe("diphthong", (("あ",), ("い",)))
    assert recipes["wo"].parts == (("お",),)                            # を is said "o"
    assert recipes["wo_foreign"].parts == (("うぉ",),)
    assert recipes["vu"].parts == (("ゔ", "ぶ"),)
    assert kana_bank.recipe_for("ぢ").parts == (("じ", "ぢ"),)


def test_a_bank_is_indexed_by_the_syllable_each_file_says(tmp_path):
    bank_dir = tmp_path / "bank"
    _tone(bank_dir / "G4" / "あ.wav")
    _tone(bank_dir / "G4" / "あ2.wav")                    # a variant: loses to あ.wav
    _tone(bank_dir / "C4" / "あ.wav")                     # another pitch: not asked for
    _tone(bank_dir / "G4" / "ka.wav")                     # romaji: the oto alias says か
    _tone(bank_dir / "G4" / unicodedata.normalize("NFD", "が.wav"))   # unzipped from a Mac
    _tone(bank_dir / "G4" / "breath.wav")                 # no syllable at all
    _tone(bank_dir / "G4" / "息.wav")
    _tone(bank_dir / "G4" / "ガ.wav")                     # her nasal が: katakana, not read
    _tone(bank_dir / "G4" / "ら舌.wav")                   # a trilled ら, and no plain one here
    _tone(bank_dir / "G4" / "あー.wav")                   # a long tone is its own syllable
    _tone(bank_dir / "G4" / "i.wav")                      # alias with her pitch suffix
    (bank_dir / "G4" / "oto.ini").write_bytes(
        "ka.wav=か,100,80,-300,60,20\nが.wav=,120,80,-300,60,20\ni.wav=い_G4,90,80,-300,60,20\n"
        .encode("cp932"))

    bank = kana_bank.index_bank(bank_dir, "G4")
    assert sorted(bank.samples) == ["あ", "あー", "い", "か", "が", "ら"]
    assert bank.samples["が"].path.name == unicodedata.normalize("NFD", "が.wav")
    assert bank.samples["い"].path.name == "i.wav"
    assert bank.samples["あ"].path == bank_dir / "G4" / "あ.wav"
    assert bank.samples["か"].path.name == "ka.wav"
    assert bank.samples["か"].start_ms == 100.0
    assert bank.samples["が"].start_ms == 120.0          # the oto names it composed, the disk not
    assert bank.samples["あ"].start_ms == 0.0
    assert bank.samples["ら"].plain is False              # used, for want of a plain ら
    assert bank.folders == ["G4"]
    assert sorted(kana_bank.index_bank(bank_dir, "c4").samples) == ["あ"]
    assert kana_bank.index_bank(bank_dir, "A4").samples == {}


@pytest.mark.parametrize("width", [3, 4])
def test_a_deeper_sample_is_read_at_16_bits(tmp_path, width):
    # 24-bit is what her studio records; a bank may ship it as it is.
    values = [0, 1000, -1000, 32767, -32768, 12345]
    with wave.open(str(tmp_path / "あ.wav"), "wb") as clip:
        clip.setnchannels(2)
        clip.setsampwidth(width)
        clip.setframerate(BANK_RATE)
        low = bytes(width - 2)
        clip.writeframes(b"".join(low + v.to_bytes(2, "little", signed=True) for v in values for _ in (0, 1)))
    pcm = kana_bank.load(tmp_path / "あ.wav")
    assert pcm.rate == BANK_RATE
    assert list(array("h", pcm.frames)) == values


def test_the_onset_is_found_even_when_the_oto_leaves_it_at_zero():
    silence, attack = [0] * 4410, [8000, -8000] * 50
    samples = array("h", silence + attack)
    assert kana_bank.onset(samples, BANK_RATE) == 4410
    # An offset past the start is a floor, not the answer: the first
    # sample loud enough at or after it.
    assert kana_bank.onset(samples, BANK_RATE, offset_ms=50) == 4410
    assert kana_bank.onset(samples, BANK_RATE, offset_ms=101) == int(0.101 * BANK_RATE)


@pytest.mark.parametrize("eighths", range(8))
def test_a_diphthong_is_joined_in_phase(tmp_path, eighths):
    # Two vowels at one pitch, blended half a period apart, cancel: a dip
    # of up to 80% mid-glide without the phase search, at 0.99 with it.
    _tone(tmp_path / "あ.wav")
    _tone(tmp_path / "い.wav", phase=eighths * math.pi / 4)
    pcm, source = kana_bank.make(kana_bank.index_bank(tmp_path), kana_bank.recipe_for("あい"))
    assert source == "あ + い"                              # no string sings the glide: two samples
    assert _flatness(pcm) > 0.9


def test_a_long_vowel_is_the_long_tone_where_the_bank_has_one(tmp_path):
    _tone(tmp_path / "え.wav", seconds=0.9)
    bank = kana_bank.index_bank(tmp_path)
    assert kana_bank.make(bank, kana_bank.recipe_for("えい"))[1] == "え"
    _tone(tmp_path / "えー.wav", seconds=1.5)
    bank = kana_bank.index_bank(tmp_path)
    pcm, source = kana_bank.make(bank, kana_bank.recipe_for("エー"))
    assert source == "えー"
    assert pcm.seconds == pytest.approx(kana_bank.PRE_ROLL_S + kana_bank.LONG_S, abs=0.001)


def test_the_v_row_is_the_b_row_only_when_the_bank_has_no_v(tmp_path):
    _tone(tmp_path / "ぶ.wav")
    bank = kana_bank.index_bank(tmp_path)
    assert kana_bank.make(bank, kana_bank.recipe_for("ヴ"))[1] == "ぶ"
    _tone(tmp_path / "ゔ.wav")
    bank = kana_bank.index_bank(tmp_path)
    assert kana_bank.make(bank, kana_bank.recipe_for("ヴ"))[1] == "ゔ"


def test_the_whole_set_from_a_bank(tmp_path, caplog):
    bank_dir, out = tmp_path / "bank", tmp_path / "kanas"
    for syllable in _bank_syllables() - set(kana_bank._V_ROW):     # no ゔ, like 小春音アミ's
        _tone(bank_dir / "G4" / f"{syllable}.wav")

    with caplog.at_level(logging.INFO, logger="build_kana_audio"):
        assert build_kana_audio.main(["--from-bank", str(bank_dir), "--pitch", "G4", "--credit", "amitaro",
                                      "--out", str(out)]) == 0
    assert build_kana_audio._check(plan(), out) == 0          # 127 files, 48 kHz mono CBR, none stray
    assert len(list(out.glob("*.mp3"))) == len(plan())
    assert read_sources(out) == {name: "amitaro" for name in plan()}
    assert sum("the バ row" in r.getMessage() for r in caplog.records) == 5

    # The three shapes, by length (a clip's frames round it up a little):
    # a syllable, a held vowel, and two vowels joined.
    seconds = {name: engine.mp3_summary((out / f"{name}.mp3").read_bytes())["seconds"]
               for name in ("a", "kya", "aa", "ei", "ai")}
    assert 0.40 <= seconds["a"] == seconds["kya"] <= 0.52
    assert 0.70 <= seconds["aa"] == seconds["ei"] <= 0.82
    assert seconds["a"] < seconds["ai"] < seconds["aa"]


def test_a_bank_missing_syllables_is_refused_with_every_gap(tmp_path, caplog):
    bank_dir, out = tmp_path / "bank", tmp_path / "kanas"
    for syllable in _bank_syllables() - set(kana_bank._V_ROW) - {"き", "ふぁ"}:
        _tone(bank_dir / f"{syllable}.wav")

    with caplog.at_level(logging.INFO, logger="build_kana_audio"):
        assert build_kana_audio.main(["--from-bank", str(bank_dir), "--credit", "amitaro", "--out", str(out)]) == 1
    logged = caplog.text
    assert "ki: needs き" in logged and "fa: needs ふぁ" in logged
    assert "kya" not in logged                      # きゃ is its own sample
    assert not out.exists()                         # half a voice is worse than either


@pytest.mark.parametrize("alias, says", [
    ("- かA3", ("か", True, True)),       # a joined bank: か opening a string, at A3
    ("a きゃF4", ("きゃ", False, True)),  # ... and きゃ sung after a vowel
    ("-か", ("か", True, True)),
    ("- ヴぁA3", ("ゔぁ", True, True)),   # ヴ is written in katakana
    ("a ン", ("ん", False, True)),
    ("あ_G4", ("あ", True, True)),        # a single-syllable bank's alias
    ("あ", ("あ", True, True)),
    ("あー", ("あー", True, True)),       # a long tone is its own syllable
    ("- か↑A3", ("か", True, False)),     # variants
    ("あR", ("あ", True, False)),
    ("ら舌", ("ら", True, False)),
    ("ガ", (None, True, False)),          # 小春音アミ's nasal が
    ("息", (None, True, False)),
])
def test_an_alias_says_its_syllable_and_whether_it_opens_a_string(alias, says):
    assert kana_bank.parse_alias(alias) == says


def test_the_last_sound_in_a_file_ends_where_its_cutoff_says():
    # UTAU's rule: a positive cutoff counts back from the end of the
    # file, a negative one forward from the offset.
    from_end = kana_bank.Sample(Path("x.wav"), "- あ", "あ", start_ms=100, blank_ms=200)
    from_offset = kana_bank.Sample(Path("x.wav"), "- あ", "あ", start_ms=100, blank_ms=-300)
    assert (from_end.end_ms(1000), from_offset.end_ms(1000)) == (800, 400)
    assert (from_end.room_ms(), from_offset.room_ms()) == (float("inf"), 300)
    assert kana_bank.Sample(Path("x.wav"), "あ", "あ").end_ms(1000) == 1000


def test_a_joined_bank_is_read_by_the_syllables_that_open_its_strings(tmp_path):
    for pitch in ("A3", "F4"):
        folder = tmp_path / "bank" / pitch
        starts = _string(folder / "_かかき.wav", [(0.5, 220.0, 0.3)] * 3)
        _oto(folder, [f"_かかき.wav=- か{pitch},{starts[0] - 10},60,-400,10,0",
                      f"_かかき.wav=a か{pitch},{starts[1] - 100},60,0,100,30",
                      f"_かかき.wav=a か↑{pitch},{starts[1] - 100},60,0,100,30",  # one sound, two names
                      f"_かかき.wav=a き{pitch},{starts[2] - 100},60,200,100,30",
                      f"_かかき.wav=き{pitch},{starts[2] - 40},60,200,40,30"])   # named bare, mid-string

    bank = kana_bank.index_bank(tmp_path / "bank", "F4")
    assert sorted(bank.samples) == ["か"]           # き is only ever sung after a vowel here
    ka = bank.samples["か"]
    assert (ka.alias, ka.path.parent.name, ka.start_ms) == ("- かF4", "F4", starts[0] - 10)
    assert ka.after.alias == "a かF4"               # the plain name stands for the sound
    assert ka.end_ms(10_000) == starts[1]           # where the next か is heard
    assert ka.after.after.alias == "a きF4"
    assert bank.glides == {("か", "か"): ka}
    assert kana_bank.missing(bank, {"ki": kana_bank.recipe_for("き")}) == ["ki: needs き"]


def test_a_syllable_ends_before_the_next_sound_in_its_string(tmp_path):
    starts = _string(tmp_path / "_かき.wav", [(0.25, 220.0, 0.2), (0.6, 247.0, 0.8)])
    _oto(tmp_path, [f"_かき.wav=- か,{starts[0] - 10},60,-600,10,0",
                    f"_かき.wav=a き,{starts[1] - 80},60,0,80,30"])
    pcm, source = kana_bank.make(kana_bank.index_bank(tmp_path), kana_bank.recipe_for("か"))
    assert source == "- か"
    # か is sung at 0.2 and has less room than a syllable is cut to;
    # none of き (0.8) comes with it.
    assert max(abs(s) for s in array("h", pcm.frames)) < 0.25 * 32768
    assert pcm.seconds == pytest.approx(kana_bank.PRE_ROLL_S + 0.25 - kana_bank.END_MARGIN_S, abs=0.002)


def test_a_long_vowel_is_held_past_the_end_of_its_recording(tmp_path):
    # A joined bank has no long tones, and its あ runs only until the
    # next sound: the steady end is repeated, each repeat in phase.
    starts = _string(tmp_path / "_あか.wav", [(0.45, 220.0, 0.5), (0.5, 247.0, 0.5)])
    _oto(tmp_path, [f"_あか.wav=- あ,{starts[0] - 10},0,-450,10,0",
                    f"_あか.wav=a か,{starts[1] - 80},60,0,80,30"])
    pcm, source = kana_bank.make(kana_bank.index_bank(tmp_path), kana_bank.recipe_for("ああ"))
    assert source == "- あ (held)"
    assert pcm.seconds == pytest.approx(kana_bank.PRE_ROLL_S + kana_bank.LONG_S, abs=0.002)
    assert _flatness(pcm, fade_s=kana_bank.FADE_OUT_LONG_S) > 0.9


def test_a_diphthong_is_the_glide_the_singer_made(tmp_path):
    starts = _string(tmp_path / "_あい.wav", [(0.5, 220.0, 0.3), (0.6, 247.0, 0.6)])
    _oto(tmp_path, [f"_あい.wav=- あ,{starts[0] - 10},0,-500,10,0",
                    f"_あい.wav=a い,{starts[1] - 100},0,0,100,30"])
    after = _string(tmp_path / "_い.wav", [(0.5, 247.0, 0.6)])
    _oto_lines = (tmp_path / "oto.ini").read_bytes() + f"\n_い.wav=- い,{after[0] - 10},0,-500,10,0".encode("cp932")
    (tmp_path / "oto.ini").write_bytes(_oto_lines)

    pcm, source = kana_bank.make(kana_bank.index_bank(tmp_path), kana_bank.recipe_for("あい"))
    assert source == "- あ → a い"
    # あ from its onset for DIPHTHONG_FIRST_S -- the singer held it
    # longer, and its middle is cut out -- then his move into い.
    assert pcm.seconds == pytest.approx(
        kana_bank.PRE_ROLL_S + kana_bank.DIPHTHONG_FIRST_S + kana_bank.DIPHTHONG_SECOND_S, abs=0.01)
    samples, rate = array("h", pcm.frames), pcm.rate

    def level(a: float, b: float) -> float:
        part = samples[int((kana_bank.PRE_ROLL_S + a) * rate):int((kana_bank.PRE_ROLL_S + b) * rate)]
        return math.sqrt(sum(x * x for x in part) / len(part))

    assert level(0.33, 0.50) / level(0.05, 0.25) == pytest.approx(2.0, rel=0.1)   # い is sung twice as loud
    assert _flatness(engine.Pcm(samples[:int((kana_bank.PRE_ROLL_S + 0.27) * rate)].tobytes(), rate),
                     fade_s=-0.01) > 0.9                                          # the cut in あ is seamless


def test_the_v_row_is_the_banks_own_when_it_has_one(tmp_path):
    starts = _string(tmp_path / "_ヴ.wav", [(0.5, 220.0, 0.3)])
    _oto(tmp_path, [f"_ヴ.wav=- ヴ,{starts[0] - 10},60,-500,10,0"])
    _tone(tmp_path / "ぶ.wav")
    bank = kana_bank.index_bank(tmp_path)
    assert bank.samples["ゔ"].alias == "- ヴ"       # written in katakana, read as ゔ
    assert kana_bank.make(bank, kana_bank.recipe_for("ヴ"))[1] == "- ヴ"


def test_a_bank_in_several_pitch_folders_needs_one_picked(tmp_path, caplog):
    for pitch in ("A3", "F4"):
        _tone(tmp_path / "bank" / pitch / "か.wav")
    argv = ["--from-bank", str(tmp_path / "bank"), "--credit", "namine-ritsu", "--only", "ka",
            "--out", str(tmp_path / "kanas")]
    with caplog.at_level(logging.INFO, logger="build_kana_audio"):
        assert build_kana_audio.main(argv) == 1
    assert "pick one with --pitch" in caplog.text
    assert build_kana_audio.main([*argv, "--pitch", "F4"]) == 0


def test_the_whole_set_from_a_joined_bank(tmp_path, caplog):
    # Every syllable opens a string of its own, as in 波音リツ's bank; あ
    # and お go on to い, so their diphthongs are the singer's glide.
    folder, out = tmp_path / "bank" / "A3", tmp_path / "kanas"
    one = folder / "_.wav"
    starts = _string(one, [(0.45, 220.0, 0.4), (0.45, 247.0, 0.4)])
    lines = []
    for i, syllable in enumerate(sorted(_bank_syllables() - {"あー", "いー", "うー", "えー", "おー"})):
        name, then = f"_{i:03d}.wav", "い" if syllable in ("あ", "お") else "あ"
        shutil.copyfile(one, folder / name)
        lines += [f"{name}=- {syllable.replace('ゔ', 'ヴ')}A3,{starts[0] - 10},60,-450,10,0",
                  f"{name}=a {then}A3,{starts[1] - 80},0,0,80,30"]
    one.unlink()
    _oto(folder, lines)

    with caplog.at_level(logging.INFO, logger="build_kana_audio"):
        assert build_kana_audio.main(["--from-bank", str(tmp_path / "bank"), "--pitch", "A3",
                                      "--credit", "namine-ritsu", "--out", str(out)]) == 0
    assert build_kana_audio._check(plan(), out) == 0
    assert read_sources(out) == {name: "namine-ritsu" for name in plan()}
    logged = caplog.text
    assert "- あA3 → a いA3" in logged and "- おA3 → a いA3" in logged
    assert "- えA3 (held)" in logged
    assert "the バ row" not in logged                 # the ヴ row is his own


def test_the_bank_and_the_engine_options_do_not_mix(tmp_path):
    for argv in (["--pitch", "G4"], ["--credit", "amitaro"],
                 ["--from-bank", str(tmp_path)],                        # whose voice is it?
                 ["--from-bank", str(tmp_path), "--credit", "amitaro", "--voice", "女声6"]):
        with pytest.raises(SystemExit):
            build_kana_audio.main(argv)


def test_a_partial_run_keeps_the_other_clips_sources(tmp_path):
    bank_dir, out = tmp_path / "bank", tmp_path / "kanas"
    _tone(bank_dir / "か.wav")
    out.mkdir()
    (out / SOURCES).write_text(json.dumps({"a": "voicevox-nemo", "ka": "voicevox-nemo"}), encoding="utf-8")
    assert build_kana_audio.main(["--from-bank", str(bank_dir), "--credit", "amitaro", "--only", "ka",
                                  "--force", "--out", str(out)]) == 0
    assert read_sources(out) == {"a": "voicevox-nemo", "ka": "amitaro"}
