import { openStatus } from '../../stores/journey'

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

// The journey's sheet, from the HUD's panel and the rail's stub alike.
// On the desk Today's gate stood the pass's back beside it (plan 123's
// walk to it, retired by plan 199, when the dial's column took that
// place), so the sheet opens everywhere now.
export function showStatus() {
  openStatus()
}
