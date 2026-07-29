"""
Frequency-tier system: an alternative axis to the JLPT N5-N1 levels for
picking what to study — "the 200 most frequent kanji/vocab", "201-400",
and so on — instead of "N5".

IMPORTANT: this reuses the exact same deck entries as kanji_data.py /
vocab_data.py, and generates card IDs the exact same way
(kanji_to_id/vocab_to_id, keyed by each entry's *native* JLPT level).
That's deliberate: a kanji studied via "Top 200" and the same kanji
studied via "N5" must be the SAME SRS card, not two separate progress
tracks. Tiers are just a different ordering/grouping over the same
underlying deck, never a second copy of it.

Standard order source files (sit next to kanji_deck.json etc. under
datas/kanji/):

  kanji_frequency.json   Real KANJIDIC2 newspaper-frequency ranking,
                          built by build_frequency_index.py. Solid data:
                          2106 of the deck's 2211 kanji have a genuine
                          rank; the rest are appended in JLPT order.

  vocab_frequency.json   PLACEHOLDER as of this writing — plain JLPT
                          deck order (N5 -> N1), because ranking vocab
                          needs it matched against JMdict's frequency
                          tags first (build_vocab_meanings.py, then
                          build_vocab_frequency.py). Swap the file once
                          you've run that against the full 53-file
                          JMdict dump; nothing here needs to change,
                          this module just reads whatever order is in
                          the file.

Per-user customization is layered on top via frequency_store.py rather
than baked into a per-user copy of the order — see that module for the
override model and its "swap this in-memory placeholder for a real
persistence layer" caveat.
"""
import json
import os
from math import ceil

from kanji_data import KANJI_BY_LEVEL, kanji_to_id
from vocab_data import VOCAB_BY_LEVEL, vocab_to_id

DEFAULT_TIER_SIZE = 200

# Overrides (see frequency_store.py) are always interpreted as tier
# numbers under THIS tier size, regardless of what tier_size a given
# /tiers or /tier/N/... request asks for. Requesting a different
# tier_size still re-buckets the standard order correctly; it just means
# an override's tier number won't line up 1:1 with the custom bucket
# boundaries. Documented limitation, not a bug — see frequency_store.py.
_BASE_DIR = os.path.dirname(__file__)
_KANJI_DIR = os.path.join(_BASE_DIR, "datas", "kanji")
_VOCAB_DIR = os.path.join(_BASE_DIR, "datas", "vocab")

with open(os.path.join(_KANJI_DIR, "kanji_frequency.json"), encoding="utf-8") as f:
    KANJI_FREQUENCY_ORDER: list[str] = json.load(f)

with open(os.path.join(_VOCAB_DIR, "vocab_frequency.json"), encoding="utf-8") as f:
    VOCAB_FREQUENCY_ORDER: list[str] = json.load(f)


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

_DOMAIN_ORDER = {"kanji": KANJI_FREQUENCY_ORDER, "vocab": VOCAB_FREQUENCY_ORDER}
_DOMAIN_RESOLUTION = {"kanji": _KANJI_RESOLUTION, "vocab": _VOCAB_RESOLUTION}
_DOMAIN_TO_ID = {"kanji": kanji_to_id, "vocab": vocab_to_id}

VALID_DOMAINS = set(_DOMAIN_ORDER)


def standard_order(domain: str) -> list[str]:
    return _DOMAIN_ORDER[domain]


def resolve(domain: str, key: str):
    """key -> (native_level, entry), or None if the key isn't in the deck
    (shouldn't happen for anything coming out of standard_order(), but
    override keys are user-supplied — see frequency_store.py — so this
    can legitimately miss for a typo'd/stale key)."""
    return _DOMAIN_RESOLUTION[domain].get(key)


def to_id(domain: str, key: str) -> str | None:
    resolved = resolve(domain, key)
    if resolved is None:
        return None
    level, entry = resolved
    return _DOMAIN_TO_ID[domain](entry, level)


def standard_tier_of(domain: str, key: str, tier_size: int = DEFAULT_TIER_SIZE) -> int | None:
    order = _DOMAIN_ORDER[domain]
    try:
        rank = order.index(key)  # O(n); fine at deck scale (a few thousand items)
    except ValueError:
        return None
    return rank // tier_size + 1


def tier_count(domain: str, tier_size: int = DEFAULT_TIER_SIZE) -> int:
    return max(1, ceil(len(_DOMAIN_ORDER[domain]) / tier_size))


def tier_bounds(tier: int, tier_size: int = DEFAULT_TIER_SIZE) -> tuple[int, int]:
    """1-indexed tier -> (start_rank, end_rank), both 1-indexed inclusive."""
    start = (tier - 1) * tier_size + 1
    end = tier * tier_size
    return start, end


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
    order = _DOMAIN_ORDER[domain]
    overrides = overrides or {}
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