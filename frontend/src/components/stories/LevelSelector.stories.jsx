import LevelSelector from '../LevelSelector'

const logSelect = level => console.log('[LevelSelector] onSelect', level)

export default {
  title: 'Selection/LevelSelector',
  component: LevelSelector,
}

// KanjiScreen / ReadingScreen's level-selection step.
export const KanjiAndReading = {
  render: () => <LevelSelector onSelect={logSelect} color="var(--accent3)" />,
}

// VocabScreen's level-selection step — different accent + explicit title.
export const Vocab = {
  render: () => <LevelSelector onSelect={logSelect} color="var(--accent2)" title="Choisis ton niveau" />,
}