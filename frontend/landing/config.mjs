// ── 辻 — the landing page's settings (plan 167) ────────────────
// Everything that will change once the page leaves its preview address
// is here, and only here: `npm run landing` regenerates the pages from
// it (frontend/landing/README.md).
import { readFileSync } from 'node:fs'

// The web origin the canonical, hreflang, sitemap and share-card URLs
// are written against. The Vercel origin until a custom domain exists.
export const SITE_ORIGIN = 'https://japanese-learner-seven.vercel.app'

// Where each language's page is served. Under /landing/ until the
// redirection that makes the French page the site's `/` and the English
// one `/en/`: change the two paths, regenerate, and add the rewrites.
export const PAGES = {
  fr: { lang: 'fr', path: '/landing/', out: 'public/landing/index.html', ogLocale: 'fr_FR', ogImage: '/landing/og-fr.png' },
  en: { lang: 'en', path: '/landing/en/', out: 'public/landing/en/index.html', ogLocale: 'en_GB', ogImage: '/landing/og-en.png' },
}
export const DEFAULT_LANG = 'fr'

// Where Embarquer and Se connecter lead: an app route, so the button
// still reaches the Welcome once `/` is this page. Signed out, every app
// route shows the Welcome; signed in, this one is the day's gate.
export const APP_ENTRY = '/today'

// The two store listings. Null draws the badge as "coming soon" and
// links nowhere: a badge that 404s is worse than one that waits.
// Google Play is https://play.google.com/store/apps/details?id=app.tsuji
// once the app is published; the App Store link needs its numeric id.
export const STORES = { appStore: null, googlePlay: null }

// The contact address for the footer. Null prints no Contact link.
export const CONTACT = null

// The footage lives in a public Supabase Storage bucket, uploaded from
// the dashboard by file name (backend/scripts/sql/landing_media_bucket.sql
// creates it). The project URL is the one the app already signs in with.
export const MEDIA_BUCKET = 'landing'
export function mediaBase(envFile = new URL('../.env.production', import.meta.url)) {
  const line = readFileSync(envFile, 'utf8').split('\n').find(l => l.startsWith('VITE_SUPABASE_URL='))
  if (!line) throw new Error('VITE_SUPABASE_URL is missing from frontend/.env.production')
  return `${line.slice('VITE_SUPABASE_URL='.length).trim().replace(/\/$/, '')}/storage/v1/object/public/${MEDIA_BUCKET}`
}

// The overview presentation. `uploadDate` stays null until the video is
// in the bucket: only then does the page describe it to search engines
// (a VideoObject for a file that is not there is a broken promise).
export const PRESENTATION = {
  file: 'presentation',
  seconds: 90,
  uploadDate: null,
  // The chapters' starts, in seconds, in the order of the strings'
  // `presentation.chapters`: the player's bar and Google's key moments.
  chapters: [0, 15, 30, 45, 60, 75],
}

// The features, one by one: one clip slot each, named by its file.
// `line` is the pigment the slot wears (the app's own, tabs.js).
export const CLIPS = [
  { id: 'aujourdhui', glyph: '本日', line: 'today', seconds: 12 },
  { id: 'kana', glyph: 'あ', line: 'kana', seconds: 10 },
  { id: 'vocabulaire', glyph: '語', line: 'vocab', seconds: 12 },
  { id: 'kanji', glyph: '漢', line: 'kanji', seconds: 12 },
  { id: 'grammaire', glyph: '文', line: 'grammar', seconds: 15 },
  { id: 'pratique', glyph: '読', line: 'reading', seconds: 15 },
  { id: 'analyseur', glyph: '解', line: 'kaiseki', seconds: 15 },
  { id: 'examen', glyph: '模', line: 'exam', seconds: 12 },
]

// The kana deck: four sets, 238 characters (backend/content/kana_data.py).
// A Python module the generator cannot read, so the figure is written
// here; everything else on the page is counted from the content itself.
export const KANA_COUNT = 238

// The app's own projection (domain/boarding.js): one new item a minute.
export const RHYTHMS = [5, 10, 15, 20]
export const DEFAULT_RHYTHM = 10
