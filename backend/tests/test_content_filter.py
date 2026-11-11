"""
core/content_filter.py (plan 310): what a learner may not post to
another, held rule by rule to the text it must refuse and the lookalike
it must let through, and as a whole to everything the app teaches.

The words below are here because a filter cannot be tested without
them; each is a rule of the module's, never a sample of learner text.
"""
import glob
import json
import re
import sqlite3
from pathlib import Path

import pytest

from core.content_filter import card_refused, refused

BACKEND = Path(__file__).resolve().parent.parent


# ── Every rule, with its lookalike ────────────────────────────
#
# (refused, passes): the first is refused wherever the rule's tier
# reaches, the second is let through everywhere, a name included.

SLURS = [
    # English
    ("nigger", "snigger"),
    ("N1GG3R", "a sniggering crowd"),
    ("nigga", "niggardly"),
    ("niggas", "nigaoe"),                    # 似顔絵
    ("wetback", "my wet back"),
    ("raghead", "ragged"),
    ("towelhead", "towel"),
    ("gook", "gokuraku"),                    # 極楽
    ("tranny", "tranquil"),
    # French
    ("bougnoule", "bougie"),
    ("youpin", "youpi !"),
    ("youpine", "youpi"),
    ("nègre", "negro"),                      # Spanish "black"
    ("négresse", "noire"),
    ("bicot", "bicolore"),
    ("chinetoque", "chinois"),
    ("niakoué", "niaque"),
    ("pédé", "pédale"),
    ("tarlouze", "tartelette"),
    # Spanish
    ("maricón", "marisco"),
    ("maricona", "mariposa"),
    ("sudaca", "sudamericano"),
    ("negrata", "negrita"),
    # Japanese, in the text
    ("ニガー", "ニガウリ"),
    ("ﾆｶﾞｰ", "苦い"),                         # half-width, folded by NFKC
    ("チョン公", "チョンボ"),
    ("あいつはチョン公だ", "ちょんまげ"),
    ("支那人", "支那そば"),
    ("支那人だ", "印度支那人"),
    ("シナ人", "インドシナ人"),
    ("チャンコロ", "ちゃんこ鍋"),
    ("チャンコロめ", "チャンコ鍋"),
    ("ガイジ", "ガイジン"),
    ("キチガイ", "ききちがい"),               # 聞き違い in kana holds きちがい
    ("キチガイだ", "書きちがい"),
    ("穢多", "穢れ"),
    ("ジャップ", "ジャップカサイ"),
    ("ジャップ", "ジャンプ"),
    ("クロンボ", "クローン"),
    ("黒んぼ", "黒い"),
]

VULGAR = [
    # English
    ("fuck", "Fukushima"),
    ("motherfucker", "fuku"),
    ("shit", "shita"),
    ("bullshit", "tabemashita"),
    ("shitty", "shitamachi"),
    ("shithead", "shiitake"),
    ("cunt", "Scunthorpe"),
    ("bitch", "bitter"),
    ("bitches", "bits"),
    ("whore", "whole"),
    ("slut", "sluice"),
    ("asshole", "assassin"),
    ("dickhead", "Dickens"),
    ("wanker", "Wankel"),
    ("porn", "porch"),
    ("porno", "poruno"),
    ("faggot", "fagot"),                     # French: a bassoon, a bundle
    ("cocksucker", "cockpit"),
    # French
    ("putain", "putatif"),
    ("pute", "dispute"),
    ("salope", "salopette"),
    ("connard", "connaissance"),
    ("connasse", "connaître"),
    ("enculé", "enclume"),
    ("enculer", "reculer"),
    ("couille", "cuillère"),
    ("couilles", "couleur"),
    ("branleur", "branle-bas"),
    # Spanish
    ("puta", "disputa"),
    ("puto", "cómputo"),
    ("pendejo", "pendiente"),
    ("pendeja", "pendientes"),
    ("verga", "vergüenza"),
    ("chingar", "chino"),
    ("chinga", "china"),
    ("chingada", "chinela"),
    ("chingado", "chincheta"),
    ("culero", "cuello"),
    ("joder", "poder"),
    ("gilipollas", "pollo"),
    ("hijueputa", "hijo"),
    ("malparido", "parido"),
]

# Words a looser list would take, which a learner writes every day.
NEVER = [
    "pique-nique", "en retard", "negro", "a chink in the armour", "dyke",
    "kike", "JAP 101", "Mother Father", "un bâtard de pain", "cono",
    "Tifa2", "SwiftRonin1234", "ShitaMachi", "Shi7", "N5", "1945",
    "Kanji du bureau", "Verbes irréguliers", "会議", "下町", "くそ",
    "ガイジン", "インドシナ人", "聞き違い", "ちゃんこ鍋",
]


@pytest.mark.parametrize("bad,lookalike", SLURS)
def test_a_slur_is_refused_everywhere_and_its_lookalike_nowhere(bad, lookalike):
    assert refused(bad)
    assert refused(bad, name=True)
    assert card_refused({"front": "x", "back": bad})
    assert not refused(lookalike)
    assert not refused(lookalike, name=True)


@pytest.mark.parametrize("bad,lookalike", VULGAR)
def test_a_vulgarity_is_refused_in_a_name_and_passes_on_a_card(bad, lookalike):
    assert refused(bad, name=True)
    # A card is what a learner opened, and may have to say what a word
    # means: くそ is "shit".
    assert not refused(bad)
    assert not card_refused({"front": "くそ", "back": bad})
    assert not refused(lookalike, name=True)


def test_a_slur_a_gloss_holds_is_refused_in_a_name_alone():
    """KANJIDIC2 glosses 把 (a bundle) with the word: a learner's kanji
    card may say so, a handle or a deck's name may not."""
    gloss = "grasp; faggot; bunch; counter for bundles"
    assert not card_refused({"kanji": "把", "meaning": gloss})
    assert refused(gloss, name=True)


@pytest.mark.parametrize("text", NEVER)
def test_what_a_learner_writes_every_day_passes(text):
    assert not refused(text, name=True)
    assert not refused(text)


def test_a_word_is_folded_before_it_is_read():
    for spelled in ("FUCK", "Fück", "5h1t", "Sh1t", "ｆｕｃｋ", "Bitch!", "bitch's"):
        assert refused(spelled, name=True), spelled
    # A camel-cased handle is its words, a number at a word's end is no
    # letter, and a plural is its word.
    assert refused("BigShit", name=True)
    assert refused("Shit99", name=True)
    assert refused("putas", name=True)
    assert not refused("Shitamachi99", name=True)


def test_a_one_word_name_spelled_apart_is_read_whole():
    assert refused("f_u_c_k", name=True)
    assert refused("n.i.g.g.e.r", name=True)
    assert refused("n_i_g_g_e_r", name=True)
    # Never across the words of a sentence or a deck's name.
    assert not refused("Mother Father", name=True)
    assert not refused("of uck", name=True)


def test_a_card_is_read_field_by_field_its_notes_too():
    assert card_refused({"kanji": "会", "readings": {"on": ["カイ"], "kun": ["ニガー"]}})
    assert card_refused({"front": "会議", "back": "meeting"}, "ニガー")
    assert not card_refused({"front": "会議", "back": "meeting"}, "")
    assert not card_refused({"radical": 9, "readings": None})
    assert not card_refused(None, None)


def test_nothing_is_refused_by_nothing():
    for empty in ("", None, "   ", "123"):
        assert not refused(empty) and not refused(empty, name=True)


# ── What the app teaches passes ───────────────────────────────

def _strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for v in value.values():
            yield from _strings(v)
    elif isinstance(value, (list, tuple)):
        for v in value:
            yield from _strings(v)


def _taught() -> dict[str, list[str]]:
    """Every text the app teaches, by where it comes from: the decks and
    their translations, the catalogue, the banks and the seeds, and the
    French and Spanish layers' senses and sentences."""
    files = [
        "datas/vocab/vocab_deck.json", "datas/vocab/vocab_fr.json", "datas/vocab/vocab_es.json",
        "datas/kanji/kanji_deck.json", "datas/kanji/kanji_meanings_fr.json",
        "datas/kanji/kanji_meanings_es.json", "datas/vocab/example_fixes.json",
        "datas/vocab/example_added.json", "datas/vocab/example_senses.json",
        "datas/vocab/theme_words.json", "content/basics.json",
    ]
    for pattern in ("content/grammar/N*.json", "content/comprehension/*.json",
                    "content/conversation/*.json", "content/exam_seed/*.json"):
        files += sorted(str(Path(p).relative_to(BACKEND)) for p in glob.glob(str(BACKEND / pattern)))
    taught = {f: list(_strings(json.loads((BACKEND / f).read_text(encoding="utf-8")))) for f in files}
    from content import reading_sentences
    taught["content/reading_sentences.py"] = [
        s for name in dir(reading_sentences) if name.isupper()
        for s in _strings(getattr(reading_sentences, name))
    ]
    for layer in ("jmdict_fr", "jmdict_es"):
        db = sqlite3.connect(BACKEND / "datas" / "vocab" / f"{layer}.sqlite3")
        try:
            taught[layer] = [s for table in ("sense", "example", "pool_line")
                             for row in db.execute(f"SELECT * FROM {table}")
                             for s in row if isinstance(s, str)]
        finally:
            db.close()
    return taught


def test_nothing_the_app_teaches_is_refused_on_a_card():
    """A learner copies what the app says into a card: none of it, over
    a million strings in three languages and Japanese, is refused there."""
    taught = _taught()
    assert sum(len(v) for v in taught.values()) > 500_000
    # Each text once, under the first place that says it.
    seen: dict[str, str] = {}
    for where, strings in taught.items():
        for s in strings:
            seen.setdefault(s, where)
    hits = [(where, s) for s, where in seen.items() if refused(s)]
    assert hits == []


def test_no_word_the_decks_teach_is_refused_as_a_handle():
    """A username or a deck's name is often a Japanese word in romaji:
    every reading the vocab and kanji decks teach passes as one, in kana
    and in Hepburn, alone and as part of a handle."""
    from study.romaji import to_romaji
    readings = set()
    for level in json.loads((BACKEND / "datas/vocab/vocab_deck.json").read_text(encoding="utf-8")).values():
        for entry in level:
            readings.update(k for k in re.split(r"[/・]", entry["kana"]) if k)
    for level in json.loads((BACKEND / "datas/kanji/kanji_deck.json").read_text(encoding="utf-8")).values():
        for entry in level:
            readings.update(k.replace(".", "").replace("-", "") for k in entry["kana"].split("・") if k)
    assert len(readings) > 8000
    hits = []
    for kana in sorted(readings):
        romaji = re.sub(r"[^a-z]", "", to_romaji(kana).lower())
        for name in (kana, romaji, f"{romaji.capitalize()}_jp", f"I_love_{romaji}"):
            if name and refused(name, name=True):
                hits.append((kana, name))
    assert hits == []


def test_no_handle_the_app_draws_is_refused():
    from routes.profile import _ADJECTIVES, _NOUNS
    for adjective in _ADJECTIVES:
        for noun in _NOUNS:
            for number in ("100", "777", "9999"):
                assert not refused(f"{adjective}{noun}{number}", name=True)
