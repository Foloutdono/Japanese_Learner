# What a question's choices give away by how they look (plan 257): the
# shapes study/exam_tells.py names, with the counter-case for each -- the
# symmetric set that looks alike and gives nothing away.
from study import exam_tells as T


def test_one_character_apart_is_one_small_difference():
    assert T.is_minimal_pair("たいです", "たくです")
    assert T.is_minimal_pair("午前", "午後")
    assert T.is_minimal_pair("木曜日", "水曜日")


def test_a_figure_is_one_unit_however_many_digits():
    assert T.is_minimal_pair("10時から5時まで", "9時から5時まで")


def test_one_character_choices_share_nothing():
    assert not T.is_minimal_pair("が", "を")
    assert not T.is_minimal_pair("で", "へ")


def test_unlike_words_with_one_ending_are_not_a_pair():
    assert not T.is_minimal_pair("食べました", "見ました")


def test_a_pair_among_unlike_choices_gives_the_answer_away():
    choices = ["ほしいです", "たいです", "ましょう", "たくです"]
    assert T.structure(choices) == "pair"
    assert T.tell(choices)


def test_a_star_makes_its_centre_the_answer():
    # ぱじめ / ばじめ / はしめ around はじめ: the old 漢字読み
    choices = ["ぱじめ", "はじめ", "はしめ", "ばじめ"]
    assert T.structure(choices) == "star"
    assert T.centre(choices) == 1
    assert T.tell(choices)


def test_three_alike_and_one_apart_is_a_tell():
    assert T.tell(["か何も", "か何か", "か何で", "かどうか"])


def test_a_shared_frame_gives_nothing_away():
    choices = ["がください", "をください", "にください", "でください"]
    assert T.structure(choices) == "clique"
    assert T.tell(choices) is None


def test_the_two_by_two_grid_gives_nothing_away():
    choices = ["せんしゅう", "ぜんしゅう", "せんしゅ", "ぜんしゅ"]
    assert T.structure(choices) == "ring"
    assert T.tell(choices) is None
    assert T.centre(choices) is None and T.outlier(choices) is None


def test_figures_in_a_grid_are_not_a_tell():
    choices = ["10時から5時まで", "9時から5時まで", "9時から6時まで", "10時から6時まで"]
    assert T.tell(choices) is None


def test_unrelated_choices_and_particles_are_not_a_tell():
    assert T.tell(["りんご", "少し", "あまり", "とても"]) is None
    assert T.tell(["で", "を", "へ", "が"]) is None
