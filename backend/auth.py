import os
import httpx
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

SUPABASE_URL         = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

security = HTTPBearer()

def get_user_id(credentials: HTTPAuthorizationCredentials = Depends(security)) -> str:
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