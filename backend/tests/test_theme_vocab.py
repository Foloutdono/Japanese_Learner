"""Thematic vocab decks and their four levels.

A theme used to be one flat list of ~220 words, ~190 of them archaic
padding a quota (蒲桜, 波波迦, 樋殿), drawn in random order; then a list
matched by gloss and cut into four bands by newspaper frequency, which
made 梅 a basic fruit and バナナ an advanced one. It is now written by
hand (content/theme_lists.py): basic/medium/advanced/expert placed on a
difficulty scale inside the theme and served easiest-first.

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
def test_every_band_is_a_real_step(theme):
    """A band of one or two words is not a level a learner can study."""
    sizes = [len(theme_data.theme_entries(theme, lv)) for lv in theme_data.LEVELS]
    assert min(sizes) >= 5, sizes


def _shipped(theme=None):
    import json, os
    path = os.path.join(os.path.dirname(theme_data.__file__), "..", "datas", "vocab", "theme_words.json")
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    return data if theme is None else data[theme]


@pytest.mark.parametrize("theme", THEMES)
def test_words_arrive_easiest_first(theme):
    """The ranks run 1..n and the levels never step back down, so the
    whole theme served in order walks basic to expert."""
    rows = _shipped(theme)
    assert [r["rank"] for r in rows] == list(range(1, len(rows) + 1))
    order = [theme_data.LEVELS.index(r["level"]) for r in rows]
    assert order == sorted(order), theme


def test_the_shipped_json_is_what_the_lists_build():
    """theme_words.json is built from content/theme_lists.py; an edit to
    the lists without a rebuild (or a hand edit of the JSON) would serve
    something nobody reviewed."""
    from scripts.build_theme_db import build
    themes, errors = build()
    assert errors == []
    assert themes == _shipped()


def test_the_scale_is_a_judgement_not_a_frequency():
    """The owner's own example of the scale, and the words the frequency
    bands got backwards."""
    def level_of(theme, surface):
        rows = [r for r in _shipped(theme) if surface in (r["kanji"], r["kana"])]
        assert rows, (theme, surface)
        return rows[0]["level"]

    assert level_of("fruits", "りんご") == "basic"      # apple
    assert level_of("fruits", "梨") == "medium"         # pear
    assert level_of("fruits", "柘榴") == "advanced"     # pomegranate
    assert level_of("fruits", "金柑") == "expert"       # kumquat
    assert level_of("fruits", "バナナ") == "basic"      # was advanced
    assert level_of("animals", "犬") == "basic"         # was missing
    assert level_of("animals", "象") == "basic"         # was expert
    assert level_of("weather", "風") == "basic"         # was expert


@pytest.mark.parametrize("theme", THEMES)
def test_every_word_has_a_french_gloss(theme):
    rows = theme_data.theme_entries(theme)
    assert all(e["meaning_fr"].strip() for e in rows)
    heads = [e["meaning_fr"].split(",")[0].strip().lower() for e in rows]
    assert len(set(heads)) == len(heads)


@pytest.mark.parametrize("theme", THEMES)
def test_a_theme_never_repeats_a_word_or_a_meaning(theme):
    """Two rows sharing a surface (鼠/ねずみ beside 鼠/ねず) or a gloss
    ("kitchen" nine times over in `rooms`) make the meaning->word
    direction unanswerable and collapse the MCQ distractors, which
    study/mcq.py dedupes by meaning."""
    rows = theme_data.theme_entries(theme)
    surfaces = [e["kanji"] or e["kana"] for e in rows]
    meanings = [e["meaning"].split(",")[0].strip().lower() for e in rows]
    assert len(set(surfaces)) == len(surfaces)
    assert len(set(meanings)) == len(meanings)


@pytest.mark.parametrize("theme", THEMES)
def test_every_row_resolves_to_a_real_card(theme):
    """theme_entries skips a row it cannot resolve, so a rebuild against a
    changed pool would quietly shrink a band with nothing noticing. Count
    the raw rows and the resolved ones and insist they match."""
    assert len(theme_data.theme_entries(theme)) == len(_shipped(theme))


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


def test_a_theme_session_introduces_its_words_easiest_first(client):
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


def test_a_pool_word_reads_in_french(client):
    """A JMdict-pool word has no line in the course's French table and
    used to arrive in JMdict's English; the theme's own gloss is French."""
    pool = [e for e in theme_data.theme_entries("fruits", "advanced")
            if e["domain"] == "vocab_jmdict"]
    assert pool
    body = client.get("/api/vocab/theme/fruits/cards",
                      params={"level": "advanced", "mode": MODE, "count": 25,
                              "lang": "fr"}).json()
    by_id = {e["card_id"]: e for e in pool}
    served = [c for c in body["cards"] if c["card_id"] in by_id]
    assert served
    for card in served:
        assert card["meaning"] == by_id[card["card_id"]]["meaning_fr"]


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
