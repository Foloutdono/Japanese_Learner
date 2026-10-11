"""
The grammar ladder (plan 187e), walked as steps since plan 194: Choisir
three times, Construire four times, then mastered with the flashcard and
Construire in turn, a miss keeping its step and a miss once mastered a
short relapse (srs/ladder.py); each step's exercise falling back where
the point cannot be asked on it, one key reaching the log, Construire's
typed check, the snapshot of which points can be asked it and write, and
the migration that seeds the ladder from a learner's best mode.
"""
import random

import pytest

from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL, find, grammar_to_id
from core.auth import DEV_USER_ID
from core.db import db_conn
from datetime import datetime, timedelta, timezone

from srs import ladder
from srs.models import CardState
from srs.srs import SRSEngine
from study import card_index, grammar_ladder
from study.grammar_examples import blank_span, highlight_span
from study.grammar_lesson import contrast_payload
from study.modes import GRADED_ORDER_FOR_SOURCE, MODES, eligible_for
from study.level_rule import primary_mode

LADDER = "grammar.ladder"

# (total_reviews, interval_days, is_learning, learning_step) a row at each
# step of the walk (srs/ladder.py, plan 194).
STEP_ROWS = {
    "choose": (1, 0, True, 1),       # Choisir 2
    "build": (4, 2, False, 4),       # Construire 2
    "mastered": (9, 21, False, 7),   # mastered, its flashcard turn
}


def _point(pattern):
    level, entry = find(pattern)
    return level, entry, grammar_to_id(entry, level)


# ── The steps ────────────────────────────────────────────────

def _state(row, mode=LADDER):
    total, interval, learning, step = row
    return CardState(card_id="u:grammar_N5_x", mode=mode, total_reviews=total, interval_days=interval,
                     is_learning=learning, learning_step=step)


def _walk(qualities):
    state, now = CardState(card_id="u:grammar_N5_x", mode=LADDER), datetime(2026, 10, 1, tzinfo=timezone.utc)
    out = []
    for q in qualities:
        state = ladder.review(state, q, now)
        out.append((ladder.step_of(state), state.next_review - now))
    return state, out


def test_choisir_three_times_construire_four_then_mastered():
    state, walk = _walk([4] * 8)
    assert [s for s, _ in walk] == [1, 2, 3, 4, 5, 6, 7, 7]
    assert [w for _, w in walk[:7]] == [
        timedelta(minutes=10), timedelta(hours=1), timedelta(days=1), timedelta(days=2),
        timedelta(days=4), timedelta(days=8), timedelta(days=21),
    ]
    # Mastered as every other card is: 21 days, the bar full.
    assert SRSEngine._classify_stage(state.total_reviews, state.interval_days) == "mastered"


def test_the_bar_climbs_with_every_step_and_never_back():
    state = CardState(card_id="u:x", mode=LADDER)
    seen = [0.0]
    for _ in range(7):
        state = ladder.review(state, 4)
        seen.append(SRSEngine._progress(state.total_reviews, state.interval_days,
                                        state.is_learning, state.learning_step))
    assert seen == sorted(seen) and len(set(seen)) == len(seen) and seen[-1] == 1.0


def test_a_miss_keeps_the_step_and_comes_back_soon():
    for row in (STEP_ROWS["choose"], STEP_ROWS["build"]):
        before = ladder.step_of(_state(row))
        after = ladder.review(_state(row), 1)
        assert ladder.step_of(after) == before
        assert after.next_review - datetime.now(timezone.utc) <= ladder.MISS_WAIT


def test_difficult_is_a_pass():
    assert ladder.step_of(ladder.review(_state(STEP_ROWS["choose"]), 3)) == 2


def test_a_miss_once_mastered_is_a_short_relapse():
    _, walk = _walk([4] * 7 + [1, 4, 4])
    assert [s for s, _ in walk[7:]] == [ladder.RELAPSE_PICK, ladder.RELAPSE_BUILD, ladder.MASTERED]
    assert [w for _, w in walk[7:]] == [ladder.MISS_WAIT, timedelta(days=1), timedelta(days=21)]


def test_mastered_asks_the_flashcard_and_construire_in_turn():
    state, _ = _walk([4] * 7)
    kinds = []
    for _ in range(4):
        kinds.append(ladder.exercise_of(state))
        state = ladder.review(state, 4)
    assert kinds == ["flashcard", "build", "flashcard", "build"]
    assert ladder.step_of(state) == ladder.MASTERED and state.interval_days > 21


def test_a_row_from_before_the_steps_is_read_onto_the_walk():
    # The progress ladder's rows, and rows seeded from another mode.
    assert ladder.step_of(_state((2, 0, True, 2))) == 2
    assert ladder.step_of(_state((3, 0, True, 3))) == 2
    assert ladder.step_of(_state((5, 2, False, 4))) == 4
    assert ladder.step_of(_state((6, 9, False, 4))) == 6
    assert ladder.step_of(_state((9, 40, False, 4))) == ladder.MASTERED
    assert ladder.step_of(_state((9, 40, True, 0))) == ladder.RELAPSE_PICK


def test_the_forecast_runs_the_steps_too(client):
    # preview_reviews_bulk dry-runs the same machine: the tiles' due_in.
    level, entry, raw_id = _point("〜てください")
    _clear(raw_id)
    try:
        _place(raw_id, LADDER, STEP_ROWS["choose"])
        card = _served(client, level, raw_id)
        assert 3500 <= card["review_preview"]["4"]["due_in"] <= 3600
        assert card["review_preview"]["1"]["due_in"] <= 600
    finally:
        _clear(raw_id)


def test_each_step_falls_back_to_the_flashcard():
    assert grammar_ladder.chain_for("choose") == ("contrast", "fill_in", "flashcard")
    assert grammar_ladder.chain_for("build") == ("build", "contrast", "fill_in", "flashcard")
    assert grammar_ladder.chain_for("flashcard") == ("flashcard",)


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


def test_construire_and_write_are_offered_for_nearly_every_point():
    for level in GRAMMAR_POINTS_BY_LEVEL:
        total = len(GRAMMAR_POINTS_BY_LEVEL[level])
        assert card_index.total("grammar", level, "grammar.build") >= total - 4
        assert card_index.total("grammar", level, "grammar.write") >= total * 9 // 10


# ── 作る Construire ──────────────────────────────────────────

def _builds():
    for level, entries in GRAMMAR_POINTS_BY_LEVEL.items():
        for entry in entries:
            if grammar_ladder.build_ok(level, entry["pattern"]):
                yield level, entry


def _text(pieces, answers):
    return "".join(answers[p["gap"]] if "gap" in p else "".join(f["text"] for f in p["furigana"])
                   for p in pieces)


def test_every_construire_puts_back_into_its_sentence_and_checks_right():
    seen = 0
    for level, entry in _builds():
        built = grammar_ladder.build_payload(level, entry, "en")
        assert built is not None and built["tr"], entry["pattern"]
        gaps = [p for p in built["pieces"] if "gap" in p]
        assert 1 <= len(gaps) <= grammar_ladder.MAX_GAPS
        verdict = grammar_ladder.check_build(level, entry["pattern"], built["key"], [""] * len(gaps), "en")
        answers = [g["answer"] for g in verdict["gaps"]]
        assert _text(built["pieces"], answers) == verdict["jp"], entry["pattern"]
        # Typed as written, or as read: right.
        assert grammar_ladder.check_build(level, entry["pattern"], built["key"], answers, "en")["verdict"] == "right"
        readings = [g["reading"] for g in verdict["gaps"]]
        assert grammar_ladder.check_build(level, entry["pattern"], built["key"], readings, "en")["verdict"] == "right"
        assert [p["size"] for p in gaps] == [len(r) for r in readings]
        seen += 1
    assert seen >= 535


def test_construire_reads_romaji_and_names_the_one_kana_off():
    level, entry, _ = _point("〜てください")
    for turn in range(10):
        built = grammar_ladder.build_payload(level, entry, "fr", turn)
        verdict = grammar_ladder.check_build(level, entry["pattern"], built["key"], ["tekudasai"], "fr")
        if verdict["gaps"][0]["reading"] == "てください":
            break
    assert verdict["verdict"] == "right"
    close = grammar_ladder.check_build(level, entry["pattern"], built["key"], ["でください"], "fr")
    assert close["verdict"] == "close"
    assert close["gaps"][0]["marks"][0] == {"wrong": "で", "fix": "て"}
    assert grammar_ladder.check_build(level, entry["pattern"], built["key"], ["をください"], "fr")["verdict"] in ("close", "wrong")
    assert grammar_ladder.check_build(level, entry["pattern"], built["key"], ["ます"], "fr")["verdict"] == "wrong"


def test_construire_asks_another_sentence_each_turn():
    level, entry, _ = _point("〜てください")
    keys = [grammar_ladder.build_payload(level, entry, "en", turn)["key"] for turn in range(4)]
    assert len(set(keys)) == 4


def test_a_point_in_two_pieces_has_two_gaps():
    level, entry, _ = _point("あまり〜ない")
    built = grammar_ladder.build_payload(level, entry, "en")
    assert [p["gap"] for p in built["pieces"] if "gap" in p] == [0, 1]


def test_the_check_endpoint_judges_and_keeps_nothing(client):
    level, entry, raw_id = _point("〜てください")
    built = grammar_ladder.build_payload(level, entry, "fr", 0)
    r = client.post("/api/grammar/build/check?lang=fr", json={"raw_id": raw_id, "key": built["key"], "answers": ["x"]})
    assert r.status_code == 200 and r.json()["verdict"] == "wrong" and r.json()["furigana"]
    assert client.post("/api/grammar/build/check", json={"raw_id": raw_id, "key": "ex:99", "answers": ["x"]}).status_code == 404
    assert client.post("/api/grammar/build/check", json={"raw_id": "grammar_N5_nope", "key": "ex:0", "answers": ["x"]}).status_code == 404


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


def test_the_particles_the_detector_blanks_can_be_chosen_and_built():
    for level, pattern in (("N5", "を"), ("N5", "に"), ("N5", "で"), ("N5", "が"), ("N5", "か"),
                           ("N4", "〜方"), ("N4", "〜さ"), ("N3", "〜化")):
        assert card_index.contrast_ok(level, pattern), pattern
        assert grammar_ladder.build_ok(level, pattern), pattern
    # は, が and も share too many sentences: は marks none, and stays on
    # the flashcard until it can be written.
    assert not card_index.contrast_ok("N5", "は")


def test_a_particle_on_choisir_is_asked_its_contrast(client):
    level, entry, raw_id = _point("を")
    _clear(raw_id)
    try:
        _place(raw_id, LADDER, STEP_ROWS["choose"])
        card = _served(client, level, raw_id)
        assert card["step"]["group"] == "choose" and card["exercise"] == "grammar.contrast"
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


# ── Served, by step ──────────────────────────────────────────

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


@pytest.mark.parametrize("where,exercise,asked", [
    ("choose", "grammar.contrast", "choose"),
    ("build", "grammar.build", "build"),
    ("mastered", "grammar.flashcard.f2b", "flashcard"),
])
def test_a_card_is_asked_the_exercise_of_its_step(client, where, exercise, asked):
    level, entry, raw_id = _point("〜てください")
    _clear(raw_id)
    try:
        _place(raw_id, LADDER, STEP_ROWS[where])
        card = _served(client, level, raw_id)
        assert card["mode"] == LADDER and card["exercise"] == exercise and card["asked"] == asked
        assert card["step"]["group"] == ("mastered" if where == "mastered" else where)
        if exercise == "grammar.build":
            assert card["build"]["pieces"] and card["build"]["tr"]
            assert (card["step"]["at"], card["step"]["of"]) == (2, 4)
        if exercise == "grammar.contrast":
            assert card["contrast"]["choices"]
            assert (card["step"]["at"], card["step"]["of"]) == (2, 3)
    finally:
        _clear(raw_id)


def test_a_point_with_no_marked_sentence_falls_back(client):
    # は has no contrast sentence: Choisir asks it on fill_in or, where
    # that cannot name it, the flashcard; Construire too, it having no
    # sentence where は can be blanked once.
    level, entry, raw_id = _point("は")
    expected = "grammar.fill_in" if card_index.fill_ok(level, "は") else "grammar.flashcard.f2b"
    _clear(raw_id)
    try:
        _place(raw_id, LADDER, STEP_ROWS["choose"])
        card = _served(client, level, raw_id)
        assert card["exercise"] == expected and card["asked"] in ("choose", "flashcard")
    finally:
        _clear(raw_id)


def test_one_key_reaches_the_log_whatever_was_asked(client):
    level, entry, raw_id = _point("〜てください")
    _clear(raw_id)
    try:
        _place(raw_id, LADDER, STEP_ROWS["build"])
        assert _served(client, level, raw_id)["exercise"] == "grammar.build"
        r = client.post("/api/grammar/review", json={"card_id": raw_id, "mode": LADDER, "quality": 4})
        assert r.status_code == 200, r.text
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT DISTINCT mode FROM review_log WHERE card_id = %s", (f"{DEV_USER_ID}:{raw_id}",))
                assert cur.fetchall() == [(LADDER,)]
                cur.execute("SELECT learning_step FROM card_modes WHERE card_id = %s AND mode = %s",
                            (f"{DEV_USER_ID}:{raw_id}", LADDER))
                assert cur.fetchone() == (5,)
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
        _seed(ka, "grammar.flashcard.f2b", (2, 0, True, 2))
        _seed(ka, "grammar.fill_in", (7, 10, False, 0))
        _seed(kudasai, "grammar.contrast", (4, 2, False, 0))

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
