"""
Is this sentence actually at this JLPT level?

Reading practice used to answer that with one test: does the sentence
contain any kanji outside the level's allowed set (see reading.py's
`_sentence_kanji_ok`). That is a real constraint but a small one, and it
let through most of what actually makes a sentence hard. Measured on the
N5 pool, the kanji gate alone served:

    その人たちはココに新しいペットをあげようとしました。   -- 〜ようとする, N3
    先生、アソコがかゆいんです。                           -- 〜んです, N4
    少しテレビを見てもいいですか。                          -- fine, by luck

Every one of those is written in N5 kanji. Difficulty in Japanese lives
in the GRAMMAR and the VOCABULARY at least as much as in the characters,
so this grades all three.

── The three gates ───────────────────────────────────────────
kanji     every kanji in the sentence is in the level's cumulative set
          (N3 means N5 + N4 + N3). Unchanged from what reading.py had.

grammar   no grammar point ABOVE the level appears. The catalogue
          (content/grammar_points.json, 205 points across five levels)
          already carries the level of each point, and study/grammar_match
          already knows how to spot one in a sentence -- this is those two
          facts put together.

vocab     every word the app's own deck recognises is learnable at or
          below the level. A word is taken at its EASIEST deck level: if
          a surface appears in both N5 and N1, an N5 learner knows it,
          and the N1 entry is an unrelated rarer sense of the same
          string. Words the deck does not know at all are not counted
          against the sentence -- the deck is 8k words, not a language,
          and treating "unknown" as "hard" would reject most sentences
          for their particles.

── Why the grammar gate is span-aware ────────────────────────
Grammar patterns nest. 〜ても (N4) is a substring of 〜てもいいです (N5),
so a plain substring test reports an N4 point inside a perfectly N5
sentence and the gate rejects its own level's material. Matching records
WHERE each pattern hit, and an above-level hit only counts when it lands
somewhere no at-or-below-level pattern already explains.
"""
import re
from functools import lru_cache

from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL
from content.kanji_data import get_kanji_string
from content.vocab_data import VOCAB_BY_LEVEL
from study.grammar_match import stems, verifiable

# Easiest first. Everything here is an index into this list, so "at or
# below N3" is a slice rather than a table of five sets.
LEVELS: tuple[str, ...] = ("N5", "N4", "N3", "N2", "N1")

_RANK = {lvl: i for i, lvl in enumerate(LEVELS)}


def rank(level: str | None) -> int:
    """A level's difficulty index, or -1 for None/unknown.

    -1 rather than a large number on purpose: an unknown level must never
    make a sentence look HARDER than it is, or every gate below would
    reject on missing data.
    """
    return _RANK.get(level or "", -1)


def _is_kanji(c: str) -> bool:
    return "一" <= c <= "鿿"


# ── Kanji ─────────────────────────────────────────────────────
@lru_cache(maxsize=None)
def kanji_set(level: str) -> frozenset:
    """Every kanji learnable at or below `level` (JLPT is cumulative)."""
    idx = rank(level)
    if idx < 0:
        return frozenset()
    # get_kanji_string takes a SEQUENCE of levels, not one level: handed
    # the bare string "N5" it iterates its characters and matches nothing,
    # which silently makes every kanji look out-of-level.
    return frozenset(get_kanji_string(LEVELS[: idx + 1]))


def kanji_over_level(sentence: str, level: str) -> list[str]:
    """The kanji in `sentence` that `level` has not reached yet."""
    allowed = kanji_set(level)
    seen, out = set(), []
    for c in sentence:
        if _is_kanji(c) and c not in allowed and c not in seen:
            seen.add(c)
            out.append(c)
    return out


# ── Vocabulary ────────────────────────────────────────────────
@lru_cache(maxsize=1)
def _vocab_level_index() -> dict[str, str]:
    """surface form -> EASIEST deck level it appears at.

    Both the written form and every packed reading are registered, since
    a sentence may spell a word either way (見る / みる). Easiest wins:
    see the module docstring for why a surface shared by an N5 word and
    an N1 one is an N5 word for this purpose.
    """
    index: dict[str, str] = {}
    for level in LEVELS:
        for word in VOCAB_BY_LEVEL.get(level, []):
            forms = [word.get("kanji", "")]
            forms += [k.strip() for k in (word.get("kana", "") or "").split("/")]
            for form in forms:
                if form and form not in index:
                    index[form] = level
    return index


def word_level(surface: str) -> str | None:
    """The easiest deck level `surface` is taught at, or None if the deck
    does not carry it."""
    return _vocab_level_index().get(surface)


def _splits_within(surface: str, limit: int) -> bool:
    """Whether `surface` reads as a run of easier words joined together.

    The segmenter is greedy over a dictionary that contains phrases as
    well as words, so it hands back 今日は as one match -- and 今日は is a
    real deck entry, the N1 spelling of こんにちは. Taken at face value
    that makes 「今日は何をしますか。」 an N1 sentence over a word it does
    not contain. Any two-or-more-piece split into at-or-below-level deck
    words is enough to say the hard reading is not the one in play; a
    word with no such split (かゆい) is genuinely the word it looks like.
    """
    index = _vocab_level_index()

    def walk(rest: str, pieces: int) -> bool:
        if not rest:
            return pieces >= 2
        for size in range(len(rest), 0, -1):
            head = rest[:size]
            # A whole-string match is the reading being ruled out, not a
            # split, so it can never be the first and only piece.
            if size == len(rest) and pieces == 0:
                continue
            lvl = index.get(head)
            if lvl is not None and rank(lvl) <= limit and walk(rest[size:], pieces + 1):
                return True
        return False

    return walk(surface, 0)


# ren'yōkei (連用形) -> dictionary form. A godan verb's stem ends in the
# i-row kana of its own column; the dictionary form ends in the u-row one.
_RENYOKEI = {"き": "く", "ぎ": "ぐ", "し": "す", "ち": "つ", "に": "ぬ",
             "び": "ぶ", "み": "む", "り": "る", "ひ": "ふ"}


def _is_inflection_of_easier(surface: str, limit: int) -> bool:
    """Whether `surface` is a conjugated form of a verb at or below `limit`.

    The tokeniser splits 行きます into 行き + ます, and 行き on its own is a
    real deck noun ("a going", N3) -- so the gate reported an N3 word in
    「学校へ行きます。」, whose verb is the N5 行く. Mapping the stem back
    through the ren'yōkei rule finds the verb the sentence actually used.
    Also covers the ichidan/te-form case (食べ -> 食べる, 飲ん -> 飲む is
    handled by the euphonic entry below).
    """
    index = _vocab_level_index()
    candidates = [surface + "る"]                      # ichidan stem: 食べ -> 食べる
    tail = _RENYOKEI.get(surface[-1:])
    if tail:
        candidates.append(surface[:-1] + tail)         # godan stem: 行き -> 行く
    for form in candidates:
        lvl = index.get(form)
        if lvl is not None and rank(lvl) <= limit:
            return True
    return False


def vocab_over_level(sentence: str, level: str, segments=None) -> list[tuple[str, str]]:
    """(word, its level) for every deck word in `sentence` above `level`.

    `segments` is find_segments_in_text's output when the caller already
    has it; recomputed here otherwise. The segmenter's OWN level is
    ignored in favour of word_level() -- it reports the level of whichever
    dictionary entry it matched, which for a common surface is often an
    obscure homograph (it files いい as N1).

    Three things are deliberately not counted.

    A KANA-ONLY segment. The index registers each entry's readings as
    well as its written form, so a run of kana matches any harder word
    that happens to be READ that way -- and the segmenter emits verb
    stems and auxiliaries as segments. Measured over a draft of the
    curated bank, kana-only matches produced twelve false rejections
    (から as 殻 "husk" N2, ます as 増す N3, しか as 歯科 "dentistry" N1,
    まま as 間々 N1, にくい as 憎い N2) against one true one. A word
    actually written in kanji is matched on the spelling, where that
    collision cannot happen.

    A ONE-CHARACTER segment: at that length the segmenter is as likely to
    have sliced a longer word (it cuts こ out of がっこう on a spaced
    sentence) as to have found a real word.

    And a segment that splits into easier words -- see _splits_within.
    """
    if segments is None:
        from study.card_lookup import find_segments_in_text
        segments = find_segments_in_text(sentence)

    limit = rank(level)
    seen, out = set(), []
    for seg in segments:
        text = seg.get("text", "")
        if not text or len(text) < 2 or text in seen:
            continue
        if not any(_is_kanji(c) for c in text):
            continue
        lvl = word_level(text)
        if lvl is None or rank(lvl) <= limit:
            continue
        if _splits_within(text, limit) or _is_inflection_of_easier(text, limit):
            continue
        seen.add(text)
        out.append((text, lvl))
    return out


# ── Grammar ───────────────────────────────────────────────────
# Constructions the catalogue does not list, mapped to the level that
# first teaches them. 205 points is a syllabus, not an inventory of the
# language, and the gaps are not obscure -- they are some of the most
# common things a real sentence does. Measured on the N5 corpus fallback,
# these five families accounted for most of what still got through:
#
#   〜んです     explanatory の. 「アソコがかゆいんです。」 read as N5.
#   〜ていただく  humble request. 「会っていただけませんか。」
#   お〜する      the catalogue HAS this (お〜になる／お〜する) but it is a
#                 circumfix, so grammar_match reports it unverifiable and
#                 skips it -- these are its actual surfaces.
#   〜れる passive  the catalogue states it as a conjugation class
#                 (受身形 〜られる), which a substring test cannot check.
#                 These are the fixed forms that occur constantly.
#   formal connectives  すなわち / したがって / および and friends.
#
# Kept deliberately short and surface-exact. Every entry here is a string
# that means one thing; anything ambiguous belongs in the catalogue with
# a real pattern behind it, not in a shortcut list.
EXTRA_MARKERS: dict[str, tuple[str, ...]] = {
    "N4": (
        "んです", "んだ", "んだい", "のです", "のだ",
        "ていただけ", "ていただき", "ていただく",
        "お聞きし", "お待ちし", "お願いし", "ご覧", "いらっしゃ", "ございま",
        "でしょうか",
    ),
    "N3": (
        "行われ", "使われ", "言われ",
        "ざるを", "ではないか",
    ),
    "N2": (
        "すなわち", "したがって", "および", "ならびに", "いわゆる",
    ),
}


# Catalogue points whose surface is also an ordinary everyday string, so
# finding it says nothing about which grammar is at work. They stay in the
# catalogue -- they are real points and the Grammar section teaches them --
# they just cannot serve as EVIDENCE here.
#
# This is the same line grammar_match._UNVERIFIABLE draws for bare
# particles, one step further out: those cannot be checked at all, these
# can be checked and are simply wrong too often to trust.
#
#   〜にして    inside ようにして, にしては, っぱなしにして
#   〜あまり    あまり is the everyday adverb "not much"
#   〜上で      「机の上で」 is "on the desk"
#   〜出す      出す is a plain verb, "to take out"
#   〜直す      直す is a plain verb, "to fix"
#   〜にあって  「そこにあって」 is just "being there"
GATE_BLIND: frozenset[str] = frozenset({
    "〜にして", "〜あまり", "〜上で", "〜出す", "〜直す", "〜にあって",
})


@lru_cache(maxsize=1)
def _checkable_points() -> list[tuple[str, str, tuple[str, ...]]]:
    """(level, pattern, stems) for every catalogue point a substring test
    can honestly check. See grammar_match.verifiable for what it excludes
    and why -- a bare particle matches everything and proves nothing --
    and GATE_BLIND above for the points this module additionally declines
    to draw conclusions from."""
    out = []
    for level in LEVELS:
        for point in GRAMMAR_POINTS_BY_LEVEL.get(level, []):
            pattern = point.get("pattern", "")
            if not pattern or pattern in GATE_BLIND or not verifiable(pattern):
                continue
            found = tuple(s for s in stems(pattern) if len(s) >= 2)
            if found:
                out.append((level, pattern, found))
    return out


def _distinctive(stem: str) -> bool:
    """Whether finding `stem` in a sentence is evidence of its pattern.

    A two-character all-hiragana stem is not. 〜なり (N1, a literary
    conjunction) reduces to なり, which is inside every ...になりました
    an N5 sentence ends with; 〜ても reduces to ても, which is inside
    〜てもいいです. Both were rejecting their own level's material.

    Only applied to patterns ABOVE the level being tested -- the
    at-or-below side keeps every stem, since there a loose match only
    widens the span an above-level hit has to escape, which is the
    conservative direction.
    """
    return len(stem) >= 3 or any(not ("぀" <= c <= "ゟ") for c in stem)


@lru_cache(maxsize=1)
def _extra_points() -> list[tuple[str, str, tuple[str, ...]]]:
    """EXTRA_MARKERS in the same shape _checkable_points returns, so the
    span logic in grammar_over_level treats both alike."""
    return [
        (level, marker, (marker,))
        for level, markers in EXTRA_MARKERS.items()
        for marker in markers
    ]


def _spans(sentence: str, needles: tuple[str, ...]) -> list[tuple[int, int]]:
    """Every (start, end) at which any of `needles` occurs."""
    hits = []
    for needle in needles:
        start = sentence.find(needle)
        while start != -1:
            hits.append((start, start + len(needle)))
            start = sentence.find(needle, start + 1)
    return hits


def grammar_over_level(sentence: str, level: str) -> list[tuple[str, str]]:
    """(pattern, its level) for every grammar point above `level` that the
    sentence visibly uses.

    Two passes: collect the spans every at-or-below-level point explains,
    then report an above-level point only where it hit somewhere those
    spans do not already cover. Without that second condition 〜ても (N4)
    is reported inside 〜てもいいです (N5) and an N5 sentence fails its own
    level -- see the module docstring.
    """
    limit = rank(level)
    if limit < 0:
        return []

    allowed_spans: list[tuple[int, int]] = []
    above: list[tuple[str, str, list[tuple[int, int]]]] = []

    for point_level, pattern, needles in _checkable_points() + _extra_points():
        hits = _spans(sentence, needles)
        if not hits:
            continue
        if rank(point_level) <= limit:
            allowed_spans.extend(hits)
        else:
            strong = _spans(sentence, tuple(n for n in needles if _distinctive(n)))
            if strong:
                above.append((pattern, point_level, strong))

    def explained(span):
        return any(a <= span[0] and span[1] <= b for a, b in allowed_spans)

    out = []
    for pattern, point_level, hits in above:
        if any(not explained(h) for h in hits):
            out.append((pattern, point_level))
    return out


# ── Length ────────────────────────────────────────────────────
# Characters, counting kana and kanji alike. Not a difficulty measure on
# its own -- a long sentence of N5 words is still N5 -- but reading
# practice shows one sentence at a time under a timer, and a 60-character
# wall is the wrong exercise for a beginner regardless of what is in it.
MAX_CHARS = {"N5": 26, "N4": 34, "N3": 46, "N2": 60, "N1": 80}


def report(sentence: str, level: str, segments=None, allow_kanji: str = "") -> dict:
    """Every reason `sentence` is not `level`, or an empty verdict.

    Returns {"ok": bool, "kanji": [...], "grammar": [...], "vocab": [...],
    "too_long": int | None} -- the lists rather than a bare bool so a
    caller building the sentence bank can see WHAT to fix, which is the
    difference between a gate and a tool.

    `allow_kanji` exempts specific characters from the kanji gate. It
    exists for one case: a sentence written to DEMONSTRATE a grammar
    point has to contain that point, and several points are spelled with
    a kanji the app's own deck files above the level that teaches the
    point -- 〜に基づいて is N2 grammar written with 基, which the deck
    does not reach until N1. Rejecting the sentence there would mean no
    N2 sentence could ever demonstrate its own N2 grammar. Callers pass
    the pattern's own characters and nothing else.
    """
    over_kanji = [c for c in kanji_over_level(sentence, level) if c not in allow_kanji]
    over_grammar = grammar_over_level(sentence, level)
    over_vocab = vocab_over_level(sentence, level, segments)
    cap = MAX_CHARS.get(level)
    too_long = len(sentence) if cap and len(sentence) > cap else None

    return {
        "ok": not (over_kanji or over_grammar or over_vocab or too_long),
        "kanji": over_kanji,
        "grammar": over_grammar,
        "vocab": over_vocab,
        "too_long": too_long,
    }


def fits(sentence: str, level: str, segments=None) -> bool:
    """Whether `sentence` is at or below `level` on all four counts."""
    return report(sentence, level, segments)["ok"]


# ── The loosest useful gate ───────────────────────────────────
# The curated bank (content/reading_sentences.json) is graded with the
# full report above. The Tatoeba-derived pool cannot be: those sentences
# were written for a bilingual corpus, not for a syllabus, and requiring
# all four gates leaves N5 with almost nothing. This is what the fallback
# uses instead -- kanji and grammar, which are the two that actually
# decide whether a beginner can read the sentence at all, plus the length
# cap. Vocabulary is dropped there because a single unrecognised proper
# noun should not disqualify an otherwise perfect sentence.
def fits_loosely(sentence: str, level: str) -> bool:
    if kanji_over_level(sentence, level):
        return False
    if grammar_over_level(sentence, level):
        return False
    cap = MAX_CHARS.get(level)
    return not (cap and len(sentence) > cap)
