import { BrowserRouter, Routes, Route } from 'react-router-dom'
import HomeScreen   from './screens/HomeScreen'
import KanaScreen   from './screens/KanaScreen'
import VocabScreen  from './screens/VocabScreen'
import KanjiScreen  from './screens/KanjiScreen'
import StatsScreen  from './screens/StatsScreen'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"      element={<HomeScreen />} />
        <Route path="/kana"  element={<KanaScreen />} />
        <Route path="/vocab" element={<VocabScreen />} />
        <Route path="/kanji" element={<KanjiScreen />} />
        <Route path="/stats" element={<StatsScreen />} />
      </Routes>
    </BrowserRouter>
  )
}