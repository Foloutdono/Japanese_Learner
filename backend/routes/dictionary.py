from fastapi import APIRouter, Depends
from kanji_data import KANJI_BY_LEVEL, kanji_to_id
from vocab_data import VOCAB_BY_LEVEL, vocab_to_id
from translations import get_meaning
from translations.fr.kanji_fr import KANJI_FR
from translations.fr.vocab_fr import VOCAB_FR
from auth import get_user_id
from srs_instance import srs
from card_lookup import card_stats, VOCAB_STATUS_MODE, KANJI_STATUS_MODE

router = APIRouter()

KANJI_FR_MAP = KANJI_FR
VOCAB_FR_MAP = VOCAB_FR


@router.get("/api/dictionary")
def get_dictionary(q: str = "", page: int = 0, limit: int = 50, lang: str = "fr",
                    category: str = "all", user_id: str = Depends(get_user_id)):
    """
    category: "all" | "kanji" | "vocab" — lets the client avoid pulling in
    thousands of vocab entries when only kanji (or vice versa) are wanted.
    """
    matches = []  # (kind, level, entry, meaning) — cheap, no SRS lookups yet

    if category in ("all", "kanji"):
        for level, kanji_list in KANJI_BY_LEVEL.items():
            for k in kanji_list:
                meaning = get_meaning(k, lang, KANJI_FR_MAP)
                if q == "" or (
                    q in k.get("kanji", "") or
                    q in k.get("kana",  "") or
                    q.lower() in meaning.lower()
                ):
                    matches.append(("kanji", level, k, meaning))

    if category in ("all", "vocab"):
        for level, vocab_list in VOCAB_BY_LEVEL.items():
            for w in vocab_list:
                meaning = get_meaning(w, lang, VOCAB_FR_MAP)
                kanji_form = w.get("kanji", "")
                kana_form  = w.get("kana", "")
                if q == "" or (
                    q in kanji_form or
                    q in kana_form or
                    q.lower() in meaning.lower()
                ):
                    matches.append(("vocab", level, w, meaning))

    total        = len(matches)
    start        = page * limit
    end          = start + limit
    page_matches = matches[start:end]

    # Only fetch/annotate SRS progress for the page actually being returned.
    # get_user_states does one bulk fetch for the whole user; card_stats is
    # then a cheap in-memory lookup per entry.
    states = srs.get_user_states(user_id) if page_matches else {}

    results = []
    for kind, level, entry, meaning in page_matches:
        if kind == "kanji":
            raw_id    = kanji_to_id(entry, level)
            codepoint = hex(ord(entry["kanji"]))[2:].zfill(5)
            results.append({
                "type":         "kanji",
                "kanji":        entry["kanji"],
                "kana":         entry.get("kana", ""),
                "meaning":      meaning,
                "stroke_count": entry.get("stroke_count", ""),
                "level":        level,
                "svg_url":      f"/kanjivg/{codepoint}.svg",
                "status":       card_stats(states, user_id, raw_id, KANJI_STATUS_MODE),
            })
        else:
            raw_id = vocab_to_id(entry, level)
            results.append({
                "type":    "vocab",
                "kanji":   entry.get("kanji", ""),
                "kana":    entry.get("kana", ""),
                "meaning": meaning,
                "level":   level,
                "status":  card_stats(states, user_id, raw_id, VOCAB_STATUS_MODE),
            })

    return {
        "results":  results,
        "total":    total,
        "page":     page,
        "limit":    limit,
        "has_more": end < total,
    }