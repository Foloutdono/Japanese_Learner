"""番付 (plan 262): one ranked list per board, paged whole; the reader's
own place, the rows around it and the gap to the next; the calendar
week and its podium; the divisions and their Monday; the moves since the
day began; the level filter; keeping off the board; a row's card.

The clock is set years ahead, so the week and division boards hold only
the XP these tests write; the lifetime board's learners are given more
XP than any other test writes, so they stand at its top."""
from datetime import datetime, timedelta, timezone

import pytest

from core.auth import DEV_USER_ID
from core.db import db_conn
from study import banzuke
from tests.conftest import acting_as

NOW = datetime(2031, 3, 5, 12, 0, tzinfo=timezone.utc)  # a Wednesday
START = banzuke.week_start(NOW)
BIG = 10**9
PREFIX = "bz-test-"


def _uid(n: int) -> str:
    return f"{PREFIX}{n:02d}"


def _sql(statement: str, params=()) -> list:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(statement, params)
            rows = cur.fetchall() if cur.description else []
        conn.commit()
        return rows
    finally:
        conn.close()


def _wipe_board() -> None:
    _sql("DELETE FROM xp_ledger WHERE user_id LIKE %s OR source = 'bz-test'", (f"{PREFIX}%",))
    _sql("DELETE FROM user_profiles WHERE user_id LIKE %s", (f"{PREFIX}%",))
    _sql("DELETE FROM decks WHERE user_id LIKE %s", (f"{PREFIX}%",))
    for table in ("banzuke_division", "banzuke_rank", "banzuke_marks"):
        _sql(f"DELETE FROM {table}")
    _sql("UPDATE user_profiles SET board_hidden = FALSE, jlpt_level = NULL WHERE user_id = %s", (DEV_USER_ID,))
    banzuke.forget()


@pytest.fixture
def board(monkeypatch, client):
    client.get("/api/profile")  # the reader's own profile row
    _wipe_board()
    clock = {"now": NOW}
    monkeypatch.setattr(banzuke, "_now", lambda: clock["now"])
    yield clock
    _wipe_board()


def _learner(n: int, level: str | None = None, hidden: bool = False) -> str:
    uid = _uid(n)
    _sql(
        "INSERT INTO user_profiles (user_id, username, jlpt_level, board_hidden) VALUES (%s, %s, %s, %s)",
        (uid, f"Bz{n:02d}", level, hidden),
    )
    return uid


def _xp(uid: str, xp: int, at: datetime = NOW) -> None:
    _sql("INSERT INTO xp_ledger (user_id, source, xp, awarded_at) VALUES (%s, 'bz-test', %s, %s)", (uid, xp, at))
    banzuke.forget()


def _get(client, **params):
    response = client.get("/api/leaderboard", params=params)
    assert response.status_code == 200, response.text
    return response.json()


def test_the_board_is_one_list_paged_whole(client, board):
    for n in range(1, 8):
        _xp(_learner(n), BIG + 100 * n)
    _xp(_learner(8), BIG + 700)  # ties Bz07: the id breaks it
    first = _get(client, period="all", limit=3)
    assert [e["username"] for e in first["entries"]] == ["Bz07", "Bz08", "Bz06"]
    assert [e["rank"] for e in first["entries"]] == [1, 2, 3]
    second = _get(client, period="all", limit=3, offset=3)
    assert [e["username"] for e in second["entries"]] == ["Bz05", "Bz04", "Bz03"]
    assert [e["rank"] for e in second["entries"]] == [4, 5, 6]
    assert first["total"] == second["total"] >= 8


def test_the_readers_row_brings_its_neighbours_and_its_gap(client, board):
    for n in range(1, 6):
        _xp(_learner(n), 100 * n)
    _xp(DEV_USER_ID, 250)  # between Bz02 (200) and Bz03 (300)
    week = _get(client, period="week", limit=2, around=1)
    me = week["me"]
    assert me["rank"] == 4 and me["xp"] == 250
    assert [e["username"] for e in week["near"]] == ["Bz03", me["username"], "Bz02"]
    assert me["gap"] == {"xp": 51, "username": "Bz03"}
    # The same place on every page, and in the list itself.
    page = _get(client, period="week", limit=10)
    assert next(e["rank"] for e in page["entries"] if e["username"] == me["username"]) == 4


def test_the_week_is_the_calendar_week_and_the_last_one_gives_its_podium(client, board):
    a, b, c, d = (_learner(n) for n in range(1, 5))
    sunday = START - timedelta(hours=1)
    _xp(a, 900, sunday)
    _xp(b, 800, sunday)
    _xp(c, 700, sunday)
    _xp(d, 600, sunday)
    _xp(d, 10)
    week = _get(client, period="week")
    assert [e["username"] for e in week["entries"]] == ["Bz04"]
    assert [(c["rank"], c["username"], c["xp"]) for c in week["champions"]] == [
        (1, "Bz01", 900), (2, "Bz02", 800), (3, "Bz03", 700),
    ]
    assert week["week"]["start"] == START.isoformat()


def test_a_learner_off_the_board_is_in_no_one_elses_list_and_still_sees_their_place(client, board):
    _xp(_learner(1), 300)
    hidden = _learner(2, hidden=True)
    _xp(hidden, 500)
    _xp(DEV_USER_ID, 100)
    mine = _get(client, period="week")
    assert [e["username"] for e in mine["entries"]] == ["Bz01", mine["me"]["username"]]
    assert mine["me"]["rank"] == 2
    with acting_as(hidden):
        theirs = _get(client, period="week")
        assert theirs["hidden"] is True
        assert theirs["me"]["rank"] == 1 and theirs["me"]["username"] == "Bz02"
        assert client.get("/api/leaderboard/learner/Bz02").status_code == 200
    assert client.get("/api/leaderboard/learner/Bz02").status_code == 404


def test_the_switch_is_the_accounts(client, board):
    assert client.get("/api/profile").json()["boardHidden"] is False
    assert client.patch("/api/profile/learning", json={"boardHidden": True}).status_code == 200
    assert client.get("/api/profile").json()["boardHidden"] is True
    _xp(DEV_USER_ID, 50)
    with acting_as(_learner(1)):
        assert _get(client, period="week")["entries"] == []


def test_the_level_board_holds_the_readers_level_only(client, board):
    _sql("UPDATE user_profiles SET jlpt_level = 'N4' WHERE user_id = %s", (DEV_USER_ID,))
    _xp(_learner(1, "N4"), 300)
    _xp(_learner(2, "N5"), 400)
    _xp(DEV_USER_ID, 100)
    level = _get(client, period="week", scope="level")
    assert [e["username"] for e in level["entries"]] == ["Bz01", level["me"]["username"]]
    assert level["level"] == "N4"
    assert len(_get(client, period="week")["entries"]) == 3


def test_monday_sends_the_top_fifth_up_and_the_idle_down(client, board):
    last_week = START - timedelta(days=7)
    _sql("INSERT INTO banzuke_marks (kind, at) VALUES ('week', %s)", (last_week.date(),))
    rows = []
    for n in range(1, 11):
        uid = _learner(n)
        rows.append((uid, last_week.date(), 0))
        _xp(uid, 100 * n, last_week + timedelta(days=1))
    idle_high, idle_foot = _learner(11), _learner(12)
    rows += [(idle_high, last_week.date(), 3), (idle_foot, last_week.date(), 0)]
    for uid, week, division in rows:
        _sql("INSERT INTO banzuke_division (user_id, week, division) VALUES (%s, %s, %s)", (uid, week, division))
    _get(client, period="division")
    table = dict(_sql("SELECT user_id, division FROM banzuke_division WHERE week = %s", (START.date(),)))
    # The foot held eleven (the idle one too): its top fifth, rounded up.
    assert [table[_uid(n)] for n in (10, 9, 8, 7)] == [1, 1, 1, 0]
    assert table[idle_high] == 2  # earned nothing above the foot
    assert idle_foot not in table  # idle at the foot: off the table
    moved = dict(_sql("SELECT user_id, moved FROM banzuke_division WHERE week = %s", (START.date(),)))
    assert moved[_uid(10)] == 1 and moved[idle_high] == -1
    # Settled once: a second board does not move anyone again.
    banzuke.forget()
    _get(client, period="division")
    assert dict(_sql("SELECT user_id, division FROM banzuke_division WHERE week = %s", (START.date(),))) == table


def test_the_division_board_ranks_the_readers_division_with_its_zones(client, board):
    for n in range(1, 6):
        uid = _learner(n)
        _sql("INSERT INTO banzuke_division (user_id, week, division) VALUES (%s, %s, 2)", (uid, START.date()))
        _xp(uid, 100 * n)
    _sql("INSERT INTO banzuke_marks (kind, at) VALUES ('week', %s)", (START.date(),))
    _sql("INSERT INTO banzuke_division (user_id, week, division, moved) VALUES (%s, %s, 2, 1)", (DEV_USER_ID, START.date()))
    _xp(DEV_USER_ID, 50)
    body = _get(client, period="division")
    assert body["division"]["index"] == 2 and body["division"]["key"] == "sandanme"
    assert body["division"]["moved"] == 1
    assert body["total"] == 6
    zones = {e["username"]: e["zone"] for e in body["entries"]}
    assert zones["Bz05"] == 1 and zones[body["me"]["username"]] == -1
    # The foot holds a new learner at nought, ranked.
    with acting_as(_learner(9)):
        foot = _get(client, period="division")
        assert foot["division"]["index"] == 0 and foot["me"]["rank"] == 1
    # Another division, browsed.
    assert _get(client, period="division", division=0)["division"]["index"] == 0


def test_a_row_shows_how_far_it_moved_since_the_day_began(client, board):
    a, b = _learner(1), _learner(2)
    _xp(a, BIG + 200)
    _xp(b, BIG + 100)
    before = _get(client, period="all")
    assert [e["move"] for e in before["entries"][:2]] == [0, 0]
    _xp(b, 500)
    after = _get(client, period="all")
    moves = {e["username"]: e["move"] for e in after["entries"][:2]}
    assert moves == {"Bz02": 1, "Bz01": -1}


def test_a_rows_card_is_what_the_board_and_the_library_already_say(client, board):
    uid = _learner(1, "N3")
    _xp(uid, 300)
    _sql(
        "INSERT INTO decks (user_id, name, visibility, published_at) VALUES (%s, 'Shown', 'public', NOW()), "
        "(%s, 'Private', 'private', NULL)",
        (uid, uid),
    )
    card = client.get("/api/leaderboard/learner/Bz01").json()
    assert card["username"] == "Bz01"
    # What the board already says, and nothing it does not.
    assert "jlptLevel" not in card and "streak" not in card
    assert card["weekXp"] == 300 and card["places"]["week"] == 1
    assert [d["name"] for d in card["decks"]] == ["Shown"]
    assert card["division"] == {"index": 0, "key": "jonokuchi"}
    assert client.get("/api/leaderboard/learner/Nobody_here").status_code == 404
    assert client.get("/api/leaderboard/learner/a%20b").status_code == 422


def test_zones_spare_the_foot_and_the_top():
    order = [("a", 50), ("b", 0)]
    assert banzuke.zones(order, 0) == {"a": 1}
    assert banzuke.zones(order, banzuke.TOP) == {"b": -1}
