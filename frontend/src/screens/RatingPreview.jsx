import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { seedSummary } from '../stores/profileSummary'
import { seedTodaySummary } from '../stores/today'
import GateCard from '../components/station/GateCard'
import { InkFilters } from '../components/dayclear/kit'
import { RatingSheet } from '../components/feedback/RatingSheet'
import { SUMMARY, TODAY_PARTIAL } from '../components/dayclear/fixtures'

// ── /dev/rating — the early-access sheet, both of it (plan 307) ────
// The sheet (plan 269) over Today's gate as the app renders it: the
// web's and iOS's stars and words, and the Android shell's question for
// Google Play (the owner's pick A of the canvas "Note sur Google Play").
// No backend: the sheet's answers go nowhere that matters (the dev branch
// has no session), and "Rejouer" opens it again.
//
//   ?v=android  the store first, the form behind a link (default)
//   ?v=web      the stars and the words
//   &bare=1     no bar (for the screenshots)
const OPTIONS = ['android', 'web']

export default function RatingPreview() {
  const [params] = useSearchParams()
  const v = OPTIONS.includes(params.get('v')) ? params.get('v') : 'android'
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
        <nav className="clrdev-bar" aria-label="Sheets">
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
        <RatingSheet key={`${v}:${take}`} session={null} store={v === 'android'} onClose={() => setOpen(false)} />
      )}
    </>
  )
}
