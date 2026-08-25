# ── Splitting a Passage into Sentences ────────────────────────────
# A Passage (what the learner submits: typed text, OCR output, a video
# caption concatenation) is not the unit that gets analyzed -- a
# Sentence is. This module draws that boundary.
#
# `split_sentences` always returns the FULL list, uncapped. MAX_SENTENCES
# is exported as the one shared cap value; applying it (and reporting
# how many Sentences were dropped) is the caller's job -- see
# routes/phrase.py's analyze_phrase, which computes
# `max(0, len(all) - MAX_SENTENCES)` before slicing. Keeping the cap out
# of this function keeps it a pure "what are the Sentences" answer, and
# the drop count exact rather than reconstructed after the fact.

# Kept with the Sentence they end (real punctuation, worth showing).
_TERMINATORS = frozenset("。！？!?")

# A bare newline is treated purely as a SEPARATOR, not kept with either
# Sentence -- unlike 。！？!?, a newline is whitespace, and "no returned
# text starts or ends with whitespace" is a hard requirement. Splitting
# on newlines matters for how learners actually paste text (one line per
# thought), but the newline itself carries no meaning worth keeping.
_OPENERS = {"「": "」", "『": "』", "（": "）"}

MAX_SENTENCES = 50


def split_sentences(text: str) -> list[dict]:
    """A Passage split into Sentences, each {"text", "start", "end"}.

    - Splits on 。！？!? (kept with the Sentence they end) and newlines
      (a separator, dropped).
    - Never splits inside 「」/『』/（） -- quoted speech ending in 。
      inside a larger sentence is one Sentence, not two.
    - `text[s["start"]:s["end"]] == s["text"]` holds for every result:
      offsets are into the ORIGINAL text.
    - No terminator anywhere returns exactly one Sentence spanning the
      (whitespace-trimmed) whole text -- the common case for
      auto-generated video captions, so it must be correct, not a
      fallback edge case.
    - Empty or whitespace-only input returns [].
    """
    if not text or not text.strip():
        return []

    n = len(text)
    sentences: list[dict] = []
    stack: list[str] = []

    def skip_ws(i: int) -> int:
        while i < n and text[i].isspace():
            i += 1
        return i

    start = skip_ws(0)
    i = start
    while i < n:
        ch = text[i]

        if ch in _OPENERS:
            stack.append(_OPENERS[ch])
            i += 1
            continue

        if stack and ch == stack[-1]:
            stack.pop()
            i += 1
            continue

        if not stack and ch == "\n":
            piece = text[start:i]
            if piece:
                sentences.append({"text": piece, "start": start, "end": i})
            start = skip_ws(i + 1)
            i = start
            continue

        if not stack and ch in _TERMINATORS:
            end = i + 1
            sentences.append({"text": text[start:end], "start": start, "end": end})
            start = skip_ws(end)
            i = start
            continue

        i += 1

    # Trailing content with no terminator -- trim trailing whitespace
    # rather than including it (same "no whitespace at the edges" rule).
    end = n
    while end > start and text[end - 1].isspace():
        end -= 1
    if end > start:
        sentences.append({"text": text[start:end], "start": start, "end": end})

    return sentences
