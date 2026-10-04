"""時間割 — the weekly agenda (routes/agenda.py, plan 181).

A learner's timetable of study blocks, replaced whole by PUT. These pin
what the page and the notification planner rely on: a week round-trips
as sent; two blocks on the same day never share a minute (but may
touch); the list is one learner's and nobody else's; a bad block is
refused with a 422 rather than stored; and the days' bit mask is the
same list both ways.
"""

import pytest

from core.auth import DEV_USER_ID
from core.db import db_conn
from routes import agenda
from tests.conftest import OTHER_USER, acting_as


def _wipe(*users):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            for user in users:
                cur.execute("DELETE FROM agenda_blocks WHERE user_id = %s", (user,))
        conn.commit()
    finally:
        conn.close()


@pytest.fixture(autouse=True)
def clean_week():
    _wipe(DEV_USER_ID, OTHER_USER)
    yield
    _wipe(DEV_USER_ID, OTHER_USER)


def block(subject="kanji", days=(0, 1, 2, 3, 4), start=540, end=660, notify=True, lead=10):
    return {"subject": subject, "days": list(days), "start": start, "end": end,
            "notify": notify, "lead": lead}


def put(client, *blocks):
    return client.put("/api/agenda", json={"blocks": list(blocks)})


# ── The pure half ─────────────────────────────────────────────

def test_days_mask_round_trips():
    assert agenda.mask_of([0, 2, 6]) == 0b1000101
    assert agenda.days_of(0b1000101) == [0, 2, 6]
    for days in ([], [3], [0, 1, 2, 3, 4, 5, 6]):
        assert agenda.days_of(agenda.mask_of(days)) == days


def test_subjects_are_the_ones_the_page_can_open():
    assert set(agenda.SUBJECTS) == {
        "review", "kana", "vocab", "kanji", "grammar",
        "reading", "translation", "dictation", "composition", "comprehension", "exam",
    }


def test_overlap_needs_a_shared_day_and_a_shared_minute():
    B = agenda.Block
    mk = lambda days, s, e: B(subject="kanji", days=days, start=s, end=e)  # noqa: E731
    # Same day, crossing.
    assert agenda.find_overlap([mk([0], 540, 660), mk([0], 600, 720)]) == (0, 1)
    # Touching is fine.
    assert agenda.find_overlap([mk([0], 540, 660), mk([0], 660, 720)]) is None
    # Same hours, different days.
    assert agenda.find_overlap([mk([0, 1], 540, 660), mk([2, 3], 540, 660)]) is None
    # One day in common is enough.
    assert agenda.find_overlap([mk([0, 1], 540, 660), mk([1, 2], 600, 700)]) == (0, 1)
    # Contained.
    assert agenda.find_overlap([mk([4], 480, 780), mk([4], 600, 660)]) == (0, 1)


# ── The routes ────────────────────────────────────────────────

def test_an_empty_week_is_empty(client):
    assert client.get("/api/agenda").json() == {"blocks": []}


def test_a_week_round_trips_in_the_order_of_the_day(client):
    reading = block("reading", days=(5,), start=14 * 60, end=16 * 60, lead=30)
    kanji = block("kanji", start=9 * 60, end=11 * 60, notify=False, lead=0)
    out = put(client, reading, kanji)
    assert out.status_code == 200
    blocks = out.json()["blocks"]
    # Earliest first, whatever order they were sent in.
    assert [b["subject"] for b in blocks] == ["kanji", "reading"]
    assert blocks[0]["days"] == [0, 1, 2, 3, 4] and blocks[0]["notify"] is False
    assert blocks[1]["days"] == [5] and blocks[1]["lead"] == 30
    assert (blocks[1]["start"], blocks[1]["end"]) == (840, 960)
    assert all(isinstance(b["id"], int) for b in blocks)
    assert client.get("/api/agenda").json() == {"blocks": blocks}


def test_putting_replaces_the_whole_week(client):
    put(client, block("kanji"), block("reading", days=(5,), start=840, end=960))
    out = put(client, block("grammar", days=(6,), start=600, end=660))
    assert [b["subject"] for b in out.json()["blocks"]] == ["grammar"]
    assert put(client).json() == {"blocks": []}
    assert client.get("/api/agenda").json() == {"blocks": []}


def test_days_arrive_sorted_and_once(client):
    out = put(client, block(days=(4, 0, 2)))
    assert out.json()["blocks"][0]["days"] == [0, 2, 4]


def test_overlapping_blocks_are_refused_and_nothing_is_stored(client):
    put(client, block("vocab", days=(2,), start=480, end=540))
    out = put(client, block("kanji", start=540, end=660), block("reading", days=(2, 3), start=600, end=720))
    assert out.status_code == 422
    assert out.json()["detail"] == {"code": "overlap", "blocks": [0, 1]}
    # The week before is untouched.
    assert [b["subject"] for b in client.get("/api/agenda").json()["blocks"]] == ["vocab"]


@pytest.mark.parametrize("bad", [
    block(subject="deck"),            # not a subject
    block(days=()),                   # no day
    block(days=(7,)),                 # no such day
    block(days=(1, 1)),               # a day twice
    block(start=-5),                  # before midnight
    block(end=1445),                  # past the day
    block(start=541),                 # off the grid
    block(start=540, end=540),        # no length
    block(start=540, end=550),        # shorter than a quarter of an hour
    block(start=660, end=540),        # backwards
    block(lead=7),                    # not one of the leads
])
def test_a_bad_block_is_refused(client, bad):
    assert put(client, bad).status_code == 422
    assert client.get("/api/agenda").json() == {"blocks": []}


def test_the_end_of_the_day_is_a_valid_end(client):
    assert put(client, block(start=22 * 60, end=24 * 60)).status_code == 200


def test_the_week_is_bounded(client):
    # Thirty-nine blocks a day-slice each is fine; forty-one is not.
    # 7 days x 6 slots a day of 2 hours, plus extras, built without overlap.
    ok = [block(days=(d,), start=h * 60, end=h * 60 + 60) for d in range(7) for h in range(5)]
    assert len(ok) == 35
    assert put(client, *ok).status_code == 200
    too_many = [block(days=(d,), start=h * 60, end=h * 60 + 60) for d in range(7) for h in range(6)]
    assert len(too_many) == agenda.MAX_BLOCKS + 2
    assert put(client, *too_many).status_code == 422


def test_each_learner_has_their_own_week(client):
    put(client, block("kanji"))
    with acting_as(OTHER_USER):
        assert client.get("/api/agenda").json() == {"blocks": []}
        put(client, block("reading", days=(6,), start=840, end=960))
        assert [b["subject"] for b in client.get("/api/agenda").json()["blocks"]] == ["reading"]
    assert [b["subject"] for b in client.get("/api/agenda").json()["blocks"]] == ["kanji"]
