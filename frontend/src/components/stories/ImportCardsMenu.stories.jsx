import ImportCardsMenu from '../ImportCardsMenu'

// onImport must return a promise — handleImport awaits it before the
// submit button leaves "Import en cours…".
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