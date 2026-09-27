# ── When each word is said: the hand-written track on the machine's clock
# A video's hand-written subtitles are the lines worth studying, and they
# say only when a line starts and ends. YouTube's own speech recognition
# of the same video says when every word starts -- in words that are
# often wrong. This puts the two together: each hand-written line takes
# the times of the recognised words it shares, compared as kana so that
# 今日 and きょう, or a recognised 言う for a written いう, still meet.
#
# The result is a cue's `words` (study/captions.py): [offset, seconds]
# at the start of each word the two tracks agree on, and one at the
# line's length for where the speech in it ends. Sparse by nature; the
# frontend spreads the words between two anchors by their morae
# (components/analysis/wordTimes.js), so a line the recogniser missed
# entirely is still read out on an estimate, never left dark.
#
# Local, per line: a line is matched only against what was recognised
# within PAD seconds of it. A song's chorus comes back five times with
# the same words; matched globally, a line would take the times of
# whichever chorus the matcher met first.
#
# Two things since the first version (2026-09-27, measured on simulated
# songs and speech run through the whole pipeline):
#
#   - a recognised word's kana are spaced at the track's own pace, not
#     spread to the next word: the last word before a pause had its kana
#     stretched across the pause, and the line's end with them;
#   - a stretch the recogniser misheard between two it heard right, kana
#     for kana as long as the written one, is still timed by it: a word
#     misheard keeps the time it was said. A stretch of another length
#     is most often words the recogniser missed, which its kana would
#     crowd into their neighbours' time -- the frontend spreads those.
from difflib import SequenceMatcher

from study import morphology

# How far outside a hand-written line's own times its words are looked
# for: authored subtitles are routinely a beat early or late.
PAD = 1.5
# A recognised kana lasts the track's median kana (the spacing of its
# words' starts, per kana) at the most this many times over.
KANA_SPREAD = 2.0
# ...and the median itself is held between these (seconds): a track
# with too few words to measure takes a pace people speak and sing at.
KANA_FLOOR, KANA_CEILING, KANA_DEFAULT = 0.08, 0.5, 0.2


def _is_kana(c: str) -> bool:
    return "ぁ" <= c <= "ゖ" or c == "ー"


def _readings(text: str) -> list[tuple[int, int, str]]:
    """(start, end, hiragana) per word. The tokenizer's reading where
    there is one; without a tokenizer, each character as itself, which
    still matches kana to kana and a kanji to the same kanji."""
    morphemes = morphology.tokenize(text)
    if morphemes is None:
        return [(i, i + 1, morphology.kata_to_hira(c)) for i, c in enumerate(text)]
    out = []
    for m in morphemes:
        reading = m.reading or morphology.kata_to_hira(m.surface)
        out.append((m.start, m.end, reading))
    return out


def _segments(cue: dict) -> list[tuple[int, float, float]]:
    """A recognised cue as its stamped words: (offset, start, next start),
    the last running to the cue's end."""
    n = len(cue["text"])
    marks = [(0, cue["start"])]
    for o, t in cue.get("words") or []:
        if 0 < o < n and t > marks[-1][1]:
            marks.append((o, t))
        elif o == 0 and t >= cue["start"] and len(marks) == 1:
            marks[0] = (0, t)
    ends = [t for _, t in marks[1:]] + [max(cue["end"], marks[-1][1])]
    return [(o, t, e) for (o, t), e in zip(marks, ends)]


def _kana_by_segment(cue: dict) -> list[tuple[float, float, list[str]]]:
    """Each stamped word's start, the next one's, and its kana."""
    segs = _segments(cue)
    out = [(t, e, []) for _, t, e in segs]
    offsets = [o for o, _, _ in segs]
    for start, _end, reading in _readings(cue["text"]):
        k = max(i for i, o in enumerate(offsets) if o <= start)
        out[k][2].extend(c for c in reading if _is_kana(c))
    return out


def _heard(timing_cues: list[dict]) -> tuple[list[tuple[str, float]], float]:
    """Every kana the recogniser wrote with the time it is said, and how
    long a kana of this track lasts. A word's kana are spaced evenly
    from its start, at most KANA_SPREAD kana-lengths each: the time up
    to the next word is the word and whatever pause follows it."""
    words = [w for cue in timing_cues for w in _kana_by_segment(cue)]
    per_kana = sorted((e - t) / len(k) for t, e, k in words if k and e > t)
    kana = per_kana[len(per_kana) // 2] if per_kana else KANA_DEFAULT
    kana = min(KANA_CEILING, max(KANA_FLOOR, kana))
    out = []
    for t, e, k in words:
        if not k:
            continue
        step = min((e - t) / len(k), kana * KANA_SPREAD) if e > t else kana
        out.extend((c, t + step * i) for i, c in enumerate(k))
    out.sort(key=lambda kt: kt[1])
    return out, kana


def _align_one(cue: dict, heard: list[tuple[str, float]], kana: float = KANA_DEFAULT) -> list[list]:
    words = _readings(cue["text"])
    written = []          # (kana, index of its word, position in the word)
    for w, (_, _, reading) in enumerate(words):
        for k, c in enumerate(c for c in reading if _is_kana(c)):
            written.append((c, w, k))
    if not written:
        return []
    lo, hi = cue["start"] - PAD, cue["end"] + PAD
    window = [kt for kt in heard if lo <= kt[1] <= hi]
    if not window:
        return []

    a = "".join(c for c, _, _ in written)
    b = "".join(c for c, _ in window)
    at = {}               # index into `written` -> index into `window`
    shortest = 1 if len(a) <= 3 else 2
    blocks = [blk for blk in SequenceMatcher(None, a, b, autojunk=False).get_matching_blocks()
              if blk.size >= shortest]
    for block in blocks:
        for k in range(block.size):
            at[block.a + k] = block.b + k
    # Between two stretches heard right, one misheard kana for kana.
    for left, right in zip(blocks, blocks[1:]):
        i0, i1 = left.a + left.size, right.a
        j0, j1 = left.b + left.size, right.b
        if i1 > i0 and i1 - i0 == j1 - j0:
            for k in range(i1 - i0):
                at[i0 + k] = j0 + k

    anchors = []
    for i, (_, w, k) in enumerate(written):
        if k == 0 and i in at:
            anchors.append((words[w][0], window[at[i]][1]))
    # Where the speech in the line ends: after its last kana, if the
    # recogniser heard that one too.
    last = len(written) - 1
    if last in at:
        j = at[last]
        t = window[j][1]
        after = window[j + 1][1] - t if j + 1 < len(window) else kana
        anchors.append((len(cue["text"]), t + max(0.15, min(kana * KANA_SPREAD, after))))

    out: list[list] = []
    for o, t in anchors:
        t = min(max(t, cue["start"]), cue["end"])
        if out and (o <= out[-1][0] or t <= out[-1][1]):
            continue
        out.append([o, round(t, 3)])
    # One anchor at the line's end is no timing at all.
    return out if any(o < len(cue["text"]) for o, _ in out) else []


def align_cues(cues: list[dict], timing_cues: list[dict]) -> list[dict]:
    """The hand-written cues, each given `words` from the recognised
    track where the two agree. A cue that already has its own (a file
    that said when each word is sung) keeps them."""
    heard, kana = _heard(timing_cues)
    if not heard:
        return cues
    out = []
    for cue in cues:
        if cue.get("words"):
            out.append(cue)
            continue
        words = _align_one(cue, heard, kana)
        out.append({**cue, "words": words} if words else cue)
    return out
