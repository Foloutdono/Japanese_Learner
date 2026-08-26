# Plan 029: 改札口 — the three intakes, and the end of the padding drift

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat de78f11..HEAD -- frontend/src/components/analysis frontend/src/index.css`
> This plan is written against the shell plan 027 creates. If 027 is not
> merged, STOP — the three intake components do not exist yet.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MEDIUM — restyles every input on the screen; one shared-class trap
- **Depends on**: `plans/027-analyzer-one-station-three-platforms.md` (**hard**)
- **Runs in parallel with**: 028 (different half of the screen; both touch
  `AnalyzerScreen.jsx`, so land one, rebase the other)
- **Category**: UX / tech debt
- **Planned at**: commit `de78f11`, 2026-08-26

## Why this matters

The intake is the first thing on the screen and the only part the learner
actually operates. It is currently the least designed part of the app, and the
evidence is specific.

**1. An undefined token, referenced twice, falling back to two different greys.**
`index.css:9795` and `:9833`:

```css
  background: var(--surface-2, rgba(127, 127, 127, 0.08));
  ...
  background: var(--surface-2, rgba(128,128,128,0.12));
```

`--surface-2` is **defined nowhere in this codebase** — `grep -c -- "--surface-2:" index.css` returns `0`. So both rules take their fallback, and the two fallbacks are different greys for what is meant to be the same surface. This is the exact failure the `--surface` token block was written to end:

> Every raised object in the app […] is the same piece of material, and it was
> eleven near-copies […] Several had drifted […] That is how one screen ends up
> looking like it came from a different app.

**2. Dead rules, dead keys, and a comment that now says the opposite of the
code.** All verified at `de78f11`:

| Dead thing | Where | Why it is dead |
|---|---|---|
| `.video-setup__label--upload` | `index.css:9784` | no JSX reference |
| `.video-failed__keep-url` | `index.css:9860` | no JSX reference |
| `.analysis-image-input__vertical-toggle` | `index.css:9737` | plan 024 removed the toggle |
| `.analysis-image-input__low-confidence` | `index.css:9762` | plan 024 removed the state |
| `t.noCaptionTrack` | both locale tables | no JSX reference |

And `index.css:9788-9789` claims:

```css
/* Paste-transcript ingest (plans/025). Sits above upload in the DOM
   because it is the path that works in production -- YouTube blocks
   this backend's datacenter IP for caption fetches, never the player. */
.video-setup__label--paste { margin-top: 20px; }
```

Paste does **not** sit above upload any more — commit `de78f11` demoted it into a
`<details>` *below* the file input. The comment describes a layout that no longer
exists, which is worse than no comment.

**3. A textarea class on a single-line URL input.** `VideoScreen.jsx`:

```jsx
            <input
              type="text"
              value={url}
              ...
              className="phrase-textarea"
            />
```

`.phrase-textarea` is `font-size: 18px` with `resize: vertical` — a property that
does nothing on an `<input>`. A URL field typeset at body-copy size, styled by a
rule named for a different control.

**4. The one raw browser control in an app that styles everything.**

```jsx
            <input
              type="file"
              accept=".srt,.vtt,.ass,.ssa"
              onChange={e => startFromFile(e.target.files?.[0])}
            />
```

No class. On a screen whose neighbours include a hand-drawn station plate and a
departure board, the primary ingest is an unstyled OS button.

**5. The working path is hidden behind a disclosure triangle.** Pasting a
transcript is a first-class ingest — `docs/adr/0003` makes the pipeline
source-agnostic precisely so it can be — and it is inside `<details>`, below a
second `<details>` of `yt-dlp` instructions. Two nested disclosures is not a
hierarchy, it is a filing cabinet.

**6. The window asks a human to do arithmetic.** `Start (seconds)` /
`End (seconds)` with `<input type="number">`. Nobody knows that the bit they want
starts at second 154.

**7. Two controls at opposite ends of an empty row.** `.phrase-input-actions` is
`justify-content: space-between`, so "History" sits hard left and "Analyze" hard
right with the full panel width of nothing between them. The codebase already
made this exact criticism of itself, in `ModeSelector.jsx`:

> the same row at the same width put a six-character title at one end and a
> five-character specimen at the other with five hundred pixels of nothing
> between them.

**8. The primary action is the wrong colour, and the repo has already fixed
this exact bug once.** `.phrase-analyze-btn` is `background: var(--accent)` —
shu-iro vermillion — and after plan 027 it sits directly under a 葡萄色 station
plate. Seen side by side (confirmed by rendering the merged screen, 2026-08-26)
the screen shows two unrelated colour languages at once. That is word-for-word
the defect `--deck-action` was created to fix, `index.css:68-79`:

> It sat directly under the 教材 station plate, which is 蘇芳 — so the one screen
> showed two unrelated colour languages at once and broke the rule every other
> section follows ("one line, one colour").

The fix is the same shape: the analyser's primary action takes the station's own
pigment. **Do not repoint `--accent`, and do not restyle `.phrase-analyze-btn`
itself** — `DeckPicker.jsx` and `ImageCropper.jsx` both use that class outside
this screen. Give the new intake action its own class on `--line-kaiseki`.

**9. Six paddings for one object.** `.card` 15/24, `.phrase-input-card` 20/24,
`.phrase-history-card` 16/24, `.phrase-result-card` 20/24, `.phrase-word-card`
16/20, `.phrase-error-card` 16. Plan 027 introduced the tokens; this plan is
where the intake actually starts using them.

## The design

Each platform's intake is one `.anl-panel` — same material, same padding tokens,
parent-owned gaps — with a shared head (the platform's kanji, and one line saying
what to give it) and a source-specific body.

**1番線 文字 — the writing slip.** An ink slab (`--bg-panel`, the app's one
high-contrast structural surface) carrying a generous serif-JP field that grows
with its content, a 字数 counter set in tabular figures at the bottom right, and
one primary action. History moves out of this row entirely and becomes its own
運行履歴 panel below, under a `SectionHeader` — so the action row holds one
button, at one end, with nothing marooned at the other.

**2番線 写真 — the bench.** Two large intake tiles (撮影 / 選択 — shoot, choose),
side by side above 560px and stacked below it. Picking one opens the existing
cropper. When recognition finishes the text lands in **the same writing slip
component 文字 uses**, carrying a 写 provenance chip and the existing "check the
text" hint — because OCR is wrong sometimes and the learner is the cheapest
corrector available (plan 024's finding, unchanged).

**3番線 動画 — the dock.** A real drop target for `.srt`/`.vtt`/`.ass` (click or
drag), the optional video link as a proper single-line field, and 区間 — the
window — as two time fields that accept `2:30` as readily as `150`, with a live
readout of how much of the five-minute maximum is spent. Paste is promoted out of
its `<details>` to a second tab *inside* the dock; the `yt-dlp` instructions stay
a disclosure, because those genuinely are help.

## Steps

### Step 1 — Locale keys, and the dead one

Add to the `phraseAnalyzer` block in **both** tables; delete `noCaptionTrack`
from **both**.

`en/index.js`:

```js
  intakeTextLead:      'Type or paste anything Japanese.',
  intakePhotoLead:     'A page, a sign, a screenshot — anything with Japanese on it.',
  intakeVideoLead:     'A subtitle file, or a transcript you pasted.',
  shootPhoto:          'Shoot',
  pickPhoto:           'Choose',
  charCount:           n => `${n} characters`,
  dropSubtitles:       'Drop a .srt, .vtt or .ass file here, or choose one',
  subtitleAccepted:    'SRT, VTT and ASS · up to 1 MB',
  windowLabel:         'Section',
  windowFrom:          'From',
  windowTo:            'To',
  windowHint:          m => `${m} of a 5:00 maximum`,
  windowFormatHint:    'mm:ss or seconds',
  ingestFile:          'Subtitle file',
  ingestPaste:         'Paste a transcript',
  historyTitle:        'Recent',
```

`fr/index.js`:

```js
  intakeTextLead:      'Tapez ou collez du japonais.',
  intakePhotoLead:     'Une page, un panneau, une capture — tout ce qui porte du japonais.',
  intakeVideoLead:     'Un fichier de sous-titres, ou une transcription collée.',
  shootPhoto:          'Photographier',
  pickPhoto:           'Choisir',
  charCount:           n => `${n} caractères`,
  dropSubtitles:       'Déposez un fichier .srt, .vtt ou .ass ici, ou choisissez-en un',
  subtitleAccepted:    'SRT, VTT et ASS · jusqu\'à 1 Mo',
  windowLabel:         'Extrait',
  windowFrom:          'De',
  windowTo:            'À',
  windowHint:          m => `${m} sur 5:00 maximum`,
  windowFormatHint:    'mm:ss ou secondes',
  ingestFile:          'Fichier de sous-titres',
  ingestPaste:         'Coller une transcription',
  historyTitle:        'Récent',
```

`charCount`, `windowHint` are functions in both tables — the parity test checks
value types.

**Verify:**

```bash
cd frontend && npm test -- --run src/locales/locales.test.js
```

### Step 2 — `lib/timecode.js`, and its test

Create `frontend/src/lib/timecode.js` — pure, no DOM, no imports:

```js
export function parseTimecode(input)   // '2:30' -> 150, '150' -> 150, '' -> null, junk -> null
export function formatTimecode(seconds) // 150 -> '2:30'
```

Rules, all of which the test must pin:

- `'2:30'` → `150`; `'02:30'` → `150`; `'1:02:03'` → `3723`.
- A bare number is seconds: `'150'` → `150`.
- Empty, whitespace, negative, `NaN` and anything unparseable → `null`. The
  caller decides what to do with `null`; this module never guesses.
- Seconds past 59 in a `m:ss` field (`'2:75'`) → `null`, not `195`. Silently
  accepting it means the field lies about what it read.
- `formatTimecode` pads seconds to two digits and never pads minutes.

Create `frontend/src/lib/timecode.test.js` (node lane — it is `.test.js`, not
`.browser.test.jsx`) covering each rule above, modelled on the existing
`src/lib/ocr.test.js`.

**Verify:**

```bash
cd frontend && npm test -- --run src/lib/timecode.test.js
```

Expected: all passing. Write the test before the parser if you prefer; either
order, both must exist before Step 5 uses it.

### Step 3 — `WritingSlip`, shared by 文字 and 写真

Create `frontend/src/components/analysis/WritingSlip.jsx`: the field both text
and photo intakes submit from.

```jsx
export function WritingSlip({ value, onChange, placeholder, t, provenance, hint, onSubmit, submitLabel, busy })
```

- A `<textarea>` on the ink slab that **grows with its content** — set
  `rows={4}` as the floor and adjust `style.height` from `scrollHeight` on input,
  capped at roughly 40vh so it can never push the action off screen. A fixed
  `rows={3}` is why a pasted paragraph currently scrolls inside a three-line box.
- A 字数 counter, `font-variant-numeric: tabular-nums`, in `--text-on-panel-soft`.
- `provenance` renders the 写 chip when the text came from OCR; `hint` renders
  the existing check-your-text line. Both are optional and neither shifts the
  layout when absent — reserve no space for them, they sit in the flow.
- One action, aligned with the counter. **Not** `justify-content: space-between`
  across the panel.

**Verify:**

```bash
cd frontend && npm run lint
```

### Step 4 — 文字 and 写真

Rewrite `IntakeText.jsx` to render the panel head plus a `WritingSlip`.

Rewrite `IntakePhoto.jsx` as: two intake tiles → (on pick) the existing
`ImageCropper` flow via `ImageInput` → (on `onTextReady`) the same `WritingSlip`
with `provenance="image"`.

`ImageInput.jsx` currently labels its two buttons with `.phrase-history-toggle` —
the *history* class, used as a generic secondary button:

```jsx
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={busy}
          className="phrase-history-toggle"
        >
          {t.takePhoto}
        </button>
```

Replace those two with `.anl-tile` (Step 6). **Keep everything else in
`ImageInput.jsx` exactly as it is** — the two separate file inputs with their
comment, the `reset()` that clears `input.value`, the per-status error messages
(413/429/503), and the object-URL revoke effect. Each of those is a fix that cost
a plan; none of them is a style concern.

Move the history list out of the intake into its own component,
`AnalyzerHistory.jsx`, rendered below the results under
`<SectionHeader jp="運行履歴" title={t.historyTitle} />`.

**History is text and photo only.** There is no list endpoint for video sessions
(`routes/video.py` exposes `POST /api/video/session`, `GET
/api/video/session/{id}` and the explain route — no index). Say so in a comment
in `AnalyzerHistory.jsx` so the next reader does not go looking for a bug:

```jsx
// Typed and photographed Passages only. Video sessions are not listed
// here because the backend has no index for them -- routes/video.py
// exposes a session by id and nothing that enumerates them. Deliberate
// scope, not an omission: see plans/README.md, wave 5 open questions.
```

**Verify:**

```bash
cd frontend && npm run lint && npm test -- --run src/components/analysis
```

Expected: the existing `ImageInput.browser.test.jsx` and
`ImageCropper.browser.test.jsx` still pass. If they fail on a class-name query,
update the query — but if they fail on *behaviour*, you changed something you
were told to keep.

### Step 5 — 動画, the dock

Rewrite `IntakeVideo.jsx`:

- **The stated size limit must match the server.** `routes/video.py:50` is
  `_MAX_UPLOAD_BYTES = 1 * 1024 * 1024` — **1 MB**, not 2. `subtitleAccepted`
  above says 1 MB for that reason. Put the number in one place in the JSX and
  leave a comment naming `routes/video.py:50`, the same way plan 024 tied
  `MAX_UPLOAD_BYTES` to `_MAX_IMAGE_BYTES`. A UI that promises more than the
  server accepts produces a 413 the learner cannot act on.
- **Drop zone.** A labelled area wrapping a visually-hidden `<input type="file">`
  (the `.analysis-image-input__file` clip pattern at `index.css:9745` is the one
  to copy — it hides the input without `display:none`, which would take it out of
  the accessibility tree). Handle `dragover`/`dragleave`/`drop`, call
  `preventDefault` on both `dragover` and `drop`, and accept only the first file.
  A drop that misses must not navigate the browser to the file.
- **Two ingest tabs inside the dock** — 字幕ファイル and 貼り付け — using the same
  roving-tabindex tab pattern `SourceRail` uses. Paste comes out of `<details>`.
- **The link field** gets `.anl-field`, a real single-line input style. Remove
  `.phrase-textarea` from it.
- **区間.** Two text (not `number`) inputs through `parseTimecode`, labelled
  From/To with `windowFormatHint` under them, plus a live `windowHint` readout
  built from `formatTimecode(end - start)`. Keep sending **numbers** to the API —
  `start`/`end` in seconds — because `routes/video.py` parses `float(...)` and
  409s on anything else. Parse at the edge, send numbers.
- Keep `MIN_TRANSCRIPT_CHARS`, `YOUTUBE_ID_RES`, `videoIdFrom` and the
  `ytdlpCommand` builder **exactly as they are**, comments included. The
  one-line-command comment ("a backslash-continued command breaks when pasted
  into PowerShell") is a real bug report.
- The `yt-dlp` block stays a `<details>`, restyled as a 案内 notice.

**Verify:**

```bash
cd frontend && npm run build
```

Then, with the dev server up: drag a `.srt` onto the dock and confirm it starts a
session; drop one outside the dock and confirm the browser does **not** open it.

### Step 6 — CSS: the intake, and the cleanup

Append the new rules after plan 027's block.

```css
/* ── 改札口 — the intakes (plan 029) ───────────────────────
   One material, one rhythm. Every padding here is a token from the
   .analyzer block; if you find yourself typing a px pair, stop and
   ask which token you meant. */
.anl-intake__head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: var(--anl-gap);
}
.anl-intake__jp {
  font-family: 'Noto Serif JP', serif;
  font-weight: 700;
  font-size: 1.1rem;
  letter-spacing: 0.1em;
}
.anl-intake__lead { color: var(--text-secondary); font-size: 0.86rem; }

/* 文字 — the writing slip. Sumi ink, the app's one high-contrast
   structural surface (see the --bg-panel note in the token block),
   so the thing you are about to hand over reads as a physical slip
   rather than another panel. */
.anl-slip {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: var(--anl-pad-block) var(--anl-pad-inline);
  background: var(--bg-panel);
  border-radius: var(--anl-radius);
}
.anl-slip__field {
  width: 100%;
  min-height: 6.5rem;
  max-height: 40vh;
  padding: 0;
  background: none;
  border: none;
  resize: none;
  color: var(--text-on-panel);
  font-family: var(--font-jp);
  font-size: clamp(1rem, 0.85rem + 0.5vw, 1.2rem);
  line-height: 1.9;
}
.anl-slip__field::placeholder { color: var(--text-on-panel-soft); }
.anl-slip__field:focus { outline: none; }
/* The focus ring goes on the slip, not the borderless field inside
   it — otherwise focus is invisible, which plan 005 exists to
   prevent. */
.anl-slip:focus-within {
  outline: 2px solid var(--line-kaiseki);
  outline-offset: 2px;
}
.anl-slip__foot {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 14px;
}
.anl-slip__count {
  font-family: var(--font-display);
  font-size: 0.7rem;
  font-variant-numeric: tabular-nums;
  color: var(--text-on-panel-soft);
}

/* 写真 — the two intake tiles. Side by side, stacked on a phone. */
.anl-tiles {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--anl-gap);
}
.anl-tile {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: clamp(18px, 2vw + 10px, 30px) 12px;
  background: var(--surface);
  border: 1px solid var(--surface-line);
  border-radius: var(--anl-radius);
  color: var(--text-primary);
  transition: background 0.16s ease, border-color 0.16s ease;
}
.anl-tile:hover {
  background: var(--bg-card-hover);
  border-color: color-mix(in srgb, var(--line-kaiseki) 45%, var(--surface-line));
}
.anl-tile__jp { font-family: 'Noto Serif JP', serif; font-weight: 700; font-size: 1.05rem; letter-spacing: 0.08em; }
.anl-tile__latin {
  font-family: var(--font-display);
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--text-secondary);
}

/* 動画 — the dock's drop target. */
.anl-drop {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: clamp(24px, 3vw + 12px, 44px) var(--anl-pad-inline);
  border: 1px dashed color-mix(in srgb, var(--line-kaiseki) 50%, var(--surface-line));
  border-radius: var(--anl-radius);
  background: var(--surface);
  text-align: center;
  transition: background 0.16s ease, border-color 0.16s ease;
}
.anl-drop--over {
  background: var(--bg-card-hover);
  border-color: var(--line-kaiseki);
  border-style: solid;
}
.anl-drop__note { font-size: 0.74rem; color: var(--text-secondary); }

/* A real single-line field. Was .phrase-textarea — an 18px textarea
   rule, resize: vertical and all, on an <input type="text">. */
.anl-field {
  width: 100%;
  padding: 10px 12px;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-radius: var(--anl-radius);
  color: var(--text-on-panel);
  font-size: 0.92rem;
}

/* 区間 — the window. Two time fields and a readout, not two number
   spinners labelled "(seconds)". */
.anl-window {
  display: flex;
  align-items: flex-end;
  gap: var(--anl-gap);
  flex-wrap: wrap;
}
.anl-window__field { display: flex; flex-direction: column; gap: 4px; min-width: 92px; }
.anl-window__label {
  font-size: 0.68rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-secondary);
}
.anl-window__readout {
  font-family: var(--font-display);
  font-size: 0.72rem;
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
}

/* 案内 — an on-screen notice (the yt-dlp help). */
.anl-notice {
  padding: var(--anl-pad-block) var(--anl-pad-inline);
  background: var(--surface);
  border: 1px solid var(--surface-line);
  border-radius: var(--anl-radius);
  font-size: 0.86rem;
  line-height: 1.55;
}

@media (max-width: 560px) {
  .anl-tiles { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) {
  .anl-tile,
  .anl-drop { transition: none; }
}
```

**Then the deletions.** Remove these rules from `index.css` — each verified
unreferenced at `de78f11`, and re-verify before deleting:

```bash
grep -rn "video-setup__label--upload\|video-failed__keep-url\|analysis-image-input__vertical-toggle\|analysis-image-input__low-confidence" frontend/src --include=*.jsx
```

Expected: no output. Then delete those four rules.

**And the undefined token.** Replace both `var(--surface-2, ...)` references
(`index.css:9795`, `:9833`) with `var(--surface)` — the token that exists and
means exactly this. Do **not** define `--surface-2`; a second surface token with
no stated purpose is how the first drift started.

Finally, delete the stale comment at `index.css:9787-9789` (the one claiming
paste "sits above upload in the DOM"). Paste is now a tab in the dock; if you
keep a comment there, make it say that.

**Verify:**

```bash
cd frontend && npm run build && npm test -- --run && npm run lint
```

### Step 7 — Sweep for orphans

Any `.video-setup__*`, `.video-transcript*` or `.phrase-input-card` rule with no
remaining consumer after plans 027–029 should go in this step, not linger.

```bash
for c in $(grep -o '^\.[a-z-]*__\?[a-z-]*' frontend/src/index.css | sort -u | grep -E 'video-setup|video-transcript|video-failed|phrase-input|phrase-history'); do \
  n=$(grep -rl "${c#.}" frontend/src --include=*.jsx | wc -l); \
  [ "$n" = "0" ] && echo "DEAD: $c"; done
```

Delete what it names, **except** `.phrase-history-row`, `.phrase-history-empty`,
`.phrase-history-toggle`, `.phrase-input-actions` and `.phrase-analyze-btn` —
those are used by `DeckPicker.jsx` and `ImageCropper.jsx`, which live outside this
screen's markup. Confirm with `grep -rn` before removing anything.

**Verify:**

```bash
cd frontend && npm test -- --run && npm run lint && npm run build
```

## STOP conditions

- **`grep -c -- "--surface-2:" frontend/src/index.css` returns anything but 0
  after your edit.** You defined the token instead of removing the reference.
- **A dead-class sweep wants to delete `.phrase-analyze-btn`,
  `.phrase-history-toggle`, `.phrase-input-actions`, `.phrase-history-row` or
  `.phrase-history-empty`.** They are used by `DeckPicker.jsx` and
  `ImageCropper.jsx`. Deleting them silently unstyles the deck picker inside the
  mining flow.
- **`ImageInput.browser.test.jsx` fails on behaviour** (not on a selector). You
  changed a fix that cost a plan — the two separate file inputs, the input
  `value` reset, the 413/429/503 messages, or the object-URL revoke.
- **The window fields send strings to the API.** `routes/video.py` does
  `float(form.get("start", 0))` and raises 400 on a non-number. Parse in the UI,
  send numbers.
- **Dropping a file outside the drop zone navigates the browser to it.** You are
  missing `preventDefault` on the document-level `dragover`.

## Boundaries

**In scope**: `IntakeText.jsx`, `IntakePhoto.jsx`, `IntakeVideo.jsx`,
`WritingSlip.jsx`, `AnalyzerHistory.jsx`, `lib/timecode.js` + its test, the two
button class names inside `ImageInput.jsx`, both locale tables, and `index.css`
(additive plus the named deletions).

**Out of scope**: `ImageCropper.jsx` (it works; plan 024 tested it),
`ImageInput.jsx`'s logic, `SentenceBreakdown.jsx` and everything it renders,
`VideoPlayer.jsx`, `PassageLine.jsx`/`NextStop.jsx` (that is 028), `lib/ocr.js`,
`lib/image.js`, and every backend file.

Do not touch `.card` itself. Six screens outside this one depend on it; unifying
the app's card padding is a real finding but a different plan's.

## Done criteria

```bash
cd frontend && npm test -- --run && npm run lint && npm run build
```

- All tests pass, lint 0 errors, build clean.
- `grep -c -- "--surface-2" frontend/src/index.css` → `0`.
- `grep -rn "noCaptionTrack" frontend/src` → no output.
- `grep -n "phrase-textarea" frontend/src/components/analysis/IntakeVideo.jsx` →
  no output.
- The 動画 panel shows a styled drop target — no raw OS file button anywhere on
  the screen.
- Every padding declaration added by this plan is either a token or a `clamp()`
  with a comment; no bare px pairs.

## Test plan

Automated: Step 2's `timecode.test.js`, plus the existing `ImageInput` and
`ImageCropper` browser tests continuing to pass.

Manual:

1. 文字: paste a 300-character paragraph. The slip **grows**; it does not scroll
   inside three lines. The counter tracks. The action stays reachable.
2. Tab to the slip. The focus ring is on the slip, clearly visible in both
   themes.
3. 写真: on a phone, Choose opens the gallery and Shoot opens the camera (this is
   plan 024's fix — confirm it survived). Recognized text lands in the slip with
   the 写 chip.
4. 動画: drag a `.srt` onto the dock → it highlights, then starts. Drag one to the
   page margin and release → nothing happens, and the browser does not open it.
5. 区間: type `2:30` and `4:00` → the readout says `1:30 of a 5:00 maximum`, and
   the request body carries `150` and `240`.
6. Type `2:75` → the field reports it as unparseable rather than accepting `195`.
7. Switch the dock to 貼り付け → the paste panel is a peer of the file tab, not a
   disclosure inside one.
8. Both themes, at 360px and at 1440px: no element touches a panel edge, and no
   two adjacent panels have visibly different inner padding.

## Maintenance note

The padding tokens are the point. A new control on this screen takes
`var(--anl-pad-block) var(--anl-pad-inline)` and its parent's `gap`; if it needs
something else, that is a signal the parent is wrong, not that the child needs a
margin.

`parseTimecode` returning `null` for `'2:75'` is deliberate, and the kind of
thing a later "improvement" will helpfully relax. The test is the guard.

`--surface-2` will come back the next time someone wants "a slightly different
panel". The answer is `--surface` with a different border, or a real token added
to the block with a comment saying what it is for.

Watch in review: `.phrase-textarea` on anything that is not a `<textarea>`, any
new `justify-content: space-between` on a two-control row, and any px padding
pair that should have been a token.
