import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useLang } from '../LangContext'
import { LANGUAGES } from '../i18n'
import { supabase } from '../lib/supabase'
import { playClick } from '../lib/audio'
import { useVolumes, useMuted, DEFAULT_VOLUMES } from '../lib/audio'
import { useProfileSummary } from '../stores/profileSummary'
import { useJourneyStatus } from '../stores/journey'
import { NOVICE_GOAL } from '../domain/goalMath'
import { useThemeChoice } from '../stores/theme'
import { Bar, Leave } from '../components/chrome/Bar'
import { ChevronIcon, GearIcon } from '../components/ui/Icons'
import { useOfferable } from '../hooks/useOfferable'
import { openPaywall } from '../stores/credits'
import { SOURCES } from '../domain/paywall'
import { DisplayPage } from '../components/settings/DisplayPage'
import { SoundPage } from '../components/settings/SoundPage'
import { LearningPage } from '../components/settings/LearningPage'
import { DestinationPage } from '../components/settings/DestinationPage'
import { DataPage } from '../components/settings/DataPage'
import { AccountPage } from '../components/settings/AccountPage'
import { CreditsPage } from '../components/settings/CreditsPage'
import { SettingsPaneContext } from '../components/settings/pane'
import { useDesk } from '../hooks/useDesk'

// ── Settings (canvas Settings, plan 074) ──────────────────────
// A list of seven rows, each printing its current value, each a door to
// its own page at /profile/settings/<page>; Sign out under the list.
// The pages are components/settings/*; this screen is the list and
// the switch. Deliberately NOT here: a notifications page — it needs
// a preferences endpoint that does not exist, and a settings screen
// above all must be exactly what it says (no dead controls).
const PAGES = {
  display: DisplayPage,
  sound: SoundPage,
  learning: LearningPage,
  destination: DestinationPage,
  data: DataPage,
  account: AccountPage,
  credits: CreditsPage,
}

const THEATRE = ['ambiance', 'jingle', 'announcement']

// The page the desk opens when the list is asked for on its own.
const FIRST_PAGE = 'display'

export default function SettingsScreen({ session }) {
  const { page } = useParams()
  const desk = useDesk()
  if (page && !PAGES[page]) return <Navigate to="/profile/settings" replace />

  // ── 机 — the list and the page side by side (plan 112) ──
  // A computer has the room to show where you are in the list while you
  // change what it leads to, so on the desk the two share the screen:
  // the list on the left under the screen's one heading, the open page
  // beside it (components/settings/pane.js). The URLs are the phone's —
  // a page is still /profile/settings/<page> — and the bare list opens
  // on its first page rather than beside an empty pane.
  if (desk) {
    if (!page) return <Navigate to={`/profile/settings/${FIRST_PAGE}`} replace />
    const Page = PAGES[page]
    return (
      <main id="main-content" className="settings desk-settings">
        <div className="desk-settings__list">
          <SettingsListBody session={session} current={page} />
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
      <SettingsListBody session={session} />
    </main>
  )
}

// The list: its bar, the rows, Sign out. `current` is the page open
// beside it on the desk, and marks its row; the phone has no such page.
function SettingsListBody({ session, current = null }) {
  const { t, lang } = useLang()
  const navigate = useNavigate()
  const summary = useProfileSummary()
  const { data: journey } = useJourneyStatus()
  const [theme] = useThemeChoice()
  const volumes = useVolumes()
  const muted = useMuted()

  const themeLabel = { auto: t.themeAuto, dark: t.themeDark, light: t.themeLight }[theme]
  const langLabel = LANGUAGES.find(l => l.code === lang)?.label ?? lang
  const quiet = THEATRE.every(k => volumes[k] === 0)
  const full = THEATRE.every(k => volumes[k] === DEFAULT_VOLUMES[k])
  const soundValue = muted ? t.mute : quiet ? t.soundValueQuiet : full ? t.soundValueFull : t.soundValueMixed
  const learningValue = summary?.jlptLevel
    ? `${summary.jlptLevel}${summary.dailyNewTarget ? ` · ${summary.dailyNewTarget} ${t.settingsPerDay}` : ''}`
    : ''
  const fmt = new Intl.DateTimeFormat(lang === 'fr' ? 'fr' : 'en', { day: 'numeric', month: 'short', year: 'numeric' })
  // The kana stop wears no JLPT code, so the row prints its name
  // (domain/goalMath.js NOVICE_GOAL).
  const destName = journey?.goalLevel === NOVICE_GOAL ? t.brdNovice : journey?.goalLevel
  const destinationValue = journey?.goalLevel
    ? `${destName}${journey.goalTargetDate ? ` · ${fmt.format(new Date(journey.goalTargetDate))}` : ''}`
    : (journey ? t.settingsGoalNoneShort : '')
  const email = session?.user?.email ?? ''
  const accountValue = email ? `${email.split('@')[0]}@…` : ''
  const offerable = useOfferable()

  const ROWS = [
    { id: 'display', label: t.settingsEnvironment, value: `${themeLabel} · ${langLabel}` },
    { id: 'sound', label: t.sound, value: soundValue },
    { id: 'learning', label: t.settingsLearning, value: learningValue },
    { id: 'destination', label: t.settingsGoal, value: destinationValue },
    { id: 'data', label: t.settingsData, value: '' },
    { id: 'account', label: t.account, value: accountValue },
    { id: 'credits', label: t.settingsCredits, value: '' },
  ]

  return (
    <>
      <Bar
        code={<GearIcon size={14} />}
        title={t.settings}
        color="var(--pass-ink)"
        aside={<Leave to={'/profile'}>{t.profileTitle}</Leave>}
      />

      <div className="stg-list">
        {ROWS.map(row => (
          <button
            key={row.id}
            type="button"
            className={`stg-row${row.id === current ? ' stg-row--on' : ''}`}
            data-page={row.id}
            aria-current={row.id === current ? 'page' : undefined}
            onClick={() => { playClick(); navigate(`/profile/settings/${row.id}`) }}
          >
            <span className="stg-row__names"><span className="stg-row__jp">{row.label}</span></span>
            <span className="stg-row__value">{row.value}</span>
            <ChevronIcon direction="right" size={16} className="stg-row__chev" />
          </button>
        ))}

        {/* The pass. Not one of PAGES — it opens the offer sheet, so it
            is drawn here rather than joining ROWS, and it leaves the
            list entirely for a learner who already holds one. */}
        {offerable && (
          <button
            type="button"
            className="stg-row stg-row--pass"
            data-page="pass"
            data-action="paywall-open"
            onClick={() => { playClick(); openPaywall(SOURCES.SETTINGS) }}
          >
            <span className="stg-row__names"><span className="stg-row__jp">{t.passLabel}</span></span>
            <span className="stg-row__value">{t.paywallRowValue}</span>
            <ChevronIcon direction="right" size={16} className="stg-row__chev" />
          </button>
        )}
      </div>

      <button type="button" className="btn-secondary stg-signout" onClick={() => supabase.auth.signOut({ scope: 'local' })}>
        {t.signOut}
      </button>
    </>
  )
}
