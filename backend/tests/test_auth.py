import os
import unittest
from unittest.mock import patch, MagicMock

os.environ.setdefault("DATABASE_URL", "postgresql://postgres:dev@localhost:5433/jp_test")

import jwt
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization
from fastapi import HTTPException

# DEV_USER_ID must be unset for these tests -- they exercise the real
# token-verification branches, which core.auth's module-level DEV_USER_ID
# check would otherwise short-circuit entirely.
os.environ.pop("DEV_USER_ID", None)
os.environ.setdefault("SUPABASE_URL", "https://test-project.supabase.co")

import core.auth as auth_mod
import importlib
importlib.reload(auth_mod)


def _make_keypair():
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_key = private_key.public_key()
    return private_key, public_key


def _make_token(private_key, **overrides):
    claims = {"sub": "user-123", "aud": "authenticated"}
    claims.update(overrides)
    return jwt.encode(claims, private_key, algorithm="ES256")


class LocalJwtVerificationTests(unittest.TestCase):
    def setUp(self):
        self.private_key, self.public_key = _make_keypair()
        # Stand in for jwt.PyJWKClient.get_signing_key_from_jwt: real
        # PyJWK objects wrap a key plus metadata, but auth.py only reads
        # `.key`, so a lightweight stand-in is enough and avoids any
        # network access.
        self.fake_signing_key = MagicMock(key=self.public_key)

    def _creds(self, token):
        return type("C", (), {"credentials": token})()

    def test_valid_token_returns_subject(self):
        token = _make_token(self.private_key)
        with patch.object(auth_mod._jwks_client, "get_signing_key_from_jwt", return_value=self.fake_signing_key):
            self.assertEqual(auth_mod.get_user_id(self._creds(token)), "user-123")

    def test_wrong_key_is_rejected(self):
        other_private_key, _ = _make_keypair()
        token = _make_token(other_private_key)  # signed with a DIFFERENT key
        with patch.object(auth_mod._jwks_client, "get_signing_key_from_jwt", return_value=self.fake_signing_key):
            with self.assertRaises(HTTPException) as ctx:
                auth_mod.get_user_id(self._creds(token))
            self.assertEqual(ctx.exception.status_code, 401)

    def test_wrong_audience_is_rejected(self):
        token = _make_token(self.private_key, aud="service_role")
        with patch.object(auth_mod._jwks_client, "get_signing_key_from_jwt", return_value=self.fake_signing_key):
            with self.assertRaises(HTTPException) as ctx:
                auth_mod.get_user_id(self._creds(token))
            self.assertEqual(ctx.exception.status_code, 401)

    def test_jwks_resolution_failure_falls_back_to_http_check(self):
        token = _make_token(self.private_key)
        with patch.object(auth_mod._jwks_client, "get_signing_key_from_jwt", side_effect=jwt.PyJWKClientError("unreachable")):
            with patch("core.auth.httpx.get") as mock_get:
                mock_get.return_value = MagicMock(status_code=200, json=lambda: {"id": "fallback-user"})
                result = auth_mod.get_user_id(self._creds(token))
        self.assertEqual(result, "fallback-user")
        mock_get.assert_called_once()

    def test_missing_credentials_still_rejected(self):
        with self.assertRaises(HTTPException) as ctx:
            auth_mod.get_user_id(None)
        self.assertEqual(ctx.exception.status_code, 401)
