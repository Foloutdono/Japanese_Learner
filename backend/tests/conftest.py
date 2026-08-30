import os

os.environ.setdefault("DATABASE_URL", "postgresql://postgres:dev@localhost:5433/jp_test")
os.environ.setdefault("DEV_USER_ID", "test-user")

import pytest
from fastapi.testclient import TestClient

from main import app

# Who every request in this suite is. Read back out of the environment
# rather than written down a second time: CI sets DEV_USER_ID to
# "ci-test-user", so a test that resets the state of a hardcoded
# "test-user" resets nothing there. That is how a persistent OCR
# counter and a stored pace target leaked between tests on CI, and
# only on CI -- five failures no local run could reproduce.
TEST_USER_ID = os.environ["DEV_USER_ID"]


@pytest.fixture(scope="session")
def client():
    return TestClient(app)
