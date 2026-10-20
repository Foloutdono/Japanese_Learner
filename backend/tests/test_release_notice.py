"""工事 -- the release the workflow announces (plan 264): the route only it
can call, and the header every /api answer carries meanwhile."""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from core import release_notice
from core.release_notice import GRACE, ReleaseNoticeHeader
from routes.release import router


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("RELEASE_NOTICE_TOKEN", "s3cret")
    release_notice.clear()
    app = FastAPI()
    app.include_router(router)

    @app.get("/api/ping")
    def ping():
        return {}

    @app.get("/elsewhere")
    def elsewhere():
        return {}

    app.add_middleware(ReleaseNoticeHeader)
    yield TestClient(app)
    release_notice.clear()


def _announce(client, minutes=10, token="s3cret"):
    return client.post("/api/release/notice", json={"in_minutes": minutes},
                       headers={"X-Release-Token": token} if token else {})


def test_no_header_until_announced(client):
    assert "x-release-at" not in client.get("/api/ping").headers


def test_announced_release_is_stamped_on_api_answers(client, monkeypatch):
    monkeypatch.setattr(release_notice.time, "time", lambda: 1_000_000.0)
    r = _announce(client, minutes=10)
    assert r.status_code == 200 and r.json() == {"at": 1_000_600}
    assert client.get("/api/ping").headers["x-release-at"] == "1000600"
    assert "x-release-at" not in client.get("/elsewhere").headers


def test_clear_takes_it_down(client):
    _announce(client)
    assert client.delete("/api/release/notice", headers={"X-Release-Token": "s3cret"}).status_code == 200
    assert "x-release-at" not in client.get("/api/ping").headers


def test_a_release_that_never_came_stops_being_announced():
    release_notice.announce(1000.0)
    assert release_notice.current(now=1000.0 + GRACE) == 1000
    assert release_notice.current(now=1000.0 + GRACE + 1) is None
    release_notice.clear()


def test_wrong_or_missing_token_is_refused(client):
    assert _announce(client, token="nope").status_code == 403
    assert _announce(client, token=None).status_code == 403
    assert client.delete("/api/release/notice").status_code == 403
    assert "x-release-at" not in client.get("/api/ping").headers


def test_without_the_variable_the_route_is_not_there(client, monkeypatch):
    monkeypatch.delenv("RELEASE_NOTICE_TOKEN")
    assert _announce(client).status_code == 404


def test_minutes_are_bounded(client):
    assert _announce(client, minutes=61).status_code == 422
    assert _announce(client, minutes=-1).status_code == 422


def test_the_app_stamps_it_and_lets_the_native_shell_read_it(monkeypatch):
    # The shell's requests are cross-origin (ADR 0008): without the
    # expose, the WebView would hide the header from the request path.
    from main import app
    monkeypatch.setenv("RELEASE_NOTICE_TOKEN", "s3cret")
    release_notice.clear()
    try:
        c = TestClient(app)
        assert _announce(c).status_code == 200
        r = c.get("/api/no-such-route", headers={"Origin": "capacitor://localhost"})
        assert r.headers["x-release-at"] == str(release_notice.current())
        assert "x-release-at" in r.headers["access-control-expose-headers"].lower()
    finally:
        release_notice.clear()
