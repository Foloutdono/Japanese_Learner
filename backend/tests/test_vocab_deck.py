"""The shape of a vocab deck entry, and the rename table that carries a
learner's progress across a correction to one (plan 091).

Three field-level corruptions reached learners as cards, all of them
residue of one spreadsheet export into datas/vocab/vocab_deck.json:

  * `meaning` holding Excel's "#NAME?" — the card taught nothing at all
  * `kana` holding a part-of-speech or sense note （感）／（終わる）instead
    of a reading — and the reading is half the card id, so
    `vocab.word_reading` quizzed the learner on the note and marked the
    real answer wrong
  * `kanji` holding the kana word, either beside a note or duplicated
    into both fields — which defeats study/modes.eligible_for's
    emptiness test and serves `word_reading` a card whose prompt IS its
    answer

The data is fixed; these hold the shape, so a future deck edit or a
re-import cannot bring any of the three back unnoticed.
"""

import re

from content.vocab_data import VOCAB_BY_LEVEL, vocab_to_id
from content.vocab_renames import KEY_MOVES, MOVES, _fields_of
from study.modes import MODES, eligible_for

LEVELS = ("N5", "N4", "N3", "N2", "N1")

# CJK Unified Ideographs, plus the extension A block and the compatibility
# block a few deck entries reach into. Kana and 々/ヶ are deliberately NOT
# kanji here: the question this answers is "is there a written form to
# read", and a kana-only word's answer is no.
_KANJI = re.compile(r"[㐀-䶿一-鿿豈-﫿]")

# Excel's error strings. "#NAME?" is the one that shipped; the rest are
# its neighbours in the same export and cost nothing to exclude.
_SPREADSHEET_ERRORS = (
    "#NAME?", "#VALUE!", "#REF!", "#DIV/0!", "#NULL!", "#NUM!", "#N/A",
)


def _entries():
    for level in LEVELS:
        for entry in VOCAB_BY_LEVEL.get(level, []):
            yield level, entry


def test_no_entry_carries_a_spreadsheet_error_string():
    """Three N1 counters shipped `"meaning": "#NAME?"`. A gloss is the
    whole back of a vocab card, so these were cards with no content —
    unreviewable, and invisible to anything that only checks a field is
    non-empty."""
    bad = [
        (level, entry)
        for level, entry in _entries()
        if any(err in entry["meaning"] for err in _SPREADSHEET_ERRORS)
    ]
    assert bad == []


def test_no_entry_carries_an_author_note_as_a_gloss():
    """One entry's gloss was "TODO same as いいえ?" — and it had been
    translated into French, so it reached a learner in both languages."""
    bad = [(level, entry) for level, entry in _entries() if "TODO" in entry["meaning"]]
    assert bad == []


def test_the_reading_field_holds_a_reading():
    """`kana` is the reading, and it is half the card id. A （感）or a
    （終わる）there is a part-of-speech or sense note the export left
    behind: not a reading, not something the card can render, and the
    string `word_reading` grades against."""
    bad = [
        (level, entry)
        for level, entry in _entries()
        if "（" in entry["kana"] or "(" in entry["kana"] or "=" in entry["kana"]
    ]
    assert bad == []


def test_the_written_form_field_is_empty_or_holds_a_written_form():
    """A kana-only word writes `kanji: ""` — 1,097 entries do. An entry
    that instead parks the kana word in `kanji` reads as a word with a
    written form to everything downstream, `eligible_for` included."""
    bad = [
        (level, entry)
        for level, entry in _entries()
        if entry["kanji"].strip() and not _KANJI.search(entry["kanji"])
    ]
    assert bad == []


def test_word_reading_never_serves_a_card_whose_prompt_is_its_answer():
    """The defect the two field tests above exist to prevent, stated as
    the behaviour it broke. `eligible_for` filters the pool on the kanji
    field being non-empty, so an entry that duplicates its kana into
    that field slips through and is served with prompt == answer."""
    mode = MODES["vocab.word_reading"]
    served = [entry for _, entry in _entries() if eligible_for(mode, entry)]
    assert served, "the mode must still have a pool"
    assert [e for e in served if e["kanji"] == e["kana"]] == []


def test_every_card_id_is_unique_within_its_level():
    """`vocab_to_id` is `vocab_{level}_{kanji}_{kana}`, so two entries
    sharing both fields at one level share one SRS row and advance each
    other's progress.

    Two such pairs predated plan 091 -- N5 たいへん ("very" / "difficult
    situation") and N5 あの ("that over there" / "um...") -- and plan 106
    settled them: the second たいへん was the N3 大変 card's sense and
    went; the second あの is the filler, its own word, あのう. Neither
    touched the shared id, so nothing was orphaned. The point of the
    test is that a new pair cannot appear unnoticed."""
    seen: dict[str, int] = {}
    for level, entry in _entries():
        raw_id = vocab_to_id(entry, level)
        seen[raw_id] = seen.get(raw_id, 0) + 1
    assert {i for i, n in seen.items() if n > 1} == set()


# ── The rename table ──────────────────────────────────────────


def _served() -> frozenset[str]:
    return frozenset(vocab_to_id(entry, level) for level, entry in _entries())


def test_every_rename_target_is_a_card_the_deck_serves():
    """A MOVES value the deck does not serve would move a learner's
    progress onto an id nothing can ever show them again."""
    assert {new for new in MOVES.values() if new not in _served()} == set()


def test_no_renamed_id_is_still_served():
    """If an old id were still in the deck, the migration would move a
    live card's rows out from under it."""
    assert {old for old in MOVES if old in _served()} == set()


def test_renames_never_chain():
    """scripts/migrate_vocab_ids.py is one hop and is not re-entrant
    across a chain: a target that is itself a key would leave rows on an
    id the same run had already condemned."""
    assert set(MOVES.values()) & set(MOVES) == set()


def test_no_rename_changes_the_level():
    """Only the surface fields were corrected. deck_cards stores `level`
    beside `raw_id`, and the migration deliberately leaves that column
    alone — this is what makes that safe."""
    def level_of(raw_id):
        return raw_id.split("_", 2)[1]

    assert [(o, n) for o, n in MOVES.items() if level_of(o) != level_of(n)] == []


def test_the_frequency_keys_track_the_renamed_ids():
    """frequency_overrides.item_key is the deck's "{kanji}::{kana}" key,
    not the card id, so the migration needs the same 34 corrections in
    that shape. Derived rather than written twice — this pins the
    derivation."""
    assert len(KEY_MOVES) == len(MOVES)
    for old_id, new_id in MOVES.items():
        okj, okn = _fields_of(old_id)
        nkj, nkn = _fields_of(new_id)
        assert KEY_MOVES[f"{okj}::{okn}"] == f"{nkj}::{nkn}"


def test_fields_round_trip_through_the_id():
    """_fields_of has to survive an empty kanji field and a kana field
    carrying the export's own brackets — both of which the old ids it
    parses actually contain."""
    for level, entry in _entries():
        raw_id = vocab_to_id(entry, level)
        assert _fields_of(raw_id) == (entry["kanji"], entry["kana"])
