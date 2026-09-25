from study.exam_validation import (
    passage_length_bounds,
    validate_no_duplicate_targets,
    validate_sentence_order_question,
)


def _order_question(order, star_index=3, answer="p1"):
    return {
        "id": "q",
        "pieces": [{"id": f"p{i}", "textJp": t} for i, t in enumerate("あいうえ", start=1)],
        "order": order,
        "starIndex": star_index,
        "answer": answer,
    }


def test_short_order_is_reported_not_raised():
    errors = validate_sentence_order_question(_order_question(["p1", "p2"]))
    assert len(errors) == 1 and "doesn't match piece ids" in errors[0]


def test_well_formed_order_passes():
    assert validate_sentence_order_question(_order_question(["p1", "p2", "p3", "p4"], 0, "p1")) == []


def test_missing_prompts_are_not_duplicates():
    assert validate_no_duplicate_targets([{"id": "a"}, {"id": "b"}]) == []


def test_repeated_prompt_is_a_duplicate():
    assert len(validate_no_duplicate_targets([{"id": "a", "promptJp": "猫"}, {"id": "b", "promptJp": "猫"}])) == 1


def test_zero_target_has_bounds():
    assert passage_length_bounds(0) == (0, 0)
