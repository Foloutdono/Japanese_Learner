"""POST /api/events — the 足跡 ingest.

A batch, because the client queues (lib/track.js) and flushes on a
timer, on twenty, and on the page going away. Deliberately thin: the
closed name set, the property allowlist and the timestamp clamp all
live in core/events.py, so the server applies exactly the rules the
frontend claims to, rather than trusting that it did.

Answers 202 with a count, never an error a client could act on. A
learner whose study session broke because their analytics batch was
malformed would be the worst possible trade, so a bad row is dropped
and the good ones are kept.
"""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from core import events
from core.auth import get_user_id
from core.db import db_conn

router = APIRouter()
logger = logging.getLogger(__name__)


class Event(BaseModel):
    name: str
    at: str | None = None
    props: dict = Field(default_factory=dict)


class Batch(BaseModel):
    events: list[Event] = Field(default_factory=list)


@router.post("/api/events", status_code=202)
def post_events(batch: Batch, user_id: str = Depends(get_user_id)):
    now = datetime.now(timezone.utc)
    rows = []
    for item in batch.events[: events.MAX_BATCH]:
        props = events.clean(item.name, item.props)
        if props is None:
            # An unknown name is a client running an older or newer
            # build than this server, which is normal during a deploy --
            # counted, not logged per row.
            continue
        rows.append((item.name, props, events.clean_at(item.at, now)))

    if not rows:
        return {"kept": 0}

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            kept = events.write(cur, user_id, rows)
        conn.commit()
    except Exception:
        conn.rollback()
        # Swallowed on purpose: the client has already moved on, and a
        # 500 here would make lib/track.js retry a batch that will fail
        # again the same way.
        logger.exception("events: batch of %d could not be written", len(rows))
        return {"kept": 0}
    finally:
        conn.close()
    return {"kept": kept}
