import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { LangProvider } from './LangContext'

import LandingScreen from './screens/LandingScreen'
import AuthScreen  from './screens/AuthScreen'
import HomeScreen  from './screens/HomeScreen'
import KanaScreen  from './screens/KanaScreen'
import VocabScreen from './screens/VocabScreen'
import KanjiScreen from './screens/KanjiScreen'
import StatsScreen from './screens/StatsScreen'
import DictionaryScreen from './screens/DictionaryScreen'
import DecksScreen      from './screens/DecksScreen'
import DeckDetailScreen from './screens/DeckDetailScreen'
import StudyScreen      from './screens/StudyScreen'
import GrammarScreen from './screens/GrammarScreen'
import PhraseAnalyzerScreen from './screens/PhraseAnalyzerScreen'
import ReadingScreen from './screens/ReadingScreen'
import ReadingComprehensionScreen from './screens/ReadingComprehensionScreen'
import ProfileScreen from './screens/ProfileScreen'
import SettingsScreen from './screens/SettingsScreen'
import ExamListScreen from './screens/ExamListScreen'
import ExamSectionSelect from './screens/ExamSectionSelect'
import ExamRunner from './screens/ExamRunner'
import ExamResult from './screens/ExamResult'
import TranslationScreen from './screens/TranslationScreen'
import DarumaScreen from './screens/DarumaScreen'
import StorehouseScreen from './screens/StorehouseScreen'
import { CosmeticTheme } from './stores/cosmetics'
import { preload } from './lib/audio'

export default function App() {
  const [session, setSession] = useState(undefined)
  const [showLanding, setShowLanding] = useState(true)

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
          <Route path="/kana"                 element={<KanaScreen session={session} />} />
          <Route path="/vocab"                element={<VocabScreen session={session} />} />
          <Route path="/kanji"                element={<KanjiScreen session={session} />} />
          <Route path="/stats"                element={<StatsScreen session={session} />} />
          <Route path="/dictionary"           element={<DictionaryScreen session={session} />} />
          <Route path="/decks"                element={<DecksScreen session={session} />} />
          <Route path="/decks/:deck_id"       element={<DeckDetailScreen session={session} />} />
          <Route path="/decks/:deck_id/study" element={<StudyScreen session={session} />} />
          <Route path="/grammar"              element={<GrammarScreen session={session} />} />
          <Route path="/phrase-analyzer"      element={<PhraseAnalyzerScreen session={session} />} />
          <Route path="/reading"              element={<ReadingScreen session={session} />} />
          <Route path="/reading-comprehension" element={<ReadingComprehensionScreen session={session} />} />
          <Route path="/profile" element={<ProfileScreen session={session} />} />
          <Route path="/settings" element={<SettingsScreen session={session} />} />
          <Route path="/exam" element={<ExamListScreen session={session} />} />
          <Route path="/exam/:examId" element={<ExamSectionSelect session={session} />} />
          <Route path="/exam/:examId/:sectionId" element={<ExamRunner session={session} />} />
          <Route path="/exam/:examId/:sectionId/results" element={<ExamResult session={session} />} />
          <Route path="/translation" element={<TranslationScreen session={session} />} />
          <Route path="/daruma" element={<DarumaScreen session={session} />} />
          <Route path="/storehouse" element={<StorehouseScreen session={session} />} />
        </Routes>
      </BrowserRouter>
    </LangProvider>
  )
}