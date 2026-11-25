from functools import lru_cache

from fastapi import APIRouter, HTTPException, Query

import translations

router = APIRouter()


# Cached: the English maps are built by walking the whole deck, and the
# per-word routes below would otherwise rebuild one for every word asked.
# The content is fixed for the life of the process. A language the app
# does not speak raises, so it is never cached.
@lru_cache(maxsize=2 * len(translations.SPOKEN))
def _load_translation_map(lang: str, item_type: str) -> dict:
    if lang == "fr":
        if item_type == "kanji":
            from content.kanji_meanings import KANJI_FR
            return KANJI_FR
        if item_type == "vocab":
            from translations.fr.vocab_fr import VOCAB_FR
            return VOCAB_FR

    # English, and every other language the app speaks (Spanish since plan
    # 302; any since plan 312) walked the same way: a card a language has
    # no line for yet carries its English, as get_meaning serves it, so the
    # map the client swaps meanings from never blanks a card.
    if lang in translations.SPOKEN:
        from translations import get_meaning
        from translations.course import KANJI_GLOSSES, VOCAB_GLOSSES

        if item_type == "kanji":
            from content.kanji_data import KANJI_BY_LEVEL
            return {
                entry["kanji"]: get_meaning(entry, lang, KANJI_GLOSSES)
                for level_list in KANJI_BY_LEVEL.values()
                for entry in level_list
                if entry.get("kanji")
            }

        if item_type == "vocab":
            from content.vocab_data import VOCAB_BY_LEVEL
            return {
                key: get_meaning(entry, lang, VOCAB_GLOSSES)
                for level_list in VOCAB_BY_LEVEL.values()
                for entry in level_list
                for key in [entry.get("kanji"), entry.get("kana")]
                if key
            }

    raise HTTPException(status_code=400, detail=f"Unsupported language: {lang}")


# ── Bulk maps ─────────────────────────────────────────────
# Used by the frontend's translationCache.js / LangContext to preload
# the full { word: meaning } map for a language once per session,
# instead of round-tripping per word. These were missing entirely —
# the frontend was calling them on every page load and always hitting
# a 404, while the per-word routes below (singular "/translation/")
# only cover the lang-switch-mid-quiz case (KanjiScreen/VocabScreen's
# translateCard), which needs one word at a time, not the full map.
@router.get("/api/translations/kanji")
def get_kanji_translations(lang: str = "fr"):
    return _load_translation_map(lang, "kanji")


@router.get("/api/translations/vocab")
def get_vocab_translations(lang: str = "fr"):
    return _load_translation_map(lang, "vocab")


# ── Per-word lookup ───────────────────────────────────────
@router.get("/api/translation/kanji")
def get_kanji_translation(word: str, lang: str = "fr"):
    if not word:
        raise HTTPException(status_code=400, detail="Query parameter 'word' is required")

    translations = _load_translation_map(lang, "kanji")
    return {
        "word": word,
        "lang": lang,
        "translation": translations.get(word, ""),
    }

# Each deck card's own gloss, keyed by its written form and its kana:
# 148 written forms are several cards (後 is あと, うしろ, ご and のち), and
# the map by written form holds one of them, so a run switching language
# mid-card would hand the card another card's gloss (plan 302's review).
@lru_cache(maxsize=3)
def _card_glosses(lang: str) -> dict:
    from content.vocab_data import VOCAB_BY_LEVEL
    from translations import get_meaning
    from translations.course import VOCAB_GLOSSES
    return {
        f"{entry.get('kanji') or entry['kana']}::{entry['kana']}": get_meaning(entry, lang, VOCAB_GLOSSES)
        for level_list in VOCAB_BY_LEVEL.values()
        for entry in level_list
    }


@router.get("/api/translation/vocab")
def get_vocab_translation(word: str, lang: str = "fr", kana: str = Query("", max_length=40)):
    if not word:
        raise HTTPException(status_code=400, detail="Query parameter 'word' is required")

    translations = _load_translation_map(lang, "vocab")
    own = _card_glosses(lang).get(f"{word}::{kana}") if kana else None
    return {
        "word": word,
        "lang": lang,
        "translation": own or translations.get(word, ""),
    }