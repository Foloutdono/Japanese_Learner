# ── 動画の図書館 — the public library of analysed videos (plan 322) ──
# Plain pytest functions, as test_video.py's. Every learner here is one
# of its own (`acting_as`), so the shared DEV_USER_ID's history is left
# alone, and conftest's autouse fixture empties the library between
# tests (it is one table for everybody).
import time
import uuid

import pytest

import routes.video as video_module
import routes.video_library as library
from core.db import db_conn
from study import video_category
from study.llm_shared import LLMUnavailable
from tests.conftest import acting_as

_REAL_CATEGORISE = video_category.categorise
_VIDEO = "dQw4w9WgXcQ"
_OTHER = "9bZkp7q19f0"


def _cues():
    return [
        {"start": 1.0, "end": 4.0, "text": "私は学生です。"},
        {"start": 5.0, "end": 8.0, "text": "今日は暑い！"},
    ]


def _a_proxy(monkeypatch):
    monkeypatch.setenv("WEBSHARE_PROXY_USERNAME", "test-user")
    monkeypatch.setenv("WEBSHARE_PROXY_PASSWORD", "test-pass")
    monkeypatch.delenv("YOUTUBE_HTTP_PROXY", raising=False)


def _no_proxy(monkeypatch):
    for var in ("WEBSHARE_PROXY_USERNAME", "WEBSHARE_PROXY_PASSWORD", "YOUTUBE_HTTP_PROXY"):
        monkeypatch.delenv(var, raising=False)


@pytest.fixture(autouse=True)
def no_model(monkeypatch):
    """No model sorts a video unless a test says one does: the sort is
    asked of nobody, and the library entry stays unsorted."""
    def _down(user_id, lines):
        raise LLMUnavailable("no model in tests")
    monkeypatch.setattr(video_category, "categorise", _down)


@pytest.fixture
def learners():
    ids = [f"library-test-{uuid.uuid4()}" for _ in range(2)]
    yield ids
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM video_sessions WHERE user_id = ANY(%s)", (ids,))
            cur.execute("DELETE FROM daily_usage WHERE user_id = ANY(%s)", (ids,))
        conn.commit()
    finally:
        conn.close()


def _run(sql, params=()):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            rows = cur.fetchall() if cur.description else None
        conn.commit()
        return rows
    finally:
        conn.close()


def _settled(client, session_id, timeout=10.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        response = client.get(f"/api/video/session/{session_id}")
        if response.json().get("status") != "generating":
            return response
        time.sleep(0.05)
    raise AssertionError("the session never settled")


def _fetch_a_link(client, monkeypatch, video_id=_VIDEO, **body):
    _a_proxy(monkeypatch)
    monkeypatch.setattr(video_module, "fetch_youtube_track", lambda vid, translations=None: _cues())
    response = client.post("/api/video/session", json={"url": f"https://youtu.be/{video_id}", **body})
    assert response.status_code == 202, response.text
    settled = _settled(client, response.json()["sessionId"])
    assert settled.json()["status"] == "ready"
    return response.json()["sessionId"]


def _library_ids():
    return {row[0] for row in _run("SELECT video_id FROM video_library")}


# ── Joining ───────────────────────────────────────────────────────

def test_a_link_fetched_video_joins_the_library_once(client, monkeypatch, learners):
    first, second = learners
    with acting_as(first):
        _fetch_a_link(client, monkeypatch)
    assert _library_ids() == {_VIDEO}
    row = _run("SELECT line_count, first_line, category, translations FROM video_library")[0]
    assert row[0] == 2 and row[1] == "私は学生です。"
    assert row[2] is None, "no model reached: the video stays unsorted, never guessed"
    # A second learner's fetch of the same video reuses it (below); a
    # second add of the same id is a no-op by construction.
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            assert library.add(cur, _VIDEO, "[]", 0, "{}", 0, None) is False
        conn.commit()
    finally:
        conn.close()
    assert _run("SELECT COUNT(*) FROM video_library")[0][0] == 1


def test_a_window_of_a_video_is_not_the_library_s(client, monkeypatch, learners):
    with acting_as(learners[0]):
        _fetch_a_link(client, monkeypatch, start=2.0, end=6.0)
    assert _library_ids() == set()


def test_an_upload_naming_a_video_stays_private(client, monkeypatch, learners):
    """An upload only names a video id: its text is the learner's, so
    it is no library entry however the id looks."""
    srt = "1\n00:00:01,000 --> 00:00:04,000\n私は学生です。\n".encode("utf-8")
    with acting_as(learners[0]):
        response = client.post(
            "/api/video/session",
            files={"file": ("a.srt", srt)}, data={"url": f"https://youtu.be/{_VIDEO}"},
        )
        assert response.status_code == 202
        _settled(client, response.json()["sessionId"])
    assert _library_ids() == set()


def test_a_paste_stays_private(client, learners):
    with acting_as(learners[0]):
        response = client.post(
            "/api/video/session", json={"url": f"https://youtu.be/{_VIDEO}", "transcript": "私は学生です。"},
        )
        assert response.status_code == 202
        _settled(client, response.json()["sessionId"])
    assert _library_ids() == set()


# ── Reusing ───────────────────────────────────────────────────────

def test_a_second_learner_opens_it_without_a_fetch_or_a_proxy(client, monkeypatch, learners):
    first, second = learners
    with acting_as(first):
        _fetch_a_link(client, monkeypatch)

    _no_proxy(monkeypatch)

    def _must_not_run(video_id, translations=None):  # pragma: no cover
        raise AssertionError("a video the library holds was fetched again")
    monkeypatch.setattr(video_module, "fetch_youtube_track", _must_not_run)

    with acting_as(second):
        response = client.post("/api/video/session", json={"url": f"https://youtu.be/{_VIDEO}"})
        assert response.status_code == 202
        assert response.json()["fromLibrary"] is True
        body = _settled(client, response.json()["sessionId"]).json()
    assert body["status"] == "ready"
    assert [s["text"] for s in body["sentences"]] == ["私は学生です。", "今日は暑い！"]
    assert body["videoId"] == _VIDEO
    assert body["sourceRef"] == _VIDEO and body["source"] == "youtube"


def test_a_library_opening_spends_none_of_the_link_allowance(client, monkeypatch, learners):
    first, second = learners
    with acting_as(first):
        _fetch_a_link(client, monkeypatch)
    with acting_as(second):
        assert client.post(f"/api/video/library/{_VIDEO}/open").status_code == 200
    # Only the fetch counts: the opened copy is flagged and left out.
    assert video_module._fetch_refusal(second) is None
    monkeypatch.setattr(video_module, "_FETCH_DAILY_CAP_PER_USER", 1)
    assert video_module._fetch_refusal(second) is None
    assert video_module._fetch_refusal(first) is not None


def test_a_windowed_link_is_still_fetched(client, monkeypatch, learners):
    first, second = learners
    with acting_as(first):
        _fetch_a_link(client, monkeypatch)
    fetched = []
    monkeypatch.setattr(
        video_module, "fetch_youtube_track",
        lambda vid, translations=None: fetched.append(vid) or _cues(),
    )
    with acting_as(second):
        response = client.post(
            "/api/video/session", json={"url": f"https://youtu.be/{_VIDEO}", "start": 2.0},
        )
        assert response.status_code == 202 and "fromLibrary" not in response.json()
        _settled(client, response.json()["sessionId"])
    assert fetched == [_VIDEO]


def test_opening_twice_is_one_session(client, monkeypatch, learners):
    first, second = learners
    with acting_as(first):
        _fetch_a_link(client, monkeypatch)
    with acting_as(second):
        a = client.post(f"/api/video/library/{_VIDEO}/open").json()["sessionId"]
        b = client.post(f"/api/video/library/{_VIDEO}/open").json()["sessionId"]
    assert a == b


def test_opening_a_video_the_library_lacks_is_a_404(client, learners):
    with acting_as(learners[0]):
        assert client.post(f"/api/video/library/{_OTHER}/open").status_code == 404
        # Not a video id at all: refused before the database is asked.
        assert client.post("/api/video/library/not-an-id/open").status_code == 422


def test_the_daily_allowance_of_openings(client, monkeypatch, learners):
    first, second = learners
    with acting_as(first):
        _fetch_a_link(client, monkeypatch, video_id=_VIDEO)
        _fetch_a_link(client, monkeypatch, video_id=_OTHER)
    monkeypatch.setattr(library, "OPEN_DAILY_CAP", 1)
    with acting_as(second):
        assert client.post(f"/api/video/library/{_VIDEO}/open").status_code == 200
        # The one already opened is still answered; a second video is not.
        assert client.post(f"/api/video/library/{_VIDEO}/open").status_code == 200
        refused = client.post(f"/api/video/library/{_OTHER}/open")
    assert refused.status_code == 429
    assert refused.json()["detail"]["code"] == "library_allowance"


# ── The shelf ─────────────────────────────────────────────────────

def test_a_whole_video_is_not_on_the_shelf_and_a_window_is(client, monkeypatch, learners):
    learner = learners[0]
    with acting_as(learner):
        _fetch_a_link(client, monkeypatch, video_id=_VIDEO)
        windowed = _fetch_a_link(client, monkeypatch, video_id=_OTHER, start=2.0, end=6.0)
        shelf = client.get("/api/video/sessions").json()
    assert [s["id"] for s in shelf] == [windowed]


def test_videos_do_not_count_toward_the_history_limit(client, monkeypatch, learners):
    """Past the limit the oldest session is removed from the shelf; a
    library video, older than all of them, is neither counted nor taken."""
    import core.history as history
    learner = learners[0]
    with acting_as(learner):
        whole = _fetch_a_link(client, monkeypatch)
    for n in range(3):
        _run(
            "INSERT INTO video_sessions(user_id, source, source_ref, status, sentences, created_at) "
            "VALUES (%s, 'upload', %s, 'ready', '[]'::jsonb, NOW() - make_interval(mins => %s))",
            (learner, f"{n}.srt", n),
        )
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            history.trim_history(cur, learner, 2)
        conn.commit()
    finally:
        conn.close()
    live = {r[0] for r in _run(
        "SELECT id FROM video_sessions WHERE user_id = %s AND deleted_at IS NULL", (learner,))}
    assert whole in live
    assert len(live) == 3, "two uploads stand on the shelf beside the video"


# ── Browsing ──────────────────────────────────────────────────────

def _seed(video_id, category, learners_n=0, minutes_ago=0):
    _run(
        "INSERT INTO video_library(video_id, category, sentences, line_count, first_line, created_at) "
        "VALUES (%s, %s, '[{\"text\": \"x\"}]'::jsonb, 1, %s, NOW() - make_interval(mins => %s))",
        (video_id, category, f"line of {video_id}", minutes_ago),
    )
    for n in range(learners_n):
        _run(
            "INSERT INTO video_sessions(user_id, source, source_ref, video_id, status, sentences) "
            "VALUES (%s, 'youtube', %s, %s, 'ready', '[]'::jsonb)",
            (f"library-test-viewer-{n}-{video_id}", video_id, video_id),
        )


@pytest.fixture
def seeded():
    _seed("aaaaaaaaaaa", "music", learners_n=3, minutes_ago=30)
    _seed("bbbbbbbbbbb", "podcast", learners_n=1, minutes_ago=20)
    _seed("ccccccccccc", "music", learners_n=0, minutes_ago=10)
    _seed("ddddddddddd", None, learners_n=0, minutes_ago=5)
    yield
    _run("DELETE FROM video_sessions WHERE user_id LIKE 'library-test-viewer-%%'")


def test_browse_lists_newest_first_with_the_counts(client, seeded, learners):
    with acting_as(learners[0]):
        body = client.get("/api/video/library").json()
    assert [v["videoId"] for v in body["videos"]] == ["ddddddddddd", "ccccccccccc", "bbbbbbbbbbb", "aaaaaaaaaaa"]
    assert body["total"] == 4
    assert body["counts"]["all"] == 4 and body["counts"]["music"] == 2
    assert body["counts"]["podcast"] == 1 and body["counts"]["mine"] == 0
    assert body["categories"] == list(video_category.CATEGORIES)
    first = body["videos"][0]
    assert first["category"] is None and first["firstLine"] == "line of ddddddddddd"
    # Anonymous and light: no track, no learner.
    assert not {"sentences", "userId", "user_id", "username"} & set(first)


def test_browse_filters_by_kind(client, seeded, learners):
    with acting_as(learners[0]):
        body = client.get("/api/video/library?category=music").json()
    assert [v["videoId"] for v in body["videos"]] == ["ccccccccccc", "aaaaaaaaaaa"]
    assert body["total"] == 2
    # The chips keep counting the whole library, not the filtered page.
    assert body["counts"]["all"] == 4


def test_browse_sorts_by_the_most_studied(client, seeded, learners):
    with acting_as(learners[0]):
        body = client.get("/api/video/library?sort=popular").json()
    assert [v["videoId"] for v in body["videos"]][:2] == ["aaaaaaaaaaa", "bbbbbbbbbbb"]
    assert body["videos"][0]["learners"] == 3


def test_browse_pages(client, seeded, learners):
    with acting_as(learners[0]):
        page = client.get("/api/video/library?limit=2&offset=2").json()
    assert [v["videoId"] for v in page["videos"]] == ["bbbbbbbbbbb", "aaaaaaaaaaa"]
    assert page["total"] == 4


def test_mine_lists_what_the_learner_opened(client, monkeypatch, learners):
    first, second = learners
    # Ids of their own: other tests leave sessions for the usual ones, and
    # the count of learners is over every session of a video.
    a, b = (uuid.uuid4().hex[:11] for _ in range(2))
    with acting_as(first):
        _fetch_a_link(client, monkeypatch, video_id=a)
        _fetch_a_link(client, monkeypatch, video_id=b)
    with acting_as(second):
        client.post(f"/api/video/library/{b}/open")
        everything = client.get("/api/video/library").json()
        mine = client.get("/api/video/library?mine=true").json()
    assert [v["videoId"] for v in mine["videos"]] == [b]
    assert mine["counts"]["mine"] == 1 and everything["counts"]["all"] == 2
    flags = {v["videoId"]: v["mine"] for v in everything["videos"]}
    assert flags == {a: False, b: True}
    # The second learner has studied b as the first has: two, against one.
    assert {v["videoId"]: v["learners"] for v in everything["videos"]} == {a: 1, b: 2}


@pytest.mark.parametrize("query", [
    "category=karaoke", "sort=random", "limit=0", f"limit={library.PAGE_MAX + 1}",
    f"offset={library.OFFSET_MAX + 1}", "offset=-1",
])
def test_browse_is_bounded_by_its_parameters(client, learners, query):
    with acting_as(learners[0]):
        assert client.get(f"/api/video/library?{query}").status_code == 422


# ── Sorting into a kind ───────────────────────────────────────────

def test_a_model_sorts_a_new_video_once(client, monkeypatch, learners):
    asked = []
    monkeypatch.setattr(
        video_category, "categorise", lambda user_id, lines: asked.append((user_id, list(lines))) or "music",
    )
    with acting_as(learners[0]):
        _fetch_a_link(client, monkeypatch)
    assert _run("SELECT category FROM video_library")[0][0] == "music"
    assert asked == [(learners[0], ["私は学生です。", "今日は暑い！"])]
    # Sorted: opening it again asks nobody.
    with acting_as(learners[1]):
        client.post(f"/api/video/library/{_VIDEO}/open")
    time.sleep(0.2)
    assert len(asked) == 1


def test_an_unsorted_video_is_sorted_when_next_opened(client, monkeypatch, learners):
    with acting_as(learners[0]):
        _fetch_a_link(client, monkeypatch)
    assert _run("SELECT category FROM video_library")[0][0] is None
    monkeypatch.setattr(video_category, "categorise", lambda user_id, lines: "podcast")
    with acting_as(learners[1]):
        assert client.post(f"/api/video/library/{_VIDEO}/open").status_code == 200
    deadline = time.time() + 5
    while time.time() < deadline and _run("SELECT category FROM video_library")[0][0] is None:
        time.sleep(0.05)
    assert _run("SELECT category FROM video_library")[0][0] == "podcast"


def test_a_failed_sort_never_fails_the_session(client, monkeypatch, learners):
    def _boom(user_id, lines):
        raise RuntimeError("the model exploded")
    monkeypatch.setattr(video_category, "categorise", _boom)
    with acting_as(learners[0]):
        _fetch_a_link(client, monkeypatch)
    assert _library_ids() == {_VIDEO}


def test_a_spent_allowance_leaves_the_video_unsorted(client, monkeypatch, learners):
    def _over(user_id, lines):
        raise video_category.OverLimit()
    monkeypatch.setattr(video_category, "categorise", _over)
    with acting_as(learners[0]):
        _fetch_a_link(client, monkeypatch)
    assert _run("SELECT category FROM video_library")[0][0] is None


# ── study/video_category.py ───────────────────────────────────────

@pytest.mark.parametrize("reply,expected", [
    ('{"category": "music"}', "music"),
    ('```json\n{"category": "Podcast"}\n```', "podcast"),
    ('Sure! {"category": "news"} done', "news"),
    ('{"category": "cooking"}', "other"),      # readable, none of ours: other
    ('"vlog"', "vlog"),
    ("music", "music"),
    ("", None), ("no idea", None), ("{broken", None), ("[1, 2]", None), ('{"category": 3}', None),
])
def test_the_reply_is_one_of_the_kinds_or_nothing(reply, expected):
    assert video_category.parse_category(reply) == expected


def test_the_sample_is_bounded_and_spread():
    lines = [f"行{n}" for n in range(500)]
    picked = video_category.sample(lines)
    assert len(picked) <= video_category.SAMPLE_LINES
    assert picked[0] == "行0" and picked[-1] == "行499"
    assert any(p not in lines[:30] and p not in lines[-30:] for p in picked), "the middle is in it"
    assert sum(len(p) for p in picked) <= video_category.SAMPLE_CHARS
    assert video_category.sample(["", "  ", "x" * 500])[0] == "x" * 120
    assert video_category.sample(["", "   "]) == []


def test_categorise_claims_a_slot_and_gives_it_back_when_no_model_was_paid(monkeypatch, learners):
    monkeypatch.setattr(video_category, "categorise", _REAL_CATEGORISE)

    def _count():
        rows = _run("SELECT COALESCE(SUM(count), 0) FROM daily_usage WHERE user_id = %s AND feature = %s",
                    (learners[0], video_category.VIDEO_CATEGORY_FEATURE))
        return rows[0][0]

    monkeypatch.setattr(video_category, "chat", lambda *a, **k: '{"category": "music"}')
    assert video_category.categorise(learners[0], ["歌詞"]) == "music"
    assert _count() == 1

    def _down(*a, **k):
        raise LLMUnavailable("down")
    monkeypatch.setattr(video_category, "chat", _down)
    with pytest.raises(LLMUnavailable):
        video_category.categorise(learners[0], ["歌詞"])
    assert _count() == 1, "an outage costs nothing"

    monkeypatch.setattr(video_category, "VIDEO_CATEGORY_DAILY_LIMIT", 1)
    with pytest.raises(video_category.OverLimit):
        video_category.categorise(learners[0], ["歌詞"])

    assert video_category.categorise(learners[0], ["", " "]) is None, "nothing to read, nothing claimed"


# ── scripts/backfill_video_library.py ─────────────────────────────

def test_the_backfill_adds_the_oldest_whole_video_once(learners):
    from scripts import backfill_video_library as backfill

    def _session(uid, video, minutes_ago, lines, window=None):
        _run(
            "INSERT INTO video_sessions(user_id, source, source_ref, video_id, status, sentences, "
            "window_start, created_at) VALUES (%s, 'youtube', %s, %s, 'ready', %s::jsonb, %s, "
            "NOW() - make_interval(mins => %s))",
            (uid, video, video, lines, window, minutes_ago),
        )

    older = '[{"text": "最初", "foreign": false}, {"text": "二つ目"}]'
    newer = '[{"text": "後から"}]'
    first, second = learners
    _session(second, _VIDEO, 5, newer)
    _session(first, _VIDEO, 50, older)
    _session(first, _OTHER, 10, older, window=3.0)   # a window: not the library's
    _session(first, "zzzzzzzzzzz", 10, "[]")        # no lines: nothing to hold

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            assert backfill.count_pending(cur) == 1
            assert backfill.backfill(cur) == 1
            assert backfill.backfill(cur) == 0, "a second run adds nothing"
        conn.commit()
    finally:
        conn.close()
    row = _run("SELECT video_id, line_count, first_line, category FROM video_library")
    assert row == [(_VIDEO, 2, "最初", None)], "the first analysis stands, with no kind"
