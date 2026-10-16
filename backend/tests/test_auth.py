import os
import unittest
from unittest.mock import patch, MagicMock

os.environ.setdefault("DATABASE_URL", "postgresql://postgres:dev@localhost:5433/jp_test")

import jwt
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import HTTPException

import core.auth as auth_mod


def _make_keypair():
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_key = private_key.public_key()
    return private_key, public_key


def _make_token(private_key, **overrides):
    claims = {"sub": "user-123", "aud": "authenticated"}
    claims.update(overrides)
    return jwt.encode(claims, private_key, algorithm="ES256")


class LocalJwtVerificationTests(unittest.TestCase):
    """Patches core.auth's module-level DEV_USER_ID/_jwks_client/SUPABASE_URL
    per test via unittest.mock, rather than mutating the real process
    environment and reloading the shared core.auth module. A reload
    mutates the SAME module object every other test file (and every route
    module) already holds a reference to -- it previously leaked
    DEV_USER_ID=None into the rest of the pytest session, breaking every
    other test that relies on the dev-auth bypass (caught when plans 001
    and 004 were merged together and run in one process)."""

    def setUp(self):
        self.private_key, self.public_key = _make_keypair()
        # Stand in for jwt.PyJWKClient.get_signing_key_from_jwt: real
        # PyJWK objects wrap a key plus metadata, but auth.py only reads
        # `.key`, so a lightweight stand-in is enough and avoids any
        # network access.
        self.fake_signing_key = MagicMock(key=self.public_key)
        self.fake_jwks_client = MagicMock()

        for attr, value in (
            ("DEV_USER_ID", None),
            ("_jwks_client", self.fake_jwks_client),
            ("SUPABASE_URL", "https://test-project.supabase.co"),
        ):
            patcher = patch.object(auth_mod, attr, value)
            patcher.start()
            self.addCleanup(patcher.stop)

    def _creds(self, token):
        return type("C", (), {"credentials": token})()

    def test_valid_token_returns_subject(self):
        token = _make_token(self.private_key)
        self.fake_jwks_client.get_signing_key_from_jwt.return_value = self.fake_signing_key
        self.assertEqual(auth_mod.get_user_id(self._creds(token)), "user-123")

    def test_wrong_key_is_rejected(self):
        other_private_key, _ = _make_keypair()
        token = _make_token(other_private_key)  # signed with a DIFFERENT key
        self.fake_jwks_client.get_signing_key_from_jwt.return_value = self.fake_signing_key
        with self.assertRaises(HTTPException) as ctx:
            auth_mod.get_user_id(self._creds(token))
        self.assertEqual(ctx.exception.status_code, 401)

    def test_wrong_audience_is_rejected(self):
        token = _make_token(self.private_key, aud="service_role")
        self.fake_jwks_client.get_signing_key_from_jwt.return_value = self.fake_signing_key
        with self.assertRaises(HTTPException) as ctx:
            auth_mod.get_user_id(self._creds(token))
        self.assertEqual(ctx.exception.status_code, 401)

    def test_jwks_resolution_failure_falls_back_to_http_check(self):
        auth_mod._fallback.clear()
        self.addCleanup(auth_mod._fallback.clear)
        token = _make_token(self.private_key)
        self.fake_jwks_client.get_signing_key_from_jwt.side_effect = jwt.PyJWKClientError("unreachable")
        with patch("core.auth.httpx.get") as mock_get:
            mock_get.return_value = MagicMock(status_code=200, json=lambda: {"id": "fallback-user"})
            result = auth_mod.get_user_id(self._creds(token))
        self.assertEqual(result, "fallback-user")
        mock_get.assert_called_once()

    def test_the_fallbacks_verdict_is_remembered_a_while(self):
        # plan 211: a token no key matches cost a Supabase round trip on
        # every request, and junk tokens need no account.
        auth_mod._fallback.clear()
        self.addCleanup(auth_mod._fallback.clear)
        self.fake_jwks_client.get_signing_key_from_jwt.side_effect = jwt.PyJWKClientError("unknown kid")
        good, junk = _make_token(self.private_key), _make_token(self.private_key, sub="x")
        with patch("core.auth.httpx.get") as mock_get:
            mock_get.side_effect = lambda url, headers, timeout: (
                MagicMock(status_code=200, json=lambda: {"id": "fallback-user"})
                if headers["Authorization"].endswith(good) else MagicMock(status_code=401)
            )
            for _ in range(3):
                self.assertEqual(auth_mod.get_user_id(self._creds(good)), "fallback-user")
                with self.assertRaises(HTTPException):
                    auth_mod.get_user_id(self._creds(junk))
        self.assertEqual(mock_get.call_count, 2)

    def test_an_auth_service_failure_is_not_remembered(self):
        auth_mod._fallback.clear()
        self.addCleanup(auth_mod._fallback.clear)
        self.fake_jwks_client.get_signing_key_from_jwt.side_effect = jwt.PyJWKClientError("unknown kid")
        token = _make_token(self.private_key)
        with patch("core.auth.httpx.get") as mock_get:
            mock_get.return_value = MagicMock(status_code=503)
            with self.assertRaises(HTTPException):
                auth_mod.get_user_id(self._creds(token))
            mock_get.return_value = MagicMock(status_code=200, json=lambda: {"id": "fallback-user"})
            self.assertEqual(auth_mod.get_user_id(self._creds(token)), "fallback-user")

    def test_missing_credentials_still_rejected(self):
        with self.assertRaises(HTTPException) as ctx:
            auth_mod.get_user_id(None)
        self.assertEqual(ctx.exception.status_code, 401)
