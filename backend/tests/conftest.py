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
