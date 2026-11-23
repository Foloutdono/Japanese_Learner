import { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { seedSummary } from '../stores/profileSummary'
import { seedTodaySummary } from '../stores/today'
import { seedCredits } from '../stores/credits'
import { seedReferral } from '../stores/referral'
import { seedMissions, seedMissionsBook } from '../stores/missions'
import GateCard from '../components/station/GateCard'
import ProfileScreen from './ProfileScreen'
import { InkFilters } from '../components/dayclear/kit'
import { ChooseSheet, WelcomeSheet } from '../components/referral/Referral'
import { SUMMARY, TODAY_PARTIAL } from '../components/dayclear/fixtures'
import { referralFixture } from '../components/referral/fixtures'
import { bookFixture, missionsFixture } from '../components/missions/fixtures'

// ── /dev/referral — the referral, in the screens it lives in (plan 329) ──
// Development only, no backend, no session: the real gate and the real
// profile under the real shell, fed by fixtures in the server's shape
// (components/referral/fixtures.js).
//
//   ?v=A    an insert in the holder (the filleuls as a book of tickets), and
//           a sheet over Today that asks once
//   ?v=B    a notice on the gate's foot, one door in the holder, one sheet behind it
//   &screen=today (default) | choose (« Choisis ton parrain ») | profile |
//           manage (B's sheet open) | reward (what the conversion pays)
//   &role=new (no parrain yet, 2 days left) | filleul | parrain
//   &step=0|1|2   the reward: waiting, ready, collected / the conversion paid
//   &plan=max     as a learner on the pass reads it (XP, not credits)
//   &bare=1       no bar (for the screenshots)
const VARIANTS = ['A', 'B']
const SCREENS = ['today', 'choose', 'profile', 'manage', 'reward']
const ROLES = ['new', 'filleul', 'parrain']
const BALANCE = 64

function credits(plan, balance) {
  return {
    balance: plan === 'max' ? null : balance, pending: 0, cap: 50, dailyRefill: 30, refillEvery: 2880,
    nextCreditAt: null, fullAt: null, signupBonus: 200,
    plan: plan === 'max' ? 'pass' : 'free', unlimited: plan === 'max', enforced: false, freeSources: ['kana'],
  }
}

export default function ReferralPreview() {
  const { search } = useLocation()
  return <Workbench key={search} />
}

function Workbench() {
  const [params] = useSearchParams()
  const v = VARIANTS.includes(params.get('v')) ? params.get('v') : 'A'
  const screen = SCREENS.includes(params.get('screen')) ? params.get('screen') : 'today'
  const role = ROLES.includes(params.get('role')) ? params.get('role') : (screen === 'reward' ? 'filleul' : 'new')
  const plan = params.get('plan') === 'max' ? 'max' : 'free'
  const step = Math.min(2, Math.max(0, Number(params.get('step')) || (screen === 'reward' ? 2 : 0)))
  const bare = params.get('bare') === '1'
  const [open, setOpen] = useState(true)

  // The workbench has no session, so the app's own sign-out (stores/account)
  // empties every store a moment after mount: plant again behind it.
  useEffect(() => {
    const plant = () => {
      seedSummary({ ...SUMMARY, guided: { today: true, profile: true, learn: true, practice: true, dictionary: true } })
      seedTodaySummary(TODAY_PARTIAL)
      seedCredits(credits(plan, BALANCE + (screen === 'reward' ? 300 : 0)))
      seedMissions(missionsFixture({ plan, step: 0 }))
      seedMissionsBook(bookFixture({ plan }))
      seedReferral({ ...referralFixture({ role, plan, step }), variant: v, open: screen === 'manage' ? 'manage' : null })
    }
    plant()
    const again = setTimeout(plant, 900)
    return () => clearTimeout(again)
  }, [v, role, plan, step, screen])

  const to = (o = {}) => {
    const q = new URLSearchParams({ v, screen, role, ...(plan === 'max' ? { plan } : {}), ...(step ? { step } : {}), ...o })
    return `/dev/referral?${q}`
  }

  return (
    <>
      {!bare && (
        <nav className="clrdev-bar" aria-label="Parrainage">
          {VARIANTS.map(o => <Link key={o} className="clrdev-bar__item" to={to({ v: o })} aria-current={o === v ? 'page' : undefined}>{o}</Link>)}
          {SCREENS.map(o => <Link key={o} className="clrdev-bar__item" to={to({ screen: o })} aria-current={o === screen ? 'page' : undefined}>{o}</Link>)}
          {ROLES.map(o => <Link key={o} className="clrdev-bar__item" to={to({ role: o })} aria-current={o === role ? 'page' : undefined}>{o}</Link>)}
          <Link className="clrdev-bar__item" to={to({ plan: plan === 'max' ? 'free' : 'max' })}>{plan === 'max' ? 'Free' : 'Max'}</Link>
        </nav>
      )}
      {screen === 'profile' || screen === 'manage' ? (
        <ProfileScreen session={null} />
      ) : (
        <main id="main-content" className="today">
          <InkFilters />
          <GateCard today={TODAY_PARTIAL} />
        </main>
      )}
      {screen === 'choose' && <ChooseSheet open={open} onClose={() => setOpen(false)} />}
      {screen === 'reward' && v === 'A' && <WelcomeSheet open={open} onClose={() => setOpen(false)} />}
    </>
  )
}
