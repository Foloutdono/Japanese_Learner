from fastapi import APIRouter
from kanji_data import KANJI_BY_LEVEL
from translations import get_meaning
from translations.fr.kanji_fr import KANJI_FR

router = APIRouter()

FR_MAP = KANJI_FR


@router.get("/api/dictionary")
def get_dictionary(q: str = "", page: int = 0, limit: int = 50, lang: str = "fr"):
    all_results = []
    for level, kanji_list in KANJI_BY_LEVEL.items():
        for k in kanji_list:
            meaning = get_meaning(k, lang, FR_MAP)
            if q == "" or (
                q in k.get("kanji", "") or
                q in k.get("kana",  "") or
                q.lower() in meaning.lower()
            ):
                codepoint = hex(ord(k["kanji"]))[2:].zfill(5)
                all_results.append({
                    "kanji":        k["kanji"],
                    "kana":         k.get("kana", ""),
                    "meaning":      meaning,
                    "stroke_count": k.get("stroke_count", ""),
                    "level":        level,
                    "svg_url":      f"/kanjivg/{codepoint}.svg",
                })

    total        = len(all_results)
    start        = page * limit
    end          = start + limit
    page_results = all_results[start:end]

    return {
        "results":  page_results,
        "total":    total,
        "page":     page,
        "limit":    limit,
        "has_more": end < total,
    }