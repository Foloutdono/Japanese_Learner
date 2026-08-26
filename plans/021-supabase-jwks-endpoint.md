# Plan 021: Point the JWKS client at the endpoint that actually serves keys

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 2552915..HEAD -- backend/core/auth.py`
> If `auth.py` changed since this plan was written, compare the "Current state"
> excerpt against the live code before proceeding; on a mismatch, treat it as a
> STOP condition.

## Status

- **Priority**: P0
- **Effort**: S
- **Risk**: LOW — one string, and the fallback that currently carries every
  request stays exactly where it is
- **Depends on**: —
- **Category**: correctness / performance
- **Planned at**: commit `2552915`, 2026-08-26

## Why this matters

Every authenticated request to the deployed backend currently does this:

1. `PyJWKClient` fetches `{SUPABASE_URL}/auth/v1/jwks` → **HTTP 401**
2. That raises `PyJWKClientConnectionError`, logged as a **warning with a full
   traceback**
3. The code falls back to `httpx.get({SUPABASE_URL}/auth/v1/user)` → 200
4. The request finally proceeds

So local JWT verification — the entire point of the `_jwks_client` code path —
**has never once worked in production**. Every request pays two network round
trips to Supabase instead of zero, and every request writes a multi-line
traceback into the Render log. This is the traceback filling the log screenshot
that prompted this wave.

The cause is a wrong path. Supabase serves its public JWKS at
`/auth/v1/.well-known/jwks.json`. The `/auth/v1/jwks` path exists but requires
an `apikey` header, which `PyJWKClient` does not send — hence the 401.

Verified live against this project's own Supabase instance on 2026-08-26:

```
/auth/v1/jwks                          -> HTTP 401 Unauthorized
/auth/v1/.well-known/jwks.json         -> 200 {"keys":[{"alg":"ES256","crv":"P-256",...
```

The keys are public by design (they verify signatures, they do not create
them), which is why the `.well-known` path needs no auth.

## Current state

`backend/core/auth.py`, near the top:

```python
# Local JWT verification (see get_user_id below): Supabase's newer
# projects sign tokens asymmetrically and publish the public verification
# key at this JWKS endpoint -- no secret to configure, the key is public
# by design. PyJWKClient fetches and caches it lazily; constructing it
# here does NOT make a network call (the first fetch happens on first use
# in get_user_id), so this is safe even when DEV_USER_ID means the path
# below is never exercised.
_jwks_client = jwt.PyJWKClient(f"{SUPABASE_URL}/auth/v1/jwks") if SUPABASE_URL else None
```

The consuming code in `get_user_id` is **correct as written** and must not
change. It already does the right thing on every branch:

```python
    if _jwks_client is not None:
        try:
            signing_key = _jwks_client.get_signing_key_from_jwt(token)
            claims = jwt.decode(
                token,
                signing_key.key,
                algorithms=["ES256"],
                audience="authenticated",
            )
            ...
        except jwt.InvalidTokenError:
            raise HTTPException(status_code=401, detail="Invalid token")
        except jwt.PyJWKClientError:
            logger.warning("Local JWT verification unavailable, falling back to network check", exc_info=True)
```

Note the two-branch `except`: a token that fails against a *real* key is a
definitive 401, and only a *key-resolution* failure falls back. That
distinction is correct and is the reason this fix is safe — if the new URL were
somehow also wrong, behaviour would be identical to today.

## Scope

**In scope** — exactly one file:
- `backend/core/auth.py` — the JWKS URL and its comment
- `backend/tests/test_auth_jwks.py` — new, small

**Out of scope — do not touch:**
- `get_user_id`'s logic, its exception branches, or the httpx fallback. The
  fallback must remain: it is what serves requests if Supabase rotates to a
  scheme this client cannot resolve.
- `SUPABASE_SERVICE_KEY` handling anywhere.
- Anything about `DEV_USER_ID`.
- The `algorithms=["ES256"]` list — see STOP conditions.

## Steps

### Step 1 — Correct the URL

In `backend/core/auth.py`, replace the `_jwks_client` construction and rewrite
its comment to record why the path matters (a future reader must not "simplify"
it back):

```python
# Local JWT verification (see get_user_id below): Supabase's newer
# projects sign tokens asymmetrically and publish the public verification
# key set as JWKS -- no secret to configure, these keys verify signatures
# and cannot create them, which is why the endpoint needs no auth.
#
# The path matters. Supabase exposes TWO JWKS-ish routes:
#   /auth/v1/.well-known/jwks.json  -> 200, public, what we want
#   /auth/v1/jwks                   -> 401 unless an apikey header is sent,
#                                      which PyJWKClient does not send
# This pointed at the second one until 2026-08-26, so local verification
# never once succeeded in production: every request 401'd here, logged a
# traceback, and fell through to the httpx round trip below. Two network
# calls per request where zero were intended.
#
# PyJWKClient fetches and caches lazily; constructing it here does NOT
# make a network call, so this is safe even when DEV_USER_ID means the
# path below is never exercised.
_jwks_client = (
    jwt.PyJWKClient(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json")
    if SUPABASE_URL
    else None
)
```

**Verify** the module still imports and the URL is what you expect:

```bash
cd backend && SUPABASE_URL=https://example.supabase.co python -c "
import core.auth as a
print(a._jwks_client.uri)
"
```

Expected output exactly:
```
https://example.supabase.co/auth/v1/.well-known/jwks.json
```

### Step 2 — Lock the path with a test

Create `backend/tests/test_auth_jwks.py`:

```python
"""The JWKS path is load-bearing and easy to "tidy" back into the
401-ing one -- see core/auth.py's comment. Verified live 2026-08-26:
/auth/v1/jwks returns 401 (needs an apikey header PyJWKClient never
sends), /auth/v1/.well-known/jwks.json returns 200 with the key set.
"""
import importlib
import os


def _auth_module_with(url: str):
    """core/auth.py reads SUPABASE_URL at import time, so the only way to
    test the constructed client is a controlled reimport."""
    previous = os.environ.get("SUPABASE_URL")
    previous_dev = os.environ.get("DEV_USER_ID")
    os.environ["SUPABASE_URL"] = url
    os.environ.pop("DEV_USER_ID", None)
    try:
        import core.auth
        return importlib.reload(core.auth)
    finally:
        if previous is None:
            os.environ.pop("SUPABASE_URL", None)
        else:
            os.environ["SUPABASE_URL"] = previous
        if previous_dev is not None:
            os.environ["DEV_USER_ID"] = previous_dev
        import core.auth
        importlib.reload(core.auth)


def test_jwks_client_uses_the_public_well_known_path():
    auth = _auth_module_with("https://example.supabase.co")
    assert auth._jwks_client is not None
    assert auth._jwks_client.uri == (
        "https://example.supabase.co/auth/v1/.well-known/jwks.json"
    )


def test_jwks_client_does_not_use_the_apikey_gated_path():
    auth = _auth_module_with("https://example.supabase.co")
    assert not auth._jwks_client.uri.endswith("/auth/v1/jwks")


def test_no_jwks_client_without_a_supabase_url():
    auth = _auth_module_with("")
    assert auth._jwks_client is None
```

**Verify:**

```bash
cd backend && python -m pytest tests/test_auth_jwks.py -v
```

Expected: 3 passed.

### Step 3 — Confirm nothing else regressed

```bash
cd backend && python -m pytest -q
```

Expected: all tests pass (338 at the time of writing, plus the 3 new ones).

The reload fixture in Step 2 mutates module state; if any *other* test starts
failing only when run after this file, that is the reload leaking — fix it by
making `_auth_module_with` restore the original module (it already reloads in
its `finally`), and report it in the execution note.

## STOP conditions

- **The new URL also returns 401, or returns something that is not a JWKS
  document.** Check with
  `curl -s -o /dev/null -w '%{http_code}\n' "$SUPABASE_URL/auth/v1/.well-known/jwks.json"`.
  If it is not 200, this project may be on legacy **symmetric** (HS256) signing,
  where there is no public key set at all and the httpx fallback is the only
  correct path. In that case: revert Step 1, and instead report that
  `_jwks_client` should be removed entirely rather than repointed.
- **The JWKS document's keys are not `ES256`.** `get_user_id` passes
  `algorithms=["ES256"]`. If the live key set advertises `RS256` instead, the
  decode will fail *after* key resolution — an `InvalidTokenError`, which is a
  hard 401 with **no fallback**, so every user would be locked out. Check
  `alg` in the fetched document before deploying. If it is not ES256, STOP and
  report: the algorithm list needs widening in the same change, and that is a
  decision worth stating out loud rather than slipping in.
- Any test outside `tests/test_auth_jwks.py` starts failing.

## Test plan

Automated (Step 2) covers the path itself. The behaviour this fixes is only
observable against a real Supabase project, so also do one manual check after
deploying:

1. Tail the Render log while loading any authenticated screen.
2. **Expected**: no `PyJWKClientConnectionError`, no
   `Local JWT verification unavailable` warning, and **no**
   `GET /auth/v1/user` line — local verification now resolves the key and the
   httpx fallback never runs.
3. Requests should also be measurably faster; two round trips to Supabase per
   request become zero after the first (PyJWKClient caches the key set).

## Maintenance note

`PyJWKClient` caches the key set in memory per process. When Supabase rotates
signing keys, an unknown `kid` triggers one automatic refresh — that is handled
inside the library and is the reason the `PyJWKClientError` branch exists
rather than being unreachable.

Watch in review: anyone "simplifying" this URL, and anyone widening the
`except jwt.InvalidTokenError` branch to also fall back. That branch existing
separately is what makes a signature failure a real rejection instead of a
second, slower rejection.
