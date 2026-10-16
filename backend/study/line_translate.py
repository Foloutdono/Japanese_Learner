# ── A translation under every line (plan 235) ────────────────────
# The owner (2026-10-16): "add the translation for each sentence". The
# analyser's stage drew a line's translation only once Explain had
# bought the line's deep tier (plan 161), one model call a line --
# which docs/adr/0001 refuses to make for every line of a video.
#
# So a translation is not the deep tier. It is asked for a BLOCK of
# lines at once, as the learner reaches them: one call for twenty
# lines, the two either side given as context and not translated, the
# video's title and channel where the player knows them. A subtitle is
# translated better that way than alone -- a line that is half a
# sentence is read as the half of the sentence it is -- and at about a
# twentieth of the calls. Each translation is kept where the Passage is
# kept, by the line's text -- a video's on its session (routes/video.py),
# a typed or photographed Passage's on its history row (routes/phrase.py)
# -- so a chorus is paid once and the next opening pays nothing.
#
# translate_block rations the calls (core/daily_limit.py, LINE_TRANSLATION_
# DAILY_LIMIT blocks a day, for both kinds of Passage) and scripts/
# llm_cost_model.py costs them. The routes keep what it found.
import json
import logging
import os
import re

from core import daily_limit
from study.llm_shared import chat

logger = logging.getLogger(__name__)

# Lines one call translates, and lines either side it is shown.
# frontend/src/components/analysis/useLineTranslations.js asks by the
# same block (tests/test_line_translate.py holds the two equal).
BLOCK = 20
CONTEXT = 2

# 60 blocks is 1,200 lines a day, a feature film's whole track.
LINE_TRANSLATION_FEATURE = "line_translation"
LINE_TRANSLATION_DAILY_LIMIT = int(os.environ.get("LINE_TRANSLATION_DAILY_LIMIT", "60"))

# What is being translated, as the prompt names it.
KINDS = {
    "video": "the Japanese subtitles of a video",
    "text": "a Japanese text, a sentence or a part of one to a line,",
}

SYSTEM_TEMPLATE = """You translate {what} into {lang_name}, for a learner of Japanese who reads each line beside its translation.

You are given numbered lines, in order, and the lines just before and after them as context. Respond with ONLY one JSON object (no markdown fences, no commentary):

{{"lines": {{"1": "...", "2": "..."}}}}

- One entry per numbered line, keyed by its number, and nothing for the context lines.
- Each value is that line alone translated into {lang_name}, natural, as a subtitle would give it. A line that is only part of a sentence is translated as that part: never pull in words from the line before or after it.
- Use the context and the title, when there is one, to get the meaning right (who is speaking, what a pronoun or a dropped subject refers to), but do not translate it.
- No notes, no romaji, no alternatives, no quotation marks around the line.

The key "lines" and the numbers stay exactly as shown, whatever {lang_name} is."""


class OverLimit(RuntimeError):
    """Today's LINE_TRANSLATION_DAILY_LIMIT blocks are spent."""


def user_message(lines: list[str], before: list[str], after: list[str],
                 title: str = "", channel: str = "") -> str:
    parts = []
    about = " -- ".join(part for part in (title.strip(), channel.strip()) if part)
    if about:
        parts += [f"Video: {about}", ""]
    if before:
        parts += ["Context before (do not translate):", *before, ""]
    parts.append("Lines to translate:")
    parts += [f"{i}. {line}" for i, line in enumerate(lines, 1)]
    if after:
        parts += ["", "Context after (do not translate):", *after]
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


def parse_translations(content: str, count: int) -> list[str | None]:
    """The model's reply as `count` translations, in order; None for a
    line it left out or answered with anything but a sentence."""
    parsed = _parse(content) or {}
    out = []
    for i in range(1, count + 1):
        value = parsed.get(str(i))
        out.append(value.strip() if isinstance(value, str) and value.strip() else None)
    return out


def translate_lines(lines: list[str], before: list[str], after: list[str], lang_name: str,
                    title: str = "", channel: str = "", kind: str = "video") -> list[str | None]:
    """One call: `lines` translated into `lang_name`, in order, None
    where the reply had none. Raises LLMUnavailable as chat() does.

    max_tokens: twenty subtitles of a dozen words and their keys, with
    room. reasoning off: a translation of text in hand, and a thinking
    pass on the models that bill one crowded the answer out before."""
    if not lines:
        return []
    content = chat(
        [
            {"role": "system", "content": SYSTEM_TEMPLATE.format(lang_name=lang_name, what=KINDS[kind])},
            {"role": "user", "content": user_message(lines, before, after, title, channel)},
        ],
        timeout=45, max_tokens=2000, reasoning=False, task="line-translation",
        # A reply that is no JSON of lines is another model's turn.
        accept=lambda reply: _parse(reply) is not None,
    )
    return parse_translations(content, len(lines))


def translate_block(user_id: str, lines: list[dict], index: int, lang_name: str, known: dict,
                    title: str = "", channel: str = "", kind: str = "video") -> tuple[int, list, dict]:
    """The block of `lines` (each {"text", "foreign"?}) that `index`
    falls in, translated: (its first index, one translation or None per
    line of it, the translations it had to ask for). A line `known`
    already holds is not asked again, and a line repeated in the block
    is asked once. A block with something to ask claims one of today's
    LINE_TRANSLATION_DAILY_LIMIT calls before the call is made (raises
    OverLimit past it); raises LLMUnavailable as chat() does."""
    start = index - index % BLOCK
    block = lines[start:start + BLOCK]
    wanted = list(dict.fromkeys(
        s["text"] for s in block if not s.get("foreign") and s.get("text") and s["text"] not in known
    ))
    found = {}
    if wanted:
        if daily_limit.claim(user_id, LINE_TRANSLATION_FEATURE, LINE_TRANSLATION_DAILY_LIMIT) \
                > LINE_TRANSLATION_DAILY_LIMIT:
            raise OverLimit()
        end = start + len(block)
        before = [s.get("text") or "" for s in lines[max(0, start - CONTEXT):start]]
        after = [s.get("text") or "" for s in lines[end:end + CONTEXT]]
        got = translate_lines(wanted, [b for b in before if b], [a for a in after if a],
                              lang_name, title, channel, kind)
        found = {text: tr for text, tr in zip(wanted, got) if tr}
    merged = {**known, **found}
    return start, [None if s.get("foreign") else merged.get(s.get("text")) for s in block], found


# The rows a Passage's translations are kept on: a video's session, a
# typed or photographed Passage's history row. Both are the learner's
# and erased with the account (routes/account.py).
_TABLES = frozenset({"video_sessions", "phrase_history"})


def keep(table: str, row_id: int, lang: str, found: dict) -> None:
    """`found` merged into the row's translations in `lang`, never
    written over whole: two blocks asked at once must both land."""
    if table not in _TABLES:
        raise ValueError(table)
    from core.db import db_conn

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                UPDATE {table}
                   SET translations = jsonb_set(
                         translations, ARRAY[%s],
                         COALESCE(translations -> %s, '{{}}'::jsonb) || %s::jsonb)
                 WHERE id = %s
                """,
                (lang, lang, json.dumps(found, ensure_ascii=False), row_id),
            )
        conn.commit()
    finally:
        conn.close()
