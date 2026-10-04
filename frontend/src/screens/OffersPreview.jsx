import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { openPaywall, closePaywall, seedCredits, seedOfferWeek, useCredits, useOfferWeek, usePaywall } from '../stores/credits'
import { seedSummary, useProfileSummary } from '../stores/profileSummary'
import { SOURCES } from '../domain/paywall'

// ── /dev/offers — the three offers, each of the seven screens (plan 172) ──
// The workbench for the canvas "Tsuji — the three offers": the REAL
// OfferScreen (App.jsx mounts it beside this route), opened through
// the real doors, over the learner the canvas drew -- Aiko, level 12,
// two thirds of the way up it, here for a trip; a free balance at zero
// with its next credit at 14:32; and the canvas's week, three stops
// and 34 cards. Two of the doors (a Pro learner's ceilings and
// Settings' "Passer à Max") have no production caller until the store
// sells Max, so this is where they are reviewed. `?open=` opens one
// directly (the clips are recorded that way). Registered in App.jsx's
// dev branch, outside the auth gate, and dropped from production the
// same way as /dev/rewards.
const SCREENS = [
  { id: 'discover', name: '1 · Discover — the 7-day trial', open: () => openPaywall(SOURCES.SETTINGS) },
  { id: 'week', name: '2 · Out of credits — the week', open: () => openPaywall(SOURCES.RUNOUT) },
  { id: 'practice', name: '3A · Practice stops costing credits', open: () => openPaywall(SOURCES.LIMIT, { limit: 'practice' }) },
  { id: 'photos', name: '3B · 10 photos a day', open: () => openPaywall(SOURCES.LIMIT, { limit: 'photos' }) },
  { id: 'explains', name: '3B · 15 explanations a day', open: () => openPaywall(SOURCES.LIMIT, { limit: 'explains' }) },
  { id: 'papers', name: '3B · 4 new mock exams a month', open: () => openPaywall(SOURCES.LIMIT, { limit: 'papers' }) },
  { id: 'upgrade', name: '3C · Settings — Pro turns into Max', open: () => openPaywall(SOURCES.UPGRADE) },
]

// The canvas's week, Monday to Sunday: reviews done, and the reviews
// that waited on the three days the balance stopped a run.
const WEEK = [
  ['2026-09-21', 22, 0],
  ['2026-09-22', 30, 8],
  ['2026-09-23', 30, 0],
  ['2026-09-24', 30, 15],
  ['2026-09-25', 18, 0],
  ['2026-09-26', 30, 11],
  ['2026-09-27', 28, 0],
]

function seed() {
  seedSummary({ username: 'Aiko', level: 12, xp: 640, xpPrevLevel: 0, xpForNext: 1000, motive: 'trip', jlptLevel: 'N4' })
  const next = new Date()
  next.setHours(14, 32, 0, 0)
  seedCredits({
    balance: 0, pending: 0, cap: 30, dailyRefill: 30, refillEvery: 48,
    nextCreditAt: next.toISOString(), fullAt: null, plan: 'free', unlimited: false, enforced: true,
  })
  seedOfferWeek({
    days: WEEK.map(([date, reviewed, waited]) => ({ date, reviewed, waited })),
    cap: 30,
    stops: 3,
    waited: 34,
  })
}

export default function OffersPreview() {
  const [params] = useSearchParams()
  const direct = params.get('open')
  // The seeds are planted again whenever one goes missing: App's auth
  // listener reads "no session" on load and forgets the account's
  // stores (stores/account.js) -- often inside the same batch as the
  // first seed, so this checks after every render rather than on a
  // change it might never see.
  const credits = useCredits()
  const week = useOfferWeek()
  const profile = useProfileSummary()
  const opened = useRef(false)
  useEffect(() => {
    if (!credits || !week || !profile) {
      seed()
      return
    }
    if (opened.current) return
    opened.current = true
    SCREENS.find(s => s.id === direct)?.open()
  })
  useEffect(() => () => closePaywall(), [])
  // The list steps out while an offer is open: on the desk the dialog
  // stands over an empty page, not over the workbench's buttons.
  const open = usePaywall()
  if (open) return <div className="onb-preview-done" />
  return (
    <div className="onb-preview-done">
      <span lang="ja">定期券</span>
      <p>The three offers, as the canvas drew them.</p>
      {SCREENS.map(s => (
        <button key={s.id} type="button" className="btn-secondary" data-open={s.id} onClick={() => { seed(); s.open() }}>
          {s.name}
        </button>
      ))}
    </div>
  )
}
