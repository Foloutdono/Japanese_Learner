# ── Read Japanese out of a photo ──────────────────────────────────
# The vision tier of the photo-input feature. Tesseract.js in the
# browser (frontend/src/lib/ocr.js) stays available as the offline,
# nothing-leaves-the-device option, but it is no longer the default:
# on real photographs it returns character soup, which is what this
# endpoint exists to fix. See docs/adr/0004's 2026-08 amendment and
# plans/023.
#
# The image is forwarded to the model and dropped. Nothing is written to
# disk or to the database except a per-user counter.
import base64
import logging
import os

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from core.auth import get_user_id
from core.db import db_conn
from study.llm_shared import chat, LLMUnavailable
from study.ocr_prompt import OCR_PROMPT, VERTICAL_HINT
from study.text_normalize import normalize_recognized_text

router = APIRouter()
logger = logging.getLogger(__name__)

# A phone photo is routinely 4-12 MB; the client downscales before
# upload (see plans/024). This is the backstop, not the expected size.
# frontend/src/lib/image.js's MAX_UPLOAD_BYTES must agree with this.
_MAX_IMAGE_BYTES = 8 * 1024 * 1024

# Nothing here costs money -- NVIDIA's vision models are on the free
# tier, same account as the text models. The resource being protected is
# that SHARED quota: one client in a retry loop degrades OCR for
# everyone and takes the analyzer's deep tier and exam generation down
# with it, since they draw on the same account. 60 images/day is far
# beyond real study use.
_DAILY_OCR_LIMIT = int(os.environ.get("OCR_DAILY_LIMIT", "60"))

# Magic bytes, because a client's declared content_type is a claim, not
# evidence. WebP is RIFF....WEBP, so it needs the second check.
_MAGIC = (
    (b"\xff\xd8\xff", "image/jpeg"),
    (b"\x89PNG\r\n\x1a\n", "image/png"),
)


def _sniff_image_type(raw: bytes) -> str | None:
    for prefix, mime in _MAGIC:
        if raw.startswith(prefix):
            return mime
    if raw[:4] == b"RIFF" and raw[8:12] == b"WEBP":
        return "image/webp"
    return None


def _ensure_ocr_schema() -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS ocr_usage (
                    user_id  TEXT NOT NULL,
                    day      DATE NOT NULL,
                    count    INTEGER NOT NULL DEFAULT 0,
                    PRIMARY KEY (user_id, day)
                )
            """)
        conn.commit()
    finally:
        conn.close()


try:
    _ensure_ocr_schema()
except Exception:  # pragma: no cover - a missing DB must not stop import
    logger.exception("ocr schema could not be initialised")


def _claim_daily_slot(user_id: str) -> int:
    """Increment today's counter and return the new value.

    Incremented BEFORE the model call on purpose: a failing call still
    costs a slot, because a client retrying a failure is exactly what a
    cap exists to stop."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO ocr_usage (user_id, day, count)
                VALUES (%s, CURRENT_DATE, 1)
                ON CONFLICT (user_id, day)
                DO UPDATE SET count = ocr_usage.count + 1
                RETURNING count
                """,
                (user_id,),
            )
            (count,) = cur.fetchone()
        conn.commit()
        return count
    finally:
        conn.close()


@router.post("/api/ocr")
async def recognize_image(
    file: UploadFile = File(...),
    vertical: str = Form("false"),
    user_id: str = Depends(get_user_id),
):
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="No image received")
    if len(raw) > _MAX_IMAGE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Image is too large (max {_MAX_IMAGE_BYTES // (1024 * 1024)} MB)",
        )

    mime = _sniff_image_type(raw)
    if mime is None:
        raise HTTPException(
            status_code=400, detail="Not a supported image (PNG, JPEG or WebP)"
        )

    used = _claim_daily_slot(user_id)
    if used > _DAILY_OCR_LIMIT:
        raise HTTPException(
            status_code=429,
            detail=f"Daily image limit reached ({_DAILY_OCR_LIMIT} per day)",
        )

    prompt = OCR_PROMPT
    if str(vertical).lower() in ("1", "true", "yes"):
        prompt += VERTICAL_HINT

    data_url = f"data:{mime};base64," + base64.b64encode(raw).decode("ascii")
    messages = [{
        "role": "user",
        "content": [
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": data_url}},
        ],
    }]

    try:
        content = chat(
            messages,
            timeout=90,
            max_tokens=1500,
            reasoning=False,
            vision=True,
        )
    except LLMUnavailable as e:
        logger.error("OCR has no usable vision provider: %s", e)
        raise HTTPException(
            status_code=503,
            detail="Image reading is unavailable right now. Please try again later.",
        )

    text = normalize_recognized_text(content or "")
    # `model` is deliberately NOT returned, though plan 023 asked for it:
    # chat() returns only the content string, and threading the winning
    # model back out would change its signature for every caller. It is
    # already logged ("Using model ...") at the point of choice, which is
    # where anyone diagnosing a quality regression would look anyway.
    return {"text": text, "chars": len(text)}
