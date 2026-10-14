#!/bin/bash
# The demo learner, armed for the run: 29 days in a row ending yesterday,
# nothing studied today, three cards due, and 5 XP short of the next level,
# so the first Correct levels up and finishing the run is the 30th day.
U=${1:-22222222-2222-4222-8222-222222222222}
cd "$(dirname "$0")"
STREAK=1 ${PYTHON:-python} seed.py "$U" Mika 29
psql -q "${DATABASE_URL:-postgresql://postgres:dev@localhost:5432/jp}" <<SQL
UPDATE user_profiles SET daily_new_target = 0 WHERE user_id = '$U';
WITH keep AS (SELECT card_id, mode FROM card_modes WHERE card_id LIKE '$U:vocab%' AND mode='vocab.flashcard.f2b'
              AND total_reviews>0 AND next_review <= now() ORDER BY next_review LIMIT 3)
UPDATE card_modes c SET next_review = now() + interval '1 day'
 WHERE c.card_id LIKE '$U:%' AND c.total_reviews > 0 AND c.next_review <= now() + interval '6 hours'
   AND (c.card_id, c.mode) NOT IN (SELECT card_id, mode FROM keep);
SQL
# XP to 5 short of the next level, on the newest review row
read XP NEXT < <(curl -s localhost:8000/api/profile | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['xp'], d['xpForNext'])")
psql -q "${DATABASE_URL:-postgresql://postgres:dev@localhost:5432/jp}" -c "UPDATE review_log SET xp_earned = xp_earned + $((NEXT - XP - 5)) WHERE id = (SELECT max(id) FROM review_log WHERE card_id LIKE '$U:%')"
