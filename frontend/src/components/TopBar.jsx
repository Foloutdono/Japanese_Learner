import { useLang } from '../LangContext'
import { getNavLinks } from '../navLinks'
import { MuteButton, LangSwitcher } from './NavControls'
import { BurgerMenu } from './BurgerMenu'

// Re-exported for backward compatibility with existing imports
// (e.g. `import { LangSwitcher } from '../components/TopBar'`)
export { MuteButton, LangSwitcher }

// ── Standard top bar ──────────────────────────────────────
export function TopBar({ onBack, title }) {
  const { t } = useLang()

  return (
    <div className="top-bar">
      <BurgerMenu links={getNavLinks(t)} />
      <button className="btn-back" onClick={onBack}>{t.menu}</button>
      <span className="top-bar__title">{title}</span>
      <MuteButton />
      <LangSwitcher />
    </div>
  )
}

// ── Kanji top bar (adds writing toggle) ───────────────────
export function KanjiTopBar({ onBack, onClick, title, drawingEnabled }) {
  const { t } = useLang()

  return (
    <div className="top-bar">
      <BurgerMenu links={getNavLinks(t)} />
      <button className="btn-back" onClick={onBack}>{t.menu}</button>
      <span className="top-bar__title">{title}</span>
      <MuteButton />
      <LangSwitcher />
      <button
        onClick={onClick}
        className={`btn-writing-toggle ${drawingEnabled ? 'btn-writing-toggle--on' : 'btn-writing-toggle--off'}`}
        title={t.toggleWriting}
      >
        ✏️ {drawingEnabled ? t.writingOn : t.writingOff}
      </button>
    </div>
  )
}