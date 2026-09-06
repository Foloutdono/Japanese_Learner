import { useNavigate, useParams, useLocation, useSearchParams, Navigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { board } from '../stores/boarding'
import { Leave } from '../components/chrome/Bar'
import { Seg } from '../components/chrome/Console'
import SelectionScreen from '../components/selection/SelectionScreen'
import LevelSelector from '../components/selection/LevelSelector'
import TierSelector from '../components/selection/TierSelector'
import ThemeSelector from '../components/selection/ThemeSelector'
import ModeSelector from '../components/selection/ModeSelector'
import { MODES as STUDY_MODES, FAST_REVIEW, modePickerEntries } from '../domain/studyModes'
import { tierLabelFor } from '../domain/tiers'
import { themeLabelFor } from '../domain/themes'

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']

// ── 単語 — the station and the platforms (plan 071) ──────────
// /learn/vocab is the JLPT line as a route, with two other ways in on
// the bar: by frequency (/learn/vocab/tiers — the JLPT deck's own
// ranking, or every JMdict word beyond it with ?domain=jmdict) and by
// theme (/learn/vocab/themes). /learn/vocab/:level, /tier/:tier
// (?size=&domain=) and /theme/:theme list that stop's modes as
// platforms; picking one boards the train into the run on the stage
// frame (screens/VocabRun.jsx). The fast review exists on the JLPT
// path only. See KanaScreen.jsx for the deep-link shape the station
// still accepts.
export default function VocabScreen({ session }) {
  const { t } = useLang()
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const { level, tier, theme } = useParams()
  const [sp, setSp] = useSearchParams()

  const MODES = modePickerEntries(t, 'vocab')
  const validMode = m => m === FAST_REVIEW || STUDY_MODES[m]?.source === 'vocab'
  const tiersPage = pathname.endsWith('/tiers')
  const themesPage = pathname.endsWith('/themes')
  const tierSize = Number(sp.get('size')) || 200
  const jmdict = sp.get('domain') === 'jmdict'
  const freqDomain = jmdict ? 'vocab_jmdict' : 'vocab'

  const qLevel = sp.get('level')
  const qMode = sp.get('mode')
  const station = !level && !tier && !theme && !tiersPage && !themesPage
  if (station && qLevel && qMode && LEVELS.includes(qLevel) && validMode(qMode)) {
    return <Navigate replace to={`/learn/vocab/${qLevel}/${qMode}`} />
  }
  if (level && !LEVELS.includes(level)) return <Navigate replace to="/learn/vocab" />

  // ── The station: the JLPT line ──
  if (station) {
    return (
      <SelectionScreen
        title={t.vocabulary}
        sub={t.stationJlpt}
        aside={(
          <>
            <button type="button" className="bar__link" onClick={() => navigate('/learn/vocab/tiers')}>{t.byFrequencyShort}</button>
            <button type="button" className="bar__link" onClick={() => navigate('/learn/vocab/themes')}>{t.byThemeShort}</button>
          </>
        )}
      >
        <LevelSelector source="vocab" onSelect={lvl => navigate(`/learn/vocab/${lvl}`)} />
      </SelectionScreen>
    )
  }

  const jlptLink = <button type="button" className="bar__link" onClick={() => navigate('/learn/vocab')}>{t.jlptInstead}</button>

  // ── The tiers: by frequency, in either pool ──
  if (tiersPage) {
    const domainQuery = jmdict ? '&domain=jmdict' : ''
    return (
      <SelectionScreen title={t.vocabulary} sub={t.byFrequencyShort} aside={jlptLink}>
        <Seg
          full
          label={t.byFrequencyShort}
          value={jmdict ? 'jmdict' : 'vocab'}
          onChange={key => setSp(key === 'jmdict' ? { size: String(tierSize), domain: 'jmdict' } : { size: String(tierSize) }, { replace: true })}
          options={[
            { key: 'vocab', label: t.freqDomainDeck },
            { key: 'jmdict', label: t.freqDomainJmdict },
          ]}
        />
        <TierSelector
          domain={freqDomain}
          session={session}
          tierSize={tierSize}
          onTierSize={size => setSp(jmdict ? { size: String(size), domain: 'jmdict' } : { size: String(size) }, { replace: true })}
          onSelect={(tr, label, ts) => navigate(`/learn/vocab/tier/${tr}?size=${ts}${domainQuery}`)}
        />
      </SelectionScreen>
    )
  }

  // ── The themes ──
  if (themesPage) {
    return (
      <SelectionScreen title={t.vocabulary} sub={t.byThemeShort} aside={jlptLink}>
        <ThemeSelector session={session} onSelect={key => navigate(`/learn/vocab/theme/${key}`)} />
      </SelectionScreen>
    )
  }

  // ── The platforms: a stop's modes ──
  const sub = level ? `${level} · ${t[`levelHint${level}`] ?? ''}`
    : theme ? themeLabelFor(t, theme)
    : tierLabelFor(Number(tier), tierSize)
  const back = level ? '/learn/vocab'
    : theme ? '/learn/vocab/themes'
    : `/learn/vocab/tiers?size=${tierSize}${jmdict ? '&domain=jmdict' : ''}`
  const backLabel = level ? t.leaveLevels : theme ? t.leaveThemes : t.leaveTiers
  const modes = level ? MODES : MODES.filter(m => m.key !== FAST_REVIEW)
  const run = m => navigate(`${pathname}/${m}${search}`)
  return (
    <SelectionScreen
      title={t.vocabulary}
      sub={sub}
      aside={<Leave onClick={() => navigate(back)}>{backLabel}</Leave>}
    >
      <ModeSelector modes={modes} onSelect={m => (m === FAST_REVIEW ? run(m) : board(() => run(m)))} />
    </SelectionScreen>
  )
}
