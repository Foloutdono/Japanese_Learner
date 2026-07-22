import ModeSelector from '../ModeSelector'

const logSelect = key => console.log('[ModeSelector] onSelect', key)

// Matches KanaScreen's mode keys exactly (compared directly against
// `mode` in its render: 'flashcard' | 'qcm' | 'write').
const KANA_MODES = [
  { key: 'flashcard', label: 'Flashcard', desc: 'Révélez la romanisation' },
  { key: 'qcm', label: 'QCM', desc: 'Choisissez la bonne romanisation' },
  { key: 'write', label: 'Écriture', desc: 'Tapez la romanisation' },
]

// Matches KanjiScreen/VocabScreen's mode keys — direction (kj-m /
// m-kj) × format (flashcard / qcm), plus the standalone write mode.
const KANJI_MODES = [
  { key: 'kj-m-flashcard', label: 'Kanji → sens (flashcard)' },
  { key: 'kj-m-qcm', label: 'Kanji → sens (QCM)' },
  { key: 'm-kj-flashcard', label: 'Sens → kanji (flashcard)' },
  { key: 'm-kj-qcm', label: 'Sens → kanji (QCM)' },
  { key: 'write', label: 'Écriture' },
]

export default {
  title: 'Selection/ModeSelector',
  component: ModeSelector,
}

export const KanaModes = {
  render: () => <ModeSelector modes={KANA_MODES} onSelect={logSelect} title="Choisissez un mode" />,
}

export const KanjiModes = {
  render: () => <ModeSelector modes={KANJI_MODES} onSelect={logSelect} title="Choisissez un mode" />,
}