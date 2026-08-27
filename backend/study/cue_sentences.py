# ── Reconstructing Sentences from Cues ────────────────────────────
# A Cue is a Sentence. That is a REVERSAL of what this module used to
# do, and of what docs/adr/0003 originally claimed; see that ADR's
# 2026-08-27 amendment for the evidence.
#
# The old model concatenated every Cue in the Window into one string and
# ran split_sentences over it, on the theory that Cue boundaries are a
# display artifact and Japanese auto-captions carry no punctuation to
# split on. It had a fallback to one-Sentence-per-Cue, but only when the
# WHOLE Window produced a single Sentence -- so a Track with a little
# punctuation (song lyrics: a ？ here, a ！ there) fell between the two
# cases and produced a handful of 200-character blocks, each spanning a
# dozen unrelated lines. Reported against a real .vtt whose 47 authored
# lyric lines came back as five walls of text.
#
# The premise was wrong for the input that matters. An authored .srt/
# .vtt Cue is not a display artifact -- it is a line somebody chose to
# put on screen together, which is exactly the unit a learner wants to
# study. Auto-caption Cues are rougher, but a rough one-phrase Sentence
# is still a usable study unit, and their rolling-window duplication is
# already handled upstream (captions._merge_duplicate_consecutive).
#
# So: one Cue in, exactly one Sentence out. Not split either -- a
# subtitle line is what is on screen, and splitting it on an internal ？
# produced stops that no longer matched the file and shared a timestamp
# with their other half.
#
# Nothing is ever DROPPED. A line with no Japanese is flagged, not
# removed: filtering it out silently deletes part of the track the
# learner is reading along with.
from study.text_normalize import japanese_ratio


def is_japanese(text: str) -> bool:
    """Any Japanese script at all. Deliberately not a tuned ratio: on
    real mixed-language subtitles the split is absolute -- Japanese
    lines score 0.4-1.0 on japanese_ratio and Korean/English/numeric
    lines score exactly 0.0 -- so "contains some Japanese" separates
    them without a threshold to maintain."""
    return bool(text.strip()) and japanese_ratio(text) > 0.0


def sentences_from_cues(cues: list[dict], start: float | None,
                        end: float | None) -> list[dict]:
    """Every Cue overlapping the Window [start, end) as a Sentence, each
    {"text", "cue_start", "cue_end", "japanese"}.

    EVERY Cue, in file order, one Sentence each. This is a subtitle
    track: the learner is reading along with it, so a line that is
    missing from the list is a line they cannot find, and a line that
    has been split or merged no longer matches what is on screen. The
    output is meant to be an enhanced copy of the file, not a filtered
    one.

    `japanese` is False for a line with no Japanese in it -- a Korean
    verse, an English ad-lib. Those are KEPT and flagged, not dropped:
    the caller shows them as-is and skips the breakdown, so the learner
    still sees the whole song and simply gets told which lines this app
    cannot take apart.

    Either bound may be None, meaning "no bound that side"; both None
    (the default) is the whole Track. The number of Sentences is capped
    by the caller via MAX_SENTENCES, which is what actually bounds the
    analysis work -- see docs/adr/0003's amendment.
    """
    return [
        {
            "text": cue["text"],
            "cue_start": cue["start"],
            "cue_end": cue["end"],
            "japanese": is_japanese(cue["text"]),
        }
        for cue in cues
        if (start is None or cue["end"] > start) and (end is None or cue["start"] < end)
    ]
