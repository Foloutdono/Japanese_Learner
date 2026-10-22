"""The interface language a learner chose is the account's, not only the
browser's: a browser forgets (cleared storage, a second device), and an
English learner was then switched back to French. GET /api/profile hands
the choice back, PATCH /api/profile/learning writes it, and nothing else
does (frontend/src/lib/langChoice.js)."""
import pytest

from core.auth import DEV_USER_ID
from core.db import db_conn


def _set(value):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("UPDATE user_profiles SET ui_lang = %s WHERE user_id = %s", (value, DEV_USER_ID))
        conn.commit()
    finally:
        conn.close()


@pytest.fixture(autouse=True)
def _clean(client):
    client.get("/api/profile")   # seeds the row
    _set(None)
    yield
    _set(None)


def test_a_learner_who_never_chose_has_no_language(client):
    assert client.get("/api/profile").json()["uiLang"] is None


def test_the_choice_is_kept_on_the_account(client):
    r = client.patch("/api/profile/learning", json={"uiLang": "en"})
    assert r.status_code == 200 and r.json()["uiLang"] == "en"
    assert client.get("/api/profile").json()["uiLang"] == "en"
    client.patch("/api/profile/learning", json={"uiLang": "fr"})
    assert client.get("/api/profile").json()["uiLang"] == "fr"


def test_another_setting_never_moves_it(client):
    client.patch("/api/profile/learning", json={"uiLang": "en"})
    client.patch("/api/profile/learning", json={"readingPace": "slow"})
    client.patch("/api/profile/learning", json={"tzOffsetMin": 60})
    assert client.get("/api/profile").json()["uiLang"] == "en"


@pytest.mark.parametrize("value", ["de", "EN", "", "fr-FR"])
def test_a_language_the_app_does_not_speak_is_refused(client, value):
    client.patch("/api/profile/learning", json={"uiLang": "en"})
    assert client.patch("/api/profile/learning", json={"uiLang": value}).status_code == 422
    assert client.get("/api/profile").json()["uiLang"] == "en"
