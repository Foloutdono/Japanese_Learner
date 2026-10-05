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
        assert (tour["twist"] is None) == (tour["scene"] is None) == ("tour" not in entry)
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
        assert tour["twist"] and tour["scene"], pattern


def test_the_authored_half_is_served_in_the_learners_language():
    level, entry = find("か")
    written = entry["tour"]
    for lang in ("fr", "en"):
        tour = tour_payload(level, entry, lang)
        twist, scene = tour["twist"], tour["scene"]
        assert twist["jp"] == written["twist"]["jp"]
        assert twist["ask"] == written["twist"]["ask"][lang]
        right = [c for c in twist["choices"] if c["correct"]]
        assert [c["text"] for c in right] == [written["twist"]["choices"][0][lang]]
        assert {c["text"] for c in twist["choices"]} == {c[lang] for c in written["twist"]["choices"]}
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
    assert [c["correct"] for c in a["twist"]["choices"]] == [c["correct"] for c in b["twist"]["choices"]]
    assert [c["jp"] for c in a["scene"]["ask"]["choices"]] == [c["jp"] for c in b["scene"]["ask"]["choices"]]
