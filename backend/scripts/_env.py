"""
Loads backend/.env, the way main.py does for the API.

Import this FIRST in any script under scripts/ that talks to the database
or an external API. The ordering is load-bearing, not stylistic:
core/db.py reads DATABASE_URL at module scope

    DATABASE_URL = os.environ.get("DATABASE_URL")

so by the time `from core.db import db_conn` has run, the value is already
fixed. Loading the file afterwards sets os.environ and changes nothing, and
the script fails with psycopg2's "fe_sendauth: no password supplied" --
which reads like a Postgres auth problem rather than an unset variable.

Scripts are run by hand from a shell that has not sourced anything, unlike
the API which loads .env in main.py before importing its routers. That
difference is the entire reason this exists.

Nothing is exported; the import itself is the effect:

    import scripts._env  # noqa: F401  -- must precede core/study imports
"""
import os
from pathlib import Path

from dotenv import load_dotenv

_ENV_FILE = Path(__file__).resolve().parents[1] / ".env"

# override=False: a variable already set in the shell wins, so a one-off
# `DATABASE_URL=... python -m scripts.foo` still does what it looks like.
load_dotenv(_ENV_FILE, override=False)

if not os.environ.get("DATABASE_URL"):
    # Said plainly here rather than surfacing 40 lines later as a psycopg2
    # authentication error against localhost.
    raise SystemExit(
        f"DATABASE_URL is not set, and none was found in {_ENV_FILE}.\n"
        "Set it in backend/.env, or pass it in the environment."
    )
