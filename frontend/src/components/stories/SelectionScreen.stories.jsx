import SelectionScreen from '../SelectionScreen'
import ModeSelector from '../ModeSelector'
import LevelSelector from '../LevelSelector'

export default {
  title: 'Layout/SelectionScreen',
  component: SelectionScreen,
}

// The common case: KanaScreen's set/mode pickers already render their
// own header, so SelectionScreen is left bare.
export const WithModeSelector = {
  render: () => (
    <SelectionScreen>
      <ModeSelector
        modes={[
          { key: 'flashcard', label: 'Flashcard', desc: 'Révélez la romanisation' },
          { key: 'qcm', label: 'QCM', desc: 'Choisissez la bonne romanisation' },
          { key: 'write', label: 'Écriture', desc: 'Tapez la romanisation' },
        ]}
        onSelect={key => console.log('[SelectionScreen] mode', key)}
        title="Choisissez un mode"
      />
    </SelectionScreen>
  ),
}

// ReadingScreen's level step: subtitle only, LevelSelector supplies
// its own internal header.
export const WithSubtitle = {
  render: () => (
    <SelectionScreen subtitle="Choisis ton niveau">
      <LevelSelector onSelect={lvl => console.log('[SelectionScreen] level', lvl)} color="var(--accent3)" />
    </SelectionScreen>
  ),
}