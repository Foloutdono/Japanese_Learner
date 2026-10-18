# ── The choices of a 漢字読み / 表記 item (plan 254) ───────────────────
# exam_kanji_gen.py built these items' wrong choices by editing the right
# one at random: a voicing flipped anywhere, a う added after a verb, a っ
# put in front of any hard consonant. Three things were wrong with what
# came out, and all three are the owner's complaint:
#
#   * strings no Japanese word could be -- ぱじめ, かえっす, さわぐう,
#     きょっくせん, ぢゅうりつ -- eliminated without reading the kanji;
#   * every wrong choice one edit from the right one, so the right one
#     was the choice nearest to the rest (a star): picking it blind won
#     96% of the 漢字読み items; and for 表記, wrong spellings made of
#     kanji drawn from the whole deck, a star again (60%);
#   * words the level has not taught: 町, 窓 and 写真 asked in N5, 曇 and
#     燵 offered in N5 -- a paper shows only the kanji of its level
#     (study/exam_levels.py).
#
# The placement test (study/placement.py) and the Practice gate
# (routes/station.py) still build theirs with exam_kanji_gen: replayed
# from a seed at every answer, the one must not change under a running
# test, and the other draws a specimen. Only the exam papers come here.
#
# What a wrong 読み is, here: the reading as a learner of THIS course
# could say it, built from the readings the course's own words give each
# kanji (another on-reading, the kun-reading of a kanji read as on) and
# from the sound changes a compound makes (voicing, a long vowel, a small
# っ) -- applied where such a change happens and checked to be a string
# Japanese can spell. The set is a 2x2 grid when two independent changes
# exist (せんしゅう / ぜんしゅう / せんしゅ / ぜんしゅ), where every choice
# has two neighbours and one opposite and none is the centre
# (study/exam_tells.py).
import itertools
import re
from functools import lru_cache

from content import kanji_pool_data as _kanji_db
from content.kanji_readings import split_readings
from content.vocab_data import VOCAB_BY_LEVEL
from study import furigana
from study.exam_tells import centre, outlier, structure

_HIRAGANA = re.compile(r"^[ぁ-ゖ]+$")
_I_ROW = frozenset("きぎしじちぢにひびぴみり")
_SMALL_Y = frozenset("ゃゅょ")
_SMALL_V = frozenset("ぁぃぅぇぉゎ")
_GEMINATE_BEFORE = frozenset("かきくけこさしすせそたちつてとぱぴぷぺぽ")
_HANDAKUTEN = frozenset("ぱぴぷぺぽ")

SYMMETRIC = ("none", "clique", "ring", "pairs")

# A word with two kanji is asked with the real paper's 2x2 grid when it
# has one, as a reading is (the best clique of three lookalikes of ONE
# kanji only tests that kanji).
GRID_BONUS = 20.0


def kana_problems(text: str, answer: str = "") -> list[str]:
    """Why `text` could not be the reading of a Japanese word -- [] when
    it could. Conservative: it refuses what no reading is spelled like
    (a っ before や, a ぱ opening a word, a small ゃ after あ), and
    nothing that merely is rare."""
    if not text or not _HIRAGANA.match(text):
        return ["not hiragana"]
    out = []
    if text[0] in "んっ" or text[0] in _SMALL_Y or text[0] in _SMALL_V:
        out.append(f"opens with {text[0]}")
    if text[-1] == "っ":
        out.append("ends in っ")
    for i, c in enumerate(text):
        before = text[i - 1] if i else ""
        after = text[i + 1] if i + 1 < len(text) else ""
        if c == "っ" and after not in _GEMINATE_BEFORE:
            out.append(f"っ before {after or 'the end'}")
        if c == "っ" and before in ("っ", "ん"):
            out.append(f"っ after {before}")
        if c in _SMALL_Y and (before not in _I_ROW or after in _SMALL_Y):
            out.append(f"{c} after {before or 'nothing'}")
        if c in _HANDAKUTEN and before not in ("っ", "ん") and text.count(c) > answer.count(c):
            out.append(f"{c} with no っ or ん before it")
        if c in "ぢづ" and c not in answer:
            out.append(f"{c} where the word has none")
        if c == "ん" and before == "ん":
            out.append("んん")
        if i >= 2 and text[i - 2] == text[i - 1] == c:
            out.append("three of a kind")
    return out


# ── What the course gives each kanji ────────────────────────────────
def _is_kanji(c: str) -> bool:
    return "一" <= c <= "龯"


@lru_cache(maxsize=None)
def _packed(char: str) -> tuple[list[str], list[str]]:
    packed = _kanji_db.packed_readings_for([char]).get(char, "")
    split = split_readings(packed) if packed else {"on": [], "kun": []}
    return split["on"], split["kun"]


@lru_cache(maxsize=1)
def course_readings() -> dict[str, dict[str, int]]:
    """kanji -> {reading token: how many deck words read it so}, from
    aligning every kanji word of the deck (study/furigana.py). A reading
    no word of the course uses is one the learner has not met, so it
    is not a plausible slip."""
    used: dict[str, dict[str, int]] = {}
    for words in VOCAB_BY_LEVEL.values():
        for w in words:
            kanji = w.get("kanji") or ""
            reading = (w.get("kana") or "").split("/")[0].strip()
            if not kanji or "/" in kanji or not reading:
                continue
            for i, seg in enumerate(furigana.align_deck(kanji, reading)):
                if "reading" not in seg or len(seg["text"]) != 1:
                    continue
                on, kun = _packed(seg["text"])
                token = furigana.reading_token_for(seg["reading"], on + kun, i == 0)
                if token:
                    used.setdefault(seg["text"], {}).setdefault(token, 0)
                    used[seg["text"]][token] += 1
    return used


@lru_cache(maxsize=None)
def readings_of_spelling(kanji: str) -> frozenset[str]:
    """Every reading the deck or the dictionary gives this exact spelling:
    a wrong choice may not be one of them (明日 is あした and あす)."""
    from content import vocab_jmdict_data as jmdict

    found = set()
    for words in VOCAB_BY_LEVEL.values():
        for w in words:
            if w.get("kanji") == kanji:
                found.update(r.strip() for r in (w.get("kana") or "").split("/") if r.strip())
    for entry in jmdict.by_kanji(kanji, 50):
        found.add(entry["kana"])
    return frozenset(found)


# ── The slips a reading admits ───────────────────────────────────────
_VOICED = {
    "か": "が", "き": "ぎ", "く": "ぐ", "け": "げ", "こ": "ご",
    "さ": "ざ", "し": "じ", "す": "ず", "せ": "ぜ", "そ": "ぞ",
    "た": "だ", "ち": "じ", "つ": "ず", "て": "で", "と": "ど",
    "は": "ば", "ひ": "び", "ふ": "ぶ", "へ": "べ", "ほ": "ぼ",
}
_UNVOICED = {"が": "か", "ぎ": "き", "ぐ": "く", "げ": "け", "ご": "こ", "ざ": "さ", "じ": "し", "ず": "す",
             "ぜ": "せ", "ぞ": "そ", "だ": "た", "で": "て", "ど": "と", "ば": "は", "び": "ひ", "ぶ": "ふ",
             "べ": "へ", "ぼ": "ほ"}
# A short on-reading that the long one is the real spelling of (こ / こう,
# しゅ / しゅう, け / けい), by what it ends in.
_LENGTHEN_O = frozenset("おこそとのほもよろごぞどぼょ")
_LENGTHEN_U = frozenset("ゅゆふす")
_LENGTHEN_E = frozenset("えけせてねへめれげぜでべ")


class Edit:
    """One slip in one kanji's slot of a reading."""
    __slots__ = ("slot", "text", "kind", "weight")

    def __init__(self, slot: int, text: str, kind: str, weight: float):
        self.slot, self.text, self.kind, self.weight = slot, text, kind, weight


def slots(kanji: str, reading: str) -> list[dict] | None:
    """The word divided over its kanji -- [{"text", "reading", "kanji"}] --
    or None when it will not divide (今年 ことし, 時計 とけい: a reading
    that belongs to the whole word has no slip to make a slot of)."""
    out = []
    for seg in furigana.align_deck(kanji, reading):
        if "reading" not in seg:
            out.append({"text": seg["text"], "reading": seg["text"], "kanji": False})
        elif len(seg["text"]) == 1 and _is_kanji(seg["text"]):
            out.append({"text": seg["text"], "reading": seg["reading"], "kanji": True})
        else:
            return None
    return out or None


def reading_edits(parts: list[dict]) -> list[Edit]:
    """Every slip a learner could make in one kanji's slot of the word."""
    used = course_readings()
    first = next(i for i, p in enumerate(parts) if p["kanji"])
    out: list[Edit] = []
    for i, p in enumerate(parts):
        if not p["kanji"]:
            continue
        c, r = p["text"], p["reading"]
        on, kun = _packed(c)
        current = furigana.reading_token_for(r, on + kun, i == 0)
        is_on = current in on
        # another reading of the same kanji. The course's own words give a
        # kanji its readings (1.0 to 0.5); a kanji it shows once has none to
        # swap, so the dictionary's other readings stand in (0.5).
        following = parts[i + 1] if i + 1 < len(parts) else None
        okurigana = following["text"] if following and not following["kanji"] else ""
        tokens = [(t, 1.0) for t in used.get(c, {})] or [(t, 0.5) for t in on + kun]
        for token, rank in tokens:
            if token == current or token[:1] in "-~":
                continue
            base = furigana.reading_stem(token).replace("-", "")
            if not base or base == r:
                continue
            same = (token in on) == is_on
            # a kun reading is a stem: it takes the okurigana the word has
            if token not in on and okurigana and not token.split(".", 1)[-1].startswith(okurigana[:1]):
                continue
            if not same and (is_on or len(base) < 2):
                continue            # a kun stem of one kana in an on-compound is no reading anyone would try
            if r[:1] in _VOICED.values() and base[:1] in _VOICED and i > first:
                base = _VOICED[base[0]] + base[1:]
            if r.endswith("っ") and base[-1:] in "つちくき" and len(base) > 1:
                base = base[:-1] + "っ"
            out.append(Edit(i, base, "alt", rank if same else 0.5))
        # a long vowel dropped or added, in an on-reading
        if current in on:
            if r.endswith("う") and len(r) >= 2 and (r[-2] in _LENGTHEN_O or r[-2] in _LENGTHEN_U):
                out.append(Edit(i, r[:-1], "len", 0.8))
            elif r.endswith("い") and len(r) >= 2 and r[-2] in _LENGTHEN_E:
                out.append(Edit(i, r[:-1], "len", 0.7))
            elif r[-1] in _LENGTHEN_O | _LENGTHEN_U and not r.endswith("っ"):
                out.append(Edit(i, r + "う", "len", 0.8))
            elif r[-1] in _LENGTHEN_E:
                out.append(Edit(i, r + "い", "len", 0.7))
        if "おお" in r:
            out.append(Edit(i, r.replace("おお", "おう", 1), "len", 0.6))
        # the sound change of a compound, done or undone: voicing at the
        # seam, or at the head of a word that opens on an on-reading
        head = r[:1]
        if i > first or current in on:
            if head in _VOICED:
                out.append(Edit(i, _VOICED[head] + r[1:], "voice", 0.8 if i > first else 0.6))
            if head in _UNVOICED:
                out.append(Edit(i, _UNVOICED[head] + r[1:], "voice", 0.8 if i > first else 0.6))
        # the small っ of 学校 / 国会, done or undone, where the next kanji is hard
        nxt = parts[i + 1] if i + 1 < len(parts) else None
        if nxt and nxt["kanji"] and nxt["reading"][:1] in _GEMINATE_BEFORE and current in on:
            if r.endswith("っ"):
                for token in on:
                    base = furigana.reading_stem(token).replace("-", "")
                    if len(base) > 1 and base[:-1] == r[:-1] and base[-1] in "つちくき":
                        out.append(Edit(i, base, "gem", 0.8))
            elif r[-1] in "つちくき" and len(r) >= 2:
                out.append(Edit(i, r[:-1] + "っ", "gem", 0.8))
    return out


# ── Words that sound like it ───────────────────────────────────────────
# The wrong reading a learner is most likely to choose is another word they
# know: 返す for かえる, 窓 for まど / 町 for まち / 的 for まと. The course's
# own words one kana away from the right reading, at the paper's level or
# below, are those.
_KANA = [chr(c) for c in range(0x3041, 0x3094)] + ["ー"]


@lru_cache(maxsize=1)
def _deck_by_reading() -> dict[str, tuple[str, str]]:
    """reading -> (easiest level that has a word read so, its spelling)."""
    out: dict[str, tuple[str, str]] = {}
    for level in ("N5", "N4", "N3", "N2", "N1"):
        for w in VOCAB_BY_LEVEL.get(level, []):
            for r in (w.get("kana") or "").split("/"):
                r = r.strip()
                if r and _HIRAGANA.match(r) and r not in out:
                    out[r] = (level, w.get("kanji") or r)
    return out


def sound_alikes(reading: str, level: str) -> list[str]:
    """Deck words read one kana away from `reading` (one changed, added or
    dropped), taught at `level` or earlier."""
    deck = _deck_by_reading()
    order = ("N5", "N4", "N3", "N2", "N1")
    limit = order.index(level)
    found = set()
    for i in range(len(reading) + 1):
        if i < len(reading):
            found.add(reading[:i] + reading[i + 1:])
            for k in _KANA:
                found.add(reading[:i] + k + reading[i + 1:])
        for k in _KANA:
            found.add(reading[:i] + k + reading[i:])
    out = []
    for cand in sorted(found):
        hit = deck.get(cand)
        if cand != reading and hit and order.index(hit[0]) <= limit and len(cand) >= 2:
            out.append(cand)
    return out


def other_endings(parts: list[dict], kanji: str, reading: str, level: str = "N1") -> list[str]:
    """The same kanji with another of its okurigana, where that is a word
    (返す -> かえる, 受ける -> うかる, 分かる -> わかれる, わける): the wrong
    reading a learner who knows the kanji, but not this word, would give."""
    if len(parts) < 2 or parts[-1]["kanji"] or not parts[-2]["kanji"] or any(p["kanji"] for p in parts[:-2]):
        return []
    order = ("N5", "N4", "N3", "N2", "N1")
    last = parts[-2]
    _on, kun = _packed(last["text"])
    head = "".join(p["reading"] for p in parts[:-2])
    deck = _deck_by_reading()
    out = []
    for token in kun:
        if "." not in token or token[:1] in "-~":
            continue
        stem, okurigana = token.replace("~", "").split(".", 1)
        if okurigana == parts[-1]["text"] or not okurigana or not stem:
            continue
        text = head + stem + okurigana
        # a word the course teaches by this level: a learner has met it
        if text != reading and text in deck and order.index(deck[text][0]) <= order.index(level):
            out.append(text)
    return out


def _apply(parts: list[dict], *edits: Edit) -> str:
    texts = {e.slot: e.text for e in edits}
    return "".join(texts.get(i, p["reading"]) for i, p in enumerate(parts))


def _symmetric(choices: list[str], answer: int = 0) -> bool:
    return structure(choices) in SYMMETRIC and answer not in (centre(choices), outlier(choices))


def reading_sets(kanji: str, reading: str, level: str = "N1") -> list[tuple[float, list[str]]]:
    """(weight, three wrong readings) for every way to make a symmetric
    set of choices from the word's slips, best first: a 2x2 grid of two
    independent slips where there are two, otherwise three slips whose set
    comes out symmetric (study/exam_tells.py)."""
    parts = slots(kanji, reading)
    if parts is None:
        return []
    valid = readings_of_spelling(kanji)
    edits = reading_edits(parts)

    def ok(text: str) -> bool:
        return text != reading and text not in valid and not kana_problems(text, reading)

    singles: dict[str, Edit] = {}
    for e in edits:
        text = _apply(parts, e)
        if ok(text) and (text not in singles or singles[text].weight < e.weight):
            singles[text] = e
    sets: list[tuple[float, list[str]]] = []
    # grids: two slips in different slots, and both together
    top = sorted(singles.items(), key=lambda kv: (-kv[1].weight, kv[0]))[:14]
    for a, b in itertools.combinations(sorted(top), 2):
        (ta, ea), (tb, eb) = a, b
        if ea.slot == eb.slot:
            continue
        both = _apply(parts, ea, eb)
        if ok(both) and len({ta, tb, both, reading}) == 4:
            choices = [reading, ta, tb, both]
            if _symmetric(choices):
                sets.append((ea.weight + eb.weight + 0.3, [ta, tb, both]))
    # three single slips, the kanji's other endings, and the words that sound like it
    pool = dict(singles)
    for text in other_endings(parts, kanji, reading, level):
        if ok(text):
            pool[text] = Edit(-1, text, "ending", 1.1)
    for text in sound_alikes(reading, level):
        if ok(text) and text not in pool:
            pool[text] = Edit(-1, text, "near", 0.9)
    # the best dozen only: the triples of a long list are all alike
    best = sorted(pool.items(), key=lambda kv: (-kv[1].weight, kv[0]))[:12]
    for trio in itertools.combinations(sorted(best), 3):
        choices = [reading] + [t for t, _ in trio]
        if _symmetric(choices):
            sets.append((sum(e.weight for _, e in trio), [t for t, _ in trio]))
    sets.sort(key=lambda s: (-s[0], s[1]))
    return sets


# ── 表記: the kanji that look like it ─────────────────────────────────
# A wrong spelling is the right one with a kanji changed for another that
# looks like it and that this level has been taught -- never a kanji the
# learner has not met, which gives the right one away by being the only
# one they know. "Looks like": the curated lookalike sets
# (frontend/carousel/content/lookalikes.json), the four-corner and SKIP
# codes KANJIDIC2 gives every character, the radical and the stroke count;
# and a kanji with the same on-reading, the other way a spelling is
# mistaken.
@lru_cache(maxsize=1)
def _lookalike_sets() -> dict[str, tuple[str, ...]]:
    import json
    from pathlib import Path

    path = Path(__file__).resolve().parents[2] / "frontend" / "carousel" / "content" / "lookalikes.json"
    mates: dict[str, list[str]] = {}
    if path.exists():
        for group in json.loads(path.read_text(encoding="utf-8")):
            chars = [c["c"] for c in group["chars"]]
            for c in chars:
                mates.setdefault(c, []).extend(x for x in chars if x != c)
    return {c: tuple(v) for c, v in mates.items()}


@lru_cache(maxsize=None)
def _shape(char: str) -> tuple[int | None, int | None, tuple[str, ...], str, frozenset[str]]:
    """(radical, strokes, four-corner codes, skip, on-readings) of a kanji."""
    import json
    import sqlite3

    row = _kanji_db._conn().execute(
        "SELECT k.radical, k.stroke_count, k.on_readings, r.query_codes FROM kanji k "
        "LEFT JOIN kanji_refs r ON r.char = k.char WHERE k.char = ?", (char,)).fetchone()
    if not row:
        return None, None, (), "", frozenset()
    codes = json.loads(row[3]) if row[3] else {}
    corners = codes.get("four_corner") or []
    corners = tuple([corners] if isinstance(corners, str) else corners)
    skip = codes.get("skip") or ""
    skip = skip[0] if isinstance(skip, list) and skip else (skip if isinstance(skip, str) else "")
    return row[0], row[1], corners, skip, frozenset(p for p in (row[2] or "").split("・") if p)


def lookalike_score(a: str, b: str) -> float:
    """How alike two kanji look: 0 for nothing, 6 and over for the curated
    sets' own."""
    if a == b:
        return 0.0
    score = 0.0
    if b in _lookalike_sets().get(a, ()):
        score += 6.0
    ra, sa, ca, ka, oa = _shape(a)
    rb, sb, cb, kb, ob = _shape(b)
    if ra is None or rb is None:
        return score
    best = 0
    for x in ca:
        for y in cb:
            best = max(best, sum(1 for p, q in zip(x[:4], y[:4]) if p == q))
    score += {4: 3.0, 3: 1.6, 2: 0.4}.get(best, 0.0)
    if ka and kb and ka.split("-")[0] == kb.split("-")[0]:
        score += 0.4
    if ra == rb:
        score += 1.2
    if sa is not None and sb is not None:
        score += max(0.0, 1.0 - 0.3 * abs(sa - sb))
    if oa & ob:
        score += 1.2
    return score


def lookalikes(char: str, level: str, count: int = 8) -> list[str]:
    """The kanji of `level` (cumulative) that look most like `char`."""
    from study.llm_shared import kanji_set_for_level

    pool = [c for c in sorted(kanji_set_for_level(level)) if c != char]
    ranked = sorted(((lookalike_score(char, c), c) for c in pool), key=lambda t: (-t[0], t[1]))
    return [c for score, c in ranked if score >= 1.0][:count]


def lookalike_ranking(char: str, level: str, count: int = 8) -> list[tuple[float, str]]:
    """(score, kanji) for the kanji of `level` that look most like `char`."""
    from study.llm_shared import kanji_set_for_level

    pool = [c for c in sorted(kanji_set_for_level(level)) if c != char]
    ranked = sorted(((lookalike_score(char, c), c) for c in pool), key=lambda t: (-t[0], t[1]))
    return [(score, c) for score, c in ranked if score >= 0.3][:count]


@lru_cache(maxsize=None)
def spellings_read(reading: str) -> frozenset[str]:
    """Every spelling, in the deck or the dictionary, that is read `reading`:
    a wrong spelling may not be one (かう is 買う and 飼う)."""
    from content import vocab_jmdict_data as jmdict

    found = set()
    for words in VOCAB_BY_LEVEL.values():
        for w in words:
            if reading in {r.strip() for r in (w.get("kana") or "").split("/")} and w.get("kanji"):
                found.update(w["kanji"].split("/"))
    for entry in jmdict.by_kana(reading, 60):
        if entry.get("kanji"):
            found.add(entry["kanji"])
    return frozenset(found)


def orthography_sets(kanji: str, reading: str, level: str) -> list[tuple[float, list[str]]]:
    """(weight, three wrong spellings), best first: a 2x2 grid over two of
    the word's kanji where it has two, otherwise three lookalikes of one."""
    slots = [i for i, c in enumerate(kanji) if _is_kanji(c)]
    if not slots:
        return []
    near = {i: lookalike_ranking(kanji[i], level, 5) for i in slots}
    taken = spellings_read(reading) | {kanji}

    def spell(**changes) -> str:
        chars = list(kanji)
        for i, c in changes.items():
            chars[int(i[1:])] = c
        return "".join(chars)

    sets: list[tuple[float, list[str]]] = []
    for i, j in itertools.combinations(slots, 2):
        for (sa, a), (sb, b) in itertools.product(near[i][:3], near[j][:3]):
            one, two, both = spell(**{f"s{i}": a}), spell(**{f"s{j}": b}), spell(**{f"s{i}": a, f"s{j}": b})
            wrong = [one, two, both]
            if len(set(wrong)) == 3 and not taken & set(wrong) and _symmetric([kanji] + wrong):
                sets.append((GRID_BONUS + sa + sb, wrong))
    for i in slots:
        for trio in itertools.combinations(near[i], 3):
            wrong = [spell(**{f"s{i}": c}) for _, c in trio]
            if len(set(wrong)) == 3 and not taken & set(wrong) and _symmetric([kanji] + wrong):
                sets.append((sum(sc for sc, _ in trio), wrong))
    sets.sort(key=lambda t: (-t[0], t[1]))
    return sets


# ── What a finished item must satisfy (the seed gate reads these) ─────
def reading_item_problems(kanji: str, choices: list[str], answer: int) -> list[str]:
    """Why a 漢字読み item is not fit to ask -- [] when it is."""
    out = []
    right = choices[answer]
    valid = readings_of_spelling(kanji)
    for i, text in enumerate(choices):
        if i == answer:
            continue
        for why in kana_problems(text, right):
            out.append(f"{text!r} is no reading: {why}")
        if text in valid:
            out.append(f"{text!r} is also a reading of {kanji}")
    return out


def orthography_item_problems(reading: str, choices: list[str], answer: int) -> list[str]:
    """Why a 表記 item is not fit to ask -- [] when it is."""
    taken = spellings_read(reading)
    return [f"{text!r} is also a spelling read {reading}" for i, text in enumerate(choices) if i != answer and text in taken]


# ── The mondai ─────────────────────────────────────────────────────────
READING_INSTRUCTIONS_JP = "つぎの　ことばの　読み方として　最も　よい　ものを　1・2・3・4から　一つ　えらんで　ください。"
ORTHOGRAPHY_INSTRUCTIONS_JP = "つぎの　ことばを　漢字で　書く　とき、最も　よい　ものを　1・2・3・4から　一つ　えらんで　ください。"


@lru_cache(maxsize=None)
def _deck_readings_by_spelling(level: str) -> dict[str, frozenset[str]]:
    """spelling -> the readings the course gives it up to `level`: a
    spelling with two (一月 ひとつき / いちがつ, 下 した / しも / げ) cannot be
    asked alone, for the learner has met both."""
    order = ("N5", "N4", "N3", "N2", "N1")
    out: dict[str, set[str]] = {}
    for lv in order[: order.index(level) + 1]:
        for w in VOCAB_BY_LEVEL.get(lv, []):
            if w.get("kanji"):
                out.setdefault(w["kanji"], set()).update(r.strip() for r in (w.get("kana") or "").split("/") if r.strip())
    return {k: frozenset(v) for k, v in out.items()}


def askable(word: dict, level: str) -> bool:
    """A word a paper at `level` may ask about: written only with the kanji
    the level has been taught, one reading, and a spelling the course
    reads one way."""
    from study.llm_shared import kanji_set_for_level

    allowed = kanji_set_for_level(level)
    kanji = word.get("kanji") or ""
    return bool(kanji) and "/" not in kanji and "/" not in (word.get("kana") or "") and all(
        not _is_kanji(c) or c in allowed for c in kanji) and "々" not in kanji \
        and len(_deck_readings_by_spelling(level).get(kanji, ())) <= 1


def _choices(rng, right: str, wrong: list[str]) -> tuple[list[dict], str]:
    options = [right] + list(wrong)
    rng.shuffle(options)
    ids = ["c1", "c2", "c3", "c4"]
    return [{"id": ids[i], "textJp": t} for i, t in enumerate(options)], ids[options.index(right)]


def _mondai(spec: dict, instructions_jp: str, instructions: str, questions: list[dict]) -> dict:
    return {"id": spec["id"], "number": spec["official_number"], "type": "mcq-text",
            "instructionsJp": instructions_jp, "instructions": instructions, "questions": questions}


def _build(spec, pool, used_words, used_prompts, rng, level, sets_for, prompt_of, right_of, instructions):
    from study.exam_gen_utils import GenerationFailed

    questions = []
    for word in pool:
        if len(questions) >= spec["count"]:
            break
        key = (word["kanji"], word["kana"])
        prompt = prompt_of(word)
        if key in used_words or prompt in used_prompts or not askable(word, level):
            continue
        sets = sets_for(word, level)
        if not sets:
            continue
        # one of the best few, so that papers do not all share one shape
        top = [s for s in sets if s[0] >= sets[0][0] - 0.5][:4]
        wrong = top[rng.randrange(len(top))][1]
        choices, answer = _choices(rng, right_of(word), wrong)
        used_words.add(key)
        used_prompts.add(prompt)
        questions.append({"id": f"{spec['id']}_q{len(questions) + 1}", "number": len(questions) + 1,
                          "promptJp": prompt, "choices": choices, "answer": answer})
    if len(questions) < spec["count"]:
        raise GenerationFailed(f"{spec['id']}: only found {len(questions)}/{spec['count']} {instructions} items")
    return questions


def _first_reading(word: dict) -> str:
    return (word.get("kana") or "").split("/")[0].strip()


def build_reading_mondai(spec, pool, used_words, used_prompts, rng, level) -> dict:
    questions = _build(spec, pool, used_words, used_prompts, rng, level,
                       lambda w, lv: reading_sets(w["kanji"], _first_reading(w), lv),
                       lambda w: w["kanji"], _first_reading, "reading")
    return _mondai(spec, READING_INSTRUCTIONS_JP, "Choose the best reading (in hiragana) for the word.", questions)


def build_orthography_mondai(spec, pool, used_words, used_prompts, rng, level) -> dict:
    questions = _build(spec, pool, used_words, used_prompts, rng, level,
                       lambda w, lv: orthography_sets(w["kanji"], _first_reading(w), lv),
                       _first_reading, lambda w: w["kanji"], "orthography")
    return _mondai(spec, ORTHOGRAPHY_INSTRUCTIONS_JP, "Choose the correct kanji spelling for the word.", questions)
