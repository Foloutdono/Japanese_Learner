import { useState } from 'react'
import { Loading } from '../ui/Loading'

// How long after Board the paper's dots are drawn (the 机 section of
// index.css, .desk-wait).
const PAPER_WAIT_MS = 480

/** 机 (plans 155, 161): the wait on first contact's paper -- the boot
    screen's dots, alone, centred on the paper, drawn
    PAPER_WAIT_MS after `since` (a performance.now() reading; the moment
    this mounts when there is none). A negative delay is a fade already
    under way, or done: the dots the Welcome started are carried on
    by the wait after it (screens/AppLoading's `frame`) rather than
    drawn again. A module of its own so the Welcome takes the dots and
    nothing of the boot screen's -- the splash, the platform -- with
    them. */
export function PaperWait({ since = null, note = null }) {
  const [delay] = useState(() => (since == null ? PAPER_WAIT_MS : Math.round(PAPER_WAIT_MS - (performance.now() - since))))
  return (
    <div className="app-loading desk-wait" style={{ '--wait-in': `${delay}ms` }}>
      <Loading />
      {/* In the tree from the first frame, as on the boot screen: the
          line lands in a live region that already existed. */}
      <p className="app-loading__note" role="status" aria-live="polite">{note}</p>
    </div>
  )
}
