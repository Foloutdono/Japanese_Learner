import os
from backend.srs.srs import SRSEngine

DATABASE_URL = os.environ.get("DATABASE_URL")
srs = SRSEngine(DATABASE_URL)