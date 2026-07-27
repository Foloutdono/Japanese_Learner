import { useEffect, useState } from 'react'
import { useLang } from '../LangContext'
import { LANGUAGES } from '../i18n'
import {
  useMuted, toggleMute,
  useVolumes, setVolume, resetVolumes,
  playClick, playToggle,
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
  kana: 'volumeKana',
  tts:  'volumeVoice',
  sfx:  'volumeEffects',
  ui:   'volumeUi',
}

function VolumeRow({ label, value, onChange, disabled }) {
  const pct = Math.round(value * 100)
  return (
    <div className="volume-row">
      <span className="volume-row__label">{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={pct}
        disabled={disabled}
        onChange={e => onChange(Number(e.target.value) / 100)}
        className="volume-row__slider"
      />
      <span className="volume-row__value">{pct}%</span>
    </div>
  )
}

export function SoundMixer() {
  const { t } = useLang()
  const muted = useMuted()
  const volumes = useVolumes()
  const categories = ['kana', 'tts', 'sfx', 'ui']

  return (
    <div className="sound-mixer">
      <VolumeRow
        label={t.volumeMaster}
        value={volumes.master}
        onChange={v => setVolume('master', v)}
        disabled={muted}
      />
      {categories.map(cat => (
        <VolumeRow
          key={cat}
          label={t[CATEGORY_LABEL_KEYS[cat]]}
          value={volumes[cat]}
          onChange={v => setVolume(cat, v)}
          disabled={muted}
        />
      ))}
      <button type="button" onClick={() => { playClick(); resetVolumes() }} className="sound-mixer__reset">
        {t.resetVolumes}
      </button>
    </div>
  )
}