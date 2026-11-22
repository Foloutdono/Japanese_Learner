import { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { seedSummary } from '../stores/profileSummary'
import { seedTodaySummary } from '../stores/today'
import { seedCredits } from '../stores/credits'
import { seedMissions, seedMissionsBook, askMissionsOpen } from '../stores/missions'
import GateCard from '../components/station/GateCard'
import ProfileScreen from './ProfileScreen'
import { InkFilters } from '../components/dayclear/kit'
import { MissionsNewsSheet } from '../components/missions/MissionsNewsSheet'
import { SUMMARY, TODAY_PARTIAL } from '../components/dayclear/fixtures'
import { bookFixture, missionsFixture } from '../components/missions/fixtures'

// ── /dev/missions — the missions, in the screens they live in (plan 328) ──
// Development only, no backend, no session: the real gate and the real
// profile under the real shell, fed by fixtures in the server's shape
// (components/missions/fixtures.js).
//
//   ?screen=today (default) | sheet (the pill's sheet open) | news | profile
//   &step=0|1|2    the day's last mission: not done, done (its stub waits), collected
//   &plan=max      as a learner on the pass reads it (XP, not credits)
//   &bare=1        no bar (for the screenshots)
// "Rejouer" plays the end of the reviews: the answer lands, then the stub.
const SCREENS = ['today', 'sheet', 'news', 'profile']
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
  const screen = SCREENS.includes(params.get('screen')) ? params.get('screen') : 'today'
  const plan = params.get('plan') === 'max' ? 'max' : 'free'
  const step = Math.min(2, Math.max(0, Number(params.get('step')) || 0))
  const bare = params.get('bare') === '1'
  const [played, setPlayed] = useState(null)
  const live = played ?? step
  const [news, setNews] = useState(screen === 'news')

  // The workbench has no session, so the app's own sign-out (stores/account)
  // empties every store a moment after mount: plant again behind it.
  useEffect(() => {
    const plant = () => {
      seedSummary({ ...SUMMARY, guided: { today: true, profile: true, learn: true, practice: true, dictionary: true } })
      seedTodaySummary(TODAY_PARTIAL)
      seedMissionsBook(bookFixture({ plan }))
      seedCredits(credits(plan, BALANCE + (live === 2 ? 8 : 0)))
      seedMissions(missionsFixture({ plan, step: live }))
    }
    plant()
    const again = setTimeout(plant, 900)
    return () => clearTimeout(again)
  }, [plan, live])

  useEffect(() => { if (screen === 'sheet') askMissionsOpen() }, [screen])

  const replay = () => {
    setPlayed(0)
    setTimeout(() => setPlayed(1), 700)
    setTimeout(() => setPlayed(2), 2400)
  }

  const to = (o = {}) => {
    const q = new URLSearchParams({ screen, ...(plan === 'max' ? { plan } : {}), ...(step ? { step } : {}), ...o })
    return `/dev/missions?${q}`
  }

  return (
    <>
      {!bare && (
        <nav className="clrdev-bar" aria-label="Missions">
          {SCREENS.map(o => <Link key={o} className="clrdev-bar__item" to={to({ screen: o })} aria-current={o === screen ? 'page' : undefined}>{o}</Link>)}
          <Link className="clrdev-bar__item" to={to({ plan: plan === 'max' ? 'free' : 'max' })}>{plan === 'max' ? 'Free' : 'Max'}</Link>
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
      {news && <MissionsNewsSheet session={null} onClose={() => setNews(false)} />}
    </>
  )
}
