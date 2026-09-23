import { useEffect, useLayoutEffect, useRef } from 'react'
import { useLang } from '../../LangContext'
import { DictionaryLookupBody } from '../dictionary/DictionaryDetail'
import { lookupKey } from './lookup'
import { dialogOpen } from '../../lib/dialogOpen'

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
export function SideLookup({ lookup, onExit, session, head, children }) {
  const { t } = useLang()
  const ref = useRef(null)
  const saved = useRef(0)
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
      <div hidden={open}>{children}</div>
      {open && head}
      {open && (
        <section className="desk-entry" aria-label={t.openDictionary}>
          <DictionaryLookupBody key={key} {...lookup} session={session} onExit={onExit} />
        </section>
      )}
    </div>
  )
}
