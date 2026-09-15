import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams, Navigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { board } from '../stores/boarding'
import { Leave } from '../components/chrome/Bar'
import { playClick, playUi } from '../lib/audio'
import { apiJson } from '../lib/api'
import { ChevronIcon } from '../components/ui/Icons'
import SelectionScreen from '../components/selection/SelectionScreen'
import LevelSelector from '../components/selection/LevelSelector'
import ModeSelector from '../components/selection/ModeSelector'
import GrammarIndex from '../components/selection/GrammarIndex'
import { GrammarLessonSheet } from '../components/study/GrammarLesson'
import { MODES as STUDY_MODES, FAST_REVIEW, modePickerEntries } from '../domain/studyModes'

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']

// ── 文法 — the station and the platforms (plan 071, 087) ──────
// /learn/grammar is the JLPT line as a route; /learn/grammar/:level
// lists that level's modes as platforms. Picking a mode boards the
// train into /learn/grammar/:level/:mode on the stage frame
// (screens/GrammarRun.jsx). See KanaScreen.jsx for the deep-link
// shape the station still accepts.
//
// Plan 087 puts the level's points on the station: a door carrying
// learned over total (the radical lesson's own door) opens the index
// (?index=1, the same screen — a query rather than a path segment
// because /learn/grammar/:level/:mode is already the run), and any
// point, from the index or a deep link (?point=<card id>), opens its
// lesson as a sheet. A platform with nothing to serve at this level
// (the contrast drill, before the level's lessons are written) is not
// offered: the station reads /api/grammar/points' `totals`.
export default function GrammarScreen({ session }) {
  const { t, lang } = useLang()
  const navigate = useNavigate()
  const { level } = useParams()
  const [sp, setSp] = useSearchParams()
  const [index, setIndex] = useState(null)

  const MODES = modePickerEntries(t, 'grammar')
  const validMode = m => m === FAST_REVIEW || STUDY_MODES[m]?.source === 'grammar'

  const qLevel = sp.get('level')
  const qMode = sp.get('mode')
  const browsing = sp.get('index') === '1'
  const point = sp.get('point')

  useEffect(() => {
    if (!level || !LEVELS.includes(level)) return undefined
    let live = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- start-of-fetch reset that must land with the fetch it announces.
    setIndex(null)
    apiJson(`/api/grammar/points?level=${encodeURIComponent(level)}&lang=${lang}`, session)
      .then(data => { if (live) setIndex(data) })
      .catch(() => { if (live) setIndex({ points: [], learned: 0, started: 0, total: 0, totals: {} }) })
    return () => { live = false }
  }, [level, lang, session])

  if (!level && qLevel && qMode && LEVELS.includes(qLevel) && validMode(qMode)) {
    return <Navigate replace to={`/learn/grammar/${qLevel}/${qMode}`} />
  }
  if (level && !LEVELS.includes(level)) return <Navigate replace to="/learn/grammar" />

  if (!level) {
    // The line's catalogue is the dictionary's grammar collection
    // (DictionaryScreen, `?category=grammar`): one browse surface, not
    // a second list here. The door sits where a station's secondary
    // action sits, in the bar's own chrome — a Leave that goes
    // somewhere, so its chevron points the way rather than back.
    const browse = (
      <button
        type="button"
        className="stage__leave dict-browse-door"
        onClick={() => { playClick(); navigate('/dictionary?category=grammar&level=N5') }}
      >
        <span>{t.browseGrammarPoints}</span>
        <ChevronIcon direction="right" size={14} />
      </button>
    )
    return (
      <SelectionScreen title={t.grammarTitle} sub={t.stationJlpt} aside={browse}>
        <LevelSelector source="grammar" onSelect={lvl => navigate(`/learn/grammar/${lvl}`)} />
      </SelectionScreen>
    )
  }

  const run = m => navigate(`/learn/grammar/${level}/${m}`)
  // Both swaps land at the top: the index is a screen down the
  // platforms, and the way back should not drop the learner mid-list
  // (KanjiScreen's radical family does the same).
  const swap = params => { setSp(params); window.scrollTo(0, 0) }
  const openPoint = rawId => swap(browsing ? { index: '1', point: rawId } : { point: rawId })
  const closePoint = () => swap(browsing ? { index: '1' } : {})

  // The platforms this level can actually serve: a mode whose pool is
  // empty here is not offered rather than boarded into "done".
  const offered = MODES.filter(m => m.key === FAST_REVIEW || !index || (index.totals?.[m.key] ?? 1) > 0)
  const startedNote = index && index.started > 0 ? t.startedNote(index.started) : null

  const sheet = point && (
    <GrammarLessonSheet key={point} id={point} session={session} onClose={closePoint} />
  )

  if (browsing) {
    return (
      <SelectionScreen
        title={t.grammarTitle}
        sub={`${level} · ${t.glPoints}`}
        aside={<Leave onClick={() => swap({})}>{t.leaveLevels}</Leave>}
      >
        {index && <GrammarIndex points={index.points} onOpen={openPoint} />}
        {sheet}
      </SelectionScreen>
    )
  }

  return (
    <SelectionScreen
      title={t.grammarTitle}
      sub={`${level} · ${t[`levelHint${level}`] ?? ''}`}
      aside={<Leave onClick={() => navigate('/learn/grammar')}>{t.leaveLevels}</Leave>}
    >
      {/* The points as a record that opens: learned over total, and
          started while the two disagree — the radical lesson's door,
          above the platforms so the lesson is one tap from boarding. */}
      {index && index.total > 0 && (
        <button type="button" className="rad-door gl-points-door" onClick={() => { playUi('click-screen-selection'); swap({ index: '1' }) }}>
          <span className="rad-door__body">
            <span className="rad-door__head">
              <span className="rad-door__fig"><b>{index.learned}</b>/ {index.total}</span>
              {startedNote && <span className="rad-door__started">{startedNote}</span>}
            </span>
            <span className="rad-door__label">{t.glPoints}</span>
          </span>
          <ChevronIcon direction="right" size={16} className="rad-door__chev" />
        </button>
      )}
      <ModeSelector modes={offered} onSelect={m => (m === FAST_REVIEW ? run(m) : board(() => run(m)))} />
      {sheet}
    </SelectionScreen>
  )
}
