"""
Shared helpers for cross-referencing arbitrary Japanese text against the
existing vocab/kanji decks and the user's SRS state. Used by both the
phrase analyzer and the reading-practice mode.
"""

from vocab_data import VOCAB_BY_LEVEL, vocab_to_id
from kanji_data import KANJI_BY_LEVEL, kanji_to_id
from quiz_modes import STATUS_MODE
import vocab_extras
import morphology

# Representative mode used to gauge "do I know this word/kanji" for the
# clickable badges — see quiz_modes.py for the reasoning. Both vocab and
# kanji use the same mode here, but they're kept as separate names since
# nothing requires them to always match.
VOCAB_STATUS_MODE = STATUS_MODE
KANJI_STATUS_MODE = STATUS_MODE

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


def _surface_variants(word: str, kana: str) -> list:
    """Alternate real-world spellings of a deck word's `word` (kanji/
    surface) field that an actual sentence — a JMdict/Tatoeba example,
    or a real-word reading-practice phrase — commonly uses instead of
    the deck's own dictionary-form spelling:

      - Arabic-digit spelling of a kanji numeral (二日 -> 2日).
      - The conventional partial-kana spelling for a small hand-picked
        set of kanji (御飯 -> ご飯).
      - The word's own kana reading, but only when JMdict tags it
        "usually kana" — see vocab_extras.is_usually_kana for why this
        isn't done for every kanji-having word.

    Does not include `word` itself. See vocab_extras.py, which this
    reuses rather than re-deriving the same logic here.
    """
    if not word:
        return []
    variants = []
    numeral = vocab_extras.numeral_variant(word)
    if numeral:
        variants.append(numeral)
    variants.extend(vocab_extras.kana_spelling_variants(word))
    if kana and vocab_extras.is_usually_kana(word, kana):
        variants.extend(r for r in _reading_variants(kana) if len(r) >= 2)
    return variants


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


def card_stats(states: dict, user_id: str, raw_id: str, mode: str) -> dict:
    """Full per-card SRS stats for a detail panel, not just a status label."""
    item = states.get((f"{user_id}:{raw_id}", mode))
    if item is None:
        return {
            "status": "not_started",
            "total_reviews": 0,
            "correct_reviews": 0,
            "accuracy": None,
            "due": False,
            "interval_days": None,
            "next_review": None,
        }
    total = item["total_reviews"]
    accuracy = round(item["correct_reviews"] / total * 100, 1) if total > 0 else None
    return {
        "status": item["state"],
        "total_reviews": total,
        "correct_reviews": item["correct_reviews"],
        "accuracy": accuracy,
        "due": item["due"],
        "interval_days": item["interval_days"],
        "next_review": item["next_review"],
    }


def find_vocab_match(surface: str, base: str, reading: str):
    """
    Best-effort lookup of a single (already-segmented) word against the
    vocab deck — used by the phrase analyzer, which gets word boundaries
    from the LLM.

    Several deck entries can share the same kanji surface (e.g. 歩 as the
    everyday word "marcher" vs. the shogi piece "fu"/pawn) with different
    readings and meanings. We disambiguate using the reading supplied by
    the LLM rather than silently returning whichever entry happens to
    come first in the deck; see _pick_best_candidate for the fallback
    order when no reading matches.

    NOTE: assumes vocab entries expose kanji/kana-ish fields similar to
    kanji_data entries. Field names are a guess — adjust the .get(...)
    calls below if vocab_data.py uses different keys.
    """
    kanji_candidates = []      # entries whose kanji field (or a known spelling variant) == surface/base
    kana_only_candidates = []  # entries with no kanji field, or "usually kana" entries matched by reading alone

    for level, vocab_list in VOCAB_BY_LEVEL.items():
        for entry in vocab_list:
            entry_word = entry.get("kanji") or entry.get("word") or entry.get("vocab") or ""
            entry_kana = entry.get("kana") or entry.get("reading") or ""
            if entry_word and (entry_word in (surface, base) or any(
                v in (surface, base) for v in _surface_variants(entry_word, entry_kana)
            )):
                kanji_candidates.append((level, entry, entry_kana))
            elif entry_kana and _reading_matches(entry_kana, reading) and (
                not entry_word or vocab_extras.is_usually_kana(entry_word, entry_kana)
            ):
                kana_only_candidates.append((level, entry, entry_kana))

    best = _pick_best_candidate(kanji_candidates, reading) or _pick_best_candidate(kana_only_candidates, reading)
    if best is None:
        return None

    level, entry = best
    return level, entry, vocab_to_id(entry, level)


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


def _assemble_segments(text: str, vocab_hits: list, kanji_hits: list):
    """Merge vocab + kanji hits into one ordered, non-overlapping list of
    segments covering the whole string, filling gaps with plain text —
    shared tail of both scan paths so their output shape stays identical."""
    n = len(text)
    hits = sorted(vocab_hits + kanji_hits, key=lambda h: h[0])
    segments = []
    cursor = 0
    for start, end, level, entry, raw_id in hits:
        if start > cursor:
            segments.append({"text": text[cursor:start], "start": cursor, "end": start, "type": "plain"})
        seg_type = "vocab" if (start, end, level, entry, raw_id) in vocab_hits else "kanji"
        segments.append({
            "text": text[start:end], "start": start, "end": end, "type": seg_type,
            "level": level, "raw_id": raw_id, "entry": serializable_entry(entry),
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


def _resolve_lemma(lemma: str, reading: str):
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


def _resolve_kana(reading: str, pos: str, auxiliary_use: bool):
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
            hit = _resolve_lemma(merged, "")
            if hit:
                level, entry, raw_id = hit
                vocab_hits.append((m.start, m2.end, level, entry, raw_id))
                for k in range(m.start, m2.end):
                    covered[k] = True
                i += 2
                continue

        hit = _resolve_lemma(m.lemma, m.lemma_reading) or _resolve_kana(m.lemma_reading, m.pos, m.auxiliary_use)
        if hit:
            level, entry, raw_id = hit
            vocab_hits.append((m.start, m.end, level, entry, raw_id))
            for k in range(m.start, m.end):
                covered[k] = True
        i += 1

    kanji_hits = _kanji_fallback_hits(text, covered)
    return _assemble_segments(text, vocab_hits, kanji_hits)


def find_segments_in_text(text: str):
    """
    Scan raw, unsegmented text (e.g. a generated reading-practice
    phrase) for clickable vocab/kanji badges, in reading order.

    Prefers real tokenization (morphology.py, MeCab-based) — see
    _find_segments_morphological — and falls back to the older
    dictionary-substring scan (_find_segments_legacy) only if that's
    unavailable in this deploy.

    Returns a list of segments covering the whole string, in order:
        {"text": "...", "start": int, "end": int, "type": "vocab"|"kanji"|"plain",
         "level": ..., "raw_id": ..., "entry": {...}}   (level/raw_id/entry omitted for "plain")
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
    return _assemble_segments(text, vocab_hits, kanji_hits)


def attach_stats_to_segments(segments: list, states: dict, user_id: str) -> list:
    """Add a "stats" dict to each non-plain segment, using the right mode per type."""
    enriched = []
    for seg in segments:
        if seg["type"] == "plain":
            enriched.append(seg)
            continue
        mode = VOCAB_STATUS_MODE if seg["type"] == "vocab" else KANJI_STATUS_MODE
        enriched.append({**seg, "stats": card_stats(states, user_id, seg["raw_id"], mode)})
    return enriched