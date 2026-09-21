"""The French gloss is the card's, not the written form's (plan 107)."""
from translations import fr_gloss, get_meaning
from translations.fr.vocab_fr import VOCAB_FR


def test_a_card_reads_its_own_line_before_the_forms():
    # 私 is three cards; each has a line of its own now, and the N5
    # わたし no longer reads the N1 あたし's "je (fem.)".
    assert fr_gloss({"kanji": "私", "kana": "わたし"}, VOCAB_FR) == "je, moi"
    assert fr_gloss({"kanji": "私", "kana": "あたし"}, VOCAB_FR) == "je, moi (fém.)"
    assert fr_gloss({"kanji": "戸", "kana": "と"}, VOCAB_FR) == "porte (à la japonaise)"


def test_the_form_is_the_fallback_and_kana_only_cards_read_by_kana():
    fr = {"魚": "poisson", "パン": "pain", "後::うしろ": "derrière", "後": "après"}
    assert fr_gloss({"kanji": "魚", "kana": "さかな"}, fr) == "poisson"
    assert fr_gloss({"kanji": "", "kana": "パン"}, fr) == "pain"
    assert fr_gloss({"kanji": "後", "kana": "うしろ"}, fr) == "derrière"
    assert fr_gloss({"kanji": "後", "kana": "あと"}, fr) == "après"
    assert fr_gloss({"kanji": "山", "kana": "やま"}, fr) is None


def test_get_meaning_falls_back_to_english_and_ignores_french_for_english():
    entry = {"kanji": "山", "kana": "やま", "meaning": "mountain"}
    assert get_meaning(entry, "fr", {}) == "mountain"
    assert get_meaning(entry, "en", {"山": "montagne"}) == "mountain"
    assert get_meaning(entry, "fr", {"山": "montagne"}) == "montagne"
