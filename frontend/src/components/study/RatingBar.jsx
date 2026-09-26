import { useContext, useEffect, useRef, useState } from 'react'
import { useLang } from '../../LangContext'
import { playCorrect, playWrong } from '../../lib/audio'
import { ratingButtons } from '../../domain/ratingScales'
import { useRatingScale } from '../../stores/ratingScale'
import { useDesk } from '../../hooks/useDesk'
import { dialogOpen } from '../../lib/dialogOpen'
import { RunPanelsContext } from './runPanels'

// Keys 1-N map to the bar's buttons. On an AZERTY keyboard the
// unshifted number row types &é"' rather than 1234, so those are
// accepted too — same physical top-row keys, either layout. Key 6 is
// '-' on a French PC keyboard and '§' on a French Mac (plan 123).
const AZERTY_INDEX = { '&': 0, 'é': 1, '"': 2, "'": 3, '(': 4, '-': 5, '§': 5 }

/**
 * `scale` overrides the learner's own choice — tests pass it, and the
 * specimen. Everything else takes the setting, the test ride included
 * (plan 098): the first bar a learner rates on is the one they will
 * keep.
 *
 * `specimen` (plan 139) draws the bar and nothing more: Settings'
 * Notation page offers the three scales as the bar each one is, so the
 * choice is made by looking at the instrument rather than at a list of
 * its words. Its tiles are not buttons (it sits inside the radio that
 * picks it), it hears no key and it is hidden from a screen reader,
 * the radio naming the words instead.
 */
// How long the pressed segment stays lit after the rating is taken.
// The bar goes idle the instant a rating lands (see each screen's
// setShowRating(false)), and .rating-bar--idle now fades rather than
// vanishes, so the seal the learner just pressed is still on screen
// filled while the card underneath moves on — the acknowledgement is
// the ring closing, not a toast. Matched to the idle fade in index.css.
const PRESSED_MS = 420

export default function RatingBar({ onRate, active, scale, guide, specimen = false }) {
  const { t } = useLang()
  const preferred = useRatingScale()
  const desk = useDesk()
  // On the run's panels (plan 126) the tiles print no digit -- the card
  // panel's verdict tiles carry them -- and stand unlit and inert before
  // the reveal rather than unseen: the console's buttons are drawn, dark,
  // until there is something to press.
  const panels = useContext(RunPanelsContext)
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
  // A specimen stands inside a button, where only phrasing content goes.
  const Box = specimen ? 'span' : 'div'

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
      // No input guard: a typed-answer run rates from its field. A field
      // that is not the answer's says so (`data-own-keys`): the asking's
      // (plan 131) is open beside a reopened line while this sentence
      // still waits for its grade, and "1" typed in a question is text.
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey || dialogOpen()) return
      if (e.target?.closest?.('[data-own-keys]')) return
      const idx = e.key in AZERTY_INDEX ? AZERTY_INDEX[e.key] : parseInt(e.key) - 1
      if (idx >= 0 && idx < QUALITY_BTNS.length) handleRate(QUALITY_BTNS[idx].q)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [active, onRate, QUALITY_BTNS.length])

  // Rendered even before the reveal, inert, so its space is RESERVED.
  // Returning null here used to make the bar appear out of nowhere on
  // reveal -- and because .stage is a centred flex column, adding
  // 58px of bar plus an 18px gap below the card pushed everything above
  // it up by half that. Measured on a vocab card: the card shrinks 7px
  // on reveal but moves up 34px, so the jump was almost entirely this.
  //
  // .rating-bar--idle is `visibility: hidden`, which (unlike opacity)
  // also takes the buttons out of the tab order and out of hit-testing,
  // so nothing is reachable before there is a card to rate. The
  // keyboard handler above is separately gated on `active`.
  return (
    <Box className={`rating-bar${specimen ? ' rating-bar--specimen' : active ? '' : (panels ? ' rating-bar--unlit' : ' rating-bar--idle')}`} aria-hidden={specimen || !active} data-guide={guide}>
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
      <Box className={`rating-bar__buttons rating-bar__buttons--${QUALITY_BTNS.length}`}>
        {specimen && QUALITY_BTNS.slice().reverse().map(({ q, label }) => (
          <span key={q} className={`rating-bar__btn rating-bar__btn--q${q}${q === QUALITY_BTNS[0].q ? ' rating-bar__btn--best' : ''}`}>
            {q !== QUALITY_BTNS[0].q && <span className="rating-bar__btn-ring" />}
            <span className="rating-bar__btn-label">{label}</span>
          </span>
        ))}
        {!specimen && QUALITY_BTNS.map((b, i) => ({ ...b, digit: i + 1 })).reverse().map(({ q, label, digit }) => (
          <button
            key={q}
            type="button"
            disabled={panels && !active}
            onClick={() => handleRate(q)}
            /* The best answer the bar offers is the one tile filled
               gold (index.css, .rating-bar__btn--best): the press most
               taken, drawn as the one to reach for. Best-first, so it
               is QUALITY_BTNS[0] on every scale. */
            className={`rating-bar__btn rating-bar__btn--q${q}${q === QUALITY_BTNS[0].q ? ' rating-bar__btn--best' : ''}${pressed === q ? ' rating-bar__btn--pressed' : ''}`}
            /* The digits are NOT in display order: QUALITY_BTNS is
               best-first, so "1" is the best answer at the RIGHT end and
               the highest digit is the worst at the left. On a phone they
               are not drawn at all (numeric indices are noise on a
               thumb's control, and a thumb has no number row), so the
               shortcut is announced to assistive tech and shown on hover.
               On the desk (plan 113) there IS a keyboard under the hands,
               and undiscoverable-and-reversed was the bad pair: each tile
               prints its key in its corner, which is what makes the
               reversal readable. */
            aria-keyshortcuts={String(digit)}
            title={`${label} (${digit})`}
          >
            {desk && !panels && <kbd className="desk-kbd" aria-hidden="true">{digit}</kbd>}
            {/* The ring is the whole colour story now: unfilled at rest,
                filled when this rating is the one chosen. Marked hidden
                because it says nothing the label does not -- it is the
                seal, and the word beside it is the name. */}
            {q !== QUALITY_BTNS[0].q && <span className="rating-bar__btn-ring" aria-hidden="true" />}
            <span className="rating-bar__btn-label">{label}</span>
          </button>
        ))}
      </Box>
    </Box>
  )
}
