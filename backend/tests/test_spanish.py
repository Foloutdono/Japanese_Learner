"""What only Spanish has (plan 302).

Spanish is held whole where any language the app writes is, by the
checks every such language shares (tests/test_languages.py, plan 312,
reading translations.WRITTEN): the decks, the grammar catalogue, the
sentences a card shows, the layer over JMdict. What is left here is
what KANJIDIC2 gives Spanish and no later language: its meanings of
every kanji, searched as the English and the French are."""
from content import kanji_pool_data


def test_a_kanji_outside_the_course_is_found_by_its_spanish():
    """KANJIDIC2's Spanish is searched as its English and French are, an
    accented query included (it is a meaning, not a reading)."""
    rows, total = kanji_pool_data.search("caballo", 20, 0)
    assert total and {"駕", "騨"} & {r["char"] for r in rows}
    assert kanji_pool_data._is_latin("canción") and not kanji_pool_data._is_latin("水")
