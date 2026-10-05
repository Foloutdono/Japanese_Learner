import { useEffect, useId, useRef, useState } from 'react'
import { useLang } from '../../LangContext'
import { useRunKeys } from '../../stores/runKeys'

// ── 机 — Help in a run's head (owner's pick C) ──────────────────────
// The keys of a run on the desk's panels, behind a "?" beside the pass
// in the head rather than printed in the left panel. The list stays in
// the page, hidden until asked for, so a screen reader and the tests
// read it either way. A press outside closes it. Renders nothing until a
// panel has registered its keys (stores/runKeys).
export function RunHelp() {
  const { t } = useLang()
  const keys = useRunKeys()
  const [open, setOpen] = useState(false)
  const id = useId()
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const away = e => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])

  if (keys.length === 0) return null
  return (
    <div className="run-help" ref={ref} data-guide="run.keys">
      <button
        type="button"
        className="run-help__btn"
        aria-label={t.deskKeysHelp}
        title={t.deskKeysHelp}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(o => !o)}
      >
        ?
      </button>
      <div id={id} className="run-help__pop desk-keys" role="list" aria-label={t.deskKeysTitle} hidden={!open}>
        {keys.map(([cap, what]) => (
          <span key={String(cap)} role="listitem" className="desk-keys__item">
            {[].concat(cap).map(c => <kbd key={c} className="desk-kbd">{c}</kbd>)}{what}
          </span>
        ))}
      </div>
    </div>
  )
}
