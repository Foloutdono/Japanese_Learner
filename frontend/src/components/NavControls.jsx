import { useLang } from '../LangContext'
import { LANGUAGES } from '../i18n'
import { useMuted, toggleMute } from './sound'

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