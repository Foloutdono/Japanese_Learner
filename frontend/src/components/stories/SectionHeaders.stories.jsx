import { SectionHeader } from '../SectionHeader'

export default {
  title: 'Layout/SectionHeader',
  component: SectionHeader,
}

// One of StatsScreen's actual section titles.
export const Default = {
  render: () => <SectionHeader title="Kana" />,
}

export const LongTitle = {
  render: () => <SectionHeader title="Un titre de section volontairement plus long pour vérifier le retour à la ligne" />,
}