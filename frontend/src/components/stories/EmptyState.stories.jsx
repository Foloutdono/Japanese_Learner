import EmptyState from '../EmptyState'

export default {
  title: 'Feedback/EmptyState',
  component: EmptyState,
}

export const EmptyDeck = {
  render: () => (
    <EmptyState
      icon="🃏"
      message="Ce deck est vide"
      hint="Ajoute des cartes pour commencer à réviser"
      action={{ label: 'Ajouter une carte', onClick: () => console.log('[EmptyState] action clicked') }}
    />
  ),
}