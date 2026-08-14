// ── The contactless mark ──────────────────────────────────
// Three arcs thickening outward — what every IC card in Japan is
// printed with, and the one mark in this app that means "this is
// yours" rather than "this is a place".
//
// It appears in three sizes now (the pass on the profile, the stub in
// the drawer, the top bar on an identity route), so it is one
// component taking a class rather than the same three <span/>s copied
// into each. The arcs themselves are drawn in CSS — see .pass__wave.
export function PassWave({ className = 'pass__wave' }) {
  return (
    <span className={className} aria-hidden="true">
      <span /><span /><span />
    </span>
  )
}
