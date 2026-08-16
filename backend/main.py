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

from fastapi import FastAPI                                      # noqa: E402
from fastapi.middleware.cors import CORSMiddleware               # noqa: E402
from fastapi.staticfiles import StaticFiles                      # noqa: E402

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
from routes.daruma          import router as daruma_router
from routes.cosmetics       import router as cosmetics_router
from routes.exams           import router as exams_router

logging.basicConfig(level=logging.INFO)

app = FastAPI()

app.mount("/kanjivg", StaticFiles(directory="kanjivg"), name="kanjivg")

# Server-synthesized listening-section audio (study/exam_tts.py) --
# same mount pattern as kanjivg above. Directory is created on first
# use by exam_tts.py itself (os.makedirs), so it may not exist yet on a
# fresh checkout; check_dir=False lets StaticFiles mount successfully
# regardless and just 404 individual files until something's written.
app.mount("/exam-audio", StaticFiles(directory="datas/exam_audio", check_dir=False), name="exam-audio")

# ── CORS ──────────────────────────────────────────────────────
# The deployed frontend, plus anything CORS_ORIGINS adds — a
# comma-separated list, set in backend/.env so a local Vite server can
# be allowed without editing this file and without a localhost origin
# ever being hardcoded into the deployed list. Unset, which is the
# case in production, this is exactly the single-origin list it has
# always been.
CORS_ORIGINS = ["https://japanese-learner-seven.vercel.app"] + [
    o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

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
app.include_router(translation_router)
app.include_router(daruma_router)
app.include_router(cosmetics_router)
app.include_router(exams_router)

@app.get("/")
def root():
    return {"status": "ok"}