import { Navigate, useParams } from 'react-router-dom'
import { useLang } from '../LangContext'
import { LANGUAGES } from '../i18n'
import { playClick } from '../lib/audio'
import { useVolumes, useMuted, DEFAULT_VOLUMES } from '../lib/audio'
import { isGuest } from '../lib/guest'
import { useThemeChoice } from '../stores/theme'
import { useRatingScale } from '../stores/ratingScale'
import { ATTRIBUTIONS } from '../domain/attributions'
import { Bar, Leave } from '../components/chrome/Bar'
import { useListWalk, WALK_KEYS } from '../hooks/useListWalk'
import { ChevronIcon, GearIcon } from '../components/ui/Icons'
import { useOfferable } from '../hooks/useOfferable'
import { openPaywall } from '../stores/credits'
import { SOURCES } from '../domain/paywall'
import { SettingsPass } from '../components/settings/SettingsPass'
import { SettingsDoor } from '../components/settings/SettingsDoor'
import { ThemeSwatch, SoundMeter, RatingDots } from '../components/settings/RowSpecimens'
import { LevelPage } from '../components/settings/LevelPage'
import { DestinationPage } from '../components/settings/DestinationPage'
import { ServicePage } from '../components/settings/ServicePage'
import { HourPage } from '../components/settings/HourPage'
import { LinesPage } from '../components/settings/LinesPage'
import { DisplayPage } from '../components/settings/DisplayPage'
import { SoundPage } from '../components/settings/SoundPage'
import { RatingPage } from '../components/settings/RatingPage'
import { HelpPage } from '../components/settings/HelpPage'
import { AccountPage } from '../components/settings/AccountPage'
import { CreditsPage } from '../components/settings/CreditsPage'
import { NotificationsPage } from '../components/settings/NotificationsPage'
import { canNudge } from '../lib/platform'
import { useProfileSummaryState } from '../stores/profileSummary'
import { SettingsPaneContext } from '../components/settings/pane'
import { useDesk } from '../hooks/useDesk'

// ── Settings (canvas Settings, plan 074; the pass's contract, plan 139) ──
// The owner's pick of the "Settings rework — options" canvas: B's pass
// with C's list. Settings opens on the learner's pass, printed with the
// contract it was issued under (components/settings/SettingsPass.jsx) —
// the level it boards at, the destination, the service, the daily ride
// and the lines, each a door to the page that changes it — and under it
// the rest as a list whose rows draw what they are set to. Every page
// lives at /profile/settings/<page>; the phone pushes it, the desk sets
// it beside the column. Notifications (plan 155) is a shell's page
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
  rating: RatingPage,
  help: HelpPage,
  account: AccountPage,
  credits: CreditsPage,
}

// The pages the pass's fields took apart (plan 139): Learning is the
// level now (its pace, lines, rating bar and ride went to their own
// doors), and Data is the account page's second half. An address kept
// from before lands where its content went.
const MOVED = { learning: 'level', data: 'account' }

const THEATRE = ['ambiance', 'jingle', 'announcement']

// The page the desk opens when the column is asked for on its own: the
// contract's destination, the field the rest of the pass is priced by.
const FIRST_PAGE = 'destination'

// Every door in the column, the pass's and the list's: one tab stop on
// the desk, walked with ↑/↓ (plan 123).
const DOORS = '.stg-door'

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
  const { t, lang } = useLang()
  const desk = current != null
  const onWalk = useListWalk(desk, { items: DOORS })
  const [theme] = useThemeChoice()
  const scale = useRatingScale()
  const volumes = useVolumes()
  const muted = useMuted()
  const offerable = useOfferable()
  const { summary } = useProfileSummaryState()

  const langLabel = LANGUAGES.find(l => l.code === lang)?.label ?? lang
  const quiet = THEATRE.every(k => volumes[k] === 0)
  const full = THEATRE.every(k => volumes[k] === DEFAULT_VOLUMES[k])
  const soundValue = muted ? t.mute : quiet ? t.soundValueQuiet : full ? t.soundValueFull : t.soundValueMixed
  const email = session?.user?.email ?? ''
  const accountValue = email ? `${email.split('@')[0]}@…` : (isGuest(session) ? t.guestLabel : '')

  const ROWS = [
    { id: 'display', label: t.settingsEnvShort, value: langLabel, spec: <ThemeSwatch theme={theme} /> },
    { id: 'sound', label: t.sound, value: soundValue, spec: <SoundMeter volumes={volumes} muted={muted} /> },
    ...(canNudge() ? [{
      id: 'notifications',
      label: t.settingsNotif,
      value: summary?.notifications && summary?.reminderTime ? summary.reminderTime : t.notifOff,
    }] : []),
    { id: 'rating', label: t.settingsRatingShort, value: t.settingsRatingScaleOption[scale] ?? '', spec: <RatingDots scale={scale} /> },
    { id: 'help', label: t.settingsHelp, value: t.settingsHelpValue },
    { id: 'account', label: t.account, value: accountValue },
    { id: 'credits', label: t.settingsCredits, value: t.settingsCreditsCount(ATTRIBUTIONS.length) },
  ]

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
        <SettingsPass current={current} />

        <div className="stg-list">
          {ROWS.map(row => (
            <SettingsDoor key={row.id} page={row.id} current={current} className="stg-row" onClassName="stg-row--on">
              <span className="stg-row__names"><span className="stg-row__jp">{row.label}</span></span>
              <span className="stg-row__value">{row.spec}<span className="stg-row__text">{row.value}</span></span>
              <ChevronIcon direction="right" size={16} className="stg-row__chev" />
            </SettingsDoor>
          ))}

          {/* The pass. Not one of PAGES — it opens the offer sheet, so it
              is drawn here rather than joining ROWS, and it leaves the
              list entirely for a learner who already holds one. */}
          {offerable && (
            <button
              type="button"
              className="stg-row stg-row--pass stg-door"
              data-page="pass"
              data-action="paywall-open"
              tabIndex={desk ? -1 : undefined}
              onClick={() => { playClick(); openPaywall(SOURCES.SETTINGS) }}
            >
              <span className="stg-row__names"><span className="stg-row__jp">{t.passLabel}</span></span>
              <span className="stg-row__value"><span className="stg-row__text">{t.paywallRowValue}</span></span>
              <ChevronIcon direction="right" size={16} className="stg-row__chev" />
            </button>
          )}
        </div>
      </div>
    </>
  )
}
