import { useNavigate, useParams, useLocation, useSearchParams, Navigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { board } from '../stores/boarding'
import { Leave } from '../components/chrome/Bar'
import SelectionScreen from '../components/selection/SelectionScreen'
import LevelSelector from '../components/selection/LevelSelector'
import TierSelector from '../components/selection/TierSelector'
import ModeSelector from '../components/selection/ModeSelector'
import { MODES as STUDY_MODES, FAST_REVIEW, modePickerEntries } from '../domain/studyModes'
import { tierLabelFor } from '../domain/tiers'

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']
const BASE = '/learn/kanji'

// ── 漢字 — the station and the platforms (plan 071) ──────────
// /learn/kanji is the SOURCES: which axis the characters are ordered
// along, one platform card each, the way the sentence sections ask the
// same question (screens/SentenceStation.jsx). Each source is a list
// of its own under it — /learn/kanji/levels is the JLPT line as a
// route, /learn/kanji/tiers is the tier size and the tiers as platform
// cards. /learn/kanji/:level and /learn/kanji/tier/:tier (?size=) list
// that stop's modes as platforms; picking one boards the train into the
// run on the stage frame (screens/KanjiRun.jsx). The fast review exists
// on the JLPT path only — there is no tier-scoped review-cards endpoint
// — so the tier platforms drop it.
//
// The second source used to be a `.bar__link` in the bar's aside ("By
// frequency", and "JLPT instead" to come back), which put the choice
// between two whole rankings of the language in eight-point capitals
// beside the title, on the one row of the screen a learner reads as
// chrome rather than as content. It is a source, so it is a platform
// card like every other source in the app.
//
// See KanaScreen.jsx for the deep-link shape the station still accepts.
export default function KanjiScreen({ session }) {
  const { t } = useLang()
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const { level, tier } = useParams()
  const [sp, setSp] = useSearchParams()

  const MODES = modePickerEntries(t, 'kanji')
  const validMode = m => m === FAST_REVIEW || STUDY_MODES[m]?.source === 'kanji'
  // Which page of the station this is: the segment after the section,
  // with a trailing slash forgiven (a route matches with or without
  // one). Anchored to BASE rather than read off the end of the path,
  // so a stop whose own key happened to be `levels` could not be
  // mistaken for the list of them.
  const page = pathname.replace(/\/$/, '').slice(BASE.length + 1)
  const levelsPage = page === 'levels'
  const tiersPage = page === 'tiers'
  const tierSize = Number(sp.get('size')) || 200

  const leaveSources = <Leave onClick={() => navigate(BASE)}>{t.leaveSources}</Leave>

  // ── The sources ──
  if (page === '') {
    // A pre-071 deep link (?level=&mode=) names both the stop and the
    // platform, so it goes straight onto the run and never sees this.
    const qLevel = sp.get('level')
    const qMode = sp.get('mode')
    if (qLevel && qMode && LEVELS.includes(qLevel) && validMode(qMode)) {
      return <Navigate replace to={`${BASE}/${qLevel}/${qMode}`} />
    }
    const SOURCES = [
      { key: 'levels', label: t.byLevel,          desc: t.byLevelDesc },
      { key: 'tiers',  label: t.byFrequencyKanji, desc: t.byFrequencyKanjiDesc },
    ]
    return (
      <SelectionScreen
        title={t.kanjiTitle}
        sub={t.stationSources}
        aside={<Leave onClick={() => navigate('/learn')}>{t.tabLearn}</Leave>}
      >
        <ModeSelector modes={SOURCES} onSelect={key => navigate(`${BASE}/${key}`)} />
      </SelectionScreen>
    )
  }

  // ── The JLPT line ──
  if (levelsPage) {
    return (
      <SelectionScreen title={t.kanjiTitle} sub={t.stationJlpt} aside={leaveSources}>
        <LevelSelector source="kanji" onSelect={lvl => navigate(`${BASE}/${lvl}`)} />
      </SelectionScreen>
    )
  }

  // ── The tiers: by frequency ──
  if (tiersPage) {
    return (
      <SelectionScreen title={t.kanjiTitle} sub={t.byFrequencyShort} aside={leaveSources}>
        <TierSelector
          domain="kanji"
          session={session}
          tierSize={tierSize}
          onTierSize={size => setSp({ size: String(size) }, { replace: true })}
          onSelect={(tr, label, ts) => navigate(`${BASE}/tier/${tr}?size=${ts}`)}
        />
      </SelectionScreen>
    )
  }

  // A hand-typed or stale grade falls back to the line it belongs to
  // rather than to the sources, which would ask a question the learner
  // has already answered.
  if (level && !LEVELS.includes(level)) return <Navigate replace to={`${BASE}/levels`} />

  // ── The platforms: a stop's modes ──
  const byLevel = Boolean(level)
  const sub = byLevel ? `${level} · ${t[`levelHint${level}`] ?? ''}` : tierLabelFor(Number(tier), tierSize)
  const back = byLevel ? `${BASE}/levels` : `${BASE}/tiers?size=${tierSize}`
  const modes = byLevel ? MODES : MODES.filter(m => m.key !== FAST_REVIEW)
  const run = m => navigate(`${pathname}/${m}${search}`)
  return (
    <SelectionScreen
      title={t.kanjiTitle}
      sub={sub}
      aside={<Leave onClick={() => navigate(back)}>{byLevel ? t.leaveLevels : t.leaveTiers}</Leave>}
    >
      <ModeSelector modes={modes} onSelect={m => (m === FAST_REVIEW ? run(m) : board(() => run(m)))} />
    </SelectionScreen>
  )
}
