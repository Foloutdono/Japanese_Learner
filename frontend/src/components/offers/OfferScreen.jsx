import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useLang } from '../../LangContext'
import { useDialog } from '../../hooks/useDialog'
import { isDesk, useDesk } from '../../hooks/useDesk'
import { useProfileSummary } from '../../stores/profileSummary'
import { usePaywall, takePaywall, closePaywall, useCredits, useOfferWeek, refreshOfferWeek } from '../../stores/credits'
import { SCREENS } from '../../domain/paywall'
import { xpShare } from './format'
import { DiscoverOffer } from './DiscoverOffer'
import { WeekOffer } from './WeekOffer'
import { MaxOffer } from './MaxOffer'

// ── 定期券 — the three offers (plan 171) ───────────────────────────
// The screen every door opens (domain/paywall.js's SOURCES), and which
// of the three it is is the door's (offerScreen): DISCOVER, the 7-day
// trial; WEEK, the free learner's own week against the refill; MAX,
// the step up for a Pro learner. Built from the owner's canvas "Tsuji
// — the three offers", drawn to it board for board.
//
// On a phone it takes the glass, its stage and words scrolling over a
// docked foot. On the desk it is a dialog in the window's middle, the
// owner's pick A of the canvas's Desktop page: the stage beside the
// words, the phone's drawing scaled whole into the left pane, the words
// and the foot at the phone's width in the right (the 机 section). It
// is one of the few dialogs the desk keeps (docs/design/desk/README.md,
// "Dialogs on the desk"), so it prints its keys: Enter on the gate,
// which takes the focus as it opens, and Esc at its corner. It portals to
// the body and stands at the sheets' layer: it opens from inside the
// balance and the run-out sheets, and one Escape must close it alone
// (useDialog's `capture`, Sheet's `over`).
export function OfferScreen() {
  const paywall = usePaywall()
  if (!paywall) return null
  return createPortal(<Offer paywall={paywall} />, document.body)
}

function Offer({ paywall }) {
  const { t } = useLang()
  const desk = useDesk()
  // Read once, at mount: on the desk Enter takes the offer.
  const ref = useDialog(closePaywall, { capture: true, focus: isDesk() ? '.ofr__gate' : 'first' })
  const profile = useProfileSummary()
  const credits = useCredits()
  const week = useOfferWeek()
  const { screen } = paywall

  // The week is read fresh on every open: the stop that opened it was
  // just written.
  useEffect(() => {
    if (screen === SCREENS.WEEK) refreshOfferWeek()
  }, [screen])

  // The gate gives way to the thanks: hand the focus to the way out,
  // which now says Close, rather than dropping it on the page behind.
  const take = () => {
    takePaywall()
    requestAnimationFrame(() => ref.current?.querySelector('.ofr__quiet')?.focus())
  }

  const pass = {
    name: profile?.username ?? '',
    level: profile?.level ?? 1,
    xp: xpShare(profile),
  }
  const shared = { onTake: take, taken: paywall.taken }
  let body
  if (screen === SCREENS.WEEK) {
    body = <WeekOffer week={week} waiting={paywall.waiting} credits={credits} {...shared} />
  } else if (screen === SCREENS.MAX) {
    body = <MaxOffer limit={paywall.limit} pass={pass} credits={credits} profile={profile} {...shared} />
  } else {
    body = <DiscoverOffer profile={profile} pass={pass} {...shared} />
  }

  return (
    <div className="ofr-scrim" onClick={closePaywall}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={t.ofrLabel}
        className={`ofr ofr--${screen}`}
        data-screen={screen}
        data-limit={paywall.limit ?? undefined}
        onClick={e => e.stopPropagation()}
      >
        {desk && <kbd className="desk-kbd ofr__esc" aria-hidden="true">{t.keyEscape}</kbd>}
        {body}
      </div>
    </div>
  )
}
