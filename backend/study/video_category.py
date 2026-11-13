# ── 動画の部屋 — what kind of video a library video is (plan 322) ──
# The public library of analysed YouTube videos (routes/video_library.py)
# is browsed by kind: music, a podcast, a drama, the news. Nothing on the
# server knows a video's title or channel (the watch page goes through a
# metered proxy and is never read), so the kind is told from what the
# video says: a sample of its lines, in one cheap model call, once, when
# the video joins the library. The answer is one of CATEGORIES and
# nothing else; a reply that is none of them is the answer "other", and
# a call no model could be reached for leaves the video unsorted (NULL),
# which the library lists under "all" and asks again at its next opening.
#
# The call is rationed (core/daily_limit.py, VIDEO_CATEGORY_DAILY_LIMIT
# videos a learner a day: the learner whose fetch added the video pays
# it) and costed in scripts/llm_cost_model.py. Nothing a learner typed is
# sent: the lines are YouTube's own captions.
import json
import logging
import os
import re

from core import daily_limit
from study.llm_shared import chat

logger = logging.getLogger(__name__)

# What a library video can be. Order is the chips' order; "other" is
# last, and is also the answer to a reply that names none of these.
CATEGORIES = ("music", "podcast", "drama", "variety", "news", "vlog", "lesson", "gaming", "other")
OTHER = "other"

# The revision of what the sort says: a change to the prompt or the set
# bumps it, and a video sorted under another is sorted again.
CATEGORY_REV = 1

VIDEO_CATEGORY_FEATURE = "video_category"
VIDEO_CATEGORY_DAILY_LIMIT = int(os.environ.get("VIDEO_CATEGORY_DAILY_LIMIT", "30"))

# The sample sent: the opening, the middle and the end of the track, so
# a song's verse and chorus and a talk's intro and sign-off are all in
# it. Bounded by lines and by characters: a video is up to
# study/sentences.MAX_SENTENCES lines and the call must not scale with it.
SAMPLE_LINES = 45
SAMPLE_CHARS = 1800


class OverLimit(RuntimeError):
    """Today's VIDEO_CATEGORY_DAILY_LIMIT videos are sorted."""


SYSTEM = """You sort a YouTube video into one kind, from lines of its Japanese captions.

Answer with a JSON object {"category": "<kind>"} and nothing else. The kinds:
- music: a song or a music video, a cover, a live concert, lyrics (short repeated lines, a chorus).
- podcast: two or more people talking at length about a subject, an audio show, an interview, a radio programme.
- drama: a scene from a drama, an anime, a film, a skit or a short story, with characters speaking to each other.
- variety: a TV variety or talk show, comedy, a quiz, a game show, a reaction video made for laughs.
- news: a news report, a bulletin, a press conference, a documentary voice-over read in the register of news.
- vlog: one person telling about their day, travel, food, a hobby, shopping, a daily-life video.
- lesson: a lesson, a lecture, a tutorial, a language-learning or how-to video, a explainer.
- gaming: someone playing a video game and talking over it.
- other: anything that fits none of these.

Choose the kind the whole video most likely is, not the one a single line suggests. Captions of a song repeat; captions of speech do not. If you cannot tell, answer "other"."""

_PARSE_RE = re.compile(r"[a-z]+")


def sample(lines: list[str]) -> list[str]:
    """Up to SAMPLE_LINES of `lines`, spread over the whole track (its
    head, its middle, its tail), each trimmed, the whole held to
    SAMPLE_CHARS. Empty lines are never sent."""
    texts = [t.strip() for t in lines if t and t.strip()]
    if len(texts) <= SAMPLE_LINES:
        picked = texts
    else:
        third = SAMPLE_LINES // 3
        mid = len(texts) // 2 - third // 2
        picked = texts[:third] + texts[mid:mid + third] + texts[-(SAMPLE_LINES - 2 * third):]
    out, used = [], 0
    for text in picked:
        text = text[:120]
        if used + len(text) > SAMPLE_CHARS:
            break
        out.append(text)
        used += len(text)
    return out


def user_message(lines: list[str]) -> str:
    return "Lines:\n" + "\n".join(f"- {line}" for line in lines)


def parse_category(content: str) -> str | None:
    """The kind the model's reply names: one of CATEGORIES, or None for a
    reply that cannot be read at all. A readable reply naming something
    else is "other", never an invented kind."""
    cleaned = re.sub(r"^```(?:json)?|```$", "", (content or "").strip(), flags=re.MULTILINE).strip()
    value = None
    try:
        parsed = json.loads(cleaned)
        if isinstance(parsed, dict):
            value = parsed.get("category")
        elif isinstance(parsed, str):
            value = parsed
    except json.JSONDecodeError:
        start, end = cleaned.find("{"), cleaned.rfind("}")
        if start != -1 and end > start:
            try:
                parsed = json.loads(cleaned[start:end + 1])
                value = parsed.get("category") if isinstance(parsed, dict) else None
            except json.JSONDecodeError:
                value = None
        elif _PARSE_RE.fullmatch(cleaned.lower() or "-"):
            value = cleaned
    if not isinstance(value, str):
        return None
    value = value.strip().lower()
    return value if value in CATEGORIES else OTHER


def ask_category(lines: list[str]) -> str | None:
    """One call: the kind of the video `lines` are from. Raises
    LLMUnavailable as chat() does. max_tokens: one short word in a
    small object; reasoning off: a sort of text in hand."""
    picked = sample(lines)
    if not picked:
        return None
    content = chat(
        [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": user_message(picked)},
        ],
        timeout=30, max_tokens=60, reasoning=False, task="video-category",
        accept=lambda reply: parse_category(reply) is not None,
    )
    return parse_category(content)


def categorise(user_id: str, lines: list[str]) -> str | None:
    """The kind of a video, for `user_id`'s account. Claims one of
    today's VIDEO_CATEGORY_DAILY_LIMIT slots before the call (raises
    OverLimit past it); raises LLMUnavailable as chat() does, the slot
    given back when no model was paid (daily_limit.refund_unbilled). None
    when there is nothing to read or the reply could not be read."""
    if not sample(lines):
        return None
    if daily_limit.claim(user_id, VIDEO_CATEGORY_FEATURE, VIDEO_CATEGORY_DAILY_LIMIT) > VIDEO_CATEGORY_DAILY_LIMIT:
        raise OverLimit()
    with daily_limit.refund_unbilled(user_id, VIDEO_CATEGORY_FEATURE):
        return ask_category(lines)
