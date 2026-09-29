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
| `build.mjs` | `npm run landing`: writes `public/landing/`, `public/sitemap.xml` and `public/robots.txt`. |
| `og.mjs` | `npm run landing:og`: renders the two share cards (`og-fr.png`, `og-en.png`). |
| `../public/landing/landing.js` | The client script. Not built; served as written. |

The built pages are committed, as `public/privacy.html` is: Vite copies
`public/` as it is, so the deployment needs no step of its own.
**After any change here, or to a deck the page counts, run `npm run landing`**
and commit what it writes. `src/landing.test.js` fails until you do.

## Motion

The page moves the way the app does (DESIGN.md, Motion):
- **Arrivals:** blocks arrive once as they are reached, rising 10px a
  child at a time. They are marked `data-reveal`, or `data-stagger` for a
  block whose children arrive in turn.
- **Hover:** a 1px lift, the edge in the line's colour.
- **Scale and glow:** none, except the gate button and the stamps, which
  are the app's own exceptions.
- **The hero:** the gold road runs out of Embarquer into the hub, each
  line draws out to its station, and trains run along them.
- **Features:** each tab shows the app's own screen, drawn, with 駅
  written in its KanjiVG stroke order. The tabs turn over by themselves
  until one is picked.

Three rules keep it safe:
- **Content is hidden only while the `js` flag is set** (the head script
  sets it) and only until it arrives, so a page without script reads
  whole.
- **A watcher that never starts shows everything after a beat.**
- **Reduced motion** keeps the fades and drops every movement and loop.

`src/landing.test.js` checks that every hook the script reaches for is
on the page.

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
  Keep each under 3 MB, with a still of the same name as a JPEG.
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
