import { useEffect, useId, useRef } from 'react'
import { useLang } from '../../LangContext'
import { CrossIcon } from '../ui/Icons'
import { dialogOpen } from '../../lib/dialogOpen'

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
export function DeskDock({ title, onClose, className = '', children }) {
  const { t } = useLang()
  const id = useId()
  const returnTo = useRef(null)

  useEffect(() => {
    const onKey = e => {
      if (e.key !== 'Escape' || e.defaultPrevented || dialogOpen()) return
      e.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    returnTo.current = document.activeElement
    return () => {
      const active = document.activeElement
      if (returnTo.current?.isConnected && (!active || active === document.body)) returnTo.current.focus?.()
    }
  }, [])

  return (
    <section className={`desk-dock${className ? ` ${className}` : ''}`} aria-labelledby={id}>
      <div className="desk-dock__head">
        <h2 id={id} className="desk-deck__cap">{title}</h2>
        <button type="button" onClick={onClose} className="import-header__close" aria-label={t.close}><CrossIcon size={16} /></button>
      </div>
      {children}
    </section>
  )
}
