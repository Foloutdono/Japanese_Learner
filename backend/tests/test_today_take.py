# ── 区間 — a run of a chosen length, and what a review takes (plan 135) ──
# The desk's fare gate offers 20 / 50 / 100 / all. It splits the length
# over the chosen lanes the way the queue deals, and the run hands each
# lane's remaining figure back as `quota` (less what it has answered
# and what it holds); the server keeps those lanes and cuts each to it. Beside the count, the gate prints what
# the run will take, from the median gap between this learner's reviews.
from collections import OrderedDict
from datetime import datetime, timedelta, timezone

from core.db import db_conn
from core.srs_instance import srs
from study import card_index, daily_queue
from study.daily_queue import SECTION
from srs.srs import PACE_BREAK, PACE_MIN_GAPS, seconds_per_review

# The HTTP half boards a user of its own, as the ration tests do.
from tests.test_today_ration import RATION_USER, _board, client  # noqa: F401  (fixture)

K_VOCAB = (SECTION, "vocab", "N5", "vocab.flashcard.f2b")
K_KANJI = (SECTION, "kanji", "N5", "kanji.flashcard.f2b")
F2B = "vocab.flashcard.f2b"


# ── The pure part ─────────────────────────────────────────────────

def test_parse_quota_reads_the_figure_after_the_last_colon():
    assert daily_queue.parse_quota("s~kanji~N5~kanji.flashcard.f2b:3,p~7~m:0") == {
        "s~kanji~N5~kanji.flashcard.f2b": 3, "p~7~m": 0,
    }
    # Malformed parts are skipped, a negative figure is zero.
    assert daily_queue.parse_quota("nocolon,:4,a:x,b:-2") == {"b": 0}
    assert daily_queue.parse_quota("") == {}


def test_keep_quota_cuts_each_lane_and_drops_the_rest():
    lanes = OrderedDict([(K_VOCAB, ["v1", "v2", "v3"]), (K_KANJI, ["k1", "k2"])])
    vocab, kanji = daily_queue.lane_id(K_VOCAB), daily_queue.lane_id(K_KANJI)
    out = daily_queue.keep_quota(lanes, {vocab: 2, kanji: 0})
    # Urgency order kept, a lane at zero gone.
    assert list(out.items()) == [(K_VOCAB, ["v1", "v2"])]
    # A lane the quota does not name is not served.
    assert daily_queue.keep_quota(lanes, {kanji: 9}) == OrderedDict([(K_KANJI, ["k1", "k2"])])


def _at(*seconds):
    t0 = datetime(2026, 9, 25, 9, tzinfo=timezone.utc)
    return [t0 + timedelta(seconds=s) for s in seconds]


def test_the_pace_is_the_median_short_gap():
    # 20 gaps of 10s, one of 12s, and a pause the median never sees.
    times = [i * 10 for i in range(21)] + [200 + 12, 200 + 12 + PACE_BREAK + 500]
    assert seconds_per_review(_at(*times)) == 10
    # Order does not matter.
    assert seconds_per_review(list(reversed(_at(*times)))) == 10


def test_the_pace_waits_for_enough_gaps():
    assert seconds_per_review(_at(*[i * 8 for i in range(PACE_MIN_GAPS)])) is None
    assert seconds_per_review(_at(*[i * 8 for i in range(PACE_MIN_GAPS + 1)])) == 8
    assert seconds_per_review([]) is None


# ── The queue ─────────────────────────────────────────────────────

def test_a_quota_serves_exactly_its_split(client):  # noqa: F811
    _board(client, "N4", "both", 6, ["vocab", "kanji"])
    today = client.get("/api/today").json()
    by = {l["source"]: l["id"] for l in today["lanes"]}
    assert set(by) == {"vocab", "kanji"}
    cards = client.get(f"/api/today/cards?count=10&quota={by['vocab']}:2,{by['kanji']}:1").json()["cards"]
    assert sorted(c["source"] for c in cards) == ["kanji", "vocab", "vocab"]
    # A lane at zero serves nothing; what the run holds stays out.
    held = next(c for c in cards if c["source"] == "vocab")
    rest = client.get(
        f"/api/today/cards?count=10&quota={by['vocab']}:1,{by['kanji']}:0"
        f"&exclude={held['card_id']}|{held['mode']}"
    ).json()["cards"]
    assert len(rest) == 1 and rest[0]["source"] == "vocab"
    assert rest[0]["card_id"] != held["card_id"]


def test_the_summary_carries_no_pace_before_there_is_one(client):  # noqa: F811
    _board(client, "N5", "both", 3, ["vocab"])
    today = client.get("/api/today").json()
    assert "seconds_per_review" in today
    assert today["seconds_per_review"] is None


def test_the_forecast_is_seven_days_today_first(client):  # noqa: F811
    _board(client, "N5", "both", 3, ["vocab"])
    days = client.get("/api/today/forecast").json()["days"]
    assert len(days) == 7
    assert days == sorted(days, key=lambda d: d["date"])
    assert all(isinstance(d["count"], int) for d in days)


# ── 残り — what the queue holds past a batch ──────────────────────
# The run's "left" count was the gate's total less what it had cleared,
# and it read 0 with the queue still serving: a miss comes due again in
# minutes, and other cards fall due during a long run. Every batch now
# says how many the queue holds past it and past what the client holds,
# so the run counts what is really left.

def _due_vocab(n: int) -> None:
    """n N5 words answered once and come due again: a queue with no
    ration in it (the learner never boarded, so has no pace), which
    serves exactly these."""
    for raw_id in card_index.raw_ids("vocab", "N5", F2B)[:n]:
        srs.review(f"{RATION_USER}:{raw_id}", F2B, 4)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE card_modes SET next_review = NOW() - INTERVAL '1 minute' WHERE card_id LIKE %s",
                (f"{RATION_USER}:%",),
            )
            assert cur.rowcount == n
        conn.commit()
    finally:
        conn.close()


def test_a_batch_says_how_many_the_queue_holds_past_it(client):  # noqa: F811
    _due_vocab(5)
    assert client.get("/api/today").json()["total"] == 5
    first = client.get("/api/today/cards?count=2").json()
    assert len(first["cards"]) == 2
    assert first["beyond"] == 3
    # What the client holds is neither served again nor counted again.
    held = ",".join(f"{c['card_id']}|{c['mode']}" for c in first["cards"])
    second = client.get(f"/api/today/cards?count=2&exclude={held}").json()
    assert len(second["cards"]) == 2
    assert second["beyond"] == 1
    # A card answered and due again -- a miss, minutes later -- is
    # counted again: the gate's total could not have known it.
    _due_vocab(5)
    assert client.get("/api/today/cards?count=2").json()["beyond"] == 3


def test_a_quota_counts_only_what_it_still_allows(client):  # noqa: F811
    _board(client, "N4", "both", 6, ["vocab", "kanji"])
    by = {l["source"]: l["id"] for l in client.get("/api/today").json()["lanes"]}
    body = client.get(f"/api/today/cards?count=2&quota={by['vocab']}:2,{by['kanji']}:1").json()
    assert len(body["cards"]) == 2
    assert body["beyond"] == 1
    # An exhausted queue says so as well.
    assert client.get(f"/api/today/cards?count=2&quota={by['vocab']}:0").json() == {"cards": [], "beyond": 0}
