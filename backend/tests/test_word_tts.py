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

Synthesis itself is stubbed throughout: edge-tts is a network call to a
consumer service, and none of the above is a fact about its output.
"""
import os
from unittest import mock

import pytest

import study.exam_tts as tts
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


@pytest.fixture
def fake_tts():
    with mock.patch.object(word_tts, "voice_for_speaker", lambda i: f"voice-{i}"), \
            mock.patch.object(word_tts, "synthesize", mock.Mock(return_value=b"\xff\xfbmp3")) as synth:
        yield synth


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
    assert open(path, "rb").read() == b"\xff\xfbmp3"
    # The packed field and the reading it normalizes to are one clip.
    assert word_tts.clip_for("まいげつ") == path
    assert fake_tts.call_count == 1
    fake_tts.assert_called_once_with("まいげつ", "voice-0")


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

    with mock.patch.object(word_tts, "_MAX_BYTES", 1024), \
            mock.patch.object(word_tts, "_EVICT_TO", 512):
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
    assert response.content == b"\xff\xfbmp3"


def test_the_route_refuses_anything_outside_the_decks(client, store, fake_tts):
    assert client.get("/api/tts", params={"text": "hello"}).status_code == 404
    assert client.get("/api/tts", params={"text": "ぬぬぬぬぬぬぬぬ"}).status_code == 404
    assert client.get("/api/tts", params={"text": "あ" * 200}).status_code == 422
    assert client.get("/api/tts", params={"text": ""}).status_code == 422
    fake_tts.assert_not_called()


def test_a_synthesis_failure_is_not_a_crash(client, store):
    with mock.patch.object(word_tts, "voice_for_speaker", side_effect=tts.TTSFailed("no voices")):
        assert client.get("/api/tts", params={"text": PACKED_VOCAB}).status_code == 503
