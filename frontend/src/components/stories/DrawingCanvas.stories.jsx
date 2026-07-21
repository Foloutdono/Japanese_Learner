import { DrawingOverlay, DrawingQuiz } from '../DrawingCanvas'

// ── DrawingCanvas ─────────────────────────────────────────
// kanjiToSvgUrl requests `${VITE_API_URL}/kanjivg/{codepoint}.svg` for
// the stroke-order reference — that 404s with no backend behind
// Storybook, which is fine: the <img onError> swaps in
// .stroke-ref__fallback automatically, so a missing stroke image here
// is the intended offline fallback, not a bug in this story.
//
// DrawingQuiz's "after validate" (revealed correction panel) is
// internal useState — click "Reveal answer" in the canvas itself
// rather than looking for a separate story for it.
export default {
  title: 'Kanji/DrawingCanvas',
}

export const Overlay = {
  render: () => (
    <DrawingOverlay
      kanji="水"
      meaning="water / eau"
      onDone={() => console.log('[DrawingOverlay] onDone')}
    />
  ),
}

export const QuizBeforeValidate = {
  render: () => (
    <DrawingQuiz
      kanji="火"
      meaning="fire / feu"
      kana="ひ"
      onValidate={() => console.log('[DrawingQuiz] onValidate')}
    />
  ),
}