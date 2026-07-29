import os
from srs.frequency_store import FrequencyOverrideStore

DATABASE_URL = os.environ.get("DATABASE_URL")
frequency_store = FrequencyOverrideStore(DATABASE_URL)