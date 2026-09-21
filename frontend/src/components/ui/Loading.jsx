import { useLang } from '../../LangContext'

// ── 待合 — the wait ───────────────────────────────────────────
// The canvas's states sheet (plan 067): loading is three gold dots,
// never a spinner. One object for every wait in the app — a card
// batch, the stats, a deck, the boot screen — so "loading" always
// looks the same, and the sheet's rest state (.35 / .7 / 1) is what a
// reduced-motion device sees. The ensō ring this replaces drew a
// second visual language for the same moment.
//
// `copy` is for the long waits that owe the learner a sentence
// ("Writing your exam…"); it prints under the dots. `inline` is for a
// slot — the console's count, a notice line — where the dots stand in
// for a figure and the copy, if any, sits beside them; there it is a
// span with no role, decoration beside a line that already speaks.
// `tight` is a wait inside a card, at the card's rhythm.

// The three dots on their own, for a wait that happens INSIDE a
// control that already speaks -- the breakdown's Explain button, which
// says "Explaining…" and only needs the app's own mark of a wait
// beside it (plan 096). It takes no context, deliberately: a button in
// a component rendered bare in a test has no provider over it, and the
// dots have nothing to translate.
export function Dots({ className = '' }) {
  return (
    <span className={`loading loading--inline ${className}`.trim()} aria-hidden="true">
      <i className="loading__dot" /><i className="loading__dot" /><i className="loading__dot" />
    </span>
  )
}

export function Loading({ copy, inline = false, tight = false, className = '' }) {
  const { t } = useLang()
  const classes = ['loading', inline ? 'loading--inline' : '', tight ? 'loading--tight' : '', className]
    .filter(Boolean).join(' ')
  const dots = <><i className="loading__dot" /><i className="loading__dot" /><i className="loading__dot" /></>
  if (inline) {
    return (
      <span className={classes}>
        {dots}
        {copy && <span className="loading__copy">{copy}</span>}
      </span>
    )
  }
  return (
    <div className={classes} role="status" aria-label={copy ? undefined : t.loading}>
      {dots}
      {copy && <span className="loading__copy">{copy}</span>}
    </div>
  )
}
