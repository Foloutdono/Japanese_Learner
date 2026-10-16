"""
The course's example sentences, corrected (plan 223).

Every word of the vocab deck shows the Tatoeba sentences JMdict files
under its senses (content/vocab_extras.get_vocab_extras): on its card and
dictionary page, in reading practice, and in the 文脈規定 items the exam
generator mines from them. They came as they are: typos (いらしゃいました),
translationese, a Bible verse, claims that are not true, sentences far
above the word's level, French and English that say something else.
Plan 223 had every one of them read, against each word it illustrates,
and corrected or replaced the ones that fell short.

The corrections are a layer over JMdict rather than edits inside it, for
the reason content/jmdict_fr.py gives: vocab_jmdict.sqlite3 is 76 MB, a
pool card's id is its row's position in it, and every correction would
re-commit all of it. datas/vocab/example_fixes.json holds them, keyed by
the sentence as JMdict has it:

    {"fixes": {"<Tatoeba sentence>": {"jp": ..., "en": ..., "fr": ..., "why": ...}}}

`jp` is the sentence to show instead (the same one when only a
translation was wrong), `en` and `fr` its translations, `why` the
reviewer's reason, for the content audit. The layer is read where every
sentence is read -- get_vocab_extras for the text, content/jmdict_fr.py
for the French -- so nothing downstream knows it exists.

A sentence can illustrate several words, a pool word among them, and a
correction is checked against the course's words only
(tests/test_vocab_examples.py). So a corrected sentence is shown under a
word only where it still carries that word; anywhere else the original
stands (`for_word`).

Loaded once, on first use: a few thousand short lines.
"""
import json
import os
from functools import lru_cache

_BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PATH = os.path.join(_BASE_DIR, "datas", "vocab", "example_fixes.json")


@lru_cache(maxsize=1)
def fixes() -> dict[str, dict]:
    if not os.path.exists(PATH):
        return {}
    with open(PATH, encoding="utf-8") as f:
        return json.load(f).get("fixes") or {}


@lru_cache(maxsize=1)
def _french() -> dict[str, str]:
    return {fix["jp"]: fix["fr"] for fix in fixes().values() if fix.get("jp") and fix.get("fr")}


def french(jp: str) -> str | None:
    """The French of a corrected sentence, by the sentence shown."""
    return _french().get(jp) if jp else None


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
