def fr_gloss(entry: dict, fr_map: dict) -> str | None:
    """The French gloss for one deck card, or None.

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


def get_meaning(entry: dict, lang: str, fr_map: dict) -> str:
    """Return meaning in requested language, fallback to English."""
    if lang == "fr":
        return fr_gloss(entry, fr_map) or entry.get("meaning", "")
    return entry.get("meaning", "")


def get_meanings(entries: list[dict], lang: str, fr_map: dict) -> list[str]:
    """Return list of meanings for MCQ choices."""
    return [get_meaning(e, lang, fr_map) for e in entries]
