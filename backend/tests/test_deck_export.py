# Plain pytest-style functions, matching test_http_smoke.py's note: the
# TestClient fixture is awkward to wire into unittest.TestCase.setUp.
#
# The property under test is the round trip. Export exists to feed the
# import endpoint that already shipped, so a file this endpoint produces
# and that endpoint cannot read is the one failure mode that matters —
# more than any assertion about the bytes themselves.

import csv
import io

import pytest

from routes.decks import _export_filename


@pytest.fixture
def deck(client):
    """A standard deck, removed again afterwards."""
    made = client.post("/api/decks", json={"name": "Export test", "type": "standard"})
    assert made.status_code == 200, made.text
    deck_id = made.json()["id"]
    yield deck_id
    client.delete(f"/api/decks/{deck_id}")


def _rows(body_bytes):
    """Decode an export exactly as the import endpoint does."""
    text = body_bytes.decode("utf-8-sig")
    return list(csv.DictReader(io.StringIO(text)))


def test_export_round_trips_through_import(client, deck):
    # Japanese on purpose: it is most of this app's content, and it is
    # what a codepage-guessing reader mangles.
    cards = [
        {"front": "会議", "back": "meeting"},
        {"front": "締切", "back": "deadline, due date"},
    ]
    for card in cards:
        added = client.post(f"/api/decks/{deck}/cards", json=card)
        assert added.status_code == 200, added.text

    exported = client.get(f"/api/decks/{deck}/export")
    assert exported.status_code == 200
    assert exported.headers["content-type"].startswith("text/csv")

    target = client.post("/api/decks", json={"name": "Round trip", "type": "standard"})
    target_id = target.json()["id"]
    try:
        back = client.post(
            f"/api/decks/{target_id}/import",
            files={"file": ("deck.csv", exported.content, "text/csv")},
        )
        assert back.status_code == 200, back.text
        assert back.json()["inserted"] == len(cards)
        assert back.json()["errors"] == []

        listed = client.get(f"/api/decks/{target_id}/cards").json()["cards"]
        assert [(c["front"], c["back"]) for c in listed] == [
            (c["front"], c["back"]) for c in cards
        ]
    finally:
        client.delete(f"/api/decks/{target_id}")


def test_export_of_empty_deck_is_a_header_and_nothing_else(client, deck):
    # Not a 404: an empty deck is a legitimate thing to export, and the
    # file it produces must still import cleanly (as zero cards).
    exported = client.get(f"/api/decks/{deck}/export")
    assert exported.status_code == 200
    assert _rows(exported.content) == []
    assert exported.content.decode("utf-8-sig").strip() == "front,back"


def test_export_writes_a_bom(client, deck):
    # The other half of import's `utf-8-sig` decode. Without it Excel
    # reads the file as the local codepage and every Japanese card in it
    # turns to mojibake.
    assert client.get(f"/api/decks/{deck}/export").content.startswith(b"\xef\xbb\xbf")


def test_export_names_the_download(client, deck):
    disposition = client.get(f"/api/decks/{deck}/export").headers["content-disposition"]
    assert disposition.startswith("attachment;")
    # Both forms, per RFC 6266: a plain ASCII fallback and the encoded name.
    assert 'filename="' in disposition
    assert "filename*=UTF-8''" in disposition


def test_export_of_an_unknown_deck_is_404(client):
    # A numeric id, because `decks.id` is a bigint. A NON-numeric id
    # returns 500 rather than 404 here -- but that is pre-existing and
    # app-wide, not this endpoint's doing: GET /api/decks/not-a-number
    # and .../cards both do the same today. Asserting 500 would enshrine
    # it, so this covers the case that is actually reachable from the UI.
    missing = client.get("/api/decks/999999999/export")
    assert missing.status_code == 404
    assert "detail" in missing.json()


# ── The filename, which is user-authored and goes into a header ──


def test_filename_keeps_a_plain_name():
    ascii_name, utf8_name = _export_filename("Work words", "7")
    assert ascii_name == "Work_words.csv"
    assert utf8_name == "Work_words.csv"


def test_filename_falls_back_to_the_id_for_a_japanese_name():
    # Nothing ASCII survives, so the fallback parameter must still name
    # something a filesystem will accept — while the encoded form keeps
    # the real name.
    ascii_name, utf8_name = _export_filename("京都の単語", "42")
    assert ascii_name == "deck-42.csv"
    assert utf8_name == "京都の単語.csv"


@pytest.mark.parametrize("hostile", [
    'evil"; rm -rf /; x="',      # ends the quoted header parameter early
    "../../etc/passwd",          # climbs out of the download folder
    "a\r\nSet-Cookie: pwned=1",  # response splitting
    "con",                       # a reserved device name on Windows
    "   ",                       # nothing usable at all
    "",
])
def test_filename_never_carries_a_dangerous_character(hostile):
    ascii_name, utf8_name = _export_filename(hostile, "9")
    for name in (ascii_name, utf8_name):
        assert name.endswith(".csv")
        assert not any(ch in name for ch in '"\\/:*?<>|\r\n\t')
        assert name.strip() == name
        # A name that sanitises down to nothing must become the deck id,
        # never an empty ".csv".
        assert len(name) > len(".csv")
