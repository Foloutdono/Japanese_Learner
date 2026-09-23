"""
What became of every kanji card id the deck used to serve (plan 112).

A kanji card id is `kanji_{level}_{character}` (content/kanji_data.
kanji_to_id), so a character's level is part of the learner's progress.
kanji_deck.json listed 2,235 entries over 2,212 characters: 23
characters were taught twice, the same readings and the same meanings,
once at N5 and again at N4 (耳 at N3) -- the N5 list had been widened
to the community lists' N5 without the old N4 list losing them -- so a
learner who had learned 会 at N5 met it at N4 as a new card, and its
progress forked in two. DECK_BY_CHAR already served one row per
character to anything that wanted one (the radical index, the
dictionary); the SRS had no such rule.

One card per character now, at its lowest level, the same rule plan
106b applied to the vocab deck. MOVES maps each retired id onto the
card that stays, and scripts/migrate_kanji_ids.py renames the learner's
rows, merging where they had studied both. Nothing keyed by the
character alone moves: frequency_overrides (domain 'kanji') and the
dictionary favourites name a kanji by its character, never its level.
"""

# old raw id -> new raw id
MOVES: dict[str, str] = {
    "kanji_N3_耳": "kanji_N5_耳",
    "kanji_N4_会": "kanji_N5_会",
    "kanji_N4_口": "kanji_N5_口",
    "kanji_N4_古": "kanji_N5_古",
    "kanji_N4_多": "kanji_N5_多",
    "kanji_N4_安": "kanji_N5_安",
    "kanji_N4_少": "kanji_N5_少",
    "kanji_N4_店": "kanji_N5_店",
    "kanji_N4_手": "kanji_N5_手",
    "kanji_N4_新": "kanji_N5_新",
    "kanji_N4_目": "kanji_N5_目",
    "kanji_N4_社": "kanji_N5_社",
    "kanji_N4_空": "kanji_N5_空",
    "kanji_N4_立": "kanji_N5_立",
    "kanji_N4_花": "kanji_N5_花",
    "kanji_N4_言": "kanji_N5_言",
    "kanji_N4_買": "kanji_N5_買",
    "kanji_N4_足": "kanji_N5_足",
    "kanji_N4_週": "kanji_N5_週",
    "kanji_N4_道": "kanji_N5_道",
    "kanji_N4_飲": "kanji_N5_飲",
    "kanji_N4_駅": "kanji_N5_駅",
    "kanji_N4_魚": "kanji_N5_魚",
}
