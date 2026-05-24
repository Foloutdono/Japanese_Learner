from fastapi import APIRouter
router = APIRouter()

@router.get("/api/translations/kanji")
def get_kanji_translations(lang: str = "fr"):
    if lang == "fr":
        from translations.fr.kanji_fr import KANJI_FR
        return {
            "by_kanji": KANJI_FR,  # { "日": "soleil" }
        }
    return {"by_kanji": {}}

@router.get("/api/translations/vocab")
def get_vocab_translations(lang: str = "fr"):
    if lang == "fr":
        from translations.fr.vocab_fr import VOCAB_FR
        return {
            "by_kanji": VOCAB_FR,  # { "毎月": "chaque mois" }
        }
    return {"by_kanji": {}}