"""The JWKS path is load-bearing and easy to "tidy" back into the
401-ing one -- see core/auth.py's comment.

Verified live against this project's Supabase instance 2026-08-26:
    /auth/v1/jwks                   -> HTTP 401 (needs an apikey header
                                       PyJWKClient never sends)
    /auth/v1/.well-known/jwks.json  -> HTTP 200, {"keys":[{"alg":"ES256",
                                       "kty":"EC","crv":"P-256",...}]}

Until that date the client pointed at the first one, so local JWT
verification never once succeeded in production: every authenticated
request 401'd, logged a traceback, and fell through to the httpx round
trip -- two network calls per request where zero were intended.
"""
import importlib
import os

import core.auth


def _reload_auth_with(supabase_url: str):
    """core/auth.py reads SUPABASE_URL at import time, so the only way to
    observe the constructed client is a controlled reimport.

    importlib.reload re-executes the module in its EXISTING namespace, so
    the restore in the caller's finally is not optional: function objects
    already handed to FastAPI's Depends() read their globals from that
    same namespace, and leaving DEV_USER_ID cleared would break every
    authenticated test that runs after this file.
    """
    os.environ["SUPABASE_URL"] = supabase_url
    return importlib.reload(core.auth)


class _AuthEnv:
    """Restores the environment and the module, whatever the test does."""

    def __enter__(self):
        self._url = os.environ.get("SUPABASE_URL")
        self._dev = os.environ.get("DEV_USER_ID")
        # DEV_USER_ID short-circuits get_user_id entirely; clear it so the
        # reload exercises the same branch production takes.
        os.environ.pop("DEV_USER_ID", None)
        return self

    def __exit__(self, *exc):
        if self._url is None:
            os.environ.pop("SUPABASE_URL", None)
        else:
            os.environ["SUPABASE_URL"] = self._url
        if self._dev is not None:
            os.environ["DEV_USER_ID"] = self._dev
        importlib.reload(core.auth)
        return False


def test_jwks_client_uses_the_public_well_known_path():
    with _AuthEnv():
        auth = _reload_auth_with("https://example.supabase.co")
        assert auth._jwks_client is not None
        assert auth._jwks_client.uri == (
            "https://example.supabase.co/auth/v1/.well-known/jwks.json"
        )


def test_jwks_client_does_not_use_the_apikey_gated_path():
    # The specific regression: /auth/v1/jwks is a real endpoint that
    # returns 401 here, so pointing at it fails silently-ish (a warning
    # and a fallback) rather than loudly.
    with _AuthEnv():
        auth = _reload_auth_with("https://example.supabase.co")
        assert not auth._jwks_client.uri.endswith("/auth/v1/jwks")


def test_no_jwks_client_without_a_supabase_url():
    with _AuthEnv():
        auth = _reload_auth_with("")
        assert auth._jwks_client is None


def test_decode_algorithm_matches_the_key_set_supabase_publishes():
    """get_user_id passes algorithms=["ES256"]. If the live key set ever
    advertises something else, key resolution SUCCEEDS and the decode then
    fails as an InvalidTokenError -- which is a hard 401 with no fallback,
    i.e. every user locked out. Checked live 2026-08-26: the project's key
    set is a single ES256/P-256 key.

    This asserts on the source rather than the network so the suite stays
    offline; it is a tripwire for someone widening the algorithm list
    without saying so, not a check of Supabase's current config.
    """
    import inspect

    source = inspect.getsource(core.auth.get_user_id)
    assert 'algorithms=["ES256"]' in source
