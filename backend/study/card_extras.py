"""
札の帯 — what a flip card shows under its answer (plan 326).

The owner's pick "B" of the canvas "Tsuji — card templates": the card
stays as it was, and a strip under it carries what the learner chose in
Réglages › Card contents (study/card_contents.py). Every piece is read
from what the dictionary already serves, in the learner's language, so
the strip says nothing the dictionary would not:

  example   the word's first example sentence (content/vocab_extras), its
            segments to mark the word, and its translation in `lang`
  kanji     each kanji the word is written with: the reading it takes in
            this word and the character's own meaning (the dictionary's
            ledger rows, routes/dictionary._word_kanji's rule)
  meanings  the word's senses after the one the card teaches
  pair      its transitive / intransitive pair, from a hand-written list
            (datas/vocab/verb_pairs.json), never guessed from a kanji
  verb      its verb group and transitivity, JMdict's own tags
  words     a kanji's words in the course, at its level or below first
  radical   a kanji's radical, as a lesson knows it (content/radical_data)
  strokes   a kanji's stroke count

A piece the content lacks is absent, never invented: a word with no
example has no example row, a noun no verb row. A card the app does not
own (a learner's deck card, a pool word) has no strip at all.
"""
import json
import re
from functools import lru_cache
from pathlib import Path

from content.kanji_data import DECK_BY_CHAR, KANJI_BY_LEVEL
from content.vocab_data import VOCAB_BY_LEVEL
import content.kanji_pool_data as kanji_db
from content.radical_data import info_for as radical_info
from translations import get_meaning
from translations.course import KANJI_GLOSSES, VOCAB_GLOSSES

LANGS = ("en", "fr", "es")
LEVELS = ("N5", "N4", "N3", "N2", "N1")
# The strip holds a few rows, never a page: the dictionary has the rest.
MAX_MEANINGS = 2
MAX_WORDS = 3
_CJK = re.compile(r"[一-龯]")
# JMdict's tags that say what kind of verb a word is.
_VERB_TAG = re.compile(r"^(v1|v5.*|vk|vs.*|vz|vt|vi)$")

_PAIRS_FILE = Path(__file__).resolve().parent.parent / "datas" / "vocab" / "verb_pairs.json"


def lang_of(value) -> str:
    code = str(value or "").strip().lower().replace("_", "-").split("-")[0]
    return code if code in LANGS else "en"


@lru_cache(maxsize=1)
def _vocab_index() -> dict[tuple[str, str], tuple[str, dict]]:
    """(kanji, kana) -> (level, entry), each word at the level that teaches it."""
    out = {}
    for level in LEVELS:
        for e in VOCAB_BY_LEVEL.get(level, []):
            out.setdefault((e.get("kanji", ""), e.get("kana", "")), (level, e))
    return out


@lru_cache(maxsize=1)
def pairs() -> dict[str, list[tuple[str, str]]]:
    """Deck key -> [(partner's key, "vi" | "vt")]: a transitive verb's
    intransitive partners and the other way round."""
    data = json.loads(_PAIRS_FILE.read_text(encoding="utf-8"))
    out: dict[str, list[tuple[str, str]]] = {}
    for vt, vi in data["pairs"]:
        out.setdefault(vt, []).append((vi, "vi"))
        out.setdefault(vi, []).append((vt, "vt"))
    return out


def parse_id(card_id: str):
    """A built-in card id -> ("vocab", level, entry) | ("kanji", level, entry) | None."""
    if not isinstance(card_id, str):
        return None
    if card_id.startswith("vocab_"):
        rest = card_id[len("vocab_"):]
        level, _, word = rest.partition("_")
        if level not in LEVELS or "_" not in word:
            return None
        kanji, kana = word.rsplit("_", 1)
        for e in VOCAB_BY_LEVEL.get(level, []):
            if e.get("kanji", "") == kanji and e.get("kana", "") == kana:
                return ("vocab", level, e)
        return None
    if card_id.startswith("kanji_"):
        level, _, char = card_id[len("kanji_"):].partition("_")
        if level not in LEVELS:
            return None
        for e in KANJI_BY_LEVEL.get(level, []):
            if e.get("kanji") == char:
                return ("kanji", level, e)
    return None


def _example(kanji: str, kana: str, meaning: str, lang: str):
    from content.vocab_extras import get_vocab_extras
    extras = get_vocab_extras(kanji, kana, meaning, lang)
    examples = extras.get("examples") or []
    return extras, (examples[0] if examples else None)


def _word_kanji(word: str, kana: str, lang: str) -> list[dict]:
    from study.kanji_words import reading_of, word_furigana
    chars = list(dict.fromkeys(_CJK.findall(word or "")))
    if not chars:
        return []
    furigana = word_furigana(word, kana)
    off_deck = [c for c in chars if c not in DECK_BY_CHAR]
    pool = kanji_db.meanings_for(off_deck, lang) if off_deck else {}
    if lang != "en":
        missing = [c for c in off_deck if c not in pool]
        if missing:
            pool.update(kanji_db.meanings_for(missing, "en"))
    out = []
    for char in chars:
        deck = DECK_BY_CHAR.get(char)
        out.append({
            "char": char,
            "reading": reading_of(char, furigana),
            "meaning": get_meaning(deck[1], lang, KANJI_GLOSSES) if deck else pool.get(char, ""),
        })
    return out


def _verb(senses: list[dict]) -> list[str]:
    """The verb tags of the sense the card teaches, as labels in the
    learner's language; nothing for a word that is not a verb."""
    if not senses:
        return []
    primary = next((s for s in senses if s.get("primary")), senses[0])
    return [t["label"] for t in primary.get("tags", []) if _VERB_TAG.match(t.get("code", ""))]


def vocab_extras(level: str, entry: dict, fields: set[str], lang: str) -> dict:
    kanji, kana = entry.get("kanji", ""), entry.get("kana", "")
    out: dict = {}
    if fields & {"example", "sentence", "meanings", "verb"}:
        extras, example = _example(kanji, kana, entry.get("meaning", ""), lang)
        if example and fields & {"example", "sentence"}:
            out["example"] = {
                "jp": example["jp"],
                "segments": [
                    {"text": s["text"], "reading": s.get("reading"), "highlight": bool(s.get("highlight"))}
                    for s in example.get("segments") or []
                ],
                # The translation is the answer side's alone: the client
                # never prints it over the question (cardContents.js).
                "tr": example.get("tr") or example.get("en") or "",
            }
        senses = extras.get("senses") or []
        if "meanings" in fields:
            others = [s.get("glossary", "") for s in senses if not s.get("primary")]
            others = [g for g in others if g][:MAX_MEANINGS]
            if others:
                out["meanings"] = others
        if "verb" in fields:
            verb = _verb(senses)
            if verb:
                out["verb"] = verb
    if "kanji" in fields:
        parts = _word_kanji(kanji, kana, lang)
        if parts:
            out["kanji"] = parts
    if "pair" in fields:
        partners = []
        for key, kind in pairs().get(f"{kanji}::{kana}", []):
            p_kanji, p_kana = key.split("::")
            found = _vocab_index().get((p_kanji, p_kana))
            if found:
                p_level, p_entry = found
                partners.append({
                    "kanji": p_kanji, "kana": p_kana, "kind": kind, "level": p_level,
                    "meaning": get_meaning(p_entry, lang, VOCAB_GLOSSES),
                })
        if partners:
            out["pair"] = partners
    return out


def kanji_extras(level: str, entry: dict, fields: set[str], lang: str) -> dict:
    char = entry["kanji"]
    out: dict = {}
    if "words" in fields:
        from study.kanji_words import kanji_words
        rank = LEVELS.index(level)
        words = kanji_words(char, lang)["examples"]
        # The words of the card's own level and below first: the ones
        # the learner has met, or is meeting now.
        words = sorted(words, key=lambda w: LEVELS.index(w["level"]) > rank if w.get("level") in LEVELS else True)
        picked = [
            {"kanji": w["kanji"], "kana": w["kana"], "meaning": w.get("meaning", ""), "level": w.get("level")}
            for w in words[:MAX_WORDS]
        ]
        if picked:
            out["words"] = picked
    if fields & {"radical", "strokes"}:
        row = kanji_db.radicals_for([char]).get(char)
        if row:
            if "radical" in fields:
                info = radical_info(row["radical"], lang)
                if info:
                    out["radical"] = {"number": info["number"], "glyph": info["glyph"], "meaning": info["meaning"]}
            if "strokes" in fields and row.get("stroke_count"):
                out["strokes"] = row["stroke_count"]
    return out


def extras_for(card_ids, chosen: dict[str, list[str]], lang: str) -> dict[str, dict]:
    """{card_id: extras} for the built-in vocab and kanji cards among
    `card_ids`, holding only what `chosen` asks for; a card with nothing
    to show is left out."""
    lang = lang_of(lang)
    out = {}
    for card_id in card_ids:
        parsed = parse_id(card_id)
        if not parsed:
            continue
        line, level, entry = parsed
        fields = set(chosen.get(line) or [])
        if not fields:
            continue
        built = (vocab_extras if line == "vocab" else kanji_extras)(level, entry, fields, lang)
        if built:
            out[card_id] = built
    return out
