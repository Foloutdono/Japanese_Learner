"""
POST/DELETE /api/release/notice -- the release workflow announces itself
(plan 264, core/release_notice.py).

Called by .github/workflows/promote.yml alone, before it pushes to
`production` (POST, `in_minutes`) and when that push fails (DELETE). It
carries `X-Release-Token`, held equal to RELEASE_NOTICE_TOKEN in the
backend's environment and the repository's secret of the same name.
Without the variable the route answers 404, as though it were not there:
nothing a learner can call moves the notice.
"""
import hmac
import os
import time

from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel, Field

from core import release_notice

router = APIRouter()

MAX_MINUTES = 60


class Notice(BaseModel):
    in_minutes: int = Field(ge=0, le=MAX_MINUTES)


def _check(token: str | None) -> None:
    expected = os.environ.get("RELEASE_NOTICE_TOKEN", "")
    if not expected:
        raise HTTPException(status_code=404)
    if not token or not hmac.compare_digest(token.encode(), expected.encode()):
        raise HTTPException(status_code=403)


@router.post("/api/release/notice")
async def announce(body: Notice, x_release_token: str | None = Header(default=None, max_length=200)):
    _check(x_release_token)
    release_notice.announce(time.time() + body.in_minutes * 60)
    return {"at": release_notice.current()}


@router.delete("/api/release/notice")
async def clear(x_release_token: str | None = Header(default=None, max_length=200)):
    _check(x_release_token)
    release_notice.clear()
    return {"at": None}
