import { useEffect, useState } from 'react'
import { useLang } from '../LangContext'
import { LANGUAGES } from '../i18n'
import { useMuted, toggleMute } from './sound'

const THEME_KEY = 'jp-theme'

// Reads any theme saved from a previous visit (or the OS preference,
// the first time) so index.css's [data-theme="light"] rules can be
// applied immediately rather than flashing dark-then-light.
function getInitialTheme() {
  if (typeof window === 'undefined') return 'dark'
  const saved = window.localStorage.getItem(THEME_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

// ── Mute toggle button ─────────────────────────────────────
// Reusable anywhere a mute control is needed (top bar, home page...).
export function MuteButton() {
  const { t } = useLang()
  const muted = useMuted()

  return (
    <button
      onClick={toggleMute}
      className="btn-nav btn-nav--icon"
      title={muted ? (t.unmute ?? 'Activer le son') : (t.mute ?? 'Couper le son')}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  )
}

// ── Theme toggle button (☀/☾) ──────────────────────────────
// Reusable anywhere a light/dark control is needed. Persists the
// choice to localStorage and applies it via a `data-theme` attribute
// on <html>, which is what index.css's light-theme overrides key off.
export function ThemeToggle() {
  const { t } = useLang()
  const [theme, setTheme] = useState(getInitialTheme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  const isDark = theme === 'dark'

  return (
    <button
      onClick={() => setTheme(th => (th === 'dark' ? 'light' : 'dark'))}
      className="btn-nav btn-nav--icon"
      title={isDark ? (t.lightMode ?? 'Mode clair') : (t.darkMode ?? 'Mode sombre')}
    >
      {isDark ? '☀' : '☾'}
    </button>
  )
}

// ── Language switcher button ──────────────────────────────
// Reusable anywhere a lang toggle is needed.
export function LangSwitcher() {
  const { lang, switchLang } = useLang()
  const next = LANGUAGES.find(l => l.code !== lang) ?? LANGUAGES[0]

  return (
    <button onClick={() => switchLang(next.code)} className="btn-nav" title={next.label}>
      {next.flag} {next.label}
    </button>
  )
}