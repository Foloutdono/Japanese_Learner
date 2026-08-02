import json
import logging
import os
import random
import re
import unicodedata

import requests
import pykakasi
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from db import db_conn
from auth import get_user_id, unprefixed
from srs_instance import srs
from card_lookup import find_segments_in_text, attach_stats_to_segments, VOCAB_STATUS_MODE
from kanji_data import get_kanji_string
from vocab_data import VOCAB_BY_LEVEL, vocab_to_id
import vocab_extras
import vocab_jmdict_data as jmdict_db
import frequency_data as freq

router = APIRouter()
logger = logging.getLogger(__name__)

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY")
OPENROUTER_MODEL = os.environ.get("OPENROUTER_MODEL", "anthropic/claude-3.5-haiku")
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

# Still used by Reading Comprehension below (LLM-generated) — untouched
# by the 2026-08 phrase-mode rewrite.
MODELS = [
    OPENROUTER_MODEL,                     # Primary
    "nvidia/nemotron-3-super-120b-a12b:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "google/gemma-4-31b-it:free",
    "openrouter/owl-alpha",
]

_kakasi = pykakasi.kakasi()

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


def _allowed_kanji_for_level(level: str) -> str:
    allowed_levels = LEVEL_HIERARCHY.get(level)
    if not allowed_levels:
        raise HTTPException(status_code=400, detail="Unknown JLPT level")
    return get_kanji_string(allowed_levels)


def _chat(messages, timeout=60):
    last_error = None
    SESSION = requests.Session()

    for model in MODELS:
        for attempt in range(2):
            try:
                response = SESSION.post(
                    OPENROUTER_URL,
                    headers={
                        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model,
                        "messages": messages,
                    },
                    timeout=timeout,
                )
            except requests.RequestException as e:
                logger.warning("%s network error: %s", model, e)
                continue

            if response.ok:
                logger.info("Using model %s", model)
                try:
                    return response.json()["choices"][0]["message"]["content"]
                except (KeyError, IndexError):
                    logger.error(response.text)
                continue

            logger.warning(
                "%s failed (%s): %s",
                model,
                response.status_code,
                response.text[:300],
            )

            last_error = response

            # only try another model for temporary failures
            if response.status_code not in (429, 500, 502, 503, 504):
                break

    raise HTTPException(
        503,
        detail=f"All LLM providers failed. Last error: {response.status_code}"
    )


def _display_seconds(phrase: str) -> float:
    seconds = BASE_SECONDS + SECONDS_PER_CHAR * len(phrase)
    return max(MIN_DISPLAY_SECONDS, min(MAX_DISPLAY_SECONDS, round(seconds, 1)))


def phrase_to_romaji(text: str) -> str:
    """Deterministic JP -> Hepburn romaji conversion via pykakasi.

    Previously (see git history) only ever called on an LLM-provided
    all-hiragana "reading" — the app deliberately never asked the LLM
    to spell romaji directly, because models are unreliable at
    inventing Hepburn spelling on the fly. Real example sentences carry
    no such pre-resolved reading, so this now runs directly on the
    sentence's own mixed kanji/kana text: pykakasi has its own
    dictionary-based kanji reading, which is NOT context-aware and can
    occasionally pick the wrong reading for an ambiguous kanji. Accepted
    trade-off, not an oversight — correctness here was already soft
    before this change (post_reading_result: "Correctness is now
    self-assessed by the user after seeing the reveal"), so an
    occasional wrong reading in the *reference* romaji is a minor
    annoyance, not a grading bug, since nothing auto-compares against it.
    """
    converted = _kakasi.convert(text)
    return " ".join(item["hepburn"] for item in converted if item["hepburn"])


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


def _pick_words_level(level: str, count: int) -> list[tuple[str, str, str]]:
    pool = VOCAB_BY_LEVEL.get(level)
    if not pool:
        raise HTTPException(status_code=400, detail="Unknown JLPT level")
    candidates = [w for w in pool if vocab_extras.has_examples(w.get("kanji", ""), w.get("kana", ""))]
    random.shuffle(candidates)
    return [(w.get("kanji", ""), w.get("kana", ""), level) for w in candidates[:count]]


def _pick_words_frequency(domain: str, tier: int, tier_size: int, count: int) -> list[tuple[str, str, str | None]]:
    if domain not in ("vocab", "vocab_jmdict"):
        raise HTTPException(status_code=400, detail="domain must be 'vocab' or 'vocab_jmdict'")

    start, end = freq.tier_bounds(tier, tier_size)

    if domain == "vocab_jmdict":
        # DB does the has_examples filter + random sampling in one
        # indexed query — no need to fetch the whole tier first.
        rows = jmdict_db.sample_rank_range_with_examples(start - 1, end - 1, count)
        return [(r["kanji"], r["kana"], None) for r in rows]

    # domain == "vocab": small in-memory deck, same pattern as _pick_words_level.
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
            if len(picked) >= count:
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
    VOCAB_STATUS_MODE (the same mode dictionary.py already reads for its
    own "is this word known" badge) as the canonical mode for that
    question, for consistency with the rest of the app rather than
    inventing a separate "any mode counts" rule here.
    """
    states = srs.get_user_states(user_id)
    known = []

    for (card_id, mode), state in states.items():
        if mode != VOCAB_STATUS_MODE:
            continue
        if state["state"] not in ("learning", "mastered"):
            continue
        raw_id = unprefixed(card_id, user_id)
        if raw_id.startswith("vocab_jmdict_"):
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


def _finish_phrase(jp: str, en: str, kanji: str, kana: str, level: str | None, segments, user_id: str | None = None) -> dict:
    if segments is None:
        states = srs.get_user_states(user_id) if user_id else {}
        segments = attach_stats_to_segments(find_segments_in_text(jp), states, user_id)
    return {
        "phrase": jp,
        "romaji": phrase_to_romaji(jp),
        "translation": en,
        "translation_lang": "en",  # see get_reading_batch's docstring
        "display_seconds": _display_seconds(jp),
        "segments": segments,
        "source_word": {"kanji": kanji, "kana": kana, "level": level},
    }


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
    """
    count = max(MIN_BATCH, min(MAX_BATCH, count))

    if source == "level":
        if not level:
            raise HTTPException(status_code=400, detail="level is required for source=level")
        words = _pick_words_level(level, count)
    elif source == "frequency":
        if domain is None or tier is None:
            raise HTTPException(status_code=400, detail="domain and tier are required for source=frequency")
        words = _pick_words_frequency(domain, tier, tier_size, count)
    elif source == "mastery":
        words = None  # handled separately below — already includes sentence + segments
    else:
        raise HTTPException(status_code=400, detail="source must be 'level', 'frequency', or 'mastery'")

    if source == "mastery":
        picked = _pick_words_mastery(user_id, count)
        phrases = [
            _finish_phrase(jp, en, kanji, kana, lvl, segments=segments)
            for kanji, kana, lvl, jp, en, segments in picked
        ]
    else:
        phrases = []
        for kanji, kana, lvl in words:
            example = vocab_extras.pick_random_example(kanji, kana, "", "en")
            if example is None:
                continue  # shouldn't happen — has_examples() already filtered — but never trust it blindly
            phrases.append(_finish_phrase(example["jp"], example.get("en", ""), kanji, kana, lvl, segments=None, user_id=user_id))

    return {
        "source": source, "level": level, "domain": domain, "tier": tier,
        "phrases": phrases,
    }


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
                INSERT INTO reading_log(user_id, level, phase, phrase, romaji, answer, correct)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                """,
                (user_id, level_for_log, payload.source, payload.phrase, payload.romaji, payload.answer, payload.correct),
            )
        conn.commit()
    finally:
        conn.close()

    return {"correct": payload.correct, "romaji": payload.romaji}


@router.get("/api/reading/history")
def get_reading_history(user_id: str = Depends(get_user_id), limit: int = 50):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT level, phase, phrase, romaji, answer, correct, created_at
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
            "answer": answer, "correct": correct, "created_at": created_at.isoformat(),
        }
        for level, phase, phrase, romaji, answer, correct, created_at in rows
    ]


# ── Reading Comprehension ─────────────────────────────────────────────────────

# Text length and question count scale with JLPT level difficulty.
COMPREHENSION_SPECS = {
    "N5": {"chars": "150-220",  "questions": 6},
    "N4": {"chars": "220-320",  "questions": 7},
    "N3": {"chars": "320-450",  "questions": 8},
    "N2": {"chars": "450-600",  "questions": 9},
    "N1": {"chars": "600-800",  "questions": 10},
}
DEFAULT_COMPREHENSION_SPEC = {"chars": "300-400", "questions": 8}

# Reading window in seconds, scaled per level alongside text length; users
# can stop early regardless.
READ_SECONDS_BY_LEVEL = {
    "N5": 240,   # 4 min
    "N4": 300,   # 5 min
    "N3": 420,   # 7 min
    "N2": 540,   # 9 min
    "N1": 600,   # 10 min
}
DEFAULT_READ_SECONDS = 420

# Same allowed-kanji restriction as the phrase-reading mode (see
# SYSTEM_PROMPT_TEMPLATE above) — a comprehension text full of kanji the
# user has never studied defeats the point of leveling it by JLPT level.
COMPREHENSION_PROMPT_TEMPLATE = """You are creating a Japanese reading-comprehension exercise for a learner at JLPT level {level}.

Write a self-contained Japanese text ({chars} characters) using vocabulary and grammar appropriate for JLPT {level}. Then write {questions} multiple-choice questions ABOUT THE TEXT, mixing different question types so the exercise tests more than just plot recall.

When writing the text:

- You MAY use hiragana, katakana and punctuation freely.
- If you use any kanji, you may use only the following kanji::
{allowed_kanji}
- Any other kanji outside this list is forbidden.
- If a word normally contains a disallowed kanji, replace that kanji with its hiragana reading instead.

Question types to mix across the {questions} questions (use a good variety — don't make them all "comprehension"):
- "comprehension": tests understanding of what happened, who/what/when/where, or the main idea of a specific passage in the text.
- "vocabulary": asks what a specific word or kanji FROM THE TEXT means (quote the exact word/kanji from the text in the question).
- "grammar": asks about a grammar point, particle, or verb form used in a specific sentence from the text (quote the relevant sentence fragment).
- "inference": asks the learner to infer something not stated directly (the author's intent, a character's feeling, what likely happens next).

Respond with ONLY a JSON object (no markdown fences, no commentary) matching exactly this schema:
{{
  "text": "...",
  "translation": "...",
  "questions": [
    {{
      "type": "comprehension",
      "question": "...",
      "options": ["...", "...", "...", "..."],
      "correct": 0
    }}
  ]
}}

Rules:
- "text" must be natural, coherent Japanese with a clear topic (a short story, announcement, letter, description, etc), long enough to support questions of every type above.
- "translation" is a faithful {lang_name} translation of "text".
- "type" must be exactly one of: "comprehension", "vocabulary", "grammar", "inference".
- Each "question" is written in {lang_name} (quoting the relevant Japanese word/phrase from the text in italics-style quotes where relevant) and must be answerable using only the text provided.
- "options" must contain exactly 4 choices in {lang_name}. All options must be plausible — avoid obviously wrong distractors.
- "correct" is the 0-based index of the only correct option.
- Generate exactly {questions} questions, with at least one of each type if {questions} >= 4, and a roughly even mix overall.
"""


VALID_QUESTION_TYPES = {"comprehension", "vocabulary", "grammar", "inference"}

class ComprehensionAnswersPayload(BaseModel):
    level: str
    text: str
    translation: str
    questions: list[dict]
    answers: list[int]  # user's chosen option index per question, in order


def _call_llm_comprehension(level: str, lang: str) -> dict:
    if not OPENROUTER_API_KEY:
        raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY is not configured")

    spec = COMPREHENSION_SPECS.get(level, DEFAULT_COMPREHENSION_SPEC)
    lang_name = LANG_NAMES.get(lang, lang)
    allowed_kanji = _allowed_kanji_for_level(level)

    prompt = COMPREHENSION_PROMPT_TEMPLATE.format(
        level=level,
        chars=spec["chars"],
        questions=spec["questions"],
        allowed_kanji=allowed_kanji,
        lang=lang,
        lang_name=lang_name,
    )

    content = _chat([
        {"role": "system", "content": prompt},
        {"role": "user", "content": "Generate the reading comprehension exercise."},
    ])
    cleaned = re.sub(r"^```(?:json)?|```$", "", content.strip(), flags=re.MULTILINE).strip()
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        logger.error("Failed to parse comprehension LLM response: %r", content)
        raise HTTPException(status_code=502, detail="LLM returned an unparseable response")

    for field in ("text", "translation", "questions"):
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

    return data


@router.get("/api/reading/comprehension")
def get_comprehension_text(level: str, lang: str = "en", user_id: str = Depends(get_user_id)):
    data = _call_llm_comprehension(level, lang)
    spec = COMPREHENSION_SPECS.get(level, DEFAULT_COMPREHENSION_SPEC)
    return {
        "level": level,
        "text": data["text"],
        "translation": data["translation"],
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