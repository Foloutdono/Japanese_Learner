"""
対戦 — the sprint's questions (plan 279).

A duel is a sprint: two minutes of quick questions (plan 284; sixty
seconds under sprint-1), the same ones in
the same order for both players, built once from a seed and stored
with the duel. Since plan 286 (the owner's B, « le fondu ») a paper is
built at a mix, where an Elo stands between two levels in tenths
(mix_of: each level's starting Elo is a whole level, 200 points a
level), and asks the two levels' words in that share: 1 180 is 0.9,
nine questions in ten N4 and one N5. Since plan 288 each of those
levels also brings the words of the levels below it, as many as their
share of the words from there down (a speed game reads an easy word
gladly, and a level's own kanji ran out in a few papers), never less
than OWN_FLOOR of its own (shares). A third of the questions are kanji.
Since plan 289 the line starts a stop before N5, the beginner's
(NOVICE, 800 Elo, mix -10): the basics course's words, shown in kana,
and the kana themselves where the others ask kanji -- a kana, its
reading in romaji -- and N5 brings that stop below it as every level
brings its own.
Three kinds, mixed in a fixed pattern so the eye cannot settle:

  word     a word (with its reading) -> what it means, three meanings in
           the learner's language
  reading  a word written in kanji -> its reading (the mock exam's
           漢字読み)
  writing  a word in kana -> its spelling in kanji (the exam's 表記),
           never at N1, where the exam asks none
  kana     a kana -> its romaji, at the beginner's stop, in the kanji's
           place

Grammar and sentences are not asked: a sentence is not read in six
seconds. Since plan 288 a question has three choices, not the exam's
four: a sprint is speed, and a fourth line is a second's reading more.

build_paper is a pure function of (seed, mix, content): no model, no
database, and nothing that iterates a set before a seeded random touches
it, so the same paper comes back in any process (the placement test's
rule, tests/test_duel_paper.py builds it under two hash seeds).

The guards are the exam's, for the reason the exam has them: a choice
must be told apart by understanding, never by its look.

  - word: the two wrong meanings are words of the same category (a
    verb's « to … » among nouns is found without reading), share no
    content word with the right one, have the same gloss shape, and a
    length near the right one's in both languages; the word is shown in
    kana when it is written with a kanji the level has not taught.
  - reading, writing: study/exam_kanji_choices' own builders, under the
    duel's seed -- the readings the course's words give a kanji, a
    symmetric set of four, the key neither the centre nor the outlier,
    of which one wrong choice is left out. Three choices always have a
    centre, so no cut is fair alone; the cut is chosen so that over the
    paper the key is the centre, the outlier, the longest and the
    shortest about one time in three, as a blind pick would be
    (_left_out). Left out at random, the exam's filter, which keeps the
    key in the middle of four, made it the centre of three 43% of the
    time at N2.
  - over many papers (the tests): the longest, the shortest, the centre
    and the outlier win no more than a blind pick of three would, the
    keys spread over the three slots without stepping through them.

PAPER_REV is the output's revision (CLAUDE.md, "Bump the revision when
the output changes"): a duel stores the paper it was built with, and the
rev it was built under. The duel's rules go with the rev too
(study/duels): sprint-2's runs are two minutes long (plan 284) and pay
a streak and the last seconds more (plan 285); sprint-3's papers are
mixes (plan 286), sprint-4's ask three choices (plan 288), sprint-5's
start at the beginner's stop (plan 289), with the same rules.
"""
from __future__ import annotations

import random
import re
from functools import lru_cache

from content.kana_data import HIRAGANA_BASIC, KATAKANA_BASIC
from content.vocab_data import VOCAB_BY_LEVEL
from content.vocab_extras import word_category
from study import basics
from study import exam_kanji_choices as kc
from study.duel_elo import NOVICE, START
from study.exam_gen_utils import GenerationFailed
from study.exam_tells import centre, outlier
from study.exam_vocab_gen import _content_words, _display, _first_reading
from study.mcq import meaning_key
from translations import fr_gloss
from translations.fr.vocab_fr import VOCAB_FR

PAPER_REV = "sprint-5"
LEVELS = ("N5", "N4", "N3", "N2", "N1")
# The stops a paper stands among: the beginner's, then the JLPT's.
LADDER = (NOVICE, *LEVELS)
# A mix is in tenths of a level above N5: 0 all N5, 9 a tenth N5 and
# nine tenths N4, 40 all N1, -10 all the beginner's (plan 289; below N5,
# so a mix stored before keeps its meaning).
STEPS = 10
MIX_MIN = -STEPS
MIX_MAX = (len(LEVELS) - 1) * STEPS
# A tenth of a level, in Elo: each level's start (duel_elo.START) is a
# whole level, 200 points above the last.
ELO_STEP = (START["N4"] - START["N5"]) // STEPS
KINDS = ("word", "reading", "writing")
# A question's choices (plan 288): the right one and two wrong.
CHOICES = 3

# More than anyone answers in the sprint's two minutes: a right answer
# holds the next question back 300 ms, a wrong one a second, and the
# fastest learner reads a choice in about one.
ITEMS = 120
# A third kanji (plan 288; half before): six words, two readings and one
# spelling in nine, never three of a kind in a row, around the turn too.
PATTERN = ("word", "reading", "word", "word", "writing", "word", "word", "reading", "word")
# The kanji items a paper may ask, at most: a kanji is asked once in a
# paper (exam_kanji_choices._build), and the levels' decks run out. The
# writing items are drawn first: they need the scarcer kanji, and the
# readings would otherwise take the ones a spelling can be asked on.
MAX_READING = 30
MAX_WRITING = 15
# What a level keeps of its own questions at least, the levels below it
# sharing the rest (plan 288, the owner's floor).
OWN_FLOOR = 0.3

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


@lru_cache(maxsize=1)
def _basics_keys() -> frozenset[str]:
    """The basics course's words, as "{kanji}::{kana}" (plan 186)."""
    return frozenset(name for unit in basics.units() for name in unit["vocab"])


def _deck(level: str) -> list[dict]:
    """A stop's words: a level's deck, or the beginner's, the basics
    course's words out of N5's, in N5's order."""
    if level != NOVICE:
        return VOCAB_BY_LEVEL[level]
    keys = _basics_keys()
    return [w for w in VOCAB_BY_LEVEL["N5"] if f"{w.get('kanji', '')}::{w.get('kana', '')}" in keys]


@lru_cache(maxsize=len(LADDER))
def _word_bank(level: str) -> tuple[dict, ...]:
    """The level's words a sprint can ask, each with what its guards
    read, in the deck's own order (a list, never a set)."""
    out = []
    seen = set()
    for word in _deck(level):
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
    """The word -> its meaning, or None when two fair wrong meanings
    cannot be found."""
    # Meanings that differ in both languages: "thank you" and
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
    if len(candidates) < CHOICES - 1:
        return None
    wrong = rng.sample(candidates, CHOICES - 1)
    options = [entry] + wrong
    rng.shuffle(options)
    word = entry["word"]
    reading = _first_reading(word)
    # The beginner reads kana, not yet kanji.
    shown = reading if level == NOVICE else _display(word, level)
    return {
        "kind": "word",
        "prompt": shown,
        "reading": reading if reading and shown != reading else None,
        "choices": {"fr": [o["fr"] for o in options], "en": [o["en"] for o in options]},
        "answer": options.index(entry),
    }


def _word_items(level: str, rng: random.Random, count: int, used: set) -> list[dict]:
    """`count` of a stop's words, none asked twice in a paper (the
    beginner's are N5's too). The beginner's wrong meanings are N5's:
    its own few words would leave many a word without two."""
    bank = _word_bank(level)
    rivals = _word_bank("N5") if level == NOVICE else bank
    order = list(range(len(bank)))
    rng.shuffle(order)
    out = []
    for i in order:
        if len(out) >= count:
            break
        key = (bank[i]["word"].get("kanji") or "", bank[i]["word"].get("kana") or "")
        if key in used:
            continue
        item = word_item(bank[i], rivals, level, rng)
        if item:
            used.add(key)
            out.append(item)
    return out


# ── The kana (plan 289) ─────────────────────────────────────────────
# A kana -> its romaji, at the beginner's stop where the others ask
# kanji: the basic hiragana and katakana with their voiced forms. The
# wrong readings are as long as the right one (ka against shi would be
# answered by its length), and three of them are cut to two the way a
# kanji item's four are (_left_out), so the eye wins nothing.

@lru_cache(maxsize=1)
def _kana_pool() -> tuple[dict, ...]:
    return tuple(HIRAGANA_BASIC + KATAKANA_BASIC)


def _kana_items(rng: random.Random, count: int, used_prompts: set, tally: dict) -> list[dict]:
    pool = list(_kana_pool())
    rng.shuffle(pool)
    out = []
    for entry in pool:
        if len(out) >= count:
            break
        right = entry["romaji"]
        if entry["kana"] in used_prompts:
            continue
        alike = sorted({o["romaji"] for o in _kana_pool() if o["romaji"] != right and len(o["romaji"]) == len(right)})
        if len(alike) < CHOICES - 1:
            continue
        wrong = rng.sample(alike, min(CHOICES, len(alike)))
        if len(wrong) == CHOICES:
            choices = _left_out([right] + wrong, right, rng, tally)
        else:
            choices = [right] + wrong
            rng.shuffle(choices)
        used_prompts.add(entry["kana"])
        out.append({"kind": "kana", "prompt": entry["kana"], "reading": None,
                    "choices": choices, "answer": choices.index(right)})
    return out


def _kanji_items(level: str, rng: random.Random, count: int, kind: str,
                 used_words: set, used_prompts: set, tally: dict) -> list[dict]:
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
        out = []
        for q in mondai["questions"]:
            texts = [c["textJp"] for c in q["choices"]]
            right = texts[next(i for i, c in enumerate(q["choices"]) if c["id"] == q["answer"])]
            choices = _left_out(texts, right, rng, tally)
            out.append({"kind": kind, "prompt": q["promptJp"], "reading": None,
                        "choices": choices, "answer": choices.index(right)})
        return out
    return []


# What the eye can read in three choices: the one most like the others,
# the one least like them, the longest and the shortest (each where one
# choice alone is it).
def _roles(kept: list[str]) -> dict[str, int | None]:
    sizes = [len(t) for t in kept]

    def alone(size: int) -> int | None:
        return sizes.index(size) if sizes.count(size) == 1 else None

    return {"centre": centre(kept), "outlier": outlier(kept),
            "longest": alone(max(sizes)), "shortest": alone(min(sizes))}


def _left_out(texts: list[str], right: str, rng: random.Random, tally: dict) -> list[str]:
    """The exam's four choices cut to CHOICES, the wrong one left out
    chosen so that, over the paper, each role in _roles falls to the key
    as often as to a blind pick: the cut that keeps `tally` (role ->
    [times the key had it, times one choice had it]) nearest one in
    three, a tie drawn at random."""
    wrong = sorted(t for t in texts if t != right)

    def after(drop: str) -> dict:
        kept = [right] + [t for t in wrong if t != drop]
        out = {}
        for role, who in _roles(kept).items():
            hits, n = tally.get(role, (0, 0))
            if who is not None:
                hits, n = hits + (who == 0), n + 1
            out[role] = (hits, n)
        return out

    def cost(drop: str) -> float:
        return sum(abs(hits - n / CHOICES) for hits, n in after(drop).values())

    best = min(cost(d) for d in wrong)
    drop = rng.choice([d for d in wrong if cost(d) - best < 1e-9])
    tally.update(after(drop))
    kept = [right] + [t for t in wrong if t != drop]
    rng.shuffle(kept)
    return kept


def mix_of(elo: float) -> int:
    """Where an Elo stands among the levels, in tenths of a level above
    N5: each level's starting Elo (duel_elo.START) is a whole level, the
    beginner's one below N5."""
    return max(MIX_MIN, min(MIX_MAX, round((elo - START["N5"]) / ELO_STEP)))


def blend(mix: int) -> list[tuple[str, float]]:
    """The levels a mix asks and the share of each, lower first:
    9 -> [("N5", 0.1), ("N4", 0.9)], -3 -> [("novice", 0.3), ("N5", 0.7)];
    a whole level alone."""
    low, part = divmod(mix - MIX_MIN, STEPS)
    if not part:
        return [(LADDER[low], 1.0)]
    return [(LADDER[low], (STEPS - part) / STEPS), (LADDER[low + 1], part / STEPS)]


def level_of(mix: int) -> str:
    """The level most of a mix's questions are at (the upper one at half)."""
    return LADDER[(mix - MIX_MIN + STEPS // 2) // STEPS]


def _downward(level: str) -> list[tuple[str, float]]:
    """A level's questions, level by level, lower first: each level from
    the beginner's up to it in its share of what there is to ask from
    there down, the level itself never under OWN_FLOOR. The beginner's
    stop weighs its kana: its words are N5's, counted there already."""
    under = LADDER[: LADDER.index(level) + 1]
    sizes = {lv: len(_kana_pool()) if lv == NOVICE else len(_word_bank(lv)) for lv in under}
    total = sum(sizes.values())
    own = max(OWN_FLOOR, sizes[level] / total)
    rest = total - sizes[level]
    lower = [(lv, (1 - own) * sizes[lv] / rest) for lv in under[:-1]] if rest else []
    return lower + [(level, own if rest else 1.0)]


def shares(mix: int) -> list[tuple[str, float]]:
    """Every level a mix asks and its share of the paper, lower first:
    the blend's levels, each with the levels below it (_downward), and
    the duel's level (level_of) never under OWN_FLOOR, the others
    giving way in their proportions."""
    acc: dict[str, float] = {}
    for lv, part in blend(mix):
        for low, share in _downward(lv):
            acc[low] = acc.get(low, 0.0) + part * share
    top = level_of(mix)
    if acc[top] < OWN_FLOOR:
        scale = (1 - OWN_FLOOR) / (1 - acc[top])
        acc = {lv: OWN_FLOOR if lv == top else share * scale for lv, share in acc.items()}
    return [(lv, acc[lv]) for lv in LADDER if lv in acc]


def _split(n: int, shares: list[tuple[str, float]]) -> dict[str, int]:
    """n questions shared out as the shares say: each level its whole
    part, the rest to the largest remainders, the upper level first on
    a tie."""
    raw = [(lv, n * share) for lv, share in shares]
    out = {lv: int(x) for lv, x in raw}
    order = sorted(raw, key=lambda r: (-(r[1] - int(r[1])), -LADDER.index(r[0])))
    for lv, _ in order[: n - sum(out.values())]:
        out[lv] += 1
    return out


def build_paper(seed: int, level: str | None = None, mix: int | None = None) -> dict:
    """The sprint's questions for a duel at `mix` (or a whole `level`),
    from `seed`."""
    if mix is None:
        if level not in LADDER:
            raise ValueError(f"unknown level {level!r}")
        mix = MIX_MIN + LADDER.index(level) * STEPS
    if not MIX_MIN <= mix <= MIX_MAX:
        raise ValueError(f"unknown mix {mix!r}")
    parts = shares(mix)
    rng = random.Random(f"duel:{PAPER_REV}:{mix}:{seed}")
    wanted = {kind: sum(1 for i in range(ITEMS) if PATTERN[i % len(PATTERN)] == kind) for kind in KINDS}
    used_words: set = set()
    used_prompts: set = set()
    tally: dict = {}
    kanji: dict[str, list] = {"writing": [], "reading": []}
    short = {lv: 0 for lv, _ in parts}
    # The writing items first, every level's: they need the scarcer
    # kanji. A level that runs short (N1 asks none) makes it up in words;
    # the beginner's stop asks kana in their place.
    for kind, cap in (("writing", MAX_WRITING), ("reading", MAX_READING)):
        for lv, count in _split(min(wanted[kind], cap), parts).items():
            if lv == NOVICE:
                got = _kana_items(rng, count, used_prompts, tally)
            elif kind == "writing" and lv == "N1":
                got = []
            else:
                got = _kanji_items(lv, rng, count, kind, used_words, used_prompts, tally)
            kanji[kind] += [{**item, "level": lv} for item in got]
            short[lv] += count - len(got)
        short_cap = wanted[kind] - min(wanted[kind], cap)
        for lv, count in _split(short_cap, parts).items():
            short[lv] += count
    words = []
    asked: set = set()
    for lv, count in _split(wanted["word"], parts).items():
        words += [{**item, "level": lv} for item in _word_items(lv, rng, count + short[lv], asked)]
    queues = {"word": words, "reading": kanji["reading"], "writing": kanji["writing"]}
    # The levels' questions dealt in among each other.
    for queue in queues.values():
        rng.shuffle(queue)
    items = []
    i = 0
    while len(items) < ITEMS and any(queues.values()):
        kind = PATTERN[i % len(PATTERN)]
        i += 1
        queue = queues[kind] or queues["word"] or queues["reading"] or queues["writing"]
        items.append(queue.pop(0))
    return {"rev": PAPER_REV, "level": level_of(mix), "mix": mix, "seed": seed, "items": items}


def served(item: dict, n: int) -> dict:
    """A question as the client sees it: never its key."""
    return {"n": n, "kind": item["kind"], "prompt": item["prompt"],
            "reading": item.get("reading"), "choices": item["choices"]}
