"""
Shared helpers for cross-referencing arbitrary Japanese text against the
existing vocab/kanji decks and the user's SRS state. Used by both the
phrase analyzer and the reading-practice mode.
"""

from content.vocab_data import VOCAB_BY_LEVEL, vocab_to_id
from content.kanji_data import KANJI_BY_LEVEL, kanji_to_id
from study.modes import KANA, KANJI, VOCAB, GRAMMAR, STATUS_MODES
from content import vocab_extras
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
    return [r.strip() for r in kana_field.split(';') if r.strip()]


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
         signal — e.g. from the phrase analyzer's LLM segmentation).
      2. Otherwise, the entry from the lowest (most common) JLPT level,
         since niche secondary meanings tend to be introduced later.
      3. Otherwise, whichever candidate came first (stable fallback).
    """
    if not candidates:
        return None

    if reading:
        for level, entry, entry_kana in candidates:
            if _reading_matches(entry_kana, reading):
                return level, entry

    return min(candidates, key=lambda c: _level_rank(c[0]))[:2]


def is_kanji(char: str) -> bool:
    return "\u4e00" <= char <= "\u9fff"


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
    twice). The 13 that remain are NOT a spelling problem, and no
    richer index will reach them -- 母, 父, 顔, 百円, 洋食, 大雨,
    失礼, 説明書, 館内, 支援, 専門家, お客様 and 言い方 are absent
    from the deck under every spelling (母 and 父 appear only as
    お母さん / お父さん, which are different words, not variants). They
    need deck entries or different focus words.
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

    Conventional kana spellings (御飯 -> ご飯, 食べ物 -> 食べもの) are keys
    too, but ONLY the ones that still contain a kanji. A tokenizer
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
    the answer to one that already succeeded. Three deck words carry
    both spellings as separate entries at different levels (御馳走 N2
    and ご馳走 N1, likewise 御無沙汰, 御手洗い); merging those
    candidate lists would hand ご馳走 to _pick_best_candidate's
    lowest-level tie-break and silently repoint the word from its N1
    card to the N2 one, moving the badge off whatever SRS history the
    learner already has. Whether the deck should hold the same word
    twice is a separate question from this index.
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
            for variant in vocab_extras.kana_spelling_variants(word):
                if variant == word or variant in index:
                    continue
                if any(is_kanji(c) for c in variant):
                    index.setdefault(variant, []).append((level, entry))
    return index


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
    match already tried in the caller comes up empty."""
    index = {}
    for level, vocab_list in VOCAB_BY_LEVEL.items():
        for entry in vocab_list:
            kana = entry.get("kana") or entry.get("reading") or ""
            if not kana:
                continue
            for reading in _reading_variants(kana):
                index.setdefault(reading, []).append((level, entry))
    return index


_VOCAB_BY_LEMMA = _index_vocab_by_lemma()
_VOCAB_BY_KANA = _index_vocab_by_kana()


def resolve_lemma(lemma: str, reading: str):
    """(level, entry, raw_id) for the deck entry whose kanji field is
    `lemma`, disambiguated by `reading` when several entries share that
    lemma text (see _index_vocab_by_lemma), or None."""
    candidates = _VOCAB_BY_LEMMA.get(lemma)
    if not candidates:
        return None
    triples = [(level, entry, entry.get("kana") or entry.get("reading") or "") for level, entry in candidates]
    best = _pick_best_candidate(triples, reading)
    if best is None:
        return None
    level, entry = best
    return level, entry, vocab_to_id(entry, level)


def resolve_kana(reading: str, pos: str, auxiliary_use: bool):
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
    words being used on their own, not that class of match."""
    if auxiliary_use or pos not in ("noun", "pronoun", "verb", "adjective") or len(reading) < 2:
        return None
    candidates = _VOCAB_BY_KANA.get(reading)
    if not candidates:
        return None
    level, entry = min(candidates, key=lambda c: _level_rank(c[0]))
    return level, entry, vocab_to_id(entry, level)


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
        # numeral-variant keys.
        if i + 1 < len(morphemes):
            m2 = morphemes[i + 1]
            merged = m.surface + m2.surface
            hit = resolve_lemma(merged, "")
            if hit:
                level, entry, raw_id = hit
                vocab_hits.append((m.start, m2.end, level, entry, raw_id))
                for k in range(m.start, m2.end):
                    covered[k] = True
                i += 2
                continue

        hit = resolve_lemma(m.lemma, m.lemma_reading) or resolve_kana(m.lemma_reading, m.pos, m.auxiliary_use)
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