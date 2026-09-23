"""
かな — the kana deck's clips (frontend/public/sounds/kanas/, plan 113).

The files are made by scripts/build_kana_audio.py from the voice engine
and committed; nothing at runtime checks them, and a missing one is not
an error anywhere -- the card is just silent. That is how the old set
came to have 24 of the deck's sounds missing and ウォ saying を. These
tests are the check:

  - every kana the deck teaches has its clip, and no clip is orphaned;
  - two kana share a clip only when they are the same sound;
  - every clip is one the generator made (48 kHz mono, constant bitrate)
    rather than a leftover from the recordings it replaced;
  - and the frontend asks for the voice revision the backend makes.
"""
import re
from pathlib import Path

import pytest

import study.voice_engine as engine
from content.kana_data import get_all_kana, sound_of
from scripts.build_kana_audio import KBPS, OUT_DIR, RATE, plan

FRONTEND = Path(__file__).resolve().parents[2] / "frontend"


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


def test_the_frontend_asks_for_the_voice_the_backend_makes():
    # A clip's URL carries the voice revision so browser and service-worker
    # caches cannot replay an old voice (lib/audio/speech.js); the two
    # constants have to move together.
    source = (FRONTEND / "src" / "lib" / "audio" / "speech.js").read_text(encoding="utf-8")
    match = re.search(r"export const VOICE_REV = '([^']+)'", source)
    assert match, "speech.js no longer declares VOICE_REV"
    assert match.group(1) == engine.VOICE_REV
