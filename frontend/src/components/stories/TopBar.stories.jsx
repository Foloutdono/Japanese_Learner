import { TopBar } from '../TopBar'

// ── TopBar ────────────────────────────────────────────────
// The heaviest dependency chain in this set: useNavigate (Router),
// useLang, getNavLinks (../navLinks — not covered by a story here),
// BurgerMenu (see BurgerMenu.stories.jsx for its own caveats), and
// useProfileSummary via both BurgerMenu and TopBar's own
// TopBarProfileRing/MobileLevelBar. All of that degrades gracefully
// with no session/backend — the ring and the mobile level bar both
// render null until a summary actually exists — so this should still
// show a usable header, just without that chrome, in a bare
// Storybook environment.
//
// autoHide's scroll-driven show/hide only engages below the 768px
// mobile breakpoint — use Storybook's viewport toolbar to actually
// see `AutoHide` hide anything; at desktop width it always renders
// visible regardless of the prop.
export default {
  title: 'Nav/TopBar',
  component: TopBar,
}

export const Static = {
  render: () => <TopBar title="Kana" onBack={() => console.log('[TopBar] onBack')} />,
}

export const WithActions = {
  render: () => (
    <TopBar
      title="Kanji N5 — Écriture"
      onBack={() => console.log('[TopBar] onBack')}
      actions={<button className="btn-writing-toggle">✏️ ON</button>}
    />
  ),
}

export const AutoHide = {
  // See the viewport note above — resize the canvas below 768px to
  // actually exercise the hide/reveal behaviour.
  render: () => <TopBar title="Kana — QCM" onBack={() => console.log('[TopBar] onBack')} autoHide />,
}