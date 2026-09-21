# The content audit

Twice a week a session wakes up, takes one slice of the taught content,
and tries to prove it wrong. What it cannot prove wrong it leaves alone;
what it can, it writes up as a GitHub issue with the sources that
contradict us.

The reason the app needs this at all: every other check in the repo asks
whether the content is *well-formed*. `check_grammar` asks whether a
sentence contains its pattern and stays inside the level's kanji;
`test_listening_clips` asks whether the kana transcribes the jp. Nothing
asks whether what we teach is **true**. A sentence can pass every gate in
CI and still be a sentence no Japanese person would say, glossed with a
meaning the word stopped having in 1970. A learner has no way to tell —
that is the whole reason they are here — so a wrong entry is not a bug
they route around, it is something they memorise. That asymmetry is why
this audit is slow, sourced and conservative rather than fast and broad.

---

## Rule 0 — the audit does not touch the content

The run opens **one GitHub issue** and changes nothing else. No commit to
the content, no PR, no "obvious" fix applied in passing.

This is not timidity. An audit that edits is an audit whose own mistakes
land in the app silently, and a wrong correction is worse than the
original error because it arrives with a citation attached. A human
reads the issue, agrees or does not, and makes the change.

The one thing a run may write is a *scratch file outside the repo* while
it works. The repository working tree ends the run clean.

---

## The run, in order

### 1. Take the slice

```bash
cd backend
python -m scripts.audit_slice                 # what today's run is for
python -m scripts.audit_slice --dump > /tmp/slice.json
```

The slice is a pure function of the date — grammar, vocab, sentences and
placement in rotation, each area walking its own list — so there is no
ledger to update and a run can be reproduced later with `--on`. Read
`scripts/audit_slice.py`'s docstring for the rotation; `--schedule 12`
shows what is coming.

The dump carries the entries, the `source` file they live in, and a
`checks` list: the questions this area is audited against. For vocab it
also carries `risk` and `flags` — see step 3.

**A placement slice is different in kind.** Its entries are not content
but *claims about* the content, raised by two outside lists (plan 109,
`docs/vocab-deck-review.md`; the lists and their licences are under
`backend/datas/vocab/sources/`): a deck card placed above the level the
community JLPT lists give the word, a list word the deck has no card
for, or a word high in a subtitle-corpus ranking with no card. Each
comes with the rank the ranking gives it. The job is the same as for a
gloss — try to disprove the claim — and the finding, when one survives,
*proposes* a card or a level move with the evidence, in the same issue
shape as step 6. The audit never adds the card or moves the level (Rule
0); a level move is a card-id change and goes through
`content/vocab_renames.py` and the migration, which is the maintainer's.
Most claims will not survive: the subtitle ranking credits verb stems
and homophones, the JLPT lists are the deck's own ancestors, and a
"missing" word is often present under another spelling. That is the
point of auditing them rather than importing them.

### 2. Run the repo's own gates first

```bash
cd backend
python -m scripts.check_grammar --level N5          # grammar slices
python -m pytest tests/test_grammar_points.py tests/test_grammar_sentences.py
python -m pytest tests/test_reading_sentences.py tests/test_listening_clips.py
```

Two reasons, both load-bearing. It tells you what the gates already
catch, so the issue does not spend a reviewer's attention on something CI
would have said for free. And it tells you the shape a correction has to
keep: a proposed example sentence that breaks `check_grammar` is not a
correction, it is a second bug, and proposing it costs the audit its
credibility.

If a gate is already failing on `main`, stop and say so in the issue —
that is a bigger finding than anything in the slice.

### 3. Cross-check against what ships in the repo

The strongest evidence is already on disk and needs no network.

| To check | Against |
|---|---|
| a vocab reading or gloss | `datas/vocab/vocab_jmdict.sqlite3` — `curated_senses` keyed `"kanji::kana"`, and `entries` (212k JMdict entries, with `freq_rank`) |
| a kanji reading, meaning or stroke count | `datas/kanji/kanji.sqlite3` (KANJIDIC2, 13,108 characters) |
| how common a word really is | `datas/vocab/vocab_frequency.json`, and JMdict's own `term_tags` (`ichi`, `news3k`, `⭐`) in the sense blob |
| a grammar point's neighbours | the other four `content/grammar/*.json` — a `compare` rival is supposed to be a real point |
| whether a theme word belongs | `theme_words.json`'s own rank, and the JMdict sense's field tags |

For a vocab slice the dump has done part of this already. Each entry
carries `flags` and a `risk` score, and the ordering is risk-first.

**A flag is a reason to look, never a finding.** `gloss_absent` fires on
駅 "station" (JMdict prefers "railway station") exactly as it fires on a
genuinely wrong gloss. Reporting a flag as if it were a defect is the
single easiest way to make this audit worthless. Open the entry, decide
for yourself, and if the answer is "our wording is fine", say nothing.

### 4. Research what the corpora cannot settle

Naturalness, register, whether something is dated, whether a level is
defensible, whether a `compare` line is true of both sides — none of
that is in JMdict. That is what the research half is for.

**What this environment can actually reach.** `WebSearch` works.
`WebFetch` and `curl` are blocked by the egress proxy for the sites you
would most want — jisho.org, kotobank.jp, weblio.jp, edrdg.org,
wiktionary — so plan on search results and their snippets, not on
fetching a dictionary page. Search in **Japanese as well as English**:
`「〜ものの」 意味 使い方 違い` returns Japanese teaching material that
`monono grammar` does not.

Where a claim needs a page you cannot fetch, say so in the finding and
mark it **B** (below) rather than asserting it. Do not work around the
proxy. If this constraint is what is limiting the audit, that is worth
telling the maintainer — the environment's network policy is
configurable, and an allowlist for a handful of reference sites would
raise the ceiling on every future run.

### 5. Judge

Three tiers. Only the first two are ever written down.

- **A — contradicted.** An authoritative source says otherwise, or the
  repo's own data does: a reading that is not a reading of that spelling,
  a gloss the word does not have, a sentence that does not contain the
  pattern it claims, a kana line that does not transcribe its jp, `#NAME?`
  sitting in a meaning field. State it, cite it, propose the exact
  replacement string.
- **B — misleading.** Not false, but it will teach the wrong instinct: a
  gloss that gives the rare sense first, a `compare` line true in one
  direction only, an example whose register contradicts the lesson's
  `careful` step, a word placed two levels off its real frequency. Say
  what a learner would wrongly conclude.
- **C — taste.** A wording you would have chosen differently, a sentence
  that is fine but dull, a missing fourth example, a French phrasing that
  is merely not yours. **Never filed.** If half the slice comes out C,
  the correct output is an issue that says the slice is sound.

Two standing cautions, because both have produced confident nonsense:

- **JLPT levels are editorial, not official.** No syllabus has been
  published since 2010. Our level assignment can only be judged against
  the old 出題基準 and the usual community lists, and those disagree with
  each other. A level is a finding only when it is off by two or more, or
  when the entry's own frequency data contradicts it outright. "JLPT
  Sensei lists this as N2" is not, by itself, a defect.
- **Prescriptive sources over-report.** Plenty of real Japanese is
  flagged 誤用 by style guides and used by everyone. The question is
  what a learner will hear and be understood saying, not what a 国語
  columnist wishes were true.

### 6. File one issue

One issue per run, titled for the slice, labelled `content-audit`.

Before writing it, search the open issues with that label: if a previous
run filed the same finding, do not file it again — add a comment to the
existing issue only if you have new evidence.

```markdown
## audit: <slice id> — <title>        (e.g. vocab-3 — risk-ranked entries 81–120)

<n> entries checked. <n> findings: <n> A, <n> B.
Gates run: check_grammar N5 clean; test_grammar_points 42 passed.

---

### A1 · `歳::さい` (N1) — the meaning field is a spreadsheet error
**File** `backend/datas/vocab/vocab_deck.json`, N1
**Now** `"meaning": "#NAME?"`
**Should be** `"meaning": "year (of age), age"` — and the French
`vocab_fr.json` entry, which carries the same `#NAME?`
**Why** JMdict (`curated_senses` `歳::さい`) glosses it *year (of age)*;
the string is Excel's #NAME? error, so this card teaches nothing at all.
**Confidence** A — no judgement involved.

### B1 · `〜ものの` (N2) — the compare line is true one way only
...
```

Rules for the body:

- **Quote the current text verbatim** and give the exact replacement, so
  a maintainer can act without re-deriving the research.
- **Cite.** A URL for anything from the web, a table and key for anything
  from the bundled databases. An uncited A finding is a B finding.
- **Name the file and the level**, not just the entry.
- If the correction touches a grammar `pattern`, say so loudly: a pattern
  string is a card id, so changing it is a migration through
  `content/grammar/renames.py`, not an edit.
- **Cap the issue at twelve findings**, worst first. A run that finds
  more has found a systematic problem — describe the pattern, give the
  worst examples, and say how many others look the same.
- If the slice is clean, still file the issue saying so. A run that
  reports nothing is indistinguishable from a run that did not happen.

### If the issue cannot be filed

A scheduled run gets its GitHub access from the Routine, and a Routine
created without connectors fires sessions that have no `mcp__github__*`
tools at all (there is no `gh` CLI here either). A run that discovers it
cannot open an issue must not throw the audit away: write the same
report, unchanged in form, to

    docs/content-audit/reports/<date>-<slice-id>.md

commit it on a branch of its own and push. That is a report about the
content, not a change to it, so Rule 0 still holds — the content files
themselves stay untouched. Say plainly, in the commit message, that the
report was written this way because the issue could not be filed, so the
maintainer knows to fix the Routine's connectors rather than assume this
is how the audit works.

---

## What is out of scope

- Editing anything. See Rule 0. A placement finding proposes a card or a
  level move; it never adds one.
- The learner database. Postgres holds SRS state and review history, not
  taught content; nothing in this audit reads it, and no finding should
  involve a learner's rows.
- Code. If a gate is wrong, or a reading is broken by
  `study/romaji.py` rather than by the data, that is a normal bug: file it
  as one, separately, without the `content-audit` label.
- Anything a learner typed. The audit never reads analytics, dictation
  answers, deck names or any other learner input — see
  `docs/adr/0012`.
