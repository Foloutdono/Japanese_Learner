"""
Frequency-tier system: an alternative axis to the JLPT N5-N1 levels for
picking what to study — "the 200 most frequent kanji/vocab", "201-400",
and so on — instead of "N5".

IMPORTANT: for the "kanji" and "vocab" domains, this reuses the exact
same deck entries as kanji_data.py / vocab_data.py, and generates card
IDs the exact same way (kanji_to_id/vocab_to_id, keyed by each entry's
*native* JLPT level). That's deliberate: a kanji studied via "Top 200"
and the same kanji studied via "N5" must be the SAME SRS card, not two
separate progress tracks. Tiers are just a different ordering/grouping
over the same underlying deck, never a second copy of it.

The third domain, "vocab_jmdict", is different on purpose: it's every
JMdict word OUTSIDE the app's own curated deck (see
vocab_jmdict_data.py) — there's no JLPT level to unify with, so it
gets its own id namespace (vocab_jmdict_to_id) and its own frequency
order entirely.

MEMORY NOTE (2026-08): "vocab_jmdict" is also handled differently from
"kanji"/"vocab" at the code level now, not just conceptually. The other
two domains are a few thousand entries each — fine to keep as plain
in-memory lists/dicts, exactly as before. vocab_jmdict is 292,848
entries: keeping its order list + resolution dict in RAM was a large
share of what pushed a 512 MB deploy over budget. It's now backed by
datas/vocab/vocab_jmdict.sqlite3 (indexed on freq_rank and on
kanji/kana) via vocab_jmdict_data.py, queried on demand instead of
loaded wholesale. Every public function below still returns the same
shapes for all three domains — callers (frequency.py) don't need to
know which domain is DB-backed.

Standard order source files (sit next to kanji_deck.json etc. under
datas/kanji/ and datas/vocab/):

  kanji_frequency.json         Real KANJIDIC2 newspaper-frequency
                                ranking, built by
                                build_frequency_index.py. Solid data:
                                2106 of the deck's 2211 kanji have a
                                genuine rank; the rest are appended in
                                JLPT order.

  vocab_frequency.json         PLACEHOLDER as of this writing — plain
                                JLPT deck order (N5 -> N1). Ranking the
                                deck's own words for real needs the
                                same JMdict frequency-tag matching
                                vocab_jmdict_frequency.json now does
                                for the non-deck pool (see
                                build_vocab_jmdict.py) — swap this file
                                once that's run against the deck too;
                                nothing here needs to change, this
                                module just reads whatever order is in
                                the file.

  vocab_jmdict.sqlite3         Real JMdict-priority-based ranking (news-
                                frequency rank + ichi/spec/gai common-
                                word tags + the "⭐" flag) for every
                                word OUTSIDE the deck, built by
                                build_jmdict_db.py from JMdict-priority
                                data. Same "not a real corpus analysis"
                                caveat as kanji_frequency.json's
                                KANJIDIC2 data — it's JMdict's own
                                editorial priority signal, not a fresh
                                frequency study. `freq_rank` is a
                                column on the `entries` table, indexed.

Per-user customization is layered on top via frequency_store.py rather
than baked into a per-user copy of the order — see that module for the
override model and its "swap this in-memory placeholder for a real
persistence layer" caveat.
"""
import json
import os
from math import ceil

from content.kanji_data import KANJI_BY_LEVEL, kanji_to_id
from content.vocab_data import VOCAB_BY_LEVEL, vocab_to_id
import content.vocab_jmdict_data as jmdict_db
from content.vocab_jmdict_data import vocab_jmdict_key, vocab_jmdict_to_id

DEFAULT_TIER_SIZE = 200

# Overrides (see frequency_store.py) are always interpreted as tier
# numbers under THIS tier size, regardless of what tier_size a given
# /tiers or /tier/N/... request asks for. Requesting a different
# tier_size still re-buckets the standard order correctly; it just means
# an override's tier number won't line up 1:1 with the custom bucket
# boundaries. Documented limitation, not a bug — see frequency_store.py.
# One level up: this module now lives in a package, and datas/
# is still at the backend root.
_BASE_DIR = os.path.dirname(os.path.dirname(__file__))
_KANJI_DIR = os.path.join(_BASE_DIR, "datas", "kanji")
_VOCAB_DIR = os.path.join(_BASE_DIR, "datas", "vocab")

with open(os.path.join(_KANJI_DIR, "kanji_frequency.json"), encoding="utf-8") as f:
    KANJI_FREQUENCY_ORDER: list[str] = json.load(f)

with open(os.path.join(_VOCAB_DIR, "vocab_frequency.json"), encoding="utf-8") as f:
    VOCAB_FREQUENCY_ORDER: list[str] = json.load(f)

# vocab_jmdict has no in-memory order list anymore — see module docstring.
VALID_DOMAINS = {"kanji", "vocab", "vocab_jmdict"}


def _build_kanji_resolution():
    """char -> (native_level, entry), first occurrence wins (N5 -> N1)."""
    resolved = {}
    for level in ("N5", "N4", "N3", "N2", "N1"):
        for entry in KANJI_BY_LEVEL.get(level, []):
            resolved.setdefault(entry["kanji"], (level, entry))
    return resolved


def _build_vocab_resolution():
    """"kanji::kana" -> (native_level, entry), first occurrence wins."""
    resolved = {}
    for level in ("N5", "N4", "N3", "N2", "N1"):
        for entry in VOCAB_BY_LEVEL.get(level, []):
            key = f"{entry.get('kanji', '')}::{entry.get('kana', '')}"
            resolved.setdefault(key, (level, entry))
    return resolved


_KANJI_RESOLUTION = _build_kanji_resolution()
_VOCAB_RESOLUTION = _build_vocab_resolution()

_DOMAIN_ORDER = {
    "kanji": KANJI_FREQUENCY_ORDER,
    "vocab": VOCAB_FREQUENCY_ORDER,
    # vocab_jmdict deliberately absent — DB-backed, see below.
}
_DOMAIN_RESOLUTION = {
    "kanji": _KANJI_RESOLUTION,
    "vocab": _VOCAB_RESOLUTION,
}
_DOMAIN_TO_ID = {
    "kanji": kanji_to_id,
    "vocab": vocab_to_id,
    "vocab_jmdict": vocab_jmdict_to_id,
}


def _split_key(key: str) -> tuple[str, str]:
    kanji, _, kana = key.partition("::")
    return kanji, kana


def standard_order(domain: str) -> list[str]:
    """Full ordered key list. For "vocab_jmdict" this materializes all
    292k keys from the DB — fine for one-off/admin use, but callers on
    a hot path should prefer domain_count()/get_by_rank_range() instead
    of calling this for that domain (see get_tiers below, which no
    longer does)."""
    if domain == "vocab_jmdict":
        rows = jmdict_db.get_by_rank_range(0, jmdict_db.count() - 1)
        return [vocab_jmdict_key(e) for e in rows]
    return _DOMAIN_ORDER[domain]


def domain_count(domain: str) -> int:
    """Total number of items in a domain — the DB-backed equivalent of
    len(standard_order(domain)), without materializing the full list
    for vocab_jmdict."""
    if domain == "vocab_jmdict":
        return jmdict_db.count()
    return len(_DOMAIN_ORDER[domain])


def resolve(domain: str, key: str):
    """key -> (native_level, entry), or None if the key isn't in the deck
    (shouldn't happen for anything coming out of standard_order(), but
    override keys are user-supplied — see frequency_store.py — so this
    can legitimately miss for a typo'd/stale key)."""
    if domain == "vocab_jmdict":
        kanji, kana = _split_key(key)
        entry = jmdict_db.get_by_key(kanji, kana)
        return (None, entry) if entry is not None else None
    return _DOMAIN_RESOLUTION[domain].get(key)


def to_id(domain: str, key: str) -> str | None:
    resolved = resolve(domain, key)
    if resolved is None:
        return None
    level, entry = resolved
    return _DOMAIN_TO_ID[domain](entry, level)


def standard_tier_of(domain: str, key: str, tier_size: int = DEFAULT_TIER_SIZE) -> int | None:
    if domain == "vocab_jmdict":
        kanji, kana = _split_key(key)
        entry = jmdict_db.get_by_key(kanji, kana)
        if entry is None:
            return None
        return entry["freq_rank"] // tier_size + 1
    order = _DOMAIN_ORDER[domain]
    try:
        rank = order.index(key)  # O(n); fine at deck scale (a few thousand items)
    except ValueError:
        return None
    return rank // tier_size + 1


def tier_count(domain: str, tier_size: int = DEFAULT_TIER_SIZE) -> int:
    return max(1, ceil(domain_count(domain) / tier_size))


def tier_bounds(tier: int, tier_size: int = DEFAULT_TIER_SIZE) -> tuple[int, int]:
    """1-indexed tier -> (start_rank, end_rank), both 1-indexed inclusive."""
    start = (tier - 1) * tier_size + 1
    end = tier * tier_size
    return start, end


def _tier_keys_jmdict(tier: int, tier_size: int, overrides: dict[str, int]) -> list[str]:
    """DB-backed equivalent of tier_keys() for vocab_jmdict: fetches
    only the rank range for this tier (indexed, ~tier_size rows) plus
    whichever override keys point INTO this tier from elsewhere —
    never touches the other ~292k rows outside those two small sets."""
    start, end = tier_bounds(tier, tier_size)
    base_rows = jmdict_db.get_by_rank_range(start - 1, end - 1)

    keyed_rank = []  # (freq_rank, key) so the result stays frequency-ordered
    base_keys = set()
    for e in base_rows:
        key = vocab_jmdict_key(e)
        base_keys.add(key)
        target = overrides.get(key)
        if target is None or target == tier:
            keyed_rank.append((e["freq_rank"], key))

    for key, target in overrides.items():
        if target != tier or key in base_keys:
            continue
        kanji, kana = _split_key(key)
        entry = jmdict_db.get_by_key(kanji, kana)
        if entry is not None:
            keyed_rank.append((entry["freq_rank"], key))

    keyed_rank.sort()
    return [key for _, key in keyed_rank]


def tier_keys(domain: str, tier: int, tier_size: int = DEFAULT_TIER_SIZE, overrides: dict[str, int] | None = None) -> list[str]:
    """
    Every key that effectively belongs to `tier` — its standard
    frequency-rank slot, UNLESS a user override moves it elsewhere (see
    frequency_store.py). Overrides are always tier numbers under
    DEFAULT_TIER_SIZE (see module docstring); pulling a custom
    `tier_size` here still works, it just means override-affected items
    may sit slightly off from where their override "intended" them if
    tier_size != DEFAULT_TIER_SIZE.
    """
    overrides = overrides or {}
    if domain == "vocab_jmdict":
        return _tier_keys_jmdict(tier, tier_size, overrides)

    order = _DOMAIN_ORDER[domain]
    start, end = tier_bounds(tier, tier_size)
    standard_slice = set(order[start - 1:end]) if start <= len(order) else set()

    keys = []
    for key in order:
        target = overrides.get(key)
        if target is not None:
            if target == tier:
                keys.append(key)
        elif key in standard_slice:
            keys.append(key)
    return keys
