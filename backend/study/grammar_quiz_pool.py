"""
The sentences a point's closing quiz may draw on (plan 195).

The tour's quiz (study/grammar_tour._quiz) asks only sentences the learner
has not met in the tour: not its three looks, not a twist's, not a line of
its scene, and no sentence twice. A point's own catalogue examples are too
few for that (four, three of them already shown), so the quiz reads the
rest of what the app teaches: every example and tour sentence of the
catalogue and every row of the reading bank, kept for each point they write.

Where those are still too few, `content/grammar/quiz_sentences.json`
holds sentences written for the quiz alone (AI-drafted like the rest of
the catalogue, level -> pattern -> sentences, Japanese only: the quiz never
translates a sentence it offers as a choice), each held to
`sentence_problems` -- the level's kanji, grammar and words, the point
written in it, and no sentence the app already teaches.

`write_pool()` is `content/grammar/quiz_pool.json`, level -> pattern ->
sentences, for the point at that level: the written ones first, then the
others; a taught sentence is kept for a point only where it is at that
level or below (its kanji and grammar are the point's own or easier) and
certainly writes it -- the detector's word where it has proved itself on
the point (grammar_detect.can_find), the stems' where it has not. The answers are slow to compute (the detector over every
sentence), which is the only reason they are written down rather than
asked: `python -m scripts.build_quiz_pool` rewrites the file and
tests/test_grammar_quiz_pool.py fails while it disagrees with the catalogue.
"""
import json
from functools import lru_cache
from pathlib import Path

from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL, LEVELS

GRAMMAR = Path(__file__).resolve().parents[1] / "content" / "grammar"
SNAPSHOT = GRAMMAR / "quiz_pool.json"
WRITTEN = GRAMMAR / "quiz_sentences.json"
MAX_CHARS = 60
MIN_CHARS = 6


@lru_cache(maxsize=1)
def corpus() -> tuple[tuple[str, str], ...]:
    """(sentence, level) for every sentence the app teaches a point with:
    the catalogue's examples and its tours' sentences, then the reading
    bank's rows; once each."""
    from content import reading_sentences
    out, seen = [], set()
    for level in LEVELS:
        for entry in GRAMMAR_POINTS_BY_LEVEL[level]:
            tour = entry.get("tour") or {}
            scene = tour.get("scene") or {}
            lines = [line["jp"] for line in scene.get("lines", [])]
            if scene:
                lines += [scene["ask"]["cue"]["jp"], *scene["ask"]["choices"]]
            for jp in [example.get("jp") for example in entry.get("examples", [])] \
                    + [twist["jp"] for twist in tour.get("twists", [])] + lines:
                if jp and jp not in seen:
                    seen.add(jp)
                    out.append((jp, level))
    for level in LEVELS:
        for row in reading_sentences.BY_LEVEL[level]:
            jp = row.get("jp")
            if jp and jp not in seen:
                seen.add(jp)
                out.append((jp, level))
    return tuple(out)


@lru_cache(maxsize=1)
def written() -> dict[str, dict[str, list[str]]]:
    """The sentences written for the quiz: level -> pattern -> sentences."""
    try:
        return json.loads(WRITTEN.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}


@lru_cache(maxsize=1)
def taught() -> frozenset[str]:
    """Every sentence the app teaches a point with."""
    return frozenset(jp for jp, _ in corpus())


def writes(jp: str, level: str, pattern: str, found=None) -> bool | None:
    """Whether `jp` writes the point: the detector's word where it has
    proved itself on the point, else the stems'; None where nothing can
    tell (a class label, a shape no rule reads). `found` is the
    detector's hits for `jp` where the caller already has them."""
    from study.grammar_detect import can_find, hits
    from study.grammar_match import contains_pattern, verifiable
    if can_find(pattern):
        found = found if found is not None else {(h["pattern"], h["level"]) for h in hits(jp)}
        return (pattern, level) in found
    if verifiable(pattern):
        return contains_pattern(jp, pattern)
    return None


def sentence_problems(level: str, pattern: str, jp) -> list[str]:
    """Everything wrong with one sentence written for the quiz, as
    reasons; [] when it is clean. The rules of a reading-bank row that
    do not depend on a translation or a focus word (content/
    reading_sentences.row_problems): a whole sentence, the level's own
    kanji, grammar and words, the point written in it; and, here, no
    sentence the app already teaches."""
    import re

    from study import difficulty as D
    if not isinstance(jp, str) or not jp.strip():
        return ["empty"]
    out = []
    if jp != jp.strip():
        out.append("has surrounding whitespace")
    if jp[-1] not in "。！？":
        out.append("does not end in 。！？")
    if not MIN_CHARS <= len(jp) <= min(MAX_CHARS, D.MAX_CHARS[level]):
        out.append(f"{len(jp)} chars, wanted {MIN_CHARS}-{min(MAX_CHARS, D.MAX_CHARS[level])}")
    if re.search(r"[A-Za-zＡ-Ｚａ-ｚ0-9０-９]", jp):
        out.append("has Latin letters or digits in it")
    if jp in taught():
        out.append("is a sentence the app already teaches")
    verdict = D.report(jp, level, allow_kanji=pattern)
    verdict["vocab"] = [(word, lv) for word, lv in verdict["vocab"] if word not in pattern]
    for key in ("kanji", "grammar", "vocab"):
        if verdict[key]:
            out.append(f"{key} above {level}: {verdict[key]}")
    if writes(jp, level, pattern) is not True:
        out.append(f"does not write {pattern}")
    from content.reading_sentences import off_deck_words
    off = off_deck_words(jp)
    if off:
        out.append(f"words the deck does not teach: {off}")
    return out


def write_pool() -> dict[str, dict[str, list[str]]]:
    """What the snapshot should hold for the catalogue as it stands."""
    from study.grammar_detect import hits

    rank = {level: n for n, level in enumerate(LEVELS)}
    points = [(level, e["pattern"]) for level in LEVELS for e in GRAMMAR_POINTS_BY_LEVEL[level]]
    pool: dict[str, dict[str, list[str]]] = {level: {} for level in LEVELS}
    # The sentences written for the quiz first, so a quiz draws them
    # before the others.
    for level, by_pattern in written().items():
        for pattern, sentences in by_pattern.items():
            pool[level][pattern] = list(sentences)
    for jp, level in corpus():
        if len(jp) > MAX_CHARS:
            continue
        found = {(h["pattern"], h["level"]) for h in hits(jp)}
        for p_level, pattern in points:
            if rank[p_level] >= rank[level] and writes(jp, p_level, pattern, found) is True:
                pool[p_level].setdefault(pattern, []).append(jp)
    return pool


@lru_cache(maxsize=1)
def _snapshot() -> dict[str, dict[str, list[str]]]:
    try:
        return json.loads(SNAPSHOT.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}


def sentences(level: str, pattern: str) -> list[str]:
    """The sentences that write `pattern` (a point at `level`), as the
    snapshot holds them; [] where it holds none."""
    return list(_snapshot().get(level, {}).get(pattern, ()))
