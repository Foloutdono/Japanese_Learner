"""
Shared helpers for cross-referencing arbitrary Japanese text against the
existing vocab/kanji decks and the user's SRS state. Used by both the
phrase analyzer and the reading-practice mode.
"""

import re
from functools import lru_cache

from content.vocab_data import VOCAB_BY_LEVEL, vocab_to_id
from content.vocab_renames import FOLDED_FORMS
from content.kanji_data import KANJI_BY_LEVEL, kanji_to_id
from study.modes import KANA, KANJI, VOCAB, GRAMMAR, STATUS_MODES
from content import vocab_extras
import content.vocab_jmdict_data as jmdict_db
from study import morphology
# What "do I already know this?" means for the clickable badges.
#
# This used to be ONE representative mode, STATUS_MODE = "qcm-kj-m" --
# recognition with the answer among four choices. That key no longer
# exists (MCQ became a hint rather than a mode), so the badges were
# reading a mode nothing writes and no word could ever come back known.
#
# Its nearest survivor, <source>.flashcard.f2b, is strictly HARDER than
# what it replaced -- nothing is offered to pick from -- so silently
# swapping it in would have raised the bar for "known" without saying
# so. Instead the question is answered across every graded mode of that
# source (study/modes.STATUS_MODES) and the best answer wins, which is
# both more forgiving and closer to what the badge actually claims.
#
# NOTE (2026-08): grammar-point lookup (GRAMMAR_STATUS_MODE, the old
# _grammar_hits/_index_grammar_by_surface machinery) was removed
# entirely — segmentation for both the phrase analyzer and reading
# practice is now mostly AI-driven (see phrase.py's LLM-based word
# segmentation), and the old literal-substring grammar matcher was a
# morphology-only heuristic layered on top of that. If per-grammar-point
# SRS tracking is wanted again later, it belongs in the AI segmentation
# result, not resurrected here.
VOCAB_STATUS_MODES = STATUS_MODES[VOCAB]
KANJI_STATUS_MODES = STATUS_MODES[KANJI]
KANA_STATUS_MODES = STATUS_MODES[KANA]
# Restored 2026-08 for study/analysis.py's local tier -- see that
# module's grammar handling and the note above about grammar lookup
# having been removed here in favour of AI segmentation. This constant
# is the piece that note said belonged in the new analysis result.
GRAMMAR_STATUS_MODES = STATUS_MODES[GRAMMAR]

# Used to pick between multiple deck entries that share the same surface
# form (e.g. 歩 is both the everyday word "marcher"/"pas" and the shogi
# piece "fu"/pawn, with different readings and meanings). Lower rank =
# more common = preferred default when we have no reading to disambiguate
# with. Unknown level strings fall back to a high rank (least preferred,
# but never crashes).
_LEVEL_ORDER = {"N5": 0, "N4": 1, "N3": 2, "N2": 3, "N1": 4}


def _level_rank(level: str) -> int:
    return _LEVEL_ORDER.get(level, 99)


def _reading_variants(kana_field: str) -> list:
    """A deck's kana field can list several readings separated by ';'."""
    if not kana_field:
        return []
    # The deck joins with "/" (毎月 is "まいげつ/まいつき", 18 entries);
    # ";" was the splitter's own convention and never the data's, kept
    # so a field written either way still splits (plan 104).
    return [r.strip() for r in kana_field.replace(";", "/").split("/") if r.strip()]


def _reading_matches(entry_kana: str, reading: str) -> bool:
    if not entry_kana or not reading:
        return False
    variants = _reading_variants(entry_kana)
    return reading in variants or reading == entry_kana.strip()


# ── Boundary safety for bare-kana matches ────────────────────
#
# Matching a word by its bare kana reading (a kana-only deck entry, a
# "usually kana" reading variant, or a conventional partial-kana
# spelling like 物->もの) is inherently riskier than matching its kanji
# form: with no morphological analyzer, a short kana string can just as
# easily be a coincidental substring spanning the TAIL of one word and
# the START of another as it can be the real word itself. Two examples
# that actually shipped this way:
#
#   お金は|いらない   -> greedy-matched "はい" ("yes"), which is really
#                        the topic particle は plus the start of いらない
#   ち|また|では       -> greedy-matched "また" ("again"), which is really
#                        the middle of an unrelated word ちまた
#
# Both are only detectable by looking at what's immediately adjacent to
# the match: a clean boundary is either the edge of a hiragana run, an
# already-recognized token, or a small set of unambiguous single-char
# particles / common grammatical endings. An unexplained hiragana
# character sitting right against the match is the signal that the
# "real" word boundary is actually somewhere else. This is deliberately
# a lightweight heuristic, not a grammar model — under-covering the
# particle/filler list below only costs a few legitimate matches
# getting skipped (safe direction), so it's kept to near-universal
# cases rather than an attempt at completeness.
_PARTICLE_CHARS = set("はがをにでともかのやねよわさぞぜへし")
_FILLER_WORDS = (
    "です", "でした", "でしょう", "ます", "ました", "ません", "ませんでした",
    "だった", "だろう", "ながら", "けれど", "けども", "けど", "という",
    "ような", "ように", "そうだ", "らしい", "でも", "しか", "だけ", "ばかり",
    "たい", "たかった",
)


def _is_hiragana(ch: str) -> bool:
    return "\u3040" <= ch <= "\u309f"


def _left_boundary_ok(text: str, start: int, covered: list) -> bool:
    """Safe to START a risky bare-kana match at `start`? Yes if there's
    no preceding hiragana at all (edge of the run), if that character
    already belongs to an already-accepted match (a legitimate adjacent
    word), or if it's one of the unambiguous single-char particles.
    Otherwise there's an unexplained hiragana character sitting right
    before the candidate — a sign the real word starts earlier than our
    candidate does (the ちまた/また case)."""
    if start == 0:
        return True
    prev = text[start - 1]
    if not _is_hiragana(prev):
        return True
    if covered[start - 1]:
        return True
    return prev in _PARTICLE_CHARS


def _right_boundary_ok(text: str, end: int) -> bool:
    """Mirror of _left_boundary_ok for the match's end. We can't yet
    know whether a LATER real vocab match will explain the text right
    after `end` (this runs before that part of the text is scanned), so
    an unrecognized hiragana character there is treated conservatively
    as "don't trust this match" (the お金はいらない case: らない after
    はい is neither a particle nor a recognized filler)."""
    if end >= len(text):
        return True
    nxt = text[end]
    if not _is_hiragana(nxt):
        return True
    if nxt in _PARTICLE_CHARS:
        return True
    return any(text.startswith(filler, end) for filler in _FILLER_WORDS)


def _pick_best_candidate(candidates: list, reading: str = None):
    """
    Disambiguate between multiple deck entries sharing the same surface
    form.

    candidates: list of (level, entry, entry_kana) tuples, all already
    known to match the requested surface/base text.

    Priority:
      1. An entry whose reading matches the one we were given (exact
         signal — e.g. from the phrase analyzer's LLM segmentation) --
         the lowest-level one when several do (plan 150: する matched
         the N3 為る read する before the N5 する, in 1,600 of the
         app's sentences, because the N3 card came first in the list).
      2. Otherwise, the entry from the lowest (most common) JLPT level,
         since niche secondary meanings tend to be introduced later.
      3. Otherwise, whichever candidate came first (stable fallback).
    """
    if not candidates:
        return None

    if reading:
        matching = [c for c in candidates if _reading_matches(c[2], reading)]
        if matching:
            return min(matching, key=lambda c: _level_rank(c[0]))[:2]

    return min(candidates, key=lambda c: _level_rank(c[0]))[:2]


def is_kanji(char: str) -> bool:
    return "\u4e00" <= char <= "\u9fff"


def _katakana_written(text: str) -> bool:
    return any("\u30a1" <= c <= "\u30fa" for c in text)


def serializable_entry(entry: dict) -> dict:
    """Keep only plain JSON-safe fields from a deck entry (kanji/vocab dict)."""
    return {k: v for k, v in entry.items() if isinstance(v, (str, int, float, bool)) or v is None}


# Best-first, so max() over this ordering answers "how well is this
# known across every mode it can be studied in".
_STATUS_RANK = {"not_started": 0, "new": 1, "learning": 2, "mastered": 3}


def card_stats(states: dict, user_id: str, raw_id: str, modes) -> dict:
    """
    Full per-card SRS stats for a detail panel, not just a status label.

    `modes` is the tuple of graded modes the card can be studied in (see
    the STATUS_MODES block above); a bare string is accepted for the one
    caller that still has a single mode in hand.

    Progress is tracked per (card, mode) pair, so "is this word known"
    is not single-valued -- it is answered here by merging across modes
    rather than by picking one and calling it canonical:

      status          the best reached in any mode
      reviews         summed, because they all happened
      accuracy        recomputed from those sums, never averaged
                      (averaging percentages weights a 2-review mode
                      the same as a 50-review one)
      due             true if ANY mode is due, since that is what the
                      badge is telling you to go and do
      interval_days   the longest, matching `status`
      next_review     the EARLIEST, which is when this card next wants
                      attention -- the opposite end from interval_days,
                      and correct for the same reason `due` is an any.
      progress        the furthest, 0 (new) to 1 (mastered), matching
                      `status` (plan 147: the bar a catalogue tile fills)
    """
    if isinstance(modes, str):
        modes = (modes,)

    items = [
        item for item in (states.get((f"{user_id}:{raw_id}", m)) for m in modes)
        if item is not None
    ]

    if not items:
        return {
            "status": "not_started",
            "total_reviews": 0,
            "correct_reviews": 0,
            "accuracy": None,
            "due": False,
            "interval_days": None,
            "next_review": None,
            "progress": 0.0,
        }

    total = sum(i["total_reviews"] for i in items)
    correct = sum(i["correct_reviews"] for i in items)
    intervals = [i["interval_days"] for i in items if i["interval_days"] is not None]
    next_reviews = [i["next_review"] for i in items if i["next_review"] is not None]

    return {
        "status": max((i["state"] for i in items), key=lambda s: _STATUS_RANK.get(s, 0)),
        "total_reviews": total,
        "correct_reviews": correct,
        "accuracy": round(correct / total * 100, 1) if total > 0 else None,
        "due": any(i["due"] for i in items),
        "interval_days": max(intervals) if intervals else None,
        "next_review": min(next_reviews) if next_reviews else None,
        "progress": max(i.get("progress", 0.0) for i in items),
    }


# NOTE (2026-08-31): find_vocab_match (plus its private
# _surface_variants helper) lived here and was removed. It resolved ONE
# already-segmented word -- the phrase analyzer's LLM-supplied
# surface/base/reading triple -- by scanning all five decks and
# recomputing spelling variants per entry on every call: ~790 ms a word,
# so a ten-word sentence cost the better part of eight seconds. Its
# caller went away in 3b9257e6 (2026-08-26), when the analyzer dropped to
# the local tier and started resolving tokens through resolve_lemma /
# resolve_kana below, which answer the same question off indexes built
# once at import time (~0.006 ms) and keep the reading disambiguation and
# lowest-JLPT tie-break intact via _pick_best_candidate.
#
# One thing did NOT survive: matching an alternate SPELLING with no
# reading in hand. find_vocab_match resolved a bare "ご飯" to the deck's
# 御飯, and ぬるい to 温い; resolve_lemma misses both, and resolve_kana
# needs a reading (and a content-word POS) to cover them. If that is
# wanted again -- routes reading/translation want it for the ~20 curated
# sentences whose focus word is spelled the deck's other way -- it
# belongs as extra keys in _index_vocab_by_lemma, next to the numeral
# variants already there, not as a re-scan of the decks per lookup.


# ── Sentence source words ────────────────────────────────────────────
#
# The reading and translation screens study a curated SENTENCE, but the
# sentence was chosen to practise one vocabulary word, which it carries
# as `source_word` (see routes/reading.py's _finish_phrase). Grading one
# of those sentences is evidence about that word, so the rating is
# scheduled against the word's own SRS card -- and that means turning a
# source_word back into a real card id.
#
# Why an index and not a per-lookup deck scan: walking all five decks
# and recomputing spelling variants per entry -- what the phrase
# analyzer's find_vocab_match used to do, before the local tier left it
# without callers -- was measured at 766 ms. That is fine for a one-off
# lookup and far too slow for something on the review path, which runs
# once per rating. This builds the index once instead: 0.002 ms per
# lookup, at the cost of matching on exact spellings only.
_LEVELS = ("N5", "N4", "N3", "N2", "N1")

_vocab_lookup: dict[str, dict[str, dict]] | None = None


def _vocab_index() -> dict[str, dict[str, dict]]:
    """level -> lookup key -> vocab entry, built once on first use.

    Three keys per entry: the kanji, each reading, and the pair. A
    curated sentence names its focus word as a bare string with no
    reading at all, and that string is sometimes the kana form of a
    kanji-less entry (バス), so a kanji-only lookup would miss it.

    Readings are split on "/" because an entry can carry more than one
    (毎月 is "まいげつ/まいつき"), and a whole-field comparison matches
    neither of them.

    setdefault, not assignment: where two entries share a key the first
    in the list wins, so the same word resolves the same way on every
    request rather than depending on iteration luck.

    A second pass adds conventional kana spellings from vocab_extras'
    two generators -- kana_spelling_variants (買い物 -> 買いもの) and
    trailing_kana_variants (子供 -> 子ども, 友達 -> 友だち) --
    mirroring what _index_vocab_by_lemma does for the segmentation
    path. It runs after the first so it can skip keys already claimed,
    which makes it strictly additive: a variant can turn a failed
    lookup into a hit, never change the answer to one that already
    worked. The kanji filter is carried over from that function for
    consistency, but it earns its place differently here -- the
    nominalizer hazard it exists to prevent there cannot arise on this
    index, which is fed explicit source_word dicts rather than a token
    stream and already keys every entry by its bare reading anyway. All
    it does here is keep combinatorial junk (時々 -> とき々) out.

    Worth knowing before extending this: between them the two
    generators take the curated focus words that fail to resolve from
    17 down to 13, fixing 買いもの, 友だち and 子ども (which occurs
    twice). The ones that remain are NOT a spelling problem, and no
    richer index will reach them -- 顔, 百円, 洋食, 大雨, 失礼,
    説明書, 館内, 支援, 専門家, お客様 and 言い方 are absent from the
    deck under every spelling. They need deck entries or different
    focus words. 母 and 父 were two more until plan 102 gave them N5
    entries of their own (they had appeared only as お母さん / お父さん,
    which are different words, not variants); the rest are that plan's
    review to settle.
    """
    global _vocab_lookup
    if _vocab_lookup is None:
        built: dict[str, dict[str, dict]] = {}
        for level in _LEVELS:
            table: dict[str, dict] = {}
            for entry in VOCAB_BY_LEVEL.get(level, []):
                kanji = (entry.get("kanji") or "").strip()
                kana = (entry.get("kana") or "").strip()
                if kanji:
                    table.setdefault(kanji, entry)
                for reading in kana.split("/"):
                    reading = reading.strip()
                    if not reading:
                        continue
                    table.setdefault(reading, entry)
                    if kanji:
                        table.setdefault(f"{kanji}	{reading}", entry)
            for entry in VOCAB_BY_LEVEL.get(level, []):
                kanji = (entry.get("kanji") or "").strip()
                if not kanji:
                    continue
                kana = (entry.get("kana") or "").strip()
                variants = (
                    *vocab_extras.kana_spelling_variants(kanji),
                    *vocab_extras.trailing_kana_variants(kanji, kana),
                )
                for variant in variants:
                    if variant == kanji or variant in table:
                        continue
                    if any(is_kanji(c) for c in variant):
                        table.setdefault(variant, entry)
            built[level] = table
        _vocab_lookup = built
    return _vocab_lookup


def vocab_card_id_for_word(source_word: dict | None, user_id: str) -> str | None:
    """The prefixed SRS card id for a sentence's source word, or None.

    Resolved against the real vocabulary list rather than built straight
    from the payload, because `source_word` does NOT carry a usable id:
    it reports kana as "" for every curated sentence, so
    vocab_to_id({"kanji": "駅", "kana": ""}) yields `vocab_N5_駅_` while
    the card every vocab session actually uses is `vocab_N5_駅_えき`.
    Trusting the payload would mint a phantom card next to the real one
    and schedule reviews onto something nothing else ever reads.

    The word's OWN level wins over the sentence's. A curated sentence
    reports the level of the SENTENCE, and its focus word frequently
    belongs to a different deck -- 本 is the focus of an N4 sentence but
    is an N5 word, and the card is `vocab_N5_本_ほん`. Searching only the
    declared level resolved 3 of 45 N4 sentences and 2 of 41 N2 ones;
    falling back to the other levels resolves 206 of the bank's 223. The
    declared level is still tried first, so a word that genuinely sits
    in two decks schedules the one its sentence was built for.

    None whenever the word cannot be resolved. Around twenty curated
    sentences focus on an orthographic variant the deck spells
    differently (子ども vs 子供, ごはん vs ご飯); matching those needs a
    variant table, and guessing without one would schedule the wrong
    card. Callers log the result either way -- only the scheduling is
    skipped.
    """
    if not source_word:
        return None
    level = (source_word.get("level") or "").strip()
    kanji = (source_word.get("kanji") or "").strip()
    kana = (source_word.get("kana") or "").strip()
    if not (kanji or kana):
        return None

    # Most specific key first, so an exact word+reading pair is never
    # beaten by a bare homograph.
    keys = []
    if kanji and kana:
        keys.append(f"{kanji}	{kana}")
    if kanji:
        keys.append(kanji)
    if kana:
        keys.append(kana)

    index = _vocab_index()
    order = ([level] if level in index else []) + [l for l in _LEVELS if l != level]
    for lvl in order:
        table = index[lvl]
        for key in keys:
            entry = table.get(key)
            if entry is not None:
                return f"{user_id}:{vocab_to_id(entry, lvl)}"
    return None


def _kanji_candidates_for(char: str):
    return [
        (level, entry)
        for level, kanji_list in KANJI_BY_LEVEL.items()
        for entry in kanji_list
        if entry.get("kanji") == char
    ]


def find_kanji_matches(text: str):
    """Find every kanji character in `text` that exists in the kanji deck.

    If the same character were ever duplicated across levels in the deck,
    this picks the lowest-level (most common) entry rather than whichever
    happens to be found first while iterating.
    """
    matches = []
    seen = set()
    for char in text:
        if char in seen or not is_kanji(char):
            continue
        seen.add(char)
        candidates = _kanji_candidates_for(char)
        if not candidates:
            continue
        level, entry = min(candidates, key=lambda c: _level_rank(c[0]))
        matches.append((char, level, entry, kanji_to_id(entry, level)))
    return matches


def _kanji_fallback_hits(text: str, covered: list):
    """(start, end, level, entry, raw_id) for every not-yet-`covered`
    kanji character in `text` that exists in the kanji deck — the
    per-character fallback both scan paths (morphology-based and
    legacy) share for whatever a word-level match didn't already cover."""
    hits = []
    for idx, char in enumerate(text):
        if covered[idx] or not is_kanji(char):
            continue
        candidates = _kanji_candidates_for(char)
        if not candidates:
            continue
        level, entry = min(candidates, key=lambda c: _level_rank(c[0]))
        hits.append((idx, idx + 1, level, entry, kanji_to_id(entry, level)))
        covered[idx] = True
    return hits


def _assemble_segments(text: str, vocab_hits: list, grammar_hits: list, kanji_hits: list):
    """Merge vocab + kanji hits into one ordered, non-overlapping list of
    segments covering the whole string, filling gaps with plain text —
    shared tail of both scan paths so their output shape stays
    identical. `grammar_hits` is always empty now (see the 2026-08 note
    on GRAMMAR_STATUS_MODE above) — kept as a parameter only so both
    call sites don't need to change shape.

    Each non-plain segment also carries a "category" — "kanji", or (for
    vocab) whatever vocab_extras.word_category says (verb/adjective/
    noun/other) — computed uniformly here regardless of which scan path
    produced the hit, so both paths' output is styled the same way on
    the frontend."""
    n = len(text)
    hits = sorted(vocab_hits + grammar_hits + kanji_hits, key=lambda h: h[0])
    segments = []
    cursor = 0
    for start, end, level, entry, raw_id in hits:
        if start > cursor:
            segments.append({"text": text[cursor:start], "start": cursor, "end": start, "type": "plain"})
        key = (start, end, level, entry, raw_id)
        if key in vocab_hits:
            seg_type = "vocab"
            word = entry.get("kanji") or entry.get("word") or entry.get("vocab") or ""
            kana = entry.get("kana") or entry.get("reading") or ""
            category = vocab_extras.word_category(word, kana)
        else:
            seg_type = "kanji"
            category = "kanji"
        segments.append({
            "text": text[start:end], "start": start, "end": end, "type": seg_type,
            "category": category, "level": level, "raw_id": raw_id, "entry": serializable_entry(entry),
        })
        cursor = end
    if cursor < n:
        segments.append({"text": text[cursor:n], "start": cursor, "end": n, "type": "plain"})
    return segments


def _index_vocab_by_lemma():
    """kanji-field text (PLUS its Arabic-numeral variant, e.g. both 二日
    and 2日) -> [(level, entry), ...]. Used by the morphology-based scan
    to resolve a token's dictionary form straight to a deck entry —
    since a real tokenizer already normalizes surface spelling
    (kana/kanji, conjugation) down to this one dictionary form, this one
    index replaces essentially all of _vocab_candidates' variant-surface
    machinery below for that path. Multiple entries can share the same
    lemma text (homographs, e.g. 歩 as "to walk" vs. the shogi piece) —
    see _pick_best_candidate for how a token's own reading disambiguates
    between them. The numeral-variant keys exist because MeCab tokenizes
    a date/count compound as separate morphemes (二 + 日), so no single
    token's lemma is ever literally "二日" — see
    _resolve_numeral_compound below, which is the one place this index
    still needs the same variant-surface trick the legacy path uses.

    Conventional kana spellings are keys too, from vocab_extras' two
    complementary generators: kana_spelling_variants swaps one of eight
    hand-picked characters (御飯 -> ご飯, 食べ物 -> 食べもの), and
    trailing_kana_variants writes a trailing kanji out as its own
    reading (子供 -> 子ども, 友達 -> 友だち, 見付ける -> 見つける),
    which the first cannot reach because 供 and 達 are not on its
    list. Both are admitted ONLY when the result still contains a
    kanji. A tokenizer
    hands us whichever spelling the page used, and its lemma for ご飯
    is ご飯, not the deck's 御飯 -- so without these keys the word is
    simply missed, which is what the deleted find_vocab_match used to
    cover (see the note above it).

    The kanji filter is the whole safety story, and it is the same
    distinction _vocab_candidates draws with its `risky` flag.
    kana_spelling_variants reduces a one-character word to BARE kana
    (事 -> こと, 物 -> もの, 時 -> とき, 方 -> ほう), and those are precisely
    the nominalizers and formal nouns that carry no lexical weight in
    running text. resolve_lemma is consulted before resolve_kana and is
    ungated, so a bare-kana key here would resolve every grammatical
    こと/もの/よう to a vocab card while bypassing the POS, length and
    auxiliary_use guards resolve_kana applies for exactly that reason.
    Requiring a kanji keeps the distinctive spellings and drops all of
    them. It also admits some combinations nobody writes (時間 yields
    とき間), which are harmless: no tokenizer will ever produce them as
    a lemma, so they sit in the dict unmatched.

    Variants are added in a SECOND pass, and only for keys the first
    pass did not already claim, which makes them strictly additive:
    they can turn a lookup that used to fail into a hit, never change
    the answer to one that already succeeded. Three deck words used to
    carry both spellings as separate entries at different levels (御馳走
    N2 and ご馳走 N1, likewise 御無沙汰, 御手洗い), and merging those
    candidate lists would have handed ご馳走 to _pick_best_candidate's
    lowest-level tie-break, repointing the word under a learner's SRS
    history. Plan 112 answered the question this index could not -- the
    deck holds each of them once now -- and the fourth pass
    (_fold_into_lemma_index) is the one that appends to a claimed key,
    because what it appends is the card that replaced one already there.
    """
    index = {}
    for level, vocab_list in VOCAB_BY_LEVEL.items():
        for entry in vocab_list:
            word = entry.get("kanji") or entry.get("word") or entry.get("vocab") or ""
            if not word:
                continue
            index.setdefault(word, []).append((level, entry))
            numeral = vocab_extras.numeral_variant(word)
            if numeral and numeral != word:
                index.setdefault(numeral, []).append((level, entry))

    for level, vocab_list in VOCAB_BY_LEVEL.items():
        for entry in vocab_list:
            word = entry.get("kanji") or entry.get("word") or entry.get("vocab") or ""
            if not word:
                continue
            kana = entry.get("kana") or entry.get("reading") or ""
            variants = (
                *vocab_extras.kana_spelling_variants(word),
                *vocab_extras.trailing_kana_variants(word, kana),
            )
            for variant in variants:
                if variant == word or variant in index:
                    continue
                if any(is_kanji(c) for c in variant):
                    index.setdefault(variant, []).append((level, entry))

    # Third pass (plan 106): the entry under UniDic's OWN lemma for its
    # written form. UniDic's lemma is an orthographic base, not the deck's
    # spelling -- 帰る lemmatises to 返る, 降りる to 下りる, 終る to
    # 終わる, 感じる to 感ずる -- so a token of the N5 帰る resolved, when
    # it resolved at all, to the N1 返る card: 213 deck words, 55 of them
    # badging a higher level than their own. Keyed by the lemma the
    # tokenizer will actually hand resolve_morpheme, each such entry is
    # reachable again; where the lemma is ALSO a deck word (返る is),
    # both are candidates and resolve_lemma's surface preference tells
    # them apart. Appended, never skipped: the whole point is to stand
    # beside the entry that already owns the key. Tokenizing the 7,300
    # written forms costs 0.08 s at import.
    if morphology.MORPHOLOGY_AVAILABLE:
        for level, vocab_list in VOCAB_BY_LEVEL.items():
            for entry in vocab_list:
                word = entry.get("kanji") or ""
                if not word or " " in word or not any(is_kanji(c) for c in word):
                    continue
                morphemes = morphology.tokenize(word, plain=True)
                if not morphemes or len(morphemes) != 1:
                    continue
                lemma = morphemes[0].lemma
                if lemma != word and (level, entry) not in index.get(lemma, []):
                    index.setdefault(lemma, []).append((level, entry))
        _stand_kana_cards_beside(index)
    return index


_GLOSS_STOP = frozenset({"to", "the", "a", "an", "of", "in", "on", "at", "for", "and", "or", "be",
                         "esp", "etc", "e.g", "abbr", "one", "one's", "something", "someone", "into"})


def _gloss_words(entry: dict) -> set[str]:
    """The words of an English gloss, less the ones every gloss has, a
    plural folded to its singular (drops, drop)."""
    import re
    words = {w.strip(".") for w in re.findall(r"[a-z][a-z'.]*", (entry.get("meaning") or "").lower())}
    return {w[:-1] if len(w) > 3 and w.endswith("s") and not w.endswith("ss") else w
            for w in words if len(w) > 1 and w not in _GLOSS_STOP}


# (lemma, raw_id) -> the readings a kana-only card stands under that lemma
# for (see _stand_kana_cards_beside); resolve_lemma admits it for those only.
_KANA_BESIDE: dict[tuple[str, str], frozenset[str]] = {}


def _stand_kana_cards_beside(index) -> None:
    """The lemma index's fifth pass (plan 150): a card written in kana
    alone, beside the same word's kanji card at a higher level. する is
    為る to the tokenizer, なる is 成る, いい is 良い, and under those keys
    stood only the N3 為る, the N3 為る read なる, the N1 好い -- so every
    する in every sentence badged N3 (1,600 of the app's own sentences).
    The N5 card stands beside it now, for its own reading only, and
    _pick_best_candidate prefers the lower level among the cards the
    reading matches. A token written 為る still reaches the kanji card:
    resolve_lemma keeps the candidates that share its first character.

    Only beside a card of the SAME word: the same reading and a gloss in
    common. Standing alone, a kana card's lemma is the tokenizer's guess
    at which word those letters are, and it guesses one word for several
    -- the N3 たとえ ("simile") tokenizes as 仮令 ("even if"), the N3 なお
    ("ordinary") as 尚 ("still"), いかが as 如何 beside いかん."""
    for level, vocab_list in VOCAB_BY_LEVEL.items():
        for entry in vocab_list:
            if entry.get("kanji"):
                continue
            mine = _gloss_words(entry)
            for kana in _reading_variants(entry.get("kana") or ""):
                if not kana or " " in kana or not all("\u3041" <= c <= "\u309f" for c in kana):
                    continue
                morphemes = morphology.tokenize(kana, plain=True)
                if not morphemes or len(morphemes) != 1:
                    continue
                m = morphemes[0]
                if m.lemma == kana or m.lemma_reading != kana or (level, entry) in index.get(m.lemma, []):
                    continue
                twins = [(lv, e) for lv, e in index.get(m.lemma, [])
                         if _level_rank(lv) > _level_rank(level)
                         and kana in {morphology.kata_to_hira(r) for r in _reading_variants(e.get("kana") or "")}
                         and mine & _gloss_words(e)]
                if not twins:
                    continue
                index.setdefault(m.lemma, []).append((level, entry))
                key = (m.lemma, vocab_to_id(entry, level))
                _KANA_BESIDE[key] = _KANA_BESIDE.get(key, frozenset()) | {kana}


def _fold_into_lemma_index(index) -> dict[tuple[str, str], frozenset[str]]:
    """The lemma index's fourth pass (plan 112): a kanji spelling folded
    into another card. The N1 美味しい went into the N5 おいしい and the N5
    終る became 終わる, but a page still writes both, and a token whose
    lemma is 美味しい used to find a card of that spelling. The card that
    took the word in stands under the key now, exactly where the card it
    replaced stood -- beside whatever else the key holds (身体 read
    しんたい keeps its place beside 体 for 身体 read からだ).

    Returns (key, raw_id) -> the readings the fold stands for, for each
    card this pass alone put under a key, and resolve_lemma admits such
    a card only for one of those readings. A folded spelling is that
    word READ THAT WAY, and a written form is often another word read
    another way: 何時 read いつ is the いつ card, 何時 read なんじ is "what
    time"; 二十 read はたち is 二十歳, read にじゅう it is twenty; 彼の
    read あの is the あの card, 彼 + の read かれの is "his", in 44 of the
    app's own sentences. Before the reading was asked, the lowest-level
    candidate won every one of them. A card the key held before the fold
    (天皇 folding すめらぎ into 天皇 read てんのう) is not listed: the
    fold took nothing there that the card did not already answer for.
    """
    folded: dict[tuple[str, str], set[str]] = {}
    for level, vocab_list in VOCAB_BY_LEVEL.items():
        for entry in vocab_list:
            raw_id = vocab_to_id(entry, level)
            for kanji, kana in FOLDED_FORMS.get(raw_id, ()):
                if not kanji:
                    continue
                if (level, entry) not in index.get(kanji, []):
                    index.setdefault(kanji, []).append((level, entry))
                elif (kanji, raw_id) not in folded:
                    continue
                readings = {morphology.kata_to_hira(r) for r in _reading_variants(kana)}
                folded.setdefault((kanji, raw_id), set()).update(readings)
    return {key: frozenset(readings) for key, readings in folded.items()}


def _index_vocab_by_kana():
    """kana-field text -> [(level, entry), ...], covering EVERY deck
    entry (not just ones with no kanji field at all). Broader than just
    "kana-only words" because a token's own lemma TEXT doesn't always
    match whatever a deck happens to store: UniDic's lemma for a
    kana-primary word can be an archaic kanji spelling no deck would
    realistically use (あなた's lemma is 貴方), and a kana-only deck
    entry might store its kana text directly in the "kanji" field
    rather than leaving it empty — this index doesn't need to assume
    either convention, it just matches by reading when the lemma-text
    match already tried in the caller comes up empty.

    A katakana reading is keyed by its hiragana fold as well (plan 104):
    the tokenizer's readings arrive folded (morphology.kata_to_hira, so
    パン's is ぱん) while the deck stores the 541 katakana-only words as
    written, and until this key existed not one of them ever matched --
    パン, コーヒー, バス, テレビ, ドア badged nothing in every sentence
    that used them. The fold is a second key on the same entry, never a
    replacement: the written form still answers for a caller that has
    it (vocab_card_id_for_word)."""
    index = {}
    for level, vocab_list in VOCAB_BY_LEVEL.items():
        for entry in vocab_list:
            kana = entry.get("kana") or entry.get("reading") or ""
            if not kana:
                continue
            for reading in _reading_variants(kana):
                index.setdefault(reading, []).append((level, entry))
                folded = morphology.kata_to_hira(reading)
                if folded != reading:
                    index.setdefault(folded, []).append((level, entry))
    # A kana spelling folded into another card (plan 112: インキ into
    # インク, ウェートレス into ウエートレス) stands where the card it
    # replaced stood -- the lemma index's fourth pass, for the words
    # written without kanji.
    for level, vocab_list in VOCAB_BY_LEVEL.items():
        for entry in vocab_list:
            for kanji, kana in FOLDED_FORMS.get(vocab_to_id(entry, level), ()):
                if kanji:
                    continue
                for reading in _reading_variants(kana):
                    for key in {reading, morphology.kata_to_hira(reading)}:
                        if (level, entry) not in index.get(key, []):
                            index.setdefault(key, []).append((level, entry))
    return index


_VOCAB_BY_LEMMA = _index_vocab_by_lemma()
_FOLDED_READINGS = _fold_into_lemma_index(_VOCAB_BY_LEMMA)
_VOCAB_BY_KANA = _index_vocab_by_kana()


def _fold_admits(lemma: str, level: str, entry: dict, reading: str) -> bool:
    """Whether a lemma-index candidate may answer for a token read
    `reading` (hiragana): always, unless only a folded spelling put it
    under `lemma`, and then only for a reading that fold stands for --
    or a kana card stands there beside its twin (_stand_kana_cards_beside),
    and then only for its own reading."""
    raw_id = vocab_to_id(entry, level)
    folded = _FOLDED_READINGS.get((lemma, raw_id))
    beside = _KANA_BESIDE.get((lemma, raw_id))
    return (folded is None or reading in folded) and (beside is None or reading in beside)


def resolve_lemma(lemma: str, reading: str, surface: str = ""):
    """(level, entry, raw_id) for the deck entry whose kanji field is
    `lemma`, disambiguated by `reading` when several entries share that
    lemma text (see _index_vocab_by_lemma), or None.

    `surface` is the token as written, when the caller has it (plan 106).
    Since the index also files an entry under UniDic's lemma for it, one
    lemma can name two deck words with the same reading -- 返る holds
    both 返る (N1) and 帰る (N5), 上る holds 上る, 登る and 昇る -- and
    the reading cannot tell them apart. The page can: a token written 帰り
    is 帰る. Where any candidate shares the surface's first kanji, only
    those stay; where none does (the token was written in kana), the
    reading and the level decide as before.

    A card that stands under `lemma` only by a folded spelling is a
    candidate only when `reading` is the one the fold stands for (see
    _fold_into_lemma_index), so an empty reading never reaches it."""
    candidates = _VOCAB_BY_LEMMA.get(lemma)
    if not candidates:
        return None
    reading_hira = morphology.kata_to_hira(reading) if reading else ""
    candidates = [c for c in candidates if _fold_admits(lemma, *c, reading_hira)]
    if not candidates:
        return None
    if surface and is_kanji(surface[0]):
        same_head = [c for c in candidates if (c[1].get("kanji") or "")[:1] == surface[0]]
        if same_head:
            candidates = same_head
    triples = [(level, entry, entry.get("kana") or entry.get("reading") or "") for level, entry in candidates]
    best = _pick_best_candidate(triples, reading)
    if best is None:
        return None
    level, entry = best
    return level, entry, vocab_to_id(entry, level)


def resolve_kana(reading: str, pos: str, auxiliary_use: bool, after_conjunctive: bool = True,
                 surface: str = "", goshu: str = ""):
    """Fallback for when lemma-TEXT matching finds nothing (see
    _index_vocab_by_kana for why that happens even for words that ARE
    in the deck): match by reading instead. Gated to content-word POS
    classes, a minimum length, and NOT `auxiliary_use` (see
    morphology.Morpheme) — reading-alone is a genuine homophone risk
    (箸/橋/端 all はし; 要る/居る both いる), and a verb in its
    grammaticalized/auxiliary use (居る as the ~ている progressive
    marker) is both far more common in ordinary text than its
    independent use and the case most likely to collide with an
    unrelated deck word of the same reading — so this only fires for
    words being used on their own, not that class of match.

    Two admissions, plan 104, each narrower than the gate it opens:

    An ADVERB is admitted, but only to a kana-only entry, and so, since
    plan 186d, is an INTERJECTION. The deck's
    adverbs are kana-only words with nothing to collide with (もう,
    もっと, ゆっくり, よく), while the kanji homophones a reading also
    reaches (こう is 請う and 溝 too) are nouns and verbs, which an
    adverb is never an instance of. Before this, もう and どう -- N5
    cards -- badged nothing in the 136 sentences that use them.

    A token in AUXILIARY USE is admitted when it does not follow a
    conjunctive て/で -- that position is what the gate exists for
    (ている, てくる, てしまう) -- AND its reading has exactly one
    candidate at its best level. できる is tagged 非自立可能 by UniDic
    whatever it does in the sentence, and 買い物ができます has it as the
    main verb: one N5 entry, admitted. いる has 居る and 要る both at N5:
    still refused, whatever precedes it. `after_conjunctive` defaults
    to True so a caller without the context keeps the old gate;
    resolve_morpheme computes it.

    Two refusals, plan 150, for the caller that hands in the token as
    written (`surface`) and where it comes from (`goshu`, UniDic's 語種):
    a reading is a sound, and a sound is shared by words that have
    nothing else in common.

    A token WRITTEN IN KANJI is not a card spelled with other kanji: the
    lemma path has already looked for its own spelling, so a card of the
    same reading and different characters is a homophone -- 郷 read ごう
    is not 号 ("number, issue"), which the breakdown used to gloss it
    with; 開店 is not 回転 ("rotation"), 生涯 not 障害, 正統 not 正当. A
    kana-only card is still admitted (沢山 is たくさん), and so is one
    spelled with every kanji the token writes (か所 is 個所) -- but never a
    katakana one: 盤 read ばん is not バン, 省 read しょう not ショー.

    A LOANWORD (外) is not a native or Sino-Japanese card: センス is not
    扇子 ("folding fan"), ショー not 章, ホール not 放る. Only a card
    written in kana answers for it (タバコ is the たばこ card). ダメ and
    キレイ are 混 and 漢 --
    native words written in katakana -- and still reach 駄目 and 綺麗.

    And the other way round (plan 193): a NATIVE or Sino-Japanese word
    (和, 漢) the page writes in hiragana is not a card written in
    katakana. まま ("as it is", 儘) is not ママ ("mum"), which 着たまま
    and そのまま were glossed with in fourteen of the taught sentences.
    さぼる is 混 and still reaches サボる.
    What any refusal turns away goes on to the JMdict pool, which
    holds the word itself.
    """
    if pos not in ("noun", "pronoun", "verb", "adjective", "adverb", "interjection") or len(reading) < 2:
        return None
    candidates = _VOCAB_BY_KANA.get(reading)
    if not candidates:
        return None
    written_kanji = {c for c in surface if is_kanji(c)}
    if written_kanji:
        candidates = [c for c in candidates
                      if (written_kanji <= set(c[1].get("kanji") or "") if c[1].get("kanji")
                          else not _katakana_written(c[1].get("kana") or ""))]
    if goshu == "外":
        candidates = [c for c in candidates
                      if not (c[1].get("kanji") or "") or _katakana_written(c[1].get("kanji") or "")]
    elif goshu in ("和", "漢") and surface and not _katakana_written(surface):
        candidates = [c for c in candidates
                      if c[1].get("kanji") or not _katakana_written(c[1].get("kana") or "")]
    if not candidates:
        return None
    if pos in ("adverb", "interjection"):
        # An interjection is admitted as an adverb is, to a kana-only
        # card alone (plan 186d): the greetings a first lesson teaches
        # (おはよう, さようなら, ありがとう) are kana cards, and UniDic
        # files them under kanji the deck does not write (御早う,
        # 有り難う), so the lemma path never met them and the breakdown
        # showed おはよう as no word or ありがとう as the pool's.
        candidates = [c for c in candidates if not c[1].get("kanji")]
        if not candidates:
            return None
    if auxiliary_use:
        if after_conjunctive:
            return None
        best = _level_rank(min(candidates, key=lambda c: _level_rank(c[0]))[0])
        if sum(1 for c in candidates if _level_rank(c[0]) == best) != 1:
            return None
    level, entry = min(candidates, key=lambda c: _level_rank(c[0]))
    return level, entry, vocab_to_id(entry, level)


# A row's a-row kana back to its u-row: 待た -> 待つ.
_A_TO_U_ROW = {"か": "く", "が": "ぐ", "さ": "す", "た": "つ", "な": "ぬ", "ば": "ぶ", "ま": "む", "ら": "る", "わ": "う"}


def _made_to_verb(morphemes, i: int):
    """(level, entry, raw_id) for the verb a short causative-passive is
    made of, where UniDic reads a す-verb no card teaches (plan 272):
    待たされた is 待つ, "was made to wait" -- the detector's 使役受身形
    reads the same shape (_short_causative_passive_spans). Else None."""
    m = morphemes[i]
    nxt = morphemes[i + 1] if i + 1 < len(morphemes) else None
    lemma = m.lemma or ""
    if (m.pos != "verb" or not m.surface.endswith("さ") or len(lemma) < 3 or lemma[-1] != "す"
            or lemma[-2] not in _A_TO_U_ROW or not _has_kanji(lemma[-3]) or nxt is None
            or nxt.pos != "auxiliary" or nxt.lemma not in ("れる", "られる") or lemma == "知らす"
            or any((e.get("kanji") or "") == lemma for _lv, e in _VOCAB_BY_LEMMA.get(lemma, ()))):
        return None
    base = lemma[:-2] + _A_TO_U_ROW[lemma[-2]]
    hit = next(((lv, e) for lv, e in _VOCAB_BY_LEMMA.get(base, ()) if (e.get("kanji") or "") == base), None)
    return (hit[0], hit[1], vocab_to_id(hit[1], hit[0])) if hit else None


# Words the tokenizer's adjusters mark as a name where they are one
# (morphology: 中央線, 中央三丁目), whose cards are the common noun's.
_NAMED_HERE = frozenset({"中央", "中央線", "中央道"})
# The verbs whose お〜です says what someone does, honoured (plan 272):
# お考えです is "is thinking of", no 考え, "an idea" -- never お休みです,
# "is closed today", whose 休み is the day.
_HONORED_STEMS = frozenset({"考え", "待ち", "持ち", "探し", "出かけ", "帰り", "求め", "使い", "決まり", "住まい"})
# What runs fast, whose はやい is 速い (plan 272).
_MOVING = frozenset({"走る", "泳ぐ", "飛ぶ", "進む", "動く", "流れる", "回る", "回す", "投げる", "打つ", "漕ぐ"})
_VEHICLES = frozenset({"車", "くるま", "電車", "でんしゃ", "新幹線", "しんかんせん", "飛行機", "ひこうき", "自転車",
                       "じてんしゃ", "バス", "タクシー", "バイク", "足", "あし", "馬", "うま", "幹線",
                       "ランナー", "選手", "せんしゅ", "走者", "チーター", "ボール", "球", "たま", "流れ", "ながれ",
                       "スピード", "速度", "そくど", "テンポ"})


def _a_knob(morphemes, i: int) -> bool:
    """Whether morphemes[i] is the counter かけ after a number (plan 272):
    生姜1かけ, a knob of ginger."""
    prev = morphemes[i - 1] if i > 0 else None
    return morphemes[i].surface == "かけ" and prev is not None and (
        prev.surface.isdigit() or numeral_value(prev.surface) is not None)


def _a_gap_left(morphemes, i: int) -> bool:
    """Whether あける in kana at morphemes[i] leaves a span of time free
    (空ける): 6時間以上あけてください, 間をあける (plan 272)."""
    m = morphemes[i]
    if m.lemma not in ("開ける", "明ける") or _has_kanji(m.surface) or not m.surface.startswith("あけ"):
        return False
    clause = []
    for u in reversed(morphemes[:i]):
        if u.pos == "symbol" and u.surface in ("。", "！", "？"):
            break
        clause.append(u)
    # (ふたは10分あけておいて, 窓は1時間あけて: what opens, named -- 開ける,
    # however long it stays open, plan 272)
    if any(u.surface in morphology._OPENS_AND_SHUTS for u in clause):
        return False
    # (一行あけて, 席を一つあけておいて, スペースをあける: a space left)
    spaced = next((morphemes[k - 1] for k in range(i - 1, max(0, i - 4), -1)
                   if morphemes[k].surface == "を" and k >= 1), None)
    if spaced is not None and spaced.surface in _SPACES:
        return True
    if i >= 1 and (morphemes[i - 1].pos == "suffix" and morphemes[i - 1].surface in ("行", "マス", "席", "字")
                   or re.fullmatch(r"[一二三四五六七八九十0-9０-９]+(行|マス|席|字)", morphemes[i - 1].surface)):
        return True                     # (一行あけて, 二マスあける)
    before = [u.surface for u in morphemes[max(0, i - 3):i]]
    return any(w in ("時間", "間", "あいだ", "間隔", "日", "分", "週間", "以上") for w in before) \
        and not any(u.surface in ("を",) and k >= 1 and morphemes[k - 1].surface not in ("間", "間隔", "時間")
                    for k, u in enumerate(morphemes[max(0, i - 3):i], start=max(0, i - 3)))


# What あける leaves empty (空ける, plan 272): 席を一つあけて, 行をあけて.
_SPACES = frozenset({"席", "行", "間", "間隔", "スペース", "場所", "部屋", "家", "時間", "予定", "手", "穴", "道", "枠",
                     "一行", "一席", "ひとつ", "一つ"})


def _a_filler_ano(morphemes, i: int) -> bool:
    """Whether あの at morphemes[i] is "um", a mark after it (あの、ゴミの日
    は…), never "that" before a noun (plan 272)."""
    nxt = morphemes[i + 1] if i + 1 < len(morphemes) else None
    if morphemes[i].surface == "あの" and nxt is not None and nxt.pos == "particle" and nxt.surface in ("ね", "ねえ", "さ", "さあ") \
            and (i + 2 >= len(morphemes) or morphemes[i + 2].pos == "symbol"):
        return True                         # パパ、あのね、: "you know what", no "that"
    return morphemes[i].surface == "あの" and nxt is not None and nxt.pos == "symbol" and nxt.surface in ("、", "，", "…")


def _a_degree_noun(morphemes, i: int):
    """The pool's 低め, 高め, 早め -- "on the low side" -- for an
    adjective's stem and め UniDic read as the stem of 低める, where it
    stands as a noun: before a mark, の, に, で, が, は, を or the copula
    (外角低め、ストライク; 少し高めに設定する), or None (plan 272). 声を
    低めて is the verb."""
    m = morphemes[i]
    if m.pos != "verb" or not m.surface.endswith("め") or not m.cform.startswith("連用形") or not _has_kanji(m.surface):
        return None
    nxt = morphemes[i + 1] if i + 1 < len(morphemes) else None
    if nxt is not None and not (nxt.pos == "symbol" or (nxt.pos == "particle" and nxt.surface in (
            "の", "に", "で", "が", "は", "を", "も")) or nxt.lemma in ("だ", "です")):
        return None
    row = jmdict_db.get_by_key(m.surface, morphology.kata_to_hira(m.reading))
    return row if row is not None and "ish" in (row.get("meaning") or "") else None


def _glued_pair(a, b) -> bool:
    return getattr(a, "end", None) == getattr(b, "start", None)


def resolve_morpheme(morphemes, i: int):
    """(level, entry, raw_id) for the deck entry morphemes[i] is, by its
    lemma first and its reading second, or None -- the one way every
    screen resolves a word (study/analysis, level_mix, the reading-badge
    scanner, scripts/audit_vocab_deck), so "off-deck" means the same
    thing everywhere. The neighbour before it is what resolve_kana's
    auxiliary admission needs: whether this token hangs off a
    conjunctive て/で."""
    m0 = morphemes[i]
    if m0.lemma in ("驕る", "傲る", "奢る") and not _has_kanji(m0.surface):
        return None                         # おごる in kana treats (奢る, the pool's), plan 272
    if m0.surface == "あれ" and m0.pos == "interjection":
        return None                         # あれ、…だっけ？ "huh?", glossed (plan 272)
    if _a_knob(morphemes, i):
        return None                         # 生姜1かけ: a knob (glossed), no 賭け (plan 272)
    if _a_filler_ano(morphemes, i):
        return _by_neighbours(morphemes, i, None)   # あの、: the filler あのう (plan 272)
    if m0.surface in ("あんた", "アンタ"):
        return None                         # あんたの: "you", blunt -- glossed, no あなた (plan 272)
    if _a_degree_noun(morphemes, i) is not None:
        return None                         # 低め、高めに: the pool's noun, no 低める (plan 272)
    if m0.surface == "ナシ" and any(u.surface == "アリ" for u in morphemes):
        return None                         # アリかナシか: "out", glossed -- no 梨 (plan 272)
    if m0.surface == "サヨナラ" and any(w in "".join(u.surface for u in morphemes)
                                       for w in ("回", "裏", "打", "ホームラン", "ヒット", "フォアボール", "押し出し", "延長")):
        return None                         # 押し出しでサヨナラ！: a walk-off, glossed (plan 272)
    if m0.lemma in ("掛かる", "かかる") and i + 2 < len(morphemes) and morphemes[i + 1].surface == "て" \
            and morphemes[i + 2].lemma in ("来る", "くる") and morphemes[i + 2].cform.startswith("命令形"):
        return None                         # かかってこい: "come at me", glossed (plan 272)
    if m0.surface == "よう" and m0.pos == "adverb" and m0.lemma == "良く":
        return None                         # 毎日よう: the west's よく, glossed (plan 272)
    nxt0 = morphemes[i + 1] if i + 1 < len(morphemes) else None
    if m0.surface in ("でら", "えらい") and nxt0 is not None and (
            nxt0.pos in ("adjective", "adverb") or (nxt0.pos == "other" and nxt0.surface != "の")
            or (nxt0.pos == "verb" and _glued_pair(m0, nxt0))):
        return None                         # でら旨い, えらい上手に: "very", glossed -- no 寺, 偉い (plan 272)
    if _a_gap_left(morphemes, i):
        return None                         # 6時間以上あけて: 空ける, the pool's -- no 開ける (plan 272)
    if m0.surface == "かたがた" and i > 0 and morphemes[i - 1].pos == "noun":
        return None                         # ご挨拶かたがた: 〜かたがた's "while also", no 方々 (plan 272)
    if (m0.surface in _NAMED_HERE or m0.name_kind in ("business", "vessel")) and m0.proper:
        return None                         # 中央線, 中央三丁目, さくら旅館: a line's, a district's, an inn's name (plan 272)
    if m0.surface == "そう" and i > 0 and morphemes[i - 1].pos in ("verb", "adjective", "auxiliary") \
            and morphemes[i - 1].end == m0.start:
        return None                         # 違うそうです, 降りそう: the point's そう, no "like that" (plan 272)
    if m0.lemma == "マイナス" and m0.surface in ("－", "−", "ー"):
        return next(iter((lv, e, vocab_to_id(e, lv)) for lv, e in _kana_cards("マイナス")), None)
    hit = _resolve_morpheme(morphemes, i)
    if hit is not None and _there_is(morphemes, i):
        return hit
    if hit is not None and morphemes[i].pos == "adverb" and (hit[1].get("kanji") or "") == "嗚呼":
        # ああ the adverb is "like that" (ああいう, ああすれば): the
        # exclamation 嗚呼 is an interjection's card (plan 272).
        cards = _kana_cards(morphemes[i].surface)
        return min(((lv, e, vocab_to_id(e, lv)) for lv, e in cards), key=lambda c: _level_rank(c[0]),
                   default=None)
    hit = _by_neighbours(morphemes, i, hit)
    if hit is not None and (hit[1].get("kanji") or "") in _SETTLED_BESIDE and morphemes[i].pos == "verb" \
            and not _has_kanji(morphemes[i].surface):
        return hit                          # (おうちで かっても いい？ after the goldfish: 飼う, plan 272)
    hit = _kana_noun(morphemes, i, hit)
    nxt = morphemes[i + 1] if i + 1 < len(morphemes) else None
    spelled = _deck_verbs_spelled(morphemes[i], nxt)
    if len(spelled) > 1:
        # Several deck verbs share the spelling: the word it takes says
        # which (plan 272) -- にすんでいる lives, うそをついた lied.
        chosen = _by_partner(morphemes, i, spelled) or _by_sentence(morphemes, i, spelled) \
            or _by_use(morphemes, i, spelled)
        if chosen is not None:
            return chosen
    previous = morphemes[i - 1] if i > 0 else None
    behind_te = previous is not None and previous.pos == "particle" and previous.conjunctive
    if hit is None and len(spelled) == 1 and not (morphemes[i].auxiliary_use and behind_te) \
            and _resolve_morpheme(morphemes, i) is None:
        # UniDic read the kana as a verb the deck does not teach, and one
        # deck verb is spelled so (plan 272): 右にまがって is 曲がる, never
        # the 紛う UniDic named.
        return spelled[0]
    return _kana_verb(morphemes[i], hit, spelled)


def a_points_own_verb(morphemes, i: int) -> bool:
    """Whether morphemes[i] is the verb a point is made of, not a word
    of its own (plan 272): 洗ってきなさい's なさい is 〜なさい, a command,
    no "to do (honorific)"; 団長である's ある is the copula written out,
    no "to be (for things)". The breakdown's to drop (analysis._tokens)
    where the point is lit: the card is still the word's to the vocab
    audit."""
    m = morphemes[i]
    previous = morphemes[i - 1] if i > 0 else None
    if previous is None or m.pos != "verb":
        return False
    return ((m.lemma in ("為さる", "なさる") and m.cform.startswith("命令形")
             and previous.pos == "verb" and previous.cform.startswith("連用形"))
            or (m.lemma in ("有る", "ある") and previous.surface == "で"
                and previous.pos == "auxiliary" and previous.lemma == "だ"))


def split_unknown_compound(m) -> list[tuple[str, str, tuple]] | None:
    """[(surface, reading, hit)] for the two deck words a noun is that the
    tokenizer reads as one word no card and no pool row is (plan 272):
    右ひざ, UniDic's 右膝, is 右 "right" and ひざ "knee". Each part's card
    reads as the page reads that part, and the second is spelled as
    UniDic's lemma spells it (膝). The caller has asked the deck and the
    pool first."""
    if m.pos != "noun" or m.proper or m.name_kind or len(m.surface) < 2 or _numeral(m.surface):
        return None
    lemma, reading = m.lemma or m.surface, morphology.kata_to_hira(m.reading)
    if lemma == m.surface and len(m.surface) < 3:
        # (Two kanji the dictionary has no word for are as often a name:
        # みどり町の中山, no "inside" and "mountain".)
        return None
    for k in range(1, len(m.surface)):
        left, right = m.surface[:k], m.surface[k:]
        if not (_has_kanji(left) and lemma.startswith(left) and len(lemma) > len(left)):
            continue
        tail = lemma[len(left):]
        for p in range(1, len(reading)):
            first = _card(left, reading[:p])
            if first is None:
                continue
            second = _card(tail, reading[p:]) or (None if _has_kanji(right) else _card("", reading[p:]))
            if second is not None and (right == tail or morphology.kata_to_hira(right) == reading[p:]):
                return [(left, reading[:p], first), (right, reading[p:], second)]
    return None


# What one spares, 割く, no 裂く, "to tear" (plan 272).
_SPARED = frozenset({"時間", "じかん", "手間", "人手", "紙面", "ページ", "予算", "人員", "労力"})


# A godan verb's 連用形 ending back to its dictionary form (回し -> 回す).
_RENYO_TO_DICT = {"し": "す", "き": "く", "ぎ": "ぐ", "ち": "つ", "に": "ぬ", "び": "ぶ", "み": "む", "り": "る", "い": "う"}


def split_unknown_verb(m) -> list[tuple[str, str, tuple]] | None:
    """[(surface, reading, hit)] for a compound verb no dictionary holds,
    cut into the two deck verbs it is made of (plan 272): 回し入れる, "to
    pour in round the pan", is 回す's stem and 入れる, each with its card,
    where the row said nothing. The first is a deck verb's 連用形 as the
    lemma spells it; the second is a deck verb whole. The caller has
    asked the deck and the pool first."""
    if m.pos != "verb" or not _has_kanji(m.surface) or len(m.lemma or "") < 4:
        return None
    lemma, reading = m.lemma, morphology.kata_to_hira(m.reading)
    to_renyo = {d: r for r, d in _RENYO_TO_DICT.items()}
    for k in range(2, len(lemma) - 1):
        stem, second = lemma[:k], lemma[k:]
        if not (_has_kanji(stem) and _has_kanji(second[0]) and m.surface.startswith(stem)):
            continue
        latter = next(((lv, e) for lv, e in _VOCAB_BY_LEMMA.get(second, ()) if (e.get("kanji") or "") == second), None)
        if latter is None:
            continue
        forms = ([(stem[:-1] + _RENYO_TO_DICT[stem[-1]], True)] if stem[-1] in _RENYO_TO_DICT else []) + [(stem + "る", False)]
        for form, godan in forms:
            first = next(((lv, e) for lv, e in _VOCAB_BY_LEMMA.get(form, ()) if (e.get("kanji") or "") == form), None)
            if first is None:
                continue
            kana = first[1].get("kana") or ""
            kana_stem = kana[:-1] + to_renyo.get(kana[-1:], "") if godan else kana[:-1]
            if not kana_stem or not reading.startswith(kana_stem):
                continue
            return [(stem, kana_stem, (first[0], first[1], vocab_to_id(first[1], first[0]))),
                    (m.surface[len(stem):], reading[len(kana_stem):],
                     (latter[0], latter[1], vocab_to_id(latter[1], latter[0])))]
    return None


def _card(kanji: str, kana: str):
    """(level, entry, raw_id) for the deck card spelled `kanji` read `kana`."""
    for level, entry in _VOCAB_BY_KANA.get(kana, ()):
        if (entry.get("kanji") or "") == kanji:
            return level, entry, vocab_to_id(entry, level)
    return None


_KANA_NUMBERS = frozenset({"いち", "に", "さん", "よん", "ご", "ろく", "なな", "はち", "きゅう", "じゅう", "ひゃく",
                           "せん", "まん", "なん"})


# Animals a home keeps (飼う): かう in kana with one of them before it and
# nothing else bought (plan 272).
_PETS = frozenset({"犬", "いぬ", "猫", "ねこ", "金魚", "きんぎょ", "鳥", "とり", "小鳥", "ことり", "うさぎ", "兎",
                   "ハムスター", "めだか", "メダカ", "かぶとむし", "カブトムシ", "子犬", "こいぬ", "子猫", "こねこ",
                   "ペット", "亀", "かめ", "インコ"})


# The kanji family names are made of (中島, 山下, 藤原): a name of them
# alone is the name UniDic reads, where 北風 and 鶴, which it also files as
# names, are the wind and the bird (plan 272).
_SURNAME_KANJI = frozenset("中島山田川村木林森井上下野原本藤佐伊加小大高橋松竹石岡前後内外西東南北長谷部宮崎浜坂池沢"
                           "口吉渡辺斎近遠金清水谷今関平福安岩久武丸永江尾桜菅増千葉横須賀杉堀秋岸荒新古望月星宇")
_TITLES = frozenset({"さん", "様", "さま", "君", "くん", "ちゃん", "氏", "選手", "監督", "先生", "社長", "部長", "課長",
                     "係長", "教授", "博士", "議員", "首相", "大統領", "容疑者", "被告", "記者", "アナ"})


# What a row says of a given name it holds as a word (太郎 "first son").
_KIN = re.compile(r"\b(son|daughter|brother|sister|child|boy|girl)\b")


def _a_persons_name(morphemes, i: int) -> bool:
    """Whether the kanji name UniDic read at morphemes[i] is a person's,
    beside its title or the other half of the name, made of a family
    name's kanji, or spelling no common word."""
    m = morphemes[i]
    nxt = morphemes[i + 1] if i + 1 < len(morphemes) else None
    prev = morphemes[i - 1] if i > 0 else None
    if nxt is not None and (nxt.surface in _TITLES or (nxt.proper and nxt.name_kind in ("given", "family"))):
        return True
    if prev is not None and prev.proper and prev.name_kind == "family" and prev.end == m.start:
        return True                           # 斎藤健, 藤原葵
    if m.name_kind == "family" and len(m.surface) >= 2 and all(c in _SURNAME_KANJI for c in m.surface):
        return True
    row = jmdict_db.get_by_key(m.surface, morphology.kata_to_hira(m.reading))
    senses = (jmdict_db.get_senses(m.surface, row.get("kana", "")) or []) if row is not None else []
    common = any("⭐" in (sense.get("term_tags") or ()) for sense in senses)
    if m.name_kind != "family":
        # 太郎 alone keeps its row, "first son" (plan 236), and 鶴 its
        # common one, the bird; 啄木 the poet is no "woodpecker"
        return row is not None and not common and not any(
            _KIN.search(gloss) for sense in senses for gloss in sense.get("glossary") or ())
    return row is None or not common


# Verbs in kana _by_neighbours names from what the text says around
# them, which no kana verb's rival may then take back (plan 272).
_SETTLED_BESIDE = frozenset({"飼う", "掬う", "返る"})


def _a_pet_kept(morphemes, i: int) -> bool:
    """Whether the かう at morphemes[i] keeps an animal the text names
    before it, where no other thing is its を (犬のえさをかう is bought)."""
    # (ねこのえさ、どこでかったの？: a pet that modifies what was bought is
    # no evidence -- the cat food was bought, plan 272)
    if not any((u.surface in _PETS or u.lemma in _PETS)
               and not (k + 1 < len(morphemes) and morphemes[k + 1].surface == "の")
               for k, u in enumerate(morphemes[:i])):
        return False
    for k in range(i - 1, max(-1, i - 6), -1):
        u = morphemes[k]
        if u.surface in ("。", "！", "？") or (u.pos == "verb" and k < i - 1):
            break
        if u.surface == "を" and k >= 1 and morphemes[k - 1].surface not in _PETS and morphemes[k - 1].lemma not in _PETS:
            return False
    return True


def _by_neighbours(morphemes, i: int, hit):
    """The card a noun written in kana is beside the words around it,
    where UniDic's pick is another word read the same (plan 272):

    - きみ is 君, "you", unless 気味 is the 気味が悪い of "creepy": きみを
      想う, a song's "I think of you", took 気味, "feeling";
    - よる before a time or a particle is 夜, "night", never the verb 因る:
      よる七時まで;
    - しろ after the polite お is 城, the castle a child builds in the sand
      (おしろ), never 白, "white";
    - てめえ, "you" said to pick a fight, is no 手前, "this side", which
      UniDic files it under: the pool's row for it answers;
    - a loanword in katakana is no native word in hiragana where the pool
      holds the loanword: ホット is "hot", not ほっと, "relieved"."""
    m = morphemes[i]
    nxt = morphemes[i + 1] if i + 1 < len(morphemes) else None
    after = morphemes[i + 2] if i + 2 < len(morphemes) else None
    prev = morphemes[i - 1] if i > 0 else None
    if m.lemma in ("感ずる",) and m.surface.startswith("感じ"):
        return _card("感じる", "かんじる") or hit         # 早く感じられる (plan 272)
    if m.lemma == "知らす" and m.surface.startswith("知らさ"):
        return _card("知らせる", "しらせる") or hit       # 知らされた: 知らせる's passive, "was told"
    if m.pos == "noun" and prev is not None and prev.surface == "お" and prev.pos == "prefix" and nxt is not None \
            and (nxt.lemma in ("です", "だ") or (nxt.surface == "の" and nxt.pos == "particle")) \
            and m.surface in _HONORED_STEMS and not (
                # (いいお考えですね, 私のお考え: a modifier makes it the noun,
                # "an idea", plan 272)
                i >= 2 and (morphemes[i - 2].pos in ("adjective", "adnominal") or morphemes[i - 2].surface == "な"
                            or (morphemes[i - 2].surface == "の" and morphemes[i - 2].pos == "particle"))):
        # (お探しのページ: the one you are looking for, said up, plan 272)
        verb = verb_of_stem(m)
        if verb is not None:
            return verb                                # どちらの病院をお考えですか: 考える said up
    if m.surface == "なき" and nxt is not None and nxt.lemma in ("出す", "始める", "続ける", "止む", "やむ", "叫ぶ"):
        return _card("泣く", "なく") or hit             # なき出す: 泣く, no ない
    if m.surface in ("其の", "此の", "彼の", "何の") and m.pos == "adnominal" or (
            m.surface and all(is_kanji(c) for c in m.surface) and m.lemma and _katakana_written(m.lemma)
            and not _has_kanji(m.lemma)):
        # 其の夜 is その, written as old books write it; 洋燈 is ランプ, a
        # loanword spelled in kanji -- the deck's card in kana (plan 272)
        said = morphology.kata_to_hira(m.reading) if m.pos == "adnominal" else m.lemma
        kana_only = [(lv, e) for lv, e in _kana_cards(said) if not e.get("kanji")]
        if kana_only:
            level, entry = min(kana_only, key=lambda c: _level_rank(c[0]))
            return level, entry, vocab_to_id(entry, level)
    if m.lemma == "私" and morphology.kata_to_hira(m.reading) == "わたくし":
        return _card("私", "わたし") or hit           # このわたくし: 私, said formally (plan 272)
    if m.surface in ("もん", "もの") and prev is not None and prev.surface in ("若い", "わかい", "年寄り", "としより", "よそ",
                                                                         "馬鹿", "ばか", "怠け", "田舎"):
        return _card("者", "もの") or hit               # 近頃の若いもん: 者, the young -- no 物 "thing"
    if m.lemma == "変わる" and m.surface[:1] in ("替", "代", "換"):
        return _card("代わる", "かわる") or hit         # 担当が替わりました: another takes its place
    if m.lemma == "変える" and m.surface[:1] in ("替", "代", "換"):
        return _card("代える", "かえる") or hit         # 電池を替える
    if m.lemma == "返る" and m.surface == "かえっ" and nxt is not None and nxt.surface == "て" and i >= 2 \
            and morphemes[i - 1].surface in ("が", "は", "も") and (
                morphemes[i - 2].lemma in morphology._COMES_BACK
                or not morphology._alive_or_moving(morphemes[i - 2])):
        # こたえが かえって きた, 貸した本がかえってきた: a thing comes back
        # -- a person, an animal or a vehicle comes home (plan 272)
        return _card("返る", "かえる") or hit
    if m.lemma == "買う" and not _has_kanji(m.surface) and _a_pet_kept(morphemes, i):
        return _card("飼う", "かう") or hit             # きんぎょ…おうちで かっても いい？: keep, no buy
    if m.lemma == "救う" and not _has_kanji(m.surface) and any(
            u.lemma in ("金魚", "掬い", "すくい", "網", "お玉", "スプーン") for u in morphemes):
        return _card("掬う", "すくう") or hit           # きんぎょ すくえた: scooped, no rescue
    if m.lemma == "干す" and m.surface == "ほし" and nxt is not None and nxt.surface.startswith("が") \
            and nxt.lemma in ("がる", "ガル"):
        return _card("欲しい", "ほしい") or hit         # ほしがる: 欲しがる, no 干す
    if m.pos == "noun" and nxt is not None and nxt.surface == "よう" and after is not None and after.surface in ("が", "も") \
            and i + 3 < len(morphemes) and morphemes[i + 3].lemma in ("無い", "ない"):
        verb = verb_of_stem(m)
        if verb is not None:
            return verb                                # 知らせようがない: 知らせる, no 知らせ "news"
    if _a_filler_ano(morphemes, i):
        return next(iter((lv, e, vocab_to_id(e, lv)) for lv, e in _kana_cards("あのう")), None) or hit
        # (あの、ゴミの日は: "um", no "that")
    if m.lemma == "早い" and not _has_kanji(m.surface):
        after = morphemes[i + 1] if i + 1 < len(morphemes) else None
        purpose = i + 2 < len(morphemes) and (morphemes[i + 2].surface == "に" or morphemes[i + 2].lemma in (
            "行く", "来る", "いく", "くる"))
        if after is not None and m.surface.endswith("く") and after.lemma in _MOVING and not purpose:
            return _card("速い", "はやい") or hit       # はやく走る: the speed one moves at -- never
            # はやく泳ぎに行こう, early: the swim is where one goes
        if not m.surface.endswith("く") and any(u.surface in _VEHICLES for u in morphemes[max(0, i - 6):i]):
            return _card("速い", "はやい") or hit       # 電車より車のほうがはやい: speed -- never はやく来た, early
    if m.surface == "一日" and i >= 2 and morphemes[i - 1].surface == "の" \
            and len(morphemes[i - 2].surface) > 1 and morphemes[i - 2].surface.endswith("月"):
        return _card("一日", "ついたち") or hit         # 来月の一日: the first of the month
    if m.lemma in ("有る", "ある") and i >= 3 and morphemes[i - 1].surface == "て" \
            and morphemes[i - 2].surface == "し" and morphemes[i - 3].surface == "と" and nxt is not None \
            and nxt.surface in ("まじき", "べき", "べし", "まじ"):
        return next(iter((lv, e, vocab_to_id(e, lv)) for lv, e in _kana_cards("ある")), None) or hit
        # (公人としてあるまじき: として's "as", then ある, no 〜てある)
    made = _made_to_verb(morphemes, i)
    if made is not None:
        return made                                    # 30分も待たされた: 待つ, made to wait
    errand = resolve_errand(morphemes, i)
    if errand is not None:
        return errand                                  # 本を返しに行く: 返す, no "return gift"
    if m.surface == "み" and m.lemma == "見る" and i >= 2:
        from study.grammar_detect import _look_look
        if _look_look(morphemes, i - 2):
            return _card("見る", "みる") or hit         # ママー、みてみて！: 見る said twice
    # (plan 272: what an eighth review found read as the wrong word)
    if m.surface in ("ぐらい", "くらい") and m.pos == "particle":
        return next(iter((lv, e, vocab_to_id(e, lv)) for lv, e in _kana_cards("ぐらい")), None) or hit
    if m.surface == "いらっしゃい" and (prev is None or prev.pos == "symbol") and (
            nxt is None or nxt.pos == "symbol"):
        return next(iter((lv, e, vocab_to_id(e, lv)) for lv, e in _kana_cards("いらっしゃい")), None) or hit
    if m.surface == "ねん" and prev is not None and (numeral_value(prev.surface) is not None
                                                    or prev.surface in _KANA_NUMBERS):
        return _card("年", "ねん") or hit                 # ひゃくねん: years, no 念
    if m.surface == "おくれ" and m.pos == "verb" and prev is not None and prev.conjunctive \
            and prev.surface in ("て", "で"):
        return None                                    # 運んでおくれ: the old 〜てくれ (glossed), no 遅れる
    if m.surface == "きみ" and hit is not None and (hit[1].get("kanji") or "") == "気味" and not (
            nxt is not None and nxt.surface == "が" and after is not None and after.lemma in ("悪い", "わるい")):
        return _card("君", "きみ") or hit
    if m.surface == "よる" and m.pos == "verb" and nxt is not None and (
            numeral_value(nxt.surface) is not None or nxt.surface in ("に", "は", "の", "も", "まで", "から")
            or nxt.pos == "symbol"):
        return _card("夜", "よる") or hit
    if m.surface == "しろ" and prev is not None and prev.pos == "prefix" and prev.surface == "お":
        return _card("城", "しろ") or hit
    if m.surface in ("てめえ", "てめー", "てめぇ"):
        return None
    if m.surface == "本" and m.pos == "prefix":
        # 本研究, "this study": the prefix "this, the present", never 本,
        # "book" (analysis glosses it).
        return None
    if m.surface == "暇" and m.reading == "いとま":
        # お暇する, "to take one's leave" (reading_context): no ひま, "free
        # time"; the pool's お暇 read おいとま is the word.
        return None
    if (hit is not None and m.goshu == "外" and _katakana_written(m.surface)
            and _hiragana(hit[1].get("kana") or "") and not hit[1].get("kanji")):
        row = jmdict_db.get_by_key("", m.surface)
        if row is not None and not (_row_gloss_words(row) & _gloss_words(hit[1])):
            return None
    return hit


# The words that do not inflect, whose surface is their spelling.
_UNINFLECTED = frozenset({"noun", "pronoun", "adverb", "other", "adnominal", "interjection"})

# Kana nouns two deck cards are spelled as, and the words beside them
# that say which (plan 272): あしたはあめです is rain, あめをなめる candy.
# A word on both lists, or none, leaves UniDic's pick.
# A day or a time of day, which says あめ is the weather only where
# あめ is what the day will be (あしたはあめです), never what one takes
# along on it (plan 272).
_DAYS = frozenset({"明日", "あした", "あす", "今日", "きょう", "あさって", "明後日", "午後", "ごご", "午前", "ごぜん",
                   "夜", "よる", "朝", "あさ", "今夜", "こんや", "週末", "しゅうまつ", "昨日", "きのう"})
_NOUN_PARTNERS = {
    # (never a day or a time of day: any sentence has one, あしたあめを
    # もっていく, plan 272)
    "あめ": (("雨", {"降る", "ふる", "止む", "やむ", "天気", "てんき", "晴れ", "はれ", "晴れる", "はれる", "曇り",
                    "くもり", "雪", "ゆき", "傘", "かさ", "大雨", "梅雨", "濡れる", "ぬれる"}),
             ("飴", {"舐める", "なめる", "甘い", "あまい", "一つ", "ひとつ", "袋", "ふくろ", "お菓子", "おかし", "もらう",
                    "あげる", "くれる", "買う", "かう", "個", "粒", "つ", "おやつ", "持つ", "もつ"})),
    "せき": (("席", {"空く", "あく", "空いる", "座る", "すわる", "譲る", "ゆずる", "予約", "よやく", "立つ", "たつ",
                    "窓側", "通路", "指定", "自由", "取る", "とる", "前", "まえ", "後ろ", "うしろ", "隣", "となり",
                    "戻る", "もどる", "外す", "はずす"}),
             ("咳", {"出る", "でる", "止まる", "とまる", "風邪", "かぜ", "熱", "ねつ", "喉", "のど", "くしゃみ",
                    "ひどい", "薬", "くすり", "咳き込む"})),
    "かんじ": (("漢字", {"覚える", "おぼえる", "書く", "かく", "読む", "よむ", "習う", "ならう", "勉強", "べんきょう",
                        "練習", "れんしゅう", "ひらがな", "平仮名", "かたかな", "片仮名", "カタカナ", "読み方", "書き方",
                        "つ", "字", "じ", "辞書", "じしょ", "テスト", "宿題", "しゅくだい"}),
               ("感じ", {"する", "いい", "よい", "悪い", "わるい", "変", "へん", "どんな", "そんな", "こんな", "あんな",
                        "嫌", "いや"})),
    "かぜ": (("風", {"吹く", "ふく", "強い", "つよい", "冷たい", "つめたい", "涼しい", "すずしい", "気持ち", "きもち",
                    "雨", "あめ", "台風", "窓", "まど", "北", "きた", "南", "みなみ", "止む", "やむ",
                    # (かぜに のって, "riding the wind", plan 272)
                    "乗る", "のる", "飛ぶ", "とぶ", "揺れる", "ゆれる"}),
             ("風邪", {"引く", "ひく", "治る", "なおる", "休む", "やすむ", "薬", "くすり", "熱", "ねつ", "病院",
                      "びょういん", "咳", "せき", "医者", "いしゃ", "うつる", "流行る", "はやる"})),
    "はし": (("橋", {"渡る", "わたる", "川", "かわ", "架ける", "かける", "向こう", "むこう", "上", "うえ", "下", "した"}),
             ("", {"使う", "つかう", "持つ", "もつ", "ご飯", "ごはん", "食べる", "たべる", "割る", "わる", "一膳",
                   "スプーン", "フォーク", "ナイフ"})),     # the N5 はし, "chopsticks"
    "かみ": (("髪", {"切る", "きる", "長い", "ながい", "短い", "みじかい", "洗う", "あらう", "染める", "そめる", "黒い",
                    "くろい", "茶色", "とかす", "伸びる", "のびる", "結ぶ", "むすぶ", "毛", "け"}),
             ("紙", {"書く", "かく", "折る", "おる", "枚", "まい", "白い", "しろい", "ペン", "えんぴつ", "鉛筆", "包む",
                    "つつむ", "はさみ", "切手", "封筒", "ふうとう", "破る", "やぶる"})),
    "はな": (("花", {"咲く", "さく", "きれい", "綺麗", "植える", "うえる", "水", "みず", "庭", "にわ", "花見", "はなみ",
                    "赤い", "あかい", "白い", "しろい", "黄色い", "きいろい", "枯れる", "かれる", "飾る", "かざる",
                    "買う", "かう", "屋", "や", "束", "たば"}),
             ("鼻", {"目", "め", "口", "くち", "耳", "みみ", "顔", "かお", "かむ", "高い", "たかい", "水", "血", "ち",
                    "鼻水", "においを"})),
    # (a たび after a verb or a noun's の is 度, "each time": asked only of
    # one that follows neither, plan 272 -- ひとりでたびに出る)
    "たび": (("旅", {"出る", "でる", "続ける", "つづける", "一人", "ひとり", "長い", "ながい", "楽しい", "たのしい",
                    "終わる", "おわる", "始める", "はじめる", "気まま", "きまま", "人生", "途中", "とちゅう"}),
             ("足袋", {"はく", "履く", "着物", "きもの", "和服", "わふく", "白い", "しろい", "草履", "ぞうり"})),
}


def _kana_noun(morphemes, i: int, hit):
    """The card a noun written in hiragana is (plan 272):

    - the card spelled as the page spells it, where UniDic's lemma names
      a card read otherwise -- みんな is the N5 みんな, never 皆 read みな;
      どっち the N5 どっち, never どちら;
    - the same word filed lower, where the lemma's card is the higher
      spelling of it: ごちそう is the N4 ごちそう, never the N2 御馳走;
      はじめから the N5 初め, never the N1 始め;
    - of two words spelled alike, the one the words beside it name
      (_NOUN_PARTNERS): このせきはあいている is 席, "seat", never 咳,
      "cough"; かんじをおぼえる 漢字, never 感じ."""
    m = morphemes[i]
    if m.pos not in _UNINFLECTED or not m.surface or not _hiragana(m.surface):
        return hit
    if i > 0 and numeral_value(morphemes[i - 1].surface) is not None:
        return hit                     # 二かい: a counter, the counters' to read
    nxt = morphemes[i + 1] if i + 1 < len(morphemes) else None
    if hit is not None and m.pos in ("noun", "pronoun") and _verb_card(hit[1]) and nxt is not None \
            and nxt.pos == "particle" and nxt.surface in ("は", "が", "を", "の", "に", "へ", "と", "も") \
            and morphology.kata_to_hira(m.reading) in _reading_variants(hit[1].get("kana") or ""):
        hit = None                     # まつは: a noun, no 待つ
    spelled = m.surface
    if m.surface == "あめ" and nxt is not None and (nxt.lemma in ("だ", "です") or nxt.surface in ("が", "も", "で")) \
            and any(u.surface in _DAYS for u in morphemes[max(0, i - 4):i]):
        return _card("雨", "あめ") or hit    # あしたはあめです: the weather said of a day (plan 272)
    each_time = m.surface == "たび" and i > 0 and (morphemes[i - 1].surface in ("の", "この", "その")
                                                   or morphemes[i - 1].pos in ("verb", "auxiliary"))
    if m.surface in _NOUN_PARTNERS and not each_time:
        chosen = _by_noun_partner(morphemes, i, _NOUN_PARTNERS[m.surface])
        if chosen is not None:
            return chosen
    if hit is None:
        return hit
    readings = {morphology.kata_to_hira(r) for r in _reading_variants(hit[1].get("kana") or "")}
    if spelled not in readings:
        own = [(lv, e) for lv, e in _kana_cards(spelled) if not _verb_card(e)]
        if own:
            level, entry = min(own, key=lambda c: _level_rank(c[0]))
            return level, entry, vocab_to_id(entry, level)
        return hit
    # (Only a noun: いや, "no", is no 嫌, "unpleasant", whose gloss says
    # "no!" too.)
    return _plainer_same_word(spelled, hit) if m.pos in ("noun", "pronoun") else hit


@lru_cache(maxsize=None)
def _verb_spelled(written: str) -> bool:
    """Whether `written` is a verb in its dictionary form (待つ), never a
    noun spelled as a verb's stem is (始め, 休み)."""
    morphemes = morphology.tokenize(written) or []
    return (len(morphemes) == 1 and morphemes[0].pos == "verb"
            and morphemes[0].cform.startswith("終止形") and morphemes[0].surface == morphemes[0].lemma)


def _verb_card(entry: dict) -> bool:
    """Whether a deck card is a verb's, spelled as one (待つ): never a
    する noun's, whose gloss reads like a verb's (びっくり, "to be
    surprised; surprise")."""
    written = re.split(r"[/／;、,・]", entry.get("kanji") or "")[0].strip()
    # (...or one the tokenizer reads as a causative it once was, 知ら +
    # せる: a u-row ending and a "to" gloss, plan 272)
    return bool(written) and (_verb_spelled(written) or (
        written[-1] in "うくぐすつぬぶむる" and (entry.get("meaning") or "").startswith("to ")))


def _by_noun_partner(morphemes, i: int, cards):
    """The card of `cards` ((kanji, partner words), ...) whose partners
    alone stand in morphemes[i]'s sentence, or None."""
    # (the noun's own clause, plan 272: かぜがつよくて、かぜをひいた says
    # the wind, then a cold)
    a, b = i, i
    while a > 0 and not (morphemes[a - 1].pos == "symbol" and morphemes[a - 1].surface in "、，。！？!?"):
        a -= 1
    while b + 1 < len(morphemes) and not (morphemes[b + 1].pos == "symbol" and morphemes[b + 1].surface in "、，。！？!?"):
        b += 1
    if a == 0 and b == len(morphemes) - 1 or not any(
            t.pos in ("verb", "adjective") for t in morphemes[a:b + 1] if t is not morphemes[i]):
        a, b = 0, len(morphemes) - 1       # (a clause with no verb of its own: the sentence)
    words = set()
    for k, t in enumerate(morphemes):
        if a <= k <= b and k != i and t.pos != "symbol":
            words.update((t.surface, t.lemma, morphology.kata_to_hira(t.surface)))
            if t.pos == "verb" and _hiragana(t.surface):
                # A verb in kana is any deck verb spelled so: UniDic's さい
                # of はながさいた is 裂く, "to tear", and the page's 咲く.
                nxt = morphemes[k + 1] if k + 1 < len(morphemes) else None
                words.update((e.get("kanji") or "") for _lv, e, _id in _deck_verbs_spelled(t, nxt))
    named = [kanji for kanji, partners in cards if partners & words]
    if len(named) != 1:
        return None
    return _card(named[0], morphemes[i].surface)


# What one does at home, or goes home to do (plan 272): うちにかえる.
_AT_HOME = frozenset({"帰る", "行く", "来る", "居る", "有る", "戻る", "泊まる", "遊ぶ", "着く", "寄る", "呼ぶ",
                      "いる", "ある", "くる", "いく", "かえる", "もどる", "返る"})  # (かえり, read 返る)


def resolve_home(morphemes, i: int) -> dict | None:
    """The pool's 家 read うち, "home, one's house", for a うち that is one,
    or None (plan 272). The deck's うち is "inside, within; while" -- 若い
    うちに, そのうち, クラスのうちで -- and うちにかえる, うちには猫が二匹
    いて and うちは大阪の近くにあります took it. A うち is a home where a
    verb of going or being follows its に or へ (友だちのうちにいく), or
    where it opens its clause before a particle; never after a word that
    makes it a span (a predicate, その)."""
    m = morphemes[i]
    if m.surface != "うち" or m.pos not in ("noun", "pronoun"):
        return None
    prev = morphemes[i - 1] if i > 0 else None
    nxt = morphemes[i + 1] if i + 1 < len(morphemes) else None
    # (an adjective's く-form says how one goes, never which span: 早く
    # うちにかえりたい is home, 若いうちに a while, plan 272)
    adverb = prev is not None and prev.pos == "adjective" and prev.surface.endswith("く")
    if nxt is None or (prev is not None and prev.pos in ("verb", "adjective", "auxiliary", "adnominal")
                       and not adverb):
        return None
    going = nxt.surface in ("に", "へ") and any(
        t.pos == "verb" and (t.lemma in _AT_HOME or t.surface in _AT_HOME)
        for t in morphemes[i + 2:i + 5] if t.pos != "symbol")
    if adverb and not going:
        return None
    opens = (prev is None or prev.pos == "symbol") and nxt.pos == "particle" and nxt.surface in (
        "は", "に", "で", "の", "も", "が", "から", "まで", "へ")
    return jmdict_db.get_by_key("家", "うち") if going or opens else None


_TE_AUXILIARIES = morphology.TE_AUXILIARIES


_WEEKDAYS = {"月": ("月曜日", "げつようび"), "火": ("火曜日", "かようび"), "水": ("水曜日", "すいようび"),
             "木": ("木曜日", "もくようび"), "金": ("金曜日", "きんようび"), "土": ("土曜日", "どようび"),
             "日": ("日曜日", "にちようび")}


def _weekday_in_brackets(morphemes, i: int):
    """The deck's card for the weekday a date writes in brackets, 10月15日
    （木）, or None (plan 272): 木 there is Thursday, never "tree"."""
    m = morphemes[i]
    if m.surface not in _WEEKDAYS or i == 0 or i + 1 >= len(morphemes):
        return None
    # (and beside the holiday it is, （火・祝）, plan 272)
    if morphemes[i - 1].surface not in ("（", "(", "・") or morphemes[i + 1].surface not in ("）", ")", "・"):
        return None
    if "（" not in "".join(u.surface for u in morphemes[max(0, i - 3):i]) \
            and "(" not in "".join(u.surface for u in morphemes[max(0, i - 3):i]):
        return None
    return resolve_lemma(*_WEEKDAYS[m.surface])


# What a キロ of distance is said beside (plan 272): 8キロの渋滞.
_DISTANCE = ("渋滞", "距離", "走", "歩", "道", "線", "区間", "時速", "マラソン", "離れ", "地点", "手前", "先", "車", "半径",
             "コース", "ジョギング", "ランニング", "移動", "北", "南", "東", "西", "泳", "進",
             # (震源の深さはおよそ10キロ: a depth, a height, plan 272)
             "深さ", "高さ", "震源", "上空", "沖")


def _kilo(morphemes, i: int):
    """The deck's キロ the sentence measures with, or None: キロメートル
    where it speaks of a way, a run or a jam (8キロの渋滞), the deck's
    first, キログラム, otherwise."""
    if morphemes[i].surface not in ("キロ", "きろ"):
        return None
    # (Each キロ by its own clause, plan 272: 5キロ走ったら、体重が1キロ減った
    # runs, then weighs; 米を10キロ買って、車で帰った weighs.)
    a, b = i, i
    while a > 0 and not (morphemes[a - 1].pos == "symbol" and morphemes[a - 1].surface in "、，。！？!?"):
        a -= 1
    while b + 1 < len(morphemes) and not (morphemes[b + 1].pos == "symbol" and morphemes[b + 1].surface in "、，。！？!?"):
        b += 1
    def says(part):
        text = "".join(u.surface for u in part)
        if any(w in text for w in _WEIGHT) or any(u.lemma in _WEIGHED for u in part):
            return "kg"
        # (from a place or to one: ここから郵便局まで -- never 23キロまで,
        # "up to 23 kilos", the limit of the measure itself)
        if any(w in text for w in _DISTANCE) or any(
                u.surface in ("から", "まで") and u.pos == "particle" and k > 0
                and part[k - 1].surface not in ("キロ", "きろ") and part[k - 1].pos in ("noun", "pronoun")
                and not _numeral(part[k - 1].surface) for k, u in enumerate(part)):
            return "km"
        return None
    # (...and a clause that says neither by the rest of its sentence)
    said = says(morphemes[a:b + 1]) or says(morphemes)
    if said != "km":
        return None
    return next(((lv, e, vocab_to_id(e, lv)) for lv, e in _kana_cards("キロ") if "キロメートル" in (e.get("kana") or "")),
                None)


# What a キロ that weighs is said beside (_kilo, plan 272).
_WEIGHT = ("体重", "重さ", "重い", "重量", "米", "肉", "荷物", "グラム", "砂糖", "小麦", "野菜", "魚", "スーツケース",
           "バッグ", "かばん", "鞄", "赤ちゃん")
_WEIGHED = frozenset({"増える", "減る", "太る", "痩せる", "やせる", "買う", "量る", "計る", "落とす", "売る"})


# What says a kana verb's card where two deck verbs share its reading
# (plan 272): はれる is 晴れる beside the weather.
_WEATHER = ("あした", "明日", "天気", "空", "雨", "晴", "てるてる", "週末", "日曜", "遠足", "運動会")


def _by_weather(morphemes, i: int):
    m = morphemes[i]
    if m.pos != "verb" or _has_kanji(m.surface):
        return None
    text = "".join(u.surface for u in morphemes)
    if m.lemma_reading == "はれる" and any(w in text for w in _WEATHER):
        return resolve_lemma("晴れる", "はれる")
    return None


def _resolve_morpheme(morphemes, i: int):
    m = morphemes[i]
    weekday = _weekday_in_brackets(morphemes, i)
    if weekday is not None:
        return weekday
    kilo = _kilo(morphemes, i)
    if kilo is not None:
        return kilo
    if m.lemma in ("驕る", "傲る", "奢る") and not _has_kanji(m.surface) and not (
            i + 1 < len(morphemes) and morphemes[i + 1].pos == "noun"):
        return None                        # おごれよ: 奢る, "to treat", the pool's (plan 272)
    if m.surface == "いっぺん" and not (i + 1 < len(morphemes) and morphemes[i + 1].lemma in ("為る", "する")):
        return None                        # いっぺん食べてみ: 一遍, "once", the pool's
    by_weather = _by_weather(morphemes, i)
    if by_weather is not None:
        return by_weather
    if m.lemma == "亀" and m.surface == "かめ":
        return None                        # (the pool's 亀; the deck's かめ is 瓶, a jar)
    if m.surface == "ワン" and i + 1 < len(morphemes) and _katakana_written(morphemes[i + 1].surface) \
            and morphemes[i + 1].start == m.end:
        return None                        # ワンサイズ上: "one", no "woof" (plan 272)
    previous = morphemes[i - 1] if i > 0 else None
    after_conjunctive = previous is not None and previous.pos == "particle" and previous.conjunctive
    # (Only the て/で: 足掻くがいい's いい, after the conjunctive が, is
    # the word "good", plan 272.)
    after_te = after_conjunctive and previous.surface in ("て", "で")
    if m.auxiliary_use and after_te and m.lemma in _TE_AUXILIARIES:
        # A verb hanging off a conjunctive て/で in its auxiliary use is
        # the grammar point's, not a word's (plan 106): ている, てくる,
        # てみる, ておく, てしまう are all catalogue points, and the row
        # opens the point. The lemma path used to answer here anyway and
        # badged 食べてしまった with the N1 仕舞う card. Only those verbs
        # (plan 272): UniDic files 出す, 切れる and 渡る as possible
        # auxiliaries too, for 書き出す and 使い切れる, and まとめて出しとく,
        # 立てて切れた, たたいて渡れ are the verbs themselves. (やる has no
        # point: 決着をつけてやる is the deck's やる; nor みせる, うまく
        # やってみせる's 見せる, "to show".)
        return None
    by_lemma = _by_page_reading(m) or resolve_lemma(m.lemma, m.lemma_reading, m.surface)
    written = morphology.written_form(m)
    if by_lemma is None and written and m.written_reading and m.written_reading != m.lemma_reading:
        # The card as the page spells and reads it, where UniDic files the
        # word under another lexeme (plan 272): 突っ込み is 突き込む's, read
        # つきこむ, and the card is 突っ込む, つっこむ.
        by_lemma = resolve_lemma(m.lemma, m.written_reading, m.surface) \
            or resolve_lemma(written, m.written_reading, m.surface)
    if m.surface.startswith("ウケ") and m.lemma in ("受ける", "請ける"):
        return None                        # ウケる, the slang (plan 272)
    hit = by_lemma or resolve_kana(
        m.lemma_reading, m.pos, m.auxiliary_use, after_conjunctive, m.surface, m.goshu,
    )
    if hit is None and m.pos == "noun" and i + 1 < len(morphemes) and morphemes[i + 1].surface == "つ" \
            and i >= 2 and morphemes[i - 1].surface == "つ":
        # 浮きつ沈みつ: a verb's stem, which UniDic made a noun of, before
        # 〜つ〜つ's second つ (plan 272).
        return verb_of_stem(m)
    if hit is not None and _kana_word_instead(m, hit[1]):
        return None
    if hit is not None and m.surface and all("\u30a0" <= c <= "\u30ff" for c in m.surface) \
            and _has_kanji(hit[1].get("kanji") or "") and hit[1].get("kanji") != m.lemma:
        # A word written in katakana reaches a card in kanji only as its own
        # lemma (オレ 俺, クスリ 薬): ワン, "woof", is no 湾, "bay", nor the
        # score's タイ 対 (plan 272).
        return None
    if hit is not None and m.surface == "サビ" and not _has_kanji(m.surface) and any(
            u.surface in ("曲", "歌", "聴", "歌詞", "イントロ", "メロディー", "ボーカル", "部分") for u in morphemes):
        return None                        # サビ, a song's hook, the pool's (plan 272)
    if hit is not None and m.proper and m.name_kind in ("place", "family", "given", "person") \
            and _has_kanji(m.surface) and not (hit[1].get("kanji") or ""):
        # 大井, a place on the expressway, is no おおい, "hey!" (plan 272).
        return None
    if hit is not None and _foreign_name(m) and not _katakana_written(hit[1].get("kanji") or hit[1].get("kana") or ""):
        # A person's name written in katakana is no word read the same
        # way (plan 266): アンナ is Anna, not あんな "such"; トム is Tom,
        # not 富む "to be rich"; the dog クロ no 黒 "black".
        return None
    if hit is not None and (_another_word(m, hit[1]) is not None or _read_otherwise(m, hit[1])):
        # The lemma's card in the page's spelling is read otherwise; the
        # same lemma may have a card read as the token is: 良い read よい
        # is the N5 いい／よい, not the N1 良い read いい (plan 151).
        again = resolve_lemma(m.lemma, m.lemma_reading)
        if again is None or again[2] == hit[2] or _another_word(m, again[1]) is not None \
                or _read_otherwise(m, again[1]):
            return _read_as_written(m, by_lemma, hit, after_conjunctive)
        return again
    return hit


_HALF_VOICED = str.maketrans("ぱぴぷぺぽ", "はひふへほ")


def _by_page_reading(m):
    """The card read as the page says a word UniDic files under the lemma
    of two (plan 272): 明日 is the lemma of あした and あす alike, its lemma
    read あす, so 明日までに, read あした, took the N4 "tomorrow (formal)";
    一日 read いちにち took ついたち, "the 1st"; 数日's 日 the 日 of "sun".
    Only a word the page leaves uninflected, and only a card read exactly
    so -- or so but for the sound change of a counter (何分 なんぷん is the
    分 read ふん, "minute", never ぶん, "portion")."""
    if m.surface != m.lemma or not m.reading or m.reading == m.lemma_reading:
        return None
    page = morphology.kata_to_hira(m.reading)
    for reading in dict.fromkeys((page, page[:1].translate(_HALF_VOICED) + page[1:])):
        hit = resolve_lemma(m.lemma, reading, m.surface)
        if hit is not None and _reading_matches(hit[1].get("kana") or "", reading):
            return hit
    return None


def _foreign_name(m) -> bool:
    return m.name_kind in ("family", "given", "person", "other") and _katakana_written(m.surface)


def _read_as_written(m, by_lemma, refused, after_conjunctive: bool):
    """The card a token written in kana is read as, where its lemma's
    card was refused as read otherwise (plan 266): UniDic files しお under
    潮, and the card for 潮 is the N1 うしお, "tide" -- refused, and the
    reading path that names the N5 塩 read しお, "salt", was never asked;
    じゃあ、しおをお願いします glossed the pool's "tide; sea water". Only
    where the lemma path answered (the reading path has had its say
    otherwise) and the page wrote no kanji (a kanji spelling read
    otherwise is another word, _read_otherwise's pool row).

    And only for a plainer word than the one refused, filed at a lower
    level, as _kana_verb keeps a rival only where it is the rarer word:
    a kana spelling the tokenizer misread is a homophone at any level,
    and the cut of けつあつ (血圧) into けつ + あつ is no 傑, "the best", at
    N1 where 穴 read あな at N3 was refused. Never a verb's card for a word
    that is not one: ゆう of ゆうがた is no 言う, "to say"."""
    if by_lemma is None or refused is not by_lemma or any(is_kanji(c) for c in m.surface):
        return None
    hit = resolve_kana(m.lemma_reading, m.pos, m.auxiliary_use, after_conjunctive, m.surface, m.goshu)
    if hit is None or hit[2] == refused[2] or _kana_word_instead(m, hit[1]) or _read_otherwise(m, hit[1]):
        return None
    if _level_rank(hit[0]) >= _level_rank(refused[0]) or (m.pos != "verb" and _a_verbs_card(hit[1])):
        return None
    return hit


def _kana_word_instead(m, entry: dict) -> bool:
    """Whether a token the page writes in kana is the word JMdict says is
    written in kana, not the card spelled in kanji it is read like (plan
    193). まま is UniDic's 侭, "as it is", and JMdict's 儘 is common and
    usually kana -- the pool holds it as a kana row -- while the card read
    まま is 間々, "occasionally": 着たまま, そのまま and 思ったまま were
    all glossed "occasionally". Three things must hold, so that a kana
    word whose lemma UniDic merely guesses (かさ filed under 嵩, さかな
    under 肴) keeps the card it is: the page writes the word in kana, its
    lemma is spelled in kanji the card does not share, and the pool holds
    a kana-only row read the same way that JMdict marks common (its ⭐).
    The pool row answers instead."""
    if m.goshu == "外" or any(is_kanji(c) for c in m.surface):
        return False
    card = set(entry.get("kanji") or "")
    lemma = {c for c in m.lemma if is_kanji(c)}
    if not card or not lemma or lemma & card:
        return False
    return _common_kana_row(morphology.kata_to_hira(m.lemma_reading or ""))


@lru_cache(maxsize=4096)
def _common_kana_row(reading: str) -> bool:
    if not reading or not jmdict_db.get_by_key("", reading):
        return False
    senses = jmdict_db.get_senses("", reading) or []
    return any("⭐" in (sense.get("term_tags") or []) for sense in senses)


# A godan verb's stem before ます (連用形) and before ない (未然形), by
# the last kana of its dictionary form.
_GODAN_STEM = {
    "連用形": dict(zip("うくぐすつぬぶむる", "いきぎしちにびみり")),
    "未然形": dict(zip("うくぐすつぬぶむる", "わかがさたなばまら")),
}
# The e-row a godan verb's potential is made on: つける of 吐く (plan 272).
_GODAN_E_ROW = dict(zip("うくぐすつぬぶむる", "えけげせてねべめれ"))


# The stem a godan verb takes before て and た, by the row it ends on
# (音便): 住んで (む ぬ ぶ), 待って (つ る う, and 行く), 書いて (く ぐ).
_ONBIN = {
    "撥音便": ("ん", ("む", "ぬ", "ぶ")),
    "促音便": ("っ", ("つ", "る", "う")),
    "イ音便": ("い", ("く", "ぐ")),
}
_GO = ("いく", "ゆく")


def _form_of(cform: str) -> str:
    """The form a kana spelling can be shared in, or "": the dictionary
    form, the plain stems, and the stems a godan verb takes before て and
    た -- which every verb of the row shares: すんで is 住む's and 済む's
    alike (plan 272)."""
    form, _, kind = cform.partition("-")
    if form in ("終止形", "連体形") or (form in _GODAN_STEM and kind == "一般"):
        return form
    if form == "連用形" and kind in _ONBIN:
        return kind
    return ""


# A godan verb's last kana and its お-row, which its volitional ends on.
_GODAN_O_ROW = {"う": "お", "く": "こ", "ぐ": "ご", "す": "そ", "つ": "と", "ぬ": "の", "ぶ": "ぼ", "む": "も", "る": "ろ"}


def _conjugated(kana: str, ctype: str, cform: str) -> str:
    """The verb read `kana` in its dictionary form, of conjugation class
    `ctype`, as it is spelled in `cform` -- for the forms a kana stem can
    be shared in (the dictionary form, the stem before ます and before
    ない) -- or "" for any other."""
    if cform == "仮定形-一般":
        return kana[:-1] + _GODAN_E_ROW[kana[-1]] if ctype.startswith("五段") and kana[-1:] in _GODAN_E_ROW else ""
    if cform.startswith("意志推量形"):
        # (つけよう, かこう: what one means to do, plan 272)
        if ctype.startswith("五段"):
            return kana[:-1] + _GODAN_O_ROW[kana[-1]] + "う" if kana[-1:] in _GODAN_O_ROW else ""
        if "一段" in ctype:
            return kana[:-1] + "よう" if kana.endswith("る") else ""
        return {"くる": "こよう", "する": "しよう"}.get(kana, "")
    if cform == "命令形":
        # (an order, 配置につけ！, plan 272)
        if ctype.startswith("五段"):
            return kana[:-1] + _GODAN_E_ROW[kana[-1]] if kana[-1:] in _GODAN_E_ROW else ""
        return kana[:-1] + "ろ" if "一段" in ctype and kana.endswith("る") else ""
    form = _form_of(cform)
    if form in ("終止形", "連体形"):
        return kana
    if form in _ONBIN:
        if not ctype.startswith("五段"):
            return ""
        tail, ends = _ONBIN[form]
        if kana in _GO:
            return kana[:-1] + "っ" if form == "促音便" else ""
        return kana[:-1] + tail if kana[-1:] in ends else ""
    if form not in _GODAN_STEM:
        return ""
    if ctype.startswith("五段"):
        row = _GODAN_STEM[form]
        return kana[:-1] + row[kana[-1]] if kana[-1:] in row else ""
    if "一段" in ctype:
        return kana[:-1] if kana.endswith("る") else ""
    if ctype.startswith("カ行変格") and kana == "くる":
        return "き" if form == "連用形" else "こ"
    return ""


def _dictionary_forms(stem: str, cform: str) -> set[str]:
    """Every dictionary form a verb spelled `stem` in `cform` could have:
    おき before ます is おきる (an ichidan stem) or おく (a godan one)."""
    if cform.startswith("意志推量形"):
        # (つけよう is つける's, かこう かく's, plan 272)
        out = {stem[:-2] + "る"} if stem.endswith("よう") and len(stem) > 2 else set()
        if stem.endswith("う") and len(stem) > 1:
            out |= {stem[:-2] + u for u, o in _GODAN_O_ROW.items() if stem[-2] == o}
        return out | ({"くる"} if stem == "こよう" else set()) | ({"する"} if stem == "しよう" else set())
    form = _form_of(cform)
    if form in ("終止形", "連体形"):
        return {stem}
    if form in _ONBIN:
        tail, ends = _ONBIN[form]
        if not stem.endswith(tail):
            return set()
        out = {stem[:-1] + e for e in ends}
        if form == "促音便" and stem[:-1] in ("い", "ゆ"):
            out.add(stem[:-1] + "く")          # 行って
        return out
    if form not in _GODAN_STEM:
        return set()
    out = {stem + "る"}
    out |= {stem[:-1] + u for u, k in _GODAN_STEM[form].items() if stem.endswith(k)}
    if stem == ("き" if form == "連用形" else "こ"):
        out.add("くる")
    return out


# A deck verb read otherwise than UniDic reads its spelling alone, with
# the class it conjugates in read so (plan 272): 居る read おる is 五段,
# おります, where 居る read いる is 一段.
_READ_CLASS = {("居る", "おる"): "五段-ラ行"}


@lru_cache(maxsize=4096)
def _verb_class(written: str) -> str:
    """UniDic's conjugation class for a deck verb written `written` on
    its own, or "" when the tokenizer does not read it as one verb."""
    morphemes = morphology.tokenize(written) or []
    if len(morphemes) != 1 or morphemes[0].pos != "verb":
        return ""
    return morphemes[0].ctype


def _deck_verbs_spelled(m, nxt=None) -> list[tuple[str, dict, str]]:
    """(level, entry, raw_id) for every deck verb a token written in
    hiragana could be, read off its spelling and its conjugation form
    alone, or [] for any other token.

    `nxt` is the token after it, where the caller has it: before て or た
    a godan verb takes its sound-changed stem (置いて, never おきて), so a
    plain stem there is an ichidan verb's or a す verb's (おきて is 起きる,
    plan 272)."""
    if (m.pos != "verb" or not m.cform or not m.surface
            or any(is_kanji(c) for c in m.surface) or _katakana_written(m.surface)):
        return []
    stem = morphology.kata_to_hira(m.surface)
    before_te = (nxt is not None and m.cform == "連用形-一般"
                 and ((nxt.pos == "particle" and nxt.conjunctive and nxt.surface in ("て", "で"))
                      or (nxt.pos == "auxiliary" and nxt.lemma in ("た", "だ"))))
    out = []
    forms = [(reading, m.cform) for reading in _dictionary_forms(stem, m.cform)]
    if m.cform.startswith("終止形") and stem.endswith("う") and nxt is not None and (
            nxt.pos == "symbol" or nxt.surface in ("よ", "ね", "か", "と", "って", "ぜ", "や")):
        # (手紙をかこう: UniDic's 囲う, as often 書く's volitional -- the
        # partner says which, plan 272)
        forms += [(reading, "意志推量形") for reading in _dictionary_forms(stem, "意志推量形")]
    for reading, cform in forms:
        for level, entry in _VOCAB_BY_KANA.get(reading, ()):
            written = re.split(r"[/／;、,・]", entry.get("kanji") or "")[0].strip() or reading
            ctype = _READ_CLASS.get((written, reading)) or _verb_class(written)
            if before_te and ctype.startswith("五段") and ctype != "五段-サ行":
                continue
            if (m.cform.startswith("連用形-イ音便") and nxt is not None and nxt.surface[:1] in ("て", "た", "で", "だ")
                    and reading.endswith("ぐ") != (nxt.surface[:1] in ("で", "だ"))):
                # (its て says which: ぬいて is 抜く, ぬいで 脱ぐ, plan 272)
                continue
            if ctype and _conjugated(reading, ctype, cform) == stem:
                raw_id = vocab_to_id(entry, level)
                if all(raw_id != r for _, _, r in out):
                    out.append((level, entry, raw_id))
    return out


def _there_is(morphemes, i: int) -> bool:
    """Whether morphemes[i], いる written in kana, says where someone is:
    after に, には or にも (家にいる, この中にいるに違いない). 要る, "to
    need", which いる also spells, takes what is needed with が, never a
    place with に (plan 266)."""
    m = morphemes[i]
    if m.lemma != "居る" or m.lemma_reading != "いる" or any(is_kanji(c) for c in m.surface):
        return False
    k = i - 1
    if k >= 0 and morphemes[k].pos == "particle" and morphemes[k].surface in ("は", "も"):
        k -= 1
    return k >= 0 and morphemes[k].pos == "particle" and morphemes[k].surface == "に"


# What decides a verb written in kana where its spelling is several deck
# verbs' (plan 272): the particle before it, and the word that particle
# marks. (The card's kanji, the particles, the words -- None for any.)
_PLACES = frozenset({
    "駅", "えき", "家", "いえ", "うち", "学校", "がっこう", "会社", "かいしゃ", "空港", "くうこう",
    "病院", "びょういん", "店", "みせ", "部屋", "へや", "公園", "こうえん", "町", "まち", "国", "くに",
    "東京", "とうきょう", "日本", "にほん", "ホテル", "海", "うみ", "山", "やま", "川", "かわ", "村", "むら",
    "城", "しろ", "家族", "ここ", "そこ", "あそこ", "どこ", "図書館", "としょかん", "銀行", "ぎんこう",
    "教室", "きょうしつ", "大学", "だいがく", "実家", "外国", "がいこく", "森", "もり", "島", "しま",
})
_PEOPLE = frozenset({
    "先生", "せんせい", "母", "はは", "父", "ちち", "友だち", "ともだち", "友達", "彼", "かれ", "彼女", "かのじょ",
    "みんな", "皆", "家族", "かぞく", "子ども", "こども", "子供", "お母さん", "おかあさん", "お父さん", "おとうさん",
    "兄", "あに", "姉", "あね", "弟", "おとうと", "妹", "いもうと", "医者", "いしゃ", "店員", "てんいん",
    "警察", "けいさつ", "社長", "しゃちょう", "部長", "ぶちょう", "課長", "かちょう", "君", "きみ", "あなた",
})
_LIGHTS = frozenset({"テレビ", "電気", "でんき", "明かり", "あかり", "エアコン", "ラジオ", "ライト", "火", "ひ",
                     "暖房", "だんぼう", "冷房", "れいぼう", "ストーブ", "電灯", "でんとう", "スイッチ"})
# Words of time that stand between a verb and its partner as an adverb
# would: 祖父が去年なくなった, 雨がきのうふった.
_WHEN_WORDS = frozenset({"去年", "きょねん", "昨日", "きのう", "今日", "きょう", "明日", "あした", "あす", "今",
                         "いま", "毎日", "まいにち", "先月", "せんげつ", "先週", "せんしゅう", "今朝", "けさ",
                         "昨夜", "ゆうべ", "今年", "ことし", "朝", "あさ", "夜", "よる", "最近", "さいきん"})

# The living, that いる says is there and 亡くなる says has died.
_LIVING = frozenset({"人", "ひと", "子", "こ", "子ども", "子供", "こども", "女の子", "おんなのこ", "男の子",
                     "おとこのこ", "女", "おんな", "男", "おとこ", "弟", "妹", "生徒", "せいと", "犬", "いぬ", "猫", "ねこ", "鳥", "とり",
                     "魚", "さかな", "動物", "どうぶつ", "虫", "むし", "友だち", "友達", "ともだち", "家族", "かぞく",
                     "兄弟", "きょうだい", "学生", "がくせい", "先生", "せんせい", "誰", "だれ", "彼", "かれ", "彼女",
                     "かのじょ", "父", "ちち", "母", "はは", "祖父", "そふ", "祖母", "そぼ", "兄", "あに", "姉",
                     "あね", "弟", "おとうと", "妹", "いもうと", "夫", "おっと", "妻", "つま", "息子", "むすこ", "娘",
                     "むすめ", "両親", "りょうしん", "客", "きゃく", "医者", "いしゃ", "店員", "てんいん", "犯人",
                     "はんにん", "おじいさん", "おばあさん", "お父さん", "おとうさん", "お母さん", "おかあさん",
                     "赤ちゃん", "あかちゃん", "社長", "しゃちょう", "みんな", "皆", "私", "わたし", "僕", "ぼく"})


_ANIMALS = frozenset({"犬", "いぬ", "猫", "ねこ", "鳥", "とり", "虫", "むし", "動物", "どうぶつ", "せみ", "蝉", "からす",
                      "カラス", "かえる", "カエル", "牛", "うし", "羊", "ひつじ", "犬たち", "小鳥", "ことり",
                      # (plan 272)
                      "鶏", "にわとり", "うぐいす", "すずめ", "雀", "こおろぎ", "鈴虫", "すずむし", "蛙", "猿", "さる",
                      "馬", "うま", "豚", "ぶた", "狼", "おおかみ", "きつね", "狐", "ライオン", "虎", "とら", "鹿",
                      "しか", "やぎ", "山羊", "ひよこ", "はと", "鳩", "かもめ", "ふくろう", "セミ", "ネコ", "イヌ"})


def _alive(word: str) -> bool:
    """Whether `word` is a person or an animal, or a name with its
    honorific (田中さん)."""
    return word in _LIVING or word.endswith(("さん", "くん", "ちゃん", "様", "さま", "たち", "達",
                                             # (plan 272: 初心者, 外国人, 店員, 留学生)
                                             "者", "人", "員", "学生", "校生", "級生"))


_TIMES = frozenset({"時間", "じかん", "日", "ひ", "年", "とし", "月", "つき", "時", "とき", "分", "ふん", "ぷん",
                    "秒", "びょう", "週間", "しゅうかん", "か月", "ヶ月", "カ月", "年間", "日間", "いつ", "何年", "何日"})
_PLACE_ENDINGS = tuple("町市村県区都府州国島京")


def _placelike(word: str) -> bool:
    """A place to live in: a place word, or a name ending as a place's
    does (大阪 aside, 北の町, 東京都)."""
    return word in _PLACES or word in _HOMES or word.endswith(_PLACE_ENDINGS)


_HOMES = frozenset({"アパート", "マンション", "寮", "りょう", "近く", "ちかく", "そば", "田舎", "いなか", "都会",
                    "とかい", "海外", "かいがい", "隣", "となり", "大阪", "おおさか", "京都", "きょうと", "北海道"})
_PARTNERS = (
    # (plan 272: what a sense review of the app's own sentences found)
    ("辞める", ("を",), frozenset({"会社", "かいしゃ", "仕事", "しごと", "学校", "がっこう", "大学", "バイト", "アルバイト",
                                  "部活", "クラブ", "職", "店", "教師", "先生"})),     # 会社をやめる
    ("賭ける", ("を",), frozenset({"命", "いのち", "人生", "全財産", "首"})),  # 命をかける (お金をかける spends, 掛ける)
    ("住む", ("に",), _placelike),                                  # 東京にすんでいる
    ("住む", ("が", "は", "も"), _alive),                            # おばあさんがすんでいました (plan 272)
    ("居る", ("が", "も", "は", ""), _alive),                        # 若い人もいる, わかる人いる？ (plan 272)
    ("来る", ("が", "も", "は"), _alive),                            # 田中さんがきた
    ("泣く", ("が", "も", "は"), lambda word: _alive(word) and word not in _ANIMALS),  # こどもがないている
    ("鳴く", ("が", "も", "は"), _ANIMALS),                          # とりがないている
    ("来る", ("に", "へ"), None),                                   # いえにきた (着る takes を)
    ("居る", ("に",), None),                                       # へやにいる
    # (どこいる？, 今どこいるの: where one is, its に dropped, plan 272)
    ("居る", ("",), frozenset({"どこ", "ここ", "そこ", "あそこ", "どっか", "どこか", "家", "うち", "今"})),
    ("居る", ("の",), _alive),                                     # 猫のいる暮らし (plan 272)
    ("要る", ("が", "も", "は"), frozenset({"お金", "おかね", "金", "かね", "時間", "じかん", "許可", "きょか",
                                         "パスポート", "ビザ", "勇気", "ゆうき", "助け", "たすけ", "力", "ちから",
                                         "練習", "れんしゅう", "準備", "じゅんび", "何", "なに", "なん"})),
    ("亡くなる", ("が", "も", "は"), _alive),                        # 祖父がなくなった
    ("無くなる", ("が", "も", "は"), lambda word: not _alive(word)),  # 終電がなくなり
    ("澄ます", ("を",), frozenset({"耳", "みみ", "顔", "かお"})),      # 耳をすます
    ("済ます", ("を", "で"), frozenset({"用事", "ようじ", "食事", "しょくじ", "宿題", "しゅくだい", "手続き",
                                    "てつづき", "仕事", "しごと", "昼", "ひる"})),
    ("降る", ("に",), frozenset({"雨", "あめ", "雪", "ゆき"})),         # 雨にふられる
    ("済む", ("が",), None),                                       # 用事がすんだ
    ("経つ", ("が", "も", "ぐらい", "くらい", "ほど", "まで", ""), _TIMES),  # 二十分ぐらいたって
    ("付く", ("が",), frozenset({"名前", "なまえ", "名", "な", "地名", "傷", "きず", "しみ", "汚れ", "よごれ", "色",
                                "いろ", "気", "き", "癖", "くせ", "力", "ちから", "実", "み", "差", "さ", "値段",
                                "ねだん", "習慣", "しゅうかん", "身", "決心", "けっしん", "見当", "けんとう",
                                # (焼き色がつく, とろみがつく: what cooking leaves, plan 272)
                                "焼き色", "やきいろ", "焦げ目", "こげめ", "とろみ", "味", "あじ", "香り", "かおり"})),
    # (サラダとスープもつきますか: what comes with a meal or a purchase, plan 272)
    ("付く", ("も", "が", "は"), frozenset({"サラダ", "スープ", "ドリンク", "飲み物", "のみもの", "デザート", "朝食",
                                         "ちょうしょく", "夕食", "ゆうしょく", "ご飯", "ごはん", "みそ汁", "味噌汁",
                                         "おまけ", "特典", "とくてん", "保証", "ほしょう", "送料", "そうりょう"})),
    ("付く", ("に",), frozenset({"服", "ふく", "手", "て", "顔", "かお", "体", "からだ", "シャツ", "床", "ゆか",
                                "壁", "かべ", "目", "め", "身", "み"})),
    ("貼る", ("に", "を", "が"), frozenset({"壁", "かべ", "地図", "ちず", "ポスター", "写真", "しゃしん", "紙",
                                        "かみ", "切手", "きって", "シール", "ドア", "窓", "まど",
                                        # (plan 272: メモをつくえにはる)
                                        "机", "つくえ", "冷蔵庫", "れいぞうこ", "黒板", "こくばん", "ノート", "封筒",
                                        "ふうとう", "掲示板", "けいじばん", "背中", "せなか", "ガラス", "画面",
                                        "がめん", "ラベル", "付箋", "ふせん", "テープ", "メモ", "絆創膏",
                                        "ばんそうこう", "はがき", "葉書"})),
    ("吹く", ("が", "も"), frozenset({"風", "かぜ", "息", "いき"})),        # 風がふいた
    ("吹く", ("を",), frozenset({"笛", "ふえ", "口笛", "くちぶえ", "ラッパ", "トランペット", "息", "いき"})),
    ("拭く", ("を",), frozenset({"汗", "あせ", "涙", "なみだ", "顔", "かお", "手", "て", "テーブル", "机", "つくえ",
                                "窓", "まど", "床", "ゆか", "皿", "さら"})),
    ("倣う", ("に",), frozenset({"例", "れい", "前例", "ぜんれい", "手本", "てほん"})),
    ("打つ", ("を",), frozenset({"終止符", "しゅうしふ", "ボール", "くぎ", "釘", "注射", "ちゅうし", "電報",
                                "でんぽう", "手", "て", "頭", "あたま", "キー", "球", "たま"})),
    ("飼う", ("を", "が", "は", "も"), frozenset({"犬", "いぬ", "猫", "ねこ", "動物", "どうぶつ", "ペット", "鳥",
                                              "とり", "魚", "さかな", "金魚", "きんぎょ", "うさぎ", "ハムスター"})),
    # (パンをかった: what is bought, where UniDic read 駆る -- an animal is
    # kept, the row before, plan 272)
    ("買う", ("を",), lambda word: word not in _PETS),
    ("明ける", ("が", "も"), frozenset({"夜", "よる", "年", "とし", "梅雨", "つゆ"})),       # 夜があけた (plan 272)
    ("勝つ", ("に",), frozenset({"試合", "しあい", "選挙", "せんきょ", "勝負", "しょうぶ", "戦い", "たたかい", "戦争",
                                "ゲーム", "相手", "あいて", "敵", "てき", "誘惑", "ゆうわく", "自分", "じぶん"})),  # 試合にかった
    ("行く", ("",), frozenset({"うまく", "まっすぐ"})),             # うまくいった
    ("切る", ("を", "も", "は"), frozenset({"髪", "かみ", "紙", "爪", "つめ", "肉", "にく", "野菜", "やさい", "パン",
                                         "ケーキ", "電話", "でんわ", "スイッチ", "電源", "でんげん", "指", "ゆび",
                                         "木", "き", "枝", "えだ", "縁", "えん", "期限", "きげん"})),
    ("着る", ("を", "も", "は"), frozenset({"服", "ふく", "シャツ", "着物", "きもの", "コート", "セーター", "ドレス",
                                         "浴衣", "ゆかた", "上着", "うわぎ", "洋服", "ようふく", "制服", "せいふく",
                                         "スーツ", "ジャケット", "水着", "みずぎ"})),
    ("書く", ("に",), frozenset({"紙", "かみ", "ノート", "黒板", "こくばん", "手帳", "てちょう", "日記", "にっき"})),
    ("行く", ("へ",), None),                                       # 学校へいった
    ("行く", ("に",), _PLACES),                                    # 駅にいった
    ("言う", ("と", "って"), None),                                # そうといった
    ("言う", ("に",), _PEOPLE),                                    # 先生にいった
    ("書く", ("を",), frozenset({"手紙", "てがみ", "字", "じ", "名前", "なまえ", "作文", "さくぶん", "日記",
                                  "にっき", "レポート", "メール", "文", "ぶん", "小説", "しょうせつ", "漢字", "かんじ"})),
    ("描く", ("を", "も", "は"), frozenset({"絵", "え", "漫画", "まんが", "マンガ", "イラスト", "似顔絵", "にがおえ"})),
    ("撮る", ("を",), frozenset({"写真", "しゃしん", "ビデオ", "動画", "どうが"})),  # しゃしんをとる
    ("着く", ("に", "へ"), _PLACES),                               # 駅につく
    ("吐く", ("を", "は", "も", ""), frozenset({"嘘", "うそ", "ため息", "ためいき", "溜息", "息", "いき", "ひと息", "一息",
                                             "ひといき"})),  # うそをつく, ひと息つく (plan 272)
    ("突く", ("を",), frozenset({"鼻", "はな", "胸", "むね", "意表", "いひょう", "虚", "きょ",
                                # (手をつく, 膝をつく, 杖をつく: put down to lean on, plan 272)
                                "手", "て", "両手", "りょうて", "片手", "かたて", "膝", "ひざ", "肘", "ひじ", "杖",
                                "つえ", "頬杖", "ほおづえ", "足", "あし"})),  # 鼻をつく (plan 272)
    ("轢く", ("に",), frozenset({"車", "くるま", "自転車", "じてんしゃ", "トラック", "バイク", "バス", "電車",
                                "でんしゃ", "列車", "れっしゃ", "自動車", "じどうしゃ"})),  # 車にひかれる (plan 272)
    ("点く", ("が",), _LIGHTS),                                    # 電気がつく
    ("", ("を",), _LIGHTS),                                        # テレビをつける, "to turn on"
    ("引く", ("を", ""), frozenset({"風邪", "かぜ", "線", "せん", "辞書", "じしょ", "くじ", "人目", "ひとめ",
                                  "油", "あぶら",                    # 油をひく, a pan (plan 272)
                                  "注意", "ちゅうい", "関心", "かんしん", "興味", "きょうみ", "気", "き"})),  # かぜをひく
    ("弾く", ("を",), frozenset({"ピアノ", "ギター", "バイオリン", "曲", "きょく", "楽器", "がっき"})),
    ("開く", ("が",), frozenset({"ドア", "窓", "まど", "戸", "と", "門", "もん", "ふた", "口", "くち"})),
    ("空く", ("が",), frozenset({"席", "せき", "手", "て", "部屋", "へや"})),
    ("効く", ("が", "は"), frozenset({"薬", "くすり"})),
    ("晴れる", ("が", "は", "も", "から"), frozenset({"天気", "てんき", "空", "そら", "明日", "あした", "あす", "今日",
                                                 "きょう", "今", "いま", "朝", "あさ", "午後", "ごご", "午前",
                                                 "ごぜん", "週末"})),
    ("付く", ("",), frozenset({"高く", "安く"})),                     # 高くつく, "to cost a lot"
    ("降る", ("が", "は", "も"), frozenset({"雨", "あめ", "雪", "ゆき"})),
    ("振る", ("を",), frozenset({"手", "て", "旗", "はた", "しっぽ", "首", "くび"})),
    ("経つ", ("が", "も"), frozenset({"時間", "じかん", "日", "ひ", "年", "とし", "月", "つき", "時", "とき"})),
    ("帰る", ("に", "へ"), _PLACES),
    ("変える", ("を",), None),                                     # 髪型をかえる
    ("履く", ("を",), frozenset({"くつ", "靴", "足袋", "たび", "くつした", "靴下", "ズボン", "スカート", "スリッパ", "ブーツ",
                                  "げた", "下駄", "ながぐつ", "長靴", "うわばき", "上履き", "サンダル", "スニーカー",
                                  # (a colour said of what one wears: 赤をはいても, plan 272)
                                  "赤", "あか", "白", "しろ", "黒", "くろ", "青", "あお", "茶色", "ちゃいろ"})),  # くつをはいた
    ("", ("が",), frozenset({"おなか", "お腹", "はら", "腹"})),        # おなかがすいた
    ("降りる", ("を", "から"), frozenset({"電車", "でんしゃ", "バス", "車", "くるま", "タクシー", "船", "ふね",
                                         "山", "やま", "階段", "かいだん", "列車", "れっしゃ"})),  # 電車をおります
    ("咲く", ("が", "も", "は"), frozenset({"花", "はな", "さくら", "桜", "ばら", "梅", "うめ", "ひまわり"})),
    ("閉める", ("を",), frozenset({"窓", "まど", "ドア", "戸", "と", "門", "もん", "店", "みせ", "ふた", "カーテン"})),
    ("締める", ("を",), frozenset({"ネクタイ", "ベルト", "ひも"})),
    ("寝る", ("",), frozenset({"はやく", "早く", "おそく", "遅く", "もう", "よく", "ぐっすり", "すぐ"})),  # 早くねる
    ("起きる", ("に",), frozenset({"時", "じ", "朝", "あさ"})),      # 七時におきる
    ("起きる", ("",), frozenset({"はやく", "早く", "おそく", "遅く", "もう", "まだ"})),  # はやくおきなさい
    ("済む", ("",), frozenset({"もう", "安く", "やすく", "少なく", "すくなく", "軽く", "かるく"})),  # 安くすむ
    ("置く", ("を",), None),                                       # かばんをおきます
    ("付ける", ("を", ""), frozenset({"決着", "けっちゃく", "名前", "なまえ", "印", "しるし", "薬", "くすり", "味", "あじ",
                                  # (plan 272: テレビ(を)つけっぱなし, 衣をつける)
                                  "テレビ", "電気", "でんき", "ライト", "エアコン", "暖房", "冷房", "ラジオ", "衣", "ころも",
                                  "パン粉", "パンこ",
                                  "日記", "にっき", "条件", "じょうけん", "見当", "けんとう", "区別", "くべつ", "傷",
                                  "きず", "点", "てん", "家計簿", "かけいぼ", "記録", "きろく", "けじめ",
                                  # (plan 272: 下味をつける, リードをつける, 手をつける, 花をつける)
                                  "下味", "したあじ", "リード", "首輪", "くびわ", "手", "て", "花", "はな", "しお", "塩",
                                  "気", "き", "名札", "なふだ", "シートベルト", "跡", "あと", "癖", "くせ", "自信",
                                  "じしん", "知識", "ちしき", "身", "み", "番号", "ばんごう", "順番", "じゅんばん",
                                  "値段", "ねだん", "目印", "めじるし", "文句", "もんく", "都合", "つごう", "片", "かた",
                                  "醤油", "しょうゆ", "ソース", "バター", "ジャム", "たれ", "タレ", "わさび",
                                  "ケチャップ", "マヨネーズ", "実", "み", "気持ち", "きもち",
                                  # (plan 272: 優先順位をつける, 窓に額をつける)
                                  "順位", "じゅんい", "優先順位", "ゆうせんじゅんい", "差", "点数", "てんすう",
                                  "成績", "せいせき", "額", "ひたい", "おでこ", "顔", "かお", "耳", "みみ", "頬", "ほお",
                                  "力", "ちから", "体力", "たいりょく", "筋肉", "きんにく", "習慣", "しゅうかん",
                                  "格好", "かっこう", "かっこ", "区切り", "くぎり", "段取り", "だんどり", "理由",
                                  "りゆう", "色", "いろ", "香り", "かおり", "気ぃ"})),  # 決着をつける
    ("就く", ("に",), frozenset({"配置", "はいち", "持ち場", "もちば", "位置", "いち", "職", "しょく", "任務",
                                "にんむ", "眠り", "ねむり", "床", "とこ", "帰路", "きろ", "家路", "いえじ", "王位",
                                "おうい", "職務", "しょくむ", "守備", "しゅび", "仕事", "しごと", "席", "せき"})),  # 配置につけ (plan 272)
    # (plan 272) お箸はおつけしますか: what is put in with an order
    ("付ける", ("は", "も", "が"), frozenset({"箸", "はし", "お箸", "おはし", "割り箸", "わりばし", "スプーン",
                                         "フォーク", "ストロー", "袋", "ふくろ", "レシート", "おしぼり", "保冷剤",
                                         "ほれいざい"})),
    ("着ける", ("を",), frozenset({"マスク", "指輪", "ゆびわ", "ネックレス", "腕時計", "うでどけい", "イヤリング",
                                  "ピアス", "ブレスレット", "エプロン", "下着", "したぎ"})),
    ("剥く", ("を",), frozenset({"皮", "かわ", "りんご", "リンゴ", "みかん", "ミカン", "果物", "くだもの", "バナナ",
                                "玉ねぎ", "たまねぎ", "じゃがいも", "ジャガイモ", "にんじん", "人参", "殻", "から", "梨",
                                "なし", "桃", "もも", "柿", "かき", "卵", "たまご", "えび", "エビ", "芋", "いも"})),
    ("向く", ("を", "に", "へ"), frozenset({"上", "うえ", "前", "まえ", "下", "した", "横", "よこ", "後ろ", "うしろ",
                                         "左", "ひだり", "右", "みぎ", "外", "そと", "空", "そら", "こっち", "そっち",
                                         "あっち", "こちら", "そちら", "あちら", "南", "みなみ", "北", "きた", "東",
                                         "ひがし", "西", "にし", "方", "ほう", "正面", "しょうめん"})),
    ("習う", ("を",), frozenset({"おりがみ", "折り紙", "ピアノ", "日本語", "にほんご", "英語", "えいご", "書道", "しょどう",
                                  "料理", "りょうり", "茶道", "さどう", "漢字", "かんじ", "ダンス", "水泳", "すいえい",
                                  "空手", "からて", "柔道", "じゅうどう", "歌", "うた", "ギター", "バイオリン", "字", "じ",
                                  "生け花", "いけばな", "剣道", "けんどう", "テニス", "運転", "うんてん", "踊り", "おどり",
                                  "泳ぎ", "およぎ", "数学", "すうがく", "フランス語", "中国語", "韓国語", "言葉", "ことば",
                                  "絵", "え", "そろばん", "あみもの", "編み物", "ひらがな", "カタカナ", "かたかな"})),     # おりがみをならう
    ("習う", ("から",), _alive),                                     # 先生からならう (母にならう may be 倣う)
    ("怒る", ("が", "は", "も"), _alive),                             # 大西さんはおこらないで
    ("怒る", ("に",), _alive),                                       # 先生におこられた
    ("起こる", ("が", "は", "も"), frozenset({"事故", "じこ", "地震", "じしん", "問題", "もんだい", "事件", "じけん",
                                          "戦争", "せんそう", "火事", "かじ", "何", "なに", "何か", "なにか", "奇跡",
                                          "きせき", "変化", "へんか", "爆発", "ばくはつ", "災害", "さいがい", "事",
                                          "こと", "トラブル", "ミス", "異変", "いへん", "混乱", "こんらん", "けんか",
                                          "喧嘩", "革命", "かくめい"})),
    ("勧める", ("を",), frozenset({"こと", "事", "本", "ほん", "店", "みせ", "映画", "えいが", "旅", "たび", "旅行",
                                  "りょこう", "運動", "うんどう", "留学", "りゅうがく", "受診", "じゅしん", "入院",
                                  "にゅういん", "手術", "しゅじゅつ", "治療", "ちりょう", "酒", "さけ", "お茶", "おちゃ",
                                  "席", "せき", "結婚", "けっこん", "転職", "てんしょく", "休養", "きゅうよう", "禁煙",
                                  "きんえん", "検査", "けんさ", "購入", "こうにゅう"})),
    ("進める", ("を",), frozenset({"話", "はなし", "計画", "けいかく", "仕事", "しごと", "準備", "じゅんび", "研究",
                                  "けんきゅう", "作業", "さぎょう", "交渉", "こうしょう", "工事", "こうじ", "時計",
                                  "とけい", "手続き", "てつづき", "開発", "かいはつ", "議論", "ぎろん", "改革",
                                  "かいかく", "話し合い", "はなしあい", "調査", "ちょうさ", "駒", "こま"})),
    # (plan 272) Past the words listed, a partner says which verb by what
    # the dictionary says it is: what is switched on or lit (扇風機, ヒーター,
    # "heater"), what is worn (鎧, "armour"), what is put on or attached
    # (石けん, "soap"; キーホルダー, "keychain"). Lists first: they settle
    # the words whose own meaning would mislead.
    ("点く", ("が", "の", "は", "も"), lambda word: _means(word, _SWITCHED_ON)),
    ("", ("を", "も", "は", ""), lambda word: _means(word, _SWITCHED_ON)),   # ヒーターをつける, "to turn on"
    ("着ける", ("を", "も", "は", ""), lambda word: _means(word, _WORN)),
    ("付ける", ("を", "も", "は", ""), lambda word: _means(word, _PUT_ON)),
    ("付く", ("が", "の", "は", "も"), lambda word: _means(word, _STUCK_ON)),
)


# What a partner's own meaning says of a verb (_PARTNERS, plan 272): the
# deck's gloss of the word, else the pool's first.
_SWITCHED_ON = re.compile(r"\b(heater|heating|electric fan|fan|air[- ]?conditioner|air conditioning|cooler|light|lamp|"
                          r"lantern|torch|flashlight|headlights?|television|tv|radio|stereo|computer|pc|monitor|"
                          r"projector|engine|dryer|stove|fire|candle|power|electricity)\b")
_WORN = re.compile(r"\b(armou?r|mask|ring|necklace|bracelet|earrings?|wristwatch|brooch|badge|harness|seat ?belt|"
                   r"corset|wig|hairpin|hair ?clip|contact lens(es)?|gloves?|apron|accessor(y|ies))\b")
_PUT_ON = re.compile(r"\b(soap|cream|ointment|salve|lotion|moisturi[sz]er|sunscreen|perfume|cologne|make-?up|"
                     r"cosmetics|lipstick|foundation|powder|glue|paste|paint|varnish|wax|seasoning|dressing|"
                     r"label|tag|sticker|seal|stamp|price|caption|subtitles?|footnote|annotation|bookmark|"
                     r"attachment|strap|handle|button|lid)\b")
_STUCK_ON = re.compile(r"\b(stain|spot|smudge|dirt|scratch|scar|dent|knot|tag|label|sticker|keychain|key ?ring|"
                       r"strap|charm|ornament|decoration|attachment|handle|button|zipper|lid|hook|"
                       r"fringe|frill|ribbon|pocket|warranty|bonus|extra|option|subtitles?|caption)\b")


@lru_cache(maxsize=4096)
def _meaning_of(word: str) -> str:
    """The deck's meaning of `word`, else the JMdict pool's, lowercased."""
    for level, entry in _VOCAB_BY_LEMMA.get(word, ()) or _VOCAB_BY_KANA.get(word, ()):
        if word in (entry.get("kanji"), entry.get("kana")) and entry.get("meaning"):
            return entry["meaning"].lower()
    rows = [r for r in jmdict_db.by_kanji(word) or [] if r.get("kanji") == word] or \
        [r for r in jmdict_db.by_kana(word) or [] if not r.get("kanji") and r.get("kana") == word]
    return (rows[0].get("meaning") or "").lower() if rows else ""


def _means(word: str, pattern) -> bool:
    """Whether `word`'s first sense is one `pattern` names: 扇風機,
    "electric fan", is switched on."""
    first = _meaning_of(word).split(";")[0]
    return bool(first) and pattern.search(first) is not None


def _partners(morphemes, i: int) -> list[tuple[str, str]]:
    """What stands before morphemes[i] that may say which verb it is:
    ("", the word right before it) -- はやくおきなさい, and かぜひく,
    かぜをひく said short -- then (the particle before it in its clause,
    the noun that particle marks), past an adverb between them (この薬は
    ちっともきかない). A particle after anything but a noun marks no
    partner: 謝らずにはすまない's に is the ず's (plan 272)."""
    out = []
    k = i - 1
    if k >= 0 and morphemes[k].pos in ("noun", "pronoun", "suffix", "adverb", "adjective"):
        out.append(("", morphemes[k].surface))
    if k >= 2 and morphemes[k].pos == "suffix" and numeral_value(morphemes[k - 1].surface) is not None \
            and morphemes[k - 2].pos == "noun":
        out.append(("", morphemes[k - 2].surface))     # 傷一つつけられない (plan 272)
    while k >= 1 and (morphemes[k].pos == "adverb" or morphemes[k].surface in _WHEN_WORDS):
        k -= 1                         # 祖父が去年なくなった
    if k >= 0 and morphemes[k].pos == "particle" and morphemes[k].surface in ("は", "も") and k >= 1 \
            and morphemes[k - 1].pos == "particle":
        k -= 1                         # 東京にはすんでいない
    if k < 1 or morphemes[k].pos != "particle":
        return out
    if morphemes[k].surface in ("と", "って"):
        # What is said, whatever stands before the quotation's と:
        # だといっても, からといって, そうといった.
        out.append((morphemes[k].surface, ""))
        return out
    word = morphemes[k - 1]
    if word.pos == "suffix" and k >= 2 and word.surface not in _TIMES and word.surface not in ("時", "じ"):
        # A name and its さん is the name; a compound and its last piece
        # is the compound, or its head: 終止 + 符 is 終止符.
        out.append((morphemes[k].surface, morphemes[k - 2].surface + word.surface))
        word = morphemes[k - 2]
    if word.pos == "noun" and k >= 2 and morphemes[k - 2].pos in ("noun", "prefix") \
            and morphemes[k - 2].end == word.start and word.surface not in _TIMES:
        # (扇風 + 機 is 扇風機, "an electric fan": the compound the
        # tokenizer cut, before its last piece, plan 272)
        out.append((morphemes[k].surface, morphemes[k - 2].surface + word.surface))
    if word.pos in ("noun", "pronoun", "suffix") or (
            word.pos == "adjective" and word.cform.startswith("連用形") and word.surface.endswith("く")):
        # (An adjective's く form before a particle is a noun: 駅のちかくに.)
        out.append((morphemes[k].surface, word.surface))
    return out


# Where no particle names the verb, the sentence may (plan 272): 今は
# はれていますが、これからくもるでしょう is the weather's 晴れる; 何回押しても
# つかない a switch's 点く. Words of one card alone decide.
_SENTENCE_PARTNERS = {
    # (なくなり次第終了: what runs out, plan 272 -- a person dies, 亡くなる)
    "無くなる": frozenset({"終了", "次第", "在庫", "品切れ", "売り切れ", "数量", "限定", "お金", "かね", "時間", "じかん",
                         "電池", "ガソリン", "水", "みず", "食べ物", "財布", "鍵", "かぎ", "席", "せき"}),
    "晴れる": frozenset({"曇る", "くもる", "雨", "あめ", "雪", "ゆき", "天気", "てんき", "空", "そら", "太陽", "たいよう",
                       "晴れ", "はれ", "降る", "ふる", "台風", "たいふう", "傘", "かさ", "暖かい", "あたたかい",
                       "寒い", "さむい", "暑い", "あつい", "涼しい", "すずしい", "あさって", "明後日"}),
    "腫れる": frozenset({"目", "め", "顔", "かお", "足", "あし", "喉", "のど", "腕", "うで", "指", "ゆび", "歯", "は",
                       "痛い", "いたい", "虫", "むし", "怪我", "けが"}),
    "点く": frozenset({"押す", "おす", "ボタン", "スイッチ", "電気", "でんき", "テレビ", "エアコン", "リモコン",
                     "電源", "でんげん", "明かり", "あかり", "ライト", "電池", "でんち", "パソコン"}),
    "着く": frozenset({"駅", "えき", "空港", "くうこう", "家", "いえ", "うち", "ホテル", "到着", "とうちゃく",
                     "電車", "でんしゃ", "バス", "飛行機", "ひこうき",
                     # (あと五分でつく: what is left before one arrives)
                     "分", "ふん", "ぷん", "時間", "じかん", "もうすぐ", "そろそろ"}),
}


def _by_use(morphemes, i: int, spelled):
    """The card of `spelled` the way the verb is used says, where no
    partner names one (plan 272):

    - おります, おりません with nothing taken by を or left from (から):
      the humble いる (はい、おります), never 降りる or 折る;
    - なく with no animal in the sentence is 泣く, "to weep": 鳴く is
      what an animal does (ないてはいられない);
    - いってきます, いってらっしゃい, said as one goes, with no quotation's
      と before it: 行く, never 言う;
    - お + すすめ + する, the humble "I recommend": 勧める."""
    m = morphemes[i]
    previous = morphemes[i - 1] if i > 0 else None
    if m.auxiliary_use and previous is not None and previous.pos == "particle" and previous.conjunctive:
        return None                    # 待っております: 〜ています's, said humbly
    by_kanji = {}
    for hit in spelled:
        by_kanji.setdefault(hit[1].get("kanji") or "", hit)
    nxt = morphemes[i + 1] if i + 1 < len(morphemes) else None
    after = morphemes[i + 2] if i + 2 < len(morphemes) else None
    oru = next((h for h in spelled if (h[1].get("kanji"), h[1].get("kana")) == ("居る", "おる")), None)
    subject = _subject_of(morphemes, i)
    # (...and the west's いる, おってや, "stay", おった, plan 272)
    if oru is not None and nxt is not None and ((m.surface == "おり" and nxt.lemma == "ます") or (
            m.surface == "おっ" and nxt.surface in ("て", "た"))) \
            and not _clause_has(morphemes, i, ("を", "から")) and (subject is None or _alive(subject[1])):
        # (肩の荷がおりました: a thing comes down, 下りる.)
        return oru
    if {"泣く", "鳴く"} <= by_kanji.keys():
        words = {w for t in morphemes for w in (t.surface, t.lemma)}
        if not words & _ANIMALS:
            return by_kanji["泣く"]
    if "行く" in by_kanji and m.surface == "いっ" and nxt is not None and nxt.surface == "て" and after is not None \
            and (after.lemma == "来る" or after.surface.startswith("らっしゃ")) \
            and not _clause_has(morphemes, i, ("と", "って")) \
            and not ((previous is None or previous.pos == "symbol") and _said_on_leaving(morphemes, i + 2)):
        # (Said whole, いってきます is the pool's set phrase, "I'm off";
        # いってきました, "I went", is 行く, plan 272.)
        return by_kanji["行く"]
    if "勧める" in by_kanji and m.surface == "すすめ" and previous is not None and previous.pos == "prefix" \
            and previous.surface == "お":
        return by_kanji["勧める"]
    # (Whether it takes を says which, plan 272: かばんをたなにおきました is
    # 置く, あさ六時におきました 起きる; たまごやきをならいました, and the
    # ことば one ならった, 習う, no 倣う; 花がさきます 咲く, 紙をさく 裂く.)
    takes = _clause_has(morphemes, i, ("を",))
    names_it = nxt is not None and nxt.pos == "auxiliary" and nxt.lemma == "た" and after is not None \
        and after.pos == "noun"
    if {"置く", "起きる"} <= by_kanji.keys():
        if takes:
            return by_kanji["置く"]
        if subject is not None and _alive(subject[1]) or any(
                t.surface in _TIMES or t.surface in ("朝", "あさ", "早く", "はやく") for t in morphemes[:i]):
            return by_kanji["起きる"]
    if {"習う", "倣う"} <= by_kanji.keys() and (takes or names_it):
        return by_kanji["習う"]
    if {"咲く", "裂く"} <= by_kanji.keys():
        if takes and any(t.surface in _SPARED for t in morphemes[max(0, i - 4):i]):
            return None                 # 時間をさいて: 割く, "to spare", which the deck does not teach
        return by_kanji["裂く"] if takes else by_kanji["咲く"]
    # (...and what stands, 立つ, or passes, 経つ: そこにたっています, 木
    # がたっている; 時間がたった.)
    if {"立つ", "経つ"} <= by_kanji.keys():
        if subject is not None and subject[1] in _TIMES:
            return by_kanji["経つ"]
        if _clause_has(morphemes, i, ("に",)) or (subject is not None and subject[1] in ("き", "木", "人", "ひと")):
            return by_kanji["立つ"]
    # (...and what is mended, 直る, or healed, 治る: スマホがなおった,
    # かぜがなおった.)
    if {"直る", "治る"} <= by_kanji.keys() and subject is not None:
        if subject[1] in _AILMENTS:
            return by_kanji["治る"]
        if _katakana_written(subject[1]) or subject[1] in _MENDED:
            return by_kanji["直る"]
    return None


_AILMENTS = frozenset({"風邪", "かぜ", "病気", "びょうき", "けが", "怪我", "ケガ", "傷", "きず", "熱", "ねつ", "頭痛",
                       "ずつう", "痛み", "いたみ", "せき", "咳", "腰", "のど", "喉", "おなか", "お腹", "足", "あし"})
_MENDED = frozenset({"車", "くるま", "時計", "とけい", "機械", "きかい", "自転車", "じてんしゃ", "電話", "でんわ",
                     "でんき", "電気", "くつ", "靴", "かさ", "傘", "いす", "椅子", "ドア", "まど", "窓", "テレビ"})


def _said_on_leaving(morphemes, k: int) -> bool:
    """Whether morphemes[k:] are the rest of いってきます or いってらっしゃい
    said whole: き + ます, or らっしゃい(ませ), and nothing after but a mark."""
    rest = [t for t in morphemes[k:] if t.pos != "symbol"]
    words = "".join(t.surface for t in rest)
    return words in ("きます", "まいります", "らっしゃい", "らっしゃいませ", "らっしゃーい")


def _clause_has(morphemes, i: int, particles: tuple[str, ...]) -> bool:
    """Whether one of `particles` stands in morphemes[i]'s clause before it."""
    for k in range(i - 1, -1, -1):
        t = morphemes[k]
        if t.pos == "symbol" or (t.pos == "particle" and t.conjunctive):
            return False
        if t.pos == "particle" and t.surface in particles:
            return True
    return False


def _by_sentence(morphemes, i: int, spelled):
    """The card of `spelled` whose sentence words (_SENTENCE_PARTNERS)
    alone stand in the sentence, or None."""
    words = set()
    for k, t in enumerate(morphemes):
        if k != i and t.pos not in ("symbol", "particle", "auxiliary"):
            words.update((t.surface, t.lemma))
    named = [(lv, e, r) for lv, e, r in spelled
             if _SENTENCE_PARTNERS.get(e.get("kanji") or "", frozenset()) & words]
    return named[0] if len(named) == 1 else None


_SPELLED_FORMS = ("連用形-一般", "連用形-イ音便", "連用形-促音便", "連用形-撥音便", "未然形-一般", "終止形-一般")


def _spells(entry: dict, stem: str, nxt=None) -> bool:
    """Whether a form of the deck verb `entry` is written `stem`: ねこを
    かいたがって is 飼う's かい, which UniDic read as 掻く's sound change.
    Before て or た a godan verb takes its sound-changed form, and before
    で or だ the voiced one (嗅いだ, 読んだ): かいだ is no 飼う."""
    written = re.split(r"[/／;、,・]", entry.get("kanji") or "")[0].strip()
    ctype = (_READ_CLASS.get((written, entry.get("kana") or "")) or _verb_class(written)) if written else ""
    if not ctype:
        return False
    forms = _SPELLED_FORMS
    past_or_te = nxt is not None and ((nxt.pos == "auxiliary" and nxt.lemma in ("た", "だ"))
                                      or (nxt.pos == "particle" and nxt.conjunctive and nxt.surface in ("て", "で")))
    if past_or_te:
        voiced = nxt.surface[:1] in "でだ"
        if ctype.startswith("五段"):
            forms = ("連用形-撥音便",) if voiced and not ctype.endswith("ガ行") else \
                ("連用形-イ音便",) if voiced else ("連用形-イ音便", "連用形-促音便")
            if ctype.endswith("サ行"):
                forms = ("連用形-一般",)
        else:
            forms = ("連用形-一般",)
    elif ctype.startswith("五段") and nxt is not None and nxt.pos == "auxiliary" and nxt.lemma in ("ない", "ず"):
        # (A godan verb's potential before its negative: うそはつけない is
        # 吐く's つける, "can tell (a lie)", plan 272.)
        forms = forms + ("仮定形-一般",)
    elif nxt is None or (nxt.pos == "symbol" and nxt.surface in ("！", "!", "。")) or (
            nxt.pos == "particle" and nxt.surface in ("よ", "ぞ")):
        # (An order ends what is said: 配置につけ！ is 就く's, plan 272.)
        forms = forms + ("命令形",)
    return any(_conjugated(kana, ctype, form) == stem
               for kana in _reading_variants(entry.get("kana") or "") for form in forms)


def _subject_of(morphemes, i: int):
    """(particle, noun) for the subject of morphemes[i]'s clause, where a
    word stands between them (plan 272): 女の子が一人でないていた. The
    nearest が, は or も after a noun, back to the clause's start."""
    for k in range(i - 1, 0, -1):
        t = morphemes[k]
        if t.pos == "symbol" or (t.pos == "particle" and t.conjunctive):
            return None
        if t.pos == "particle" and t.surface in ("が", "は", "も"):
            word = morphemes[k - 1]
            if t.surface == "も" and _a_quantity(morphemes, k - 1):
                continue                   # ゆきが三十センチもふった: how much, no subject (plan 272)
            if word.pos == "suffix" and k >= 2:
                return t.surface, morphemes[k - 2].surface + word.surface
            return (t.surface, word.surface) if word.pos in ("noun", "pronoun") else None
    return None


def _a_quantity(morphemes, j: int) -> bool:
    """Whether morphemes[j] ends a quantity: a number, or a counter or a
    unit after one or after 何 (三十センチ, 何回)."""
    w = morphemes[j]
    if _numeral(w.surface):
        return True
    return j >= 1 and (w.counter or w.pos == "suffix") and (
        _numeral(morphemes[j - 1].surface) or morphemes[j - 1].surface == "何")


def _by_partner(morphemes, i: int, spelled):
    """The card the verb's partner names (_PARTNERS) among `spelled`
    (_deck_verbs_spelled) -- or, where UniDic took the stem for another
    form, the deck verb a form of which the page spells -- or None where
    no partner names one."""
    m = morphemes[i]
    stem = morphology.kata_to_hira(m.surface)
    nxt = morphemes[i + 1] if i + 1 < len(morphemes) else None
    pairs = [(p, w, False) for p, w in _partners(morphemes, i)]
    subject = _subject_of(morphemes, i)
    if subject is not None and subject not in [(p, w) for p, w, _ in pairs]:
        pairs.append((*subject, True))
    for particle, word, far in pairs:
        for kanji, particles, words in _PARTNERS:
            # (嘘ばっかりつく, 専門家さえいる: a focus particle stands where
            # the を or the が would, plan 272)
            standing = particle in _FOCUS_PARTICLES and any(p in particles for p in ("を", "が", "は", "も"))
            if (particle not in particles and not standing) or (far and kanji not in _SUBJECT_VERBS):
                continue
            if words is not None and not (words(word) if callable(words) else word in words):
                continue
            if particles == ("",) and kanji == "居る" and not morphology.kata_to_hira(m.reading).startswith("い"):
                continue                   # (どこおると: the west's おる, glossed -- no humble 居る)
            for level, entry, raw_id in spelled:
                if (entry.get("kanji") or "") == kanji:
                    return level, entry, raw_id
            if kanji and m.pos == "verb" and _hiragana(stem):
                for level, entry in _VOCAB_BY_LEMMA.get(kanji, ()):
                    if (entry.get("kanji") or "") == kanji and _spells(entry, stem, nxt):
                        return level, entry, vocab_to_id(entry, level)
    return None


# The particles that stand in a noun's case particle's place and stress
# it: なんて, さえ, ばかり, だけ (plan 272).
_FOCUS_PARTICLES = frozenset({"なんて", "なんか", "さえ", "すら", "だけ", "ばかり", "ばっかり", "ばっか", "こそ",
                              "まで", "でも", "って", "しか", "など"})


# The verbs whose partner is the one who does it, which may stand further
# back in the clause (_subject_of): 女の子が一人でないていた. Never a verb
# whose が marks what it takes: 犬は匂いをかいだ is no 飼う.
_SUBJECT_VERBS = frozenset({"泣く", "鳴く", "来る", "居る", "要る", "亡くなる", "無くなる", "降る", "晴れる", "住む",
                            "吹く", "咲く", "点く", "経つ", "済む", "空く", "開く", "効く",
                            # (plan 272; 付ける by what its は puts first: お箸は
                            # おつけしますか)
                            "怒る", "起こる", "付ける"})


def _kana_verb(m, hit, spelled=None):
    """The card for a verb the page writes in hiragana, where its
    spelling alone could be another deck verb's (plan 213). A kana stem
    says nothing of the verb it belongs to: 毎日六時におきます is 起きる,
    "to get up", and UniDic reads おき as 置く, "to put" -- the dictation
    clip was glossed "poser" under a translation that says "I get up".
    The kanji tells them apart and the kana cannot, and UniDic's pick
    between them was wrong as often as not: 明日ははれる was 腫れる "to
    swell", ねるように 練る "to knead", 雨がふりました 振る "to wave",
    電車をおります 居る. Nor does the level decide: the lowest of them
    makes この薬はきかない 聞く "to hear" and 時間がたつ 立つ "to stand".

    So a token another deck verb could be spelled as has no card -- a
    missing meaning is a gap the learner can see, a false one is learned
    -- unless:

    - the other shares the hit's gloss: 上る and 登る are one word in two
      spellings;
    - the other is a rarer word than the hit, filed at a higher level: a
      page that writes かえります in kana means the N5 帰る, not the N2 反る
      "to warp", めがねをかける the N4 掛ける, not the N3 欠ける "to lack".
      A rival as plain as the hit or plainer is a coin toss UniDic lost
      as often as it won, and refuses it; the hit is kept or refused,
      never traded for a rival;
    - the hit is a kana-only card the page spells as the deck writes it:
      する, なる, かかる are words the deck writes in kana, and 為る,
      鳴る and 罹る are not what a page means by them."""
    spelled = _deck_verbs_spelled(m) if spelled is None else spelled
    if hit is None or not spelled:
        return hit
    _, entry, raw_id = hit
    if not entry.get("kanji") and any(r == raw_id for _, _, r in spelled):
        return hit
    words, rank = _gloss_words(entry), _level_rank(hit[0])
    if any(r != raw_id and not (words & _gloss_words(e)) and _level_rank(lv) <= rank
           for lv, e, r in spelled):
        return None
    return hit


_VOICED = str.maketrans("かきくけこさしすせそたちつてとはひふへほ", "がぎぐげござじずぜぞだぢづでどばびぶべぼ")


def _zuru(reading: str) -> str:
    """通ずる is 通じる, 感ずる 感じる: the literary ずる verb and its じる
    form are one word, which JMdict lists twice."""
    return reading[:-2] + "じる" if reading.endswith("ずる") else reading


def _read_otherwise(m, entry: dict) -> bool:
    """Whether the token is read as none of the card's readings and
    JMdict holds the page's spelling read that way as a word of its own
    (plan 151): 殺人罪's 罪 is ざい, not the つみ card; 研究所's 所 is しょ,
    not ところ; ３年's 年 is ねん, not とし; 取り分 is とりぶん, not とりわけ
    "especially". The pool's row for the pair answers instead. A reading
    the pool has no row for is the tokenizer's own slip more often than
    a word (下品 read げぼん, 皆 read かい), and the card stands.

    A card may be read voiced where the token is not, as a compound
    voices its second half (沿い read そい, the card ぞい), never the
    other way round: がち is not the かち card.

    A token UniDic calls a name is held to the same rule (plan 236): the
    pool's commonest row for a spelling is a guess, a card of the course
    is not, and where UniDic takes a course word for a name it is UniDic
    that misreads -- 大きな蓮の葉 is はす, the card, not Ren."""
    if _numeral(m.surface):
        return False
    card = {_zuru(morphology.kata_to_hira(r)) for r in _reading_variants(entry.get("kana") or "")}
    if not card:
        return False
    token = {_zuru(morphology.kata_to_hira(r)) for r in (m.lemma_reading, m.reading) if r}
    if token & card or {t.translate(_VOICED) for t in token if t} & card:
        return False
    form = _page_form(m) or m.lemma
    if not _has_kanji(form):
        return True                     # written in kana, read otherwise: another word
    return _pool_by_form(form, tuple(token), seen_kanji=False) is not None


def _kanji_head(text: str) -> str:
    head = ""
    for c in text:
        if not is_kanji(c):
            break
        head += c
    return head


def _page_form(m) -> str:
    """The token's dictionary form in the page's own kanji: UniDic files
    推し under 押す and 冒し under 犯す, and the page's word is 推す and
    冒す -- the page's kanji, then the lemma's okurigana. A word that
    does not inflect is its surface."""
    if m.pos not in ("verb", "adjective"):
        return m.surface
    written = morphology.written_form(m)
    if written and _has_kanji(written):
        # UniDic's own (plan 272): 突っ込み is 突っ込む, which the lemma's
        # okurigana (突き込む) would miss.
        return written
    head = _kanji_head(m.surface)
    return head + m.lemma[len(_kanji_head(m.lemma)):] if head else ""


def _another_word(m, entry: dict) -> dict | None:
    """The pool row for a token written in kanji the card is not spelled
    with, when JMdict holds the page's spelling as a word whose gloss
    shares nothing with the card's (plan 150) -- the card is then another
    word read the same way, not this one in another spelling. 推す is
    "to recommend", not 押す "to push"; 冒す "to brave", not 犯す "to
    commit"; 酔い "drunkenness", not the いい／よい card; 層 "layer", not
    the そう card. Where the spellings are one word (眼 and 目, 恐い and
    怖い, 沢山 and たくさん) the glosses meet, or JMdict files the spelling
    under the card's own entry and the pool, which is JMdict less the
    deck, has no row for it: the card stands."""
    written = {c for c in m.surface if is_kanji(c)}
    if not written or written <= set(entry.get("kanji") or ""):
        return None
    form = _page_form(m)
    if not form:
        return None
    row = _pool_by_form(form, (m.reading, m.lemma_reading), seen_kanji=False)
    if row is None or _row_gloss_words(row) & _gloss_words(entry):
        return None
    return row


def _glosses_meet(mine: set[str], theirs: set[str]) -> bool:
    """Whether two glosses share a word, an ending apart: "contact" and
    "contacting", "store" and "stores"."""
    return any(a == b or (min(len(a), len(b)) >= 4 and (a.startswith(b) or b.startswith(a)))
               for a in mine for b in theirs)


def _row_gloss_words(row: dict) -> set[str]:
    """Every sense of a pool row, not only the first its `meaning`
    carries: お陰 is "grace (of God)" first and "assistance" second, and
    the deck's お蔭 is "(your) backing, assistance"."""
    senses = jmdict_db.get_senses(row.get("kanji", ""), row.get("kana", "")) or []
    glosses = ", ".join(g for sense in senses for g in sense.get("glossary", []))
    return _gloss_words({"meaning": ", ".join(filter(None, (row.get("meaning", ""), glosses)))})


# The parts of speech a compound may be assembled from. Nouns, and the
# prefix and suffix UniDic cuts off them (お + 母 + さん, 二 + 日 where
# 日 is a suffix). Never a particle, never an auxiliary, never a verb:
# 今日 + は is two words whatever the deck holds, and a verb's lemma
# joined to a noun's spells nothing anybody reads.
_COMPOUND_POS = frozenset({"noun", "prefix", "suffix"})
_COMPOUND_MAX = 4          # (生 + 年 + 月 + 日 is 生年月日, plan 272)


_PHRASE_MAX = 4


def resolve_phrase(morphemes, i: int, max_len: int = _PHRASE_MAX):
    """(level, entry, raw_id, n) for a kana-only deck card that a whole
    clause of `n` morphemes from `i` spells, or None (plan 186d).

    A set phrase the deck teaches as one card arrives cut into a verb
    and its endings: すみません is 済む + ませ + ん, and the breakdown
    glossed it "to finish" under a sentence that apologises. The run is
    folded only where it stands alone -- the sentence's start or a mark
    before it, its end or a mark after it, or the が that joins it to the
    next clause (_joins_on) -- and holds a verb or an
    ending, and its letters are exactly a kana-only card's: so the
    しまった of 食べてしまった, the でも of 学校でも and a noun run (that is
    resolve_compound's) are never taken for one."""
    if i > 0 and morphemes[i - 1].pos != "symbol" and not _leads_in(morphemes, i) \
            and not _apologises_for(morphemes, i):
        return None
    longest = min(max_len, len(morphemes) - i)
    for n in range(longest, 1, -1):
        run = morphemes[i:i + n]
        if i + n < len(morphemes) and morphemes[i + n].pos != "symbol" and not _joins_on(morphemes, i + n) \
                and not _rounds_off(morphemes, i + n, run):
            continue
        # (A verb in auxiliary use may open it (plan 266): はじめまして is
        # 始める + ます + て, and 始める is a 〜はじめる to UniDic wherever it
        # stands. Its stand is what keeps 食べてしまった's しまった out.)
        if any(m.pos == "symbol" for m in run):
            continue
        if not any(m.pos in ("verb", "auxiliary") for m in run):
            continue
        surface = "".join(m.surface for m in run)
        surface = _PHRASE_SAID.get(surface, surface)
        for level, entry in _VOCAB_BY_KANA.get(surface, ()):
            if not entry.get("kanji") and entry.get("kana") == surface:
                return level, entry, vocab_to_id(entry, level), n
        if _hiragana(surface) and len(surface) >= 4 and run[0].pos == "adverb" \
                and i + n < len(morphemes) and morphemes[i + n].surface in "、，,":
            # (Or spelled in kanji the page does not write, opening on an
            # adverb and set off by a comma, plan 272: もし + か + し + て is
            # the N1 もしかして, "perhaps", which the deck spells 若しかして --
            # but そうして。 is "do so!", a request.)
            for level, entry in _VOCAB_BY_KANA.get(surface, ()):
                if surface in _reading_variants(entry.get("kana") or "") and not _verb_card(entry):
                    return level, entry, vocab_to_id(entry, level), n
    return None


# A set phrase as it is said, and the card it is (plan 272).
_PHRASE_SAID = {"すいません": "すみません", "すいませんでした": "すみませんでした"}

# What may stand before a set phrase in its own clause: the words that
# make an apology or a thanks deeper (本当にすみません, どうもありがとう).
_LEAD_INS = frozenset({"どうも", "大変", "たいへん", "誠に", "まことに", "本当", "ほんとう", "ほんと", "本と",
                       "とても", "ほんとに", "本当に", "ほんとうに", "重ね重ね", "かさねがさね"})


def _leads_in(morphemes, i: int) -> bool:
    """Whether a set phrase at morphemes[i] follows a word that only makes
    it deeper (_LEAD_INS), at the start of its clause: 本当にすみません,
    どうもありがとう -- never a clause that ends in it (食べてしまった)."""
    k = i - 1
    if morphemes[k].surface in ("ところ", "所") and morphemes[k].pos == "noun":
        return True                    # お忙しいところすみません
    if morphemes[k].surface == "に" and k >= 1 and morphemes[k - 1].surface in _LEAD_INS:
        k -= 1
    elif morphemes[k].surface not in _LEAD_INS:
        return False
    return k == 0 or morphemes[k - 1].pos == "symbol"


@lru_cache(maxsize=4096)
def is_a_word(surface: str) -> bool:
    """Whether a deck card or a JMdict row is written `surface` (plan
    272): 思わず and 絶えず are words of their own, 書かず is not."""
    for level, entry in _VOCAB_BY_KANA.get(surface, ()):
        if not entry.get("kanji"):
            return True
    for entry in _VOCAB_BY_LEMMA.get(surface, ()):
        if (entry[1].get("kanji") or "") == surface:
            return True
    return bool(jmdict_db.by_kanji(surface) if _has_kanji(surface) else jmdict_db.by_kana(surface))


def _apologises_for(morphemes, i: int) -> bool:
    """Whether an apology at morphemes[i] follows what it is for (plan
    272): 遅れてすみません, お手数をおかけしてすみません -- the reason's て --
    or an adverb that opens its clause, 突然すみません, いつもすみません
    (UniDic's いつ + も)."""
    if morphemes[i].surface not in ("すみ", "すい"):
        return False
    prev = morphemes[i - 1]
    if prev.pos == "particle" and prev.conjunctive and prev.surface in ("て", "で"):
        return True
    k = i - 1
    if prev.surface == "も" and i >= 2 and morphemes[i - 2].surface in ("いつ", "何度", "何回"):
        k = i - 2                      # いつもすみません, 何度もすみません
    elif prev.pos != "adverb":
        return False
    return k == 0 or morphemes[k - 1].pos == "symbol"


# The endings a set phrase may take and stay itself: すみません + でした,
# and the particles that close an utterance on it (すみませんね).
_CLOSING = frozenset({"ね", "よ", "ねえ", "ねー", "なあ", "な", "よね", "わ"})


def _rounds_off(morphemes, k: int, run) -> bool:
    """Whether what follows the run at morphemes[k] only rounds the set
    phrase off before the utterance ends: the でした of すみませんでした,
    a closing particle."""
    rest = list(morphemes[k:])
    if run[-1].surface == "ん" and len(rest) >= 2 and rest[0].surface == "でし" and rest[1].surface == "た":
        rest = rest[2:]
    while rest and rest[0].pos == "particle" and rest[0].surface in _CLOSING:
        rest = rest[1:]
    return len(rest) < len(morphemes) - k and (not rest or rest[0].pos == "symbol")


def _joins_on(morphemes, k: int) -> bool:
    """Whether morphemes[k] is the が or けど a set phrase joins the next
    clause with, before a mark (plan 266): すみませんが、駅はどこですか --
    the apology, then "but"."""
    m = morphemes[k]
    return (m.pos == "particle" and m.surface in ("が", "けど", "けれど", "けれども")
            and (k + 1 >= len(morphemes) or morphemes[k + 1].pos == "symbol"))


def resolve_compound(morphemes, i: int, max_len: int = _COMPOUND_MAX):
    """(level, entry, raw_id, n) for the deck entry that a run of `n`
    morphemes starting at `i` spells as ONE word, longest run first, or
    None when no run of two or more does.

    UniDic cuts to the short unit, so a compound the deck teaches as
    one card arrives as several morphemes: 日曜日 is 日曜 + 日, 誕生日
    is 誕生 + 日, お母さん is お + 母 + さん, 二日 is 二 + 日. Left as
    they are, the breakdown shows the halves -- 日曜 at N3 followed by
    日 at N4, when the sentence was chosen to teach the N5 word -- and
    a learner reading 日曜日 as two words has been taught something
    false. The run is looked up both by the surfaces joined and by the
    lemmas joined: a curated N5 sentence writes 曜 out as kana
    (日よう日) because the kanji is above the level, and only the
    lemmas (日曜 + 日) still spell the deck's word.

    The merged word's reading is the caller's to take from the ENTRY,
    not from the morphemes joined: 日曜 + 日 reads にちよう + ひ, and the
    compound reads にちようび. Rendaku and the counter readings (二日
    is ふつか, not ふた + か) are exactly what a per-morpheme reading
    cannot know.

    A run is only ever a noun and the affixes on it (_COMPOUND_POS) and
    never crosses a particle, so 今日 + は stays two words, and a token
    in auxiliary use (居る as 〜ている) is never part of one.
    """
    longest = min(max_len, len(morphemes) - i)
    for n in range(longest, 1, -1):
        run = morphemes[i:i + n]
        if any((m.pos not in _COMPOUND_POS and not _kanji_stem(m)) or m.auxiliary_use for m in run):
            continue
        joined_reading = "".join(m.reading for m in run)
        for key in ("".join(m.surface for m in run), "".join(m.lemma for m in run)):
            # The joined reading picks between entries that share the
            # written form (一日 is ついたち and いちにち, two cards): it
            # matches one of them exactly or, as for にちようび, none.
            hit = resolve_lemma(key, joined_reading)
            if hit and run[0].surface == "何" and joined_reading not in {
                    morphology.kata_to_hira(r) for r in _reading_variants(hit[1].get("kana") or "")}:
                # 何 and what it asks about, read as asked, are no word
                # spelled the same: 何分 read なんぷん, "how many minutes",
                # or なんぶん (何分の一), is not the N2 何分 read なにぶん,
                # "anyway" (plan 272).
                continue
            if hit:
                written = "".join(m.surface for m in run)
                level, entry, raw_id = _plainer_same_word(written, hit) if _hiragana(written) else hit
                return level, entry, raw_id, n
        joined = "".join(m.surface for m in run)
        if all(_katakana_written(m.surface) and not _has_kanji(m.surface) for m in run):
            # A loanword UniDic cut in two is the deck's word spelled so
            # (plan 272): ボール + ペン is ボールペン, "ballpoint pen".
            cards = [(lv, e) for lv, e in _VOCAB_BY_KANA.get(joined, ())
                     if not e.get("kanji") and joined in _reading_variants(e.get("kana") or "")]
            if cards:
                level, entry = min(cards, key=lambda c: _level_rank(c[0]))
                return level, entry, vocab_to_id(entry, level), n
        if len(joined) >= 3 and _hiragana(joined):
            # Written in kana, the run is the deck word spelled so (plan
            # 272): ご + ちそう + さま is the N2 ごちそうさま, お + かし the N5
            # お菓子 -- a polite prefix the card's own spelling opens with.
            cards = [(lv, e) for lv, e in _VOCAB_BY_KANA.get(joined, ())
                     if joined in _reading_variants(e.get("kana") or "") and not _a_verbs_card(e)
                     and (not e.get("kanji") or (run[0].pos == "prefix"
                                                and (e.get("kanji") or "").startswith(run[0].surface)))]
            if cards:
                level, entry = min(cards, key=lambda c: (bool(c[1].get("kanji")), _level_rank(c[0])))
                return level, entry, vocab_to_id(entry, level), n
    return None


def _kanji_stem(m) -> bool:
    """A な-adjective's stem in kanji, which a compound may open with:
    幼稚 + 園 is the N2 幼稚園, "kindergarten" (plan 272)."""
    return m.pos == "other" and bool(m.surface) and all(_has_kanji(c) for c in m.surface)


def _plainer_same_word(spelled: str, hit):
    """The deck card for the word `hit` is, filed at a lower level and
    spelled as the page spells it (kana), where there is one: ごちそう is
    the N4 ごちそう before the N2 御馳走, はじめから the N5 初め before the
    N1 始め (plan 272). The same word: their glosses meet."""
    if not hit[1].get("kanji"):
        return hit
    lower = [(lv, e) for lv, e in _VOCAB_BY_KANA.get(spelled, ())
             if _level_rank(lv) < _level_rank(hit[0]) and spelled in _reading_variants(e.get("kana") or "")
             and not _a_verbs_card(e) and _glosses_meet(_gloss_words(e), _gloss_words(hit[1]))]
    if not lower:
        return hit
    level, entry = min(lower, key=lambda c: _level_rank(c[0]))
    return level, entry, vocab_to_id(entry, level)


def compound_reading(entry: dict, morphemes) -> str:
    """The reading a merged compound is shown with: the deck entry's own
    (see resolve_compound), and where the entry lists several
    (まいげつ/まいつき), the one the tokenizer's own readings joined
    agree with, else the first."""
    joined = "".join(m.reading for m in morphemes)
    variants = [r.strip() for r in (entry.get("kana") or "").replace(";", "/").split("/") if r.strip()]
    if not variants:
        return joined
    return joined if joined in variants else variants[0]


# ── The JMdict pool, after the deck (plan 148) ─────────────────
# The deck is 8k words chosen for the JLPT; a subtitle or a photo of a
# page is written in the rest of the language as well. Until plan 148 a
# word the deck does not teach was a rule under a word and nothing else:
# no meaning, no card, no ＋ -- 桃源郷, 真っさら and さらば in one line of
# an anime's subtitles, while the pool beside the deck (212k JMdict
# words, content/vocab_jmdict_data.py) held all three. These resolvers
# are asked only once the deck's own (resolve_morpheme, resolve_compound)
# have answered None, so they can never move a word off its deck card.
#
# They are the breakdown's alone: level_mix, the reading badges and the
# audit keep resolve_morpheme's answer, since "off-deck" there means
# "not in the course", which a pool word still is.

# What a pool word may be. The content classes, plus the ones the deck
# rarely needs and a breakdown still wants glossed: "other" is UniDic's
# 形状詞 (真っさら, the stem of a な-adjective, which morphology does not
# map), an interjection is さらば, an adnominal 大きな. Never a particle,
# an auxiliary, a mark or a bare affix -- JMdict has entries for は and
# for さん, and neither is a word of the sentence the way a noun is.
_POOL_POS = frozenset({
    "noun", "pronoun", "verb", "adjective", "adverb",
    "other", "interjection", "adnominal", "conjunction",
})


def _has_kanji(text: str) -> bool:
    return any(is_kanji(c) for c in text)


def _japanese(text: str) -> bool:
    """Whether a token is written in kana or kanji at all: a number or a
    Latin word in a subtitle is not something JMdict is asked about."""
    return any(is_kanji(c) or "ぁ" <= c <= "ヿ" for c in text)


_NUMERALS = frozenset("〇一二三四五六七八九十百千万億兆0123456789０１２３４５６７８９")


def _numeral(text: str) -> bool:
    return bool(text) and all(c in _NUMERALS for c in text)


def _to_katakana(text: str) -> str:
    return "".join(chr(ord(c) + 0x60) if "ぁ" <= c <= "ゖ" else c for c in text)


def _pool_by_form(written: str, readings: tuple[str, ...], seen_kanji: bool = True,
                  shared: bool = False) -> dict | None:
    """The pool row for one written form, given the readings it may
    have (the dictionary form's, the page's).

    A form with a kanji in it: the pair exactly; else a row read one of
    those ways that shares a kanji with it -- UniDic files ぶっ殺す under
    打ち殺す, and the row read ぶっころす is ぶっ殺す, "to kill", where
    打ち殺す's own row is うちころす, "to beat to death" (a verb's or an
    adjective's lemma only, `shared`: a noun's spelling IS its word, and
    二十 read にじゅう shares a kanji and a reading with 二重, "double");
    else, where the
    page itself wrote a kanji (`seen_kanji`), that spelling's commonest
    row, since a kanji spelling names its word far more narrowly than a
    reading does and UniDic's reading of a lone kanji is not always
    JMdict's. A page that wrote the word in kana showed no spelling to
    trust that far: only UniDic's lemma, which can be a spelling nobody
    uses.

    A form written in kana alone matches a kana-only row and nothing
    else. Never the one row read that way: the pool is JMdict LESS the
    deck, so a reading with one row in the pool is not a reading with
    one word -- その's own entries are the deck's, and the pool's one
    row read その is 苑, "garden"; あんな's is the Anna era."""
    if not written:
        return None
    readings = tuple(r for r in dict.fromkeys(readings) if r)
    if _has_kanji(written):
        for reading in readings:
            hit = jmdict_db.get_by_key(written, reading)
            if hit is not None:
                return hit
        chars = {c for c in written if is_kanji(c)}
        for reading in readings if shared else ():
            for row in jmdict_db.by_kana(reading):
                if chars & set(row["kanji"]):
                    return row
        if not seen_kanji:
            return None
        rows = jmdict_db.by_kanji(written, limit=1)
        return rows[0] if rows else None
    if any(c.isascii() and c.isalpha() for c in written):
        return latin_row(written)           # Uターン, Tシャツ (plan 272)
    for kana in dict.fromkeys((written, _to_katakana(written))):
        hit = jmdict_db.get_by_key("", kana)
        if hit is not None:
            return hit
    if _katakana_written(written) and 2 <= len(written) <= 3:
        # (A short loanword JMdict files under its Latin letters: オフ ＯＦＦ,
        # オン ＯＮ, plan 272 -- never a name, エリック, read as an acronym.)
        hit = next((row for row in jmdict_db.by_kana(written, limit=4)
                    if row.get("kanji") and all("\uff21" <= c <= "\uff5a" for c in row["kanji"])), None)
        if hit is not None:
            return hit
    if len(written) >= 3 and written.endswith("ー") and "ー" not in written[:-1] and _katakana_written(written):
        # (A loanword's last long vowel the pool writes as a vowel: プレー
        # is its プレイ, エッセー its エッセイ, plan 272 -- never one inside a
        # name, グレース, nor a clipped word, ホラゲー's ゲー.)
        voweled = _long_e_o(written)
        if voweled != written:
            return jmdict_db.get_by_key("", voweled)
    return None


_E_ROW_KATAKANA = set("エケゲセゼテデネヘベペメレ")
_O_ROW_KATAKANA = set("オコゴソゾトドノホボポモヨロョ")


def _long_e_o(word: str) -> str:
    """プレー → プレイ, ボーイ stays: ー after an e-row letter as イ, after an
    o-row one as ウ."""
    out = []
    for k, c in enumerate(word):
        prev = word[k - 1] if k else ""
        out.append("イ" if c == "ー" and prev in _E_ROW_KATAKANA else "ウ" if c == "ー" and prev in _O_ROW_KATAKANA else c)
    return "".join(out)


# The senses an affix is used in, by the part of speech UniDic gives it.
_AFFIX_TAGS = {"suffix": frozenset({"suf", "n-suf", "ctr"}), "prefix": frozenset({"pref", "n-pref"})}


def _pool_affix(m, before=None, after=None) -> dict | None:
    """The pool row for a suffix or a prefix written in kanji, read as
    the page reads it -- 三人's 人 read にん, "counter for people"; 政治家's
    家 read か, "-ist" -- with the meaning of the sense JMdict tags as an
    affix, or None where it tags none (plan 151). An affix is a sense of
    a word, never the word's first sense by right: 水 read すい is
    "Wednesday" first, and no gloss is better than that under 化粧水."""
    written = m.surface
    if (m.pos == "suffix" and _hiragana(m.surface) and m.lemma in _PRODUCTIVE_SUFFIXES
            and len(m.lemma) == 1):
        # The suffixes that go on any noun, written in kana (plan 266):
        # 子どもたち's たち is 達, "pluralizing suffix", 彼ら's ら 等. No
        # other kana suffix: the しょ of じ + しょ is a dictionary the
        # tokenizer cut in two, not 薯, "potato".
        written = m.lemma
    if not _has_kanji(written) or _numeral(written):
        return None
    # An affix goes on a word: a suffix after a noun (a counter after a
    # number), a prefix before one. 一軒家's 家 after the counter 軒 is
    # read や, and "-ist" would be a guess at the tokenizer's reading.
    if m.pos == "suffix":
        counted = before is not None and (_numeral(before.surface) or before.lemma in ("何", "数", "幾"))
        tags = _AFFIX_TAGS["suffix"] if counted else _AFFIX_TAGS["suffix"] - {"ctr"}
        if before is None or not (counted or before.pos in ("noun", "pronoun")):
            return None
    else:
        tags = _AFFIX_TAGS["prefix"]
        if after is None or after.pos not in ("noun", "suffix"):
            return None
    for reading in dict.fromkeys(r for r in (m.reading, m.lemma_reading) if r):
        row = jmdict_db.get_by_key(written, morphology.kata_to_hira(reading))
        if row is None:
            continue
        for sense in jmdict_db.get_senses(row.get("kanji", ""), row.get("kana", "")) or []:
            if tags & set(sense.get("tags") or ()) and sense.get("glossary"):
                return {**row, "meaning": ", ".join(sense["glossary"][:2]), "affix": True}
        return None
    return None


# What a word's first sense is said with, which its gloss carries (plan
# 272): JMdict's derogatory and vulgar tags.
_REGISTER_NOTES = (("vulg", "vulgar"), ("derog", "contemptuous"))
# What no gloss gives as a word's second sense (pool_gloss, plan 272).
_SEXUAL = re.compile(r"\b(rape|sex|sexual|intercourse|penis|vagina|genitals?|masturbat\w*|prostitut\w*|orgasm|"
                     r"semen|ejaculat\w*|pubic|porn\w*|erotic|copulat\w*)\b", re.IGNORECASE)


def pool_gloss(row: dict, senses: int = 3) -> str:
    """A pool word's line in the breakdown: the first gloss of each of
    its first senses, not the first sense alone -- 盛り read もり is
    "serving (of food)" first and "pile, heap" after, 物 read ぶつ
    "stock" first and "goods" after, and the sentence may use either
    (plan 151). An affix row keeps the one sense it was chosen for."""
    if row.get("affix"):
        return row.get("meaning", "")
    glosses = []
    found = jmdict_db.get_senses(row.get("kanji", ""), row.get("kana", "")) or []
    for sense in found[:senses]:
        # (an example's aside is the entry's to give, so a second sense
        # fits: 段差 is "difference in grades; difference in level", plan 272)
        first = _ASIDE.sub("", next(iter(sense.get("glossary") or ()), "")).strip()
        if not first or first in glosses:
            continue
        if glosses and _OUT_OF_USE & set(sense.get("tags") or ()):
            # Never a sense past use after the word's own: まじ is
            # "serious", and its archaic auxiliary "cannot" is the
            # entry's to list (plan 272).
            continue
        if glosses and _SEXUAL.search(first):
            # Nor a sexual sense set beside the word's own as an aside:
            # 回し on a sumo line is "mawashi; mantle", JMdict's third
            # sense is the entry's to list (plan 272) -- the French line
            # never had it.
            continue
        if glosses and len("; ".join(glosses + [first])) > _POOL_GLOSS_MAX:
            break
        register = next((note for tag, note in _REGISTER_NOTES if tag in (sense.get("tags") or ())), "")
        # (貴様 is "you (contemptuous)", never a bare "you", plan 272)
        glosses.append(f"{first} ({register})" if register and not glosses else first)
    if len(found) == 1 and len(glosses) == 1:
        # (one sense, its second gloss: 勤怠 is "diligence and indolence;
        # attendance and absence (at work)", plan 272)
        second = _ASIDE.sub("", next(iter((found[0].get("glossary") or ())[1:2]), "")).strip()
        if second and len("; ".join(glosses + [second])) <= _POOL_GLOSS_MAX:
            glosses.append(second)
    return "; ".join(glosses) or row.get("meaning", "")


# A breakdown row is one line: past this, a later sense waits for the
# entry, which lists them all.
_POOL_GLOSS_MAX = 60
# An example JMdict gives in brackets: "(e.g. in go, shoji, etc.)".
_ASIDE = re.compile(r"\s*\(e\.g\.[^)]*\)")
# JMdict's tags for a sense out of use: archaic, obsolete.
_OUT_OF_USE = frozenset({"arch", "obs"})


def resolve_pool_morpheme(morphemes, i: int) -> dict | None:
    """The JMdict pool entry morphemes[i] is, by its dictionary form
    first and as written second, or None. Asked only for a token the
    deck has no card for (see the note above)."""
    m = morphemes[i]
    if m.surface == "付" and m.pos == "suffix" and morphology.kata_to_hira(m.reading) == "づけ":
        return jmdict_db.get_by_key("付け", "づけ")          # 本日付で, "dated" (plan 272)
    if m.pos in _AFFIX_TAGS:
        return _pool_affix(m, morphemes[i - 1] if i > 0 else None,
                           morphemes[i + 1] if i + 1 < len(morphemes) else None)
    if m.surface == "それがし" and m.pos == "pronoun":
        return None                        # (a samurai's "I", glossed, plan 272)
    if m.surface == "ナシ" and any(u.surface == "アリ" for u in morphemes):
        return None
    degree = _a_degree_noun(morphemes, i)
    if degree is not None:
        return degree                      # 外角低め、ストライク: "lowish", no 低める (plan 272)
    if m.surface == "ツー" and not any(u.surface in ("トン", "トンツー") for u in morphemes):
        return jmdict_db.get_by_key("２", "ツー")             # ツーランホームラン: "two", no Morse's dash (plan 272)
    if m.surface == "アリ" and m.lemma == "有り" and m.pos == "noun":
        from study import particle_glosses
        if particle_glosses.fair_option(morphemes, i):
            return None                    # (十分アリだ: "fair", glossed, plan 272)
        return jmdict_db.get_by_key("蟻", "あり")            # あ、アリだ！: an ant, written as animals are
    spare = resolve_spare_moment(morphemes, i)
    if spare is not None:
        return spare                       # お手すきの際に (plan 272)
    if _a_knob(morphemes, i):
        return None                        # (nor the pool's 欠け, "fragment")
    if m.surface == "連れ込み" and m.pos == "noun":
        return jmdict_db.get_by_key("連れ込む", "つれこむ")   # ペットの連れ込み: bringing in (plan 272)
    if m.surface == "なして" and m.pos == "adverb":
        return None                        # (the north's "why?", glossed; no 為す's "forming")
    if m.pos == "verb" and i + 1 < len(morphemes) and morphemes[i + 1].surface == "て" and _has_kanji(m.surface) \
            and jmdict_db.has_form(m.surface + "て"):
        row = jmdict_db.get_by_key(m.surface + "て", morphology.kata_to_hira(m.reading) + "て")
        if row is not None:
            return row                     # 折り入って, "earnestly": the pool's adverb (plan 272)
    if m.lemma == "泥濘む":
        return jmdict_db.get_by_key("", "ぬかるむ")          # ぬかるんどる, "is muddy" (plan 272)
    if m.surface in ("あんた", "アンタ", "いかん") or (m.surface == "よう" and m.pos == "adverb" and m.lemma == "良く"):
        return None                        # (あんた, いかん, the west's よう: glossed, plan 272)
    if _a_gap_left(morphemes, i):
        return jmdict_db.get_by_key("空ける", "あける")      # (6時間以上あけて: leave a gap)
    if (m.surface in _NAMED_HERE or m.name_kind in ("business", "vessel")) and m.proper:
        return None                        # (中央線 is no "centerline (road)", さくら旅館 no 桜)
    if m.surface in ("ちょうちょ", "ちょうちょう") and m.pos == "noun":
        return jmdict_db.get_by_key("蝶々", "ちょうちょう")   # こいぬはちょうちょを (plan 272)
    if m.pos == "adnominal" and m.surface in ("そういう", "こういう", "ああいう", "どういう"):
        return jmdict_db.get_by_key(m.surface[:-2] + "言う", m.surface)   # そういう人, "such" (plan 272)
    if m.lemma in ("驕る", "傲る", "奢る") and not _has_kanji(m.surface):
        return jmdict_db.get_by_key("奢る", "おごる")
    if m.surface == "いっぺん":
        return jmdict_db.get_by_key("一遍", "いっぺん")
    if m.surface == "しかと" and m.pos == "adverb":
        return jmdict_db.get_by_key("確と", "しかと")   # しかと聞き届けた, no シカト
    if m.surface == "サビ" and any(u.surface in ("曲", "歌", "聴", "歌詞", "イントロ", "メロディー", "ボーカル", "部分")
                                   for u in morphemes):
        return jmdict_db.get_by_key("", "サビ")
    if m.surface == "かたっぽ":
        return jmdict_db.get_by_key("片っぽ", "かたっぽ")
    if m.lemma == "亀" and m.surface == "かめ":
        return jmdict_db.get_by_key("亀", "かめ")       # うさぎとかめ
    if m.surface == "ワン" and i + 1 < len(morphemes) and _katakana_written(morphemes[i + 1].surface) \
            and morphemes[i + 1].start == m.end:
        return None                                   # ワンサイズ: "one", glossed
    if m.surface == "ワン" and any(u.surface in ("ツー", "スリー", "フォー") for u in morphemes):
        return jmdict_db.get_by_key("１", "ワン")             # ワン、ツー、スリー: counted, no "woof" (plan 272)
    if m.surface.startswith("ウケ") and m.lemma in ("受ける", "請ける"):
        return None                        # ウケる: "that's hilarious", glossed (plan 272)
    if m.surface in ("てめえ", "てめー", "てめぇ"):
        # "You", said to pick a fight: JMdict's 手前 read てめえ (plan 272).
        return jmdict_db.get_by_key("手前", "てめえ")
    if m.pos in _POOL_POS and _LATIN_WORD.fullmatch(m.surface) and not (
            i > 0 and morphemes[i - 1].surface[-1:].isdigit()):
        # SNS, AI, BGM: JMdict writes them in full width (plan 272).
        return latin_row(m.surface)
    if m.pos not in _POOL_POS or not _japanese(m.surface) or _numeral(m.surface):
        # A number is the deck's to read (its numeral compounds).
        return None
    if m.unknown and _hiragana(m.surface):
        # Letters the tokenizer could make no word of, read back as one
        # (morphology._unknown_words, _kana_names): most often a name, and
        # a pool row spelled so is another word (たろう, "ought to have been").
        return None
    if m.unknown and m.proper and not _has_kanji(m.surface):
        # A name the sentence's context gives (morphology._introduced,
        # _names_kept) is the name: カイト introducing himself is no
        # "kite" (plan 272). One UniDic only tags so keeps its row, which
        # the breakdown names both ways (analysis._name_or_word).
        return None
    previous = morphemes[i - 1] if i > 0 else None
    if m.auxiliary_use and previous is not None and previous.pos == "particle" and previous.conjunctive:
        # ている, てしまう: the grammar point's, as resolve_morpheme says.
        return None
    if _deck_verbs_spelled(m):
        # A kana verb a deck verb could be spelled as, and the deck path
        # gave no card: two deck verbs share its stem (plan 213), or
        # UniDic read it as a word the deck does not hold and the deck's
        # own reads the same. The pool's guess is no better.
        return None
    lemma = m.lemma or m.surface
    if not _has_kanji(lemma) and len(lemma) < 2:
        # One kana on its own is a particle mis-tagged or a letter.
        return None
    if m.proper and _has_kanji(m.surface) and m.name_kind in ("family", "given", "person") \
            and _a_persons_name(morphemes, i):
        # A person's name is no common word the dictionary spells alike:
        # 中島 who heads the ball is Nakajima, no "island in a pond" --
        # JMdict holds no one's name (plan 272).
        return None
    if m.proper and _has_kanji(m.surface):
        # A name: only a row read as the page reads it is its word (香港,
        # whose row is read ホンコン; 太郎). The spelling's commonest row
        # is another word read otherwise -- JMdict files almost no names,
        # so 博 read ひろし, Hiroshi, took 博 read はく, "doctor"; 山下 read
        # やました took さんか, "foot of a mountain" (plan 236).
        return _pool_by_form(m.surface, (m.reading, m.lemma_reading, _to_katakana(m.reading)),
                             seen_kanji=False)
    inflects = m.pos in ("verb", "adjective")
    written = {c for c in m.surface if is_kanji(c)}
    page = morphology.written_form(m)
    respelled = bool(written) and written <= set(lemma) and page and page != lemma and _has_kanji(page)
    if respelled:
        as_read = _pool_by_form(lemma, (m.reading, m.lemma_reading), _has_kanji(m.surface), shared=True)
        if as_read is not None and morphology.kata_to_hira(as_read.get("kana") or "") == morphology.kata_to_hira(m.reading):
            return as_read
    if written and (not written <= set(lemma) or respelled):
        # The page's own spelling first, where UniDic files the word
        # under other kanji (推し under 押す): the row for 推す is the
        # word on the page (plan 150).
        form = _page_form(m)
        hit = _pool_by_form(form, (m.reading, m.lemma_reading), seen_kanji=False) if form else None
        if hit is not None:
            return hit
    # The page's reading first: for a word in its dictionary form it is
    # the word as said (ぶっころす), where UniDic's lemma reading is its
    # citation (ぶちころす); for an inflected one it matches nothing and
    # the lemma's reading answers.
    hit = _pool_by_form(lemma, (m.reading, m.lemma_reading), _has_kanji(m.surface), shared=inflects)
    if hit is None and m.surface != lemma and not inflects:
        # A word UniDic files under another spelling than the page's
        # (a loanword's lemma, a variant kanji): the page's own form. A
        # verb's surface is inflected and names no headword.
        hit = _pool_by_form(m.surface, (m.reading,))
    if (hit is None and m.pos == "noun" and not m.proper and not m.unknown and _katakana_written(m.surface)
            and _has_kanji(lemma)):
        # A plant or an animal written in katakana, as they are, whose
        # row JMdict keeps in hiragana: インコ, UniDic's 鸚哥, is the row
        # いんこ (plan 272).
        hit = jmdict_db.get_by_key("", morphology.kata_to_hira(m.surface))
    if hit is not None and not inflects and not _has_kanji(m.surface):
        # Written in kana and not inflected, the page spells the word's
        # reading outright, and a row read otherwise is UniDic's guess
        # at a word it does not know: まじか (slang, "seriously?") comes
        # back as 間近, read まぢか, "near".
        spelled = morphology.kata_to_hira(m.surface)
        drawn = _said_as(spelled) if (any(c in _DRAWN_OUT for c in m.surface)
                                      or any(c in _SMALL_VOWELS for c in spelled)) else ()
        if morphology.kata_to_hira(hit["kana"]) not in (spelled, *drawn):
            # (A word drawn out in speech is the word it draws out:
            # ただいまー is ただいま, plan 272. Never one cut short: ガシッ is
            # no がし.)
            # The page's kana spells a word JMdict writes so (plan 272):
            # ありったけ, where UniDic's lemma 有り丈 reads ありたけ; めっちゃ,
            # never 目茶 read めちゃ.
            own = _pool_by_form(m.surface, (m.reading,)) if m.surface != lemma and len(m.surface) >= 2 else None
            if own is not None and morphology.kata_to_hira(own["kana"]) in (spelled, *drawn):
                return own
            return _pool_by_kana_alone(m)
    if hit is None and not inflects:
        hit = _pool_by_kana_alone(m)
    if hit is None and not m.proper and not m.unknown:
        # The word as JMdict spells it otherwise (plan 272): 気合い 気合,
        # ごみ袋 ゴミ袋, なまけ者 怠け者, 青痣 青あざ; a verb by its lemma.
        hit = _variant_row(lemma if inflects else m.surface, m.lemma_reading if inflects else m.reading)
    if hit is None and m.pos == "verb" and _has_kanji(lemma):
        # A potential UniDic files as a verb of its own (断ち切れる): the
        # verb it is the potential of, as the deck's lookups read 書ける.
        base, said = _potential_base(lemma), _potential_base(m.lemma_reading)
        if base and said:
            hit = jmdict_db.get_by_key(base, said)
    return hit


_E_TO_U = dict(zip("えけげせてねべめれ", "うくぐすつぬぶむる"))


def _potential_base(lemma: str) -> str:
    """The godan verb a potential lemma is made of: 断ち切れる 断ち切る,
    書ける 書く; "" for any other."""
    if len(lemma) < 3 or not lemma.endswith("る") or lemma[-2] not in _E_TO_U:
        return ""
    return lemma[:-2] + _E_TO_U[lemma[-2]]


def _variant_row(written: str, reading: str) -> dict | None:
    """The one pool row read as the page reads `written` whose kanji are
    the page's, in order, where the two differ only in what one writes
    in kana (plan 272): okurigana (気合い, 気合; 肩書き, 肩書), the kana's
    script (ごみ袋, ゴミ袋; ため口, タメ口), a kanji the page or JMdict
    writes in kana (なまけ者, 怠け者; 青痣, 青あざ; 多め, 多目 -- never
    大目, whose 大 the page did not write). A spelling with other kanji
    (髪型, 髪形) is another word as far as the letters can tell."""
    reading = morphology.kata_to_hira(reading or "")
    mine = [c for c in written if is_kanji(c)]
    if not mine or len(written) < 2 or len(reading) < 2:
        return None
    found = []
    for row in jmdict_db.by_kana(reading):
        if morphology.kata_to_hira(row.get("kana") or "") != reading or not row.get("kanji"):
            continue
        theirs = [c for c in row["kanji"] if is_kanji(c)]
        if theirs and (theirs == mine or _in_order(mine, theirs) or _in_order(theirs, mine)):
            found.append(row)
    return found[0] if len(found) == 1 else None


def _in_order(few: list, many: list) -> bool:
    """Whether `few` is `many` with some of its letters left out."""
    if len(few) >= len(many):
        return False
    it = iter(many)
    return all(c in it for c in few)


_LATIN_WORD = re.compile(r"[A-Za-z][A-Za-z0-9&+.\-]*")


def _full_width(text: str) -> str:
    return "".join(chr(ord(c) + 0xFEE0) if "!" <= c <= "~" else c for c in text)


def latin_row(written: str) -> dict | None:
    """The pool row JMdict writes `written`'s Latin letters in, in full
    width (plan 272): SNS ＳＮＳ, BGM ＢＧＭ, Uターン Ｕターン, Tシャツ Ｔシャツ.
    None for one letter alone (M, L, W: a size or a unit, read beside what
    it measures) and for laughter typed as w."""
    letters = [c for c in written if c.isascii() and c.isalpha()]
    if not letters or len(written) < 2 or all(c in "wW" for c in letters):
        return None
    wide = _full_width(written)
    for form in dict.fromkeys((wide, wide.replace("－", "-"))):
        # (JMdict writes Wi-Fi's hyphen as it is: Ｗｉ-Ｆｉ, plan 272)
        hit = next((row for row in jmdict_db.by_kanji(form, limit=4) if row.get("kanji") == form), None)
        if hit is not None:
            return hit
    return None


def _pool_by_kana_alone(m) -> dict | None:
    """The pool row a noun written in hiragana is where UniDic files it
    under a spelling JMdict lists second (plan 272): えび is UniDic's 蝦
    and JMdict's 海老, ふるさと 古里 and 故郷, あげく 挙げ句 and 挙句 --
    and the breakdown had no meaning for them. Only where nothing else
    is read so: no deck card (_VOCAB_BY_KANA, the deck is JMdict's other
    half) and one common row (⭐) in the pool, or of several, the one
    spelled with a kanji of UniDic's lemma (いつごろ, いつ頃 and 何時頃)."""
    spelled = m.surface
    if (m.pos not in ("noun", "adverb", "pronoun", "interjection") or m.proper or len(spelled) < 2
            or not _hiragana(spelled) or _VOCAB_BY_KANA.get(spelled)):
        return None
    if m.pos in ("pronoun", "interjection"):
        # (A pronoun or an exclamation is the one row read so and tagged
        # as one, that JMdict writes in kana: わし is 儂, "I", never 鷲,
        # "eagle"; しっ 叱, "shh!".)
        tag = "pn" if m.pos == "pronoun" else "int"
        rows = [row for row in jmdict_db.by_kana(spelled) if row["kana"] == spelled and {tag, "uk"} <= {
            t for sense in jmdict_db.get_senses(row.get("kanji", ""), spelled) or [] for t in sense.get("tags") or ()}]
        return rows[0] if len(rows) == 1 else None
    # (Or as UniDic spells it, a loanword the page wrote in hiragana:
    # ぎょうざ is its ギョーザ, JMdict's 餃子 read ギョーザ.)
    forms = [spelled] + ([m.lemma] if _katakana_written(m.lemma) and not _has_kanji(m.lemma) else [])
    common = [row for form in forms for row in jmdict_db.by_kana(form)
              if row["kana"] == form and any(
                  "⭐" in (sense.get("term_tags") or ())
                  for sense in jmdict_db.get_senses(row.get("kanji", ""), row.get("kana", "")) or [])]
    lemma = {c for c in m.lemma if is_kanji(c)}
    alone = [row for row in jmdict_db.by_kana(spelled) if row["kana"] == spelled]
    if len(alone) == 1 and len(common) == 1 and alone[0]["id"] == common[0]["id"] \
            and m.pos == "noun" and "uk" in {t for sense in jmdict_db.get_senses(common[0].get("kanji", ""), spelled)
                                            or [] for t in sense.get("tags") or ()}:
        # (The one row read so at all, a common word JMdict writes in
        # kana: いじめ is 虐め, "bullying", whatever kanji UniDic files it
        # under, 苛め.)
        return common[0]
    common = [row for row in common if _same_word_as_lemma(m, lemma, row)]
    if len(common) == 1:
        return common[0]
    shared = [row for row in common if lemma & set(row.get("kanji") or "")]
    if not common:
        # (No common row read so: the one that shares a kanji with UniDic's
        # lemma -- かくれんぼ is its 隠れん坊, JMdict's 隠れんぼ, plan 272.)
        shared = [row for row in alone if lemma & set(row.get("kanji") or "")]
    return shared[0] if len(shared) == 1 else None


def _same_word_as_lemma(m, lemma: set, row: dict) -> bool:
    """Whether a pool row read as the page is the word UniDic named: it
    shares a kanji with UniDic's lemma (挙げ句, 挙句), or JMdict writes it
    in kana as a rule and the lemma's kanji mean what it does (蝦,
    "shrimp", and 海老 read えび) -- never 蟻, "ant", for UniDic's 有り, the
    classical "there is" (猫に九生あり). An adverb (ふわ) is no word spelled
    in kanji JMdict does not write it in kana."""
    tags = {t for sense in jmdict_db.get_senses(row.get("kanji", ""), row.get("kana", "")) or []
            for t in sense.get("tags") or ()}
    if m.pos == "adverb":
        return not row.get("kanji") or "uk" in tags
    if not lemma or lemma & set(row.get("kanji") or ""):
        return True
    if "uk" not in tags:
        return False
    from content.kanji_meanings import get_kanji_meaning
    meant = _gloss_words({"meaning": "; ".join(get_kanji_meaning(c) for c in lemma)})
    return _glosses_meet(meant, _row_gloss_words(row))


# The suffixes that go on any noun and make no new word of it: 人 + 達
# is 人 said of several, and folding it would take 人's N5 card away.
_PRODUCTIVE_SUFFIXES = frozenset("達等共方様君殿氏")

# A word-forming suffix a first-year page writes in kana (plan 274): the
# shop's 屋 in パンや and くつや, read so by morphology._shops.
_KANA_WORD_FORMING = frozenset({"屋", "焼き"})   # (焼き: たまごやき, たこやき, plan 272)


def _word_forming(m) -> bool:
    """A suffix in kanji that makes a word of the noun before it (者,
    家, 所, 書), as opposed to one that goes on any noun (達, 様); or
    one of them written in kana (_KANA_WORD_FORMING)."""
    return m.pos == "suffix" and (
        (_has_kanji(m.surface) and not any(c in _PRODUCTIVE_SUFFIXES for c in m.surface))
        or m.lemma in _KANA_WORD_FORMING)


# The sound changes a compound makes of its second word, undone: 時計 in
# 腕時計 is どけい, 相撲 in 大相撲 ずもう.
_UNVOICED = str.maketrans("がぎぐげござじずぜぞだぢづでどばびぶべぼぱぴぷぺぽっ",
                          "かきくけこさしすせそたちつてとはひふへほはひふへほつ")


def _kana_key(text: str) -> str:
    """Kana compared as written: katakana as hiragana, its ー kept."""
    return "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in text)


def _an_affix_card(entry: dict) -> bool:
    meaning = entry.get("meaning") or ""
    return "suffix" in meaning or "counter" in meaning or meaning.startswith(("-", "~", "〜"))


def _read_apart_wrongly(run, hits) -> dict | None:
    """The pool word a run spells where the deck has a card for each of
    its parts and the cards say nothing of it (plan 272): a loanword
    UniDic cut in two (スマート + フォン, スマートフォン), or one joined to a
    native word -- 段 + ボール is 段ボール, "cardboard", no "step" and
    "ball". Where a part's card says what the word does, the cards stay
    (チーズ + ケーキ, テレビ + 番組), as two cards in kanji always do --
    電話 + 番号, 鉄道 + 会社, whose sound change compound_tail_readings
    reads over the second card: a sentence written for its level counts
    them (the reading bank)."""
    if any(m.pos not in ("noun", "prefix", "suffix", "other") or m.auxiliary_use or m.proper or m.name_kind
           or _numeral(m.surface) for m in run):
        return None
    if not any(_katakana_written(m.surface) and not _has_kanji(m.surface) for m in run):
        return None
    written = "".join(m.surface for m in run)
    if all(_katakana_written(m.surface) and not _has_kanji(m.surface) for m in run):
        row = jmdict_db.get_by_key("", written)
    else:
        # (A loanword's part is read as written: UniDic reads ボール ぼうる.)
        reading = "".join(_kana_key(m.surface) if _katakana_written(m.surface)
                          else morphology.kata_to_hira(m.reading) for m in run)
        rows = [r for r in jmdict_db.by_kanji(written, limit=8)
                if _kana_key(r["kana"]).translate(_UNVOICED) == reading.translate(_UNVOICED)]
        row = rows[0] if len(rows) == 1 else None
    if row is None or any(isinstance(hit, tuple) and _glosses_meet(_row_gloss_words(row), _gloss_words(hit[1]))
                          for hit in hits):
        return None
    return row


def _read_otherwise_whole(run) -> dict | None:
    """The pool word two nouns in kanji spell where the word is read
    otherwise than its parts (plan 272): 光 + 合成 is 光合成, こうごうせい,
    "photosynthesis", and no ひかり; 土俵 + 際 is 土俵際, どひょうぎわ, "the
    edge of the ring", and no さい "occasion". A part read so is another
    word than its card, and the furigana over it was wrong. Read alike
    but for a voiced or doubled letter where they meet (電話 + 番号, 学 +
    校), the cards stay -- compound_tail_readings voices the second."""
    if len(run) != 2 or any(m.pos not in ("noun", "suffix") or m.auxiliary_use or m.proper or m.name_kind
                            or _numeral(m.surface) or not all(is_kanji(c) for c in m.surface) for m in run):
        return None
    if run[0].pos == "suffix":
        return None                     # (日本 + 海 + 側: 海 is 日本海's, no 海側 "seaward", plan 272)
    written = "".join(m.surface for m in run)
    first, second = (morphology.kata_to_hira(m.reading) for m in run)
    rows = [r for r in jmdict_db.by_kanji(written, limit=8) if r.get("kanji") == written]
    if len(rows) != 1:
        return None
    if any("suf" in (sense.get("tags") or ()) for sense in jmdict_db.get_senses(written, rows[0].get("kana", "")) or []):
        return None                     # (奴等 read めら, a suffix's row: no word for 奴 + 等)
    whole = morphology.kata_to_hira(rows[0].get("kana") or "")
    if not whole or whole.translate(_UNVOICED) == (first + second).translate(_UNVOICED):
        return None
    if whole.translate(_UNVOICED).endswith(second.translate(_UNVOICED)) and \
            whole[:len(whole) - len(second)].translate(_UNVOICED)[:-1] == first.translate(_UNVOICED)[:-1] and \
            len(whole) - len(second) == len(first):
        return None                     # (学 + 校, がっこう: the joint doubled)
    return rows[0]


def compound_tail_readings(morphemes, deck_hits: list) -> dict[int, str]:
    """{index: reading} for the second of two deck words the pool holds
    as one word with a sound change their own readings lack (plan 272):
    腕 + 時計 is うでどけい, so 時計 is read どけい there; 鉄道 + 会社
    がいしゃ; 大 + 相撲, a prefix and a card, おおずもう. Both cards stay; only the reading over the second is the
    word's. A voiced letter for a plain one, never one voiced for
    another: 何分 なんぶん is no なんぷん."""
    out = {}
    for i in range(len(morphemes) - 1):
        a, b = morphemes[i], morphemes[i + 1]
        if not (a.pos in ("noun", "prefix") and b.pos in ("noun", "suffix") and (deck_hits[i] or a.pos == "prefix")
                and deck_hits[i + 1]
                and _has_kanji(a.surface) and _has_kanji(b.surface) and not a.proper and not b.proper
                and not _numeral(a.surface)):
            continue
        first, second = morphology.kata_to_hira(a.reading), morphology.kata_to_hira(b.reading)
        rows = [r for r in jmdict_db.by_kanji(a.surface + b.surface, limit=8)
                if r["kana"].startswith(first) and len(r["kana"]) == len(first) + len(second)]
        if len(rows) != 1:
            continue
        tail = rows[0]["kana"][len(first):]
        if tail != second and tail[0] in _VOICED_OF.get(second[0], "") and tail[1:] == second[1:]:
            out[i + 1] = tail
    return out


# A plain letter and what a sound change makes of it: と ど, は ば ぱ.
_VOICED_OF = {plain: voiced for plain, voiced in zip("かきくけこさしすせそたちつてとはひふへほ",
                                                     ("が", "ぎ", "ぐ", "げ", "ご", "ざ", "じ", "ず", "ぜ", "ぞ", "だ", "ぢ",
                                                      "づ", "で", "ど", "ばぱ", "びぴ", "ぶぷ", "べぺ", "ぼぽ"))}


# Words the pool holds whole that two deck cards would read as another
# thing (resolve_pool_compound): 熱中症 "heatstroke" (熱中 is
# "enthusiasm"), 銀世界 "a snowscape" (no "silver"), 開口一番 "the first
# thing one says" (no 一番 "best"), 本品 "this product" (本 "book"),
# 住民票 "a certificate of residence" (票 is "a vote").
_WHOLE_OVER_CARDS = frozenset({"熱中症", "銀世界", "開口一番", "本品", "住民票"})


# The one-kanji nouns that make a place of a deed, whose own card says
# another thing (plan 272): 勤務地 "place of work", no 地 "earth"; 連絡先
# "contact address", no 先 "ahead".
_PLACE_ENDS = frozenset({"地", "先"})


def _a_place_of(run) -> bool:
    return len(run) == 2 and run[1].surface in _PLACE_ENDS and run[0].pos == "noun" and len(run[0].surface) >= 2 \
        and all(_has_kanji(c) for c in run[0].surface)


def _another_thing(run, hits) -> bool:
    """Whether the pool's word for two loanwords means something its
    parts' cards do not say: タイムサービス, "a limited-time sale", is no
    "time" + "service"; チーズケーキ, "cheesecake", is."""
    row = latin_row("".join(m.surface for m in run)) or jmdict_db.get_by_key("", "".join(m.surface for m in run))
    if row is None:
        return False
    meaning = (row.get("meaning") or "").lower()
    for m, hit in zip(run, hits):
        if not hit or hit is True:
            continue
        gloss = ((hit[1] if isinstance(hit, tuple) else {}).get("meaning") or "").lower()
        words = [w for w in re.split(r"[^a-z]+", gloss.split(";")[0].split(",")[0]) if len(w) > 2]
        if words and not any(w[:4] in meaning for w in words):
            return True
    return False


def _a_saying(run, hits) -> bool:
    """Whether the run of nouns in kanji is a saying JMdict holds whole
    (a four-kanji compound, a proverb, an idiom): 三日坊主, "a quitter",
    is no "three days" and "monk"; 一石二鳥 is no count of stones."""
    return _saying_row(run, hits) is not None


_SAYING_TAGS = frozenset({"yoji", "proverb", "id"})


def _saying_row(run, hits) -> dict | None:
    if not (2 <= len(run) <= 4 and all(m.pos in ("noun", "suffix") and _has_kanji(m.surface) for m in run)
            and run[0].pos == "noun"):
        return None
    written = "".join(m.surface for m in run)
    row = jmdict_db.get_by_key(written, morphology.kata_to_hira("".join(m.reading for m in run)))
    if row is None and len(written) >= 4 and all(is_kanji(c) for c in written):
        # (A four-kanji saying is its spelling, whatever UniDic read its
        # parts as: 一石二鳥 is いっせきにちょう, no 一石's こく.)
        rows = jmdict_db.by_kanji(written, limit=1)
        row = rows[0] if rows and rows[0].get("kanji") == written else None
    if row is None:
        return None
    tags = {t for sense in jmdict_db.get_senses(row.get("kanji", ""), row.get("kana", "")) or []
            for t in sense.get("tags") or ()}
    # (Only a saying: 観光客 and 三番 are their deck words, and stay so,
    # plan 148. And a four-kanji compound only where its cards say no word
    # of its meaning: 自由貿易 is "free trade", 三日坊主 no "three days".)
    if tags & {"proverb", "id"}:
        return row
    return row if "yoji" in tags and not _parts_say_it(run, hits, row) else None


def _parts_say_it(run, hits, row) -> bool:
    """Whether a card of the run says a word of the row's meaning."""
    meaning = (row.get("meaning") or "").lower()
    for m, hit in zip(run, hits):
        gloss = hit[1].get("meaning") if isinstance(hit, tuple) else None
        if gloss is None and m.pos == "noun":
            own = jmdict_db.get_by_key(m.surface, morphology.kata_to_hira(m.reading))
            gloss = own.get("meaning") if own else None
        words = [w for w in re.split(r"[^a-z]+", (gloss or "").lower()) if len(w) > 2 and w not in ("the", "and", "one", "for")]
        if any(w[:4] in meaning for w in words):
            return True
    return False


def resolve_saying(morphemes, i: int, deck_hits: list):
    """(entry, n) for a saying (_a_saying) opening on morphemes[i], read
    before a number in it is folded as a count: 三日坊主, 一石二鳥."""
    for n in range(min(4, len(morphemes) - i), 1, -1):
        if not any(deck_hits[i + k] is True for k in range(n)):
            row = _saying_row(morphemes[i:i + n], deck_hits[i:i + n])
            if row is not None:
                return row, n
    return None


def resolve_pool_compound(morphemes, i: int, deck_hits: list, max_len: int = _COMPOUND_MAX):
    """(entry, n) for the JMdict pool word a run of `n` >= 2 morphemes
    starting at `i` spells as one, longest first, or None.

    UniDic cuts 桃源郷 into 桃源 + 郷, and each half alone is another
    word (郷 read ごう is "countryside"). The run is folded only where the
    deck has no card for at least one of its nouns (`deck_hits`, the
    caller's resolve_morpheme answers): 電話 + 番号 stays two N5 words
    the learner can study rather than becoming one pool word, and お +
    茶 is the deck's own fold (resolve_compound), asked first. Same run
    rule as resolve_compound -- nouns and the affixes on them, never
    across a particle -- and a key must hold a kanji, since a run of
    kana joined is a guess at a word boundary. Never a run with a number
    in it: 二 + 十 is the deck's to read (_resolve_numeral_compound's
    business), and a numeral joined to a noun is a count, not a word."""
    longest = min(max_len, len(morphemes) - i)
    for n in range(longest, 1, -1):
        run = morphemes[i:i + n]
        # (A morpheme a point is written on stands as True in deck_hits.)
        if not any(deck_hits[i + k] is True for k in range(n)) and not any(
                resolve_compound(morphemes, j) and j + resolve_compound(morphemes, j)[3] > i + n
                for j in range(i + 1, i + n)):
            apart = _read_apart_wrongly(run, deck_hits[i:i + n]) or _read_otherwise_whole(run)
            if apart is not None:
                return apart, n
        # (...and nouns in kanji the pool holds as a saying none of their
        # cards says a word of: 猫舌, "can't take hot food", no "cat" and
        # "tongue"; 三日坊主 and 一石二鳥, a number in it too -- plan 272)
        saying = _a_saying(run, deck_hits[i:i + n])
        # (...and the few words of deck nouns whose own card misleads
        # there: 熱中症 is "heatstroke", no 熱中 "enthusiasm"; 本品 "this
        # product", no 本 "book" -- where 観光 + 客 says 観光客, plan 272)
        unsaid = "".join(m.surface for m in run) in _WHOLE_OVER_CARDS or _a_place_of(run)
        if not saying and not unsaid and any(m.pos not in _COMPOUND_POS or m.auxiliary_use or _numeral(m.surface)
                                             for m in run):
            continue
        polite = n == 2 and run[0].pos == "prefix" and run[0].surface in ("お", "御", "ご")
        # (and お + a noun + 様, the word said of someone else's: お嬢様,
        # "(your) daughter, young lady", plan 272)
        honoured = (n == 3 and run[0].pos == "prefix" and run[0].surface in ("お", "御", "ご")
                    and run[2].surface in ("様", "さま", "ちゃん"))     # (お兄ちゃん, plan 272)
        # (...and two loanwords JMdict writes as one where it means another
        # thing than the pair (タイムサービス, a limited-time sale) -- never
        # チーズケーキ, whose two deck words say it, plan 272)
        pair = n == 2 and all(_katakana_written(m.surface) and not _has_kanji(m.surface) for m in run)
        loanwords = pair and _another_thing(run, deck_hits[i:i + n])
        if all(deck_hits[i + k] for k, m in enumerate(run) if m.pos == "noun" or _word_forming(m)) \
                and not polite and not honoured and not loanwords and not saying and not unsaid:
            # (A suffix with no card of its own counts too (plan 151):
            # 参加 + 者 read しゃ is 参加者, "participant", where 者's card
            # is もの and was a wrong reading on it. The polite prefix folds
            # where the pool holds the word with it (plan 272): 御中元, the
            # summer gift, read おちゅうげん -- 中元 alone is the day.)
            continue
        if any(resolve_compound(morphemes, j) and j + resolve_compound(morphemes, j)[3] > i + n
               for j in range(i + 1, i + n)):
            # A deck compound starts inside this run and reaches past it
            # (…日曜 + 日): the deck's word is not cut in half for ours.
            continue
        reading = "".join(m.reading for m in run)
        # (The polite prefix keeps its letter: UniDic spells お as 御, and
        # 御先 is みさき, "the leader of a cavalcade", where the page's お先 is
        # おさき, plan 272. The lemma of a word written in kana spells it:
        # いく日 is 幾日.)
        keys = ["".join(m.surface for m in run),
                "".join(m.surface if m.pos == "prefix" and m.surface in ("お", "ご") else m.lemma for m in run)]
        if honoured:
            keys = keys[:1]
        if polite:
            keys.append("お" + run[1].surface)          # 御中元, filed as お中元
        joined = "".join(m.surface for m in run)
        if polite and _hiragana(joined) and len(joined) >= 3:
            # (The polite prefix and a noun in kana, plan 272: お + ばけ is
            # おばけ, "ghost" -- the pool's row read so, where the noun
            # alone is no card the deck holds for it.)
            rows = [row for row in jmdict_db.by_kana(joined) if row["kana"] == joined]
            common = [row for row in rows if any("⭐" in (sense.get("term_tags") or ())
                                                 for sense in jmdict_db.get_senses(row.get("kanji", ""), joined) or [])]
            own = [deck_hits[i + 1][1]] if deck_hits[i + 1] else [e for _lv, e in _kana_cards(run[1].surface)]
            # (Where the noun alone is a card, only a common word folds it:
            # おつもり's one row is お積り, "the last cup of sake", and the
            # page's おつもり is つもり, "intention", said politely.)
            if own and (i == 0 or morphemes[i - 1].pos == "symbol"):
                # (...or an exclamation opening the sentence: お + やおや is
                # おやおや, "oh dear", no greengrocer.)
                common = common or [row for row in rows if "int" in {
                    t for sense in jmdict_db.get_senses(row.get("kanji", ""), joined) or []
                    for t in sense.get("tags") or ()}]
            picked = common if own else (rows if len(rows) == 1 else common)
            if len(picked) == 1 and not any(_glosses_meet(_row_gloss_words(picked[0]), _gloss_words(e))
                                            for e in own):
                return picked[0], n
            # (...and a lemma's kanji the page never wrote says no more:
            # つもり's lemma 積り spells お積り, the last cup again.)
            continue
        if honoured and _hiragana(joined):
            # (おにいちゃん, おねえさま: the pool's word read so, plan 272)
            rows = [row for row in jmdict_db.by_kana(joined) if row["kana"] == joined]
            if len(rows) == 1:
                return rows[0], n
        for key in dict.fromkeys(keys):
            if not _has_kanji(key) and not (_LATIN_WORD.match(key) and _katakana_written(key[1:])) \
                    and not (pair and all(_katakana_written(c) or c == "ー" for c in key)):
                # (...or two loanwords, where one has no deck card or the
                # pair means another thing: ツーアウト, タイムサービス, plan 272)
                # (A letter and a loanword JMdict writes as one: Uターン,
                # Tシャツ, plan 272.)
                continue
            # (A loanword's part read as written: JMdict spells みそラーメン so,
            # where UniDic reads ラーメン らあめん.)
            written_kana = "".join(m.surface if _katakana_written(m.surface) and not _has_kanji(m.surface)
                                   else m.reading for m in run)
            hit = _pool_by_form(key, (reading, written_kana))
            if hit is not None and polite and deck_hits[i + 1] \
                    and _glosses_meet(_row_gloss_words(hit), _gloss_words(deck_hits[i + 1][1])):
                # お店, お仕事 and ご連絡 are 店, 仕事 and 連絡, the deck's
                # cards, said politely -- in every spelling of the run.
                break
            if hit is not None:
                return hit, n
    return None


_I_TO_U = dict(zip("いきぎしちにびみり", "うくぐすつぬぶむる"))


def verb_of_stem(m):
    """(level, entry, raw_id) for the deck verb a noun is the stem of
    (探し 探す, 沈み 沈む, 考え 考える), or None (plan 272)."""
    surface, reading = m.surface, morphology.kata_to_hira(m.reading)
    if not _has_kanji(surface) or not surface or not reading:
        return None
    tries = []
    if surface[-1] in _I_TO_U and reading[-1:] == surface[-1]:
        tries.append((surface[:-1] + _I_TO_U[surface[-1]], reading[:-1] + _I_TO_U[surface[-1]]))
    tries.append((surface + "る", reading + "る"))
    for lemma, said in tries:
        hit = resolve_lemma(lemma, said, lemma)
        if hit is not None and _verb_card(hit[1]):
            return hit
    return None


# What may follow a noun the polite prefix makes of a verb's stem.
_AFTER_A_NOUN = frozenset({"は", "が", "を", "の", "も", "に", "で", "と", "や", "へ", "から", "まで"})


def resolve_spare_moment(morphemes, i: int):
    """The pool's 手透き, "a free moment", for the お手すき of a polite
    request (お手すきの際に, plan 272), where UniDic reads 手漉き, paper
    made by hand. Else None."""
    m = morphemes[i]
    if m.surface in ("手すき", "手隙", "手透き") and i > 0 and morphemes[i - 1].surface == "お":
        return jmdict_db.get_by_key("手透き", "てすき")
    return None


# The nouns that are a verb's stem and a place one goes to (plan 272):
# 大通りに行く is no errand.
_PLACES_STEMMED = frozenset({"通り", "辺り", "周り", "終わり", "始まり", "向かい", "隣", "集まり"})


def resolve_errand(morphemes, i: int):
    """(level, entry, raw_id) for the verb a noun is the stem of, where it
    is what one goes off to do (plan 272): 本を返しに行く is "go to return
    the book", 返す, no 返し, "a return gift" -- as 遊びに行く is 遊ぶ,
    which UniDic already reads a verb. Else None."""
    m = morphemes[i]
    if m.pos != "noun" or i + 2 >= len(morphemes) or m.surface in _PLACES_STEMMED or m.surface.endswith("通り"):
        return None
    ni, go = morphemes[i + 1], morphemes[i + 2]
    if not (ni.surface == "に" and ni.pos == "particle" and go.pos == "verb"
            and go.lemma_reading in ("いく", "くる", "かえる", "でかける", "まいる")):
        return None
    if i > 0 and morphemes[i - 1].pos == "prefix":
        return None                     # (お返しに参りました: resolve_humble_errand's)
    hit = verb_of_stem(m)
    if hit is None or resolve_lemma(m.lemma, m.lemma_reading, m.surface) is not None:
        return None                     # (a deck noun is the noun: 買い物に行く)
    return hit


def resolve_humble_errand(morphemes, i: int):
    """(level, entry, raw_id) for the verb whose stem the polite お makes
    the errand of a humble going or coming (plan 272): お返しに参りました
    is "came to return (it)", 返す -- no お返し, "a return gift" -- as お
    迎えに参ります is 迎える. Else None."""
    if i + 3 >= len(morphemes):
        return None
    prefix, stem, ni, go = morphemes[i:i + 4]
    if prefix.pos != "prefix" or prefix.surface not in ("お", "御") or stem.pos != "noun" \
            or ni.surface != "に" or ni.pos != "particle" or go.pos != "verb" or go.lemma not in ("参る", "伺う"):
        return None
    return verb_of_stem(stem)


def resolve_polite_noun(morphemes, i: int):
    """(("deck", (level, entry, raw_id)) or ("pool", row), 2) for the
    noun the polite お or ご makes of a verb's stem (plan 272): おすすめは
    何ですか is お + すすめ (勧める) to UniDic, and おすすめ, "a
    recommendation", is the word. Only where a noun's particle, the
    copula or a mark follows -- おすすめします is お〜する, the point's --
    and the deck or the pool holds the word spelled so: a card read as
    the page, else the pool's row for the page's spelling, or for a
    spelling in kana the one common row read so."""
    if i + 2 > len(morphemes):
        return None
    prefix, stem = morphemes[i], morphemes[i + 1]
    if prefix.pos != "prefix" or prefix.surface not in ("お", "ご", "御"):
        return None
    if stem.pos == "noun" and resolve_lemma(stem.lemma, stem.lemma_reading, stem.surface) is None:
        # お探しですか: UniDic's noun 探し, a verb's stem said politely, the
        # verb's card where neither the deck nor the pool holds the noun
        # (plan 272).
        after = morphemes[i + 2] if i + 2 < len(morphemes) else None
        verb = verb_of_stem(stem)
        joined = prefix.surface + stem.surface
        if verb is not None and after is not None and (after.lemma in ("です", "だ") or after.surface == "に") \
                and _pool_by_form(joined, (morphology.kata_to_hira(prefix.reading + stem.reading),),
                                  seen_kanji=False) is None:
            return ("deck", verb), 2
        return None
    if stem.pos != "verb" or not stem.cform.startswith("連用形-一般"):
        return None
    after = morphemes[i + 2] if i + 2 < len(morphemes) else None
    if after is not None and not ((after.pos == "particle" and after.surface in _AFTER_A_NOUN)
                                  or after.pos == "symbol" or after.lemma in ("です", "だ")):
        return None
    joined = prefix.surface + stem.surface
    reading = morphology.kata_to_hira(prefix.reading + stem.reading)
    verb = resolve_lemma(stem.lemma, stem.lemma_reading, stem.surface)
    cards = [(lv, e) for lv, e in _VOCAB_BY_KANA.get(reading, ())
             if reading in _reading_variants(e.get("kana") or "") and not _verb_card(e)
             and (not e.get("kanji") or _has_kanji(joined) and set(c for c in joined if is_kanji(c))
                  <= set(e.get("kanji") or ""))]
    if cards:
        level, entry = min(cards, key=lambda c: _level_rank(c[0]))
        return ("deck", (level, entry, vocab_to_id(entry, level))), 2
    def the_verb_said_politely(row) -> bool:
        # お迎え is 迎える's noun said politely, and the deck's card is the
        # word to study: never the pool's in its place (as お店 is 店).
        return verb is not None and _glosses_meet(_row_gloss_words(row), _gloss_words(verb[1]))

    def answer(row):
        if row is None:
            return None
        return (("deck", verb), 2) if the_verb_said_politely(row) else (("pool", row), 2)

    if _has_kanji(joined):
        return answer(_pool_by_form(joined, (reading,), seen_kanji=False))
    # (The shape is the evidence here, a polite noun before its
    # particle: one row read so, or one of them common. お勧め is no ⭐
    # word to JMdict, only "usually in kana".)
    rows = [row for row in jmdict_db.by_kana(joined) if row["kana"] == joined]
    common = [row for row in rows if any(
        "⭐" in (sense.get("term_tags") or ())
        for sense in jmdict_db.get_senses(row.get("kanji", ""), row.get("kana", "")) or [])]
    picked = rows if len(rows) == 1 else common
    return answer(picked[0]) if len(picked) == 1 else None


# ── The words that hold a sentence together (plan 266) ────────
# A breakdown is the learner's map of a sentence, and every part of it
# should say what it is. Measured over the 7,651 sentences the app
# teaches, 2,036 had a part that said nothing: no card, no point -- the
# さん of たなかさん (121 times), the その of その本, the ほど of 二週間ほど,
# the でも that opens a sentence, the じゃあ of じゃあ、何がおいしいですか
# (176), はじめまして and どういたしまして, the 気をつける of 気をつけて,
# 知らせる cut into 知ら + せ. The deck held a card for most of them,
# written in kana, and the lookups never asked it: resolve_kana admits
# the content words alone, and a set phrase only as the deck spells it.
#
# Like the pool's, these resolvers are the breakdown's alone, asked only
# where the deck's own have answered None and no grammar point is
# written on the word (study/analysis._tokens): the level a sentence is
# graded at, the reading badges and the audit keep resolve_morpheme's
# answer. So より, an N3 card, gives an N5 sentence's comparison its
# meaning without making the sentence N3.

# The parts of speech a function word's card may answer for.
_FUNCTION_POS = frozenset({"suffix", "adnominal", "conjunction", "particle"})


def _hiragana(text: str) -> bool:
    return bool(text) and all("ぁ" <= c <= "ゟ" for c in text)


@lru_cache(maxsize=1)
def _catalogue_words() -> frozenset[str]:
    """The grammar points written as one word, in kana and with no 〜:
    the particles' markers (は, を, と, ね), だから, それから. Such a word
    is its point's to explain, and where the detector refused it, the
    reading it refused is no card's to give back -- the ね of ゆっくりねます
    is 寝る misread, not "isn't it?"."""
    from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL
    out = set()
    for points in GRAMMAR_POINTS_BY_LEVEL.values():
        for point in points:
            pattern = point.get("pattern", "")
            for alt in re.split(r"[／/]", pattern):
                if alt and "〜" not in alt and _hiragana(alt):
                    out.add(alt)
    return frozenset(out)


def _kana_cards(spelled: str) -> list[tuple[str, dict]]:
    """The deck's cards written in kana alone and read exactly `spelled`,
    hiragana for hiragana: ばん is not the card バン ("van"), which the
    kana index folds in beside it."""
    return [(level, entry) for level, entry in _VOCAB_BY_KANA.get(spelled, ())
            if not entry.get("kanji") and spelled in _reading_variants(entry.get("kana") or "")]


def _clause_start(morphemes, i: int) -> bool:
    """Whether morphemes[i] opens a sentence or a quotation: nothing
    before it, or a mark that ends a sentence or opens a quote."""
    return i == 0 or (morphemes[i - 1].pos == "symbol"
                      and morphemes[i - 1].surface in "。．！？!?「『（(…")


def _a_verbs_card(entry: dict) -> bool:
    return (entry.get("meaning") or "").startswith("to ")


def kana_card(written: str):
    """(level, entry, raw_id) for the deck's card written `written` in
    kana, the lowest level's, or None: the card a conjunction point's own
    word carries (それに, ところが)."""
    cards = _kana_cards(written)
    if not cards:
        return None
    level, entry = min(cards, key=lambda c: _level_rank(c[0]))
    return level, entry, vocab_to_id(entry, level)


# The days より starts from in a notice: 本日より, 来月より (never 今日 or
# 去年, which より compares: 去年より増えた).
_FROM_DAYS = frozenset({"本日", "明日", "翌日", "翌月", "来月", "来週", "来年度", "当日", "次回", "今後", "明朝"})
# What follows the より of "from": a departure, a sending, a start
# (口座より引き落とされます, 窓より飛び去る, 東京駅より発車します).
_FROM_DEEDS = frozenset({"引き落とす", "発車", "出発", "発つ", "送る", "届く", "始まる", "始める", "開始", "開催",
                         "実施", "施行", "適用", "発売", "販売", "受付", "受け付ける", "配信", "放送", "去る",
                         "飛び去る", "出る", "逃げる", "離れる", "降りる", "移る", "移動", "差し引く", "支払う",
                         "振り込む", "抜粋", "引用", "転載", "折り返し", "営業"})


def _from_not_than(morphemes, i: int) -> bool:
    """Whether the より at morphemes[i] is the formal "from" (= から), not
    the comparison's "than" (plan 272): before a departure, a sending or
    a start (口座より引き落とされます, 田中より折り返し), before the polite
    prefix (心よりおわび, 当社よりご連絡), or after a day a notice starts
    on (本日より、, 本日よりお世話に). 去年より増える, 運転するより作るほう
    が are "than"."""
    nxt = morphemes[i + 1] if i + 1 < len(morphemes) else None
    prev = morphemes[i - 1] if i > 0 else None
    if nxt is None or prev is None:
        return False
    if nxt.lemma in _FROM_DEEDS or nxt.surface in _FROM_DEEDS:
        return True
    if nxt.pos == "prefix" and nxt.surface in ("お", "ご", "御") and i + 2 < len(morphemes) \
            and morphemes[i + 2].pos in ("noun", "verb"):
        return True
    if prev.surface in ("）", ")") and nxt.surface in ("、", "，") and i >= 4:
        # 令和7年4月1日（火）より、: the date a notice starts on, its weekday
        # in brackets (plan 272)
        k = next((k for k in range(i - 2, max(-1, i - 6), -1) if morphemes[k].surface in ("（", "(")), None)
        if k is not None and k > 0 and (morphemes[k - 1].surface in ("日", "月") or morphemes[k - 1].surface.endswith("日")):
            return True
    return prev.surface in _FROM_DAYS and nxt.pos not in ("adjective", "other", "adverb")


def resolve_function_word(morphemes, i: int):
    """(level, entry, raw_id) for the deck card written in kana that a
    function word is, or None (plan 266).

    - a SUFFIX: たなかさん's さん is "Mr, Mrs, Ms" -- the course's N5
      card, which no lookup reached, since resolve_kana admits content
      words alone and the card has no kanji for the lemma path;
    - an ADNOMINAL: その本's その (UniDic's 其の, which no card spells),
      そんな, どんな -- never a verb's card, though: ある研究's ある is
      或る, "a certain", not ある "to be";
    - a CONJUNCTION opening a clause: じゃあ is UniDic's では, and its
      lemma reads で;
    - a PARTICLE no grammar point is written on, that is no point's own
      word (_catalogue_words): 二週間ほど's ほど, いつもより's より,
      など. A marker the detector refused is left to it.

    Read off the token as written, never its lemma: one or two kana are
    a sound many words share, and the page's own letters are the word."""
    m = morphemes[i]
    if m.pos not in _FUNCTION_POS or not _hiragana(m.surface) or len(m.surface) < 2:
        return None
    if m.pos == "particle" and m.surface in _catalogue_words():
        return None
    if m.pos == "conjunction" and not (_clause_start(morphemes, i)
                                       or (i > 0 and morphemes[i - 1].surface in "、，,")
                                       or _after_a_clause(morphemes, i)):
        # A conjunction opens its clause: the さて of きっさてん is three
        # letters of a café the tokenizer cut wrong, not "well, now".
        return None
    if m.pos == "particle" and m.surface in ("じゃ", "じゃあ") and not _clause_start(morphemes, i) \
            and not (i > 0 and morphemes[i - 1].surface in ("それ", "そう", "これ")
                     and (i == 1 or morphemes[i - 2].pos == "symbol")):
        # では said short after a word (お前のせいじゃね, "isn't it your
        # fault?"), never the じゃあ, "well then", that opens a clause, as
        # それじゃあ does (plan 272).
        return None
    if m.pos == "particle" and m.surface == "より" and _from_not_than(morphemes, i):
        return None                    # 口座より引き落とされます: "from", glossed (plan 272)
    cards = _kana_cards(m.surface)
    if m.pos == "adnominal":
        cards = [c for c in cards if not _a_verbs_card(c[1])]
    if not cards:
        return None
    level, entry = min(cards, key=lambda c: _level_rank(c[0]))
    return level, entry, vocab_to_id(entry, level)


# What an interjection is the card of where its letters spell another
# word too (plan 272): the filler あの, あのー is the N5 あのう, "um", never
# the adnominal あの, "that over there"; ええと's spellings are ええと; ああ,
# "ah!", is the N1 嗚呼, never the N4 ああ, "like that".
_INTERJECTION_CARDS = {
    "あの": ("", "あのう"), "あのう": ("", "あのう"), "あのお": ("", "あのう"),
    "ええと": ("", "ええと"), "えーと": ("", "ええと"), "えっと": ("", "ええと"),
    "ええっと": ("", "ええと"), "えーっと": ("", "ええと"),
    "ああ": ("嗚呼", "ああ"), "あー": ("嗚呼", "ああ"), "あぁ": ("嗚呼", "ああ"),
    # (The pool's: "damn it!", where its kana row is くそ, "you …";
    # "huh?!", where UniDic files えーっ under ええ, "yes".)
    "くそ": ("糞", "くそ"), "えーっ": ("", "えっ"), "ええっ": ("", "えっ"),
}
_DRAWN_OUT = "ーぇェ〜～"
_CUT = "っッ"
_SMALL_VOWELS = "ぁぃぅぇぉ"
_ROW_VOWEL = {**{c: "う" for c in "おこそとのほもよろごぞどぼぽょ"},
              **{c: "い" for c in "えけせてねへめれげぜでべぺ"},
              **{c: "あ" for c in "あかさたなはまやらわがざだばぱゃ"},
              **{c: "い" for c in "いきしちにひみりぎじぢびぴ"},
              **{c: "う" for c in "うくすつぬふむゆるぐずづぶぷゅ"}}
_FULL_VOWELS = str.maketrans("ぁぃぅぇぉ", "あいうえお")
_SAME_VOWEL = {**_ROW_VOWEL, **{c: "お" for c in "おこそとのほもよろごぞどぼぽょ"},
               **{c: "え" for c in "えけせてねへめれげぜでべぺ"}}


def _said_as(surface: str) -> list[str]:
    """The spellings a word drawn out or cut short in speech stands for:
    いやー いや, よっしゃあ よっしゃ, うわっ うわ, あのー あのう and あの,
    ええっと ええと."""
    out = [surface]
    # A long vowel as a word spells it (おはよう, せんせい), and as an
    # exclamation does (おお, ええ, へえ).
    for vowel in (_ROW_VOWEL, _SAME_VOWEL):
        out.append("".join(vowel.get(surface[k - 1], c) if c == "ー" and k else c
                           for k, c in enumerate(surface)))
    out.append(surface.translate(_FULL_VOWELS))       # はぁ はあ
    cut = surface.rstrip(_DRAWN_OUT + _CUT + _SMALL_VOWELS)
    if len(cut) >= 3 and cut[-1] in "あお" and _SAME_VOWEL.get(cut[-2]) == cut[-1]:
        out.append(cut[:-1])           # いやあ, よっしゃあ: a vowel said twice
    out.append(cut)
    out.append(cut.replace("ー", ""))
    # Never cut down to one letter: ねぇ is "hey", not the particle ね.
    return [w for w in dict.fromkeys(out) if len(w) >= 2]


def resolve_interjection(m):
    """("deck", (level, entry, raw_id)) or ("pool", row) for an
    interjection (or a filler) by the spelling it is said as, or None
    (plan 272): いやー is いや, "oh, well"; うわっ うわ, "yikes"; やったー
    やった, "hooray"; あのー the N5 あのう, "um" -- where UniDic's word,
    or no word at all, had nothing to say or the wrong card. The deck's
    kana card first, the pool's kana row after; never a card spelled in
    kanji, which an exclamation written in kana is no instance of (いや
    is no 嫌, "unpleasant")."""
    if m.pos not in ("interjection", "filler") or not m.surface or any(is_kanji(c) for c in m.surface):
        return None
    if m.surface == "あれ":
        return None                     # "huh?", glossed: no "that one over there" (plan 272)
    spellings = _said_as(m.surface)
    for spelled in spellings:
        if spelled in _INTERJECTION_CARDS:
            kanji, kana = _INTERJECTION_CARDS[spelled]
            for level, entry in _VOCAB_BY_KANA.get(kana, ()):
                if (entry.get("kanji") or "") == kanji:
                    return "deck", (level, entry, vocab_to_id(entry, level))
            row = jmdict_db.get_by_key(kanji, kana)
            if row is not None:
                return "pool", row
    for spelled in spellings:
        cards = [c for c in _kana_cards(spelled) if not _a_verbs_card(c[1])]
        if cards:
            level, entry = min(cards, key=lambda c: _level_rank(c[0]))
            return "deck", (level, entry, vocab_to_id(entry, level))
        row = jmdict_db.get_by_key("", spelled)
        if row is not None:
            return "pool", row
    return None


def _after_a_clause(morphemes, i: int) -> bool:
    """Whether morphemes[i] follows the end of a clause in a line written
    without its commas (plan 272): a particle (バンドメンバーと, そして
    ...), an ending or a predicate (ありがとう, それでは ...). A subtitle
    writes what is said, and a speaker's pause is no comma."""
    if i == 0:
        return True
    before = morphemes[i - 1]
    # (A space between a lyric's phrases is its line's end: 祈りは届かず
    # それでも叫べ.)
    return before.pos in ("particle", "auxiliary", "verb", "adjective", "interjection") \
        or (before.pos == "symbol" and before.surface in (" ", "\u3000"))


# What may follow a sentence-opening では or でも and leave it the copula's
# or a particle's: ではない, でもある.
_COPULA_TAILS = frozenset({"無い", "ない", "有る", "ある", "ござる", "御座る"})

# What それで, それでは, それでも say "with that" before, never "and so",
# "well then" or "even so" (plan 272): それでいい, "that's fine";
# それでもいい, "that would do too"; それでお願いします.
EVALUATIONS = frozenset({
    "良い", "いい", "よい", "好い", "大丈夫", "十分", "充分", "結構", "構う", "OK", "オッケー", "問題",
    "駄目", "だめ", "ダメ", "無理", "満足", "足りる", "決まり", "終わり", "お終い", "おしまい", "お願い",
    "願う", "頼む", "済む", "平気", "正解", "十分だ", "我慢",
})

def evaluates(morphemes, k: int) -> bool:
    """Whether morphemes[k], past an honorific prefix, is an evaluation
    (EVALUATIONS): the 願い of それでお願いします as the いい of それでいい,
    and past the space a page in kana writes between its phrases (それで
    いいです)."""
    while k < len(morphemes) and morphemes[k].surface in (" ", "\u3000"):
        k += 1
    if k < len(morphemes) and morphemes[k].pos == "prefix" and morphemes[k].surface in ("お", "ご", "御"):
        k += 1
    return k < len(morphemes) and (morphemes[k].lemma in EVALUATIONS or morphemes[k].surface in EVALUATIONS)


# The run a pronoun opens and a conjunction of the deck closes:
# それ + で + は is それでは, "well then"; それ + で + も それでも, "even so".
_PRONOUN_OPENERS = frozenset({"それ"})


def resolve_opening(morphemes, i: int):
    """(level, entry, raw_id, n) for a conjunction the tokenizer cut into
    particles where it opens a sentence (plan 266): でも、まだ… is で + も
    to UniDic, and the deck's でも, "but", stood beside it unasked; では is
    "well then", だって "but, because". Only at a sentence's start or a
    quotation's -- 学校でも is a noun's で and も -- and never where the
    run is a catalogue point's word (だから, それで: the point explains it)
    or the copula goes on (ではない).

    And one that それ opens (plan 272): それ + で + は is それでは, "well
    then", which the breakdown read as the point それで and a topic's は;
    それ + で + も それでも, "even so", read as それ and 〜でも "or
    something". Where a clause opens, as a subtitle writes it too
    (ありがとうそれでは…, _after_a_clause), and never before an
    evaluation: それではだめだ is "that won't do", それでもいい "that would
    do too"."""
    pronoun = morphemes[i].surface in _PRONOUN_OPENERS and morphemes[i].pos == "pronoun"
    if not (_clause_start(morphemes, i) or (pronoun and _after_a_clause(morphemes, i))):
        return None
    for n in (3, 2):
        run = morphemes[i:i + n]
        if len(run) < n or any(m.pos not in ("particle", "auxiliary") for m in run[1 if pronoun else 0:]):
            continue
        surface = "".join(m.surface for m in run)
        if not _hiragana(surface) or surface in _catalogue_words():
            continue
        nxt = morphemes[i + n] if i + n < len(morphemes) else None
        if nxt is not None and (nxt.lemma in _COPULA_TAILS or (pronoun and evaluates(morphemes, i + n))):
            continue
        cards = _kana_cards(surface)
        if cards:
            level, entry = min(cards, key=lambda c: _level_rank(c[0]))
            return level, entry, vocab_to_id(entry, level), n
    return None


def resolve_pool_opening(morphemes, i: int):
    """(row, n) for a conjunction the pool holds that opens a sentence,
    cut by the tokenizer into the copula and particles (plan 272): な + の
    + に is なのに, "and yet"; だっ + たら だったら, "in that case". Only
    where a sentence or a quotation opens: 雨だったら is "if it rains"."""
    if not _clause_start(morphemes, i):
        return None
    for n in (4, 3, 2):
        run = morphemes[i:i + n]
        if len(run) < n or any(m.pos not in ("particle", "auxiliary", "pronoun") for m in run):
            continue
        joined = "".join(m.surface for m in run)
        if not _hiragana(joined) or _kana_cards(joined):
            continue
        if run[0].pos == "pronoun" and run[-1].pos == "particle" and not (
                i + n < len(morphemes) and morphemes[i + n].surface in ("、", "，", ",")):
            # A pronoun and its particle open a sentence as the pronoun
            # does: それを読んでから is "after reading it", それより遅く
            # "later than that". Only its comma makes it the conjunction:
            # それより、早く行かないと, "more to the point".
            continue
        row = jmdict_db.get_by_key("", joined)
        if row is not None and "conj" in {t for sense in jmdict_db.get_senses("", joined) or []
                                          for t in sense.get("tags") or ()}:
            return row, n
    return None


# JMdict's tags for a set phrase: an expression, an interjection.
_PHRASE_TAGS = frozenset({"exp", "int"})


def _utterance_start(morphemes, i: int) -> bool:
    """Whether morphemes[i] opens an utterance: a sentence's start or a
    quotation's (_clause_start), or a comma after the word a reply opens
    with -- いいえ、どういたしまして, はい、いってらっしゃい."""
    if _clause_start(morphemes, i):
        return True
    return (i >= 2 and morphemes[i - 1].surface in "、，,"
            and morphemes[i - 2].pos in ("interjection", "conjunction")
            and _clause_start(morphemes, i - 2))


def _after_a_farewell(morphemes, i: int) -> bool:
    """Whether morphemes[i] follows a farewell said just before it, as
    a second one is (plan 272): またねー | ばいばーい, じゃあね、| ばいばい."""
    if i >= 1 and morphemes[i - 1].surface in "、，,":
        i -= 1
    return (i >= 2 and morphemes[i - 1].pos == "particle"
            and morphemes[i - 1].surface.rstrip(_DRAWN_OUT) in ("ね", "な")
            and morphemes[i - 2].pos in ("adverb", "conjunction", "interjection"))


def _utterance_end(morphemes, end: int) -> bool:
    return end >= len(morphemes) or (morphemes[end].pos == "symbol"
                                     and morphemes[end].surface in "。．！？!?」』）)…")


def _greeting(run):
    """(row, opens) for the exclamation a run of kana with no verb in it
    spells, the pool's kana-only row tagged an interjection, or None:
    `opens` where JMdict marks it common, as a greeting that opens what
    follows it is (ようこそ日本へ)."""
    if len(run) < 2 or any(m.pos in ("verb", "auxiliary", "symbol") for m in run):
        return None
    if not any(m.pos == "particle" for m in run):
        return None
    joined = "".join(m.surface for m in run)
    # (Drawn out, it is the word it draws out: ばいばーい is バイバイ.)
    undrawn = joined.replace("ー", "").replace("〜", "").replace("～", "")
    if not _hiragana(undrawn) or len(undrawn) < 3:
        return None
    for spelled in dict.fromkeys((joined, undrawn, _to_katakana(joined), _to_katakana(undrawn))):
        if not all(c not in "ー〜～" for c in spelled):
            continue
        for row in jmdict_db.by_kana(spelled):
            if row["kana"] != spelled or row.get("kanji"):
                continue
            senses = jmdict_db.get_senses("", spelled) or []
            if senses and "int" in (senses[0].get("tags") or ()):
                return row, any("⭐" in (s.get("term_tags") or ()) for s in senses)
    return None


def resolve_pool_phrase(morphemes, i: int, deck_hits: list, explained: list,
                        max_len: int = _PHRASE_MAX):
    """(row, n) for a set phrase said as a whole utterance that the deck
    has no card for and the JMdict pool holds as one expression (plan
    266): どういたしまして is どう + 致す + ます + て, いらっしゃいませ
    いらっしゃる + ます, 申し訳ありません a noun and a verb's polite
    negative -- and the まし, the て, the ませ and the ん said nothing.

    Held to what makes it a phrase and not a clause its words explain:

    - it is the whole utterance (_utterance_start, _utterance_end): the
      雨が降る of 大事な日に限って、雨が降る is a clause, its words cards;
    - no word of it is a greeting the deck teaches: ありがとうございます
      keeps the N5 ありがとう card a learner studies;
    - a part of it says nothing otherwise -- no card and no point
      (`explained`, the caller's) -- or carries a card its spelling
      contradicts: いってきます's いっ took 言う, "to say", where the row
      is 行ってきます. そうですね, whose そう, です and ね are a card and two
      points, is left to them;
    - JMdict tags the row an expression or an interjection, and marks it
      common (its ⭐)."""
    if not (_utterance_start(morphemes, i) or _after_a_farewell(morphemes, i)):
        return None
    longest = min(max_len, len(morphemes) - i)
    for n in range(longest, 1, -1):
        run = morphemes[i:i + n]
        greeting = _greeting(run)
        if greeting is not None and not any(explained[i + k] for k, m in enumerate(run) if m.pos == "particle"):
            # (An exclamation the tokenizer cut into pieces of no word,
            # plan 272: よう + こそ is ようこそ, "welcome", which opens what
            # follows it; ばい + ばい the whole utterance バイバイ.)
            if _utterance_end(morphemes, i + n) or greeting[1]:
                return greeting[0], n
        if not _utterance_end(morphemes, i + n):
            continue
        # (A farewell is a word and the particle it ends on, no verb in
        # it: またね, じゃあね, またな, plan 272.)
        farewell = (n == 2 and run[0].pos in ("adverb", "conjunction")
                    and run[1].pos in ("particle", "auxiliary") and run[1].surface.rstrip(_DRAWN_OUT) in ("ね", "な"))
        if any(m.pos == "symbol" for m in run) or not (farewell or any(m.pos in ("verb", "auxiliary") for m in run)):
            continue
        if any(deck_hits[i + k] and m.pos == "interjection" for k, m in enumerate(run)):
            continue
        surface = "".join(m.surface for m in run).rstrip(_DRAWN_OUT) if farewell else "".join(m.surface for m in run)
        reading = morphology.kata_to_hira("".join(m.kana for m in run))
        rows = ([jmdict_db.get_by_key(surface, reading)] if _has_kanji(surface)
                else jmdict_db.by_kana(surface))
        for row in rows:
            if row is None or (_has_kanji(surface) and row.get("kanji") != surface):
                continue
            spelled = {c for c in row.get("kanji") or "" if is_kanji(c)}
            silent = any(not explained[i + k] for k, m in enumerate(run) if m.pos != "symbol")
            contradicted = bool(spelled) and any(
                deck_hits[i + k] and _has_kanji(deck_hits[i + k][1].get("kanji") or "")
                and not {c for c in deck_hits[i + k][1]["kanji"] if is_kanji(c)} & spelled
                for k in range(n))
            if not (silent or contradicted):
                continue
            senses = jmdict_db.get_senses(row.get("kanji", ""), row.get("kana", "")) or []
            if any(_PHRASE_TAGS & set(s.get("tags") or ()) and "⭐" in (s.get("term_tags") or ())
                   for s in senses):
                return row, n
    return None


# What follows a name and makes it one: たなかさん, こんたくん.
_HONORIFICS = frozenset({"さん", "くん", "君", "ちゃん", "様", "さま", "ちゃま", "殿", "どの", "先生", "せんせい"})


def resolve_name_fragments(morphemes, i: int):
    """(("deck", (level, entry, raw_id)) or ("pool", row), n) for a word
    written in hiragana that UniDic, not knowing it, cut into names
    (plan 272): しゅうまつ is しゅう + まつ to it, "Shū" and "Matsu", two
    given names, and the breakdown glossed 周, "circumference", and マツ,
    "pine". Read back as the word the letters spell -- a deck card, else
    the pool's commonest row read so that JMdict marks common (its ⭐) --
    where every piece is a noun in hiragana, one of them a name UniDic
    guessed, and no honorific after them makes them a name."""
    longest = min(3, len(morphemes) - i)
    for n in range(longest, 1, -1):
        run = morphemes[i:i + n]
        if any(m.pos not in ("noun", "suffix") for m in run) or run[0].pos != "noun":
            continue
        # A name UniDic guessed in kana, and the rest kana or the kanji a
        # level allows: 週まつ writes 末 in kana, as 日よう日 writes 曜.
        if not any(m.proper and _hiragana(m.surface) for m in run):
            continue
        if not all(_hiragana(m.surface) or all(is_kanji(c) for c in m.surface) for m in run):
            continue
        after = morphemes[i + n] if i + n < len(morphemes) else None
        if after is not None and (after.surface in _HONORIFICS or after.pos == "suffix"):
            continue
        joined = "".join(m.surface if _hiragana(m.surface) else morphology.kata_to_hira(m.reading) for m in run)
        written = {c for m in run for c in m.surface if is_kanji(c)}
        if len(joined) < 3:
            continue
        cards = [(lv, e) for lv, e in _VOCAB_BY_KANA.get(joined, ())
                 if joined in _reading_variants(e.get("kana") or "") and not _verb_card(e)
                 and written <= set(e.get("kanji") or "")]
        if cards:
            level, entry = min(cards, key=lambda c: (bool(c[1].get("kanji")), _level_rank(c[0])))
            return ("deck", (level, entry, vocab_to_id(entry, level))), n
        common = [row for row in jmdict_db.by_kana(joined)
                  if written <= set(row.get("kanji") or "")
                  and any("⭐" in (sense.get("term_tags") or ())
                          for sense in jmdict_db.get_senses(row.get("kanji", ""), row.get("kana", "")) or [])]
        if common:
            return ("pool", min(common, key=lambda row: row.get("freq_rank") or 10 ** 9)), n
    return None


# The particles a deck word ends in that the tokenizer writes as
# particles of their own (plan 272), longest first: 今 + に + も is 今にも,
# いつ + も いつも, 実 + は 実は.
_WHOLE_TAILS = (("まで", "も"), ("に", "も"), ("に", "か"), ("と", "か"), ("と", "も"), ("だ", "か"),
                ("しも",), ("とも",), ("やら",), ("も",), ("に",), ("か",), ("は",))

# What may stand before them: a question word, an adverb, a noun or a
# な-adjective's stem, and the く of an adjective before とも (少なくとも).
_WHOLE_HEADS = frozenset({"pronoun", "adverb", "noun", "other", "adjective"})

# Spellings of a deck word that a page writes, letter for letter, as
# something else as often or more, or that a point of their own explains.
_NOT_WHOLE = frozenset({
    "ことに",                        # やめることにした: こと + に, seldom 殊に
    "先に", "さきに",                 # 先 (N5) and its に: the N1 card would grade a first lesson N1
    "今に", "いまに",                 # 今になって is no "before long"
    "何と", "なんと",                 # 何と言いますか: "what", and the quotation's と
    "何て", "なんて",                 # the quoting なんて (なんで is _what_word's)
    "なんか",                         # 〜なんか, a particle of its own
    "何も", "なにも", "何か", "なにか", "誰か", "だれか", "どこか",  # their points' (何か／誰か／どこか ...)
    "それに", "それと", "それとも",    # the conjunctions' own path (resolve_function_word)
})

# A noun a deck word opens with that is a clause's own word anywhere but
# at its start: 始めに is "to begin with" there, and "at the start" (最初の
# 始めに戻る) after a word.
_OPENING_ONLY = frozenset({"始めに", "はじめに"})

# The verbs an embedded question is asked or known with: いつか分からない
# is "I don't know when", never "someday".
_ASKING = frozenset({"分かる", "判る", "解る", "知る", "聞く", "訊く", "教える", "決める", "覚える", "調べる",
                     "尋ねる", "考える", "思い出す", "確かめる", "言う"})


def _ends_in(entry: dict, tail: str) -> bool:
    """Whether the deck word's own spelling ends in `tail`: 急に, 実は,
    いつも -- never 文化, whose kana ぶんか only ends in か's letter."""
    written = re.split(r"[/／;、,・]", entry.get("kanji") or "")[0].strip()
    if written:
        return written.endswith(tail)
    return any(r.endswith(tail) for r in _reading_variants(entry.get("kana") or ""))


def resolve_whole_word(morphemes, i: int):
    """(level, entry, raw_id, n) for the deck word that a word and the
    particles after it spell (plan 272), or None.

    UniDic writes いつも as いつ + も, どうも as どう + も, 実は as 実 + は,
    今にも as 今 + に + も, 少しも as 少し + も, 非常に as 非常 + に: the
    breakdown showed "when" and the も of "also", and a learner reading
    いつも人が多い was taught it says "when, also". The run is folded
    where the deck has the whole word, spelled as the page spells it --
    its own spelling ends in the particles (_ends_in), and a kanji
    spelling is read as the card is read (実になる, 実 read み, is "to
    bear fruit") -- and no reading of the same letters is likelier
    (_NOT_WHOLE, _OPENING_ONLY, and いつか, どうか, ともに where the
    sentence asks for another)."""
    m = morphemes[i]
    what = _what_word(morphemes, i) or _polite_set_phrase(morphemes, i)
    if what:
        return what
    if m.pos == "verb" and m.surface in ("できる", "出来る") and i + 1 < len(morphemes) \
            and morphemes[i + 1].surface == "だけ" and morphemes[i + 1].pos == "particle":
        # できる + だけ is できるだけ, "as much as possible" (plan 272).
        for level, entry in sorted(_VOCAB_BY_KANA.get("できるだけ", ()), key=lambda c: (
                bool(c[1].get("kanji")) != _has_kanji(m.surface), _level_rank(c[0]))):
            return level, entry, vocab_to_id(entry, level), 2
        return None
    if m.pos not in _WHOLE_HEADS or m.auxiliary_use or m.proper:
        return None
    if m.pos == "adjective" and not m.surface.endswith("く"):
        return None
    for tail in _WHOLE_TAILS:
        n = 1 + len(tail)
        run = morphemes[i:i + n]
        # (The last of them drawn out in speech is the same: どうもー.)
        if len(run) < n or tuple(t.surface for t in run[1:-1]) + (run[-1].surface.rstrip("ー〜～"),) != tail:
            continue
        if any(t.pos not in ("particle", "auxiliary") for t in run[1:]):
            continue
        joined = m.surface + "".join(tail)
        if joined in _NOT_WHOLE:
            return None
        if joined in _OPENING_ONLY and i > 0 and morphemes[i - 1].pos != "symbol":
            return None
        if not _likely_whole(morphemes, i, n, joined):
            return None
        reading = morphology.kata_to_hira(m.reading) + "".join(tail)
        found = []
        if _has_kanji(joined):
            for level, entry in _VOCAB_BY_LEMMA.get(joined, ()):
                if re.split(r"[/／;、,・]", entry.get("kanji") or "")[0].strip() == joined and \
                        reading in _reading_variants(entry.get("kana") or ""):
                    found.append((level, entry))
        else:
            for level, entry in _VOCAB_BY_KANA.get(morphology.kata_to_hira(joined), ()):
                if _ends_in(entry, "".join(tail)) and (not entry.get("kanji") or _ends_in(entry, "".join(tail))):
                    found.append((level, entry))
        found = [(level, entry) for level, entry in found if _ends_in(entry, "".join(tail))]
        if found:
            level, entry = min(found, key=lambda c: (bool(c[1].get("kanji")) and not _has_kanji(joined),
                                                      _level_rank(c[0])))
            return level, entry, vocab_to_id(entry, level), n
    return None


# What 何で asks "by what" with, written in kanji: 何で行きますか, "how
# will you go?", 何で書きますか.
_BY_WHAT = frozenset({"行く", "来る", "帰る", "通う", "送る", "運ぶ", "書く", "払う", "作る", "切る", "食べる",
                      "洗う", "拭く", "描く", "撮る", "連絡"})


def _what_word(morphemes, i: int):
    """(level, entry, raw_id, n) for the deck word 何 opens and UniDic
    cut (plan 272), or None: なん + で is なんで, "why" -- never 何で
    行きますか's "by what", asked of a way of going in kanji, nor
    なんでも's "anything" -- and なん + と + なく なんとなく, "somehow"."""
    m = morphemes[i]
    if m.pos != "pronoun" or m.lemma != "何" or m.reading != "なん" or i + 1 >= len(morphemes):
        return None
    nxt = morphemes[i + 1]
    after = morphemes[i + 2] if i + 2 < len(morphemes) else None
    if nxt.surface == "で" and nxt.pos == "particle":
        if after is not None and (after.surface == "も" or (_has_kanji(m.surface) and after.lemma in _BY_WHAT)):
            return None
        card = _card("何で", "なんで")
        return card + (2,) if card else None
    if nxt.surface == "と" and nxt.pos == "particle" and after is not None and after.surface == "なく" \
            and after.pos == "adjective":
        card = _card("", "なんとなく")
        return card + (3,) if card else None
    return None


def _polite_set_phrase(morphemes, i: int):
    """(level, entry, raw_id, n) for the deck's set phrase that a polite
    noun and its particle spell (plan 272): お + 先 + に is お先に, "excuse
    me for going first", never the prefix, "tip, end" and an adverb's に;
    お + 大事 + に お大事に, "take care"; おかげ + さま + で おかげさまで."""
    for n in (4, 3):
        run = morphemes[i:i + n]
        if len(run) < n or run[-1].surface not in ("に", "で") or run[-1].pos not in ("particle", "auxiliary"):
            continue
        if not ((run[0].pos == "prefix" and run[0].surface in ("お", "ご", "御"))
                or run[-2].surface in ("様", "さま")):
            continue
        if any(t.pos not in ("prefix", "noun", "other", "suffix") for t in run[:-1]):
            continue
        joined = "".join(t.surface for t in run)
        kana = morphology.kata_to_hira("".join(t.reading for t in run))
        cards = [(lv, e) for lv, e in _VOCAB_BY_KANA.get(kana, ())
                 if kana in _reading_variants(e.get("kana") or "") and _ends_in(e, run[-1].surface)
                 and (not e.get("kanji") or re.split(r"[/／;、,・]", e["kanji"])[0].strip() == joined)]
        if cards:
            level, entry = min(cards, key=lambda c: _level_rank(c[0]))
            return level, entry, vocab_to_id(entry, level), n
    return None


def resolve_pool_whole_word(morphemes, i: int):
    """(row, n) for the pool word a word and the particles after it spell
    where the deck has none (plan 272): なぜ + か is なぜか, "for some
    reason" -- never in a question asked or known, なぜか分からない; なん +
    か, なんか, "kind of, something" (the particle of お前なんか is a
    word of UniDic's own); 二 + 度 + と before a negative, 二度と, "never
    again"."""
    m = morphemes[i]
    nxt = morphemes[i + 1] if i + 1 < len(morphemes) else None
    if nxt is None:
        return None
    asked = lambda k: next((t.lemma in _ASKING for t in morphemes[k:k + 3] if t.pos == "verb"), False)
    if nxt.surface == "か" and nxt.pos == "particle" and (
            (m.pos == "adverb" and m.lemma == "何故") or (m.pos == "pronoun" and m.lemma == "何" and m.reading == "なん")):
        if asked(i + 2):
            return None
        kana = morphology.kata_to_hira(m.reading) + "か"
        row = jmdict_db.get_by_key(m.lemma + "か", kana)
        return (row, 2) if row is not None else None
    if m.surface == "二" and nxt.surface == "度" and i + 2 < len(morphemes) and morphemes[i + 2].surface == "と" \
            and morphemes[i + 2].pos == "particle":
        clause = []
        rest = morphemes[i + 3:]
        if rest and rest[0].pos == "symbol" and rest[0].surface in "、，,":
            rest = rest[1:]                # もう二度と、あの店には行くまい
        for t in rest:
            if t.pos == "symbol" and t.surface in "。！？!?、，,":
                break
            clause.append(t)
        # (...and the written negatives: 行くまい, 行くものか, plan 272)
        negative = any(t.lemma in ("ない", "無い", "ぬ", "ず", "ん", "まい") or t.surface in ("ません", "ごめん")
                       or (t.surface == "な" and t.pos == "particle") for t in clause) or (
            len(clause) >= 2 and clause[-2].surface in ("もの", "もん") and clause[-1].surface == "か")
        row = jmdict_db.get_by_key("二度と", "にどと") if negative else None
        return (row, 3) if row is not None else None
    return None


def resolve_te_noun(morphemes, i: int):
    """(level, entry, raw_id, 2) for a noun in kana the tokenizer read as
    a verb's て form (plan 272): ここできってを買う is きっ (切る) + て to
    UniDic, and a て form takes no を -- the page wrote 切手, "stamp".
    Only before を or が, which no て form is followed by, and only the
    deck's noun spelled so."""
    if i + 2 >= len(morphemes):
        return None
    verb, te, after = morphemes[i], morphemes[i + 1], morphemes[i + 2]
    if verb.pos != "verb" or not _hiragana(verb.surface) or not (te.conjunctive and te.surface in ("て", "で")):
        return None
    if after.pos != "particle" or after.surface not in ("を", "が"):
        return None
    joined = verb.surface + te.surface
    for level, entry in sorted(_VOCAB_BY_KANA.get(joined, ()), key=lambda c: _level_rank(c[0])):
        if joined in _reading_variants(entry.get("kana") or "") and not _verb_card(entry):
            return level, entry, vocab_to_id(entry, level), 2
    return None


def whole_word_spans(morphemes) -> list[tuple[int, int, int]]:
    """(start, where its particles start, end) of every word
    resolve_whole_word folds: the detector's own words, whose particles
    are letters (plan 272)."""
    out = []
    for i in range(len(morphemes)):
        hit = resolve_whole_word(morphemes, i)
        if hit:
            out.append((morphemes[i].start, morphemes[i + 1].start, morphemes[i + hit[3] - 1].end))
    return out


def _likely_whole(morphemes, i: int, n: int, joined: str) -> bool:
    """Whether the sentence reads the letters as the whole word: いつか
    and どうか are "when" and "how" in a question asked or known
    (いつか分からない, 行くかどうか), ともに is 〜とともに's after と."""
    before = morphemes[i - 1] if i > 0 else None
    after = morphemes[i + n] if i + n < len(morphemes) else None
    if joined.endswith("に") and after is not None and after.pos == "verb" and after.lemma in ("成る", "なる"):
        return False                   # 実になる, "to bear fruit": the に of "become"
    if joined in ("どうか",) and before is not None and before.surface == "か":
        return False
    if joined in ("ともに", "共に") and before is not None and before.surface == "と":
        return False
    if joined in ("いつか", "どうか"):
        for nxt in morphemes[i + n:i + n + 3]:
            if nxt.pos == "verb":
                return nxt.lemma not in _ASKING
            if nxt.pos not in ("particle", "symbol") or nxt.surface in ("。", "？", "?"):
                break
    return True


def resolve_adverb_tail(morphemes, i: int, hit) -> int:
    """2 where the adverb at `i` and the particle after it are one word
    its own card spells (plan 266) -- the N5 すぐ is written すぐ／すぐに,
    ゆっくり ゆっくり／ゆっくりと, and the に and the と said nothing beside
    them -- else 0. Only the card's own spellings: a に after any other
    adverb is a particle's."""
    if hit is None or i + 1 >= len(morphemes):
        return 0
    m, nxt = morphemes[i], morphemes[i + 1]
    if m.pos != "adverb" or nxt.pos != "particle" or nxt.surface not in ("に", "と"):
        return 0
    return 2 if m.surface + nxt.surface in _reading_variants(hit[1].get("kana") or "") else 0


def resolve_adverb_whole(morphemes, i: int):
    """("deck", (level, entry, raw_id)) or ("pool", row) for an adverb
    and the と or に after it that are one word the adverb alone is not
    (plan 272): さっ + と is the N1 さっと, "quickly", ガシッ + と the
    pool's ガシッと, "firmly", どさっ + と どさっと, "with a thud" -- a
    sound word's と is its own, and the breakdown showed a word with no
    meaning beside a と that said nothing. The joined spelling only, as
    the page writes it or in hiragana: a kana-only card, else a kana-only
    pool row."""
    if i + 1 >= len(morphemes):
        return None
    m, nxt = morphemes[i], morphemes[i + 1]
    if m.pos != "adverb" or nxt.pos != "particle" or nxt.surface not in ("と", "に"):
        return None
    joined = m.surface + nxt.surface
    for spelled in dict.fromkeys((joined, morphology.kata_to_hira(joined))):
        for level, entry in _VOCAB_BY_KANA.get(spelled, ()):
            if not entry.get("kanji") and spelled in _reading_variants(entry.get("kana") or ""):
                return "deck", (level, entry, vocab_to_id(entry, level))
    for spelled in dict.fromkeys((joined, morphology.kata_to_hira(joined))):
        for row in jmdict_db.by_kana(spelled):
            if not row["kanji"] and row["kana"] == spelled:
                return "pool", row
    return None


# The particles an idiom the deck teaches is written with.
_IDIOM_PARTICLES = frozenset({"を", "に", "が"})


def resolve_idiom(morphemes, i: int, max_len: int = 4):
    """(level, entry, raw_id, n) for a deck card written as a noun, a
    particle and a verb -- 気を付ける, 役に立つ, 気に入る, 間に合う -- that a
    run of `n` morphemes from `i` spells (plan 266). The tokenizer cuts
    each into its words, and the breakdown glossed 気をつけて as "spirit"
    + を + a verb with no card: the idiom's meaning, "to be careful", was
    nowhere on the line. Matched on the nouns as written and the verb's
    dictionary form, so every form of the verb reaches it (気をつけて,
    役に立った); the verb's endings stay rows of their own."""
    longest = min(max_len, len(morphemes) - i)
    for n in range(longest, 2, -1):
        run = morphemes[i:i + n]
        head, particle, verb = run[:-2], run[-2], run[-1]
        if (particle.pos != "particle" or particle.surface not in _IDIOM_PARTICLES
                or verb.pos != "verb" or any(m.pos not in ("noun", "prefix") for m in head)):
            continue
        written = "".join(m.surface for m in run[:-1])
        reading = morphology.kata_to_hira("".join(m.reading for m in run[:-1])) + verb.lemma_reading
        hit = resolve_lemma(written + verb.lemma, reading)
        if hit is None and all(_hiragana(m.surface) for m in head):
            # (Or as the deck writes it, the page in kana: きをつけて is
            # 気をつける, plan 272.)
            hit = resolve_lemma("".join(m.lemma for m in head) + particle.surface + verb.lemma, reading)
        if hit is not None:
            level, entry, raw_id = hit
            return level, entry, raw_id, n
    return None


# A godan verb's potential, back to the verb: 取れる 取る, 読める 読む.
_POTENTIAL_TO_PLAIN = {"れ": "る", "め": "む", "け": "く", "せ": "す", "て": "つ", "ね": "ぬ", "べ": "ぶ", "げ": "ぐ",
                       "え": "う"}


def resolve_pool_idiom(morphemes, i: int, max_len: int = 4):
    """(row, n) for an expression the JMdict pool holds that a noun, a
    particle and a verb spell, where the deck has none (plan 272): 気に
    なる, "to weigh on one's mind" -- never 気, "spirit", and 〜になる,
    "to become"; 気が済む, 腹が立つ. resolve_idiom's shape, the pool's
    row spelled as the page and read as it, tagged an expression, and
    only where its cards cannot say it (_said_by_its_figure): JMdict
    files 服を着る and 雨が降る as expressions too, and 服 and 着る say
    all of it."""
    longest = min(max_len, len(morphemes) - i)
    for n in range(longest, 2, -1):
        run = morphemes[i:i + n]
        head, particle, verb = run[:-2], run[-2], run[-1]
        # (...or an adjective after が or の: 息の長い支援, "sustained", no
        # "long-breathed"; 気が早い, plan 272)
        # -- never が + ない, いい, 多い: the course's own patterns, お金
        # がない "has no money" (罪のない, "innocent", folds) -- nor from
        # inside a word its prefix opens
        quality = verb.pos == "adjective" and particle.surface in ("が", "の") \
            and not (particle.surface == "が" and verb.lemma in _PLAIN_QUALITIES) \
            and not (i > 0 and morphemes[i - 1].pos == "prefix" and resolve_compound(morphemes, i - 1))
        if (particle.pos != "particle" or not (particle.surface in _IDIOM_PARTICLES or quality)
                or not (verb.pos == "verb" or quality) or any(m.pos not in ("noun", "prefix") for m in head)):
            continue
        before = "".join(m.surface for m in run[:-1])
        # (A particle as JMdict spells it: を, never its sound お.)
        said = morphology.kata_to_hira("".join(m.surface if m.pos == "particle" else m.reading for m in run[:-1]))
        # (JMdict may write the verb in kana: ひどい目に遭う is 目にあう. And
        # a potential is its verb's: 元を取れない is 元を取る's, which UniDic
        # files under 取れる.)
        verbs = [(verb.lemma, verb.lemma_reading)]
        if verb.lemma.endswith("る") and len(verb.lemma) >= 2 and verb.lemma[-2] in _POTENTIAL_TO_PLAIN \
                and verb.lemma_reading.endswith("る"):
            plain = _POTENTIAL_TO_PLAIN[verb.lemma[-2]]
            verbs.append((verb.lemma[:-2] + plain, verb.lemma_reading[:-2] + plain))
            if i > 0 and morphemes[i - 1].surface in ("お", "御"):
                verbs.reverse()             # お役に立てず: 役に立つ's, humbly -- no 役に立てる "to make use of"
        for written, reading in ((before + spelled, said + lemma_reading) for lemma, lemma_reading in verbs
                                 for spelled in dict.fromkeys((lemma, lemma_reading))):
            row = jmdict_db.get_by_key(written, reading)
            if row is None and _has_kanji(written):
                # (音を上げる is ねをあげる, whatever UniDic read 音 as: the
                # expression's one row by its spelling, plan 272)
                rows = [r for r in jmdict_db.by_kanji(written, limit=3) if r.get("kanji") == written]
                row = rows[0] if len(rows) == 1 else None
                reading = row["kana"] if row is not None else reading
            senses = jmdict_db.get_senses(written, reading) or [] if row is not None else []
            if row is not None and _said_by_its_figure(morphemes, i, n, row, senses):
                return row, n
    return None


# The adjectives a noun and が say as the course teaches them (plan 272).
_PLAIN_QUALITIES = frozenset({"無い", "ない", "良い", "いい", "よい", "多い", "少ない", "欲しい", "ほしい"})
# A noun the grammar writes on, never an idiom's: ことができる is 〜ことが
# できます, 中に入っていた物を言えば "say what was inside".
_FORMAL_HEADS = frozenset({"こと", "事", "もの", "物", "ところ", "所", "わけ", "訳", "ため", "為", "はず", "筈",
                           "つもり"})
# The expressions JMdict glosses by their figure alone whose letters are
# most often meant as written: 先生の話が分かりました is "I understood
# what the teacher said", no "down to earth".
_READ_AS_WRITTEN = frozenset({"話がわかる", "話が分かる"})
# JMdict's tags for a verb: v1, v5r, vs-i, vk, vz.
_VERB_TAG = re.compile(r"v(1|5|s|k|z)")


def _said_by_its_figure(morphemes, i: int, n: int, row: dict, senses: list) -> bool:
    """Whether a pool expression the run spells means what its cards
    cannot say, and so is read whole (plan 272): 気になる, 手に入れる,
    腹が立つ. Not where the verb's card or the noun's says it (服を着る,
    右に曲がる, 実を結ぶ's 実 "fruit"; 病気になる's 病気 "illness"), and
    not a row JMdict says is also meant as written ("(literally) to see
    the mountains": 高い山が見えます), said of a noun only (顔が見える,
    "identifiable", before 相手の顔が見えない), or written on a formal
    noun."""
    tags = {t for sense in senses for t in sense.get("tags") or ()}
    if morphemes[i + n - 1].pos == "adjective":
        if not tags & {"adj-i", "adj-ix"}:
            return False
    elif "exp" not in tags or not any(_VERB_TAG.match(t) for t in tags):
        return False
    if row.get("kanji") in _READ_AS_WRITTEN or any(m.surface in _FORMAL_HEADS for m in morphemes[i:i + n - 2]):
        return False
    if any(g.startswith("(literally)") for sense in senses for g in sense.get("glossary") or ()):
        return False
    said = _row_gloss_words(row)
    if morphemes[i + n - 1].pos == "adjective" and senses and senses[0].get("glossary"):
        # (an adjective's idiom by its first sense alone: 気が長い is
        # "patient" before "having a long fuse", plan 272)
        said = _gloss_words({"meaning": senses[0]["glossary"][0]})
    words = _gloss_stems(said)
    for k in (*range(i, i + n - 2), i + n - 1):
        hit = resolve_morpheme(morphemes, k)
        mine = _idiom_gloss_words(hit[1]) if hit else set()
        if hit and (words & _gloss_stems(mine) or _glosses_meet(said, mine)):
            return False
    return True


# English verbs light enough to stand in any idiom's gloss: 元を取る is
# "to get one's money's worth", and 取る's "to get (obtain)" says none of
# it; 電話に出る is no 出る "to take part" (plan 272).
_LIGHT_WORDS = frozenset({"take", "make", "get", "go", "come", "put", "have", "give", "do", "set", "keep", "let"})
_JAPANESE = re.compile(r"[\u3040-\u30ff\u4e00-\u9fff]")


def _idiom_gloss_words(entry: dict) -> set[str]:
    """A card's gloss words, as an idiom's check reads them: less a sense
    the card writes by the phrase it is read in (気's "attention (as in
    気にする)", 体's "health (as in 体にいい)"), which a pool idiom of the
    card says better (気を抜く, 体を壊す), and less a light verb (plan 272)."""
    senses = [part for part in re.split(r"[,;]", entry.get("meaning") or "") if not _JAPANESE.search(part)]
    return _gloss_words({"meaning": ",".join(senses)}) - _LIGHT_WORDS


_STEM_ENDINGS = ("ness", "ment", "ing", "ed", "ly", "s")


def _gloss_stems(words: set[str]) -> set[str]:
    """Gloss words less an English ending, so "illness" meets "ill" (病気
    and 病気になる, "to fall ill"), which _glosses_meet's four letters
    miss."""
    out = set()
    for w in words:
        for ending in _STEM_ENDINGS:
            if w.endswith(ending) and len(w) - len(ending) >= 3:
                w = w[:-len(ending)]
                break
        out.add(w)
    return out


def idiom_spans(morphemes) -> list[tuple[int, int, int]]:
    """(start, where its particle starts, end) of every idiom
    resolve_idiom or resolve_pool_idiom folds: its particle and its
    verb are the idiom's, no point's (plan 272)."""
    out = []
    for i in range(len(morphemes)):
        hit = resolve_idiom(morphemes, i)
        n = hit[3] if hit else (resolve_pool_idiom(morphemes, i) or (None, 0))[1]
        if n:
            out.append((morphemes[i].start, morphemes[i + n - 2].start, morphemes[i + n - 1].end))
    return out


# The endings a word the deck teaches whole can be cut from: 知らせる is
# 知ら + せる to UniDic, 思わず 思わ + ず.
_SPLIT_ENDINGS = frozenset({"せる", "させる", "ず"})


def resolve_split_word(morphemes, i: int):
    """(level, entry, raw_id, 2) for a deck word the tokenizer cut into a
    verb and an ending (plan 266): 知らせる, "to notify", is 知る + the
    causative せる to UniDic, and the breakdown read 知らせてください as
    "to know" with a せ that said nothing; 思わず, "unintentionally", is
    思う + ず. The deck's card written as the stem and the ending's
    dictionary form (知ら + せる) or as the two together (思わ + ず) is
    the word. A causative the deck does not teach as a word (書かせる)
    stays a verb and its 使役形."""
    if i + 1 >= len(morphemes):
        return None
    stem, ending = morphemes[i], morphemes[i + 1]
    if (stem.pos == "verb" and ending.pos == "auxiliary" and ending.surface == "ない"
            and _hiragana(stem.surface) and not (i > 0 and morphemes[i - 1].surface == "が")):
        # たまらない, "irresistible", is a word of its own, the deck's in
        # kana, never 溜まる, "to collect", made negative (plan 272) --
        # except with what collects as its subject: お金がたまらない.
        cards = _kana_cards(stem.surface + "ない")
        if cards:
            level, entry = min(cards, key=lambda c: _level_rank(c[0]))
            return level, entry, vocab_to_id(entry, level), 2
    if stem.pos != "verb" or ending.pos != "auxiliary" or ending.lemma not in _SPLIT_ENDINGS:
        return None
    reading = morphology.kata_to_hira(stem.reading)
    keys = ((stem.surface + ending.lemma, reading + morphology.kata_to_hira(ending.lemma_reading)),
            (stem.surface + ending.surface, reading + morphology.kata_to_hira(ending.reading)))
    for key, key_reading in keys:
        hit = resolve_lemma(key, key_reading, key)
        if hit is not None and hit[1].get("kanji") == key:
            return (*hit, 2)
    return None


# ── Numbers (plan 266) ─────────────────────────────────────────
_DIGIT_VALUES = {**{c: v for v, c in enumerate("〇一二三四五六七八九")},
                 **{c: v for v, c in enumerate("0123456789")},
                 **{c: v for v, c in enumerate("０１２３４５６７８９")}}
_UNIT_VALUES = {"十": 10, "百": 100, "千": 1000}
_MYRIAD_VALUES = {"万": 10 ** 4, "億": 10 ** 8, "兆": 10 ** 12}
_KANJI_NUMERALS = frozenset("〇一二三四五六七八九十百千万億兆")


def numeral_value(text: str) -> int | None:
    """The number a numeral written in kanji says -- 三十 is 30, 九千三百五十
    9350, 三万五千 35000, 二〇二六 2026 -- or None for any text that is
    not one, or carries no kanji numeral to read (2026 says itself)."""
    if not text or not any(c in _KANJI_NUMERALS for c in text):
        return None
    total = section = 0
    digits = None
    for c in text:
        if c in _DIGIT_VALUES:
            digits = _DIGIT_VALUES[c] if digits is None else digits * 10 + _DIGIT_VALUES[c]
        elif c in _UNIT_VALUES:
            section += (1 if digits is None else digits) * _UNIT_VALUES[c]
            digits = None
        elif c in _MYRIAD_VALUES:
            section += digits or 0
            total += (section or 1) * _MYRIAD_VALUES[c]
            section, digits = 0, None
        else:
            return None
    return total + section + (digits or 0)


def _find_segments_morphological(text: str):
    """Preferred scan path (see find_segments_in_text): tokenize with a
    real morphological analyzer instead of guessing word boundaries by
    substring, then resolve each token to a deck entry by its
    DICTIONARY FORM (lemma) rather than its literal on-the-page
    spelling. This one change is what makes conjugated words (要る ->
    いらない), kana-only spellings of a kanji word (温い -> ぬるい), and
    correct particle separation (今日 + は, not こんにちは) all just
    work, without any of the special-cased variant-matching the legacy
    path below needs — a tokenizer already normalizes all of that for
    us, and it only ever proposes matches at real word boundaries, so
    the boundary-safety heuristics the legacy path needs are moot here
    too.
    """
    morphemes = morphology.tokenize(text)
    if morphemes is None:
        return None

    n = len(text)
    covered = [False] * n
    vocab_hits = []  # (start, end, level, entry, raw_id)

    i = 0
    while i < len(morphemes):
        m = morphemes[i]

        # Two-token merge first (longest-match-first, same principle as
        # the legacy scan): catches deck entries MeCab tokenizes as more
        # than one morpheme, which in practice is just date/count
        # compounds (二日 = 二 + 日) — see _index_vocab_by_lemma's
        # numeral-variant keys. The two readings joined pick between
        # entries sharing the written form, as resolve_compound's do, and
        # let a folded spelling merge only read as it was folded (再来 +
        # 年 is さ来年; 何 + 時 read なんじ is not いつ). Across a particle
        # there is no reading, so no fold merges there: 彼 + の and 所 +
        # で spell folds (あの, ところで), and are "his" and "at the
        # place" far more often than either.
        if i + 1 < len(morphemes):
            m2 = morphemes[i + 1]
            merged = m.surface + m2.surface
            crosses = "particle" in (m.pos, m2.pos)
            hit = resolve_lemma(merged, "" if crosses else m.reading + m2.reading)
            if hit:
                level, entry, raw_id = hit
                vocab_hits.append((m.start, m2.end, level, entry, raw_id))
                for k in range(m.start, m2.end):
                    covered[k] = True
                i += 2
                continue

        hit = resolve_morpheme(morphemes, i)
        if hit:
            level, entry, raw_id = hit
            vocab_hits.append((m.start, m.end, level, entry, raw_id))
            for k in range(m.start, m.end):
                covered[k] = True
        i += 1

    # Grammar-pattern matching (_grammar_hits) was removed in the 2026-08
    # AI-segmentation rewrite — see the note on GRAMMAR_STATUS_MODE above.
    kanji_hits = _kanji_fallback_hits(text, covered)
    return _assemble_segments(text, vocab_hits, [], kanji_hits)


def find_segments_in_text(text: str):
    """
    Scan raw, unsegmented text (e.g. a generated reading-practice
    phrase) for clickable vocab/grammar/kanji badges, in reading order.

    Prefers real tokenization (morphology.py, MeCab-based) — see
    _find_segments_morphological — and falls back to the older
    dictionary-substring scan (_find_segments_legacy) only if that's
    unavailable in this deploy. Grammar-pattern matching only happens
    on the morphology-based path (see _grammar_hits for why); the
    legacy fallback still recognizes vocab/kanji, just not grammar.

    Returns a list of segments covering the whole string, in order:
        {"text": "...", "start": int, "end": int, "type": "vocab"|"grammar"|"kanji"|"plain",
         "category": ..., "level": ..., "raw_id": ..., "entry": {...}}
        (category/level/raw_id/entry omitted for "plain")
    """
    segments = _find_segments_morphological(text)
    if segments is not None:
        return segments
    return _find_segments_legacy(text)


def _vocab_candidates():
    """All (surface, level, entry, risky) quadruples the greedy scan
    below can match against, longest first — built once at import time
    so dictionary scanning doesn't redo this per request.

    Ties (same surface length) are broken by JLPT level, lowest first. This
    matters when several entries share the same surface form (e.g. 歩 as
    the everyday word "marcher" vs. the shogi piece "fu"/pawn): without a
    known reading to disambiguate against (this function scans raw,
    unsegmented text), the greedy scan below just takes whichever
    candidate comes first — so we make sure that's the common one.

    Beyond each entry's own dictionary-form surface, this also registers
    alternate real-world spellings a real sentence commonly uses instead
    (二日 -> 2日, 御飯 -> ご飯, 温い -> ぬるい) — see vocab_extras'
    numeral_variant / kana_spelling_variants / is_usually_kana. Every
    variant maps back to the SAME (level, entry) as the canonical form.

    `risky` marks a surface as bare kana with no kanji backing it (a
    kana-only entry, a kana_spelling_variant, or a "usually kana"
    reading) — these can coincidentally span the tail of one real word
    and the head of another (see the boundary-safety block above), so
    the scanner only accepts them when the surrounding text passes
    _left_boundary_ok/_right_boundary_ok. The kanji form itself and the
    numeral variant are NOT flagged risky: kanji strings are distinctive
    enough, and digit swaps specific enough, that this class of
    collision isn't a practical concern for them.
    """
    candidates = []
    for level, vocab_list in VOCAB_BY_LEVEL.items():
        for entry in vocab_list:
            word = entry.get("kanji") or entry.get("word") or entry.get("vocab") or ""
            kana = entry.get("kana") or entry.get("reading") or ""
            if word:
                candidates.append((word, level, entry, False))

                numeral = vocab_extras.numeral_variant(word)
                if numeral:
                    candidates.append((numeral, level, entry, False))

                for variant in vocab_extras.kana_spelling_variants(word):
                    candidates.append((variant, level, entry, True))

                if kana and vocab_extras.is_usually_kana(word, kana):
                    for reading in _reading_variants(kana):
                        if len(reading) >= 2:
                            candidates.append((reading, level, entry, True))
            elif kana:
                # Kana-only deck entries (no kanji field at all) were
                # previously dropped entirely here — nothing to match
                # them against besides their own kana form. Same risk
                # class as any other bare-kana surface, so also flagged
                # risky (and length-gated: a single kana character is
                # far too likely to collide with something unrelated).
                for reading in _reading_variants(kana):
                    if len(reading) >= 2:
                        candidates.append((reading, level, entry, True))
    candidates.sort(key=lambda c: (-len(c[0]), _level_rank(c[1])))
    return candidates


_VOCAB_CANDIDATES = _vocab_candidates()


def _find_segments_legacy(text: str):
    """
    Fallback path used only when morphology.MORPHOLOGY_AVAILABLE is
    False (fugashi/unidic-lite not installed) — see
    find_segments_in_text for the preferred, morphology-based path.

    Scans raw, unsegmented text against the vocab deck using greedy
    longest-match, then checks any leftover kanji characters against
    the kanji deck individually.

    Bare-kana candidates (see _vocab_candidates' `risky` flag) are only
    accepted when _left_boundary_ok/_right_boundary_ok both pass — a
    kanji-form match is always trusted, but a kana-only surface (which
    could just be a coincidental substring straddling two unrelated
    words, e.g. お金は|いらない mis-matching "はい") has to look clean
    on both sides first. When a risky candidate fails that check, the
    scan simply falls through to the next (shorter) candidate at this
    position rather than accepting it — worst case, that position ends
    up unmatched "plain" text instead of a wrong badge. Real
    tokenization (the morphology-based path) makes this whole class of
    problem moot by only ever considering matches at real word
    boundaries in the first place, which is why that path is preferred
    whenever it's available.
    """
    n = len(text)
    covered = [False] * n
    vocab_hits = []  # (start, end, level, entry, raw_id)

    i = 0
    while i < n:
        matched = False
        for word, level, entry, risky in _VOCAB_CANDIDATES:
            length = len(word)
            if length == 0 or i + length > n:
                continue
            if text[i:i + length] != word:
                continue
            if risky and not (_left_boundary_ok(text, i, covered) and _right_boundary_ok(text, i + length)):
                continue
            raw_id = vocab_to_id(entry, level)
            vocab_hits.append((i, i + length, level, entry, raw_id))
            for k in range(i, i + length):
                covered[k] = True
            i += length
            matched = True
            break
        if not matched:
            i += 1

    kanji_hits = _kanji_fallback_hits(text, covered)
    return _assemble_segments(text, vocab_hits, [], kanji_hits)


def attach_stats_to_segments(segments: list, states: dict, user_id: str) -> list:
    """Add a "stats" dict to each non-plain segment, using the right mode per type."""
    modes = {"vocab": VOCAB_STATUS_MODES}
    enriched = []
    for seg in segments:
        if seg["type"] == "plain":
            enriched.append(seg)
            continue
        seg_modes = modes.get(seg["type"], KANJI_STATUS_MODES)
        enriched.append({**seg, "stats": card_stats(states, user_id, seg["raw_id"], seg_modes)})
    return enriched