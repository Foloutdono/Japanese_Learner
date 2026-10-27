"""
対戦 — the sprint's questions (plan 276).

A duel is a sprint: sixty seconds of quick questions, the same ones in
the same order for both players, built once from a seed at the lower
JLPT level of the two and stored with the duel. Three kinds, mixed in a
fixed pattern so the eye cannot settle:

  word     a word (with its reading) -> what it means, four meanings in
           the learner's language
  reading  a word written in kanji -> its reading (the mock exam's
           漢字読み)
  writing  a word in kana -> its spelling in kanji (the exam's 表記),
           never at N1, where the exam asks none

Grammar and sentences are not asked: a sentence is not read in six
seconds.

build_paper is a pure function of (seed, level, content): no model, no
database, and nothing that iterates a set before a seeded random touches
it, so the same paper comes back in any process (the placement test's
rule, tests/test_duel_paper.py builds it under two hash seeds).

The guards are the exam's, for the reason the exam has them: a choice
must be told apart by understanding, never by its look.

  - word: the three wrong meanings are words of the same category (a
    verb's « to … » among nouns is found without reading), share no
    content word with the right one, have the same gloss shape, and a
    length near the right one's in both languages; the word is shown in
    kana when it is written with a kanji the level has not taught.
  - reading, writing: study/exam_kanji_choices' own builders, under the
    duel's seed -- the readings the course's words give a kanji, a
    symmetric set, the key neither the centre nor the outlier.
  - over many papers (the tests): the longest and the shortest choice
    win no more than a blind pick would (exam_seed.LENGTH_TELL), the
    keys spread over the four slots without stepping through them.

PAPER_REV is the output's revision (CLAUDE.md, "Bump the revision when
the output changes"): a duel stores the paper it was built with, and the
rev it was built under.
"""
from __future__ import annotations

import random
import re
from functools import lru_cache

from content.vocab_data import VOCAB_BY_LEVEL
from content.vocab_extras import word_category
from study import exam_kanji_choices as kc
from study.exam_gen_utils import GenerationFailed
from study.exam_vocab_gen import _content_words, _display, _first_reading
from study.mcq import meaning_key
from translations import fr_gloss
from translations.fr.vocab_fr import VOCAB_FR

PAPER_REV = "sprint-1"
LEVELS = ("N5", "N4", "N3", "N2", "N1")
KINDS = ("word", "reading", "writing")

# More than anyone answers in a minute: a right answer holds the next
# question back 300 ms, a wrong one a second, and the fastest learner
# reads a choice in about one.
ITEMS = 60
PATTERN = ("word", "reading", "word", "writing", "word", "reading")
# The kanji items a paper may ask, at most: a kanji is asked once in a
# paper (exam_kanji_choices._build), and the levels' decks run out.
MAX_READING = 24
MAX_WRITING = 12

# How near a wrong meaning's length must be to the right one's.
LENGTH_BAND = (0.6, 1.6)


# A meaning read in a glance: the first gloss of the first sense, its
# notes in brackets dropped (« le fait de voir (humble, …) »), and a word
# whose meaning is still longer than this in either language not asked.
MEANING_MAX = 24
_NOTE = re.compile(r"\s*[(（][^)）]*[)）]")


def _first_sense(text: str) -> str:
    text = _NOTE.sub("", (text or "").strip())
    for sep in (";", "；", ",", "，", "、"):
        text = text.split(sep)[0]
    return text.strip()


def _gloss(word: dict, lang: str) -> str:
    if lang == "fr":
        return _first_sense(fr_gloss(word, VOCAB_FR) or "")
    return _first_sense(word.get("meaning", ""))


def _near(a: str, b: str) -> bool:
    low, high = LENGTH_BAND
    return low <= len(b) / max(1, len(a)) <= high


@lru_cache(maxsize=len(LEVELS))
def _word_bank(level: str) -> tuple[dict, ...]:
    """The level's words a sprint can ask, each with what its guards
    read, in the deck's own order (a list, never a set)."""
    out = []
    seen = set()
    for word in VOCAB_BY_LEVEL[level]:
        en, fr = _gloss(word, "en"), _gloss(word, "fr")
        if not en or not fr or len(en) > MEANING_MAX or len(fr) > MEANING_MAX:
            continue
        key = (word.get("kanji") or "", word.get("kana") or "")
        if key in seen:
            continue
        seen.add(key)
        out.append({
            "word": word,
            "en": en,
            "fr": fr,
            "key": meaning_key(en),
            "key_fr": meaning_key(fr),
            "category": word_category(word.get("kanji") or "", word["kana"]),
            "content": frozenset(_content_words(word.get("meaning", ""))),
            "to": en.lower().startswith("to "),
        })
    return tuple(out)


def word_item(entry: dict, bank: tuple[dict, ...], level: str, rng: random.Random) -> dict | None:
    """The word -> its meaning, or None when three fair wrong meanings
    cannot be found."""
    # Four meanings that differ in both languages: "thank you" and
    # "thanks" are two English glosses and one French « merci ».
    seen, seen_fr = {entry["key"]}, {entry["key_fr"]}
    candidates = []
    for other in bank:
        if other is entry or other["key"] in seen or other["key_fr"] in seen_fr:
            continue
        if other["category"] != entry["category"] or other["to"] != entry["to"]:
            continue
        if entry["content"] & other["content"]:
            continue
        if not (_near(entry["en"], other["en"]) and _near(entry["fr"], other["fr"])):
            continue
        seen.add(other["key"])
        seen_fr.add(other["key_fr"])
        candidates.append(other)
    if len(candidates) < 3:
        return None
    wrong = rng.sample(candidates, 3)
    options = [entry] + wrong
    rng.shuffle(options)
    word = entry["word"]
    shown = _display(word, level)
    reading = _first_reading(word)
    return {
        "kind": "word",
        "prompt": shown,
        "reading": reading if reading and shown != reading else None,
        "choices": {"fr": [o["fr"] for o in options], "en": [o["en"] for o in options]},
        "answer": options.index(entry),
    }


def _word_items(level: str, rng: random.Random, count: int) -> list[dict]:
    bank = _word_bank(level)
    order = list(range(len(bank)))
    rng.shuffle(order)
    out = []
    for i in order:
        if len(out) >= count:
            break
        item = word_item(bank[i], bank, level, rng)
        if item:
            out.append(item)
    return out


def _kanji_items(level: str, rng: random.Random, count: int, kind: str,
                 used_words: set, used_prompts: set) -> list[dict]:
    """漢字読み or 表記 through the mock exam's builders, as many as the
    level holds up to `count`."""
    if count <= 0:
        return []
    pool = list(VOCAB_BY_LEVEL[level])
    rng.shuffle(pool)
    build = kc.build_reading_mondai if kind == "reading" else kc.build_orthography_mondai
    # The builder raises when it finds fewer than asked; it is pure in
    # its inputs, so asking for fewer is the same walk cut shorter.
    while count > 0:
        words, prompts = set(used_words), set(used_prompts)
        spec = {"id": f"duel_{kind}", "official_number": 1, "count": count}
        try:
            mondai = build(spec, pool, words, prompts, random.Random(rng.random()), level)
        except GenerationFailed:
            count -= 1
            continue
        used_words |= words
        used_prompts |= prompts
        return [{
            "kind": kind,
            "prompt": q["promptJp"],
            "reading": None,
            "choices": [c["textJp"] for c in q["choices"]],
            "answer": next(i for i, c in enumerate(q["choices"]) if c["id"] == q["answer"]),
        } for q in mondai["questions"]]
    return []


def build_paper(seed: int, level: str) -> dict:
    """The sprint's questions for a duel at `level`, from `seed`."""
    if level not in LEVELS:
        raise ValueError(f"unknown level {level!r}")
    rng = random.Random(f"duel:{PAPER_REV}:{level}:{seed}")
    wanted = {kind: sum(1 for i in range(ITEMS) if PATTERN[i % len(PATTERN)] == kind) for kind in KINDS}
    used_words: set = set()
    used_prompts: set = set()
    kanji = {
        "reading": _kanji_items(level, rng, min(wanted["reading"], MAX_READING), "reading", used_words, used_prompts),
        "writing": [] if level == "N1" else _kanji_items(level, rng, min(wanted["writing"], MAX_WRITING),
                                                          "writing", used_words, used_prompts),
    }
    short = sum(wanted[k] - len(kanji[k]) for k in ("reading", "writing"))
    words = _word_items(level, rng, wanted["word"] + short)

    queues = {"word": words, "reading": kanji["reading"], "writing": kanji["writing"]}
    items = []
    i = 0
    while len(items) < ITEMS and any(queues.values()):
        kind = PATTERN[i % len(PATTERN)]
        i += 1
        queue = queues[kind] or queues["word"] or queues["reading"] or queues["writing"]
        items.append(queue.pop(0))
    return {"rev": PAPER_REV, "level": level, "seed": seed, "items": items}


def served(item: dict, n: int) -> dict:
    """A question as the client sees it: never its key."""
    return {"n": n, "kind": item["kind"], "prompt": item["prompt"],
            "reading": item.get("reading"), "choices": item["choices"]}
