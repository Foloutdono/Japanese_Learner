# 模試 -- scripts/prewarm_exam_papers.py (plan 111): the pool filler for
# exam_papers. Needs the database; the generators are stubbed, since a
# real paper is dozens of model calls.
import pytest

from core.db import db_conn
from routes.exams import EXAM_GENERATORS
from scripts import prewarm_exam_papers as pw

EXAM = "n5-vocab-01"


def _sql(query, params=(), fetch=False):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(query, params)
            rows = cur.fetchall() if fetch else None
        conn.commit()
        return rows
    finally:
        conn.close()


@pytest.fixture
def no_papers():
    _sql("DELETE FROM exam_attempts WHERE exam_id = %s", (EXAM,))
    _sql("DELETE FROM exam_papers WHERE exam_id = %s", (EXAM,))
    yield
    _sql("DELETE FROM exam_attempts WHERE exam_id = %s", (EXAM,))
    _sql("DELETE FROM exam_papers WHERE exam_id = %s", (EXAM,))


@pytest.fixture
def stub_generator(monkeypatch):
    """The exam's generator replaced by one that writes an empty but
    well-formed paper and counts its calls."""
    calls = []

    def generate(seed):
        calls.append(seed)
        return {"level": "N5", "sections": []}

    version, kind, level, _real = EXAM_GENERATORS[EXAM]
    monkeypatch.setitem(EXAM_GENERATORS, EXAM, (version, kind, level, generate))
    monkeypatch.setattr(pw, "llm_configured", lambda: True)
    monkeypatch.setattr(pw, "PAUSE_SECONDS", 0)
    return calls


def test_counts_cover_every_exam_id(no_papers):
    have = pw._counts()
    assert set(have) == set(EXAM_GENERATORS)
    assert have[EXAM] == 0


def test_a_dry_run_reports_and_generates_nothing(no_papers, stub_generator):
    assert pw.main(["--dry-run"]) == 0
    assert stub_generator == []
    assert pw._counts()[EXAM] == 0


def test_it_tops_the_exam_up_to_target_and_no_further(no_papers, stub_generator):
    assert pw.main(["--exam", EXAM, "--target", "2"]) == 0
    assert len(stub_generator) == 2
    assert pw._counts()[EXAM] == 2
    # A second run finds the target met and pays nothing.
    assert pw.main(["--exam", EXAM, "--target", "2"]) == 0
    assert len(stub_generator) == 2


def test_the_seed_is_the_one_the_worker_would_use(no_papers, stub_generator):
    from routes.exams import _seed_for
    pw.main(["--exam", EXAM])
    assert stub_generator == [_seed_for(EXAM, 1)]
    ((revision, seed),) = _sql("SELECT revision, seed FROM exam_papers WHERE exam_id = %s", (EXAM,), fetch=True)
    assert (revision, seed) == (1, _seed_for(EXAM, 1))


def test_an_old_version_s_paper_does_not_count(no_papers, stub_generator):
    version = EXAM_GENERATORS[EXAM][0]
    _sql(
        """
        INSERT INTO exam_papers (exam_id, revision, level, seed, generator_version, paper, section_count, question_count)
        VALUES (%s, 1, 'N5', 0, %s, '{"level": "N5", "sections": []}', 0, 0)
        """,
        (EXAM, version + "-retired"),
    )
    assert pw._counts()[EXAM] == 0
    assert pw.main(["--exam", EXAM]) == 0
    # Numbering continues past the retired revision, as the route's own does.
    revisions = sorted(r for (r,) in _sql("SELECT revision FROM exam_papers WHERE exam_id = %s", (EXAM,), fetch=True))
    assert revisions == [1, 2]
    assert pw._counts()[EXAM] == 1


def test_an_unknown_exam_id_is_refused(no_papers):
    assert pw.main(["--exam", "n9-vocab-99", "--dry-run"]) == 2


def test_the_filters_select_by_level_and_kind(no_papers):
    todo = dict(pw.plan(["N5"], ["vocab"], None, 1))
    assert set(todo) == {EXAM}
