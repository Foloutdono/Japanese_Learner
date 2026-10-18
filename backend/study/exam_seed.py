# ── The exam pool's seed papers (plan 228) ───────────────────────
# exam_papers starts empty, and an empty exam id costs its first
# learner a generation: ~35 model calls and minutes on a spinner, at
# each of the twenty exam ids (five levels, four kinds), on every fresh
# database -- and again for every learner who has sat every revision
# there is. The papers in content/exam_seed/ are the floor under that:
# PER_EXAM papers per exam id, made by the very generators the route
# calls (scripts/exam_seed.py replays them, with Claude writing what the
# model would have written), so each one went through every check a
# generated paper goes through, and loaded here at import so every exam
# id has papers to serve before any learner or operator has done
# anything. Same arrangement as the comprehension pool's seeds
# (routes/reading.py, plan 111).
#
# A seed is stored as an ordinary revision of its exam id, at the
# generator_version that made it, so the route serves it by its own
# rule (the lowest revision of the current version this learner has
# not sat) without knowing seeds exist. Its row carries `seed_key`,
# "{exam_id}#{n}@{hash}": the hash is over the paper and its version,
# so a warm pool costs one SELECT of the keys and nothing else.
#
# A seed whose paper changed (a corrected question, papers rebuilt
# after a generator bump) is rewritten in place while nobody has sat
# it. Once somebody has, its revision must keep meaning the paper they
# sat (their result screen re-fetches it by revision), so the old row
# is retired instead -- its generator_version prefixed with "retired:",
# which no generator registers, so _select_paper never serves it again
# -- and the corrected paper is stored as a new revision.
#
# A seed file made by a generator_version that is no longer the
# registered one is skipped: its papers could never be served, and a
# version bump is exactly the statement that they should not be.
# tests/test_exam_seed.py fails until they are rebuilt.
import hashlib
import json
import logging
import re
from pathlib import Path

from study.exam_audio_repair import questions_with_audio, turns_from_script
from study.exam_blueprint import LEVEL_BLUEPRINT
from study.exam_catalogue import EXAM_GENERATORS, KIND_META
from study.exam_levels import kanji_outside, paper_grammar_above
from study.exam_scoring import flatten_questions
from study.exam_tells import centre, outlier, tell
from study.exam_tts import content_key
from study.exam_validation import paper_gives_answer_away, validate_answer_balance, validate_content

logger = logging.getLogger(__name__)

SEED_DIR = Path(__file__).resolve().parent.parent / "content" / "exam_seed"

# The owner's floor: ten papers per exam id, i.e. per kind and level.
PER_EXAM = 10

RETIRED_PREFIX = "retired:"


def seed_for(exam_id: str, n: int) -> int:
    """The generator seed of seed paper `n`. Not routes/exams._seed_for:
    that one is keyed by revision, and a seed's revision is whatever the
    database it lands in has free -- the paper must not depend on it."""
    return int(hashlib.sha256(f"{exam_id}:seed:{n}".encode()).hexdigest(), 16) % (2**63)


def seed_path(exam_id: str) -> Path:
    return SEED_DIR / f"{exam_id}.json"


def load(exam_id: str) -> dict | None:
    """The exam id's seed file, {"examId", "generatorVersion", "papers":
    [{"n", "seed", "paper"}, ...]}, or None if it has none."""
    path = seed_path(exam_id)
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def seed_key(exam_id: str, n: int, version: str, paper: dict) -> str:
    raw = json.dumps([version, paper], ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return f"{exam_id}#{n}@{hashlib.sha256(raw.encode('utf-8')).hexdigest()[:16]}"


def expected_parts(level: str, kind: str) -> list[tuple[str, int]]:
    """(mondai id, items) for every blueprint mondai this kind's paper is
    made of at `level`, in the blueprint's order: what a complete paper
    holds. A generator ships a paper without a mondai it could not fill;
    a seed never does."""
    types = KIND_META[kind][2]
    return [
        (m["id"], m["count"])
        for section in LEVEL_BLUEPRINT[level]["sections"]
        for m in section["mondai"]
        if m["type"] in types
    ]


def paper_parts(paper: dict) -> list[tuple[str, int]]:
    out = []
    for section in paper.get("sections") or []:
        for m in section.get("mondai") or []:
            if m.get("type") == "cloze-passage":
                n = sum(len(p.get("blanks") or []) for p in m.get("passages") or [])
            elif m.get("passages") is not None:
                n = sum(len(p.get("questions") or []) for p in m["passages"])
            else:
                n = len(m.get("questions") or [])
            out.append((m.get("id"), n))
    return out


def problems(exam_id: str, paper: dict) -> list[str]:
    """Why `paper` is not fit to be one of `exam_id`'s seeds -- [] when
    it is. The paper-level checks the generators run (exam_pipeline:
    validate_content, the answer-position balance), the one the route
    runs before serving (paper_gives_answer_away), completeness, a
    sentence-order ★ on a middle slot (exam_grammar_gen.star_slot), the
    choices' looks (choice_tells) and the level of what is printed -- no
    kanji and no grammar point above the paper's level
    (study/exam_levels.py, plan 254) -- and, for listening, that every
    clip can be remade from its own script (study/exam_audio_repair.py),
    since no seed ships its audio."""
    _version, kind, level, _generate = EXAM_GENERATORS[exam_id]
    out = []
    if paper.get("level") != level:
        out.append(f"level {paper.get('level')!r}, not {level}")
    have, want = paper_parts(paper), expected_parts(level, kind)
    if have != want:
        out.append(f"parts {have}, not {want}")
    flat = flatten_questions(paper)
    out += validate_content(flat, check_duplicates=(kind == "vocab"))
    out += validate_answer_balance(flat)
    if paper_gives_answer_away(paper):
        out.append("a choice repeats the underlined word")
    for q in flat:
        if "pieces" in q and q.get("starIndex") not in (1, 2):
            out.append(f"{q.get('id')}: the ★ is on the first or last piece, answered by punctuation")
    out += choice_tells(paper, level)
    out += kanji_item_problems(paper, level)
    out += item_shape_problems(paper, level)
    out += [f"{where}: kanji outside {level}: {chars}" for where, chars in kanji_outside(paper, kind)]
    out += [f"{where}: grammar above {level}: {pattern} ({point_level})"
            for where, pattern, point_level in paper_grammar_above(paper, kind)]
    for q in questions_with_audio(paper):
        turns = turns_from_script(q.get("scriptJp") or "")
        if turns is None or q.get("audioSrc") != f"/exam-audio/{content_key(turns)}.mp3":
            out.append(f"{q.get('id')}: audioSrc is not the clip of its scriptJp")
    return out


def _kinds(level: str) -> dict[str, str]:
    """The blueprint's type of each mondai id at `level` (the stored papers
    all say mcq-text)."""
    return {m["id"]: m["type"] for s in LEVEL_BLUEPRINT[level]["sections"] for m in s["mondai"]}


# What the choices give away by how they look beside each other
# (study/exam_tells.py, plan 254): an answer that is one of two choices a
# character apart, or the one choice nearest to all the others, is found
# without reading the question. A listening item is spared the first: its
# choices are the figures and places the recording gives (5時 / 5時半 /
# 6時), and what tells them apart is heard.
def choice_tells(paper: dict, level: str) -> list[str]:
    kinds = _kinds(level)
    out = []
    for section in paper.get("sections") or []:
        for m in section.get("mondai") or []:
            blueprint = kinds.get(m.get("id"))
            groups = [m.get("questions") or []]
            for passage in m.get("passages") or []:
                groups += [passage.get("blanks") or [], passage.get("questions") or []]
            for q in (q for group in groups for q in group):
                choices = [c.get("textJp") or "" for c in q.get("choices") or []]
                if len(choices) != 4 or q.get("audioSrc"):
                    continue
                answer = next((i for i, c in enumerate(q["choices"]) if c.get("id") == q.get("answer")), None)
                why = tell(choices)
                if why:
                    out.append(f"{q.get('id')}: {why}: {' / '.join(choices)}")
                elif blueprint in ("kanji-reading", "kanji-orthography") and answer in (centre(choices), outlier(choices)):
                    out.append(f"{q.get('id')}: the answer is the choice most or least like the others: {' / '.join(choices)}")
    return out


# A 漢字読み item's wrong readings are readings (no ぱじめ), none is a
# reading of the word, and a 表記 item's wrong spellings are no spelling of
# the word (study/exam_kanji_choices.py, plan 254).
def kanji_item_problems(paper: dict, level: str) -> list[str]:
    from study import exam_kanji_choices as kc

    kinds = _kinds(level)
    out = []
    for section in paper.get("sections") or []:
        for m in section.get("mondai") or []:
            check = {"kanji-reading": kc.reading_item_problems, "kanji-orthography": kc.orthography_item_problems}.get(kinds.get(m.get("id")))
            for q in m.get("questions") or [] if check else []:
                choices = [c.get("textJp") or "" for c in q.get("choices") or []]
                answer = next((i for i, c in enumerate(q.get("choices") or []) if c.get("id") == q.get("answer")), None)
                if len(choices) == 4 and answer is not None:
                    out += [f"{q.get('id')}: {why}" for why in check(q.get("promptJp") or "", choices, answer)]
    return out


# A fill-in item has its blank and a paraphrase item its underline. A stem
# edited by hand can lose either, and then shows a finished sentence over
# four loose words, which no other check notices (plan 254).
def item_shape_problems(paper: dict, level: str) -> list[str]:
    kinds = _kinds(level)
    out = []
    for section in paper.get("sections") or []:
        for m in section.get("mondai") or []:
            kind = kinds.get(m.get("id"))
            for q in m.get("questions") or []:
                prompt = q.get("promptJp") or ""
                if kind == "vocab-context":
                    blanks = re.findall(r"＿+", prompt)
                    if len(blanks) != 1 or len(blanks[0]) != 4:
                        out.append(f"{q.get('id')}: a fill-in stem has one ＿＿＿＿, not {blanks or 'none'}")
                elif kind == "vocab-paraphrase":
                    underline = q.get("underlineJp") or ""
                    if not underline or underline not in prompt:
                        out.append(f"{q.get('id')}: the underlined word {underline!r} is not in the stem")
    return out


# Choices must be told apart by understanding, never by the eye (the
# tours' and the conversation bank's rule, plan 217): written with care,
# the right choice drifts to the longest. Across an exam id's seeds,
# picking the longest choice, or the shortest, ties shared, must win
# about as often as a blind pick of four.
LENGTH_TELL = (0.15, 0.35)


def length_tells(papers: list[dict]) -> list[str]:
    longest = shortest = 0.0
    items = 0
    for paper in papers:
        for q in flatten_questions(paper):
            choices = q.get("choices") or []
            right = [i for i, c in enumerate(choices) if c.get("id") == q.get("answer")]
            if len(choices) != 4 or len(right) != 1:
                continue
            sizes = [len(c.get("textJp") or "") for c in choices]
            size = sizes[right[0]]
            items += 1
            if size == max(sizes):
                longest += 1 / sizes.count(size)
            if size == min(sizes):
                shortest += 1 / sizes.count(size)
    if not items:
        return []
    low, high = LENGTH_TELL
    out = []
    for name, wins in (("the longest", longest), ("the shortest", shortest)):
        share = wins / items
        if not low <= share <= high:
            out.append(f"picking {name} choice wins {share:.0%} ({wins:.1f} of {items}); "
                       f"length must say nothing, {low:.0%} to {high:.0%}")
    return out


# The choice nearest to all the others (study/exam_tells.centre) is what a
# set of wrong choices written by editing the right one leaves the right
# one: picked blind, it was the answer of 95% of the old 漢字読み items and
# of 45% of the N4 grammar ones. Across an exam id's seeds, a blind pick of
# it must win about as often as a blind pick of four.
LIKENESS_TELL = 0.36
LIKENESS_MIN_ITEMS = 40       # fewer items than this say nothing


def likeness_tells(papers: list[dict]) -> list[str]:
    items = hits = 0
    for paper in papers:
        for q in flatten_questions(paper):
            choices = q.get("choices") or []
            right = [i for i, c in enumerate(choices) if c.get("id") == q.get("answer")]
            if len(choices) != 4 or len(right) != 1 or q.get("audioSrc"):
                continue
            middle = centre([c.get("textJp") or "" for c in choices])
            if middle is not None:
                items += 1
                hits += middle == right[0]
    if items < LIKENESS_MIN_ITEMS or hits / items <= LIKENESS_TELL:
        return []
    return [f"picking the choice most like the others wins {hits / items:.0%} ({hits} of {items}); "
            f"looks must say nothing, {LIKENESS_TELL:.0%} at most"]


def authored_texts(paper: dict) -> list[str]:
    """The texts of a paper a model wrote (passages, scripts, sentences),
    not the deck-built items: no two seeds of an exam id may share one.
    A shared text is two papers that are one paper in part -- what a
    learner who sits both notices first."""
    out = []
    for section in paper.get("sections") or []:
        for m in section.get("mondai") or []:
            for p in m.get("passages") or []:
                out.append(p.get("textJp") or p.get("textTemplateJp") or "")
            for q in m.get("questions") or []:
                if q.get("scriptJp"):
                    out.append(q["scriptJp"])
                elif m.get("type") == "sentence-order":
                    by_id = {piece["id"]: piece["textJp"] for piece in q.get("pieces") or []}
                    out.append((q.get("contextJp") or "") + "".join(by_id.get(i, "") for i in q.get("order") or []))
                elif q.get("underlineJp") or section.get("id") == "grammar":
                    out.append(q.get("promptJp") or "")
    return [t for t in out if t]


def exam_problems(exam_id: str) -> list[str]:
    """Everything wrong with an exam id's seed file -- [] when it holds
    PER_EXAM sound papers made by the generator_version it registers."""
    version = EXAM_GENERATORS[exam_id][0]
    data = load(exam_id)
    if data is None:
        return [f"{exam_id}: no seed file"]
    out = []
    if data.get("examId") != exam_id:
        out.append(f"{exam_id}: the file names {data.get('examId')!r}")
    if data.get("generatorVersion") != version:
        out.append(f"{exam_id}: made by {data.get('generatorVersion')}, not {version}: rebuild it")
    entries = data.get("papers") or []
    numbers = [e.get("n") for e in entries]
    if sorted(numbers) != list(range(1, len(numbers) + 1)) or len(numbers) < PER_EXAM:
        out.append(f"{exam_id}: seeds {numbers}, not 1 to {PER_EXAM} at least")
    texts = set()
    seen: dict[str, int] = {}
    for e in entries:
        if e.get("seed") != seed_for(exam_id, e.get("n")):
            out.append(f"{exam_id} #{e.get('n')}: seed is not seed_for({e.get('n')})")
        out += [f"{exam_id} #{e.get('n')}: {p}" for p in problems(exam_id, e["paper"])]
        text = json.dumps(e["paper"], ensure_ascii=False, sort_keys=True)
        if text in texts:
            out.append(f"{exam_id} #{e.get('n')}: the same paper as another seed")
        texts.add(text)
        for t in dict.fromkeys(authored_texts(e["paper"])):
            if t in seen and seen[t] != e.get("n"):
                out.append(f"{exam_id} #{e.get('n')}: shares a text with #{seen[t]}: {t[:40]}...")
            seen.setdefault(t, e.get("n"))
    out += [f"{exam_id}: {t}" for t in length_tells([e["paper"] for e in entries])]
    out += [f"{exam_id}: {t}" for t in likeness_tells([e["paper"] for e in entries])]
    return out


def rows():
    """(exam_id, version, n, seed, paper) for every seed whose file was
    made by the generator_version the exam id registers now. One file at
    a time, so the whole pool is never held at once."""
    for exam_id, (version, _kind, _level, _generate) in EXAM_GENERATORS.items():
        data = load(exam_id)
        if data is None:
            continue
        if data.get("generatorVersion") != version:
            logger.warning("exam seeds for %s were made by %s, not %s: skipped until rebuilt",
                           exam_id, data.get("generatorVersion"), version)
            continue
        for entry in data.get("papers") or []:
            yield exam_id, version, entry["n"], entry["seed"], entry["paper"]


def seed_exam_papers() -> int:
    """Store every seed that is missing or stale. Returns how many papers
    were written (inserted or rewritten); 0 on a warm pool."""
    # Here, not at the top: core.db opens its pool on import, and the
    # rest of this module is read by scripts/exam_seed.py, which has no
    # database.
    from core.db import db_conn

    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT seed_key FROM exam_papers WHERE seed_key IS NOT NULL")
            stored = {key for (key,) in cur.fetchall()}
            written = 0
            for exam_id, version, n, seed, paper in rows():
                key = seed_key(exam_id, n, version, paper)
                if key in stored:
                    continue
                written += _store(cur, exam_id, version, n, seed, paper, key)
        conn.commit()
    finally:
        conn.close()
    if written:
        logger.info("exam pool: %d seed paper(s) written", written)
    return written


def _store(cur, exam_id: str, version: str, n: int, seed: int, paper: dict, key: str) -> int:
    payload = json.dumps(paper, ensure_ascii=False)
    sections, questions = len(paper["sections"]), len(flatten_questions(paper))
    # The row an earlier copy of this seed was stored as, if any.
    cur.execute(
        """
        SELECT p.revision,
               EXISTS (SELECT 1 FROM exam_attempts a
                        WHERE a.exam_id = p.exam_id AND a.revision = p.revision)
          FROM exam_papers p
         WHERE p.exam_id = %s AND split_part(p.seed_key, '@', 1) = %s
        """,
        (exam_id, f"{exam_id}#{n}"),
    )
    old = cur.fetchone()
    if old is not None and not old[1]:
        cur.execute(
            """
            UPDATE exam_papers
               SET paper = %s, generator_version = %s, seed = %s, seed_key = %s,
                   section_count = %s, question_count = %s
             WHERE exam_id = %s AND revision = %s
            """,
            (payload, version, seed, key, sections, questions, exam_id, old[0]),
        )
        return 1
    if old is not None:
        cur.execute(
            """
            UPDATE exam_papers
               SET generator_version = %s || generator_version, seed_key = NULL
             WHERE exam_id = %s AND revision = %s
            """,
            (RETIRED_PREFIX, exam_id, old[0]),
        )
    # One past the highest revision at any version, as _next_revision
    # numbers a generated paper. A generation storing the same revision
    # meanwhile wins it; this seed is stored on the next start.
    cur.execute(
        """
        INSERT INTO exam_papers
            (exam_id, revision, level, seed, generator_version, paper, section_count, question_count, seed_key)
        SELECT %s, COALESCE(MAX(revision), 0) + 1, %s, %s, %s, %s, %s, %s, %s
          FROM exam_papers WHERE exam_id = %s
        ON CONFLICT DO NOTHING
        """,
        (exam_id, paper["level"], seed, version, payload, sections, questions, key, exam_id),
    )
    return cur.rowcount
