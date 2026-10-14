"""The demo learner the footage is filmed with.

Runs against a local backend started with DEV_USER_ID (backend/.env) and
its local Postgres: it boards the learner at N5, then studies a few
dozen cards through the app's own review endpoints and spreads the
history over the last two weeks, so the HUD, the stats and Today's gate
show an account that has been used rather than a blank one.

    python seed.py            # API on :8000, DATABASE_URL from backend/.env
"""
import os
import random
import re
import sys

import httpx
import psycopg2

API = os.environ.get("API_URL", "http://localhost:8000")
random.seed(5)
c = httpx.Client(base_url=API, timeout=60)


def post(path, **body):
    r = c.post(path, json=body)
    r.raise_for_status()
    return r.json()


def get(path, **params):
    r = c.get(path, params=params)
    r.raise_for_status()
    return r.json()


c.patch("/api/profile", json={"username": "Haru"}).raise_for_status()
post("/api/onboarding/complete", jlptLevel="N5", dailyNewTarget=10, goalLevel="N4", motive="fun",
     kanaKnown="none", rhythmMin=10, tzOffsetMin=0)
post("/api/onboarding/ride/done", skipped=True)
for gate in ("today", "learn", "practice", "dictionary", "profile"):
    c.post(f"/api/onboarding/guided/{gate}")

# (route, query, mode, cards, passes)
PLAN = [
    ("kana", {"set_name": "hiragana_basic"}, "kana.flashcard.f2b", 46, 2),
    ("kana", {"set_name": "hiragana_basic"}, "kana.write_kana", 20, 1),
    ("vocab", {"level": "N5", "lang": "en"}, "vocab.flashcard.f2b", 96, 2),
    ("kanji", {"level": "N5", "lang": "en"}, "kanji.flashcard.f2b", 30, 2),
]
done = 0
for route, q, mode, want, passes in PLAN:
    got = 0
    seen = []
    while got < want:
        r = get(f"/api/{route}/cards", **q, mode=mode, count=min(25, want - got), beyond_target="true",
                exclude=",".join(seen))
        cards = r.get("cards") or []
        if not cards:
            break
        for card in cards:
            seen.append(card["card_id"])
            for p in range(passes):
                post(f"/api/{route}/review", card_id=card["card_id"], mode=mode,
                     quality=random.choice([3, 4, 4, 4, 5]), prev_stage=card.get("stage") or "new")
            got += 1
    done += got
    print(route, mode, got)

# History: spread over two weeks; some cards due, the rest a few days out.
here = os.path.dirname(os.path.abspath(__file__))
env = open(os.path.join(here, "../../../backend/.env")).read()
dsn = re.search(r"^DATABASE_URL=(.*)$", env, re.M).group(1).strip()
with psycopg2.connect(dsn) as db, db.cursor() as cur:
    cur.execute("UPDATE review_log SET reviewed_at = now() - (random() * interval '13 days') - interval '3 hours'")
    cur.execute("UPDATE card_modes SET next_review = CASE WHEN random() < 0.35 THEN now() - interval '2 hours' "
                "ELSE now() + (1 + random() * 6) * interval '1 day' END")
    # The analyser's shelf holds one earlier passage, so its first screen
    # is a lived-in one, and nothing else the demo learner did leaves a trace.
    cur.execute("DELETE FROM event_log")
    cur.execute("DELETE FROM phrase_history")
    cur.execute("INSERT INTO phrase_history(user_id, phrase, source, created_at) "
                "VALUES ('demo-footage', '今日はあまり寒くないです。', 'typed', now() - interval '1 day')")
print("seeded", done, "cards")
