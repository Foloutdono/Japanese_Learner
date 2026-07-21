import EmptyState from '../EmptyState'

export default {
  title: 'Feedback/EmptyState',
  component: EmptyState,
}

export const Default = {
  render: () => <EmptyState message="Aucune carte pour l'instant" />,
}

export const WithHint = {
  render: () => (
    <EmptyState
      icon="📚"
      message="Aucun deck pour l'instant"
      hint="Crée ton premier deck pour commencer"
    />
  ),
}

export const WithAction = {
  render: () => (
    <EmptyState
      icon="🃏"
      message="Ce deck est vide"
      hint="Ajoute des cartes pour commencer à réviser"
      action={{ label: 'Ajouter une carte', onClick: () => console.log('[EmptyState] action clicked') }}
    />
  ),
}