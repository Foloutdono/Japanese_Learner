# ── Reconstructing Sentences from Cues ────────────────────────────
# The heart of this plan. Cue boundaries are a DISPLAY artifact (how
# long a line stays on screen) and do not correspond to Sentence
# boundaries -- and Japanese auto-captions arrive with NO PUNCTUATION
# AT ALL, so the usual split_sentences (plan 016) approach needs a
# fallback for the common case where it finds nothing to split on.
from study.sentences import split_sentences

# When split_sentences finds no terminator across an entire Window, it
# (correctly) returns one giant Sentence spanning everything -- which is
# useless as a study unit. Above this many characters, that single
# Sentence is abandoned in favour of one Sentence per Cue instead. A
# heuristic standing in for punctuation that Japanese auto-captions
# simply don't have; expect to tune it against real videos (see the
# plan's maintenance notes).
UNPUNCTUATED_FALLBACK_CHAR_THRESHOLD = 120


def _build_concatenation(cues: list[dict]) -> tuple[str, list[tuple[int, int]]]:
    """Every Cue's text joined with a single space, plus each Cue's own
    (char_start, char_end) span within that joined string. The single-
    space join is part of this module's contract -- callers (and tests)
    reconstructing offsets rely on it."""
    concatenation = ""
    spans = []
    for cue in cues:
        if concatenation:
            concatenation += " "
        char_start = len(concatenation)
        concatenation += cue["text"]
        spans.append((char_start, len(concatenation)))
    return concatenation, spans


def _owning_cue(char_index: int, spans: list[tuple[int, int]]) -> int:
    """Index into `spans` (and therefore into the Cue list) that owns
    `char_index`. A character landing in a JOIN separator (the space
    between two Cues) is attributed to the following Cue; one landing
    past the end of everything is attributed to the last Cue."""
    for i, (start, end) in enumerate(spans):
        if start <= char_index < end:
            return i
    for i, (start, _end) in enumerate(spans):
        if char_index < start:
            return i
    return len(spans) - 1


def sentences_from_cues(cues: list[dict], start: float, end: float) -> list[dict]:
    """Cues overlapping the Window [start, end) as Sentences, each
    {"text", "start", "end", "cue_start", "cue_end"} -- the first two
    are character offsets into this call's internal Cue concatenation
    (see _build_concatenation), the last two are seconds.
    """
    selected = [c for c in cues if c["end"] > start and c["start"] < end]
    if not selected:
        return []

    concatenation, spans = _build_concatenation(selected)
    raw_sentences = split_sentences(concatenation)

    if len(raw_sentences) <= 1 and len(concatenation) > UNPUNCTUATED_FALLBACK_CHAR_THRESHOLD:
        # No usable punctuation across the whole Window -- fall back to
        # one Sentence per Cue rather than shipping one unreadable block.
        return [
            {
                "text": selected[i]["text"],
                "start": char_start,
                "end": char_end,
                "cue_start": selected[i]["start"],
                "cue_end": selected[i]["end"],
            }
            for i, (char_start, char_end) in enumerate(spans)
        ]

    result = []
    for sentence in raw_sentences:
        first_cue = _owning_cue(sentence["start"], spans)
        last_cue = _owning_cue(sentence["end"] - 1, spans)
        result.append({
            "text": sentence["text"],
            "start": sentence["start"],
            "end": sentence["end"],
            "cue_start": selected[first_cue]["start"],
            "cue_end": selected[last_cue]["end"],
        })
    return result
