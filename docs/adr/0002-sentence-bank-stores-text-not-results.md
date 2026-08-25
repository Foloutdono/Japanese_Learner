# 0002 — The Sentence bank stores text and provenance, not frozen analyses

- **Status**: accepted
- **Date**: 2026-08-25

## Context

`phrase_history` stores the **fully enriched** analysis as JSONB — including
each word's per-user SRS statistics as they were at the moment of analysis
(`routes/phrase.py`, the `INSERT INTO phrase_history` in `analyze_phrase`).

That is already wrong today: reopen an entry from last month and a word the
learner has since mastered still displays "New". The stored stats are a
snapshot of a value that changes every review.

It gets worse under the new design. Entries can now hold a whole Passage — a
photo of a page, a video window of ~100 Sentences — so the rows grow by two
orders of magnitude while storing data that is stale on arrival.

The local tier being free is what makes a different answer possible: the
analysis can simply be recomputed on open.

## Decision

Store the Sentence **text** and its **provenance** (source kind, and a
reference such as a video id and timestamp). Do not store the analysis.

Re-derive the local tier when an entry is opened. The deep tier, if it was
ever bought, is still in `phrase_analysis_cache`, which is permanent and keyed
by text — so reopening usually recovers the explanation for free too.

The object stops being "a log of requests I made" and becomes "the Sentences
I collected", which is what sentence mining actually wants.

## Consequences

- The stale-badge defect disappears, for free, with no separate fix.
- Rows shrink from kilobytes of JSON to a text column plus provenance.
- Video and photo Passages become storable at all.
- Opening an entry now costs a MeCab pass. That is sub-millisecond per
  sentence and needs no network, but it is not literally zero, and it means
  history depends on the tokenizer being installed — the same dependency the
  rest of the local tier already has.
- A Sentence whose deep tier was bought under a different UI language will
  miss the cache (the key includes language) and show local-only until
  re-bought. Accepted.

## Alternatives considered

**Keep the enriched blob, strip the stats before storing.** Fixes staleness
but keeps the size problem and freezes segmentation and grammar matching at
analysis time, so improvements to the analyzer never reach old entries.

**Store the blob and refresh the stats on read.** Half the recompute for none
of the size saving, and two code paths for producing one shape.
