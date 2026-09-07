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

// ── 漢字 — the station and the platforms (plan 071) ──────────
// /learn/kanji is the JLPT line as a route, with "By frequency" as
// the other way in (/learn/kanji/tiers: the tier size, then the tiers
// as platform cards). /learn/kanji/:level and /learn/kanji/tier/:tier
// (?size=) list that stop's modes as platforms; picking one boards the
// train into the run on the stage frame (screens/KanjiRun.jsx). The
// fast review exists on the JLPT path only — there is no tier-scoped
// review-cards endpoint — so the tier platforms drop it. See
// KanaScreen.jsx for the deep-link shape the station still accepts.
export default function KanjiScreen({ session }) {
  const { t } = useLang()
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const { level, tier } = useParams()
  const [sp, setSp] = useSearchParams()

  const MODES = modePickerEntries(t, 'kanji')
  const validMode = m => m === FAST_REVIEW || STUDY_MODES[m]?.source === 'kanji'
  const tiersPage = pathname.endsWith('/tiers')
  const tierSize = Number(sp.get('size')) || 200

  const qLevel = sp.get('level')
  const qMode = sp.get('mode')
  if (!level && !tier && !tiersPage && qLevel && qMode && LEVELS.includes(qLevel) && validMode(qMode)) {
    return <Navigate replace to={`/learn/kanji/${qLevel}/${qMode}`} />
  }
  if (level && !LEVELS.includes(level)) return <Navigate replace to="/learn/kanji" />

  // ── The station: the JLPT line ──
  if (!level && !tier && !tiersPage) {
    return (
      <SelectionScreen
        title={t.kanjiTitle}
        sub={t.stationJlpt}
        aside={<button type="button" className="bar__link" onClick={() => navigate('/learn/kanji/tiers')}>{t.byFrequencyShort}</button>}
      >
        <LevelSelector source="kanji" onSelect={lvl => navigate(`/learn/kanji/${lvl}`)} />
      </SelectionScreen>
    )
  }

  // ── The tiers: by frequency ──
  if (tiersPage) {
    return (
      <SelectionScreen
        title={t.kanjiTitle}
        sub={t.byFrequencyShort}
        aside={<button type="button" className="bar__link" onClick={() => navigate('/learn/kanji')}>{t.jlptInstead}</button>}
      >
        <TierSelector
          domain="kanji"
          session={session}
          tierSize={tierSize}
          onTierSize={size => setSp({ size: String(size) }, { replace: true })}
          onSelect={(tr, label, ts) => navigate(`/learn/kanji/tier/${tr}?size=${ts}`)}
        />
      </SelectionScreen>
    )
  }

  // ── The platforms: a stop's modes ──
  const byLevel = Boolean(level)
  const sub = byLevel ? `${level} · ${t[`levelHint${level}`] ?? ''}` : tierLabelFor(Number(tier), tierSize)
  const back = byLevel ? '/learn/kanji' : `/learn/kanji/tiers?size=${tierSize}`
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
