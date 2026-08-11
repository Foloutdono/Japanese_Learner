import { useEffect, useState } from 'react'
import { useLang } from '../LangContext'
import { LANGUAGES } from '../i18n'
import {
  useMuted, toggleMute,
  useVolumes, setVolume, resetVolumes,
  playClick, playToggle,
  SOUND_CATEGORIES,
} from './sound'

const THEME_KEY = 'jp-theme'

function getInitialTheme() {
  if (typeof window === 'undefined') return 'dark'
  const saved = window.localStorage.getItem(THEME_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

/* ── Icônes SVG (remplacent les émojis) ─────────────────── */

function IconVolume({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  )
}

function IconVolumeOff({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  )
}

function IconSun({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

function IconMoon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

/* ── Composants exportés ────────────────────────────────── */

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
      title={muted ? t.unmute : t.mute}
      aria-label={muted ? t.unmute : t.mute}
    >
      {muted ? <IconVolumeOff /> : <IconVolume />}
    </button>
  )
}

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
      title={isDark ? t.lightMode : t.darkMode}
      aria-label={isDark ? t.lightMode : t.darkMode}
    >
      {isDark ? <IconSun /> : <IconMoon />}
    </button>
  )
}

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
          {l.label}
        </option>
      ))}
    </select>
  )
}

const CATEGORY_LABEL_KEYS = {
  kana:         'volumeKana',
  tts:          'volumeVoice',
  sfx:          'volumeEffects',
  ui:           'volumeUi',
  jingle:       'volumeJingle',
  announcement: 'volumeAnnouncement',
  ambiance:     'volumeAmbiance',
}

function MasterVolume({ value, onChange, disabled }) {
  const pct = Math.round(value * 100)
  return (
    <div className={`master-volume-card${disabled ? ' master-volume-card--muted' : ''}`}>
      <div className="master-volume-header">
        <div className="master-volume-title">
          <IconVolume size={16} />
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