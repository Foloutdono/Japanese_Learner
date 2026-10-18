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
import random
import re

import content.kanji_pool_data as _kanji_db
import content.vocab_jmdict_data as _jmdict
from content.vocab_data import VOCAB_BY_LEVEL
from study.exam_gen_utils import GenerationFailed, make_choices


# ── Reverse indexes, built once at import ──────────────────────
def _deck_kanji_chars() -> set[str]:
    chars = set()
    for entries in VOCAB_BY_LEVEL.values():
        for w in entries:
            chars.update(w.get("kanji") or "")
    return chars


_DECK_CHARS = _deck_kanji_chars()

# MEMORY NOTE (2026-09): these two used to be json.load()s of
# kanji_readings.json (3.0 MB, 12,760 characters) and kanji_radicals.json
# (0.76 MB, 13,108) — the third copy of the latter in the process. Every
# use below is a lookup for a character in _DECK_CHARS, ~2,180 of them, so
# the other eleven thousand rows were parsed at import to be ignored.
# Two bounded queries against datas/kanji/kanji.sqlite3 instead; the
# distractors that come out are identical.
KANJI_READINGS: dict[str, dict] = _kanji_db.readings_for(_DECK_CHARS)
KANJI_RADICALS: dict[str, dict] = _kanji_db.radicals_for(_DECK_CHARS)


def _build_radical_index() -> dict[int, list[str]]:
    # Restricted to characters that actually appear in the app's own
    # vocab deck, not the full ~13k KANJIDIC2 set — a 表記 distractor
    # should look like a character the learner could plausibly
    # confuse the right one for, not an obscure character they've
    # never seen.
    #
    # In code-point order: _DECK_CHARS is a set, whose order changes with
    # every process's string hashing, and a radical's list is shuffled by
    # the caller's seeded random -- so in set order the same seed drew
    # other distractors after a restart, and the placement test, which
    # rebuilds its questions from the seed at every answer, could grade
    # an answer against a paper the learner was never shown (plan 224), nor
    # a seed paper (plan 228) be replayed into the same questions.
    index: dict[int, list[str]] = {}
    for char in sorted(_DECK_CHARS):
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


def _build_spelling_to_readings() -> dict[str, set[str]]:
    # The other way round: spelling -> every reading the deck gives it.
    # A bare-word prompt has no sentence to choose between them, so none
    # of them may be a wrong choice (上 is うえ at N5 and うわ, かみ,
    # じょう at N3; plan 247).
    index: dict[str, set[str]] = {}
    for reading, spellings in READING_TO_SPELLINGS.items():
        for kanji in spellings:
            index.setdefault(kanji, set()).add(reading)
    return index


SPELLING_TO_READINGS = _build_spelling_to_readings()


def _readings_of(written: str) -> set[str]:
    """Every reading of the word written `written`: the deck's, and the
    JMdict pool's rows written exactly that way (二 is ふた there, 角
    すみ and すま) -- a reading the course does not teach is still a
    right answer to "read this word"."""
    readings = set(SPELLING_TO_READINGS.get(written, set()))
    readings.update(_kata_to_hira(e["kana"]) for e in _jmdict.by_kanji(written, limit=40))
    return readings


_KATAKANA_RANGE = ("ァ", "ヶ")
_KATA_TO_HIRA_SHIFT = 0x60


def _kata_to_hira(s: str) -> str:
    lo, hi = _KATAKANA_RANGE
    return "".join(chr(ord(c) - _KATA_TO_HIRA_SHIFT) if lo <= c <= hi else c for c in s)


def _strip_okurigana(reading: str) -> str:
    # KANJIDIC2 kun-readings mark the okurigana boundary with a dot
    # (つ.ぐ) — the part before the dot is the kanji's own reading.
    # They also mark a prefix or suffix use with a hyphen (-うえ, うわ-),
    # which is notation, not kana: left on, it reached a paper as a
    # choice nobody could mistake for a reading.
    return _kata_to_hira(reading.split(".")[0].strip("-"))


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
            # After っ only a k/s/t/p consonant can stand: しっけ voiced
            # to しっげ, or しゅっちょう to しゅっぢょう, is a string no
            # Japanese word spells. Nor is ぢ or づ voiced out of ち, つ:
            # いぢだんと, らいげづ look like no reading (plan 247).
            if i > 0 and moras[i - 1] == "っ" and variant[0] not in _GEMINATABLE_STARTS:
                continue
            if variant[0] in "ぢづ":
                continue
            perturbed = moras.copy()
            perturbed[i] = variant
            out.append("".join(perturbed))
    return out


# Crude but workable: mora endings a trailing う turns into the long
# vowel of an on-reading (こ/こう, と/とう). Good enough to reproduce
# the pattern this generator is built around; not a full model of
# Japanese vowel length. A contracted mora (しゅ, きょ) ends in its
# small kana, so ゅ/ょ are here too: せんしゅ -> せんしゅう is the pair
# this generator is named for. A plain u-column mora is not: no reading
# lengthens げつ or す, and らいげつう, だすう reached papers as choices
# nobody could take for a reading (plan 247).
_LENGTHENED_BY_U = set("おこそとのほもよろごぞどぼぽゅょ")


def _toggle_long_vowel(reading: str) -> list[str]:
    moras = _moras(reading)
    # Only drop a trailing う if at least 2 moras remain — otherwise a
    # 2-mora word like かう (飼う) degenerates to the single mora "か",
    # which isn't a plausible near-miss, just a fragment.
    if reading.endswith("う"):
        # A short word ending in う is not lengthened either: あう -> あうう
        # is no more a near-miss than the fragment would be.
        return [reading[:-1]] if len(moras) >= 3 else []
    if moras and moras[-1][-1] in _LENGTHENED_BY_U:
        return [reading + "う"]
    return []


# k/s/t/p rows are the consonants that plausibly geminate (っ) in real
# words (がっこう, きって) — the other rows essentially don't.
_GEMINATABLE_STARTS = set("かきくけこさしすせそたちつてとぱぴぷぺぽ")
_BARE_VOWELS = set("あいうえお")


def _toggle_geminate(reading: str) -> list[str]:
    moras = _moras(reading)
    out = []
    for i, m in enumerate(moras):
        if m == "っ":
            out.append("".join(moras[:i] + moras[i + 1:]))
    # i > 0 only — っ never opens a real Japanese word, so inserting
    # one before the first mora would produce an unpronounceable
    # "distractor" rather than a plausible near-miss. Nor does it
    # follow ん, or a bare vowel past the first mora (the う of とう,
    # the い of かい): だんっかい, かいっしゃ spell no word (plan 247).
    for i, m in enumerate(moras):
        if i == 0 or not m or m[0] not in _GEMINATABLE_STARTS:
            continue
        before = moras[i - 1]
        if before in ("っ", "ん") or (i > 1 and before in _BARE_VOWELS):
            continue
        out.append("".join(moras[:i] + ["っ"] + moras[i:]))
    return out


def _fits_written(candidate: str, written: str) -> bool:
    """Whether `candidate` keeps the kana `written` shows. The okurigana
    of 食べる or 出す, the お of お茶, are printed in the prompt, so a
    choice that changes them (たべるう, だず) is struck by eye (plan
    247)."""
    parts = _collapse_kanji(written)
    # A kanji's reading never ends in an unwritten っ before its
    # okurigana (だっす for 出す): the っ would be printed, as in 真っ白.
    pattern = "".join(
        ("(?:.*[^っ])" if i + 1 < len(parts) else "(?:.+)") if ch == "*" else re.escape(_kata_to_hira(ch))
        for i, ch in enumerate(parts)
    )
    return re.fullmatch(pattern, _kata_to_hira(candidate)) is not None


def _is_kana(ch: str) -> bool:
    # ヵ and ヶ are counters read か/が/こ, so they belong to the kanji run.
    return ("ぁ" <= ch <= "ゖ" or "ァ" <= ch <= "ヴ" or ch == "ー") and ch not in "ヵヶ"


def _collapse_kanji(written: str) -> list[str]:
    # A run of kanji (and 々) reads as one span of any length.
    out: list[str] = []
    for ch in written:
        if not _is_kana(ch) and out and out[-1] == "*":
            continue
        out.append(ch if _is_kana(ch) else "*")
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
            # The stem of a reading that takes okurigana (あ.げる) is no
            # reading of the bare character: 上 offered あ, のぼ. An affix
            # reading (-べ of 海辺, うわ- of 上着) is the character's own
            # in a word the learner may know, so a right answer to a bare
            # prompt (plan 247).
            if "." in alt or "-" in alt:
                continue
            # Nor is a loanword KANJIDIC spells with the character (米
            # メエトル): an on-reading runs to three kana at most.
            if alt in info.get("ja_on", []) and len(alt) > 3:
                continue
            stripped = _strip_okurigana(alt)
            if stripped:
                candidates.add(stripped)

    candidates -= own_readings
    if kanji:
        # A reading the word itself has is a right answer to a bare
        # prompt, whichever the deck keys (plan 247).
        candidates -= _readings_of(kanji)
        if _fits_written(correct, kanji):
            candidates = {c for c in candidates if _fits_written(c, kanji)}
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


# ── Mondai assembly ──────────────────────────────────────────────
_READING_INSTRUCTIONS_JP = "つぎの　ことばの　読み方として　最も　よい　ものを　1・2・3・4から　一つ　えらんで　ください。"
_ORTHOGRAPHY_INSTRUCTIONS_JP = "つぎの　ことばを　漢字で　書く　とき、最も　よい　ものを　1・2・3・4から　一つ　えらんで　ください。"


def _one_spelling(word: dict) -> bool:
    kanji = word.get("kanji") or ""
    return bool(kanji) and "/" not in kanji


def build_reading_mondai(spec: dict, pool: list[dict], used_words: set, used_prompts: set, rng: random.Random) -> dict:
    questions = []
    for word in pool:
        if len(questions) >= spec["count"]:
            break
        # A word with no written form, or with two (丸い/円い), has no
        # prompt to print: the placement's pool is the whole level.
        if not _one_spelling(word):
            continue
        key = (word["kanji"], word["kana"])
        if key in used_words or word["kanji"] in used_prompts:
            continue
        distractors = build_kanji_reading_distractors(word, rng)
        made = make_choices(rng, word["kana"].split("/")[0].strip(), distractors)
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


def build_orthography_mondai(spec: dict, pool: list[dict], used_words: set, used_prompts: set, rng: random.Random) -> dict:
    questions = []
    for word in pool:
        if len(questions) >= spec["count"]:
            break
        if not _one_spelling(word):
            continue
        key = (word["kanji"], word["kana"])
        reading = word["kana"].split("/")[0].strip()
        if key in used_words or reading in used_prompts:
            continue
        distractors = build_orthography_distractors(word, rng)
        made = make_choices(rng, word["kanji"], distractors)
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


# Paper-level orchestration (which mondai go in a paper, the
# retry-on-validation-failure loop, the section's scaled time limit)
# lives in exam_vocab_gen.py now — this module stopped being
# kanji-only content once 文脈規定/言い換え類義/用法 needed the SAME
# "vocabulary" section, so it's the section-level orchestrator for all
# of them. build_reading_mondai/build_orthography_mondai above are
# what it calls into.
