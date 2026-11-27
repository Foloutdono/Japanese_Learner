"""
Matching a pasted row to the app's own card (plan 335: the import dialog's
"use the app's card" step).

A learner who pastes 水 / water / みず into a vocab deck is holding, in
the app, a card the app already teaches: with its examples, its audio,
its levels and every other learner's well-checked gloss. Written out as a
personal card it is a second, lonelier copy. This module finds the app
card a row means so the dialog can offer it; the learner decides.

Nothing here writes. It reads the course's own decks (the same ones the
browse picker searches, `routes/decks.SOURCES`) and never guesses past
what the row says:

  * a written form (水, 〜てください, ヴ) matches the card whose face it
    is, after folding width, case, spaces and a pattern's leading 〜;
  * a word typed in kana matches a kana-only card outright and a kanji
    card as a reading only -- a *possible* match, never an exact one,
    since many words read みず;
  * a row that also gives a reading holds the card to it: a card whose
    reading disagrees is still offered (the learner may spell it
    otherwise) but never as the exact one;
  * the meaning only ranks. Two cards written alike (毎日, two readings
    of 日) are told apart by which meaning the learner's own text shares
    words with, and a tie stays a tie.

A match is `exact` only when one card stands alone at the top, so the
dialog may default to it. Anything else is offered and left to the
learner.
"""
from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from functools import lru_cache

from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL, grammar_to_id
from content.kana_data import KANA_SETS, kana_to_id
from content.kanji_data import KANJI_BY_LEVEL, kanji_to_id
from content.vocab_data import VOCAB_BY_LEVEL, vocab_to_id

# How many candidates one row is offered, best first.
MAX_CANDIDATES = 4

# The deck structures the dialog can match for, and the sources each reads:
# the same table the browse picker enforces (routes/decks.SOURCE_FOR_TYPE),
# restated here so the module stands without the router. A test holds them
# equal. `standard` is absent: a plain front/back deck holds no app card.
SOURCES_FOR_TYPE = {
    "kana":    ("kana",),
    "kanji":   ("kanji",),
    "vocab":   ("vocab",),
    "grammar": ("grammar",),
    "mixed":   ("vocab", "grammar", "kanji", "kana"),
    "lyrics":  ("vocab", "grammar", "kanji", "kana"),
}

# A row's front and meaning, by deck structure. A mixed or lyrics deck's
# written cards are standard pairs.
_FRONT_KEYS = ("front", "word", "kanji", "kana", "rule")
_BACK_KEYS = ("back", "meaning", "romaji")

# Score. A written hit is what a card IS; a reading hit is only what it
# sounds like. The reading and the meaning then break ties between
# homographs; they never lift a reading hit to a written one.
_WRITTEN = 6
_READING_OF_KANA_ONLY = 6
_READING_OF_KANJI = 2
_READING_AGREES = 2
_READING_DISAGREES = -3
_MEANING_AGREES = 1
_EXACT_FROM = _WRITTEN


@dataclass(frozen=True)
class Candidate:
    source: str
    level: str
    raw_id: str
    entry: dict = field(compare=False, repr=False)
    score: int = 0
    # "written" the card's own face matched; "reading" only its sound did.
    via: str = "written"
    # The card's reading and the learner's meaning share a word.
    meaning_agrees: bool = False
    exact: bool = False


# ── folding ───────────────────────────────────────────────────

_WS = re.compile(r"\s+")
# A pattern's leading mark: 〜 ～ ~ … , and the ellipsis in the middle of
# 〜から〜まで is kept (it is part of the pattern).
_PATTERN_EDGE = "〜～~…・ "
_SLASH_FORMS = re.compile(r"[/／;；]")
_WORD = re.compile(r"[a-z0-9áéíóúñüàâçèêëîïôùûœ]+", re.IGNORECASE)
# Words too common to say two meanings are alike.
_STOP = frozenset((
    "to", "a", "an", "the", "of", "be", "or", "and", "in", "on", "for",
    "de", "la", "le", "les", "un", "une", "du", "des", "et", "ou", "se",
    "el", "los", "las", "una", "y", "o", "en", "con", "que", "yang", "dan",
    "something", "someone", "one", "s",
))


def fold(text) -> str:
    """Width, case and spaces folded, for comparing two spellings."""
    s = unicodedata.normalize("NFKC", str(text or ""))
    return _WS.sub("", s).casefold()


def _pattern_fold(text) -> str:
    return fold(text).strip(_PATTERN_EDGE)


def _meaning_words(text) -> frozenset[str]:
    folded = unicodedata.normalize("NFKD", str(text or "")).casefold()
    folded = "".join(c for c in folded if not unicodedata.combining(c))
    return frozenset(w for w in _WORD.findall(folded) if len(w) > 1 and w not in _STOP)


def _kana_forms(kana: str) -> list[str]:
    """A card's readings: 'まいげつ/まいつき' is two, 'ド・ト・つち' (a kanji's)
    is not a word's and is never read here."""
    return [f for f in (fold(p) for p in _SLASH_FORMS.split(kana or "")) if f]


# ── the index ─────────────────────────────────────────────────

@lru_cache(maxsize=1)
def _index() -> dict:
    """What every source can be looked up by, built once.

    {source: {key: [(level, raw_id, entry, via)]}}. Learner-independent
    and bounded by the course, so it is computed once per process.
    """
    out: dict[str, dict[str, list]] = {s: {} for s in ("vocab", "kanji", "kana", "grammar")}

    def put(source, key, row):
        if key:
            bucket = out[source].setdefault(key, [])
            if row not in bucket:
                bucket.append(row)

    for level, entries in VOCAB_BY_LEVEL.items():
        for e in entries:
            raw = vocab_to_id(e, level)
            written = fold(e.get("kanji"))
            if written:
                put("vocab", written, (level, raw, e, "written"))
            for form in _kana_forms(e.get("kana")):
                # A kana-only card IS its kana; a kanji card is only read so.
                put("vocab", form, (level, raw, e, "written" if not written else "reading"))
    for level, entries in KANJI_BY_LEVEL.items():
        for e in entries:
            put("kanji", fold(e.get("kanji")), (level, kanji_to_id(e, level), e, "written"))
    for set_key, entries in KANA_SETS.items():
        for e in entries:
            put("kana", fold(e.get("kana")), (set_key, kana_to_id(e), e, "written"))
    for level, entries in GRAMMAR_POINTS_BY_LEVEL.items():
        for e in entries:
            pattern = e.get("pattern") or e.get("grammar") or ""
            raw = grammar_to_id(e, level)
            put("grammar", _pattern_fold(pattern), (level, raw, e, "written"))
            # 〜ている／ていた is two spellings of one point.
            parts = [p for p in re.split(r"[／/・、,]", pattern) if p.strip()]
            if len(parts) > 1:
                for p in parts:
                    put("grammar", _pattern_fold(p), (level, raw, e, "reading"))
    return out


# ── a row ─────────────────────────────────────────────────────

def _first(fields: dict, keys) -> str:
    for k in keys:
        v = fields.get(k)
        if isinstance(v, str) and v.strip():
            return v.strip()
    return ""


def candidates(deck_type: str, fields: dict, meaning_of=None) -> list[Candidate]:
    """The app cards a row may mean, best first, at most MAX_CANDIDATES.

    `fields` is the row as the deck's structure holds it. `meaning_of` is
    `(source, entry) -> text` in the learner's language, so the learner's
    own words are compared with the gloss they would be shown, not with
    the English the deck is keyed on; without it the entry's own is used.
    """
    sources = SOURCES_FOR_TYPE.get(deck_type)
    if not sources:
        return []
    front = _first(fields, _FRONT_KEYS)
    if not front:
        return []
    own_meaning = _meaning_words(_first(fields, _BACK_KEYS))
    reading = fold(fields.get("reading")) if isinstance(fields.get("reading"), str) else ""
    index = _index()

    found: dict[tuple[str, str], Candidate] = {}
    for source in sources:
        key = _pattern_fold(front) if source == "grammar" else fold(front)
        for level, raw_id, entry, via in index[source].get(key, ()):
            score = _WRITTEN if via == "written" else (
                _READING_OF_KANA_ONLY if not entry.get("kanji") else _READING_OF_KANJI
            )
            if source == "grammar" and via == "reading":
                score = _READING_OF_KANJI
            # A reading the row gives holds the card to it. Only a vocab
            # row can carry one (the structure's own `reading` field).
            if source == "vocab" and reading and via == "written" and entry.get("kanji"):
                forms = _kana_forms(entry.get("kana"))
                score += _READING_AGREES if reading in forms else _READING_DISAGREES
            agrees = False
            if own_meaning:
                gloss = meaning_of(source, entry) if meaning_of else entry.get("meaning")
                if own_meaning & _meaning_words(gloss):
                    agrees = True
                    score += _MEANING_AGREES
            cand = Candidate(source, level, raw_id, entry, score, via, agrees)
            prior = found.get((source, raw_id))
            if prior is None or cand.score > prior.score:
                found[(source, raw_id)] = cand

    ranked = sorted(
        found.values(),
        key=lambda c: (-c.score, sources.index(c.source), c.level, c.raw_id),
    )[:MAX_CANDIDATES]
    if not ranked:
        return []
    # Exact: one card alone at the top and a written hit. Two cards that
    # tie, or a lone reading hit, are the learner's to decide.
    top = ranked[0]
    alone = len(ranked) == 1 or ranked[1].score < top.score
    if alone and top.via == "written" and top.score >= _EXACT_FROM:
        ranked[0] = Candidate(top.source, top.level, top.raw_id, top.entry,
                              top.score, top.via, top.meaning_agrees, True)
    return ranked
