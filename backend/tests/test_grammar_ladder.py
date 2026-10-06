"""
The grammar ladder (plan 187e): one track, its exercise read from the
card's progress -- recognise, choose, build, write -- each rung falling
back where the point cannot be asked on it, one key reaching the log, the
two new exercises' payloads, the snapshot of which points can be asked
them, and the migration that seeds the ladder from a learner's best mode.
"""
import random

import pytest

from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL, find, grammar_to_id
from core.auth import DEV_USER_ID
from core.db import db_conn
from srs.srs import SRSEngine
from study import card_index, grammar_ladder
from study.grammar_examples import blank_span, highlight_span
from study.grammar_lesson import contrast_payload
from study.modes import GRADED_ORDER_FOR_SOURCE, MODES, eligible_for
from study.level_rule import primary_mode

LADDER = "grammar.ladder"

# (total_reviews, interval_days, is_learning, learning_step) a card on each
# rung has: progress 0, 0.25, ~0.61, ~0.88 (srs._progress).
RUNG_ROWS = {0: (0, 0, True, 0), 1: (2, 0, True, 2), 2: (4, 2, False, 0), 3: (7, 10, False, 0)}


def _point(pattern):
    level, entry = find(pattern)
    return level, entry, grammar_to_id(entry, level)


# ── The rungs ────────────────────────────────────────────────

def test_the_rung_is_read_from_progress():
    assert [grammar_ladder.rung_of(p) for p in (None, 0, 0.24, 0.25, 0.49, 0.5, 0.74, 0.75, 1)] == \
        [0, 0, 0, 1, 1, 2, 2, 3, 3]
    for rung, row in RUNG_ROWS.items():
        assert grammar_ladder.rung_of(SRSEngine._progress(*row)) == rung


def test_each_rung_falls_back_down_the_ladder_to_the_flashcard():
    assert grammar_ladder.chain_for(0) == ("fill_in", "flashcard")
    assert grammar_ladder.chain_for(1) == ("contrast", "fill_in", "flashcard")
    assert grammar_ladder.chain_for(2) == ("build", "contrast", "fill_in", "flashcard")
    assert grammar_ladder.chain_for(3) == ("write", "build", "contrast", "fill_in", "flashcard")


def test_the_ladder_is_grammars_primary_track_and_asks_every_point():
    assert primary_mode("grammar") == LADDER
    assert GRADED_ORDER_FOR_SOURCE["grammar"][0] == LADDER
    for level, entries in GRAMMAR_POINTS_BY_LEVEL.items():
        assert card_index.total("grammar", level, LADDER) == len(entries)


# ── The snapshot ─────────────────────────────────────────────

def test_the_snapshot_says_what_the_two_exercises_can_be_asked_on():
    # Rewrite it with `python -m scripts.build_ladder_flags` after a
    # catalogue change.
    import json
    written = json.loads(grammar_ladder.SNAPSHOT.read_text(encoding="utf-8"))
    assert written == grammar_ladder.snapshot_now()


def test_the_two_platforms_are_offered_where_most_points_can_take_them():
    for level in GRAMMAR_POINTS_BY_LEVEL:
        total = len(GRAMMAR_POINTS_BY_LEVEL[level])
        assert card_index.total("grammar", level, "grammar.build") >= total // 2
        assert card_index.total("grammar", level, "grammar.write") >= total * 9 // 10


# ── 組立 build ───────────────────────────────────────────────

def _builds():
    for level, entries in GRAMMAR_POINTS_BY_LEVEL.items():
        for entry in entries:
            if grammar_ladder.build_ok(level, entry["pattern"]):
                yield level, entry


def test_a_build_puts_back_together_into_its_sentence():
    seen = 0
    for level, entry in _builds():
        built = grammar_ladder.build_payload(level, entry, "en", random.Random(entry["pattern"]))
        assert built is not None, entry["pattern"]
        by_id = {tile["id"]: tile for tile in built["tray"]}
        slots = [tile["slot"] for tile in built["tiles"] if "slot" in tile]
        assert slots == sorted(slots) == list(range(len(built["answer"])))
        assert 1 <= len(slots) <= 2
        # One wrong piece in the tray, besides the missing ones.
        assert len(built["tray"]) == len(slots) + 1
        text = "".join(
            by_id[built["answer"][tile["slot"]]]["text"] if "slot" in tile
            else "".join(p["text"] for p in tile["furigana"])
            for tile in built["tiles"]
        ) + built["tail"]
        assert text == built["jp"], entry["pattern"]
        # Every piece reads as itself, ruby included.
        for tile in built["tray"]:
            assert "".join(p["text"] for p in tile["furigana"]) == tile["text"]
        wrong = [t for t in built["tray"] if t["id"] not in built["answer"]]
        assert len(wrong) == 1
        assert wrong[0]["text"] not in {by_id[i]["text"] for i in built["answer"]}, entry["pattern"]
        assert built["tr"]
        seen += 1
    assert seen > 400


def test_the_point_is_always_a_missing_piece():
    level, entry, _ = _point("〜てください")
    built = grammar_ladder.build_payload(level, entry, "en", random.Random(1))
    pieces = {t["id"]: t["text"] for t in built["tray"]}
    assert "でください" in [pieces[i] for i in built["answer"]]


def test_a_point_with_no_marked_sentence_is_no_build():
    level, entry, _ = _point("は")
    assert not grammar_ladder.can_build(level, "は")
    assert grammar_ladder.build_payload(level, entry, "en") is None


# ── A particle, blanked by the detector (plan 190) ───────────

def test_a_particle_is_blanked_where_the_detector_finds_it_once():
    # Its letters point at nothing, so the detector does: once, on one
    # piece, or not at all.
    assert blank_span("毎あさパンを食べます。", "を", "N5") == (5, 6)
    assert blank_span("パンを食べて、水を飲みます。", "を", "N5") is None
    assert blank_span("おちゃかコーヒーを飲みますか。", "〜か〜か", "N5") is None
    # A verifiable point is blanked by its stems, as before.
    assert blank_span("約束は守るべきです。", "〜べきだ", "N3") == highlight_span("約束は守るべきです。", "〜べきだ")


def test_a_particles_contrast_offers_its_rivals_alone():
    # パン＿食べます takes だけ, まで and から too: no filler is certainly
    # wrong in a particle's gap, so only the rivals its author marked the
    # sentence against are offered.
    level, entry, _ = _point("を")
    for seed in range(8):
        drill = contrast_payload(level, entry, GRAMMAR_POINTS_BY_LEVEL[level], "en", random.Random(seed))
        assert sorted(drill["choices"]) == sorted(["を", "が", "に"])
        blanks = [p for p in drill["furigana"] if p.get("blank")]
        assert len(blanks) == 1
        around = "".join(p["text"] for p in drill["furigana"] if not p.get("blank"))
        assert drill["jp"].replace("を", "", 1) == around


def test_the_particles_the_detector_blanks_reach_the_middle_rungs():
    for level, pattern in (("N5", "を"), ("N5", "に"), ("N5", "で"), ("N5", "が"), ("N5", "か"),
                           ("N4", "〜方"), ("N4", "〜さ"), ("N3", "〜化")):
        assert card_index.contrast_ok(level, pattern), pattern
        assert grammar_ladder.build_ok(level, pattern), pattern
    # は, が and も share too many sentences: は marks none, and stays on
    # the flashcard until it can be written.
    assert not card_index.contrast_ok("N5", "は")


def test_a_particle_on_the_middle_rung_is_asked_its_contrast(client):
    level, entry, raw_id = _point("を")
    _clear(raw_id)
    try:
        _place(raw_id, LADDER, RUNG_ROWS[1])
        card = _served(client, level, raw_id)
        assert card["rung"] == 1 and card["exercise"] == "grammar.contrast"
        assert sorted(card["contrast"]["choices"]) == sorted(["を", "が", "に"])
    finally:
        _clear(raw_id)


# ── 書く write ───────────────────────────────────────────────

def test_a_write_hands_a_situation_two_words_and_the_sentence_lit():
    level, entry, _ = _point("〜てください")
    written = grammar_ladder.write_payload(level, entry, "fr", random.Random(3))
    assert written["situation"] and written["model"]["tr"] == written["situation"]
    assert 1 <= len(written["helpers"]) <= grammar_ladder.HELPERS
    assert any(p.get("highlight") for p in written["model"]["furigana"])
    for helper in written["helpers"]:
        assert helper["text"] not in ("でください", "ください")


def test_write_is_only_where_the_detector_can_judge():
    from study.grammar_detect import can_find
    for level, entries in GRAMMAR_POINTS_BY_LEVEL.items():
        for entry in entries:
            if grammar_ladder.write_ok(level, entry["pattern"]):
                assert can_find(entry["pattern"]), entry["pattern"]


def test_a_written_card_is_never_on_the_ladder():
    from routes.decks import _card_answers
    written = {"fields": {"rule": "〜ても", "meaning": "even if", "sentences": "雨が降っても行きます。"}}
    for key in (LADDER, "grammar.build", "grammar.write"):
        assert _card_answers(written, MODES[key]) is False
    assert eligible_for(MODES[LADDER], {})


# ── Served, by rung ──────────────────────────────────────────

def _place(raw_id, mode, row):
    """A due row for the dev learner in `mode`, at `row`'s progress."""
    total, interval, learning, step = row
    card_id = f"{DEV_USER_ID}:{raw_id}"
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO cards (id) VALUES (%s) ON CONFLICT DO NOTHING", (card_id,))
            cur.execute(
                """
                INSERT INTO card_modes (card_id, mode, interval_days, total_reviews, is_learning,
                                        learning_step, next_review)
                VALUES (%s, %s, %s, %s, %s, %s, NOW() - INTERVAL '1 day')
                ON CONFLICT (card_id, mode) DO UPDATE SET
                    interval_days = EXCLUDED.interval_days, total_reviews = EXCLUDED.total_reviews,
                    is_learning = EXCLUDED.is_learning, learning_step = EXCLUDED.learning_step,
                    next_review = EXCLUDED.next_review
                """,
                (card_id, mode, interval, total, learning, step),
            )
        conn.commit()
    finally:
        conn.close()


def _clear(*raw_ids):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            ids = [f"{DEV_USER_ID}:{r}" for r in raw_ids]
            cur.execute("DELETE FROM card_modes WHERE card_id = ANY(%s)", (ids,))
            cur.execute("DELETE FROM review_log WHERE card_id = ANY(%s)", (ids,))
        conn.commit()
    finally:
        conn.close()


def _served(client, level, raw_id, lang="en"):
    cards = client.get(f"/api/grammar/cards?level={level}&mode={LADDER}&lang={lang}&count=25").json()["cards"]
    return next(c for c in cards if c["card_id"] == raw_id)


@pytest.mark.parametrize("rung,exercise", [
    (0, "grammar.fill_in"), (1, "grammar.contrast"), (2, "grammar.build"), (3, "grammar.write"),
])
def test_a_card_is_asked_the_exercise_of_its_rung(client, rung, exercise):
    level, entry, raw_id = _point("〜てください")
    _clear(raw_id)
    try:
        _place(raw_id, LADDER, RUNG_ROWS[rung])
        card = _served(client, level, raw_id)
        assert card["mode"] == LADDER and card["rung"] == rung and card["exercise"] == exercise
        assert card["asked"] == rung
        if exercise == "grammar.build":
            assert card["build"]["tray"]
        if exercise == "grammar.write":
            assert card["write"]["situation"]
        if exercise == "grammar.contrast":
            assert card["contrast"]["choices"]
    finally:
        _clear(raw_id)


def test_a_lapse_steps_the_card_down():
    # A miss lowers the progress, and the rung is read from it alone.
    high = SRSEngine._progress(*RUNG_ROWS[3])
    relearning = SRSEngine._progress(5, 0, True, 1)
    assert grammar_ladder.rung_of(high) == 3
    assert grammar_ladder.rung_of(relearning) < 3


def test_a_point_with_no_marked_sentence_falls_back(client):
    # は has no contrast sentence: on rungs 1 and 2 it is asked on fill_in
    # or, where that cannot name it, the flashcard. Writing needs no
    # marked sentence, only a detector trusted on the point: rung 3 is
    # write.
    level, entry, raw_id = _point("は")
    expected = "grammar.fill_in" if card_index.fill_ok(level, "は") else "grammar.flashcard.f2b"
    assert not grammar_ladder.build_ok(level, "は") and grammar_ladder.write_ok(level, "は")
    _clear(raw_id)
    try:
        for rung, exercise in ((1, expected), (2, expected), (3, "grammar.write")):
            _place(raw_id, LADDER, RUNG_ROWS[rung])
            card = _served(client, level, raw_id)
            assert card["rung"] == rung and card["exercise"] == exercise
            # The strip names the exercise asked, not the rung it fell from.
            assert card["asked"] == (3 if exercise == "grammar.write" else 0)
    finally:
        _clear(raw_id)


def test_one_key_reaches_the_log_whatever_was_asked(client):
    level, entry, raw_id = _point("〜てください")
    _clear(raw_id)
    try:
        _place(raw_id, LADDER, RUNG_ROWS[2])
        assert _served(client, level, raw_id)["exercise"] == "grammar.build"
        r = client.post("/api/grammar/review", json={"card_id": raw_id, "mode": LADDER, "quality": 4})
        assert r.status_code == 200, r.text
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT DISTINCT mode FROM review_log WHERE card_id = %s", (f"{DEV_USER_ID}:{raw_id}",))
                assert cur.fetchall() == [(LADDER,)]
        finally:
            conn.close()
    finally:
        _clear(raw_id)


# ── The plate's record ───────────────────────────────────────

def test_the_point_carries_its_first_tour(client):
    level, entry, raw_id = _point("か")
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM grammar_tours WHERE user_id = %s AND card_id = %s", (DEV_USER_ID, raw_id))
        conn.commit()
    finally:
        conn.close()
    assert client.get(f"/api/grammar/point?id={raw_id}").json()["tour_record"] is None
    client.post("/api/grammar/tour", json={"raw_id": raw_id, "tries": 1, "helped": False})
    record = client.get(f"/api/grammar/point?id={raw_id}").json()["tour_record"]
    assert record["tries"] == 1 and record["helped"] is False and record["done_at"]


# ── The migration ────────────────────────────────────────────

MIGRATE_USER = "ladder-migrate-user"


def _rows(raw_id):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT mode, interval_days, total_reviews FROM card_modes WHERE card_id = %s ORDER BY mode",
                        (f"{MIGRATE_USER}:{raw_id}",))
            return cur.fetchall()
    finally:
        conn.close()


def _seed(raw_id, mode, row):
    total, interval, learning, step = row
    card_id = f"{MIGRATE_USER}:{raw_id}"
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO cards (id) VALUES (%s) ON CONFLICT DO NOTHING", (card_id,))
            cur.execute(
                "INSERT INTO card_modes (card_id, mode, interval_days, total_reviews, is_learning, learning_step) "
                "VALUES (%s, %s, %s, %s, %s, %s)",
                (card_id, mode, interval, total, learning, step),
            )
        conn.commit()
    finally:
        conn.close()


def _wipe():
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM card_modes WHERE card_id LIKE %s", (f"{MIGRATE_USER}:%",))
        conn.commit()
    finally:
        conn.close()


def test_the_migration_seeds_the_ladder_from_the_best_mode(monkeypatch):
    from scripts import migrate_grammar_ladder as migrate
    _, _, ka = _point("か")
    _, _, kudasai = _point("〜てください")
    _wipe()
    try:
        _seed(ka, "grammar.flashcard.f2b", RUNG_ROWS[1])
        _seed(ka, "grammar.fill_in", RUNG_ROWS[3])
        _seed(kudasai, "grammar.contrast", RUNG_ROWS[2])

        # A dry run writes nothing.
        monkeypatch.setattr("sys.argv", ["migrate", "--user", MIGRATE_USER])
        assert migrate.main() == 0
        assert [m for m, *_ in _rows(ka)] == ["grammar.fill_in", "grammar.flashcard.f2b"]

        monkeypatch.setattr("sys.argv", ["migrate", "--user", MIGRATE_USER, "--yes"])
        assert migrate.main() == 0
        # か: the ladder takes fill_in's schedule, the best; the f2b row,
        # the old main track, is folded in; fill_in stays a platform.
        assert _rows(ka) == [("grammar.fill_in", 10, 7), (LADDER, 10, 7)]
        # 〜てください: seeded from contrast, which stays.
        assert _rows(kudasai) == [("grammar.contrast", 2, 4), (LADDER, 2, 4)]

        # Run twice, changes nothing.
        assert migrate.main() == 0
        assert _rows(ka) == [("grammar.fill_in", 10, 7), (LADDER, 10, 7)]
    finally:
        _wipe()
