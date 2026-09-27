"""
仏訳 — a line in the learner's language for the pool's words (plan 162).

The words the deck teaches carry their French beside their English
(plan 160). A word past the deck is a JMdict pool word (plan 148), and
the pool was built from JMdict's English export: in a French words list
it read "ticket barrier" under 改札口. Two sources fill it, in order:

  1. JMdict's own French, where its edition has a line
     (content/vocab_jmdict_data.fr_gloss, written by
     scripts/build_pool_fr.py). The analysis already carries it as the
     entry's `meaning_fr`, as a deck word's; it is read here too, for a
     line stored before the table existed (a video session's).
  2. A translation of the English line, bought once and kept for every
     learner in pool_gloss_cache, keyed by (card id, language): the
     same word in another sentence, or for another learner, costs
     nothing more.

What goes to the model is the server's own data -- the entry's form,
reading and English line, looked up from the id -- never text from the
client, so the shared cache cannot be written into by a request. The
local tier stays free (docs/adr/0001): the analysis never calls this;
the words list asks for the pool words it shows, one call a sentence
at most, the next sentence's with it.

    POST /api/phrase/glosses   (routes/phrase.py)

A call that has to buy anything takes one of the learner's
POOL_GLOSS_DAILY_LIMIT slots (core/daily_limit.py, feature
"pool-glosses"); past it the words stay in English for the day and the
answer says `limited`. A failed call costs its slot and returns what the
two free sources had. The call is accounted like every other (study/
llm_shared's usage line, task "pool-glosses").
"""
import json
import logging
import os
import re

from content import vocab_jmdict_data as jmdict_db
from core import daily_limit
from core.db import db_conn
from study.card_lookup import pool_gloss
from study import llm_shared

logger = logging.getLogger(__name__)

# The words one call may ask for: two sentences' pool words, and room.
MAX_IDS = 40
# A translated line longer than this is not a gloss: dropped.
GLOSS_MAX = 120
POOL_GLOSS_DAILY_LIMIT = int(os.environ.get("POOL_GLOSS_DAILY_LIMIT", "60"))
FEATURE = "pool-glosses"

_ID = re.compile(r"^vocab_jmdict_(\d+)$")

# Byte-identical for every call in a language, so a provider's prefix
# cache can serve it (docs/llm-commercial-plan.md, "Prompt caching").
SYSTEM_PROMPT = """You translate the English dictionary glosses of Japanese words into {lang_name}.

You receive a JSON object. Each key maps to a word: its written form, its reading and its English gloss.
Reply with ONLY a JSON object (no markdown fences, no commentary) mapping each key, unchanged, to the gloss in {lang_name}:
- the same senses in the same order, separated by "; " as in the English;
- as short as the English: a dictionary gloss, not a sentence, no articles unless the sense needs one;
- a word the English marks as humble, polite, colloquial, etc. keeps that mark, translated;
- nothing else: no notes, no romaji, no Japanese.
"""


def _init_db() -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                CREATE TABLE IF NOT EXISTS pool_gloss_cache (
                    raw_id     TEXT NOT NULL,
                    lang       TEXT NOT NULL,
                    gloss      TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    PRIMARY KEY (raw_id, lang)
                )
                """
            )
        conn.commit()
    finally:
        conn.close()


try:
    _init_db()
except Exception:  # pragma: no cover - a missing DB must not stop import
    logger.exception("pool_gloss_cache could not be initialised")


def _rows(ids: list[str]) -> dict[str, dict]:
    """The pool rows the ids name, in order, at most MAX_IDS; anything
    that is not a pool card id, or names no row, is left out."""
    rows: dict[str, dict] = {}
    for raw_id in dict.fromkeys(ids):
        if len(rows) == MAX_IDS:
            break
        match = _ID.match(raw_id) if isinstance(raw_id, str) else None
        row = jmdict_db.get_by_id(int(match.group(1))) if match else None
        if row:
            rows[raw_id] = row
    return rows


def _cached(raw_ids: list[str], lang: str) -> dict[str, str]:
    if not raw_ids:
        return {}
    try:
        conn = db_conn()
    except Exception:
        logger.exception("pool_gloss_cache: no connection")
        return {}
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT raw_id, gloss FROM pool_gloss_cache WHERE lang = %s AND raw_id = ANY(%s)",
                (lang, raw_ids),
            )
            return dict(cur.fetchall())
    except Exception:
        logger.exception("pool_gloss_cache read failed")
        return {}
    finally:
        conn.close()


def _store(made: dict[str, str], lang: str) -> None:
    """Best-effort, and first write wins: two learners reaching the same
    word at once both buy it, and either line is as good."""
    if not made:
        return
    try:
        conn = db_conn()
    except Exception:
        return
    try:
        with conn.cursor() as cur:
            cur.executemany(
                "INSERT INTO pool_gloss_cache (raw_id, lang, gloss) VALUES (%s, %s, %s) "
                "ON CONFLICT (raw_id, lang) DO NOTHING",
                [(raw_id, lang, gloss) for raw_id, gloss in made.items()],
            )
        conn.commit()
    except Exception:
        logger.exception("pool_gloss_cache write failed")
    finally:
        conn.close()


def _translate(rows: dict[str, dict], lang_name: str) -> dict[str, str]:
    """One call for every row; the lines that came back well formed."""
    words = {
        raw_id: {
            "word": row.get("kanji") or row.get("kana", ""),
            "reading": row.get("kana", ""),
            "gloss": pool_gloss(row),
        }
        for raw_id, row in rows.items()
    }
    try:
        content = llm_shared.chat(
            [
                {"role": "system", "content": SYSTEM_PROMPT.format(lang_name=lang_name)},
                {"role": "user", "content": json.dumps(words, ensure_ascii=False)},
            ],
            timeout=30, max_tokens=900, reasoning=False, task="pool-glosses",
        )
    except llm_shared.LLMUnavailable:
        logger.warning("pool glosses: no usable LLM provider")
        return {}
    cleaned = re.sub(r"^```(?:json)?|```$", "", (content or "").strip(), flags=re.MULTILINE).strip()
    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError:
        logger.warning("pool glosses: unparseable answer %r", content)
        return {}
    if not isinstance(parsed, dict):
        return {}
    made = {}
    for raw_id in rows:
        line = parsed.get(raw_id)
        if isinstance(line, str) and 0 < len(line.strip()) <= GLOSS_MAX:
            made[raw_id] = line.strip()
    return made


def glosses(ids: list[str], lang: str, lang_name: str, user_id: str) -> tuple[dict[str, str], bool]:
    """({card id: line in `lang`}, limited) for the pool words `ids` name.

    English is the pool's own language and answers nothing. `limited` is
    True when a translation was wanted and the learner's day was spent."""
    if lang == "en":
        return {}, False
    rows = _rows(ids)
    found: dict[str, str] = {}
    if lang == "fr":
        for raw_id, row in rows.items():
            french = jmdict_db.fr_gloss(row.get("seq"))
            if french:
                found[raw_id] = french
    missing = [raw_id for raw_id in rows if raw_id not in found]
    found.update(_cached(missing, lang))
    missing = [raw_id for raw_id in missing if raw_id not in found]
    if not missing:
        return found, False
    if daily_limit.claim(user_id, FEATURE, POOL_GLOSS_DAILY_LIMIT) > POOL_GLOSS_DAILY_LIMIT:
        return found, True
    made = _translate({raw_id: rows[raw_id] for raw_id in missing}, lang_name)
    _store(made, lang)
    found.update(made)
    return found, False
