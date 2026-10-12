"""The quiz's sentences (plan 195): the snapshot is what the catalogue says,
and every sentence written for the quiz passes the bank's own rules."""
import json

from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL, find
from scripts.check_quiz_sentences import check
from study import grammar_quiz_pool


def test_the_snapshot_is_what_the_catalogue_says():
    assert json.loads(grammar_quiz_pool.SNAPSHOT.read_text(encoding="utf-8")) == grammar_quiz_pool.write_pool(), (
        "run `python -m scripts.build_quiz_pool`"
    )


def test_every_sentence_written_for_the_quiz_passes_its_rules():
    written = grammar_quiz_pool.written()
    assert written, "content/grammar/quiz_sentences.json is empty"
    assert check(written) == []


def test_a_written_sentence_is_for_a_point_of_that_level():
    for level, by_pattern in grammar_quiz_pool.written().items():
        for pattern in by_pattern:
            assert find(pattern)[0] == level


def test_the_pool_holds_sentences_at_the_points_level_or_below():
    rank = {level: n for n, level in enumerate(GRAMMAR_POINTS_BY_LEVEL)}
    levels = dict(grammar_quiz_pool.corpus())
    for level, by_pattern in grammar_quiz_pool._snapshot().items():
        for pattern, sentences in by_pattern.items():
            for jp in sentences:
                if jp in levels:
                    assert rank[levels[jp]] <= rank[level], (level, pattern, jp)
