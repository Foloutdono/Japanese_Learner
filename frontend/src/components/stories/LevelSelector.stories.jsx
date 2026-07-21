import LevelSelector from '../LevelSelector'

const logSelect = level => console.log('[LevelSelector] onSelect', level)

export default {
  title: 'Selection/LevelSelector',
  component: LevelSelector,
}

export const Default = {
  render: () => <LevelSelector onSelect={logSelect} />,
}

export const CustomColor = {
  render: () => <LevelSelector onSelect={logSelect} color="var(--accent2)" />,
}

export const CustomLevels = {
  render: () => (
    <LevelSelector
      onSelect={logSelect}
      levels={['N5', 'N4']}
      title="Choisis un niveau (démo restreinte)"
    />
  ),
}

export const NoTitle = {
  // Matches how it's actually mounted inside <SelectionScreen>, which
  // supplies its own header — title="" here checks the header block
  // collapses cleanly instead of leaving an empty bar.
  render: () => <LevelSelector onSelect={logSelect} title="" />,
}