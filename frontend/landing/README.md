# The landing page (plan 167)

The public page for search and the stores: 辻 the crossroads (the owner's
pick A on the canvas "Tsuji — landing page", improved with the others' best
ideas). It is the site's `/` in French and `/en` in English; the files
live under `public/landing/` and `vercel.json` rewrites the two addresses
to them (the old `/landing/` addresses redirect there for good).

It is a **static page**, not a screen of the app: plain HTML that search
engines read whole, a stylesheet inlined in it, and one small script
(`public/landing/landing.js`) that turns the demos on and lets the footage
in. The page works without that script.

## Files

| File | What it is |
| --- | --- |
| `config.mjs` | Everything that changes when the page goes live: the origin, the paths, the store links, the contact, the footage. |
| `strings.mjs` | Every word, French and English. Titles and descriptions come from `docs/seo/keywords.md`. |
| `content.mjs` | The figures, counted from the decks the app serves. |
| `tokens.mjs` | The app's tokens, copied. `src/landing.test.js` holds them equal to `index.css`. |
| `page.mjs` | The renderer: the sections, the SEO head, the JSON-LD. |
| `landing.css` | The stylesheet, phone first, inlined at build. |
| `build.mjs` | `npm run landing`: writes `public/landing/` (the demos' `voices.js` too), `public/sitemap.xml` and `public/robots.txt`. |
| `og.mjs` | `npm run landing:og`: renders the two share cards (`og-fr.png`, `og-en.png`). |
| `../public/landing/landing.js` | The client script. Not built; served as written. |

The built pages are committed, as `public/privacy.html` is: Vite copies
`public/` as it is, so the deployment needs no step of its own.
**After any change here, to a deck the page counts, or to the app's sound
palette (`src/lib/audio/recipes.js` and the trims in `settings.js`), run
`npm run landing`** and commit what it writes. `src/landing.test.js` fails
until you do.

## Motion

The page moves the way the app does (DESIGN.md, Motion):
- **Arrivals:** blocks arrive once as they are reached, rising 10px a
  child at a time. They are marked `data-reveal`, or `data-stagger` for a
  block whose children arrive in turn.
- **Hover:** a 1px lift, the edge in the line's colour, and only on
  what can be pressed: the four lines' plates are no doors, so they
  lift nothing. The mock exam's answers are an exception: they lift
  nothing.
  Under the pointer, or with keyboard focus, an answer's number turns
  over in the exam's ink and its edge takes a tint of it, so it reads
  "press this", not "picked". The first pick is the answer, as on the
  paper: after it, no answer reacts and a second click changes nothing.
  On the desk the feature tabs, a row each in one group, lift nothing
  either: under the pointer, or with keyboard focus, a tab shows a 1px
  edge in its line's colour and a tint in its roundel, and nothing
  more, so it never reads as a second pick; the picked tab is washed in
  gold with its rail, its roundel lit in its line's colour.
- **Scale and glow:** none, except the gate button and the stamps, which
  are the app's own exceptions.
- **The hero:** the gold road runs out of Embarquer into the hub, each
  line draws out to its station, and trains run along them.
- **Features:** each tab shows the app's own screen, drawn, with 駅
  written in its KanjiVG stroke order. The tabs turn over by themselves
  until one is picked, and hold while the pointer or the focus is on
  the tabs or the stage (not on the heading beside them). A drawn
  screen stays seven seconds. A tab with a clip stays until the clip
  has played through, the line under the tab following it, and plays
  it again while the pointer is on the tabs or the stage. A clip that
  fails leaves the tab to the seven seconds, and one that has not
  started after seven seconds turns it. On the desk the stage's label
  stands beside the phone -- the feature's roundel and name and its
  line at the head, what the clip shows at the foot, each held at two
  lines -- and every tab is the same height, so a turn moves nothing.
- **The tools:** the dictionary entry writes 駅 stroke by stroke, once,
  as the stop arrives; without script, or with reduced motion, it is
  drawn whole. In the analyser a word lifts nothing either: under the
  pointer, or with keyboard focus, its rule turns half gold, a step
  short of the pick's. Pressed, its rule turns the whole gold and it is
  washed in gold, its entry comes in under the sentence, and its grammar
  point is lit in the numbered list. The entry keeps its height, so a
  word pressed moves nothing.
- **The questions:** one answer is open at a time (the `<details>` share
  a name, and the script does it where a browser does not). From the
  tablet up a question lifts nothing either: under the pointer, or with
  keyboard focus, its row shows its gold rail (and on the desk a ▶
  slides in), and nothing more, so it never reads as opened; the open
  one is washed in gold, its ring the lit stop's. On the desk the open
  answer stands in a card beside the list, and on a tablet at least
  1000px tall in a card under it; there the open question stays open
  (the script), the rows never change height, so a question opened
  moves nothing, and the answer it leaves fades out before its own fades
  in. A phone, and a shorter tablet, keep the accordion. Each answer
  ends on the stop that shows it, a link back up the line.
- **The stops:** the page is the gold line the hero's road starts, and
  each section is a stop on it. A sign opens every section, where a
  hairline once cut the page. It holds the stop's number in a ring, its
  name, the rail to the next stop, and a link on to that stop. The rail is
  laid as the sign arrives, with one train run along it. The stop being
  read is lit, as its link in the header is. The line ends at the way in,
  the terminus 終, where the rail ends at a buffer. Every other section
  lies on a band that fades in at its edges, so no border stands between
  two sections.
- **What to press:** each demo's first step wears the ring the app's
  guide puts round what a note asks you to press: gold, breathing, never
  a fill. The steps are the card, then its verdicts, the pace, a word and
  an answer (the ring goes round each answer's number, never round the
  group, and never round one answer alone). The ring moves on or goes
  once the step is answered, and it never comes back. The hero ends with
  a link down to the first stop.

Three rules keep it safe:
- **Content is hidden only while the `js` flag is set** (the head script
  sets it) and only until it arrives, so a page without script reads
  whole.
- **A watcher that never starts shows everything after a beat.**
- **Reduced motion** keeps the fades and drops every movement and loop
  (a ring stands still).
- **A ring is drawn only by the script**, which alone can take it away.

`src/landing.test.js` checks that every hook the script reaches for is
on the page.

## Sound

The demos sound as the app does, with the app's own voices:
`public/landing/voices.js` is `src/lib/audio/recipes.js` bundled by
`scripts/voices-bundle.mjs`, the same bundle the loudness meter and the
listening panel play, so what a visitor hears is byte for byte what ships.
The script plays each event's shipped voice through the app's chain (the
voice's trim, its channel, the master).

| Press | Sound |
| --- | --- |
| The trial's card turned | `card-flip`, and the kana card (ぬ) says its syllable with the kana deck's own clip |
| A verdict | `correct` (Difficult, Correct) or `wrong` (Wrong, Almost), the `fare-tick` 110ms after it, and `card-transition` as the card leaves: a rating in the app |
| The pace, a word in the analyser, a feature tab | `click-mode-selection` |
| The exam's answer | `correct` or `wrong` |
| Phone / Computer, and the sound switch turned on | `toggle` |

Four rules:
- **Only the visitor's own press makes a sound.** Nothing plays on arrival,
  on scroll or on the page's own motion: the feature tabs turning by
  themselves are silent, and no audio context exists before the first press.
- **The switch in the header is the app's mute.** It reads and writes the
  app's own key (`jp-app-muted`, `src/lib/audio/settings.js`), and the page
  plays at the app's volumes (`jp-app-volumes`): the page and the app are
  one origin, so a visitor who mutes here boards muted, and a learner who
  muted the app finds the page quiet. Sound is on by default, as in the app.
- **The switch is drawn by the script**, which alone plays anything; a page
  without it has no switch.
- **The voices are fetched when the page is idle**, and the kana clip when
  the trial is near, so the first card turned is heard. Muted, neither is
  fetched until the switch is turned on.

## Footage

The footage lives in a public Supabase Storage bucket named `landing`,
in the project the app already signs in with. To create it, run
`backend/scripts/sql/landing_media_bucket.sql` once in the SQL Editor.
Then upload each file from the dashboard (Storage → landing → Upload) under
its exact name. Nothing needs rebuilding for a clip to appear: each slot
looks for its still, and only a still that loads brings in a player.

| Slot | Files |
| --- | --- |
| Overview presentation | `presentation.mp4`, `presentation.jpg`, `presentation.fr.vtt`, `presentation.en.vtt` |
| Aujourd'hui | `aujourdhui.mp4`, `aujourdhui.jpg` |
| Kana | `kana.mp4`, `kana.jpg` |
| Vocabulaire | `vocabulaire.mp4`, `vocabulaire.jpg` |
| Kanji | `kanji.mp4`, `kanji.jpg` |
| Grammaire | `grammaire.mp4`, `grammaire.jpg` |
| Lecture et dictée | `pratique.mp4`, `pratique.jpg` |
| Analyseur | `analyseur.mp4`, `analyseur.jpg` |
| Examen blanc | `examen.mp4`, `examen.jpg` |

- **Phone clips:** portrait 1080×2340, 30 fps, muted, with no status bar.
  Each clip starts and ends on the same screen so the loop is seamless.
  Keep each under 3 MB, with a still of the same name as a JPEG. A clip
  can run as long as its feature needs: its tab waits for it to end.
- **Computer clips (optional):** the same names with `-desk`
  (`kana-desk.mp4`, `kana-desk.jpg`), 1440×900, with the browser chrome
  cropped. The page's Phone / Computer switch shows them.
- **The presentation:** 16:9, 1920×1080, 60 to 90 seconds, 25 MB at most.
  Its chapters start at the seconds in `config.mjs`'s
  `PRESENTATION.chapters`, so keep each chapter starting where it says.
- **On screen:** a demo account, the French interface and the dark theme.
  Show nothing personal.

The shot list, with what to film in each slot, is the canvas's "Footage
slots" board.

The presentation section stays hidden until `presentation.jpg` is in the
bucket. Once the video is up, **set `PRESENTATION.uploadDate`** in
`config.mjs` (e.g. `'2026-10-15'`) and run `npm run landing`. That shows the
section without waiting on the script, and describes the video to search
engines (a `VideoObject` with its chapters as key moments). Do this only
once the file is really there.

## Later: going live

- **The stores:** put the two listing URLs in `STORES`. The badges then link
  instead of saying "coming soon". Google Play's is
  `https://play.google.com/store/apps/details?id=app.tsuji`; the App Store's
  needs the app's numeric id. For store-ready artwork, Apple and Google
  publish their official badges.
- **Contact:** set `CONTACT` to an address and the footer prints it.
- **A custom domain:** change `SITE_ORIGIN`, then run `npm run landing` and
  `npm run landing:og` (the share card prints the domain).

## `/` and the app

The landing page took `/` from the app, which moved to **`/app`**, a route
that goes where `/` did (the first ride when it is due, else the day's
gate). Four things make that work, and each has a test:

- **The app's document is `app.html` on the web.** Vercel serves a file
  before any rewrite, so an `index.html` at the build's root would answer
  `/` itself. `appShell.js` renames it in the web build; `vercel.json`'s
  fallback and the service worker's offline fallback point at `app.html`.
  `npm run dev` and the native shell's bundle keep `index.html`.
- **The page sends on what `/` used to open.** A script in its `<head>`,
  before anything is drawn, sends a signed-in learner to `/app`. It sends
  every sign-in's return there too: Google and the e-mail links come back
  to `/` (the project's Site URL) with `?code`, `#access_token` or an
  error, and those go along. Visitors, and search engines, stay.
- **Signed in and want to see the page?** Open `/?landing`. It holds for
  the rest of the tab.
- **The installed app opens at `/app`** (the manifest's `start_url`),
  keeping its `id` of `/`, so every existing install stays the same app.
- **`npm run dev` and `npm run preview` route as the deployment does.**
  `appShell.js`'s `siteRoutes` reads `vercel.json` itself, so the landing
  page is at `/` and `/en` there too, the old addresses redirect, and the
  app is at `/app` and every app route. Open `/app` for the app.
