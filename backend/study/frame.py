# ── 骨組み — how a line is built, part by part (plan 311) ──────────
# The owner's pick C of the canvas "Tsuji — Explain, made clear": Explain
# no longer prints a paragraph. The deep tier is asked for the line's
# FRAME -- the line cut into its parts, in the order they come, each
# named by what it does in the sentence (a role from ROLES, which the app
# names in the learner's language) and said in one line -- and the sheet
# draws a part a row.
#
# The paragraph it replaces had three faults the owner's screenshots
# showed: nothing tied its prose to the pieces of the line; a sentence
# about the lines around this one even where they built nothing of it
# ("the line before and the line after do not complete this
# construction"); and, on a line with no verb, a word supplied that the
# line does not have ("the unstated negative of 関心"). A frame cannot
# say the first, and is held here against the other two:
#
#   * a part is a run of the line as written -- its text is taken from
#     the line, never from the model, and a part the line does not hold
#     in order is dropped;
#   * a part carried from a neighbouring line (`from`, the topic the
#     line before set) is kept only when the words stand in that line --
#     the only thing a frame may say about the lines around;
#   * a word the line leaves out (`dropped`) is only ever a copula or a
#     particle, from DROPPED, and only where the line does not have it.
#
# Pure: the model's reply and the line in, the frame out, so a reply
# kept in phrase_analysis_cache is held to the same rules every time it
# is read.
import re
import unicodedata

# What a part may do in its sentence. The app names each in the
# learner's language (frontend locales, `frameRole`); a role outside
# the list keeps its part with no name over it.
ROLES = (
    "topic", "subject", "object", "target", "time", "place", "means",
    "reason", "condition", "contrast", "purpose", "quote", "modifier",
    "predicate",
)

# What a line may be said to leave out: the copula and the particles a
# song or speech drops (僕ら(だ), 私(は)), never a content word.
DROPPED = frozenset({"だ", "です", "は", "が", "を", "に", "の", "と", "へ", "で", "も"})

# Neighbouring lines a part may be carried from.
SIDES = ("before", "after")

# A line is cut into a handful of parts: a clause or a phrase each,
# never a part a token. More than this is a reply that cut too fine.
MAX_PARTS = 8
# One short sentence a part; a reply that writes an essay is cut.
MAX_SAY = 280
# The share of the line's letters its parts must hold between them: a
# frame of two parts over a third of a long line would draw a skeleton
# with its middle missing.
MIN_COVER = 0.5


def _skipped(ch: str) -> bool:
    """A mark, a symbol or a space: what a model may leave out of a part
    it copies (、。！？♪ and the spaces of a subtitle)."""
    return ch.isspace() or unicodedata.category(ch)[0] in "PSZ"


def _letters(text: str) -> tuple[str, list[int]]:
    """`text` without its marks, each letter in its NFKC form (ｶ is カ,
    a full-width Ａ an A), and where in `text` each letter kept stood --
    the place in the line as the client holds it, not in a normalised
    copy."""
    kept, where = [], []
    for i, ch in enumerate(text):
        for c in unicodedata.normalize("NFKC", ch):
            if not _skipped(c):
                kept.append(c)
                where.append(i)
    return "".join(kept), where


def _text(value) -> str:
    return value.strip() if isinstance(value, str) else ""


def _short(say: str) -> str:
    if len(say) <= MAX_SAY:
        return say
    cut = say[:MAX_SAY]
    stop = max(cut.rfind(". "), cut.rfind("。"))
    return cut[:stop + 1] if stop > MAX_SAY // 2 else cut.rstrip() + "…"


def clean_frame(raw, phrase: str, before: str = "", after: str = "") -> list[dict]:
    """The model's frame (`raw`, its list of {"jp", "role", "say",
    "from"?, "dropped"?}) held to `phrase` and, for a carried part, to
    the lines `before` and `after` it: the parts the line holds, in
    order, each {"jp", "start", "end", "role", "say", "dropped"?} with
    its text as the line writes it (start/end its place in `phrase`),
    and the carried ones {"jp", "role", "say", "from"} before or after
    them. [] when no part is the line's own, or when its parts hold less
    than MIN_COVER of it."""
    if not isinstance(raw, list) or not isinstance(phrase, str) or not phrase.strip():
        return []
    letters, where = _letters(phrase)
    sides = {"before": before or "", "after": after or ""}
    ahead, parts, behind = [], [], []
    cursor = 0  # in `letters`
    covered = 0
    for item in raw[: MAX_PARTS * 2]:
        if not isinstance(item, dict):
            continue
        jp = _text(item.get("jp"))
        if not jp:
            continue
        role = _text(item.get("role")).lower()
        role = role if role in ROLES else ""
        say = _short(_text(item.get("say")))
        side = _text(item.get("from")).lower()
        if side in SIDES:
            # Carried: only words that stand in that line, and not in
            # this one (the line's own words are a part of it).
            wanted, _ = _letters(jp)
            if wanted and wanted in _letters(sides[side])[0] and wanted not in letters:
                part = {"jp": jp, "role": role, "say": say, "from": side}
                (ahead if side == "before" else behind).append(part)
            continue
        if len(parts) >= MAX_PARTS:
            continue
        wanted, _ = _letters(jp)
        found = letters.find(wanted, cursor) if wanted else -1
        if found < 0:
            continue
        stop = found + len(wanted)
        start = where[found]
        # A part reaches over the marks after it (ので、), so the line
        # reads whole down its parts.
        end = where[stop] if stop < len(where) else len(phrase)
        part = {"jp": phrase[start:end].strip(), "start": start, "end": end, "role": role, "say": say}
        gone = _text(item.get("dropped"))
        if gone in DROPPED and not letters[stop:].startswith(gone):
            part["dropped"] = gone
        parts.append(part)
        covered += len(wanted)
        cursor = stop
    if not parts or covered < MIN_COVER * len(letters):
        return []
    return ahead + parts + behind


def frame_text(frame: list[dict]) -> str:
    """The frame as plain lines -- a part and what it says -- for what
    reads an explanation as text: the asking's context, a stop's
    "explained" mark, a caller that draws no frame. A carried part,
    which only the frame's drawing can say, stays out; a part with
    nothing said is its words alone, so a frame is never read as no
    explanation."""
    lines = []
    for part in frame or []:
        if part.get("from"):
            continue
        gone = part.get("dropped")
        words = f"{part['jp']}{f'（{gone}）' if gone else ''}"
        lines.append(f"{words} — {part['say']}" if part.get("say") else words)
    return "\n".join(lines)


_SIDE_LINE = re.compile(r"^- (Before|After) it: (.*)$", re.MULTILINE)


def context_sides(context: str) -> tuple[str, str]:
    """The lines before and after a phrase, as routes/phrase.deep_context
    wrote them into its context block (" / " between two lines)."""
    found = {"Before": "", "After": ""}
    for side, text in _SIDE_LINE.findall(context or ""):
        found[side] = text
    return found["Before"], found["After"]
