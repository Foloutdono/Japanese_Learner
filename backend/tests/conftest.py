import os

os.environ.setdefault("DATABASE_URL", "postgresql://postgres:dev@localhost:5433/jp_test")
os.environ.setdefault("DEV_USER_ID", "test-user")

import pytest
from fastapi.testclient import TestClient

from main import app


@pytest.fixture(scope="session")
def client():
    return TestClient(app)
