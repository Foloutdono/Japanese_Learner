"""
What became of every vocab card id the deck used to serve (plan 091).

A vocab card id is `vocab_{level}_{kanji}_{kana}`
(content/vocab_data.vocab_to_id), so BOTH surface fields are part of the
learner's progress: correct one of them and every row keyed by the old id
is orphaned. 34 entries needed correcting, all of them residue of one
spreadsheet export that landed in the deck:

  * 17 entries carried the word in `kanji` and a part-of-speech or sense
    note in `kana` — `{"kanji": "すみません", "kana": "（感）"}`. The note is
    not a reading, so `vocab.word_reading` quizzed the learner on it and
    graded the real answer wrong.
  * 15 entries carried the word in BOTH fields —
    `{"kanji": "この", "kana": "この"}`. Prompt equalled answer under
    `word_reading`, the case study/modes.eligible_for exists to exclude
    (it tests the `kanji` field for emptiness, which these defeat).
  * 2 more parked a note where the reading belongs: an okurigana bracket
    (`あたたか(い)`) and a synonym gloss (`あげる (=やる)`).

All 34 now follow the convention the other 1,097 kana-only entries
already use: `kanji` is empty and `kana` holds the word. No level moved
and no id collides with one the deck already served, so every rename is
one hop onto an id that was new.

MOVES maps old raw id -> new raw id, and scripts/migrate_vocab_ids.py
renames the learner's rows. KEY_MOVES is the same 34 entries as
"{kanji}::{kana}" deck keys, which is what frequency_overrides.item_key
holds for domain='vocab' (see content/frequency_data.py's resolve()).

Nothing is retired: every corrected entry is still served, under its new
id. A row whose id is in neither the live deck nor MOVES is content drift
from before this table existed; the migration reports it and leaves it
exactly as it is, the way migrate_jmdict_card_ids.py does.
"""

# old raw id -> new raw id
MOVES: dict[str, str] = {
    # ── The word in `kanji`, a （...）note in `kana` ──────────────
    "vocab_N3_すみません_（感）": "vocab_N3__すみません",
    "vocab_N3_しまい_（終わり）": "vocab_N3__しまい",
    "vocab_N3_しまう_（終わる）": "vocab_N3__しまう",
    "vocab_N3_ね_（感）": "vocab_N3__ね",
    # The note was truncated mid-cell by the export's own comma split
    # ("（1000" with no closing bracket) — the clearest fingerprint of
    # the whole family.
    "vocab_N3_とん_（1000": "vocab_N3__とん",
    "vocab_N3_できる_（可能。出現。発生）": "vocab_N5__できる",
    "vocab_N3_はい_（感）": "vocab_N5__はい",
    "vocab_N3_どう_（接。副）": "vocab_N5__どう",
    "vocab_N3_それ_（接。感）": "vocab_N5__それ",
    "vocab_N3_しまった_（感）": "vocab_N3__しまった",
    "vocab_N3_うん_（感）": "vocab_N4__うん",
    "vocab_N3_よろしく_（感）": "vocab_N3__よろしく",
    "vocab_N3_ふと_（副）": "vocab_N3__ふと",
    "vocab_N2_だいいち_（副）": "vocab_N2__だいいち",
    "vocab_N2_じゅうたん_（カーペット）": "vocab_N2__じゅうたん",
    "vocab_N2_しいんと_（する）": "vocab_N2__しいんと",
    "vocab_N2_ミリ_（メートル）": "vocab_N2__ミリ",
    # ── The word in both fields ──────────────────────────────────
    "vocab_N3_したがって_したがって": "vocab_N3__したがって",
    "vocab_N3_すると_すると": "vocab_N4__すると",
    "vocab_N3_この_この": "vocab_N5__この",
    "vocab_N3_どれ_どれ": "vocab_N5__どれ",
    "vocab_N3_だから_だから": "vocab_N4__だから",
    "vocab_N3_そこ_そこ": "vocab_N5__そこ",
    "vocab_N3_では_では": "vocab_N5__では",
    "vocab_N3_うまい_うまい": "vocab_N4__うまい",
    "vocab_N3_いつも_いつも": "vocab_N5__いつも",
    "vocab_N3_その_その": "vocab_N5__その",
    "vocab_N3_そう_そう": "vocab_N4__そう",
    "vocab_N3_ここ_ここ": "vocab_N5__ここ",
    "vocab_N3_いえ_いえ": "vocab_N3__いえ",
    "vocab_N3_でも_でも": "vocab_N5__でも",
    "vocab_N2_こうして_こうして": "vocab_N2__こうして",
    # ── A note where the reading belongs ─────────────────────────
    "vocab_N3_暖かい_あたたか(い)": "vocab_N5_暖かい_あたたかい",
    "vocab_N2__あげる (=やる)": "vocab_N4__あげる",
    # ── Plan 106: one spelling, one reading field, no する in it ─
    # The N5 掃除 carried its する in the reading; the N5 見る had two
    # spellings in one written-form field, so its lemma key was neither
    # and every 見る badged as the N3 card; the N5 十 joined its two
    # readings with a space, which nothing splits.
    "vocab_N5_掃除_そうじする": "vocab_N5_掃除_そうじ",
    "vocab_N5_見る 観る_みる": "vocab_N5_見る_みる",
    "vocab_N5_十_じゅう とお": "vocab_N5_十_じゅう/とお",
    # ── Plan 108: a mojibake in a written form ───────────────────
    # The N2 たいりつ was exported as "Ͼ立", a Greek letter where 対
    # belongs. Same level; the N1 対立 is a different card and stays.
    "vocab_N2_Ͼ立_たいりつ": "vocab_N2_対立_たいりつ",
    # ── Plan 106b: one card per (form, reading), at the lower level ─
    # Nineteen of plan 091's lines above (この, その, どう, できる...) used
    # to land on the N3 and N2 ids merged here, and a MOVE is one hop,
    # never a chain: they now point straight at the lower card, the same
    # place two hops would have reached.
    # 26 entries were the same word twice, at two levels (この at N5 and
    # N3, できる, いつも, 掃除 after 106, 対立 after 108...), so a learner
    # met the card again as "new" at the higher level. The lower card
    # stays, its gloss the union of both; the higher one's rows merge
    # into it. These are the first MOVES that change a level, which is
    # why scripts/migrate_vocab_ids.py now rewrites deck_cards.level
    # from the target id.
    "vocab_N3__どう": "vocab_N5__どう",
    "vocab_N3_掃除_そうじ": "vocab_N5_掃除_そうじ",
    "vocab_N3__でも": "vocab_N5__でも",
    "vocab_N3__はい": "vocab_N5__はい",
    "vocab_N3__この": "vocab_N5__この",
    "vocab_N3__その": "vocab_N5__その",
    "vocab_N3__ここ": "vocab_N5__ここ",
    "vocab_N3__いつも": "vocab_N5__いつも",
    "vocab_N3__できる": "vocab_N5__できる",
    "vocab_N3__どれ": "vocab_N5__どれ",
    "vocab_N3_見る_みる": "vocab_N5_見る_みる",
    "vocab_N3__では": "vocab_N5__では",
    "vocab_N3__そこ": "vocab_N5__そこ",
    "vocab_N3_暖かい_あたたかい": "vocab_N5_暖かい_あたたかい",
    "vocab_N3__それ": "vocab_N5__それ",
    "vocab_N2__けれど/けれども": "vocab_N4__けれど/けれども",
    "vocab_N3__だから": "vocab_N4__だから",
    "vocab_N3__すると": "vocab_N4__すると",
    "vocab_N2__あげる": "vocab_N4__あげる",
    "vocab_N3__うん": "vocab_N4__うん",
    "vocab_N3__うまい": "vocab_N4__うまい",
    "vocab_N3__そう": "vocab_N4__そう",
    "vocab_N1__しまった": "vocab_N3__しまった",
    "vocab_N1__しいんと": "vocab_N2__しいんと",
    "vocab_N1_対立_たいりつ": "vocab_N2_対立_たいりつ",
    "vocab_N1__ミリ": "vocab_N2__ミリ",

}


def _fields_of(raw_id: str) -> tuple[str, str]:
    """
    vocab_{level}_{kanji}_{kana} -> (kanji, kana). The kanji field can be
    empty and the kana field can itself contain "_" (none does today), so
    the split is bounded from the left and the LAST separator wins.
    """
    _, _, rest = raw_id.split("_", 2)
    kanji, _, kana = rest.rpartition("_")
    return kanji, kana


def key_moves() -> dict[str, str]:
    """
    old "{kanji}::{kana}" -> new, for the places that store the deck key
    rather than the card id: frequency_overrides.item_key for
    domain='vocab' (frequency_data.resolve()).
    """
    out: dict[str, str] = {}
    for old, new in MOVES.items():
        okj, okn = _fields_of(old)
        nkj, nkn = _fields_of(new)
        out[f"{okj}::{okn}"] = f"{nkj}::{nkn}"
    return out


KEY_MOVES: dict[str, str] = key_moves()
