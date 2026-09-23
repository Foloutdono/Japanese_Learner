"""
単語の音声 — the card-reading clips the device cannot always speak.

The feature exists because browser speech does not reach a large part of
the phones this app runs on (study/word_tts.py's header has the three
ways it fails). What is tested here is the part that decides whether a
learner hears anything at all:

  - the packed reading fields the decks actually store are normalized to
    ONE reading, not read out with their separators;
  - every field the API can put on a card is speakable, so the fallback
    is never silent on real content;
  - and nothing else is, which is what keeps /api/tts from being the
    open TTS proxy docs/adr/0006 refused.

Synthesis itself is stubbed throughout: the voice engine
(study/voice_engine.py) is a network call, and none of the above is a
fact about its output. The encoder is real, so what lands on disk is an
MP3.
"""
import math
import os
from array import array
from unittest import mock

import pytest

import study.exam_tts as tts
import study.voice_engine as engine
import study.word_tts as word_tts
from content.kana_data import get_all_kana
from content.kanji_data import KANJI_BY_LEVEL
from content.vocab_data import VOCAB_BY_LEVEL

# 毎月, N5: its kana field packs two readings the way vocab_data.py's own
# docstring describes.
PACKED_VOCAB = "まいげつ/まいつき"


@pytest.fixture
def store(tmp_path):
    """Point the clip store at a scratch directory."""
    directory = str(tmp_path / "audio")
    os.makedirs(directory)
    with mock.patch.object(tts, "_resolve_audio_dir", lambda: directory):
        yield os.path.join(directory, "words")


def _word() -> engine.Pcm:
    rate = engine.DIALOGUE_RATE
    samples = array("h", (int(8000 * math.sin(2 * math.pi * 440 * i / rate)) for i in range(rate // 2)))
    return engine.Pcm(samples.tobytes(), rate)


@pytest.fixture
def fake_tts():
    with mock.patch.object(engine, "style_for_slot", lambda slot: 100 + slot), \
            mock.patch.object(engine, "say", mock.Mock(side_effect=lambda *a, **k: _word())) as say:
        yield say


# ── What gets said ───────────────────────────────────────────────

# The client normalizes before asking and the server normalizes again,
# so the two have to agree about what was asked for. The three tests
# below and their counterparts in
# frontend/src/lib/audio/speech.browser.test.js run the SAME table; a
# change to either normalizer that is not made in both shows up as a
# clip the catalog cannot find.
def test_one_reading_is_spoken_not_the_whole_packed_field():
    # Read whole, a synthesizer says the separator out loud.
    assert word_tts.spoken_form(PACKED_VOCAB) == "まいげつ"
    assert word_tts.spoken_form("ド・ト・つち") == "ド"
    assert word_tts.spoken_form("あ;い") == "あ"


def test_okurigana_is_spoken_as_the_word_it_belongs_to():
    # さ.げる is the word さげる. Cutting at the dot would say "さ".
    assert word_tts.spoken_form("さ.げる") == "さげる"
    assert word_tts.spoken_form("~くだ.す") == "くだす"


# ── What is speakable ────────────────────────────────────────────

def test_every_card_field_the_api_serves_is_speakable():
    """routes/vocab.py and routes/kanji.py hand the client each entry's
    `kanji` and `kana` verbatim, and the client speaks one of them. A
    reading outside the catalog is a card that says nothing."""
    unspeakable = [
        (level, field, raw)
        for by_level in (VOCAB_BY_LEVEL, KANJI_BY_LEVEL)
        for level, entries in by_level.items()
        for entry in entries
        for field in ("kanji", "kana")
        if (raw := entry.get(field)) and not word_tts.speakable(raw)
    ]
    assert unspeakable == []
    assert all(word_tts.speakable(k["kana"]) for k in get_all_kana())


def test_a_dictionary_entry_outside_the_decks_is_still_speakable():
    """The dictionary serves the JMdict pool beyond the curated decks
    (content/vocab_jmdict_data.py) and puts the same speaker button on
    those entries. シングルス is in that pool and in no deck."""
    assert word_tts.speakable("シングルス") == "シングルス"
    assert not any(
        entry.get("kana") == "シングルス"
        for entries in VOCAB_BY_LEVEL.values()
        for entry in entries
    )


def test_text_the_app_does_not_teach_is_refused():
    # The whole bound on this endpoint: not a length or a character
    # class, but membership in the decks the app ships.
    assert word_tts.speakable("hello") is None
    assert word_tts.speakable("ぬぬぬぬぬぬぬぬ") is None
    assert word_tts.speakable("") is None
    assert word_tts.speakable(None) is None
    # An analyzer sentence is real Japanese and still refused -- that is
    # the case docs/adr/0006 keeps on the device.
    assert word_tts.speakable("きのう　ともだちと　えいがを　見ました") is None


# ── The clip store ───────────────────────────────────────────────

def test_a_clip_is_synthesized_once_and_then_read_from_disk(store, fake_tts):
    path = word_tts.clip_for(PACKED_VOCAB)

    assert os.path.dirname(path) == store
    assert engine.mp3_summary(open(path, "rb").read())["frames"] > 0
    # The packed field and the reading it normalizes to are one clip.
    assert word_tts.clip_for("まいげつ") == path
    assert fake_tts.call_count == 1
    # In the reader's voice (slot 0; style_for_slot is 100 + slot here).
    fake_tts.assert_called_once_with("まいげつ", 100, speed=engine.tempo_for_slot(0))


def test_refused_text_never_reaches_the_synthesizer(store, fake_tts):
    with pytest.raises(ValueError):
        word_tts.clip_for("hello")
    fake_tts.assert_not_called()


def test_the_store_is_trimmed_when_it_grows_past_its_cap(store, fake_tts):
    os.makedirs(store)
    # Older than anything written below, and over the cap on its own.
    # The cap itself is moved rather than met: the real one is 100 MB,
    # and writing that much to prove a comparison is not a test, it is a
    # disk-full CI run.
    stale = os.path.join(store, "stale.mp3")
    with open(stale, "wb") as f:
        f.write(b"0" * 4096)
    os.utime(stale, (0, 0))

    # A real clip here is half a second of MP3, about 3 KB: the cap sits
    # above the fresh clip alone and below the two together.
    with mock.patch.object(word_tts, "_MAX_BYTES", 6000), \
            mock.patch.object(word_tts, "_EVICT_TO", 5000):
        fresh = word_tts.clip_for(PACKED_VOCAB)

    # A clip here is disposable -- the text is in the URL, so whatever
    # this dropped is remade by the next request that wants it.
    assert not os.path.exists(stale)
    assert os.path.exists(fresh)


# ── The route ────────────────────────────────────────────────────

def test_a_known_reading_is_served_as_a_cacheable_mp3(client, store, fake_tts):
    response = client.get("/api/tts", params={"text": PACKED_VOCAB})

    assert response.status_code == 200
    assert response.headers["content-type"] == "audio/mpeg"
    assert "immutable" in response.headers["cache-control"]
    assert engine.mp3_summary(response.content)["frames"] > 0


def test_the_route_refuses_anything_outside_the_decks(client, store, fake_tts):
    assert client.get("/api/tts", params={"text": "hello"}).status_code == 404
    assert client.get("/api/tts", params={"text": "ぬぬぬぬぬぬぬぬ"}).status_code == 404
    assert client.get("/api/tts", params={"text": "あ" * 200}).status_code == 422
    assert client.get("/api/tts", params={"text": ""}).status_code == 422
    fake_tts.assert_not_called()


def test_a_synthesis_failure_is_not_a_crash(client, store):
    with mock.patch.object(engine, "style_for_slot", side_effect=tts.TTSFailed("no voices")):
        assert client.get("/api/tts", params={"text": PACKED_VOCAB}).status_code == 503


def test_the_voice_revision_in_the_url_is_only_a_cache_key(client, store, fake_tts):
    # lib/audio/speech.js adds v=<VOICE_REV> so a new voice is a new URL
    # for every cache in front of this route; the route itself ignores it.
    plain = client.get("/api/tts", params={"text": PACKED_VOCAB})
    versioned = client.get("/api/tts", params={"text": PACKED_VOCAB, "v": engine.VOICE_REV})
    assert versioned.status_code == 200
    assert versioned.content == plain.content
    assert fake_tts.call_count == 1


def test_a_word_an_earlier_voice_said_is_said_again(store, fake_tts):
    path = word_tts.clip_for(PACKED_VOCAB)
    past = tts.voice_epoch() - 3600
    os.utime(path, (past, past))

    assert word_tts.clip_for(PACKED_VOCAB) == path
    assert fake_tts.call_count == 2
    assert tts.is_current(path)
