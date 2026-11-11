# ── scripts/migrate_handles.py (plan 247b) ──────────────────────────
# The one-shot that gives the accounts that boarded before the handle came
# from the card's name the handle their name spells. Each test makes its own
# learners (never DEV_USER_ID's row) and scopes the script to them, so what
# else is in the test database is never what is being moved.
from datetime import datetime, timezone

import pytest

from core.db import db_conn
from scripts.migrate_handles import migrate, run

_PREFIX = "test-migrate-handles-"
_DAY = datetime(2026, 1, 1, tzinfo=timezone.utc)


@pytest.fixture
def learners():
    """make(n, username, card_name, day) -> user id; every row gone again."""
    made = []

    def make(n, username, card_name, day=0):
        user_id = f"{_PREFIX}{n}"
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO user_profiles(user_id, username, card_name, created_at)
                    VALUES (%s, %s, %s, %s + make_interval(days => %s))
                    """,
                    (user_id, username, card_name, _DAY, day),
                )
            conn.commit()
        finally:
            conn.close()
        made.append(user_id)
        return user_id

    yield make
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM user_profiles WHERE user_id LIKE %s", (f"{_PREFIX}%",))
        conn.commit()
    finally:
        conn.close()


def _username(user_id):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT username FROM user_profiles WHERE user_id = %s", (user_id,))
            return cur.fetchone()[0]
    finally:
        conn.close()


def test_an_account_with_a_name_takes_it_as_its_handle(learners):
    a = learners(1, "LuckyNinja6569", "Mirabelle")
    report = run([a], apply=True)
    assert _username(a) == "Mirabelle"
    assert report["moved"] == [(a, "LuckyNinja6569", "Mirabelle")]
    assert (report["bare"], report["numbered"]) == (1, 0)


def test_the_oldest_account_of_a_name_has_it_bare_and_the_next_a_number(learners):
    newer = learners(1, "SwiftSensei2194", "Mirabelle", day=5)
    older = learners(2, "BoldHikari9135", "mirabelle", day=1)
    report = run([newer, older], apply=True)
    assert _username(older) == "mirabelle"
    assert _username(newer) == "Mirabelle2"
    assert (report["bare"], report["numbered"]) == (1, 1)


def test_a_name_somebody_holds_takes_the_first_number_free_in_any_case(learners):
    learners(1, "MIRABELLE", None)
    learners(2, "mirabelle2", None)
    a = learners(3, "CalmTsuki3872", "Mirabelle")
    run([a], apply=True)
    assert _username(a) == "Mirabelle3"


def test_the_report_changes_nothing_and_is_what_a_run_does(learners):
    a = learners(1, "LuckyNinja6569", "Mirabelle")
    b = learners(2, "QuietSakura496", "Mirabelle", day=3)
    seen = run([a, b], apply=False)
    assert _username(a) == "LuckyNinja6569" and _username(b) == "QuietSakura496"
    done = run([a, b], apply=True)
    assert seen["moved"] == done["moved"]
    assert _username(a) == "Mirabelle" and _username(b) == "Mirabelle2"


def test_a_second_run_finds_nothing_to_move(learners):
    a = learners(1, "LuckyNinja6569", "Mirabelle")
    assert len(run([a], apply=True)["moved"]) == 1
    again = run([a], apply=True)
    assert again["moved"] == []
    assert again["own_handle"] == 1
    assert _username(a) == "Mirabelle"


def test_what_is_not_the_apps_to_rename_is_left_alone(learners):
    chosen = learners(1, "MyOwnHandle", "Mirabelle")
    no_latin = learners(2, "SwiftNinja3579", "さくら")
    mixed_up = learners(3, "SilentSensei973", "مریم")
    empty = learners(4, "SwiftHikari8175", "")
    never_asked = learners(5, "QuietKitsune4", None)
    report = run([chosen, no_latin, mixed_up, empty, never_asked], apply=True)
    assert report["moved"] == []
    assert report["named"] == 3
    assert (report["own_handle"], report["no_latin"]) == (1, 2)
    assert [_username(u) for u in (chosen, no_latin, mixed_up, empty, never_asked)] == [
        "MyOwnHandle", "SwiftNinja3579", "SilentSensei973", "SwiftHikari8175", "QuietKitsune4",
    ]


def test_the_moves_share_one_transaction(learners):
    a = learners(1, "LuckyNinja6569", "Mirabelle")
    b = learners(2, "QuietSakura496", "Philomène", day=1)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            report = migrate(cur, [a, b])
            assert [m[2] for m in report["moved"]] == ["Mirabelle", "Philomene"]
        conn.rollback()
    finally:
        conn.close()
    assert _username(a) == "LuckyNinja6569"
    assert _username(b) == "QuietSakura496"


class _Blind:
    """A cursor that misses the first look at who holds a name, as a
    learner boarding with it between the look and the write would."""

    def __init__(self, cur):
        self.cur, self.looked, self.blind = cur, False, False

    def execute(self, sql, params=None):
        self.cur.execute(sql, params)
        self.blind = "lower(username)" in sql and not self.looked
        self.looked = self.looked or self.blind

    def fetchone(self):
        row = self.cur.fetchone()
        return None if self.blind else row


def test_a_name_taken_between_the_look_and_the_write_takes_a_number_and_keeps_the_moves(learners):
    from routes.profile import claim_handle_with

    first = learners(1, "LuckyNinja6569", "Philomène")
    learners(2, "Mirabelle", None)
    second = learners(3, "QuietSakura496", "Mirabelle")
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            assert claim_handle_with(cur, first, "Philomène") == "Philomene"
            assert claim_handle_with(_Blind(cur), second, "Mirabelle") == "Mirabelle2"
        conn.commit()
    finally:
        conn.close()
    assert _username(first) == "Philomene"
    assert _username(second) == "Mirabelle2"


def test_the_scope_is_the_accounts_named(learners):
    a = learners(1, "LuckyNinja6569", "Mirabelle")
    b = learners(2, "QuietSakura496", "Philomène")
    run([a], apply=True)
    assert _username(a) == "Mirabelle"
    assert _username(b) == "QuietSakura496"
