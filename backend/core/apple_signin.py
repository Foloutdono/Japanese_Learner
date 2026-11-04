"""
Sign in with Apple: the server's half (plan 295).

The iPhone signs in with Apple on the device (ios/App/App/
TsujiAppleSignInPlugin.swift) and hands Supabase the identity token
(src/lib/oauth.js), which Supabase checks against the bundle id and
answers with a session. A sign-in needs nothing more from this server.

What it does need the server for comes later. Apple asks an app that
offers Sign in with Apple to revoke the learner's grant when the
account is deleted ("Offering account deletion in your app"), so that
Tsuji leaves the learner's Apple ID › Sign in with Apple list with the
account. Revoking takes a token only the server can obtain: the
device's answer carries, beside the identity token, an authorization
code -- single use, valid five minutes, exchangeable only with a client
secret signed by the team's key. The app posts it here straight after
the sign-in (POST /api/account/apple); it is exchanged for a refresh
token, which is kept in apple_grants, one row per learner, and nothing
else of Apple's answer is. DELETE /api/account revokes it before the
rows go (routes/account.py), and the table is in that route's PLAN.

Without the APPLE_* variables nothing breaks: no code is exchanged,
nothing is stored, and a deletion has nothing to revoke. The sign-in
itself does not read them.

    APPLE_TEAM_ID      the team id, ten characters (MS25NAPKZ6)
    APPLE_KEY_ID       the id of a key with Sign in with Apple enabled
    APPLE_PRIVATE_KEY  that key's .p8 file, as it is (newlines may be
                       written \\n on one line)
    APPLE_CLIENT_ID    the bundle id the codes are issued to; app.tsuji
                       when unset
"""
import logging
import os
import time
from dataclasses import dataclass

import httpx
import jwt

from core.db import db_conn
from core.rls import enable_rls

logger = logging.getLogger(__name__)

APPLE = "https://appleid.apple.com"
TOKEN_URL = f"{APPLE}/auth/token"
REVOKE_URL = f"{APPLE}/auth/revoke"
DEFAULT_CLIENT_ID = "app.tsuji"
# A client secret lives for minutes here, not the six months Apple
# allows: one is signed for each call, so none is ever kept.
SECRET_TTL_S = 300


@dataclass(frozen=True)
class Config:
    team_id: str
    key_id: str
    private_key: str
    client_id: str


def config() -> Config | None:
    """The team's key, or None while any of it is unset. Read at each
    call, so a key added on Render is used without a code change."""
    team = os.environ.get("APPLE_TEAM_ID", "").strip()
    key_id = os.environ.get("APPLE_KEY_ID", "").strip()
    key = os.environ.get("APPLE_PRIVATE_KEY", "").strip().replace("\\n", "\n")
    client = os.environ.get("APPLE_CLIENT_ID", "").strip() or DEFAULT_CLIENT_ID
    if not (team and key_id and key):
        return None
    return Config(team, key_id, key, client)


def client_secret(cfg: Config, now: float | None = None) -> str:
    """The JWT Apple takes as a client secret: ES256, signed by the
    team's key, naming the team as issuer and the bundle id as subject."""
    issued = int(time.time() if now is None else now)
    return jwt.encode(
        {"iss": cfg.team_id, "iat": issued, "exp": issued + SECRET_TTL_S, "aud": APPLE, "sub": cfg.client_id},
        cfg.private_key,
        algorithm="ES256",
        headers={"kid": cfg.key_id},
    )


def _post(url: str, cfg: Config, fields: dict) -> httpx.Response | None:
    try:
        return httpx.post(
            url,
            data={"client_id": cfg.client_id, "client_secret": client_secret(cfg), **fields},
            timeout=10,
        )
    except (httpx.RequestError, jwt.PyJWTError, ValueError) as e:
        # ValueError: a key that is not a P-256 private key in PEM.
        logger.warning("apple: %s failed: %s", url.rsplit("/", 1)[-1], e)
        return None


def _apple_error(r: httpx.Response) -> str:
    try:
        return str(r.json().get("error", ""))
    except ValueError:
        return ""


def exchange(code: str, cfg: Config) -> str | None:
    """The refresh token an authorization code is worth, or None."""
    r = _post(TOKEN_URL, cfg, {"code": code, "grant_type": "authorization_code"})
    if r is None:
        return None
    if r.status_code != 200:
        # Apple's error is a code (invalid_grant, invalid_client), never
        # the learner's data.
        logger.warning("apple: code exchange refused: %s %s", r.status_code, _apple_error(r))
        return None
    try:
        token = r.json().get("refresh_token")
    except ValueError:
        token = None
    return token if isinstance(token, str) and token else None


def revoke(token: str, cfg: Config) -> bool:
    r = _post(REVOKE_URL, cfg, {"token": token, "token_type_hint": "refresh_token"})
    if r is None:
        return False
    if r.status_code != 200:
        logger.warning("apple: revocation refused: %s %s", r.status_code, _apple_error(r))
        return False
    return True


# ── The kept grant ───────────────────────────────────────────────

def _init_db() -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS apple_grants (
                    user_id       TEXT PRIMARY KEY,
                    refresh_token TEXT NOT NULL,
                    kept_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
            enable_rls(cur, "apple_grants")
        conn.commit()
    finally:
        conn.close()


try:
    _init_db()
except Exception:  # pragma: no cover - a missing DB must not stop import
    logger.exception("apple_grants could not be initialised")


def keep(user_id: str, code: str) -> bool:
    """Exchange the code a sign-in just brought and keep its grant,
    replacing the one kept before. False when there is no key to
    exchange it with, or Apple refused it: the sign-in stands either way."""
    cfg = config()
    if cfg is None:
        return False
    token = exchange(code, cfg)
    if token is None:
        return False
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO apple_grants (user_id, refresh_token) VALUES (%s, %s) "
                "ON CONFLICT (user_id) DO UPDATE SET refresh_token = EXCLUDED.refresh_token, kept_at = NOW()",
                (user_id, token),
            )
        conn.commit()
    finally:
        conn.close()
    return True


def revoke_for(user_id: str) -> bool | None:
    """Revoke the grant kept for this learner. None when there is none
    (or no key to revoke it with), else whether Apple accepted. Never
    raises: an account's deletion does not wait on Apple. The row itself
    goes with the account's (routes/account.PLAN)."""
    try:
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT refresh_token FROM apple_grants WHERE user_id = %s", (user_id,))
                row = cur.fetchone()
        finally:
            conn.close()
    except Exception:
        logger.exception("apple: the kept grant could not be read for %s", user_id)
        return False
    if row is None:
        return None
    cfg = config()
    if cfg is None:
        logger.warning("apple: a grant is kept for %s but APPLE_* is unset; not revoked", user_id)
        return None
    return revoke(row[0], cfg)
