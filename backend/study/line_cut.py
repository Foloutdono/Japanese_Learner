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
#
# Three rows were still too many (the owner, 2026-10-20: "make sure
# sentences aren't too big, if impossible to cut in two, make them
# smaller"): under the video and over the dock, a phone of ordinary
# height holds two rows at display size and the translation, and a
# third put the translation under the dock. So a line wider than
# TARGET_LINE_WIDTH, two rows there, is cut again -- but only where a
# cut costs nothing: at a mark, a clause's end or a phrase's, never
# inside a compound or after the の that joins two nouns, and never
# through a point the grammar detector finds on the line, かもしれない and
# 〜なければならない whole as much as 〜ている. A line with no such
# place, or none that leaves every piece two rows, stays as it came, and
# the stage sets it a size smaller instead (AnalyzerScreen's useLineFit).
import unicodedata

from study import grammar_detect, morphology
from study.text_normalize import japanese_ratio

# In full-width characters, a Latin letter or a space counting half.
# A broadcast subtitle holds two rows of thirteen; the stage at display
# size holds about eight a row on a phone, so 22 is three rows there,
# the most any line is left at, and 16 two, where a clean cut takes it.
MAX_LINE_WIDTH = 22
TARGET_LINE_WIDTH = 16
# A stored line cut by today's rule carries it (`cut_rev`), so a line
# with nowhere clean to cut is not tried again at every opening
# (routes/video._current). Bumped when what a line is cut into changes.
CUT_REV = 2
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
# The dearest cut that takes a line down to TARGET_LINE_WIDTH: a list's
# と or a conjunction's end, and anything cheaper.
_CLEAN = _AT_LIST

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


# The frames a sentence's subject or object hangs in (plan 272): their が
# or を and the predicate are kept whole each, but a line breathes
# between them -- …みなさんが | いてくれるので.
_FRAMES = frozenset({"〜があります／います", "〜が好きです", "〜がきらいです", "〜が上手です／下手です",
                     "〜が分かります", "〜をください"})


def _clean_cuts(text: str, tokens, cuts: list[tuple[int, int, float]]) -> list[tuple[int, int, float]]:
    """The cuts that lose nothing: no dearer than _CLEAN, and through no
    grammar point -- the whole stretch it reaches over where one line
    could hold it (から〜まで keeps the clause between them), and only
    the pieces it is written on where none could (a 〜は〜が from the
    line's head to its foot was never going to stay on one line)."""
    spans = []
    for hit in grammar_detect.hits(text, tokens) if tokens else []:
        if line_width(text[hit["start"]:hit["end"]]) <= TARGET_LINE_WIDTH and hit["pattern"] not in _FRAMES:
            spans.append((hit["start"], hit["end"]))
        else:
            spans += [tuple(segment) for segment in hit["segments"]]
    return [(end, nxt, cost) for end, nxt, cost in cuts
            if cost <= _CLEAN and not any(s < end and nxt < e for s, e in spans)]


def _plan(text: str, cuts: list[tuple[int, int, float]], cap: float = MAX_LINE_WIDTH,
          lo: int = 0, hi: int | None = None) -> list[tuple[int, int]]:
    """The pieces of text[lo:hi], as (start, end) offsets: the cheapest
    way through the cuts inside it, the fewest lines no wider than `cap`
    first."""
    hi = len(text) if hi is None else hi
    total = line_width(text[lo:hi])
    rows = -(-total // cap)
    even = total / rows
    japanese = _has_japanese(text[lo:hi])
    # The places a piece may start, with the cost of the cut before it
    # and where the piece before it ends.
    starts = [(lo, lo, 0.0)] + [(nxt, end, cost) for end, nxt, cost in cuts if lo < end and nxt < hi]

    def piece_cost(a: int, b: int) -> float:
        piece = text[a:b]
        width = line_width(piece)
        cost = _PIECE + _OVER * max(0.0, width - cap)
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
        if best[k] == float("inf") or a >= hi:
            continue
        cost = best[k] + piece_cost(a, hi)
        if cost < final:
            final, last = cost, k
    pieces = []
    k, b = last, hi
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


def _recut(text: str, clean: list[tuple[int, int, float]], a: int, b: int) -> list[tuple[int, int]]:
    """text[a:b] in pieces no wider than TARGET_LINE_WIDTH, cut only at
    `clean` places, or whole when they cannot all be: a piece left wider
    is set smaller on the stage, not cut where it would lose something."""
    if line_width(text[a:b]) <= TARGET_LINE_WIDTH:
        return [(a, b)]
    pieces = _plan(text, clean, TARGET_LINE_WIDTH, a, b)
    widths = [line_width(text[x:y]) for x, y in pieces]
    if (len(pieces) < 2 or max(widths) > TARGET_LINE_WIDTH or min(widths) < MIN_PIECE_WIDTH
            or (_has_japanese(text[a:b]) and not all(_has_japanese(text[x:y]) for x, y in pieces))):
        return [(a, b)]
    return pieces


def cut_line(text: str, start: float | None, end: float | None, words=None) -> list[dict]:
    """`text` as the lines it is studied in: itself when it fits
    TARGET_LINE_WIDTH; else the fewest pieces no wider than
    MAX_LINE_WIDTH, each cut again to TARGET_LINE_WIDTH where it cuts
    clean; each {"text", "start", "end"} and its `words` where the cue
    had some (offsets rebased onto the piece). A cue without times
    keeps None."""
    whole = {"text": text, "start": start, "end": end, **({"words": words} if words else {})}
    if line_width(text) <= TARGET_LINE_WIDTH:
        return [whole]
    tokens = morphology.tokenize(text) or []
    cuts = _cuts(text, tokens)
    if not cuts:
        return [whole]
    pieces = _plan(text, cuts) if line_width(text) > MAX_LINE_WIDTH else [(0, len(text))]
    clean = _clean_cuts(text, tokens, cuts)
    pieces = [piece for a, b in pieces for piece in _recut(text, clean, a, b)]
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
