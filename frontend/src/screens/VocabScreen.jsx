import { useNavigate, useParams, useLocation, useSearchParams, Navigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { board } from '../stores/boarding'
import { Leave } from '../components/chrome/Bar'
import { Seg } from '../components/chrome/Console'
import SelectionScreen from '../components/selection/SelectionScreen'
import LevelSelector from '../components/selection/LevelSelector'
import TierSelector from '../components/selection/TierSelector'
import ThemeSelector from '../components/selection/ThemeSelector'
import ThemeLevelSelector from '../components/selection/ThemeLevelSelector'
import ModeSelector from '../components/selection/ModeSelector'
import { MODES as STUDY_MODES, FAST_REVIEW, modePickerEntries } from '../domain/studyModes'
import { tierLabelFor } from '../domain/tiers'
import { themeLabelFor, themeLevelLabel, isThemeLevel } from '../domain/themes'

const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']
const BASE = '/learn/vocab'

// ── 単語 — the station and the platforms (plan 071) ──────────
// /learn/vocab is the SOURCES: which ordering of the language you want
// to walk, one platform card each, the way the sentence sections ask
// the same question (screens/SentenceStation.jsx). Each source is a
// list of its own under it — /learn/vocab/levels is the JLPT line as a
// route, /learn/vocab/tiers is frequency (the JLPT deck's own ranking,
// or every JMdict word beyond it with ?domain=jmdict) and
// /learn/vocab/themes is by subject. /learn/vocab/:level and
// /tier/:tier (?size=&domain=) list that stop's modes as platforms; a
// theme has one stop more, because it is itself a little line —
// /theme/:theme is its four frequency bands (基本 → 達人) and
// /theme/:theme/level/:themeLevel is where the platforms are. Picking a
// platform boards the train into the run on the stage frame
// (screens/VocabRun.jsx). The fast review exists on the JLPT path only.
//
// The other two sources used to be `.bar__link`s in the bar's aside
// ("By frequency" · "By theme", and "JLPT instead" to come back): three
// whole orderings of the vocabulary, two of them set in eight-point
// capitals beside the title, on the one row of the screen a learner
// reads as chrome rather than as content — and the JLPT one not
// offered at all, only implied by being what you were already looking
// at. They are sources, so they are platform cards, like every other
// source in the app.
//
// See KanaScreen.jsx for the deep-link shape the station still accepts.
export default function VocabScreen({ session }) {
  const { t } = useLang()
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const { level, tier, theme, themeLevel } = useParams()
  const [sp, setSp] = useSearchParams()

  const MODES = modePickerEntries(t, 'vocab')
  const validMode = m => m === FAST_REVIEW || STUDY_MODES[m]?.source === 'vocab'
  // Which page of the station this is: the segment after the section,
  // with a trailing slash forgiven (a route matches with or without
  // one). Anchored to BASE rather than read off the end of the path,
  // so a theme whose own key happened to be `levels` could not be
  // mistaken for the list of them.
  const page = pathname.replace(/\/$/, '').slice(BASE.length + 1)
  const levelsPage = page === 'levels'
  const tiersPage = page === 'tiers'
  const themesPage = page === 'themes'
  const tierSize = Number(sp.get('size')) || 200
  const jmdict = sp.get('domain') === 'jmdict'
  const freqDomain = jmdict ? 'vocab_jmdict' : 'vocab'

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
      { key: 'levels', label: t.byLevel,     desc: t.byLevelDesc },
      { key: 'tiers',  label: t.byFrequency, desc: t.byFrequencyDesc },
      { key: 'themes', label: t.byTheme,     desc: t.byThemeDesc },
    ]
    return (
      <SelectionScreen
        title={t.vocabulary}
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
      <SelectionScreen title={t.vocabulary} sub={t.stationJlpt} aside={leaveSources}>
        <LevelSelector source="vocab" onSelect={lvl => navigate(`${BASE}/${lvl}`)} />
      </SelectionScreen>
    )
  }

  // ── The tiers: by frequency, in either pool ──
  if (tiersPage) {
    const domainQuery = jmdict ? '&domain=jmdict' : ''
    return (
      <SelectionScreen title={t.vocabulary} sub={t.byFrequencyShort} aside={leaveSources}>
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
          onSelect={(tr, label, ts) => navigate(`${BASE}/tier/${tr}?size=${ts}${domainQuery}`)}
        />
      </SelectionScreen>
    )
  }

  // ── The themes ──
  if (themesPage) {
    return (
      <SelectionScreen title={t.vocabulary} sub={t.byThemeShort} aside={leaveSources}>
        <ThemeSelector session={session} onSelect={key => navigate(`${BASE}/theme/${key}`)} />
      </SelectionScreen>
    )
  }

  // ── A theme's own line: its four frequency bands ──
  if (theme && !themeLevel) {
    return (
      <SelectionScreen
        title={t.vocabulary}
        sub={themeLabelFor(t, theme)}
        aside={<Leave onClick={() => navigate(`${BASE}/themes`)}>{t.leaveThemes}</Leave>}
      >
        <ThemeLevelSelector
          session={session}
          theme={theme}
          onSelect={lvl => navigate(`${BASE}/theme/${theme}/level/${lvl}`)}
        />
      </SelectionScreen>
    )
  }

  // A hand-typed or stale grade falls back to the line it belongs to
  // rather than to the sources, which would ask a question the learner
  // has already answered; a stale band likewise falls back to its
  // theme's own ladder rather than to a mode picker for a band that
  // does not exist.
  if (level && !LEVELS.includes(level)) return <Navigate replace to={`${BASE}/levels`} />
  if (themeLevel && !isThemeLevel(themeLevel)) return <Navigate replace to={`${BASE}/theme/${theme}`} />

  // ── The platforms: a stop's modes ──
  const sub = level ? `${level} · ${t[`levelHint${level}`] ?? ''}`
    : theme ? `${themeLabelFor(t, theme)} · ${themeLevelLabel(t, themeLevel)}`
    : tierLabelFor(Number(tier), tierSize)
  const back = level ? `${BASE}/levels`
    : theme ? `${BASE}/theme/${theme}`
    : `${BASE}/tiers?size=${tierSize}${jmdict ? '&domain=jmdict' : ''}`
  const backLabel = level ? t.leaveLevels : theme ? t.leaveThemeLevels : t.leaveTiers
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
