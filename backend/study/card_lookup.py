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


def resolve_morpheme(morphemes, i: int):
    """(level, entry, raw_id) for the deck entry morphemes[i] is, by its
    lemma first and its reading second, or None -- the one way every
    screen resolves a word (study/analysis, level_mix, the reading-badge
    scanner, scripts/audit_vocab_deck), so "off-deck" means the same
    thing everywhere. The neighbour before it is what resolve_kana's
    auxiliary admission needs: whether this token hangs off a
    conjunctive て/で."""
    hit = _resolve_morpheme(morphemes, i)
    if hit is not None and _there_is(morphemes, i):
        return hit
    if hit is not None and morphemes[i].pos == "adverb" and (hit[1].get("kanji") or "") == "嗚呼":
        # ああ the adverb is "like that" (ああいう, ああすれば): the
        # exclamation 嗚呼 is an interjection's card (plan 272).
        cards = _kana_cards(morphemes[i].surface)
        return min(((lv, e, vocab_to_id(e, lv)) for lv, e in cards), key=lambda c: _level_rank(c[0]),
                   default=None)
    return _kana_verb(morphemes[i], hit)


def _resolve_morpheme(morphemes, i: int):
    m = morphemes[i]
    previous = morphemes[i - 1] if i > 0 else None
    after_conjunctive = previous is not None and previous.pos == "particle" and previous.conjunctive
    if m.auxiliary_use and after_conjunctive:
        # A verb hanging off a conjunctive て/で in its auxiliary use is
        # the grammar point's, not a word's (plan 106): ている, てくる,
        # てみる, ておく, てしまう are all catalogue points, and the row
        # opens the point. The lemma path used to answer here anyway and
        # badged 食べてしまった with the N1 仕舞う card.
        return None
    by_lemma = resolve_lemma(m.lemma, m.lemma_reading, m.surface)
    hit = by_lemma or resolve_kana(
        m.lemma_reading, m.pos, m.auxiliary_use, after_conjunctive, m.surface, m.goshu,
    )
    if hit is not None and _kana_word_instead(m, hit[1]):
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


def _form_of(cform: str) -> str:
    """The form a kana spelling can be shared in, or "": the dictionary
    form, and the plain stems. A sound-changed stem (すいて, はいた,
    おいて: イ音便, 促音便) is a godan verb's alone and spells its own."""
    form, _, kind = cform.partition("-")
    if form in ("終止形", "連体形") or (form in _GODAN_STEM and kind == "一般"):
        return form
    return ""


def _conjugated(kana: str, ctype: str, cform: str) -> str:
    """The verb read `kana` in its dictionary form, of conjugation class
    `ctype`, as it is spelled in `cform` -- for the forms a kana stem can
    be shared in (the dictionary form, the stem before ます and before
    ない) -- or "" for any other."""
    form = _form_of(cform)
    if form in ("終止形", "連体形"):
        return kana
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
    form = _form_of(cform)
    if form in ("終止形", "連体形"):
        return {stem}
    if form not in _GODAN_STEM:
        return set()
    out = {stem + "る"}
    out |= {stem[:-1] + u for u, k in _GODAN_STEM[form].items() if stem.endswith(k)}
    if stem == ("き" if form == "連用形" else "こ"):
        out.add("くる")
    return out


@lru_cache(maxsize=4096)
def _verb_class(written: str) -> str:
    """UniDic's conjugation class for a deck verb written `written` on
    its own, or "" when the tokenizer does not read it as one verb."""
    morphemes = morphology.tokenize(written) or []
    if len(morphemes) != 1 or morphemes[0].pos != "verb":
        return ""
    return morphemes[0].ctype


def _deck_verbs_spelled(m) -> list[tuple[str, dict, str]]:
    """(level, entry, raw_id) for every deck verb a token written in
    hiragana could be, read off its spelling and its conjugation form
    alone, or [] for any other token."""
    if (m.pos != "verb" or not m.cform or not m.surface
            or any(is_kanji(c) for c in m.surface) or _katakana_written(m.surface)):
        return []
    stem = morphology.kata_to_hira(m.surface)
    out = []
    for reading in _dictionary_forms(stem, m.cform):
        for level, entry in _VOCAB_BY_KANA.get(reading, ()):
            written = re.split(r"[/／;、,・]", entry.get("kanji") or "")[0].strip() or reading
            ctype = _verb_class(written)
            if ctype and _conjugated(reading, ctype, m.cform) == stem:
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


def _kana_verb(m, hit):
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
    spelled = _deck_verbs_spelled(m)
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
_COMPOUND_MAX = 3


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
    if i > 0 and morphemes[i - 1].pos != "symbol":
        return None
    longest = min(max_len, len(morphemes) - i)
    for n in range(longest, 1, -1):
        run = morphemes[i:i + n]
        if i + n < len(morphemes) and morphemes[i + n].pos != "symbol" and not _joins_on(morphemes, i + n):
            continue
        # (A verb in auxiliary use may open it (plan 266): はじめまして is
        # 始める + ます + て, and 始める is a 〜はじめる to UniDic wherever it
        # stands. Its stand is what keeps 食べてしまった's しまった out.)
        if any(m.pos == "symbol" for m in run):
            continue
        if not any(m.pos in ("verb", "auxiliary") for m in run):
            continue
        surface = "".join(m.surface for m in run)
        for level, entry in _VOCAB_BY_KANA.get(surface, ()):
            if not entry.get("kanji") and entry.get("kana") == surface:
                return level, entry, vocab_to_id(entry, level), n
    return None


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
        if any(m.pos not in _COMPOUND_POS or m.auxiliary_use for m in run):
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
                level, entry, raw_id = hit
                return level, entry, raw_id, n
    return None


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
    for kana in dict.fromkeys((written, _to_katakana(written))):
        hit = jmdict_db.get_by_key("", kana)
        if hit is not None:
            return hit
    return None


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


def pool_gloss(row: dict, senses: int = 3) -> str:
    """A pool word's line in the breakdown: the first gloss of each of
    its first senses, not the first sense alone -- 盛り read もり is
    "serving (of food)" first and "pile, heap" after, 物 read ぶつ
    "stock" first and "goods" after, and the sentence may use either
    (plan 151). An affix row keeps the one sense it was chosen for."""
    if row.get("affix"):
        return row.get("meaning", "")
    glosses = []
    for sense in (jmdict_db.get_senses(row.get("kanji", ""), row.get("kana", "")) or [])[:senses]:
        first = next(iter(sense.get("glossary") or ()), "")
        if not first or first in glosses:
            continue
        if glosses and len("; ".join(glosses + [first])) > _POOL_GLOSS_MAX:
            break
        glosses.append(first)
    return "; ".join(glosses) or row.get("meaning", "")


# A breakdown row is one line: past this, a later sense waits for the
# entry, which lists them all.
_POOL_GLOSS_MAX = 60


def resolve_pool_morpheme(morphemes, i: int) -> dict | None:
    """The JMdict pool entry morphemes[i] is, by its dictionary form
    first and as written second, or None. Asked only for a token the
    deck has no card for (see the note above)."""
    m = morphemes[i]
    if m.pos in _AFFIX_TAGS:
        return _pool_affix(m, morphemes[i - 1] if i > 0 else None,
                           morphemes[i + 1] if i + 1 < len(morphemes) else None)
    if m.pos not in _POOL_POS or not _japanese(m.surface) or _numeral(m.surface):
        # A number is the deck's to read (its numeral compounds).
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
    if written and not written <= set(lemma):
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
    if hit is not None and not inflects and not _has_kanji(m.surface):
        # Written in kana and not inflected, the page spells the word's
        # reading outright, and a row read otherwise is UniDic's guess
        # at a word it does not know: まじか (slang, "seriously?") comes
        # back as 間近, read まぢか, "near".
        spelled = morphology.kata_to_hira(m.surface)
        if morphology.kata_to_hira(hit["kana"]) not in (spelled, *_said_as(spelled)):
            # (A word drawn out in speech is the word it draws out:
            # ただいまー is ただいま, plan 272.)
            return None
    return hit


# The suffixes that go on any noun and make no new word of it: 人 + 達
# is 人 said of several, and folding it would take 人's N5 card away.
_PRODUCTIVE_SUFFIXES = frozenset("達等共方様君殿氏")


def _word_forming(m) -> bool:
    """A suffix in kanji that makes a word of the noun before it (者,
    家, 所, 書), as opposed to one that goes on any noun (達, 様)."""
    return (m.pos == "suffix" and _has_kanji(m.surface)
            and not any(c in _PRODUCTIVE_SUFFIXES for c in m.surface))


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
        if any(m.pos not in _COMPOUND_POS or m.auxiliary_use or _numeral(m.surface) for m in run):
            continue
        if all(deck_hits[i + k] for k, m in enumerate(run) if m.pos == "noun" or _word_forming(m)):
            # (A suffix with no card of its own counts too (plan 151):
            # 参加 + 者 read しゃ is 参加者, "participant", where 者's card
            # is もの and was a wrong reading on it.)
            continue
        if any(resolve_compound(morphemes, j) and j + resolve_compound(morphemes, j)[3] > i + n
               for j in range(i + 1, i + n)):
            # A deck compound starts inside this run and reaches past it
            # (…日曜 + 日): the deck's word is not cut in half for ours.
            continue
        reading = "".join(m.reading for m in run)
        for key in dict.fromkeys(("".join(m.surface for m in run), "".join(m.lemma for m in run))):
            if not _has_kanji(key):
                continue
            hit = _pool_by_form(key, (reading,))
            if hit is not None:
                return hit, n
    return None


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
    return before.pos in ("particle", "auxiliary", "verb", "adjective", "interjection")


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
    (EVALUATIONS): the 願い of それでお願いします as the いい of それでいい."""
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


def _utterance_end(morphemes, end: int) -> bool:
    return end >= len(morphemes) or (morphemes[end].pos == "symbol"
                                     and morphemes[end].surface in "。．！？!?」』）)…")


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
    if not _utterance_start(morphemes, i):
        return None
    longest = min(max_len, len(morphemes) - i)
    for n in range(longest, 1, -1):
        run = morphemes[i:i + n]
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
        if hit is not None:
            level, entry, raw_id = hit
            return level, entry, raw_id, n
    return None


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