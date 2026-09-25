import { openStatus } from '../../stores/journey'
import { isDesk } from '../../hooks/useDesk'

// ── 運行状況 — the journey's reading, and where it opens ──────────
// Shared by the two objects that print the journey's status: the HUD's
// station panel (Hud.jsx) and the stub of the desk rail's pass
// (DeskPass.jsx, plan 127). Kept out of Hud.jsx so that file exports
// components only.

// The word on the panel, and the class that inks it. slightlyBehind
// and delayed both read "late" — the days beside the word are what
// tell the two apart, and the ink does the rest. The desk's pass
// (DeskPass, plan 127) prints the same reading on its stub.
export function statusOf(model) {
  if (!model?.status) return null
  const { status, deltaDays } = model
  const days = status === 'ahead' || status === 'slightlyBehind' || status === 'delayed'
    ? (deltaDays == null ? null : Math.abs(deltaDays))
    : null
  return { status, days: days || null }
}

// 机 (plan 123): on Today the pass's back already stands beside the
// gate (components/journey/JourneyPanel), and the rail's status chip
// opened a dialog copy of it, the scrim hiding the panel it duplicated.
// Where that panel stands, the chip walks to it instead: in view,
// focused, marked with one soft arrival. Everywhere else, and on every
// phone, it opens the sheet as it always has. The rail's pass (plan
// 127) calls the same walk from its stub.
export function showStatus() {
  const panel = isDesk() ? document.querySelector('.desk-journey') : null
  if (!panel) { openStatus(); return }
  panel.scrollIntoView({ block: 'nearest' })
  panel.focus({ preventScroll: true })
  panel.classList.remove('desk-journey--called')
  void panel.offsetWidth
  panel.classList.add('desk-journey--called')
}
