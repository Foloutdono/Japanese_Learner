# ── Sign in with Apple: the server's half (plan 295) ────────────────
# core/apple_signin.py exchanges a sign-in's authorization code for the
# refresh token that lets DELETE /api/account revoke the learner's grant.
# Apple is never called: httpx.post is patched, and the client secret is
# signed with a key made here and checked with its public half.
import uuid
from unittest.mock import MagicMock, patch

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec

import core.apple_signin as apple
import routes.account as account
from core.auth import DEV_USER_ID
from core.db import db_conn


@pytest.fixture(scope="module")
def key():
    private = ec.generate_private_key(ec.SECP256R1())
    pem = private.private_bytes(
        serialization.Encoding.PEM,
        serialization.PrivateFormat.PKCS8,
        serialization.NoEncryption(),
    ).decode()
    return private, pem


@pytest.fixture
def cfg(key):
    return apple.Config(team_id="TEAM123456", key_id="KEY1234567", private_key=key[1], client_id="app.tsuji")


@pytest.fixture
def configured(monkeypatch, key):
    monkeypatch.setenv("APPLE_TEAM_ID", "TEAM123456")
    monkeypatch.setenv("APPLE_KEY_ID", "KEY1234567")
    monkeypatch.setenv("APPLE_PRIVATE_KEY", key[1])
    monkeypatch.delenv("APPLE_CLIENT_ID", raising=False)


@pytest.fixture
def unconfigured(monkeypatch):
    for name in ("APPLE_TEAM_ID", "APPLE_KEY_ID", "APPLE_PRIVATE_KEY", "APPLE_CLIENT_ID"):
        monkeypatch.delenv(name, raising=False)


def _grant(user_id):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT refresh_token FROM apple_grants WHERE user_id = %s", (user_id,))
            row = cur.fetchone()
    finally:
        conn.close()
    return row[0] if row else None


def _forget(user_id):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM apple_grants WHERE user_id = %s", (user_id,))
        conn.commit()
    finally:
        conn.close()


@pytest.fixture
def learner():
    uid = f"probe-{uuid.uuid4()}"
    yield uid
    _forget(uid)


# ── The key ──────────────────────────────────────────────────────

def test_no_key_is_no_config(unconfigured):
    assert apple.config() is None


def test_the_key_is_read_from_the_environment(configured, key):
    cfg = apple.config()
    assert cfg.team_id == "TEAM123456" and cfg.key_id == "KEY1234567"
    # The bundle id, when nothing says otherwise.
    assert cfg.client_id == "app.tsuji"
    assert cfg.private_key == key[1].strip()


def test_a_key_written_on_one_line_is_read_back_whole(configured, monkeypatch, key):
    monkeypatch.setenv("APPLE_PRIVATE_KEY", key[1].strip().replace("\n", "\\n"))
    assert apple.config().private_key == key[1].strip()


def test_the_client_secret_is_what_apple_asks_for(cfg, key):
    secret = apple.client_secret(cfg, now=1_700_000_000)
    assert jwt.get_unverified_header(secret) == {"alg": "ES256", "kid": "KEY1234567", "typ": "JWT"}
    claims = jwt.decode(
        secret, key[0].public_key(), algorithms=["ES256"],
        audience="https://appleid.apple.com", options={"verify_exp": False},
    )
    assert claims["iss"] == "TEAM123456"
    assert claims["sub"] == "app.tsuji"
    # Minutes, never the six months Apple would allow: none is kept.
    assert claims["exp"] - claims["iat"] == apple.SECRET_TTL_S <= 600


# ── The two calls ────────────────────────────────────────────────

def _answer(status, body=None):
    r = MagicMock(status_code=status)
    r.json.return_value = body or {}
    return r


def test_a_code_is_exchanged_for_its_refresh_token(cfg):
    with patch.object(apple.httpx, "post", return_value=_answer(200, {"refresh_token": "r.1", "id_token": "x"})) as post:
        assert apple.exchange("c.1", cfg) == "r.1"
    assert post.call_args.args[0] == "https://appleid.apple.com/auth/token"
    sent = post.call_args.kwargs["data"]
    assert sent["code"] == "c.1" and sent["grant_type"] == "authorization_code"
    assert sent["client_id"] == "app.tsuji" and sent["client_secret"].count(".") == 2


@pytest.mark.parametrize("answer", [
    _answer(400, {"error": "invalid_grant"}),
    _answer(200, {}),
    _answer(200, {"refresh_token": ""}),
])
def test_a_refused_code_is_worth_nothing(cfg, answer):
    with patch.object(apple.httpx, "post", return_value=answer):
        assert apple.exchange("c.1", cfg) is None


def test_apple_unreachable_is_worth_nothing(cfg):
    with patch.object(apple.httpx, "post", side_effect=httpx.ConnectError("down")):
        assert apple.exchange("c.1", cfg) is None
        assert apple.revoke("r.1", cfg) is False


def test_a_bad_key_is_logged_not_raised(cfg):
    broken = apple.Config(cfg.team_id, cfg.key_id, "not a key", cfg.client_id)
    with patch.object(apple.httpx, "post") as post:
        assert apple.exchange("c.1", broken) is None
    post.assert_not_called()


def test_a_grant_is_revoked_by_its_refresh_token(cfg):
    with patch.object(apple.httpx, "post", return_value=_answer(200)) as post:
        assert apple.revoke("r.1", cfg) is True
    assert post.call_args.args[0] == "https://appleid.apple.com/auth/revoke"
    sent = post.call_args.kwargs["data"]
    assert sent["token"] == "r.1" and sent["token_type_hint"] == "refresh_token"


def test_a_refused_revocation_says_so(cfg):
    with patch.object(apple.httpx, "post", return_value=_answer(400, {"error": "invalid_client"})):
        assert apple.revoke("r.1", cfg) is False


# ── The kept grant ───────────────────────────────────────────────

def test_without_a_key_nothing_is_exchanged_or_kept(unconfigured, learner):
    with patch.object(apple.httpx, "post") as post:
        assert apple.keep(learner, "c.1") is False
    post.assert_not_called()
    assert _grant(learner) is None


def test_a_sign_in_keeps_its_grant_and_the_next_replaces_it(configured, learner):
    with patch.object(apple.httpx, "post", return_value=_answer(200, {"refresh_token": "r.1"})):
        assert apple.keep(learner, "c.1") is True
    assert _grant(learner) == "r.1"
    with patch.object(apple.httpx, "post", return_value=_answer(200, {"refresh_token": "r.2"})):
        assert apple.keep(learner, "c.2") is True
    assert _grant(learner) == "r.2"


def test_a_refused_code_keeps_nothing(configured, learner):
    with patch.object(apple.httpx, "post", return_value=_answer(400, {"error": "invalid_grant"})):
        assert apple.keep(learner, "c.1") is False
    assert _grant(learner) is None


def test_no_grant_kept_is_nothing_to_revoke(configured, learner):
    with patch.object(apple.httpx, "post") as post:
        assert apple.revoke_for(learner) is None
    post.assert_not_called()


def test_the_kept_grant_is_the_one_revoked(configured, learner):
    with patch.object(apple.httpx, "post", return_value=_answer(200, {"refresh_token": "r.1"})):
        apple.keep(learner, "c.1")
    with patch.object(apple.httpx, "post", return_value=_answer(200)) as post:
        assert apple.revoke_for(learner) is True
    assert post.call_args.kwargs["data"]["token"] == "r.1"


def test_a_kept_grant_without_a_key_is_left_alone(configured, learner, monkeypatch):
    with patch.object(apple.httpx, "post", return_value=_answer(200, {"refresh_token": "r.1"})):
        apple.keep(learner, "c.1")
    monkeypatch.delenv("APPLE_KEY_ID")
    with patch.object(apple.httpx, "post") as post:
        assert apple.revoke_for(learner) is None
    post.assert_not_called()


def test_the_grant_goes_with_the_account(configured, learner):
    with patch.object(apple.httpx, "post", return_value=_answer(200, {"refresh_token": "r.1"})):
        apple.keep(learner, "c.1")
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            counts = account.delete_user_rows(cur, learner)
        conn.commit()
    finally:
        conn.close()
    assert counts["apple_grants"] == 1
    assert _grant(learner) is None


# ── The routes ───────────────────────────────────────────────────

@pytest.mark.parametrize("code", ["", "x" * 1025])
def test_the_code_posted_is_bounded(client, code):
    with patch.object(apple, "keep") as keep:
        r = client.post("/api/account/apple", json={"code": code})
    assert r.status_code == 422
    keep.assert_not_called()


def test_the_code_posted_is_kept_for_the_learner_asking(client):
    with patch.object(apple, "keep", return_value=True) as keep:
        r = client.post("/api/account/apple", json={"code": "c.1"})
    assert r.status_code == 200 and r.json() == {"kept": True}
    keep.assert_called_once_with(DEV_USER_ID, "c.1")


def test_the_deletion_revokes_the_grant_before_the_rows_go(client, monkeypatch):
    calls = []
    monkeypatch.setattr(apple, "revoke_for", lambda uid: calls.append("apple") or True)
    monkeypatch.setattr(account, "delete_user_rows", lambda cur, uid, after=None: calls.append("rows") or {})
    monkeypatch.setattr(account, "_delete_auth_user", lambda uid: calls.append("auth") or True)
    r = client.delete("/api/account")
    assert r.status_code == 200 and r.json()["apple_revoked"] is True
    assert calls == ["apple", "rows", "auth"]


def test_apple_refusing_never_holds_the_deletion_up(client, monkeypatch):
    calls = []
    monkeypatch.setattr(apple, "revoke_for", lambda uid: False)
    monkeypatch.setattr(account, "delete_user_rows", lambda cur, uid, after=None: calls.append("rows") or {})
    monkeypatch.setattr(account, "_delete_auth_user", lambda uid: calls.append("auth") or True)
    r = client.delete("/api/account")
    assert r.status_code == 200 and r.json()["apple_revoked"] is False
    assert calls == ["rows", "auth"]
