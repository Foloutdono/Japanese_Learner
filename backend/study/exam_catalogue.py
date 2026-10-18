# ── The exam catalogue ───────────────────────────────────────
# Which exam ids exist, which generator (and generator_version) makes
# each one's papers, and which blueprint mondai each kind is made of.
# Moved out of routes/exams.py (plan 228) so that what needs only the
# registry -- the seed papers' loader (study/exam_seed.py) and the
# script that authors them (scripts/exam_seed.py) -- can read it without
# importing the route, whose import migrates the exam tables. The route
# imports everything here under its old names.
from functools import partial

from study.exam_grammar_gen import generate_grammar_paper
from study.exam_listening_gen import generate_listening_paper
from study.exam_reading_gen import generate_reading_paper
from study.exam_vocab_gen import generate_vocabulary_paper

LEVELS = ["N5", "N4", "N3", "N2", "N1"]

# kind -> (title label, JP title label, blueprint mondai `type`s this
# generator builds). Single source of truth for both EXAM_GENERATORS
# below and routes/exams.list_exams()'s static estimate — must stay in sync with
# each generator's own title strings (exam_vocab_gen.py /
# exam_reading_gen.py / exam_grammar_gen.py's f"{level} ... Practice" /
# f"{level} ..." literals) since those are what actually gets served
# once a paper materializes; this is only the pre-materialization guess.
KIND_META = {
    "vocab": (
        "Vocabulary Practice", "語彙",
        {"kanji-reading", "kanji-orthography", "vocab-context", "vocab-paraphrase", "vocab-usage"},
    ),
    "reading": ("Reading Practice", "読解", {"reading-passage"}),
    "grammar": ("Grammar Practice", "文法", {"grammar-fill", "sentence-order", "cloze-passage"}),
    # Only "listening-mcq" (課題理解/ポイント理解) is actually generated
    # today -- 発話表現/即時応答/概要理解/統合理解 are still skipped by
    # exam_listening_gen.py (see its own module docstring), so counting
    # them here would make the pre-materialization estimate promise more
    # items than a real generation attempt can currently deliver. Widen
    # this set as each of those ships its own generator.
    "listening": ("Listening Practice", "聴解", {"listening-mcq"}),
}

# id -> (generator_version, kind, level, callable(seed) -> paper).
# generator_version is stored per row in exam_papers AND filtered on
# when a paper is served (see routes/exams._select_paper): bumping the string here
# retires every paper an older generator produced, in one edit, without
# deleting a thing -- past attempts still render against the revision
# they were taken on, and nothing new is ever served from the old
# prompt. That is what the reading/listening/grammar "-gen-2" bumps
# below are for: the papers generated before study/exam_topics.py
# existed all drew on the same handful of subjects, and the reading
# ones frequently failed to generate at all.
#
# kind/level are needed by routes/exams.list_exams() to describe a not-yet-
# materialized exam without generating it.
#
# study/exam_stub.py's hand-written preview paper is deliberately NOT
# registered here anymore: it existed to prove the generation pipe end
# to end before any real generator existed ("once the real generator
# lands, this stops being registered" — its own module docstring), and
# with all four real generators shipped it was just a fifth, fake entry
# cluttering every learner's exam picker.
EXAM_GENERATORS = {
    **{
        # "-vocab-01", not "-kanji-01": this generator now covers the
        # whole vocabulary section (漢字読み/表記/文脈規定/言い換え類義/
        # 用法 where each has a generator), not kanji items alone — see
        # exam_vocab_gen.py. Renamed rather than kept for continuity
        # since nothing has shipped to real users under the old id yet.
        # -gen-2 (plan 254): the 漢字読み / 表記 items are built by
        # study/exam_kanji_choices.py (words and kanji the level has been
        # taught, readings a word could have, no choice the answer is
        # nearest to), and a word above the level's kanji is shown in
        # kana. The papers made before are retired, not deleted.
        f"{level.lower()}-vocab-01": ("vocab-gen-2", "vocab", level, partial(generate_vocabulary_paper, level))
        for level in LEVELS
    },
    **{
        # A separate paper from "-vocab-01" at every level, including
        # N1/N2 where the real exam presents vocab/grammar/reading in
        # one booklet — accepted simplification, see
        # exam_reading_gen.py's module docstring.
        f"{level.lower()}-reading-01": ("reading-gen-2", "reading", level, partial(generate_reading_paper, level))
        for level in LEVELS
    },
    **{
        # Same accepted simplification as "-reading-01": its own paper
        # at every level rather than merged into the real exam's
        # combined booklet at N1/N2.
        f"{level.lower()}-grammar-01": ("grammar-gen-2", "grammar", level, partial(generate_grammar_paper, level))
        for level in LEVELS
    },
    **{
        # Same accepted simplification as "-reading-01"/"-grammar-01".
        # Needs an LLM provider configured (dialogue text) and a voice
        # engine (VOICEVOX_URL, study/voice_engine.py) for the audio.
        f"{level.lower()}-listening-01": ("listening-gen-2", "listening", level, partial(generate_listening_paper, level))
        for level in LEVELS
    },
}
