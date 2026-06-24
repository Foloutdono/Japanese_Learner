import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from routes.kana            import router as kana_router
from routes.vocab           import router as vocab_router
from routes.kanji           import router as kanji_router
from routes.stats           import router as stats_router
from routes.dictionary      import router as dictionary_router
from routes.decks           import router as decks_router
from routes.translations    import router as translations_router
from routes.grammar         import router as grammar_router
from routes.phrase           import router as phrase_router

logging.basicConfig(level=logging.INFO)

app = FastAPI()

app.mount("/kanjivg", StaticFiles(directory="kanjivg"), name="kanjivg")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://japanese-learner-seven.vercel.app"],
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

@app.get("/")
def root():
    return {"status": "ok"}