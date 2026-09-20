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
from core.credits import require_pass

from core.auth import get_user_id
from core.credits import local_today, next_refill_at
from core.db import db_conn
from study.llm_shared import chat, LLMUnavailable
from study.ocr_prompt import OCR_PROMPT, VERTICAL_HINT
from study.text_normalize import normalize_recognized_text

# A pass feature (plan 069): every route here refuses a free learner
# with 402 pass_required once CREDITS_ENFORCE=1; a no-op until then.
router = APIRouter(dependencies=[Depends(require_pass)])
logger = logging.getLogger(__name__)

# A phone photo is routinely 4-12 MB; the client downscales before
# upload (see plans/024). This is the backstop, not the expected size.
# frontend/src/lib/image.js's MAX_UPLOAD_BYTES must agree with this.
_MAX_IMAGE_BYTES = 8 * 1024 * 1024

# ── What the cap is for, and why the number moved ───────────────
# It used to be 60, and the reason given was that nothing here cost
# money: the vision models were on a free tier, and what a runaway
# client threatened was the SHARED quota the text models drew on too.
# That stopped being true when the app went paid (plan 092) -- vision
# now goes to Google first, and every image is billed. The resource
# being protected is the bill.
#
# An image is roughly 1,400 input tokens plus the prompt, and a few
# hundred out. At 60 a day that is 1,800 images a month from ONE
# learner: several dollars against a subscription of a few, which is
# not a ceiling, it is a hole. See docs/llm-commercial-plan.md's
# "abuse ceiling" row.
#
# 20 rather than the 10-15 that document proposed. 10 would stop being
# an abuse ceiling and start being a product limit: a learner reading
# a manga chapter photographs it page by page, and a chapter is more
# than ten pages. 20 covers a real session and still cuts the worst
# case by two thirds. It is env-overridable precisely because the right
# number is a measurement nobody has yet -- ocr_usage has the data.
_DAILY_OCR_LIMIT = int(os.environ.get("OCR_DAILY_LIMIT", "20"))

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
    cap exists to stop.

    "Today" is the LEARNER's, not the server's -- core/credits.py's own
    rule, and the same helper. It was CURRENT_DATE (the server's clock,
    UTC in every deployment) while the cap was 60 and nobody reached
    it. At 20 the boundary decides whether someone can study in the
    evening: a learner in Tokyo crosses into the next UTC day at 09:00
    local, so a UTC cap would hand them a fresh allowance mid-morning
    and none at all after dinner. It also makes the message the screen
    already shows -- "You've hit today's image limit. Try again
    tomorrow." -- true, which it was not before.

    A learner with no profile row, or none that has reported an offset
    yet, falls back to UTC exactly as local_today does."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT tz_offset_min FROM user_profiles WHERE user_id = %s",
                (user_id,),
            )
            row = cur.fetchone()
            cur.execute(
                """
                INSERT INTO ocr_usage (user_id, day, count)
                VALUES (%s, %s, 1)
                ON CONFLICT (user_id, day)
                DO UPDATE SET count = ocr_usage.count + 1
                RETURNING count
                """,
                (user_id, local_today(row[0] if row else None)),
            )
            (count,) = cur.fetchone()
        conn.commit()
        return count
    finally:
        conn.close()


def _resets_at(user_id: str):
    """When this learner's allowance comes back, as a UTC instant.

    A second query, on the refusal path only: the claim above already
    read the offset, but threading it out would change that function's
    return for the sake of a string nobody reads on the happy path."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT tz_offset_min FROM user_profiles WHERE user_id = %s",
                (user_id,),
            )
            row = cur.fetchone()
        return next_refill_at(row[0] if row else None)
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
        # The screen shows its own localized line for a 429 (the
        # frontend's `ocrLimitReached`), so this detail is for the log
        # and for whoever is asked why a learner is being refused. The
        # reset instant is the part that cannot be worked out from the
        # outside, now that the day is the learner's rather than UTC's.
        raise HTTPException(
            status_code=429,
            detail=(f"Daily image limit reached ({_DAILY_OCR_LIMIT} per day); "
                    f"resets {_resets_at(user_id):%Y-%m-%dT%H:%MZ}"),
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
            task="ocr",
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
