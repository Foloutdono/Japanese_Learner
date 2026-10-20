# ── 歌 — which lines are the song (plan 262) ─────────────────────
# A music video's track is the song and more: a spoken intro before the
# first verse, a skit in the bridge, the channel asking to subscribe,
# the credits (作詞・作曲), the sound cues an auto-caption writes for
# what it cannot transcribe ([音楽], (拍手)). The owner (2026-10-20):
# separate the lines that are part of the music from the ones that only
# happen to be in the clip, so a lyrics deck holds the song.
#
# Two passes. What a pattern can tell for certain -- a sound cue, a
# credit, a line of music symbols -- is told here and never asked. The
# rest goes to the model, numbered, in one call for a song (CALL_LINES
# a call past that, under the same ration), each line answered with
# one of KINDS. It is a sort, never a filter: the learner is shown the
# two piles and moves any line between them before a deck is made
# (components/decks/LyricsImportSheet.jsx), and a line the model left
# out or answered strangely stays in the song. A song with no model
# behind it (the ration spent, every provider down) is sorted by the
# patterns alone and says so.
#
# sort_lines rations the calls (core/daily_limit.py, LYRICS_SORT_DAILY_
# LIMIT songs a day) and scripts/llm_cost_model.py costs them. routes/
# video.py keeps what it found on the session, by the line's text,
# under SORT_REV: a chorus is asked once, and a second look at the same
# song asks nothing.
import json
import logging
import os
import re

from core import daily_limit
from study.llm_shared import chat

logger = logging.getLogger(__name__)

# What a line can be. Only "sung" goes in the song's pile.
SUNG = "sung"
KINDS = (SUNG, "spoken", "credit", "sound")

# The revision of what the sort says: a change to the prompt or the
# patterns bumps it, and a session sorted under another is sorted again.
SORT_REV = 1

# One song a call; a track longer than this (a live set, a film) takes
# a call per CALL_LINES lines, all under the one ration.
CALL_LINES = 150

LYRICS_SORT_FEATURE = "lyrics_sort"
LYRICS_SORT_DAILY_LIMIT = int(os.environ.get("LYRICS_SORT_DAILY_LIMIT", "20"))


class OverLimit(RuntimeError):
    """Today's LYRICS_SORT_DAILY_LIMIT songs are sorted."""


# ── What a pattern can tell ───────────────────────────────────────
# A line wholly inside one pair of brackets...
_BRACKETED_RE = re.compile(r"^\s*[\[［(（【〔<＜《]\s*(.*?)\s*[\]］)）】〕>＞》]\s*$")
# ...naming a sound rather than saying a word. Short on purpose: a
# backing vocal in brackets, （君の名を）, is sung, and is the model's.
_SOUND_WORDS = (
    "音楽", "拍手", "歓声", "笑", "笑い", "笑い声", "間奏", "前奏", "後奏", "イントロ", "アウトロ",
    "効果音", "BGM", "SE", "music", "applause", "laughter", "laughs", "cheering", "instrumental",
    "intro", "outro", "interlude", "silence", "inaudible", "foreign", "♪", "♫",
)
_MUSIC_ONLY_RE = re.compile(r"^[\s♪♫♬♩〜~～・…ー\-]*$")
# A credit: a role, then a colon or a slash, then a name.
_CREDIT_RE = re.compile(
    r"^\s*(作詞|作曲|編曲|作詞作曲|作詞・作曲|歌|唄|うた|ボーカル|演奏|映像|監督|振付|イラスト|字幕|翻訳|"
    r"vocals?|lyrics?|music|composer|composed by|written by|arrange(?:ment|d by)?|mix(?:ed by)?|"
    r"master(?:ing|ed by)?|director|directed by|illust(?:ration)?|movie|mv|animation|guitar|bass|drums?|"
    r"piano|keyboards?|subtitles?|translation)\s*[:：/／]",
    re.IGNORECASE,
)


def obvious_kind(text: str) -> str | None:
    """The kind a pattern can tell for certain, or None for the model's."""
    line = (text or "").strip()
    if not line or _MUSIC_ONLY_RE.match(line):
        return "sound"
    inner = _BRACKETED_RE.match(line)
    if inner:
        words = inner.group(1).strip(" ♪♫♬♩").lower()
        if not words or any(words == w.lower() for w in _SOUND_WORDS):
            return "sound"
    if _CREDIT_RE.match(line):
        return "credit"
    return None


# ── What the model is asked ───────────────────────────────────────
SYSTEM = """You sort the lines of a Japanese subtitle or lyrics track taken from a music video.

The track holds the song's lyrics, and may also hold lines that are not part of the song: talk before or after the music or in a break (a greeting, an introduction, a skit, a scene's dialogue), the channel asking to like or subscribe, credits and title cards, descriptions of sounds.

You are given the lines, numbered, in the order they appear. Respond with ONLY one JSON object (no markdown fences, no commentary):

{"lines": {"1": "sung", "2": "spoken"}}

One entry per numbered line, keyed by its number, each value exactly one of:
- "sung": a line of the song's lyrics, as it is sung or rapped -- the verses, the chorus each time it comes back, a backing vocal, a line in English or another language that is part of the song.
- "spoken": talk that is not part of the song: an introduction, a greeting, a skit or a scene's dialogue, a message to the viewer, an announcement.
- "credit": who wrote, composed, sang or made it, the song's title, a title card, a channel or label name.
- "sound": a description of a sound or of the music, not words anyone says.

When a line could be either, answer "sung": a lyric wrongly kept costs the learner one tap, a lyric wrongly removed costs them part of the song. Use the order: a run of talk usually comes before the first verse, between two parts of the song, or after the last line.

The key "lines" and the numbers stay exactly as shown."""


def user_message(lines: list[str], about: str = "") -> str:
    parts = [f"Video or file: {about.strip()}", ""] if about.strip() else []
    parts.append("Lines:")
    parts += [f"{i}. {line}" for i, line in enumerate(lines, 1)]
    return "\n".join(parts)


def _parse(content: str):
    cleaned = re.sub(r"^```(?:json)?|```$", "", (content or "").strip(), flags=re.MULTILINE).strip()
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        start, end = cleaned.find("{"), cleaned.rfind("}")
        if start == -1 or end <= start:
            return None
        try:
            parsed = json.loads(cleaned[start:end + 1])
        except json.JSONDecodeError:
            return None
    if isinstance(parsed, dict) and "lines" in parsed:
        parsed = parsed["lines"]
    if isinstance(parsed, list):
        parsed = {str(i): value for i, value in enumerate(parsed, 1)}
    return parsed if isinstance(parsed, dict) else None


def parse_kinds(content: str, count: int) -> list[str]:
    """The model's reply as `count` kinds, in order. A line it left out
    or answered with anything but one of KINDS is sung: kept."""
    parsed = _parse(content) or {}
    out = []
    for i in range(1, count + 1):
        value = parsed.get(str(i))
        value = value.strip().lower() if isinstance(value, str) else ""
        out.append(value if value in KINDS else SUNG)
    return out


def ask_kinds(lines: list[str], about: str = "") -> list[str]:
    """One call: a kind for each of `lines`, in order. Raises
    LLMUnavailable as chat() does.

    max_tokens: 150 keys and a short word each, with room. reasoning
    off: a sort of text in hand."""
    if not lines:
        return []
    content = chat(
        [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": user_message(lines, about)},
        ],
        timeout=45, max_tokens=2500, reasoning=False, task="lyrics-sort",
        accept=lambda reply: _parse(reply) is not None,
    )
    return parse_kinds(content, len(lines))


def _text(line: dict) -> str:
    return (line.get("text") or "").strip()


def sort_lines(user_id: str, lines: list[dict], known: dict, about: str = "") -> tuple[list[str], dict]:
    """A kind for each of `lines` (each {"text", ...}), in order, and
    the kinds this sort found that `known` did not hold, by text. A line
    `known` holds is not asked again, a line repeated is asked once, and
    a line a pattern can tell is never asked. Something left to ask
    claims one of today's LYRICS_SORT_DAILY_LIMIT songs before the first
    call (raises OverLimit past it); raises LLMUnavailable as chat()
    does.

    A line with no Japanese in it is asked like the rest: an English
    hook is part of a J-pop chorus, and "Thanks for watching" is not."""
    fresh = {}
    wanted = []
    for text in dict.fromkeys(_text(s) for s in lines):
        if not text or text in known:
            continue
        kind = obvious_kind(text)
        if kind:
            fresh[text] = kind
        else:
            wanted.append(text)
    if wanted:
        if daily_limit.claim(user_id, LYRICS_SORT_FEATURE, LYRICS_SORT_DAILY_LIMIT) > LYRICS_SORT_DAILY_LIMIT:
            raise OverLimit()
        for at in range(0, len(wanted), CALL_LINES):
            chunk = wanted[at:at + CALL_LINES]
            fresh.update(zip(chunk, ask_kinds(chunk, about)))
    return sort_by_patterns(lines, {**known, **fresh}), fresh


def sort_by_patterns(lines: list[dict], known: dict) -> list[str]:
    """The kinds with no model behind them: what `known` holds, what a
    pattern can tell, and every other line sung."""
    return [known.get(_text(s)) or obvious_kind(_text(s)) or SUNG for s in lines]
