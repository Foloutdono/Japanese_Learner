"""
A grammar point as a tour: found before it is drilled (plan 187).

The lesson the gate prints before a new card (plan 087) is read once and
forgotten. The tour asks instead: three of the point's own examples with
the point lit, a guess at what it does, then the rule as confirmation.
tour_payload() is the part of it derived from the catalogue as it stands,
which is why every point that can be lit gets one on the same day.

- `look`: up to three examples with the point lit where the detector finds
  it (grammar_detect.hits, the segments it is written on), else where its
  stems do (grammar_examples.highlight_span). Fewer than MIN_LIT lit
  examples and there is nothing to look at, so no tour.
- `guesses`: the point's meaning against its rivals' (the `compare` list),
  filled to GUESS_COUNT with same-level points. A wrong guess on a rival
  is answered by the point's own compare line for that rival -- the line
  that says which to use when -- so nothing is written for the tour. A
  filler carries no answer: its meaning is its option.
- `rule`, `structure`, `chain`: the lesson's rule step, the formation, and
  where the point attaches to a verb, the verb of the first example from
  its dictionary form to the point (書く → 書いてください).
- `rival`: the first rival the lesson names, for the terminus.
- `quiz`: the closing quiz, up to eight questions -- the point's authored
  `tour.quiz` (plan 196: read a sentence, build a form, say the right
  thing in a situation) and the gaps a rival's contrast sentences make --
  each on a sentence the tour has not shown, none asked twice (_quiz);
  None where there is too little to ask.
- `twists`, `scene`: the point's authored `tour` block (plan 187c),
  localised, the choices shuffled by a seed of the card id: [] and None
  where it is not written yet. study/grammar_check.py holds the block's
  shape. A twist per notion the point has beyond the meaning the guess
  asks (plan 189): a second use, a sense, a form, the rival the lesson
  warns about, each named by its `notion`, so the tour walks them all.

A point with no rival has nothing to guess against and gets no tour: the
gate keeps the lesson for it. Static per (level, pattern, lang), so it is
built once and copied out; the guesses' order is seeded by the card id,
so a reload asks the same.
"""
import copy
import random
import re
from functools import lru_cache

from content.grammar_points_data import (
    find, get_grammar_points, gloss, grammar_to_id, localise,
)
from content.grammar_sentences_data import translation
from study.furigana import align_sentence, mark_spans
from study.grammar_detect import hits
from study.grammar_examples import (
    BLANK, highlight_span, pattern_furigana, structure_furigana, structure_text,
)
from study.grammar_match import contains_pattern, verifiable
from study.morphology import tokenize

# Bumped when the payload's shape or its seeding changes.
TOUR_REV = 8  # 8: a gap question's options print the form each rule takes there (plan 254)
LOOK_COUNT = 3
MIN_LIT = 2
GUESS_COUNT = 4

# Where a scene happens (plan 187, Q5): a closed set of places the app
# already is, each drawn as a station plate with its plain-language caption
# (a place is what gets a pair, DESIGN.md). A scene's `place` is one key.
SCENE_PLACES: dict[str, dict] = {
    "窓口":   {"reading": "まどぐち",     "en": "Ticket window",           "fr": "Guichet"},
    "売店":   {"reading": "ばいてん",     "en": "Kiosk",                   "fr": "Kiosque"},
    "ホーム": {"reading": None,          "en": "Platform",                "fr": "Quai"},
    "車内":   {"reading": "しゃない",     "en": "On the train",            "fr": "Dans le train"},
    "改札":   {"reading": "かいさつ",     "en": "Ticket gates",            "fr": "Portillons"},
    "待合室": {"reading": "まちあいしつ", "en": "Waiting room",            "fr": "Salle d'attente"},
    "駅前":   {"reading": "えきまえ",     "en": "In front of the station", "fr": "Devant la gare"},
}
# The two voices of a scene: the other person, whom the scene names
# (`them`: the agent, the vendor, a traveller), and the learner.
SCENE_WHO = ("them", "me")

_SPACE = re.compile(r"\s+")


def _norm(text: str) -> str:
    return _SPACE.sub(" ", (text or "").strip().lower())


def _point_hits(jp: str, pattern: str, level: str) -> list[dict]:
    return [h for h in hits(jp) if (h["pattern"], h["level"]) == (pattern, level)]


def lit_spans(jp: str, pattern: str, level: str) -> list[tuple[int, int]]:
    """Where the point is written in `jp`: the detector's segments for it,
    else the stems' first match, else nothing."""
    found = _point_hits(jp, pattern, level)
    if found:
        return [tuple(seg) for seg in found[0]["segments"]]
    span = highlight_span(jp, pattern)
    return [span] if span else []


def _look(level: str, entry: dict, lang: str) -> list[dict]:
    out = []
    for example in entry.get("examples", []):
        jp = example.get("jp")
        if not jp:
            continue
        spans = lit_spans(jp, entry["pattern"], level)
        if not spans:
            continue
        out.append({
            "jp": jp,
            "tr": translation({"en": example.get("en", ""), "fr": example.get("fr", "")}, lang),
            "furigana": _parts(jp, spans),
            "spans": [list(s) for s in spans],
        })
        if len(out) == LOOK_COUNT:
            break
    return out


def _dictionary_form(token) -> str:
    """The verb as the learner would look it up, in the script the
    sentence writes it in: 書い → 書く, すわ → すう (not 吸う, which the
    tokenizer files it under)."""
    if token.lemma and token.surface and token.lemma[0] == token.surface[0]:
        return token.lemma
    return token.lemma_reading or token.lemma


def _chain(entry: dict, look: list[dict]) -> list[str] | None:
    """[dictionary form, the form in the sentence] for a point that
    attaches to a verb, from the first example: [書く, 書いてください]."""
    if not look or not (entry.get("structure") or "").lower().startswith("verb"):
        return None
    jp = look[0]["jp"]
    start, end = look[0]["spans"][0][0], look[0]["spans"][-1][1]
    tokens = tokenize(jp) or []
    before = next((t for t in tokens if t.start < start <= t.end), None)
    if before is None or before.pos != "verb" or before.surface == before.lemma:
        return None
    head = _dictionary_form(before)
    written = jp[before.start:end]
    if not head or head == written:
        return None
    return [head, written]


def _guesses(level: str, entry: dict, look: list[dict], lang: str) -> list[dict]:
    pattern = entry["pattern"]
    meaning = gloss(entry, lang)
    options = [{"text": meaning, "correct": True}]
    seen = {_norm(meaning)}
    named = {pattern}
    for rival in entry.get("compare", []):
        found = find(rival["pattern"])
        if found is None:
            continue
        r_level, r_entry = found
        named.add(r_entry["pattern"])
        text = gloss(r_entry, lang)
        if not text or _norm(text) in seen:
            continue
        seen.add(_norm(text))
        options.append({
            "text": text,
            "correct": False,
            "pattern": r_entry["pattern"],
            "furigana": pattern_furigana(r_entry["pattern"], r_entry.get("reading")),
            "answer": localise({"en": rival["en"], "fr": rival["fr"]}, lang),
        })
        if len(options) == GUESS_COUNT:
            break
    if len(options) < 2:
        return []

    rng = random.Random(f"{TOUR_REV}:{grammar_to_id(entry, level)}")
    # A point the examples themselves use could honestly be "what it
    # does" -- は and です in 学生ですか -- so it is never offered.
    present = {h["pattern"] for item in look for h in hits(item["jp"])}
    fillers = [
        g for g in get_grammar_points(level)
        if g["pattern"] not in named and g["pattern"] not in present
        and gloss(g, lang) and _norm(gloss(g, lang)) not in seen
    ]
    rng.shuffle(fillers)
    for g in fillers:
        if len(options) == GUESS_COUNT:
            break
        text = gloss(g, lang)
        if _norm(text) in seen:
            continue
        seen.add(_norm(text))
        options.append({
            "text": text,
            "correct": False,
            "pattern": g["pattern"],
            "furigana": pattern_furigana(g["pattern"], g.get("reading")),
            "answer": None,
        })
    rng.shuffle(options)
    return options


def _rival(entry: dict, lang: str) -> dict | None:
    for rival in entry.get("compare", []):
        found = find(rival["pattern"])
        if found is None:
            continue
        r_entry = found[1]
        return {
            "pattern": r_entry["pattern"],
            "furigana": pattern_furigana(r_entry["pattern"], r_entry.get("reading")),
            "text": localise({"en": rival["en"], "fr": rival["fr"]}, lang),
        }
    return None


# What leans on the word before it, so never opens a line.
_BOUND = {"particle", "auxiliary", "suffix", "symbol"}


def _parts(jp: str, spans: list[tuple[int, int]] | None = None) -> list[dict]:
    """A sentence's furigana, lit over `spans`, its kana runs cut at the
    tokenizer's words. align_sentence joins every run with no reading
    into one part, and the example renderer never breaks inside a part
    (ExampleSentence.jsx) -- so a scene's all-kana line, いいえ、コーヒー
    です。おちゃもありますよ。, ran off a phone's side as one unbreakable
    piece. Cut where a phrase begins (a word that is no particle,
    auxiliary, suffix or punctuation, after no prefix), it wraps between
    phrases and never strands a particle or a 。 at a line's start.
    """
    parts = mark_spans(align_sentence(jp), spans or [])
    tokens = tokenize(jp)
    if not tokens:
        return parts
    cuts = {
        token.start for i, token in enumerate(tokens)
        if i and token.pos not in _BOUND and tokens[i - 1].pos != "prefix"
    }
    out, pos = [], 0
    for part in parts:
        text = part["text"]
        if part.get("reading") is not None:
            out.append(part)
            pos += len(text)
            continue
        start = 0
        for i in range(1, len(text) + 1):
            if i == len(text) or pos + i in cuts:
                out.append({**part, "text": text[start:i]})
                start = i
        pos += len(text)
    return out


def _lit(jp: str, pattern: str, level: str) -> list[dict]:
    """A line's furigana with the point lit where it is written."""
    return _parts(jp, lit_spans(jp, pattern, level))


def _spoken(line: dict, pattern: str, level: str, lang: str) -> dict:
    return {
        "who": line["who"],
        "jp": line["jp"],
        "tr": localise({"en": line["en"], "fr": line["fr"]}, lang),
        "furigana": _lit(line["jp"], pattern, level),
    }


def _twists(level: str, entry: dict, lang: str) -> list[dict]:
    """The point's usages, one at a time (« C'est pas tout ! », plan 194):
    the sentence lit, the question, two readings -- the right one and the
    confusion its author set beside it (`choices[1]`, content/grammar/
    README.md) -- and the why. The sentence's translation (`tr`) is the
    payload's but the screen holds it back until the question is answered
    (plan 196): printed under the sentence it was the answer to "what does
    it say?". `kind` says whether it is another use of the point or a trap
    set against it."""
    out = []
    for n, twist in enumerate((entry.get("tour") or {}).get("twists") or []):
        rng = random.Random(f"{TOUR_REV}:{grammar_to_id(entry, level)}:twist:{n}")
        choices = [
            {"text": localise(choice, lang), "correct": i == 0}
            for i, choice in enumerate(twist["choices"][:2])
        ]
        rng.shuffle(choices)
        tr = twist.get("tr")
        out.append({
            "notion": localise(twist["notion"], lang),
            "kind": twist.get("kind") or "usage",
            "jp": twist["jp"],
            "furigana": _lit(twist["jp"], entry["pattern"], level),
            "tr": localise(tr, lang) if tr else None,
            "ask": localise(twist["ask"], lang),
            "choices": choices,
            "why": localise(twist["why"], lang),
            "pair": list(twist.get("pair") or []) or None,
        })
    return out


# ── 試験 the closing quiz (plan 194; rewritten in plan 196) ──
# Up to eight questions, each on a sentence the learner has not met in the
# tour -- not a look, not a twist, not a line of the scene -- and no
# sentence or question asked twice (study/grammar_check holds it for what
# is authored, test_grammar_tour for what is served). The first quiz asked
# "which of these uses it?" up to eight times over: a question the eye
# answers by finding the point's own characters, which tests nothing. A
# question here is one only someone who has understood the point can answer.
# Three kinds are authored in the point's `tour.quiz`:
#   meaning  a sentence new to the tour, its translation held back until
#            it is answered, three readings of it
#   form     a sentence with the point's form blanked and what it says
#            under it, three forms to fill it with
#   use      a situation in the learner's language, three Japanese lines
#            one of which is the one to say
# and one is derived, up to QUIZ_GAPS of them where a rival's lesson has
# contrast sentences:
#   gap      a rival's own contrast sentence with the rival blanked, the
#            point among the choices as the wrong answer: the point told
#            apart from the side of its neighbour
# A gap's trap is a rival the lesson's compare names (or the point itself);
# its `why` is the lesson's own line on that pair. A point with fewer than
# QUIZ_MIN questions has no quiz: the tour ends on its results.
QUIZ_SIZE = 8
QUIZ_MIN = 3
QUIZ_GAPS = 2
_RANK = {level: n for n, level in enumerate(("N5", "N4", "N3", "N2", "N1"))}


def _compare_line(entry: dict, rival: str, lang: str) -> str | None:
    for r in entry.get("compare", []):
        if r["pattern"] == rival:
            return localise({"en": r["en"], "fr": r["fr"]}, lang)
    return None


def _without_point(jp: str, pattern: str, level: str) -> bool:
    """Whether `jp` certainly does not use the point (so it can stand as a
    wrong answer to a gap)."""
    if lit_spans(jp, pattern, level):
        return False
    return not (verifiable(pattern) and contains_pattern(jp, pattern))


def quiz_sentences(question: dict) -> list[str]:
    """Every sentence an authored quiz question shows or offers, as the
    learner reads it: a meaning's sentence, a form's with each of its
    fillings, a use's three lines."""
    kind = question.get("kind")
    if kind == "meaning":
        return [question["jp"]]
    if kind == "form":
        return [question["jp"].replace(BLANK, c) for c in question["choices"]]
    if kind == "use":
        return list(question["choices"])
    return []


def _met(entry: dict, look: list[dict]) -> set[str]:
    """Every sentence the tour has shown by the time the quiz starts, and
    every one its authored questions ask, so a derived question never
    repeats one."""
    tour = entry.get("tour") or {}
    met = {item["jp"] for item in look}
    met |= {example["jp"] for example in entry.get("examples", []) if example.get("jp")}
    met |= {twist["jp"] for twist in tour.get("twists") or []}
    scene = tour.get("scene")
    if scene:
        met |= {line["jp"] for line in scene["lines"]}
        met.add(scene["ask"]["cue"]["jp"])
        met |= set(scene["ask"]["choices"])
    for question in tour.get("quiz") or []:
        met |= set(quiz_sentences(question))
    return met


def _rivals(level: str, entry: dict) -> list[tuple[str, str, dict]]:
    """(level, pattern, entry) of each rival the lesson names that the
    catalogue holds at the point's level or below, in the lesson's order."""
    out = []
    for r in entry.get("compare", []):
        found = find(r["pattern"])
        if found is not None and _RANK[found[0]] <= _RANK[level]:
            out.append((found[0], r["pattern"], found[1]))
    return out


def _gap_questions(level: str, entry: dict, lang: str, met: set[str], rng: random.Random) -> list[dict]:
    """A rival's own contrast sentences with the rival blanked, the point
    offered as a wrong answer. Only a rival whose lesson names the point
    back, and a sentence its author marked as one where the rivals are
    wrong, so the point is certainly not the answer."""
    from study.grammar_lesson import contrast_payload
    pattern = entry["pattern"]
    out = []
    for r_level, r_pattern, r_entry in _rivals(level, entry):
        why = _compare_line(r_entry, pattern, lang)
        if why is None:
            continue
        for example in r_entry.get("examples", []):
            jp = example.get("jp")
            if not example.get("contrast") or jp in met or not _without_point(jp, pattern, level):
                continue
            c = contrast_payload(r_level, r_entry, get_grammar_points(r_level), lang, rng=rng,
                                 example=example, offer=pattern)
            rules = (c or {}).get("rules", {})
            if c is None or pattern not in rules.values() or rules.get(c["answer"]) != r_pattern:
                continue
            # Each option prints the form its rule would take in the hole
            # (plan 254); `pattern` stays the rule it is.
            out.append({
                "kind": "gap",
                "jp": c["jp"], "tr": c["tr"], "furigana": c["furigana"], "fill": c.get("fill", []),
                "choices": [{"pattern": rules[f], "form": f, "furigana": c["readings"].get(f),
                             "correct": rules[f] == r_pattern, "trap": rules[f] == pattern} for f in c["choices"]],
                "why": why,
            })
            met.add(jp)
            if len(out) == QUIZ_GAPS:
                return out
    return out


def _blanked(jp: str, span: tuple[int, int]) -> list[dict]:
    """A sentence's furigana with `span` as one blank part."""
    out: list[dict] = []
    for part in _parts(jp, [span]):
        if not part.get("highlight"):
            out.append(part)
        elif not (out and out[-1].get("blank")):
            out.append({"text": BLANK, "blank": True})
    return out


def _authored_questions(level: str, entry: dict, lang: str) -> list[dict]:
    """The point's own `tour.quiz`, localised, each question's choices
    shuffled by a seed of the card id (the answer is written first)."""
    out = []
    for n, q in enumerate((entry.get("tour") or {}).get("quiz") or []):
        rng = random.Random(f"{TOUR_REV}:{grammar_to_id(entry, level)}:quiz:{n}")
        kind = q["kind"]
        base = {"kind": kind, "ask": localise(q["ask"], lang), "why": localise(q["why"], lang)}
        if kind == "meaning":
            choices = [{"text": localise(c, lang), "correct": i == 0} for i, c in enumerate(q["choices"])]
            rng.shuffle(choices)
            out.append({**base, "jp": q["jp"], "tr": localise(q["tr"], lang),
                        "furigana": _parts(q["jp"]), "choices": choices})
        elif kind == "form":
            right = q["choices"][0]
            at = q["jp"].index(BLANK)
            filled = q["jp"].replace(BLANK, right)
            choices = [{"jp": c, "correct": i == 0} for i, c in enumerate(q["choices"])]
            rng.shuffle(choices)
            out.append({**base, "jp": filled, "tr": localise(q["tr"], lang),
                        "furigana": _blanked(filled, (at, at + len(right))), "choices": choices})
        else:
            choices = [{"jp": jp, "furigana": _parts(jp), "correct": i == 0} for i, jp in enumerate(q["choices"])]
            rng.shuffle(choices)
            out.append({**base, "choices": choices})
    return out


def _quiz(level: str, entry: dict, lang: str, look: list[dict]) -> list[dict] | None:
    """The closing quiz: the authored questions in the order they are
    written, a gap after every other one, up to QUIZ_SIZE; None under
    QUIZ_MIN, where there is too little to ask."""
    rng = random.Random(f"{TOUR_REV}:{grammar_to_id(entry, level)}:quiz")
    authored = _authored_questions(level, entry, lang)
    gaps = _gap_questions(level, entry, lang, _met(entry, look), rng)
    out = []
    for i, question in enumerate(authored):
        out.append(question)
        if i % 2 == 0 and gaps:
            out.append(gaps.pop(0))
    out = (out + gaps)[:QUIZ_SIZE]
    if len(out) < QUIZ_MIN:
        return None
    for n, q in enumerate(out):
        q["n"] = n
    return out


def _scene(level: str, entry: dict, lang: str) -> dict | None:
    scene = (entry.get("tour") or {}).get("scene")
    if not scene:
        return None
    pattern = entry["pattern"]
    rng = random.Random(f"{TOUR_REV}:{grammar_to_id(entry, level)}:scene")
    place = SCENE_PLACES[scene["place"]]
    choices = [
        {"jp": jp, "furigana": _parts(jp), "correct": i == 0}
        for i, jp in enumerate(scene["ask"]["choices"])
    ]
    rng.shuffle(choices)
    return {
        "place": scene["place"],
        "place_reading": place["reading"],
        "place_caption": localise(place, lang),
        "them": localise(scene["them"], lang),
        "lines": [_spoken(line, pattern, level, lang) for line in scene["lines"]],
        "note": localise(scene["note"], lang),
        "ask": {
            "cue": _spoken(scene["ask"]["cue"], pattern, level, lang),
            "task": localise(scene["ask"]["task"], lang),
            "choices": choices,
            "why": localise(scene["ask"]["why"], lang),
        },
    }


@lru_cache(maxsize=2048)
def _tour(level: str, pattern: str, lang: str) -> dict | None:
    found = find(pattern)
    if found is None or found[0] != level:
        return None
    entry = found[1]
    look = _look(level, entry, lang)
    if len(look) < MIN_LIT:
        return None
    guesses = _guesses(level, entry, look, lang)
    if not guesses:
        return None
    rule = next((s for s in entry.get("steps", []) if s.get("kind") == "rule"), None)
    return {
        "rev": TOUR_REV,
        "look": look,
        "guesses": guesses,
        "rule": localise({"en": rule["en"], "fr": rule["fr"]}, lang) if rule else None,
        "structure": structure_text(entry, lang),
        "structure_furigana": structure_furigana(entry, lang),
        "chain": _chain(entry, look),
        "rival": _rival(entry, lang),
        "twists": _twists(level, entry, lang),
        "scene": _scene(level, entry, lang),
        "quiz": _quiz(level, entry, lang, look),
    }


def tour_payload(level: str, entry: dict, lang: str) -> dict | None:
    """The derived tour for one point, or None when it cannot be lit or
    has no rival to guess against (the gate then keeps the lesson)."""
    tour = _tour(level, entry["pattern"], lang)
    # lru_cache hands back one object; a caller that mutates it would
    # corrupt every later reader.
    return copy.deepcopy(tour) if tour is not None else None
