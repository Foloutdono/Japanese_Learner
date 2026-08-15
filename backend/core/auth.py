import os
import httpx
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

SUPABASE_URL         = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

# ── Local development ─────────────────────────────────────────
# Identity comes from an HTTP round trip to Supabase on every request,
# so a fresh checkout cannot serve a single authenticated route
# without production credentials — and the credential it would need is
# SUPABASE_SERVICE_KEY, the one that bypasses row-level security on
# the entire project. Nobody should be copying that onto a laptop to
# look at a layout.
#
# DEV_USER_ID removes the requirement: when it is set, every request
# is that user and no token is read at all. Three things keep it from
# becoming a production hole:
#
#   - it is opt-in via a variable that simply does not exist in a
#     deployed environment, rather than a default that has to be
#     turned off;
#   - it announces itself on every start (below), so an instance
#     running without auth cannot be quietly mistaken for one with it;
#   - it changes nothing about the path taken when it is unset — the
#     token check below is the same code it always was.
DEV_USER_ID = os.environ.get("DEV_USER_ID")

if DEV_USER_ID:
    print(
        "\n" + "!" * 70
        # ASCII only: cmd.exe is cp1252 and turns an em dash into "?",
        # which is not what a security warning should look like.
        + f"\n!!  AUTH DISABLED - DEV_USER_ID is set ({DEV_USER_ID!r})."
        + "\n!!  Every request is treated as this user; no token is verified."
        + "\n!!  This must never be set on a deployed instance."
        + "\n" + "!" * 70 + "\n",
        flush=True,
    )

# auto_error=False so that a request carrying no Authorization header
# reaches get_user_id instead of being rejected by the dependency
# itself — in dev mode there is no token to send, and HTTPBearer would
# turn that into a 403 before any of the logic below ran. Without a
# DEV_USER_ID the very next line still rejects it.
security = HTTPBearer(auto_error=False)

def get_user_id(credentials: HTTPAuthorizationCredentials | None = Depends(security)) -> str:
    if DEV_USER_ID:
        return DEV_USER_ID

    if credentials is None:
        raise HTTPException(status_code=401, detail="Missing token")

    token = credentials.credentials
    try:
        response = httpx.get(
            f"{SUPABASE_URL}/auth/v1/user",
            headers={
                "Authorization": f"Bearer {token}",
                "apikey":        SUPABASE_SERVICE_KEY,
            }
        )
        if response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid token")
        user_id = response.json().get("id")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except httpx.RequestError:
        raise HTTPException(status_code=401, detail="Auth service unavailable")

def prefixed(card_ids: list[str], user_id: str) -> list[str]:
    return [f"{user_id}:{cid}" for cid in card_ids]

def unprefixed(card_id: str, user_id: str) -> str:
    prefix = f"{user_id}:"
    return card_id[len(prefix):] if card_id.startswith(prefix) else card_id