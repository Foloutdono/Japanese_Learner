// ── The app's tokens, as the landing page reads them (plan 167) ──
// The page is a static document outside src/ (as public/privacy.html
// is), so it cannot import index.css: loading the app's whole sheet would
// cost the page its speed. It copies the tokens it uses instead, and
// src/landing.test.js holds every value here equal to index.css's, so a
// pigment or a rung changed in the app fails the test until this file
// follows. The font stacks are the one deliberate difference: the app
// self-hosts Noto for Japanese, the page asks the system for its own.

// The dark theme, which is the app's :root.
export const DARK = {
  '--bg-main': '#17151a',
  '--bg-card': '#201d24',
  '--bg-panel': '#100e13',
  '--text-primary': '#ece5d8',
  '--text-secondary': '#a79c8c',
  '--text-on-panel': '#f3ecdf',
  '--text-on-panel-soft': '#b3a488',
  '--text-on-fill': '#1c1811',
  '--border': '#35303a',
  '--surface': 'color-mix(in srgb, var(--text-primary) 4%, var(--bg-card))',
  '--surface-line': 'color-mix(in srgb, var(--text-primary) 15%, var(--border))',
  '--accent2': '#c99a3e',
  '--pass-ink': '#575060',
  '--stamp-ink': '#c33a2c',
  '--success': '#7d9a5b',
  '--warning': '#d1a24a',
  '--danger': '#9c3428',
  '--teal': '#4f7a72',
  '--rust': '#a8622f',
  '--rating-wrong': '#b7402a',
  '--state-new': '#beb3a0',
  '--state-learning': '#b7402a',
  '--state-mastered': '#a97a25',
  '--line-kana': '#c1442c',
  '--line-vocab': '#3f6d8e',
  '--line-kanji': '#7c6a9c',
  '--line-grammar': '#6b8a4a',
  '--line-reading': '#4f7d7a',
  '--line-rikai': '#c1702f',
  '--line-honyaku': '#4f6aa8',
  '--line-kaiseki': '#7a4a6e',
  '--line-jisho': '#c99a3e',
  '--line-exam': '#8a6b4f',
  '--line-kakitori': '#3f8f63',
  '--line-sakubun': '#884898',
  '--gate-gold-lit': '#e6bd62',
  '--gate-gold': '#c99a3e',
  '--gate-gold-deep': '#b0852f',
  '--gate-lamp': '#e0b04f',
  '--elev-hang': '0 10px 26px rgba(0, 0, 0, 0.22)',
  '--elev-board': '0 24px 60px rgba(0, 0, 0, 0.34)',
}

// What the washi theme overrides (the app's :root[data-theme="light"]).
export const LIGHT = {
  '--bg-main': '#f6f1e4',
  '--bg-card': '#efe6d0',
  '--bg-panel': '#1e1912',
  '--text-primary': '#221d15',
  '--text-secondary': '#665c4a',
  '--border': '#c3af7c',
  '--accent2': '#a97a25',
  '--pass-ink': '#4a4452',
  '--stamp-ink': '#b23425',
  '--success': '#5c7a43',
  '--warning': '#ad7c2e',
  '--danger': '#93301f',
  '--teal': '#43645f',
  '--rust': '#8d5027',
  '--state-new': '#1a1812',
  '--line-kana': '#b7402a',
  '--line-vocab': '#375b78',
  '--line-kanji': '#6f5d8f',
  '--line-grammar': '#5a7540',
  '--line-reading': '#43645f',
  '--line-rikai': '#a85c26',
  '--line-honyaku': '#43598c',
  '--line-kaiseki': '#653d5b',
  '--line-jisho': '#a97a25',
  '--line-exam': '#7a5c40',
  '--line-kakitori': '#35784f',
  '--line-sakubun': '#743d82',
}

// The scales, the same in both themes.
export const SCALE = {
  '--fs-caption-xs': '0.62rem',
  '--fs-caption': '0.72rem',
  '--fs-sm': '0.82rem',
  '--fs-body': '0.95rem',
  '--fs-lead': '1.12rem',
  '--fs-title': '1.25rem',
  '--fs-heading': '1.70rem',
  '--fs-display': '2.50rem',
  '--fs-specimen-glyph': '6.5rem',
  '--fs-specimen-word': '4.5rem',
  '--fs-heading-fluid': 'clamp(1.35rem, 1.1rem + 1vw, 1.75rem)',
  '--fs-display-fluid': 'clamp(1.9rem, 1.4rem + 2.2vw, 3.1rem)',
  '--tr-term': '0.06em',
  '--tr-caption': '0.18em',
  '--tr-reading': '0.30em',
  '--sp-1': '4px',
  '--sp-2': '6px',
  '--sp-3': '8px',
  '--sp-4': '12px',
  '--sp-5': '16px',
  '--sp-6': '22px',
  '--sp-7': '28px',
  '--sp-8': '44px',
  '--sp-9': '52px',
  '--r-plate': '4px',
  '--r-card': '6px',
  '--r-panel': '8px',
  '--r-identity': '10px',
  '--r-pill': '999px',
}

// The page's own font stacks: Space Grotesk self-hosted beside the page
// (public/landing/fonts/), Japanese from the system's own faces.
export const FONTS = {
  '--font-display': "'Space Grotesk', 'Segoe UI', system-ui, sans-serif",
  '--font-jp': "'Noto Sans JP', 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Yu Gothic', Meiryo, system-ui, sans-serif",
  '--font-serif': "'Noto Serif JP', 'Hiragino Mincho ProN', 'Yu Mincho', 'Noto Serif CJK JP', serif",
}

export const block = map => Object.entries(map).map(([k, v]) => `${k}:${v}`).join(';')
