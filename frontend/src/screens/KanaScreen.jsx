import { useNavigate, useParams, useSearchParams, Navigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { board } from '../stores/boarding'
import { useStats } from '../stores/stats'
import { Leave } from '../components/chrome/Bar'
import SelectionScreen from '../components/selection/SelectionScreen'
import { RouteStops } from '../components/selection/RouteStops'
import ModeSelector from '../components/selection/ModeSelector'
import { MODES as STUDY_MODES, FAST_REVIEW, modePickerEntries } from '../domain/studyModes'
import { kanaSets, currentKanaSet } from '../domain/kanaSets'
import { deckItems } from '../domain/lineProgress'
import { useDesk } from '../hooks/useDesk'
import { StationSplit, KanaSetRedirect } from '../components/selection/StationSplit'
import { ModeFigures } from '../components/selection/ModeFigures'

// ── かな — the station and the platforms (plan 071) ──────────
// /learn/kana lists the sets as the stops of the kana line, with
// how much of each is learned and the one you are at ringed and
// captioned — the same route the JLPT lines draw, on the same rows
// (components/selection/RouteStops.jsx), only its "here" is read
// off the figures rather than off a declared level, because kana
// has none (domain/kanaSets.js); /learn/kana/:set lists that set's
// modes as platforms. Both under the chrome. Picking a mode boards
// the train (the door cutscene) into /learn/kana/:set/:mode on the
// stage frame (screens/KanaRun.jsx). The fast review is a browse, not
// a session — it does not board.
//
// `?set=&mode=` on the station is the shape the old deep links took
// (a bookmark, the stats screen before plan 071): a valid pair goes
// straight onto the run; anything else is simply the station.
export default function KanaScreen() {
  const { t } = useLang()
  const navigate = useNavigate()
  const { set } = useParams()
  const [sp] = useSearchParams()
  const stats = useStats().data
  const desk = useDesk()

  const SETS = kanaSets(t)
  const MODES = modePickerEntries(t, 'kana')
  const selectedSet = set ? SETS.find(s => s.slug === set) : null

  const qSet = sp.get('set')
  const qMode = sp.get('mode')
  const validMode = m => m === FAST_REVIEW || STUDY_MODES[m]?.source === 'kana'
  if (!set && qSet && qMode && SETS.some(s => s.slug === qSet) && validMode(qMode)) {
    return <Navigate replace to={`/learn/kana/${qSet}/${qMode}`} />
  }
  if (set && !selectedSet) return <Navigate replace to="/learn/kana" />

  // The sets as a route: the station page on a phone, and on the desk
  // the list beside a set's platforms (plan 113).
  const setStops = () => SETS.map(s => {
      const { learned, total, started } = deckItems(stats, 'kana', s.slug)
      return {
        key: s.slug,
        code: s.code,
        codeLang: 'ja',
        name: s.label,
        hereLabel: t.levelCurrentMark,
        learned,
        total,
        started,
        startedLabel: t.startedNote(started),
      }
    })
  const here = currentKanaSet(stats?.items?.kana)

  // ── The station: the sets ──
  if (!selectedSet) {
    return (
      <SelectionScreen
        title={t.kanaTitle}
        sub={t.stationSets}
        aside={<Leave to={'/learn'}>{t.tabLearn}</Leave>}
      >
        {/* On the desk the sets stand beside a set's platforms, so the
            list alone opens on the set the figures say they are on. */}
        {desk
          ? <KanaSetRedirect to={slug => `/learn/kana/${slug}`} />
          : <RouteStops stops={setStops()} here={here} onSelect={slug => navigate(`/learn/kana/${slug}`)} />}
      </SelectionScreen>
    )
  }

  // ── The platforms: the set's modes ──
  const run = m => navigate(`/learn/kana/${set}/${m}`)

  // ── 机 — the sets beside a set's platforms (plan 113) ──
  if (desk) {
    const figured = MODES.map(m => (m.key === FAST_REVIEW ? m : { ...m, aside: <ModeFigures source="kana" deck={set} mode={m.key} /> }))
    return (
      <SelectionScreen
        title={t.kanaTitle}
        sub={selectedSet.label}
        aside={<Leave to={'/learn'}>{t.tabLearn}</Leave>}
      >
        <StationSplit
          label={t.stationSets}
          list={<RouteStops stops={setStops()} here={here} selected={set} onSelect={slug => navigate(`/learn/kana/${slug}`, { replace: true })} />}
        >
          <ModeSelector modes={figured} onSelect={m => (m === FAST_REVIEW ? run(m) : board(() => run(m)))} />
        </StationSplit>
      </SelectionScreen>
    )
  }

  return (
    <SelectionScreen
      title={t.kanaTitle}
      sub={selectedSet.label}
      aside={<Leave to={'/learn/kana'}>{t.leaveSets}</Leave>}
    >
      <ModeSelector modes={MODES} onSelect={m => (m === FAST_REVIEW ? run(m) : board(() => run(m)))} />
    </SelectionScreen>
  )
}
