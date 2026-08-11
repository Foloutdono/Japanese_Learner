import { useEffect, useState } from 'react'
import { useLang } from '../LangContext'
import { LANGUAGES } from '../i18n'
import {
  useMuted, toggleMute,
  useVolumes, setVolume, resetVolumes,
  useAmbianceEnabled, setAmbianceEnabled,
  playClick, playToggle,
  SOUND_CATEGORIES,
} from './sound'

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
// toggleMute() runs first, then playClick() — so the click itself
// respects the *new* mute state: muting stays silent, unmuting gives
// an audible confirmation instead of the very button that turns sound
// back on staying silent about it.
export function MuteButton() {
  const { t } = useLang()
  const muted = useMuted()

  function handleClick() {
    toggleMute()
    playClick()
  }

  return (
    <button
      onClick={handleClick}
      className="btn-nav btn-nav--icon"
      title={muted ? (t.unmute) : (t.mute)}
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

  function handleClick() {
    setTheme(th => (th === 'dark' ? 'light' : 'dark'))
    playToggle()
  }

  return (
    <button
      onClick={handleClick}
      className="btn-nav btn-nav--icon"
      title={isDark ? (t.lightMode) : (t.darkMode)}
    >
      {isDark ? '☀' : '☾'}
    </button>
  )
}

// ── Ambiance toggle button (🎐) ─────────────────────────────
// Independent from MuteButton: mute silences everything including
// ambiance (sound.js's setMuted retunes its gain to 0), but this is
// the control that decides whether ambiance is part of the mix at
// all. Same glyph in both states — only dimmed when off — rather
// than swapping icons, so it doesn't read as a second mute button.
export function AmbianceToggle() {
  const { t } = useLang()
  const enabled = useAmbianceEnabled()

  function handleClick() {
    setAmbianceEnabled(!enabled)
    playClick()
  }

  return (
    <button
      onClick={handleClick}
      className={`btn-nav btn-nav--icon${enabled ? '' : ' btn-nav--off'}`}
      title={enabled ? t.ambianceOff : t.ambianceOn}
    >
      🎐
    </button>
  )
}

// ── Language switcher (dropdown) ───────────────────────────
// A real <select> rather than the old cycle-through-two button: it
// scales to any number of LANGUAGES without extra taps, and lets the
// user land on their language directly instead of hunting through a
// toggle. Shares .btn-nav for its background/color (including the
// card-context override already defined for `.settings-row .btn-nav`
// in index.css) — `.lang-select` on top just strips the native select
// chrome and draws a themed arrow in its place.
export function LangSwitcher() {
  const { t, lang, switchLang } = useLang()

  function handleChange(e) {
    switchLang(e.target.value)
    playClick()
  }

  return (
    <select
      value={lang}
      onChange={handleChange}
      className="btn-nav btn-nav--lang lang-select"
      aria-label={t?.language}
    >
      {LANGUAGES.map(l => (
        <option key={l.code} value={l.code}>
          {l.flag} {l.label}
        </option>
      ))}
    </select>
  )
}

// ── Sound mixer ─────────────────────────────────────────────
// Master volume plus one slider per category from sound.js's
// SOUND_CATEGORIES — kana pronunciation, TTS, gamification SFX, and
// UI sounds (button taps/toggles). Purely a thin view over
// getVolumes/setVolume/resetVolumes: sound.js owns persistence and
// the actual 0–1 math, this just renders it and writes back on drag.
// Disabled (but still visible) while globally muted, so the numbers
// don't silently drift out of sync with what's actually audible.
const CATEGORY_LABEL_KEYS = {
  kana:         'volumeKana',
  tts:          'volumeVoice',
  sfx:          'volumeEffects',
  ui:           'volumeUi',
  jingle:       'volumeJingle',
  announcement: 'volumeAnnouncements',
  ambiance:     'volumeAmbiance',
}

/* ── Master volume (prominent card) ───────────────────────── */
function MasterVolume({ value, onChange, disabled }) {
  const pct = Math.round(value * 100)

  return (
    <div className={`master-volume-card${disabled ? ' master-volume-card--muted' : ''}`}>
      <div className="master-volume-header">
        <div className="master-volume-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
          <span>Master Volume</span>
        </div>
        <span
          className="master-volume-value"
          style={{ color: pct === 0 ? 'var(--text-secondary)' : 'var(--accent2)' }}
        >
          {pct}%
        </span>
      </div>
      <div className="master-volume-slider-wrap">
        <div className="master-volume-fill" style={{ width: `${pct}%` }} />
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={pct}
          disabled={disabled}
          onChange={e => onChange(Number(e.target.value) / 100)}
        />
      </div>
    </div>
  )
}

/* ── Category volume (compact row) ────────────────────────── */
function CategoryVolume({ label, value, onChange, disabled }) {
  const pct = Math.round(value * 100)

  return (
    <div className="category-volume-row">
      <span className="category-volume-row__label">{label}</span>
      <div className={`vol-slider-wrap${disabled ? ' vol-slider-wrap--disabled' : ''}`}>
        <div className="vol-slider-fill" style={{ width: `${pct}%` }} />
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={pct}
          disabled={disabled}
          onChange={e => onChange(Number(e.target.value) / 100)}
        />
      </div>
      <span
        className="category-volume-row__value"
        style={{ color: pct === 0 ? 'var(--text-secondary)' : 'var(--text-primary)' }}
      >
        {pct}%
      </span>
    </div>
  )
}

/* ── Sound mixer ──────────────────────────────────────────── */
export function SoundMixer() {
  const { t } = useLang()
  const muted = useMuted()
  const volumes = useVolumes()

  return (
    <div className="sound-mixer">
      <MasterVolume
        value={volumes.master}
        onChange={v => setVolume('master', v)}
        disabled={muted}
      />
      <div className="sound-mixer__categories">
        {SOUND_CATEGORIES.map(cat => (
          <CategoryVolume
            key={cat}
            label={t[CATEGORY_LABEL_KEYS[cat]]}
            value={volumes[cat]}
            onChange={v => setVolume(cat, v)}
            disabled={muted}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={() => { playClick(); resetVolumes() }}
        className="sound-mixer__reset"
      >
        {t.resetVolumes}
      </button>
    </div>
  )
}