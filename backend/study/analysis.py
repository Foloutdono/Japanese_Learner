# ── The local analysis tier ───────────────────────────────────────
# Everything a Sentence breakdown needs that a language model is NOT
# required for: segmentation, readings, furigana, deck matches, SRS
# status, grammar points, JLPT grading. All of it is composed from
# modules that already existed -- morphology.tokenize (MeCab/UniDic),
# card_lookup's resolvers, furigana.align_deck, difficulty's grammar and
# level machinery -- none of which the phrase analyzer used before this.
#
# The one thing genuinely missing here is the contextual gloss ("what
# does this word mean IN THIS SENTENCE") and the prose explanation --
# both need a model, and both stay out of this module on purpose. See
# docs/adr/0001-two-tier-sentence-analysis.md for the split this module
# is one half of.
#
# analyze_local MUST stay pure: no database, no user_id, no imports from
# core/. That purity is what lets one Sentence's analysis be computed
# once and shared across every learner who asks about it -- attach_user_state
# is the separate, per-user half.
import logging

from content.grammar_points_data import find, grammar_to_id
from study import morphology
from study.grammar_detect import NO_GOOD_VERBS, compound_particles, no_good_points
from content.vocab_jmdict_data import vocab_jmdict_to_id
from study.card_lookup import (
    resolve_morpheme, resolve_compound, compound_reading,
    resolve_pool_morpheme, resolve_pool_compound, pool_gloss,
    find_kanji_matches, find_segments_in_text, card_stats, serializable_entry,
    VOCAB_STATUS_MODES, KANJI_STATUS_MODES, GRAMMAR_STATUS_MODES,
)
from study.furigana import align_deck
from translations import fr_gloss
from translations.fr.vocab_fr import VOCAB_FR
from study import difficulty
from study import grammar_detect

logger = logging.getLogger(__name__)

# Content-word part-of-speech classes, per morphology.py's _POS_MAP. Used
# to decide what counts toward unknown_count / off_deck_count below --
# particles and auxiliaries are grammar scaffolding, not vocabulary a
# learner is expected to have "learned" as a card.
_CONTENT_POS = frozenset({"noun", "verb", "adjective", "adverb"})
# The public name, for study/level_mix.py -- one definition, not three.
CONTENT_POS = _CONTENT_POS


def _grammar_entries(sentence: str, morphemes=None) -> list[dict]:
    """grammar_detect's hits, resolved to a real catalogue entry and a
    card id. A hit that can't be resolved is dropped (logged, not
    raised) rather than shipped as a chip with nothing behind it --
    never hand-construct the id string, since grammar_to_id's format is
    the one place that's allowed to know it.

    `kind` rides along: "marker" for a point that IS one grammatical
    word (は, です／だ), "pattern" for one built around a word
    (〜ます／〜ません). Both are cards and both open; what differs is
    where a screen puts them, since a chip strip of は・が・を over every
    sentence is wallpaper while the same point on the row of that very
    particle is the answer to "what is this ん doing here".

    `morphemes` is the tokenization the caller already has, so a
    breakdown reads the sentence once.

    `meaning` and `structure` (plan 095) are the catalogue's own one-line
    gloss and formation, so a chip can say what the rule does without
    the learner opening its sheet -- 〜ながら is "while", and nobody
    should have to press it to learn that. The gloss travels as the
    catalogue's {en, fr} pair rather than in one language: this result
    is pure and shared across every learner who asks about the sentence
    (see the module docstring), and which language the reader is in is
    the screen's to decide (frontend grammarGloss.js). The comprehension
    result's points (routes/reading.py) were already localised on the
    server into a plain string; the same reader takes both.

    `segments` (plan 095) is where on the sentence the point is written,
    as [start, end] pieces -- one for a point written in one piece, one
    per part for から〜まで, whose `start`..`end` reaches over a clause
    it does not own. A screen that shows where a rule sits lights the
    pieces (frontend grammarSpans.js); the tokens a point covers are
    the pieces' tokens (_attach_grammar).
    """
    out = []
    for hit in grammar_detect.hits(sentence, morphemes):
        pattern, level = hit["pattern"], hit["level"]
        found = find(pattern)
        entry = found[1] if found and found[0] == level else None
        if entry is None:
            logger.debug("detect hit %r/%s has no catalogue entry; dropped", pattern, level)
            continue
        meaning = entry.get("meaning")
        out.append({
            "pattern": pattern,
            "level": level,
            "start": hit["start"],
            "end": hit["end"],
            "segments": [list(seg) for seg in hit["segments"]],
            "kind": hit["kind"],
            "raw_id": grammar_to_id(entry, level),
            # A copy, never the catalogue's own dict: this result is
            # cached and handed around, and nothing downstream may be
            # able to edit the catalogue through it.
            "meaning": dict(meaning) if isinstance(meaning, dict) else (meaning or ""),
            "structure": entry.get("structure", ""),
        })
    return out


def _attach_grammar(tokens: list[dict], grammar: list[dict]) -> None:
    """Give every token the points written on it, in place.

    This is what makes a grammar point reachable the way a word is: the
    rows under a sentence are the learner's map of it, and until now a
    row like 「へ」 was the one kind of row that went nowhere -- no deck
    entry, no card, nothing to press -- while the rule it is an instance
    of sat in a chip below, unconnected to the word that demonstrates
    it. A point covering a token is that token's own rule, so the row
    opens it.

    Covering means written on one of the point's `segments`, not lying
    anywhere under its span: から〜まで reaches from から to まで, and
    the 家 between them is not an instance of it. Attached by span, a
    stage card for 家 listed から〜まで as that word's rule (plan 095).
    """
    for token in tokens:
        start, end = token["start"], token["end"]
        token["grammar"] = [
            # The occurrence's own offsets ride along, so the row that
            # opens a marker can light the very particle it is in the
            # line above -- the same point twice in a sentence is two
            # lights, not one (frontend grammarSpans.js).
            {k: g[k] for k in ("pattern", "level", "raw_id", "kind", "meaning", "structure",
                               "start", "end", "segments")}
            for g in grammar
            if any(s < end and start < e for s, e in g["segments"])
        ]


def _pool_match(entry: dict) -> dict:
    """A JMdict pool word as a token's vocab_match (plan 148): the same
    shape as a deck word's, so every screen that glosses a word, opens
    its entry or adds it to a deck reads it where it already reads one,
    with `level` null -- the pool has no JLPT level, and a null level is
    what draws no badge -- and `pool` saying so outright. The entry is
    cut to the three fields a screen reads: a video session stores the
    analysis of every line it holds (routes/video.py)."""
    return {
        "level": None,
        "raw_id": vocab_jmdict_to_id(entry),
        "entry": {"kanji": entry.get("kanji", ""), "kana": entry.get("kana", ""),
                  "meaning": pool_gloss(entry)},
        "pool": True,
    }


def _deck_match(level: str, entry: dict, raw_id: str) -> dict:
    """A deck card as a token's vocab_match, its French gloss beside its
    English one (plan 160). The analysis is pure and shared across
    learners, so it cannot know the reader's language, and carries both,
    as a grammar point carries its {en, fr}; the screen reads its own
    (frontend tokens.js's wordGloss). The French is the card's own line
    (plan 107's per-card key, then the form's), and absent where the
    card has none, so a screen falls back to the English."""
    out = {"level": level, "raw_id": raw_id, "entry": serializable_entry(entry)}
    french = fr_gloss(entry, VOCAB_FR)
    if french:
        out["entry"]["meaning_fr"] = french
    return out


def _token_dict(m: morphology.Morpheme, hit, pool=None) -> dict:
    """`hit` is card_lookup.resolve_morpheme's answer for `m`, resolved
    by the caller, which has the neighbours the resolver reads; `pool`
    is resolve_pool_morpheme's, asked only where `hit` is None."""
    vocab_match = None
    if hit:
        level, entry, raw_id = hit
        vocab_match = _deck_match(level, entry, raw_id)
    elif pool:
        vocab_match = _pool_match(pool)

    kanji_matches = [
        {"kanji": char, "level": level, "raw_id": raw_id, "entry": serializable_entry(entry)}
        for char, level, entry, raw_id in find_kanji_matches(m.surface)
    ]

    # Furigana goes over the surface AS WRITTEN, so it uses `reading`
    # (the inflected reading) -- not `lemma_reading`, which is the
    # dictionary form's reading and can differ from what's on the page.
    furigana = align_deck(m.surface, m.reading)

    return {
        "surface": m.surface, "start": m.start, "end": m.end,
        "lemma": m.lemma, "reading": m.reading, "pos": m.pos,
        "furigana": furigana,
        "vocab_match": vocab_match,
        "kanji_matches": kanji_matches,
    }


def _compound_dict(run: list, level: str, entry: dict, raw_id: str) -> dict:
    """One token for a run of morphemes the deck teaches as one word
    (card_lookup.resolve_compound, plan 102). Its surface and offsets
    are the run's, so the sentence still rebuilds from the tokens and a
    grammar point written on any part of it still lands on it; its
    reading is the entry's, since the morphemes' joined would misread
    it (にちよう + ひ for にちようび); its lemma is the entry's written
    form, which is what the run spells. A noun, as everything
    resolve_compound admits is."""
    surface = "".join(m.surface for m in run)
    reading = compound_reading(entry, run)
    return {
        "surface": surface, "start": run[0].start, "end": run[-1].end,
        "lemma": entry.get("kanji") or surface, "reading": reading, "pos": "noun",
        "furigana": align_deck(surface, reading),
        "vocab_match": _deck_match(level, entry, raw_id),
        "kanji_matches": [
            {"kanji": char, "level": lvl, "raw_id": rid, "entry": serializable_entry(e)}
            for char, lvl, e, rid in find_kanji_matches(surface)
        ],
    }


def _pool_compound_dict(run: list, entry: dict) -> dict:
    """_compound_dict for a run the JMdict pool holds as one word
    (card_lookup.resolve_pool_compound, plan 148): 桃源 + 郷 as 桃源郷."""
    surface = "".join(m.surface for m in run)
    reading = entry.get("kana") or "".join(m.reading for m in run)
    return {
        "surface": surface, "start": run[0].start, "end": run[-1].end,
        "lemma": entry.get("kanji") or surface, "reading": reading, "pos": "noun",
        "furigana": align_deck(surface, reading),
        "vocab_match": _pool_match(entry),
        "kanji_matches": [
            {"kanji": char, "level": lvl, "raw_id": rid, "entry": serializable_entry(e)}
            for char, lvl, e, rid in find_kanji_matches(surface)
        ],
    }


def _in_grammar(morphemes: list, grammar: list[dict]) -> set[int]:
    """The indices of the morphemes a grammar point is written on (its
    `segments`, as _attach_grammar reads them)."""
    return {
        j for j, m in enumerate(morphemes)
        if any(s < m.end and m.start < e for g in grammar for s, e in g["segments"])
    }


_COUNTERS = "助数詞 〜つ／〜人／〜枚"


def _tokens(morphemes: list, grammar: list[dict] | None = None) -> list[dict]:
    """The morphemes as tokens, a deck compound folded into one.

    UniDic's short unit cuts 日曜日 into 日曜 + 日, and per-morpheme
    lookup then matched each half to a card of its own -- Sunday at N3
    and day at N4 under a sentence written to teach the N5 word. The
    reading-badge scanner (card_lookup._find_segments_morphological)
    has merged such runs since it was written; the breakdown never
    did. Longest run first, so お母さん is one word and not お + 母さん.

    The deck answers first, the JMdict pool after (plan 148): a run the
    pool holds as one word where the deck has no card for one of its
    nouns (桃源 + 郷), then each word the deck has no card for, looked
    up alone. So every word the app holds a card for -- in the course or
    past it -- carries its meaning and can be put in a deck.

    Never a word a grammar point is written on (`grammar`, the
    sentence's detected points): the しれ of かもしれない is 知れる in the
    pool, ござい is 御座い, 際し is 際する, and a row with no deck word
    in it opens its point (frontend rows) -- a pool gloss there would
    trade the lesson for a dictionary line about one of its letters.
    """
    deck_hits = [resolve_morpheme(morphemes, j) for j in range(len(morphemes))]
    ruled = _in_grammar(morphemes, grammar or [])
    # A counter the counters' point lights is that point's to explain:
    # 三本's 本 is no "book" (plan 151). A card that is itself the
    # counter (冊, 匹) stays, and so does a word (二人, "two people").
    counted = _in_grammar(morphemes, [g for g in grammar or [] if g.get("pattern") == _COUNTERS])
    deck_hits = [None if (j in counted and hit and morphemes[j].pos == "suffix"
                          and "counter" not in (hit[1].get("meaning") or "")) else hit
                 for j, hit in enumerate(deck_hits)]
    # The verb of a compound particle is the point's, not a word of its
    # own: について's つい is no 着く "to arrive", において's おい no 置く
    # "to put", にたいして no 大して "not very" (plan 152). Its row opens
    # the point.
    compounds = compound_particles()
    bound = _in_grammar(morphemes, [g for g in grammar or [] if g.get("pattern") in compounds])
    deck_hits = [None if j in bound and morphemes[j].pos in ("verb", "adverb") else hit
                 for j, hit in enumerate(deck_hits)]
    # So is the negated verb of a "must" or a "must not": 〜てはいけません's
    # いけ is no 行く "to go", 〜なければならない's なら no 成る "to become"
    # (plan 160). Its row is the point's.
    held = _in_grammar(morphemes, [g for g in grammar or [] if g.get("pattern") in no_good_points()])
    deck_hits = [None if j in held and morphemes[j].pos == "verb" and morphemes[j].lemma in NO_GOOD_VERBS else hit
                 for j, hit in enumerate(deck_hits)]
    # A pool run may not take in a morpheme a point is written on; a
    # deck hit stands in for "has a card" there, which is all
    # resolve_pool_compound asks of it.
    pool_hits = [hit or (j in ruled) for j, hit in enumerate(deck_hits)]
    tokens = []
    i = 0
    while i < len(morphemes):
        hit = resolve_compound(morphemes, i)
        if hit:
            level, entry, raw_id, n = hit
            tokens.append(_compound_dict(morphemes[i:i + n], level, entry, raw_id))
            i += n
            continue
        pooled = None if i in ruled else resolve_pool_compound(morphemes, i, pool_hits)
        if pooled and not any(j in ruled for j in range(i, i + pooled[1])):
            entry, n = pooled
            tokens.append(_pool_compound_dict(morphemes[i:i + n], entry))
            i += n
            continue
        deck = deck_hits[i]
        pool = None if deck or i in ruled else resolve_pool_morpheme(morphemes, i)
        tokens.append(_token_dict(morphemes[i], deck, pool))
        i += 1
    return tokens


# The local tier's revision. Its answer is made again on every request,
# except where a caller keeps one: a video session stores the analysis
# of every line it was built with (routes/video.py), and would go on
# showing a line as it was first read for as long as the session is
# kept. Bump this when a change makes the local tier answer differently
# for a sentence it has already answered -- the tokenizer, the grammar
# detector, the lookups -- and a stored session analysed under another
# revision (or before there was one) is analysed again when next opened.
# 1: offsets past a space (every particle after a subtitle's first
# space was lost) and the plain copula after a noun (2026-09-25).
# 2: the JMdict pool after the deck -- a word the course does not teach
# carries its meaning and its card (plan 148).
# 3: the grammar detector reads what a point attaches to by kind of
# word, the copula's and a pattern's final word's forms, and the plain
# past and negative (plan 149).
# 4: no false key and no false meaning (plan 150) -- the particles the
# tokenizer cannot tell apart (でも, とは, とか), a multi-part point's
# tightest reading, 何でも／誰でも as its own point; and no card for a
# word that only sounds like the token (郷 is not 号, センス not 扇子),
# the N5 する／なる／いい over their N3 and N1 twins.
# 5: what eight reviewers found (plan 151) -- each point's homographs
# refused (obligation is no prohibition, the volitional of 〜ようとする
# no "let's", a compound particle's に no moment), 〜も（強調） and the
# mixed "must" halves found, a counter after a number; no card read
# otherwise than the token (彼ら's ら is not 等), a suffix folded into
# its word (参加者) or given its affix sense, a pool word's first senses.
# 6: readings spelled rather than pronounced (大きい おおきい, not
# おうきい) and put right in context (お母さん's 母 かあ, 一本 いっぽん;
# study/reading_context.py), which is every row's reading and furigana
# -- 2 on main while plans 148-151 were open on their branch.
# 7: what the detector could not see (plan 152) -- the embedded
# question, polite hearsay, a point in its other spelling (に従って,
# 事が出来る, 時 read とき); and no card for the verb of a compound
# particle (について's つい is no 着く).
# 8: no card for the negated verb of a "must" or a "must not" (plan
# 160: 〜てはいけません's いけ is no 行く "to go"), a word a point is
# written on and has no card not counted off-deck, and every deck
# card's French gloss beside its English one (`meaning_fr`).
LOCAL_REV = 8


def analyze_local(text: str, level: str | None = None) -> dict:
    """Everything about a Sentence that needs no language model. Pure and
    user-independent, therefore cacheable and shareable across learners.

    `level` is the level to grade against; when omitted, grading uses the
    sentence's own estimated level (falling back to N5 if the sentence
    fits no level at all -- report() needs *some* level to grade against
    even for a sentence that fits nothing).
    """
    morphemes = morphology.tokenize(text)
    if morphemes is None:
        # No fallback to a worse analysis here -- see the module
        # docstring. A caller renders "analysis unavailable", not a
        # silently degraded one.
        return {
            "text": text, "tokens": [], "grammar": [],
            "level": None, "grade": None, "available": False,
        }

    grammar = _grammar_entries(text, morphemes)
    tokens = _tokens(morphemes, grammar)
    _attach_grammar(tokens, grammar)
    # Segmented once for both: left to them, estimate_level and report
    # each segment the sentence again for every level they try.
    segments = find_segments_in_text(text)
    estimated = difficulty.estimate_level(text, segments)
    grade_level = level or estimated or "N5"

    return {
        "text": text,
        "tokens": tokens,
        "grammar": grammar,
        "level": estimated,
        "grade": difficulty.report(text, grade_level, segments),
        "available": True,
    }


def attach_user_state(analysis: dict, states: dict, user_id: str) -> dict:
    """Add per-learner SRS stats to an analyze_local result. Returns a
    NEW dict -- analyze_local's result is cacheable and shared, so this
    must never mutate its argument."""
    if not analysis.get("available"):
        return dict(analysis)

    tokens = []
    unknown_count = 0
    off_deck_count = 0

    for tok in analysis["tokens"]:
        new_tok = dict(tok)
        vocab_match = tok.get("vocab_match")
        kanji_matches = tok.get("kanji_matches") or []
        is_content_word = tok.get("pos") in _CONTENT_POS

        if vocab_match:
            new_tok["vocab_match"] = {
                **vocab_match,
                "stats": card_stats(states, user_id, vocab_match["raw_id"], VOCAB_STATUS_MODES),
            }
        if kanji_matches:
            new_tok["kanji_matches"] = [
                {**k, "stats": card_stats(states, user_id, k["raw_id"], KANJI_STATUS_MODES)}
                for k in kanji_matches
            ]

        # Off-deck (no card anywhere) vs. unknown (a card that isn't
        # learned yet) are counted separately and are NEVER the same
        # bucket: an off-deck word is something the app cannot teach,
        # not something the learner failed to learn. Merging the two
        # would make every real-world sentence -- every OCR'd photo,
        # every video caption -- look impossible, and would make the
        # i+1 signal (exactly one unknown word) permanently false on
        # exactly the input this feature exists to handle.
        #
        # A JMdict pool word (plan 148) the learner has never taken up
        # is still off-deck in that sense -- the course does not teach
        # it, the learner simply CAN now -- so it counts where it always
        # did. Once it is in the learner's SRS it is a word of theirs
        # like any other and counts the way a deck word does.
        # A word a construction is written on, with no card of its own,
        # is the construction's (〜てはいけません's いけ, について's つい;
        # plans 152 and 160): no word the app cannot teach.
        ruled = not vocab_match and any(g.get("kind") != "marker" for g in tok.get("grammar") or [])
        if is_content_word and not ruled:
            status = new_tok["vocab_match"]["stats"]["status"] if vocab_match else None
            if vocab_match and not (vocab_match.get("pool") and status == "not_started"):
                if status in ("not_started", "new"):
                    unknown_count += 1
            elif not kanji_matches:
                off_deck_count += 1

        tokens.append(new_tok)

    grammar = [
        {**g, "stats": card_stats(states, user_id, g["raw_id"], GRAMMAR_STATUS_MODES)}
        for g in analysis["grammar"]
    ]
    # The stats onto the token's own copy, which keeps its occurrence
    # (its offsets) rather than taking the sentence-level entry's: a
    # point found twice has one card and two places.
    stats_by_id = {g["raw_id"]: g["stats"] for g in grammar}
    for tok in tokens:
        if tok.get("grammar"):
            tok["grammar"] = [
                {**g, "stats": stats_by_id[g["raw_id"]]} if g["raw_id"] in stats_by_id else g
                for g in tok["grammar"]
            ]

    return {
        **analysis,
        "tokens": tokens,
        "grammar": grammar,
        "unknown_count": unknown_count,
        "off_deck_count": off_deck_count,
    }


def merge_deep(analysis: dict, llm_words: list[dict], explanation: str,
               llm_grammar: list[dict] | None = None, translation: str = "") -> dict:
    """Fold the deep tier's per-word glosses and prose explanation onto
    Tokens the local tier already verified -- and its per-point notes
    onto the grammar the local tier found (plan 095), and the sentence's
    translation beside the explanation (plan 161).

    The tokenizer is the authority on segmentation: only `meaning` is
    copied from an LLM word onto its matched Token. Everything else --
    surface, reading, pos, offsets, vocab_match, kanji_matches -- comes
    from the local tier and wins. An LLM word matching no Token is a
    hallucinated boundary and is DROPPED rather than shown; the count of
    drops is returned as "deep_dropped" so a caller can see it happened
    (see docs/adr/0001-two-tier-sentence-analysis.md).

    Matching walks both lists forward by surface text, so a repeated
    word (e.g. two occurrences of は) binds to occurrences in order
    rather than every occurrence binding to the first match.

    A word may bind to a RUN of consecutive Tokens whose surfaces
    concatenate to it. A model cuts words the way a dictionary does
    (会いました) where the tokenizer cuts morphemes (会い / まし / た),
    and matching exact surfaces alone dropped the gloss of every
    conjugated verb and adjective -- the words a learner most needs
    glossed. The run's first Token carries the meaning and a `span_end`
    (the index of the run's last Token) so a renderer can show the run
    as the one word it is; the segmentation itself is still the
    tokenizer's, and every other field on every Token in the run is
    untouched.

    `llm_grammar` is the model's [{pattern, note}], one line per point
    the caller listed for it (routes/phrase._deep_points): what the
    pattern does IN THIS SENTENCE, which is the one thing the
    catalogue's gloss cannot say. The local tier is the authority on
    which points are there: a note lands on the entry -- and on every
    token's copy of it -- whose pattern it names, and a note for a
    pattern the sentence does not use is dropped, exactly as a word the
    tokenizer does not confirm is. A model may echo the pattern with
    its spaces trimmed; nothing looser is matched.

    Returns a NEW dict; does not mutate `analysis` -- the local analysis
    is cacheable and may be shared with a caller that never buys the
    deep tier.
    """
    tokens = [dict(t) for t in analysis.get("tokens", [])]
    used = [False] * len(tokens)
    dropped = 0

    notes: dict[str, str] = {}
    for item in llm_grammar or []:
        if not isinstance(item, dict):
            continue
        pattern, note = item.get("pattern"), item.get("note")
        if isinstance(pattern, str) and isinstance(note, str) and pattern.strip() and note.strip():
            notes.setdefault(pattern.strip(), note.strip())
    grammar = [
        {**g, "note": notes[g["pattern"]]} if g.get("pattern") in notes else dict(g)
        for g in analysis.get("grammar", [])
    ]
    if notes and not any("note" in g for g in grammar):
        logger.debug("deep tier noted %d point(s) the sentence does not use", len(notes))
    for tok in tokens:
        if tok.get("grammar"):
            tok["grammar"] = [
                {**g, "note": notes[g["pattern"]]} if g.get("pattern") in notes else g
                for g in tok["grammar"]
            ]

    for word in llm_words:
        surface = word.get("surface", "")
        meaning = word.get("meaning")
        span = _find_run(tokens, used, surface) if surface else None
        if span is None:
            dropped += 1
            continue
        start, end = span
        if meaning:
            tokens[start]["meaning"] = meaning
        if end > start:
            tokens[start]["span_end"] = end
        for i in range(start, end + 1):
            used[i] = True

    return {
        **analysis,
        "tokens": tokens,
        "grammar": grammar,
        "explanation": explanation,
        "translation": translation.strip() if isinstance(translation, str) else "",
        "deep_dropped": dropped,
    }


def _find_run(tokens: list[dict], used: list[bool], surface: str) -> tuple[int, int] | None:
    """(start, end) of the first unused run of Tokens whose surfaces
    concatenate to `surface`, or None. Forward, first match wins, so
    repeated words bind in order."""
    for start in range(len(tokens)):
        if used[start]:
            continue
        built = ""
        for end in range(start, len(tokens)):
            if used[end]:
                break
            built += tokens[end]["surface"]
            if built == surface:
                return start, end
            if not surface.startswith(built):
                break
    return None


def analyze_with_glosses(text: str, words: list[dict] | None, level: str | None = None) -> dict:
    """analyze_local(text, level) with a model's per-word glosses folded
    on, and no prose explanation. Pure, like both halves: the reading
    comprehension generator has the glosses in hand from the same call
    that wrote the text, so no second model call is bought for them."""
    return merge_deep(analyze_local(text, level), words or [], "")
