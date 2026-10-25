"""
主 — the mode each line is ridden in, and the modes added to Today
beside it (plan 273).

Every line had one mode the app rode it in, fixed in code: the first
graded mode of its source (level_rule.primary_mode) -- the recognition
flashcard for kana, kanji and words, the ladder for grammar. It is the
track Today deals a new card on, the one the level rule marks known and
the one the gate's 主 filter keeps. A learner who learns kanji by
drawing them could change none of it.

Two choices now, kept on the account (user_profiles.main_modes and
extra_modes, NULL for never chosen):

  main    one mode per line, from Réglages › Modes principaux: what
          the line is ridden in. Whatever read primary_mode reads it.
  extra   more modes of a line, added from Today's services: the ration
          deals them too, each card once the line's main mode has
          taught it (its main row graduated), so a kanji is met by its
          meaning before it is asked to be drawn.

Grammar is not chosen: its ladder already climbs through Choisir and
Construire (srs/ladder.py, plan 194). Pure here; core/learner_modes.py
reads the account and routes/profile.py writes it.
"""
from typing import NamedTuple

from study.modes import (
    KANA, KANJI, VOCAB, GRADED_ORDER_FOR_SOURCE, MODES, MODES_FOR_SOURCE,
    RADICAL, WORD_READING,
)

# The lines whose modes a learner chooses, in the gate's order.
SOURCES = (KANA, VOCAB, KANJI)


def default_main(source: str) -> str:
    """The mode a line is ridden in until the learner chooses: its
    source's first graded mode, as it always was."""
    return MODES_FOR_SOURCE[source][0]


# A main mode asks every card of its line. word_reading has nothing to
# ask of a word written in kana alone, and radical needs the kanji's
# radical, so a line's main mode is never one of them: they ride as
# extras, over the cards they can serve.
_PARTIAL = (WORD_READING, RADICAL)
MAIN_CHOICES: dict[str, tuple[str, ...]] = {
    source: tuple(k for k in GRADED_ORDER_FOR_SOURCE[source] if MODES[k].base not in _PARTIAL)
    for source in SOURCES
}
EXTRA_CHOICES: dict[str, tuple[str, ...]] = {
    source: GRADED_ORDER_FOR_SOURCE[source] for source in SOURCES
}


def clean_main(value):
    """A client's {line: mode} -> the stored map, in SOURCES order; None
    stays None (the field was not sent). Raises ValueError on a line or
    a mode that is not on offer, so a validator can hand it straight on."""
    if value is None:
        return None
    if not isinstance(value, dict):
        raise ValueError("must be a map of line to mode")
    for source, mode in value.items():
        if source not in MAIN_CHOICES:
            raise ValueError(f"unknown line {source!r}; must be among {', '.join(SOURCES)}")
        if mode not in MAIN_CHOICES[source]:
            raise ValueError(f"{mode!r} is not a main mode of {source}")
    return {source: value[source] for source in SOURCES if source in value}


def clean_extra(value):
    """A client's {line: [mode, ...]} -> the stored map, each list in
    picker order and without repeats; None stays None. Bounded by the
    registry: nothing but a line's own modes gets through."""
    if value is None:
        return None
    if not isinstance(value, dict):
        raise ValueError("must be a map of line to modes")
    out = {}
    for source, modes in value.items():
        if source not in EXTRA_CHOICES:
            raise ValueError(f"unknown line {source!r}; must be among {', '.join(SOURCES)}")
        if not isinstance(modes, (list, tuple)):
            raise ValueError(f"the modes of {source} must be a list")
        unknown = [m for m in modes if m not in EXTRA_CHOICES[source]]
        if unknown:
            raise ValueError(f"{', '.join(map(repr, unknown))} not a mode of {source}")
    for source in SOURCES:
        if source in value:
            out[source] = [m for m in EXTRA_CHOICES[source] if m in value[source]]
    return out


class Modes(NamedTuple):
    """A learner's modes, every line answered: `main` line -> mode,
    `extra` line -> the modes added, never the main one."""
    main: dict
    extra: dict

    def main_of(self, source: str) -> str:
        """The mode `source` is ridden in -- any source, grammar's the
        ladder."""
        return self.main.get(source) or default_main(source)

    def extras_of(self, source: str) -> tuple[str, ...]:
        return self.extra.get(source, ())

    def ridden(self) -> frozenset[str]:
        """Every mode Today deals a new card in: each line's main mode
        and its extras. The gate's 主 filter keeps these."""
        return frozenset(self.main.values()) | {m for ms in self.extra.values() for m in ms}

    def spending(self) -> frozenset[str]:
        """The modes whose first answer to a card met before spends the
        day's pace (core/pace.py): a mode the learner added and a main
        mode they chose, each dealt by the ration to cards that are not
        new. A default main mode spends only on new items, as it always
        did."""
        chosen = {m for s, m in self.main.items() if m != default_main(s)}
        return frozenset(chosen) | {m for ms in self.extra.values() for m in ms}

    def payload(self) -> dict:
        return {"main": dict(self.main), "extra": {s: list(ms) for s, ms in self.extra.items()}}


def resolve(main_stored, extra_stored) -> Modes:
    """What the stored columns mean: a line never chosen (or holding a
    mode no longer on offer) is ridden in its default, and an extra is
    dropped when it is the line's main mode or no longer offered."""
    main_stored = main_stored if isinstance(main_stored, dict) else {}
    extra_stored = extra_stored if isinstance(extra_stored, dict) else {}
    main = {
        source: main_stored.get(source) if main_stored.get(source) in MAIN_CHOICES[source] else default_main(source)
        for source in SOURCES
    }
    extra = {}
    for source in SOURCES:
        wanted = extra_stored.get(source)
        wanted = wanted if isinstance(wanted, (list, tuple)) else ()
        extra[source] = tuple(m for m in EXTRA_CHOICES[source] if m in wanted and m != main[source])
    return Modes(main, extra)


DEFAULT = resolve(None, None)
