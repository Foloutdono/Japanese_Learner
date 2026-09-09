import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom'
import { DepartureGate } from './components/station/DepartureGate'
import { TrainDoor } from './components/station/TrainDoor'
import { TicketGate } from './components/station/TicketGate'
import { UpdateToast, OfflineNote } from './components/ui/UpdateToast'
import { BalanceSheet } from './components/credits/BalanceSheet'
import { RunOutSheet } from './components/credits/RunOutSheet'
import { StatusSheet } from './components/journey/StatusSheet'
import { sectionFor, HOME_STATION } from './config/stations'
import { getTabs } from './config/tabs'
import { Shell, StageFrame } from './components/chrome/Shell'
import { NativeBridge } from './components/chrome/NativeBridge'
import { identityFor } from './config/identity'
import { apiJson, apiJsonWithTimeout } from './lib/api'
// Development-only. Vite statically replaces import.meta.env.DEV with
// `false` in a production build, so this import and the route below
// are both dropped by tree-shaking — the screen is not merely
// unreachable in production, it is not in the bundle.
import RewardsPreview from './screens/RewardsPreview'
import OnboardingPreview from './screens/OnboardingPreview'
import SoundPalette from './screens/SoundPalette'
import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { authRedirectError } from './lib/authRedirect'
import { isGuest, startGuest } from './lib/guest'
import { LangProvider, useLang } from './LangContext'

import Welcome from './components/boarding/Welcome'
import AuthScreen  from './screens/AuthScreen'
import BoardingFlow from './screens/BoardingFlow'
import LearnScreen from './screens/LearnScreen'
import PracticeScreen from './screens/PracticeScreen'
import TodayScreen from './screens/TodayScreen'
import TodayRun from './screens/TodayRun'
import KanaScreen  from './screens/KanaScreen'
import KanaRun from './screens/KanaRun'
import VocabRun from './screens/VocabRun'
import KanjiRun from './screens/KanjiRun'
import GrammarRun from './screens/GrammarRun'
import StudyRun from './screens/StudyRun'
import VocabScreen from './screens/VocabScreen'
import KanjiScreen from './screens/KanjiScreen'
import StatsScreen from './screens/StatsScreen'
import DictionaryScreen from './screens/DictionaryScreen'
import DecksScreen      from './screens/DecksScreen'
import DeckDetailScreen from './screens/DeckDetailScreen'
import StudyScreen      from './screens/StudyScreen'
import GrammarScreen from './screens/GrammarScreen'
import AnalyzerScreen from './screens/AnalyzerScreen'
import SentenceStation from './screens/SentenceStation'
import ReadingRun from './screens/ReadingRun'
import ComprehensionRun from './screens/ComprehensionRun'
import ProfileScreen from './screens/ProfileScreen'
import SettingsScreen from './screens/SettingsScreen'
import ExamScreen from './screens/ExamScreen'
import ExamRunner from './screens/ExamRunner'
import ExamResult from './screens/ExamResult'
import TranslationRun from './screens/TranslationRun'
import AppLoading from './screens/AppLoading'

// Renders nothing — keeps <html lang> and document.title in step with
// the current route and language. Beside <Routes/> rather than inside
// it for the same reason DepartureGate is: every screen would otherwise
// need to remember to set its own title, and the six that forgot the
// theme snippet are the evidence for how that goes.
//
// The route's own title comes from the same registries the bar uses —
// sectionFor for stations, identityFor for the two pass routes, and
// the tab itself for a gate's root — so a new station added to
// stations.js gets a document title for free.
function DocumentHead() {
  const { t } = useLang()
  const { pathname } = useLocation()

  useEffect(() => {
    const identity = identityFor(pathname, t)
    const section = identity ? null : sectionFor(pathname, t)
    const tab = identity || section ? null : getTabs(t).find(x => x.path === pathname)
    const screen = identity?.title ?? section?.title ?? tab?.label
    document.title = screen ? `${screen} — ${t.appTitle}` : t.appTitle
  }, [pathname, t])

  return null
}

// ── Moved ──
// Every path the app has ever had stays reachable: the old top-level
// routes (/kana, /decks/<id>, /exam/<id>/results …) were live for
// months, sit in browser histories and bookmarks, and a 404 on a URL
// that used to work is the worst possible outcome of a rename. Each
// one redirects to its place behind a gate (config/tabs.js), keeping
// its params and its query (`/kana?set=…`, `/exam/<id>?exclude=…`).
// `replace`, so Back from the destination leaves rather than bouncing.
const MOVED = [
  ['/kana',                    '/learn/kana'],
  ['/vocab',                   '/learn/vocab'],
  ['/kanji',                   '/learn/kanji'],
  ['/grammar',                 '/learn/grammar'],
  ['/decks',                   '/learn/decks'],
  ['/decks/:deck_id',          '/learn/decks/:deck_id'],
  ['/decks/:deck_id/study',    '/learn/decks/:deck_id/study'],
  ['/reading',                 '/practice/reading'],
  ['/reading-comprehension',   '/practice/comprehension'],
  ['/translation',             '/practice/translation'],
  ['/exam',                    '/practice/exam'],
  ['/exam/:examId',            '/practice/exam/:examId'],
  ['/exam/:examId/results',    '/practice/exam/:examId/results'],
  // Merged into the analyzer by plan 027; the analyzer moved behind
  // the dictionary's door in plan 068.
  ['/analyzer',                '/dictionary/analyzer'],
  ['/phrase-analyzer',         '/dictionary/analyzer'],
  ['/video',                   '/dictionary/analyzer'],
  ['/stats',                   '/profile/stats'],
  ['/settings',                '/profile/settings'],
  // The Daruma Hall and the Storehouse were retired with the rest of
  // the profile's gamification; they go home to the pass they hung off.
  ['/daruma',                  '/profile'],
  ['/storehouse',              '/profile'],
]

// ── 実践 — the sentence sections, and their station pages ──
// Reading, comprehension and translation are each a station (the
// source, the grade, the tier — under the chrome) and a run (the
// session — on the stage). One entry here draws that station's pages;
// the run's own routes are spelled out below, since each names the
// part of the choice it carries. Comprehension has one axis, so its
// root is the level list and it has no source or tier page.
const SENTENCE_SECTIONS = [
  { base: '/practice/reading' },
  { base: '/practice/translation' },
  { base: '/practice/comprehension', levelsOnly: true },
]

function Moved({ to }) {
  const params = useParams()
  const { search, hash } = useLocation()
  const path = to.replace(/:(\w+)/g, (_, key) => params[key])
  return <Navigate to={path + search + hash} replace />
}

export default function App() {
  const [session, setSession] = useState(undefined)
  // Signed out: Welcome (the boarding's step zero) until Board or
  // "Have an account?" opens the sign-in on the matching side.
  //
  // The exception is a load that came back from a REFUSED Google round
  // trip with nobody signed in (lib/authRedirect.js): Welcome has no
  // line to say why, so the learner would be returned to the poster as
  // if they had never tapped anything. The sign-in screen has that
  // line, and it prints the reason on its own mount.
  const [authMode, setAuthMode] = useState(() => (authRedirectError() ? 'login' : null)) // null | 'login' | 'signup'
  // Embarquer mints a guest pass rather than asking for an account
  // (lib/guest.js): the boarding runs on a real user with no
  // credentials, and the account is offered at the END, refusably. The
  // flag is only the button's own "working on it" — the session
  // arrives through the auth listener like any other.
  const [boarding, setBoarding] = useState(false)

  // Anonymous sign-ins are a project setting, so this can legitimately
  // be unavailable. It is not something the learner can act on, so the
  // fall-back is silent and is simply the flow this replaced: ask for
  // the account up front.
  async function board() {
    if (boarding) return
    setBoarding(true)
    const r = await startGuest()
    if (!r.ok) setAuthMode('signup')
    setBoarding(false)
  }

  // The two ways out of the boarding, both of which end at Welcome:
  // back from its first question, and "already have an account". A
  // guest pass with nothing on it is worth nothing, so leaving drops
  // it rather than stranding a half-filled account in the session —
  // and signing out is what puts Welcome back on screen. `local`
  // scope, like Settings' own sign-out: this device only.
  function leaveBoarding(mode = null) {
    setAuthMode(mode)
    supabase.auth.signOut({ scope: 'local' })
  }
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
    // 45 s, not the 10 s default: the backend sleeps on Render's free
    // tier and a cold start takes 30–60 s. On a phone, where every visit
    // is short and the first request of the day is exactly this one, an
    // 8 s gate that fails open showed a blank hall to everyone who
    // arrived while the server was still waking. The wait itself is
    // drawn honestly by AppLoading.
    // The device's clock, on the profile, so the credits refill at the
    // learner's midnight (plan 069). Fire-and-forget: a boot that could
    // not say so refills on UTC's day until the next one that can.
    apiJson('/api/profile/learning', session, {
      method: 'PATCH',
      body: JSON.stringify({ tzOffsetMin: -new Date().getTimezoneOffset() }),
    }).catch(() => {})
    apiJsonWithTimeout('/api/profile', session, { timeoutMs: 45000 })
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

  // Nothing to preload any more: every effect and interface sound is
  // synthesised at the moment it plays (lib/audio/voices.js), so there
  // is no fetch and no decode to get ahead of. This used to warm the
  // click and the level-up chime, the two whose first play must not be
  // late — a few oscillator nodes are cheaper than either.
  //
  // The recorded sets — kana, announcements, ambiance — still decode
  // on demand; they are large, and none of them fires on the first
  // interaction.

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
            <Route path="/dev/sounds" element={<SoundPalette />} />
          </Routes>
        </BrowserRouter>
      </LangProvider>
    )
  }

  // The two waits below are the same screen (screens/AppLoading.jsx,
  // plan 067). Only the second asks for the "waking the server" line:
  // this one is Supabase reading its own storage, never a round trip.
  if (session === undefined) {
    return (
      <LangProvider>
        <AppLoading />
      </LangProvider>
    )
  }

  if (!session) {
    return (
      <LangProvider>
        {authMode
          ? <AuthScreen mode={authMode} onBack={() => setAuthMode(null)} />
          : <Welcome onBoard={board} boarding={boarding} onSignIn={() => setAuthMode('login')} />}
      </LangProvider>
    )
  }

  // Signed in, but the profile hasn't answered "onboarded?" yet — the
  // same wait as the session check above, for the same reason:
  // flashing the wrong screen for 200ms is worse than a beat of quiet.
  // This is the request a sleeping backend holds for 30–60 s, so the
  // screen says so after a few seconds (see the 45 s gate above).
  if (onboarding === undefined) {
    return (
      <LangProvider>
        <AppLoading wakesServer />
      </LangProvider>
    )
  }

  // 乗車 — the boarding, instead of the router: the same continuum
  // Welcome → Auth uses. No route, no station; see
  // screens/BoardingFlow.jsx for why. onComplete goes through
  // 'finishing' so the TicketGate below plays over the mounted router.
  if (onboarding === 'needed') {
    return (
      <LangProvider>
        <BoardingFlow
          session={session}
          initialProfile={onboardingProfile}
          guest={isGuest(session)}
          onComplete={() => setOnboarding('finishing')}
          onExit={() => leaveBoarding()}
          onSignIn={() => leaveBoarding('login')}
        />
      </LangProvider>
    )
  }

  return (
    <LangProvider>
      <BrowserRouter>
        <Routes>
          {/* 車内 — the shell (plan 068): the HUD, the screen, the five
              gates. One chrome at every width. */}
          <Route element={<Shell />}>
            {/* 本日の運行 — everything due, in one queue. See TodayScreen. */}
            <Route path="/today"                element={<TodayScreen session={session} />} />
            <Route path="/learn"                element={<LearnScreen session={session} />} />
            {/* The stations and the platforms (plan 071): a line's stops,
                then a stop's modes, under the chrome; the run itself is
                on the stage frame below. */}
            <Route path="/learn/kana"                 element={<KanaScreen />} />
            <Route path="/learn/kana/:set"            element={<KanaScreen />} />
            <Route path="/learn/vocab"                element={<VocabScreen session={session} />} />
            <Route path="/learn/vocab/tiers"          element={<VocabScreen session={session} />} />
            <Route path="/learn/vocab/themes"         element={<VocabScreen session={session} />} />
            <Route path="/learn/vocab/tier/:tier"     element={<VocabScreen session={session} />} />
            <Route path="/learn/vocab/theme/:theme"   element={<VocabScreen session={session} />} />
            <Route path="/learn/vocab/theme/:theme/level/:themeLevel" element={<VocabScreen session={session} />} />
            <Route path="/learn/vocab/:level"         element={<VocabScreen session={session} />} />
            <Route path="/learn/kanji"                element={<KanjiScreen session={session} />} />
            <Route path="/learn/kanji/tiers"          element={<KanjiScreen session={session} />} />
            <Route path="/learn/kanji/tier/:tier"     element={<KanjiScreen session={session} />} />
            <Route path="/learn/kanji/:level"         element={<KanjiScreen session={session} />} />
            <Route path="/learn/grammar"              element={<GrammarScreen />} />
            <Route path="/learn/grammar/:level"       element={<GrammarScreen />} />
            <Route path="/learn/decks"          element={<DecksScreen session={session} />} />
            <Route path="/learn/decks/:deck_id" element={<DeckDetailScreen session={session} />} />
            <Route path="/learn/decks/:deck_id/study" element={<StudyScreen session={session} />} />
            <Route path="/practice"             element={<PracticeScreen />} />
            {/* No /:sectionId segment: every generated paper has exactly
                one section (see each backend/study/exam_*_gen.py), so it
                was a parameter with one legal value and a picker screen
                that only ever offered one choice. */}
            <Route path="/practice/exam"        element={<ExamScreen session={session} />} />
            <Route path="/practice/exam/:examId/results" element={<ExamResult session={session} />} />
            {/* The three sentence sections are stations too: the
                source, the grade and the tier are chosen under the
                chrome, and only the session itself is on the stage
                frame below (screens/SentenceStation.jsx). */}
            {SENTENCE_SECTIONS.flatMap(({ base, levelsOnly = false }) =>
              (levelsOnly ? [base] : [base, `${base}/levels`, `${base}/tiers`]).map(path => (
                <Route
                  key={path}
                  path={path}
                  element={<SentenceStation session={session} base={base} levelsOnly={levelsOnly} />}
                />
              ))
            )}
            <Route path="/dictionary"           element={<DictionaryScreen session={session} />} />
            <Route path="/dictionary/analyzer"  element={<AnalyzerScreen session={session} />} />
            <Route path="/profile"              element={<ProfileScreen session={session} />} />
            <Route path="/profile/stats"        element={<StatsScreen session={session} />} />
            <Route path="/profile/settings"     element={<SettingsScreen session={session} />} />
            {/* The settings pages (plan 074): display, sound, learning,
                destination, data, account — each its own page under
                the list. */}
            <Route path="/profile/settings/:page" element={<SettingsScreen session={session} />} />
          </Route>

          {/* The stage: both bars leave, the rating bar or the field
              docks on the bottom edge, and the bar's ‹ is the way out.
              A run's set, level, tier, theme or deck and its mode are its
              path (plan 071); the stations and platforms before it sit
              under the shell above. */}
          <Route element={<StageFrame />}>
            <Route path="/today/run"                          element={<TodayRun session={session} />} />
            <Route path="/learn/kana/:set/:mode"              element={<KanaRun session={session} />} />
            <Route path="/learn/vocab/tier/:tier/:mode"       element={<VocabRun session={session} />} />
            {/* The literal `level/` segment keeps the four-segment band
                run from colliding with the three-segment legacy one
                below, which VocabRun redirects. */}
            <Route path="/learn/vocab/theme/:theme/level/:themeLevel/:mode" element={<VocabRun session={session} />} />
            <Route path="/learn/vocab/theme/:theme/:mode"     element={<VocabRun session={session} />} />
            <Route path="/learn/vocab/:level/:mode"           element={<VocabRun session={session} />} />
            <Route path="/learn/kanji/tier/:tier/:mode"       element={<KanjiRun session={session} />} />
            <Route path="/learn/kanji/:level/:mode"           element={<KanjiRun session={session} />} />
            <Route path="/learn/grammar/:level/:mode"         element={<GrammarRun session={session} />} />
            <Route path="/learn/decks/:deck_id/study/:mode"   element={<StudyRun session={session} />} />
            <Route path="/practice/reading/level/:level"     element={<ReadingRun session={session} />} />
            <Route path="/practice/reading/tier/:tier"       element={<ReadingRun session={session} />} />
            <Route path="/practice/reading/mastery"          element={<ReadingRun session={session} />} />
            <Route path="/practice/comprehension/:level"     element={<ComprehensionRun session={session} />} />
            <Route path="/practice/translation/level/:level" element={<TranslationRun session={session} />} />
            <Route path="/practice/translation/tier/:tier"   element={<TranslationRun session={session} />} />
            <Route path="/practice/translation/mastery"      element={<TranslationRun session={session} />} />
            <Route path="/practice/exam/:examId"      element={<ExamRunner session={session} />} />
          </Route>

          {/* The gate hall retired with the chrome; the front door is
              the run. */}
          <Route path="/" element={<Navigate to="/today" replace />} />
          {MOVED.map(([from, to]) => (
            <Route key={from} path={from} element={<Moved to={to} />} />
          ))}
          {import.meta.env.DEV && (
            <Route path="/dev/rewards" element={<RewardsPreview />} />
          )}
          {import.meta.env.DEV && (
            <Route path="/dev/sounds" element={<SoundPalette />} />
          )}
        </Routes>

        <DocumentHead />
        {/* 車両 — the shell's habits (plan 076): Android's back button
            and the daily nudge. Inside the router for the history and
            the profile; nothing on the web. */}
        <NativeBridge />

        {/* 掲示 — the docked notes (plan 065): a new build waiting, or
            no network. Beside <Routes/> for the same reason as the gate
            below: they must outlive the navigation that would unmount a
            screen. */}
        <UpdateToast />
        <OfflineNote />

        {/* 回数券 — the balance sheet off the HUD's pass, and the run-out
            sheet a 402 mid-run raises (plan 069). Beside <Routes/> like
            the notes: the first opens from outside every screen, the
            second is raised by a review the screen fired and forgot. */}
        <BalanceSheet />
        <RunOutSheet />
        {/* 運行状況 — the status sheet off the HUD's station panel
            (plan 074): the pass's back, the ghost train and the two
            honest moves. */}
        <StatusSheet session={session} />

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
            改札, played over the already-mounted router (the run is
            under the scrim from frame one) — rendered here and not by
            BoardingFlow, which has just unmounted and would take the
            cutscene down mid-wipe with it. onNavigate is a no-op
            because '/' (→ /today) is already where the router mounts.
            Under prefers-reduced-motion TicketGate fires both callbacks
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