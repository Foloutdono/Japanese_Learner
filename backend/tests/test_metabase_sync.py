# ── 足跡 — the dashboards as code (plan 215) ──────────────────────────
#
# docs/analytics/metabase/*.sql is what scripts/metabase_sync.py builds
# Metabase from. These pin what has to hold for that to stay safe and
# rebuildable without a Metabase to hand: every file parses, every
# question leaves the internal accounts out, and no question reads a
# column that holds what a learner typed -- the dashboards count the
# practice logs, they never read them.
import re

import pytest

from core import events
from scripts import metabase_sync

BOARDS = metabase_sync.dashboards()
QUESTIONS = [(b["file"], q) for b in BOARDS for q in b["questions"]]

# The text a learner typed or was shown, by column name, across the
# tables a dashboard may join: the practice logs' sentences and answers,
# the analyser's phrases and results, a deck's name, the account's
# e-mail and username.
TYPED = re.compile(
    r"\b(answer|answers|phrase|sentence|translation_prompt|romaji|result|review"
    r"|username|email|title|description|transcript|source_ref)\b"
)


def test_there_are_dashboards_and_they_parse():
    assert len(BOARDS) >= 9
    for b in BOARDS:
        assert b["name"].startswith("Tsuji — 足跡 · "), b["file"]
        assert b["questions"], b["file"]


@pytest.mark.parametrize("file,q", QUESTIONS, ids=[f"{f}:{q['title']}" for f, q in QUESTIONS])
def test_each_question_is_well_formed(file, q):
    assert q["title"], file
    assert q["display"] in {"scalar", "line", "bar", "pie", "funnel", "table", "row", "area", "combo"}
    assert 1 <= q["w"] <= metabase_sync.GRID and 1 <= q["h"] <= 20
    assert q["sql"].lstrip().upper().startswith(("SELECT", "WITH")), "read-only questions only"
    assert ";" not in q["sql"], "one statement per question"


@pytest.mark.parametrize("file,q", QUESTIONS, ids=[f"{f}:{q['title']}" for f, q in QUESTIONS])
def test_each_question_leaves_the_internal_accounts_out(file, q):
    assert "{{snippet: internal_users}}" in q["sql"]


@pytest.mark.parametrize("file,q", QUESTIONS, ids=[f"{f}:{q['title']}" for f, q in QUESTIONS])
def test_no_question_reads_what_a_learner_typed(file, q):
    # Column names only: strip the quoted aliases ("Révisions" is a
    # heading, not the review column) and the string literals.
    sql = re.sub(r'"[^"]*"', "", q["sql"])
    sql = re.sub(r"'[^']*'", "", sql)
    hit = TYPED.search(sql)
    assert hit is None, f"{file} · {q['title']} reads {hit.group(0)!r}"


def test_the_unused_features_list_is_the_enum():
    sql = next(q["sql"] for f, q in QUESTIONS if q["title"].startswith("Fonctions jamais utilisées"))
    pairs = re.findall(r"\('(\w+)', '(\w+)'\)", sql)
    assert pairs
    for feature, action in pairs:
        assert feature in events.VALUES["feature_use"]["feature"]
        assert action in events.VALUES["feature_use"]["action"]


def test_the_layout_never_overlaps():
    for b in BOARDS:
        cells = set()
        for q, (row, col) in zip(b["questions"], metabase_sync.layout(b["questions"])):
            assert col + q["w"] <= metabase_sync.GRID
            for r in range(row, row + q["h"]):
                for c in range(col, col + q["w"]):
                    assert (r, c) not in cells, (b["file"], q["title"])
                    cells.add((r, c))


def test_the_snippet_excludes_nobody_by_default_and_quotes_safely():
    assert metabase_sync.snippet_content([]) == "(SELECT NULL::text WHERE FALSE)"
    assert metabase_sync.snippet_content(["a'b", "c"]) == "('ab', 'c')"


def test_a_runnable_question_has_no_placeholder_left():
    for _, q in QUESTIONS:
        sql = metabase_sync.runnable(q["sql"], "('x')")
        assert "{{" not in sql
