# The translation screen grades with the app's six-segment rating bar, so
# a result carries the learner's own rating and not just pass/fail. These
# pin the three things that could silently regress:
#
#   1. the rating survives the round trip and comes back on /history
#   2. `correct` stays independent of it, so every existing reader keeps
#      working and an older client posting only `correct` still does
#   3. the bound is enforced as a 422 the caller can read, not a 500 from
#      the driver
#
# Plain pytest functions, same style as test_deck_export.py.

import pytest


def _payload(**over):
    body = {
        "source": "level:N5",
        "level": "N5",
        "translation_prompt": "Let's meet in front of the station at five.",
        "phrase": "五時に駅の前で会いましょう。",
        "romaji": "goji ni eki no mae de aimashou.",
        "answer": "五時に駅の前に会いましょう",
        "correct": True,
    }
    body.update(over)
    return body


def test_quality_round_trips(client):
    """The rating the learner gave comes back out of the log."""
    posted = client.post("/api/translation/result", json=_payload(quality=5))
    assert posted.status_code == 200, posted.text
    assert posted.json()["quality"] == 5

    history = client.get("/api/translation/history", params={"limit": 1})
    assert history.status_code == 200, history.text
    rows = history.json()
    assert rows, "the row just written should be the most recent"
    assert rows[0]["quality"] == 5


def test_quality_is_optional(client):
    """A client that posts only `correct` still works.

    This is not hypothetical politeness: every row written before the
    column existed has no rating, and the endpoint has to keep accepting
    that shape rather than 422-ing an older build of the app.
    """
    posted = client.post("/api/translation/result", json=_payload())
    assert posted.status_code == 200, posted.text
    assert posted.json()["quality"] is None


def test_quality_is_independent_of_correct(client):
    """`correct` is not derived server-side, so the two can disagree.

    The client derives the pass/fail from the rating (q > 2) and posts
    both. Recomputing it here would silently overrule a caller that
    grades differently, so the endpoint stores what it is told -- and
    this test is what would notice if someone "helpfully" made the server
    infer one from the other.
    """
    posted = client.post("/api/translation/result", json=_payload(correct=False, quality=4))
    assert posted.status_code == 200, posted.text
    body = posted.json()
    assert body["correct"] is False
    assert body["quality"] == 4


@pytest.mark.parametrize("bad", [-1, 6, 99])
def test_quality_out_of_range_is_a_422(client, bad):
    """Out of 0..5 is a readable rejection, not a database error."""
    posted = client.post("/api/translation/result", json=_payload(quality=bad))
    assert posted.status_code == 422, posted.text
