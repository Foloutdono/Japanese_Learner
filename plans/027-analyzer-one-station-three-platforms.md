# Plan 027: 解析駅 — one station, three platforms

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**:
> `git diff --stat de78f11..HEAD -- frontend/src/screens/PhraseAnalyzerScreen.jsx frontend/src/screens/VideoScreen.jsx frontend/src/config frontend/src/App.jsx frontend/src/locales`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P0
- **Effort**: L
- **Risk**: MEDIUM-HIGH — replaces two live routes with one
- **Depends on**: nothing
- **Blocks**: 028, 029, 030 (all three build on the shell this creates)
- **Category**: architecture / UX
- **Planned at**: commit `de78f11`, 2026-08-26

## Why this matters

**Two screens do one job.** `PhraseAnalyzerScreen` and `VideoScreen` both take
Japanese from the world, split it into Sentences, render each with
`SentenceBreakdown`, buy the deep tier one Sentence at a time, mine tokens into
decks, and open `WordDetail`. The only real difference is where the text came
from.

The duplication is not a suspicion, it is verbatim. Both screens hold the same
state under the same names:

```jsx
  const [explaining, setExplaining] = useState({})
  const [detail, setDetail]     = useState(null)
  const closeDetail = useCallback(() => setDetail(null), [])
```

Both carry the *same comment* explaining why `closeDetail` is a `useCallback`.
Both define `openVocabDetail`/`openKanjiDetail` with identical bodies apart from
one line (`playerRef.current?.pause()` in the video one). Both define an
`explainSentence` differing only in which endpoint it calls. A bug fixed in one
is a bug still live in the other — which is exactly what happened with the HTTP
202 white-screen (`plans/README.md`, "Execution notes").

**The app's own vocabulary already says this is one screen.** `CONTEXT.md`:

> **Passage** — what the user submits for analysis, as one act: typed text, a
> photo, a video window, or a reading-practice phrase. A Passage has a
> **source** naming where it came from.

One noun, four sources, one `source` field. The domain model was merged before
the UI was.

**The departure board carries two destinations for one idea.** 解析 and 動画 sit
as separate rows among twelve. 動画 has never even had an announcement clip —
`frontend/public/sounds/announcements/` contains `phrase-analyzer.wav` but no
`video.wav`, so departing for 動画 has always played the jingle and then
silence. A section the app never learned to say out loud is a section that was
bolted on.

This plan does the **structural** merge and nothing else: one station, three
platforms, today's markup moved inside. The screen looks broadly as it does now
when this plan lands. Plans 028–030 do the redesign on top of the frame this
builds. That split is deliberate — merging two routes and restyling them in one
step would make a regression impossible to attribute.

## Current state

`frontend/src/App.jsx:144-145`:

```jsx
          <Route path="/phrase-analyzer"      element={<PhraseAnalyzerScreen session={session} />} />
          <Route path="/video"                element={<VideoScreen session={session} />} />
```

`frontend/src/config/stations.js:47-48`:

```js
  '/phrase-analyzer':       { code: 'KS', kana: 'かいせき' },
  '/video':                 { code: 'DG', kana: 'どうが' },
```

`frontend/src/config/navLinks.js:39` and `:43` hold the two board rows —
`icon: '解析'` on `--line-kaiseki`, and `icon: '動画'` on `--line-douga`.

`frontend/src/screens/HomeScreen.jsx:143-144` — how a board row finds its clip:

```jsx
  function depart(section) {
    playAnnouncement(section.path.slice(1))
```

and `frontend/src/lib/audio/playback.js:15`:

```js
const ANNOUNCEMENT = name   => `/sounds/announcements/${name}.wav`
```

So **the route path is the announcement filename.** Changing the path without
renaming the clip silently removes the station's voice. That is the single
easiest thing to get wrong in this plan.

## The design this wave implements

Read this section once before Step 1; plans 028–030 assume it.

**解析駅 is a transfer station.** Three lines used to run into this idea from
different directions; now they terminate at one station and you pick a platform:

| 番線 | 平仮名 | Source | What it takes |
|------|--------|--------|---------------|
| 1番線 | もじ | 文字 / TEXT | typed or pasted Japanese |
| 2番線 | しゃしん | 写真 / PHOTO | a photo or screenshot, OCR'd |
| 3番線 | どうが | 動画 / VIDEO | a subtitle file or pasted transcript |

**One line, one colour.** The station keeps `--line-kaiseki` (葡萄色, grape) for
everything structural: the plate, the platform rail, the primary actions, the
route diagram in plan 028. `--line-douga` (鶯色, uguisu) is **retired as a board
line** and survives in exactly one role — the **timestamp chips on video
Sentences**, the one piece of data that exists for that source and no other. One
colour, one meaning; the rule the `--line-*` block was written to protect
(`index.css:180-207`) is not bent.

**The three platforms are tabs, and must be real ones**: `role="tablist"` /
`role="tab"` / `aria-selected` / `role="tabpanel"`, with Left/Right/Home/End
keyboard support. This app has already spent a plan each on heading hierarchy
(003), dialog semantics (004) and focus indicators (005); a div-based tab strip
would be a regression against work already paid for.

**Spacing is owned by one scale, and by parents.** The screen gets four tokens
and one rule: *a stack's parent owns the gap; children never carry margins for
it, and nothing on this screen uses a negative margin.* The current code
violates this — `index.css:9670-9677`:

```css
.phrase-explain-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: -12px 0 24px;
  padding: 0 4px;
}
```

That `-12px` exists to pull the Explain row up under the card above it. It is a
hard-coded correction for someone else's `margin-bottom`, and it breaks the
moment either box changes. Plan 028 deletes the rule; this plan makes sure
nothing new is built the same way.

## Steps

### Step 1 — Locale keys

Edit **both** `frontend/src/locales/en/index.js` and
`frontend/src/locales/fr/index.js`. The two tables are key-for-key identical and
a test enforces it (`src/locales/locales.test.js`), so every key added to one is
added to the other in the same edit.

In `en/index.js`, the `phraseAnalyzer` block begins at line 438 and the `video`
block at 498. **Keep every existing key in both blocks** — plans 028 and 029
retire the dead ones, and deleting them here breaks the two screens before their
replacement exists. Add to the `phraseAnalyzer` block:

```js
  analyzerTitle:       'Analyzer',
  analyzerDesc:        'Anything Japanese you ran into\nTyped, photographed, or captioned\nTaken apart word by word',
  sourceText:          'Text',
  sourcePhoto:         'Photo',
  sourceVideo:         'Video',
  sourceTextHint:      'Type or paste Japanese',
  sourcePhotoHint:     'Shoot or upload a picture',
  sourceVideoHint:     'Subtitles or a transcript',
  platformUnit:        'Platform',
```

French (`fr/index.js`, same block):

```js
  analyzerTitle:       'Analyseur',
  analyzerDesc:        "Tout ce que vous croisez en japonais\nTapé, photographié ou sous-titré\nDécortiqué mot à mot",
  sourceText:          'Texte',
  sourcePhoto:         'Photo',
  sourceVideo:         'Vidéo',
  sourceTextHint:      'Tapez ou collez du japonais',
  sourcePhotoHint:     'Photographiez ou importez une image',
  sourceVideoHint:     'Sous-titres ou transcription',
  platformUnit:        'Voie',
```

`analyzerDesc` is three lines because the departure board reads only the first
(`DepartureBoard.jsx`: `(section.desc ?? '').split('\n')[0]`) and the landing
showcase reads all three. Keep it to three.

**Verify:**

```bash
cd frontend && npm test -- --run src/locales/locales.test.js
```

Expected: 3 passing tests. A failure here names the key you added to one table
and not the other.

### Step 2 — The station registry, the board row, and the announcement

`frontend/src/config/stations.js` — replace the two entries at lines 47-48 with
one:

```js
  '/analyzer':              { code: 'KS', kana: 'かいせき' },
```

`frontend/src/config/navLinks.js` — replace the two entries (lines 39 and 43)
with one, at the position 解析 currently holds (after 翻訳, before 辞書):

```js
    // 解析 — one station, three platforms: typed text, a photo, a video's
    // subtitles. Was two board rows (/phrase-analyzer and /video) until
    // plan 027; they always produced the same thing — a Passage of
    // Sentences — and CONTEXT.md's own definition of Passage lists all
    // three sources as one act. See screens/AnalyzerScreen.jsx.
    { icon: '解析', title: t.analyzerTitle, desc: t.analyzerDesc, path: '/analyzer', color: 'var(--line-kaiseki)', scope: 'home' },
```

Rename the announcement clip so the station keeps its voice:

```bash
git mv frontend/public/sounds/announcements/phrase-analyzer.wav frontend/public/sounds/announcements/analyzer.wav
```

The clip names 解析 station, which has not changed, so the audio is still
correct — only the filename has to follow the path.

In `frontend/src/index.css`, add a note to the `--line-douga` declaration
(line 207) — do not delete the token:

```css
  /* 鶯色 uguisu — no longer a board line (plan 027 merged 動画 into 解析).
     Kept, and used for exactly one thing: the timestamp chips on video
     Sentences, the only data that exists for that source and no other.
     Do not reuse it for a section without reading the --line-* note above. */
  --line-douga:     #7a8a3f;
```

Do the same for the light-theme value at line 296.

**Verify:**

```bash
cd frontend && npm run lint
```

Expected: lint 0 errors (pre-existing warnings are fine). `git status` must show
the `.wav` as a **rename**, not a delete plus an add.

### Step 3 — `useAnalyzerSession`, the one seam that makes three sources one screen

Create `frontend/src/components/analysis/useAnalyzerSession.js`.

This is the load-bearing piece of the merge, so its contract is written out in
full. The three sources reach the same result by different routes:

| Source | Request | Shape back | Explain one Sentence |
|--------|---------|-----------|--------------------|
| text | `POST /api/phrase/analyze` `{phrase, lang, source:'typed'}` | `{sentences, truncated}` **synchronous** | `POST /api/phrase/analyze` `{phrase: <that sentence>, deep:true, lang, save:false}` |
| photo | same, with `source:'image'` | same | same |
| video | `POST /api/video/session` (**202**) then poll `GET /api/video/session/{id}` | `{sentences, videoId, windowCapped, truncated}`; sentences carry `cue_start`/`cue_end` | `POST /api/video/session/{id}/sentence/{i}/explain` `{lang}` |

The hook owns one Passage and hides that table from the screen:

```js
{
  passage,        // { sentences: [], truncated: 0, videoId: null, windowCapped: false } | null
  status,         // 'idle' | 'working' | 'ready' | 'failed'
  error,          // string | null
  focusIndex,     // number — which Sentence is the current stop
  setFocusIndex,
  explaining,     // { [index]: true }
  analyzeText(text, { source }),   // 'typed' | 'image'
  startVideoFromFile(file, { url, start, end }),
  startVideoFromTranscript(text, { url, start, end }),
  explain(index),                  // dispatches on the Passage's own source
  loadHistoryEntry(id),
  reset(),
}
```

Four requirements that are not negotiable, each because it is a bug already paid
for:

1. **A 202 is a success.** `apiJson` resolves on 202 with `{status:'generating'}`.
   Discriminate on the *payload*, never on a throw:

   ```js
   if (data.status === 'generating' || !Array.isArray(data.sentences)) {
     timer = setTimeout(poll, POLL_MS); return
   }
   ```

   Copy this predicate out of `VideoScreen.jsx`'s existing poll, comment
   included. Getting it wrong reproduces the production white-screen described in
   `plans/README.md`'s execution notes.
2. **The poll must be cancellable** and must clear its timer on unmount — carry
   over the `cancelled` flag and `clearTimeout` from the current effect.
   Switching platform mid-poll must not leave a timer running.
3. **`explain` never touches the whole Passage.** One Sentence, one call, per
   `docs/adr/0001`. A Passage can be `MAX_SENTENCES` long and `deep` on all of
   them multiplies the cost by that many.
4. **`source` provenance survives.** Text typed → `'typed'`; text that arrived
   from OCR and has not since been retyped → `'image'`. This is the Sentence
   bank's provenance (plan 016) and the history row's badge.

**Verify:**

```bash
cd frontend && npm run lint
```

Expected: 0 errors. The hook gets no test of its own — Step 7 exercises it
through the screen, which is where its behaviour is observable.

### Step 4 — `SourceRail`, the のりば

Create `frontend/src/components/analysis/SourceRail.jsx`: the three platform
signs, as a real tablist.

```jsx
const SOURCES = [
  { key: 'text',  jp: '文字', kana: 'もじ',     no: 1 },
  { key: 'photo', jp: '写真', kana: 'しゃしん', no: 2 },
  { key: 'video', jp: '動画', kana: 'どうが',   no: 3 },
]
```

Each sign carries, top to bottom: the 番線 number in the line colour, the kana
reading, the kanji name in `'Noto Serif JP'`, and the plain-language label — the
same four registers `StationSign` uses, because it is the same signage system.
The active sign's stripe is filled; the others carry a hairline.

- `playUi('click-mode-selection')` on change — the sound every other selector in
  the app makes (`ModeSelector.jsx`, `TierSelector.jsx`, `LevelSelector.jsx`).
- Roving tabindex: the active tab is `tabIndex={0}`, the others `-1`;
  Left/Right move and activate, Home/End jump to first/last.
- `aria-controls` pointing at the panel id, `aria-selected` on each tab.

**Do not** put the intake panels inside this component. It renders the rail and
calls `onChange(key)`; the screen owns which panel is mounted.

**Verify:**

```bash
cd frontend && npm run lint
```

### Step 5 — The three intake components (markup moved, not redesigned)

Create three files under `frontend/src/components/analysis/`:

- `IntakeText.jsx` — the textarea, the Analyze button and the `fromImage` hint,
  lifted from `PhraseAnalyzerScreen.jsx`.
- `IntakePhoto.jsx` — `<ImageInput/>` plus the same editable textarea, because
  OCR output must stay correctable before analysis (that is plan 024's whole
  finding). On `onTextReady` it fills the field and marks the Passage's source
  `'image'`.
- `IntakeVideo.jsx` — the file input, the `<details>` yt-dlp help, the optional
  URL field, the window row and the paste panel, lifted from `VideoScreen.jsx`
  **including `pastePanel()`'s "one implementation, two call sites" comment**.

**Move the markup verbatim.** Same class names, same strings, same structure. The
only permitted changes are: props instead of closure state, and the
`t.xxx ?? 'English fallback'` patterns collapsed to `t.xxx` for keys that now
certainly exist. Redesign happens in plan 029 — mixing it in here means a visual
regression cannot be told apart from a merge regression.

**Verify:**

```bash
cd frontend && npm run lint
```

### Step 6 — `AnalyzerScreen`, and the routes

Create `frontend/src/screens/AnalyzerScreen.jsx`:

```jsx
export default function AnalyzerScreen({ session }) {
  const [source, setSource] = useState('text')   // 'text' | 'photo' | 'video'
  const analyzer = useAnalyzerSession(session)
  const mining = useMining(session)
  ...
  return (
    <div className="screen">
      <TopBar onBack={() => navigate('/')} title={t.analyzerTitle} />
      <main id="main-content" className="container page-pad analyzer">
        <StationHeader />
        <SourceRail value={source} onChange={...} t={t} />
        <div id={`anl-panel-${source}`} role="tabpanel" aria-labelledby={`anl-tab-${source}`}>
          {source === 'text'  && <IntakeText  ... />}
          {source === 'photo' && <IntakePhoto ... />}
          {source === 'video' && <IntakeVideo ... />}
        </div>
        {/* results — unchanged from today in this plan; plan 028 replaces this block */}
      </main>
      {detail && <WordDetail detail={detail} t={t} onClose={closeDetail} mining={mining} />}
    </div>
  )
}
```

Two details that are easy to miss:

- **Add `<StationHeader />`.** Neither old screen had one — they opened with a
  `TopBar` and went straight to a card, which is precisely the symptom
  `StationHeader.jsx`'s own comment names as "the screens that still read as a
  different app". The plate is derived from the path, so it needs no props.
- **Switching source must not discard a finished Passage.** Analysing a photo,
  switching to 文字 to check something, then switching back must not throw the
  result away. Keep one `analyzer` instance across all three panels; only
  `reset()` clears it.

`frontend/src/App.jsx` — swap the two imports for one, and replace lines 144-145:

```jsx
          <Route path="/analyzer"             element={<AnalyzerScreen session={session} />} />
          {/* Merged into /analyzer by plan 027. Kept as redirects, not
              deleted: both paths have been live, are in browser history
              and may be bookmarked, and a 404 on a URL that used to work
              is the worst possible outcome of a rename. `replace` so Back
              from the analyzer goes home rather than back to the redirect. */}
          <Route path="/phrase-analyzer"      element={<Navigate to="/analyzer" replace />} />
          <Route path="/video"                element={<Navigate to="/analyzer" replace />} />
```

Import `Navigate` from `react-router-dom` alongside the existing imports.

Delete `frontend/src/screens/PhraseAnalyzerScreen.jsx` and
`frontend/src/screens/VideoScreen.jsx`.

**Verify:**

```bash
cd frontend && npm run build
```

Expected: a clean build. A build error naming a missing import is a call site you
have not moved.

### Step 7 — Tests: retarget, do not delete

`frontend/src/screens/VideoScreen.polling.browser.test.jsx` pins the HTTP 202
white-screen — the most expensive bug this feature has had, and one that reached
production because it only reproduced on the slow ingest path. **It must survive
this merge.**

`git mv` it to `frontend/src/screens/AnalyzerScreen.polling.browser.test.jsx` and
change the minimum needed:

- import `AnalyzerScreen` instead of `VideoScreen`;
- before `startFromFile`, click the 動画 tab (the file input only exists on that
  panel) — query it by its accessible name, not by a class;
- keep all three cases, all three mocks (`../lib/api`, `useMining` spread from
  `importOriginal`, `VideoPlayer`), and the whole header comment. That comment is
  the only written record of why the bug survived the suite.

Add one new case to the same file:

```
it('keeps a finished Passage when the learner switches platform and back')
```

Analyze on 文字, switch to 写真, switch back, assert the Sentence text is still
rendered. This pins the one behaviour the merge makes possible to break and
nothing else covers.

**Verify:**

```bash
cd frontend && npm test -- --run && npm run lint
```

Expected: all tests pass; lint 0 errors (pre-existing warnings are fine).

### Step 8 — The spacing scale and the rail's CSS

Append to `frontend/src/index.css`, after the phrase-analyzer block that ends
around line 9680. **Additive only — do not edit rules above it in this plan.**

```css
/* ── 解析 — the analyser (plan 027) ────────────────────────
   ONE rhythm for the whole screen, and one rule: a stack's parent
   owns the gap. Children carry no margins for spacing, and nothing
   here uses a negative margin.

   The screen this replaces had six paddings for one card object
   (.phrase-input-card 20/24, .phrase-history-card 16/24,
   .phrase-result-card 20/24, .phrase-word-card 16/20,
   .phrase-error-card 16, and .card itself 15/24) plus a -12px margin
   correcting the box above it. That is what padding drift looks
   like, and tokens are how it stops.

   The clamps scale continuously instead of stepping at a
   breakpoint, so there is no width at which the screen looks
   half-adjusted. */
.analyzer {
  --anl-gap:          clamp(16px, 1.2vw + 10px, 24px);
  --anl-pad-inline:   clamp(16px, 1.6vw + 10px, 28px);
  --anl-pad-block:    clamp(18px, 1.2vw + 12px, 26px);
  --anl-radius:       var(--surface-radius);

  display: flex;
  flex-direction: column;
  gap: var(--anl-gap);
}

/* Every panel on this screen is the same piece of material. */
.anl-panel {
  background: var(--surface);
  border: 1px solid var(--surface-line);
  border-radius: var(--anl-radius);
  padding: var(--anl-pad-block) var(--anl-pad-inline);
}

/* ── のりば — the platform rail ──
   Three signs at the head of three platforms. Same four registers as
   a 駅名標 (number, kana, kanji, plain language), because it is the
   same signage system — see components/station/StationSign.jsx. */
.anl-rail {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: clamp(8px, 0.8vw + 4px, 14px);
}
.anl-rail__sign {
  --sign: var(--line-color, var(--line-kaiseki));
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: clamp(12px, 1vw + 8px, 18px) 10px 0;
  background: var(--surface);
  border: 1px solid var(--surface-line);
  border-radius: var(--anl-radius) var(--anl-radius) 0 0;
  color: var(--text-secondary);
  text-align: center;
  transition: background 0.16s ease, color 0.16s ease;
}
.anl-rail__sign[aria-selected="true"] { color: var(--text-primary); }
.anl-rail__sign:hover { background: var(--bg-card-hover); }

.anl-rail__no {
  font-family: var(--font-display);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--sign);
}
.anl-rail__kana {
  font-family: var(--font-jp);
  font-size: 0.62rem;
  letter-spacing: 0.24em;
  text-indent: 0.24em;
}
.anl-rail__jp {
  font-family: 'Noto Serif JP', serif;
  font-weight: 700;
  font-size: clamp(1.1rem, 0.7rem + 1.4vw, 1.55rem);
  letter-spacing: 0.1em;
  text-indent: 0.1em;
  line-height: 1.2;
}
.anl-rail__latin {
  font-family: var(--font-display);
  font-size: 0.6rem;
  font-weight: 700;
  letter-spacing: 0.2em;
  text-indent: 0.2em;
  text-transform: uppercase;
}
/* The stripe is the sign's bottom edge, exactly as on a station
   plate — full-bleed to the sign's own width, not inset. */
.anl-rail__stripe {
  width: 100%;
  height: 4px;
  margin-top: clamp(8px, 0.6vw + 5px, 12px);
  background: var(--surface-line);
  border-radius: 0 0 2px 2px;
  transition: background 0.2s ease;
}
.anl-rail__sign[aria-selected="true"] .anl-rail__stripe { background: var(--sign); }

@media (prefers-reduced-motion: reduce) {
  .anl-rail__sign,
  .anl-rail__stripe { transition: none; }
}
```

**Verify:** run the app and look at it.

```bash
cd frontend && npm run dev
```

Open `http://localhost:5173/analyzer`. Expected: the 解析 plate, three platform
signs with the first one lit, and today's text intake below.

## STOP conditions

- **`git status` shows `phrase-analyzer.wav` deleted and `analyzer.wav` added as
  separate files** rather than a rename. Redo with `git mv` — a copy loses the
  file's history for no reason.
- **The polling browser test was deleted rather than moved.** Restore it. It is
  the only regression guard on a bug that reached production.
- **A source switch leaves a poll timer running** (repeated
  `/api/video/session/...` requests after leaving the 動画 platform). The
  `cancelled` flag or the `clearTimeout` did not survive the move into the hook.
  Fix before continuing.
- **`sectionFor('/analyzer')` returns null** — the plate and the top bar's line
  colour both go blank. You edited `stations.js` but not `navLinks.js`, or the
  two paths disagree by a character.
- **You find yourself restyling `.phrase-word-card`, `.phrase-result-card`,
  `.phrase-line`, `.phrase-explanation`, `.phrase-kanji-chip` or any
  `.analysis-*` rule.** Those are shared with `ReadingScreen` through
  `SentenceBreakdown`/`TokenCard`. Out of scope for this plan and this wave.

## Boundaries

**In scope**: `App.jsx`, `config/stations.js`, `config/navLinks.js`,
`screens/AnalyzerScreen.jsx` (new), the four new files under
`components/analysis/`, the two deleted screens, the moved test, both locale
tables, the announcement rename, and **additive-only** CSS at the end of
`index.css`.

**Explicitly out of scope**:

- `SentenceBreakdown.jsx`, `TokenCard.jsx`, `WordDetail.jsx`, `MineButton.jsx`,
  `GrammarChips.jsx`, `LevelBadge.jsx`, `status.js` — shared with `ReadingScreen`.
- `.phrase-analyze-btn`, `.phrase-history-toggle`, `.phrase-input-actions` — also
  used by `DeckPicker.jsx` and `ImageCropper.jsx`.
- Every backend file. This wave is frontend-only.
- `/api/phrase/*` and `/api/video/*` naming. `CONTEXT.md` records the decision to
  leave them: renaming costs a migration and buys nothing visible.

## Done criteria

```bash
cd frontend && npm test -- --run && npm run lint && npm run build
```

- All tests pass, lint 0 errors, build clean.
- With the dev server up, `/analyzer` renders; `/phrase-analyzer` and `/video`
  both land on it with the old URL **replaced** in history (Back goes home, not
  into a redirect loop).
- The home departure board shows **eleven** rows, one of them 解析.
- Departing for 解析 plays the jingle *and* the announcement.
- `grep -rn "PhraseAnalyzerScreen\|VideoScreen" frontend/src` returns nothing but
  the renamed test file's own name, if anything.

## Test plan

Automated: Step 7.

Manual, in one pass:

1. `/analyzer` → 文字 → type 猫が好きです → Analyze → a breakdown appears.
2. Switch to 写真, then back to 文字. The breakdown is **still there**.
3. 写真 → pick an image → crop → recognize → the text lands in an editable field.
4. 動画 → upload a `.srt` → the transcript renders.
5. Tab to the rail and drive it with Left/Right only. Each platform's panel
   appears; focus never lands inside a hidden panel.
6. Old URLs `/phrase-analyzer` and `/video` both land on `/analyzer`.

## Maintenance note

**The route path is the announcement filename.** Anyone renaming `/analyzer` must
rename `public/sounds/announcements/analyzer.wav` in the same commit. There is no
test for this — the failure mode is silence, which nothing asserts on. A
`video.wav` never existed, which is how the 動画 row went its whole life without a
voice and nobody noticed.

`useAnalyzerSession` is now the only place that knows a 202 means "still
working". If a fourth source is ever added, it goes through that hook, not around
it.

Watch in review: any new `margin-bottom` used for stack spacing inside
`.analyzer`, any negative margin at all, and any new hard-coded padding pair that
should have been `var(--anl-pad-block) var(--anl-pad-inline)`.
