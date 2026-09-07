# Plain pytest-style functions rather than unittest.TestCase (the style
# used elsewhere in this suite): TestClient fixtures are awkward to wire
# into unittest.TestCase.setUp, and pytest fixtures work fine with plain
# functions, so this one file deviates for that reason.


def test_root_responds_ok(client):
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_list_exams_resolves_via_dev_user_id(client):
    response = client.get("/api/exams")
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, list)
    assert len(body) > 0
    for entry in body:
        assert "id" in entry
        assert "kind" in entry
        assert "level" in entry
        assert "title" in entry
        assert "generated" in entry


def test_dictionary_search_returns_paginated_shape(client):
    response = client.get("/api/dictionary", params={"q": "水", "limit": 5})
    assert response.status_code == 200
    body = response.json()
    assert "results" in body
    assert "total" in body
    assert "page" in body
    assert "limit" in body
    assert "has_more" in body


def test_unknown_exam_id_returns_404_with_detail(client):
    response = client.get("/api/exams/not-a-real-exam-id")
    assert response.status_code == 404
    body = response.json()
    assert "detail" in body


def test_today_queue_responds_for_fresh_user(client):
    response = client.get("/api/today")
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body, dict)


# ── CORS — the native shell's own origins (plan 066) ─────────────
# Starlette matches Origin by exact string, so the two WebView origins
# have to be spelled exactly as Capacitor sends them. A preflight is
# what the first /api call from the shell does; the echo below is what
# lets it through.
import pytest


@pytest.mark.parametrize("origin", ["capacitor://localhost", "https://localhost"])
def test_native_origins_pass_the_cors_preflight(client, origin):
    response = client.options(
        "/api/profile",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization,content-type",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == origin


def test_an_unknown_origin_is_not_echoed(client):
    response = client.options(
        "/api/profile",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"},
    )
    assert response.headers.get("access-control-allow-origin") is None


# ── CORS on the static mounts, not just /api ─────────────────────
# The stroke-order drawing is the one backend asset the frontend reads
# with fetch() rather than an <img>/<audio> src (it parses the SVG to
# animate it path by path -- components/study/StrokeOrderAnimation),
# and fetch is CORS-checked where a media element's src is not. So in
# the shell, where /kanjivg is cross-origin (ADR 0008), the mount has
# to answer with the echo too or every kanji falls back to "not
# available". CORSMiddleware wraps the mounts as well as the routers;
# this is what keeps that true.
@pytest.mark.parametrize("origin", ["capacitor://localhost", "https://localhost"])
def test_the_kanjivg_mount_answers_the_native_origins(client, origin):
    response = client.get("/kanjivg/06728.svg", headers={"Origin": origin})
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == origin
    assert "<svg" in response.text
