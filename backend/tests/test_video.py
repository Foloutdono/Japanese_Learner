# Plain pytest-style functions with the `client`/`monkeypatch` fixtures
# -- same reason test_http_smoke.py and test_phrase_api.py deviate from
# this suite's usual unittest.TestCase style.
import time

import routes.video as video_module
from core.db import db_conn

_SRT = (
    "1\n00:00:01,000 --> 00:00:04,000\n私は学生です。\n\n"
    "2\n00:00:05,000 --> 00:00:08,000\n今日は暑い！\n"
).encode("utf-8")


def _poll_until_settled(client, session_id, timeout=10.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        response = client.get(f"/api/video/session/{session_id}")
        if response.json().get("status") != "generating":
            return response
        time.sleep(0.1)
    raise AssertionError(f"session {session_id} never left 'generating' within {timeout}s")


def test_no_caption_fetch_exists_at_all() -> None:
    """The YouTube caption fetch was removed 2026-08-26: a server cannot
    get captions from YouTube (datacenter IPs are blocked AND the
    endpoint needs a player-generated token). Both remaining ingests are
    purely local. This guards against it being reintroduced, since a
    reintroduced fetch would look like it works in dev and fail only in
    production -- which is exactly how it wasted a release cycle."""
    import study.captions as captions_module
    assert not hasattr(captions_module, "fetch_youtube_track")
    assert not hasattr(video_module, "fetch_youtube_track")
    assert not hasattr(captions_module, "_PROXY_CONFIG")


def test_upload_produces_a_ready_transcript(client):
    post_resp = client.post(
        "/api/video/session",
        files={"file": ("test.srt", _SRT, "text/plain")},
        data={"start": "0", "end": "30"},
    )
    assert post_resp.status_code == 202
    session_id = post_resp.json()["sessionId"]
    assert post_resp.json()["windowCapped"] is False

    final = _poll_until_settled(client, session_id)
    assert final.status_code == 200
    body = final.json()
    assert body["status"] == "ready"
    assert len(body["sentences"]) == 2
    assert body["sentences"][0]["text"] == "私は学生です。"
    assert body["sentences"][0]["cue_start"] == 1.0
    assert body["sentences"][0]["cue_end"] == 4.0
    assert body["sentences"][0]["available"] is True
    assert body["truncated"] == 0


def test_oversized_upload_returns_413(client):
    huge = b"1\n00:00:01,000 --> 00:00:02,000\nx\n" * 100_000  # well over 1MB
    response = client.post(
        "/api/video/session",
        files={"file": ("huge.srt", huge, "text/plain")},
        data={"start": "0", "end": "30"},
    )
    assert response.status_code == 413


def test_a_long_window_is_honoured_not_capped(client):
    """The Window used to be clamped to 5 minutes. It was a second,
    blunter cap on what MAX_SENTENCES already bounds, and one the learner
    had to reason about -- see docs/adr/0003's 2026-08-27 amendment."""
    response = client.post(
        "/api/video/session",
        files={"file": ("test.srt", _SRT, "text/plain")},
        data={"start": "0", "end": "600"},  # 10 minutes: kept as asked
    )
    assert response.status_code == 202
    assert response.json()["windowCapped"] is False

    final = _poll_until_settled(client, response.json()["sessionId"])
    assert final.json()["windowCapped"] is False
    assert final.json()["windowEnd"] == 600.0


def test_a_session_needs_no_window_at_all(client):
    """The common case, and the default the UI now sends: no bounds,
    meaning the whole Track. This used to be a 400 ("end must be after
    start"), because an absent bound was read as 0."""
    response = client.post(
        "/api/video/session",
        files={"file": ("test.srt", _SRT, "text/plain")},
    )
    assert response.status_code == 202

    final = _poll_until_settled(client, response.json()["sessionId"])
    body = final.json()
    assert body["status"] == "ready"
    assert body["windowStart"] is None and body["windowEnd"] is None
    assert len(body["sentences"]) > 0


def test_one_bound_on_its_own_is_a_valid_window(client):
    """"From 0:02 onward" is a perfectly good Window. Only a Window with
    BOTH bounds can be back-to-front."""
    response = client.post(
        "/api/video/session",
        files={"file": ("test.srt", _SRT, "text/plain")},
        data={"start": "2"},
    )
    assert response.status_code == 202
    final = _poll_until_settled(client, response.json()["sessionId"])
    assert final.json()["windowStart"] == 2.0
    assert final.json()["windowEnd"] is None


def test_a_bare_url_with_no_transcript_is_rejected(client):
    """A URL alone used to mean "fetch the captions yourself". It cannot
    any more, so asking for that is a 400 with a message naming what to
    do instead -- not a session that fails minutes later."""
    response = client.post(
        "/api/video/session",
        json={"url": "https://youtu.be/dQw4w9WgXcQ", "start": 0, "end": 30},
    )
    assert response.status_code == 400
    assert "transcript" in response.json()["detail"].lower()


def test_non_youtube_url_returns_400(client):
    # Supplied but unrecognizable -- worth rejecting, since the learner
    # clearly meant to name a video.
    response = client.post(
        "/api/video/session",
        json={"url": "https://example.com/not-youtube",
              "transcript": "0:00 これはテストです。", "start": 0, "end": 30},
    )
    assert response.status_code == 400


def test_get_unknown_session_returns_404(client):
    response = client.get("/api/video/session/999999999")
    assert response.status_code == 404


def test_explain_endpoint_buys_deep_tier_and_records_video_provenance(client, monkeypatch):
    # A sentence unique to THIS test: phrase_analysis_cache has no
    # expiry and is keyed only by (phrase, lang) -- reusing a phrase
    # another test already bought the deep tier for (e.g.
    # test_phrase_api.py's "私は学生です。") would silently return that
    # test's cached explanation instead of exercising this call at all.
    srt = (
        "1\n00:00:01,000 --> 00:00:04,000\n猫は可愛い動物です。\n\n"
        "2\n00:00:05,000 --> 00:00:08,000\n犬も好きです。\n"
    ).encode("utf-8")

    post_resp = client.post(
        "/api/video/session",
        files={"file": ("prov.srt", srt, "text/plain")},
        data={"start": "0", "end": "30"},
    )
    session_id = post_resp.json()["sessionId"]
    _poll_until_settled(client, session_id)

    def _fake_chat(messages, timeout=30, max_tokens=1200, reasoning=False):
        return (
            '{"words": [{"surface": "猫", "meaning": "cat"}], '
            '"explanation": "An introduction."}'
        )

    monkeypatch.setattr("routes.phrase.chat", _fake_chat)

    response = client.post(f"/api/video/session/{session_id}/sentence/0/explain", json={"lang": "en"})
    assert response.status_code == 200
    assert response.json()["explanation"] == "An introduction."

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT source, source_ref FROM phrase_history WHERE phrase = %s ORDER BY id DESC LIMIT 1",
                ("猫は可愛い動物です。",),
            )
            row = cur.fetchone()
    finally:
        conn.close()
    assert row is not None
    source, source_ref = row
    assert source == "video"
    assert source_ref.startswith("prov.srt@")


def test_explain_keeps_cue_times(client, monkeypatch):
    # analyze_local builds from TEXT alone and knows nothing about cues
    # (it must stay pure -- see study/analysis.py). The route used to
    # return that bare analysis, deleting cue_start/cue_end from the
    # stored Sentence and permanently breaking playback sync for it.
    srt = (
        "1\n00:00:01,000 --> 00:00:04,000\n猫は可愛い動物です。\n\n"
        "2\n00:00:05,000 --> 00:00:08,000\n犬も好きです。\n"
    ).encode("utf-8")

    post_resp = client.post(
        "/api/video/session",
        files={"file": ("cue.srt", srt, "text/plain")},
        data={"start": "0", "end": "30"},
    )
    session_id = post_resp.json()["sessionId"]
    ready = _poll_until_settled(client, session_id)
    stored = ready.json()["sentences"][0]
    assert stored["cue_start"] == 1.0
    assert stored["cue_end"] == 4.0

    def _fake_chat(messages, timeout=30, max_tokens=1200, reasoning=False):
        return (
            '{"words": [{"surface": "猫", "meaning": "cat"}], '
            '"explanation": "An introduction."}'
        )

    monkeypatch.setattr("routes.phrase.chat", _fake_chat)

    response = client.post(f"/api/video/session/{session_id}/sentence/0/explain", json={"lang": "en"})
    assert response.status_code == 200
    body = response.json()
    assert body["cue_start"] == 1.0
    assert body["cue_end"] == 4.0
    assert body["explanation"] == "An introduction."


def test_explain_out_of_range_index_returns_404(client):
    post_resp = client.post(
        "/api/video/session",
        files={"file": ("range.srt", _SRT, "text/plain")},
        data={"start": "0", "end": "30"},
    )
    session_id = post_resp.json()["sessionId"]
    _poll_until_settled(client, session_id)

    response = client.post(f"/api/video/session/{session_id}/sentence/99/explain", json={})
    assert response.status_code == 404


def test_uses_a_daemon_thread_not_fastapis_background_task_helper() -> None:
    # A plain daemon thread, matching routes/exams.py -- see that
    # module's own comment on why a request-scoped async task helper is
    # the wrong tool for work that must outlive the request.
    import routes.video as vm
    assert not hasattr(vm, "BackgroundTasks")
    with open("routes/video.py", encoding="utf-8") as f:
        content = f.read()
    assert "threading.Thread" in content


# ── Pasted transcript ingest (plan 025) ───────────────────────────
# The one path that cannot be IP-blocked. Uses a phrase not used
# elsewhere in this suite: phrase_analysis_cache has no expiry and is
# keyed only by (phrase, lang), so reusing another test's sentence can
# silently read back ITS cached deep tier.
_PASTE = "0:00 犬が走っています。\n0:04 空はとても青いですね。"


def test_pasted_transcript_never_calls_youtube(client):
    """The single most important test in plan 025: the paste path must
    not touch the network, because the network is exactly what fails in
    production."""
    response = client.post(
        "/api/video/session",
        json={"url": "https://youtu.be/abcdefghijk", "transcript": _PASTE,
              "start": 0, "end": 60},
    )
    assert response.status_code == 202

    final = _poll_until_settled(client, response.json()["sessionId"])
    assert final.status_code == 200
    body = final.json()
    assert body["status"] == "ready"
    assert len(body["sentences"]) >= 1


def test_pasted_transcript_reports_paste_source_and_keeps_the_video_id(client):
    # source_ref must stay the video id: VideoScreen embeds the player
    # from it, and playback is not blocked even though the fetch is.
    response = client.post(
        "/api/video/session",
        json={"url": "https://www.youtube.com/watch?v=abcdefghijk",
              "transcript": "0:00 猫は寝ています。", "start": 0, "end": 60},
    )
    final = _poll_until_settled(client, response.json()["sessionId"])
    body = final.json()
    assert body["source"] == "paste"
    assert body["videoId"] == "abcdefghijk"


def test_transcript_without_a_url_is_accepted(client):
    """Inverted 2026-08-26. `url` used to be required because it was the
    caption SOURCE. It is now only the optional name of a video to embed,
    so a transcript on its own is a perfectly normal session -- it just
    has no player."""
    response = client.post(
        "/api/video/session",
        json={"transcript": "0:00 これはテストです。", "start": 0, "end": 60},
    )
    assert response.status_code == 202
    final = _poll_until_settled(client, response.json()["sessionId"])
    assert final.status_code == 200
    assert final.json()["videoId"] is None


def test_unparseable_transcript_fails_the_session_with_a_reason(client):
    response = client.post(
        "/api/video/session",
        json={"url": "https://youtu.be/abcdefghijk",
              "transcript": "no timestamps anywhere in here", "start": 0, "end": 60},
    )
    assert response.status_code == 202
    final = _poll_until_settled(client, response.json()["sessionId"])
    assert final.status_code == 503
    assert "0:18" in final.json()["error"]


def test_the_paste_path_is_also_uncapped_and_window_optional(client):
    response = client.post(
        "/api/video/session",
        json={"url": "https://youtu.be/abcdefghijk", "transcript": _PASTE,
              "start": 0, "end": 600},  # 10 minutes: kept as asked
    )
    assert response.json()["windowCapped"] is False
    final = _poll_until_settled(client, response.json()["sessionId"])
    assert final.json()["windowEnd"] == 600.0

    bare = client.post(
        "/api/video/session",
        json={"url": "https://youtu.be/abcdefghijk", "transcript": _PASTE},
    )
    assert bare.status_code == 202
    assert _poll_until_settled(client, bare.json()["sessionId"]).json()["windowEnd"] is None


# ── The finished-session-reported-as-stalled race ─────────────────
# _video_worker sets status='ready' and deletes the job row in ONE
# transaction; get_video_session read the session and the job row on TWO
# connections. A worker committing between those two reads made a
# succeeded session report 503 "Generation stalled".
#
# Pinned by forcing the interleaving rather than by timing: the real
# thing only appeared as a flaky failure on a slow run, and a test that
# reproduces it by racing would be flaky in exactly the same way.
def test_finished_session_is_not_reported_as_stalled(client, monkeypatch):
    response = client.post(
        "/api/video/session",
        files={"file": ("test.srt", _SRT, "text/plain")},
        data={"start": "0", "end": "60"},
    )
    session_id = response.json()["sessionId"]
    settled = _poll_until_settled(client, session_id)
    assert settled.status_code == 200, "precondition: the session really did succeed"

    # The DB now holds status='ready' with no job row -- exactly the
    # state the worker leaves behind. Hand the handler the stale
    # 'generating' snapshot it would have read a moment before the
    # worker's commit, once.
    real_load = video_module._load_session
    calls = {"n": 0}

    def _stale_first(sid, user_id):
        calls["n"] += 1
        loaded = real_load(sid, user_id)
        if calls["n"] == 1 and loaded is not None:
            return {**loaded, "status": "generating", "sentences": None}
        return loaded

    monkeypatch.setattr(video_module, "_load_session", _stale_first)

    result = client.get(f"/api/video/session/{session_id}")
    assert result.status_code == 200, (
        f"a finished session was reported as {result.status_code}: {result.json()}"
    )
    assert result.json()["status"] == "ready"
    assert result.json()["sentences"]
    # It must have re-read rather than trusted the first snapshot.
    assert calls["n"] >= 2


def test_a_genuinely_lost_worker_is_still_reported_as_stalled(client, monkeypatch):
    """The re-read must not swallow the case the branch exists for: a
    session stuck in 'generating' with no job row really is lost."""
    response = client.post(
        "/api/video/session",
        files={"file": ("test.srt", _SRT, "text/plain")},
        data={"start": "0", "end": "60"},
    )
    session_id = response.json()["sessionId"]
    _poll_until_settled(client, session_id)

    # Every read says 'generating', and the job row is already gone.
    real_load = video_module._load_session

    def _always_generating(sid, user_id):
        loaded = real_load(sid, user_id)
        return None if loaded is None else {**loaded, "status": "generating"}

    monkeypatch.setattr(video_module, "_load_session", _always_generating)

    result = client.get(f"/api/video/session/{session_id}")
    assert result.status_code == 503
    assert "stalled" in result.json()["error"].lower()


def test_a_running_job_still_reports_generating(client, monkeypatch):
    """A live job row must mean 202, not 503 -- otherwise every poll
    during normal generation would fail the session."""
    response = client.post(
        "/api/video/session",
        files={"file": ("test.srt", _SRT, "text/plain")},
        data={"start": "0", "end": "60"},
    )
    session_id = response.json()["sessionId"]
    _poll_until_settled(client, session_id)

    real_load = video_module._load_session
    monkeypatch.setattr(
        video_module, "_load_session",
        lambda sid, uid: (lambda r: None if r is None else {**r, "status": "generating"})(real_load(sid, uid)),
    )
    monkeypatch.setattr(video_module, "_job_state", lambda sid: "running")

    result = client.get(f"/api/video/session/{session_id}")
    assert result.status_code == 202
    assert result.json()["status"] == "generating"


# ── The video is now independent of the captions ──────────────────
# Until 2026-08-26 a session's video came from the same URL its captions
# were fetched from, so `source` implied whether there was a player. The
# fetch is gone; a video id is just an optional extra on any session.
def test_upload_can_name_a_video_to_play_alongside_it(client):
    response = client.post(
        "/api/video/session",
        files={"file": ("test.srt", _SRT, "text/plain")},
        data={"start": "0", "end": "60", "url": "https://youtu.be/dQw4w9WgXcQ"},
    )
    assert response.status_code == 202
    final = _poll_until_settled(client, response.json()["sessionId"])
    body = final.json()
    assert body["source"] == "upload"
    assert body["sourceRef"] == "test.srt"    # still names the FILE
    assert body["videoId"] == "dQw4w9WgXcQ"   # and separately the video


def test_upload_without_a_url_has_no_video(client):
    response = client.post(
        "/api/video/session",
        files={"file": ("test.srt", _SRT, "text/plain")},
        data={"start": "0", "end": "60"},
    )
    final = _poll_until_settled(client, response.json()["sessionId"])
    assert final.json()["videoId"] is None
