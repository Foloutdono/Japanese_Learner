import { BurgerMenu } from '../BurgerMenu'

// Needs the global Router + LangContext decorators every screen story
// relies on. `open` is internal state — click ☰ to see the drawer.
const REAL_LINKS = [
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
  render: () => <BurgerMenu links={REAL_LINKS} currentPath="/kana" />,
}