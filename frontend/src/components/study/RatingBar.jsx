import { useContext, useEffect, useRef, useState } from 'react'
import { useLang } from '../../LangContext'
import { playCorrect, playWrong } from '../../lib/audio'
import { ratingButtons } from '../../domain/ratingScales'
import { useRatingScale } from '../../stores/ratingScale'
import { useDesk } from '../../hooks/useDesk'
import { dialogOpen } from '../../lib/dialogOpen'
import { RunPanelsContext } from './runPanels'
import { CheckIcon } from '../ui/Icons'

// Keys 1-N map to the bar's buttons. On an AZERTY keyboard the
// unshifted number row types &é"' rather than 1234, so those are
// accepted too — same physical top-row keys, either layout. Key 6 is
// '-' on a French PC keyboard and '§' on a French Mac (plan 123).
const AZERTY_INDEX = { '&': 0, 'é': 1, '"': 2, "'": 3, '(': 4, '-': 5, '§': 5 }

// 正解 (plan 180): the passes -- Correct, and Perfect on the six -- are
// keys of their own beside the instrument the misses make, each filled
// in its verdict's ink. Correct is the answer pressed most, so it is
// the biggest target and the one thing on the bar in colour. Gold
// stays the action's metal (plan 174): a pass is lit in its own ink.
const isKey = q => q >= 4

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

  // Worst to best, as the bar draws them. `.map()` returns a new array,
  // so the `.reverse()` sorts that copy and never QUALITY_BTNS itself;
  // the digit is captured BEFORE the reverse, the only place it can be
  // read correctly, while the keyboard handler above keeps indexing the
  // untouched original.
  const tiles = QUALITY_BTNS.map((b, i) => ({ ...b, digit: i + 1 })).reverse()
  const best = QUALITY_BTNS[0].q

  // One tile. A miss is a segment of the instrument, a word under its
  // verdict's pill; a pass (正解, plan 180) is a key of its own, filled
  // in its verdict's ink, a check where the pill was. The --best mark
  // stays on the best answer the bar offers (QUALITY_BTNS[0] on every
  // scale, best-first), for the tests and the guide.
  function tile({ q, label, digit }) {
    const cls = [
      'rating-bar__btn',
      `rating-bar__btn--q${q}`,
      isKey(q) && 'rating-bar__btn--key',
      q === best && 'rating-bar__btn--best',
      !specimen && pressed === q && 'rating-bar__btn--pressed',
    ].filter(Boolean).join(' ')
    const mark = isKey(q)
      ? <CheckIcon size={18} className="rating-bar__btn-check" />
      : <span className="rating-bar__btn-ring" aria-hidden="true" />
    if (specimen) {
      return (
        <span key={q} className={cls}>
          {mark}
          <span className="rating-bar__btn-label">{label}</span>
        </span>
      )
    }
    return (
      <button
        key={q}
        type="button"
        disabled={panels && !active}
        onClick={() => handleRate(q)}
        className={cls}
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
        {/* The pill (or a key's check) says nothing the label does not
            -- it is the seal, and the word beside it is the name -- so
            it is hidden from a screen reader. Its ink is the verdict's,
            the same as the run meter's segment (RunConsole.jsx). */}
        {mark}
        <span className="rating-bar__btn-label">{label}</span>
      </button>
    )
  }

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
      {/* Worst to best, in DOM order too (and therefore tab and
          screen-reader order): the misses as one instrument, then the
          passes as keys beside it -- see index.css for why.

          The count rides on the container because the phone layout
          depends on it: six wrap to the four misses over the two keys,
          and nth-child cannot count its own siblings. */}
      <Box className={`rating-bar__buttons rating-bar__buttons--${QUALITY_BTNS.length}`}>
        <Box className="rating-bar__misses">{tiles.filter(b => !isKey(b.q)).map(tile)}</Box>
        <Box className="rating-bar__keys">{tiles.filter(b => isKey(b.q)).map(tile)}</Box>
      </Box>
    </Box>
  )
}
