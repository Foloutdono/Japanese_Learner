"""A video's own translation under its lines (plan 238).

The owner: "If the subtitles translated are available take them, if not
make them." A video whose makers wrote French or English subtitles has
its lines translated by them: the link fetch and the grab bring that
track beside the Japanese, each Japanese cue takes the translated lines
said in its time (study/line_translate.from_track), and the session keeps
them as it keeps the model's, so the block a learner reaches asks the
model only for what the track left.
"""
import json
import re
import time
from types import SimpleNamespace
from unittest import mock

import pytest

import routes.video as video_module
from core.db import db_conn
from study import line_translate
from study.captions import fetch_youtube_track
from study.cue_sentences import sentences_from_cues


def _cue(start, end, text):
    return {"start": start, "end": end, "text": text}


# ── Reading the track off the cues ───────────────────────────────
def test_a_track_timed_as_the_cues_translates_each_of_them():
    cues = [_cue(1, 4, "私は学生です。"), _cue(5, 8, "今日は暑い！")]
    track = [_cue(1, 4, "Je suis étudiant."), _cue(5, 8, "Il fait chaud !")]
    assert line_translate.from_track(cues, track) == ["Je suis étudiant.", "Il fait chaud !"]


def test_a_track_a_little_off_the_cues_still_finds_them():
    cues = [_cue(1, 4, "私は学生です。"), _cue(4, 8, "今日は暑い！")]
    track = [_cue(1.3, 4.2, "Je suis étudiant."), _cue(4.2, 7.6, "Il fait chaud !")]
    assert line_translate.from_track(cues, track) == ["Je suis étudiant.", "Il fait chaud !"]


def test_two_translated_lines_in_one_cue_are_both_its():
    cues = [_cue(0, 6, "長い一行です")]
    track = [_cue(0, 3, "Une longue"), _cue(3, 6, "ligne.")]
    assert line_translate.from_track(cues, track) == ["Une longue ligne."]


def test_a_translated_line_across_two_cues_is_neither_s():
    """Half a sentence under each would say more than either line:
    both are left to the model."""
    cues = [_cue(0, 3, "今日は"), _cue(3, 6, "暑いですね"), _cue(7, 9, "また明日")]
    track = [_cue(0, 6, "Il fait chaud aujourd'hui."), _cue(7, 9, "À demain.")]
    assert line_translate.from_track(cues, track) == [None, None, "À demain."]


def test_a_cue_the_track_says_nothing_in_is_none():
    cues = [_cue(0, 2, "ラララ"), _cue(3, 5, "愛してる")]
    track = [_cue(3, 5, "Je t'aime")]
    assert line_translate.from_track(cues, track) == [None, "Je t'aime"]


def test_a_line_of_the_track_in_japanese_translates_nothing():
    """A track labelled French that is the Japanese again."""
    cues = [_cue(0, 2, "愛してる"), _cue(3, 5, "米津玄師")]
    track = [_cue(0, 2, "愛してる"), _cue(3, 5, "Kenshi Yonezu 米津玄師")]
    assert line_translate.from_track(cues, track) == [None, "Kenshi Yonezu 米津玄師"]


def test_the_grab_asks_for_the_server_s_languages():
    from pathlib import Path
    grab = Path(__file__).resolve().parents[2] / "frontend/src/lib/captionGrab.js"
    match = re.search(r"export const TRANSLATION_LANGS = \[([^\]]*)\]", grab.read_text(encoding="utf-8"))
    assert match and tuple(re.findall(r"'(\w+)'", match.group(1))) == line_translate.TRACK_LANGS


def test_the_languages_a_track_is_taken_in():
    assert line_translate.track_lang("fr") == "fr"
    assert line_translate.track_lang("fr-CA") == "fr"
    assert line_translate.track_lang("en-GB") == "en"
    assert line_translate.track_lang("de") is None
    assert line_translate.track_lang("") is None


# ── Into lines ───────────────────────────────────────────────────
def test_a_cue_that_stays_one_line_carries_its_translation():
    lines = sentences_from_cues([{**_cue(1, 4, "今日は暑い"), "tr": {"fr": "Il fait chaud"}}], None, None)
    assert [line.get("tr") for line in lines] == [{"fr": "Il fait chaud"}]


def test_a_cue_cut_in_pieces_leaves_them_to_the_model():
    from study import morphology
    if not morphology.MORPHOLOGY_AVAILABLE:
        pytest.skip("the cut needs the tokenizer")
    wide = "今日はAyaseさんとバンドメンバーとそしてぷらそにかの合唱のみなさんがいてくれるので、"
    lines = sentences_from_cues([{**_cue(0, 10, wide), "tr": {"fr": "Toute la phrase"}}], None, None)
    assert len(lines) > 1
    assert all("tr" not in line for line in lines)


def test_a_line_with_no_japanese_carries_none():
    lines = sentences_from_cues([{**_cue(0, 2, "I love you"), "tr": {"fr": "Je t'aime"}}], None, None)
    assert "tr" not in lines[0]


# ── The link fetch ───────────────────────────────────────────────
PROXY_ENV = {"WEBSHARE_PROXY_USERNAME": "test-user", "WEBSHARE_PROXY_PASSWORD": "test-pass"}


def _snippets(*triples):
    return [SimpleNamespace(text=text, start=start, duration=duration) for text, start, duration in triples]


def _fetch_listing(*tracks, translations=None):
    """The transcript API offering a Japanese hand-written track and
    `tracks` beside it, each (language_code, is_generated, snippets)."""
    import youtube_transcript_api

    japanese = SimpleNamespace(language_code="ja", is_generated=False,
                               fetch=lambda: _snippets(("今日は暑い", 1.0, 3.0)))
    others = [SimpleNamespace(language_code=code, is_generated=generated, fetch=lambda s=snippets: s)
              for code, generated, snippets in tracks]

    class _TranscriptList:
        def __iter__(self):
            return iter([japanese, *others])

        def find_manually_created_transcript(self, codes):
            return japanese

        def find_generated_transcript(self, codes):
            raise youtube_transcript_api.NoTranscriptFound("vid", list(codes), None)

    class _Api:
        def __init__(self, **kwargs):
            pass

        def list(self, video_id):
            return _TranscriptList()

    with mock.patch.dict("os.environ", PROXY_ENV, clear=False), \
         mock.patch.object(youtube_transcript_api, "YouTubeTranscriptApi", _Api):
        return fetch_youtube_track("dQw4w9WgXcQ", translations)


def test_the_fetch_brings_the_video_s_own_translation_beside_the_japanese():
    found = {}
    cues = _fetch_listing(
        ("fr-FR", False, _snippets(("Il fait chaud", 1.0, 3.0))),
        ("en", True, _snippets(("it's hot", 1.0, 3.0))),
        ("de", False, _snippets(("Es ist heiß", 1.0, 3.0))),
        translations=found,
    )
    assert [c["text"] for c in cues] == ["今日は暑い"]
    # French, hand-written; never a recognised track, never a language
    # the app is not read in.
    assert found == {"fr": [{"start": 1.0, "end": 4.0, "text": "Il fait chaud"}]}


def test_a_translation_that_will_not_come_costs_nothing_but_itself():
    def refused():
        raise ConnectionError("refused")

    found = {}
    import youtube_transcript_api
    japanese = SimpleNamespace(language_code="ja", is_generated=False,
                               fetch=lambda: _snippets(("今日は暑い", 1.0, 3.0)))
    french = SimpleNamespace(language_code="fr", is_generated=False, fetch=refused)

    class _TranscriptList:
        def __iter__(self):
            return iter([japanese, french])

        def find_manually_created_transcript(self, codes):
            return japanese

        def find_generated_transcript(self, codes):
            raise youtube_transcript_api.NoTranscriptFound("vid", list(codes), None)

    class _Api:
        def __init__(self, **kwargs):
            pass

        def list(self, video_id):
            return _TranscriptList()

    with mock.patch.dict("os.environ", PROXY_ENV, clear=False), \
         mock.patch.object(youtube_transcript_api, "YouTubeTranscriptApi", _Api):
        cues = fetch_youtube_track("dQw4w9WgXcQ", found)
    assert [c["text"] for c in cues] == ["今日は暑い"]
    assert found == {}


# ── The session ──────────────────────────────────────────────────
_SRT = (
    "1\n00:00:01,000 --> 00:00:04,000\n私は学生です。\n\n"
    "2\n00:00:05,000 --> 00:00:08,000\n今日は暑い！\n\n"
    "3\n00:00:09,000 --> 00:00:11,000\nまた明日\n"
)
_FR = (
    "WEBVTT\n\n"
    "00:00:01.000 --> 00:00:04.000\nJe suis étudiant.\n\n"
    "00:00:05.000 --> 00:00:08.000\nIl fait chaud !\n"
)


def _settled(client, session_id: int) -> dict:
    deadline = time.time() + 10
    while time.time() < deadline:
        body = client.get(f"/api/video/session/{session_id}").json()
        if body.get("status") != "generating":
            return body
        time.sleep(0.1)
    raise AssertionError("the session never settled")


def _stored(session_id: int) -> dict:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT translations FROM video_sessions WHERE id = %s", (session_id,))
            (stored,) = cur.fetchone()
    finally:
        conn.close()
    return stored


@pytest.fixture
def plenty(monkeypatch):
    monkeypatch.setattr(line_translate, "LINE_TRANSLATION_DAILY_LIMIT", 10 ** 6)


def _fake_model(monkeypatch, calls: list):
    def chat(messages, **kwargs):
        calls.append(messages[1]["content"])
        numbered = re.findall(r"^(\d+)\. (.+)$", messages[1]["content"], flags=re.MULTILINE)
        return json.dumps({"lines": {n: f"<{text}>" for n, text in numbered}}, ensure_ascii=False)

    monkeypatch.setattr(line_translate, "chat", chat)


def test_the_grab_s_translation_is_kept_and_the_model_asked_for_the_rest(client, monkeypatch, plenty):
    session_id = client.post(
        "/api/video/session",
        files={
            "file": ("ja.srt", _SRT.encode("utf-8"), "text/plain"),
            "translation_fr": ("fr.vtt", _FR, "text/vtt"),
        },
    ).json()["sessionId"]
    assert _settled(client, session_id)["status"] == "ready"
    assert _stored(session_id) == {"fr": {"私は学生です。": "Je suis étudiant.", "今日は暑い！": "Il fait chaud !"}}

    calls: list = []
    _fake_model(monkeypatch, calls)
    body = client.post(f"/api/video/session/{session_id}/translations", json={"lang": "fr", "index": 0}).json()
    assert body == {"start": 0, "lines": ["Je suis étudiant.", "Il fait chaud !", "<また明日>"]}
    # The one line the track left, alone.
    assert len(calls) == 1
    assert "1. また明日" in calls[0] and "私は学生です。" not in calls[0].split("Lines to translate:")[1]


def test_a_track_that_covers_every_line_costs_no_call(client, monkeypatch, plenty):
    fr = _FR + "\n00:00:09.000 --> 00:00:11.000\nÀ demain\n"
    session_id = client.post(
        "/api/video/session",
        files={
            "file": ("ja.srt", _SRT.encode("utf-8"), "text/plain"),
            "translation_fr": ("fr.vtt", fr, "text/vtt"),
        },
    ).json()["sessionId"]
    _settled(client, session_id)

    def must_not_call(messages, **kwargs):  # pragma: no cover - asserts it isn't reached
        raise AssertionError("a line the track translated was asked of the model")

    monkeypatch.setattr(line_translate, "chat", must_not_call)
    body = client.post(f"/api/video/session/{session_id}/translations", json={"lang": "fr", "index": 0}).json()
    assert body["lines"] == ["Je suis étudiant.", "Il fait chaud !", "À demain"]


def test_an_unreadable_translation_costs_the_lines_nothing_but_it(client):
    session_id = client.post(
        "/api/video/session",
        files={
            "file": ("ja.srt", _SRT.encode("utf-8"), "text/plain"),
            "translation_en": ("en.vtt", "not a subtitle file", "text/vtt"),
        },
    ).json()["sessionId"]
    assert _settled(client, session_id)["status"] == "ready"
    assert _stored(session_id) == {}


def test_the_link_fetch_s_translation_is_kept_on_the_session(client, monkeypatch):
    for var, value in PROXY_ENV.items():
        monkeypatch.setenv(var, value)
    monkeypatch.delenv("YOUTUBE_HTTP_PROXY", raising=False)

    def fetch(video_id, translations=None):
        translations["en"] = [_cue(1.0, 4.0, "I am a student.")]
        return [_cue(1.0, 4.0, "私は学生です。"), _cue(5.0, 8.0, "今日は暑い！")]

    monkeypatch.setattr(video_module, "fetch_youtube_track", fetch)
    session_id = client.post("/api/video/session", json={"url": "https://youtu.be/dQw4w9WgXcQ"}).json()["sessionId"]
    assert _settled(client, session_id)["status"] == "ready"
    assert _stored(session_id) == {"en": {"私は学生です。": "I am a student."}}


# ── Explain is the construction ──────────────────────────────────
def test_explain_is_asked_how_the_line_is_built_not_what_it_means():
    """The owner: "the explain button is only for the explanation of
    how the sentence is built". The meaning is the translation's, which
    every line now has under it."""
    from routes import phrase

    prompt = phrase.SYSTEM_PROMPT_TEMPLATE.format(lang_name="French")
    rule = next(line for line in prompt.splitlines() if line.startswith('- "explanation"'))
    assert "how the phrase is BUILT" in rule
    assert "Never restate, summarise or translate" in rule
    assert "nuance of the whole phrase" not in prompt
    # An explanation bought under the old prompt is never served again.
    assert phrase.CACHE_VERSION >= 6
