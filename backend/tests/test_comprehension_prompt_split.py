# 読解 — the prompt split that makes a provider's prefix cache possible
# (plan 092, step 2 of docs/llm-commercial-plan.md).
#
# Both providers this app calls cache automatically, take no flag, and
# cache the longest IDENTICAL PREFIX of a request. That makes the split
# the entire feature: a volatile value early in the prompt does not cost
# a little of the cache, it costs all of it. The seeds used to sit at
# character 87 of a 6,500-character prompt, so nothing was ever
# cacheable.
#
# Nothing here can prove a cache HIT -- that is the provider's business
# and is measured through the `cached=` column of the usage log. What
# these tests can do is prove the two properties a hit depends on, both
# of which are one careless edit away from being lost, and neither of
# which any other test would notice:
#
#   1. the stable block really is byte-identical between calls
#   2. nothing per-call has leaked into it
#
# No database and no model: _call_llm_comprehension with its one network
# call stubbed, as in test_comprehension.py.
import pytest

from routes import reading
from tests.test_comprehension import _reply, MASHITA, KUDASAI, TAI

WORDS = [{"kanji": "電車", "kana": "でんしゃ", "meaning": "train"}]

# OpenAI caches from 1,024 tokens and Google from 1,024-2,048 depending
# on the model. English runs about four characters to the token, so a
# stable block under this is not worth calling a cache prefix at all --
# it would never be eligible on either provider. Deliberately well under
# the ~6,700 the block actually measures: this is a floor that catches
# someone gutting it, not a restatement of its current size.
_CACHEABLE_FLOOR_CHARS = 4 * 1024


@pytest.fixture
def sent(monkeypatch):
    """Every message list the generator sends, in order."""
    calls = []

    def _chat(messages, *a, **kw):
        calls.append(messages)
        return _reply()

    monkeypatch.setattr(reading, "llm_configured", lambda: True)
    monkeypatch.setattr(reading, "_chat", _chat)
    return calls


def _system(calls, i=0):
    assert calls[i][0]["role"] == "system"
    return calls[i][0]["content"]


def _task(calls, i=0):
    assert calls[i][1]["role"] == "user"
    return calls[i][1]["content"]


# ── the prefix holds ─────────────────────────────────────────
def test_two_exercises_at_one_level_send_the_identical_prefix(sent, monkeypatch):
    monkeypatch.setattr(reading, "_pick_grammar_seeds", lambda *a, **kw: [MASHITA])
    monkeypatch.setattr(reading, "_pick_word_seeds", lambda *a, **kw: WORDS)
    reading._call_llm_comprehension("N5", "en")

    monkeypatch.setattr(reading, "_pick_grammar_seeds", lambda *a, **kw: [KUDASAI, TAI])
    monkeypatch.setattr(reading, "_pick_word_seeds", lambda *a, **kw: [])
    reading._call_llm_comprehension("N5", "en")

    # Different seeds, different words, same prefix -- byte for byte.
    assert _system(sent, 0) == _system(sent, 1)
    assert _task(sent, 0) != _task(sent, 1)


def test_a_retry_does_not_disturb_the_prefix(sent, monkeypatch):
    """A rejected attempt is told what was wrong with it. That feedback
    is the most tempting thing to append to the system block, and doing
    so would throw away the cache on exactly the calls that cost the
    most -- the second and third attempts at one exercise."""
    monkeypatch.setattr(reading, "_pick_grammar_seeds", lambda *a, **kw: [KUDASAI])
    monkeypatch.setattr(reading, "_pick_word_seeds", lambda *a, **kw: [])
    # KUDASAI is not in the fixture text, so the seed is asked for again.
    reading._call_llm_comprehension("N5", "en")

    assert len(sent) == reading._COMPREHENSION_ATTEMPTS
    assert _system(sent, 0) == _system(sent, 1) == _system(sent, 2)
    assert "REJECTED" in _task(sent, 1)
    assert "REJECTED" not in _system(sent, 1)


def test_the_stable_block_is_the_same_object_every_time():
    # lru_cache, so "identical" is a property of the code rather than of
    # the formatting happening to come out the same way twice.
    assert reading._comprehension_system("N4", "en") is reading._comprehension_system("N4", "en")


# ── nothing per-call has leaked in ───────────────────────────
def test_the_seeds_never_reach_the_stable_block(sent, monkeypatch):
    monkeypatch.setattr(reading, "_pick_grammar_seeds", lambda *a, **kw: [MASHITA, KUDASAI])
    monkeypatch.setattr(reading, "_pick_word_seeds", lambda *a, **kw: WORDS)
    reading._call_llm_comprehension("N5", "en")

    system, task = _system(sent), _task(sent)
    for point in (MASHITA, KUDASAI):
        assert point["pattern"] not in system
        assert point["pattern"] in task
    assert "電車" not in system
    assert "電車" in task


def test_the_stable_block_carries_what_the_bucket_decides(sent, monkeypatch):
    # The other half of the same rule: what IS stable per (level, lang)
    # belongs in the prefix, or the prefix is shorter than it could be.
    monkeypatch.setattr(reading, "_pick_grammar_seeds", lambda *a, **kw: [])
    monkeypatch.setattr(reading, "_pick_word_seeds", lambda *a, **kw: [])
    reading._call_llm_comprehension("N3", "en")

    system = _system(sent)
    assert "N3" in system
    assert reading.DIFFICULTY_BY_LEVEL["N3"] in system
    assert str(reading.COMPREHENSION_SPECS["N3"]["questions"]) in system
    # The kanji gate: N3 gets the literal list (exam_gen_utils).
    assert "駅" in system


# ── the buckets stay apart ───────────────────────────────────
@pytest.mark.parametrize("a, b", [(("N5", "en"), ("N3", "en")),
                                  (("N5", "en"), ("N5", "fr"))])
def test_each_bucket_has_its_own_prefix(a, b):
    # A shared prefix across buckets would mean one of them is being
    # told the wrong level or the wrong language.
    assert reading._comprehension_system(*a) != reading._comprehension_system(*b)


def test_the_prefix_is_long_enough_to_be_worth_caching():
    for level in reading.COMPREHENSION_SPECS:
        block = reading._comprehension_system(level, "en")
        assert len(block) > _CACHEABLE_FLOOR_CHARS, (
            f"{level}'s stable block is {len(block)} characters; under about "
            f"{_CACHEABLE_FLOOR_CHARS} it is below both providers' minimum "
            "cacheable prefix and the split buys nothing"
        )
