import { useLang } from '../../LangContext'
import { closePaywall } from '../../stores/credits'
import { GateButton } from '../ui/GateButton'

// ── The frame every offer is drawn in (plan 171) ───────────────────
// The canvas "Tsuji — the three offers", as built: a stage on the
// pass's sumi under one cone of warm light (the owner's pick 光, the
// spotlight), its subject in the light; under it the words -- an
// eyebrow, the title, the case, the ticket; and a docked foot: the
// quiet way out over the gate (the boarding's rule, plan 168: a thumb
// finds the answer where it was), the gate itself (GateButton, plan
// 164), and the fine line under it. Gold is the ticket's and the
// gate's alone (the owner, round 10: "the offers should receive the
// attention").
//
// The stage is drawn for a 390px phone and centred in a wider one;
// the words hold the card's width. The stage and the words scroll
// together on a short screen; the foot never moves.
//
// `clock` marks a way out that waits for the refill (the week's).
//
// The gate records the interest while there is no store
// (domain/credits.js's HAS_STORE): pressed, it gives way to the thanks
// in a live region, and the way out says Close.
export function OfferFrame({ kind, hero, children, quiet, clock = false, cta, onTake, fine, taken }) {
  const { t } = useLang()
  return (
    <>
      <div className="ofr__scroll">
        <div className={`ofr__hero ofr__hero--${kind}`}>
          <div className="ofr__floor" />
          <div className="ofr__stage">{hero}</div>
        </div>
        <div className="ofr__body">{children}</div>
      </div>
      <div className="ofr__foot">
        <button type="button" className="ofr__quiet" onClick={closePaywall} data-action="paywall-later">
          {clock && !taken && (
            <svg className="ofr__clock" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <circle cx="12" cy="12" r="9" />
              <polyline points="12 7 12 12 15.5 14" />
            </svg>
          )}
          {taken ? t.close : quiet}
        </button>
        {taken ? (
          <p className="ofr__thanks" role="status">{t.paywallThanks}</p>
        ) : (
          <GateButton label={cta} onClick={onTake} className="ofr__gate" data-action="paywall-intent" />
        )}
        <p className="ofr__fine">{fine}</p>
      </div>
    </>
  )
}
