# ── 札の帯 — the strip under a flip card's answer (plan 326) ────────
# A run asks once a batch for what its cards show under the answer
# (study/card_extras.py), the learner's choice read here, never sent:
# a bounded list of the batch's ids, the extras of the built-in vocab
# and kanji cards among them, nothing for any other.
from fastapi import APIRouter, Depends, Query

from core import learner_card_contents
from core.auth import get_user_id
from study.card_extras import extras_for, lang_of

router = APIRouter()

# A run's batch is ten cards, Today's a few more; never a deck at once.
MAX_IDS = 30


@router.get("/api/card-extras")
def get_card_extras(ids: str = Query(..., max_length=3000), lang: str = Query("en", max_length=8),
                    user_id: str = Depends(get_user_id)):
    chosen = learner_card_contents.read(user_id)
    if not any(chosen.values()):
        return {"extras": {}, "chosen": chosen}
    card_ids = list(dict.fromkeys(i for i in ids.split(",") if i))[:MAX_IDS]
    return {"extras": extras_for(card_ids, chosen, lang_of(lang)), "chosen": chosen}
