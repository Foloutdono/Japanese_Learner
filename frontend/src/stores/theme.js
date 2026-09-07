import { useEffect, useState } from 'react'

// ── The theme choice (plan 074) ──────────────────────────────
// Three-valued — dark, light, or auto — while the <html data-theme>
// attribute stays two-valued (the stylesheet only knows light and
// dark). Auto is simply "no saved key": index.html's blocking script
// already falls through to the OS preference when the key is absent,
// so an auto choice needs no new bootstrap — only the control has to
// stop freezing the OS answer into localStorage. Lifted out of the
// retired NavControls' ThemeToggle so Settings › Display draws it on
// the canvas's service cards.
const THEME_KEY = 'jp-theme'

// --bg-main of each theme, for the browser's own chrome (the installed
// app's status bar). Mirrored in index.html's blocking script, which
// paints it before React runs; a change here is a change there.
const THEME_COLOR = { dark: '#17151a', light: '#f6f1e4' }

export function applyThemeAttribute(theme) {
  document.documentElement.setAttribute('data-theme', theme)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', THEME_COLOR[theme] ?? THEME_COLOR.dark)
}

export function osTheme() {
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function getThemeChoice() {
  if (typeof window === 'undefined') return 'auto'
  try {
    const saved = window.localStorage.getItem(THEME_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch { /* private mode — treat as auto */ }
  return 'auto'
}

// Applies a choice, but only for changes made here. The initial value
// is already on <html> (see index.html) — writing it back on mount is
// what used to freeze a detected OS preference into an explicit saved
// choice, so later OS changes stopped being honoured.
export function setThemeChoice(next) {
  try {
    if (next === 'auto') window.localStorage.removeItem(THEME_KEY)
    else window.localStorage.setItem(THEME_KEY, next)
  } catch { /* private mode — the attribute below still applies */ }
  applyThemeAttribute(next === 'auto' ? osTheme() : next)
}

export function useThemeChoice() {
  const [choice, setChoice] = useState(getThemeChoice)

  // While the choice is auto, a live OS flip must land without a
  // reload — the blocking script only runs at load time.
  useEffect(() => {
    if (choice !== 'auto' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const follow = () => applyThemeAttribute(osTheme())
    mq.addEventListener('change', follow)
    return () => mq.removeEventListener('change', follow)
  }, [choice])

  return [choice, next => { setThemeChoice(next); setChoice(next) }]
}
