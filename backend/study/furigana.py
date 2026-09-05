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
"""
from content.kanji_readings import display_reading, split_readings

def is_kanji(c: str) -> bool:
    return "一" <= c <= "龯"


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


def _variants(reading: str, first: bool) -> list[str]:
    """Every surface form this reading may take in a compound."""
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
    return list(dict.fromkeys(out))


def _forms(base: str, first: bool) -> list[str]:
    out = [base]
    if not first:
        head, tail = base[0], base[1:]
        if head in _RENDAKU:
            out.append(_RENDAKU[head] + tail)
        if head in _HANDAKU:
            out.append(_HANDAKU[head] + tail)
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


def reading_token_for(surface: str, tokens: list[str], first: bool) -> str | None:
    """
    Which of a kanji's own readings `surface` is a form of, or None.

    `surface` is the slice of a word's reading the aligner put over this
    kanji (木曜日 gives 日 "び"); `tokens` are the deck's readings for the
    kanji, in the deck's order (ニチ・ジツ・ひ・~び・~か); `first` says
    whether the kanji opens the word, because rendaku only voices a
    non-initial element.

    Two passes, exact before variant: 日's "び" is listed as its own bound
    form (~び), and that entry should own the word rather than ひ claiming
    it through rendaku. Within a pass the deck's order decides, which is
    where a primary reading is marked -- it comes first.
    """
    if not surface:
        return None
    surface = _to_hiragana(surface)
    for tok in tokens:
        bare = _to_hiragana(display_reading(tok))
        stem = _to_hiragana(tok.split(".", 1)[0].replace("~", "")) if "." in tok else bare
        if surface in (bare, stem):
            return tok
    for tok in tokens:
        if surface in _variants(tok, first):
            return tok
    return None


def _readings_for(char: str, lookup) -> list[str]:
    packed = lookup(char)
    if not packed:
        return []
    split = split_readings(packed)
    # Longest first: だい before だ, so a greedy match does not strand the
    # rest of the reading.
    return sorted(split["on"] + split["kun"], key=len, reverse=True)


def _segment(chars: str, reading: str, lookup, first: bool = True) -> list[str] | None:
    """
    Split `reading` across `chars`, one slice per kanji, or None.

    Exhaustive rather than greedy: a longest-match-wins pass strands the
    tail on compounds where an early kanji has a long reading that happens
    to prefix the right answer, and there are few enough candidates that
    trying them all is free.
    """
    if not chars:
        return [] if not reading else None
    head, rest = chars[0], chars[1:]
    for candidate in _readings_for(head, lookup):
        for form in _variants(candidate, first):
            if not reading.startswith(form):
                continue
            tail = _segment(rest, reading[len(form):], lookup, first=False)
            if tail is not None:
                return [form] + tail
    return None


def _split_runs(text: str) -> list[str]:
    """Runs of kanji and runs of everything else, in order."""
    runs: list[str] = []
    for c in text:
        if runs and is_kanji(runs[-1][-1]) == is_kanji(c):
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

    if not is_kanji(run[0]):
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
    """One part per kanji when the slice divides, else one for the run."""
    segments = _segment(run, slice_, lookup) if len(run) > 1 else None
    if segments and len(segments) == len(run):
        return [{"text": ch, "reading": seg} for ch, seg in zip(run, segments)]
    return [{"text": run, "reading": slice_}]


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
    """
    if not text:
        return []
    if not reading or not any(is_kanji(c) for c in text):
        return [{"text": text}]

    parts = _walk(_split_runs(text), reading, lookup)
    return parts if parts is not None else [{"text": text, "reading": reading}]


def align_deck(text: str, reading: str) -> list[dict]:
    """align() against the app's own kanji deck."""
    from content.kanji_data import KANJI_BY_LEVEL

    global _DECK_READINGS
    if _DECK_READINGS is None:
        _DECK_READINGS = {
            e["kanji"]: e.get("kana", "")
            for entries in KANJI_BY_LEVEL.values() for e in entries
        }
    return align(text, reading, _DECK_READINGS.get)


_DECK_READINGS: dict[str, str] | None = None
