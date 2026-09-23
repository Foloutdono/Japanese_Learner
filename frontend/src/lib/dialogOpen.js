// ── Whether a dialog owns the keyboard ─────────────────────────────
// A run answers to window-level keys — the digits rate and pick, Space
// turns the card — and a sheet opened over it (the pass, a dictionary
// entry, the way-out question) is a dialog the learner is now reading.
// A key pressed there belongs to the dialog: without this check "1"
// rated the card behind the balance sheet and Space turned it. Every
// dialog in the app says so with aria-modal (components/chrome/Sheet,
// the lookup and lesson sheets, the guide), so that is what is asked.
export function dialogOpen() {
  return typeof document !== 'undefined' && document.querySelector('[aria-modal="true"]') !== null
}
