import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams, Navigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { board } from '../stores/boarding'
import { Leave } from '../components/chrome/Bar'
import { playUi } from '../lib/audio'
import { apiJson } from '../lib/api'
import { ChevronIcon } from '../components/ui/Icons'
import SelectionScreen from '../components/selection/SelectionScreen'
import LevelSelector from '../components/selection/LevelSelector'
import ModeSelector from '../components/selection/ModeSelector'
import GrammarIndex from '../components/selection/GrammarIndex'
import { GrammarLessonSheet, GrammarLessonBody } from '../components/study/GrammarLesson'
import { Loading } from '../components/ui/Loading'
import { dialogOpen } from '../lib/dialogOpen'
import { MODES as STUDY_MODES, FAST_REVIEW, modePickerEntries } from '../domain/studyModes'
import { useDesk } from '../hooks/useDesk'
import { StationSplit, LevelRedirect } from '../components/selection/StationSplit'
import { LinePlatforms } from '../components/selection/LinePlatforms'
import { useStationSamples } from '../stores/stationSamples'

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
  const desk = useDesk()
  const samples = useStationSamples('grammar', desk && Boolean(level))

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
    // The station's own way out, where every other line's first page
    // puts it (VocabScreen, KanjiScreen): ‹ Learn, back to the gate.
    // The line's catalogue is reached from a level — the points door
    // below the platforms — rather than from the bar here.
    return (
      <SelectionScreen
        title={t.grammarTitle}
        sub={t.stationJlpt}
        aside={<Leave to={'/learn'}>{t.tabLearn}</Leave>}
      >
        {/* On the desk the line stands beside a level's platforms, so
            the list alone opens on the learner's own level (plan 114). */}
        {desk
          ? <LevelRedirect to={lvl => `/learn/grammar/${lvl}`} />
          : <LevelSelector source="grammar" onSelect={lvl => navigate(`/learn/grammar/${lvl}`)} />}
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

  // ── 机 — the line beside a level (plan 114) ──
  // On the desk the JLPT line stands beside the level's page — its
  // points door and platforms — and another level swaps the page in
  // place. Each platform carries its figures.
  //
  // The points (plan 115) are the index beside the open point's lesson:
  // one click or ←/→ per point, where the phone opens each in a sheet
  // over the index. The bare index opens on the first point not yet
  // mastered; a point asked for from the level page opens the same way.
  // Each row is a link to its point (plan 117), so one also opens in a
  // tab of its own.
  if (desk && (browsing || point) && (!index || index.points?.length)) {
    if (!index) return <SelectionScreen title={t.grammarTitle} sub={`${level} · ${t.glPoints}`}><Loading /></SelectionScreen>
    const points = index.points
    const open = points.find(p => p.raw_id === point)
    const pointAt = rawId => `/learn/grammar/${level}?index=1&point=${encodeURIComponent(rawId)}`
    if (!browsing || !open) {
      return <Navigate replace to={pointAt(open ? point : (points.find(p => p.stage !== 'mastered') ?? points[0]).raw_id)} />
    }
    const walk = rawId => setSp({ index: '1', point: rawId }, { replace: true })
    return (
      <SelectionScreen
        title={t.grammarTitle}
        sub={`${level} · ${t.glPoints}`}
        aside={<Leave onClick={() => swap({})}>{level}</Leave>}
      >
        <StationSplit label={t.glPoints} list={<GrammarIndex points={points} selected={point} linkTo={pointAt} />}>
          {open && (
            <div className="desk-lesson">
              <GrammarLessonBody key={point} id={point} session={session} />
            </div>
          )}
        </StationSplit>
        <PointKeys points={points} point={point} onWalk={walk} />
      </SelectionScreen>
    )
  }

  // Both columns take the window (plan 137, LinePlatforms): each level
  // with its first points and its bar, each platform with the card it
  // asks, and the points' door at the foot beside the fast review —
  // both open something rather than board. The bar prints no sub: the
  // open stop names the level.
  if (desk) {
    return (
      <SelectionScreen
        title={t.grammarTitle}
        aside={<Leave to={'/learn'}>{t.tabLearn}</Leave>}
      >
        <StationSplit
          className="desk-split--line"
          label={t.stationJlpt}
          list={<LevelSelector source="grammar" selected={level} linkTo={lvl => `/learn/grammar/${lvl}`} figured />}
        >
          <LinePlatforms
            source="grammar"
            deck={level}
            card={samples?.[level]?.card}
            modes={offered}
            onSelect={m => (m === FAST_REVIEW ? run(m) : board(() => run(m)))}
            door={index && index.total > 0 && (
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
          />
        </StationSplit>
      </SelectionScreen>
    )
  }

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
      aside={<Leave to={'/learn/grammar'}>{t.leaveLevels}</Leave>}
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

// ←/→ walk the level's points on the desk, the lesson following — the
// dictionary's walk (screens/DictionaryScreen.jsx) for the grammar
// index. Not while typing or under a dialog. Renders nothing.
//
// Another point also takes the page back to its top, for the lesson it
// now shows. On the change of point rather than in a click handler
// (plan 117): the rows are links, and a Ctrl/⌘-click that opens a point
// in another tab changes nothing here, so it must not scroll this page.
function PointKeys({ points, point, onWalk }) {
  useEffect(() => {
    const onKey = e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      if (e.metaKey || e.ctrlKey || e.altKey || dialogOpen()) return
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName) || e.target?.isContentEditable) return
      const at = points.findIndex(p => p.raw_id === point)
      const next = points[Math.min(points.length - 1, Math.max(0, at + (e.key === 'ArrowRight' ? 1 : -1)))]
      if (!next || next.raw_id === point) return
      e.preventDefault()
      onWalk(next.raw_id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [points, point, onWalk])
  const shown = useRef(point)
  useEffect(() => {
    if (shown.current !== point) {
      shown.current = point
      window.scrollTo(0, 0)
    }
    // The open row kept in view in the list's own scroll.
    document.querySelector('.gl-index__row[aria-current="page"]')?.scrollIntoView?.({ block: 'nearest' })
  }, [point])
  return null
}
