"""
The derived tour (plan 187a): what every grammar point can be asked
before it is drilled, read off the catalogue as it stands.

Content-independent where it can be: the catalogue-wide tests read what
each entry says rather than pinning a point, and the pinned tests use
points whose shape the plan's canvas was drawn on (か, 〜てください).
"""
import pytest

from content.grammar_points_data import (
    GRAMMAR_POINTS_BY_LEVEL, LEVELS, find, gloss, grammar_to_id, localise,
)
from core.db import db_conn
from study.grammar_detect import hits
from study.grammar_tour import (
    GUESS_COUNT, LOOK_COUNT, MIN_LIT, TOUR_REV, lit_spans, tour_payload,
)

# The points no example of which the detector or the stems can light,
# measured when the tour was built. A point leaving this list is good
# news (shrink it); a point joining it is a tour lost, and the test says
# which.
UNLIT = {
    ("N5", "〜て（理由）"), ("N5", "〜を（移動）"), ("N5", "〜で（理由）"),
    ("N4", "自動詞／他動詞"), ("N3", "使役受身形 〜させられる"), ("N3", "〜み"),
}


def _all():
    for level in LEVELS:
        for entry in GRAMMAR_POINTS_BY_LEVEL[level]:
            yield level, entry


@pytest.mark.parametrize("lang", ["fr", "en"])
def test_every_point_gets_a_tour_or_is_a_known_fallback(lang):
    missing = {
        (level, entry["pattern"]) for level, entry in _all()
        if tour_payload(level, entry, lang) is None
    }
    assert missing <= UNLIT, f"points that lost their tour: {sorted(missing - UNLIT)}"


def test_a_tour_has_its_shape():
    for level, entry in _all():
        tour = tour_payload(level, entry, "fr")
        if tour is None:
            continue
        assert tour["rev"] == TOUR_REV
        assert MIN_LIT <= len(tour["look"]) <= LOOK_COUNT
        assert 2 <= len(tour["guesses"]) <= GUESS_COUNT
        # The authored half is there exactly where the point's tour is
        # written (plan 187c).
        assert (not tour["twists"]) == (tour["scene"] is None) == ("tour" not in entry)
        assert tour["structure"] == entry["structure"]


def test_the_look_lights_the_point_where_it_is_written():
    for level, entry in _all():
        tour = tour_payload(level, entry, "fr")
        if tour is None:
            continue
        examples = {ex["jp"]: ex for ex in entry["examples"]}
        for item in tour["look"]:
            # Every looked-at sentence is the point's own example, in the
            # learner's language, lit where the point is written.
            assert item["jp"] in examples, (entry["pattern"], item["jp"])
            assert item["tr"] == localise(examples[item["jp"]], "fr")
            assert item["spans"] == [list(s) for s in lit_spans(item["jp"], entry["pattern"], level)]
            assert "".join(p["text"] for p in item["furigana"]) == item["jp"]
            lit = "".join(p["text"] for p in item["furigana"] if p.get("highlight"))
            assert lit, (entry["pattern"], item["jp"])
            for start, end in item["spans"]:
                assert item["jp"][start:end] in lit


def test_the_detector_lights_the_point_before_the_stems_do():
    # 〜てください in 書いてください: the detector's own segment.
    jp = "ここに名前を書いてください。"
    found = [h for h in hits(jp) if h["pattern"] == "〜てください"]
    assert found
    assert lit_spans(jp, "〜てください", "N5") == [tuple(s) for s in found[0]["segments"]]


def test_the_guesses_hold_the_meaning_once_and_answer_every_rival():
    for level, entry in _all():
        tour = tour_payload(level, entry, "fr")
        if tour is None:
            continue
        right = [g for g in tour["guesses"] if g["correct"]]
        assert len(right) == 1 and right[0]["text"] == gloss(entry, "fr")
        texts = [g["text"].strip().lower() for g in tour["guesses"]]
        assert len(texts) == len(set(texts)), entry["pattern"]
        lines = {r["pattern"]: localise(r, "fr") for r in entry.get("compare", [])}
        for guess in tour["guesses"]:
            if guess["correct"]:
                continue
            assert guess["pattern"] != entry["pattern"]
            assert "".join(p["text"] for p in guess["furigana"]) == guess["pattern"]
            if guess["pattern"] in lines:
                # A rival is answered by the lesson's own line for it.
                assert guess["answer"] == lines[guess["pattern"]]
            else:
                # A filler is a same-level point, never one the examples use.
                assert guess["answer"] is None
                assert guess["pattern"] in {e["pattern"] for e in GRAMMAR_POINTS_BY_LEVEL[level]}
                for item in tour["look"]:
                    assert guess["pattern"] not in {h["pattern"] for h in hits(item["jp"])}


def test_a_point_with_rivals_offers_at_least_one_of_them():
    for level, entry in _all():
        tour = tour_payload(level, entry, "fr")
        if tour is None:
            continue
        rivals = {r["pattern"] for r in entry["compare"]}
        assert any(g.get("pattern") in rivals for g in tour["guesses"]), entry["pattern"]


def test_a_reload_asks_the_same_and_the_copy_is_the_callers():
    level, entry = find("か")
    first = tour_payload(level, entry, "fr")
    first["guesses"].clear()
    first["look"][0]["furigana"].clear()
    again = tour_payload(level, entry, "fr")
    assert again["guesses"] and again["look"][0]["furigana"]
    assert again == tour_payload(level, entry, "fr")


def test_te_kudasai_as_drawn_on_the_canvas():
    level, entry = find("〜てください")
    tour = tour_payload(level, entry, "fr")
    assert [item["jp"] for item in tour["look"]] == [ex["jp"] for ex in entry["examples"][:3]]
    rivals = {g["pattern"]: g["answer"] for g in tour["guesses"] if not g["correct"]}
    assert rivals["〜をください"] == "てください demande une action ; をください demande une chose."
    # The verb from its dictionary form to the point, in the script the
    # sentence writes it in.
    assert tour["chain"] == ["読む", "読んでください"]
    assert tour["rival"]["pattern"] == entry["compare"][0]["pattern"]
    assert tour["rule"].startswith("**forme en て + ください**")


def test_a_particle_has_no_chain():
    level, entry = find("か")
    tour = tour_payload(level, entry, "en")
    assert tour["chain"] is None
    assert any(g.get("pattern") == "ね" for g in tour["guesses"])


def test_a_point_with_no_rival_gets_no_tour(monkeypatch):
    level, entry = find("〜てください")
    lonely = {**entry, "pattern": "〜てください", "compare": []}
    from study import grammar_tour
    monkeypatch.setattr(grammar_tour, "find", lambda p: (level, lonely) if p == "〜てください" else find(p))
    grammar_tour._tour.cache_clear()
    try:
        assert tour_payload(level, lonely, "fr") is None
    finally:
        grammar_tour._tour.cache_clear()


def test_the_id_seeds_the_order():
    # Two languages of one point shuffle the same way: the seed is the id.
    level, entry = find("〜てください")
    fr = [g.get("pattern") for g in tour_payload(level, entry, "fr")["guesses"]]
    en = [g.get("pattern") for g in tour_payload(level, entry, "en")["guesses"]]
    assert grammar_to_id(entry, level)
    assert fr == en


# ── The record (plan 187b) ────────────────────────────────────

def _clear_tours():
    from core.auth import DEV_USER_ID
    from core.db import db_conn
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM grammar_tours WHERE user_id = %s", (DEV_USER_ID,))
        conn.commit()
    finally:
        conn.close()


def test_the_terminus_records_the_first_tour_only(client):
    _clear_tours()
    level, entry = find("〜てください")
    raw_id = grammar_to_id(entry, level)
    first = client.post("/api/grammar/tour", json={"raw_id": raw_id, "tries": 2, "helped": True})
    assert first.status_code == 200 and first.json() == {"recorded": True}
    # A replay never changes it (plan 187, Q4).
    again = client.post("/api/grammar/tour", json={"raw_id": raw_id, "tries": 0, "helped": False})
    assert again.json() == {"recorded": False}
    from core.auth import DEV_USER_ID
    from core.db import db_conn
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT tries, helped FROM grammar_tours WHERE user_id = %s AND card_id = %s", (DEV_USER_ID, raw_id))
            assert cur.fetchall() == [(2, True)]
    finally:
        conn.close()
    _clear_tours()


def test_the_record_refuses_what_is_no_point(client):
    assert client.post("/api/grammar/tour", json={"raw_id": "grammar_N5_nope", "tries": 0}).status_code == 404
    level, entry = find("か")
    raw_id = grammar_to_id(entry, level)
    assert client.post("/api/grammar/tour", json={"raw_id": raw_id, "tries": 10}).status_code == 422
    assert client.post("/api/grammar/tour", json={"raw_id": raw_id, "tries": -1}).status_code == 422


# ── The authored half (plan 187c) ─────────────────────────────

def test_the_basics_course_points_carry_their_tour():
    from study import basics
    course = [p for unit in basics.units() for p in unit.get("grammar", [])]
    assert len(course) == 32
    for pattern in course:
        level, entry = find(pattern)
        assert "tour" in entry, pattern
        tour = tour_payload(level, entry, "fr")
        assert tour["twists"] and tour["scene"], pattern


def test_the_authored_half_is_served_in_the_learners_language():
    level, entry = find("か")
    written = entry["tour"]
    for lang in ("fr", "en"):
        tour = tour_payload(level, entry, lang)
        scene = tour["scene"]
        # A twist per notion, in the order written (plan 189).
        assert len(tour["twists"]) == len(written["twists"])
        for twist, said in zip(tour["twists"], written["twists"]):
            assert twist["notion"] == said["notion"][lang]
            assert twist["jp"] == said["jp"]
            assert twist["ask"] == said["ask"][lang]
            right = [c for c in twist["choices"] if c["correct"]]
            assert [c["text"] for c in right] == [said["choices"][0][lang]]
            # Two readings (plan 194): the right one and the confusion set
            # second; the quiz asks all three.
            assert {c["text"] for c in twist["choices"]} == {c[lang] for c in said["choices"][:2]}
            assert twist["tr"] == said["tr"][lang] and twist["kind"] in ("usage", "trap")
        assert scene["place"] == written["scene"]["place"]
        assert scene["place_caption"] == {"fr": "Kiosque", "en": "Kiosk"}[lang]
        assert scene["them"] == written["scene"]["them"][lang]
        assert [l["jp"] for l in scene["lines"]] == [l["jp"] for l in written["scene"]["lines"]]
        assert [l["tr"] for l in scene["lines"]] == [l[lang] for l in written["scene"]["lines"]]
        for line in scene["lines"] + [scene["ask"]["cue"]]:
            assert "".join(p["text"] for p in line["furigana"]) == line["jp"]
        # The point is lit where a line writes it.
        lit = [l for l in scene["lines"] if any(p.get("highlight") for p in l["furigana"])]
        assert lit
        choices = scene["ask"]["choices"]
        assert [c["jp"] for c in choices if c["correct"]] == [written["scene"]["ask"]["choices"][0]]
        assert sorted(c["jp"] for c in choices) == sorted(written["scene"]["ask"]["choices"])


def test_the_authored_choices_are_seeded_by_the_id():
    level, entry = find("か")
    a = tour_payload(level, entry, "fr")
    b = tour_payload(level, entry, "en")
    for ta, tb in zip(a["twists"], b["twists"], strict=True):
        assert [c["correct"] for c in ta["choices"]] == [c["correct"] for c in tb["choices"]]
    assert [c["jp"] for c in a["scene"]["ask"]["choices"]] == [c["jp"] for c in b["scene"]["ask"]["choices"]]


def test_a_kana_line_wraps_between_its_phrases():
    # align_sentence keeps a kana run whole, and the renderer never breaks
    # inside a part: a scene's all-kana line ran off a phone's side.
    level, entry = find("か")
    tour = tour_payload(level, entry, "en")
    line = next(l for l in tour["scene"]["lines"] if l["jp"] == "いいえ、コーヒーです。おちゃもありますよ。")
    assert [p["text"] for p in line["furigana"]] == ["いいえ、", "コーヒーです。", "おちゃも", "ありますよ。"]
    # Never a particle, an ending or a 。 opening a part of its own --
    # but where the lit point ends, which mark_spans cuts at.
    for line in tour["scene"]["lines"]:
        parts = line["furigana"]
        for before, part in zip(parts, parts[1:]):
            if part.get("reading") is None and not part.get("highlight") and not before.get("highlight"):
                assert part["text"][0] not in "、。もはがをによね"


# ── Plan 194: the quiz, and the tutorial once per point ──────

def test_the_quiz_asks_new_questions_with_their_traps():
    level, entry = find("〜てください")
    quiz = tour_payload(level, entry, "fr")["quiz"]
    assert 3 <= len(quiz) <= 8
    assert {q["kind"] for q in quiz} <= {"gap", "which"}
    for q in quiz:
        assert sum(c["correct"] for c in q["choices"]) == 1, q
        assert not any(c["correct"] and c.get("trap") for c in q["choices"])
        assert q["why"]
    # A "which" is trapped by a rival's sentence while the rivals have one
    # to spare, then by any other the app teaches; the quiz has traps.
    assert any(c.get("trap") for q in quiz for c in q["choices"])
    for q in (q for q in quiz if q["kind"] == "gap"):
        # Asked from a rival's side: the point is among the choices, and wrong.
        point = next(c for c in q["choices"] if c["pattern"] == "〜てください")
        assert not point["correct"] and point["trap"]
        assert any(p.get("blank") for p in q["furigana"])
    for q in (q for q in quiz if q["kind"] == "which"):
        right = next(c for c in q["choices"] if c["correct"])
        assert lit_spans(right["jp"], "〜てください", level)
        for c in q["choices"]:
            if not c["correct"]:
                assert not lit_spans(c["jp"], "〜てください", level), c["jp"]
    # Seeded: a reload asks the same.
    assert tour_payload(level, entry, "fr")["quiz"] == quiz


def _sentences(tour):
    """Every sentence a tour shows, in the order it shows them."""
    out = [x["jp"] for x in tour["look"]] + [x["jp"] for x in tour["twists"]]
    if tour["scene"]:
        out += [line["jp"] for line in tour["scene"]["lines"]] + [tour["scene"]["ask"]["cue"]["jp"]]
        out += [c["jp"] for c in tour["scene"]["ask"]["choices"]]
    return out


def test_no_quiz_question_repeats_a_sentence_the_tour_has_shown():
    """Plan 195: every question is new. A quiz sentence is not a look, a
    twist or a line of the scene, and no sentence stands in two questions
    (or twice in one) -- over every point that has a quiz."""
    from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL
    from study.grammar_tour import QUIZ_MIN, QUIZ_SIZE
    quizzed = 0
    for level, entries in GRAMMAR_POINTS_BY_LEVEL.items():
        for entry in entries:
            tour = tour_payload(level, entry, "en")
            if not tour or not tour["quiz"]:
                continue
            quizzed += 1
            quiz = tour["quiz"]
            assert QUIZ_MIN <= len(quiz) <= QUIZ_SIZE, entry["pattern"]
            asked = []
            for q in quiz:
                asked += [q["jp"]] if q["kind"] == "gap" else [c["jp"] for c in q["choices"]]
            assert not set(asked) & set(_sentences(tour)), (level, entry["pattern"], set(asked) & set(_sentences(tour)))
            assert len(asked) == len(set(asked)), (level, entry["pattern"])
    assert quizzed > 400


def test_the_usages_carry_their_translation_and_kind():
    for pattern in ("〜てください", "か", "〜ば"):
        level, entry = find(pattern)
        for twist in tour_payload(level, entry, "en")["twists"]:
            assert twist["tr"] and len(twist["choices"]) == 2 and twist["kind"] in ("usage", "trap")


def _wipe_point(raw_id):
    from core.auth import DEV_USER_ID
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM grammar_tours WHERE user_id = %s AND card_id = %s", (DEV_USER_ID, raw_id))
            cur.execute("DELETE FROM card_modes WHERE card_id = %s", (f"{DEV_USER_ID}:{raw_id}",))
            cur.execute("DELETE FROM review_log WHERE card_id = %s", (f"{DEV_USER_ID}:{raw_id}",))
        conn.commit()
    finally:
        conn.close()


def _card(client, level, mode, raw_id):
    cards = client.get(f"/api/grammar/cards?level={level}&mode={mode}&lang=fr&count=25"
                       f"&beyond_target=true").json()["cards"]
    return next((c for c in cards if c["raw_id"] == raw_id), None)


def test_the_tutorial_is_due_once_per_point_not_per_mode(client):
    level, entry = find("〜てください")
    raw_id = grammar_to_id(entry, level)
    _wipe_point(raw_id)
    try:
        card = _card(client, level, "grammar.ladder", raw_id)
        assert card is not None and card["tutorial"] is True and card["lesson"]["tour"]["quiz"]
        r = client.post("/api/grammar/tour", json={"raw_id": raw_id, "tries": 0, "helped": False,
                                                   "quiz_right": 7, "quiz_total": 8})
        assert r.json() == {"recorded": True}
        # New on another platform, but toured: no tutorial again.
        other = _card(client, level, "grammar.flashcard.f2b", raw_id)
        assert other is not None and other["stage"] == "new" and other["tutorial"] is False
        record = client.get(f"/api/grammar/point?id={raw_id}").json()["tour_record"]
        assert (record["quiz_right"], record["quiz_total"]) == (7, 8)
    finally:
        _wipe_point(raw_id)


def test_a_point_studied_before_the_tour_is_never_toured(client):
    level, entry = find("〜てください")
    raw_id = grammar_to_id(entry, level)
    _wipe_point(raw_id)
    try:
        client.post("/api/grammar/review", json={"card_id": raw_id, "mode": "grammar.flashcard.b2f", "quality": 4})
        card = _card(client, level, "grammar.ladder", raw_id)
        assert card is not None and card["stage"] == "new" and card["tutorial"] is False
    finally:
        _wipe_point(raw_id)
