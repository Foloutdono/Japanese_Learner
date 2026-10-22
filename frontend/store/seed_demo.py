"""Store screenshots, step 0: give the local dev learner two weeks of believable history. Local dev database only; see README.md."""
import os, random, sys
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'backend'))
os.chdir(sys.path[0])
from dotenv import load_dotenv
load_dotenv('.env')
from core.srs_instance import srs
from core.auth import prefixed
from core.db import db_conn
from study import card_index as ci

UID = 'local-dev-user'
random.seed(7)
plan = [
    ('kana', 'hiragana_basic', 'kana.flashcard.f2b', 46),
    ('kana', 'katakana_basic', 'kana.flashcard.f2b', 20),
    ('vocab', 'N5', 'vocab.flashcard.f2b', 150),
    ('kanji', 'N5', 'kanji.flashcard.f2b', 34),
]
rows = []
for source, deck, mode, n in plan:
    ids = ci.raw_ids(source, deck, mode)[:n]
    print(source, deck, mode, len(ids))
    rows += [(i, mode) for i in ids]
g = ci.raw_ids('grammar', 'N5', 'grammar.ladder')[:9]
print('grammar', len(g))
rows += [(i, 'grammar.ladder') for i in g]

for cid, mode in rows:
    p = prefixed([cid], UID)[0]
    for q in random.choice([(4,), (4, 4), (3, 4, 5), (2, 4, 4), (5, 4, 4, 5)]):
        try:
            srs.review(p, mode, q)
        except Exception as e:
            print('fail', cid, mode, e); break

conn = db_conn(); cur = conn.cursor()
# Spread the review log over the last 13 days (a 13-day streak), a few hours each.
cur.execute("SELECT id FROM review_log WHERE card_id LIKE %s ORDER BY id", (UID + ':%',))
ids = [r[0] for r in cur.fetchall()]
random.shuffle(ids)
for k, rid in enumerate(ids):
    day = 1 + (k % 13)  # 1..13 days ago; today kept clean for the queue
    hour = random.choice([7, 8, 12, 13, 18, 19, 20, 21])
    cur.execute("UPDATE review_log SET reviewed_at = date_trunc('day', NOW()) - (%s || ' days')::interval + (%s || ' hours')::interval + (%s || ' minutes')::interval WHERE id=%s",
                (day, hour, random.randint(0, 50), rid))
# Schedules: ~60 due now or earlier, the rest spread over the coming week; the older ones mature.
cur.execute("SELECT card_id, mode FROM card_modes WHERE card_id LIKE %s ORDER BY random()", (UID + ':%',))
cms = cur.fetchall()
for k, (cid, mode) in enumerate(cms):
    if k < 63:
        cur.execute("UPDATE card_modes SET next_review = NOW() - (%s || ' hours')::interval WHERE card_id=%s AND mode=%s", (random.randint(1, 30), cid, mode))
    else:
        d = random.choice([1, 1, 2, 2, 3, 4, 5, 6, 9, 12, 20])
        cur.execute("UPDATE card_modes SET next_review = NOW() + (%s || ' days')::interval, interval_days=GREATEST(interval_days, %s), is_learning=false WHERE card_id=%s AND mode=%s", (d, d, cid, mode))
conn.commit(); conn.close()
srs.forget_history(UID)
print('seeded', len(rows))
