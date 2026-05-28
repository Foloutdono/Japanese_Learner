import random
from fastapi import APIRouter, Depends
from auth import get_user_id, prefixed, unprefixed
from srs_instance import srs
from backend.grammar_data import GRAMMAR_BY_LEVEL, grammar_to_id
from pydantic import BaseModel

router = APIRouter()

class ReviewPayload(BaseModel):
    card_id: str
    mode:    str
    quality: int


@router.get("/api/grammar/levels")
def get_grammar_levels():
    return {"levels": list(GRAMMAR_BY_LEVEL.keys())}


@router.get("/api/grammar/card")
def get_grammar_card(level: str, mode: str = "flashcard",
                     user_id: str = Depends(get_user_id)):
    grammar_list = GRAMMAR_BY_LEVEL.get(level)
    if not grammar_list:
        return {"error": "Unknown level"}

    raw_ids  = [grammar_to_id(g, level) for g in grammar_list]
    card_ids = prefixed(raw_ids, user_id)

    due = srs.get_due_cards(card_ids, mode)
    if due:
        card_id = random.choice(due)
    else:
        new = srs.get_new_cards(card_ids, mode, limit=1)
        if new:
            card_id = new[0]
        else:
            return {"done": True}

    raw_id = unprefixed(card_id, user_id)
    entry  = next(g for g in grammar_list if grammar_to_id(g, level) == raw_id)

    # MCQ: choose 3 wrong meanings + 1 correct
    all_meanings = [
        g["meaning"] for g in grammar_list
        if g["meaning"] != entry["meaning"]
    ]
    choices = random.sample(all_meanings, min(3, len(all_meanings))) + [entry["meaning"]]
    random.shuffle(choices)

    # Fill-in: pick a random example and blank out the grammar point
    fill_example = None
    if entry["examples"] and mode == "fill":
        ex = random.choice(entry["examples"])
        blanked = ex["jp"].replace(
            entry["grammar"].split('・')[0],
            '＿＿＿'
        )
        fill_example = {
            "jp_blanked": blanked,
            "jp_full":    ex["jp"],
            "romaji":     ex["romaji"],
            "en":         ex["en"],
        }

    return {
        "card_id":     raw_id,
        "grammar":     entry["grammar"],
        "meaning":     entry["meaning"],
        "explanation": entry["explanation"],
        "examples":    entry["examples"],
        "choices":     choices,
        "fill_example": fill_example,
        "mode":        mode,
    }


@router.post("/api/grammar/review")
def post_grammar_review(payload: ReviewPayload,
                        user_id: str = Depends(get_user_id)):
    card_id = f"{user_id}:{payload.card_id}"
    s = srs.review(card_id, payload.mode, payload.quality)
    return {"card_id": payload.card_id, "interval": s["interval"],
            "next_review": s["next_review"]}


@router.get("/api/grammar/stats")
def get_grammar_stats(user_id: str = Depends(get_user_id)):
    MODES = ["flashcard", "mcq", "fill"]
    result = {}
    for level, grammar_list in GRAMMAR_BY_LEVEL.items():
        raw_ids = [grammar_to_id(g, level) for g in grammar_list]
        result[level] = {
            mode: {
                "total":    len(raw_ids),
                "new":      sum(1 for s in srs.get_bulk_stats(prefixed(raw_ids, user_id), mode).values() if s == "new"),
                "learning": sum(1 for s in srs.get_bulk_stats(prefixed(raw_ids, user_id), mode).values() if s == "learning"),
                "mastered": sum(1 for s in srs.get_bulk_stats(prefixed(raw_ids, user_id), mode).values() if s == "mastered"),
                "due_now":  srs.get_due_count(prefixed(raw_ids, user_id), mode),
            }
            for mode in MODES
        }
    return result