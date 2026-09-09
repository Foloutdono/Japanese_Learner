"""Thematic vocab decks and their four frequency levels.

A theme used to be one flat list of ~220 words, ~190 of them archaic
padding a quota (蒲桜, 波波迦, 樋殿), drawn in random order. It is now a
short curated list cut into basic/medium/advanced/expert by frequency and
served commonest-first. Nothing tested any of it.

The invariant these exist to protect, above all the others, is that a
theme is a GROUPING and never a second copy: the same word studied under
"Fruits · 基本", under "N4" and under "Top 200" has to be one SRS card, or
a learner's progress silently forks in three.
"""

import pytest

from content import frequency_data as freq, theme_data
from core.auth import DEV_USER_ID
from study import modes

MODE = "vocab.flashcard.f2b"
VOCAB_MODES = [d["key"] for d in modes.describe()
               if str(d.get("key", "")).startswith("vocab.")]
THEMES = [t["key"] for t in theme_data.list_themes()]


@pytest.fixture(autouse=True)
def _fresh_batches():
    """The new-card batch cache is a module-level dict shared by the whole
    process, and it refills from the same pool when it runs dry — so one
    test asking for more cards than a band holds leaves the next test
    reading a half-consumed, wrapped-around batch. Clear it per test so
    the ordering assertions mean what they say."""
    from srs import batch_cache
    batch_cache.reset()
    yield
    batch_cache.reset()


# ---------------------------------------------------------------- data


def test_there_are_themes_and_they_are_not_the_old_padded_lists():
    """Every theme used to hold exactly 220 JMdict words plus whatever the
    deck contributed, because MAX_JMDICT_PER_THEME was a quota to fill
    rather than a ceiling to respect. A theme back near that size means
    the quota is back."""
    assert len(THEMES) >= 30
    for theme in THEMES:
        rows = theme_data.theme_entries(theme)
        assert 4 <= len(rows) < 150, f"{theme} has {len(rows)} words"


@pytest.mark.parametrize("theme", THEMES)
def test_every_theme_has_all_four_levels(theme):
    entry = next(t for t in theme_data.list_themes() if t["key"] == theme)
    assert [lv["level"] for lv in entry["levels"]] == list(theme_data.LEVELS)
    assert all(lv["count"] > 0 for lv in entry["levels"]), entry
    assert sum(lv["count"] for lv in entry["levels"]) == entry["count"]


@pytest.mark.parametrize("theme", THEMES)
def test_a_level_is_a_contiguous_slice_of_its_theme(theme):
    """The four bands concatenated must BE the theme, in order. If they
    ever overlap or leave a gap, a word becomes unreachable from the UI
    while still being counted on the ladder."""
    whole = theme_data.theme_entries(theme)
    stacked = []
    for level in theme_data.LEVELS:
        stacked.extend(theme_data.theme_entries(theme, level))
    assert [e["card_id"] for e in stacked] == [e["card_id"] for e in whole]


@pytest.mark.parametrize("theme", THEMES)
def test_the_bands_grow(theme):
    """Basic is the short high-value starter set and expert the long
    tail, never the other way round."""
    sizes = [len(theme_data.theme_entries(theme, lv)) for lv in theme_data.LEVELS]
    assert sizes == sorted(sizes), sizes


@pytest.mark.parametrize("theme", THEMES)
def test_words_arrive_commonest_first_and_basic_is_easier_than_expert(theme):
    """The levels only mean anything if the underlying order is by
    frequency. Checked through the shipped data rather than recomputing
    the score, so a rebuild that sorted by something else fails here."""
    import json, os
    path = os.path.join(os.path.dirname(theme_data.__file__), "..", "datas", "vocab", "theme_words.json")
    with open(path, encoding="utf-8") as f:
        rows = json.load(f)[theme]
    scores = [r["score"] for r in rows]
    assert scores == sorted(scores), theme
    assert [r["rank"] for r in rows] == list(range(1, len(rows) + 1))
    basic = [r["score"] for r in rows if r["level"] == "basic"]
    expert = [r["score"] for r in rows if r["level"] == "expert"]
    assert max(basic) <= min(expert)


@pytest.mark.parametrize("theme", THEMES)
def test_a_theme_never_repeats_a_word_or_a_meaning(theme):
    """Two rows sharing a surface (鼠/ねずみ beside 鼠/ねず) or a gloss
    ("kitchen" nine times over in `rooms`) make the meaning->word
    direction unanswerable and collapse the MCQ distractors, which
    study/mcq.py dedupes by meaning.

    Checked through the BUILD's own key, not a plain lowercase compare:
    an exact-string test passes happily on 劇場 "theatre" beside シアター
    "theater", 靴 "shoe, shoes" beside シューズ "shoes", and 店舗 "shop,
    store" beside 店 "store, shop" — all three of which shipped."""
    from scripts.build_theme_db import gloss_keys

    rows = theme_data.theme_entries(theme)
    surfaces = [e["kanji"] or e["kana"] for e in rows]
    assert len(set(surfaces)) == len(surfaces)

    heads, key_sets = [], []
    for e in rows:
        head, keys = gloss_keys(e["meaning"])
        heads.append(head)
        key_sets.append(keys)
    assert len(set(heads)) == len(heads), \
        sorted(h for h in heads if heads.count(h) > 1)
    assert len(set(key_sets)) == len(key_sets)


@pytest.mark.parametrize("theme", THEMES)
def test_every_row_resolves_to_a_real_card(theme):
    """theme_entries skips a row it cannot resolve, so a rebuild against a
    changed pool would quietly shrink a band with nothing noticing. Count
    the raw rows and the resolved ones and insist they match."""
    import json, os
    path = os.path.join(os.path.dirname(theme_data.__file__), "..", "datas", "vocab", "theme_words.json")
    with open(path, encoding="utf-8") as f:
        raw = json.load(f)[theme]
    assert len(theme_data.theme_entries(theme)) == len(raw)


@pytest.mark.parametrize("theme", THEMES)
def test_a_card_id_does_not_depend_on_the_theme_or_the_level(theme):
    """THE invariant. A theme card's id must be the id frequency_data
    would produce for that word on its own, so studying 桃 under
    "Fruits · 基本" advances the same card as studying it under N3."""
    for entry in theme_data.theme_entries(theme):
        key = f"{entry['kanji']}::{entry['kana']}"
        assert entry["card_id"] == freq.to_id(entry["domain"], key)


def test_the_two_meanings_of_level_stay_apart():
    """`level` is the word's native JLPT level and drives the card's
    LevelBadge; `theme_level` is which band it was sorted into. They are
    different things on the same row and renaming either to the other
    relabels every card."""
    rows = theme_data.theme_entries("fruits")
    assert {e["theme_level"] for e in rows} <= set(theme_data.LEVELS)
    assert {e["level"] for e in rows} <= {"N5", "N4", "N3", "N2", "N1", None}


def test_has_theme_distinguishes_missing_from_empty():
    assert theme_data.has_theme("fruits")
    assert not theme_data.has_theme("definitely-not-a-theme")


# --------------------------------------------------------------- route


def test_the_theme_list_carries_per_level_counts(client):
    body = client.get("/api/themes").json()
    assert body["themes"] == theme_data.list_themes()
    assert all("levels" in t for t in body["themes"])


def test_a_level_serves_only_its_own_words(client):
    for level in theme_data.LEVELS:
        want = {e["card_id"] for e in theme_data.theme_entries("animals", level)}
        body = client.get("/api/vocab/theme/animals/cards",
                          params={"level": level, "mode": MODE, "count": 25}).json()
        assert body["cards"], level
        assert {c["card_id"] for c in body["cards"]} <= want


def test_omitting_the_level_still_serves_the_whole_theme(client):
    """The level is optional so every pre-level client keeps working."""
    whole = {e["card_id"] for e in theme_data.theme_entries("animals")}
    body = client.get("/api/vocab/theme/animals/cards",
                      params={"mode": MODE, "count": 25}).json()
    assert body["cards"]
    assert {c["card_id"] for c in body["cards"]} <= whole


def _is_subsequence(got, order):
    """`got` appears in `order`, in order — the assertion that survives
    whatever the user has already reviewed."""
    it = iter(order)
    return all(item in it for item in got)


def test_get_new_cards_can_preserve_the_callers_order(client):
    """srs.get_new_cards ends `ORDER BY random()` by default and that is
    right for a level or a deck, where the pool is one undifferentiated
    bag. `ordered=True` is what themes need."""
    from core.srs_instance import srs
    from core.auth import prefixed

    ids = prefixed([e["card_id"] for e in theme_data.theme_entries("animals", "basic")],
                   DEV_USER_ID)
    got = srs.get_new_cards(MODE, limit=len(ids), card_ids=ids, ordered=True)
    assert _is_subsequence(got, ids)
    assert len(got) > 1, "need more than one new card for this to mean anything"


def test_a_theme_session_introduces_its_words_commonest_first(client):
    """The end-to-end version, through the route. This is the bug the
    learner actually saw: the ordering theme_data computed was discarded
    downstream, so opening Fruits was as likely to hand over マンゴー as
    りんご."""
    band = [e["card_id"] for e in theme_data.theme_entries("animals", "medium")]
    # Never ask for more than the band holds: batch_cache.take_batch
    # refills from the same pool when it runs dry, so an over-large
    # request cycles the band and hands out repeats. Pre-existing, and
    # true of any small pool (a short deck, a thin tier) — the client
    # asks for ten at a time and de-dupes by card_id in useCardSession.
    body = client.get("/api/vocab/theme/animals/cards",
                      params={"level": "medium", "mode": MODE, "count": len(band)}).json()
    got = [c["card_id"] for c in body["cards"]]
    assert len(got) > 1
    assert _is_subsequence(got, band), (got, band)


def test_an_unknown_theme_is_a_404_not_a_200_saying_done(client):
    """A 200 carrying {"error": ...} reached the run screen as
    `data.cards ?? []` — indistinguishable from an exhausted deck — and
    fired the completion fanfare for a typo."""
    for path in ("card", "cards", "stats"):
        r = client.get(f"/api/vocab/theme/not-a-theme/{path}", params={"mode": MODE})
        assert r.status_code == 404, path


def test_an_unknown_level_is_refused(client):
    for path in ("card", "cards", "stats"):
        r = client.get(f"/api/vocab/theme/animals/{path}",
                       params={"level": "impossible", "mode": MODE})
        assert r.status_code == 400, path


def test_stats_are_scoped_to_the_level(client):
    """The four bands' totals add up to the whole theme's, for a mode
    that filters nothing out."""
    whole = client.get("/api/vocab/theme/animals/stats",
                       params={"mode": MODE}).json()
    parts = [
        client.get("/api/vocab/theme/animals/stats",
                   params={"level": lv, "mode": MODE}).json()
        for lv in theme_data.LEVELS
    ]
    assert sum(p["total"] for p in parts) == whole["total"]


def test_a_card_carries_the_band_it_came_from(client):
    body = client.get("/api/vocab/theme/animals/cards",
                      params={"level": "basic", "mode": MODE, "count": 5}).json()
    assert all(c["theme_level"] == "basic" for c in body["cards"])


def test_every_mode_the_ui_offers_can_serve_the_smallest_band(client):
    """vocab.word_reading drops kana-only words, so a small band of
    loanwords can filter to nothing. That is an empty session, not an
    error — the endpoint must still answer 200."""
    assert VOCAB_MODES, "no vocab modes found — modes.describe() shape changed"
    for mode in VOCAB_MODES:
        r = client.get("/api/vocab/theme/fruits/cards",
                       params={"level": "expert", "mode": mode, "count": 5})
        assert r.status_code == 200, (mode, r.text)
        assert "cards" in r.json()
