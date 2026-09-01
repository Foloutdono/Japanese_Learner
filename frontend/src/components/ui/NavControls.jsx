import { useEffect, useState } from 'react'
import { useLang } from '../../LangContext'
import { LANGUAGES } from '../../i18n'
import {
  useMuted, toggleMute,
  useVolumes, setVolume,
  playClick, playToggle,
  SOUND_CATEGORIES,
} from '../../lib/audio'

const THEME_KEY = 'jp-theme'

function osTheme() {
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

// The learner's CHOICE, which is three-valued — 暗, 明, or 自動 — while
// the <html data-theme> attribute stays two-valued (the stylesheet only
// knows light and dark). 自動 is simply "no saved key": index.html's
// blocking script already falls through to the OS preference when the
// key is absent, so an auto choice needs no new bootstrap — only this
// control has to stop freezing the OS answer into localStorage, which
// is exactly the bug its old two-button form documented.
function getInitialChoice() {
  if (typeof window === 'undefined') return 'auto'
  try {
    const saved = window.localStorage.getItem(THEME_KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch { /* private mode — treat as auto */ }
  return 'auto'
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
  const [choice, setChoice] = useState(getInitialChoice)

  // Applies a choice, but only for changes made here. The initial
  // value is already on <html> (see index.html) — writing it back on
  // mount is what used to freeze a detected OS preference into an
  // explicit saved choice, so later OS changes stopped being honoured.
  function apply(next) {
    setChoice(next)
    try {
      if (next === 'auto') window.localStorage.removeItem(THEME_KEY)
      else window.localStorage.setItem(THEME_KEY, next)
    } catch { /* private mode — the attribute below still applies */ }
    document.documentElement.setAttribute(
      'data-theme',
      next === 'auto' ? osTheme() : next,
    )
    playToggle()
  }

  // While the choice is 自動, a live OS flip must land without a
  // reload — the blocking script only runs at load time.
  useEffect(() => {
    if (choice !== 'auto' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const follow = () => document.documentElement.setAttribute('data-theme', osTheme())
    mq.addEventListener('change', follow)
    return () => mq.removeEventListener('change', follow)
  }, [choice])

  // Settings.dc.html drew this as a pair — 暗 and 明 side by side with
  // the current one filled — because a lone icon button showed the
  // destination, not the state. The 窓口 round added the third state
  // the pair could never say: 自動, "follow the device". Radios rather
  // than pressed-buttons now that there are three: exactly one is
  // chosen, and that is the grammar a radio group announces.
  const OPTIONS = [
    { key: 'dark', jp: '暗', label: t.themeDark },
    { key: 'light', jp: '明', label: t.themeLight },
    { key: 'auto', jp: '自動', label: t.themeAuto, title: t.themeAutoHint },
  ]
  return (
    <div className="theme-choice" role="radiogroup" aria-label={t.theme}>
      {OPTIONS.map(opt => (
        <button
          key={opt.key}
          type="button"
          role="radio"
          onClick={() => { if (choice !== opt.key) apply(opt.key) }}
          className={`theme-choice__btn${choice === opt.key ? ' theme-choice__btn--on' : ''}`}
          aria-checked={choice === opt.key}
          title={opt.title}
        >
          <span className="theme-choice__jp" lang="ja">{opt.jp}</span>
          {opt.label}
        </button>
      ))}
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

function CategoryVolume({ label, value, onChange, disabled, master = false }) {
  const pct = Math.round(value * 100)
  return (
    <div className={`category-volume-row${master ? ' category-volume-row--master' : ''}`}>
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

  // Eight uniform rows with the master leading them, per the 窓口
  // artboard — the master used to be its own boxed card with a
  // hardcoded English title, which made the densest control in the
  // app start with its loudest exception.
  return (
    <div className="sound-mixer">
      <CategoryVolume
        master
        label={t.volumeMaster}
        value={volumes.master}
        onChange={v => setVolume('master', v)}
        disabled={muted}
      />
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
  )
}