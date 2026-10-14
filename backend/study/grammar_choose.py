"""
Choisir on a point the contrast drill cannot be drawn on (plan 201).

The contrast drill (plan 087, 190) blanks the point out of a sentence its
author marked and offers the point's rivals as the choices. That needs the
matcher to find the point, or the detector to find it once, on one piece,
and an author who dared to mark a sentence in which every rival is wrong.
Forty-one points had none of the three: は, も, です／だ, ない形, 〜ば,
〜て（理由）... a particle every sentence shares with its rivals, a form
whose letters are every verb's, a cause the detector cannot tell from a
sequence. Their Choisir steps quietly fell back to the flashcard
(srs/ladder.py's chain), so a learner on Choisir 2/3 of です／だ was shown
a card with no choices at all.

A point of that kind is asked from its own `choose` list instead, written
by hand like the tour's quiz, which it is modelled on:

    {"jp": "あれは学校＿＿＿。",                # the blank, ＿＿＿, once
     "tr": {"en": "…", "fr": "…"},             # what the whole sentence says
     "choices": ["です", "あります", "ます"],    # three or four fillings, the RIGHT ONE FIRST
     "why": {"en": "…", "fr": "…"}}            # said when a wrong one is taken

It is the tour's `form` question without its `ask` -- the choices are what
fills the hole, not catalogue points -- so an item pins the answer by what
the sentence says (`tr` is printed under it, Choisir's own front) and by
the grammar around the hole, never by a rival nobody could say. The fillings
are Japanese forms, which is also why none of this needs the detector or the
stems: the author says where the point is by where the hole is, and
study/grammar_check.py holds that the detector agrees.

The payload is the contrast drill's own (`study/grammar_lesson.contrast_
payload`), so the run draws it unchanged, plus what a filling that is not a
catalogue pattern needs:

    jp         the whole sentence, the right filling in the hole
    tr         its translation, in the learner's language
    furigana   the sentence's parts with the hole as one blank part
    fill       the parts of the right filling, as it stands in the sentence
               (the card turns to them: the hole holding the right form)
    choices    the fillings, shuffled
    answer     the right filling -- the run compares a tile to it
    why        {wrong filling: the item's line}
    readings   {filling: parts} for a filling with kanji, which the tiles
               print as ruby (sent as the card's `choices_furigana`)
"""
import copy
import random
from functools import lru_cache

from content.grammar_points_data import localise
from study.grammar_examples import BLANK
from study.grammar_tour import _parts

# A question offers three fillings, or four where there are four slips worth
# offering. Two would be a coin toss, five is a wall of tiles.
CHOICES = (3, 4)
# What a point with a `choose` list must carry: the three steps of Choisir,
# each asked on another sentence.
MIN_ITEMS = 3


def choose_items(entry: dict) -> list[dict]:
    """The point's authored Choisir questions, in the order written."""
    return list(entry.get("choose") or [])


def fillings_of(item: dict) -> list[str]:
    return list(item["choices"])


def cut(jp: str, filling: str) -> tuple[list[dict], list[dict]] | None:
    """(the sentence's parts with the hole, the parts of the filling) for
    `filling` standing in `jp`'s blank; None when the hole does not fall on
    whole parts -- a ruby part is never cut, so a filling that starts or
    ends inside a kanji word's reading would blank more than it says.

    The parts are read from the sentence as it stands filled, so a kanji is
    read as the tokenizer reads it in its sentence, never as a fragment."""
    at = jp.index(BLANK)
    filled = jp.replace(BLANK, filling, 1)
    parts = _parts(filled, [(at, at + len(filling))])
    marked = [p for p in parts if p.get("highlight")]
    if "".join(p["text"] for p in marked) != filling:
        return None
    question: list[dict] = []
    for part in parts:
        if not part.get("highlight"):
            question.append(part)
        elif not (question and question[-1].get("blank")):
            question.append({"text": BLANK, "blank": True})
    return question, [{k: v for k, v in p.items() if k != "highlight"} for p in marked]


@lru_cache(maxsize=2048)
def _shape(jp: str, choices: tuple[str, ...]) -> dict | None:
    """What an item draws from its sentence alone, not its language: the
    hole, the right filling's parts and the ruby of every filling that has
    kanji. Tokenizing is the cost, so it is asked once per item."""
    got = cut(jp, choices[0])
    if got is None:
        return None
    question, fill = got
    readings = {}
    for filling in choices:
        parts = cut(jp, filling)
        if parts is not None and any(p.get("reading") for p in parts[1]):
            readings[filling] = parts[1]
    return {"furigana": question, "fill": fill, "readings": readings}


def choose_payload(level: str, entry: dict, item: dict, lang: str,
                   rng: random.Random | None = None) -> dict | None:
    """The contrast drill's payload for one authored item, or None where
    its hole cannot be drawn (the gate keeps that off a committed
    catalogue; None is for the moment between an edit and its test)."""
    rng = rng or random
    shape = _shape(item["jp"], tuple(item["choices"]))
    if shape is None:
        return None
    right, wrong = item["choices"][0], item["choices"][1:]
    why = localise(item["why"], lang)
    choices = list(item["choices"])
    rng.shuffle(choices)
    return {
        "jp": item["jp"].replace(BLANK, right, 1),
        "tr": localise(item["tr"], lang),
        "furigana": copy.deepcopy(shape["furigana"]),
        "fill": copy.deepcopy(shape["fill"]),
        "choices": choices,
        "answer": right,
        "why": {w: why for w in wrong},
        "readings": copy.deepcopy(shape["readings"]),
    }
