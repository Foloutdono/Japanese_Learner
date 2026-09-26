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

The second pass: by dictionary form (plan 095)
----------------------------------------------
What a substring cannot see, the tokenizer already knows: すぎ in
食べすぎました is the verb すぎる, み in 見てみます is the verb みる,
られ in 褒められました is the auxiliary られる, and 読める is the verb
読む conjugating as 下一段 -- which is what the potential IS. So a
pattern's tail is also looked for as the dictionary form of a token
rather than as letters, and every conjugation of it is found at once.
Two shapes of tail, read off the pattern itself:

- **stem**: 〜すぎる, 〜たいです, 〜やすい, 〜始める. The tail's own
  tokens, by dictionary form, on a token that stands right after a verb
  or adjective stem and is grammaticalised there (an auxiliary, a
  suffix, or a verb UniDic marks 非自立可能). 三時を過ぎました is not
  〜すぎる: 過ぎ follows a particle, not a stem.
- **te**: 〜てみる, 〜ておく, 〜ていく. The conjunctive て／で, then the
  tail's verb by dictionary form. 映画を見ます is not 〜てみる.

And a table for the FORM points, whose surface is a conjugation the
tokenizer names rather than a string: the passive and causative
auxiliaries, the potential (a verb conjugating as 下一段 whose
dictionary form is not), the volitional and the imperative (the form's
own name on the token). For a る-verb the passive and the potential are
one shape (食べられる), and both are reported on it: the catalogue says
so itself, in each lesson's row about the other, and a span cannot
choose between two points written the same way (see _detect).

Every rule is held to the point's own lessons, as rule 3 above is: a
rule that cannot find its point in at least one of the point's example
sentences is not trusted on anyone else's. The examples are read only
once a rule has a candidate in hand, so the first analysis after a boot
still tokenizes nothing it does not need.

Measured over the catalogue's own 2,169 example sentences: the point a
sentence was written for is found in 92% of them (90% before the second
pass, 78% for the substring matcher before that), and 517 of the 541
points are found in at least one of their own lessons (510 before).

What it still cannot see
------------------------
Three kinds of point, all of them refusals rather than misses:

- A point that names a CLASS with no conjugation to read: い形容詞／な形容詞,
  自動詞／他動詞. There is no string to look for and no form to name,
  and "this sentence contains an adjective" is not a lesson anyone
  needs pointed out.
- A point the catalogue itself marks as a SENSE: 〜を（移動）is を with a
  verb of movement and 〜そうだ（伝聞）is そうだ meaning "I hear that".
  Each has a plain sibling written identically, and the parenthesis is
  the catalogue saying the difference is one of meaning. The plain
  sibling is reported; the qualified one waits for a reader that
  understands the sentence.
- A point whose surface is an ordinary word (AMBIGUOUS, below): 〜上に
  is 上 + に, and so is 山の上に.

Without morphology (fugashi/unidic-lite absent -- see
morphology.MORPHOLOGY_AVAILABLE) none of the rules is possible, and the
module falls back to exactly the old substring rule. Detection
degrades; it does not vanish.
"""
import logging
from functools import lru_cache

from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL, find
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
    own, the meaning-bearing forms the word it ends in is seen in --
    "" for plain inflection).

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
    seen: list[list[tuple[bool, str, str, str, int]]] = [[] for _ in parts]
    for index, sentence in enumerate(examples):
        tokens = morphology.tokenize(sentence)
        if not tokens:
            continue
        starts = {t.start for t in tokens}
        for start, end, pos, _c, spelling, _segments in _hits(sentence, tokens, parts):
            seen[spelling].append((start in starts, pos, _before(start, tokens), _ending(end, tokens), index))

    out = []
    for signatures in seen:
        # When the lessons show a spelling standing on a word of its
        # own, that is what it is, and whatever the same needle also hit
        # inside some other word is that sentence's coincidence: the し
        # of なくして is not the 〜し that lists reasons.
        standing = [sig for sig in signatures if sig[0]]
        kept = standing or signatures
        # Every signature they show, not the ones they agree on: a
        # pattern that attaches to a noun in one sentence and a verb in
        # the next is not in disagreement with itself. Holding them to a
        # majority was measured against the catalogue and cost six
        # points of recall to shave a twentieth off the false hits — the
        # wrong way round for a breakdown, where a missing rule is a
        # rule left untaught. The one exception is a coincidence that
        # stands on a word of its own (_without_coincidences).
        out.append((
            _without_coincidences(kept),
            frozenset(before for _s, _h, before, _e, _i in kept),
            bool(kept) and all(stood for stood, _h, _b, _e, _i in kept),
            # The form the word the hit ends in is in, where that form
            # means something: 〜てください ends in ください, the
            # imperative, in every lesson, and 教えてくださいました
            # ends in the same verb in the 連用形 -- the honorific,
            # which is 〜てくださる's lesson and not this one's.
            frozenset(ending for _s, _h, _b, ending, _i in kept),
        ))
    return tuple(_pooled(out))


def _pooled(shapes):
    """Each spelling's shape, with the words it may attach to shared
    among the spellings that are the same kind of word.

    です／だ is one point in two registers, and its lessons show the
    polite spelling four times and the plain one once -- after しずか.
    Read apart, だ learned that it follows a na-adjective and nothing
    else, and 夜だ, 学生だ, every plain sentence ending in a noun, had no
    copula. Where two spellings are realized by the same parts of speech
    and stand the same way, they are the same word written two ways, and
    what one attaches to the other may too. Spellings that are different
    kinds of word keep their own: 〜になる stands on its own に after a
    noun, while 〜くなる grows out of the adjective in front of it.
    """
    return [
        (heads, befores.union(*(b for h, b, s, _e in shapes if h == heads and s == stands))
         if heads else befores, stands, endings)
        for heads, befores, stands, endings in shapes
    ]


def _without_coincidences(kept) -> frozenset[str]:
    """The parts of speech a spelling is realized by, less the ones a
    lesson shows only by accident.

    安いし、近いし、この店にします。 shows 〜し as the particle it is
    twice, and once more as the し of します -- a verb, standing on a
    token of its own, so the rule above does not catch it. Learned, it
    taught the matcher that 〜し may be the し of any する, and
    食べようとしました was listing reasons. A reading seen in one lesson
    only, and there only beside another reading of the same point, is
    that sentence's coincidence: the sentence was written to show the
    point, and it shows it in the other reading. A reading seen in two
    lessons, or alone in one, is the point's -- which keeps a point
    that really is realized two ways (a particle in one sentence, an
    auxiliary in the next), and costs nothing measured over the
    catalogue.
    """
    sentences_of: dict[str, set[int]] = {}
    readings_in: dict[int, set[str]] = {}
    for _stood, pos, _before, _ending, index in kept:
        sentences_of.setdefault(pos, set()).add(index)
        readings_in.setdefault(index, set()).add(pos)
    return frozenset(
        pos for pos, sentences in sentences_of.items()
        if len(sentences) >= 2 or any(readings_in[i] == {pos} for i in sentences)
    )


@lru_cache(maxsize=1)
def _by_name() -> dict[tuple[str, str], tuple]:
    return {(e[0], e[1]): e for e in _catalogue()}


def _ending(end: int, tokens) -> str:
    """The form of the word a hit ends in, where the form carries a
    meaning of its own (_MEANING_FORMS): the imperative, the
    volitional. "" for any other, which is inflection."""
    for t in tokens:
        if t.start < end <= t.end:
            head = _form_head(t.cform)
            return head if head in _MEANING_FORMS else ""
    return ""


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
        heads, befores, stands, endings = (
            shape[spelling] if spelling < len(shape) else (frozenset(), frozenset(), False, frozenset())
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
        if _ending(end, tokens) not in endings:
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


# ── The second pass: by dictionary form (plan 095) ──────────────
# See the module docstring. Every rule here answers one question about
# a token the first pass cannot ask: what word is this, and in what
# form. Nothing here reads letters.

# Trailing politeness and tense a tail may or may not be written with
# (〜たいです is たい; 〜ました is ます + た), and the auxiliaries a tail
# may not consist of alone: a rule made of nothing but ます and た would
# claim 〜ました on every 食べます.
_TAIL_TRIM = frozenset({"です", "ます", "だ", "た", "ぬ", "ず"})
_TAIL_PURE = _TAIL_TRIM | frozenset({"ん"})
# A tail written in its dictionary form (〜すぎる, 〜たいです, 〜てみる) is
# found in any plain inflection -- that is what reading by dictionary
# form is for. A tail written in some other form is that form exactly:
# 〜べきだ, 〜べく and 〜べからず are one word べし in three forms and
# three lessons; 〜てください is ください, the imperative of くださる,
# and 〜てくださる the verb itself; 〜ましょうか is ましょう and not every
# ますか. The two forms that carry a meaning of their own are never
# "plain": a dictionary-form tail does not match a verb in the
# imperative or the volitional.
_MEANING_FORMS = frozenset({"命令形", "意志推量形"})
# Politeness and tense that force the word before them into the 連用形:
# い in ています is only 連用形 because ます follows. A tail's last word
# before one of these is found in any plain form.
_FORCES_RENYOKEI = frozenset({"ます", "た"})
# What a tail's first token may be for a stem rule to read it: a word
# that attaches to a stem. A noun (〜ことがある), a particle (〜ながら) or
# a 形状詞 (〜そうです) is the first pass's business.
_TAIL_POS = frozenset({"verb", "adjective", "auxiliary", "suffix"})
_INFLECTING_POS = frozenset({"verb", "adjective"})
_PASSIVE = frozenset({"れる", "られる"})
_CAUSATIVE = frozenset({"せる", "させる"})


# The stem a tail is read on. A tail tokenized on its own is read as a
# word: たい alone is the fish, やすい the adjective "cheap". On a stem
# it is what the pattern means it to be.
_DUMMY_STEM = "食べ"


def _form_head(cform: str) -> str:
    """UniDic's form without its variant: 連用形-イ音便 is 連用形."""
    return cform.split("-", 1)[0]


def _form_required(token) -> str:
    """What a sentence token's form must be for this tail token: "" for
    any plain inflection when the tail is written as its own dictionary
    form (すぎる, たい, みる -- or a word that does not conjugate), the
    form itself otherwise (べき is not べし, ください is not くださる).
    Judged on the reading rather than on UniDic's form name: a verb
    ending a bare fragment is tagged 連体形, and 食べる's 終止形 and
    連体形 are the same word either way."""
    return "" if token.reading == token.lemma_reading else _form_head(token.cform)


def _form_fits(token, required: str) -> bool:
    head = _form_head(token.cform)
    return head not in _MEANING_FORMS if required == "" else head == required


def _tail_core(tail: str) -> tuple[tuple[str, str, str], ...] | None:
    """A tail as (pos, dictionary reading, required form) per token
    (_form_required), its trailing politeness and tense dropped -- or
    None where no stem rule may read it: a tail that does not start
    with a word that attaches to a stem, or one made of nothing but
    ます／です／た."""
    tokens = morphology.tokenize(_DUMMY_STEM + tail)
    if not tokens or tokens[0].surface != _DUMMY_STEM:
        tokens = morphology.tokenize(tail)
        if not tokens:
            return None
    else:
        tokens = tokens[1:]
    trimmed = None
    while tokens and tokens[-1].lemma_reading in _TAIL_TRIM and _form_head(tokens[-1].cform) not in _MEANING_FORMS:
        trimmed = tokens.pop().lemma_reading
    if not tokens or tokens[0].pos not in _TAIL_POS:
        return None
    required = [_form_required(t) for t in tokens]
    if trimmed in _FORCES_RENYOKEI and _form_head(tokens[-1].cform) not in _MEANING_FORMS:
        required[-1] = ""
    core = tuple((t.pos, t.lemma_reading, req) for t, req in zip(tokens, required))
    if all(reading in _TAIL_PURE and not req for _pos, reading, req in core):
        return None
    return core


@lru_cache(maxsize=1)
def _form_rules() -> dict[str, list[tuple[str, str, str, tuple[tuple[str, str, str], ...]]]]:
    """The stem and te rules, indexed by the dictionary reading a
    sentence must contain for the rule to have a candidate at all:
    reading -> [(level, pattern, "stem" | "te", core)]. Built once from
    the catalogue, which already leaves out the AMBIGUOUS and the
    sense-qualified points (see _catalogue)."""
    index: dict[str, list] = {}
    for level, pattern, _parts, _examples in _catalogue():
        if pattern in _CLASS_RULES:
            continue
        for alt in alternatives(pattern):
            if "〜" in alt:
                continue  # a two-part pattern is the first pass's
            te = len(alt) > 1 and alt[0] in "てで"
            core = _tail_core(alt[1:] if te else alt)
            if core is None or (te and core[0][0] != "verb"):
                continue
            index.setdefault(core[0][1], []).append((level, pattern, "te" if te else "stem", core))
    return index


def _grammaticalised(token) -> bool:
    return token.pos in ("auxiliary", "suffix") or token.auxiliary_use


def _matches_core(tokens, i: int, core) -> int | None:
    """The end offset of the core's tokens standing at tokens[i], in
    order, each by dictionary reading -- or None."""
    if i + len(core) > len(tokens):
        return None
    for k, (_pos, reading, required) in enumerate(core):
        token = tokens[i + k]
        if token.lemma_reading != reading or not _form_fits(token, required):
            return None
    return tokens[i + len(core) - 1].end


def _stem_spans(tokens, core) -> list[tuple[int, int]]:
    """A stem tail: its tokens, right after a verb or adjective, on a
    token grammaticalised there."""
    out = []
    for i in range(1, len(tokens)):
        if tokens[i - 1].pos not in _INFLECTING_POS or not _grammaticalised(tokens[i]):
            continue
        end = _matches_core(tokens, i, core)
        if end is not None:
            out.append((tokens[i].start, end))
    return out


def _te_spans(tokens, core) -> list[tuple[int, int]]:
    """A te tail: the conjunctive て／で, then the tail's tokens."""
    out = []
    for i in range(1, len(tokens) - 1):
        te = tokens[i]
        if not (te.conjunctive and te.surface in ("て", "で")):
            continue
        end = _matches_core(tokens, i + 1, core)
        if end is not None:
            out.append((te.start, end))
    return out


def _after_verb(tokens, i: int) -> bool:
    return i > 0 and tokens[i - 1].pos == "verb"


def _passive_spans(tokens):
    return [(t.start, t.end) for i, t in enumerate(tokens)
            if t.pos == "auxiliary" and t.lemma_reading in _PASSIVE and _after_verb(tokens, i)]


def _causative_spans(tokens):
    return [(t.start, t.end) for i, t in enumerate(tokens)
            if t.pos == "auxiliary" and t.lemma_reading in _CAUSATIVE and _after_verb(tokens, i)]


def _causative_passive_spans(tokens):
    return [(a.start, b.end) for a, b in zip(tokens, tokens[1:])
            if a.pos == "auxiliary" and a.lemma_reading in _CAUSATIVE
            and b.pos == "auxiliary" and b.lemma_reading in _PASSIVE]


def _ichidan_stem(reading: str, cform: str) -> str | None:
    """The stem of a 下一段 token from its reading and the form UniDic
    says it is in, or None for a form this does not follow."""
    if cform.startswith(("終止形", "連体形")):
        return reading[:-1] if reading.endswith("る") else None
    if cform.startswith(("連用形", "未然形")):
        return reading
    if cform.startswith("仮定形"):
        return reading[:-1] if reading.endswith("れ") else None
    if cform.startswith("命令形"):
        return reading[:-1] if reading[-1:] in ("ろ", "よ") else None
    if cform.startswith("意志推量形"):
        return reading[:-2] if reading.endswith("よう") else None
    return None


def _potential_spans(tokens):
    """The potential: a verb conjugating as 下一段 whose dictionary
    form is not (読める is 読む, 書けます is 書く, 帰れる is 帰る) -- and
    られる after a る-verb, which is the potential and the passive both,
    reported as both (module docstring). 見える is 見える, and stays a
    verb that means something is in view."""
    out = []
    for i, t in enumerate(tokens):
        if t.pos == "verb" and t.ctype.startswith("下一段"):
            stem = _ichidan_stem(t.reading, t.cform)
            if stem is not None and stem + "る" != t.lemma_reading:
                out.append((t.start, t.end))
        elif t.pos == "auxiliary" and t.lemma_reading == "られる" and _after_verb(tokens, i):
            out.append((t.start, t.end))
    return out


def _volitional_spans(tokens):
    """帰ろう, 食べよう: the verb itself in the volitional form. ましょう
    and でしょう are auxiliaries in that form, and are not it."""
    return [(t.start, t.end) for t in tokens if t.pos == "verb" and t.cform.startswith("意志推量形")]


def _imperative_spans(tokens):
    """起きろ, 待て: a verb in the imperative that ends its clause. Not
    ください or なさい, imperatives of the verbs they are but the polite
    request and 〜なさい as points; and not a verb the tagger reads as an
    imperative on its way to an auxiliary (習わせられた)."""
    out = []
    for i, t in enumerate(tokens):
        if t.pos != "verb" or not t.cform.startswith("命令形") or t.auxiliary_use:
            continue
        if i + 1 < len(tokens) and tokens[i + 1].pos in ("auxiliary", "verb"):
            continue
        out.append((t.start, t.end))
    return out


# The form points, by the pattern the catalogue files them under. A
# rename here is a rename there (tests/test_grammar_detect holds the
# two together).
_CLASS_RULES = {
    "受身形 〜られる": _passive_spans,
    "可能形 〜(ら)れる": _potential_spans,
    "使役形 〜させる": _causative_spans,
    "使役受身形 〜させられる": _causative_passive_spans,
    "意向形 〜(よ)う": _volitional_spans,
    "命令形 〜ろ／〜え": _imperative_spans,
}


@lru_cache(maxsize=None)
def _confirmed(level: str, pattern: str) -> bool:
    """Whether the point's own lessons show its rule working: the rule
    finds the point in at least one of the point's example sentences.
    Read once per point, and only once a sentence has given the rule a
    candidate."""
    found = find(pattern)
    if found is None or found[0] != level:
        return False
    for example in found[1].get("examples", []):
        tokens = morphology.tokenize(example.get("jp", ""))
        if tokens and any(p == pattern for p, _l, _s, _e in _form_hits(tokens, confirm=False)):
            return True
    return False


def _form_hits(tokens, confirm: bool = True) -> list[tuple[str, str, int, int]]:
    """(pattern, level, start, end) for every point the second pass
    finds, each held to its own lessons unless `confirm` is off (which
    is how the lessons themselves are read)."""
    out = []
    index = _form_rules()
    for reading in {t.lemma_reading for t in tokens} & index.keys():
        for level, pattern, shape, core in index[reading]:
            spans = _te_spans(tokens, core) if shape == "te" else _stem_spans(tokens, core)
            if spans and (not confirm or _confirmed(level, pattern)):
                out.extend((pattern, level, s, e) for s, e in spans)
    for pattern, rule in _CLASS_RULES.items():
        spans = rule(tokens)
        if not spans:
            continue
        found = find(pattern)
        if found is None:
            continue
        level = found[0]
        if not confirm or _confirmed(level, pattern):
            out.extend((pattern, level, s, e) for s, e in spans)
    return out


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


@lru_cache(maxsize=None)
def can_find(pattern: str) -> bool:
    """Whether the detector may say a sentence does NOT use `pattern`
    (plan 125): true when it finds the point in at least one of the
    point's own catalogue examples.

    A "not found" is evidence only where the matcher has proved itself
    on the point. It never sees some two dozen of the 541 -- the
    sense-qualified and AMBIGUOUS points _catalogue() drops (〜が（逆接）,
    〜上に) and the class labels and shapes no rule reads (い形容詞／な形容詞,
    〜しか〜ない) -- and for those the honest answer to "is it in this
    sentence" is no answer. 作文 asks here before printing its found /
    not-found hint, and prints nothing when the answer is False. Read
    once per point, like _confirmed, and only when asked."""
    found = find(pattern)
    if found is None:
        return False
    level, entry = found
    return any(
        (hit["pattern"], hit["level"]) == (pattern, level)
        for example in entry.get("examples", [])
        if example.get("jp")
        for hit in hits(example["jp"])
    )


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
        # The second pass, on the same footing: a hit the first pass
        # also made is one hit (the dedupe below), a wider reading of
        # the same point wins, and a form inside a longer construction
        # is that one's (the containment rule below) -- the られ of
        # 食べさせられた is the causative-passive's, not a passive.
        for pattern, level, start, end in _form_hits(tokens):
            found.append((pattern, level, start, end,
                          _kind(pattern, spans.get((start, end))), True, ((start, end),)))

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
    #
    # A MARKER is kept whatever encloses it (plan 095): the が of
    # ことができます is the subject が, and the row that particle stands
    # on is where a learner asks what it is doing -- a row with nothing
    # to open was the one kind that went nowhere. The construction is
    # still reported over it, and a screen lists the construction's
    # parts beside its name.
    return [
        (pattern, level, start, end, kind, segments)
        for pattern, level, start, end, kind, _c, segments in deduped
        if kind == "marker" or not any(
            whole and (s, e) != (start, end) and s <= start and end <= e
            for _p, _l, s, e, _k, whole, _segs in deduped
        )
    ]
