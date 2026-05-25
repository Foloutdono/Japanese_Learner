from fastapi import APIRouter, HTTPException

router = APIRouter()


def _load_translation_map(lang: str, item_type: str) -> dict:
    if lang == "fr":
        if item_type == "kanji":
            from translations.fr.kanji_fr import KANJI_FR
            return KANJI_FR
        if item_type == "vocab":
            from translations.fr.vocab_fr import VOCAB_FR
            return VOCAB_FR

    if lang == "en":
        if item_type == "kanji":
            from kanji_data import KANJI_BY_LEVEL
            return {
                entry["kanji"]: entry.get("meaning", "")
                for level_list in KANJI_BY_LEVEL.values()
                for entry in level_list
                if entry.get("kanji")
            }

        if item_type == "vocab":
            from vocab_data import VOCAB_BY_LEVEL
            return {
                key: entry.get("meaning", "")
                for level_list in VOCAB_BY_LEVEL.values()
                for entry in level_list
                for key in [entry.get("kanji"), entry.get("kana")]
                if key
            }

    raise HTTPException(status_code=400, detail=f"Unsupported language: {lang}")


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

@router.get("/api/translation/vocab")
def get_vocab_translation(word: str, lang: str = "fr"):
    if not word:
        raise HTTPException(status_code=400, detail="Query parameter 'word' is required")

    translations = _load_translation_map(lang, "vocab")
    return {
        "word": word,
        "lang": lang,
        "translation": translations.get(word, ""),
    }