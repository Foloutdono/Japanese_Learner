import { SectionHeader } from '../SectionHeader'

export default {
  title: 'Layout/SectionHeader',
  component: SectionHeader,
}

export const Default = {
  render: () => <SectionHeader title="Objectifs" />,
}

export const LongTitle = {
  render: () => <SectionHeader title="Un titre de section volontairement plus long pour vérifier le retour à la ligne" />,
}