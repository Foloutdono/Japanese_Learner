# ── 乗換 — another app's progress, brought across (plans 243, 243b) ─
# A learner's device sends the short Japanese fields of their notes and
# the schedule of each note's strongest card; the server matches them to
# the course and writes each card as an imported assumption. Pinned
# here: how a field is read, which field of a note type is the word,
# when a word matches nothing, how Anki's schedule becomes the
# scheduler's, and how an imported card stands beside the level rule's
# (plan 224) -- its first answer a check, kept by a move down, taken
# back by the undo with the level's assumptions seeded over the holes.
from datetime import datetime, timedelta, timezone

import pytest

import core.user_level as user_level
from core.auth import get_user_id
from core.db import db_conn
from core.srs_instance import srs
from main import app
from srs.models import CardState
from srs.srs import SRSEngine
from study import card_index, level_rule, transfer
from study.transfer import AMBIGUOUS, Form, Note, forms, reading_of, resolve

AUID = "transfer-test-user"
VOCAB_MODE = level_rule.primary_mode("vocab")
KANJI_MODE = level_rule.primary_mode("kanji")


# ── Reading a field ───────────────────────────────────────────────

@pytest.mark.parametrize("text, expected", [
    ("食[た]べる", [Form("食べる", "たべる")]),
    (" 毎日[まいにち]", [Form("毎日", "まいにち")]),
    # A base that opens on kana keeps it whether or not the bracket
    # repeats it.
    ("お茶[ちゃ]", [Form("お茶", "おちゃ")]),
    ("お茶[おちゃ]", [Form("お茶", "おちゃ")]),
    ("日[ひ;h]", [Form("日", "ひ")]),
    ("食べる（たべる）", [Form("食べる", "たべる")]),
    ("勉強(する)", [Form("勉強", ""), Form("勉強する", "")]),
    ("見る、観る", [Form("見る", ""), Form("観る", "")]),
    ("〜さん", [Form("さん", "")]),
    ("ｺｰﾋｰ", [Form("コーヒー", "")]),
    ("to eat", []),
    ("", []),
    ("あ" * (transfer.MAX_FIELD + 1), []),
])
def test_a_field_is_read_as_its_words(text, expected):
    assert list(forms(text)) == expected


def test_a_reading_is_furigana_or_kana_alone():
    assert reading_of("食[た]べる") == "たべる"
    assert reading_of("たべる") == "たべる"
    assert reading_of("コーヒー") == "こうひい"
    assert reading_of("食べる") == ""


# ── Resolving a word ──────────────────────────────────────────────

def test_a_written_form_resolves_by_its_reading():
    assert resolve("vocab", Form("食べる", "")) == "vocab_N5_食べる_たべる"
    # 今日 is two deck words: the reading picks one, none leaves it open.
    assert resolve("vocab", Form("今日", "")) is AMBIGUOUS
    assert resolve("vocab", Form("今日", "きょう")) == "vocab_N5_今日_きょう"
    assert resolve("vocab", Form("今日", ""), reading="こんにち") == "vocab_N3_今日_こんにち"
    # A reading that is none of the deck's says the note is another word.
    assert resolve("vocab", Form("食べる", "くう")) is None


def test_a_conventional_spelling_is_the_card():
    assert resolve("vocab", Form("子ども", "")) == "vocab_N5_子供_こども"


def test_a_word_in_kana_alone_matches_only_a_word_written_so():
    assert resolve("vocab", Form("コーヒー", "")) == "vocab_N5__コーヒー"
    # たべる is read 食べる, but a kana form never reaches a kanji word.
    assert resolve("vocab", Form("たべる", "")) is None


def test_kanji_and_kana_resolve_to_their_own_lines():
    assert resolve("kanji", Form("日", "")) == "kanji_N5_日"
    assert resolve("kanji", Form("日本", "")) is None
    assert resolve("kana", Form("あ", "")) == "kana_あ"
    assert resolve("kana", Form("きゃ", "")) == "kana_きゃ"


# ── Matching a collection ─────────────────────────────────────────

def _note(t, *fields, interval=30, ease=2500, due=10, fsrs=None):
    return Note(type=t, fields=tuple(fields), interval=interval, ease=ease, fsrs=fsrs, due=due)


def test_the_word_field_is_found_wherever_it_stands():
    # Core-style: an index, the word, its kana, a sentence. The sentence
    # mentions other deck words; only the word field is ever matched.
    notes = [
        _note(0, "", "食べる", "たべる", "毎日パンを食べる"),
        _note(0, "", "今日", "きょう", "今日は雨"),
        _note(0, "", "学校", "がっこう", "学校に行く"),
        _note(0, "", "蜃気楼", "しんきろう", "砂漠に蜃気楼が見える"),
    ]
    m = transfer.match(notes)
    (tm,) = m.types
    assert (tm.field, tm.kind, tm.reading) == (1, "vocab", 2)
    assert set(m.hits) == {
        ("vocab", "vocab_N5_食べる_たべる"), ("vocab", "vocab_N5_今日_きょう"), ("vocab", card_raw("学校")),
    }
    # The course lacks 蜃気楼, and its sentence's 砂漠 is not its word.
    assert m.unmatched == 1 and m.sample == ["蜃気楼"]


def card_raw(written):
    hit = resolve("vocab", Form(written, ""))
    assert isinstance(hit, str), written
    return hit


def test_a_kanji_deck_is_read_as_kanji():
    notes = [_note(1, "日", "sun, day"), _note(1, "木", "tree"), _note(1, "語", "language")]
    m = transfer.match(notes)
    assert m.types[0].kind == "kanji"
    assert set(m.hits) == {("kanji", "kanji_N5_日"), ("kanji", "kanji_N5_木"), ("kanji", "kanji_N5_語")}


def test_each_note_type_is_read_on_its_own():
    notes = [_note(0, "食べる", "to eat"), _note(1, "eat", "飲む")]
    m = transfer.match(notes)
    assert [(tm.type, tm.field) for tm in m.types] == [(0, 0), (1, 1)]
    assert len(m.hits) == 2


def test_one_card_matched_twice_keeps_the_stronger_note():
    m = transfer.match([_note(0, "食べる", interval=5), _note(0, "食べる", interval=50)])
    assert m.hits[("vocab", "vocab_N5_食べる_たべる")].interval == 50


# ── Anki's schedule, read onto the scheduler ──────────────────────

def test_ease_is_the_schedulers_own_multiplier():
    assert transfer.difficulty_of(_note(0, ease=2500)) == 2.5
    assert transfer.difficulty_of(_note(0, ease=3500)) == 1.5
    assert transfer.difficulty_of(_note(0, ease=1300)) == 3.5
    assert transfer.difficulty_of(_note(0, ease=0)) == 2.5
    assert transfer.difficulty_of(_note(0, fsrs=1.0)) == 1.5
    assert transfer.difficulty_of(_note(0, fsrs=10.0)) == 3.5


def test_a_due_day_is_kept_and_the_overdue_are_spread_weakest_first():
    now = datetime(2026, 10, 17, tzinfo=timezone.utc)
    m = transfer.match([
        _note(0, "食べる", interval=40, due=12),
        _note(0, "学校", interval=200, due=-30),
        _note(0, "飲む", interval=3, due=0),
        _note(0, "見る", interval=100000, due=-1),
    ])
    rows = {r.raw_id: r for r in transfer.rows(m, now)}
    assert rows["vocab_N5_食べる_たべる"].next_review == now + timedelta(days=12)
    weak, mid, strong = (rows[card_raw(w)] for w in ("飲む", "学校", "見る"))
    assert now < weak.next_review < mid.next_review < strong.next_review
    assert strong.next_review == now + timedelta(days=level_rule.SPREAD_DAYS)
    assert strong.interval_days == 36500
    assert {r.mode for r in rows.values()} == {VOCAB_MODE}


# ── The routes ────────────────────────────────────────────────────

def _wipe(user_id: str) -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM review_log WHERE card_id LIKE %s", (f"{user_id}:%",))
            cur.execute("DELETE FROM card_first_review WHERE card_id LIKE %s", (f"{user_id}:%",))
            cur.execute("DELETE FROM card_modes WHERE card_id LIKE %s", (f"{user_id}:%",))
            cur.execute("DELETE FROM cards WHERE id LIKE %s", (f"{user_id}:%",))
            cur.execute("DELETE FROM credit_ledger WHERE user_id = %s", (user_id,))
            cur.execute("DELETE FROM event_log WHERE user_id = %s", (user_id,))
            cur.execute("DELETE FROM user_profiles WHERE user_id = %s", (user_id,))
        conn.commit()
    finally:
        conn.close()
    user_level._cache.pop(user_id, None)
    srs.forget_history(user_id)


@pytest.fixture()
def aclient(client):
    _wipe(AUID)
    previous = app.dependency_overrides.get(get_user_id)
    app.dependency_overrides[get_user_id] = lambda: AUID
    try:
        yield client
    finally:
        if previous is None:
            app.dependency_overrides.pop(get_user_id, None)
        else:
            app.dependency_overrides[get_user_id] = previous
        _wipe(AUID)


def _board(client, level):
    r = client.post("/api/onboarding/complete", json={
        "jlptLevel": level, "dailyNewTarget": 4, "kanaKnown": "both", "lines": ["vocab", "kanji"],
    })
    assert r.status_code == 200, r.text


def _body(*words, interval=30, due=10):
    return {"notes": [{"t": 0, "f": [w], "i": interval, "e": 2500, "u": due} for w in words]}


def _row(raw):
    return srs.get_states_for([f"{AUID}:{raw}"], [VOCAB_MODE]).get((f"{AUID}:{raw}", VOCAB_MODE))


def _state(raw) -> CardState:
    return srs._load_state(f"{AUID}:{raw}", VOCAB_MODE)


def _events(name):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT props FROM event_log WHERE user_id = %s AND name = %s", (AUID, name))
            return [r[0] for r in cur.fetchall()]
    finally:
        conn.close()


def test_the_preview_writes_nothing(aclient):
    r = aclient.post("/api/transfer/preview", json=_body("食べる", "学校", "蜃気楼"))
    assert r.status_code == 200, r.text
    body = r.json()
    assert (body["notes"], body["cards"], body["write"], body["kept"], body["unmatched"]) == (3, 2, 2, 0, 1)
    assert body["bySource"] == {"vocab": 2, "kanji": 0, "kana": 0}
    assert body["sample"] == ["蜃気楼"] and body["types"][0]["field"] == 0
    assert _row("vocab_N5_食べる_たべる") is None
    assert aclient.get("/api/transfer").json() == {"waiting": 0}


def test_the_preview_counts_what_stands_past_the_level(aclient):
    n3 = card_index.entry_for("vocab", card_index.raw_ids("vocab", "N3", VOCAB_MODE)[0])
    body = _body("食べる", n3["kanji"] or n3["kana"])
    # Before the boarding nothing is held: Today serves every level.
    assert aclient.post("/api/transfer/preview", json=body).json()["above"] == 0
    _board(aclient, "N5")
    assert aclient.post("/api/transfer/preview", json=body).json()["above"] == 1


def test_an_import_writes_assumptions_with_ankis_schedule(aclient):
    r = aclient.post("/api/transfer/import", json=_body("食べる", interval=45, due=7))
    assert r.status_code == 200, r.text
    assert (r.json()["written"], r.json()["waiting"]) == (1, 1)
    state = _state("vocab_N5_食べる_たべる")
    assert SRSEngine.is_assumed(state)
    assert (state.interval_days, state.difficulty, state.learning_step) == (45, 2.5, SRSEngine.IMPORTED_STEP)
    assert abs((state.next_review - datetime.now(timezone.utc)) - timedelta(days=7)) < timedelta(minutes=1)
    # Mastered at 45 days, and the stats never saw a review.
    assert _row("vocab_N5_食べる_たべる")["state"] == "mastered"
    assert srs.get_total_reviews(AUID) == 0
    assert _events("transfer_import") == [{"source": "anki", "notes": 1, "cards": 1, "written": 1, "kept": 0}]


def test_history_is_kept_and_a_level_assumption_replaced(aclient):
    _board(aclient, "N4")                       # N5 assumed known
    learnt = card_raw("学校")
    srs.review(f"{AUID}:{learnt}", VOCAB_MODE, 4)   # answered here: history
    before = _state(learnt)

    r = aclient.post("/api/transfer/import", json=_body("食べる", "学校", interval=5, due=-3)).json()
    # Both overdue in Anki, but only the card written has a check to spread.
    assert (r["cards"], r["kept"], r["written"], r["dueNow"]) == (2, 1, 1, 1)
    after = _state(learnt)
    assert (after.total_reviews, after.interval_days) == (before.total_reviews, before.interval_days)
    # The N5 assumption 食べる carried the level's 21 days; Anki's 5 win.
    replaced = _state("vocab_N5_食べる_たべる")
    assert (replaced.interval_days, replaced.learning_step) == (5, SRSEngine.IMPORTED_STEP)


def test_an_imported_cards_first_answer_is_a_check(aclient):
    aclient.post("/api/transfer/import", json=_body("食べる", "学校"))
    missed, passed = f"{AUID}:vocab_N5_食べる_たべる", f"{AUID}:{card_raw('学校')}"
    srs.review(missed, VOCAB_MODE, 1)
    srs.review(passed, VOCAB_MODE, 4)
    # Missed, it starts as a new card, not a lapse.
    m = srs._load_state(missed, VOCAB_MODE)
    assert (m.is_learning, m.lapses, m.interval_days) == (True, 1, 0)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT bool_and(assumed) FROM review_log WHERE card_id IN (%s, %s)", (missed, passed))
            assert cur.fetchone()[0] is True
    finally:
        conn.close()
    assert aclient.get("/api/transfer").json() == {"waiting": 0}


def test_a_move_down_keeps_imported_cards(aclient):
    _board(aclient, "N3")
    n4_word = card_index.raw_ids("vocab", "N4", VOCAB_MODE)[0]
    entry = card_index.entry_for("vocab", n4_word)
    word = entry["kanji"] or entry["kana"]
    imported = aclient.post("/api/transfer/import", json=_body(word)).json()
    assert imported["written"] == 1

    preview = aclient.get("/api/profile/learning/preview", params={"jlptLevel": "N4"}).json()
    n4 = sum(len(ids) for _, _, ids in level_rule.known_batches(["N4"]))
    assert preview["returned"] == n4 - 1
    aclient.patch("/api/profile/learning", json={"jlptLevel": "N4"})
    assert SRSEngine.is_assumed(_state(n4_word))
    assert aclient.get("/api/transfer").json() == {"waiting": 1}


def test_the_undo_takes_back_what_no_answer_touched(aclient):
    _board(aclient, "N4")
    aclient.post("/api/transfer/import", json=_body("食べる", "学校", interval=5))
    answered = f"{AUID}:{card_raw('学校')}"
    srs.review(answered, VOCAB_MODE, 4)

    r = aclient.delete("/api/transfer")
    assert r.status_code == 200 and r.json() == {"removed": 1, "waiting": 0}
    # 食べる is N5, behind the level: the level's assumption is back.
    back = _state("vocab_N5_食べる_たべる")
    assert SRSEngine.is_assumed(back) and back.learning_step == 0 and back.interval_days == 21
    # 学校 was answered: history, untouched by the undo.
    assert srs._load_state(answered, VOCAB_MODE).total_reviews == 2
    assert _events("transfer_undo") == [{"removed": 1}]


def test_the_undo_before_boarding_leaves_new_cards(aclient):
    aclient.post("/api/transfer/import", json=_body("食べる"))
    assert aclient.delete("/api/transfer").json()["removed"] == 1
    assert _row("vocab_N5_食べる_たべる") is None


@pytest.mark.parametrize("body", [
    {"notes": [{"t": 0, "f": ["a"] * (transfer.MAX_FIELDS + 1), "i": 1}]},
    {"notes": [{"t": transfer.MAX_TYPES, "f": [], "i": 1}]},
    {"notes": [{"t": 0, "f": ["あ" * (2 * transfer.MAX_FIELD + 1)], "i": 1}]},
    {"notes": [{"t": 0, "f": [], "i": 0}]},
    {"notes": [{"t": 0, "f": [], "i": 1, "d": 11}]},
    {"notes": [{"t": 0, "f": [], "i": 1}] * (transfer.MAX_NOTES + 1)},
])
def test_every_body_is_bounded(aclient, body):
    assert aclient.post("/api/transfer/preview", json=body).status_code == 422


def test_the_device_and_the_server_agree_on_the_bounds():
    """frontend/src/lib/transfer/bounds.js cuts the payload to the same
    bounds the server holds it to: a device sending more is refused
    whole, and one sending less loses notes it need not; and it offers
    the sources the server accepts."""
    import re
    from pathlib import Path
    source = (Path(__file__).resolve().parents[2] / "frontend/src/lib/transfer/bounds.js").read_text()
    for name in ("MAX_NOTES", "MAX_TYPES", "MAX_FIELDS", "MAX_FIELD"):
        found = re.search(rf"export const {name} = (\d+)", source)
        assert found and int(found.group(1)) == getattr(transfer, name), name
    from routes.transfer import SOURCES
    found = re.search(r"export const SOURCES = \[([^\]]*)\]", source)
    assert found and re.findall(r"'(\w+)'", found.group(1)) == list(SOURCES)


# ── Where from (plan 243b) ────────────────────────────────────────

def test_a_source_is_one_the_page_offers(aclient):
    body = _body("食べる")
    assert aclient.post("/api/transfer/preview", json={**body, "source": "bunpro"}).status_code == 422
    assert aclient.post("/api/transfer/preview", json={**body, "source": "wanikani"}).status_code == 200
    assert aclient.post("/api/transfer/import", json={**body, "source": "renshuu"}).status_code == 200
    assert _events("transfer_import")[0]["source"] == "renshuu"


# ── The sheet over Today, once (plan 243b) ────────────────────────

def _ride(client):
    r = client.post("/api/onboarding/ride/done", json={"skipped": False})
    assert r.status_code == 200, r.text


def _offer(client) -> bool:
    return client.get("/api/profile").json()["transferOffer"]


def test_a_new_learner_is_asked_once_after_the_ride(aclient):
    _board(aclient, "N5")
    assert _offer(aclient) is False          # the ride is still ahead
    _ride(aclient)
    assert _offer(aclient) is True
    r = aclient.post("/api/transfer/offer", json={"choice": "later"})
    assert r.status_code == 200 and r.json() == {"transferOffer": False}
    assert _offer(aclient) is False
    assert _events("transfer_offer") == [{"choice": "later"}]
    assert aclient.post("/api/transfer/offer", json={"choice": "maybe"}).status_code == 422


def test_an_import_answers_the_offer(aclient):
    _board(aclient, "N5")
    _ride(aclient)
    aclient.post("/api/transfer/import", json=_body("食べる"))
    assert _offer(aclient) is False


def test_a_learner_who_studied_weeks_ago_is_not_asked(aclient):
    _board(aclient, "N5")
    _ride(aclient)
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO review_log (card_id, mode, quality, reviewed_at) VALUES (%s, %s, 4, NOW() - INTERVAL '30 days')",
                (f"{AUID}:vocab_N5_食べる_たべる", VOCAB_MODE),
            )
        conn.commit()
    finally:
        conn.close()
    srs.forget_history(AUID)
    assert _offer(aclient) is False
