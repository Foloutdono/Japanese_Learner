import logging
import os
from pathlib import Path

# ── Local environment ─────────────────────────────────────────
# Nothing else reads backend/.env, so without this the file is purely
# decorative: DATABASE_URL comes back None and psycopg2 falls through
# to libpq's own defaults (localhost:5432), which is a confusing way
# to be told your configuration was never loaded — the error names a
# server you never configured rather than the setting you did.
#
# This has to run before the route imports below. core/srs_instance.py
# opens a connection pool at import time and core/auth.py reads its
# variables the same way, so by the time the first `from routes...`
# line executes the environment must already be complete.
#
# override=False (the default) leaves a real deployment untouched:
# there the variables are already in the process environment and no
# .env file exists, so this call does nothing at all.
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

from fastapi import FastAPI
from fastapi.responses import JSONResponse                                      # noqa: E402
from fastapi.middleware.cors import CORSMiddleware               # noqa: E402
from fastapi.middleware.gzip import GZipMiddleware               # noqa: E402
from fastapi.staticfiles import StaticFiles                      # noqa: E402
from starlette.concurrency import run_in_threadpool               # noqa: E402
from starlette.exceptions import HTTPException as StarletteHTTPException  # noqa: E402

from study.exam_tts import audio_dir                              # noqa: E402
from study.exam_audio_repair import restore_clip                  # noqa: E402

from routes.kana            import router as kana_router         # noqa: E402
from routes.vocab           import router as vocab_router
from routes.kanji           import router as kanji_router
from routes.stats           import router as stats_router
from routes.dictionary      import router as dictionary_router
from routes.decks           import router as decks_router
from routes.translations    import router as translations_router
from routes.grammar         import router as grammar_router
from routes.phrase           import router as phrase_router
from routes.reading          import router as reading_router
from routes.profile          import router as profile_router
from routes.frequency       import router as frequency_router
from routes.theme_vocab      import router as theme_vocab_router
from routes.translation import router as translation_router
from routes.exams           import router as exams_router
from routes.today           import router as today_router
from routes.video           import router as video_router
from routes.ocr             import router as ocr_router
from routes.onboarding      import router as onboarding_router
from routes.journey         import router as journey_router
from routes.account         import router as account_router
from routes.credits         import router as credits_router
from core.credits import OutOfCredits, PassRequired, LimitReached

logging.basicConfig(level=logging.INFO)

app = FastAPI()

app.mount("/kanjivg", StaticFiles(directory="kanjivg"), name="kanjivg")

# Server-synthesized listening-section audio (study/exam_tts.py) --
# same mount pattern as kanjivg above, with two differences this
# directory has earned the hard way.
#
# The directory comes from exam_tts.audio_dir() rather than being read
# out of the environment a second time here: it is the same resolution
# the writer uses, fallbacks included, so files can never be served from
# a place nothing writes to. (That split -- a __file__-relative writer
# and a cwd-relative mount -- was the original bug; re-reading
# EXAM_AUDIO_DIR here fixed it only until the writer started falling
# back off an unwritable disk.)
#
# check_dir=False alone is NOT enough to survive a missing directory,
# which is the trap this hit in production: it only silences the
# constructor. StaticFiles.check_config() re-stats the directory on the
# FIRST REQUEST and raises RuntimeError, which surfaces as a 500 on an
# <audio> element -- so an unmounted disk turned every clip request into
# a server error instead of a 404. Both are needed.
class ExamAudioFiles(StaticFiles):
    """A missing directory is a 404, and a missing FILE gets one chance
    to be re-synthesized from the paper that references it (see
    study/exam_audio_repair.py) before becoming one."""

    async def check_config(self) -> None:
        return

    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as exc:
            if exc.status_code != 404:
                raise
            # Synthesis is blocking network I/O, and this is an async
            # method: off the event loop it goes, like every other
            # blocking call FastAPI makes on our behalf.
            if not await run_in_threadpool(restore_clip, path):
                raise
            return await super().get_response(path, scope)


app.mount("/exam-audio", ExamAudioFiles(directory=audio_dir(), check_dir=False), name="exam-audio")

# ── CORS ──────────────────────────────────────────────────────
# The deployed frontend, plus anything CORS_ORIGINS adds — a
# comma-separated list, set in backend/.env so a local Vite server can
# be allowed without editing this file and without a localhost origin
# ever being hardcoded into the deployed list. Unset, which is the
# case in production, this is exactly the single-origin list it has
# always been.
#
# The native shell's own WebView origins (plan 066, ADR 0008) — hardcoded
# like the Vercel origin rather than fed through CORS_ORIGINS: they are
# what the shipped app IS, not a per-machine allowance, and a dashboard
# variable is exactly the invisible state the 2026-09-01 outage taught
# this repo to avoid. Neither is reachable by a browser page an attacker
# controls in any useful way — capacitor:// is not a navigable scheme,
# https://localhost names the user's own machine — and auth is a bearer
# header, never a cookie (allow_credentials stays off), so listing them
# widens nothing. Starlette matches Origin by exact string, so the
# scheme has to be spelled exactly as the WebView sends it.
NATIVE_ORIGINS = ["capacitor://localhost", "https://localhost"]

CORS_ORIGINS = ["https://japanese-learner-seven.vercel.app", *NATIVE_ORIGINS] + [
    o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# The translation maps (/api/translations/*) are the whole kanji and
# vocab meaning tables, pulled on every cold load by
# frontend/src/lib/translationCache.js, and nothing in front of this
# process compresses them. On a phone that is the single largest
# transfer of a session. Small responses stay as they are.
app.add_middleware(GZipMiddleware, minimum_size=1024)

app.include_router(kana_router)
app.include_router(vocab_router)
app.include_router(kanji_router)
app.include_router(stats_router)
app.include_router(dictionary_router)
app.include_router(decks_router)
app.include_router(translations_router)
app.include_router(grammar_router)
app.include_router(phrase_router)
app.include_router(reading_router)
app.include_router(profile_router)
app.include_router(frequency_router)
app.include_router(theme_vocab_router)
app.include_router(today_router)
app.include_router(translation_router)
app.include_router(exams_router)
app.include_router(video_router)
app.include_router(ocr_router)
app.include_router(onboarding_router)
app.include_router(credits_router)


# ── 402 — the fare gate's three refusals (plan 069) ──
# Flat bodies, not HTTPException's {"detail": {...}}: the client reads
# `detail` as the code and the figures beside it. All three are dormant
# until CREDITS_ENFORCE=1 (core/credits.py).
@app.exception_handler(OutOfCredits)
async def _out_of_credits(request, exc: OutOfCredits):
    return JSONResponse(status_code=402, content={
        "detail": "out_of_credits", "balance": exc.balance, "refillAt": exc.refill_at,
    })


@app.exception_handler(PassRequired)
async def _pass_required(request, exc: PassRequired):
    return JSONResponse(status_code=402, content={"detail": "pass_required"})


@app.exception_handler(LimitReached)
async def _limit_reached(request, exc: LimitReached):
    return JSONResponse(status_code=402, content={
        "detail": "limit_reached", "what": exc.what, "limit": exc.limit,
    })
app.include_router(journey_router)
app.include_router(account_router)

@app.get("/")
def root():
    return {"status": "ok"}