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
# So: one Cue in, one or more Sentences out -- more only when the Cue's
# OWN text carries punctuation to split on. Never fewer, and never a
# merge across Cues.
from study.sentences import split_sentences
from study.text_normalize import japanese_ratio


def _has_japanese(text: str) -> bool:
    """Any Japanese script at all. Deliberately not a tuned ratio: on
    real mixed-language subtitles the split is absolute -- Japanese
    lines score 0.4-1.0 and Korean/English/numeric lines score exactly
    0.0 -- so "contains some Japanese" separates them without a
    threshold to maintain. Measured against the mosi-mosi .vtt, whose
    Korean verses were being furigana'd as though they were Japanese."""
    return japanese_ratio(text) > 0.0 and text.strip() != ""


def sentences_from_cues(cues: list[dict], start: float | None,
                        end: float | None) -> list[dict]:
    """Cues overlapping the Window [start, end) as Sentences, each
    {"text", "cue_start", "cue_end"} -- the last two in seconds.

    Either bound may be None, meaning "no bound that side"; both None
    (the default) is the whole Track. The number of Sentences is capped
    by the caller via MAX_SENTENCES, which is what actually bounds the
    analysis work -- see docs/adr/0003's amendment on why the Window
    stopped being a second cap on the same thing.

    A Cue with no Japanese in it is dropped: this app cannot teach a
    Korean lyric or an English ad-lib, and analyzing one produces a
    Sentence of pure off-deck noise.
    """
    selected = [
        c for c in cues
        if (start is None or c["end"] > start) and (end is None or c["start"] < end)
    ]

    result: list[dict] = []
    for cue in selected:
        if not _has_japanese(cue["text"]):
            continue
        for sentence in split_sentences(cue["text"]):
            result.append({
                "text": sentence["text"],
                "cue_start": cue["start"],
                "cue_end": cue["end"],
            })
    return result
