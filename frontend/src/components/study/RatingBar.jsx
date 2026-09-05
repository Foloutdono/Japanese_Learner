import { useEffect, useRef, useState } from 'react'
import { useLang } from '../../LangContext'
import { playCorrect, playWrong } from '../../lib/audio'
import { ratingButtons } from '../../domain/ratingScales'
import { useRatingScale } from '../../stores/ratingScale'

// Keys 1-N map to the bar's buttons. On an AZERTY keyboard the
// unshifted number row types &é"' rather than 1234, so those are
// accepted too — same physical top-row keys, either layout.
const AZERTY_INDEX = { '&': 0, 'é': 1, '"': 2, "'": 3, '(': 4, '§': 5 }

/**
 * `scale` overrides the learner's own choice — only the onboarding
 * demo and tests pass it. Everything else takes the setting.
 */
// How long the pressed segment stays lit after the rating is taken.
// The bar goes idle the instant a rating lands (see each screen's
// setShowRating(false)), and .rating-bar--idle now fades rather than
// vanishes, so the seal the learner just pressed is still on screen
// filled while the card underneath moves on — the acknowledgement is
// the ring closing, not a toast. Matched to the idle fade in index.css.
const PRESSED_MS = 420

// ── The instrument's form — an open choice ─────────────────────
// Three drawings of the same bar are side by side while the maintainer
// picks one (see "the rating bar" in index.css): the choice is read
// per bar from localStorage so it can be tried in a real session from
// /dev/rewards, and a caller may name a form outright (the workbench
// does). The picked one stays; the others go, and so does this.
// eslint-disable-next-line react-refresh/only-export-components -- the workbench's list, co-located with the bar it draws.
export const RATING_FORMS = [
  { key: 'ring',  jp: '輪', label: 'Ring above the word (current)' },
  { key: 'board', jp: '標', label: 'Board row: the ramp as a rule' },
  { key: 'dock',  jp: '改札', label: 'Sumi dock, one with the HUD' },
  { key: 'pill',  jp: '札', label: 'Hairline pill, colour on press' },
]
const DEFAULT_RATING_FORM = 'ring'
const FORM_KEY = 'jp-rating-form'

// eslint-disable-next-line react-refresh/only-export-components -- the form switch is the workbench's, co-located with the bar it switches.
export function readRatingForm() {
  try {
    const v = window.localStorage.getItem(FORM_KEY)
    return RATING_FORMS.some(f => f.key === v) ? v : DEFAULT_RATING_FORM
  } catch {
    return DEFAULT_RATING_FORM
  }
}

// eslint-disable-next-line react-refresh/only-export-components -- see readRatingForm.
export function setRatingForm(key) {
  try { window.localStorage.setItem(FORM_KEY, key) } catch { /* not persisted */ }
}

export default function RatingBar({ onRate, active, scale, form }) {
  const { t } = useLang()
  const preferred = useRatingScale()
  const drawn = form ?? readRatingForm()
  const [pressed, setPressed] = useState(null)
  const pressedTimer = useRef(null)
  useEffect(() => () => clearTimeout(pressedTimer.current), [])

  // Best-first, and it must STAY that way -- the keyboard handler below
  // indexes this array positionally, so "1" means the best answer only
  // as long as index 0 IS the best answer. The bar renders worst-first
  // (see the JSX below), but that's a display-only reversal; reversing
  // the array instead would silently flip every digit shortcut. See
  // RatingBar.browser.test.jsx, which pins this contract on both bars.
  //
  // Which buttons those are is the learner's choice (settings → 学習):
  // four (wrong / almost / difficult / correct) or all six. Both send
  // the same 0..5 quality, so "1" is the best answer either way and the
  // digits keep their meaning across a switch. See domain/ratingScales.
  const QUALITY_BTNS = ratingButtons(scale ?? preferred, t)

  // Shared by the on-screen buttons and the keyboard shortcuts below,
  // so a rating fired either way gets the same tap feedback.
  function handleRate(q) {
    if (q > 2)
      playCorrect()
    else
      playWrong()
    setPressed(q)
    clearTimeout(pressedTimer.current)
    pressedTimer.current = setTimeout(() => setPressed(null), PRESSED_MS)
    onRate(q)
  }

  useEffect(() => {
    if (!active) return
    const handler = e => {
      const idx = e.key in AZERTY_INDEX ? AZERTY_INDEX[e.key] : parseInt(e.key) - 1
      if (idx >= 0 && idx < QUALITY_BTNS.length) handleRate(QUALITY_BTNS[idx].q)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [active, onRate, QUALITY_BTNS.length])

  // Rendered even before the reveal, inert, so its space is RESERVED.
  // Returning null here used to make the bar appear out of nowhere on
  // reveal -- and because .quiz-area is a centred flex column, adding
  // 58px of bar plus an 18px gap below the card pushed everything above
  // it up by half that. Measured on a vocab card: the card shrinks 7px
  // on reveal but moves up 34px, so the jump was almost entirely this.
  //
  // .rating-bar--idle is `visibility: hidden`, which (unlike opacity)
  // also takes the buttons out of the tab order and out of hit-testing,
  // so nothing is reachable before there is a card to rate. The
  // keyboard handler above is separately gated on `active`.
  return (
    <div className={`rating-bar rating-bar--${drawn}${active ? '' : ' rating-bar--idle'}`} aria-hidden={!active}>
      {/* One continuous instrument, worst to best -- see index.css for
          why. `.map()` already returns a new array, so the `.reverse()`
          below sorts that copy and never QUALITY_BTNS itself; DOM order
          (and therefore tab and screen-reader order) matches what is on
          screen while the keyboard handler above keeps indexing the
          untouched original. The digit is captured BEFORE the reverse,
          which is the only place it can be read correctly.

          The count rides on the container because the phone layout
          depends on it: six segments wrap to two rows of three, four to
          two of two, and the hairlines between them have to be redrawn
          for whichever grid that is. */}
      <div className={`rating-bar__buttons rating-bar__buttons--${QUALITY_BTNS.length}`}>
        {QUALITY_BTNS.map((b, i) => ({ ...b, digit: i + 1 })).reverse().map(({ q, label, digit }) => (
          <button
            key={q}
            type="button"
            onClick={() => handleRate(q)}
            className={`rating-bar__btn rating-bar__btn--q${q}${pressed === q ? ' rating-bar__btn--pressed' : ''}`}
            /* The digits are deliberately NOT drawn (numeric indices are
               noise on a control this size) and are deliberately NOT in
               display order: QUALITY_BTNS is best-first, so "1" is the
               best answer at the RIGHT end and the highest digit is the
               worst at the left. Undiscoverable and reversed is a bad
               pair, so the shortcut is at least announced to assistive
               tech and shown on hover. */
            aria-keyshortcuts={String(digit)}
            title={`${label} (${digit})`}
          >
            {/* The ring is the whole colour story now: unfilled at rest,
                filled when this rating is the one chosen. Marked hidden
                because it says nothing the label does not -- it is the
                seal, and the word beside it is the name. */}
            <span className="rating-bar__btn-ring" aria-hidden="true" />
            <span className="rating-bar__btn-label">{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
