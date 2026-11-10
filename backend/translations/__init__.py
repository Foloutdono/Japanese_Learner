"""
The app's languages: which it speaks, and where each is written (plan 312).

`SPOKEN` is every language the app speaks: the interface's, the `lang` a
route answers in, the account's `ui_lang`, the trail's `lang`, the station
samples'. frontend/src/lib/locale.js's SUPPORTED_LANGS is the client's
copy, and tests/test_languages.py holds the two equal.

English and French are the course's two languages: every part is written
in both (the grammar catalogue since plan 087, French end to end since plan
215), and a text of the content is a pair of them ({"en": ..., "fr": ...},
structure / structure_fr). Every other language the app speaks is written
beside them a part at a time, and reads its own words wherever a part is
written in it and English wherever a part is not yet: never French and
never blank (ADR 0023).

`WRITTEN` is each part of the course and those other languages it is
written whole in. A language joins a part in the commit that writes the
part whole in it, and from then on tests/test_languages.py holds the part
whole there: a card, a point or a row the part gains is written in each of
its languages in the same change. `python -m scripts.language_coverage
--lang LANG` counts what is left. A part that has a list of its own keeps it
where it is read (reading_sentences.LANGS, comprehension_seed.LANGS,
conversation.LANGS, duel_paper.CHOICE_LANGS, line_translate.TRACK_LANGS),
held whole by its own checks.
"""

SPOKEN: tuple[str, ...] = ("en", "fr", "es", "id")

# The languages the app speaks to a few accounts only, while their parts
# are written (plan 312, the owner's pick D3): the picker offers one to the
# accounts PREVIEW_LANG_USERS names (a comma-separated list of user ids, set
# on the server) and to no one else, and no device starts in it
# (lib/locale.js's PREVIEW_LANGS is the client's copy). A language leaves
# this list the day it is offered to everyone.
PREVIEW: tuple[str, ...] = ("id",)

WRITTEN: dict[str, tuple[str, ...]] = {
    # A deck card's own line, "{kanji}::{kana}" (datas/vocab/vocab_{lang}.json).
    "deck": ("es", "id"),
    # A deck kanji's meaning (kanji.sqlite3's meaning_{lang}, the app's own
    # lines in datas/kanji/kanji_meanings_{lang}.json).
    "kanji": ("es", "id"),
    # A grammar point's gloss and formation (meaning.{lang}, structure_{lang}).
    "grammar.gloss": ("es", "id"),
    # Its lesson: every step, neighbour's line and example's translation.
    "grammar.lesson": ("es", "id"),
    # Its tour and its own Choisir questions.
    "grammar.drills": ("es", "id"),
    # A theme word, in the sense it has in its theme (meaning_{lang}).
    "theme": ("es",),
    # The sentences a deck card shows: a correction, a sentence written for
    # a word (example_fixes.json, example_added.json) and the layer's line
    # of a Tatoeba sentence a card shows.
    "sentences": ("es",),
    # The layer over JMdict beside the French one (datas/vocab/jmdict_{lang}
    # .sqlite3), line for line: a sense, a sentence, a pool word.
    "layer": ("es",),
    # The dictionary's chips: their labels and tooltips.
    "chips": ("es",),
    # The basics course's unit titles.
    "basics": ("es",),
    # The breakdown's own glosses, and every literal text table in the
    # server's code ({"en": ..., "fr": ...}).
    "breakdown": ("es",),
}


def spoken(lang) -> str:
    """`lang` if the app speaks it, else English: the language a route
    answers a `lang` it was handed in."""
    return lang if lang in SPOKEN else "en"


def preview_langs(user_id: str) -> tuple[str, ...]:
    """The languages in preview this account may pick: every one of
    PREVIEW for an account PREVIEW_LANG_USERS names, none for another."""
    import os
    named = {u.strip() for u in os.environ.get("PREVIEW_LANG_USERS", "").split(",") if u.strip()}
    return PREVIEW if user_id in named else ()


def fr_gloss(entry: dict, fr_map: dict) -> str | None:
    """The French gloss for one deck card, or None. Any language's map
    keyed the same way reads through it (vocab_es.json, plan 302).

    vocab_fr.json has always been keyed by the written form alone, so
    the 266 forms the deck teaches as several cards (後 is あと, うしろ,
    ご and のち) shared one gloss -- whichever card's was written last,
    which is why the N5 私 read "je (fem.)" and the N5 戸 "unité de
    mesure pour les maisons". Plan 107 adds a per-card key,
    "{kanji}::{kana}" (the deck key vocab_frequency.json and
    frequency_overrides already use), consulted first; the bare form
    stays as the fallback, so a card without its own line still reads
    as before rather than blank. The kanji map (routes/dictionary's
    KANJI_FR) is keyed by the character and never carries the pair, so
    the fallback is the whole story there.
    """
    kanji = entry.get("kanji") or ""
    kana = entry.get("kana") or ""
    if kanji and kana:
        own = fr_map.get(f"{kanji}::{kana}")
        if own:
            return own
    return fr_map.get(kanji or kana)


def get_meaning(entry: dict, lang: str, glosses: dict[str, dict]) -> str:
    """Return meaning in requested language, fallback to English.

    `glosses` is the course's own maps of one deck, by language
    (translations.course: VOCAB_GLOSSES, KANJI_GLOSSES); English is the
    entry's own `meaning`, and a language with no map, or a card its map
    has no line for, reads English (plan 302: Spanish is written card by
    card, and a card not yet written is never blank).

    A JMdict pool row (it carries its pool `seq`; a deck entry never
    does) is answered from the pool's own French layer, never from
    `glosses`: VOCAB_FR is the course's, keyed by written form, and gave
    1,184 pool words the French of a deck homograph -- 殿 どの "Mr." as
    "arrière, garde arrière", 歩 ほ "step" as "pion" (plan 215)."""
    if "seq" in entry:
        from content.jmdict_fr import pool_meaning
        return pool_meaning(entry, lang)
    own = glosses.get(lang) if lang != "en" else None
    if own:
        return fr_gloss(entry, own) or entry.get("meaning", "")
    return entry.get("meaning", "")


def get_meanings(entries: list[dict], lang: str, glosses: dict[str, dict]) -> list[str]:
    """Return list of meanings for MCQ choices."""
    return [get_meaning(e, lang, glosses) for e in entries]
