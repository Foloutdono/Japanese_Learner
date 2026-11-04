import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { seedSummary } from '../stores/profileSummary'
import { seedTodaySummary } from '../stores/today'
import GateCard from '../components/station/GateCard'
import { InkFilters } from '../components/dayclear/kit'
import { RatingSheet } from '../components/feedback/RatingSheet'
import { SUMMARY, TODAY_PARTIAL } from '../components/dayclear/fixtures'

// ── /dev/rating — the rating sheet's options on Android (plan 307) ──
// The early-access sheet (plan 269) drawn over Today's gate as the app
// renders it, for the owner's pick of how it sends an Android learner to
// Google Play. No backend: the sheet's answers go nowhere that matters
// (the dev branch has no session), and "Rejouer" opens it again.
//
//   ?v=web   the sheet as it is (the web, iOS)
//   ?v=A     the store first, the form behind a link
//   ?v=B     the form, then the stamp offers the store
//   &bare=1  no option bar (for the screenshots)
const OPTIONS = ['web', 'A', 'B']

export default function RatingPreview() {
  const [params] = useSearchParams()
  const v = OPTIONS.includes(params.get('v')) ? params.get('v') : 'A'
  const bare = params.get('bare') === '1'
  const [take, setTake] = useState(0)
  const [open, setOpen] = useState(true)

  useEffect(() => {
    seedSummary(SUMMARY)
    seedTodaySummary(TODAY_PARTIAL)
  }, [take])

  return (
    <>
      {!bare && (
        <nav className="clrdev-bar" aria-label="Options">
          {OPTIONS.map(o => (
            <Link key={o} className="clrdev-bar__item" to={`/dev/rating?v=${o}`} aria-current={o === v ? 'page' : undefined} onClick={() => { setOpen(true); setTake(n => n + 1) }}>{o}</Link>
          ))}
          <button type="button" className="clrdev-bar__item" onClick={() => { setOpen(true); setTake(n => n + 1) }}>Rejouer</button>
        </nav>
      )}
      <main id="main-content" className="today">
        <InkFilters />
        <GateCard today={TODAY_PARTIAL} />
      </main>
      {open && (
        <RatingSheet key={`${v}:${take}`} session={null} store={v === 'web' ? null : v} onClose={() => setOpen(false)} />
      )}
    </>
  )
}
