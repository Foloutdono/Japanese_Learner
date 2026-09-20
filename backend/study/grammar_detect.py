"""Which catalogue grammar points a sentence actually uses.

Detection, not gating. study/difficulty.grammar_over_level asks "is this
sentence too hard for N4", and may answer conservatively -- a point it
misses only lets a sentence through. Here every hit becomes a chip a
learner can press and a row that opens a grammar card, so a miss is a
rule left untaught and a false hit is a lesson about something that is
not in the sentence. Both cost, in opposite directions, which is why
this is its own module with its own rules rather than a flag on the
gate's.

What this knows that a substring test cannot
--------------------------------------------
The old detector was `sentence.find(stem)` over the catalogue's
patterns, guarded by a blunt rule -- a two-character all-hiragana stem
was thrown away as not distinctive enough to trust. That rule cost more
than it bought: it took out 〜から, 〜とき, 〜だけ, 〜など, 〜ごろ, 〜たら
and their like (201 of 486 misses over the catalogue's own example
sentences), while still letting through 天気がいいです as 〜気がする,
because 「気が」 really is a substring of 天気が.

Three things replace it, all of them things morphology.tokenize and the
catalogue already know:

1. **A hit must land on word boundaries.** It ends where a token ends,
   and begins where one begins -- or inside an INFLECTING token, since a
   pattern attaches to a conjugated stem: 大きくて is one token 大きく
   plus て, and 〜くて begins in the middle of it. A noun is not
   inflecting, so 天気 is never half of a grammar point.

2. **Every part of a multi-part pattern must be there.** から〜まで needs
   まで as well as から; もう〜ました needs もう. The old matcher kept the
   longest piece and dropped the rest, so もう〜ました fired on every
   sentence in the catalogue that ends in ました -- 137 of them.

3. **A point looks the way its own examples look.** Plan 087's catalogue
   gives every point three to five hand-written sentences that use it.
   Tokenize those and you learn what part of speech the point is
   realized by: 〜なり is a particle なり, so the verb なり in
   先生になりました is not it; 〜とき is the noun とき, and finding that
   noun IS the point. The catalogue teaches the matcher, which means a
   point written next year comes with its own detection rules attached
   and nothing here has to be updated.

A point whose own examples do not show it to this matcher keeps the old
behaviour (a distinctive stem, matched as before), so nothing that used
to be found is lost while those lessons are written.

Measured over the catalogue's own 2,169 example sentences: the point a
sentence was written for is found in 90% of them, against 78% for the
substring matcher this replaced, and 510 of the 541 points are found in
at least one of their own lessons.

What it still cannot see
------------------------
Four kinds of point, all of them refusals rather than misses:

- A point that names a CLASS rather than a surface: い形容詞／な形容詞,
  自動詞／他動詞, 可能形 〜(ら)れる. There is no string to look for, and
  "this sentence contains an adjective" is not a lesson anyone needs
  pointed out.
- A point the catalogue itself marks as a SENSE: 〜を（移動）is を with a
  verb of movement and 〜そうだ（伝聞）is そうだ meaning "I hear that".
  Each has a plain sibling written identically, and the parenthesis is
  the catalogue saying the difference is one of meaning. The plain
  sibling is reported; the qualified one waits for a reader that
  understands the sentence.
- A point whose surface is an ordinary word (AMBIGUOUS, below): 〜上に
  is 上 + に, and so is 山の上に.
- A point that attaches to a verb stem as a bare two-mora tail
  (〜すぎる as 食べすぎ, 〜てみる as 見てみ): the needle that would find
  those is two hiragana, which is not evidence of anything on its own,
  and the point's own examples cannot teach a shape for a needle that
  never matched them. Writing this one out is what a later pass is for.

Without morphology (fugashi/unidic-lite absent -- see
morphology.MORPHOLOGY_AVAILABLE) none of the three rules is possible,
and the module falls back to exactly the old substring rule. Detection
degrades; it does not vanish.
"""
import logging
from functools import lru_cache

from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL
from study import morphology
from study.grammar_match import alternatives, stems

logger = logging.getLogger(__name__)

LEVELS = ("N5", "N4", "N3", "N2", "N1")

# Points whose surface is a common word in its own right, where no
# amount of tokenizing separates the point from the word: 〜上に is
# 上(noun) + に(particle) and so is 山の上に, 〜ものを is 買いものを,
# 別に〜ない reduces to 別に which 特別に contains. The distinction is
# semantic, so it is not drawn rather than drawn wrongly. difficulty.py
# imports this list for its own gate -- one list, not two.
AMBIGUOUS: frozenset[str] = frozenset({
    "〜にして", "〜あまり", "〜上で", "〜出す", "〜直す", "〜にあって",
    "〜上に", "〜ものを", "別に〜ない",
})

# A pattern attaches to a word that conjugates, so a hit may begin
# inside one of these -- 〜くて inside 大きく, 〜てしまう inside 食べ.
# It may never begin inside anything else: a noun, a pronoun or an
# adverb is a word, not a stem with a grammar point growing off it.
_INFLECTING = frozenset({"verb", "adjective", "auxiliary"})

# Punctuation and spacing a pattern is written with but a sentence does
# not have to match on: 〜て、〜て is two て, the comma is typography.
_TRIM = "、。，・ 　　"


def _parts(pattern: str) -> list[tuple[tuple[str, ...], ...]]:
    """One entry per way the pattern may be written; each entry is the
    sequence of parts that must ALL appear, in order, each part given as
    the surfaces it may take.

    〜てください  -> [(("てください", "でください", "てくださ", …),)]
    から〜まで    -> [(("から", …), ("まで", …))]
    〜てあげる／〜てくれる -> one entry per alternative.
    """
    out = []
    for alt in alternatives(pattern):
        pieces = [p.strip(_TRIM) for p in alt.split("〜")]
        # stems() stops at two characters, where a substring stops being
        # evidence on its own. A one-character PATTERN is not a
        # substring guess though -- 「は」 is a point in the catalogue,
        # and on a tokenized sentence it is a particle token or it is
        # nothing -- so it keeps itself as its own needle.
        needles = [_needles(p) for p in pieces if p]
        if needles and all(needles):
            out.append(tuple(needles))
    return out


def _qualified(pattern: str) -> bool:
    """Whether the pattern names a SENSE rather than a surface: 〜を（移動）
    is を with a verb of movement, 〜そうだ（伝聞） is そうだ meaning "I
    hear that". The parenthesis is the catalogue telling us the
    distinction is one of meaning — and every one of these has a plain
    sibling written the same way (を, 〜そうです), which is why the
    qualifier is there at all."""
    return "（" in pattern or "(" in pattern


# 連用形: the form a verb takes before ます, and the one a pattern
# written in the dictionary form actually appears in half the time --
# 〜くなる is 大きくなりました, まいる is まいります. A truncation
# (なる -> な) would match those too, and match everything else with it.
_RENYOKEI = {"う": "い", "く": "き", "ぐ": "ぎ", "す": "し", "つ": "ち",
             "ぬ": "に", "ぶ": "び", "む": "み", "る": "り"}


def _needles(piece: str) -> tuple[str, ...]:
    """The surfaces one part of a pattern may take.

    stems() gives the citation form and the truncations that survive
    inflection (〜てしまう -> てしまう, てしま). A TRUNCATION has to stay
    distinctive to be worth matching: もうす truncates to もう, which is
    the adverb in もう暗くなった and nothing to do with the humble verb;
    います truncates to いま, which is inside しまいました. The citation
    form itself is never held to that -- 「は」 and 「〜し」 are patterns
    two characters long and one character long, and a sentence writes
    them exactly as the catalogue does.
    """
    full = piece.strip()
    found = [full] if full else []
    if len(full) >= 3 and full[-1] in _RENYOKEI:
        found.append(full[:-1] + _RENYOKEI[full[-1]])
    found += [n for n in stems(piece) if n != full and _distinctive(n)]
    return tuple(dict.fromkeys(found))


@lru_cache(maxsize=1)
def _catalogue() -> tuple[tuple[str, str, tuple, tuple], ...]:
    """(level, pattern, parts, examples) for every point worth looking
    for. Built once from the catalogue; `examples` rides along so a
    point's own sentences can teach the matcher what it looks like.

    A sense-qualified point is dropped when a plainer point is written
    with the same surface: 〜を（移動） and を are both を, 〜そうだ（伝聞）
    and 〜そうです are both そうです, and nothing in the text says which
    is meant. Claiming both puts two chips on one particle, one of them
    a guess; claiming the qualified one over the plain one would be a
    guess with a lesson attached. So the plain point keeps the surface
    and the qualified one waits for a reader that understands the
    sentence."""
    entries = []
    for level in LEVELS:
        for point in GRAMMAR_POINTS_BY_LEVEL.get(level, []):
            pattern = point.get("pattern", "")
            if not pattern or pattern in AMBIGUOUS:
                continue
            parts = _parts(pattern)
            if not parts:
                continue
            examples = tuple(
                ex.get("jp", "") for ex in point.get("examples", []) if ex.get("jp")
            )
            entries.append((level, pattern, tuple(parts), examples))

    plain_needles = {
        needle
        for level, pattern, parts, _ex in entries
        if not _qualified(pattern)
        for alt in parts for part in alt for needle in part
    }
    return tuple(
        e for e in entries
        if not _qualified(e[1])
        or not any(n in plain_needles for alt in e[2] for part in alt for n in part)
    )


def _distinctive(needle: str) -> bool:
    """The old rule, kept for the points whose own examples cannot teach
    this matcher anything: a two-character all-hiragana needle is not
    evidence on its own. 〜なり reduces to なり, which is inside every
    ...になりました."""
    return len(needle) >= 3 or any(not ("぀" <= c <= "ゟ") for c in needle)


def _find_all(text: str, needle: str) -> list[int]:
    out, at = [], text.find(needle)
    while at != -1:
        out.append(at)
        at = text.find(needle, at + 1)
    return out


def _anchored(start: int, end: int, starts: set[int], ends: set[int],
              inside: dict[int, str], word_start: dict[int, int]) -> bool:
    """Whether a span sits on word boundaries — rule 1 above.

    Either end of a hit may fall inside an INFLECTING word, and only
    inside one: a pattern is written in a citation form that a real
    sentence conjugates at both ends. 〜くて begins inside 大きく;
    〜てしまう ends inside しまい (なくしてしまいました); 〜くなる does
    both at once (大きくなりました). A noun is not inflecting, which is
    what makes 天気がいい not 〜気がする.

    The one thing a hit may never be is the FRONT OF A SINGLE WORD --
    starting where a word starts and stopping inside that same word. It
    would be reading half a word and calling it a pattern: the で of
    です is not the で of 〜くて／〜で, and です is not two things.
    """
    if start not in starts and inside.get(start, "") not in _INFLECTING:
        return False
    if end in ends:
        return True
    if inside.get(end, "") not in _INFLECTING:
        return False
    return word_start.get(end, -1) > start


@lru_cache(maxsize=4096)
def _shape(level: str, pattern: str) -> tuple[tuple[frozenset[str], frozenset[str], bool], ...]:
    """What the point looks like in its own example sentences — rule 3.

    One entry per spelling the point may be written in (〜くなる／〜になる
    is two), because a point's spellings do not behave alike: 〜になる
    stands on its own に and attaches to a noun, while the 〜くなる
    beside it grows out of the adjective in front of it. Each entry is
    (the parts of speech the spelling is realized BY, the parts of
    speech it attaches TO, whether it always stands on a word of its
    own).

    The first two are sets rather than the pairs they were read from:
    four example sentences cannot enumerate every context a point occurs
    in, and a pair not among them would be a miss rather than a
    judgement. Each half on its own is what the catalogue's `structure`
    line says in prose — 「noun + の + noun」 is the possessive の,
    attached to a noun; 「verb dictionary form + の」 is the nominalizer,
    attached to a verb. Same particle, and the word in front of it is
    the difference, which is exactly what separates わたしのかさ from
    走るのが好き.

    An entry of empty sets means "nothing to check against" — no
    morphology when the lessons were read, or a lesson whose sentences
    conjugate past what this matcher can follow — not "nothing
    allowed"; see _shaped.
    """
    entry = _by_name().get((level, pattern))
    if entry is None:
        return ()
    _, _, parts, examples = entry

    # Read without a shape to check against — there is none yet; this is
    # where one comes from — so an example can hand back a second,
    # accidental hit beside the one it was written for.
    seen: list[list[tuple[bool, str, str]]] = [[] for _ in parts]
    for sentence in examples:
        tokens = morphology.tokenize(sentence)
        if not tokens:
            continue
        starts = {t.start for t in tokens}
        for start, _e, pos, _c, spelling, _segments in _hits(sentence, tokens, parts):
            seen[spelling].append((start in starts, pos, _before(start, tokens)))

    out = []
    for signatures in seen:
        # When the lessons show a spelling standing on a word of its
        # own, that is what it is, and whatever the same needle also hit
        # inside some other word is that sentence's coincidence:
        # 安いし、近いし、この店にします。 shows 〜し as the particle it
        # is twice, and once more inside します. Learning from both
        # teaches the matcher that 〜し may be the し of any する — which
        # is how なくしてしまいました came to be listing reasons.
        standing = [sig for sig in signatures if sig[0]]
        kept = standing or signatures
        # Every signature they show, not the ones they agree on: a
        # pattern that attaches to a noun in one sentence and a verb in
        # the next is not in disagreement with itself. Holding them to a
        # majority was measured against the catalogue and cost six
        # points of recall to shave a twentieth off the false hits — the
        # wrong way round for a breakdown, where a missing rule is a
        # rule left untaught.
        out.append((
            frozenset(pos for _s, pos, _b in kept),
            frozenset(before for _s, _h, before in kept),
            bool(kept) and all(stood for stood, _h, _b in kept),
        ))
    return tuple(out)


@lru_cache(maxsize=1)
def _by_name() -> dict[tuple[str, str], tuple]:
    return {(e[0], e[1]): e for e in _catalogue()}


def _before(start: int, tokens) -> str:
    """The part of speech of the word a hit attaches to — the last token
    ending at or before it starts.

    "" when there is no such word, which is a sentence beginning rather
    than a context: 「食べようとしました」 as a fragment has nothing in
    front of 食べよう, and the point is no less present for it. The
    caller reads "" as "nothing to check" rather than as a shape of its
    own, or a lesson's four examples — all of them whole sentences with
    a subject — would rule out the fragment a learner actually typed.
    """
    pos = ""
    for t in tokens:
        if t.end <= start:
            pos = t.pos
        else:
            break
    return pos


def _hits(sentence: str, tokens, parts):
    """Every (start, end, pos-of-first-covered-token, contiguous,
    spelling, segments) at which `parts` are all present, in order, on
    word boundaries. `segments` is one (start, end) per part -- the
    pieces of the sentence the point is actually written on, which for
    から〜まで are から and まで and not the clause between them (see
    hits()). The shape test is the caller's (see _shaped): a point's
    own examples are read only when the point has actually matched
    something, which is what keeps the first analysis after a boot
    from tokenizing the whole catalogue."""
    starts = {t.start for t in tokens}
    ends = {t.end for t in tokens}
    # The part of speech of whatever token a position falls inside, and
    # where that token began, so a hit that starts or stops mid-word can
    # be judged on the word it is inside.
    inside = {}
    word_start = {}
    for t in tokens:
        for i in range(t.start, t.end):
            inside[i] = t.pos
            word_start[i] = t.start

    out = []
    for index, alt in enumerate(parts):
        # Each part in turn, each one starting after the last one ended;
        # a chain is the parts it has matched so far, as their spans.
        chains = [((), 0)]
        for needles in alt:
            nxt = []
            for segments, cursor in chains:
                for needle in needles:
                    for at in _find_all(sentence, needle):
                        if at < cursor:
                            continue
                        end = at + len(needle)
                        if not _anchored(at, end, starts, ends, inside, word_start):
                            continue
                        nxt.append((segments + ((at, end),), end))
            chains = nxt
            if not chains:
                break
        for segments, _cursor in chains:
            first, last = segments[0][0], segments[-1][1]
            # Contiguous when the pattern is written in one piece: a
            # multi-part one (もう〜ました) spans from its first part to
            # its last with a whole clause in between that it does not
            # own, which is why it never explains what it encloses.
            out.append((first, last, inside.get(first, ""), len(alt) == 1, index, segments))
    return out


def _shaped(sentence, tokens, level, pattern, parts):
    """`_hits`, then each hit held to the shape its own lessons show for
    the spelling it matched.

    A spelling whose examples taught nothing — no morphology when they
    were read, or a lesson whose sentences conjugate past what this
    matcher can follow — keeps the rule it had before: a distinctive
    needle, on word boundaries all the same. So a point can only gain by
    being written; it never loses what it already had.
    """
    found = _hits(sentence, tokens, parts)
    if not found:
        return []
    shape = _shape(level, pattern)
    starts = {t.start for t in tokens}

    out = []
    for hit in found:
        start, end, pos, contiguous, spelling, _segments = hit
        heads, befores, stands = (
            shape[spelling] if spelling < len(shape) else (frozenset(), frozenset(), False)
        )
        if not heads and not befores:
            # Nothing to check a shape against, so the old rule stands —
            # but per HIT, on the text it actually matched. Held per
            # point instead, it passed まいる／もうす／いたす on the もう
            # of もう暗くなった, because another needle of the same point
            # was distinctive enough.
            if contiguous and not _distinctive(sentence[start:end]):
                continue
            out.append(hit)
            continue
        # A spelling its lessons always show on a word of its own is not
        # half a word here either: the し of なくして is not the 〜し
        # that lists reasons.
        if stands and start not in starts:
            continue
        if pos not in heads:
            continue
        if _before(start, tokens) not in ("", *befores):
            continue
        out.append(hit)
    return out


def _legacy(sentence: str) -> list[tuple[str, str, int, int]]:
    """What this module did before it could tokenize: a distinctive
    substring, anywhere in the sentence. The fallback when morphology is
    unavailable, and the guard for a point whose examples teach nothing.
    """
    hits = []
    for level, pattern, parts, _examples in _catalogue():
        for alt in parts:
            if len(alt) != 1:
                continue  # a multi-part pattern is never guessed at
            for needle in alt[0]:
                if not _distinctive(needle):
                    continue
                for at in _find_all(sentence, needle):
                    hits.append((pattern, level, at, at + len(needle)))
    return hits


# A point that IS one grammatical word -- a particle, the copula -- as
# opposed to one built around a word: 「は」 and です／だ against
# 〜ます／〜ません and から〜まで. The catalogue writes the difference
# already (a construction is written with 〜, marking where the rest of
# the sentence goes), and the screens use it: a marker belongs on the
# row of the very particle it is, a construction over the sentence it
# shapes. Both are cards, and both open.
_MARKER_POS = frozenset({"particle", "auxiliary"})


def _kind(pattern: str, token) -> str:
    if "〜" in pattern or token is None or token.pos not in _MARKER_POS:
        return "pattern"
    return "marker"


def hits(sentence: str, tokens=None) -> list[dict]:
    """Every point `sentence` visibly uses, in full: {pattern, level,
    start, end, kind, segments}.

    `start`..`end` is the whole stretch the hit reaches over; `segments`
    is the list of (start, end) pieces it is actually written on, one
    per part of the pattern. For a point written in one piece the two
    are the same span. For から〜まで they are から and まで, and the
    clause between them is not in either: a screen that draws where a
    rule sits on the sentence lights those two words and not the whole
    line (plan 095), and a token between them is not one the point
    covers (study/analysis._attach_grammar). detect and points_in are
    the same list in the tuple forms their callers already read.
    """
    return [
        {"pattern": p, "level": lv, "start": s, "end": e, "kind": k, "segments": list(segs)}
        for p, lv, s, e, k, segs in _detect(sentence, tokens)
    ]


def detect(sentence: str, tokens=None) -> list[tuple[str, str, int, int, str]]:
    """(pattern, level, start, end, kind) — points_in, plus what shape of
    point each hit is (see _kind). The full form; points_in is the same
    list with the kind dropped for the callers that predate it, and
    hits() the same list with the pieces each hit is written on."""
    return [(p, lv, s, e, k) for p, lv, s, e, k, _segs in _detect(sentence, tokens)]


def points_in(sentence: str, tokens=None) -> list[tuple[str, str, int, int]]:
    """(pattern, level, start, end) for every catalogue point `sentence`
    visibly uses, at any level.

    `tokens` is morphology.tokenize's output when the caller already has
    it (study/analysis.py does — it tokenizes the sentence for the
    word rows), so a breakdown tokenizes once rather than twice.

    Sorted by start, then widest first, and deduplicated to one hit per
    (pattern, level) per position it covers: a point's needles include a
    form and its truncated stems, which nest — 「ています」 and 「ていま」
    start at the same place and are one occurrence, not two chips with
    the same card behind them. A second, non-overlapping occurrence of
    the same point later in a longer sentence is a real second hit and
    stays.
    """
    return [(p, lv, s, e) for p, lv, s, e, _kind, _segs in _detect(sentence, tokens)]


def _detect(sentence: str, tokens) -> list[tuple[str, str, int, int, str, tuple[tuple[int, int], ...]]]:
    if not sentence:
        return []
    if tokens is None:
        tokens = morphology.tokenize(sentence)

    if not tokens:
        # Nothing can be called a marker without a tokenizer to say what
        # part of speech the hit landed on, and the containment rule
        # below needs to know a contiguous hit from a two-part one:
        # _legacy only ever reports contiguous ones, so each is written
        # on the one piece it spans.
        found = [(p, lv, s, e, "pattern", True, ((s, e),)) for p, lv, s, e in _legacy(sentence)]
    else:
        spans = {(t.start, t.end): t for t in tokens}
        found = []
        for level, pattern, parts, _examples in _catalogue():
            for start, end, _pos, contiguous, _spelling, segments in _shaped(sentence, tokens, level, pattern, parts):
                found.append((pattern, level, start, end,
                              _kind(pattern, spans.get((start, end))), contiguous, segments))

    found.sort(key=lambda h: (h[2], -(h[3] - h[2])))
    deduped: list[tuple[str, str, int, int, str, bool, tuple[tuple[int, int], ...]]] = []
    covered: dict[tuple[str, str], list[tuple[int, int]]] = {}
    for pattern, level, start, end, kind, contiguous, segments in found:
        seen = covered.setdefault((pattern, level), [])
        if any(s <= start and end <= e for s, e in seen):
            continue
        seen.append((start, end))
        deduped.append((pattern, level, start, end, kind, contiguous, segments))

    # A point wholly inside a longer CONTIGUOUS one is that one's own
    # machinery, not a second rule: the と of 食べようとした is
    # 〜ようとする's と and never the conditional 〜と, and the ます inside
    # ました is the ました. A multi-part point explains nothing it
    # encloses -- もう〜ました reaches from もう to the end of the
    # sentence, and everything the learner is actually reading lies
    # between the two. Equal spans are left alone: two points really can
    # be written the same way, and a span cannot choose between them
    # (see _catalogue on the sense-qualified ones).
    return [
        (pattern, level, start, end, kind, segments)
        for pattern, level, start, end, kind, _c, segments in deduped
        if not any(
            whole and (s, e) != (start, end) and s <= start and end <= e
            for _p, _l, s, e, _k, whole, _segs in deduped
        )
    ]
