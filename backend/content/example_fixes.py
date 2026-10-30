"""
The course's example sentences, corrected, and written where JMdict had none (plan 227).

Every word of the vocab deck shows the Tatoeba sentences JMdict files
under its senses (content/vocab_extras.get_vocab_extras): on its card and
dictionary page, in reading practice, and in the 文脈規定 items the exam
generator mines from them. They came as they are: typos (いらしゃいました),
translationese, a Bible verse, claims that are not true, sentences far
above the word's level, French and English that say something else.
Plan 227 had every one of them read, against each word it illustrates,
and corrected or replaced the ones that fell short.

The corrections are a layer over JMdict rather than edits inside it, for
the reason content/jmdict_fr.py gives: vocab_jmdict.sqlite3 is 76 MB, a
pool card's id is its row's position in it, and every correction would
re-commit all of it. datas/vocab/example_fixes.json holds them, keyed by
the sentence as JMdict has it:

    {"fixes": {"<Tatoeba sentence>": {"jp": ..., "en": ..., "fr": ..., "es": ..., "why": ...}}}

`jp` is the sentence to show instead (the same one when only a
translation was wrong), `en`, `fr` and `es` its translations (the
Spanish since plan 291), `why` the reviewer's reason, for the content
audit. The layer is read where every sentence is read --
get_vocab_extras for the text, content/jmdict_fr.py for the
translations -- so nothing downstream knows it exists.

A sentence can illustrate several words, a pool word among them, and a
correction is checked against the course's words only
(tests/test_vocab_examples.py). So a corrected sentence is shown under a
word only where it still carries that word; anywhere else the original
stands (`for_word`).

A word JMdict files no sentence under -- 1,128 of the deck's, a kana
card, a word Tatoeba never met -- has sentences written for it instead,
two a word, in datas/vocab/example_added.json, keyed by the card:

    {"added": {"<kanji>::<kana>": [{"jp": ..., "en": ..., "fr": ..., "es": ...}]}}

get_vocab_extras shows them after the word's own (`added`), and
content/jmdict_fr.py answers their French and Spanish like a
correction's. They
were written by Claude and read again by a second reviewer, and are
held to what tests/test_vocab_examples.py asks of them: the word in its
course spelling, no kanji above its level, every translation.

Loaded once, on first use: a few thousand short lines.
"""
import json
import os
from functools import lru_cache

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(_BASE_DIR, "datas", "vocab", "example_fixes.json")
ADDED_PATH = os.path.join(_BASE_DIR, "datas", "vocab", "example_added.json")
# The languages a correction or a written sentence is translated into
# besides English, each answered by the sentence shown (`translated`).
LANGS = ("fr", "es")


@lru_cache(maxsize=1)
def fixes() -> dict[str, dict]:
    if not os.path.exists(PATH):
        return {}
    with open(PATH, encoding="utf-8") as f:
        return json.load(f).get("fixes") or {}


@lru_cache(maxsize=1)
def written() -> dict[str, list[dict]]:
    """"{kanji}::{kana}" -> the sentences written for a word JMdict
    gave none."""
    if not os.path.exists(ADDED_PATH):
        return {}
    with open(ADDED_PATH, encoding="utf-8") as f:
        return json.load(f).get("added") or {}


def added(kanji: str, kana: str) -> list[dict]:
    """The sentences written for this deck word ({jp, en, fr, es}), or []."""
    return written().get(f"{kanji}::{kana}", [])


@lru_cache(maxsize=4)
def _own(lang: str) -> dict[str, str]:
    out = {ex["jp"]: ex[lang] for exs in written().values() for ex in exs if ex.get("jp") and ex.get(lang)}
    out.update({fix["jp"]: fix[lang] for fix in fixes().values() if fix.get("jp") and fix.get(lang)})
    return out


def translated(jp: str, lang: str) -> str | None:
    """The French (or Spanish) of a corrected or written sentence, by the
    sentence shown."""
    return _own(lang).get(jp) if jp and lang in LANGS else None


def for_word(example: dict, carries_word) -> dict:
    """`example` ({jp, en}) as the course shows it: its correction where
    there is one and the corrected sentence still carries the word
    (`carries_word(jp) -> bool`), else unchanged."""
    fix = fixes().get(example.get("jp") or "")
    if not fix:
        return example
    if fix["jp"] != example["jp"] and not carries_word(fix["jp"]):
        return example
    return {**example, "jp": fix["jp"], "en": fix.get("en") or example.get("en", "")}
