import { useState } from 'react'
import { useLang } from '../../LangContext'
import { LANGUAGES } from '../../i18n'
import {
  useMuted, toggleMute,
  useVolumes, setVolume,
  playClick, playToggle,
  SOUND_CATEGORIES,
} from '../../lib/audio'

const THEME_KEY = 'jp-theme'

function getInitialTheme() {
  if (typeof window === 'undefined') return 'dark'
  // index.html's blocking script has already resolved saved-or-OS
  // preference onto <html data-theme> before React ever ran, so the
  // attribute is the source of truth. Falling back to the localStorage
  // read only covers the case where that script was blocked.
  const attr = document.documentElement.getAttribute('data-theme')
  if (attr === 'light' || attr === 'dark') return attr
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

  // Applies the theme, but only for changes made here. The initial
  // value is already on <html> (see index.html) — writing it back on
  // mount is what used to freeze a detected OS preference into an
  // explicit saved choice, so later OS changes stopped being honoured.
  function apply(next) {
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    window.localStorage.setItem(THEME_KEY, next)
  }

  const isDark = theme === 'dark'

  // Settings.dc.html draws this as a pair, not a switch: 暗 DARK and
  // 明 LIGHT side by side with the current one filled. A lone icon
  // button has to be read twice -- once to see which glyph it shows,
  // again to work out whether that means "you are here" or "go here" --
  // and it was showing the destination, not the state. Two buttons say
  // both at once. This control lives only on the settings page now
  // (the top bar carries the gear), so the pair costs nothing elsewhere.
  return (
    <div className="theme-choice" role="group" aria-label={t.theme}>
      <button
        type="button"
        onClick={() => { if (!isDark) { apply('dark'); playToggle() } }}
        className={`theme-choice__btn${isDark ? ' theme-choice__btn--on' : ''}`}
        aria-pressed={isDark}
      >
        <span className="theme-choice__jp" lang="ja">暗</span>
        {t.darkMode}
      </button>
      <button
        type="button"
        onClick={() => { if (isDark) { apply('light'); playToggle() } }}
        className={`theme-choice__btn${!isDark ? ' theme-choice__btn--on' : ''}`}
        aria-pressed={!isDark}
      >
        <span className="theme-choice__jp" lang="ja">明</span>
        {t.lightMode}
      </button>
    </div>
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
      // Not .btn-nav: that is a top-bar control and paints a white wash
      // meant for sumi. This lives on the settings card now, where
      // Settings.dc.html draws it as a select box on --bg-card.
      className="lang-select"
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
    </div>
  )
}