import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useLang } from '../../LangContext'
import { useDialog } from '../../hooks/useDialog'
import { useDesk } from '../../hooks/useDesk'
import { useRadioWalk, radioTab } from '../../hooks/useRadioWalk'
import { usePaywall, takePaywall, closePaywall, showAllOffers } from '../../stores/credits'
import {
  PLAN_IDS, BILLINGS, LEAD, PROMOTED, PERKS, PLANS, FREE,
  price, perMonth, monthsOfYear, yearlySaving, formatPrice, formatPercent,
} from '../../domain/paywall'
import { CheckIcon } from '../ui/Icons'

// ── 定期券 — the offer ─────────────────────────────────────────
// A screen of its own, opened from five doors (domain/paywall.js's
// SOURCES) over whatever was on the glass -- the canvas's BoardOffer,
// drawn for the boarding and never built until now. On a phone it
// takes the whole screen, its answer docked at the foot like the
// boarding's; on the desk it is a dialog in the window's middle, one of
// the few the desk keeps (docs/design/desk/README.md, "Dialogs on the
// desk").
//
// The strategy is the owner's (docs/business/tsuji-costs.xlsx): sell
// Pro yearly. So the offer opens on Pro alone, yearly first and picked,
// its head the month it comes to ("5 €") and its row the saving over
// twelve monthly payments, struck through beside it. Monthly is under
// it, the anchor. Max waits behind "See all offers", laid out under Pro
// when asked for, never picked for the learner.
//
// The head reads the pick, so the anchor does its work in the moment:
// picking monthly turns the 5 € into 8,99 €.
//
// The foot is still an interest tap while there is no store
// (domain/paywall.js, HAS_PAYWALL beside HAS_STORE): "Notify me", on
// the pick, which the funnel records (stores/credits.js) -- the plan
// and the billing the learner would have bought, the figure the
// pricing sheet's annual share is waiting on.

export function PaywallScreen() {
  const paywall = usePaywall()
  if (!paywall) return null
  return createPortal(<Offer paywall={paywall} />, document.body)
}

function Offer({ paywall }) {
  const { t, lang } = useLang()
  const desk = useDesk()
  const [pick, setPick] = useState(PROMOTED)
  // `capture`: the offer opens from inside the balance and the run-out
  // sheets, and one Escape must close it alone (Sheet's `over`).
  const ref = useDialog(closePaywall, { capture: true })
  const money = v => formatPrice(v, lang)
  const plans = paywall.all ? PLAN_IDS : LEAD

  // Both presses below take away the button that had the focus, so
  // each hands it on rather than dropping it on the page behind.
  const focus = sel => requestAnimationFrame(() => ref.current?.querySelector(sel)?.focus())
  const seeAll = () => {
    showAllOffers()
    // To the first plan it laid out, which also scrolls that plan in.
    focus(`[data-plan="${PLAN_IDS.find(id => !LEAD.includes(id))}"] [role="radio"]`)
  }
  const take = () => {
    takePaywall(pick)
    // To the way out, which now says Close.
    focus('.pw__later')
  }

  return (
    <div className="pw-scrim" onClick={closePaywall}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={t.paywallLabel}
        className="pw"
        onClick={e => e.stopPropagation()}
      >
        <div className="pw__body">
          <div className="pw-head">
            <span className="pw-head__cap">{t[`paywallName_${pick.plan}`]}</span>
            <span className="pw-head__fig">
              {money(perMonth(pick.plan, pick.billing))}
              <span className="pw-head__unit">{t.paywallUnit_monthly}</span>
            </span>
            <span className="pw-head__sub">
              {pick.billing === 'yearly' ? t.paywallBilledYearly(money(price(pick.plan, 'yearly'))) : t.paywallBilledMonthly}
            </span>
          </div>

          {plans.map(id => (
            <Plan key={id} id={id} pick={pick} onPick={setPick} desk={desk} t={t} lang={lang} money={money} />
          ))}

          {!paywall.all && (
            <button type="button" className="btn-secondary pw__all" onClick={seeAll} data-action="paywall-all">
              {t.paywallAll}
            </button>
          )}
        </div>

        <div className="pw__foot">
          <button type="button" className="pw__later" onClick={closePaywall}>
            {paywall.taken ? t.close : t.paywallNotNow}
          </button>
          {paywall.taken ? (
            // aria-live so the answer is announced where the button was,
            // rather than the button simply vanishing under the pointer.
            <p className="pw__thanks" role="status">{t.paywallThanks}</p>
          ) : (
            <button
              type="button"
              className="btn-depart pw__cta"
              onClick={take}
              data-action="paywall-intent"
            >
              <span className="btn-depart__jp">{t.paywallCta}</span>
              <span className="btn-depart__go" aria-hidden="true">▶</span>
            </button>
          )}
          <p className="pw__soon">{t.paywallSoon}</p>
        </div>
      </div>
    </div>
  )
}

// One plan: what it holds, then its two billings to pick from. The
// radio group is the plan's; the pick is the offer's, so a group can
// hold none of it (Max, until it is picked) -- its first radio is then
// its tab stop (useRadioWalk's radioTab).
function Plan({ id, pick, onPick, desk, t, lang, money }) {
  const walk = useRadioWalk(desk)
  const checkedAt = pick.plan === id ? BILLINGS.indexOf(pick.billing) : -1
  return (
    <section className="pw-block" data-plan={id}>
      <div className="pw-perks">
        <div className="pw-perks__pass" aria-hidden="true">
          <span className="pw-perks__inf">∞</span>
          <span className="pw-perks__cap">{t[`paywallTile_${id}`]}</span>
        </div>
        <ul className="pw-perks__list" aria-label={t[`paywallName_${id}`]}>
          {PERKS[id].map(perk => {
            const { name, sub } = perkText(perk, id, t, lang)
            return (
              <li key={perk} className="pw-perk">
                <CheckIcon className="pw-perk__tick" />
                <span>{name}{sub && <small> · {sub}</small>}</span>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="pw-plans" role="radiogroup" aria-label={t[`paywallName_${id}`]} onKeyDown={walk}>
        {BILLINGS.map((billing, i) => {
          const on = i === checkedAt
          const yearly = billing === 'yearly'
          return (
            <button
              key={billing}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={radioTab(desk, i, checkedAt)}
              className={`pw-plan${on ? ' pw-plan--on' : ''}`}
              onClick={() => onPick({ plan: id, billing })}
              data-billing={billing}
            >
              <span className="pw-plan__names">
                <span className="pw-plan__label">
                  {t[`paywallBilling_${billing}`]}
                  {yearly && <span className="pw-tag">{t.paywallSave(formatPercent(yearlySaving(id), lang))}</span>}
                </span>
                <span className="pw-plan__price">
                  {yearly && (
                    <>
                      <s className="pw-plan__was" aria-hidden="true">{money(monthsOfYear(id))}</s>
                      <span className="sr-only">{t.paywallWas(money(monthsOfYear(id)))}</span>
                    </>
                  )}
                  <b>{money(price(id, billing))}</b> {t[`paywallUnit_${billing}`]}
                </span>
              </span>
              <span className="pw-plan__check" aria-hidden="true"><CheckIcon /></span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

// A perk's line and its quieter second half. The figures are the
// plan's own (domain/paywall.js's PLANS) and, beside Pro's decks, what
// a free learner holds today (FREE).
function perkText(perk, plan, t, lang) {
  const n = v => v.toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US')
  const p = PLANS[plan]
  switch (perk) {
    case 'decks':
      return {
        name: t.paywallPerk_decks(n(p.decks), n(p.cards)),
        sub: plan === 'pro' ? t.paywallPerkSub_decks(n(FREE.decks), n(FREE.cards)) : null,
      }
    case 'allowance':
      return { name: t.paywallPerk_allowance, sub: t.paywallPerkSub_allowance(n(p.photos), n(p.explains)) }
    default:
      return { name: t[`paywallPerk_${perk}`], sub: t[`paywallPerkSub_${perk}`] ?? null }
  }
}
