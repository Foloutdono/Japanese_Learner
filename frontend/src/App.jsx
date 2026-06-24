import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { LangProvider } from './LangContext'

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

export default function App() {
  const [session, setSession] = useState(undefined)

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
        <AuthScreen />
      </LangProvider>
    )
  }

  return (
    <LangProvider>
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
        </Routes>
      </BrowserRouter>
    </LangProvider>
  )
}