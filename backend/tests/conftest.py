import os

os.environ.setdefault("DATABASE_URL", "postgresql://postgres:dev@localhost:5433/jp_test")
# setdefault, not assignment: an ambient DEV_USER_ID wins, and CI sets it to
# "ci-test-user". So "test-user" is the FALLBACK, never a fact — a test that
# names it literally in its own setup or teardown is acting on a different
# user than the one its requests run as. That mistake is invisible locally,
# where the fallback happens to be right, and in CI it leaks rows between
# tests: an onboarding profile left behind under the real id made three pace
# assertions read someone else's target, and an uncleared ocr_usage row made
# the rate-limit tests start already throttled. Import DEV_USER_ID from
# core.auth instead; that is the id every request actually resolves to.

import pytest
from fastapi.testclient import TestClient

from main import app


@pytest.fixture(scope="session")
def client():
    return TestClient(app)


# ── A second learner ──────────────────────────────────────────
#
# The library is the first feature in this app where one request reads
# another person's rows, so its tests need two identities. There is only
# one real one: DEV_USER_ID bypasses the token check for every request
# (core/auth.py). Overriding the dependency is the supported way to put
# a different id behind the same TestClient, and it is scoped to a
# `with` block so a test that fails mid-way cannot leak the override
# into the next one.
from contextlib import contextmanager

from core.auth import DEV_USER_ID, get_user_id
from main import app as _app

OTHER_USER = "lib-test-other-learner"


@contextmanager
def acting_as(user_id: str):
    """Run requests as `user_id` for the duration of the block."""
    previous = _app.dependency_overrides.get(get_user_id)
    _app.dependency_overrides[get_user_id] = lambda: user_id
    try:
        yield
    finally:
        if previous is None:
            _app.dependency_overrides.pop(get_user_id, None)
        else:
            _app.dependency_overrides[get_user_id] = previous


@pytest.fixture
def other_user():
    """OTHER_USER, with a profile row so the library can attribute decks
    to a username, and with every row they own removed afterwards."""
    from routes.profile import ensure_profile_row
    ensure_profile_row(OTHER_USER)
    yield OTHER_USER
    _wipe(OTHER_USER)


def _wipe(user_id: str) -> None:
    from core.db import db_conn
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM deck_reports WHERE user_id = %s", (user_id,))
            cur.execute("DELETE FROM deck_subscriptions WHERE user_id = %s", (user_id,))
            # decks cascades to custom_cards, deck_cards and to any
            # subscription other learners hold on them.
            cur.execute("DELETE FROM decks WHERE user_id = %s", (user_id,))
            cur.execute("DELETE FROM card_modes WHERE card_id LIKE %s", (f"{user_id}:%",))
            cur.execute("DELETE FROM card_first_review WHERE card_id LIKE %s", (f"{user_id}:%",))
            cur.execute("DELETE FROM review_log WHERE card_id LIKE %s", (f"{user_id}:%",))
            cur.execute("DELETE FROM cards WHERE id LIKE %s", (f"{user_id}:%",))
            cur.execute("DELETE FROM user_profiles WHERE user_id = %s", (user_id,))
        conn.commit()
    finally:
        conn.close()


@pytest.fixture
def clean_decks():
    """Every deck DEV_USER_ID owns or follows, gone again afterwards."""
    yield
    from core.db import db_conn
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM deck_subscriptions WHERE user_id = %s", (DEV_USER_ID,))
            cur.execute("DELETE FROM deck_reports WHERE user_id = %s", (DEV_USER_ID,))
            cur.execute("DELETE FROM decks WHERE user_id = %s", (DEV_USER_ID,))
        conn.commit()
    finally:
        conn.close()
