import { useLang } from '../../LangContext'
import { Sheet } from '../chrome/Sheet'
import { usePaywall, takePaywall, closePaywall, useCredits } from '../../stores/credits'
import { DAILY_REFILL } from '../../domain/credits'
import { BENEFITS } from '../../domain/paywall'

// ── 定期券 — the offer ─────────────────────────────────────────
// The pass, shown from five doors (domain/paywall.js's SOURCES) and
// bought from none of them yet. `sumi` because the sheet IS the pass
// turned over: an object about the learner wears the pass's own
// charcoal and gold, never a line colour (DESIGN.md, "Three families,
// and they never mix").
//
// No price. Not an omission — the figure does not exist yet, and a
// placeholder one shown to a real learner is a promise made by
// accident. What the pass CHANGES is knowable today, so that is what
// this shows: the three limits, free beside pass, drawn from the same
// constants the server enforces.
//
// The foot is an interest tap, not a purchase. See domain/paywall.js
// for why that is the honest form of this screen while HAS_STORE is
// false, and what changes when it is not.

// The free side of the reviews row is the daily refill rather than a
// ceiling — a free learner is not capped at a number of reviews, they
// are given some back every day. The store's own figure when it has
// answered, the constant until then, so the row is never blank.
function reviewsFree(credits, t) {
  return t.paywallPerDay(credits?.dailyRefill ?? DAILY_REFILL)
}

function Row({ id, free, pass, t }) {
  return (
    <li className="pw-row">
      <span className="pw-row__name">{t[`paywallBenefit_${id}`]}</span>
      <span className="pw-row__free">{free}</span>
      <span className="pw-row__arrow" aria-hidden="true">→</span>
      <span className="pw-row__pass">{pass}</span>
    </li>
  )
}

export function PaywallSheet() {
  const { t, lang } = useLang()
  const paywall = usePaywall()
  const credits = useCredits()
  if (!paywall) return null

  const n = v => v.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')
  const taken = paywall.taken

  return (
    <Sheet open sumi onClose={closePaywall} jp={t.paywallTitle} cap={t.passLabel} label={t.paywallTitle}>
      <p className="pw__lede">{t.paywallLede}</p>

      <ul className="pw-list">
        {BENEFITS.map(b => (
          <Row
            key={b.id}
            id={b.id}
            t={t}
            free={b.id === 'reviews' ? reviewsFree(credits, t) : n(b.free)}
            pass={b.id === 'reviews' ? '∞' : n(b.pass)}
          />
        ))}
      </ul>

      {taken ? (
        // aria-live so the answer is announced where the button was,
        // rather than the button simply vanishing under the pointer.
        <p className="pw__thanks" role="status">{t.paywallThanks}</p>
      ) : (
        <button type="button" className="btn-depart pw__cta" onClick={takePaywall} data-action="paywall-intent">
          <span className="btn-depart__jp">{t.paywallCta}</span>
        </button>
      )}

      <p className="pw__soon">{t.paywallSoon}</p>

      <button type="button" className="btn-secondary" onClick={closePaywall}>
        {taken ? t.close : t.paywallNotNow}
      </button>
    </Sheet>
  )
}
