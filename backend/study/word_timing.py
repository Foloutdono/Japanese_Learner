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
from difflib import SequenceMatcher

from study import morphology

# How far outside a hand-written line's own times its words are looked
# for: authored subtitles are routinely a beat early or late.
PAD = 1.5
# The longest a line's last word is taken to last when nothing
# recognised follows it.
LAST_WORD = 0.6


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


def _clock(cue: dict) -> list[float]:
    """The time at every character offset of a cue, 0 to len inclusive,
    linear between its anchors -- a recognised segment's letters are
    spread over the segment."""
    text = cue["text"]
    n = len(text)
    anchors = [(0, cue["start"])]
    for o, t in cue.get("words") or []:
        if 0 < o < n and t > anchors[-1][1]:
            anchors.append((o, t))
        elif o == 0 and t >= cue["start"]:
            anchors[0] = (0, t)
    anchors.append((n, max(cue["end"], anchors[-1][1])))
    times = []
    for (o0, t0), (o1, t1) in zip(anchors, anchors[1:]):
        span = max(1, o1 - o0)
        for o in range(o0, o1):
            times.append(t0 + (t1 - t0) * (o - o0) / span)
    times.append(anchors[-1][1])
    return times


def _heard(timing_cues: list[dict]) -> list[tuple[str, float]]:
    """Every kana the recogniser wrote, with the time it is said."""
    out = []
    for cue in timing_cues:
        clock = _clock(cue)
        for start, end, reading in _readings(cue["text"]):
            kana = [c for c in reading if _is_kana(c)]
            t0, t1 = clock[start], clock[end]
            for k, c in enumerate(kana):
                out.append((c, t0 + (t1 - t0) * k / len(kana)))
    out.sort(key=lambda kt: kt[1])
    return out


def _align_one(cue: dict, heard: list[tuple[str, float]]) -> list[list]:
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
    for block in SequenceMatcher(None, a, b, autojunk=False).get_matching_blocks():
        if block.size < shortest:
            continue
        for k in range(block.size):
            at[block.a + k] = block.b + k

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
        after = window[j + 1][1] - t if j + 1 < len(window) else LAST_WORD
        anchors.append((len(cue["text"]), t + max(0.15, min(LAST_WORD, after))))

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
    heard = _heard(timing_cues)
    if not heard:
        return cues
    out = []
    for cue in cues:
        if cue.get("words"):
            out.append(cue)
            continue
        words = _align_one(cue, heard)
        out.append({**cue, "words": words} if words else cue)
    return out
