import os
from srs import SRSEngine

DATABASE_URL = os.environ.get("DATABASE_URL")
srs = SRSEngine(DATABASE_URL)