import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { supabase } from './supabase'

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

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = loading

  useEffect(() => {
    // Get current session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    // Listen for login/logout
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Still loading
  if (session === undefined) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text-secondary)' }}>Chargement...</div>
      </div>
    )
  }

  // Not logged in
  if (!session) {
    return <AuthScreen />
  }

  // Logged in
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"      element={<HomeScreen session={session} />} />
        <Route path="/kana"  element={<KanaScreen session={session} />} />
        <Route path="/vocab" element={<VocabScreen session={session} />} />
        <Route path="/kanji" element={<KanjiScreen session={session} />} />
        <Route path="/stats" element={<StatsScreen session={session} />} />
        <Route path="/dictionary" element={<DictionaryScreen session={session} />} />
        <Route path="/decks"                    element={<DecksScreen session={session} />} />
        <Route path="/decks/:deck_id"           element={<DeckDetailScreen session={session} />} />
        <Route path="/decks/:deck_id/study"     element={<StudyScreen session={session} />} />
      </Routes>
    </BrowserRouter>
  )
}