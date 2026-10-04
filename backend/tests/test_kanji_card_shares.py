"""
A kanji card carries the course's count for each of its readings (plan 176),
so the card can print the share of the few readings it shows. The figures
are study/kanji_words.course_shares', the same as the entry's.
"""
from study.kanji_words import course_shares

MODE = "kanji.flashcard.f2b"


def test_every_kanji_card_carries_its_courses_counts(client):
    r = client.get(f"/api/kanji/cards?level=N5&mode={MODE}&count=5")
    assert r.status_code == 200, r.text
    cards = r.json()["cards"]
    assert cards
    for card in cards:
        shares = card["reading_shares"]
        assert shares == course_shares(card["kanji"]), card["kanji"]
        assert set(shares) == {"total", "whole", "readings"}
        assert sum(shares["readings"].values()) + shares["whole"] == shares["total"]


def test_a_card_whose_kanji_the_course_never_uses_carries_an_empty_count():
    assert course_shares("桃") == {"total": 0, "whole": 0, "readings": {}}
