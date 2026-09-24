import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLang } from '../../LangContext'
import { DictionaryLookupBody } from '../dictionary/DictionaryDetail'
import { lookupKey } from './lookup'
import { dialogOpen } from '../../lib/dialogOpen'
import { holdEsc } from '../../stores/escHold'

// ── 机 — a door in a docked breakdown opens beside it (plan 115) ──
// A breakdown standing in a run's side column (BreakdownSide, the
// comprehension results) is full of doors: a word opens its dictionary
// entry, a rule its lesson. On the phone each opens a sheet over the
// run; in the desk's column that sheet was a dialog with a scrim over
// the very sentence the learner was reading. Here the entry opens IN
// the column instead: the breakdown steps aside (kept mounted, so its
// open sentence and its lights survive), `head` — the sentence's ruby
// line — stays above the entry so the next word is one click, and the
// entry's ✕ or Esc brings the breakdown back where it was scrolled.
// A grammar run wraps its session panel the same way (plan 120): the
// rival a gate lesson's compare row names opens here, not over the run.
//
// Focus (plan 123): the row that opened the entry is hidden with the
// breakdown, and the focus fell to the page's body with it -- Tab began
// again at the top of the screen, and closing the entry gave nothing
// back. The entry takes the focus on the way in (its section, so the
// next Tab is its plate's first control), and the row that opened it
// has it again on the way out, the breakdown scrolled where it was.
export function SideLookup({ lookup, onExit, session, head, children }) {
  const { t } = useLang()
  const ref = useRef(null)
  const saved = useRef(0)
  const opener = useRef(null)
  const entry = useRef(null)
  const was = useRef(false)
  const open = Boolean(lookup)
  const key = lookupKey(lookup)

  // The column's scroll: remembered while the breakdown is showing, the
  // top for each entry, and the remembered place again on the way back.
  // A layout effect, so the listener is gone before the hidden
  // breakdown's shorter column clamps the scroll to zero.
  useLayoutEffect(() => {
    const column = ref.current?.closest('.desk-run__side')
    if (!column) return undefined
    if (open) {
      column.scrollTop = 0
      return undefined
    }
    column.scrollTop = saved.current
    const onScroll = () => { saved.current = column.scrollTop }
    column.addEventListener('scroll', onScroll, { passive: true })
    return () => column.removeEventListener('scroll', onScroll)
  }, [open, key])

  // After the scroll above: the row comes back into the place it was
  // scrolled to, and takes the focus without moving it.
  useLayoutEffect(() => {
    if (open && !was.current) entry.current?.focus({ preventScroll: true })
    if (!open && was.current) {
      const active = document.activeElement
      if (opener.current?.isConnected && (!active || active === document.body)) opener.current.focus({ preventScroll: true })
    }
    was.current = open
  }, [open])

  // The run's head drops its Esc while the entry holds the key.
  useEffect(() => (open ? holdEsc() : undefined), [open])

  useEffect(() => {
    if (!open) return undefined
    const onKey = e => {
      if (e.key !== 'Escape' || dialogOpen()) return
      e.preventDefault()
      onExit?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onExit])

  return (
    <div ref={ref} className="desk-lookup">
      <div hidden={open} onFocus={e => { opener.current = e.target }}>{children}</div>
      {open && head}
      {open && (
        <section ref={entry} className="desk-entry" aria-label={t.openDictionary} tabIndex={-1}>
          <DictionaryLookupBody key={key} {...lookup} session={session} onExit={onExit} />
        </section>
      )}
    </div>
  )
}
