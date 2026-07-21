import ImportCardsMenu from '../ImportCardsMenu'

// onImport must return a promise — handleImport awaits it before
// flipping the submit button back out of "Import en cours…". Swap
// the resolved promise below for one that never settles if that
// stuck-button state is what you're actually trying to reproduce.
export default {
  title: 'Decks/ImportCardsMenu',
  component: ImportCardsMenu,
}

export const Default = {
  render: () => (
    <ImportCardsMenu
      onImport={cards => {
        console.log('[ImportCardsMenu] onImport', cards)
        return Promise.resolve()
      }}
      onClose={() => console.log('[ImportCardsMenu] onClose')}
    />
  ),
}