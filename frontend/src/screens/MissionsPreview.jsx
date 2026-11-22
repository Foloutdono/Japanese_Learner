import { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { seedSummary } from '../stores/profileSummary'
import { seedTodaySummary } from '../stores/today'
import { seedCredits } from '../stores/credits'
import { seedMissions } from '../stores/missions'
import GateCard from '../components/station/GateCard'
import ProfileScreen from './ProfileScreen'
import { InkFilters } from '../components/dayclear/kit'
import { SUMMARY, TODAY_PARTIAL } from '../components/dayclear/fixtures'
import { missionsFixture } from '../components/missions/fixtures'

// ── /dev/missions — the missions, in the screens they will live in (plan 328) ──
// Development only, no backend, no session. The real gate and the real
// profile under the real shell, with one of three ways of standing in them
// (components/missions), fed by fixtures: the owner picks, then the pick
// is built as drawn and the others go.
//
//   ?v=A   les coupons   -- a door on the gate opens the sheet; stubs to tear
//   ?v=B   le tableau    -- departures hung on the gate, paid on the last answer
//   ?v=C   le carnet     -- a chip on the gate, the stamps in the holder
//   &screen=today (default) | sheet (A's sheet open) | profile
//   &step=0|1|2    the last mission: not yet, done, paid (the reward)
//   &plan=max      as a Max learner reads it
//   &bare=1        no bar (for the screenshots)
// "Rejouer" plays the reward again: the last answer, then the payment.
const VARIANTS = ['A', 'B', 'C']
const SCREENS = ['today', 'sheet', 'profile']
const BALANCE = 64

function credits(plan, balance) {
  return {
    balance: plan === 'max' ? null : balance, pending: 0, cap: 50, dailyRefill: 30, refillEvery: 2880,
    nextCreditAt: null, fullAt: null, signupBonus: 200,
    plan: plan === 'max' ? 'pass' : 'free', unlimited: plan === 'max', enforced: false, freeSources: ['kana'],
  }
}

export default function MissionsPreview() {
  // A new address is a new take: nothing of the last one's replay is kept.
  const { search } = useLocation()
  return <Workbench key={search} />
}

function Workbench() {
  const [params] = useSearchParams()
  const v = VARIANTS.includes(params.get('v')) ? params.get('v') : 'A'
  const screen = SCREENS.includes(params.get('screen')) ? params.get('screen') : 'today'
  const plan = params.get('plan') === 'max' ? 'max' : 'free'
  const step = Math.min(2, Math.max(0, Number(params.get('step')) || 0))
  const bare = params.get('bare') === '1'
  const [played, setPlayed] = useState(null)
  const live = played ?? step

  useEffect(() => {
    seedSummary({ ...SUMMARY, guided: { today: true, profile: true, learn: true, practice: true, dictionary: true } })
    seedTodaySummary(TODAY_PARTIAL)
  }, [])

  useEffect(() => {
    seedCredits(credits(plan, BALANCE + (live === 2 ? 8 : 0)))
    seedMissions({ ...missionsFixture({ variant: v, plan, step: live }), open: screen === 'sheet' })
  }, [v, plan, live, screen])

  // "Rejouer": the last answer lands, then the reward is paid.
  const replay = () => {
    setPlayed(0)
    setTimeout(() => setPlayed(1), 700)
    setTimeout(() => setPlayed(2), 1900)
  }

  const to = (o = {}) => {
    const q = new URLSearchParams({ v, screen, ...(plan === 'max' ? { plan } : {}), ...(step ? { step } : {}), ...o })
    return `/dev/missions?${q}`
  }

  return (
    <>
      {!bare && (
        <nav className="clrdev-bar" aria-label="Options">
          {VARIANTS.map(o => <Link key={o} className="clrdev-bar__item" to={to({ v: o })} aria-current={o === v ? 'page' : undefined}>{o}</Link>)}
          {SCREENS.map(o => <Link key={o} className="clrdev-bar__item" to={to({ screen: o })} aria-current={o === screen ? 'page' : undefined}>{o}</Link>)}
          <Link className="clrdev-bar__item" to={to(plan === 'max' ? { plan: 'free' } : { plan: 'max' })}>{plan === 'max' ? 'Free' : 'Max'}</Link>
          <button type="button" className="clrdev-bar__item" onClick={replay}>Rejouer</button>
        </nav>
      )}
      {screen === 'profile' ? (
        <ProfileScreen session={null} />
      ) : (
        <main id="main-content" className="today">
          <InkFilters />
          <GateCard today={TODAY_PARTIAL} />
        </main>
      )}
    </>
  )
}
