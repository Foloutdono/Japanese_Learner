import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { DepartureGate } from './components/station/DepartureGate'
import { TrainDoor } from './components/station/TrainDoor'
import { TicketGate } from './components/station/TicketGate'
import { sectionFor, HOME_STATION } from './config/stations'
import { identityFor } from './config/identity'
import { apiJsonWithTimeout } from './lib/api'
// Development-only. Vite statically replaces import.meta.env.DEV with
// `false` in a production build, so this import and the route below
// are both dropped by tree-shaking — the screen is not merely
// unreachable in production, it is not in the bundle.
import RewardsPreview from './screens/RewardsPreview'
import OnboardingPreview from './screens/OnboardingPreview'
import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { LangProvider, useLang } from './LangContext'

import LandingScreen from './screens/LandingScreen'
import AuthScreen  from './screens/AuthScreen'
import OnboardingFlow from './screens/OnboardingFlow'
import HomeScreen  from './screens/HomeScreen'
import TodayScreen from './screens/TodayScreen'
import KanaScreen  from './screens/KanaScreen'
import VocabScreen from './screens/VocabScreen'
import KanjiScreen from './screens/KanjiScreen'
import StatsScreen from './screens/StatsScreen'
import DictionaryScreen from './screens/DictionaryScreen'
import DecksScreen      from './screens/DecksScreen'
import DeckDetailScreen from './screens/DeckDetailScreen'
import StudyScreen      from './screens/StudyScreen'
import GrammarScreen from './screens/GrammarScreen'
import AnalyzerScreen from './screens/AnalyzerScreen'
import ReadingScreen from './screens/ReadingScreen'
import ReadingComprehensionScreen from './screens/ReadingComprehensionScreen'
import ProfileScreen from './screens/ProfileScreen'
import SettingsScreen from './screens/SettingsScreen'
import ExamScreen from './screens/ExamScreen'
import ExamRunner from './screens/ExamRunner'
import ExamResult from './screens/ExamResult'
import TranslationScreen from './screens/TranslationScreen'
import DarumaScreen from './screens/DarumaScreen'
import StorehouseScreen from './screens/StorehouseScreen'
import { CosmeticTheme } from './stores/cosmetics'
import { preload } from './lib/audio'

// Renders nothing — keeps <html lang> and document.title in step with
// the current route and language. Beside <Routes/> rather than inside
// it for the same reason DepartureGate is: every screen would otherwise
// need to remember to set its own title, and the six that forgot the
// theme snippet are the evidence for how that goes.
//
// The route's own title comes from the same pair TopBar uses —
// sectionFor for stations, identityFor for the two pass routes — so a
// new station added to stations.js gets a document title for free.
function DocumentHead() {
  const { t } = useLang()
  const { pathname } = useLocation()

  useEffect(() => {
    const identity = identityFor(pathname, t)
    const section = identity ? null : sectionFor(pathname, t)
    const screen = identity?.title ?? section?.title
    document.title = screen ? `${screen} — ${t.appTitle}` : t.appTitle
  }, [pathname, t])

  return null
}

export default function App() {
  const [session, setSession] = useState(undefined)
  const [showLanding, setShowLanding] = useState(true)
  // The onboarding gate: undefined = still asking, 'needed' = show the
  // ticket office instead of the router, 'finishing' = the router is
  // up with the TicketGate cutscene playing over it, 'done' = normal.
  // Gated on a dedicated fetch rather than stores/profileSummary — the
  // store's silent .catch and 30s TTL make it exactly wrong for a
  // decision this binary (an outage would spin forever; a stale
  // pre-onboarding cache would flash 窓口 at a veteran).
  //
  // The answer is stored WITH the user id it belongs to and derived
  // against the current session below, instead of being reset in the
  // effect: no synchronous setState in an effect, a signout/signin as
  // someone else can never leak the previous account's answer, and a
  // Supabase token refresh (new session object, same user) neither
  // flashes the loading state nor re-gates anyone.
  const [gate, setGate] = useState(null) // { userId, state, profile }

  useEffect(() => {
    if (!session) return
    let cancelled = false
    const userId = session.user?.id ?? null
    apiJsonWithTimeout('/api/profile', session, { timeoutMs: 8000 })
      .then(p => {
        if (cancelled) return
        setGate({ userId, state: p.onboardedAt ? 'done' : 'needed', profile: p })
      })
      // FAIL OPEN. A flaky network must never lock someone out of an
      // app they already use; the flow re-offers itself next launch.
      .catch(() => { if (!cancelled) setGate({ userId, state: 'done', profile: null }) })
    return () => { cancelled = true }
  }, [session])

  const onboarding = gate && gate.userId === (session?.user?.id ?? null) ? gate.state : undefined
  const onboardingProfile = gate?.profile ?? null
  const setOnboarding = state => setGate(g => (g ? { ...g, state } : g))

  // Decode the two sounds whose first play must not be late: the UI
  // click, which is the very first interaction, and the level-up
  // chime, which fires under a full-screen celebration where a
  // hundred milliseconds of fetch is plainly visible. Everything else
  // can decode on demand.
  useEffect(() => {
    preload(['/sounds/ui/click.mp3', '/sounds/sfx/level-up.mp3'])
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session))
    return () => subscription.unsubscribe()
  }, [])

  // The dev workbenches render synthetic props and touch no user
  // data, so they are deliberately outside the auth gate: requiring a
  // sign-in to look at a reward would mean the one tool built to avoid
  // levelling an account needs an account, and /dev/onboarding exists
  // precisely to replay the office without an onboarding-armed
  // profile (its dryRun never writes). Dev-only, like the routes
  // themselves — import.meta.env.DEV is false in a production build,
  // so this whole branch is dropped.
  if (import.meta.env.DEV && window.location.pathname.startsWith('/dev/')) {
    return (
      <LangProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/dev/rewards" element={<RewardsPreview />} />
            <Route path="/dev/onboarding" element={<OnboardingPreview />} />
          </Routes>
        </BrowserRouter>
      </LangProvider>
    )
  }

  if (session === undefined) {
    return (
      <LangProvider>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: 'var(--text-secondary)' }}>Chargement...</div>
        </div>
      </LangProvider>
    )
  }

  if (!session) {
    return (
      <LangProvider>
        {showLanding
          ? <LandingScreen onContinue={() => setShowLanding(false)} />
          : <AuthScreen onBack={() => setShowLanding(true)} />}
      </LangProvider>
    )
  }

  // Signed in, but the profile hasn't answered "onboarded?" yet — the
  // same centered wait as the session check above, for the same reason:
  // flashing the wrong screen for 200ms is worse than a beat of quiet.
  if (onboarding === undefined) {
    return (
      <LangProvider>
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ color: 'var(--text-secondary)' }}>Chargement...</div>
        </div>
      </LangProvider>
    )
  }

  // みどりの窓口 — the ticket office, instead of the router: the same
  // continuum Landing → Auth uses. No route, no station; see
  // screens/OnboardingFlow.jsx for why. onComplete goes through
  // 'finishing' so the TicketGate below plays over the mounted router.
  if (onboarding === 'needed') {
    return (
      <LangProvider>
        <CosmeticTheme />
        <OnboardingFlow
          session={session}
          initialProfile={onboardingProfile}
          onComplete={() => setOnboarding('finishing')}
        />
      </LangProvider>
    )
  }

  return (
    <LangProvider>
      {/* Renders nothing — keeps <html>'s data-paper/-ring/-seal
          attributes in step with the equipped loadout, which is how
          cosmetics reach every screen without any of them knowing
          cosmetics exist. See components/cosmetics.js. */}
      <CosmeticTheme />
      <BrowserRouter>
        <Routes>
          <Route path="/"                     element={<HomeScreen session={session} />} />
          {/* 本日の運行 — everything due, in one queue. See TodayScreen. */}
          <Route path="/today"                element={<TodayScreen session={session} />} />
          <Route path="/kana"                 element={<KanaScreen session={session} />} />
          <Route path="/vocab"                element={<VocabScreen session={session} />} />
          <Route path="/kanji"                element={<KanjiScreen session={session} />} />
          <Route path="/stats"                element={<StatsScreen session={session} />} />
          <Route path="/dictionary"           element={<DictionaryScreen session={session} />} />
          <Route path="/decks"                element={<DecksScreen session={session} />} />
          <Route path="/decks/:deck_id"       element={<DeckDetailScreen session={session} />} />
          <Route path="/decks/:deck_id/study" element={<StudyScreen session={session} />} />
          <Route path="/grammar"              element={<GrammarScreen session={session} />} />
          <Route path="/analyzer"             element={<AnalyzerScreen session={session} />} />
          {/* Merged into /analyzer by plan 027. Kept as redirects, not
              deleted: both paths have been live, are in browser history
              and may be bookmarked, and a 404 on a URL that used to work
              is the worst possible outcome of a rename. `replace` so Back
              from the analyzer goes home rather than back to the redirect. */}
          <Route path="/phrase-analyzer"      element={<Navigate to="/analyzer" replace />} />
          <Route path="/video"                element={<Navigate to="/analyzer" replace />} />
          <Route path="/reading"              element={<ReadingScreen session={session} />} />
          <Route path="/reading-comprehension" element={<ReadingComprehensionScreen session={session} />} />
          <Route path="/profile" element={<ProfileScreen session={session} />} />
          <Route path="/settings" element={<SettingsScreen session={session} />} />
          {/* No /:sectionId segment: every generated paper has exactly
              one section (see each backend/study/exam_*_gen.py), so it
              was a parameter with one legal value and a picker screen
              that only ever offered one choice. */}
          <Route path="/exam" element={<ExamScreen session={session} />} />
          <Route path="/exam/:examId" element={<ExamRunner session={session} />} />
          <Route path="/exam/:examId/results" element={<ExamResult session={session} />} />
          <Route path="/translation" element={<TranslationScreen session={session} />} />
          <Route path="/daruma" element={<DarumaScreen session={session} />} />
          <Route path="/storehouse" element={<StorehouseScreen session={session} />} />
          {import.meta.env.DEV && (
            <Route path="/dev/rewards" element={<RewardsPreview />} />
          )}
        </Routes>

        <DocumentHead />

        {/* 改札 — the departure cutscene. Beside <Routes/>, never
            inside it: the gate has to keep playing across the very
            navigation it triggers, and a screen that renders it is
            unmounted by that navigation. See stores/departure. */}
        <DepartureGate />

        {/* 扉 — boarding, on the last choice of a selection screen.
            Outside <Routes/> for a sharper version of the gate's
            reason: committing the choice is what makes the screen
            render a different tree, so a door rendered by the
            selection branch would be unmounted by the very state
            change it is covering. See stores/boarding. */}
        <TrainDoor />

        {/* The onboarding finale: the learner's FIRST pass through the
            改札, played over the already-mounted router (HomeScreen is
            under the scrim from frame one) — rendered here and not by
            OnboardingFlow, which has just unmounted and would take the
            cutscene down mid-wipe with it. onNavigate is a no-op
            because '/' is already where the router mounts. Under
            prefers-reduced-motion TicketGate fires both callbacks
            synchronously and renders nothing, per house rule. */}
        {onboarding === 'finishing' && (
          <TicketGate
            section={{ icon: '日本語', title: HOME_STATION.latin }}
            station={HOME_STATION}
            onNavigate={() => {}}
            onDone={() => setOnboarding('done')}
          />
        )}
      </BrowserRouter>
    </LangProvider>
  )
}