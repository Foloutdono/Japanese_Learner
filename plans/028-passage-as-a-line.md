# Plan 028: 路線図 — the Passage as a line

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat de78f11..HEAD -- frontend/src/components/analysis frontend/src/components/video frontend/src/screens/AnalyzerScreen.jsx`
> This plan is written against the shell plan 027 creates. If 027 is not
> merged, STOP — nothing here has a file to edit.

## Status

- **Priority**: P0
- **Effort**: L
- **Risk**: MEDIUM — replaces the results half of the screen for all three sources
- **Depends on**: `plans/027-analyzer-one-station-three-platforms.md` (**hard**)
- **Runs in parallel with**: 029 (different half of the screen; both touch
  `AnalyzerScreen.jsx`, so land one, rebase the other)
- **Category**: UX
- **Planned at**: commit `de78f11`, 2026-08-26

## Why this matters

**The two screens answer "what did I just give you" in two incompatible ways,
and both answers are bad.**

*Text and photo stack everything.* `PhraseAnalyzerScreen.jsx` renders a full
breakdown per Sentence, one after another:

```jsx
        {sentences && sentences.map((s, i) => (
          <Fragment key={i}>
            ...
                <SentenceBreakdown
                  analysis={s}
                  t={t}
                  layout="list"
```

Each `SentenceBreakdown` in `layout="list"` renders a result card, **a status
legend**, and one `TokenCard` per Token. A photo of a page is roughly ten
Sentences, so that is ten result cards, ten legends and perhaps eighty token
cards down one column. The legend duplication is not a figure of speech —
`SentenceBreakdown.jsx:181` renders `<Legend t={t} />` inside the per-Sentence
branch, and `.status-legend` carries `margin-bottom: 20px`, so a ten-Sentence
Passage prints the same six colour swatches ten times and spends 200px of
vertical space doing it.

*Video shows one Sentence and a flat list.* `Transcript.jsx` renders every
Sentence as an undifferentiated row. It works, but it is a scrolling list of
Japanese text with no sense of extent, position, or which rows are worth
stopping at.

**And the app's own highest-value signal is invisible in both.** `CONTEXT.md`:

> **i+1** — a Sentence with exactly one unknown Token: comprehensible except for
> a single step. The highest-value thing to study, and the signal the Sentence
> bank is sorted by.

In the text analyzer, i+1 is a badge on a card you have to scroll to. In the
video transcript it is a small `i+1` chip in a list. Neither lets you *see, at a
glance, which parts of what you brought in are the ones worth your attention* —
which is the entire question the screen exists to answer.

**The app already has the right drawing for this.** `LevelSelector.jsx` renders
the JLPT levels as a 路線図 — the stopping-pattern diagram that hangs in every
train car — and its own comment says why:

> It is a route map rather than a list of five rows because that is genuinely
> what these are — an ordered line you travel from one end of, where the distance
> between the first stop and the last is the whole point. A list says "pick one
> of five". A line says "this is how far it goes".

A Passage is exactly that: an ordered line you travel from one end of. For video
it is literally a line with a train on it. This plan draws it.

## The design

```
┌──────────────────────┬─────────────────────────────────────┐
│ 路線図                │  [ video player, when there is one ] │
│ ●─ 1  0:04           │  ─────────────────────────────────── │
│ │                    │  現在の停車駅                          │
│ ◉─ 2  0:11   i+1     │  <SentenceBreakdown layout="list"/>   │
│ │                    │  [ Explain — deep tier, this one ]    │
│ ●─ 3  0:19           │  ─────────────────────────────────── │
│ │                    │  次は  3  この本は…            ▶      │
│ ●─ 4  0:26           │                                      │
└──────────────────────┴─────────────────────────────────────┘
```

- **The line** is every Sentence in the Passage as a stop, in order, threaded by
  one rail in the station's colour. i+1 stops are marked on the line itself, so
  "where is the good stuff" is answered without scrolling.
- **The current stop** is one `SentenceBreakdown` — the component as it exists
  today, unchanged, rendered once instead of N times. One legend, not ten.
- **次は** is the in-car next-stop display: the following Sentence's opening
  characters and a way to advance. It is the single most recognisable piece of
  Japanese in-train information design, and here it is also the answer to "how do
  I read this passage straight through".
- **For video**, the active stop is the train's position: playback moves it, and
  clicking a stop seeks. Timestamps are the one place `--line-douga` (鶯色) is
  spent — the only data that exists for that source and no other.

One deliberate exception: **a Passage of one Sentence draws no line.** A route
diagram with a single stop is a joke at the reader's expense. Below the
threshold, the breakdown takes the full column.

## Current state

`frontend/src/components/video/Transcript.jsx` in full — this is what the line
replaces, and its three behaviours (a row per Sentence, an active one, an i+1
flag) are exactly the three the new component must keep:

```jsx
export function Transcript({ sentences, activeIndex, onSeek, t }) {
  return (
    <div className="video-transcript">
      {sentences.map((s, i) => (
        <div
          key={i}
          onClick={() => onSeek(i)}
          className={`video-transcript__row${i === activeIndex ? ' video-transcript__row--active' : ''}`}
        >
          {s.unknown_count === 1 && (
            <span className="video-transcript__i-plus-one" title={t.iPlusOne ?? 'One step beyond you'}>
              i+1
            </span>
          )}
          <span className="video-transcript__text" lang="ja">{s.text}</span>
        </div>
      ))}
    </div>
  )
}
```

Note what it is *not*: not a `<button>`, so it is unreachable by keyboard and
invisible to a screen reader as a control. The replacement fixes that.

The rail vocabulary to reuse, `index.css:2742-2812` (abridged):

```css
.route-stop {
  --rail: var(--line-color, var(--accent));
  position: relative;
  display: flex;
  align-items: center;
  gap: 18px;
  width: 100%;
  padding: 26px 0 26px 66px;
  ...
}
.route-stop__rail {
  position: absolute;
  left: 29px;
  top: calc(-1px - var(--route-gap));
  bottom: calc(-1px - var(--route-gap));
  width: 4px;
  background: color-mix(in srgb, var(--line-color, var(--accent)) 55%, transparent);
}
.route-stop--first .route-stop__rail { top: 50%; border-radius: 2px 2px 0 0; }
.route-stop--last  .route-stop__rail { bottom: 50%; border-radius: 0 0 2px 2px; }
```

The rail is drawn *per stop* and bleeds into the gap above and below, which is
what keeps the line unbroken between cards. Reuse that technique exactly; a
single absolutely-positioned rail behind the list breaks the moment the list
scrolls independently, which in this screen it does.

## Steps

### Step 1 — Locale keys

Add to the `phraseAnalyzer` block in **both** locale tables. Two keys already
exist and are currently dead — `seekToSentence` and `noCaptionTrack` are defined
in both tables and referenced by no JSX. `seekToSentence` becomes live in this
plan; leave `noCaptionTrack` alone (plan 029 decides its fate).

`en/index.js`:

```js
  routeMap:            'Route map',
  currentStop:         'Current stop',
  nextStop:            'Next',
  stopsInPassage:      n => `${n} ${n === 1 ? 'sentence' : 'sentences'}`,
  jumpToStop:          'Go to this sentence',
```

`fr/index.js`:

```js
  routeMap:            'Plan de ligne',
  currentStop:         'Arrêt actuel',
  nextStop:            'Prochain',
  stopsInPassage:      n => `${n} phrase${n === 1 ? '' : 's'}`,
  jumpToStop:          'Aller à cette phrase',
```

`stopsInPassage` is a **function** in both tables. The parity test asserts
matching value types, so a plain string on one side fails it — which is the test
doing its job.

**Verify:**

```bash
cd frontend && npm test -- --run src/locales/locales.test.js
```

### Step 2 — `PassageLine`

Create `frontend/src/components/analysis/PassageLine.jsx`.

```jsx
export function PassageLine({ sentences, activeIndex, onSelect, t, orientation = 'vertical' })
```

Behaviour, all of it required:

- One stop per Sentence, in order. Each stop is a **`<button type="button">`** —
  the thing `Transcript`'s `<div onClick>` was not — carrying
  `aria-current={i === activeIndex ? 'true' : undefined}` and
  `title={t.jumpToStop}`.
- Each stop shows: a marker on the rail, the Sentence's opening text truncated to
  one line (`text-overflow: ellipsis`, never a JS substring — a hard character
  count cuts mid-grapheme and looks broken in Japanese), an i+1 flag when
  `unknown_count === 1`, and a timestamp when `cue_start != null`.
- `--route-gap` is set smaller here than in the level picker: a Passage can have
  fifty stops where the JLPT line has five.
- `orientation="strip"` renders the same data as a horizontal, scrollable
  stopping-pattern band — the strip above a train door. Plan 030 is where it is
  actually used responsively; build both here and render `vertical` for now.
- **The active stop scrolls itself into view** when `activeIndex` changes
  (video playback moves it without a click). Use
  `el.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion ? 'auto' : 'smooth' })`
  and read the preference with
  `window.matchMedia('(prefers-reduced-motion: reduce)').matches` — do not
  hard-code `'smooth'`. Reduced-motion coverage is a convention here; plan 007
  exists for it and `index.css` carries twelve such blocks.

Formatting a timestamp: `m:ss` from `cue_start` seconds. Write it as a small
local helper, not a dependency.

**Verify:**

```bash
cd frontend && npm run lint
```

### Step 3 — Retarget the Transcript test

`frontend/src/components/video/Transcript.browser.test.jsx` has three cases that
map one-to-one onto `PassageLine`. `git mv` it to
`frontend/src/components/analysis/PassageLine.browser.test.jsx`, point it at the
new component, and update the selectors:

| Old assertion | New assertion |
|---|---|
| `.video-transcript__row` count | `.anl-stop` count |
| `--active` class on row 1 | `aria-current="true"` on stop 1 |
| `onSeek` called with `1` | `onSelect` called with `1` |
| one `.video-transcript__i-plus-one` | one `.anl-stop__iplus` |

Add a fourth case: **a stop is a button and is reachable by keyboard** —
`screen.container.querySelectorAll('button.anl-stop').length === sentences.length`.
That is the accessibility defect this component fixes, and without a test it
regresses the first time somebody "simplifies" the markup.

Then delete `frontend/src/components/video/Transcript.jsx`. Check for other
importers first:

```bash
grep -rn "components/video/Transcript" frontend/src
```

Expected after the change: no matches.

**Verify:**

```bash
cd frontend && npm test -- --run src/components/analysis/PassageLine.browser.test.jsx
```

Expected: 4 passing.

### Step 4 — `NextStop`

Create `frontend/src/components/analysis/NextStop.jsx`: a single full-width
button rendered under the focused breakdown.

```
次は  ▸  3   この本はとても…                                    ▶
```

- Renders nothing at all when the focused Sentence is the last one. An inert
  "next" control at the end of a line is worse than no control.
- `次は` in `--font-jp`, the plain-language label from `t.nextStop` beneath or
  beside it — the same Japanese-plus-plain pairing `NextService`, `SectionHeader`
  and every station plate already use. `NextService.jsx` has the exact pattern to
  copy:

  ```jsx
        <span className="next-service__name">
          <span className="next-service__jp" lang="ja">本日の運行</span>
          <span className="next-service__latin">{t.todayTitle}</span>
        </span>
  ```

- Clicking calls `onAdvance()`, which sets `focusIndex + 1` — and, for a video
  Passage, seeks the player, because the two must not disagree about where you
  are.

**Verify:**

```bash
cd frontend && npm run lint
```

### Step 5 — Wire the results half of `AnalyzerScreen`

Replace the results block plan 027 left in place. The shape:

```jsx
{analyzer.status === 'ready' && analyzer.passage && (
  <div className="anl-results">
    {passage.sentences.length > 1 && (
      <PassageLine
        sentences={passage.sentences}
        activeIndex={analyzer.focusIndex}
        onSelect={goToStop}
        t={t}
      />
    )}
    <div className="anl-stage">
      {passage.videoId && <VideoPlayer ref={playerRef} videoId={passage.videoId} onTimeUpdate={handleTimeUpdate} />}
      <SectionHeader jp="現在の停車駅" title={t.currentStop} count={...} />
      <SentenceBreakdown analysis={focused} t={t} layout="list" ... />
      {!focused.explanation && <ExplainRow ... />}
      <NextStop ... />
    </div>
  </div>
)}
```

Five things to get right:

1. **`goToStop(i)`** sets `focusIndex` and, when the Passage is a video one,
   calls `playerRef.current?.seekTo(sentence.cue_start)` then `play()`. Lift this
   straight from `VideoScreen.jsx`'s `seekTo`.
2. **`handleTimeUpdate`** stays exactly as it is in `VideoScreen.jsx`, including
   the `idx === -1 ? prev : idx` guard — that guard is what stops the focus
   snapping back to stop 0 during the silence between cues.
3. **Tapping a word still pauses playback.** `openVocabDetail`/`openKanjiDetail`
   call `playerRef.current?.pause()` when a player exists. Looking something up
   is a deliberate break from watching.
4. **`focusIndex` resets to 0** on every new Passage, and must be clamped on
   every read: `Math.min(focusIndex, sentences.length - 1)`. Loading a
   two-Sentence history entry while sitting on stop 9 of a previous Passage is
   otherwise an out-of-range read, which is precisely the failure class that
   produced this feature's white screen.
5. **The `available === false` Sentence** still renders its own error card rather
   than a breakdown — carry that branch over from `PhraseAnalyzerScreen.jsx`.

Delete the per-Sentence `<Fragment>` map. It is what this plan exists to remove.

**Verify:**

```bash
cd frontend && npm run build
```

### Step 6 — CSS

Append to `index.css` after plan 027's block. **Additive, except for one
deletion, called out below.**

```css
/* ── 路線図 — the Passage as a line (plan 028) ─────────────
   Every Sentence is a stop, in order, on one rail. Same drawing as
   LevelSelector's JLPT line and for the same stated reason: a list
   says "pick one of these", a line says "this is how far it goes".

   Tighter than that one on purpose — a JLPT line has five stops and
   a five-minute video window can have fifty. */
.anl-line {
  --route-gap: 10px;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--route-gap);
}

.anl-stop {
  position: relative;
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px 10px 44px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--anl-radius);
  color: var(--text-secondary);
  text-align: left;
  transition: background 0.14s ease, color 0.14s ease;
}
.anl-stop:hover { background: var(--overlay-hover); color: var(--text-primary); }

/* Drawn per stop and bled into the gap above and below, so the line
   stays unbroken between them — the technique .route-stop__rail
   uses, and the reason a single rail behind the list will not do:
   this list scrolls independently of the page. */
.anl-stop__rail {
  position: absolute;
  left: 19px;
  top: calc(-1px - var(--route-gap));
  bottom: calc(-1px - var(--route-gap));
  width: 3px;
  background: color-mix(in srgb, var(--line-color, var(--line-kaiseki)) 45%, transparent);
}
.anl-stop--first .anl-stop__rail { top: 50%; border-radius: 2px 2px 0 0; }
.anl-stop--last  .anl-stop__rail { bottom: 50%; border-radius: 0 0 2px 2px; }

.anl-stop__marker {
  position: absolute;
  left: 14px;
  top: 50%;
  width: 12px;
  height: 12px;
  margin-top: -6px;
  border-radius: 50%;
  background: var(--bg-card);
  border: 3px solid var(--line-color, var(--line-kaiseki));
  transition: transform 0.15s ease, background 0.15s ease;
}

/* 現在地 — you are here. The one filled marker on the line. */
.anl-stop[aria-current="true"] {
  background: var(--surface);
  border-color: color-mix(in srgb, var(--line-color, var(--line-kaiseki)) 50%, var(--surface-line));
  color: var(--text-primary);
}
.anl-stop[aria-current="true"] .anl-stop__marker {
  background: var(--line-color, var(--line-kaiseki));
  transform: scale(1.25);
}

.anl-stop__text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-family: var(--font-jp);
  font-size: 0.9rem;
}

/* 鶯色 — the video source's own colour, spent on the one piece of
   data only a video Sentence has. See the --line-douga note in the
   token block. */
.anl-stop__time {
  flex-shrink: 0;
  font-family: var(--font-display);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  font-variant-numeric: tabular-nums;
  color: var(--line-douga);
}

.anl-stop__iplus {
  flex-shrink: 0;
  font-family: var(--font-display);
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 1px 5px;
  border-radius: 3px;
  color: var(--success);
  border: 1px solid color-mix(in srgb, var(--success) 45%, transparent);
}

/* 次は — the in-car next-stop display. */
.anl-next {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: var(--anl-pad-block) var(--anl-pad-inline);
  background: var(--bg-panel);
  border: none;
  border-radius: var(--anl-radius);
  color: var(--text-on-panel);
  text-align: left;
}
.anl-next__jp {
  font-family: var(--font-jp);
  font-weight: 700;
  font-size: 0.85rem;
  letter-spacing: 0.14em;
  color: var(--text-on-panel-soft);
}
.anl-next__text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  font-family: var(--font-jp);
}
.anl-next__go { flex-shrink: 0; color: var(--line-kaiseki); }

@media (prefers-reduced-motion: reduce) {
  .anl-stop,
  .anl-stop__marker { transition: none; }
}
```

**The one deletion.** Remove `index.css:9670-9677` entirely:

```css
.phrase-explain-row {
  ...
  margin: -12px 0 24px;
  ...
}
```

Its only consumer was the per-Sentence map this plan deletes. The Explain control
now lives inside `.anl-stage`, whose parent owns the gap, so there is nothing
left for a negative margin to correct. Grep first to be sure:

```bash
grep -rn "phrase-explain-row\|phrase-explain-hint" frontend/src
```

Expected: matches only in `index.css` before your edit, and none after you have
moved the markup.

**Verify:**

```bash
cd frontend && npm run dev
```

Analyze a multi-sentence passage. Expected: one line diagram, one breakdown, one
legend, one 次は strip.

## STOP conditions

- **`SentenceBreakdown.jsx` needs a change to make this work.** It does not —
  the focused Sentence is rendered with the same `layout="list"` call the old
  screen used. If you are editing it, you are about to change `ReadingScreen`
  too. Stop and re-read the boundaries.
- **The line renders for a one-Sentence Passage.** The threshold is
  `sentences.length > 1`; a one-stop route diagram is not a design, it is a bug
  that looks like a design.
- **Video playback and the focused stop disagree** — clicking stop 5 plays stop 5
  but the breakdown shows stop 3, or vice versa. `goToStop` and `handleTimeUpdate`
  are fighting. Fix before continuing; a subtitle screen where the text and the
  audio are different sentences is worse than no screen.
- **`focusIndex` is read without clamping.** Search for `sentences[focusIndex]`
  with no `Math.min`. This is the exact shape of the crash in `plans/README.md`'s
  execution note.
- **You reach for `behavior: 'smooth'` unconditionally.** Guard it on
  `prefers-reduced-motion`.

## Boundaries

**In scope**: `PassageLine.jsx`, `NextStop.jsx` (both new), the moved
`PassageLine.browser.test.jsx`, the results half of `AnalyzerScreen.jsx`, the
deleted `components/video/Transcript.jsx`, both locale tables, and additive CSS
plus the single documented deletion.

**Out of scope**, unchanged in this plan: `SentenceBreakdown.jsx`,
`TokenCard.jsx`, `WordDetail.jsx`, `MineButton.jsx`, `GrammarChips.jsx`,
`LevelBadge.jsx`, `VideoPlayer.jsx`, every intake component (that is 029), every
`.phrase-*` and `.analysis-*` rule other than the one deletion, and all backend
files.

The duplicated-`<Legend>` defect is **fixed by this plan as a side effect** —
rendering one Sentence renders one legend — not by editing `SentenceBreakdown`.
Do not "fix it properly" by moving `Legend` out; `ReadingScreen`'s stepper layout
depends on the current arrangement.

## Done criteria

```bash
cd frontend && npm test -- --run && npm run lint && npm run build
```

- All tests pass (including the four in `PassageLine.browser.test.jsx`), lint 0
  errors, build clean.
- A ten-Sentence Passage renders **one** `.status-legend`, not ten:
  in the browser console, `document.querySelectorAll('.status-legend').length`
  → `1`.
- `grep -rn "video-transcript" frontend/src` → matches only in `index.css`
  (the dead rules are removed in plan 029, not here).
- Every stop is a `<button>`: `document.querySelectorAll('.anl-stop:not(button)').length`
  → `0`.

## Test plan

Automated: Step 3's four cases.

Manual:

1. **Text, one Sentence**: 猫が好きです → breakdown, **no line**, no 次は.
2. **Text, many Sentences**: paste four sentences → a line of four stops, stop 1
   focused, one legend on screen.
3. Click stop 3 → the breakdown changes, the marker moves, 次は now offers 4.
4. On the last stop, 次は is **absent**, not disabled-and-present.
5. **Video**: upload a `.srt` with several cues and a video link. Play. The
   active stop advances by itself and scrolls itself into view. Click stop 6 →
   the player seeks there.
6. Tap a word mid-playback → the player pauses and `WordDetail` opens.
7. Keyboard only: Tab into the line, Enter on a stop → it focuses. Nothing is
   reachable by mouse alone.
8. With OS "reduce motion" on, repeat 5 — the list jumps rather than glides, and
   nothing animates.

## Maintenance note

`focusIndex` is now the screen's single cursor, shared by the line, the
breakdown, 次は and the player. Every read of it must be clamped against the
current Passage's length — a Passage can be replaced under it (a new analysis, a
history entry) while it holds a stale value. That is the same class of bug as the
202 white screen: a stale index into a shorter array.

The line and the player are two views of one position. If a third ever appears
(a minimap, a progress bar), it reads `focusIndex` — it does not keep its own.

Watch in review: any `substring`/`slice` used to truncate Japanese for a stop
label (use CSS ellipsis), any reintroduction of a per-Sentence `SentenceBreakdown`
map, and any negative margin.
