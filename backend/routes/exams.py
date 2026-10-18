import hashlib
import json
import logging
import os
import threading

from fastapi import APIRouter, Depends, HTTPException
from core import daily_limit
from core.credits import require_pass, resets_at
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from core.db import db_conn
from core.srs_instance import srs
from core.auth import get_user_id
from study.exam_schema import ensure_exam_schema
from study.exam_seed import seed_exam_papers
from study.exam_scoring import flatten_questions, score_attempt
from study.exam_blueprint import LEVEL_BLUEPRINT, name_mondai
from study.exam_gen_utils import GenerationFailed
from study.exam_validation import paper_gives_answer_away
from study.exam_study import study_question
from study.llm_shared import LLMUnavailable
from study import exam_grammar_gen, exam_listening_gen, exam_reading_gen, exam_vocab_gen
from study.exam_catalogue import EXAM_GENERATORS, KIND_META as _KIND_META

# A pass feature (plan 069): every route here refuses a free learner
# with 402 pass_required once CREDITS_ENFORCE=1; a no-op until then.
router = APIRouter(dependencies=[Depends(require_pass)])
logger = logging.getLogger(__name__)

ensure_exam_schema()

# The pool's floor (plan 228): every exam id's seed papers, stored as
# ordinary revisions before any learner opens an exam. A bad seed file
# must not stop the route from importing; the papers already stored
# are served regardless.
try:
    seed_exam_papers()
except Exception:  # pragma: no cover - logged, never fatal
    logger.exception("exam seed papers could not be stored")

# kind -> the generator's own time rule, (level, items) -> minutes: the
# catalogue's estimate for a paper not yet generated is the limit the
# generator would print on it (plan 159).
_TIME_LIMIT = {
    "vocab": exam_vocab_gen.time_limit_min,
    "reading": exam_reading_gen.time_limit_min,
    "grammar": exam_grammar_gen.time_limit_min,
    "listening": exam_listening_gen.time_limit_min,
}


def _expected_question_count(level: str, kind: str) -> int:
    """Target item count for a not-yet-materialized paper, straight from
    the (static, free) blueprint -- an estimate, since a generator can
    end up shipping fewer items than the target if a mondai fails every
    retry (see each exam_*_gen.py's own skip-on-GenerationFailed logic),
    but close enough for a catalog listing and requires no LLM call."""
    types = _KIND_META[kind][2]
    return sum(
        m["count"]
        for section in LEVEL_BLUEPRINT[level]["sections"]
        for m in section["mondai"]
        if m["type"] in types
    )


def _mondai_names(level: str, kind: str) -> list[str]:
    """The blueprint's mondai this kind's paper is made of at `level`,
    by their Japanese names and in the blueprint's order (漢字読み, 表記,
    …) -- what the desk's exam grade prints under the paper (plan 159).
    The same type set _expected_question_count counts."""
    types = _KIND_META[kind][2]
    return [
        m["name_jp"]
        for section in LEVEL_BLUEPRINT[level]["sections"]
        for m in section["mondai"]
        if m["type"] in types
    ]


def _mondai_parts(level: str, kind: str, paper: dict | None) -> list[dict]:
    """The paper's parts, each by its blueprint name with the questions
    it holds -- the desk's exam station draws them as a line, a stretch
    a part and a stop a question (plan 200). Counted on the paper this
    learner would be served when there is one, so the stops add up to
    its `questionCount` (a generator can ship a part short); else the
    blueprint's targets, in its order, as _mondai_names lists them."""
    if paper is not None:
        named = name_mondai(paper)
        counts: dict[str, int] = {}
        names: dict[str, str | None] = {}
        for q in flatten_questions(named):
            counts[q["mondaiId"]] = counts.get(q["mondaiId"], 0) + 1
        for section in named.get("sections") or []:
            for m in section.get("mondai") or []:
                names.setdefault(m.get("id"), m.get("nameJp"))
        return [{"nameJp": names.get(mid), "count": n} for mid, n in counts.items()]
    types = _KIND_META[kind][2]
    return [
        {"nameJp": m["name_jp"], "count": m["count"]}
        for section in LEVEL_BLUEPRINT[level]["sections"]
        for m in section["mondai"]
        if m["type"] in types
    ]


def _paper_minutes(paper: dict | None, level: str, kind: str, items: int) -> int:
    """The time limit a paper prints (its section's timeLimitMin), or,
    for one not generated yet or stored without it, the generator's own
    rule applied to the items it is expected to carry."""
    sections = (paper or {}).get("sections") or []
    minutes = sections[0].get("timeLimitMin") if sections and isinstance(sections[0], dict) else None
    if isinstance(minutes, (int, float)) and minutes > 0:
        return int(minutes)
    return _TIME_LIMIT[kind](level, items)


def _last_attempts(user_id: str) -> dict[str, dict]:
    """exam_id -> this learner's newest sitting of it, at any revision,
    as {correct, total, at}: the catalogue's "last: 32/40". One query
    for the whole catalogue rather than one per exam id."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT DISTINCT ON (exam_id) exam_id, correct, total, finished_at
                  FROM exam_attempts
                 WHERE user_id = %s
                 ORDER BY exam_id, finished_at DESC, id DESC
                """,
                (user_id,),
            )
            return {
                exam_id: {"correct": int(correct), "total": int(total), "at": at.isoformat()}
                for exam_id, correct, total, at in cur.fetchall()
            }
    finally:
        conn.close()


def _select_paper(exam_id: str, user_id: str, exclude: tuple[int, ...] = ()) -> tuple[int, dict] | None:
    """The paper this user should be served for exam_id, as
    (revision, paper) -- or None if they need a new one generated.

    Read-only: never generates. list_exams() and submit_attempt() both
    go through here specifically so neither browsing the catalog nor
    scoring an attempt can trigger full LLM generation (up to 15
    LLM-dependent papers, each several slow calls) inside one HTTP
    request. See list_exams()'s own comment for how the original plan
    already called this out: "static catalog, no materialization needed
    to list."

    The selection rule is the whole design (see study/exam_schema.py's
    header): the LOWEST revision of the CURRENT generator_version that
    this user has not already attempted. Papers are global, so a
    revision another learner paid to generate is served to this one for
    free, and a learner who has sat every existing revision -- and only
    then -- causes a new one to be generated. `exclude` drops a specific
    revision on top of that, which is how "give me a different paper"
    works for someone who opened a paper but never submitted it (no
    attempt row exists to exclude them by)."""
    generator_version = EXAM_GENERATORS[exam_id][0]
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT revision, paper
                  FROM exam_papers p
                 WHERE exam_id = %s
                   AND generator_version = %s
                   AND NOT (revision = ANY(%s))
                   AND NOT EXISTS (
                        SELECT 1 FROM exam_attempts a
                         WHERE a.exam_id = p.exam_id
                           AND a.revision = p.revision
                           AND a.user_id = %s)
                 ORDER BY revision
                """,
                (exam_id, generator_version, list(exclude), user_id),
            )
            # A paper stored before a check existed that it fails is
            # passed over rather than served (paper_gives_answer_away:
            # the underlined word among its own choices).
            for revision, paper in cur:
                if not paper_gives_answer_away(paper):
                    return revision, paper
            return None
    finally:
        conn.close()


def _load_paper(exam_id: str, revision: int) -> dict | None:
    """One exact revision, whoever has attempted it. Scoring and the
    result screen use this rather than _select_paper: an attempt must be
    graded against the paper the learner actually sat, which by
    definition is one _select_paper would no longer offer them."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT paper FROM exam_papers WHERE exam_id = %s AND revision = %s",
                (exam_id, revision),
            )
            row = cur.fetchone()
            return row[0] if row else None
    finally:
        conn.close()


def _next_revision(exam_id: str) -> int:
    """One past the highest revision that exists for this exam id, at
    ANY generator_version. Numbering continues across a version bump
    rather than restarting, so a revision number is unique per exam id
    for the lifetime of the database -- an attempt row's (exam_id,
    revision) can then never come to mean a different paper than the one
    it was taken on."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COALESCE(MAX(revision), 0) + 1 FROM exam_papers WHERE exam_id = %s", (exam_id,))
            return cur.fetchone()[0]
    finally:
        conn.close()


def _parse_exclude(exclude: str | None) -> tuple[int, ...]:
    """Query-string revisions to skip, ignoring anything unparseable —
    a malformed `exclude` should cost the learner a less-specific paper
    choice, never a 422 on the screen they were trying to open."""
    if not exclude:
        return ()
    out = []
    for part in exclude.split(","):
        try:
            out.append(int(part))
        except ValueError:
            continue
    return tuple(out)


def _seed_for(exam_id: str, revision: int) -> int:
    # Deterministic from the id and revision, so those two are the whole
    # reproducibility key — no seed needs to be passed around or stored
    # anywhere else to regenerate/verify a paper later. The revision is
    # in the hash and not just the row, so two revisions are written
    # from different draws; which subjects each is written on is the
    # topic deck's, dealt by the revision itself (study/exam_topics.py).
    return int(hashlib.sha256(f"{exam_id}:{revision}".encode()).hexdigest(), 16) % (2**63)


# ── Background generation ────────────────────────────────────────
# Generating an LLM-backed paper takes minutes and dozens of model
# calls. It used to run synchronously inside the request handler, which
# meant the handler occupied one of the threadpool's limited worker
# slots AND held a Postgres connection open for the entire time, while
# the browser sat on a request that would very often time out before it
# finished. Now the request only ever claims (or reads) a job row and
# returns immediately; the generation runs on its own thread and writes
# the finished paper to exam_papers, which the client picks up by
# polling.
#
# A plain daemon thread rather than FastAPI's BackgroundTasks: those run
# after the response is sent but still inside the request's threadpool
# slot and lifecycle, so a client that disconnects mid-generation would
# take the generation with it -- exactly the case this needs to survive,
# since the whole point is that the work outlives the request.

# How long a failed generation is remembered before a retry is allowed
# to pay for another attempt.
_FAILED_COOLDOWN_SECONDS = 300
# Longer for a provider-level failure (no key, no reachable model, auth
# rejected): a content failure might genuinely come out differently on
# the next roll of the dice, but nothing about the account changes
# within five minutes, so retrying that quickly is pure waste.
_UNAVAILABLE_COOLDOWN_SECONDS = 900
# A 'running' row older than this is assumed abandoned -- the worker's
# process was restarted mid-generation. Without this, one restart at the
# wrong moment would wedge that exam id as permanently "generating".
_STALE_RUNNING_SECONDS = 900

EXAM_PAPERS_FEATURE = "exam_paper"
EXAM_PAPERS_DAILY_LIMIT = int(os.environ.get("EXAM_PAPERS_DAILY_LIMIT", "5"))


def _mark_job_failed(exam_id: str, error: str, cooldown_seconds: int) -> None:
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE exam_generation_jobs
                   SET status = 'failed',
                       error = %s,
                       retry_after = NOW() + make_interval(secs => %s),
                       updated_at = NOW()
                 WHERE exam_id = %s
                """,
                (error[:2000], cooldown_seconds, exam_id),
            )
        conn.commit()
    finally:
        conn.close()


def _generation_worker(exam_id: str, revision: int) -> None:
    """Runs off-request. Owns the job row from 'running' through to
    either deleted (success) or 'failed' (with a cooldown)."""
    generator_version, _kind, _level, generate = EXAM_GENERATORS[exam_id]
    seed = _seed_for(exam_id, revision)
    try:
        # No DB connection is held across this call -- it is the slow
        # part, and an idle-in-transaction connection for its whole
        # duration was the other half of the old synchronous design's
        # cost.
        paper = generate(seed, paper=revision)
    except LLMUnavailable as e:
        logger.error("Exam generation for %s hit a provider failure: %s", exam_id, e)
        _mark_job_failed(exam_id, str(e), _UNAVAILABLE_COOLDOWN_SECONDS)
        return
    except GenerationFailed as e:
        logger.error("Exam generation failed for %s: %s", exam_id, e)
        _mark_job_failed(exam_id, str(e), _FAILED_COOLDOWN_SECONDS)
        return
    except Exception:  # pragma: no cover - defensive
        # Nothing else is going to catch this: an uncaught exception on
        # a worker thread would leave the job row 'running' until the
        # stale reaper picks it up, i.e. the screen spins for 15 minutes.
        #
        # The exception text is deliberately NOT stored. The cooldown
        # response hands `error` to the client on the promise that it is
        # "the generator's own, safe to show" (see get_exam) -- true of the
        # two branches above, and not of an arbitrary exception's str().
        logger.exception("Unexpected error generating %s", exam_id)
        _mark_job_failed(exam_id, "Generation failed unexpectedly.", _FAILED_COOLDOWN_SECONDS)
        return

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            # ON CONFLICT DO NOTHING preserves the invariant the old
            # synchronous path documented here: two workers can never
            # materialize two different papers for one id. The job-row
            # claim below should already make that impossible; this is
            # the cheap belt to that braces.
            cur.execute(
                """
                INSERT INTO exam_papers
                    (exam_id, revision, level, seed, generator_version, paper, section_count, question_count)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (exam_id, revision) DO NOTHING
                """,
                (
                    exam_id, revision, paper["level"], seed, generator_version,
                    json.dumps(paper), len(paper["sections"]), len(flatten_questions(paper)),
                ),
            )
            # The paper row IS the success record, so the job row's work
            # is done -- see exam_schema.py's note on why there is no
            # 'done' status.
            cur.execute("DELETE FROM exam_generation_jobs WHERE exam_id = %s", (exam_id,))
        conn.commit()
        logger.info("Exam %s revision %d generated and materialized", exam_id, revision)
    finally:
        conn.close()


def _release_generation(exam_id: str) -> None:
    """Gives back a claim _claim_generation granted and nobody used."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM exam_generation_jobs WHERE exam_id = %s AND status = 'running'", (exam_id,))
        conn.commit()
    finally:
        conn.close()


def _claim_generation(exam_id: str, revision: int) -> tuple[str, dict | None]:
    """Decides, in one transaction, what should happen for an exam id
    with no materialized paper. Returns (outcome, detail):

      'claimed'   -- this caller won the right to generate; spawn a worker
      'running'   -- someone else is already generating it
      'cooldown'  -- the last attempt failed recently; detail says why

    The INSERT ... ON CONFLICT DO NOTHING is the lock: whichever caller
    comes back with rowcount 1 is the only one that generates. This is
    what makes the retry button, a refresh, and a second tab cost
    nothing instead of each starting their own full cascade."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO exam_generation_jobs (exam_id, revision, status)
                VALUES (%s, %s, 'running')
                ON CONFLICT (exam_id) DO NOTHING
                """,
                (exam_id, revision),
            )
            if cur.rowcount == 1:
                conn.commit()
                return "claimed", None

            cur.execute(
                """
                SELECT status,
                       error,
                       GREATEST(0, EXTRACT(EPOCH FROM (retry_after - NOW())))::int,
                       updated_at < NOW() - make_interval(secs => %s)
                  FROM exam_generation_jobs
                 WHERE exam_id = %s
                 FOR UPDATE
                """,
                (_STALE_RUNNING_SECONDS, exam_id),
            )
            row = cur.fetchone()
            if row is None:
                # The row was deleted between the INSERT and this SELECT
                # -- a worker finished successfully just now. Report it
                # as running; the caller reads the real paper on its next
                # poll.
                conn.commit()
                return "running", None

            status, error, retry_after, is_stale = row
            reclaimable = (
                (status == "failed" and retry_after <= 0)
                or (status == "running" and is_stale)
            )
            if reclaimable:
                cur.execute(
                    """
                    UPDATE exam_generation_jobs
                       SET status = 'running', error = NULL, retry_after = NULL,
                           revision = %s, started_at = NOW(), updated_at = NOW()
                     WHERE exam_id = %s
                    """,
                    (revision, exam_id),
                )
                conn.commit()
                return "claimed", None

            conn.commit()
            if status == "failed":
                return "cooldown", {"error": error, "retryAfter": retry_after}
            return "running", None
    finally:
        conn.close()


def _start_generation(exam_id: str, revision: int) -> None:
    threading.Thread(
        target=_generation_worker, args=(exam_id, revision),
        name=f"exam-gen:{exam_id}:r{revision}", daemon=True,
    ).start()


@router.get("/api/exams")
def list_exams(user_id: str = Depends(get_user_id)):
    # Static catalog, not a materialization trigger -- per the original
    # plan ("GET /api/exams -- static catalog, no materialization needed
    # to list"). This used to generate on demand for every registered
    # id, which meant the FIRST catalog request after a fresh
    # deploy synchronously generated all ~15 LLM-dependent papers (each
    # several slow model calls) before returning anything -- live-
    # diagnosed 2026-08 when a single GET /api/exams call hung for
    # minutes. Already-materialized papers still report their real,
    # exact counts; anything not yet generated reports the blueprint's
    # target counts instead, and generation only actually happens when a
    # user opens that specific exam (GET /api/exams/{exam_id} below).
    #
    # Three more fields per entry since plan 159, for the exam station
    # filled on the desk: `minutes` (the paper's printed time limit, or
    # the generator's rule over the expected items), `mondai` (the
    # blueprint's names for what the paper holds) and `last` (this
    # learner's newest sitting, or null).
    last_attempts = _last_attempts(user_id)
    out = []
    for exam_id, (_generator_version, kind, level, _generate) in EXAM_GENERATORS.items():
        label, label_jp, _types = _KIND_META[kind]
        # The revision THIS user would be served, not "the" paper: the
        # picker needs it both to say whether opening the exam costs a
        # wait, and to pass as `exclude` when they ask for a different
        # paper than the one they are being offered.
        selected = _select_paper(exam_id, user_id)
        if selected is not None:
            revision, paper = selected
            entry = {
                "level": paper["level"],
                "title": paper["title"],
                "titleJp": paper["titleJp"],
                "questionCount": len(flatten_questions(paper)),
                "generated": True,
                "revision": revision,
            }
        else:
            entry = {
                "level": level,
                "title": f"{level} {label}",
                "titleJp": f"{level} {label_jp}",
                "questionCount": _expected_question_count(level, kind),
                # False means "opening this will generate it", which is
                # slow (minutes, for the LLM-backed kinds) -- the picker
                # screen warns before the learner commits to waiting
                # rather than dropping them on a silent spinner. Note it
                # can be False for an exam that HAS papers: this learner
                # has sat all of them, so the next one is a generation
                # for them even though the row count is not zero.
                "generated": False,
                "revision": None,
            }
        entry["minutes"] = _paper_minutes(
            selected[1] if selected is not None else None, entry["level"], kind, entry["questionCount"],
        )
        entry["mondai"] = _mondai_names(level, kind)
        entry["parts"] = _mondai_parts(level, kind, selected[1] if selected is not None else None)
        entry["last"] = last_attempts.get(exam_id)
        # `kind` travels explicitly so the client can group/label by it
        # without parsing exam_id -- the "{level}-{kind}-01" id scheme is
        # this module's business, not the frontend's.
        out.append({"id": exam_id, "kind": kind, **entry})
    return out


@router.get("/api/exams/{exam_id}")
def get_exam(exam_id: str, revision: int | None = None, exclude: str | None = None,
             user_id: str = Depends(get_user_id)):
    """200 + the paper once it exists; 202 while it is being generated;
    503 for a short cooldown after a failed attempt. The client polls
    this (see frontend/src/screens/ExamRunner.jsx) rather than holding
    one request open for the minutes a generation takes.

    `exclude` is a comma-separated list of revisions not to serve — how
    "give me a different paper" is asked for. Revisions this user has
    already ATTEMPTED are excluded unconditionally and need not be
    listed; `exclude` covers the other case, a paper they opened and
    abandoned without submitting. `revision` overrides all of that and
    asks for one exact paper."""
    if exam_id not in EXAM_GENERATORS:
        raise HTTPException(status_code=404, detail=f"Unknown exam id: {exam_id}")

    # An exact revision, asked for by the result screen on the reload
    # path: it must render an old attempt against the paper that attempt
    # was taken on, which is precisely the paper the selection rule
    # below would refuse to hand back. Never generates -- a revision
    # nobody has is a 404, not a two-minute wait.
    if revision is not None:
        paper = _load_paper(exam_id, revision)
        if paper is None:
            raise HTTPException(status_code=404, detail=f"Unknown revision {revision} for {exam_id}")
        return {**name_mondai(paper), "revision": revision}

    skipped = _parse_exclude(exclude)
    selected = _select_paper(exam_id, user_id, skipped)
    if selected is not None:
        revision, paper = selected
        # The revision travels with the paper because the client needs
        # to send it back on submit (so the attempt is scored against
        # the paper actually sat, not whichever one the selection rule
        # would pick at submit time) and to key its saved draft.
        return {**name_mondai(paper), "revision": revision}

    revision = _next_revision(exam_id)
    outcome, detail = _claim_generation(exam_id, revision)
    if outcome == "claimed":
        # A new paper is ~35 model calls, and "a different paper"
        # listing every revision there is starts one (plan 211): a
        # learner may start EXAM_PAPERS_DAILY_LIMIT such a day. An exam's
        # first paper, and the one a generator change calls for, are not
        # counted -- they are the paper everyone sits. Counted only when
        # this request would start one, so the polls while it is written
        # and joining another learner's cost nothing.
        if skipped and daily_limit.claim(user_id, EXAM_PAPERS_FEATURE, EXAM_PAPERS_DAILY_LIMIT) > EXAM_PAPERS_DAILY_LIMIT:
            _release_generation(exam_id)
            raise HTTPException(
                status_code=429,
                detail=(f"Daily limit of {EXAM_PAPERS_DAILY_LIMIT} new papers reached; "
                        f"resets {resets_at(user_id):%Y-%m-%dT%H:%MZ}"),
            )
        _start_generation(exam_id, revision)
    if outcome == "cooldown":
        # The error text is the generator's own, safe to show: it names
        # what could not be produced, not anything about the account.
        return JSONResponse(
            status_code=503,
            content={
                "status": "failed",
                "examId": exam_id,
                "error": detail["error"],
                "retryAfter": detail["retryAfter"],
            },
            headers={"Retry-After": str(detail["retryAfter"])},
        )
    return JSONResponse(status_code=202, content={"status": "generating", "examId": exam_id})


class SubmitAttemptPayload(BaseModel):
    section_id: str
    answers: dict[str, str]
    started_at: int   # epoch ms, matches Date.now() on the client
    finished_at: int
    # Which revision the learner actually sat. Optional so a client that
    # loaded a paper before this shipped can still submit; omitted, the
    # server falls back to the selection rule, which for a learner mid-
    # attempt still resolves to the paper they were given.
    revision: int | None = None


@router.post("/api/exams/{exam_id}/attempts")
def submit_attempt(exam_id: str, payload: SubmitAttemptPayload, user_id: str = Depends(get_user_id)):
    if exam_id not in EXAM_GENERATORS:
        raise HTTPException(status_code=404, detail=f"Unknown exam id: {exam_id}")

    # Reads, never generates. A learner cannot have just taken a paper
    # that was never materialized, so arriving here with no row means the
    # paper was deleted (or this is a stray request) -- and triggering a
    # multi-minute generation to score answers that could not have come
    # from it would both block the submit and score against different
    # content than the learner saw.
    #
    # By exact revision when the client names one: _select_paper would
    # be wrong here for the same reason it is right everywhere else --
    # it deliberately skips papers this user has already attempted, and
    # on a re-submit that is the very paper being scored.
    if payload.revision is not None:
        revision, paper = payload.revision, _load_paper(exam_id, payload.revision)
    else:
        selected = _select_paper(exam_id, user_id)
        revision, paper = selected if selected else (None, None)
    if paper is None:
        raise HTTPException(
            status_code=409,
            detail=f"Exam {exam_id} has not been generated; cannot score an attempt against it.",
        )

    summary = score_attempt(paper, payload.answers)

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO exam_attempts
                    (user_id, exam_id, revision, section_id, answers, review, per_section, correct, total, started_at, finished_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, to_timestamp(%s), to_timestamp(%s))
                RETURNING id
                """,
                (
                    user_id, exam_id, revision, payload.section_id,
                    json.dumps(payload.answers), json.dumps(summary["review"]), json.dumps(summary["perSection"]),
                    summary["correct"], summary["total"],
                    payload.started_at / 1000, payload.finished_at / 1000,
                ),
            )
            attempt_id = cur.fetchone()[0]
        conn.commit()
    finally:
        conn.close()

    # The fare for the paper: one ledger row for the attempt, each item
    # at a card's correct or wrong rate (srs.award_practice). The one
    # practice mode whose score the server computed itself.
    fare = srs.award_practice(
        user_id, "exam", str(attempt_id),
        [4] * summary["correct"] + [1] * (summary["total"] - summary["correct"]),
    )

    return {
        **fare,
        "attemptId": attempt_id,
        "examId": exam_id,
        "revision": revision,
        # Echoed back rather than left to the caller: the result screen
        # reads startedAt/finishedAt off this response on the fast path
        # and off get_attempt on a reload, and the two have to agree.
        "startedAt": payload.started_at,
        "finishedAt": payload.finished_at,
        **summary,
    }


def _epoch_ms(value):
    """A TIMESTAMPTZ column as epoch milliseconds, the unit the exam
    API speaks everywhere else (see SubmitAttemptPayload)."""
    return int(value.timestamp() * 1000) if value is not None else None


@router.get("/api/exams/{exam_id}/attempts/{attempt_id}")
def get_attempt(exam_id: str, attempt_id: int, user_id: str = Depends(get_user_id)):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT section_id, answers, review, per_section, correct, total, revision,
                       started_at, finished_at
                FROM exam_attempts
                WHERE id = %s AND user_id = %s AND exam_id = %s
                """,
                (attempt_id, user_id, exam_id),
            )
            row = cur.fetchone()
    finally:
        conn.close()

    if row is None:
        raise HTTPException(status_code=404, detail="Unknown attempt")

    section_id, answers, review, per_section, correct, total, revision, started_at, finished_at = row
    return {
        "attemptId": attempt_id,
        "examId": exam_id,
        # The result screen re-fetches the paper on a reload; without
        # this it would fetch whichever revision the learner should be
        # served NEXT and render an old result against the wrong
        # questions.
        "revision": revision,
        "sectionId": section_id,
        "answers": answers,
        "review": review,
        "perSection": per_section,
        "correct": correct,
        "total": total,
        # Already recorded on submit, just never handed back — which is
        # why a reloaded result page could not show how long the paper
        # took while the one navigated to directly could.
        # Epoch ms, matching what submit_attempt takes in and hands
        # back. These are TIMESTAMPTZ columns, so returning them raw
        # would make this endpoint answer with ISO strings while the
        # submit path answered with numbers, for the same two fields.
        "startedAt": _epoch_ms(started_at),
        "finishedAt": _epoch_ms(finished_at),
    }


@router.get("/api/exams/{exam_id}/revisions/{revision}/questions/{question_id}/study")
def get_question_study(exam_id: str, revision: int, question_id: str, lang: str = "en",
                       user_id: str = Depends(get_user_id)):
    """A sat question made something to study, for the result screen's
    review: its sentence with the answer in place (what the breakdown
    reads), that sentence and each choice in the learner's language, and
    a reading passage or listening script translated. The texts come
    from the stored paper, never from the request; the translations are
    cached by content (study/exam_study.py), so a shared paper costs one
    model call per question and language, whoever asks."""
    if exam_id not in EXAM_GENERATORS:
        raise HTTPException(status_code=404, detail=f"Unknown exam id: {exam_id}")
    paper = _load_paper(exam_id, revision)
    if paper is None:
        raise HTTPException(status_code=404, detail=f"Unknown revision {revision} for {exam_id}")
    # Imported here: routes/reading.py seeds the comprehension pool at
    # import, which the exam router has no business triggering.
    from routes.reading import LANG_NAMES, known_lang
    # Known languages only (plan 211): the translations are cached by
    # language, so any other string was a model call per new spelling.
    lang = known_lang(lang)
    try:
        study = study_question(paper, question_id, lang, LANG_NAMES[lang])
    except (LLMUnavailable, GenerationFailed) as e:
        logger.warning("exam study for %s/%s/%s failed: %s", exam_id, revision, question_id, e)
        raise HTTPException(status_code=503, detail="Translation unavailable")
    if study is None:
        raise HTTPException(status_code=404, detail=f"Unknown question {question_id}")
    return study
