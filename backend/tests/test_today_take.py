# ── 区間 — a run of a chosen length, and what a review takes (plan 135) ──
# The desk's fare gate offers 20 / 50 / 100 / all. It splits the length
# over the chosen lanes the way the queue deals, and the run hands each
# lane's remaining figure back as `quota` (less what it has answered
# and what it holds); the server keeps those lanes and cuts each to it. Beside the count, the gate prints what
# the run will take, from the median gap between this learner's reviews
# blended (plan 175) with what a card cost in each of their last twenty runs.
from collections import OrderedDict
from datetime import datetime, timedelta, timezone

from core.db import db_conn
from core.srs_instance import srs
from study import card_index, daily_queue
from study.daily_queue import SECTION
from srs.srs import (
    PACE_BREAK, PACE_MIN_GAPS, PACE_PRIOR_RUNS, RUN_BREAK, RUN_MIN_CARDS, RUNS_KEPT,
    personal_pace, run_paces, runs_of, seconds_per_review,
)

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


# ── 走行 — the pace read from the last runs (plan 175) ────────────

def _run(start, n, every):
    """n reviews `every` seconds apart from `start`."""
    return [start + i * every for i in range(n)]


def test_a_gap_of_a_break_or_more_closes_a_run():
    runs = runs_of(_at(*_run(0, 12, 5), *_run(60 + RUN_BREAK, 3, 5), *_run(5000, 4, 5)))
    assert [len(r) for r in runs] == [12, 3, 4]
    # The break is the boundary: one second short of it stays one run.
    assert len(runs_of(_at(0, RUN_BREAK - 1))) == 1
    assert len(runs_of(_at(0, RUN_BREAK))) == 2


def test_a_run_s_pace_counts_its_pauses_and_skips_the_lookups():
    # 10 cards 10s apart, with one five-minute pause in the middle.
    times = _run(0, 5, 10) + _run(40 + 300, 5, 10)
    assert run_paces(_at(*times)) == [(340 + 40) / 9]
    # Fewer than RUN_MIN_CARDS reviews is a lookup: no run, no pace.
    assert run_paces(_at(*_run(0, RUN_MIN_CARDS - 1, 10))) == []


def test_only_the_last_runs_are_counted():
    times = []
    for day in range(RUNS_KEPT + 5):
        # The first five runs are slow, the last twenty fast.
        times += _run(day * 10_000, RUN_MIN_CARDS, 60 if day < 5 else 6)
    assert run_paces(_at(*times)) == [6.0] * RUNS_KEPT


def test_runs_that_slow_the_learner_down_lift_the_figure():
    # Short gaps of 8s, but each run holds a long pause: the gap pace says
    # 8 and the runs say more.
    times = []
    for day in range(10):
        start = day * 10_000
        times += _run(start, 10, 8) + _run(start + 72 + 400, 10, 8)
    assert seconds_per_review(_at(*times)) == 8
    pace = personal_pace(_at(*times))
    assert pace > 8
    # Ten runs, each 9 gaps of 8s, a 400s pause and 9 more: 19 gaps in all.
    run_pace = (72 + 400 + 72) / 19  # the 400s lands between the two halves
    assert pace == round((10 * run_pace + PACE_PRIOR_RUNS * 8) / (10 + PACE_PRIOR_RUNS))


def test_without_runs_the_figure_is_the_gap_pace():
    # Twenty-one reviews 8s apart: a gap pace, and one run under the
    # break whose pace is the same 8s -- but with a lookup-sized sitting
    # there is only the gap pace.
    short = _at(*[i * 8 for i in range(PACE_MIN_GAPS + 1)])
    assert personal_pace(short[:RUN_MIN_CARDS - 1]) is None
    assert personal_pace(short) == 8
    # And a figure from runs alone when the gaps are all pauses.
    slow = _at(*_run(0, 10, 200) + _run(100_000, 10, 200))
    assert seconds_per_review(slow) is None
    assert personal_pace(slow) == 200
    assert personal_pace([]) is None


def test_the_gap_pace_is_read_from_the_recent_reviews_only():
    # The runs see everything; the gap pace only what `recent` holds.
    old = _at(*_run(0, 30, 30))
    recent = _at(*_run(500_000, PACE_MIN_GAPS + 1, 8))
    both = old + recent
    assert personal_pace(both, recent) != personal_pace(both)


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


def _log_reviews(user_id, instants):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            for t in instants:
                cur.execute(
                    "INSERT INTO review_log (card_id, mode, quality, reviewed_at) VALUES (%s, %s, 4, %s)",
                    (f"{user_id}:vocab_N5_x_x", F2B, t),
                )
        conn.commit()
    finally:
        conn.close()


def test_the_pace_is_read_from_the_last_runs_in_the_log(client):  # noqa: F811
    # Three runs on three recent days, 10 cards 6s apart with a 200s
    # pause after the fifth: 54 + 200 over 9 gaps. The gap pace skips the
    # pause and says 6s (24 short gaps); the runs say 254/9, and the two
    # weigh equally at PACE_PRIOR_RUNS runs.
    now = datetime.now(timezone.utc).replace(microsecond=0)
    instants = []
    for days_ago in (3, 2, 1):
        start = now - timedelta(days=days_ago)
        instants += [start + timedelta(seconds=6 * i + (200 if i >= 5 else 0)) for i in range(10)]
    _log_reviews(RATION_USER, instants)
    assert PACE_PRIOR_RUNS == 3
    assert srs.get_review_pace(RATION_USER) == round((3 * (54 + 200) / 9 + 3 * 6) / 6)


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
