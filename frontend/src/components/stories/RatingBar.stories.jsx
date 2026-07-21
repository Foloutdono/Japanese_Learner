import RatingBar from '../RatingBar'

// ── RatingBar ─────────────────────────────────────────────
// `active` is the only prop that changes what's rendered — like
// XpToast returning null with no toast, RatingBar returns null
// entirely when inactive, so `Inactive` below renders a note instead
// of an empty canvas. `onRate` just logs the clicked quality (0-5) —
// or the equivalent AZERTY/QWERTY number key, see RatingBar.jsx's
// AZERTY_INDEX — so a click is visible without a real quiz screen.
//
// Assumes the same global LangContext decorator every screen's
// stories already rely on, since RatingBar calls useLang() directly
// for its six button labels. If this project doesn't wrap stories in
// a LangProvider globally, add one as a decorator here.
export default {
  title: 'Feedback/RatingBar',
  component: RatingBar,
}

const logRate = q => console.log('[RatingBar] onRate', q)

export const Active = {
  render: () => <RatingBar active onRate={logRate} />,
}

export const Inactive = {
  render: () => (
    <div>
      <p style={{ opacity: 0.6, fontFamily: 'monospace', fontSize: 13 }}>
        active=false — RatingBar renders null. Nothing below this line
        is missing, that's the actual return value.
      </p>
      <RatingBar active={false} onRate={logRate} />
    </div>
  ),
}

// Not a different prop combination — just a visible reminder of the
// keyboard path (window keydown listener, only attached while
// active) so a "why didn't pressing 3 do anything" bug report is
// quick to place: either the listener never attached (active was
// false) or the key itself didn't match AZERTY_INDEX/parseInt.
export const KeyboardShortcuts = {
  render: () => (
    <div>
      <p style={{ opacity: 0.6, fontFamily: 'monospace', fontSize: 13, maxWidth: 420 }}>
        Keys 1-6 (or &amp;é&quot;'(§ on AZERTY) map to the six buttons
        left to right while this is active — try them here.
      </p>
      <RatingBar active onRate={logRate} />
    </div>
  ),
}