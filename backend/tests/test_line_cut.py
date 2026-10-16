"""A subtitle line held to what reads at a glance (plan 235).

study/line_cut.py cuts a cue wider than MAX_LINE_WIDTH into the fewest
lines that fit, between two phrases, and shares the cue's time among
them. The lines here are the owner's screenshots of 2026-10-16 and
lines shaped like them.
"""
import pytest

from study import morphology
from study.cue_sentences import sentences_from_cues
from study.line_cut import MAX_LINE_WIDTH, cut_line, line_width

needs_tokenizer = pytest.mark.skipif(not morphology.MORPHOLOGY_AVAILABLE, reason="needs the tokenizer")


def _texts(pieces):
    return [p["text"] for p in pieces]


def test_a_line_that_fits_is_left_as_it_came():
    line = "もしもし、（なに？）聞こえてる？"
    assert cut_line(line, 1.0, 4.0, [[0, 1.2]]) == [
        {"text": line, "start": 1.0, "end": 4.0, "words": [[0, 1.2]]},
    ]


def test_width_counts_a_latin_letter_and_a_space_as_half():
    assert line_width("今日は") == 3
    assert line_width("Ayase") == 2.5
    assert line_width("THE HOME") == 4


@needs_tokenizer
def test_the_owner_s_long_line_is_cut_where_it_breathes():
    line = "今日はAyaseさんとバンドメンバーとそしてぷらそにかの合唱のみなさんがいてくれるので、"
    pieces = cut_line(line, 10.0, 20.0)
    assert _texts(pieces) == [
        "今日はAyaseさんとバンドメンバーとそして",
        "ぷらそにかの合唱のみなさんがいてくれるので、",
    ]
    assert "".join(_texts(pieces)) == line


@needs_tokenizer
def test_a_line_is_cut_after_a_phrase_not_inside_one():
    line = "もう一人一人の全員の思いがこの一回のテイクで乗るといいですね！"
    assert _texts(cut_line(line, 0.0, 6.0)) == [
        "もう一人一人の全員の思いが",
        "この一回のテイクで乗るといいですね！",
    ]


@needs_tokenizer
def test_a_mark_already_in_the_line_is_a_cut_and_latin_words_stay_together():
    line = "そうですね、今日は前回THE HOME TAKEの時は私一人で歌わせていただいたんですけど"
    pieces = _texts(cut_line(line, 0.0, 8.0))
    assert pieces == ["そうですね、今日は前回THE HOME TAKEの時は", "私一人で歌わせていただいたんですけど"]


@needs_tokenizer
@pytest.mark.parametrize("line", [
    "今日はAyaseさんとバンドメンバーとそしてぷらそにかの合唱のみなさんがいてくれるので、",
    "私は毎朝早く起きて公園を散歩してから朝ご飯を食べて会社に行きます。",
    "だから僕は君のことをずっとずっと待っているんだよ今日もまた明日も",
    "そうですね、今日は前回THE HOME TAKEの時は私一人で歌わせていただいたんですけど",
])
def test_no_piece_opens_on_a_particle_an_auxiliary_or_a_mark(line):
    for piece in cut_line(line, 0.0, 9.0)[1:]:
        first = morphology.tokenize(piece["text"])[0]
        assert first.pos not in ("particle", "auxiliary", "suffix"), piece["text"]
        assert piece["text"][0] not in "、。！？", piece["text"]


@needs_tokenizer
def test_a_verb_s_chain_is_never_cut():
    # 〜ている, 〜てくれる, 〜ので, 〜てしまう: a cut inside one would
    # lose the grammar point the detector finds on it.
    for line, chain in (
        ("みんなが毎日ここでずっと待っていてくれるのでとても嬉しいです", "待っていてくれるので"),
        ("ずっと前から君のことを好きになってしまっていたのかもしれない", "しまっていた"),
    ):
        pieces = _texts(cut_line(line, 0.0, 5.0))
        assert len(pieces) == 2, pieces
        assert any(chain in piece for piece in pieces), pieces


@needs_tokenizer
def test_every_piece_fits_when_the_line_can_be_cut():
    line = "私は毎朝早く起きて公園を散歩してから朝ご飯を食べて会社に行きます。" * 2
    pieces = cut_line(line, 0.0, 20.0)
    assert len(pieces) >= 3
    assert all(line_width(p["text"]) <= MAX_LINE_WIDTH for p in pieces)


@needs_tokenizer
def test_the_pieces_tile_the_cue_s_time_in_order():
    pieces = cut_line("私は毎朝早く起きて公園を散歩してから朝ご飯を食べて会社に行きます。", 10.0, 16.0)
    assert pieces[0]["start"] == 10.0 and pieces[-1]["end"] == 16.0
    for a, b in zip(pieces, pieces[1:]):
        assert a["end"] == b["start"]
        assert a["start"] < a["end"]


@needs_tokenizer
def test_a_time_the_track_measured_at_the_cut_is_where_the_next_line_starts():
    line = "もう一人一人の全員の思いがこの一回のテイクで乗るといいですね！"
    cut = line.index("この")
    take = line.index("テイク")
    words = [[0, 10.2], [cut, 13.5], [take, 14.6], [len(line), 16.8]]
    first, second = cut_line(line, 10.0, 17.0, words)
    assert first["end"] == second["start"] == 13.5
    # Each keeps the times that fall in it, on its own text.
    assert first["words"] == [[0, 10.2]]
    assert second["words"] == [[0, 13.5], [take - cut, 14.6], [len(second["text"]), 16.8]]


def test_without_a_tokenizer_a_line_is_cut_only_where_it_breathes(monkeypatch):
    monkeypatch.setattr(morphology, "tokenize", lambda text: None)
    marked = "きょうはみんなでえきまえのきっさてんにいきました、そのあとでこうえんをさんぽしました"
    assert _texts(cut_line(marked, 0.0, 6.0)) == [
        "きょうはみんなでえきまえのきっさてんにいきました、",
        "そのあとでこうえんをさんぽしました",
    ]
    bare = "きょうはみんなでえきまえのきっさてんにいきましたそのあとでこうえんをさんぽしました"
    assert _texts(cut_line(bare, 0.0, 6.0)) == [bare]


@needs_tokenizer
def test_no_piece_is_left_without_japanese():
    line = "今日のゲストはTHE BAND FROM TOKYO AND OSAKA WITH FRIENDS"
    for piece in cut_line(line, 0.0, 4.0):
        assert any(ord(c) > 0x3000 for c in piece["text"]), piece["text"]


@needs_tokenizer
def test_sentences_from_cues_cuts_a_wide_cue_and_keeps_its_neighbours_whole():
    cues = [
        {"start": 0.0, "end": 2.0, "text": "こんにちは"},
        {"start": 2.0, "end": 9.0, "text": "今日はAyaseさんとバンドメンバーとそしてぷらそにかの合唱のみなさんがいてくれるので、"},
        {"start": 9.0, "end": 10.0, "text": "I miss you so much every single day and every single night"},
    ]
    result = sentences_from_cues(cues, None, None)
    assert [s["text"] for s in result] == [
        "こんにちは",
        "今日はAyaseさんとバンドメンバーとそして",
        "ぷらそにかの合唱のみなさんがいてくれるので、",
        "I miss you so much every single day and every single night",
    ]
    assert result[1]["cue_start"] == 2.0 and result[2]["cue_end"] == 9.0
    assert result[1]["cue_end"] == result[2]["cue_start"]
    assert [s["japanese"] for s in result] == [True, True, True, False]
