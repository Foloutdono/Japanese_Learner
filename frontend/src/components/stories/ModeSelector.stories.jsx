import ModeSelector from '../ModeSelector'

const logSelect = key => console.log('[ModeSelector] onSelect', key)

const SAMPLE_MODES = [
  { key: 'flashcard', label: 'Flashcard', desc: 'Révélez la romanisation' },
  { key: 'qcm', label: 'QCM', desc: 'Choisissez la bonne romanisation' },
  { key: 'write', label: 'Écriture', desc: 'Tapez la romanisation' },
]

export default {
  title: 'Selection/ModeSelector',
  component: ModeSelector,
}

export const Default = {
  render: () => <ModeSelector modes={SAMPLE_MODES} onSelect={logSelect} title="Choisissez un mode" />,
}

export const WithPerRowColor = {
  // m.color is only meant for genuine semantic distinctions (see the
  // component's own doc comment) — this is the "right vs wrong" case
  // it calls out, not decoration.
  render: () => (
    <ModeSelector
      modes={[
        { key: 'ok', label: 'Correct', desc: 'Bonne réponse', color: 'var(--success)' },
        { key: 'ko', label: 'Incorrect', desc: 'Mauvaise réponse', color: 'var(--danger)' },
      ]}
      onSelect={logSelect}
    />
  ),
}

export const NoDescriptions = {
  render: () => (
    <ModeSelector
      modes={SAMPLE_MODES.map(({ key, label }) => ({ key, label }))}
      onSelect={logSelect}
    />
  ),
}