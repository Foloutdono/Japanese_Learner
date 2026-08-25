import os

os.environ.setdefault("DATABASE_URL", "postgresql://postgres:dev@localhost:5433/jp_test")
os.environ.setdefault("DEV_USER_ID", "test-user")

from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


class TestQueryBounds:
    """One entry per (path, param, cap) from plans/011's table -- confirms
    the FastAPI-level Query bound actually rejects an out-of-range value
    with a 422, and still accepts an in-range one with a 200.

    Named TestQueryBounds (not QueryBoundsTests) so pytest's default
    discovery (classes prefixed `Test`) actually collects it.
    """

    # NOTE: the plan's own example CASES used route paths that don't
    # actually exist ("/api/kana", "/api/vocab", "/api/kanji", "/api/grammar",
    # "/api/profile/leaderboard") -- the real routes are the "/cards"-suffixed
    # forms below, and the leaderboard route is mounted at "/api/leaderboard"
    # (see routes/kana.py:210, routes/vocab.py:243, routes/kanji.py:266,
    # routes/grammar.py:274, routes/profile.py:268). Using the wrong paths
    # would 404 instead of exercising the Query bound, so they're corrected
    # here to the routes actually decorated in backend/routes/*.py.
    #
    # The card endpoints also require a `mode` query param (a separate,
    # unrelated `Depends(require_mode(...))` dependency -- see
    # study/modes.py) with no default, so it's included directly in the
    # base path for those four cases; otherwise a valid `count` alone
    # would still 422 on the missing `mode`, unrelated to what this test
    # is checking.
    CASES = [
        # (path, param, valid_value, over_cap_value)
        ("/api/kana/cards?set_name=hiragana&mode=kana.flashcard.f2b", "count", 10, 100000),
        ("/api/vocab/cards?level=N5&mode=vocab.flashcard.f2b", "count", 10, 100000),
        ("/api/kanji/cards?level=N5&mode=kanji.flashcard.f2b", "count", 10, 100000),
        ("/api/grammar/cards?level=N5&mode=grammar.flashcard.f2b", "count", 10, 100000),
        ("/api/dictionary", "limit", 10, 100000),
        ("/api/leaderboard", "limit", 10, 100000),
    ]

    def test_over_cap_value_returns_422(self):
        for path, param, _valid, over_cap in self.CASES:
            sep = "&" if "?" in path else "?"
            resp = client.get(f"{path}{sep}{param}={over_cap}")
            assert resp.status_code == 422, f"{path} did not reject {param}={over_cap}: got {resp.status_code}"

    def test_negative_value_returns_422(self):
        for path, param, _valid, _over_cap in self.CASES:
            sep = "&" if "?" in path else "?"
            resp = client.get(f"{path}{sep}{param}=-1")
            assert resp.status_code == 422, f"{path} did not reject {param}=-1: got {resp.status_code}"

    def test_in_range_value_is_still_accepted(self):
        for path, param, valid, _over_cap in self.CASES:
            sep = "&" if "?" in path else "?"
            resp = client.get(f"{path}{sep}{param}={valid}")
            assert resp.status_code != 422, f"{path} rejected a valid {param}={valid}: {resp.text}"
