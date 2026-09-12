import json
import logging
import random
import re
import unicodedata
from functools import lru_cache

from fastapi import APIRouter, Depends, HTTPException, Query
from core.credits import require_pass
from pydantic import BaseModel, Field

from core.db import db_conn
from core.auth import get_user_id, unprefixed
from core.srs_instance import srs
from core.user_level import resolve_level
from study.card_lookup import (
    find_segments_in_text, attach_stats_to_segments, VOCAB_STATUS_MODES,
    vocab_card_id_for_word,
)
from content.kanji_data import get_kanji_string
from content.vocab_data import VOCAB_BY_LEVEL, vocab_to_id
from content import vocab_extras
from content import reading_sentences
from study import difficulty
from study.llm_shared import chat, llm_configured, LLMUnavailable
from study.romaji import sentence_romaji
import content.vocab_jmdict_data as jmdict_db
import content.frequency_data as freq

# A pass feature (plan 069): every route here refuses a free learner
# with 402 pass_required once CREDITS_ENFORCE=1; a no-op until then.
router = APIRouter(dependencies=[Depends(require_pass)])
logger = logging.getLogger(__name__)


# ── Schema ───────────────────────────────────────────────────────────
#
# reading_log is declared in srs/data_structure.sql and created only by
# loading that file -- unlike translation_log, this module has never
# owned its table. So this is an ALTER only, exactly as phrase.py does
# for the equally schema-file-only phrase_history: adding a second
# CREATE TABLE definition here would give the same table two
# definitions free to drift, and would drag in reading_log's
# `level TEXT NOT NULL` question that post_reading_result currently
# dodges by coalescing to ''. That is a separate decision from adding
# one column.
#
# The screen grades with the app's six-segment rating bar, so the
# learner's answer carries more than pass/fail. `correct` stays -- it is
# what every existing reader and every row written before this
# understands -- and `quality` records the rating it was derived from,
# 0..5 worst-to-best, exactly as RatingBar emits it.
#
# NULLable on purpose: every row logged before this column existed
# genuinely has no rating, and a default would invent one. A reader has
# to treat NULL as "graded, resolution unknown" rather than as a score.
def _migrate_reading_log_schema() -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "ALTER TABLE reading_log ADD COLUMN IF NOT EXISTS quality SMALLINT"
            )
        conn.commit()
    finally:
        conn.close()


try:
    _migrate_reading_log_schema()
except Exception:  # pragma: no cover - a missing DB must not stop import
    logger.exception("reading_log schema migration failed")

# Model selection, provider fallback and the dead-model/dead-provider
# bookkeeping all live in study/llm_shared.py now -- this module used to
# carry its own byte-near-identical copy of that loop. Consolidated
# 2026-08 when a SECOND provider (NVIDIA) was added: llm_shared's header
# named exactly this condition for revisiting the deliberate
# duplication, and keeping three copies of the provider list would have
# meant Reading Comprehension silently staying on the exhausted
# OpenRouter account while everything else failed over.

# Display time scales with phrase length, clamped to a sane range. Tune freely.
MIN_DISPLAY_SECONDS = 5
MAX_DISPLAY_SECONDS = 25
SECONDS_PER_CHAR = 0.6
BASE_SECONDS = 3.0

# Best-effort code -> name mapping so the LLM gets an unambiguous instruction
# even if it only recognizes ISO codes loosely. Still used by Reading
# Comprehension below.
LANG_NAMES = {
    "en": "English",
    "fr": "French",
    "es": "Spanish",
    "de": "German",
    "ja": "Japanese",
    "it": "Italian",
    "pt": "Portuguese",
}

# A level's allowed kanji pool includes every level at or below it, since
# JLPT levels are cumulative. Still used by Reading Comprehension below
# (constrains the LLM's kanji choice) — the phrase mode below doesn't
# need this anymore: real example sentences aren't generated against an
# allow-list, they just come from whatever level/tier/mastery pool the
# learner picked.
LEVEL_HIERARCHY = {
    "N5": ("N5",),
    "N4": ("N5", "N4"),
    "N3": ("N5", "N4", "N3"),
    "N2": ("N5", "N4", "N3", "N2"),
    "N1": ("N5", "N4", "N3", "N2", "N1"),
}

MIN_BATCH = 1
MAX_BATCH = 10
DEFAULT_BATCH = 5


class ResultPayload(BaseModel):
    source: str            # compact log label — see _source_label()
    level: str | None = None
    phrase: str
    romaji: str
    answer: str
    correct: bool
    # 0..5, worst to best, as RatingBar emits it. Optional so an older
    # client that still posts only `correct` keeps working; the bound is
    # enforced here rather than by a CHECK so a bad value is a 422 the
    # caller can read, not a 500 from the driver.
    quality: int | None = Field(default=None, ge=0, le=5)
    # The sentence's source word, straight from the batch payload, so the
    # rating can reach that word's schedule. Optional: an older client
    # does not send it, and an uncurated sentence has none.
    source_word: dict | None = None


def _allowed_kanji_for_level(level: str) -> str:
    allowed_levels = LEVEL_HIERARCHY.get(level)
    if not allowed_levels:
        raise HTTPException(status_code=400, detail="Unknown JLPT level")
    return get_kanji_string(allowed_levels)


def _chat(messages, timeout=60, max_tokens=3000):
    """Thin adapter over study/llm_shared.chat -- kept as a local name so
    this module's many call sites are unchanged, and so the shared
    function's LLMUnavailable becomes the HTTPException(503) they already
    expect. Everything else (multi-provider fallback, per-model retry,
    remembering what is dead) is llm_shared's job.

    reasoning stays on: this endpoint asks for ONE passage plus a handful
    of questions in a single constrained blob, which is the shape
    llm_shared documents reasoning as helping with -- unlike the batched
    generators, which pass reasoning=False."""
    try:
        return chat(messages, timeout=timeout, max_tokens=max_tokens)
    except LLMUnavailable as e:
        raise HTTPException(503, detail=str(e))


def _display_seconds(phrase: str) -> float:
    seconds = BASE_SECONDS + SECONDS_PER_CHAR * len(phrase)
    return max(MIN_DISPLAY_SECONDS, min(MAX_DISPLAY_SECONDS, round(seconds, 1)))


def phrase_to_romaji(text: str) -> str:
    """JP -> Hepburn romaji, via study/romaji.sentence_romaji.

    The conversion itself lives in study/romaji.py, shared with 書取 —
    one pykakasi instance for the process rather than two. This name
    stays because it is what this module's own callers know it as, and
    because the note below is about THIS caller's data.

    Previously (see git history) only ever called on an LLM-provided
    all-hiragana "reading" — the app deliberately never asked the LLM
    to spell romaji directly, because models are unreliable at
    inventing Hepburn spelling on the fly. Real example sentences carry
    no such pre-resolved reading, so this runs directly on the
    sentence's own mixed kanji/kana text: sentence_romaji reads it with
    a real morphological tokenizer rather than pykakasi's own context-
    blind kanji dictionary, so most of the ambiguous-kanji misreads that
    used to land here (六時に as "roku tokini" instead of "rokuji ni")
    are gone, but that tokenizer is not infallible either, and
    correctness here was already soft before any of this (see
    post_reading_result: "Correctness is now self-assessed by the user
    after seeing the reveal") — an occasional wrong reading in the
    *reference* romaji is a minor annoyance, not a grading bug, since
    nothing auto-compares against it.
    """
    return sentence_romaji(text)


def normalize_romaji(text: str) -> str:
    """
    Loose normalization so reasonable romanization variants still count as
    correct: lowercase, strip accents/macrons (ā -> a), drop punctuation and
    all whitespace, collapse repeated letters from long-vowel spelling
    differences is NOT done (おう vs ō is ambiguous) — only exact spelling
    variants survive this normalization.
    """
    text = unicodedata.normalize("NFKD", text.lower())
    text = "".join(c for c in text if not unicodedata.combining(c))
    text = re.sub(r"[^a-z]", "", text)
    return text


# ── Sentence source: real example sentences instead of LLM generation ──
#
# 2026-08 rewrite. Previously this endpoint asked an LLM to invent
# phrases constrained to a kanji allow-list (see git history for the
# removed SYSTEM_PROMPT_TEMPLATE / _call_llm_batch / PHASES if you need
# to compare) — replaced with real JMdict/Tatoeba example sentences
# already sitting in the vocab data (get_vocab_extras()["examples"],
# see vocab_extras.py). Three ways to pick WHICH word's example
# sentence gets served:
#
#   "level"     — JLPT level (existing LevelSelector UI), from the
#                 app's own curated deck.
#   "frequency" — a frequency tier (see frequency_data.py), either over
#                 the deck ("vocab" domain) or the full JMdict pool
#                 ("vocab_jmdict" domain) — the same tiers used
#                 elsewhere in the app for frequency-based study.
#   "mastery"   — words the learner already has in "learning" or
#                 "mastered" SRS state. Deliberately stronger than "an
#                 example sentence FOR one of your cards": a sentence is
#                 only accepted if EVERY recognizable word in it (not
#                 just the target) is also one of the learner's own
#                 learning/mastered cards — otherwise "sentences made of
#                 the cards you're learning" could still serve a
#                 sentence stuffed with unfamiliar vocabulary around the
#                 one word it was picked for. See _pick_words_mastery.

# Mastery mode: how many of the learner's own learning/mastered words to
# pull example sentences from before giving up on finding `count`
# sentences that are ENTIRELY made of learning/mastered vocabulary.
# Capped rather than unbounded — a learner with thousands of mastered
# words doesn't need this scanning all of them every request, and one
# with only a handful will simply come back with fewer than `count`.
_MASTERY_WORD_SAMPLE_CAP = 60
_MASTERY_SENTENCE_SCAN_CAP = 250
_MASTERY_MIN_KNOWN_WORDS = 3

# How many candidate words to try (across level/frequency-vocab sources)
# before giving up on finding `count` sentences whose kanji all fit the
# target level — see _sentence_fits_level. Needs to be generous: a word's
# OWN kanji being N5 says nothing about the kanji in ITS example
# sentences (JMdict/Tatoeba examples aren't difficulty-graded — see the
# 2026-08 "sentences too hard for the level" fix below), so several
# candidates in a row can fail before one works, especially for less
# common N5/N4 words with few examples.
_LEVEL_CANDIDATE_SCAN_CAP = 80


# ── Difficulty gate: real example sentences aren't graded by level ──
#
# ── Is a sentence actually at the level it is being served for? ──
# This used to be a kanji-character check and nothing else, and its own
# comment said why: a word-level check "would need to resolve each
# recognized segment back to a specific vocab entry's level ... worth
# revisiting with a word-level check later if that turns out to matter
# in practice". It mattered. A kanji gate passes any sentence spelled in
# easy characters however hard its grammar is, so N5 was being served
# 〜ようとする and 〜んです constructions all day.
#
# study/difficulty grades kanji, GRAMMAR and vocabulary together now;
# see that module for the measurement that motivated it. fits_loosely is
# the Tatoeba-facing gate — kanji + grammar + length, no vocabulary, for
# the reason given there. The curated bank (content/reading_sentences)
# does not pass through here at all: every sentence in it is graded by
# the full report at test time, so re-checking per request would be work
# already done.
def _sentence_fits_level(jp: str, level: str) -> bool:
    return difficulty.fits_loosely(jp, level)


def _is_kanji(c: str) -> bool:
    return "\u4e00" <= c <= "\u9fff"


def _pick_example_within_level(kanji: str, kana: str, level: str) -> dict | None:
    """Like vocab_extras.pick_random_example, but only considers
    examples whose sentence fits entirely within the target level's
    kanji set — shuffled so which valid example gets served still
    varies across requests, not always the "easiest" one first."""
    extras = vocab_extras.get_vocab_extras(kanji, kana, "", "en")
    examples = extras["examples"]
    random.shuffle(examples)
    for example in examples:
        if _sentence_fits_level(example["jp"], level):
            return example
    return None


def _pick_curated_phrases(level: str, count: int, exclude: set[str]) -> list[dict]:
    """`count` sentences from the hand-written bank for `level`.

    Drawn without replacement from a shuffled copy, so a single batch
    never repeats itself, and `exclude` (what the session has already
    shown) is honoured so a long sitting works through the bank rather
    than circling the same handful.
    """
    pool = [row for row in reading_sentences.BY_LEVEL.get(level, []) if row["jp"] not in exclude]
    random.shuffle(pool)
    return pool[:count]


def _pick_level_appropriate_phrases(word_pool: list[tuple[str, str, str]], level: str, count: int, scan_cap: int = _LEVEL_CANDIDATE_SCAN_CAP) -> list[tuple[str, str, str, dict]]:
    """Scans `word_pool` (already shuffled by the caller) for up to
    `count` (kanji, kana, level, example) tuples whose example sentence
    passes _sentence_fits_level. May return fewer than `count` if the pool
    or scan cap runs out first — callers already tolerate a shorter
    batch than requested."""
    picked = []
    for kanji, kana, lvl in word_pool[:scan_cap]:
        example = _pick_example_within_level(kanji, kana, level)
        if example is None:
            continue
        picked.append((kanji, kana, lvl, example))
        if len(picked) >= count:
            break
    return picked


def _pick_words_level(level: str, sample_size: int) -> list[tuple[str, str, str]]:
    pool = VOCAB_BY_LEVEL.get(level)
    if not pool:
        raise HTTPException(status_code=400, detail="Unknown JLPT level")
    candidates = [w for w in pool if vocab_extras.has_examples(w.get("kanji", ""), w.get("kana", ""))]
    random.shuffle(candidates)
    return [(w.get("kanji", ""), w.get("kana", ""), level) for w in candidates[:sample_size]]


def _pick_words_frequency(domain: str, tier: int, tier_size: int, sample_size: int) -> list[tuple[str, str, str | None]]:
    if domain not in ("vocab", "vocab_jmdict"):
        raise HTTPException(status_code=400, detail="domain must be 'vocab' or 'vocab_jmdict'")

    start, end = freq.tier_bounds(tier, tier_size)

    if domain == "vocab_jmdict":
        # DB does the has_examples filter + random sampling in one
        # indexed query — no need to fetch the whole tier first. No
        # difficulty gate here (see get_reading_batch's docstring): pool
        # words carry no JLPT level to gate kanji against.
        rows = jmdict_db.sample_rank_range_with_examples(start - 1, end - 1, sample_size)
        return [(r["kanji"], r["kana"], None) for r in rows]

    # domain == "vocab": small in-memory deck, same pattern as _pick_words_level.
    # Oversampled (sample_size, not the final `count`) — the difficulty
    # gate downstream will reject a chunk of these.
    keys = freq.tier_keys("vocab", tier, tier_size=tier_size)
    random.shuffle(keys)
    picked = []
    for key in keys:
        resolved = freq.resolve("vocab", key)
        if resolved is None:
            continue
        level, entry = resolved
        kanji, kana = entry.get("kanji", ""), entry.get("kana", "")
        if vocab_extras.has_examples(kanji, kana):
            picked.append((kanji, kana, level))
            if len(picked) >= sample_size:
                break
    return picked


def _deck_id_to_word():
    # Built once at import, reused across requests — vocab_to_id(entry,
    # level) for every deck entry, so mastery mode can resolve a
    # "vocab_{level}_..." SRS card id back to (kanji, kana) without
    # string-parsing an id whose kanji/kana fields could themselves
    # contain characters that make naive splitting fragile. Small
    # (~8.4k entries), cheap to build once.
    table = {}
    for level, entries in VOCAB_BY_LEVEL.items():
        for entry in entries:
            table[vocab_to_id(entry, level)] = (entry.get("kanji", ""), entry.get("kana", ""), level)
    return table


_DECK_ID_TO_WORD = _deck_id_to_word()


def _known_words_for_mastery(user_id: str) -> list[tuple[str, str, str | None]]:
    """The learner's own vocab cards (deck + JMdict pool) currently in
    "learning" or "mastered" SRS stage, per the real srs.py contract
    (checked against the actual file, not guessed):

      srs.get_user_states(user_id) -> {(prefixed_card_id, mode): {"state": ..., ...}}

    i.e. the key is a (card_id, mode) TUPLE, card_id is prefixed with
    "{user_id}:" (needs auth.unprefixed), and the status field is named
    "state", not "status". card_modes also tracks progress separately
    PER QUIZ MODE (flashcard/qcm/write/...), not per word — so "is this
    word learning/mastered" isn't single-valued in general. This uses
    VOCAB_STATUS_MODES -- every graded vocab mode, the same set
    dictionary.py reads for its own "is this word known" badge -- and
    counts a word as known once ANY of them reaches learning/mastered.

    That "any" is the rule the whole app now uses (see card_lookup's
    STATUS_MODES block); it replaced a single canonical mode, "qcm-kj-m",
    which the mode registry retired. Nothing writes that key any more, so
    this loop matched zero rows and the filter silently passed every
    word through as unknown.
    """
    states = srs.get_user_states(user_id)
    known = []

    for (card_id, mode), state in states.items():
        if mode not in VOCAB_STATUS_MODES:
            continue
        if state["state"] not in ("learning", "mastered"):
            continue
        raw_id = unprefixed(card_id, user_id)
        if raw_id.startswith("vocab_jmdict_"):
            # get_by_id() queries entries.id. vocab_jmdict_to_id() now
            # builds this suffix from that same `id`, so this resolves
            # correctly — until the migration in
            # scripts/migrate_jmdict_card_ids.py has run, though, a
            # returning user's card_ids here are still the OLD
            # seq-based suffix (out of get_by_id's id range), so this
            # silently matches nothing for them. That's the same
            # pre-migration gap the module docstring describes, not a
            # new issue introduced here.
            try:
                entry_id = int(raw_id[len("vocab_jmdict_"):])
            except ValueError:
                continue
            entry = jmdict_db.get_by_id(entry_id)
            if entry is not None:
                known.append((entry["kanji"], entry["kana"], None))
        elif raw_id.startswith("vocab_"):
            word = _DECK_ID_TO_WORD.get(raw_id)
            if word is not None:
                known.append(word)

    return known


def _pick_words_mastery(user_id: str, count: int) -> list[tuple[str, str, str | None, str, str, list]]:
    """Returns up to `count` (kanji, kana, level, jp_sentence, en,
    segments) tuples — segments (with SRS stats already attached) are
    computed here rather than in the caller, since building them is
    exactly how a sentence gets verified as entirely learning/mastered
    vocabulary; recomputing them again downstream would be wasted work.
    """
    known_words = _known_words_for_mastery(user_id)
    seen_words = set()
    unique_known = []
    for w in known_words:
        key = (w[0], w[1])
        if key not in seen_words:
            seen_words.add(key)
            unique_known.append(w)

    if len(unique_known) < _MASTERY_MIN_KNOWN_WORDS:
        raise HTTPException(
            status_code=400,
            detail="Not enough learning/mastered vocabulary yet for sentence mode — keep studying and check back.",
        )

    random.shuffle(unique_known)
    sample_words = unique_known[:_MASTERY_WORD_SAMPLE_CAP]

    states = srs.get_user_states(user_id)

    candidates = []  # (jp, en, kanji, kana, level)
    seen_jp = set()
    for kanji, kana, level in sample_words:
        extras = vocab_extras.get_vocab_extras(kanji, kana, "", "en")
        for ex in extras["examples"]:
            jp = ex["jp"]
            if jp in seen_jp:
                continue
            seen_jp.add(jp)
            candidates.append((jp, ex.get("en", ""), kanji, kana, level))

    random.shuffle(candidates)

    picked = []
    for jp, en, kanji, kana, level in candidates[:_MASTERY_SENTENCE_SCAN_CAP]:
        segments = attach_stats_to_segments(find_segments_in_text(jp), states, user_id)
        # The actual "made of the cards you're learning/mastered"
        # guarantee: every recognized (non-plain) segment's own status
        # must be learning/mastered — not just the target word.
        fully_known = all(
            seg["type"] == "plain" or seg["stats"]["status"] in ("learning", "mastered")
            for seg in segments
        )
        if not fully_known:
            continue
        picked.append((kanji, kana, level, jp, en, segments))
        if len(picked) >= count:
            break

    return picked


def _finish_phrase(jp: str, en: str, kanji: str, kana: str, level: str | None,
                   grammar: str | None = None) -> dict:
    """
    NOTE (2026-08): this used to also attach a `segments` field, built
    per-request via find_segments_in_text/attach_stats_to_segments (the
    morphology-based scanner in card_lookup.py). That's gone now —
    reading practice's word/kanji breakdown is served by the same
    AI-driven analyzer the phrase-analyzer screen uses (POST
    /api/phrase/analyze, save=false — see ReadingScreen.jsx), fired in
    the background as soon as a phrase is shown so it's ready by the
    time the reader wants it. That gives one consistent, LLM-quality
    segmentation everywhere in the app instead of two different
    scanners with different quirks, and drops a synchronous
    morphology pass from every batch fetch. The morphology scanner
    itself isn't gone — _pick_words_mastery below still uses it
    server-side to verify a candidate sentence is entirely made of the
    learner's own learning/mastered vocabulary before ever offering it
    — that's a cheap bulk filter, not something worth an LLM call per
    candidate sentence.
    """
    phrase = {
        "phrase": jp,
        "romaji": phrase_to_romaji(jp),
        "translation": en,
        "translation_lang": "en",  # see get_reading_batch's docstring
        "display_seconds": _display_seconds(jp),
        "source_word": {"kanji": kanji, "kana": kana, "level": level},
    }
    # Only a curated sentence carries this: it was written to demonstrate
    # exactly this point (and a test proves it contains it), so the
    # screen can name the grammar the reader is looking at. A corpus
    # sentence uses whatever it uses and gets no label rather than a
    # guessed one.
    if grammar:
        phrase["grammar"] = grammar
    return phrase


def _source_label(source: str, level: str | None, domain: str | None, tier: int | None) -> str:
    """Compact string stored in reading_log.phase (column kept as-is —
    see get_reading_batch's docstring — only what it *means* changed)."""
    if source == "level":
        return f"level:{level}"
    if source == "frequency":
        return f"freq:{domain}:{tier}"
    return "mastery"


@router.get("/api/reading/batch")
def get_reading_batch(
    source: str,                         # "level" | "frequency" | "mastery"
    level: str | None = None,            # required if source == "level"
    domain: str | None = None,           # required if source == "frequency": "vocab" | "vocab_jmdict"
    tier: int | None = None,             # required if source == "frequency"
    tier_size: int = freq.DEFAULT_TIER_SIZE,
    count: int = DEFAULT_BATCH,
    lang: str = "en",
    # Sentences this session has already shown, comma-separated. Only the
    # curated bank uses it (see _pick_curated_phrases) -- the Tatoeba path
    # varies by shuffling a pool of thousands and does not need it.
    exclude: str = "",
    user_id: str = Depends(get_user_id),
):
    """
    NOTE on `lang`: real example sentences (JMdict/Tatoeba-sourced) only
    carry an English translation in this app's data — there's no
    French/Spanish/etc. translation layer for them (unlike the old
    LLM-generated phrases, which were translated into whatever `lang`
    was requested). Every phrase in the response therefore comes back
    with "translation_lang": "en" regardless of `lang` — the frontend
    should label the translation as English rather than silently
    implying it's in the UI language. `lang` is accepted but currently
    unused; kept in the signature so the frontend doesn't need a
    conditional query-param builder, and in case a translated-examples
    layer gets added later.

    NOTE on reading_log.phase: not renamed at the DB column level (no
    migration tooling available here) — it now stores a compact label
    from _source_label() ("level:N3" / "freq:vocab:1" / "mastery")
    instead of the old "hiragana"/"katakana"/"mixed". Rename the column
    yourself with `ALTER TABLE reading_log RENAME COLUMN phase TO source;`
    if you'd rather it matched the new field name everywhere.

    NOTE on difficulty: for source="level" and source="frequency" with
    domain="vocab", every returned sentence is checked against
    _sentence_fits_level — no kanji outside the target level's allowed
    set. source="frequency" with domain="vocab_jmdict" has no such gate:
    JMdict-pool words carry no JLPT level to check kanji against, so a
    sentence there can still contain arbitrarily advanced kanji even
    for a "common" (low tier) word. mastery mode has its own, stronger
    per-word gate (see _pick_words_mastery) and needs nothing extra.
    """
    count = max(MIN_BATCH, min(MAX_BATCH, count))
    exclude_seen = {p for p in exclude.split("|") if p}

    if source == "level":
        if not level:
            raise HTTPException(status_code=400, detail="level is required for source=level")
        # The hand-written bank first, the Tatoeba pool for whatever is
        # left. Not a fallback in the "if the good path fails" sense --
        # the bank is finite (30-55 sentences a level) and a long sitting
        # will exhaust it, at which point real corpus sentences that pass
        # the gate are exactly what should come next. Ordering it this
        # way means the first thing a beginner ever reads is a sentence
        # written for them.
        curated = _pick_curated_phrases(level, count, exclude_seen)
        phrases = [
            _finish_phrase(row["jp"], row["en"], row["focus"], "", level, grammar=row["grammar"])
            for row in curated
        ]
        if len(phrases) < count:
            word_pool = _pick_words_level(level, _LEVEL_CANDIDATE_SCAN_CAP)
            picked = _pick_level_appropriate_phrases(word_pool, level, count - len(phrases))
            phrases.extend(
                _finish_phrase(example["jp"], example.get("en", ""), kanji, kana, lvl)
                for kanji, kana, lvl, example in picked
            )
    elif source == "frequency":
        if domain is None or tier is None:
            raise HTTPException(status_code=400, detail="domain and tier are required for source=frequency")
        if domain == "vocab":
            word_pool = _pick_words_frequency(domain, tier, tier_size, _LEVEL_CANDIDATE_SCAN_CAP)
            # Every word here resolved to a real deck level (see
            # _pick_words_frequency) — group by that level since a tier
            # can straddle more than one JLPT level, and the kanji gate
            # needs to check against each word's OWN level, not one
            # fixed level for the whole tier.
            phrases = []
            by_level: dict[str, list[tuple[str, str, str]]] = {}
            for kanji, kana, lvl in word_pool:
                by_level.setdefault(lvl, []).append((kanji, kana, lvl))
            remaining = count
            for lvl, words in by_level.items():
                if remaining <= 0:
                    break
                picked = _pick_level_appropriate_phrases(words, lvl, remaining, scan_cap=len(words))
                phrases.extend(
                    _finish_phrase(example["jp"], example.get("en", ""), kanji, kana, lvl2)
                    for kanji, kana, lvl2, example in picked
                )
                remaining = count - len(phrases)
        else:  # vocab_jmdict — no JLPT level, no gate (see docstring above)
            word_pool = _pick_words_frequency(domain, tier, tier_size, count)
            phrases = []
            for kanji, kana, lvl in word_pool:
                example = vocab_extras.pick_random_example(kanji, kana, "", "en")
                if example is None:
                    continue
                phrases.append(_finish_phrase(example["jp"], example.get("en", ""), kanji, kana, lvl))
    elif source == "mastery":
        picked = _pick_words_mastery(user_id, count)
        phrases = [
            _finish_phrase(jp, en, kanji, kana, lvl)
            # `segments` here is only the internal gating result used to
            # verify the sentence is fully learning/mastered vocabulary
            # (see _pick_words_mastery) — not sent to the client anymore.
            for kanji, kana, lvl, jp, en, segments in picked
        ]
    else:
        raise HTTPException(status_code=400, detail="source must be 'level', 'frequency', or 'mastery'")

    return {
        "source": source, "level": level, "domain": domain, "tier": tier,
        "phrases": phrases,
    }


# ── Scheduling ───────────────────────────────────────────────────────
#
# A reading exercise has no card of its own -- the sentence bank is
# curated content, not a deck -- but every sentence is CHOSEN to
# practise one vocabulary word, and carries it as `source_word`. So the
# thing being scheduled is that word, and reading its sentence is
# evidence about it.
#
# The mode key is its own: card_modes is keyed (card_id, mode), so this
# writes a schedule that sits BESIDE vocab's own flashcard modes rather
# than overwriting them. A reading session must not silently advance the
# intervals a vocab session owns.
#
# `sentence.` rather than a bare `reading`, following the
# <source>.<base> shape study/modes.py sets out: the source really is
# the curated sentence bank and not a deck, and the namespace keeps this
# from being read as a sibling of `vocab.word_reading` or
# `kanji.readings` -- two registered keys a bare "reading" sits
# confusingly close to -- by anyone auditing card_modes later.
#
# It is deliberately NOT registered in study/modes.py. card_index.locate()
# returns None for an unregistered mode and daily_queue skips such a row
# (see its `else: continue`), which is what is being relied on here: 読書
# runs its own session off the curated bank and has no renderer in Today.
# Registering it would mean a Today lane, a frontend studyModes.js entry,
# en+fr labels and four test updates -- a deliberate piece of work, not a
# side effect of this one.
SRS_MODE = "sentence.reading"


@router.post("/api/reading/result")
def post_reading_result(payload: ResultPayload, user_id: str = Depends(get_user_id)):
    # Correctness is self-assessed by the user after seeing the reveal
    # (romaji auto-matching was too brittle — see normalize_romaji's
    # docstring; it's kept above only as an optional sanity-check helper).
    #
    # reading_log.level is NOT NULL (see data_structure.sql) but
    # payload.level is only ever set for source="level" — frequency and
    # mastery sessions have no single JLPT level. Falls back to '' rather
    # than crashing the insert; the compact `phase` label already carries
    # the real source info ("freq:vocab:1" / "mastery") for anything that
    # needs it. Consider `ALTER TABLE reading_log ALTER COLUMN level DROP
    # NOT NULL;` if you'd rather this be a real NULL.
    level_for_log = payload.level or ""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO reading_log(user_id, level, phase, phrase, romaji,
                                        answer, correct, quality)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (user_id, level_for_log, payload.source, payload.phrase, payload.romaji,
                 payload.answer, payload.correct, payload.quality),
            )
        conn.commit()
    finally:
        conn.close()

    # Scheduling happens after the log is committed, and never instead
    # of it: a rating is a fact about what the learner did, and it must
    # survive even if the word cannot be resolved to a card.
    scheduled = None
    if payload.quality is not None:
        card_id = vocab_card_id_for_word(payload.source_word, user_id)
        if card_id:
            state = srs.review(card_id, SRS_MODE, payload.quality)
            scheduled = {
                "card_id": card_id,
                "mode": SRS_MODE,
                "interval_days": state["interval_days"],
                "next_review": state["next_review"],
                "stage": state["stage"],
                "xp_earned": state.get("xp_earned"),
                "leveled_up": state.get("leveled_up"),
                "new_level": state.get("new_level"),
            }

    return {
        "correct": payload.correct,
        "romaji": payload.romaji,
        "quality": payload.quality,
        # None when the rating scheduled nothing -- no quality given, or
        # the sentence's word is not in the vocabulary list.
        "scheduled": scheduled,
    }


@router.get("/api/reading/history")
def get_reading_history(user_id: str = Depends(get_user_id), limit: int = Query(50, ge=1, le=200)):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT level, phase, phrase, romaji, answer, correct, quality,
                       created_at
                FROM reading_log
                WHERE user_id = %s
                ORDER BY created_at DESC
                LIMIT %s
                """,
                (user_id, limit),
            )
            rows = cur.fetchall()
    finally:
        conn.close()

    return [
        {
            "source": phase, "phrase": phrase, "romaji": romaji,
            "answer": answer, "correct": correct,
            # NULL on every row written before the screen graded with the
            # rating bar -- "graded, resolution unknown", not a zero.
            "quality": quality,
            "created_at": created_at.isoformat(),
        }
        for level, phase, phrase, romaji, answer, correct, quality, created_at in rows
    ]


# ── Reading Comprehension ─────────────────────────────────────────────────────

# ── One length, every level ──────────────────────────────────────────
#
# (floor, ceiling) in Japanese characters, and the SAME pair at N5 and
# at N1 (owner-directed, 2026-09-11). The ladder used to run 150-220 up
# to 600-800, which made the top grades a test of stamina: an N1 paper
# was four times the reading of an N5 one, and the thing that actually
# separates the two — how hard the Japanese is to decode — was left to
# the kanji gate and one line of the prompt. What a level changes is
# now stated where it belongs, in DIFFICULTY_BY_LEVEL below, and the
# amount of Japanese is a constant.
#
# The ceiling is a measurement, not a preference: 280 characters is
# what the reading card holds WITHOUT scrolling on the smallest phone
# the app is drawn for (390x667 — .prose__jp--passage at --fs-body over
# a 309px column is ~20 characters a line, and the card's body is 433px
# of 26.6px lines there). The card scrolls rather than spilling when a
# text runs past it (index.css, .prompt-card--passage), but a passage
# the reader takes in at a glance is the one this band buys.
# frontend/src/screens/ComprehensionRun.touch.test.jsx measures the
# ceiling against the real card and fails if it stops fitting.
#
# ~20 a line is the WORST case on purpose: how many characters a line
# holds depends on the Japanese font the device has, and a machine
# without one packs appreciably more (CI's headless Linux runner fits a
# text a fifth longer than this band's ceiling, which is why that test
# only ever asserts the fit and never the overflow). Measure on
# something with real fonts before touching this number.
#
# The floor is the paper's: below ~220 characters there is not enough
# text to ask 8-12 non-overlapping questions of four different kinds
# about. Both ends are stated to the model with the reason for each,
# because neither holds on its own — asked as a bare range it answered
# a 150-220 brief with 98 characters, and given a floor alone it wrote
# 380 (both live, 2026-09-11).
COMPREHENSION_CHARS = (220, 280)

# What the level actually changes. Question count is a paper's DENSITY
# over that one fixed text, not its length — the same passage examined
# harder, which is the only sense in which a higher grade should mean
# more work here.
#
# Every count gained two on 2026-09-11 (owner-directed): a six-question
# N5 paper was over before the text it was written about had settled,
# and the four question types below only cover a text properly once
# there are at least two of each. Eight is the floor everywhere; the
# screen draws its own progress ("3 / 8") from the list that comes
# back, so a spec that slipped would shorten the exercise silently.
COMPREHENSION_SPECS = {
    "N5": {"questions": 8},
    "N4": {"questions": 9},
    "N3": {"questions": 10},
    "N2": {"questions": 11},
    "N1": {"questions": 12},
}
DEFAULT_COMPREHENSION_SPEC = {"questions": 10}

# The brief for the ONE thing a level changes. The kanji gate
# (_allowed_kanji_for_level) already bounds the writing; this bounds
# the grammar, the register and the reading itself, which the gate
# cannot see. Kept short on purpose: these are constraints handed to a
# model, and a paragraph of them reads as a topic list it then tries to
# satisfy all of at once.
DIFFICULTY_BY_LEVEL = {
    "N5": "Short sentences, one idea each, almost all in the polite present or past. Basic particles (は が を に で へ と も), て-form only for joining two actions. Everyday concrete subjects: a day at school, shopping, the weather, a family. The answer to every question is stated outright somewhere in the text.",
    "N4": "Sentences that join two or three clauses with て-forms, から, ので, たら, と. Plain forms inside a sentence, potential and volitional, giving and receiving, comparison. A concrete subject with a small complication in it — a plan that changes, an outing that goes wrong.",
    "N3": "Compound sentences with subordinate clauses. Passive, causative, conditional pairs, ようだ/らしい/そうだ, conjunctions of cause, contrast and condition. The subject is often left unsaid and has to be tracked. Explanation or opinion rather than diary: how something works, why someone decided something.",
    "N2": "Written register, including formal connectives (にもかかわらず, 一方で, に対して, とはいえ). Nominalisation, humble and honorific forms, longer noun phrases. An abstract or public subject: work, a service, a change in a town, a piece of research. Some of what the text means is carried by its structure rather than its words.",
    "N1": "Essay or editorial register, dense noun phrases, nuance carried in hedging and word choice. Idiomatic and literary turns, irony, a line of argument rather than a sequence of facts. An abstract subject treated critically. At least one question should only be answerable by reading between the lines.",
}
DEFAULT_DIFFICULTY = DIFFICULTY_BY_LEVEL["N3"]

# Reading window in seconds. It used to scale with the text, which no
# longer varies — so this is now what it should always have been: the
# time the SAME amount of Japanese takes to decode at each level. A
# ladder, because an N1 paragraph is genuinely slower per character
# than an N5 one, but a gentle one rather than the 4x the old lengths
# forced. Learners can stop early regardless, and most do.
READ_SECONDS_BY_LEVEL = {
    "N5": 240,   # 4 min
    "N4": 270,
    "N3": 300,   # 5 min
    "N2": 330,
    "N1": 360,   # 6 min
}
DEFAULT_READ_SECONDS = 300

# Same allowed-kanji restriction as the phrase-reading mode (see
# SYSTEM_PROMPT_TEMPLATE above) — a comprehension text full of kanji the
# user has never studied defeats the point of leveling it by JLPT level.
COMPREHENSION_PROMPT_TEMPLATE = """You are creating a Japanese reading-comprehension exercise for a learner at JLPT level {level}.

Write a self-contained Japanese text of about {target_chars} Japanese characters — never fewer than {min_chars} and never more than {max_chars} — in vocabulary and grammar appropriate for JLPT {level}.

That length is the same at EVERY level. What JLPT {level} changes is how hard the Japanese is, never how much of it there is: a harder level means denser grammar, a less concrete subject and more that has to be worked out — in the same number of characters. At JLPT {level} specifically:

{difficulty}

Then write {questions} multiple-choice questions ABOUT THE TEXT, mixing different question types so the exercise tests more than just plot recall. Finally, break the text down one sentence at a time, so the learner can go back over it afterwards and see exactly where their reading went wrong.

When writing the text:

- You MAY use hiragana, katakana and punctuation freely.
- If you use any kanji, you may use only the following kanji::
{allowed_kanji}
- Any other kanji outside this list is forbidden.
- If a word normally contains a disallowed kanji, replace that kanji with its hiragana reading instead.
- But DO write a word in the kanji it is normally written in whenever those kanji are on the list. A passage spelled out entirely in hiragana is not Japanese anyone reads, and at JLPT {level} the kanji on that list are exactly the ones the learner is being taught to read.

Question types to mix across the {questions} questions (use a good variety — don't make them all "comprehension"):
- "comprehension": tests understanding of what happened, who/what/when/where, or the main idea of a specific passage in the text.
- "vocabulary": asks what a specific word or kanji FROM THE TEXT means (quote the exact word/kanji from the text in the question).
- "grammar": asks about a grammar point, particle, or verb form used in a specific sentence from the text (quote the relevant sentence fragment).
- "inference": asks the learner to infer something not stated directly (the author's intent, a character's feeling, what likely happens next).

Respond with ONLY a JSON object (no markdown fences, no commentary) matching exactly this schema:
{{
  "text": "...",
  "questions": [
    {{
      "type": "comprehension",
      "question": "...",
      "options": ["...", "...", "...", "..."],
      "correct": 0
    }}
  ],
  "breakdown": [
    {{
      "jp": "...",
      "translation": "...",
      "note": "..."
    }}
  ]
}}

Rules:
- EVERY value in this object is a plain JSON string: it opens with the " character and closes with it, and with nothing else. Never open a value with «, “ or 「.
- Where you quote Japanese INSIDE a value — a question, an option, a note — open it with 「 and close it with 」, and use no other mark for it — never « », never quotes, never italics marks, and never one of those paired with a corner bracket.
- "text" must be natural, coherent Japanese with a clear topic (a short story, announcement, letter, description, etc).
- "text" must be between {min_chars} and {max_chars} Japanese characters long, and {target_chars} is what to aim for. Count them before you answer: this is the rule most often broken, and a text of 170 characters where {target_chars} was asked for is a failed exercise. Both ends are real — under {min_chars} the text cannot carry {questions} questions of four different kinds, and over {max_chars} it does not fit on the screen it is read from. Do not write a longer text because the level is high: write a harder one.
- "type" must be exactly one of: "comprehension", "vocabulary", "grammar", "inference".
- Each "question" is written in {lang_name} (quoting the relevant Japanese word or phrase from the text in 「 」 where that helps) and must be answerable using only the text provided.
- "options" must contain exactly 4 choices in {lang_name}. All options must be plausible — avoid obviously wrong distractors.
- "correct" is the 0-based index of the only correct option.
- Generate exactly {questions} questions, with at least one of each type if {questions} >= 4, and a roughly even mix overall.
- "breakdown" has ONE entry per sentence of "text", in the order the sentences appear. Splitting on 。！？, every sentence of the text must appear exactly once and nothing that is not in the text may appear at all: concatenating every "jp" in order must reproduce "text" exactly, punctuation included.
- "jp" is the sentence copied verbatim from "text" — never re-written, re-spelled or given kanji the text does not use.
- "translation" is a faithful {lang_name} translation of that ONE sentence.
- "note" is one short {lang_name} sentence on how that sentence is built — the particle, verb form, construction or word a JLPT {level} learner is most likely to trip on in it. Name the Japanese you are talking about, in 「 」. Never restate the translation; if a sentence really has nothing worth noting, use an empty string.
- A "note" must BEGIN with a word of {lang_name} — "The particle 「は」 marks...", never "「は」 marks...". Starting one on a bracket is how the opening " of the JSON string goes missing, and that one character costs the whole exercise.
"""


VALID_QUESTION_TYPES = {"comprehension", "vocabulary", "grammar", "inference"}

# How many times one exercise is asked for before the screen is told no.
# See the loop in _call_llm_comprehension for what the second attempt
# actually buys.
_COMPREHENSION_ATTEMPTS = 2

class ComprehensionAnswersPayload(BaseModel):
    level: str
    text: str
    translation: str
    questions: list[dict]
    answers: list[int]  # user's chosen option index per question, in order
    # The sentence-by-sentence breakdown the exercise was served with,
    # echoed back the way `questions` is. Optional: comprehension_log
    # has no column for it (nothing reads that table — see
    # scripts/prune_logs.py), so this is accepted and dropped rather
    # than stored, and an older client that never sends it still posts
    # a valid payload.
    breakdown: list[dict] | None = None


def _text_field(part: dict, key: str) -> str:
    """One string out of a model-written object, or ''. A model that
    answers a text field with a number or a list is answering badly,
    not fatally — every caller here treats a blank as "nothing to
    print", and str() on a list would print the brackets."""
    value = part.get(key)
    return value.strip() if isinstance(value, str) else ""


def _clean_breakdown(raw) -> list[dict]:
    """The breakdown as the screen reads it: {jp, translation, note} per
    sentence, in order, nothing else.

    Lenient on purpose, and only in the directions that cannot mislead a
    learner. A sentence with no `jp` is dropped (there is nothing to
    show it against); a missing or non-string `note` becomes '' (the
    prompt itself allows an empty one, and the card simply omits the
    line); a missing translation is kept as '' rather than dropping the
    sentence, because the Japanese is still the passage and losing a
    line of it would silently rewrite the text the learner just read.
    """
    if not isinstance(raw, list):
        return []

    cleaned = []
    for part in raw:
        if not isinstance(part, dict):
            continue
        jp = _text_field(part, "jp")
        if not jp:
            continue
        cleaned.append({
            "jp": jp,
            "translation": _text_field(part, "translation"),
            "note": _text_field(part, "note"),
        })
    return cleaned


def _call_llm_comprehension(level: str, lang: str) -> dict:
    if not llm_configured():
        raise HTTPException(status_code=500, detail="No LLM provider is configured")

    spec = COMPREHENSION_SPECS.get(level, DEFAULT_COMPREHENSION_SPEC)
    lang_name = LANG_NAMES.get(lang, lang)
    allowed_kanji = _allowed_kanji_for_level(level)

    min_chars, max_chars = COMPREHENSION_CHARS
    prompt = COMPREHENSION_PROMPT_TEMPLATE.format(
        level=level,
        min_chars=min_chars,
        max_chars=max_chars,
        # A target, not just a band. Asked for a range the model aims
        # under it — a 220-280 brief came back at 173 (live,
        # 2026-09-11) — and asked for one number it lands on it.
        target_chars=(min_chars + max_chars) // 2,
        difficulty=DIFFICULTY_BY_LEVEL.get(level, DEFAULT_DIFFICULTY),
        questions=spec["questions"],
        allowed_kanji=allowed_kanji,
        lang=lang,
        lang_name=lang_name,
    )

    # Asked twice before giving up, and this is not belt-and-braces:
    # one blob carries the passage, the paper AND the breakdown, so a
    # single malformed value costs the learner the whole exercise — a
    # 502 they read as "Couldn't load a text". That is not
    # hypothetical, it is the shape that prompted this, live on
    # 2026-09-11: a French note that OPENED on a guillemet instead of
    # the JSON quote, which is a parse error two thousand characters
    # into an otherwise perfect answer. The quoting rules in the prompt
    # are the fix; this is what a model that ignores them costs. The
    # exam generator makes the same bargain for the same reason
    # (exam_reading_gen._build_one_passage).
    #
    # 502 only. A 503 is llm_shared saying every provider is gone, and
    # asking it again is a request not worth sending.
    last = None
    for attempt in range(_COMPREHENSION_ATTEMPTS):
        # max_tokens above the shared 3000 default, and the timeout
        # with it: this one call now writes the passage, a dozen
        # four-option questions AND a translated, annotated entry per
        # sentence, roughly twice the JSON the flat whole-text
        # translation it replaced came to. A cap that cuts the blob
        # mid-array costs the whole exercise, so it is set for the
        # longest paper the specs above can ask for — N1: 800
        # characters, 12 questions, ~15 sentences.
        content = _chat([
            {"role": "system", "content": prompt},
            {"role": "user", "content": "Generate the reading comprehension exercise."},
        ], timeout=120, max_tokens=8000)
        try:
            return _parse_comprehension(content)
        except HTTPException as e:
            if e.status_code != 502:
                raise
            last = e
            logger.warning(
                "Comprehension attempt %d/%d unusable (%s)",
                attempt + 1, _COMPREHENSION_ATTEMPTS, e.detail,
            )

    raise last


# A value that begins with anything but the JSON quote — the one
# malformation this endpoint actually sees, and it sees it often.
# The shape, live twice on 2026-09-11:
#
#     "note": 「見て」 links テレビを見る and 寝ました。"
#
# The model opens the string on the Japanese quotation mark it was
# asked to quote Japanese with, and never writes the " — so the value
# is unterminated and two thousand characters of otherwise perfect
# answer are unparseable. The prompt now tells it to start a note on a
# word rather than on a bracket, which is the real fix; this is the
# net under it.
#
# Only ever applied to input `json.loads` has ALREADY refused, so it
# cannot change the meaning of a well-formed answer: a value that does
# not open on a quote is not valid JSON under any reading. The closing
# quote is the one the model did write.
_UNOPENED_VALUE = re.compile(r'("(?:jp|translation|note|question)":[ \t]*)(?=[^"\s\[{])')


def _parse_comprehension(content: str) -> dict:
    """One model answer to the prompt above, checked and normalized, or
    a 502 naming what was wrong with it — which the caller reads as
    "ask again"."""
    cleaned = re.sub(r"^```(?:json)?|```$", "", content.strip(), flags=re.MULTILINE).strip()
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        repaired, fixes = _UNOPENED_VALUE.subn(r'\1"', cleaned)
        try:
            data = json.loads(repaired) if fixes else None
        except json.JSONDecodeError:
            data = None
        if data is None:
            logger.error("Failed to parse comprehension LLM response: %r", content)
            raise HTTPException(status_code=502, detail="LLM returned an unparseable response")
        logger.warning("Comprehension response repaired: %d value(s) opened on the wrong quote", fixes)

    for field in ("text", "questions", "breakdown"):
        if field not in data:
            raise HTTPException(status_code=502, detail=f"LLM response missing field: {field}")

    for i, q in enumerate(data["questions"]):
        if not all(k in q for k in ("question", "options", "correct")):
            raise HTTPException(status_code=502, detail=f"Question {i} missing required fields")
        if len(q["options"]) != 4:
            raise HTTPException(status_code=502, detail=f"Question {i} must have exactly 4 options")
        # Be lenient on "type" — default rather than reject, since it's
        # metadata for display, not something correctness depends on.
        if q.get("type") not in VALID_QUESTION_TYPES:
            q["type"] = "comprehension"

    data["breakdown"] = _clean_breakdown(data["breakdown"])
    if not data["breakdown"]:
        raise HTTPException(status_code=502, detail="LLM response carried no usable breakdown")

    # The whole-text translation is no longer asked for: it is the
    # breakdown read end to end, which is the same text by construction
    # and one fewer thing for the model to get out of step with itself.
    # It still exists because comprehension_log.translation is NOT NULL
    # and because the screen posts back what it was served.
    data["translation"] = " ".join(part["translation"] for part in data["breakdown"] if part["translation"])

    return data


@router.get("/api/reading/comprehension")
def get_comprehension_text(level: str | None = None, lang: str = "en", user_id: str = Depends(get_user_id)):
    level = resolve_level(user_id, level)
    data = _call_llm_comprehension(level, lang)
    spec = COMPREHENSION_SPECS.get(level, DEFAULT_COMPREHENSION_SPEC)
    return {
        "level": level,
        "text": data["text"],
        "translation": data["translation"],
        "breakdown": data["breakdown"],
        "questions": data["questions"],
        "read_seconds": READ_SECONDS_BY_LEVEL.get(level, DEFAULT_READ_SECONDS),
        "question_count": spec["questions"],
    }


@router.post("/api/reading/comprehension/result")
def post_comprehension_result(payload: ComprehensionAnswersPayload, user_id: str = Depends(get_user_id)):
    questions = payload.questions
    answers = payload.answers

    if len(answers) != len(questions):
        raise HTTPException(status_code=400, detail="Answer count does not match question count")

    score = sum(
        1 for i, q in enumerate(questions)
        if i < len(answers) and answers[i] == q.get("correct")
    )
    total = len(questions)

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO comprehension_log
                    (user_id, level, text, translation, questions, answers, score, total)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, created_at
                """,
                (
                    user_id, payload.level, payload.text, payload.translation,
                    json.dumps(questions), json.dumps(answers), score, total,
                ),
            )
            row_id, created_at = cur.fetchone()
        conn.commit()
    finally:
        conn.close()

    return {
        "id": row_id,
        "score": score,
        "total": total,
        "created_at": created_at.isoformat(),
        "results": [
            {
                "type": q.get("type", "comprehension"),
                "question": q["question"],
                "options": q["options"],
                "correct": q["correct"],
                "user_answer": answers[i] if i < len(answers) else None,
                "is_correct": i < len(answers) and answers[i] == q["correct"],
            }
            for i, q in enumerate(questions)
        ],
    }