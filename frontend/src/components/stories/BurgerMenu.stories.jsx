import { BurgerMenu } from '../BurgerMenu'

// ── BurgerMenu ────────────────────────────────────────────
// Needs a Router context (useNavigate) and LangContext (useLang) —
// assumes the same global decorators every other screen's stories
// rely on. BurgerProfileRow additionally calls useProfileSummary(),
// which on mount tries a real supabase.auth.getSession() — with no
// session (the normal case here) that resolves to nothing and it
// silently falls back to the plain "Profil" link, so this still
// renders fine with no backend; it just won't show the ring/streak
// preview unless something already primed the module-level cache
// (e.g. a ProfileScreen story ran earlier in the same session).
//
// `open` is internal state with no prop to force it — as with the
// real header, click ☰ to actually see the drawer.
const SAMPLE_LINKS = [
  { icon: 'あ', title: 'Kana', path: '/kana' },
  { icon: '語', title: 'Vocabulaire', path: '/vocab' },
  { icon: '字', title: 'Kanji', path: '/kanji' },
  { icon: '文', title: 'Grammaire', path: '/grammar' },
]

export default {
  title: 'Nav/BurgerMenu',
  component: BurgerMenu,
}

export const Default = {
  render: () => <BurgerMenu links={SAMPLE_LINKS} currentPath="/kana" />,
}

export const NoActivePath = {
  render: () => <BurgerMenu links={SAMPLE_LINKS} currentPath={null} />,
}