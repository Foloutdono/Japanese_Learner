import { useLang } from '../../LangContext'
import { useRatingScale } from '../../stores/ratingScale'
import { ratingButtons } from '../../domain/ratingScales'

// ── 机 — what a sentence run hands its lines (plan 129) ──
// The two pieces the four sentence runs (reading, translation,
// dictation, composition) pass to components/study/RunLines.jsx, kept
// apart from it so that file exports components only.

// The keys of a sentence run, as its lines print them: Enter checks the
// answer and then takes the next sentence (plan 123's type, Enter, a
// digit, Enter), the digits grade -- as many as the learner's own scale
// has -- Esc leaves; a dictation line is played, and a reading
// sentence shown, on Space first.
export function useSentenceKeys({ listen = false, reveal = false } = {}) {
  const { t } = useLang()
  const scale = useRatingScale()
  const n = ratingButtons(scale, t).length
  return [
    ...(listen ? [[t.keySpace, t.deskKeyListen]] : []),
    ...(reveal ? [[t.keySpace, t.deskKeyReveal]] : []),
    [t.keyEnter, t.deskKeyCheckNext],
    [`1–${n}`, t.deskKeyRate],
    [t.keyEscape, t.deskKeyLeave],
  ]
}

// The row of the sentence on the stage: an ellipsis until the answer is
// in -- the line list stands beside the card, and before the answer the
// sentence is the card's to show or to cover (reading's clock covers
// it) and dictation's to withhold -- then the line itself, graded or not.
export function currentLine(text, quality = null) {
  return text ? { label: text, lang: 'ja', quality } : { label: '…', lang: undefined, quality: null }
}
