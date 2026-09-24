import { useEffect, useId, useRef } from 'react'
import { useLang } from '../../LangContext'
import { CloseIcon } from '../ui/Icons'
import { dialogOpen } from '../../lib/dialogOpen'
import { composing } from '../../lib/keyGuards'

// ── 机 — a door opened in the page's own column (plans 115, 120) ─────
// On the desk a door that does not interrupt opens beside the page
// rather than over it: into the screen's second column (DeskSide), in
// place of whatever the column was holding, which comes back when the
// dock closes. This is the dock's shell — a named section, its caption
// and a ✕ — shared by a deck's Browse and More and the analyser's grab
// tutorial. Esc closes it too, unless a dialog above it owns the key;
// the key is marked spent, so a run's own Esc (DeskKeys) never answers
// it twice. Focus goes back to whatever opened the dock when the dock
// takes focus with it, as a dialog's does (hooks/useDialog).
//
// Rendered only on the desk, by the screen that owns the column.
//
// Focus (plan 123): the dock takes it on the way in and gives it back on
// the way out, one way for every door. It first remembers what had the
// focus -- the chip that opened it -- then puts it on `initialFocus` (a
// selector inside the dock: Browse's search, the card form's first
// field), or on its own caption when there is nothing to type in, so the
// next Tab is the dock's first control rather than the next of the
// cards listed before the column. None of its children autofocuses:
// one that did ran before this, and the dock remembered the child as its
// opener. The ✕ is the column's own, the entry's roundel.
export function DeskDock({ title, onClose, className = '', initialFocus, children }) {
  const { t } = useLang()
  const id = useId()
  const returnTo = useRef(null)
  const ref = useRef(null)
  const cap = useRef(null)

  useEffect(() => {
    const onKey = e => {
      if (e.key !== 'Escape' || e.defaultPrevented || composing(e) || dialogOpen()) return
      e.preventDefault()
      // An Esc from a field that holds text leaves the field and is
      // spent there: Esc typed in Browse's search closed the dock and
      // threw away the cards ticked under it (plan 123). The next Esc
      // closes the dock.
      const field = e.target
      if (/^(INPUT|TEXTAREA)$/.test(field?.tagName ?? '') && field.value) { field.blur(); return }
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    returnTo.current = document.activeElement
    const into = (initialFocus && ref.current?.querySelector(initialFocus)) || cap.current
    into?.focus({ preventScroll: true })
    return () => {
      const active = document.activeElement
      if (returnTo.current?.isConnected && (!active || active === document.body)) returnTo.current.focus?.()
    }
    // The dock's arrival, once: a selector that changes later is not a
    // second arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const close = `${t.close} (${t.keyEscape})`
  return (
    <section ref={ref} className={`desk-dock${className ? ` ${className}` : ''}`} aria-labelledby={id}>
      <div className="desk-dock__head">
        <h2 ref={cap} id={id} className="desk-deck__cap" tabIndex={-1}>{title}</h2>
        <button type="button" onClick={onClose} className="dict-plate__btn" title={close} aria-label={t.close} aria-keyshortcuts="Escape"><CloseIcon /></button>
      </div>
      {children}
    </section>
  )
}
