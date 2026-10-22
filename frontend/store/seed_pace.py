"""Store screenshots, step 0c (after seed_demo): a learner who answers in tight sittings (14 s a card) with 42 cards due, so Today reads 42 and about 10 min. Local dev database only."""
import os, random, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'backend')); os.chdir(sys.path[0])
from dotenv import load_dotenv; load_dotenv('.env')
from core.db import db_conn
random.seed(11)
UID = 'local-dev-user'
conn = db_conn(); cur = conn.cursor()
# 1. reviews in tight sittings: a day's reviews 12-16 s apart (the pace the forecast reads)
cur.execute("SELECT id FROM review_log WHERE card_id LIKE %s ORDER BY id", (UID + ':%',))
ids = [r[0] for r in cur.fetchall()]
random.shuffle(ids)
per_day = {}
for k, rid in enumerate(ids):
    per_day.setdefault(1 + k % 13, []).append(rid)
for day, rs in per_day.items():
    start_h = random.choice([7, 12, 18, 20])
    t = 0
    for rid in rs:
        t += random.randint(11, 16)
        cur.execute("UPDATE review_log SET reviewed_at = date_trunc('day', NOW()) - (%s || ' days')::interval + (%s || ' hours')::interval + (%s || ' seconds')::interval WHERE id=%s", (day, start_h, t, rid))
# 2. exactly 42 due: kana 12, vocab 19, kanji 7, grammar 4 (rest pushed out)
want = {'kana': 2, 'vocab': 19, 'kanji': 7, 'grammar': 4}
cur.execute("SELECT card_id, mode FROM card_modes WHERE card_id LIKE %s ORDER BY random()", (UID + ':%',))
cms = cur.fetchall(); left = dict(want)
for cid, mode in cms:
    src = cid.split(':', 1)[1].split('_', 1)[0]
    if left.get(src, 0) > 0:
        left[src] -= 1
        cur.execute("UPDATE card_modes SET next_review = NOW() - (%s || ' hours')::interval WHERE card_id=%s AND mode=%s", (random.randint(1, 20), cid, mode))
    else:
        d = random.choice([1, 1, 2, 3, 4, 6, 9, 14])
        cur.execute("UPDATE card_modes SET next_review = NOW() + (%s || ' days')::interval WHERE card_id=%s AND mode=%s", (d, cid, mode))
print('unfilled', left)
conn.commit(); conn.close()
