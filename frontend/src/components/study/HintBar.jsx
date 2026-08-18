import { useLang } from '../../LangContext'
import { LightbulbIcon } from '../ui/Icons'

// ── The hint switch ───────────────────────────────────────────
// A hint is something you reach for on a card you are stuck on, so it
// lives ON the card, not back on the mode picker: you only find out
// whether you needed the choices once you are looking at the prompt.
//
// This replaces the old "MCQ mode" vs "flashcard mode" split. Those were
// never two exercises — they were one question at two help levels, which
// is why they had two separate SRS tracks for the same knowledge. The
// help level is a switch now, and a hint deliberately does NOT fork the
// SRS: what a review consumes is the learner's own 1-4 self-rating,
// which means the same thing whether or not four options were on screen.
//
// Rendered from the hints actually present on the payload rather than
// from the mode's declared hints, so a card that could not produce a
// given hint (a personal card has no distractors; a grammar point with
// no cached sentences has no examples) simply doesn't offer it instead
// of showing a control that would do nothing.
//
// Props:
//   available — hint keys this card can actually offer, e.g. ['indice_1']
//   active    — Set/array of hint keys currently switched on
//   onToggle  — (hintKey) => void
//   disabled  — true while the card is locked mid-review
export default function HintBar({ available = [], active = [], onToggle, disabled = false }) {
  const { t } = useLang()
  if (available.length === 0) return null

  const isOn = key => (active instanceof Set ? active.has(key) : active.includes(key))

  // Sorted by their own numbering rather than left in whatever order the
  // payload happened to build them. indice_1/2/3 is a stated order, and a
  // control that moves depending on which card you are looking at is a
  // control you have to re-find every time.
  const ordered = [...available].sort()

  const LABELS = {
    indice_1: [t.hintChoicesShow, t.hintChoicesHide],
    indice_2: [t.hintSentencesShow, t.hintSentencesHide],
    indice_3: [t.hintFuriganaShow, t.hintFuriganaHide],
  }

  return (
    <div className="study-assist">
      {ordered.map(key => {
        const on = isOn(key)
        const [showLabel, hideLabel] = LABELS[key] ?? [key, key]
        return (
          <button
            key={key}
            type="button"
            className={`study-assist__toggle${on ? ' study-assist__toggle--on' : ''}`}
            onClick={() => onToggle(key)}
            disabled={disabled}
            aria-pressed={on}
          >
            <LightbulbIcon size={14} />
            {on ? hideLabel : showLabel}
          </button>
        )
      })}
    </div>
  )
}
