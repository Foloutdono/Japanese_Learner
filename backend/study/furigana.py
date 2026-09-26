"""
Furigana placed over the kanji it belongs to.

A vocab entry stores one flat reading for the whole word -- 食べる is
"たべる", 大学 is "だいがく" -- so the naive rendering puts the entire
reading over the entire word. That is wrong twice over: it repeats kana
the word already writes (べる appears above AND below), and for a compound
it gives one blanket label where a learner needs to see that だい belongs
to 大 and がく to 学.

The frontend already splits on KANA ANCHORS: okurigana and particles are
identical in the text and the reading, so they pin the slices around them.
What it could not do is split a run of several kanji, and its own comment
says why -- "no reliable way to say where だい ends and がく begins without
per-kanji data we don't have". That data does exist now
(content/kanji_readings.py), so this does the split here and ships the
result, and the frontend renders rather than guesses.

── What makes it hard ────────────────────────────────────────
A kanji's reading inside a compound is not always its citation form:

  rendaku   the second element voices its first mora -- ひと + ひと is
            not ひとひと; 人々 is ひとびと
  gemination a final つ/ち becomes っ before a hard consonant --
            がく + こう is がっこう, not がくこう
  script    the deck writes on-readings in katakana (ダイ) and they
            appear in a word's reading as hiragana (だい)

All three are tried. Anything that still does not segment cleanly keeps
the whole-run reading rather than being guessed at: a wrong furigana is
worse than a coarse one, because the learner cannot tell it is wrong.

── A second, looser pass ─────────────────────────────────────
Two shapes the strict pass does not know, tried only on a run it could
not divide, so no word it already divides can come out differently:

  okurigana   a kun reading's okurigana taken into the kanji -- 売上 is
  absorbed    う(り)+あげ, 戸締り is と+じま+り: う.る and あ.げる and
              し.まる, written without the kana they usually carry
  じ and ず   modern spelling writes a voiced ち/つ as じ/ず once the
              compound is felt as one word -- 世界中 せかいじゅう,
              融通 ゆうずう -- where rendaku alone gives ぢ/づ

── What else stood in the way ────────────────────────────────
A word could fail for reasons that are not about readings at all, and
the dictionary's word rows showed it: the kanji a row is an example of
is picked out only where it has a part of its own. So:

  々          repeats the kanji before it and takes its readings (時々
              とき|どき); it is not a kanji to look up, but it belongs
              inside a kanji run rather than being a kana anchor that
              never appears in the reading
  する        the deck packed a suru-verb's する into its readings
              (練習 れんしゅうする, 入学 にゅうがく・する) until it
              dropped them, and test_vocab_deck holds it there with
              written_reading(); furigana annotates
              what is written, so written_reading() drops it first
  the pool    align_deck() falls back to KANJIDIC2 for a character the
              deck does not teach -- 171 jōyō kanji, 的・無・可・身
              among them, had no readings here at all

What is left undivided after all of it is, overwhelmingly, a word whose
reading belongs to the whole word -- 熟字訓 and 当て字, 今朝 けさ,
時計 とけい -- which is exactly what the coarse rendering says.
"""
from functools import lru_cache

from content.kanji_readings import display_reading, split_readings

def is_kanji(c: str) -> bool:
    return "一" <= c <= "龯"


# 々 (the iteration mark) repeats the kanji before it. Deliberately NOT
# is_kanji: callers index characters by it (study/kanji_words.py) and 々
# is not a character anyone looks up. It only ever belongs in a run.
_ITERATION = "々"


def _in_kanji_run(c: str) -> bool:
    return is_kanji(c) or c == _ITERATION


def _to_hiragana(s: str) -> str:
    """Katakana to hiragana, so an on-reading matches a word's reading."""
    return "".join(
        chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c
        for c in s
    )


# The first mora of a non-initial element may voice (連濁).
_RENDAKU = {
    "か": "が", "き": "ぎ", "く": "ぐ", "け": "げ", "こ": "ご",
    "さ": "ざ", "し": "じ", "す": "ず", "せ": "ぜ", "そ": "ぞ",
    "た": "だ", "ち": "ぢ", "つ": "づ", "て": "で", "と": "ど",
    "は": "ば", "ひ": "び", "ふ": "ぶ", "へ": "べ", "ほ": "ぼ",
}
# は-row can also go handakuten (っぱ), which rendaku alone misses.
_HANDAKU = {"は": "ぱ", "ひ": "ぴ", "ふ": "ぷ", "へ": "ぺ", "ほ": "ぽ"}
# Loose pass only: the voiced ち/つ as modern spelling writes it once the
# compound is one word (世界中 じゅう, 融通 ずう) rather than as ぢ/づ.
_YOTSUGANA = {"ち": "じ", "つ": "ず"}
# Loose pass only: a godan ending in its 連用形, the form a verb takes
# as the first half of a compound noun -- う.る is うり in 売上, あつか.う
# is あつかい in 取扱.
_GODAN_I = {
    "う": "い", "く": "き", "ぐ": "ぎ", "す": "し", "つ": "ち",
    "ぬ": "に", "ぶ": "び", "む": "み", "る": "り",
}


def _variants(reading: str, first: bool, loose: bool = False) -> list[str]:
    """Every surface form this reading may take in a compound.

    `loose` adds the second pass's forms (see the module docstring),
    AFTER every strict one, so a strict form is always tried first.
    """
    bases = [_to_hiragana(display_reading(reading))]
    # A kun reading carries its okurigana boundary: 切 is き.る, and inside
    # a compound only the き before the dot appears -- 切手 is きって, not
    # きるて. Both forms are offered, stem first, since the stem is the one
    # that shows up in compounds.
    if "." in reading:
        stem = _to_hiragana(reading.split(".", 1)[0].replace("~", ""))
        if stem:
            bases.insert(0, stem)
    out: list[str] = []
    for base in bases:
        if not base:
            continue
        out.extend(_forms(base, first))
    if loose:
        for base in bases + _absorbed(reading):
            if base:
                out.extend(_forms(base, first, loose=True))
    return list(dict.fromkeys(out))


def _absorbed(reading: str) -> list[str]:
    """A kun reading with its okurigana taken into the kanji, in part or
    as the verb's 連用形: し.まる gives しま (戸締り, whose り is still
    written), し.める gives しめ and き.る gives きり (締切, which writes
    neither), う.る gives うり and あ.げる あげ (売上). Nothing for a
    reading with no okurigana."""
    if "." not in reading:
        return []
    stem, okurigana = reading.replace("~", "").split(".", 1)
    stem, okurigana = _to_hiragana(stem), _to_hiragana(okurigana)
    if not stem or not okurigana:
        return []
    out = []
    if len(okurigana) > 1:
        out.append(stem + okurigana[:-1])
    if okurigana[-1] in _GODAN_I:
        out.append(stem + okurigana[:-1] + _GODAN_I[okurigana[-1]])
    return out


def _forms(base: str, first: bool, loose: bool = False) -> list[str]:
    out = [base]
    if not first:
        head, tail = base[0], base[1:]
        if head in _RENDAKU:
            out.append(_RENDAKU[head] + tail)
        if head in _HANDAKU:
            out.append(_HANDAKU[head] + tail)
        if loose and head in _YOTSUGANA:
            out.append(_YOTSUGANA[head] + tail)
    # 促音便: a final つ・ち・く・き hardens to っ before the next
    # element. がく + こう is がっこう, not がくこう -- and く is by far the
    # commonest of the four, so omitting it fails most 学-compounds.
    if base[-1] in "つちくき" and len(base) > 1:
        out.append(base[:-1] + "っ")
    # The other shape of 促音便: the geminate is ADDED rather than
    # replacing a mora. 切 (き) + 手 (て) is きって, not きて. Safe to offer
    # speculatively -- _segment only accepts a form if the WHOLE remaining
    # reading still divides exactly, so a wrong っ simply fails to close.
    out.append(base + "っ")
    return out


def reading_stem(token: str) -> str:
    """
    The part of a deck reading that is the kanji's own, in hiragana, with
    okurigana and bound-form markers stripped: 'い.きる' → 'い', '~び' →
    'び', 'なま~' → 'なま', 'セイ' → 'せい'. Two readings share a stem
    when they are the same sound wearing different endings -- 上げる and
    上がる are both あ -- which is the sense in which a list of example
    words "varies its readings". The frontend's domain/readingPick.js
    draws the same line for the study card.
    """
    bare = (token or "").replace("~", "").replace("～", "")
    dot = bare.find(".")
    return _to_hiragana(bare if dot == -1 else bare[:dot])


def reading_token_for(surface: str, tokens: list[str], first: bool) -> str | None:
    """
    Which of a kanji's own readings `surface` is a form of, or None.

    `surface` is the slice of a word's reading the aligner put over this
    kanji (木曜日 gives 日 "び"); `tokens` are the deck's readings for the
    kanji, in the deck's order (ニチ・ジツ・ひ・~び・~か); `first` says
    whether the kanji opens the word, because rendaku only voices a
    non-initial element.

    Three passes, exact before variant before the aligner's loose forms:
    日's "び" is listed as its own bound form (~び), and that entry should
    own the word rather than ひ claiming it through rendaku; and a slice
    only the loose pass could have cut (売上's うり) still files under the
    reading it came from (う.る) rather than under none. Within a pass
    the deck's order decides, which is where a primary reading is marked
    -- it comes first.
    """
    if not surface:
        return None
    surface = _to_hiragana(surface)
    for tok in tokens:
        bare = _to_hiragana(display_reading(tok))
        stem = _to_hiragana(tok.split(".", 1)[0].replace("~", "")) if "." in tok else bare
        if surface in (bare, stem):
            return tok
    for loose in (False, True):
        for tok in tokens:
            if surface in _variants(tok, first, loose=loose):
                return tok
    return None


def _readings_for(char: str | None, lookup) -> list[str]:
    packed = lookup(char) if char else None
    if not packed:
        return []
    split = split_readings(packed)
    # Longest first: だい before だ, so a greedy match does not strand the
    # rest of the reading.
    return sorted(split["on"] + split["kun"], key=len, reverse=True)


def _segment(chars: str, reading: str, lookup, first: bool = True,
             loose: bool = False, prev: str | None = None) -> list[str] | None:
    """
    Split `reading` across `chars`, one slice per kanji, or None.

    Exhaustive rather than greedy: a longest-match-wins pass strands the
    tail on compounds where an early kanji has a long reading that happens
    to prefix the right answer, and there are few enough candidates that
    trying them all is free.

    A 々 reads as `prev`, the kanji it repeats; `loose` is the second
    pass (module docstring).
    """
    if not chars:
        return [] if not reading else None
    head, rest = chars[0], chars[1:]
    char = prev if head == _ITERATION else head
    for candidate in _readings_for(char, lookup):
        for form in _variants(candidate, first, loose):
            if not reading.startswith(form):
                continue
            tail = _segment(rest, reading[len(form):], lookup, first=False,
                            loose=loose, prev=char)
            if tail is not None:
                return [form] + tail
    return None


def _split_runs(text: str) -> list[str]:
    """Runs of kanji and runs of everything else, in order. A 々 sits in
    the run of the kanji it repeats."""
    runs: list[str] = []
    for c in text:
        if runs and _in_kanji_run(runs[-1][-1]) == _in_kanji_run(c):
            runs[-1] += c
        else:
            runs.append(c)
    return runs


def _walk(runs: list[str], reading: str, lookup) -> list[dict] | None:
    """
    Assign a slice of `reading` to each run, or None if it will not divide.

    BACKTRACKING, because a kana anchor can occur more than once and the
    first occurrence is not always the right one. 五つ is いつつ: taking the
    first つ leaves 五 reading い and strands the final つ, and taking the
    second gives 五[いつ] つ, which is correct. A single forward guess gets
    one of those two wrong, and the failure is silent -- a dropped mora
    just does not appear above the kanji.
    """
    if not runs:
        return [] if not reading else None

    run, rest = runs[0], runs[1:]

    if not _in_kanji_run(run[0]):
        if not reading.startswith(run):
            return None
        tail = _walk(rest, reading[len(run):], lookup)
        return None if tail is None else [{"text": run}] + tail

    if not rest:
        # Trailing kanji run takes whatever is left.
        return _kanji_parts(run, reading, lookup) if reading else None

    nxt = rest[0]
    # Every kanji needs at least one mora, so start at len(run).
    at = reading.find(nxt, len(run))
    while at != -1:
        tail = _walk(rest, reading[at:], lookup)
        if tail is not None:
            return _kanji_parts(run, reading[:at], lookup) + tail
        at = reading.find(nxt, at + 1)
    return None


def _kanji_parts(run: str, slice_: str, lookup) -> list[dict]:
    """One part per kanji when the slice divides, else one for the run.

    The loose pass runs only where the strict one found nothing, which is
    what keeps it from ever changing a division the strict pass makes.
    """
    segments = None
    if len(run) > 1:
        segments = (_segment(run, slice_, lookup)
                    or _segment(run, slice_, lookup, loose=True))
    if segments and len(segments) == len(run):
        return [{"text": ch, "reading": seg} for ch, seg in zip(run, segments)]
    return [{"text": run, "reading": slice_}]


# The suru-verb marker the deck packed into a reading its written form
# does not carry (練習 れんしゅうする, 入学 にゅうがく・する) until it
# dropped them; a reading from anywhere else may still carry one.
_SURU_MARKERS = ("・する", "する")


def written_reading(text: str, reading: str) -> str:
    """The part of `reading` that `text` spells: the reading less a する
    the deck packed onto a word written without one.

    Only after a kanji: a word ending in kana spells its own ending, and
    為る (する), 擦る (こする) are read する because they are written so.
    """
    if not text or not reading or not _in_kanji_run(text[-1]):
        return reading
    for marker in _SURU_MARKERS:
        if reading.endswith(marker) and len(reading) > len(marker):
            return reading[:-len(marker)]
    return reading


def align(text: str, reading: str, lookup) -> list[dict]:
    """
    [{"text": ..., "reading": ...}, ...] -- one part per run, with a
    reading only where furigana belongs.

    `lookup` takes a kanji and returns its packed reading string (or None),
    so this module does not care where the deck lives.

    A word that will not divide comes back as a single part carrying the
    whole reading: the coarse rendering the app already did. A wrong
    furigana is worse than a coarse one, because the learner cannot tell
    it is wrong.

    The parts spell `text` and read written_reading(text, reading): a
    packed する is metadata about the word, not kana over it.
    """
    if not text:
        return []
    if not reading or not any(_in_kanji_run(c) for c in text):
        return [{"text": text}]
    if any(_in_kanji_run(c) for c in reading):
        # Not a reading: a kanji over a kanji teaches nothing, and the
        # walk below would divide it as though it were kana.
        return [{"text": text}]

    reading = written_reading(text, reading)
    parts = _walk(_split_runs(text), reading, lookup)
    return parts if parts is not None else [{"text": text, "reading": reading}]


@lru_cache(maxsize=4096)
def _pool_readings(char: str) -> str | None:
    """A character's KANJIDIC2 readings, in the deck's packed format, for
    the ones the deck does not teach. One indexed SQLite read per
    character, cached: the pool is 13,108 rows and is never held whole
    (content/kanji_pool_data.py)."""
    from content import kanji_pool_data

    return kanji_pool_data.packed_readings_for([char]).get(char)


def _deck_or_pool(char: str) -> str | None:
    return _DECK_READINGS.get(char) or _pool_readings(char)


def align_deck(text: str, reading: str) -> list[dict]:
    """align() against the app's own kanji deck, and KANJIDIC2 for a
    character the deck does not teach.

    The deck's readings come first because they are the ones the app
    teaches, and a character it teaches never reaches the pool: 的, 無
    and 身 are the reason the pool is asked at all, and until it was
    every word containing one came back undivided.
    """
    from content.kanji_data import KANJI_BY_LEVEL

    global _DECK_READINGS
    if _DECK_READINGS is None:
        _DECK_READINGS = {
            e["kanji"]: e.get("kana", "")
            for entries in KANJI_BY_LEVEL.values() for e in entries
        }
    return align(text, reading, _deck_or_pool)


def align_sentence(text: str) -> list[dict]:
    """align_deck() over a whole sentence, one morpheme at a time.

    A sentence has no single flat reading to align against -- the deck
    stores one per WORD -- so the readings come from the tokenizer, which
    is also the only thing that gets them right in context: 上 is うえ
    standing alone and のぼ inside 上る, and no per-character table can
    say which (see study/morphology.py). Each morpheme's surface and its
    INFLECTED reading then go through the same per-kanji splitter a
    flashcard's furigana uses, so the ruby over 飲み divides の|み here
    exactly as it does there.

    Consecutive parts with no reading are merged back into one: a run of
    kana and punctuation is one text node rather than five, and breaks
    where the browser would break it anyway.

    A part with a reading carries `word`, the index of the morpheme it
    came from: 学 and 生 share one, 毎年 and 軽井沢 do not. The example
    renderer joins a word's readings into one ruby and never two
    words' (components/dictionary/ExampleSentence.jsx), so the parts
    have to say where one word ends.

    A reading the tokenizer could not give (an unknown word it echoes
    back in kanji) is no furigana rather than the kanji over itself.

    Degrades to a single unreadinged part when the tokenizer is not
    installed (morphology.py's GRACEFUL DEGRADATION), which renders as
    the bare sentence -- what every caller showed before furigana.
    """
    # Imported here, not at module scope: everything else in this file is
    # pure content data, and MeCab is a 250MB optional dependency that a
    # caller aligning a word it already has the reading for never needs.
    from study import morphology

    if not text:
        return []
    morphemes = morphology.tokenize(text)
    if morphemes is None:
        return [{"text": text}]

    parts: list[dict] = []
    for word, m in enumerate(morphemes):
        for part in align_deck(m.surface, m.reading):
            if part.get("reading") is None:
                if parts and parts[-1].get("reading") is None:
                    parts[-1] = {"text": parts[-1]["text"] + part["text"]}
                else:
                    parts.append(part)
            else:
                parts.append({**part, "word": word})
    return parts


def mark_spans(parts: list[dict], spans: list[tuple[int, int]]) -> list[dict]:
    """`parts` with every character inside one of `spans` marked
    `highlight: True` -- the offsets being into the text the parts
    spell out, which is the sentence they were aligned from.

    A part with no reading is SPLIT at a span's edges, so a mark can
    point at three characters of a kana run. A ruby part is never
    split: half a reading over half a word is wrong furigana, and wrong
    furigana is worse than a mark a character too wide. So a span
    touching a ruby part widens to the whole part.

    Two callers mark a span for two reasons -- the grammar lesson picks
    its pattern out of its example (study/grammar_examples.py), and the
    translation review picks out what it changed in the learner's own
    sentence (routes/translation.py) -- and the rule above is the same
    one for both, which is why it is here beside the parts rather than
    written twice beside the reasons.
    """
    if not spans or not parts:
        return parts
    out: list[dict] = []
    pos = 0
    for part in parts:
        text = part["text"]
        start, end = pos, pos + len(text)
        pos = end
        # The part's own characters, each inside a span or not.
        inside = [any(a <= i < b for a, b in spans) for i in range(start, end)]
        if not any(inside):
            out.append(part)
        elif part.get("reading") is not None or all(inside):
            out.append({**part, "highlight": True})
        else:
            # A readingless run: cut it into alternating stretches.
            at = 0
            for i in range(1, len(text) + 1):
                if i == len(text) or inside[i] != inside[at]:
                    piece = {"text": text[at:i]}
                    out.append({**piece, "highlight": True} if inside[at] else piece)
                    at = i
    return out


_DECK_READINGS: dict[str, str] | None = None
