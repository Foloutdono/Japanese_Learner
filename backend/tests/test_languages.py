"""The app's languages (plan 312): which it speaks, and each part of the
course held whole in each language it is written in.

English and French are the course's two languages; every other language
the app speaks is written beside them a part at a time
(translations.WRITTEN), and reads English wherever a part is not written
in it yet. Spanish was held so by tests/test_spanish.py (plan 302); the
checks are the same for any language a part lists, so they read the
lists: a language joins a part in the commit that writes the part whole in
it, and from then on a card, a kanji, a point or a sentence the part gains
is written in it in the same change, and a line for a card the deck no
longer has is moved with it (content/vocab_renames.py) or dropped.
`python -m scripts.language_coverage --lang LANG` counts what is left."""
import ast
import json
import random
import re
import sqlite3
from pathlib import Path

import pytest

from content import example_fixes, jmdict_fr
from content.grammar_points_data import GRAMMAR_POINTS_BY_LEVEL
from content.kanji_data import KANJI_BY_LEVEL
from content.vocab_data import VOCAB_BY_LEVEL
from content.vocab_extras import get_vocab_extras
from routes.translations import _load_translation_map
from translations import SPOKEN, WRITTEN, get_meaning, spoken
from translations.course import KANJI_GLOSSES, VOCAB_GLOSSES

_BASE = Path(__file__).resolve().parent.parent
_ROOT = _BASE.parent
_DB = _BASE / "datas" / "kanji" / "kanji.sqlite3"


def _card_key(entry: dict) -> str:
    return f"{entry['kanji']}::{entry['kana']}" if entry["kanji"] else entry["kana"]


# ── The languages the app speaks ─────────────────────────────

def test_the_client_speaks_the_languages_the_server_does():
    """lib/locale.js's SUPPORTED_LANGS is SPOKEN's copy: a language one
    side speaks and the other does not is a learner shown a picker entry
    the server refuses, or a ui_lang the client cannot read."""
    source = (_ROOT / "frontend" / "src" / "lib" / "locale.js").read_text(encoding="utf-8")
    listed = re.search(r"export const SUPPORTED_LANGS = \[([^\]]*)\]", source)
    assert listed, "lib/locale.js no longer declares SUPPORTED_LANGS as a literal list"
    assert set(re.findall(r"'([a-z-]+)'", listed.group(1))) == set(SPOKEN)


def test_every_spoken_language_has_a_name_for_the_models():
    """routes/reading.LANG_NAMES is what known_lang reads: a spoken
    language missing from it is answered in English by every model
    feature (the deep tier, comprehension, conversation, the tutor)."""
    tree = ast.parse((_BASE / "routes" / "reading.py").read_text(encoding="utf-8"))
    names = next(node.value for node in tree.body if isinstance(node, ast.Assign)
                 and any(getattr(t, "id", "") == "LANG_NAMES" for t in node.targets))
    assert set(SPOKEN) <= {k.value for k in names.keys}


def test_the_account_and_the_trail_take_every_spoken_language():
    from core import events
    from routes.profile import UI_LANGS
    assert events.VALUES["session_start"]["lang"] == frozenset(SPOKEN)
    assert set(SPOKEN) <= set(UI_LANGS)


def test_a_part_is_written_only_in_languages_the_app_speaks():
    from content import comprehension_seed, reading_sentences
    from study import conversation, duel_paper, line_translate
    beside = set(SPOKEN) - {"en", "fr"}
    for part, langs in WRITTEN.items():
        assert set(langs) <= beside, part
    for own in (reading_sentences.LANGS, comprehension_seed.LANGS, conversation.LANGS,
                duel_paper.CHOICE_LANGS, line_translate.TRACK_LANGS):
        assert set(own) <= set(SPOKEN), own


def test_a_language_the_app_does_not_speak_reads_english():
    assert spoken("fr") == "fr" and spoken("es") == "es"
    assert spoken("de") == "en" and spoken("") == "en" and spoken(None) == "en"


def test_a_language_the_app_does_not_speak_is_refused_by_the_maps():
    from fastapi import HTTPException
    with pytest.raises(HTTPException):
        _load_translation_map("de", "vocab")


# ── The decks ────────────────────────────────────────────────

@pytest.mark.parametrize("lang", WRITTEN["deck"])
def test_every_deck_card_has_its_own_line_and_no_other(lang):
    lines = VOCAB_GLOSSES[lang]
    keys = {_card_key(e) for level in VOCAB_BY_LEVEL.values() for e in level}
    missing = sorted(keys - set(lines))
    stray = sorted(set(lines) - keys)
    assert missing == [], f"deck cards with no line in vocab_{lang}.json: {missing[:20]}"
    assert stray == [], f"vocab_{lang}.json lines for no card of the deck (moved or retired?): {stray[:20]}"


@pytest.mark.parametrize("lang", WRITTEN["deck"])
def test_a_deck_gloss_is_one_clean_line(lang):
    bad = [k for k, v in VOCAB_GLOSSES[lang].items()
           if not isinstance(v, str) or not v.strip() or v != v.strip() or "\t" in v or "\n" in v]
    assert bad == []


@pytest.mark.parametrize("lang", WRITTEN["deck"])
def test_a_card_reads_its_own_gloss_not_a_homographs(lang):
    # 後 is four cards (あと, うしろ, ご, のち); each reads its own line.
    entries = [e for level in VOCAB_BY_LEVEL.values() for e in level if e["kanji"] == "後"]
    glosses = {get_meaning(e, lang, VOCAB_GLOSSES) for e in entries}
    assert len(entries) > 1 and len(glosses) == len(entries)


@pytest.mark.parametrize("lang", WRITTEN["deck"])
def test_the_vocab_map_the_client_preloads_is_whole(lang):
    assert set(_load_translation_map(lang, "vocab")) == set(_load_translation_map("en", "vocab"))


@pytest.mark.parametrize("lang", WRITTEN["deck"])
def test_a_card_switched_mid_run_keeps_its_own_gloss(lang):
    """A written form several cards share (後: あと, うしろ…) is answered by
    the card's kana, not by whichever card the form's map kept."""
    from routes.translations import get_vocab_translation
    cards = [e for lv in VOCAB_BY_LEVEL.values() for e in lv if e.get("kanji") == "後"]
    assert len({e["kana"] for e in cards}) > 1
    for card in cards:
        got = get_vocab_translation("後", lang, card["kana"])["translation"]
        assert got == get_meaning(card, lang, VOCAB_GLOSSES), card["kana"]


# ── The kanji ────────────────────────────────────────────────

@pytest.mark.parametrize("lang", WRITTEN["kanji"])
def test_every_deck_kanji_has_a_meaning(lang):
    missing = [e["kanji"] for level in KANJI_BY_LEVEL.values() for e in level
               if not KANJI_GLOSSES[lang].get(e["kanji"])]
    assert missing == [], f"deck kanji with no meaning in {lang}: {''.join(missing)}"


@pytest.mark.parametrize("lang", WRITTEN["kanji"])
def test_the_database_carries_the_kanji_file(lang):
    """The file is applied: a file edited without re-running
    `python -m scripts.build_kanji_db --lang LANG` would ship nothing."""
    path = _BASE / "datas" / "kanji" / f"kanji_meanings_{lang}.json"
    own = json.loads(path.read_text(encoding="utf-8"))
    conn = sqlite3.connect(f"file:{_DB}?mode=ro", uri=True)
    try:
        stale = [c for c, text in own.items()
                 if conn.execute(f"SELECT meaning_{lang} FROM kanji WHERE char = ?", (c,)).fetchone()[0] != text]
    finally:
        conn.close()
    assert stale == [], f"re-run python -m scripts.build_kanji_db --lang {lang}"


@pytest.mark.parametrize("lang", WRITTEN["kanji"])
def test_the_kanji_map_the_client_preloads_is_whole_and_its_own(lang):
    kanji = _load_translation_map(lang, "kanji")
    assert set(kanji) == set(_load_translation_map("en", "kanji"))
    assert kanji["山"] == get_meaning({"kanji": "山"}, lang, KANJI_GLOSSES) != "mountain"


# ── The grammar catalogue ────────────────────────────────────

def _cases(part: str):
    return [(level, lang) for lang in WRITTEN[part] for level in GRAMMAR_POINTS_BY_LEVEL]


@pytest.mark.parametrize("level,lang", _cases("grammar.gloss"))
def test_every_grammar_point_has_its_gloss_and_formation(level, lang):
    """Their form is grammar_check's (the English line's Japanese, in
    order, no English left); that they are there is held here."""
    missing = [p["pattern"] for p in GRAMMAR_POINTS_BY_LEVEL[level]
               if not (p.get("meaning") or {}).get(lang) or not p.get(f"structure_{lang}")]
    assert missing == []


@pytest.mark.parametrize("level,lang", _cases("grammar.lesson"))
def test_every_grammar_lesson_is_written(level, lang):
    """The lesson, whole: every step, every neighbour's line and every
    example's translation. Their form is grammar_check's."""
    missing = [
        f"{p['pattern']} {part} {i}"
        for p in GRAMMAR_POINTS_BY_LEVEL[level]
        for part in ("steps", "compare", "examples")
        for i, text in enumerate(p.get(part) or [])
        if not (text.get(lang) or "").strip()
    ]
    assert missing == [], f"{len(missing)} lesson texts with no {lang}: {missing[:10]}"


@pytest.mark.parametrize("lang", WRITTEN["grammar.lesson"])
def test_a_lesson_is_served_in_its_language(lang):
    from study.grammar_lesson import lesson_payload
    level, entry = "N5", GRAMMAR_POINTS_BY_LEVEL["N5"][0]
    own, english = lesson_payload(level, entry, lang), lesson_payload(level, entry, "en")
    assert own["steps"][0]["text"] == entry["steps"][0][lang] != english["steps"][0]["text"]


def _drill_texts(point: dict):
    """(path, text) for every text of a point's tour and its own Choisir
    questions: each dict carrying an `en` and a `fr`."""
    def walk(node, path):
        if isinstance(node, dict):
            if isinstance(node.get("en"), str) and isinstance(node.get("fr"), str):
                yield "/".join(path), node
            for k, v in node.items():
                yield from walk(v, path + [k])
        elif isinstance(node, list):
            for i, v in enumerate(node):
                yield from walk(v, path + [str(i)])
    for key in ("tour", "choose"):
        yield from walk(point.get(key), [key])


@pytest.mark.parametrize("level,lang", _cases("grammar.drills"))
def test_every_tour_and_choisir_question_is_written(level, lang):
    """The tours and the points' own Choisir questions, whole, as the
    lessons are."""
    missing = [f"{p['pattern']} {path}" for p in GRAMMAR_POINTS_BY_LEVEL[level]
               for path, text in _drill_texts(p) if not (text.get(lang) or "").strip()]
    assert missing == [], f"{len(missing)} tour/choose texts with no {lang}: {missing[:10]}"


@pytest.mark.parametrize("lang", WRITTEN["grammar.drills"])
def test_a_tour_is_served_in_its_language(lang):
    from study.grammar_tour import SCENE_PLACES, tour_payload
    level, entry = "N5", next(p for p in GRAMMAR_POINTS_BY_LEVEL["N5"] if p.get("tour"))
    tour = tour_payload(level, entry, lang)
    twist = entry["tour"]["twists"][0]
    assert tour["twists"][0]["notion"] == twist["notion"][lang] != twist["notion"]["en"]
    assert tour["scene"]["them"] == entry["tour"]["scene"]["them"][lang]
    # The place the scene happens at is captioned in the language too:
    # every place of the closed set has its line.
    assert all(place.get(lang) for place in SCENE_PLACES.values())
    assert tour["scene"]["place_caption"] == SCENE_PLACES[entry["tour"]["scene"]["place"]][lang]


# ── The themes ───────────────────────────────────────────────

@pytest.mark.parametrize("lang", WRITTEN["theme"])
def test_every_theme_word_reads_its_theme_s_sense(lang):
    """A deck card's gloss is one sense of its word; the theme's line is
    the one the word has there, in each language (丸 is a shape in
    `shapes`, 先生 a teacher beside 教授), so every line has its own."""
    from content import theme_data
    from routes.theme_vocab import _entry_meaning
    missing = [f"{theme} {e['kanji'] or e['kana']}" for theme in (t["key"] for t in theme_data.list_themes())
               for e in theme_data.theme_entries(theme) if not e.get(f"meaning_{lang}")]
    assert missing == [], missing[:10]
    entry = next(e for e in theme_data.theme_entries("shapes") if e["kanji"] == "丸")
    assert _entry_meaning(entry, lang) == entry[f"meaning_{lang}"]


# ── The sentences a card shows ───────────────────────────────

@pytest.mark.parametrize("lang", WRITTEN["sentences"])
def test_every_correction_and_written_sentence_carries_its_language(lang):
    fixed = [orig for orig, fix in example_fixes.fixes().items() if not (fix.get(lang) or "").strip()]
    written = [ex["jp"] for exs in example_fixes.written().values() for ex in exs if not (ex.get(lang) or "").strip()]
    assert fixed == [], f"{len(fixed)} corrections without {lang} (example_fixes.json), e.g. {fixed[:5]}"
    assert written == [], f"{len(written)} written sentences without {lang} (example_added.json), e.g. {written[:5]}"


@pytest.mark.parametrize("lang", WRITTEN["sentences"])
def test_every_sentence_a_card_shows_reads_its_language(lang):
    missing = []
    for level, words in VOCAB_BY_LEVEL.items():
        for w in words:
            kanji, kana = w.get("kanji") or "", w["kana"]
            for ex in get_vocab_extras(kanji, kana, w.get("meaning", ""), lang)["examples"]:
                if ex.get("tr_lang") != lang or not ex.get("tr"):
                    missing.append(f"{level} {kanji or kana}: {ex['jp']}")
    assert missing == [], (f"{len(missing)} sentences a card shows a reader of {lang} in English "
                           f"(jmdict_{lang}.sqlite3, scripts/build_jmdict_fr.py --lang {lang}), e.g. {missing[:10]}")


@pytest.mark.parametrize("lang", WRITTEN["sentences"])
def test_an_entry_says_which_language_each_line_is_in(lang):
    own = get_vocab_extras("学校", "がっこう", "school", lang)
    en = get_vocab_extras("学校", "がっこう", "school", "en")
    assert own["examples"] and all(ex["tr_lang"] == lang for ex in own["examples"])
    assert [ex["en"] for ex in own["examples"]] == [ex["en"] for ex in en["examples"]]
    # A sense the layer has no line for keeps its English, and says so.
    for mine, english in zip(own["senses"], en["senses"]):
        assert mine["glossary_lang"] == lang or (mine["glossary_lang"] == "en" and mine["glossary"] == english["glossary"])


@pytest.mark.parametrize("lang", WRITTEN["sentences"])
def test_a_corpus_sentence_is_translated_for_its_reader(lang):
    jp = next(ex["jp"] for ex in get_vocab_extras("学校", "がっこう", "school", "en")["examples"])
    assert jmdict_fr.translation(jp, "the english", lang) == (jmdict_fr.example(jp, lang), lang)
    assert jmdict_fr.translation("どこにもない文。", "the english", lang) == ("the english", "en")
    assert jmdict_fr.translation(jp, "the english", "de") == ("the english", "en")


# ── The dictionary's chips ───────────────────────────────────

@pytest.mark.parametrize("lang", WRITTEN["chips"])
def test_every_chip_has_its_label_and_tooltip(lang):
    from content import vocab_extras
    labels = getattr(vocab_extras, f"_SHORT_LABELS_{lang.upper()}")
    tooltips = getattr(vocab_extras, f"_TOOLTIPS_{lang.upper()}")
    assert set(labels) == set(vocab_extras._SHORT_LABELS_FR)
    assert set(tooltips) == set(vocab_extras._TOOLTIPS_FR)
    assert all(t.strip() for t in (*labels.values(), *tooltips.values()))
    own = get_vocab_extras("食べる", "たべる", "to eat", lang)["tags"]
    fr = get_vocab_extras("食べる", "たべる", "to eat", "fr")["tags"]
    assert own and [t["code"] for t in own] == [t["code"] for t in fr]
    assert all(t["label"] == vocab_extras._short_label(t["code"], lang) for t in own)
    assert all(t["tooltip"] != f["tooltip"] for t, f in zip(own, fr))


# ── The layer over JMdict ────────────────────────────────────

@pytest.mark.parametrize("lang", WRITTEN["layer"])
def test_the_layer_holds_every_line_the_french_one_does(lang):
    """Senses, sentences and pool lines: a language's layer is the French
    one's twin (plans 215, 302), so nothing a French learner reads in their
    language reaches another in English."""
    with sqlite3.connect(jmdict_fr.DB_PATHS["fr"]) as fr, sqlite3.connect(jmdict_fr.DB_PATHS[lang]) as own:
        for table, key in (("sense", "en"), ("example", "jp"), ("pool_line", "kanji || '::' || kana")):
            french = {k for (k,) in fr.execute(f"SELECT {key} FROM {table}")}
            theirs = {k for (k,) in own.execute(f"SELECT {key} FROM {table}")}
            missing = sorted(french - theirs)
            assert missing == [], f"{len(missing)} {table} lines with French and no {lang}, e.g. {missing[:5]}"


@pytest.mark.parametrize("lang", WRITTEN["layer"])
def test_a_dictionary_entry_reads_its_senses_in_its_language(lang):
    own = get_vocab_extras("食べる", "たべる", "to eat", lang)
    en = get_vocab_extras("食べる", "たべる", "to eat", "en")
    assert own["senses"] and all(s["glossary_lang"] == lang for s in own["senses"])
    assert own["senses"][0]["glossary"] != en["senses"][0]["glossary"]


@pytest.mark.parametrize("lang", WRITTEN["layer"])
def test_a_pool_word_reads_its_language_and_is_found_by_it(lang):
    import content.vocab_jmdict_data as jmdict_db
    row = jmdict_db.get_by_key("豚", "ぶた")
    line = jmdict_fr.pool_meaning(row, lang)
    assert line == jmdict_fr.pool_line("豚", "ぶた", lang) != row["meaning"]
    word = line.split(",")[0].strip()
    keys = {(r["kanji"], r["kana"]) for r in jmdict_db.page(word, 50, 0)}
    assert ("豚", "ぶた") in keys, word


@pytest.mark.parametrize("lang", WRITTEN["layer"])
def test_a_pool_word_in_a_breakdown_carries_its_language(lang):
    from study import analysis
    tokens = analysis.analyze_local("豚を飼っている。")["tokens"]
    pig = next(t for t in tokens if t["surface"] == "豚")
    match = pig.get("vocab_match") or {}
    assert match.get("pool"), "豚 is read as the pool's word"
    assert match["entry"][f"meaning_{lang}"] == jmdict_fr.pool_line("豚", "ぶた", lang)


# ── The breakdown and the code's own tables ──────────────────

@pytest.mark.parametrize("lang", WRITTEN["breakdown"])
def test_no_table_in_the_code_says_a_text_without_the_language(lang):
    """A literal {"en": "...", "fr": "..."} in the server's code is a text a
    learner reads, and one without a language's line reaches its reader in
    English (the tours' scene places did until plan 302's review)."""
    missing = []
    for folder in ("routes", "study", "content", "translations", "core"):
        for path in sorted((_BASE / folder).glob("*.py")):
            tree = ast.parse(path.read_text(encoding="utf-8"))
            for node in ast.walk(tree):
                if not isinstance(node, ast.Dict):
                    continue
                texts = {k.value: v for k, v in zip(node.keys, node.values)
                         if isinstance(k, ast.Constant) and isinstance(k.value, str)}
                if {"en", "fr"} <= texts.keys() and lang not in texts and all(
                        isinstance(texts[k], ast.Constant) and isinstance(texts[k].value, str) for k in ("en", "fr")):
                    missing.append(f"{path.relative_to(_BASE)}:{node.lineno}")
    assert missing == [], missing


# ── A language with nothing written reads English ─────────────
#
# The fallback, held before any line of a new language exists: a stand-in
# the app speaks and has written nothing in is answered by every route that
# takes `lang` exactly as English is, bar the language it echoes back. A
# route that sends a language it does not know to French (basics did,
# `lang if lang in ("en", "es") else "fr"`; the station samples too), or
# keys a cache by it as sent (comprehension did), fails here before any
# learner reads it.

STAND_IN = "zz"
STAND_IN_USER = "lang-stand-in-learner"

# The routes whose answer is not the content's: a model writes it, in the
# language reading.known_lang names (every spoken language has a name for
# the models, above), or it is the learner's own.
EXEMPT = {
    "/api/exams/{exam_id}/revisions/{revision}/questions/{question_id}/study":
        "a model translates a sat question into the learner's language",
    "/api/phrase/history/{entry_id}":
        "a learner's own breakdown, stored in the language it was bought in",
    "/api/reading/comprehension":
        "a fresh text at each call, a model's where the pool has none (held below)",
}


def _lang_routes() -> set[str]:
    from main import app
    paths = app.openapi()["paths"]
    return {path for path, ops in paths.items()
            if any(p["name"] == "lang" and p["in"] == "query" for p in (ops.get("get") or {}).get("parameters", []))}


@pytest.fixture(scope="module")
def stand_in(client):
    """The stand-in's learner, a mixed deck of theirs (a word, a kanji, a
    point and a written card) published to the library, and the URL of
    every route that takes `lang`."""
    from conftest import _wipe, acting_as
    from content.grammar_points_data import grammar_to_id
    from content.kanji_data import kanji_to_id
    from content.vocab_data import vocab_to_id
    from routes.profile import ensure_profile_row
    from study import basics
    from urllib.parse import quote
    ensure_profile_row(STAND_IN_USER)
    point = grammar_to_id(GRAMMAR_POINTS_BY_LEVEL["N5"][0], "N5")
    with acting_as(STAND_IN_USER):
        deck = client.post("/api/decks", json={"name": "Stand-in", "type": "mixed"}).json()["id"]
        linked = client.post(f"/api/decks/{deck}/cards/app", json={"cards": [
            {"source": "vocab", "level": "N5", "raw_id": vocab_to_id(VOCAB_BY_LEVEL["N5"][0], "N5")},
            {"source": "kanji", "level": "N5", "raw_id": kanji_to_id(KANJI_BY_LEVEL["N5"][0], "N5")},
            {"source": "grammar", "level": "N5", "raw_id": point},
        ]})
        assert linked.status_code == 200 and linked.json()["added"] == 3, linked.text
        assert client.post(f"/api/decks/{deck}/cards", json={"front": "君の名前", "back": "きみのなまえ"}).status_code == 200
        assert client.post(f"/api/decks/{deck}/publish", json={}).status_code == 200
        scenario = client.get("/api/conversation/scenarios", params={"lang": "en"}).json()["scenarios"][0]["id"]
    cases = {
        "/api/basics/{unit_id}": f"/api/basics/{basics.units()[0]['id']}",
        "/api/composition/batch": "/api/composition/batch?level=N5",
        "/api/conversation/scenario/{scenario_id}": f"/api/conversation/scenario/{scenario}",
        "/api/conversation/scenarios": "/api/conversation/scenarios",
        "/api/decks/library/{deck_id}": f"/api/decks/library/{deck}",
        "/api/decks/{deck_id}/browse": f"/api/decks/{deck}/browse?source=vocab&level=N5",
        "/api/decks/{deck_id}/cards": f"/api/decks/{deck}/cards",
        "/api/decks/{deck_id}/export": f"/api/decks/{deck}/export",
        "/api/decks/{deck_id}/study": f"/api/decks/{deck}/study?mode=vocab.flashcard.f2b&count=20",
        "/api/dictionary": "/api/dictionary?category=vocab&q=water",
        "/api/dictionary/favorites": "/api/dictionary/favorites",
        "/api/frequency/{domain}/card": "/api/frequency/vocab/card?tier=1&mode=vocab.flashcard.f2b",
        "/api/frequency/{domain}/cards": "/api/frequency/vocab/cards?tier=1&mode=vocab.flashcard.f2b",
        "/api/frequency/{domain}/tier/{tier}/items": "/api/frequency/vocab/tier/1/items",
        "/api/grammar/card": "/api/grammar/card?level=N5&mode=grammar.flashcard.f2b",
        "/api/grammar/cards": "/api/grammar/cards?level=N5&mode=grammar.flashcard.f2b",
        "/api/grammar/point": f"/api/grammar/point?id={quote(point)}",
        "/api/grammar/points": "/api/grammar/points?level=N5",
        "/api/grammar/review-cards": "/api/grammar/review-cards?level=N5",
        "/api/kana/cards": "/api/kana/cards?set_name=hiragana&mode=kana.flashcard.f2b",
        "/api/kanji/card": "/api/kanji/card?level=N5&mode=kanji.flashcard.f2b",
        "/api/kanji/cards": "/api/kanji/cards?level=N5&mode=kanji.flashcard.f2b",
        "/api/kanji/radical/{number}": "/api/kanji/radical/85",
        "/api/kanji/radicals": "/api/kanji/radicals",
        "/api/kanji/review-cards": "/api/kanji/review-cards?level=N5",
        "/api/onboarding/ride": "/api/onboarding/ride",
        "/api/reading/batch": "/api/reading/batch?source=frequency&domain=vocab&tier=1",
        "/api/station/{source}/samples": "/api/station/vocab/samples",
        "/api/today/ahead": "/api/today/ahead?at=2026-11-10T08:00:00Z",
        "/api/today/cards": "/api/today/cards",
        "/api/translation/batch": "/api/translation/batch?source=frequency&domain=vocab&tier=1",
        "/api/translation/kanji": f"/api/translation/kanji?word={quote('山')}",
        "/api/translation/vocab": f"/api/translation/vocab?word={quote('水')}",
        "/api/translations/kanji": "/api/translations/kanji",
        "/api/translations/vocab": "/api/translations/vocab",
        "/api/vocab/card": "/api/vocab/card?level=N5&mode=vocab.flashcard.f2b",
        "/api/vocab/cards": "/api/vocab/cards?level=N5&mode=vocab.flashcard.f2b",
        "/api/vocab/review-cards": "/api/vocab/review-cards?level=N5",
        "/api/vocab/theme/{theme}/card": "/api/vocab/theme/animals/card?mode=vocab.flashcard.f2b",
        "/api/vocab/theme/{theme}/cards": "/api/vocab/theme/animals/cards?mode=vocab.flashcard.f2b",
    }
    yield cases
    _wipe(STAND_IN_USER)


def test_every_route_that_takes_a_language_is_held_here(stand_in):
    """A route the app gains with a `lang` is added to the stand-in's
    cases, or to EXEMPT with the reason its answer is not the content's."""
    assert _lang_routes() == set(stand_in) | set(EXEMPT)
    assert not set(stand_in) & set(EXEMPT)


class _Seeded(random.Random):
    """A generator seeded the same at every call, so two requests deal the
    same cards and the same choices."""
    def __init__(self, x=None):
        super().__init__(312 if x is None else x)


def _answer(client, url: str, lang: str):
    from conftest import acting_as
    from srs import batch_cache
    random.seed(312)
    batch_cache.reset()
    with acting_as(STAND_IN_USER):
        r = client.get(f"{url}{'&' if '?' in url else '?'}lang={lang}")
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else r.text
    return r.status_code, body


def test_a_language_with_nothing_written_reads_english_on_every_route(client, stand_in, monkeypatch):
    import translations
    monkeypatch.setattr(translations, "SPOKEN", (*translations.SPOKEN, STAND_IN))
    monkeypatch.setattr(random, "Random", _Seeded)
    differ = []
    for route, url in sorted(stand_in.items()):
        english, theirs = _answer(client, url, "en"), _answer(client, url, STAND_IN)
        assert english[0] == 200, (route, english)
        echoed = json.dumps(theirs, sort_keys=True, ensure_ascii=False).replace(f'"{STAND_IN}"', '"en"')
        if echoed != json.dumps(english, sort_keys=True, ensure_ascii=False):
            differ.append(route)
        assert _identifiers_beside_languages(english[1]) == [], route
    assert differ == [], f"routes that answer a language with nothing written otherwise than English: {differ}"


def test_a_comprehension_text_is_keyed_by_a_language_the_models_know(client, stand_in, monkeypatch):
    """The pool is keyed (level, lang) and a miss is a model call: a
    language no model is asked in reads the English pool, never a bucket
    and a generation of its own."""
    from routes import reading
    asked = []
    taken = reading._pool_take
    monkeypatch.setattr(reading, "_pool_take", lambda user, level, lang, avoid: asked.append(lang) or taken(user, level, lang, avoid))
    status, body = _answer(client, "/api/reading/comprehension?level=N5", STAND_IN)
    assert status == 200 and asked == ["en"], (status, asked)


# ── Indonesian is `id` (plan 312, the owner's pick D2) ────────
#
# The language code is also the commonest key in the code: an `id` beside
# a text's languages must be that text's Indonesian, never an identifier.
# None stands beside them today, in the content or in what a route answers;
# once the app speaks Indonesian, an `id` beside an `en` is its text in the
# same shape (a string beside a string).

def _identifiers_beside_languages(node, path="$") -> list[str]:
    out = []
    if isinstance(node, dict):
        if "id" in node and {"en", "fr", "es"} & node.keys():
            text = isinstance(node.get("en"), str) and isinstance(node["id"], str)
            if not ("id" in SPOKEN and text):
                out.append(path)
        for key, value in node.items():
            out += _identifiers_beside_languages(value, f"{path}.{key}")
    elif isinstance(node, list):
        for i, value in enumerate(node):
            out += _identifiers_beside_languages(value, f"{path}[{i}]")
    return out


def _content_json() -> list[Path]:
    """The JSON the repository ships under content/ and datas/: what git
    tracks there, so an export restored beside it for a rebuild (the
    KANJIDIC2 and JMdict dumps, a layer's drafts) is not read."""
    import subprocess
    try:
        listed = subprocess.run(["git", "ls-files", "-z", "--", "content", "datas"], cwd=_BASE,
                                capture_output=True, check=True).stdout.decode("utf-8").split("\0")
        return sorted(_BASE / name for name in listed if name.endswith(".json"))
    except (OSError, subprocess.CalledProcessError):
        return sorted([*(_BASE / "content").rglob("*.json"), *(_BASE / "datas").rglob("*.json")])


def test_no_content_holds_an_identifier_beside_a_texts_languages():
    found = []
    for path in _content_json():
        found += [f"{path.relative_to(_BASE)} {where}"
                  for where in _identifiers_beside_languages(json.loads(path.read_text(encoding="utf-8")))]
    for folder in ("content", "study", "routes", "core", "translations"):
        for path in sorted((_BASE / folder).glob("*.py")):
            for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
                if isinstance(node, ast.Dict):
                    keys = {k.value for k in node.keys if isinstance(k, ast.Constant)}
                    if "id" in keys and {"en", "fr", "es"} & keys and "id" not in SPOKEN:
                        found.append(f"{path.relative_to(_BASE)}:{node.lineno}")
    assert found == [], found[:20]
