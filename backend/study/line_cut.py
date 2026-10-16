# ── A subtitle line held to what reads at a glance (plan 235) ─────
# A Cue is a Sentence (study/cue_sentences.py), and most cues are a
# line somebody sized for a screen. Some are not: a talk's hand-written
# track can put forty-odd characters in one cue, which the analyser's
# stage drew at display size over five rows of a phone, the words list
# and the explanation following it (the owner, 2026-10-16: "make sure
# the sentences can't get too long"). A cue wider than MAX_LINE_WIDTH
# is cut here into the fewest lines that fit, each its own stop.
#
# Where it is cut is what makes this more than a wrap. Only between
# two words, and at the best place the line offers: a mark or a space
# it already breathes at; a clause's end (〜て, 〜けど, a sentence-final
# ね with no mark after it) or a conjunction's start; then a phrase's
# end, a particle before a new word -- the の that joins two nouns last
# of those. Never before a particle, an auxiliary, a suffix or a mark,
# never after a prefix or an この, never inside a verb's chain
# (い|て|くれる, 歌わ|せ|て): a grammar point is found on one line, and
# a cut through one would lose it. Among the cuts left, the pieces are
# kept near one width, so a line is not cut into nineteen characters
# and three.
#
# A cut line shares its cue's time. Each piece runs from where its
# first word is said to where the next piece's is: a time the track
# measured there (the cue's `words`, study/captions.py) where it has
# one, else placed between the nearest two by the beats of the words
# between them, as the frontend reads a line out
# (components/analysis/wordTimes.js). The pieces tile the cue, and
# each keeps the measured times that fall in it, rebased onto its own
# text.
#
# Without a tokenizer a line is cut only where it has a mark or a
# space, which needs no word to be found; a line with neither stays
# whole, as wide as it came.
import unicodedata

from study import morphology
from study.text_normalize import japanese_ratio

# In full-width characters, a Latin letter or a space counting half.
# A broadcast subtitle holds two rows of thirteen; the stage at display
# size holds about seven a row on a phone, so 22 is three rows there.
MAX_LINE_WIDTH = 22
# A piece narrower than this is a scrap (a ね！ on its own), dearer
# than a less even cut.
MIN_PIECE_WIDTH = 4

# What a cut costs where it falls; lower is better, None is never.
_AT_BREATH = 0
_AT_SENTENCE_END = 1
_AT_CLAUSE = 2
_AT_UNMARKED_END = 3
_AT_PHRASE = 4
_AT_LIST = 6
_AFTER_CONJUNCTION = 6
_AT_GENITIVE = 12
_BETWEEN_WORDS = 10
_IN_COMPOUND = 30
_IN_UNKNOWN = 40

# Cost of a line, of a width over the cap, of a scrap, and of a piece
# away from the even width. Half a character over costs more than a
# line more: the cap is the point, and only a line with nowhere left
# to cut goes past it.
_PIECE = 1000
_OVER = 5000
_SCRAP = 20
_UNEVEN = 0.05

# A mark ends what is before it and never opens a line.
_CLOSERS = frozenset("、。，．,.!?！？…‥」』）)〉》】〜～~♪・")
_OPENERS = frozenset("「『（(〈《【")
_FINAL_PARTICLES = frozenset({"ね", "よ", "な", "わ", "ぞ", "ぜ", "さ", "よね", "かな", "かしら", "っけ"})
_CONTENT = frozenset({
    "noun", "verb", "adjective", "adverb", "pronoun", "adnominal",
    "prefix", "conjunction", "interjection", "filler",
})
# A mark between two said words is a breath: two beats (wordTimes.js).
_BREATH = frozenset("、。，．,.!?！？…「」『』（）()〜~♪ 　")
_PAUSE = 2
_SMALL = frozenset("ぁぃぅぇぉゃゅょゎゕゖァィゥェォャュョヮヵヶ")


def char_width(c: str) -> float:
    return 1.0 if unicodedata.east_asian_width(c) in ("W", "F", "A") else 0.5


def line_width(text: str) -> float:
    return sum(char_width(c) for c in text.strip())


def _has_japanese(text: str) -> bool:
    return bool(text.strip()) and japanese_ratio(text) > 0.0


def _latin(m) -> bool:
    return m.surface.isascii() and any(c.isalpha() for c in m.surface)


def _mark(m) -> bool:
    return bool(m.surface) and all(c in _CLOSERS for c in m.surface)


def _cut_cost(prev, nxt, gap: str):
    """What a cut between `prev` and `nxt` costs, `gap` the text
    between them (whitespace, or nothing). None where it may not go."""
    if _mark(nxt):
        return None
    if prev.pos == "prefix" or prev.pos == "adnominal":
        return None
    if nxt.pos in ("particle", "auxiliary", "suffix"):
        return None
    # A verb's chain: 〜ている, 〜てくれる, 〜といい, a noun's する.
    if nxt.auxiliary_use and (prev.conjunctive or prev.pos in ("verb", "adjective", "auxiliary", "noun", "suffix")):
        return None
    if gap and not (_latin(prev) and _latin(nxt)):
        return _AT_BREATH
    if _mark(prev) or nxt.surface[:1] in _OPENERS:
        return _AT_BREATH
    if prev.conjunctive:
        return _AT_CLAUSE
    if nxt.pos == "conjunction":
        return _AT_CLAUSE
    if prev.pos == "conjunction":
        return _AFTER_CONJUNCTION
    if prev.pos == "particle":
        if prev.surface in _FINAL_PARTICLES:
            return _AT_SENTENCE_END
        if prev.surface == "の":
            return _AT_GENITIVE
        if prev.surface in ("と", "や", "か"):
            return _AT_LIST
        return _AT_PHRASE
    if prev.pos == "auxiliary" and nxt.pos in _CONTENT:
        return _AT_UNMARKED_END
    if "interjection" in (prev.pos, nxt.pos):
        return _AT_CLAUSE
    if prev.pos in ("symbol", "other") or nxt.pos in ("symbol", "other"):
        return _IN_UNKNOWN
    if prev.pos in ("noun", "pronoun") and nxt.pos in ("noun", "pronoun"):
        return _IN_COMPOUND
    return _BETWEEN_WORDS


def _breath_cuts(text: str) -> list[tuple[int, int, float]]:
    """Without a tokenizer: (end of the piece before, start of the one
    after, cost) after each run of marks or spaces inside the line."""
    cuts = []
    i = 0
    while i < len(text):
        c = text[i]
        if c.isspace() or c in _CLOSERS:
            j = i
            while j < len(text) and (text[j].isspace() or text[j] in _CLOSERS):
                j += 1
            if 0 < i and j < len(text) and text[j] not in _CLOSERS:
                end = i
                while end < j and text[end] in _CLOSERS:
                    end += 1
                cuts.append((end, j, _AT_BREATH))
            i = j
        else:
            i += 1
    return cuts


def _cuts(text: str, tokens) -> list[tuple[int, int, float]]:
    if not tokens:
        return _breath_cuts(text)
    cuts = []
    for prev, nxt in zip(tokens, tokens[1:]):
        cost = _cut_cost(prev, nxt, text[prev.end:nxt.start])
        if cost is not None:
            cuts.append((prev.end, nxt.start, cost))
    return cuts


def _plan(text: str, cuts: list[tuple[int, int, float]]) -> list[tuple[int, int]]:
    """The pieces, as (start, end) offsets: the cheapest way through the
    line's cuts, the fewest lines first."""
    total = line_width(text)
    rows = -(-total // MAX_LINE_WIDTH)
    even = total / rows
    japanese = _has_japanese(text)
    # The places a piece may start, with the cost of the cut before it
    # and where the piece before it ends.
    starts = [(0, 0, 0.0)] + [(nxt, end, cost) for end, nxt, cost in cuts]

    def piece_cost(a: int, b: int) -> float:
        piece = text[a:b]
        width = line_width(piece)
        cost = _PIECE + _OVER * max(0.0, width - MAX_LINE_WIDTH)
        cost += _SCRAP * max(0.0, MIN_PIECE_WIDTH - width)
        cost += _UNEVEN * (width - even) ** 2
        if japanese and not _has_japanese(piece):
            cost += 100 * _PIECE
        return cost

    # best[k]: the cheapest way to have cut the line up to starts[k].
    best = [0.0] + [float("inf")] * (len(starts) - 1)
    back = [-1] * len(starts)
    for k in range(1, len(starts)):
        start_k, end_before, cut = starts[k]
        for j in range(k):
            if best[j] == float("inf"):
                continue
            a = starts[j][0]
            if end_before <= a:
                continue
            cost = best[j] + cut + piece_cost(a, end_before)
            if cost < best[k]:
                best[k], back[k] = cost, j
    final, last = float("inf"), 0
    for k, (a, _end, _cut) in enumerate(starts):
        if best[k] == float("inf") or a >= len(text):
            continue
        cost = best[k] + piece_cost(a, len(text))
        if cost < final:
            final, last = cost, k
    pieces = []
    k, b = last, len(text)
    while k != -1:
        a = starts[k][0]
        pieces.append((a, b))
        b = starts[k][1]
        k = back[k]
    return pieces[::-1]


def _beats(text: str, tokens) -> list[float]:
    """The beats said before each offset of `text`: cum[o], cum[0] = 0."""
    weight = [0.0] * len(text)
    for m in tokens or []:
        reading = m.reading or ""
        n = sum(1 for c in reading if ("ぁ" <= c <= "ゖ" or c == "ー") and c not in _SMALL)
        if not n:
            for c in m.surface:
                if "ぁ" <= c <= "ヺ" and c not in _SMALL:
                    n += 1
                elif c.isalnum():
                    n += 0.5 if c.isascii() else 2
        width = max(1, m.end - m.start)
        for i in range(m.start, min(m.end, len(text))):
            weight[i] = n / width
    if not tokens:
        weight = [0.0 if c.isspace() or c in _CLOSERS else 1.0 for c in text]
    said = [i for i, w in enumerate(weight) if w > 0]
    if said:
        for i in range(said[0] + 1, said[-1]):
            if weight[i] == 0 and text[i] in _BREATH:
                weight[i] = _PAUSE
    cum = [0.0]
    for w in weight:
        cum.append(cum[-1] + w)
    return cum


def _clock(text: str, tokens, start: float, end: float, words) -> callable:
    """The time a piece starting at an offset of `text` is said."""
    cum = _beats(text, tokens)
    anchors = [(0, start)]
    for o, t in words or []:
        if not (0 <= o <= len(text) and start <= t <= end):
            continue
        if o == anchors[-1][0]:
            if t > (anchors[-2][1] if len(anchors) > 1 else float("-inf")):
                anchors[-1] = (o, t)
            continue
        if t > anchors[-1][1]:
            anchors.append((o, t))
    if anchors[-1][0] < len(text) and end > anchors[-1][1]:
        anchors.append((len(text), end))

    def at(offset: int) -> float:
        for (oa, ta), (ob, tb) in zip(anchors, anchors[1:]):
            if oa <= offset <= ob:
                if offset == oa:
                    return ta
                span = cum[ob] - cum[oa]
                share = (cum[offset] - cum[oa]) / span if span > 0 else (offset - oa) / (ob - oa)
                return ta + (tb - ta) * share
        return anchors[-1][1]

    return at


def cut_line(text: str, start: float | None, end: float | None, words=None) -> list[dict]:
    """`text` as the lines it is studied in: itself when it fits
    MAX_LINE_WIDTH, else the fewest pieces that do, each
    {"text", "start", "end"} and its `words` where the cue had some
    (offsets rebased onto the piece). A cue without times keeps None."""
    whole = {"text": text, "start": start, "end": end, **({"words": words} if words else {})}
    if line_width(text) <= MAX_LINE_WIDTH:
        return [whole]
    tokens = morphology.tokenize(text) or []
    cuts = _cuts(text, tokens)
    if not cuts:
        return [whole]
    pieces = _plan(text, cuts)
    if len(pieces) < 2:
        return [whole]
    timed = start is not None and end is not None and end > start
    at = _clock(text, tokens, start, end, words) if timed else None
    out = []
    for i, (a, b) in enumerate(pieces):
        last = i == len(pieces) - 1
        piece = {
            "text": text[a:b],
            "start": (start if i == 0 else round(at(a), 3)) if timed else start,
            "end": (end if last else round(at(pieces[i + 1][0]), 3)) if timed else end,
        }
        mine = [[o - a, t] for o, t in words or [] if a <= o < b or (last and o == len(text))]
        if mine:
            piece["words"] = mine
        out.append(piece)
    return out
