# ── Read Japanese out of a photo ──────────────────────────────────
# The vision tier of the photo-input feature. Tesseract.js in the
# browser (frontend/src/lib/ocr.js) stays available as the offline,
# nothing-leaves-the-device option, but it is no longer the default:
# on real photographs it returns character soup, which is what this
# endpoint exists to fix. See docs/adr/0004's 2026-08 amendment and
# plans/023.
#
# The image is forwarded to the model and dropped. Nothing is written to
# disk or to the database except a per-user counter (core/daily_limit.py).
import base64
import logging
import os

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from core import daily_limit
from core.auth import get_user_id
from core.credits import require_pass, resets_at
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
# number is a measurement nobody has yet -- daily_usage has the data
# (feature 'ocr').
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


# The cap counts in core/daily_limit.py's daily_usage under OCR_FEATURE
# (plan 320), on the learner's own day. It had a table of its own,
# ocr_usage, written before the shared counter existed;
# scripts/migrate_daily_usage.py folds its rows into daily_usage and
# drops it. One rule changed with the move: a database error now counts
# as under the cap (claim fails open) where the old counter raised a
# 500. A hiccup refusing a scan the learner is entitled to is the worse
# failure, and a pool that ran dry still refuses (PoolBusy, a 503).
OCR_FEATURE = "ocr"


# A plain def, so FastAPI runs it on the threadpool (plan 211): as an
# async def, its daily claim and its vision call (up to 90s a try, two
# tries a provider) ran on the event loop and held the whole API -- one
# worker -- for as long. Read bounded: the size check below needs no
# more than one byte past the limit.
@router.post("/api/ocr")
def recognize_image(
    file: UploadFile = File(...),
    vertical: str = Form("false"),
    user_id: str = Depends(get_user_id),
):
    raw = file.file.read(_MAX_IMAGE_BYTES + 1)
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

    used = daily_limit.claim(user_id, OCR_FEATURE, _DAILY_OCR_LIMIT)
    if used > _DAILY_OCR_LIMIT:
        # The screen shows its own localized line for a 429 (the
        # frontend's `ocrLimitReached`), so this detail is for the log
        # and for whoever is asked why a learner is being refused. The
        # reset instant is the part that cannot be worked out from the
        # outside, now that the day is the learner's rather than UTC's.
        raise HTTPException(
            status_code=429,
            detail=(f"Daily image limit reached ({_DAILY_OCR_LIMIT} per day); "
                    f"resets {resets_at(user_id):%Y-%m-%dT%H:%MZ}"),
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

    # An outage nobody billed gives the slot back (the 503's cause is
    # the LLMUnavailable, which refund_unbilled reads).
    with daily_limit.refund_unbilled(user_id, OCR_FEATURE):
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
            ) from e

    text = normalize_recognized_text(content or "")
    # `model` is deliberately NOT returned, though plan 023 asked for it:
    # chat() returns only the content string, and threading the winning
    # model back out would change its signature for every caller. It is
    # already logged ("Using model ...") at the point of choice, which is
    # where anyone diagnosing a quality regression would look anyway.
    return {"text": text, "chars": len(text)}
