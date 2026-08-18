"""
Loads the JMdict-derived "extras" for the app's vocab deck: grammatical
tags, every JMdict sense (not just the one glossed in the app's own
deck), and example sentences — layered on top of vocab_data.py's own
JLPT-leveled deck rather than folded into it (vocab_deck.json only ever
carries {kanji, kana, meaning} — see vocab_data.py's docstring — and
dictionary.py's public contract for a vocab result shouldn't have to
change shape just because this data happens to exist for some words).

Source files sit next to vocab_deck.json under datas/vocab/:

    vocab_meanings.json — "<kanji>::<kana>" -> [sense, sense, ...]
        Keyed exactly like a vocab_deck.json entry's own kanji/kana
        pair (kana can be several readings packed with "/", e.g.
        "毎月::まいげつ/まいつき") so the common case is a direct dict
        lookup with no parsing. Each sense:
        {match_type, term, reading, tags, term_tags, glossary,
         examples: [{jp, en}, ...]}
        tags are JMdict part-of-speech/field/misc codes ("n", "v1",
        "adj-i", ...); term_tags are priority/frequency/name markers
        ("⭐", "ichi", "news3k", "place", ...).

    vocab_tags.json — tag code -> {category, sorting_order, notes, score}
        Human-readable "notes" (English) and a "score" used here to
        order frequency tags from most to least common.

Public API: get_vocab_extras(kanji, kana, meaning_hint="", lang="fr") ->
    {
      "tags": [{"code", "label", "tooltip"}, ...],   # word-level, pruned + priority-ordered
      "senses": [
          {"number": 1, "primary": bool, "glossary": "...", "tags": [...]},
          ...
      ],
      "examples": [
          {"jp", "en", "segments": [...], "sense_number": 1, "sense_glossary": "..."},
          ...
      ],
    }

"tags" is the word-level row: priority star, then part-of-speech, then
usage/register, then frequency rank — pooled across every sense so a
word that's both a noun and a suru-verb shows both, deduplicated, and
capped so it stays a glance rather than a JMdict dump. "senses" lists
every JMdict sense (numbered in their original dictionary order, not
reordered) with its own short tags; `primary` flags whichever one best
matches the app's own (English) gloss, scored via `meaning_hint` — the
app still shows its own translated meaning elsewhere, this is
additional context. "examples" pools sentences across senses (primary
sense's examples first) and tags each with the sense it illustrates so
the frontend can show "① to take (time, money)" next to it.

Each example's "segments" is a list of
    {"text": str, "reading": str | None, "highlight": bool}
in reading order — "reading" is set when that chunk should be rendered
as furigana (a <ruby>), and "highlight" flags the chunk(s) that make up
the headword itself. Furigana comes from the app's own vocab/kanji
decks (a lightweight longest-match lookup, not a real morphological
analyzer): any compound already in the app's deck gets its real
reading, anything else falls back to per-character kanji readings,
which is occasionally wrong for compounds whose reading isn't just the
sum of their parts.
"""
import itertools
import json
import os
import re
from functools import lru_cache

from study import morphology
from study.furigana import align_deck
from content.vocab_data import VOCAB_BY_LEVEL

try:
    from content.kanji_data import KANJI_BY_LEVEL
except ImportError:  # pragma: no cover - defensive only, always present in prod
    KANJI_BY_LEVEL = {}

# One level up: this module now lives in a package, and datas/
# is still at the backend root.
_BASE_DIR = os.path.dirname(os.path.dirname(__file__))
_DATA_DIR = os.path.join(_BASE_DIR, "datas", "vocab")

# MEMORY NOTE (2026-08): this used to eagerly load the full ~293k-entry
# vocab_jmdict_meanings.json (~80MB of JSON, several times heavier once
# parsed into Python dicts/lists) and merge it into an in-memory
# _VOCAB_MEANINGS dict at import time — a large share of what pushed a
# 512MB deploy over budget. The JMdict pool is now backed by
# datas/vocab/vocab_jmdict.sqlite3 (see vocab_jmdict_data.py) and
# queried per-word on demand instead — _find_senses() below falls back
# to that DB lookup only for words not in the app's own deck.
#
# MEMORY NOTE (2026-08, cont'd): the app's own deck's senses
# (vocab_meanings.json, ~8,400 words) used to get the same eager
# in-memory treatment as a "small enough" exception — but parsed into
# Python objects plus the _MEANINGS_READING structure derived from
# them (see _build_meanings_readings below), that was still two full
# resident copies of the same data on every worker. It's now migrated
# into the SAME sqlite database as the JMdict pool (a `curated_senses`
# table — see build_curated_senses_db.py) and queried through
# vocab_meanings_data.py exactly like _jmdict_db is queried below — no
# more always-in-memory dict for either half of this module's data.
# The deck's own curated senses still always win over the JMdict pool
# when both exist, same as before (see _find_senses).
from content import vocab_meanings_data
try:
    import content.vocab_jmdict_data as _jmdict_db
except ImportError:  # pragma: no cover - defensive only, always present in prod
    _jmdict_db = None

with open(os.path.join(_DATA_DIR, "vocab_tags.json"), encoding="utf-8") as f:
    _VOCAB_TAGS: dict[str, dict] = json.load(f)

# term_tags mix real study-relevant signal (priority/frequency markers,
# category "popular"/"frequent") with name/place/person/etc. markers
# (category "name") that don't help a JLPT learner's card — only the
# former are ever surfaced.
_TERM_TAG_CATEGORIES_SHOWN = {"popular", "frequent"}

# Cards stay a glance, not a JMdict dump.
_MAX_TAGS = 6
_MAX_SENSE_TAGS = 4
_MAX_SENSES = 8
_MAX_EXAMPLES = 5

_HIRAGANA_RE = re.compile(r"[\u3040-\u309F]")

# When extending a matched stem through the hiragana that follows it
# (see _extend_inflection_tail), stop as soon as one of these turns up —
# they're grammar (particles, sentence-final か/ね/よ) tacked on after
# the word, not part of its own conjugation.
_BOUNDARY_HIRAGANA = set("かねよわなはがをにでともへの")


def _is_kanji(ch: str) -> bool:
    return "\u4e00" <= ch <= "\u9fff"


def _readings(kana: str) -> list[str]:
    return [r.strip() for r in (kana or "").split("/") if r.strip()]


# ── Tag classification + short labels (fr/en) ───────────────
# Yomitan-style: a short glance-able label on the chip itself, with the
# full JMdict "notes" text kept only for the tooltip. Codes not listed
# here fall back to the raw code (already short) in either language.
# Display priority for a constant, predictable chip order: star first,
# then part-of-speech (what kind of word it is), then frequency rank
# (how common it is), then everything else (register/field notes).
_KIND_STAR, _KIND_POS, _KIND_FREQ, _KIND_MISC = 0, 1, 2, 3

_POS_CODES = {
    "n", "n-suf", "n-pref", "pn", "adj-i", "adj-ix", "adj-na", "adj-no",
    "adj-t", "adj-f", "adv", "adv-to", "aux", "aux-v", "aux-adj", "conj",
    "cop", "ctr", "exp", "int", "num", "pref", "prt", "suf",
    "v1", "v1-s", "v5aru", "v5b", "v5g", "v5k", "v5k-s", "v5m", "v5n",
    "v5r", "v5r-i", "v5s", "v5t", "v5u", "v5u-s", "v5uru",
    "vk", "vn", "vr", "vs", "vs-c", "vs-i", "vs-s", "vz", "vt", "vi",
}
_MISC_CODES = {
    "uk", "abbr", "col", "hon", "hum", "pol", "arch", "obs", "dated",
    "rare", "on-mim", "id", "proverb", "derog",
}
# Field-of-use tags worth surfacing (the word belongs to a recognisable
# study-relevant domain) — kept separate from _MISC_CODES since JMdict
# calls them "fields" rather than register/misc notes, but they render
# in the same chip slot. The much longer tail of JMdict field codes
# (dialects, individual mythologies, card/board games, etc.) is left
# out on purpose: real but not useful on a JLPT learner's glance card.
_FIELD_CODES = {
    "comp", "ling", "med", "math", "physics", "biol", "chem", "music",
    "sports", "law", "econ", "food", "MA", "Buddh", "Shinto", "geol",
    "astron", "bot", "zool", "anat", "mil", "photo", "internet",
    "baseb", "go", "shogi", "sumo", "politics", "psych", "archit",
    "art", "bus", "finc",
}

_SHORT_LABELS_FR = {
    "n": "nom", "n-suf": "suffixe", "n-pref": "préfixe", "pn": "pronom",
    "adj-i": "adj. -i", "adj-ix": "adj. -i", "adj-na": "adj. -na",
    "adj-no": "adj. -no", "adj-t": "adj. -taru", "adj-f": "adj.",
    "adv": "adv.", "adv-to": "adv. -to",
    "aux": "aux.", "aux-v": "aux. verbe", "aux-adj": "aux. adj.",
    "conj": "conj.", "cop": "copule", "ctr": "compteur",
    "exp": "expression", "int": "interjection", "num": "nombre",
    "pref": "préfixe", "prt": "particule", "suf": "suffixe",
    "v1": "v. ichidan", "v1-s": "v. ichidan",
    "v5aru": "v. godan", "v5b": "v. godan", "v5g": "v. godan",
    "v5k": "v. godan", "v5k-s": "v. godan", "v5m": "v. godan",
    "v5n": "v. godan", "v5r": "v. godan", "v5r-i": "v. godan",
    "v5s": "v. godan", "v5t": "v. godan", "v5u": "v. godan",
    "v5u-s": "v. godan", "v5uru": "v. godan",
    "vk": "v. irr. (来る)", "vn": "v. irr. (ぬ)", "vr": "v. irr. (り)",
    "vs": "v. suru", "vs-c": "v. suru", "vs-i": "v. suru", "vs-s": "v. suru",
    "vz": "v. ichidan (ずる)", "vt": "transitif", "vi": "intransitif",
    "uk": "kana", "abbr": "abrév.", "col": "familier", "hon": "honorifique",
    "hum": "humble", "pol": "poli", "arch": "archaïque", "obs": "obsolète",
    "dated": "désuet", "rare": "rare", "on-mim": "onomatopée",
    "id": "idiome", "proverb": "proverbe", "derog": "péjoratif",
    "⭐": "⭐", "ichi": "fréquent", "spec": "fréquent", "gai": "emprunt",
    "comp": "informatique", "ling": "linguistique", "med": "médecine",
    "math": "mathématiques", "physics": "physique", "biol": "biologie",
    "chem": "chimie", "music": "musique", "sports": "sport", "law": "droit",
    "econ": "économie", "food": "cuisine", "MA": "arts martiaux",
    "Buddh": "bouddhisme", "Shinto": "shintoïsme", "geol": "géologie",
    "astron": "astronomie", "bot": "botanique", "zool": "zoologie",
    "anat": "anatomie", "mil": "militaire", "photo": "photographie",
    "internet": "internet", "baseb": "baseball", "go": "go (jeu)",
    "shogi": "shogi", "sumo": "sumo", "politics": "politique",
    "psych": "psychologie", "archit": "architecture", "art": "art",
    "bus": "affaires", "finc": "finance",
}
_SHORT_LABELS_EN = {
    "n": "noun", "n-suf": "suffix", "n-pref": "prefix", "pn": "pronoun",
    "adj-i": "i-adj.", "adj-ix": "i-adj.", "adj-na": "na-adj.",
    "adj-no": "no-adj.", "adj-t": "taru-adj.", "adj-f": "adj.",
    "adv": "adv.", "adv-to": "adv. (to)",
    "aux": "aux.", "aux-v": "aux. verb", "aux-adj": "aux. adj.",
    "conj": "conj.", "cop": "copula", "ctr": "counter",
    "exp": "expression", "int": "interjection", "num": "numeral",
    "pref": "prefix", "prt": "particle", "suf": "suffix",
    "v1": "ichidan v.", "v1-s": "ichidan v.",
    "v5aru": "godan v.", "v5b": "godan v.", "v5g": "godan v.",
    "v5k": "godan v.", "v5k-s": "godan v.", "v5m": "godan v.",
    "v5n": "godan v.", "v5r": "godan v.", "v5r-i": "godan v.",
    "v5s": "godan v.", "v5t": "godan v.", "v5u": "godan v.",
    "v5u-s": "godan v.", "v5uru": "godan v.",
    "vk": "irr. v. (来る)", "vn": "irr. v. (ぬ)", "vr": "irr. v. (り)",
    "vs": "suru v.", "vs-c": "suru v.", "vs-i": "suru v.", "vs-s": "suru v.",
    "vz": "ichidan v. (ずる)", "vt": "transitive", "vi": "intransitive",
    "uk": "kana usually", "abbr": "abbr.", "col": "colloquial", "hon": "honorific",
    "hum": "humble", "pol": "polite", "arch": "archaic", "obs": "obsolete",
    "dated": "dated", "rare": "rare", "on-mim": "onomatopoeia",
    "id": "idiom", "proverb": "proverb", "derog": "derogatory",
    "⭐": "⭐", "ichi": "common", "spec": "common", "gai": "loanword",
    "comp": "computing", "ling": "linguistics", "med": "medicine",
    "math": "math", "physics": "physics", "biol": "biology",
    "chem": "chemistry", "music": "music", "sports": "sports", "law": "law",
    "econ": "economics", "food": "food", "MA": "martial arts",
    "Buddh": "Buddhism", "Shinto": "Shinto", "geol": "geology",
    "astron": "astronomy", "bot": "botany", "zool": "zoology",
    "anat": "anatomy", "mil": "military", "photo": "photography",
    "internet": "internet", "baseb": "baseball", "go": "go (game)",
    "shogi": "shogi", "sumo": "sumo", "politics": "politics",
    "psych": "psychology", "archit": "architecture", "art": "art",
    "bus": "business", "finc": "finance",
}
_NEWS_RANK_RE = re.compile(r"^news(\d+)k$")

# Coarse part-of-speech buckets, for callers (card_lookup.py's reading-
# practice badge coloring) that want "verb"/"adjective"/"noun" rather
# than a raw JMdict code — see word_category below.
_VERB_POS_CODES = {
    "v1", "v1-s", "v5aru", "v5b", "v5g", "v5k", "v5k-s", "v5m", "v5n",
    "v5r", "v5r-i", "v5s", "v5t", "v5u", "v5u-s", "v5uru",
    "vk", "vn", "vr", "vs", "vs-c", "vs-i", "vs-s", "vz",
}
_ADJECTIVE_POS_CODES = {"adj-i", "adj-ix", "adj-na", "adj-no", "adj-t", "adj-f"}
_NOUN_POS_CODES = {"n", "n-suf", "n-pref", "pn", "ctr", "num"}


def _short_label(code: str, lang: str) -> str:
    table = _SHORT_LABELS_FR if lang == "fr" else _SHORT_LABELS_EN
    if code in table:
        return table[code]
    m = _NEWS_RANK_RE.match(code)
    if m:
        return f"top {m.group(1)}k"
    return code


# A code only earns a chip if it has an actual translated label (POS,
# curated misc/field tag, star, or a news-frequency rank) — this is
# the real pruning step. Left unfiltered, JMdict's raw code list is
# mostly noise for a learner's card: kana/kanji variant markers ("ik",
# "rK", "sK", ...), a "not displayed in educational software" marker
# ("X"), bare JMdict sense numbers ("1", "2", ...), and dozens of very
# niche fields (individual mythologies, regional dialects, card/board
# games) that add clutter, not value. Anything not in the allow-list
# below is dropped rather than shown as a raw, untranslated code.
_RECOGNIZED_CODES = _POS_CODES | set(_SHORT_LABELS_FR)


def _is_recognized(code: str) -> bool:
    return code in _RECOGNIZED_CODES or bool(_NEWS_RANK_RE.match(code))


def _build_tag(code: str, is_term_tag: bool, lang: str) -> dict:
    info = _VOCAB_TAGS.get(code) or {}
    if is_term_tag:
        kind = _KIND_STAR if info.get("category") == "popular" else _KIND_FREQ
    else:
        kind = _KIND_POS if code in _POS_CODES else _KIND_MISC
    return {
        "code": code,
        "label": _short_label(code, lang),
        "tooltip": info.get("notes") or code,
        "_kind": kind,
        "_score": info.get("score") or 0,
    }


def _public_tag(t: dict) -> dict:
    return {"code": t["code"], "label": t["label"], "tooltip": t["tooltip"]}


def _collect_sense_tags(sense: dict, lang: str, limit: int = _MAX_SENSE_TAGS) -> list:
    seen = set()
    collected = []
    for code in sense.get("tags", []):
        if code in seen or not _is_recognized(code):
            continue
        seen.add(code)
        collected.append(_build_tag(code, False, lang))
    for code in sense.get("term_tags", []):
        info = _VOCAB_TAGS.get(code)
        if not info or info.get("category") not in _TERM_TAG_CATEGORIES_SHOWN or code in seen:
            continue
        seen.add(code)
        collected.append(_build_tag(code, True, lang))
    collected.sort(key=lambda t: (t["_kind"], t["_score"]))
    return [_public_tag(t) for t in collected[:limit]]


def _collect_word_tags(senses: list, lang: str) -> list:
    # Pooled across every sense (not just the primary one) — a word
    # that's e.g. both a noun and a suru-verb should show both, the
    # way a real dictionary entry would, not just whichever sense
    # happens to match the app's own single gloss.
    seen = set()
    collected = []
    for order, sense in enumerate(senses):
        for code in sense.get("tags", []):
            if code in seen or not _is_recognized(code):
                continue
            seen.add(code)
            collected.append((order, _build_tag(code, False, lang)))
        for code in sense.get("term_tags", []):
            info = _VOCAB_TAGS.get(code)
            if not info or info.get("category") not in _TERM_TAG_CATEGORIES_SHOWN or code in seen:
                continue
            seen.add(code)
            collected.append((order, _build_tag(code, True, lang)))
    collected.sort(key=lambda pair: (pair[1]["_kind"], pair[1]["_score"], pair[0]))
    return [_public_tag(t) for _, t in collected[:_MAX_TAGS]]


def _find_senses(kanji: str, kana: str) -> list[dict] | None:
    # Fast path: curated_senses keys its rows with the exact same
    # packed kana string vocab_deck.json uses (see module docstring),
    # so most words resolve with a single indexed query — this only
    # ever covers the app's own (~8k word) deck.
    senses = vocab_meanings_data.get(f"{kanji}::{kana}")
    if senses:
        return senses
    # Fallback for any mismatch in reading order/subset between the two
    # decks — try each individual reading on its own.
    for reading in _readings(kana):
        senses = vocab_meanings_data.get(f"{kanji}::{reading}")
        if senses:
            return senses
    # Not in the app's own deck — try the JMdict pool via SQLite
    # (queried on demand, see module docstring; never held fully in RAM).
    if _jmdict_db is not None:
        senses = _jmdict_db.get_senses(kanji, kana)
        if senses:
            return senses
        for reading in _readings(kana):
            senses = _jmdict_db.get_senses(kanji, reading)
            if senses:
                return senses
    return None


@lru_cache(maxsize=4096)
def word_category(kanji: str, kana: str) -> str:
    """Coarse part-of-speech bucket for this word — "verb", "adjective",
    "noun", or "other" — used by card_lookup.py to color-code
    reading-practice badges by word type (2026-08). Deliberately derived
    from the word's OWN JMdict sense tags rather than how it's being
    used in any one sentence: a sentence's own conjugated-form POS is
    contextual and would make the same card change color depending on
    which example happened to be shown, where a word's dictionary part
    of speech is stable. "other" covers everything that doesn't cleanly
    fall into the three buckets above (particles, adverbs, conjunctions,
    interjections, expressions, ...) as well as words with no findable
    senses at all — left for the caller's own neutral default styling
    rather than guessed at.
    """
    senses = _find_senses(kanji, kana)
    if not senses:
        return "other"
    tags = {t for s in senses for t in s.get("tags", [])}
    if tags & _VERB_POS_CODES:
        return "verb"
    if tags & _ADJECTIVE_POS_CODES:
        return "adjective"
    if tags & _NOUN_POS_CODES:
        return "noun"
    return "other"


# ── "Does this word have an example sentence?" (reading.py, 2026-08) ──
# The app's own deck is small enough (~8k words) that keeping this one
# set of keys resident is cheap and keeps reading.py's level-mode word
# picker (VOCAB_BY_LEVEL, filter, sample) a pure in-memory operation —
# no need to touch _find_senses/get_vocab_extras just to check
# candidates before picking one. has_examples is precomputed per key at
# build time now (see build_curated_senses_db.py), so this is one
# indexed query instead of decoding every sense blob at import.
_DECK_WORDS_WITH_EXAMPLES = vocab_meanings_data.keys_with_examples()


def has_examples(kanji: str, kana: str) -> bool:
    """Cheap existence check — does NOT build furigana/segments/tags
    like get_vocab_extras does, just answers "is it worth calling
    get_vocab_extras on this word for reading practice". Deck words:
    one set lookup (precomputed above). JMdict-pool words: the
    has_examples column on vocab_jmdict.sqlite3's entries table
    (indexed, see build_jmdict_db.py) via get_by_key, which
    reading.py's frequency-tier picker already calls anyway — reuse
    that instead of a second round-trip to the DB when possible."""
    key = f"{kanji}::{kana}"
    if key in _DECK_WORDS_WITH_EXAMPLES:
        return True
    for reading in _readings(kana):
        if f"{kanji}::{reading}" in _DECK_WORDS_WITH_EXAMPLES:
            return True
    if _jmdict_db is not None:
        entry = _jmdict_db.get_by_key(kanji, kana)
        if entry is not None:
            return bool(entry["has_examples"])
    return False


def pick_random_example(kanji: str, kana: str, meaning_hint: str = "", lang: str = "fr") -> dict | None:
    """One random example for this word (jp/en/segments/sense_glossary
    — same shape as one item of get_vocab_extras()["examples"]), or
    None if it has none. Random rather than always examples[0] so
    reading-practice sessions don't serve the exact same sentence for a
    word every time it comes up."""
    import random
    extras = get_vocab_extras(kanji, kana, meaning_hint, lang)
    examples = extras["examples"]
    return random.choice(examples) if examples else None


# ── Primary-sense scoring ────────────────────────────────────
# A word can carry many JMdict senses but the app shows one gloss —
# score each sense against it so the frontend can flag which one is
# "the" meaning already shown elsewhere on the card (all senses are
# still listed; this only affects the `primary` flag and example order).
_WORD_RE = re.compile(r"[a-zA-Z']+")
_STOPWORDS = {
    "a", "an", "the", "to", "of", "in", "on", "at", "by", "for", "with",
    "and", "or", "e", "g", "eg", "etc", "someone", "something", "one",
    "ones", "one's", "is", "be", "as", "it", "that", "this",
}


def _content_words(text: str) -> set:
    return {w for w in (m.lower() for m in _WORD_RE.findall(text)) if w not in _STOPWORDS and len(w) > 1}


def _gloss_words(sense: dict) -> set:
    words = set()
    for g in sense.get("glossary", []):
        words |= _content_words(g)
    return words


def _select_primary(senses: list, meaning_hint: str) -> list:
    meaning_words = _content_words(meaning_hint or "")
    if not meaning_words:
        return senses[:1]
    scored = [(s, len(meaning_words & _gloss_words(s))) for s in senses]
    best = max(score for _, score in scored)
    if best == 0:
        return senses[:1]
    return [s for s, score in scored if score == best]


# ── Furigana + highlight ─────────────────────────────────────
# Best-effort furigana built from the app's own decks: no morphological
# analyzer is available server-side, so compounds already in the vocab
# deck get their real reading via a longest-match lookup, and anything
# else falls back to per-character kanji readings.

def _kata_to_hira(s: str) -> str:
    # See morphology.kata_to_hira: also resolves the katakana long-vowel
    # mark (ー) to the correct native hiragana vowel (今日's pron キョー
    # -> きょう, not きょー) — a plain per-character shift alone gets
    # that wrong, and this function is used for kanji readings sourced
    # from kanji_data.py, which are also katakana for on'yomi.
    return morphology.kata_to_hira(s)


def _reading_tokens(kana: str) -> list[str]:
    return [
        t.replace(".", "").replace("~", "")
        for t in re.split(r"[・;]", kana or "")
        if t.strip()
    ]


# Same on'yomi/kun'yomi split Readings.jsx's isOnyomiToken uses on the
# frontend (on'yomi written in katakana, kun'yomi in hiragana) — kept in
# sync deliberately so "which reading is this" agrees on both ends.
def _is_onyomi_token(token: str) -> bool:
    return any("\u30A0" <= c <= "\u30FF" for c in token)


def _build_single_kanji_readings() -> dict:
    """char -> {"on": reading|None, "kun": reading|None}.

    Previously this took whichever reading token happened to be listed
    *first* in the kanji's own combined field and used it unconditionally
    — that assumes on'yomi always comes first, which isn't reliably true
    across every entry, and produced wrong furigana for compounds like
    東京 (which fell back to 東's kun'yomi "ひがし" instead of its
    on'yomi "とう"). Keeping both readings lets the caller in
    _tokenize_furigana pick the one that actually matches how the kanji
    is being used there (compound vs. standalone — see below) instead of
    guessing from field order.
    """
    table = {}
    for _level, entries in KANJI_BY_LEVEL.items():
        for k in entries:
            char = k.get("kanji")
            if not char or char in table:
                continue
            tokens = _reading_tokens(k.get("kana", ""))
            if not tokens:
                continue
            on  = next((t for t in tokens if _is_onyomi_token(t)), None)
            kun = next((t for t in tokens if not _is_onyomi_token(t)), None)
            table[char] = {
                "on":  _kata_to_hira(on) if on else None,
                "kun": kun,
            }
    return table


def _build_vocab_readings() -> dict:
    table = {}
    # Longer entries first so the greedy tokenizer below naturally
    # prefers a full compound match over a shorter partial one.
    all_entries = [w for entries in VOCAB_BY_LEVEL.values() for w in entries]
    all_entries.sort(key=lambda w: len(w.get("kanji") or ""), reverse=True)
    for w in all_entries:
        form = w.get("kanji") or ""
        if not form or form in table or not any(_is_kanji(c) for c in form):
            continue
        readings = _readings(w.get("kana", ""))
        if readings:
            table[form] = readings[0]
    return table

def _build_meanings_readings() -> dict:
    """Extract compound readings from the JMdict-derived data (the
    app's own deck's meanings, plus the JMdict pool via SQLite).

    This gives us readings for many common compounds that aren't in the
    app's own JLPT deck — e.g. 東京 → とうきょう. Deliberately pulls only
    (kanji, kana) pairs, never the senses themselves (tags/glossary/
    examples) — those are the heavy part of the JMdict pool and are of
    no use for this table, so vocab_jmdict_data.iter_kanji_kana_pairs()
    is a dedicated lightweight query for exactly this.
    """
    table = {}
    for key in vocab_meanings_data.iter_keys():
        if "::" not in key:
            continue
        kanji, kana = key.split("::", 1)
        if not kanji or not any(_is_kanji(c) for c in kanji):
            continue
        readings = _readings(kana)
        if readings and kanji not in table:
            table[kanji] = readings[0]
    if _jmdict_db is not None:
        for kanji, kana in _jmdict_db.iter_kanji_kana_pairs():
            if kanji in table:
                continue
            readings = _readings(kana)
            if readings:
                table[kanji] = readings[0]
    return table

_SINGLE_KANJI_READING = _build_single_kanji_readings()
_VOCAB_READING = _build_vocab_readings()

# Layer JMdict meanings on top: the app's own deck takes precedence,
# but anything not covered there (place names, common compounds, etc.)
# gets a real reading instead of falling back to per-character guesswork.
_MEANINGS_READING = _build_meanings_readings()
for form, reading in _MEANINGS_READING.items():
    if form not in _VOCAB_READING:
        _VOCAB_READING[form] = reading

_MAX_VOCAB_MATCH_LEN = max((len(k) for k in _VOCAB_READING), default=1)


def _tokenize_furigana_legacy(sentence: str) -> list:
    """Fallback path used only when morphology.MORPHOLOGY_AVAILABLE is
    False — see _tokenize_furigana for the preferred, morphology-based
    path. Splits `sentence` into ordered {text, reading, start, end}
    chunks using a dictionary-substring lookup, falling back further to
    per-character kanji readings for anything not in that lookup.

    This has no way to know a kanji is being used as a conjugating
    word's stem rather than standing on its own — 上 gets its
    standalone-noun reading うえ even when it's actually the のぼ- in
    上る, because a single isolated kanji character carries no
    information about which one applies. Real tokenization (the
    morphology-based path) fixes this because it reasons about whole
    words, not characters.
    """
    segments = []
    i, n = 0, len(sentence)
    while i < n:
        ch = sentence[i]
        if _is_kanji(ch):
            match = None
            for length in range(min(_MAX_VOCAB_MATCH_LEN, n - i), 0, -1):
                candidate = sentence[i:i + length]
                reading = _VOCAB_READING.get(candidate)
                if reading:
                    match = (candidate, reading, length)
                    break
            if match:
                text, reading, length = match
                segments.append({"text": text, "reading": reading, "start": i, "end": i + length})
                i += length
                continue
            # No known compound here — consume the run of consecutive
            # kanji characters and fall back to per-character readings.
            j = i
            while j < n and _is_kanji(sentence[j]):
                j += 1
            run = sentence[i:j]
            # A multi-kanji run is almost always a jukugo compound (音読み
            # reading per character, e.g. 東京 -> とう+きょう), while a
            # single isolated kanji is far more often standing on its own
            # (訓読み, e.g. 山 -> やま) — so which reading to prefer for
            # each character depends on which situation this run is in,
            # not a fixed per-kanji default.
            is_compound = len(run) > 1
            reading_parts = []
            has_reading = False
            for c in run:
                info = _SINGLE_KANJI_READING.get(c)
                if not info:
                    reading_parts.append(c)
                    continue
                preferred = info["on"] if is_compound else info["kun"]
                picked = preferred or info["on"] or info["kun"]
                if picked:
                    has_reading = True
                    reading_parts.append(picked)
                else:
                    reading_parts.append(c)
            reading = "".join(reading_parts)
            segments.append({
                "text": run,
                "reading": reading if has_reading else None,
                "start": i, "end": j,
            })
            i = j
            continue
        j = i
        while j < n and not _is_kanji(sentence[j]):
            j += 1
        segments.append({"text": sentence[i:j], "reading": None, "start": i, "end": j})
        i = j
    return segments


def _split_morpheme_for_furigana(m) -> list:
    """One morphology.Morpheme -> up to 3 {text, reading, start, end}
    segments: a leading all-kana prefix (rare — e.g. an unglued
    particle-like prefix), the kanji-bearing core with its own derived
    reading, and a trailing all-kana suffix (the usual case: okurigana/
    conjugation tail, e.g. れ in 上れ). Splitting this way keeps furigana
    on just the kanji, matching how _tokenize_furigana_legacy's
    kanji-run segments already worked, so _annotate_sentence downstream
    doesn't need to change at all.
    """
    surface = m.surface
    start, end = m.start, m.end
    if not any(_is_kanji(c) for c in surface):
        return [{"text": surface, "reading": None, "start": start, "end": end}]

    n = len(surface)
    lead = 0
    while lead < n and not _is_kanji(surface[lead]):
        lead += 1
    tail = n
    while tail > lead and not _is_kanji(surface[tail - 1]):
        tail -= 1

    # m.reading is the hiragana reading of the WHOLE surface, as
    # inflected. Okurigana characters pronounce themselves 1:1 (each
    # kana character corresponds to exactly one mora in the reading),
    # so trimming that many characters off each end isolates the
    # kanji-bearing core's own reading — e.g. surface "上れ", reading
    # "のぼれ": 1 trailing kana character -> strip 1 -> core reading
    # "のぼ". Falls back to the untrimmed reading (better than nothing)
    # if that character-count assumption doesn't hold for some entry.
    core_reading = m.reading
    trailing_len = n - tail
    if trailing_len and len(core_reading) > trailing_len:
        core_reading = core_reading[:len(core_reading) - trailing_len]
    if lead and len(core_reading) > lead:
        core_reading = core_reading[lead:]

    out = []
    if lead:
        out.append({"text": surface[:lead], "reading": None, "start": start, "end": start + lead})
    out.append({
        "text": surface[lead:tail],
        "reading": core_reading or None,
        "start": start + lead, "end": start + tail,
    })
    if tail < n:
        out.append({"text": surface[tail:], "reading": None, "start": start + tail, "end": end})
    return out


def _tokenize_furigana_morphological(sentence: str):
    """Preferred path (see _tokenize_furigana): real per-morpheme
    furigana via morphology.tokenize instead of dictionary-substring
    guessing. Each morpheme's own reading is context-correct — a verb
    stem gets its verb reading, not its standalone-noun reading (上 in
    上れません reads のぼ, not うえ) — because a real tokenizer reasons
    about the whole word being used, not the character in isolation.
    Returns None if morphology isn't available, so the caller can fall
    back to the legacy per-character approach."""
    morphemes = morphology.tokenize(sentence)
    if morphemes is None:
        return None
    segments = []
    for m in morphemes:
        segments.extend(_split_morpheme_for_furigana(m))
    return segments


def _tokenize_furigana(sentence: str) -> list:
    """Splits `sentence` into ordered {text, reading, start, end}
    chunks. Prefers real tokenization (_tokenize_furigana_morphological)
    and falls back to the dictionary-substring approach
    (_tokenize_furigana_legacy) only if that's unavailable in this
    deploy — see morphology.py's docstring for why."""
    segments = _tokenize_furigana_morphological(sentence)
    if segments is not None:
        return segments
    return _tokenize_furigana_legacy(sentence)


def _extend_inflection_tail(sentence: str, end: int, max_extra: int = 6) -> int:
    """Consumes hiragana after `end` (an inflection tail) but stops at
    the first character that's more plausibly a following particle or
    sentence-final ending than part of the word's own conjugation."""
    max_end = min(len(sentence), end + max_extra)
    while end < max_end and _HIRAGANA_RE.match(sentence[end]):
        if sentence[end] in _BOUNDARY_HIRAGANA:
            break
        end += 1
    return end


def _find_occurrence(sentence: str, needle: str, prefer_hiragana_after: bool):
    """Index of the best occurrence of `needle` in `sentence`.

    A dictionary-form stem (e.g. "飛" stripped from 飛ぶ) can legitimately
    occur several times in one sentence for unrelated reasons — 飛行機
    just happens to start with the same character as 飛んだ, the actual
    conjugated form of the headword. Blindly taking the first match (the
    old behaviour) highlighted 飛行機 instead. When `prefer_hiragana_after`
    is set, only an occurrence immediately followed by hiragana counts —
    a real inflection tail — so an unrelated compound like 飛行機 (followed
    by the kanji 行) is skipped in favour of 飛んだ (followed by ん).
    Returns None rather than guessing if nothing qualifies.
    """
    start = 0
    while True:
        idx = sentence.find(needle, start)
        if idx == -1:
            return None
        end = idx + len(needle)
        if not prefer_hiragana_after or (end < len(sentence) and _HIRAGANA_RE.match(sentence[end])):
            return idx
        start = idx + 1


# Kanji numerals 0-9 next to their Arabic-digit spelling — a natural
# corpus sentence very often spells a date/count in digits ("2日") even
# though the app's own deck lists the word with its kanji numeral
# ("二日"). 十/百/千/万 are left out: their digit equivalent isn't a
# single fixed substring ("十" -> "10", but 二十 -> "20" not "210"),
# so a blind per-character swap would produce the wrong string.
_KANJI_DIGIT_CHARS = set("〇一二三四五六七八九")
_KANJI_DIGIT_TO_ARABIC = str.maketrans({
    "〇": "0", "一": "1", "二": "2", "三": "3", "四": "4",
    "五": "5", "六": "6", "七": "7", "八": "8", "九": "9",
})


def _arabic_numeral_variant(kanji: str) -> str | None:
    """`kanji` with any 0-9 kanji numeral swapped for its Arabic digit
    (二日 -> 2日), or None if `kanji` has no such numeral to swap."""
    if not any(c in _KANJI_DIGIT_CHARS for c in kanji):
        return None
    return kanji.translate(_KANJI_DIGIT_TO_ARABIC)


# ── Public surface-variant helpers ───────────────────────────
# Other modules that need to recognize a deck word inside arbitrary,
# already-written text (card_lookup.py's badge/stats matching over
# generated reading-practice sentences) hit the exact same "the real
# sentence doesn't spell the word exactly like the deck does" problem
# this file already solved for single-headword highlighting above.
# Exposed here so that logic lives in one place instead of being
# re-derived twice.

def numeral_variant(kanji: str) -> str | None:
    """Public wrapper around _arabic_numeral_variant — same kanji-numeral
    -> Arabic-digit swap (二日 -> 2日), for callers outside this module."""
    return _arabic_numeral_variant(kanji)


def kana_spelling_variants(kanji: str) -> list[str]:
    """All alternate spellings of `kanji` obtained by swapping one or
    more of its characters for their conventional kana spelling (see
    _KANA_CONVENTIONAL_SPELLING below), e.g. 御飯 -> ["ご飯"]. Returns
    [] if `kanji` has no character with a known kana alternative
    (nothing to vary). A word with two such characters yields every
    combination except the original all-kanji spelling; in practice
    the hand-picked list is short enough, and rarely more than one such
    character occurs in the same word, that this never grows large.
    """
    if not any(c in _KANA_CONVENTIONAL_SPELLING for c in kanji):
        return []
    options_per_char = [(ch, *_KANA_CONVENTIONAL_SPELLING.get(ch, ())) for ch in kanji]
    variants = {"".join(combo) for combo in itertools.product(*options_per_char)}
    variants.discard(kanji)
    return sorted(variants)


def is_usually_kana(kanji: str, kana: str) -> bool:
    """True if any JMdict sense for this word carries the "uk" tag
    ("word usually written using kana alone"). Used by card_lookup.py
    to decide whether it's safe to also match this word's bare kana
    reading in running text — deliberately NOT done for every
    kanji-having word, since that would risk matching unrelated
    okurigana/particles/other words that happen to spell out the same
    kana sequence; restricting it to JMdict-confirmed "usually kana"
    words keeps that risk low while fixing the common case (i-adjectives
    and verbs that are, in practice, at least as often written in
    hiragana as in kanji, e.g. 温い written ぬるい)."""
    senses = _find_senses(kanji, kana)
    if not senses:
        return False
    return any("uk" in s.get("tags", []) for s in senses)


# A handful of very common kanji that are conventionally written in
# kana in running text even though JMdict/the app's deck lists them
# with their kanji — not general enough to trust a kanji deck's own
# reading for (many kanji have a reading that's technically correct but
# never actually used to replace the kanji in practice), so this is a
# short, deliberately hand-picked list rather than every kanji with a
# known reading.
_KANA_CONVENTIONAL_SPELLING = {
    "御": ("ご", "お"), "事": ("こと",), "物": ("もの",), "時": ("とき",),
    "為": ("ため",), "様": ("よう",), "所": ("ところ",), "方": ("ほう",),
}


def _build_kana_variant_regex(kanji: str):
    """Regex matching `kanji` with any individual character optionally
    replaced by its conventional kana spelling (see
    _KANA_CONVENTIONAL_SPELLING above) — catches compounds like 御飯,
    conventionally written ご飯, where only part of the word is kana'd
    while the rest stays kanji. Returns None if no character in `kanji`
    has a known kana alternative (nothing to vary, skip this stage).
    """
    if not any(c in _KANA_CONVENTIONAL_SPELLING for c in kanji):
        return None
    parts = []
    for ch in kanji:
        alts = _KANA_CONVENTIONAL_SPELLING.get(ch)
        if alts:
            options = "|".join(re.escape(a) for a in (ch, *alts))
            parts.append(f"(?:{options})")
        else:
            parts.append(re.escape(ch))
    return re.compile("".join(parts))


def _target_span(sentence: str, kanji: str, kana: str):
    """Best-effort (start, end) of the headword itself within `sentence`."""
    if kanji:
        idx = _find_occurrence(sentence, kanji, prefer_hiragana_after=False)
        if idx is not None:
            return idx, idx + len(kanji)

        # Same word, spelled with Arabic digits instead of its kanji
        # numeral (二日 -> 2日) — very common in natural sentences.
        arabic = _arabic_numeral_variant(kanji)
        if arabic:
            idx = _find_occurrence(sentence, arabic, prefer_hiragana_after=False)
            if idx is not None:
                return idx, idx + len(arabic)

        # Same word, with one of its characters in its conventional kana
        # spelling instead of kanji (御飯 -> ご飯).
        variant_re = _build_kana_variant_regex(kanji)
        if variant_re:
            m = variant_re.search(sentence)
            if m:
                return m.start(), m.end()

        # Conjugating word (verb/i-adjective): the example rarely uses
        # the bare dictionary form. Match on the invariant kanji stem
        # (the dictionary form minus its trailing okurigana) and extend
        # through the inflection tail that follows — enough to catch
        # 出た/出ます/太かった/... without a conjugation table.
        stem = re.sub(r"[\u3040-\u309F]+$", "", kanji)
        if stem and stem != kanji:
            idx = _find_occurrence(sentence, stem, prefer_hiragana_after=True)
            if idx is not None:
                return idx, _extend_inflection_tail(sentence, idx + len(stem))

    # No kanji field, or this example uses the kana-only form of a word
    # that does have one (common for "usually kana" words) — fall back
    # to the reading itself, with the same stem+extend trick.
    for reading in _readings(kana) or ([kana] if kana else []):
        idx = _find_occurrence(sentence, reading, prefer_hiragana_after=False)
        if idx is not None:
            return idx, idx + len(reading)
        stem = reading[:-1] if len(reading) > 1 else reading
        if not stem:
            continue
        idx = _find_occurrence(sentence, stem, prefer_hiragana_after=True)
        if idx is not None:
            return idx, _extend_inflection_tail(sentence, idx + len(stem))

    # Last resort: real tokenization. Catches an example sentence that
    # spells this word with a DIFFERENT (but reading-equivalent) kanji
    # than this card uses — e.g. a card for 登る(のぼる) whose tagged
    # example actually reads 上れません: 上る is a distinct dictionary
    # headword from 登る, so no amount of matching against THIS card's
    # own kanji spelling would ever find it, but the two share the
    # exact same reading. JMdict/Tatoeba's example-to-headword tagging
    # isn't always literal-text-exact about which of several synonymous
    # kanji spellings a sentence happens to use, so this tier trusts a
    # real tokenizer's own per-token reading to recognize the
    # equivalence instead of insisting on this card's exact kanji.
    # `auxiliary_use` is excluded for the same reason card_lookup.py's
    # _resolve_kana excludes it: reading alone can't tell 要る from
    # 居る (both いる), and 居る-as-~ている-progressive-marker is common
    # enough in ordinary text that trusting reading equivalence there
    # would misidentify that marker as an unrelated card's headword.
    target_readings = set(_readings(kana) or ([kana] if kana else []))
    if target_readings:
        for m in morphology.tokenize(sentence) or []:
            if m.auxiliary_use or m.pos not in ("verb", "adjective", "noun"):
                continue
            if not any(_is_kanji(c) for c in m.surface):
                continue
            if m.lemma_reading in target_readings:
                return m.start, m.end
    return None


def _expand_furigana(text: str, reading: str | None, highlight: bool) -> list:
    """One segment -> one-or-more {text, reading, highlight}.

    _tokenize_furigana hands back one reading per morpheme/run, so a
    multi-kanji core (心配 -> しんぱい) would render as a single <ruby>
    spanning both characters. study.furigana.align_deck is the same
    per-kanji splitter the vocab screen's indice_3 hint already uses
    (rendaku/gemination-aware); reusing it here instead of the frontend's
    weaker anchor-only split means an example sentence divides furigana
    exactly like the flashcard for the same word does. Falls back to the
    single block when it can't divide, same as align_deck always does.
    """
    if not reading or len(text) < 2:
        return [{"text": text, "reading": reading, "highlight": highlight}]
    parts = align_deck(text, reading)
    if len(parts) < 2:
        return [{"text": text, "reading": reading, "highlight": highlight}]
    return [{"text": p["text"], "reading": p.get("reading"), "highlight": highlight} for p in parts]


def _annotate_sentence(sentence: str, kanji: str, kana: str) -> list:
    span = _target_span(sentence, kanji, kana)
    segments = _tokenize_furigana(sentence)
    if not span:
        out = []
        for seg in segments:
            out.extend(_expand_furigana(seg["text"], seg["reading"], False))
        return out

    span_start, span_end = span
    out = []
    for seg in segments:
        s_start, s_end = seg["start"], seg["end"]
        if s_end <= span_start or s_start >= span_end:
            out.extend(_expand_furigana(seg["text"], seg["reading"], False))
            continue
        if seg["reading"] is not None:
            # Kanji run carrying its own furigana — splitting it mid-way
            # would break the ruby annotation, and in practice a kanji
            # run's own boundaries already line up with the matched span
            # (both come from the same "run of consecutive kanji" logic),
            # so it's either fully inside the span or not overlapping at
            # all; keep it whole either way. _expand_furigana still
            # divides it per-kanji — just never at the span's own edge.
            out.extend(_expand_furigana(seg["text"], seg["reading"], True))
            continue
        # Plain kana run: _tokenize_furigana merges every consecutive
        # non-kanji character into one segment regardless of word
        # boundaries, so a conjugated word written entirely in kana
        # (e.g. 会う -> あった) can land in the middle of a run that also
        # contains neighbouring particles (に...のを). Slice out exactly
        # the overlapping portion so only the headword itself lights up,
        # not the whole run it happens to sit inside.
        local_start = max(s_start, span_start) - s_start
        local_end = min(s_end, span_end) - s_start
        text = seg["text"]
        if local_start > 0:
            out.append({"text": text[:local_start], "reading": None, "highlight": False})
        out.append({"text": text[local_start:local_end], "reading": None, "highlight": True})
        if local_end < len(text):
            out.append({"text": text[local_end:], "reading": None, "highlight": False})
    return out


def get_vocab_extras(kanji: str, kana: str, meaning_hint: str = "", lang: str = "fr") -> dict:
    all_senses = _find_senses(kanji, kana)
    if not all_senses:
        return {"tags": [], "senses": [], "examples": []}

    senses = all_senses[:_MAX_SENSES]
    primary_ids = {id(s) for s in _select_primary(senses, meaning_hint)}
    numbers = {id(s): i for i, s in enumerate(senses, start=1)}

    senses_out = [
        {
            "number": numbers[id(sense)],
            "primary": id(sense) in primary_ids,
            "glossary": "; ".join(sense.get("glossary", [])),
            "tags": _collect_sense_tags(sense, lang),
        }
        for sense in senses
    ]

    # Examples: primary sense(s) first, then the rest in their original
    # order, so the sentence matching the app's own gloss shows up first.
    ordered = [s for s in senses if id(s) in primary_ids] + [s for s in senses if id(s) not in primary_ids]
    examples = []
    seen_jp = set()
    for sense in ordered:
        num = numbers[id(sense)]
        gloss = "; ".join(sense.get("glossary", []))
        for ex in sense.get("examples", []):
            jp = ex.get("jp")
            if not jp or jp in seen_jp:
                continue
            seen_jp.add(jp)
            examples.append({
                "jp": jp,
                "en": ex.get("en", ""),
                "segments": _annotate_sentence(jp, kanji, kana),
                "sense_number": num,
                "sense_glossary": gloss,
            })
            if len(examples) >= _MAX_EXAMPLES:
                break
        if len(examples) >= _MAX_EXAMPLES:
            break

    return {
        "tags": _collect_word_tags(senses, lang),
        "senses": senses_out,
        "examples": examples,
    }