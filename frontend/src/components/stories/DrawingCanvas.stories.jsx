import { DrawingOverlay, DrawingQuiz } from '../DrawingCanvas'

// kanjiToSvgUrl 404s with no backend — the <img onError> swaps in the
// stroke-ref fallback automatically, which is the intended offline
// state here, not a bug.
export default {
  title: 'Kanji/DrawingCanvas',
}

// Shown by KanjiScreen when a review is graded low on a m-kj card
// (postReview's needTraining branch) — a quick writing drill before
// moving on.
export const TrainingOverlay = {
  render: () => (
    <DrawingOverlay
      kanji="水"
      meaning="water / eau"
      onDone={() => console.log('[DrawingOverlay] onDone')}
    />
  ),
}

// The prompt used directly in KanjiScreen's "write" quiz mode.
export const WriteModeQuiz = {
  render: () => (
    <DrawingQuiz
      kanji="火"
      meaning="fire / feu"
      kana="ひ"
      onValidate={() => console.log('[DrawingQuiz] onValidate')}
    />
  ),
}