"""
Which words a kana is read in (plan 088).

A kanji's entry has listed the words it appears in since the ledger was
built (study/kanji_words.py). A kana's entry listed the character, its
romaji and how to draw it, and then stopped -- and the character is the
one thing on that plate the reader already has, since they got there by
tapping it. What they cannot do yet is READ, and reading starts at あさ,
あお, あき rather than at あ on its own.

This is that ledger for the other half of the catalogue: up to
MAX_WORDS words the kana is read in, AS THE READER READS THEM. The row
prints the word's reading, not its written form -- a learner still
working through the syllabary cannot be shown 朝 as an example of あ --
and carries the written form alongside so the row can still open the
word's own entry, where the kanji, the furigana and the senses are.

Pure: content data and nothing else, no database and no client, so it
tests the way kanji_words.py does.

-- Where the words come from ---------------------------------
The app's own curated deck first (content/vocab_data.py). Its 8,405
words are levelled and translated into both languages, which is most of
what an example wants to be, and katakana is not the gap it looks like:
the deck files ドア and テレビ with an empty `kanji` and the katakana in
`kana`, 530 words that way.

The JMdict pool (content/vocab_jmdict_data.py) fills in behind it. ヴ,
ウォ, ティ and the rest of the 外来音 are sounds the JLPT lists barely
touch and a loanword dictionary is full of; without the pool a third of
the katakana combinations chart would have nothing to show. A pool word
is served in English wherever vocab_fr has no entry for it, which is
the fallback the deck's own French gaps already take
(routes/dictionary.py).

Only the pool's ranked head is drawn on. `freq_rank` is a real ordering
to about rank 23,000 and an arbitrary one after that -- content/
theme_data.py avoids the column entirely for the same reason -- so past
the horizon there is no "commonest word" to pick, and a kana with
nothing under it prints no block at all rather than the first row of an
alphabetical tail: ヲ has no ordinary word, and ヲタ is not what to
teach it with.

Both halves are folded into an index on first use rather than
recomputed per request: about 4 MB between them (2 for the deck's 8,405
readings, 2 for ~250 keys of four pool rows each), which is the whole
of what this adds to a worker's RSS -- see content/vocab_jmdict_data.py
for why that is a number worth writing down here.

-- How the few are chosen ------------------------------------
Commonest level first; then the words that BEGIN with the kana, because
a syllabary is taught as "あ as in あさ" and the card should read that
way; then the shortest; then the deck's own order, which the sort is
stable on. A kana that ends words rather than starting them (ん, and
every long-vowel pair) simply has no initial candidates and takes the
rest of the rule unchanged.
"""
import re
from collections import defaultdict
from functools import lru_cache

from content.kana_data import get_syllabary
from content.vocab_data import VOCAB_BY_LEVEL
import content.vocab_jmdict_data as jmdict_db
from translations import get_meaning
from translations.fr.vocab_fr import VOCAB_FR

# Rows in the ledger. The kanji panel's own number: four rows is what
# the block holds before it becomes a list to scroll rather than a fact
# to read.
MAX_WORDS = 4

# How long a bucket is allowed to grow before it is sorted back down to
# MAX_WORDS. Trimming to the best few by the full ordering is exact --
# a row that loses to four others never wins later -- so this is only
# how often the sort runs, not what it keeps.
_POOL_BUCKET_SLACK = 4 * MAX_WORDS

# Where the pool's freq_rank stops being a ranking -- see the module
# docstring, and content/theme_data.py's note on the same column.
POOL_RANK_HORIZON = 23_000

# A word is an example of a kana only if the reader can read all of it,
# so a reading is taken whole or not at all: one script, plus the 長音符
# for the katakana half. Anything else in the field -- a "/"-packed
# second reading, the deck's occasional "（感）" or "けが・する" -- is not
# a reading this can print, and the word is passed over. That is 43 of
# 8,405, none of them the only example of anything.
_HIRAGANA = re.compile(r"[ぁ-ゖー]+")
_KATAKANA = re.compile(r"[ァ-ヴー]+")

# Same ordering rule kanji_words._level_rank uses (lower = more common).
_LEVEL_ORDER = {"N5": 0, "N4": 1, "N3": 2, "N2": 3, "N1": 4}


def _level_rank(level: str | None) -> int:
    return _LEVEL_ORDER.get(level or "", 99)


def _script_of(kana: str) -> re.Pattern:
    """The script a kana entry teaches, from its own first character --
    every katakana entry starts with a katakana, ー and the small vowels
    only ever follow one."""
    return _KATAKANA if "ァ" <= kana[:1] <= "ヴ" else _HIRAGANA


def reading_of(entry: dict, script: re.Pattern) -> str | None:
    """The reading `entry` can be shown by, or None.

    The deck's `kana` field is the reading, except where it carries a
    part-of-speech note instead of one ("すみません" is filed with
    "（感）"); there the headword is itself kana and is the reading. Only
    the first of a "/"-packed pair is considered, matching how the
    dictionary plate already picks a word's headline reading.
    """
    for field in ("kana", "kanji"):
        text = (entry.get(field) or "").split("/")[0].strip()
        if text and script.fullmatch(text):
            return text
    return None


def _any_reading(word: dict) -> str | None:
    """A deck word's reading in whichever script it is written in: the
    deck files ドア and テレビ in katakana and everything else in
    hiragana, and a word belongs to the cards of the script it is
    actually spelled with."""
    return reading_of(word, _HIRAGANA) or reading_of(word, _KATAKANA)


@lru_cache(maxsize=1)
def _deck_index() -> dict[str, tuple[tuple[str, str, dict], ...]]:
    """kana character -> (level, reading, entry) for every deck word
    read with that character, commonest level first and in deck order
    within a level.

    Keyed by single characters, and a digraph asks for its first one
    (きゃ reads the き bucket, then keeps the readings that carry the
    pair). One bucket per character rather than one per syllabary entry
    keeps this a single pass over the deck instead of 250 substring
    tests per word.
    """
    index: dict[str, list[tuple[str, str, dict]]] = defaultdict(list)
    for level, words in sorted(VOCAB_BY_LEVEL.items(), key=lambda kv: _level_rank(kv[0])):
        for word in words:
            reading = _any_reading(word)
            if not reading:
                continue
            for char in set(reading):
                index[char].append((level, reading, word))
    return {char: tuple(rows) for char, rows in index.items()}


def _deck_candidates(kana: str) -> list[tuple[str, str, dict]]:
    """(level, reading, entry) for every deck word `kana` is read in."""
    script = _script_of(kana)
    return [
        row for row in _deck_index().get(kana[0], ())
        if kana in row[1] and script.fullmatch(row[1])
    ]


# Every kana the syllabary has an entry for -- the gojūon, the yōon,
# the 外来音 and the long-vowel pairs, both scripts. A reading is read
# for these and nothing else, so 'ー' on its own is not a key and 'アー'
# is.
@lru_cache(maxsize=1)
def _syllabary() -> frozenset[str]:
    return frozenset(
        entry["kana"]
        for script in ("hiragana", "katakana")
        for entry in get_syllabary(script)
    )


def _spelled_with(reading: str) -> set[str]:
    """The syllabary entries `reading` is spelled with, each once. One
    or two characters at every position, which is every shape a kana
    entry has."""
    return {
        key
        for i in range(len(reading))
        for key in (reading[i], reading[i:i + 2])
        if key in _syllabary()
    }


def _pool_order(rows: list[tuple], kana: str) -> list[tuple]:
    """Cut `rows` down to the pool's shortlist for one kana, in place:
    the words that begin with it, then the shortest, then the commonest.
    Level plays no part -- a pool word has none."""
    rows.sort(key=lambda row: (0 if row[1].startswith(kana) else 1, len(row[1]), row[3]))
    del rows[MAX_WORDS:]
    return rows


@lru_cache(maxsize=1)
def _pool_index() -> dict[str, tuple[dict, ...]]:
    """kana -> the pool's best MAX_WORDS words read with it.

    Built in ONE pass over the ranked head rather than a query per kana:
    a syllabary page asks about 114 kana at once and some 60 of them
    reach past the deck, which as separate `LIKE` scans is a second of
    work on a cold worker and as one streamed pass is a sixth of one.
    Each bucket is trimmed back to MAX_WORDS as it fills, so the whole
    index is ~250 keys by four rows however many rows went past it.
    """
    buckets: dict[str, list[tuple]] = defaultdict(list)
    for row in jmdict_db.iter_rank_head(POOL_RANK_HORIZON):
        reading = row[1]
        if not (_HIRAGANA.fullmatch(reading) or _KATAKANA.fullmatch(reading)):
            continue
        for key in _spelled_with(reading):
            bucket = buckets[key]
            bucket.append(row)
            if len(bucket) > _POOL_BUCKET_SLACK:
                _pool_order(bucket, key)
    return {
        key: tuple({"kanji": kanji, "kana": reading, "meaning": meaning}
                   for kanji, reading, meaning, _ in _pool_order(bucket, key))
        for key, bucket in buckets.items()
    }


def _pool_candidates(kana: str) -> list[tuple[None, str, dict]]:
    """The pool's shortlist for `kana`, in the order it belongs in."""
    return [(None, row["kana"], row) for row in _pool_index().get(kana, ())]


def _ordered(candidates: list[tuple[str | None, str, dict]], kana: str) -> list[tuple[str | None, str, dict]]:
    """The choosing rule, as one stable sort -- see the module docstring.
    Deck order survives every tie because nothing in the key mentions it.
    """
    return sorted(candidates, key=lambda row: (
        _level_rank(row[0]), 0 if row[1].startswith(kana) else 1, len(row[1]),
    ))


def kana_words(kana: str, lang: str) -> list[dict]:
    """Up to MAX_WORDS words `kana` is read in, as ledger rows.

    A row is the shape the kanji ledger's rows already have --
    {kanji, kana, meaning, level} -- so the panel renders both through
    one component. `kanji` is the written form and is empty for a word
    written in kana alone (テレビ); `kana` is the reading, and is what
    the row prints.

    The list is short, or empty, wherever the language is: ん ends words
    and never starts one, ぴゃ lives in 六百 and almost nowhere else, ヲ
    is not read in ordinary writing at all.
    """
    if not kana:
        return []
    chosen = _ordered(_deck_candidates(kana), kana)
    # The pool is asked only for what the deck could not cover, and its
    # rows go behind the deck's rather than being re-sorted among them:
    # a levelled, translated word outranks a ranked one.
    if len(chosen) < MAX_WORDS:
        chosen = chosen + list(_pool_candidates(kana))

    rows, seen = [], set()
    for level, reading, entry in chosen:
        if reading in seen:
            continue
        seen.add(reading)
        rows.append({
            "kanji":   entry.get("kanji", ""),
            "kana":    reading,
            "meaning": get_meaning(entry, lang, VOCAB_FR),
            "level":   level,
        })
        if len(rows) == MAX_WORDS:
            break
    return rows
