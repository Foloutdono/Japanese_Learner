import { useLang } from '../../LangContext'
import { openPaywall } from '../../stores/credits'
import { useOfferable } from '../../hooks/useOfferable'

// ── The door to the offer ──────────────────────────────────────
// One control, five places (domain/paywall.js's SOURCES). It exists so
// the "may this even be shown?" question is answered once: a learner
// already holding a pass must never be sold one, and five call sites
// each remembering that is five chances to forget. Rendering nothing
// is the correct empty state — the surrounding layouts are lists and
// sheets that close up around it.
//
// The settings list does not use this: its rows are a fixed idiom
// (stg-row, with a chevron and a value), so it calls useOfferable()
// (hooks/useOfferable.js) and draws its own. Same guard, same source,
// different furniture.

export function OfferButton({ source, className = 'btn-secondary', children = null }) {
  const { t } = useLang()
  const may = useOfferable()
  if (!may) return null
  return (
    <button
      type="button"
      className={`${className} pw-open`}
      onClick={() => openPaywall(source)}
      data-action="paywall-open"
      data-source={source}
    >
      {children ?? t.paywallOpen}
    </button>
  )
}
