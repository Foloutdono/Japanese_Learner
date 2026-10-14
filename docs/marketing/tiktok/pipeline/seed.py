"""Seed a demo learner with ~5 weeks of simulated study, through the real SRS engine."""
import os, random, sys
from datetime import datetime, timedelta, timezone
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../../../backend'))
os.environ.setdefault('DATABASE_URL', 'postgresql://postgres:dev@localhost:5432/jp')
from core.srs_instance import srs
import psycopg2
from study import teaching_order

UID = sys.argv[1]; NAME = sys.argv[2]; DAYS = int(sys.argv[3]) if len(sys.argv) > 3 else 36
random.seed(7)
now = datetime.now(timezone.utc)

def q(sql, args=()):
    c = psycopg2.connect(os.environ['DATABASE_URL']); c.autocommit = True
    try:
        with c.cursor() as cur:
            cur.execute(sql, args)
            return cur.fetchall() if cur.description else None
    finally: c.close()

start = now - timedelta(days=DAYS)
P = UID + ':%'
for sql in ("DELETE FROM review_log WHERE card_id LIKE %s", "DELETE FROM card_first_review WHERE card_id LIKE %s",
            "DELETE FROM card_modes WHERE card_id LIKE %s", "DELETE FROM cards WHERE id LIKE %s"):
    q(sql, (P,))
for t in ('credit_ledger', 'xp_ledger', 'review_daily'):
    try: q(f"DELETE FROM {t} WHERE user_id=%s", (UID,))
    except Exception as e: print('skip', t, e)
q("DELETE FROM user_profiles WHERE user_id=%s", (UID,))
q("""INSERT INTO user_profiles (user_id, username, created_at, jlpt_level, daily_new_target, onboarded_at, goal_start_level, goal_level,
     goal_target_date, goal_set_at, daily_departure, rating_scale, tz_offset_min, motive, kana_known, lines, tutorial_at, reading_pace)
     VALUES (%s,%s,%s,'N5',15,%s,'N5','N4',%s,%s,'pm','simple',0,'trip','both','{vocab,kanji,grammar}',%s,'standard')""",
  (UID, NAME, start, start, (now + timedelta(days=150)).date(), start, start))

tracks = [
    ('kana', 'hiragana_basic', 'kana.flashcard.f2b', 'kana'),
    ('kana', 'katakana_basic', 'kana.flashcard.f2b', 'kana'),
    ('vocab', 'N5', 'vocab.flashcard.f2b', 'vocab'),
    ('kanji', 'N5', 'kanji.flashcard.f2b', 'kanji'),
    ('grammar', 'N5', 'grammar.ladder', 'grammar'),
]
pools = {t: list(teaching_order.raw_ids(t[0], t[1], t[2])) for t in tracks}
seen = {}  # (card, mode) -> True
STREAK = os.environ.get('STREAK') == '1'
skip_days = set() if STREAK else {DAYS - 3, DAYS - 9, DAYS - 15}  # STREAK: unbroken, and nothing studied today
new_per_day = {'kana': 6, 'vocab': 5, 'kanji': 2, 'grammar': 1}
total = 0
for d in range(DAYS, 0 if STREAK else -1, -1):
    if d in skip_days: continue
    day = now - timedelta(days=d)
    t = day.replace(hour=18, minute=random.randint(0, 50), second=0, microsecond=0)
    if t > now: t = now - timedelta(minutes=30)
    shift = now - t
    # due cards, in simulated time
    due = q("""SELECT card_id, mode FROM card_modes WHERE card_id LIKE %s AND total_reviews > 0 AND next_review - %s <= %s""",
            (UID + ':%', shift, now))
    todo = [(c, m) for c, m in due]
    for tr in tracks:
        kind = tr[3]
        n = new_per_day[kind] if not (kind == 'kana' and tr[1] == 'katakana_basic' and d > DAYS - 12) else 0
        if kind == 'kana' and tr[1] == 'hiragana_basic' and d < DAYS - 12: n = 0
        fresh = [c for c in pools[tr] if (c, tr[2]) not in seen][:n]
        for c in fresh: seen[(c, tr[2])] = True; todo.append((UID + ':' + c, tr[2]))
    random.shuffle(todo)
    for i, (cid, mode) in enumerate(todo):
        qual = random.choices([5, 4, 3, 1], weights=[40, 38, 12, 10])[0]
        srs.review(cid, mode, qual)
        ts = t + timedelta(seconds=9 * i)
        sh = now - ts
        q("UPDATE review_log SET reviewed_at=%s WHERE id=(SELECT max(id) FROM review_log WHERE card_id=%s)", (ts, cid))
        q("UPDATE card_modes SET next_review = next_review - %s WHERE card_id=%s AND mode=%s", (sh, cid, mode))
        total += 1
for tbl in ('xp_ledger',):
    pass
print('reviews', total)
import json as _json
_g = {k: (now - timedelta(days=DAYS)).isoformat() for k in ('today', 'learn', 'practice', 'dictionary', 'profile')}
q("UPDATE user_profiles SET guided=%s WHERE user_id=%s", (_json.dumps(_g), UID))
q("DELETE FROM comprehension_served WHERE user_id=%s", (UID,))
