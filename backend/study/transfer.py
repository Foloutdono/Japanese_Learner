"""
乗換 — progress brought across from another app (plans 243, 243b).

A learner who studied in Anki, WaniKani or Renshuu before boarding here
knows words this app would deal them as new. Their old app says which,
and how well: each card's interval, its ease, the day it is next due.
This module turns that into the course's cards and the rows
SRSEngine.seed_imported writes for them.

── What arrives ───────────────────────────────────────────────
Nothing is fetched or opened here. An .apkg or .colpkg is a zip holding
a SQLite collection and, usually, hundreds of megabytes of media; the
learner's device opens it (frontend/src/lib/anki/), or reads their
WaniKani or Renshuu account through that app's own API with a key that
never leaves it (frontend/src/lib/transfer/), and sends only what
matching needs, in one shape for all three: for each note -- an Anki
note, a WaniKani subject, a Renshuu term -- its note type (an index),
its fields cut down to the short Japanese ones (anything else is sent
empty, so a field keeps its position), and the schedule of its
strongest graduated card -- interval, ease (or FSRS difficulty) and the
day it is due, counted from the learner's today. An item the old app
has not taught yet is not sent. Nothing of it is kept but the rows
written for the cards it matched.

── Matching ───────────────────────────────────────────────────
Decks name their fields as they please (Expression, Vocabulary-Kanji,
Front, 単語, Kanji ...), so nothing is read from a field's name. Per
note type, the WORD field is the one whose values most often resolve to
a course card, and its kind -- vocab, kanji or kana -- the kind they
resolve to: a kanji deck's 日 is the kanji, a vocab deck's 日 the word.
A vocab type's READING field is then the one whose kana most often is a
reading of the word field's candidates. Only the word field is ever
matched: an example or a related-words field would otherwise give a
note a card that is not its word.

A written form resolves to the deck entries written that way (or by a
conventional kana spelling of it, 子ども for 子供, as card_lookup's
indexes allow), narrowed by the note's reading -- its own furigana
first, then the reading field. A reading that is none of theirs says
the note is another word (今日 read こんにち is not the N5 きょう), and
it matches nothing. Two entries left standing is no match either:
writing the wrong card's schedule is worse than leaving one to be met
as new. A form in kana alone matches only a deck word written in kana
alone, never a kanji word that happens to read so: はし is three
words, かぐ two.

── Scheduling ─────────────────────────────────────────────────
An imported card is an assumption (plan 224): Anki's history is not
this app's, and the card's first answer here is a check (srs.is_assumed),
missed and the card starts as new, passed and it spends nothing of the
day's pace. It is written in the card's line's primary mode only, one
row per item as the level rule writes, with Anki's interval (capped as
the scheduler caps one) and its ease read onto the scheduler's
difficulty, the two being the same multiplier: Anki's 250% is a
difficulty of 2.5 here. A card due in Anki keeps its day; one already
due, or overdue, has its check spread over the level rule's six weeks,
weakest first, so a collection left for a season does not arrive as one
day's wall.
"""
from __future__ import annotations

import re
import unicodedata
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from functools import lru_cache
from typing import NamedTuple

from content.kana_data import KANA_SETS, kana_to_id
from content.kanji_data import KANJI_BY_LEVEL, kanji_to_id
from content.vocab_data import VOCAB_BY_LEVEL, vocab_to_id
from content.vocab_renames import FOLDED_FORMS
from content import vocab_extras
from srs.scheduler import MAX_DIFFICULTY, MAX_INTERVAL_DAYS, MIN_DIFFICULTY
from study import card_index
from study.difficulty import LEVELS
from study.level_rule import SPREAD_DAYS, primary_mode
from study.modes import KANA, KANJI, VOCAB
from study.morphology import kata_to_hira

# ── Bounds (plan 211) ─────────────────────────────────────────
# What one import may send. Twenty thousand notes is past the largest
# Japanese decks learners share (Core 6k, the 8k JLPT sets, RTK's 3,000
# kanji) with room for a whole collection; at the client's trimmed
# encoding it stays well under the proxy's 4.5 MB.
MAX_NOTES = 20_000
MAX_TYPES = 64
MAX_FIELDS = 16
# A field longer than this is a sentence or a note, never a word: the
# client sends it empty, and so is it read here.
MAX_FIELD = 40
# How many of the words the course lacks are named back to the learner.
SAMPLE = 12

# The kinds a note type can be, in the order a tie between them goes.
KINDS = (VOCAB, KANJI, KANA)
AMBIGUOUS = object()


@dataclass(frozen=True)
class Note:
    """One note as the device sent it (see the module's docstring)."""
    type: int
    fields: tuple[str, ...]
    interval: int
    ease: int = 0                 # SM-2 ease in permille; 0 under FSRS
    fsrs: float | None = None     # FSRS difficulty, 1 (easy) to 10
    due: int = 0                  # days from today; 0 or less is due now


class Form(NamedTuple):
    """A field's word: as written, and its reading in hiragana ("" when
    the field gives none)."""
    written: str
    reading: str


# ── Reading a field ───────────────────────────────────────────

def _is_kanji(ch: str) -> bool:
    return "一" <= ch <= "鿿" or "㐀" <= ch <= "䶿" or ch in "々〆"


def _is_kana(ch: str) -> bool:
    return "ぁ" <= ch <= "ゟ" or "゠" <= ch <= "ヿ"


def _has_kanji(text: str) -> bool:
    return any(_is_kanji(c) for c in text)


def _japanese(text: str) -> bool:
    return bool(text) and all(_is_kanji(c) or _is_kana(c) for c in text)


def _kana_only(text: str) -> bool:
    return bool(text) and all(_is_kana(c) for c in text)


# Anki's furigana: `漢字[かんじ]`, the base reaching back to the last
# space (` 毎日[まいにち] 食[た]べる`), a pitch mark after `;` or `,`
# inside the bracket.
_FURIGANA = re.compile(r" ?([^ \[\]]+?)\[([^\]]*)\]")
# A reading in brackets after the word: 食べる（たべる）, NFKC having
# made the brackets ASCII.
_PAREN = re.compile(r"^(.+?)\s*\(([ぁ-ヿ]+)\)$")
# What a dictionary-style field hangs off a word: 勉強(する), 静か(な).
_MARKERS = ("する", "な", "の")
# Alternatives within a field: 見る、観る / 見る, 観る / 見る;観る.
_SPLIT = re.compile(r"[、,/;・\s]+")
_TRIM = "~〜…「」『』【】。.!?！？:：\"' "


def _furigana_reading(base: str, kana: str) -> str:
    """The reading a `base[kana]` group stands for. A base that opens on
    kana keeps it when the bracket does not repeat it -- お茶[ちゃ] is
    おちゃ, お茶[おちゃ] too."""
    kana = re.split(r"[;,]", kana, maxsplit=1)[0]
    head = ""
    for ch in base:
        if _is_kanji(ch):
            break
        head += ch
    return kana if kana.startswith(head) else head + kana


def _furigana(text: str) -> Form:
    written = _FURIGANA.sub(lambda m: m.group(1), text).replace(" ", "")
    reading = _FURIGANA.sub(lambda m: _furigana_reading(m.group(1), m.group(2)), text).replace(" ", "")
    return Form(written.strip(_TRIM), kata_to_hira(reading.strip(_TRIM)))


def _plain(part: str) -> list[Form]:
    part = part.strip(_TRIM)
    m = _PAREN.match(part)
    if m and m.group(2) in _MARKERS:
        word = m.group(1).strip(_TRIM)
        return [Form(word, ""), Form(word + m.group(2), "")]
    if m:
        return [Form(m.group(1).strip(_TRIM), kata_to_hira(m.group(2)))]
    return [Form(part, "")]


@lru_cache(maxsize=65536)
def forms(text: str) -> tuple[Form, ...]:
    """The words a field may be, most likely first: the whole field,
    then each of its alternatives. Only forms written in Japanese
    script are kept, so a gloss, a number or a sentence with its
    punctuation yields nothing."""
    text = unicodedata.normalize("NFKC", text or "").strip()
    if not text or len(text) > MAX_FIELD:
        return ()
    if "[" in text:
        found = [_furigana(text)]
    else:
        parts = [text, *(p for p in _SPLIT.split(text) if p and p != text)]
        found = [f for part in parts for f in _plain(part)]
    out: dict[Form, None] = {}
    for f in found:
        if _japanese(f.written) and (not f.reading or _kana_only(f.reading)):
            out[f] = None
    return tuple(out)


def reading_of(text: str) -> str:
    """The reading a field gives, in hiragana: its furigana's, or the
    field itself when it is written in kana alone. "" otherwise."""
    for f in forms(text):
        if f.reading:
            return f.reading
        if _kana_only(f.written):
            return kata_to_hira(f.written)
    return ""


# ── The course, indexed for matching ──────────────────────────

class _Cand(NamedTuple):
    raw_id: str
    readings: frozenset[str]


class _Index(NamedTuple):
    written: dict[str, list[_Cand]]     # a written form with kanji
    kana: dict[str, list[_Cand]]        # a kana word, as written
    folded: dict[str, list[_Cand]]      # a kana word, in hiragana
    kanji: dict[str, str]               # a character -> its kanji card
    signs: dict[str, str]               # a kana sign -> its kana card


def _readings(kana: str) -> list[str]:
    # The deck joins readings with "/" (毎月 is まいげつ/まいつき).
    return [r.strip() for r in (kana or "").replace(";", "/").split("/") if r.strip()]


def _add(table: dict[str, list[_Cand]], key: str, cand: _Cand) -> None:
    held = table.setdefault(key, [])
    if all(c.raw_id != cand.raw_id for c in held):
        held.append(cand)


@lru_cache(maxsize=1)
def _index() -> _Index:
    """Built once: the content is static (card_index's reason)."""
    written: dict[str, list[_Cand]] = {}
    kana: dict[str, list[_Cand]] = {}
    folded: dict[str, list[_Cand]] = {}
    vocab_mode = primary_mode(VOCAB)
    entries = [
        (vocab_to_id(entry, level), entry)
        for level in LEVELS
        for entry in VOCAB_BY_LEVEL.get(level, [])
    ]
    entries = [(raw, e) for raw, e in entries if card_index.locate(raw, vocab_mode) is not None]

    def word(raw: str, kanji: str, readings: list[str]) -> None:
        cand = _Cand(raw, frozenset(kata_to_hira(r) for r in readings))
        if _has_kanji(kanji):
            _add(written, kanji, cand)
            return
        for r in readings + ([kanji] if kanji else []):
            _add(kana, r, cand)
            _add(folded, kata_to_hira(r), cand)

    for raw, entry in entries:
        word(raw, (entry.get("kanji") or "").strip(), _readings(entry.get("kana")))
        # A spelling folded into this card (plan 112) is this card.
        for kanji, kana_ in FOLDED_FORMS.get(raw, ()):
            word(raw, (kanji or "").strip(), _readings(kana_))
    # Conventional kana spellings (子ども for 子供, ご飯 for 御飯), second
    # and only where no deck word is written so: strictly additive, as
    # card_lookup's indexes add them.
    variants: dict[str, list[_Cand]] = {}
    for raw, entry in entries:
        kanji = (entry.get("kanji") or "").strip()
        if not _has_kanji(kanji):
            continue
        readings = _readings(entry.get("kana"))
        cand = _Cand(raw, frozenset(kata_to_hira(r) for r in readings))
        for v in (*vocab_extras.kana_spelling_variants(kanji),
                  *vocab_extras.trailing_kana_variants(kanji, entry.get("kana") or "")):
            if v != kanji and v not in written and _has_kanji(v):
                _add(variants, v, cand)
    written.update(variants)

    kanji_mode = primary_mode(KANJI)
    kanji: dict[str, str] = {}
    for level in LEVELS:
        for entry in KANJI_BY_LEVEL.get(level, []):
            raw = kanji_to_id(entry, level)
            if card_index.locate(raw, kanji_mode) is not None:
                kanji.setdefault(entry["kanji"], raw)

    kana_mode = primary_mode(KANA)
    signs: dict[str, str] = {}
    for set_entries in KANA_SETS.values():
        for entry in set_entries:
            raw = kana_to_id(entry)
            if card_index.locate(raw, kana_mode) is not None:
                signs.setdefault(entry["kana"], raw)

    return _Index(written, kana, folded, kanji, signs)


def _vocab_candidates(form: Form) -> list[_Cand]:
    idx = _index()
    if _has_kanji(form.written):
        return idx.written.get(form.written, [])
    return idx.kana.get(form.written) or idx.folded.get(kata_to_hira(form.written), [])


def resolve(kind: str, form: Form, reading: str = ""):
    """The raw card id `form` is in `kind`, AMBIGUOUS, or None.

    `reading` is the note's, from its reading field; the form's own
    furigana comes first. A word in kana alone is its own reading."""
    idx = _index()
    if kind == KANJI:
        return idx.kanji.get(form.written) if len(form.written) == 1 else None
    if kind == KANA:
        return idx.signs.get(form.written)
    cands = _vocab_candidates(form)
    if not cands:
        return None
    wanted = "" if not _has_kanji(form.written) else (form.reading or reading)
    if wanted:
        cands = [c for c in cands if wanted in c.readings]
        if not cands:
            return None
    return cands[0].raw_id if len(cands) == 1 else AMBIGUOUS


# ── Matching a collection ─────────────────────────────────────

@dataclass
class TypeMatch:
    """How a note type was read: which field is the word, as which kind,
    and which field gives its reading (vocab only)."""
    type: int
    notes: int
    field: int | None = None
    kind: str | None = None
    reading: int | None = None


@dataclass
class Match:
    notes: int = 0
    # (source, raw id) -> the strongest note that matched it.
    hits: dict[tuple[str, str], Note] = field(default_factory=dict)
    unmatched: int = 0
    sample: list[str] = field(default_factory=list)
    types: list[TypeMatch] = field(default_factory=list)


def _word_field(notes: list[Note]) -> tuple[int, str] | None:
    """The (field, kind) whose values most often resolve, or None. A
    tie goes to the earlier field, then to vocab over kanji over kana."""
    counts: Counter = Counter()
    for note in notes:
        for f, text in enumerate(note.fields):
            fs = forms(text)
            if not fs:
                continue
            for kind in KINDS:
                if any(isinstance(resolve(kind, form), str) for form in fs):
                    counts[(f, kind)] += 1
    if not counts:
        return None
    return max(counts, key=lambda k: (counts[k], -k[0], -KINDS.index(k[1])))


def _reading_field(notes: list[Note], word: int) -> int | None:
    """The field whose kana most often reads the word field's written
    form as one of its deck entries do."""
    counts: Counter = Counter()
    for note in notes:
        fs = forms(note.fields[word]) if word < len(note.fields) else ()
        readings = {r for form in fs if _has_kanji(form.written)
                    for c in _vocab_candidates(form) for r in c.readings}
        if not readings:
            continue
        for g, text in enumerate(note.fields):
            if g != word and text and reading_of(text) in readings:
                counts[g] += 1
    if not counts:
        return None
    return max(counts, key=lambda g: (counts[g], -g))


def _stronger(a: Note, b: Note) -> Note:
    return a if (a.interval, -a.due) >= (b.interval, -b.due) else b


def match(notes: list[Note]) -> Match:
    """Every note matched to the course's cards, per note type."""
    out = Match(notes=len(notes))
    by_type: dict[int, list[Note]] = {}
    for note in notes:
        by_type.setdefault(note.type, []).append(note)
    for t in sorted(by_type):
        group = by_type[t]
        tm = TypeMatch(type=t, notes=len(group))
        out.types.append(tm)
        found = _word_field(group)
        if found is not None:
            tm.field, tm.kind = found
            if tm.kind == VOCAB:
                tm.reading = _reading_field(group, tm.field)
        for note in group:
            raw = None
            text = note.fields[tm.field] if tm.field is not None and tm.field < len(note.fields) else ""
            reading = (reading_of(note.fields[tm.reading])
                       if tm.reading is not None and tm.reading < len(note.fields) else "")
            for form in forms(text):
                hit = resolve(tm.kind, form, reading)
                if isinstance(hit, str):
                    raw = hit
                    break
            if raw is None:
                out.unmatched += 1
                named = forms(text) or next((forms(f) for f in note.fields if forms(f)), ())
                if named and len(out.sample) < SAMPLE and named[0].written not in out.sample:
                    out.sample.append(named[0].written)
                continue
            key = (tm.kind, raw)
            out.hits[key] = _stronger(note, out.hits[key]) if key in out.hits else note
    return out


def counts(m: Match) -> dict:
    """What was matched, per source and per level, for the preview."""
    by_source: Counter = Counter()
    by_level: Counter = Counter()
    for source, raw in m.hits:
        by_source[source] += 1
        located = card_index.locate(raw, primary_mode(source))
        if located and located[1] in LEVELS:
            by_level[located[1]] += 1
    return {
        "bySource": {s: by_source.get(s, 0) for s in KINDS},
        "byLevel": {lvl: by_level.get(lvl, 0) for lvl in LEVELS},
    }


# ── Scheduling ────────────────────────────────────────────────

class Row(NamedTuple):
    """A card's imported schedule, before the user prefix."""
    source: str
    raw_id: str
    mode: str
    difficulty: float
    interval_days: int
    next_review: datetime


def difficulty_of(note: Note) -> float:
    """The scheduler's difficulty for an Anki card. FSRS's (1 to 10)
    is laid onto the scheduler's range; SM-2's ease is the scheduler's
    own multiplier (scheduler._grow: ease = MIN + MAX - difficulty), so
    Anki's 250% is 2.5 here and its floor of 130% the hardest card."""
    span = MAX_DIFFICULTY - MIN_DIFFICULTY
    if note.fsrs is not None:
        d = min(10.0, max(1.0, note.fsrs))
        return round(MIN_DIFFICULTY + (d - 1) / 9 * span, 2)
    if note.ease > 0:
        return round(min(MAX_DIFFICULTY, max(MIN_DIFFICULTY, MIN_DIFFICULTY + MAX_DIFFICULTY - note.ease / 1000)), 2)
    return round(MIN_DIFFICULTY + span / 2, 2)


def rows(m: Match, now: datetime, kept: frozenset = frozenset()) -> list[Row]:
    """The rows to write for every card matched but those `kept` (the
    (source, raw id) already studied here, which seed_imported would
    leave alone): due in Anki, the same day; due now or overdue, spread
    over SPREAD_DAYS, shortest interval first, the i-th of n at
    SPREAD_DAYS * (i + 1) / n (seed_known's spread)."""
    out: list[Row] = []
    due_now: list[tuple[int, int, str, str, float]] = []
    for (source, raw), note in sorted(m.hits.items()):
        if (source, raw) in kept:
            continue
        interval = max(1, min(MAX_INTERVAL_DAYS, int(note.interval)))
        difficulty = difficulty_of(note)
        if note.due >= 1:
            when = now + timedelta(days=min(int(note.due), MAX_INTERVAL_DAYS))
            out.append(Row(source, raw, primary_mode(source), difficulty, interval, when))
        else:
            due_now.append((interval, note.due, source, raw, difficulty))
    due_now.sort()
    n = len(due_now)
    for i, (interval, _due, source, raw, difficulty) in enumerate(due_now):
        when = now + timedelta(days=SPREAD_DAYS * (i + 1) / n)
        out.append(Row(source, raw, primary_mode(source), difficulty, interval, when))
    return out


def overdue(m: Match, kept: frozenset = frozenset()) -> int:
    """How many of the matched cards, but those `kept`, are due now or
    overdue in Anki -- the checks rows() spreads."""
    return sum(1 for key, note in m.hits.items() if note.due < 1 and key not in kept)
