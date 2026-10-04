import { Navigate, useParams } from 'react-router-dom'
import { useLang } from '../LangContext'
import { Bar, Leave } from '../components/chrome/Bar'
import { useListWalk, WALK_KEYS } from '../hooks/useListWalk'
import { GearIcon } from '../components/ui/Icons'
import { SettingsCard } from '../components/pass/LearnerCard'
import { SettingsList } from '../components/settings/SettingsList'
import { AgendaPage } from '../components/settings/AgendaPage'
import { LevelPage } from '../components/settings/LevelPage'
import { DestinationPage } from '../components/settings/DestinationPage'
import { ServicePage } from '../components/settings/ServicePage'
import { HourPage } from '../components/settings/HourPage'
import { LinesPage } from '../components/settings/LinesPage'
import { DisplayPage } from '../components/settings/DisplayPage'
import { SoundPage } from '../components/settings/SoundPage'
import { RatingPage } from '../components/settings/RatingPage'
import { ReadingPacePage } from '../components/settings/ReadingPacePage'
import { HelpPage } from '../components/settings/HelpPage'
import { AccountPage } from '../components/settings/AccountPage'
import { CreditsPage } from '../components/settings/CreditsPage'
import { NotificationsPage } from '../components/settings/NotificationsPage'
import { canNudge } from '../lib/platform'
import { SettingsPaneContext } from '../components/settings/pane'
import { useDesk } from '../hooks/useDesk'

// ── Settings (canvas Settings, plan 074; the pass's contract, plan 139) ──
// The owner's pick of the "Settings rework — options" canvas: B's pass
// with C's list. Settings opens on the learner's card turned over, its
// back printed with the contract it was issued under (plan 173,
// components/pass/LearnerCard.jsx's SettingsCard) — the level it boards
// at, the destination, the service, the daily ride and the lines, each
// a door to the page that changes it — and under it
// the rest as a list whose rows draw what they are set to. Every page
// lives at /profile/settings/<page>; the phone pushes it, the desk sets
// it beside the column. Notifications (plan 156) is a shell's page
// only: the web has nothing to schedule, and a settings screen above
// all must be exactly what it says (no dead controls).
const PAGES = {
  level: LevelPage,
  destination: DestinationPage,
  service: ServicePage,
  hour: HourPage,
  lines: LinesPage,
  display: DisplayPage,
  sound: SoundPage,
  notifications: NotificationsPage,
  agenda: AgendaPage,
  rating: RatingPage,
  reading: ReadingPacePage,
  help: HelpPage,
  account: AccountPage,
  credits: CreditsPage,
}

// The pages the pass's fields took apart (plan 139): Learning is the
// level now (its pace, lines, rating bar and ride went to their own
// doors), and Data is the account page's second half. An address kept
// from before lands where its content went.
const MOVED = { learning: 'level', data: 'account' }

// The page the desk opens when the column is asked for on its own: the
// contract's destination, the field the rest of the pass is priced by.
const FIRST_PAGE = 'destination'

// Every door in the column, the card's and the list's: one tab stop on
// the desk, walked with ↑/↓ (plan 123) -- the card's only while its
// back is up (a side turned away is inert).
const DOORS = '.stg-door:not([inert] *)'

export default function SettingsScreen({ session }) {
  const { page } = useParams()
  const desk = useDesk()
  if (page && MOVED[page]) return <Navigate to={`/profile/settings/${MOVED[page]}`} replace />
  if (page && !PAGES[page]) return <Navigate to="/profile/settings" replace />
  if (page === 'notifications' && !canNudge()) return <Navigate to="/profile/settings" replace />

  // ── 机 — the column and the page side by side (plan 113) ──
  // A computer has the room to show the pass and the list while you
  // change what they lead to, so on the desk the two share the screen:
  // the column on the left, the open page beside it
  // (components/settings/pane.js), neither printing a title (plan 139):
  // the open door is lit. The URLs are the phone's, and the bare column
  // opens on its first page rather than beside an empty pane.
  if (desk) {
    if (!page) return <Navigate to={`/profile/settings/${FIRST_PAGE}`} replace />
    const Page = PAGES[page]
    return (
      <main id="main-content" className="settings desk-settings">
        <div className="desk-settings__list">
          <SettingsHome session={session} current={page} />
        </div>
        <SettingsPaneContext.Provider value>
          <Page session={session} />
        </SettingsPaneContext.Provider>
      </main>
    )
  }

  if (page) {
    const Page = PAGES[page]
    return <Page session={session} />
  }
  return (
    <main id="main-content" className="settings">
      <SettingsHome session={session} />
    </main>
  )
}

// The column: the pass, then the list. `current` is the page open beside
// it on the desk, and lights its door; the phone has no such page.
function SettingsHome({ session, current = null }) {
  const { t } = useLang()
  const desk = current != null
  const onWalk = useListWalk(desk, { items: DOORS })

  return (
    <>
      {/* The column's name: a bar on the phone, where it is the screen;
          clipped on the desk, where the rail's lit station says it
          (plan 139). */}
      {desk ? <h1 className="sr-only">{t.settings}</h1> : (
        <Bar
          code={<GearIcon size={14} />}
          title={t.settings}
          color="var(--pass-ink)"
          aside={<Leave to={'/profile'}>{t.profileTitle}</Leave>}
        />
      )}

      <div className="stg-home" onKeyDown={onWalk} aria-keyshortcuts={desk ? WALK_KEYS : undefined}>
        <SettingsCard current={current} session={session} />
        <SettingsList session={session} current={current} />
      </div>
    </>
  )
}
