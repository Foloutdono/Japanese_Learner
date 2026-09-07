import { useNavigate, useParams, useSearchParams, Navigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { board } from '../stores/boarding'
import { Leave } from '../components/chrome/Bar'
import SelectionScreen from '../components/selection/SelectionScreen'
import LevelSelector from '../components/selection/LevelSelector'
import ModeSelector from '../components/selection/ModeSelector'
import { MODES as STUDY_MODES, FAST_REVIEW, modePickerEntries } from '../domain/studyModes'

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']

// ── 文法 — the station and the platforms (plan 071) ──────────
// /learn/grammar is the JLPT line as a route; /learn/grammar/:level
// lists that level's modes as platforms. Picking a mode boards the
// train into /learn/grammar/:level/:mode on the stage frame
// (screens/GrammarRun.jsx). See KanaScreen.jsx for the deep-link
// shape the station still accepts.
export default function GrammarScreen() {
  const { t } = useLang()
  const navigate = useNavigate()
  const { level } = useParams()
  const [sp] = useSearchParams()

  const MODES = modePickerEntries(t, 'grammar')
  const validMode = m => m === FAST_REVIEW || STUDY_MODES[m]?.source === 'grammar'

  const qLevel = sp.get('level')
  const qMode = sp.get('mode')
  if (!level && qLevel && qMode && LEVELS.includes(qLevel) && validMode(qMode)) {
    return <Navigate replace to={`/learn/grammar/${qLevel}/${qMode}`} />
  }
  if (level && !LEVELS.includes(level)) return <Navigate replace to="/learn/grammar" />

  if (!level) {
    return (
      <SelectionScreen title={t.grammarTitle} sub={t.stationJlpt}>
        <LevelSelector source="grammar" onSelect={lvl => navigate(`/learn/grammar/${lvl}`)} />
      </SelectionScreen>
    )
  }

  const run = m => navigate(`/learn/grammar/${level}/${m}`)
  return (
    <SelectionScreen
      title={t.grammarTitle}
      sub={`${level} · ${t[`levelHint${level}`] ?? ''}`}
      aside={<Leave onClick={() => navigate('/learn/grammar')}>{t.leaveLevels}</Leave>}
    >
      <ModeSelector modes={MODES} onSelect={m => (m === FAST_REVIEW ? run(m) : board(() => run(m)))} />
    </SelectionScreen>
  )
}
