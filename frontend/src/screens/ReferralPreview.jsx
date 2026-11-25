import { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { seedSummary } from '../stores/profileSummary'
import { seedTodaySummary } from '../stores/today'
import { seedCredits } from '../stores/credits'
import { seedReferral } from '../stores/referral'
import { seedMissions, seedMissionsBook } from '../stores/missions'
import { REFERRAL_KEY } from '../lib/arrival'
import GateCard from '../components/station/GateCard'
import ProfileScreen from './ProfileScreen'
import { InkFilters } from '../components/dayclear/kit'
import { ChooseSheet, ReferralSheet, WelcomeSheet } from '../components/referral/Referral'
import { SUMMARY, TODAY_PARTIAL } from '../components/dayclear/fixtures'
import { SUGGESTED, referralFixture } from '../components/referral/fixtures'
import { bookFixture, missionsFixture } from '../components/missions/fixtures'

// ── /dev/referral — the referral, in the screens it lives in (plan 332) ──
// Development only, no backend, no session: the real gate and the real
// profile under the real shell, fed by fixtures in GET /api/referral's
// shape (components/referral/fixtures.js).
//
//   ?screen=today (default) | profile | sheet (the holder's sheet open) |
//           choose (naming a parrain) | welcome (the reward paid)
//   &role=new (may name a parrain, 2 days left) | filleul | parrain
//   &step=2       filleul: the reward paid; parrain: the week collected
//   &plan=max     as a learner on the pass reads it (XP, not credits)
//   &bare=1       no bar (for the screenshots)
const SCREENS = ['today', 'profile', 'sheet', 'choose', 'welcome']
const ROLES = ['new', 'filleul', 'parrain']
const BALANCE = 64

function credits(plan, balance) {
  return {
    balance: plan === 'max' ? null : balance, pending: 0, cap: 50, dailyRefill: 30, refillEvery: 2880,
    nextCreditAt: null, fullAt: null, signupBonus: 200,
    plan: plan === 'max' ? 'pass' : 'free', unlimited: plan === 'max', enforced: false, freeSources: ['kana'],
  }
}

// The duels' search, answered here: the link's name is somebody, Hana is
// somebody, nobody else is.
async function find(name) {
  if (['mei', 'hana'].includes(name.toLowerCase())) return { username: name[0].toUpperCase() + name.slice(1).toLowerCase(), relation: 'none' }
  throw Object.assign(new Error('not found'), { code: 'pvp_not_found' })
}

export default function ReferralPreview() {
  const { search } = useLocation()
  return <Workbench key={search} />
}

function Workbench() {
  const [params] = useSearchParams()
  const screen = SCREENS.includes(params.get('screen')) ? params.get('screen') : 'today'
  const role = ROLES.includes(params.get('role')) ? params.get('role') : (screen === 'welcome' ? 'filleul' : 'new')
  const plan = params.get('plan') === 'max' ? 'max' : 'free'
  const step = Math.min(2, Math.max(0, Number(params.get('step')) || (screen === 'welcome' ? 2 : 0)))
  const bare = params.get('bare') === '1'
  const [open, setOpen] = useState(true)

  // The workbench has no session, so the app's own sign-out (stores/account)
  // empties every store a moment after mount: plant again behind it.
  useEffect(() => {
    try { localStorage.setItem(REFERRAL_KEY, SUGGESTED) } catch { /* private mode */ }
    const plant = () => {
      seedSummary({ ...SUMMARY, referralNotice: true, guided: { today: true, profile: true, learn: true, practice: true, dictionary: true } })
      seedTodaySummary(TODAY_PARTIAL)
      seedCredits(credits(plan, BALANCE + (step === 2 && role === 'filleul' ? 300 : 0)))
      seedMissions(missionsFixture({ plan, step: 0 }))
      seedMissionsBook(bookFixture({ plan }))
      seedReferral(referralFixture({ role, plan, step }))
    }
    plant()
    const again = setTimeout(plant, 900)
    return () => clearTimeout(again)
  }, [role, plan, step])

  const to = (o = {}) => {
    const q = new URLSearchParams({ screen, role, ...(plan === 'max' ? { plan } : {}), ...(step ? { step } : {}), ...o })
    return `/dev/referral?${q}`
  }

  return (
    <>
      {!bare && (
        <nav className="clrdev-bar" aria-label="Referral">
          {SCREENS.map(o => <Link key={o} className="clrdev-bar__item" to={to({ screen: o })} aria-current={o === screen ? 'page' : undefined}>{o}</Link>)}
          {ROLES.map(o => <Link key={o} className="clrdev-bar__item" to={to({ role: o })} aria-current={o === role ? 'page' : undefined}>{o}</Link>)}
          <Link className="clrdev-bar__item" to={to({ step: step === 2 ? 0 : 2 })}>{step === 2 ? 'step 0' : 'step 2'}</Link>
          <Link className="clrdev-bar__item" to={to({ plan: plan === 'max' ? 'free' : 'max' })}>{plan === 'max' ? 'Free' : 'Max'}</Link>
        </nav>
      )}
      {screen === 'today' || screen === 'choose' || screen === 'welcome' ? (
        <main id="main-content" className="today">
          <InkFilters />
          <GateCard today={TODAY_PARTIAL} />
        </main>
      ) : (
        <ProfileScreen session={null} />
      )}
      {screen === 'sheet' && <ReferralSheet open={open} onClose={() => setOpen(false)} onChoose={() => {}} />}
      {screen === 'choose' && <ChooseSheet open={open} onClose={() => setOpen(false)} find={find} />}
      {screen === 'welcome' && <WelcomeSheet open={open} onClose={() => setOpen(false)} />}
    </>
  )
}
