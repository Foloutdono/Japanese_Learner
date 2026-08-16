# ── 漢字読み / 表記 generator ──────────────────────────────────
# Deterministic given (level, seed) — no LLM, no network call, built
# entirely from data this project already owns: the curated JLPT vocab
# deck (content/vocab_data.py) and KANJIDIC2-derived reading/radical
# data (datas/kanji/). Ships first among the exam generators because
# it needs none of that: no sentence-generation pipeline, no
# level-graded corpus, nothing that depends on Phase 4/5's work.
#
# Distractors are built to be near-miss BY CONSTRUCTION rather than
# drawn at random — the same discipline real JLPT items use. A
# systematic voicing x length grid is exactly how the bundled example
# in the project's own research turned up (せんしゅ / せんしゅう /
# ぜんしゅ / ぜんしゅう for 先週): reproducing that TECHNIQUE from
# owned data is original work; reproducing a specific past-paper item
# would not be. See study/exam_validation.py for the gates a generated
# paper must clear before it's ever served.
#
# Today's items are bare-word prompts ("毎月", not a carrier sentence
# with 毎月 underlined) — deliberately: a natural carrier sentence
# needs either a level-graded real-sentence corpus (routes/reading.py
# shows real example sentences pass a level's kanji filter only 4% of
# the time at N5) or an LLM, and this generator is scoped to need
# neither. Carrier sentences are a natural upgrade for a later pass
# once the reading generator (Phase 4) exists to reuse.
import json
import os
import random

from content.vocab_data import VOCAB_BY_LEVEL
from study.exam_blueprint import LEVEL_BLUEPRINT
from study.exam_validation import validate_questions

_BASE_DIR = os.path.dirname(os.path.dirname(__file__))
_KANJI_DATA_DIR = os.path.join(_BASE_DIR, "datas", "kanji")

with open(os.path.join(_KANJI_DATA_DIR, "kanji_readings.json"), encoding="utf-8") as f:
    KANJI_READINGS: dict[str, dict] = json.load(f)

with open(os.path.join(_KANJI_DATA_DIR, "kanji_radicals.json"), encoding="utf-8") as f:
    KANJI_RADICALS: dict[str, dict] = json.load(f)


class GenerationFailed(Exception):
    pass


# ── Reverse indexes, built once at import ──────────────────────
def _deck_kanji_chars() -> set[str]:
    chars = set()
    for entries in VOCAB_BY_LEVEL.values():
        for w in entries:
            chars.update(w.get("kanji") or "")
    return chars


_DECK_CHARS = _deck_kanji_chars()


def _build_radical_index() -> dict[int, list[str]]:
    # Restricted to characters that actually appear in the app's own
    # vocab deck, not the full ~13k KANJIDIC2 set — a 表記 distractor
    # should look like a character the learner could plausibly
    # confuse the right one for, not an obscure character they've
    # never seen.
    index: dict[int, list[str]] = {}
    for char in _DECK_CHARS:
        info = KANJI_RADICALS.get(char)
        if not info:
            continue
        index.setdefault(info["radical"], []).append(char)
    return index


RADICAL_INDEX = _build_radical_index()


def _build_reading_to_spellings() -> dict[str, set[str]]:
    # reading -> every real kanji spelling in the deck that reads that
    # way. The only use is a safety check: a 表記 distractor must never
    # equal a DIFFERENT real word's actual spelling for the SAME
    # target reading, or the item would have two defensible answers.
    index: dict[str, set[str]] = {}
    for entries in VOCAB_BY_LEVEL.values():
        for w in entries:
            kanji = w.get("kanji") or ""
            if not kanji:
                continue
            for reading in (w.get("kana") or "").split("/"):
                reading = reading.strip()
                if reading:
                    index.setdefault(reading, set()).add(kanji)
    return index


READING_TO_SPELLINGS = _build_reading_to_spellings()

_KATAKANA_RANGE = ("ァ", "ヶ")
_KATA_TO_HIRA_SHIFT = 0x60


def _kata_to_hira(s: str) -> str:
    lo, hi = _KATAKANA_RANGE
    return "".join(chr(ord(c) - _KATA_TO_HIRA_SHIFT) if lo <= c <= hi else c for c in s)


def _strip_okurigana(reading: str) -> str:
    # KANJIDIC2 kun-readings mark the okurigana boundary with a dot
    # (つ.ぐ) — the part before the dot is the kanji's own reading.
    return _kata_to_hira(reading.split(".")[0])


# ── Mora-level phonetic perturbation ────────────────────────────
_SMALL_KANA = set("ゃゅょ")


def _moras(reading: str) -> list[str]:
    moras: list[str] = []
    for ch in reading:
        if ch in _SMALL_KANA and moras:
            moras[-1] += ch
        else:
            moras.append(ch)
    return moras


_VOICING_PAIRS = {
    "か": "が", "き": "ぎ", "く": "ぐ", "け": "げ", "こ": "ご",
    "さ": "ざ", "し": "じ", "す": "ず", "せ": "ぜ", "そ": "ぞ",
    "た": "だ", "ち": "ぢ", "つ": "づ", "て": "で", "と": "ど",
    "は": "ば", "ひ": "び", "ふ": "ぶ", "へ": "べ", "ほ": "ぼ",
}
_SEMI_VOICING_PAIRS = {"は": "ぱ", "ひ": "ぴ", "ふ": "ぷ", "へ": "ぺ", "ほ": "ぽ"}
_UNVOICE = {v: k for k, v in _VOICING_PAIRS.items()}
_UNSEMIVOICE = {v: k for k, v in _SEMI_VOICING_PAIRS.items()}


def _voicing_variants(mora: str) -> list[str]:
    base, suffix = mora[0], mora[1:]
    variants = set()
    for table in (_VOICING_PAIRS, _SEMI_VOICING_PAIRS, _UNVOICE, _UNSEMIVOICE):
        if base in table:
            variants.add(table[base] + suffix)
    variants.discard(mora)
    return sorted(variants)


def _voicing_flip_candidates(reading: str) -> list[str]:
    moras = _moras(reading)
    out = []
    for i, m in enumerate(moras):
        for variant in _voicing_variants(m):
            perturbed = moras.copy()
            perturbed[i] = variant
            out.append("".join(perturbed))
    return out


# Crude but workable: mora endings whose vowel is u/o, the two columns
# a trailing "long ー" is spelled with in real hiragana orthography
# (しゅう, とう). Good enough to reproduce the pattern this generator
# is built around; not a full model of Japanese vowel length.
_U_O_VOWEL_ENDINGS = set("うくすつぬふむゆるぐずぶぷおこそとのほもよろごぞどぼぽ")


def _toggle_long_vowel(reading: str) -> list[str]:
    moras = _moras(reading)
    # Only drop a trailing う if at least 2 moras remain — otherwise a
    # 2-mora word like かう (飼う) degenerates to the single mora "か",
    # which isn't a plausible near-miss, just a fragment.
    if reading.endswith("う") and len(moras) >= 3:
        return [reading[:-1]]
    if moras and moras[-1][-1] in _U_O_VOWEL_ENDINGS:
        return [reading + "う"]
    return []


# k/s/t/p rows are the consonants that plausibly geminate (っ) in real
# words (がっこう, きって) — the other rows essentially don't.
_GEMINATABLE_STARTS = set("かきくけこさしすせそたちつてとぱぴぷぺぽ")


def _toggle_geminate(reading: str) -> list[str]:
    moras = _moras(reading)
    out = []
    for i, m in enumerate(moras):
        if m == "っ":
            out.append("".join(moras[:i] + moras[i + 1:]))
    # i > 0 only — っ never opens a real Japanese word, so inserting
    # one before the first mora would produce an unpronounceable
    # "distractor" rather than a plausible near-miss.
    for i, m in enumerate(moras):
        if i > 0 and m and m[0] in _GEMINATABLE_STARTS and moras[i - 1] != "っ":
            out.append("".join(moras[:i] + ["っ"] + moras[i:]))
    return out


# ── Distractor construction ─────────────────────────────────────
def build_kanji_reading_distractors(word: dict, rng: random.Random) -> list[str]:
    readings = [r.strip() for r in (word.get("kana") or "").split("/") if r.strip()]
    if not readings:
        return []
    correct = readings[0]
    own_readings = set(readings)

    candidates = set()
    candidates.update(_voicing_flip_candidates(correct))
    candidates.update(_toggle_long_vowel(correct))
    candidates.update(_toggle_geminate(correct))

    kanji = word.get("kanji") or ""
    if len(kanji) == 1:
        info = KANJI_READINGS.get(kanji, {})
        for alt in info.get("ja_on", []) + info.get("ja_kun", []):
            stripped = _strip_okurigana(alt)
            if stripped:
                candidates.add(stripped)

    candidates -= own_readings
    return sorted(candidates)


def build_orthography_distractors(word: dict, rng: random.Random) -> list[str]:
    kanji = word.get("kanji") or ""
    reading = (word.get("kana") or "").split("/")[0].strip()
    same_reading_spellings = READING_TO_SPELLINGS.get(reading, set())

    candidates = set()
    for i, char in enumerate(kanji):
        info = KANJI_RADICALS.get(char)
        if not info:
            continue
        siblings = [c for c in RADICAL_INDEX.get(info["radical"], []) if c != char]
        rng.shuffle(siblings)
        for alt_char in siblings[:4]:
            candidates.add(kanji[:i] + alt_char + kanji[i + 1:])

    candidates.discard(kanji)
    candidates -= same_reading_spellings
    return sorted(candidates)


def _make_choices(rng: random.Random, correct: str, distractors: list[str]) -> tuple[list[dict], str] | None:
    if len(distractors) < 3:
        return None
    picked = rng.sample(distractors, 3)
    options = [correct] + picked
    rng.shuffle(options)
    ids = ["c1", "c2", "c3", "c4"]
    choices = [{"id": ids[i], "textJp": text} for i, text in enumerate(options)]
    answer_id = ids[options.index(correct)]
    return choices, answer_id


# ── Mondai assembly ──────────────────────────────────────────────
_READING_INSTRUCTIONS_JP = "つぎの　ことばの　読み方として　最も　よい　ものを　1・2・3・4から　一つ　えらんで　ください。"
_ORTHOGRAPHY_INSTRUCTIONS_JP = "つぎの　ことばを　漢字で　書く　とき、最も　よい　ものを　1・2・3・4から　一つ　えらんで　ください。"


def _build_reading_mondai(spec: dict, pool: list[dict], used_words: set, used_prompts: set, rng: random.Random) -> dict:
    questions = []
    for word in pool:
        if len(questions) >= spec["count"]:
            break
        key = (word["kanji"], word["kana"])
        if key in used_words or word["kanji"] in used_prompts:
            continue
        distractors = build_kanji_reading_distractors(word, rng)
        made = _make_choices(rng, word["kana"].split("/")[0].strip(), distractors)
        if made is None:
            continue
        choices, answer_id = made
        used_words.add(key)
        used_prompts.add(word["kanji"])
        questions.append({
            "id": f"{spec['id']}_q{len(questions) + 1}",
            "number": len(questions) + 1,
            "promptJp": word["kanji"],
            "choices": choices,
            "answer": answer_id,
        })

    if len(questions) < spec["count"]:
        raise GenerationFailed(f"{spec['id']}: only found {len(questions)}/{spec['count']} valid reading items")

    return {
        "id": spec["id"],
        "number": spec["official_number"],
        "type": "mcq-text",
        "instructionsJp": _READING_INSTRUCTIONS_JP,
        "instructions": "Choose the best reading (in hiragana) for the word.",
        "questions": questions,
    }


def _build_orthography_mondai(spec: dict, pool: list[dict], used_words: set, used_prompts: set, rng: random.Random) -> dict:
    questions = []
    for word in pool:
        if len(questions) >= spec["count"]:
            break
        key = (word["kanji"], word["kana"])
        reading = word["kana"].split("/")[0].strip()
        if key in used_words or reading in used_prompts:
            continue
        distractors = build_orthography_distractors(word, rng)
        made = _make_choices(rng, word["kanji"], distractors)
        if made is None:
            continue
        choices, answer_id = made
        used_words.add(key)
        used_prompts.add(reading)
        questions.append({
            "id": f"{spec['id']}_q{len(questions) + 1}",
            "number": len(questions) + 1,
            "promptJp": reading,
            "choices": choices,
            "answer": answer_id,
        })

    if len(questions) < spec["count"]:
        raise GenerationFailed(f"{spec['id']}: only found {len(questions)}/{spec['count']} valid orthography items")

    return {
        "id": spec["id"],
        "number": spec["official_number"],
        "type": "mcq-text",
        "instructionsJp": _ORTHOGRAPHY_INSTRUCTIONS_JP,
        "instructions": "Choose the correct kanji spelling for the word.",
        "questions": questions,
    }


def _generate_once(level: str, seed: int) -> dict:
    rng = random.Random(seed)
    blueprint = LEVEL_BLUEPRINT[level]
    vocab_section = next(s for s in blueprint["sections"] if s["id"] in ("vocabulary", "vocabulary_grammar_reading"))

    reading_spec = next((m for m in vocab_section["mondai"] if m["type"] == "kanji-reading"), None)
    ortho_spec = next((m for m in vocab_section["mondai"] if m["type"] == "kanji-orthography"), None)
    # N1 has no 表記 mondai — ortho_spec is None there, matching the
    # real exam rather than inventing a task it doesn't have.

    # A handful of deck entries (8 across the whole deck, e.g. 丸い/円い)
    # record more than one accepted kanji spelling in the same "kanji"
    # field, "/"-separated the same way "kana" sometimes is. Skipped
    # rather than handled: showing "丸い/円い" as a single choice is
    # wrong, and picking one spelling risks a distractor accidentally
    # matching the OTHER accepted one.
    pool = [w for w in VOCAB_BY_LEVEL.get(level, []) if w.get("kanji") and "/" not in w["kanji"]]
    rng.shuffle(pool)

    used_words: set = set()
    used_prompts: set = set()
    mondai = []
    if reading_spec:
        mondai.append(_build_reading_mondai(reading_spec, pool, used_words, used_prompts, rng))
    if ortho_spec:
        mondai.append(_build_orthography_mondai(ortho_spec, pool, used_words, used_prompts, rng))

    # The official timeLimitMin covers the WHOLE vocabulary section
    # (up to 6 mondai at N2) — this paper only contains the 1-2 mondai
    # this generator can build so far. Showing the full official time
    # for a fraction of the section's items would overstate how long
    # it should take (110 min for N1's 6-question paper, when the real
    # N1 vocabulary section has 71 items) — scale it down by the
    # fraction of the section's own item count this paper covers.
    included_items = sum(m["count"] for m in (reading_spec, ortho_spec) if m)
    total_section_items = sum(m["count"] for m in vocab_section["mondai"])
    scaled_time_limit = max(5, round(vocab_section["timeLimitMin"] * included_items / total_section_items))

    return {
        "level": level,
        "title": f"{level} Vocabulary Practice — Kanji Reading & Writing",
        "titleJp": f"{level} 語彙 — 漢字読み・表記",
        "sections": [{
            "id": "vocabulary",
            "label": "Vocabulary",
            "labelJp": "語彙 — 漢字読み・表記",
            "timeLimitMin": scaled_time_limit,
            "mondai": mondai,
        }],
    }


_MAX_GENERATION_ATTEMPTS = 5


def generate_kanji_paper(level: str, seed: int) -> dict:
    last_errors: list[str] = []
    for attempt in range(_MAX_GENERATION_ATTEMPTS):
        try:
            paper = _generate_once(level, seed + attempt)
        except GenerationFailed as e:
            last_errors = [str(e)]
            continue

        all_questions = [q for m in paper["sections"][0]["mondai"] for q in m["questions"]]
        errors = validate_questions(all_questions)
        if not errors:
            return paper
        last_errors = errors

    raise GenerationFailed(
        f"Could not generate a valid {level} kanji paper after {_MAX_GENERATION_ATTEMPTS} attempts: {last_errors}"
    )
