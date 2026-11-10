"""
The grammar ladder (plan 187e), walked as steps since plan 194: Choisir
three times, Construire four times, then mastered with the flashcard and
Construire in turn, a miss keeping its step and a miss once mastered a
short relapse (srs/ladder.py); each step's exercise falling back where
the point cannot be asked on it, one key reaching the log, Construire's
typed check, the snapshot of which points can be asked it and write, and
the migration that seeds the ladder from a learner's best mode.
"""
import random

import pytest

from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL, find, grammar_to_id
from core.auth import DEV_USER_ID
from core.db import db_conn
from datetime import datetime, timedelta, timezone

from srs import ladder
from srs.models import CardState
from srs.srs import SRSEngine
from study import card_index, grammar_ladder
from study.grammar_examples import blank_span, highlight_span
from study.grammar_lesson import contrast_payload
from study.modes import GRADED_ORDER_FOR_SOURCE, MODES, eligible_for
from study.level_rule import primary_mode

LADDER = "grammar.ladder"

# (total_reviews, interval_days, is_learning, learning_step) a row at each
# step of the walk (srs/ladder.py, plan 194).
STEP_ROWS = {
    "choose": (1, 0, True, 1),       # Choisir 2
    "build": (4, 2, False, 4),       # Construire 2
    "mastered": (9, 21, False, 7),   # mastered, its flashcard turn
}


def _point(pattern):
    level, entry = find(pattern)
    return level, entry, grammar_to_id(entry, level)


# ── The steps ────────────────────────────────────────────────

def _state(row, mode=LADDER):
    total, interval, learning, step = row
    return CardState(card_id="u:grammar_N5_x", mode=mode, total_reviews=total, interval_days=interval,
                     is_learning=learning, learning_step=step)


def _walk(qualities):
    state, now = CardState(card_id="u:grammar_N5_x", mode=LADDER), datetime(2026, 10, 1, tzinfo=timezone.utc)
    out = []
    for q in qualities:
        state = ladder.review(state, q, now)
        out.append((ladder.step_of(state), state.next_review - now))
    return state, out


def test_choisir_three_times_construire_four_then_mastered():
    state, walk = _walk([4] * 8)
    assert [s for s, _ in walk] == [1, 2, 3, 4, 5, 6, 7, 7]
    assert [w for _, w in walk[:7]] == [
        timedelta(minutes=10), timedelta(hours=1), timedelta(days=1), timedelta(days=2),
        timedelta(days=4), timedelta(days=8), timedelta(days=21),
    ]
    # Mastered as every other card is: 21 days, the bar full.
    assert SRSEngine._classify_stage(state.total_reviews, state.interval_days) == "mastered"


def test_the_bar_climbs_with_every_step_and_never_back():
    state = CardState(card_id="u:x", mode=LADDER)
    seen = [0.0]
    for _ in range(7):
        state = ladder.review(state, 4)
        seen.append(SRSEngine._progress(state.total_reviews, state.interval_days,
                                        state.is_learning, state.learning_step))
    assert seen == sorted(seen) and len(set(seen)) == len(seen) and seen[-1] == 1.0


def test_a_miss_keeps_the_step_and_comes_back_soon():
    for row in (STEP_ROWS["choose"], STEP_ROWS["build"]):
        before = ladder.step_of(_state(row))
        after = ladder.review(_state(row), 1)
        assert ladder.step_of(after) == before
        assert after.next_review - datetime.now(timezone.utc) <= ladder.MISS_WAIT


def test_difficult_is_a_pass():
    assert ladder.step_of(ladder.review(_state(STEP_ROWS["choose"]), 3)) == 2


def test_a_miss_once_mastered_is_a_short_relapse():
    _, walk = _walk([4] * 7 + [1, 4, 4])
    assert [s for s, _ in walk[7:]] == [ladder.RELAPSE_PICK, ladder.RELAPSE_BUILD, ladder.MASTERED]
    assert [w for _, w in walk[7:]] == [ladder.MISS_WAIT, timedelta(days=1), timedelta(days=21)]


def test_mastered_asks_the_flashcard_and_construire_in_turn():
    state, _ = _walk([4] * 7)
    kinds = []
    for _ in range(4):
        kinds.append(ladder.exercise_of(state))
        state = ladder.review(state, 4)
    assert kinds == ["flashcard", "build", "flashcard", "build"]
    assert ladder.step_of(state) == ladder.MASTERED and state.interval_days > 21


def test_a_row_from_before_the_steps_is_read_onto_the_walk():
    # The progress ladder's rows, and rows seeded from another mode.
    assert ladder.step_of(_state((2, 0, True, 2))) == 2
    assert ladder.step_of(_state((3, 0, True, 3))) == 2
    assert ladder.step_of(_state((5, 2, False, 4))) == 4
    assert ladder.step_of(_state((6, 9, False, 4))) == 6
    assert ladder.step_of(_state((9, 40, False, 4))) == ladder.MASTERED
    assert ladder.step_of(_state((9, 40, True, 0))) == ladder.RELAPSE_PICK


def test_the_forecast_runs_the_steps_too(client):
    # preview_reviews_bulk dry-runs the same machine: the tiles' due_in.
    level, entry, raw_id = _point("〜てください")
    _clear(raw_id)
    try:
        _place(raw_id, LADDER, STEP_ROWS["choose"])
        card = _served(client, level, raw_id)
        assert 3500 <= card["review_preview"]["4"]["due_in"] <= 3600
        assert card["review_preview"]["1"]["due_in"] <= 600
    finally:
        _clear(raw_id)


# Where each rating leaves a point, as the card panel's walk draws it
# (plan 198): a row at a step, and the step each quality lands on.
LANDINGS = [
    # Choisir 2: a miss asks it again, a pass climbs to Choisir 3.
    (STEP_ROWS["choose"], {1: 1, 2: 1, 3: 2, 4: 2}),
    # Construire 2 -> Construire 3.
    (STEP_ROWS["build"], {1: 4, 2: 4, 3: 5, 4: 5}),
    # Construire 4: a pass is mastered.
    ((7, 8, False, 6), {1: 6, 3: 7, 4: 7}),
    # Mastered: a miss is the relapse, a pass stays mastered.
    (STEP_ROWS["mastered"], {1: ladder.RELAPSE_PICK, 2: ladder.RELAPSE_PICK, 3: ladder.MASTERED, 4: ladder.MASTERED}),
    # The relapse: its Choisir, then its Construire, then mastered again.
    ((10, 0, True, ladder.RELAPSE_PICK), {1: ladder.RELAPSE_PICK, 4: ladder.RELAPSE_BUILD}),
    ((11, 1, False, ladder.RELAPSE_BUILD), {1: ladder.RELAPSE_BUILD, 4: ladder.MASTERED}),
]


@pytest.mark.parametrize("row,lands", LANDINGS)
def test_the_forecast_says_where_each_rating_leaves_the_point(client, row, lands):
    level, entry, raw_id = _point("〜てください")
    _clear(raw_id)
    try:
        _place(raw_id, LADDER, row)
        preview = _served(client, level, raw_id)["review_preview"]
        for quality, step in lands.items():
            landing = preview[str(quality)]
            assert landing["step"]["step"] == step, quality
            assert landing["passed"] is (quality >= ladder.PASS_QUALITY), quality
    finally:
        _clear(raw_id)


def test_a_landing_has_the_shape_of_the_cards_own_step(client):
    level, entry, raw_id = _point("〜てください")
    _clear(raw_id)
    try:
        _place(raw_id, LADDER, STEP_ROWS["choose"])
        card = _served(client, level, raw_id)
        assert card["step"] == {"step": 1, "group": "choose", "at": 2, "of": 3, "relapse": False}
        assert card["review_preview"]["1"]["step"] == card["step"]
        assert card["review_preview"]["4"]["step"] == {"step": 2, "group": "choose", "at": 3, "of": 3, "relapse": False}
    finally:
        _clear(raw_id)


def test_only_a_ladder_card_forecasts_where_it_lands(client):
    level, entry, raw_id = _point("〜てください")
    mode = "grammar.flashcard.f2b"
    _clear(raw_id)
    try:
        _place(raw_id, mode, (1, 0, True, 1))
        cards = client.get(f"/api/grammar/cards?level={level}&mode={mode}&lang=en&count=25").json()["cards"]
        preview = next(c for c in cards if c["card_id"] == raw_id)["review_preview"]
        assert preview["4"]["due_in"] > 0
        assert all("step" not in p and "passed" not in p for p in preview.values())
    finally:
        _clear(raw_id)


def test_each_step_falls_back_to_the_flashcard():
    assert grammar_ladder.chain_for("choose") == ("contrast", "fill_in", "flashcard")
    assert grammar_ladder.chain_for("build") == ("build", "contrast", "fill_in", "flashcard")
    assert grammar_ladder.chain_for("flashcard") == ("flashcard",)


def test_the_ladder_is_grammars_primary_track_and_asks_every_point():
    assert primary_mode("grammar") == LADDER
    assert GRADED_ORDER_FOR_SOURCE["grammar"][0] == LADDER
    for level, entries in GRAMMAR_POINTS_BY_LEVEL.items():
        assert card_index.total("grammar", level, LADDER) == len(entries)


# ── The snapshot ─────────────────────────────────────────────

def test_the_snapshot_says_what_the_two_exercises_can_be_asked_on():
    # Rewrite it with `python -m scripts.build_ladder_flags` after a
    # catalogue change.
    import json
    written = json.loads(grammar_ladder.SNAPSHOT.read_text(encoding="utf-8"))
    assert written == grammar_ladder.snapshot_now()


def test_construire_and_write_are_offered_for_nearly_every_point():
    for level in GRAMMAR_POINTS_BY_LEVEL:
        total = len(GRAMMAR_POINTS_BY_LEVEL[level])
        assert card_index.total("grammar", level, "grammar.build") >= total - 4
        assert card_index.total("grammar", level, "grammar.write") >= total * 9 // 10


# ── 作る Construire ──────────────────────────────────────────

def _builds():
    for level, entries in GRAMMAR_POINTS_BY_LEVEL.items():
        for entry in entries:
            if grammar_ladder.build_ok(level, entry["pattern"]):
                yield level, entry


def _text(pieces, answers):
    return "".join(answers[p["gap"]] if "gap" in p else "".join(f["text"] for f in p["furigana"])
                   for p in pieces)


def test_every_construire_puts_back_into_its_sentence_and_checks_right():
    seen = 0
    for level, entry in _builds():
        built = grammar_ladder.build_payload(level, entry, "en")
        assert built is not None and built["tr"], entry["pattern"]
        gaps = [p for p in built["pieces"] if "gap" in p]
        assert 1 <= len(gaps) <= grammar_ladder.MAX_GAPS
        verdict = grammar_ladder.check_build(level, entry["pattern"], built["key"], [""] * len(gaps), "en")
        answers = [g["answer"] for g in verdict["gaps"]]
        assert _text(built["pieces"], answers) == verdict["jp"], entry["pattern"]
        # Typed as written, or as read: right.
        assert grammar_ladder.check_build(level, entry["pattern"], built["key"], answers, "en")["verdict"] == "right"
        readings = [g["reading"] for g in verdict["gaps"]]
        assert grammar_ladder.check_build(level, entry["pattern"], built["key"], readings, "en")["verdict"] == "right"
        assert [p["size"] for p in gaps] == [len(r) for r in readings]
        seen += 1
    assert seen >= 535


def test_construire_reads_romaji_and_names_the_one_kana_off():
    level, entry, _ = _point("〜てください")
    for turn in range(10):
        built = grammar_ladder.build_payload(level, entry, "fr", turn)
        verdict = grammar_ladder.check_build(level, entry["pattern"], built["key"], ["tekudasai"], "fr")
        if verdict["gaps"][0]["reading"] == "てください":
            break
    assert verdict["verdict"] == "right"
    close = grammar_ladder.check_build(level, entry["pattern"], built["key"], ["でください"], "fr")
    assert close["verdict"] == "close"
    assert close["gaps"][0]["marks"][0] == {"wrong": "で", "fix": "て"}
    assert grammar_ladder.check_build(level, entry["pattern"], built["key"], ["をください"], "fr")["verdict"] in ("close", "wrong")
    assert grammar_ladder.check_build(level, entry["pattern"], built["key"], ["ます"], "fr")["verdict"] == "wrong"


def test_construire_takes_the_other_register_where_the_translation_cannot_say():
    # Plan 241: « Demain, c'est l'examen » under あしたはテスト＿。 -- です
    # was marked wrong for the sentence's だ, though nothing asked for it.
    level, entry, _ = _point("です／だ")
    key = next(i[0] for i in grammar_ladder._build_items(level, entry["pattern"]) if i[1] == "あしたはテストだ。")
    for typed in ("です", "desu", "デス"):
        verdict = grammar_ladder.check_build(level, entry["pattern"], key, [typed], "fr")
        assert verdict["verdict"] == "right", typed
        assert verdict["gaps"][0] == {"verdict": "right", "answer": "です", "reading": "だ", "marks": [],
                                      "said": "だ", "register": "plain"}
        assert verdict["jp"] == "あしたはテストだ。"
    # The sentence's own answer says nothing more.
    assert "said" not in grammar_ladder.check_build(level, entry["pattern"], key, ["だ"], "fr")["gaps"][0]
    # One kana off the other form is close to it, and corrected towards it.
    close = grammar_ladder.check_build(level, entry["pattern"], key, ["でず"], "fr")["gaps"][0]
    assert close["verdict"] == "close" and close["answer"] == "です" and close["said"] == "だ"
    assert close["marks"] == [{"ok": "で"}, {"wrong": "ず", "fix": "す"}]
    # A wrong answer is corrected towards the sentence, as before.
    wrong = grammar_ladder.check_build(level, entry["pattern"], key, ["でした"], "fr")["gaps"][0]
    assert wrong["verdict"] == "wrong" and wrong["answer"] == "だ" and "said" not in wrong
    # A question keeps its register: 学生だか is not one.
    asked = next(i[0] for i in grammar_ladder._build_items(level, entry["pattern"]) if i[1] == "学生ですか。")
    assert grammar_ladder.check_build(level, entry["pattern"], asked, ["だ"], "fr")["verdict"] == "wrong"


def test_construire_reads_a_kanji_the_keyboard_put_in():
    level, entry, _ = _point("〜と思います")
    key = next(i[0] for i in grammar_ladder._build_items(level, entry["pattern"]) if i[1] == "この店は安いと思います。")
    for typed in ("と思います", "とおもいます", "to omoimasu", "と思う", "とおもう"):
        assert grammar_ladder.check_build(level, entry["pattern"], key, [typed], "en")["verdict"] == "right", typed
    # Read, a wrong one is still wrong, and its correction is drawn in kana.
    wrong = grammar_ladder.check_build(level, entry["pattern"], key, ["と言います"], "en")["gaps"][0]
    assert wrong["verdict"] == "wrong" and "言" not in "".join(m.get("wrong", "") for m in wrong["marks"])


def _key(level, pattern, jp):
    return next(i[0] for i in grammar_ladder._build_items(level, pattern) if i[1] == jp)


def _hole(level, pattern, jp):
    item = next(i for i in grammar_ladder._build_items(level, pattern) if i[1] == jp)
    return [jp[a:b] for a, b in item[2]]


def test_construire_never_cuts_the_negative_off_its_word():
    # Plan 295, the owner's screenshot: これはわたしのかさ＿＿＿＿ません。
    # asked ではあり, the copula's negative without its negation, and あり
    # typed in it was corrected to ではあり -- no form of です -- while the
    # card read これはわたしのかさありません.
    level, entry, _ = _point("です／だ")
    jp = "これはわたしのかさではありません。"
    key = _key(level, entry["pattern"], jp)
    assert _hole(level, entry["pattern"], jp) == ["ではありません"]
    built = next(b for b in (grammar_ladder.build_payload(level, entry, "fr", t) for t in range(12)) if b["key"] == key)
    assert [p["size"] for p in built["pieces"] if "gap" in p] == [7]
    assert built["pieces"][-1] == {"furigana": [{"text": "。"}]}
    wrong = grammar_ladder.check_build(level, entry["pattern"], key, ["あり"], "fr")["gaps"][0]
    assert wrong["verdict"] == "wrong" and wrong["answer"] == "ではありません"
    assert wrong["marks"] == [{"wrong": "", "fix": "では"}, {"ok": "あり"}, {"wrong": "", "fix": "ません"}]
    # The negative, typed whole, is right; in plain speech too.
    for typed in ("ではありません", "de wa arimasen", "ではない"):
        assert grammar_ladder.check_build(level, entry["pattern"], key, [typed], "fr")["verdict"] == "right", typed
    # もうお金が＿＿＿＿。 asked ありませ: ありません typed was one kana too many.
    level, entry, _ = _point("もう〜ない")
    jp = "もうお金がありません。"
    assert _hole(level, entry["pattern"], jp) == ["もう", "ありません"]
    verdict = grammar_ladder.check_build(level, entry["pattern"], _key(level, entry["pattern"], jp),
                                         ["もう", "ありません"], "fr")
    assert verdict["verdict"] == "right"
    # Another point's ありません is no more cut than the copula's.
    assert _hole("N4", "〜ことがある", "その映画は見たことがありません。") == ["ことがありません"]


def test_construire_carries_a_hole_cut_inside_an_ending_to_the_words_end():
    # The stems lit a word to the middle of its ending: ことがあ|ります,
    # が分かりま|せん, せいで|す. The rest of the word goes in the hole...
    for pattern, jp, hole in (
            ("〜ことがある", "朝の電車は、おくれることがあります。", ["ことがあり"]),
            ("〜が分かります", "このことばのいみが分かりません。", ["が分かりません"]),
            ("〜ができます", "わたしはりょうりができません。", ["ができません"]),
            ("〜せいで", "失敗したのは私のせいです。", ["せいです"]),
            ("〜と思います", "母は、わたしがまだ子どもだと思っています。", ["と思っ"]),
            ("〜にします", "会うのは日よう日にしましょう。", ["にしましょう"])):
        level, _entry, _ = _point(pattern)
        assert _hole(level, pattern, jp) == hole, jp
    # ...and the hole still stops where the word's ending begins, the
    # sentence's inflection outside it, as before.
    level, _entry, _ = _point("〜ことがある")
    assert _hole(level, "〜ことがある", "北海道へ行ったことがあります。") == ["ことがあり"]
    level, _entry, _ = _point("〜しか〜ない")
    assert _hole(level, "〜しか〜ない", "きのうは三時間しかねられなかった。") == ["しか", "なかっ"]
    # Where the tokenizer read a word across the point, nothing is cut:
    # 何時ごろつきますか is ごろ and つきます, not ごろつく (a thug); つけた
    # ままねて is まま and ねて, not まねる; 作りがいがない is がい, not 衣蛾.
    for pattern, jp, hole in (
            ("〜ごろ", "おおさかには何時ごろつきますか。", ["ごろ"]),
            ("〜まま", "電気をつけたままねてしまいました。", ["まま"]),
            ("〜がい", "せっかく作ったのに、だれも食べない。作りがいがないなあ。", ["がい"])):
        level, _entry, _ = _point(pattern)
        assert _hole(level, pattern, jp) == hole, jp
    # A point's piece at the end of a word keeps its start: 大き + く.
    level, _entry, _ = _point("〜く／〜に（副詞形）")
    assert _hole(level, "〜く／〜に（副詞形）", "大きく書いてください。") == ["く"]


def test_no_construire_hole_ends_inside_an_ending():
    # Over every Construire: no hole ends between an auxiliary's letters
    # (で|す, ま|せ), nor leaves the ん of ません or the ません of ありません
    # outside it.
    from study.morphology import tokenize
    seen = 0
    for level, entry in _builds():
        for key, jp, spans, *_ in grammar_ladder._build_items(level, entry["pattern"]):
            tokens = tokenize(jp)
            for a, b in spans:
                where = (entry["pattern"], key, jp[a:b])
                assert not any(t.pos == "auxiliary" and t.start < b < t.end for t in tokens), where
                k = next((i for i, t in enumerate(tokens) if t.end == b), None)
                if k is None or k + 2 >= len(tokens):
                    continue
                t, nxt, then = tokens[k], tokens[k + 1], tokens[k + 2]
                assert not (t.surface == "ませ" and nxt.lemma == "ず"), where
                assert not (t.lemma in ("有る", "ある") and nxt.surface == "ませ" and then.lemma == "ず"), where
                seen += 1
    assert seen > 1000


def test_construire_takes_de_wa_in_full_and_contracted():
    # Plan 295: « Cette personne n'est pas professeur » under あの人は先生
    # ＿＿ありません。 -- では was corrected to じゃ, though the lesson
    # teaches では first and the translation says neither.
    level, entry, _ = _point("です／だ")
    key = _key(level, entry["pattern"], "あの人は先生じゃありません。")
    verdict = grammar_ladder.check_build(level, entry["pattern"], key, ["では"], "en")
    assert verdict["verdict"] == "right"
    assert verdict["gaps"][0] == {"verdict": "right", "answer": "では", "reading": "じゃ", "marks": [],
                                  "said": "じゃ", "register": "contracted"}
    # The other way, and with the other register: the sentence says では
    # in full, and politely.
    key = _key(level, entry["pattern"], "これはわたしのかさではありません。")
    gap = grammar_ladder.check_build(level, entry["pattern"], key, ["じゃありません"], "en")["gaps"][0]
    assert gap["verdict"] == "right" and gap["said"] == "ではありません" and gap["register"] == "full"
    gap = grammar_ladder.check_build(level, entry["pattern"], key, ["じゃない"], "en")["gaps"][0]
    assert gap["verdict"] == "right" and gap["register"] == "polite"
    # The sentence's own answer says nothing more.
    assert "said" not in grammar_ladder.check_build(level, entry["pattern"], key, ["ではありません"], "en")["gaps"][0]


def test_construire_takes_the_points_other_spelling():
    # Plan 318: the translation says neither なきゃ nor なくちゃ, and the
    # holes of 〜なきゃ／〜なくちゃ held one or the other.
    level, entry, _ = _point("〜なきゃ／〜なくちゃ")
    key = _key(level, entry["pattern"], "そろそろ帰らなきゃ。")
    gap = grammar_ladder.check_build(level, entry["pattern"], key, ["なくちゃ"], "en")["gaps"][0]
    assert gap["verdict"] == "right" and gap["said"] == "なきゃ" and gap["register"] == grammar_ladder.VARIANT
    # 〜いかんによらず's rule gives both endings; its twin's sentence takes the point's.
    level, entry, _ = _point("〜いかんによらず")
    key = _key(level, entry["pattern"], "運賃は、距離のいかんにかかわらず一律です。")
    verdict = grammar_ladder.check_build(level, entry["pattern"], key, ["いかん", "によらず"], "en")
    assert verdict["verdict"] == "right" and verdict["gaps"][1]["said"] == "にかかわらず"
    # A う-verb's causative passive is as right short (習わされた, the usual
    # one) as long, both ways; an る-verb's has no short form.
    level, entry, _ = _point("使役受身形 〜させられる")
    for jp, typed, said in (("子どものころ、毎日ピアノを習わせられた。", "され", "せられ"),
                            ("駅で二時間も待たされた。", "せられ", "され")):
        gap = grammar_ladder.check_build(level, entry["pattern"], _key(level, entry["pattern"], jp), [typed], "en")["gaps"][0]
        assert gap["verdict"] == "right" and gap["said"] == said, jp
    key = _key(level, entry["pattern"], "父にきらいな野さいを食べさせられました。")
    assert grammar_ladder.check_build(level, entry["pattern"], key, ["され"], "en")["verdict"] == "wrong"


def test_a_tour_line_is_cut_only_where_the_detector_reads_the_point():
    # Plan 318: where the detector found nothing, the stems' first match
    # cut a twist or a scene line on the point's letters, in a rival's
    # sentence -- 話さ［ないで］ください under 〜ないで, あそ［この］電車
    # under この／その／あの／どの. The examples keep the stems' match.
    for pattern, jp in (("〜ないで", "大きいこえで話さないでください。"),
                        ("この／その／あの／どの", "とうきょうは、あそこの電車ですよ。"),
                        ("〜ことになる", "日本語の学校に行くことにしました。")):
        level, entry, _ = _point(pattern)
        for key, line, *_ in grammar_ladder._build_items(level, pattern):
            assert not (key.startswith(("tw:", "sc:")) and jp.rstrip("。") in line), (pattern, key, line)
    # A trap the point itself is written in still is: を against に.
    level, entry, _ = _point("を")
    assert _hole(level, "を", "先生にてがみを書きました。") == ["を"]


def test_a_counts_mo_holds_mo_alone():
    # Plan 318: the hole of 〜も（強調） was lit on 三度も, and under « three
    # whole times » 三回も was refused. The count stays in the sentence.
    level, entry, _ = _point("〜も（強調）")
    holes = [jp[a:b] for _k, jp, spans, *_ in grammar_ladder._build_items(level, entry["pattern"]) for a, b in spans]
    assert holes and set(holes) == {"も"}
    assert _hole(level, entry["pattern"], "その本は三度も読みました。") == ["も"]


def test_the_n_of_masen_is_never_a_hole_alone():
    # Plan 318: the detector lights a negative's ん (どこへも行きませ|ん|
    # でした), and the hole held one kana of ません.
    level, entry, _ = _point("何も／誰も〜ない")
    assert _hole(level, entry["pattern"], "日よう日は、どこへも行きませんでした。") == ["どこへも", "ません"]


def test_construire_asks_another_sentence_each_turn():
    level, entry, _ = _point("〜てください")
    keys = [grammar_ladder.build_payload(level, entry, "en", turn)["key"] for turn in range(4)]
    assert len(set(keys)) == 4


def test_a_point_in_two_pieces_has_two_gaps():
    level, entry, _ = _point("あまり〜ない")
    built = grammar_ladder.build_payload(level, entry, "en")
    assert [p["gap"] for p in built["pieces"] if "gap" in p] == [0, 1]


def _held(pieces):
    """The parts a client holds each gap to: the part before it, and
    the kanji before that where the part is the kanji's kana."""
    out = []
    for i, piece in enumerate(pieces):
        if "gap" in piece and i and "furigana" in pieces[i - 1]:
            parts = pieces[i - 1]["furigana"]
            take = 2 if len(parts) > 1 and parts[-1].get("reading") is None and parts[-2].get("reading") else 1
            out.append("".join(p["text"] for p in parts[-take:]))
    return out


def test_construire_holds_a_gap_to_its_word_not_to_the_sentence():
    # すみません、わたしはさかな＿＿＿。 on a phone: a run of kana is one
    # part, the client holds the gap to the part before it, and the whole
    # clause stood with the gap on one line wider than the card.
    level, entry, _ = _point("〜がきらいです")
    built = next(b for b in (grammar_ladder.build_payload(level, entry, "fr", t) for t in range(8))
                 if b["key"] == "sc:1")
    assert built["pieces"][0]["furigana"] == [{"text": "すみません、わたしは"}, {"text": "さかな"}]
    assert _held(built["pieces"]) == ["さかな"]
    # A ruby part is never cut, and its kana stays with it: 書い of 書いて.
    level, entry, _ = _point("〜てください")
    for turn in range(8):
        b = grammar_ladder.build_payload(level, entry, "en", turn)
        if b["key"] == "ex:1":
            assert _held(b["pieces"]) == ["書い"]
            break
    else:
        raise AssertionError("ex:1 never asked")


def test_no_gap_is_held_to_more_than_its_word():
    # Over every Construire: the text the client holds a gap to is one
    # word, never a clause -- at most the tokenizer's morpheme the gap
    # follows, with its kanji.
    seen = 0
    for level, entry in _builds():
        for turn in range(3):
            built = grammar_ladder.build_payload(level, entry, "en", turn)
            for held in _held(built["pieces"]):
                assert len(held) <= 8, (entry["pattern"], built["key"], held)
                seen += 1
    assert seen > 1000


def test_the_check_endpoint_judges_and_keeps_nothing(client):
    level, entry, raw_id = _point("〜てください")
    built = grammar_ladder.build_payload(level, entry, "fr", 0)
    r = client.post("/api/grammar/build/check?lang=fr", json={"raw_id": raw_id, "key": built["key"], "answers": ["x"]})
    assert r.status_code == 200 and r.json()["verdict"] == "wrong" and r.json()["furigana"]
    assert client.post("/api/grammar/build/check", json={"raw_id": raw_id, "key": "ex:99", "answers": ["x"]}).status_code == 404
    assert client.post("/api/grammar/build/check", json={"raw_id": "grammar_N5_nope", "key": "ex:0", "answers": ["x"]}).status_code == 404


# ── A particle, blanked by the detector (plan 190) ───────────

def test_a_particle_is_blanked_where_the_detector_finds_it_once():
    # Its letters point at nothing, so the detector does: once, on one
    # piece, or not at all.
    assert blank_span("毎あさパンを食べます。", "を", "N5") == (5, 6)
    assert blank_span("パンを食べて、水を飲みます。", "を", "N5") is None
    assert blank_span("おちゃかコーヒーを飲みますか。", "〜か〜か", "N5") is None
    # A verifiable point is blanked by its stems, as before.
    assert blank_span("約束は守るべきです。", "〜べきだ", "N3") == highlight_span("約束は守るべきです。", "〜べきだ")


def test_a_particles_contrast_offers_its_rivals_alone():
    # パン＿食べます takes だけ, まで and から too: no filler is certainly
    # wrong in a particle's gap, so only the rivals its author marked the
    # sentence against are offered.
    level, entry, _ = _point("を")
    for seed in range(8):
        drill = contrast_payload(level, entry, GRAMMAR_POINTS_BY_LEVEL[level], "en", random.Random(seed))
        assert sorted(drill["choices"]) == sorted(["を", "が", "に"])
        blanks = [p for p in drill["furigana"] if p.get("blank")]
        assert len(blanks) == 1
        around = "".join(p["text"] for p in drill["furigana"] if not p.get("blank"))
        assert drill["jp"].replace("を", "", 1) == around


def test_the_particles_the_detector_blanks_can_be_chosen_and_built():
    for level, pattern in (("N5", "を"), ("N5", "に"), ("N5", "で"), ("N5", "が"), ("N5", "か"),
                           ("N4", "〜方"), ("N4", "〜さ"), ("N3", "〜化")):
        assert card_index.contrast_ok(level, pattern), pattern
        assert grammar_ladder.build_ok(level, pattern), pattern
    # は, が and も share too many sentences for the detector to blank one:
    # は marks none, and is asked from questions of its own instead
    # (plan 201, study/grammar_choose.py), so it is chosen without the snapshot.
    assert not grammar_ladder.blank_ok("N5", "は")
    assert card_index.contrast_ok("N5", "は")


def test_a_particle_on_choisir_is_asked_its_contrast(client):
    level, entry, raw_id = _point("を")
    _clear(raw_id)
    try:
        _place(raw_id, LADDER, STEP_ROWS["choose"])
        card = _served(client, level, raw_id)
        assert card["step"]["group"] == "choose" and card["exercise"] == "grammar.contrast"
        assert sorted(card["contrast"]["choices"]) == sorted(["を", "が", "に"])
    finally:
        _clear(raw_id)


# ── 書く write ───────────────────────────────────────────────

def test_a_write_hands_a_situation_two_words_and_the_sentence_lit():
    level, entry, _ = _point("〜てください")
    written = grammar_ladder.write_payload(level, entry, "fr", random.Random(3))
    assert written["situation"] and written["model"]["tr"] == written["situation"]
    assert 1 <= len(written["helpers"]) <= grammar_ladder.HELPERS
    assert any(p.get("highlight") for p in written["model"]["furigana"])
    for helper in written["helpers"]:
        assert helper["text"] not in ("でください", "ください")


def test_write_is_only_where_the_detector_can_judge():
    from study.grammar_detect import can_find
    for level, entries in GRAMMAR_POINTS_BY_LEVEL.items():
        for entry in entries:
            if grammar_ladder.write_ok(level, entry["pattern"]):
                assert can_find(entry["pattern"]), entry["pattern"]


def test_a_written_card_is_never_on_the_ladder():
    from routes.decks import _card_answers
    written = {"fields": {"rule": "〜ても", "meaning": "even if", "sentences": "雨が降っても行きます。"}}
    for key in (LADDER, "grammar.build", "grammar.write"):
        assert _card_answers(written, MODES[key]) is False
    assert eligible_for(MODES[LADDER], {})


# ── Served, by step ──────────────────────────────────────────

def _place(raw_id, mode, row):
    """A due row for the dev learner in `mode`, at `row`'s progress."""
    total, interval, learning, step = row
    card_id = f"{DEV_USER_ID}:{raw_id}"
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO cards (id) VALUES (%s) ON CONFLICT DO NOTHING", (card_id,))
            cur.execute(
                """
                INSERT INTO card_modes (card_id, mode, interval_days, total_reviews, is_learning,
                                        learning_step, next_review)
                VALUES (%s, %s, %s, %s, %s, %s, NOW() - INTERVAL '1 day')
                ON CONFLICT (card_id, mode) DO UPDATE SET
                    interval_days = EXCLUDED.interval_days, total_reviews = EXCLUDED.total_reviews,
                    is_learning = EXCLUDED.is_learning, learning_step = EXCLUDED.learning_step,
                    next_review = EXCLUDED.next_review
                """,
                (card_id, mode, interval, total, learning, step),
            )
        conn.commit()
    finally:
        conn.close()


def _clear(*raw_ids):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            ids = [f"{DEV_USER_ID}:{r}" for r in raw_ids]
            cur.execute("DELETE FROM card_modes WHERE card_id = ANY(%s)", (ids,))
            cur.execute("DELETE FROM review_log WHERE card_id = ANY(%s)", (ids,))
        conn.commit()
    finally:
        conn.close()


def _served(client, level, raw_id, lang="en"):
    cards = client.get(f"/api/grammar/cards?level={level}&mode={LADDER}&lang={lang}&count=25").json()["cards"]
    return next(c for c in cards if c["card_id"] == raw_id)


@pytest.mark.parametrize("where,exercise,asked", [
    ("choose", "grammar.contrast", "choose"),
    ("build", "grammar.build", "build"),
    ("mastered", "grammar.flashcard.f2b", "flashcard"),
])
def test_a_card_is_asked_the_exercise_of_its_step(client, where, exercise, asked):
    level, entry, raw_id = _point("〜てください")
    _clear(raw_id)
    try:
        _place(raw_id, LADDER, STEP_ROWS[where])
        card = _served(client, level, raw_id)
        assert card["mode"] == LADDER and card["exercise"] == exercise and card["asked"] == asked
        assert card["step"]["group"] == ("mastered" if where == "mastered" else where)
        if exercise == "grammar.build":
            assert card["build"]["pieces"] and card["build"]["tr"]
            assert (card["step"]["at"], card["step"]["of"]) == (2, 4)
        if exercise == "grammar.contrast":
            assert card["contrast"]["choices"]
            assert (card["step"]["at"], card["step"]["of"]) == (2, 3)
    finally:
        _clear(raw_id)


def test_a_point_with_no_marked_sentence_is_asked_from_its_own_questions(client):
    # は has no contrast sentence the detector can blank, and used to fall to
    # the flashcard on Choisir (and to the flashcard or fill_in on Construire).
    # Plan 201: it carries questions of its own, so Choisir asks a real one.
    level, entry, raw_id = _point("は")
    _clear(raw_id)
    try:
        _place(raw_id, LADDER, STEP_ROWS["choose"])
        card = _served(client, level, raw_id)
        assert card["exercise"] == "grammar.contrast" and card["asked"] == "choose"
        drill = card["contrast"]
        assert drill["answer"] in drill["choices"] and len(drill["choices"]) >= 3
        assert "".join(p["text"] for p in drill["fill"]) == drill["answer"]
        assert [p for p in drill["furigana"] if p.get("blank")]
        assert card["choices_furigana"] == {} or set(card["choices_furigana"]) <= set(drill["choices"])
    finally:
        _clear(raw_id)


def test_one_key_reaches_the_log_whatever_was_asked(client):
    level, entry, raw_id = _point("〜てください")
    _clear(raw_id)
    try:
        _place(raw_id, LADDER, STEP_ROWS["build"])
        assert _served(client, level, raw_id)["exercise"] == "grammar.build"
        r = client.post("/api/grammar/review", json={"card_id": raw_id, "mode": LADDER, "quality": 4})
        assert r.status_code == 200, r.text
        conn = db_conn()
        try:
            with conn.cursor() as cur:
                cur.execute("SELECT DISTINCT mode FROM review_log WHERE card_id = %s", (f"{DEV_USER_ID}:{raw_id}",))
                assert cur.fetchall() == [(LADDER,)]
                cur.execute("SELECT learning_step FROM card_modes WHERE card_id = %s AND mode = %s",
                            (f"{DEV_USER_ID}:{raw_id}", LADDER))
                assert cur.fetchone() == (5,)
        finally:
            conn.close()
    finally:
        _clear(raw_id)


# ── The plate's record ───────────────────────────────────────

def test_the_point_carries_its_first_tour(client):
    level, entry, raw_id = _point("か")
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM grammar_tours WHERE user_id = %s AND card_id = %s", (DEV_USER_ID, raw_id))
        conn.commit()
    finally:
        conn.close()
    assert client.get(f"/api/grammar/point?id={raw_id}").json()["tour_record"] is None
    client.post("/api/grammar/tour", json={"raw_id": raw_id, "tries": 1, "helped": False})
    record = client.get(f"/api/grammar/point?id={raw_id}").json()["tour_record"]
    assert record["tries"] == 1 and record["helped"] is False and record["done_at"]


# ── The migration ────────────────────────────────────────────

MIGRATE_USER = "ladder-migrate-user"


def _rows(raw_id):
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT mode, interval_days, total_reviews FROM card_modes WHERE card_id = %s ORDER BY mode",
                        (f"{MIGRATE_USER}:{raw_id}",))
            return cur.fetchall()
    finally:
        conn.close()


def _seed(raw_id, mode, row):
    total, interval, learning, step = row
    card_id = f"{MIGRATE_USER}:{raw_id}"
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("INSERT INTO cards (id) VALUES (%s) ON CONFLICT DO NOTHING", (card_id,))
            cur.execute(
                "INSERT INTO card_modes (card_id, mode, interval_days, total_reviews, is_learning, learning_step) "
                "VALUES (%s, %s, %s, %s, %s, %s)",
                (card_id, mode, interval, total, learning, step),
            )
        conn.commit()
    finally:
        conn.close()


def _wipe():
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM card_modes WHERE card_id LIKE %s", (f"{MIGRATE_USER}:%",))
        conn.commit()
    finally:
        conn.close()


def test_the_migration_seeds_the_ladder_from_the_best_mode(monkeypatch):
    from scripts import migrate_grammar_ladder as migrate
    _, _, ka = _point("か")
    _, _, kudasai = _point("〜てください")
    _wipe()
    try:
        _seed(ka, "grammar.flashcard.f2b", (2, 0, True, 2))
        _seed(ka, "grammar.fill_in", (7, 10, False, 0))
        _seed(kudasai, "grammar.contrast", (4, 2, False, 0))

        # A dry run writes nothing.
        monkeypatch.setattr("sys.argv", ["migrate", "--user", MIGRATE_USER])
        assert migrate.main() == 0
        assert [m for m, *_ in _rows(ka)] == ["grammar.fill_in", "grammar.flashcard.f2b"]

        monkeypatch.setattr("sys.argv", ["migrate", "--user", MIGRATE_USER, "--yes"])
        assert migrate.main() == 0
        # か: the ladder takes fill_in's schedule, the best; the f2b row,
        # the old main track, is folded in; fill_in stays a platform.
        assert _rows(ka) == [("grammar.fill_in", 10, 7), (LADDER, 10, 7)]
        # 〜てください: seeded from contrast, which stays.
        assert _rows(kudasai) == [("grammar.contrast", 2, 4), (LADDER, 2, 4)]

        # Run twice, changes nothing.
        assert migrate.main() == 0
        assert _rows(ka) == [("grammar.fill_in", 10, 7), (LADDER, 10, 7)]
    finally:
        _wipe()
