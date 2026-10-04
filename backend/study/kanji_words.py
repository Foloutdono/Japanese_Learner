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
slice the aligner could not isolate is filed under no reading -- almost
always a reading that belongs to the whole word, 熟字訓 or 当て字 (今朝
comes back as one run, けさ, and け is no reading of 今). It may still
appear in the ledger, but only once every filed reading has run out of
words, and never under a reading it cannot vouch for.

── Words written in kana ──────────────────────────────────────
── Words the deck does not have ──────────────────────────────
The deck is 8,405 words and a kanji's readings run past it: 桃 has
もも and the deck has no word for it, so the reading was a bare chip
under "no example words yet" (plan 175). A reading with fewer than
MAX_WORDS deck words is topped up from the JMdict pool, the commonest
words first (content/vocab_jmdict_data.by_kanji_char), filed under the
reading by the same aligner and the same token matching as the deck's
own and shown after them. A pool word carries no level -- the ledger row
draws no badge for it -- and is glossed in English where vocab_fr has no
entry, as the kana ledger's pool rows are (study/kana_words.py).

A word JMdict says is written in kana in every sense (火傷 やけど,
不山戯る ふざける) is the weakest example a kanji can have: the reader
will meet the word, but not the character in it. Such a word goes after
the others of its group rather than out of it, because for some readings
it is the only word the deck has.
"""
from collections import defaultdict
from functools import lru_cache

import content.vocab_jmdict_data as jmdict_db
from content.kanji_data import KANJI_BY_LEVEL
from content.vocab_data import VOCAB_BY_LEVEL
from content.vocab_extras import is_written_in_kana
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


def reading_tokens(char: str, packed: str | None = None) -> list[str]:
    """The readings for `char`, in the deck's own order -- on readings
    first, then kun, markers kept (い.きる, ~び).

    `packed` overrides the deck lookup with a ・-separated string in the
    same format. The dictionary passes it for a character KANJIDIC2 knows
    but the deck does not teach: 322 of those still appear inside deck
    VOCABULARY words, so without it their "used in these words" ledger
    would come back empty for words the app can perfectly well show.
    Passing the string the caller already has in hand also keeps this a
    pure function -- no query per row.
    """
    source = _KANJI_READINGS.get(char, "") if packed is None else packed
    return [p.strip() for p in source.split("・") if p.strip()]


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


def _file_under(char: str, kanji: str, furigana: list[dict], tokens: list[str]) -> str | None:
    """The reading of `char` a word (already aligned) is filed under, or
    None where the aligner could not place it: the token the slice of its
    reading matches (reading_token_for), then the one whose okurigana the
    word writes (_by_okurigana)."""
    surface = reading_of(char, furigana)
    token = reading_token_for(surface, tokens, first=kanji.find(char) == 0) if surface else None
    if token is not None:
        token = _by_okurigana(token, tokens, _okurigana_after(char, furigana))
    return token


def _okurigana_after(char: str, furigana: list[dict]) -> str:
    """The kana written straight after `char` in a word, as the aligner
    left it: 生きる → きる, 生け花 → け, 生活 → ''."""
    for i, part in enumerate(furigana[:-1]):
        nxt = furigana[i + 1]
        if part.get("text") == char and not nxt.get("reading"):
            return nxt["text"]
    return ""


def _by_okurigana(token: str, tokens: list[str], okurigana: str) -> str:
    """Of the readings that share `token`'s sound, the one whose own
    okurigana the word writes: 生かす and 生ける are both い, and
    reading_token_for files both under the first い.* of the list, so
    い.かす and い.ける never owned a word. The longest ending the word
    begins with wins (うま.れる over うま.れ for 生まれる); a word that
    matches none keeps the token it was filed under."""
    if not okurigana or "." not in token:
        return token
    stem, best, best_len = reading_stem(token), token, -1
    for other in tokens:
        if "." not in other or reading_stem(other) != stem:
            continue
        tail = other.split(".", 1)[1].replace("~", "")
        if tail and okurigana.startswith(tail) and len(tail) > best_len:
            best, best_len = other, len(tail)
    return best if best_len >= 0 else token


# How many pool rows are aligned for one character, commonest first. A
# bucket needs four words and the aligner is the cost: 生 has 1,888
# words in the pool and the first 300 already read it eleven ways.
POOL_SCAN = 300
# Candidates kept per reading: a few more than shown, so a pool word that
# is also a deck word, or one written in kana, can be passed over.
_POOL_KEPT = 2 * MAX_WORDS


@lru_cache(maxsize=512)
def _pool_candidates(char: str, tokens: tuple[str, ...]) -> dict[str, tuple[tuple[str, str, str], ...]]:
    """reading token -> (kanji, kana, English meaning) for the pool words
    that demonstrate it, written-in-kanji first and commonest first.

    Language-free and small on purpose (a tuple of strings per word,
    ~7 KB for a character with a dozen readings): the furigana and the
    gloss are made for the few that are shown."""
    found: dict[str, list[tuple[str, str, str]]] = {tok: [] for tok in tokens}
    for row in jmdict_db.by_kanji_char(char, POOL_SCAN):
        kanji, kana = row["kanji"], row["kana"]
        token = _file_under(char, kanji, word_furigana(kanji, kana), list(tokens))
        if token is not None and len(found[token]) < _POOL_KEPT * 2:
            found[token].append((kanji, kana, row["meaning"]))
    return {
        tok: tuple(sorted(words, key=lambda w: is_written_in_kana(w[0], w[1]))[:_POOL_KEPT])
        for tok, words in found.items() if words
    }


def _buckets(char: str, lang: str, packed: str | None = None) -> tuple[list[str], dict[str | None, list[dict]], dict[str | None, int]]:
    """Every deck word containing `char`, filed under the reading it uses.

    Order inside a bucket is most-common level first, and multi-character
    compounds before the bare single-character word, since a kanji's
    entry should show how it combines with others rather than just
    repeat itself -- and, before either, written in kanji before written
    in kana (module docstring). Buckets are keyed by the deck's own
    reading token (see reading_token_for), with None for a word the
    aligner could not place.
    """
    tokens = reading_tokens(char, packed)
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
        buckets[_file_under(char, kanji, furigana, tokens)].append(entry)
    # How many deck words each reading has, before the pool tops any up:
    # the figure behind the share of the JLPT course (plan 175).
    deck_counts = {tok: len(words) for tok, words in buckets.items()}
    # The pool tops up every reading the deck leaves short, behind the
    # deck's own words. Asked only if one is short, so a character the
    # deck covers well never touches it.
    if any(len(buckets[tok]) < MAX_WORDS for tok in tokens):
        pool = _pool_candidates(char, tuple(tokens))
        for tok in tokens:
            for kanji, kana, meaning in pool.get(tok, ()):
                if len(buckets[tok]) >= MAX_WORDS:
                    break
                if (kanji, kana) in seen:
                    continue
                seen.add((kanji, kana))
                buckets[tok].append({
                    "kanji":    kanji,
                    "kana":     kana,
                    "meaning":  meaning,
                    "level":    None,
                    "furigana": word_furigana(kanji, kana),
                })
    # Stable: the level and compound order above holds on either side.
    for words in buckets.values():
        words.sort(key=lambda e: is_written_in_kana(e["kanji"], e["kana"]))
    return tokens, buckets, deck_counts


def _build_single_kanji_words() -> dict[str, str]:
    """The characters that are words on their own, and how each is read
    as that word.

    山 carries サン, セン and やま in the kanji deck; as a word it is
    やま, and that is the one a catalogue tile means when it prints one
    character. The character's own list of readings is what the entry's
    plate is for.

    Lowest level wins where the same character is two words -- 日 is ひ
    at N4 and にち at N3 -- because the commoner word is the one a tile
    of that character is most likely to be read as.
    """
    best: dict[str, tuple[int, str]] = {}
    for level, words in VOCAB_BY_LEVEL.items():
        rank = _level_rank(level)
        for word in words:
            kanji = word.get("kanji") or ""
            kana = (word.get("kana") or "").split("/")[0].strip()
            if len(kanji) != 1 or not is_kanji(kanji) or not kana:
                continue
            if kanji not in best or rank < best[kanji][0]:
                best[kanji] = (rank, kana)
    return {char: kana for char, (_, kana) in best.items()}


_SINGLE_KANJI_WORDS = _build_single_kanji_words()


def kanji_as_word(char: str) -> str | None:
    """How `char` is read when it stands alone as a word, or None when
    the deck does not know it as one."""
    return _SINGLE_KANJI_WORDS.get(char)


def kanji_words(char: str, lang: str, packed: str | None = None) -> dict:
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
               not place come after every placed word, not merely after
               each round of them -- a word that cannot say which reading
               it demonstrates is the weakest example, not a wrong one.
               It used to take the first free slot of the first round,
               which is how 今朝 (けさ) came before 今週 and 不山戯る before
               火山. A kanji with one reading is unaffected: one bucket,
               the same order it always had.
    """
    tokens, buckets, deck_counts = _buckets(char, lang, packed)
    readings = [{"reading": tok, "words": buckets[tok][:MAX_WORDS]} for tok in tokens]

    # One queue per stem, in the deck's order; a stem's queue is its
    # tokens' buckets back to back, so the ledger never spends two slots
    # on one sound, then re-sorted so a word written in kana from one
    # token does not stand before a written one from the next.
    queues: dict[str, list[dict]] = {}
    for tok in tokens:
        if buckets[tok]:
            queues.setdefault(reading_stem(tok), []).extend(buckets[tok])
    for words in queues.values():
        words.sort(key=lambda e: is_written_in_kana(e["kanji"], e["kana"]))

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
    # The unplaced words, only in the slots the placed ones left.
    examples.extend(buckets[None][:MAX_WORDS - len(examples)])
    return {"readings": readings, "examples": examples,
            "shares": _shares(deck_counts, tokens)}


def _shares(counts: dict[str | None, int], tokens: list[str]) -> dict:
    """{"total", "whole", "readings": {token: words}} from a count per
    reading: `whole` is the words the aligner could not place (a reading
    that belongs to the whole word, 今朝 けさ), and `total` every word,
    placed or not, so the shares of a kanji add up to its whole."""
    return {
        "total": sum(counts.values()),
        "whole": counts.get(None, 0),
        "readings": {tok: counts[tok] for tok in tokens if counts.get(tok)},
    }


@lru_cache(maxsize=256)
def full_shares(char: str, packed: str | None = None) -> dict:
    """The same counts over ALL of JMdict: the course's words plus every
    pool word written with `char` (the pool is everything the course is
    not). The count behind the readings sheet's "Tout JMdict" scope --
    aligning every one of 生's 1,943 words, so it is asked for when the
    learner switches to it, and cached (plan 175)."""
    tokens = reading_tokens(char, packed)
    counts: dict[str | None, int] = defaultdict(int)
    seen: set[tuple[str, str]] = set()
    for _level, w in _KANJI_TO_VOCAB.get(char, []):
        key = (w.get("kanji", ""), w.get("kana", ""))
        if key in seen:
            continue
        seen.add(key)
        counts[_file_under(char, key[0], word_furigana(*key), tokens)] += 1
    for kanji, kana in jmdict_db.all_with_kanji(char):
        if (kanji, kana) in seen:
            continue
        seen.add((kanji, kana))
        counts[_file_under(char, kanji, word_furigana(kanji, kana), tokens)] += 1
    return _shares(counts, tokens)
