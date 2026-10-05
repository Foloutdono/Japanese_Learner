"""
教順 — the order a deck's new cards are taught in (plan 186a).

New cards were a random draw: `srs.get_new_cards` shuffled whatever pool
it was handed, so the day's ration and every section run dealt an N5
learner 〜なければなりません or 郵便局 on day one as readily as は or 駅.
The decks already carry an order worth keeping, or have one beside them:

- grammar: `content/grammar/N*.json` is written in the order the level
  teaches it (です／だ, は, が, を, に…), so deck order is the order;
- kana: the syllabary's own order, which deck order also is;
- vocab: the subtitle-corpus ranking in `vocab_frequency.json` (plan
  109), commonest first -- the deck file's own order is arbitrary
  (毎月, 太い, 五日…);
- kanji: KANJIDIC2's newspaper ranking in `kanji_frequency.json`, the
  deck file's order being arbitrary too (土 山 先 三…).

A card the ranking does not name keeps its deck position after every
ranked one, so no card is ever dropped by being unranked. Callers pass
the result to `get_new_cards(..., ordered=True)`.
"""
from functools import lru_cache

from content.frequency_data import KANJI_FREQUENCY_ORDER, VOCAB_FREQUENCY_ORDER
from study import card_index
from study.modes import KANJI, VOCAB

_RANKS = {
    VOCAB: {key: i for i, key in enumerate(VOCAB_FREQUENCY_ORDER)},
    KANJI: {char: i for i, char in enumerate(KANJI_FREQUENCY_ORDER)},
}


def _key(source: str, entry: dict) -> str:
    """The entry as the ranking names it: "kanji::kana" for a word (the
    deck key `frequency_data` resolves), the character for a kanji."""
    if source == VOCAB:
        return f"{entry.get('kanji', '')}::{entry.get('kana', '')}"
    return entry.get("kanji", "")


def rank(source: str, raw_id: str) -> int:
    """Where `raw_id` stands in its source's ranking, lower first. Kana,
    grammar and anything the ranking does not name all rank alike, so a
    stable sort by this keeps their deck order. Sort a route's pool by
    it, rather than its ids, to keep entries and ids together."""
    ranks = _RANKS.get(source)
    if ranks is None:
        return 0
    entry = card_index.entry_for(source, raw_id)
    if entry is None:
        return len(ranks)
    return ranks.get(_key(source, entry), len(ranks))


def in_order(source: str, raw_ids: list[str]) -> list[str]:
    """`raw_ids` (one source's card ids) in teaching order: kana and
    grammar as given -- their deck order is the order -- and vocab and
    kanji by rank, unranked last in the order given."""
    return sorted(raw_ids, key=lambda raw_id: rank(source, raw_id))


@lru_cache(maxsize=None)
def _deck(source: str, deck_key: str, mode_key: str) -> tuple[str, ...]:
    return tuple(in_order(source, card_index.raw_ids(source, deck_key, mode_key)))


def raw_ids(source: str, deck_key: str, mode_key: str) -> list[str]:
    """`card_index.raw_ids` in teaching order: every card this mode can
    serve from this deck, the first one to teach first. Computed once a
    deck -- the content is static."""
    return list(_deck(source, deck_key, mode_key))
