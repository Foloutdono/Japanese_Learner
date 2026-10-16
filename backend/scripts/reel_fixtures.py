"""
What the reel's stage is told, computed by the app's own code (plan 210).
Read-only: no database, no model call, no voice engine.

A reel (frontend/reel/) films the real app, and the real app asks the
server for everything it draws: a sentence's breakdown, a word's entry, a
reading prompt, the accuracy of a typed answer. The reel's stage has no
server, so the generator asks this script for those answers before
filming, from the same functions the routes call:

  analyze      POST /api/phrase/analyze, unsaved, for a learner with no
               cards (study/analysis: the local tier, the passage split
               and the single-sentence mirror routes/phrase does)
  dictionary   GET /api/dictionary for every word, kanji and grammar point
               a breakdown can open, and for the reel's own searches
               (routes/dictionary.get_dictionary itself)
  phrase       a reading batch's prompt (routes/reading._finish_phrase's
               fields: romaji, furigana, words, the display time)
  check        POST /api/reading/check for the answer the reel types
               (study/dictation.measure_forms)
  words/kanji  the deck entries a review or a kanji scene shows
  grammar      GET /api/grammar/point's lesson for a point

The database is never opened: the two modules that would open it at
import (core.db, core.srs_instance) are replaced, before anything imports
them, by stand-ins that know no learner -- every card reads not_started,
which is what a stranger to the app sees, and any call that would have
written something raises.

    python -m scripts.reel_fixtures request.json            # the bundle, to stdout
    python -m scripts.reel_fixtures request.json --out bundle.json

A request is {"lang", "sentences": [{"text", "translation", "answer"}],
"searches": [{"q", "category", "level"}], "words": [...], "kanji": [...],
"grammar": [raw_id, ...]}; every field is optional but lang.
"""
import argparse
import json
import sys
import types


def _no_database():
    """Stand in for the modules that open a connection when imported."""
    def refuse(*_a, **_k):
        raise RuntimeError("reel_fixtures reads no database")

    db = types.ModuleType("core.db")
    db.db_conn = refuse
    sys.modules.setdefault("core.db", db)

    class _Nobody:
        def get_user_states(self, *_a, **_k):
            return {}

        def get_states_for(self, *_a, **_k):
            return {}

        def __getattr__(self, name):
            raise RuntimeError(f"reel_fixtures reads no database (srs.{name})")

    srs = types.ModuleType("core.srs_instance")
    srs.srs = _Nobody()
    sys.modules.setdefault("core.srs_instance", srs)


_no_database()

from content.grammar_points_data import entry_by_id  # noqa: E402
from study.analysis import analyze_local, attach_user_state  # noqa: E402
from study.dictation import measure_forms  # noqa: E402
from study.furigana import align_sentence  # noqa: E402
from study.grammar_lesson import lesson_payload  # noqa: E402
from study.romaji import sentence_romaji, sentence_words  # noqa: E402
from study.sentences import MAX_SENTENCES, split_sentences  # noqa: E402
from routes.dictionary import get_dictionary  # noqa: E402

_NOBODY = "reel"

# routes/reading.py's display time: 3 s and 0.6 s a character, 5 to 45.
_BASE_SECONDS, _PER_CHAR, _MIN_SECONDS, _MAX_SECONDS = 3.0, 0.6, 5, 45


def analyze(passage: str) -> dict:
    """POST /api/phrase/analyze's answer to `passage`, unsaved."""
    passage = passage.strip()
    parts = split_sentences(passage)[:MAX_SENTENCES]
    sentences = [attach_user_state(analyze_local(p["text"]), {}, _NOBODY) for p in parts]
    result = {"passage": passage, "sentences": sentences, "truncated": 0, "id": None, "created_at": None}
    if len(sentences) == 1:
        only = sentences[0]
        result.update({
            "explanation": only.get("explanation", ""),
            "translation": only.get("translation", ""),
            "words": only["tokens"],
            "tokens": only["tokens"],
            "grammar": only["grammar"],
            "level": only["level"],
            "grade": only["grade"],
            "available": only["available"],
            "unknown_count": only.get("unknown_count"),
            "off_deck_count": only.get("off_deck_count"),
        })
    return result


def lookup_key(category: str, q: str = "", kana: str = "", id: str = "") -> str:
    """How the stage files a dictionary answer: what the request names."""
    return "|".join([category, q or "", kana or "", id or ""])


def dictionary(lang: str, category: str, q: str = "", kana: str = "", id: str = "",
               level: str | None = None, limit: int = 10) -> dict:
    return get_dictionary(
        q=q, page=0, limit=limit, lang=lang, category=category, radical=None, kana=kana,
        level=level, id=id, match="word", field="all", one=bool(kana), user_id=_NOBODY,
    )


def lookups_of(answer: dict) -> list[tuple[str, str, str, str]]:
    """Every entry a breakdown can open (components/analysis/lookup.js):
    a word by its deck entry's spelling and reading, each kanji, each
    grammar point by its id."""
    out = []
    for sentence in answer["sentences"]:
        for tok in sentence["tokens"]:
            entry = (tok.get("vocab_match") or {}).get("entry")
            if entry:
                term = entry.get("kanji") or entry.get("kana") or tok["surface"]
                out.append(("vocab", term, entry.get("kana") or "", ""))
            for k in tok.get("kanji_matches") or []:
                out.append(("kanji", k["kanji"], "", ""))
        for point in sentence["grammar"]:
            out.append(("grammar", "", "", point["raw_id"]))
    return out


def phrase(text: str, translation: str, lang: str) -> dict:
    """A reading or translation batch's prompt for `text`."""
    seconds = _BASE_SECONDS + _PER_CHAR * len(text)
    return {
        "phrase": text,
        "romaji": sentence_romaji(text),
        "furigana": align_sentence(text),
        "words": sentence_words(text),
        "translation": translation,
        "translation_lang": lang,
        "display_seconds": max(_MIN_SECONDS, min(_MAX_SECONDS, round(seconds, 1))),
        "key": f"reel:{text}",
    }


def bundle(request: dict) -> dict:
    lang = request.get("lang", "en")
    out = {"lang": lang, "analyze": {}, "phrase": {}, "check": {}, "dictionary": {},
           "words": {}, "kanji": {}, "grammar": {}}

    def entry(category, q="", kana="", id="", level=None, limit=10):
        key = lookup_key(category, q, kana, id)
        if key not in out["dictionary"]:
            out["dictionary"][key] = dictionary(lang, category, q, kana, id, level, limit)
        return out["dictionary"][key]

    for sentence in request.get("sentences", []):
        text = sentence["text"].strip()
        answer = analyze(text)
        out["analyze"][text] = answer
        out["phrase"][text] = phrase(text, sentence.get("translation", ""), lang)
        if sentence.get("answer"):
            out["check"].setdefault(text, {})[sentence["answer"]] = measure_forms(
                sentence["answer"], jp=text, romaji=out["phrase"][text]["romaji"],
            )
        for category, q, kana, id in lookups_of(answer):
            entry(category, q, kana, id)

    for search in request.get("searches", []):
        key = lookup_key(search.get("category", "vocab"), search.get("q", "")) + f"|{search.get('level') or ''}"
        out["dictionary"][key] = dictionary(
            lang, search.get("category", "vocab"), search.get("q", ""), level=search.get("level"), limit=50,
        )

    for word in request.get("words", []):
        spelling, _, reading = word.partition(":")
        found = entry("vocab", spelling, reading)["results"]
        if found:
            out["words"][word] = found[0]

    for char in request.get("kanji", []):
        found = entry("kanji", char)["results"]
        hit = next((k for k in found if k.get("kanji") == char), None)
        if hit:
            out["kanji"][char] = hit

    for raw_id in request.get("grammar", []):
        hit = entry_by_id(raw_id)
        if hit:
            level, point = hit
            out["grammar"][raw_id] = {"level": level, "pattern": point["pattern"], **lesson_payload(level, point, lang)}
    return out


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("request", help="the reel's request, as JSON ('-' for stdin)")
    parser.add_argument("--out", help="write the bundle here instead of to stdout")
    args = parser.parse_args(argv)
    if args.request == "-":
        request = json.load(sys.stdin)
    else:
        with open(args.request, encoding="utf-8") as f:
            request = json.load(f)
    text = json.dumps(bundle(request), ensure_ascii=False, default=str)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(text)
    else:
        sys.stdout.write(text + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
