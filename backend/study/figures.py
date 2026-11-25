"""
How each language writes a figure and an ordinal (plan 312).

One line a language, so a language the app gains writes its own figures by
a line here, not by a branch at every place that prints one: plan 302 left
`lang == "es"` in three places, and a fourth language fell through each to
a figure written the French or the English way. A language with no line
writes the English way, never the French.

- `figure(value, lang, fraction="")` is the screens' figure, what Intl
  prints for lib/locale.js's intlLocale(lang): 2,000 and 3.5 in English;
  2 000 (a narrow no-break space) and 3,5 in French; 2,000 and 3.5 in
  Latin-American Spanish (es-419, the owner's variety, plan 302).
- `ordinal(value, lang)`: 1st, 1er, n.º 1.

The breakdown's glosses (study/analysis.py) and the dictionary's chips
(content/vocab_extras.py) read them, and print what they printed before
(plan 312 moved nothing a learner sees).
"""

# The mark between thousands and the one before the decimals.
_MARKS: dict[str, tuple[str, str]] = {
    "en": (",", "."),
    "fr": (" ", ","),
    "es": (",", "."),
}


def point(lang: str) -> str:
    """The mark `lang` writes before a figure's decimals."""
    return _MARKS.get(lang, _MARKS["en"])[1]


def figure(value, lang: str, fraction: str = "") -> str:
    """`value` as `lang` writes it, `fraction` (the decimals' digits, as
    printed) after its decimal mark. A float is cut at its point as
    printed (3.5, never 3.500)."""
    if isinstance(value, float):
        whole, _, decimals = repr(value).partition(".")
        return figure(int(whole), lang, "" if decimals == "0" else decimals)
    group, mark = _MARKS.get(lang, _MARKS["en"])
    digits = f"{value:,}".replace(",", group)
    return f"{digits}{mark}{fraction}" if fraction else digits


def _english_ordinal(value: int) -> str:
    suffix = "th" if 10 <= value % 100 <= 20 else {1: "st", 2: "nd", 3: "rd"}.get(value % 10, "th")
    return f"{value:,}{suffix}"


_ORDINALS = {
    "en": _english_ordinal,
    # 1er, 2e; past a thousand with a plain space, as the breakdown has
    # always written it.
    "fr": lambda value: "1er" if value == 1 else f"{value:,}".replace(",", " ") + "e",
    # n.º 3, "number 3": 3.º and 3.ª would give the counted noun a gender
    # (plan 302).
    "es": lambda value: f"n.º {figure(value, 'es')}",
}


def ordinal(value: int, lang: str) -> str:
    """The `value`th, as `lang` writes it."""
    return _ORDINALS.get(lang, _english_ordinal)(value)
