"""
Which words use a kanji, and with which of its readings.

A kanji's readings are a list a learner cannot use on its own -- 生 has
twenty -- and its example words are the thing that makes each reading
real: セイ is 先生, い.きる is 生きる, なま is 生ビール. The dictionary
panel shows the two headline readings on its plate and opens a panel
listing every reading with the words that use it; this module is the
grouping behind both, and behind the panel's four-word "used in these
words" ledger, which is the same buckets read round-robin.

Pure: content data plus the furigana aligner. It sits in study/ rather
than in routes/dictionary.py (where the first version of the ledger
lived) so it can be tested without a database behind it.

── How a word is filed under a reading ────────────────────────
The aligner (study/furigana.py) already splits a word's flat reading per
kanji, so 木曜日 → もく|よう|び says 木 is read もく here. That slice is
matched back to the kanji's own reading list through
furigana.reading_token_for, which knows the same three things the
aligner does -- an on-reading is written in katakana in the deck and
appears in hiragana in a word, a kun-reading's okurigana stays outside
the kanji (生きる files under い.きる by its stem い), and a non-initial
element may voice or geminate (日 read び, 学 read がっ). A word whose
slice the aligner could not isolate (生活 comes back as one run,
せいかつ) is filed under no reading: it still appears in the ledger, last,
but never under a reading it cannot vouch for.
"""
from collections import defaultdict

from content.kanji_data import KANJI_BY_LEVEL
from content.vocab_data import VOCAB_BY_LEVEL
from study.furigana import align_deck, is_kanji, reading_stem, reading_token_for
from translations import get_meaning
from translations.fr.vocab_fr import VOCAB_FR

# Words shown per reading in the panel, and in the ledger overall.
MAX_WORDS = 4

# Same ordering rule card_lookup._level_rank uses (lower = more common).
_LEVEL_ORDER = {"N5": 0, "N4": 1, "N3": 2, "N2": 3, "N1": 4}


def _level_rank(level: str) -> int:
    return _LEVEL_ORDER.get(level, 99)


def _build_kanji_to_vocab_index() -> dict[str, list[tuple[str, dict]]]:
    """kanji char -> [(level, vocab_entry), ...] over the app's own deck."""
    index: dict[str, list[tuple[str, dict]]] = defaultdict(list)
    for level, vocab_list in VOCAB_BY_LEVEL.items():
        for w in vocab_list:
            chars = {c for c in w.get("kanji", "") if is_kanji(c)}
            for char in chars:
                index[char].append((level, w))
    return index


_KANJI_TO_VOCAB = _build_kanji_to_vocab_index()
_KANJI_READINGS = {
    e["kanji"]: e.get("kana", "")
    for entries in KANJI_BY_LEVEL.values() for e in entries
}


def reading_tokens(char: str) -> list[str]:
    """The deck's readings for `char`, in the deck's own order -- on
    readings first, then kun, markers kept (い.きる, ~び)."""
    return [p.strip() for p in _KANJI_READINGS.get(char, "").split("・") if p.strip()]


def word_furigana(kanji: str, kana: str) -> list[dict]:
    """Per-kanji furigana for a headword, computed once here rather than
    left to the frontend's weaker anchor-only splitter -- same algorithm
    (study.furigana) the vocab screen's indice_3 hint already renders
    with. `kana` may pack several readings with "/"; only the first,
    primary one is annotated, matching how the dictionary panel's
    headline furigana already picks it."""
    if not kanji or not kana:
        return []
    primary = kana.split("/")[0].strip()
    return align_deck(kanji, primary) if primary else []


def reading_of(char: str, furigana: list[dict]) -> str | None:
    """Which reading of `char` a word actually uses, from its own furigana.

    Only counted when the aligner isolated the character on its own -- a
    part covering a whole unsegmented run ("生活" → せいかつ) says nothing
    about which half is which, so it comes back None and the caller
    treats the word as "reading unknown" rather than inventing one.
    """
    for part in furigana:
        if part.get("text") == char:
            return part.get("reading")
    return None


def _buckets(char: str, lang: str) -> tuple[list[str], dict[str | None, list[dict]]]:
    """Every deck word containing `char`, filed under the reading it uses.

    Order inside a bucket is most-common level first, and multi-character
    compounds before the bare single-character word, since a kanji's
    entry should show how it combines with others rather than just
    repeat itself. Buckets are keyed by the deck's own reading token
    (see reading_token_for), with None for a word the aligner could not
    place.
    """
    tokens = reading_tokens(char)
    candidates = _KANJI_TO_VOCAB.get(char, [])
    compounds = sorted((c for c in candidates if len(c[1].get("kanji", "")) > 1), key=lambda c: _level_rank(c[0]))
    singles   = sorted((c for c in candidates if len(c[1].get("kanji", "")) <= 1), key=lambda c: _level_rank(c[0]))

    seen: set[tuple[str, str]] = set()
    buckets: dict[str | None, list[dict]] = {tok: [] for tok in tokens}
    buckets[None] = []
    for level, w in compounds + singles:
        kanji = w.get("kanji", "")
        key = (kanji, w.get("kana", ""))
        if key in seen:
            continue
        seen.add(key)
        furigana = word_furigana(kanji, w.get("kana", ""))
        entry = {
            "kanji":    kanji,
            "kana":     w.get("kana", ""),
            "meaning":  get_meaning(w, lang, VOCAB_FR),
            "level":    level,
            "furigana": furigana,
        }
        surface = reading_of(char, furigana)
        token = reading_token_for(surface, tokens, first=kanji.find(char) == 0) if surface else None
        buckets[token].append(entry)
    return tokens, buckets


def kanji_words(char: str, lang: str) -> dict:
    """
    {"readings": [...], "examples": [...]} for one kanji.

    readings   every reading token in the deck's order, each with up to
               MAX_WORDS words that use it (possibly none) -- the panel
               behind the plate's "+N".
    examples   up to MAX_WORDS words chosen to show as MANY DIFFERENT
               READINGS as the deck can -- the panel's ledger. The slots
               are filled one reading at a time before any reading gets a
               second word: by level alone 生's four came out 先生・学生・
               生活・人生, セイ four times, teaching a quarter of the
               character; round-robin gives セイ, い(きる), う(まれる), なま.
               "Different" is judged by stem (reading_stem): 上げる and
               上がる are both あ, and 生まれる under う.まれる and うま.れる
               are one sound, so okurigana variants of one reading share
               a slot rather than each taking one. Words the aligner could
               not place come last -- a word that cannot say which reading
               it demonstrates is the weakest example, not a wrong one. A
               kanji with one reading is unaffected: one bucket, the same
               order it always had.
    """
    tokens, buckets = _buckets(char, lang)
    readings = [{"reading": tok, "words": buckets[tok][:MAX_WORDS]} for tok in tokens]

    # One queue per stem, in the deck's order; a stem's queue is its
    # tokens' buckets back to back, so the ledger never spends two slots
    # on one sound. The unplaced words are a queue of their own, last.
    queues: dict[str | None, list[dict]] = {}
    for tok in tokens:
        if buckets[tok]:
            queues.setdefault(reading_stem(tok), []).extend(buckets[tok])
    queues[None] = buckets[None]

    examples: list[dict] = []
    depth = 0
    while len(examples) < MAX_WORDS:
        added = False
        for words in queues.values():
            if depth >= len(words):
                continue
            examples.append(words[depth])
            added = True
            if len(examples) >= MAX_WORDS:
                break
        if not added:
            break
        depth += 1
    return {"readings": readings, "examples": examples}
