"""
The learner the landing page's footage is filmed on (plan 283).

    python -m scripts.footage_learner                   # report only, changes nothing
    python -m scripts.footage_learner --seed --yes      # board, study a month, keep it
    python -m scripts.footage_learner --restore --yes   # put it back as kept, moved on to now

FOOTAGE_DATABASE_URL names the database, and it must be a local one
(localhost or a socket) that holds nobody else: this script rewrites
every timestamp in it. --seed wants it empty (createdb), and lays
srs/data_structure.sql in it first. frontend/landing/footage/film.mjs
runs --restore before each clip; frontend/landing/README.md, "Footage",
has the rest.

WHY THIS EXISTS
---------------
A clip of the app is only as good as the account in it. A fresh one
shows an empty gate, no streak and a level of 1; a real learner's
cannot be filmed. So this one is made the way a learner is: boarded at
N5 with N4 as the goal (the beginner's path, kana included), then
DAYS days of study answered through the app's own routes, each day's
queue cleared as the gate serves it. Between two days every timestamp
in the database moves back one day, so the month ends yesterday and
today has its reviews due.

WHAT IT CHANGES AFTER THE MONTH
-------------------------------
- The answers of a day are spaced 7 seconds apart: the simulation
  answers in milliseconds, and the gate's "≈ 7 min" is read off those
  gaps (srs._review_pace).
- The XP is cut to XP_KEPT of itself. A month of days cleared without
  fail pays a level (60) that reads as a year's; the cut leaves the
  level of the same month studied more gently (27).
- Part of today is answered, down to TODAY_LEFT cards, so the gate
  shows a day under way and no catch-up offer.
- The fare card is filled, the interface is French, and the
  early-access rating and the transfer offer are marked as already
  asked, so no sheet opens over a clip.

Then the database is dumped (pg_dump) beside its time, in
datas/footage/ (gitignored). --restore puts the dump back and moves
every timestamp on by the time since, so each clip opens on the same
gate whatever the hour it is filmed at.
"""
import argparse
import json
import os
import random
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

USER = "footage-learner"
DAYS = 30
TODAY_LEFT = 62
XP_KEPT = 0.27
SPACING_S = 7
LOCAL_HOSTS = {"", "localhost", "127.0.0.1", "::1"}
KEEP = Path(__file__).resolve().parent.parent / "datas" / "footage"
DUMP = KEEP / "learner.dump"
STAMP = KEEP / "learner.json"
SCHEMA = Path(__file__).resolve().parent.parent / "srs" / "data_structure.sql"

# Every timestamp column of every table, moved by an interval: what
# both the month's days and --restore move.
_SHIFT = """
DO $$ DECLARE r record; BEGIN
FOR r IN SELECT c.table_name, c.column_name FROM information_schema.columns c
  JOIN information_schema.tables t USING (table_schema, table_name)
  WHERE c.table_schema = 'public' AND t.table_type = 'BASE TABLE'
    AND c.data_type IN ({types}) LOOP
  EXECUTE format('UPDATE %I SET %I = %I + ''{by}''::interval WHERE %I IS NOT NULL',
                 r.table_name, r.column_name, r.column_name, r.column_name);
END LOOP; END $$;
"""
_STAMPS = "'timestamp with time zone', 'timestamp without time zone'"
_ALL = _STAMPS + ", 'date'"


def database_url() -> str:
    url = os.environ.get("FOOTAGE_DATABASE_URL", "")
    if not url:
        sys.exit("FOOTAGE_DATABASE_URL is unset: name a local database this script may rewrite.")
    host = urlparse(url).hostname
    if host is not None and host not in LOCAL_HOSTS:
        sys.exit(f"Refused: {host} is not local. This script rewrites every timestamp it finds.")
    return url


def connect(url: str):
    import psycopg2
    conn = psycopg2.connect(url)
    conn.autocommit = True
    return conn


def shift(conn, days: int = 0, seconds: int = 0, types: str = _STAMPS) -> None:
    def run(d, s):
        with conn.cursor() as cur:
            cur.execute(_SHIFT.format(types=types, by=f"{d} days {s} seconds"))
    try:
        run(days, seconds)
    except Exception:
        # A unique key on a date (day_clears) collides row by row when
        # every day moves one step: go round through a far offset.
        run(-10000, 0)
        run(10000 + days, seconds)


def others(conn) -> list[str]:
    with conn.cursor() as cur:
        cur.execute("SELECT to_regclass('public.user_profiles')")
        if cur.fetchone()[0] is None:
            return []
        cur.execute("SELECT user_id FROM user_profiles WHERE user_id <> %s", (USER,))
        return [r[0] for r in cur.fetchall()]


def seed(url: str) -> None:
    conn = connect(url)
    with conn.cursor() as cur:
        cur.execute("SELECT to_regclass('public.user_profiles')")
        if cur.fetchone()[0] is None:
            # A fresh database: the whole schema first, as CLAUDE.md's
            # "Local Postgres" stands one up. Not every table is made by
            # its module on import (phrase_history is not), and the
            # analyser needs that one.
            cur.execute(SCHEMA.read_text())
    os.environ["DATABASE_URL"] = url
    os.environ["DEV_USER_ID"] = USER
    from fastapi.testclient import TestClient
    import main
    from core.srs_instance import srs
    import core.credits
    import core.user_level

    c = TestClient(main.app)
    rng = random.Random(7)
    if others(conn):
        sys.exit("Refused: the database holds other learners. Use one of its own.")

    def ok(r):
        if r.status_code >= 400:
            sys.exit(f"{r.request.method} {r.request.url} -> {r.status_code} {r.text[:300]}")
        return r.json()

    def forget():
        srs.forget_all_history()
        core.credits._cache.clear()
        core.user_level._cache.clear()

    def quality():
        x = rng.random()
        return 5 if x < 0.2 else 4 if x < 0.82 else 3 if x < 0.9 else 1

    def answer(card):
        return c.post("/api/today/review", json={"card_id": card["card_id"], "mode": card["mode"],
                                                 "quality": quality(), "prev_stage": card.get("stage")})

    ok(c.post("/api/onboarding/complete", json={
        "jlptLevel": "N5", "goalLevel": "N4", "goalTargetDate": "2027-07-04", "dailyNewTarget": 15,
        "dailyDeparture": "pm", "motive": "trip", "notifications": False, "tzOffsetMin": 0,
        "lines": ["vocab", "kanji", "grammar"], "cardName": "Hana",
    }))
    ok(c.post("/api/onboarding/ride/done", json={"skipped": True}))
    for gate in ("today", "learn", "practice", "dictionary", "profile"):
        c.post(f"/api/onboarding/guided/{gate}")
    shift(conn, days=-1, types=_ALL)
    forget()

    for day in range(DAYS, 0, -1):
        done, held = 0, []
        while done < 150:
            cards = ok(c.get("/api/today/cards", params={"count": 10, "exclude": ",".join(held)}))["cards"]
            if not cards:
                break
            for card in cards:
                if answer(card).status_code >= 400:
                    held.append(f"{card['card_id']}|{card['mode']}")
                else:
                    done += 1
        cleared = c.post("/api/today/clear").json().get("cleared")
        print(f"  day -{day}: {done} answers, cleared={cleared}")
        shift(conn, days=-1, types=_ALL)
        forget()

    with conn.cursor() as cur:
        cur.execute("UPDATE review_log SET xp_earned = round(xp_earned * %s)", (XP_KEPT,))
        cur.execute("UPDATE xp_ledger SET xp = round(xp * %s)", (XP_KEPT,))
        cur.execute(f"""
            WITH r AS (SELECT id, row_number() OVER (PARTITION BY date_trunc('day', reviewed_at) ORDER BY reviewed_at, id) n,
                              min(reviewed_at) OVER (PARTITION BY date_trunc('day', reviewed_at)) m
                       FROM review_log)
            UPDATE review_log l SET reviewed_at = r.m - interval '20 minutes' + r.n * interval '{SPACING_S} seconds'
                                                 + random() * interval '4 seconds'
            FROM r WHERE l.id = r.id""")
    forget()

    today = 0
    while ok(c.get("/api/today"))["total"] > TODAY_LEFT:
        cards = ok(c.get("/api/today/cards", params={"count": 5}))["cards"]
        if not cards:
            break
        answer(cards[0])
        today += 1
    with conn.cursor() as cur:
        cur.execute(f"""
            WITH r AS (SELECT id, row_number() OVER (ORDER BY reviewed_at DESC, id DESC) k FROM review_log
                       WHERE reviewed_at > NOW() - interval '1 hour')
            UPDATE review_log l SET reviewed_at = NOW() - interval '3 hours' - r.k * interval '{SPACING_S + 1} seconds'
            FROM r WHERE l.id = r.id""")
        cur.execute("SELECT COALESCE(SUM(delta), 0) FROM credit_ledger WHERE user_id = %s", (USER,))
        balance = cur.fetchone()[0]
        # A full card: below the day's fare the gate says how many cards
        # wait for credits, which is no thing to film.
        if balance < core.credits.CAP:
            cur.execute("INSERT INTO credit_ledger (user_id, delta, reason, ref) VALUES (%s, %s, 'adjust', 'footage')",
                        (USER, core.credits.CAP - balance))
        cur.execute("""UPDATE user_profiles SET ui_lang = 'fr', feedback_asked_at = NOW(),
                       transfer_offered_at = NOW() WHERE user_id = %s""", (USER,))
    forget()
    gate = ok(c.get("/api/today"))
    print(f"  today: {today} answered, {gate['total']} left {gate['by_source']}, "
          f"{gate['seconds_per_review']} s a card, streak {gate['day_clear']['preview']['streak']}")

    KEEP.mkdir(parents=True, exist_ok=True)
    subprocess.run(["pg_dump", "-Fc", "-f", str(DUMP), url], check=True)
    STAMP.write_text(json.dumps({"kept_at": datetime.now(timezone.utc).isoformat()}))
    print(f"Kept in {DUMP}.")


def restore(url: str) -> None:
    if not DUMP.exists():
        sys.exit(f"Nothing kept yet: run --seed --yes first ({DUMP}).")
    kept_at = datetime.fromisoformat(json.loads(STAMP.read_text())["kept_at"])
    conn = connect(url)
    if others(conn):
        sys.exit("Refused: the database holds other learners. Use one of its own.")
    conn.close()
    subprocess.run(["pg_restore", "--clean", "--if-exists", "--no-owner", "-d", url, str(DUMP)], check=True)
    now = datetime.now(timezone.utc)
    since = now - kept_at
    conn = connect(url)
    shift(conn, seconds=int(since.total_seconds()))
    # A date column is a calendar day (UTC, as the server keeps them):
    # it moves by the days the calendar turned, not by the hours.
    days = (now.date() - kept_at.date()).days
    if days:
        shift(conn, days=days, types="'date'")
    print(f"Restored, moved on by {since}.")


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    p.add_argument("--seed", action="store_true", help="board the learner, play the month, keep it")
    p.add_argument("--restore", action="store_true", help="put the kept learner back, moved on to now")
    p.add_argument("--yes", action="store_true", help="do it (without it, report only)")
    a = p.parse_args()
    url = database_url()
    host = urlparse(url).hostname or "a local socket"
    kept = json.loads(STAMP.read_text())["kept_at"] if STAMP.exists() else None
    if not a.yes or not (a.seed or a.restore):
        print(f"Database: {urlparse(url).path.lstrip('/')} on {host}. Learner: {USER}.")
        print(f"Kept: {kept or 'nothing yet'} ({DUMP}).")
        print("--seed --yes boards and plays the month; --restore --yes puts the kept one back.")
        return
    seed(url) if a.seed else restore(url)


if __name__ == "__main__":
    main()
