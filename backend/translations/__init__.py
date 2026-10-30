def fr_gloss(entry: dict, fr_map: dict) -> str | None:
    """The French gloss for one deck card, or None. Any language's map
    keyed the same way reads through it (vocab_es.json, plan 291).

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
    has no line for, reads English (plan 291: Spanish is written card by
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
