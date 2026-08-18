"""
Single source of truth for study-mode identity.

Replaces study/quiz_modes.py, whose nine keys had grown ambiguous:
`flashcard` meant one thing under kana and another under grammar,
`write` meant "draw a kana" in one section and "draw a kanji" in
another, and `qcm-*` vs `flashcard-*` presented "how much help do you
want" as if it were a choice of exercise. A mode key now names exactly
one exercise on exactly one source, and the help level is a HINT the
learner switches on per card (see HINTS below), never a separate key.

── Key format ────────────────────────────────────────────────
    <source>.<base>[.<direction>]

`.` is the separator on purpose. It can never be a substring of another
key's segment, which is what made routes/decks.py's old
`return "flashcard" in mode` substring test possible in the first place;
and it is not `:`, which card ids already use structurally
(`get_leaderboard` does `split_part(card_id, ':', 1)`).

Namespacing is a clarity and validation win rather than a correctness
fix: card ids are already category-prefixed (`kana_…`, `kanji_{level}_…`,
`vocab_{level}_…`, `grammar_{level}_…`, `custom_{deck}_…`), so rows in
card_modes could never collide across sources even under a shared key.
What it buys is that each router can validate its OWN key set — a
`?mode=kanji.readings` on the vocab endpoint is now rejected rather than
silently materialising SRS rows — and that a row in the database says
what it is without a lookup table.

── Personal cards ────────────────────────────────────────────
A hand-authored card with a kanji/vocab/grammar structure studies under
THAT source's keys, not a set of its own. Its `custom_…` id keeps its
SRS progress separate, so sharing the mode key costs nothing and means
_build_kanji_card and friends can build personal cards too.

── Hints are not modes ───────────────────────────────────────
indice_1/2/3 are payload enrichment plus client render state. They are
never concatenated into a key, and SRS_MODES (the set every review
endpoint validates against) is what physically prevents a hint-forked
or ungraded key from reaching card_modes. What an SRS review consumes is
the learner's own 1-4 self-rating, which means the same thing whether or
not four choices happened to be on screen — so a hint must not fork a
track.
"""
from dataclasses import dataclass, field

# ── Hints ─────────────────────────────────────────────────────
# Wire names match the vocabulary the feature was specified in, so there
# is no translation layer between spec and code. Human labels live in the
# frontend locale files.
INDICE_CHOICES = "indice_1"    # MCQ choices
INDICE_SENTENCES = "indice_2"  # JP example sentences, translation hidden until revealed
INDICE_FURIGANA = "indice_3"   # furigana over the Japanese

HINTS = (INDICE_CHOICES, INDICE_SENTENCES, INDICE_FURIGANA)

# ── Sources ───────────────────────────────────────────────────
KANA = "kana"
KANJI = "kanji"
VOCAB = "vocab"
GRAMMAR = "grammar"
STANDARD = "standard"  # a hand-authored front/back card with no structure

SOURCES = (KANA, KANJI, VOCAB, GRAMMAR, STANDARD)

# ── Directions ────────────────────────────────────────────────
# f2b/b2f rather than the old kj-m/m-kj: the spec says "front to back",
# and "front" is source-relative (the kana glyph / the kanji / the
# Japanese word / the Japanese rule / the typed front of a personal
# card), which the old naming obscured by calling everything "kj".
F2B = "f2b"
B2F = "b2f"

# ── Base exercises ────────────────────────────────────────────
FLASHCARD = "flashcard"
WRITE_ROMAJI = "write_romaji"
WRITE_KANA = "write_kana"
WRITE_KANJI = "write_kanji"
READINGS = "readings"
RADICAL = "radical"
WORD_READING = "word_reading"
FILL_IN = "fill_in"
FAST_REVIEW = "fast_review"

# How the client renders a mode. Kept here rather than only in the
# frontend so the two cannot disagree about what a key *is*, only about
# how it looks.
RENDER_FLASHCARD = "flashcard"
RENDER_TYPE = "type"
RENDER_DRAW = "draw"
RENDER_FILL = "fill"
RENDER_BROWSE = "browse"


@dataclass(frozen=True)
class Mode:
    key: str
    source: str
    base: str
    direction: str | None = None
    hints: frozenset[str] = field(default_factory=frozenset)
    # False only for fast_review: an ungraded browse writes no SRS row,
    # so it must never reach card_modes or a review endpoint.
    graded: bool = True
    renderer: str = RENDER_FLASHCARD

    @property
    def is_flashcard(self) -> bool:
        return self.base == FLASHCARD


def _m(source, base, direction=None, hints=(), graded=True, renderer=RENDER_FLASHCARD) -> Mode:
    key = ".".join(p for p in (source, base, direction) if p)
    return Mode(
        key=key, source=source, base=base, direction=direction,
        hints=frozenset(hints), graded=graded, renderer=renderer,
    )


_CHOICES = (INDICE_CHOICES,)
_CHOICES_FURIGANA = (INDICE_CHOICES, INDICE_FURIGANA)
_CHOICES_SENTENCES = (INDICE_CHOICES, INDICE_SENTENCES)

# ── The registry ──────────────────────────────────────────────
# Ordered per source: this ordering is what the mode picker shows, so it
# is the spec's numbering, not alphabetical.
_ORDERED: dict[str, tuple[Mode, ...]] = {
    KANA: (
        _m(KANA, FLASHCARD, F2B, _CHOICES),
        _m(KANA, FLASHCARD, B2F, _CHOICES),
        _m(KANA, WRITE_ROMAJI, renderer=RENDER_TYPE),
        _m(KANA, WRITE_KANA, renderer=RENDER_DRAW),
    ),
    KANJI: (
        _m(KANJI, FLASHCARD, F2B, _CHOICES),
        _m(KANJI, FLASHCARD, B2F, _CHOICES),
        _m(KANJI, WRITE_KANJI, renderer=RENDER_DRAW),
        _m(KANJI, READINGS, renderer=RENDER_TYPE),
        _m(KANJI, RADICAL),
    ),
    VOCAB: (
        _m(VOCAB, FLASHCARD, F2B, _CHOICES_FURIGANA),
        _m(VOCAB, FLASHCARD, B2F, _CHOICES_FURIGANA),
        # Only vocab entries that actually contain kanji — for a kana-only
        # entry the prompt and the answer would be the same string. See
        # eligible_for().
        _m(VOCAB, WORD_READING),
    ),
    GRAMMAR: (
        _m(GRAMMAR, FLASHCARD, F2B, _CHOICES_SENTENCES),
        _m(GRAMMAR, FLASHCARD, B2F, _CHOICES_SENTENCES),
        # The sentence is shown INTACT and the learner names the rule at
        # work in it. Blanking the rule out was the obvious reading of
        # the spec but has no unique answer — 食べて＿＿＿ accepts いる,
        # から, もいい and はいけない alike — so it could not be graded
        # fairly.
        _m(GRAMMAR, FILL_IN, hints=_CHOICES, renderer=RENDER_FILL),
    ),
    STANDARD: (
        _m(STANDARD, FLASHCARD, F2B, _CHOICES),
        _m(STANDARD, FLASHCARD, B2F, _CHOICES),
    ),
}

# Ungraded, sourceless, and deliberately outside _ORDERED: fast_review is
# a browse over already-studied cards (the existing */review-cards
# endpoints + ReviewDeck), not an exercise. It takes no SRS row, so it
# must not appear in SRS_MODES; its f2b/b2f invertibility is runtime
# state in the component, not a second key.
FAST_REVIEW_MODE = Mode(
    key=FAST_REVIEW, source="", base=FAST_REVIEW, graded=False,
    renderer=RENDER_BROWSE, hints=frozenset((INDICE_FURIGANA,)),
)

MODES: dict[str, Mode] = {m.key: m for group in _ORDERED.values() for m in group}
MODES[FAST_REVIEW_MODE.key] = FAST_REVIEW_MODE

# Per source, in picker order, with the ungraded browse appended — which
# is what every mode picker actually offers.
MODES_FOR_SOURCE: dict[str, tuple[str, ...]] = {
    source: tuple(m.key for m in group) + (FAST_REVIEW,)
    for source, group in _ORDERED.items()
}

# The graded keys — the ONLY strings allowed to reach card_modes or
# review_log. Every card/stats endpoint and every ReviewPayload validates
# against this.
SRS_MODES: frozenset[str] = frozenset(m.key for m in MODES.values() if m.graded)

ALL_MODE_KEYS: tuple[str, ...] = tuple(MODES)

# Graded keys per source, for validation in require_mode().
GRADED_FOR_SOURCE: dict[str, frozenset[str]] = {
    source: frozenset(m.key for m in group) for source, group in _ORDERED.items()
}


class UnknownMode(ValueError):
    """Raised by resolve() for a key not in the registry."""


def resolve(key: str) -> Mode:
    try:
        return MODES[key]
    except KeyError:
        raise UnknownMode(f"Unknown study mode: {key!r}") from None


def try_resolve(key: str) -> Mode | None:
    return MODES.get(key)


# ── Status modes ──────────────────────────────────────────────
# What "do I already know this?" means for the dictionary's badges and
# for reading.py's known-word filter.
#
# This used to be a single mode, STATUS_MODE = "qcm-kj-m" — recognition
# WITH the answer among four choices. That key no longer exists (MCQ is a
# hint now), and its nearest equivalent, <source>.flashcard.f2b, is
# strictly harder because nothing is offered to pick from. Rather than
# silently raise the bar, "known" is now satisfied by ANY graded mode for
# that source reaching learning/mastered, which is both more forgiving
# and closer to what the badge claims. Callers take the max across these.
STATUS_MODES: dict[str, tuple[str, ...]] = {
    source: tuple(keys) for source, keys in GRADED_FOR_SOURCE.items()
}


# ── Card-pool eligibility ─────────────────────────────────────
# Three modes can only draw from a subset of their source's deck. The
# filter has to be applied to the card pool AND to the stats totals — if
# only the pool is filtered, vocab.word_reading's mastery bar is scored
# out of 8,405 while only 7,308 cards can ever be reached, so it can
# never reach 100%.
def eligible_for(mode: Mode, entry: dict) -> bool:
    """Can this deck entry be served in this mode?"""
    if mode.base == WORD_READING:
        # Prompt would equal the answer for a kana-only entry.
        return bool((entry.get("kanji") or "").strip())
    if mode.base == RADICAL:
        # Needs a radical number; content/radical_data.py owns the lookup,
        # so the router passes it in on the entry.
        return entry.get("radical") is not None
    if mode.base == FILL_IN:
        # Needs at least one cached sentence that verifiably contains the
        # rule — see study/grammar_match.py. Absent that, the mode has no
        # answerable card and is hidden rather than served empty.
        return bool(entry.get("fill_ok"))
    return True


def resolve_for_source(source: str, key: str) -> Mode | None:
    """
    The lookup every router should use: accepts a current key belonging
    to `source`, or a legacy key for that source during the alias window.
    Returns None for anything else, so the caller can 400 rather than
    letting an unrecognised string reach the SRS.
    """
    mode = MODES.get(key)
    if mode is not None and mode.key in GRADED_FOR_SOURCE.get(source, frozenset()):
        return mode
    return None


def require_mode(source: str):
    """
    FastAPI dependency factory. Every card/cards/stats endpoint should
    take `m: Mode = Depends(require_mode("<source>"))` instead of a bare
    `mode: str`, which fixes four separate defects at once:

    - routes/kana.py had NO mode validation at all, so `?mode=banana`
      reached srs.ensure_cards and materialised a card_modes row for every
      card in the set under a garbage key.
    - routes/vocab.py:82 and routes/theme_vocab.py:68 did `MODE_INFO[mode]`
      with no escape hatch, so a key admitted by a valid-modes set but
      absent from that dict 500'd the endpoint (KeyError). Same shape at
      routes/kanji.py:116 and routes/frequency.py:121 after their `write`
      early-return.
    - a mode belonging to a DIFFERENT source was accepted wherever the
      key happened to exist in the target's dict.
    - a 400 gives the client something to show. The old behaviour was
      `{"cards": []}` or a 200 with an `{"error": ...}` body, which the
      frontend read as "deck exhausted" and celebrated — see the
      companion fix in lib/api.js.

    The old flat key space ('qcm-m-kj', 'flashcard', 'fill') is no longer
    accepted. It was, through a LEGACY_ALIASES table, for exactly as long
    as the frontend needed to catch up -- every screen now emits registry
    keys, useCardSession's CACHE_VERSION retires any session that still
    held an old one, and the SRS wipe cleared the rows written under them.
    A permanent alias table would have kept the ambiguity it existed to
    retire quietly alive in the database.
    """
    from fastapi import HTTPException, Query  # local: keeps this module importable without FastAPI

    def dependency(mode: str = Query(...)) -> Mode:
        resolved = resolve_for_source(source, mode)
        if resolved is None:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid mode for {source}: {mode!r}",
            )
        return resolved

    return dependency


def describe() -> list[dict]:
    """
    Registry dump for GET /api/study/modes — lets the client render a
    picker (and per-level availability) without duplicating the table,
    and doubles as a debugging surface.
    """
    out = []
    for source, keys in MODES_FOR_SOURCE.items():
        for key in keys:
            m = MODES[key]
            out.append({
                "key": m.key,
                "source": source,
                "base": m.base,
                "direction": m.direction,
                "hints": sorted(m.hints),
                "graded": m.graded,
                "renderer": m.renderer,
            })
    return out
