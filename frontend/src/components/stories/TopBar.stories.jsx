import { TopBar } from '../TopBar'

// Needs Router (useNavigate), LangContext, and useProfileSummary via
// BurgerMenu/TopBarProfileRing/MobileLevelBar — all degrade to null
// with no session, so this still renders a usable header without a
// backend, just without the ring/streak chrome.
// autoHide's scroll-driven show/hide only engages below the 768px
// breakpoint — use the viewport toolbar to see it actually hide.
export default {
  title: 'Nav/TopBar',
  component: TopBar,
}

// KanaScreen's set-selection step: plain header, back to home.
export const SetSelection = {
  render: () => <TopBar title="Kana" onBack={() => console.log('[TopBar] onBack')} />,
}

// KanjiScreen's quiz step: autoHide + the writing-drill toggle action.
export const QuizWithWritingToggle = {
  render: () => (
    <TopBar
      title="Kanji N5 — Écriture"
      onBack={() => console.log('[TopBar] onBack')}
      autoHide
      actions={<button className="btn-writing-toggle btn-writing-toggle--on">✏️ ON</button>}
    />
  ),
}