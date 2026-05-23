def get_meaning(entry: dict, lang: str, fr_map: dict) -> str:
    """Return meaning in requested language, fallback to English."""
    if lang == "fr":
        key = entry.get("kanji") or entry.get("kana", "")
        return fr_map.get(key, entry.get("meaning", ""))
    return entry.get("meaning", "")


def get_meanings(entries: list[dict], lang: str, fr_map: dict) -> list[str]:
    """Return list of meanings for MCQ choices."""
    return [get_meaning(e, lang, fr_map) for e in entries]