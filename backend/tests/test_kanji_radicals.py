"""Study by radical (plan 086).

The kanji station's third source: the 214 Kangxi radicals as a way in,
each one a lesson (what it means, what it is called, the forms it takes)
over the course's own kanji filed under it, then the same five drills
over that family.

The invariant above every other one here is the one the vocabulary's
themes already hold (tests/test_theme_vocab.py): a radical is a GROUPING
of the same cards, never a second copy. 海 studied under 氵 and under N4
is one SRS row, or a learner's progress silently forks in two.
"""

import pytest

from content import radical_data
from content.kanji_data import DECK_BY_CHAR, KANJI_BY_LEVEL, LEVELS, kanji_to_id
from content.radical_info import POSITIONS, RADICAL_INFO
from core.auth import DEV_USER_ID
from core.db import db_conn

MODE = "kanji.flashcard.f2b"
WATER = 85     # 氵 — the biggest family in the course
FLUTE = 214    # 龠 — a radical the course never reaches


@pytest.fixture(autouse=True)
def _fresh():
    """The new-card batch cache is process-wide and refills from the
    same pool; and a review written by one test must not be read as
    progress by the next."""
    from srs import batch_cache
    batch_cache.reset()
    yield
    batch_cache.reset()
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM card_modes WHERE card_id LIKE %s", (f"{DEV_USER_ID}:%",))
            cur.execute("DELETE FROM cards WHERE id LIKE %s", (f"{DEV_USER_ID}:%",))
        conn.commit()
    finally:
        conn.close()


# ---------------------------------------------------------------- the table


def test_every_radical_is_described_in_both_languages():
    """content/radical_info.py is written by hand, so the thing to pin
    is coverage: every number the index knows has a meaning in each
    language, at least one Japanese name, at least one form, and a
    position the frontend has a word for."""
    assert set(RADICAL_INFO) == set(radical_data.RADICAL_BY_NUMBER)
    for number, (en, fr, names, forms, position) in RADICAL_INFO.items():
        assert en and fr and names and forms, number
        assert position is None or position in POSITIONS, number


def test_the_glyph_is_the_form_the_learner_meets_first():
    """The index files 64 under 才 and 85 under 氵 — KANJIDIC2's
    fewest-stroke member, not the radical. The lesson prints the form
    the course actually shows: 手 with 扌 beside it, 水 with 氵."""
    hand = radical_data.info_for(64)
    assert hand["char"] == "才"
    assert hand["glyph"] == "手" and "扌" in hand["forms"]
    water = radical_data.info_for(WATER, "fr")
    assert water["glyph"] == "水" and water["meaning"] == "eau"
    assert radical_data.info_for(WATER, "en")["meaning"] == "water"
    assert radical_data.info_for(999) is None


# ---------------------------------------------------------------- the grouping


def test_the_families_partition_the_course_one_row_per_character():
    """Every course character is filed under exactly one radical, once —
    the 23 dual-level characters at their lowest level, DECK_BY_CHAR's
    rule — and no radical without a course kanji has a family."""
    rows = [row for rows in radical_data.DECK_BY_RADICAL.values() for row in rows]
    chars = [entry["kanji"] for _, entry in rows]
    assert len(chars) == len(set(chars)) == len(DECK_BY_CHAR)
    for level, entry in rows:
        assert DECK_BY_CHAR[entry["kanji"]][0] == level
    assert FLUTE not in radical_data.DECK_BY_RADICAL
    assert radical_data.deck_kanji_for(FLUTE) == []


def test_a_family_reads_easy_first():
    """N5 before N4 before N1, and fewer strokes first within a level:
    the order the lesson lists the family in and the order the drill
    serves it in (get_new_cards is asked to keep it)."""
    rows = radical_data.deck_kanji_for(WATER)
    ranks = [LEVELS.index(level) for level, _ in rows]
    assert ranks == sorted(ranks)
    assert rows[0][1]["kanji"] == "水"
    strokes = [radical_data.KANJI_RADICALS[e["kanji"]]["stroke_count"]
               for level, e in rows if level == "N1"]
    assert strokes == sorted(strokes)


# ---------------------------------------------------------------- the index


def test_the_index_counts_the_course_not_the_language(client):
    body = client.get("/api/kanji/radicals", params={"lang": "en"}).json()
    groups = body["groups"]
    assert [g["stroke_count"] for g in groups] == sorted(g["stroke_count"] for g in groups)
    tiles = [r for g in groups for r in g["radicals"]]
    assert {r["number"] for r in tiles} == set(radical_data.DECK_BY_RADICAL)
    assert sum(r["count"] for r in tiles) == len(DECK_BY_CHAR)
    water = next(r for r in tiles if r["number"] == WATER)
    # 氵 files 656 characters of the language; the course teaches far
    # fewer, and that smaller number is the denominator a learner can
    # actually reach.
    assert water["count"] == len(radical_data.deck_kanji_for(WATER)) < 656
    assert water["glyph"] == "水" and water["meaning"] == "water"
    assert water["started"] == water["learned"] == 0


# ---------------------------------------------------------------- the lesson


def test_the_lesson_is_the_radical_and_its_family_by_level(client):
    body = client.get(f"/api/kanji/radical/{WATER}", params={"lang": "fr"}).json()
    assert body["glyph"] == "水" and body["forms"][:2] == ["水", "氵"]
    assert body["names_ja"][:2] == ["みず", "さんずい"]
    assert body["position"] == "hen"
    assert body["svg_url"] == "/kanjivg/06c34.svg"
    assert [lv["level"] for lv in body["levels"]] == [
        lv for lv in LEVELS if any(level == lv for level, _ in radical_data.deck_kanji_for(WATER))
    ]
    assert sum(len(lv["kanji"]) for lv in body["levels"]) == body["total"]
    first = body["levels"][0]["kanji"][0]
    assert first["kanji"] == "水" and first["meaning"] == "eau" and first["stage"] == "new"
    assert first["card_id"] == "kanji_N5_水"


def test_every_lesson_has_a_stroke_diagram(client):
    """The index files 140 under U+FA5D, a compatibility form KanjiVG
    has no file for; the lesson prints 艹 (U+8279), which it does. Every
    glyph the table chooses has a diagram — pinned, because a plate
    with a blank where the strokes should be is the first thing a
    learner would see."""
    for number in radical_data.DECK_BY_RADICAL:
        body = client.get(f"/api/kanji/radical/{number}").json()
        assert body["svg_url"], (number, body["glyph"])
    assert client.get("/api/kanji/radical/140").json()["glyph"] == "艹"


def test_an_unknown_radical_is_a_404_not_an_exhausted_deck(client):
    """A 200 with an error body reaches the run as "deck exhausted" and
    fires the completion fanfare (theme_vocab.py's _require_theme)."""
    assert client.get("/api/kanji/radical/999").status_code == 404
    assert client.get("/api/kanji/cards", params={"radical": 999, "mode": MODE}).status_code == 404
    assert client.get("/api/kanji/stats", params={"radical": 999, "mode": MODE}).status_code == 404
    assert client.get("/api/kanji/review-cards", params={"radical": 999}).status_code == 404


def test_a_reached_radical_with_no_course_kanji_is_empty_not_missing(client):
    """The other answer: 龠 is a real radical the index knows; the
    course just teaches nothing under it."""
    body = client.get(f"/api/kanji/radical/{FLUTE}").json()
    assert body["total"] == 0 and body["levels"] == []
    assert client.get("/api/kanji/cards", params={"radical": FLUTE, "mode": MODE}).json()["cards"] == []


# ---------------------------------------------------------------- the drill


def test_the_drill_serves_the_family_and_nothing_else(client):
    family = {kanji_to_id(e, lv) for lv, e in radical_data.deck_kanji_for(WATER)}
    body = client.get("/api/kanji/cards", params={"radical": WATER, "mode": MODE, "count": 10}).json()
    ids = [c["card_id"] for c in body["cards"]]
    assert ids and set(ids) <= family
    # Easy-first: the N5 character leads.
    assert ids[0] == "kanji_N5_水"


def test_a_card_id_does_not_depend_on_the_radical(client):
    """THE invariant. The same character served by the radical path and
    by the level path is the same card, so a review under one is a
    review under the other."""
    by_radical = {c["kanji"]: c["card_id"] for c in client.get(
        "/api/kanji/cards", params={"radical": WATER, "mode": MODE, "count": 10}).json()["cards"]}
    for kanji, card_id in by_radical.items():
        level, entry = DECK_BY_CHAR[kanji]
        assert card_id == kanji_to_id(entry, level)


def test_wrong_answers_come_from_the_family_when_it_is_big_enough(client):
    """泳 against 洗, 池 and 湖 is the discrimination the learner came
    for; a 4-option grid drawn from all of N4 would ask a different
    question."""
    family = {e["kanji"] for _, e in radical_data.deck_kanji_for(WATER)}
    body = client.get("/api/kanji/cards", params={"radical": WATER, "mode": MODE, "count": 5}).json()
    for card in body["cards"]:
        options = {h["kanji"] for h in card["hints"]["indice_1"]}
        assert len(options) == 4 and options <= family


def test_a_small_family_is_widened_so_the_grid_stays_full(client):
    small = next(n for n, rows in radical_data.DECK_BY_RADICAL.items() if 1 <= len(rows) <= 3)
    body = client.get("/api/kanji/cards", params={"radical": small, "mode": MODE, "count": 3}).json()
    assert body["cards"]
    for card in body["cards"]:
        assert len(card["hints"]["indice_1"]) == 4


def test_one_radical_batch_is_not_served_to_another_or_to_a_level(client):
    """The batch cache is keyed by scope: the water batch must not leak
    into the tree family's, nor into N5's."""
    water = {c["card_id"] for c in client.get(
        "/api/kanji/cards", params={"radical": WATER, "mode": MODE, "count": 10}).json()["cards"]}
    tree = {c["card_id"] for c in client.get(
        "/api/kanji/cards", params={"radical": 75, "mode": MODE, "count": 10}).json()["cards"]}
    assert water and tree and not (water & tree)
    n5 = {c["card_id"] for c in client.get(
        "/api/kanji/cards", params={"level": "N5", "mode": MODE, "count": 10}).json()["cards"]}
    assert all(cid.startswith("kanji_N5_") for cid in n5)


def test_the_level_path_is_untouched(client):
    body = client.get("/api/kanji/cards", params={"level": "N5", "mode": MODE, "count": 3}).json()
    assert len(body["cards"]) == 3
    assert client.get("/api/kanji/cards", params={"mode": MODE}).json() == {"error": "Unknown level"}
    stats = client.get("/api/kanji/stats", params={"level": "N5", "mode": MODE}).json()
    assert stats["total"] == len(KANJI_BY_LEVEL["N5"])


# ---------------------------------------------------------------- progress


def test_a_review_under_the_radical_shows_on_the_index_the_lesson_and_the_level(client):
    """One row, three readers: the radical tile's `started`, the family
    member's `stage`, and — because it is the same card — the level's
    own stats."""
    client.post("/api/kanji/review", json={"card_id": "kanji_N5_水", "mode": MODE, "quality": 4})

    tiles = [r for g in client.get("/api/kanji/radicals").json()["groups"] for r in g["radicals"]]
    water = next(r for r in tiles if r["number"] == WATER)
    assert water["started"] == 1 and water["learned"] == 0

    lesson = client.get(f"/api/kanji/radical/{WATER}").json()
    assert lesson["started"] == 1
    stages = {k["kanji"]: k["stage"] for lv in lesson["levels"] for k in lv["kanji"]}
    assert stages["水"] == "learning"

    stats = client.get("/api/kanji/stats", params={"radical": WATER, "mode": MODE}).json()
    assert stats["learning"] == 1 and stats["total"] == lesson["total"]
    level = client.get("/api/kanji/stats", params={"level": "N5", "mode": MODE}).json()
    assert level["learning"] == 1

    browse = client.get("/api/kanji/review-cards", params={"radical": WATER}).json()["cards"]
    assert [c["card_id"] for c in browse] == ["kanji_N5_水"]
