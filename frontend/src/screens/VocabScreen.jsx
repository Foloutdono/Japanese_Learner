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
import { tierLabelFor, tierAtSize } from '../domain/tiers'
import { THEME_LEVELS, themeLabelFor, themeLevelLabel, isThemeLevel } from '../domain/themes'
import { useDesk } from '../hooks/useDesk'
import { StationSplit, LevelRedirect } from '../components/selection/StationSplit'
import { ScopeFigures } from '../components/selection/ModeFigures'
import { LinePlatforms } from '../components/selection/LinePlatforms'
import VocabSources from '../components/selection/VocabSources'
import { useStationSamples } from '../stores/stationSamples'

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
  const desk = useDesk()
  const lineSamples = useStationSamples('vocab', desk && Boolean(level))

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

  const leaveSources = <Leave to={BASE}>{t.leaveSources}</Leave>

  // ── The sources ──
  if (page === '') {
    // A pre-071 deep link (?level=&mode=) names both the stop and the
    // platform, so it goes straight onto the run and never sees this.
    const qLevel = sp.get('level')
    const qMode = sp.get('mode')
    if (qLevel && qMode && LEVELS.includes(qLevel) && validMode(qMode)) {
      return <Navigate replace to={`${BASE}/${qLevel}/${qMode}`} />
    }
    // 机 (plan 136): the three sources as plates, each with its whole
    // list, so a stop of any of them is one click from its platforms.
    if (desk) {
      return (
        <SelectionScreen title={t.vocabulary} aside={<Leave to={'/learn'}>{t.tabLearn}</Leave>}>
          <VocabSources session={session} />
        </SelectionScreen>
      )
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
        aside={<Leave to={'/learn'}>{t.tabLearn}</Leave>}
      >
        <ModeSelector modes={SOURCES} onSelect={key => navigate(`${BASE}/${key}`)} />
      </SelectionScreen>
    )
  }

  // ── The JLPT line ──
  if (levelsPage) {
    return (
      <SelectionScreen title={t.vocabulary} sub={t.stationJlpt} aside={leaveSources}>
        {/* On the desk the line stands beside a stop's platforms, so
            the list alone opens on the learner's own stop (plan 114). */}
        {desk
          ? <LevelRedirect to={lvl => `${BASE}/${lvl}`} />
          : <LevelSelector source="vocab" onSelect={lvl => navigate(`${BASE}/${lvl}`)} />}
      </SelectionScreen>
    )
  }

  // ── The tiers: by frequency, in either pool ──
  if (tiersPage) {
    const domainQuery = jmdict ? '&domain=jmdict' : ''
    // On the desk the tiers stand beside a tier's platforms (below), so
    // the list alone opens on the first of them, as the JLPT line does.
    if (desk) return <Navigate replace to={`${BASE}/tier/1?size=${tierSize}${domainQuery}`} />
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
    // The desk draws the bands beside a band's platforms (below): the
    // line alone opens on its first band, the commonest words.
    if (desk) return <Navigate replace to={`${BASE}/theme/${theme}/level/${THEME_LEVELS[0]}`} />
    return (
      <SelectionScreen
        title={t.vocabulary}
        sub={themeLabelFor(t, theme)}
        aside={<Leave to={`${BASE}/themes`}>{t.leaveThemes}</Leave>}
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

  // ── 机 — the line beside its platforms (plans 114, 136) ──
  // On the desk a level's platforms stand beside the JLPT line itself
  // (StationSplit): another stop swaps the platforms in place. Both
  // columns take the window (plan 136, LinePlatforms): each stop with
  // its first words and its bar, each platform with the card it asks
  // and its figures, the fast review a door at the foot. The bar prints
  // no sub: the open stop names the level. The way out is the sources.
  if (desk && level) {
    return (
      <SelectionScreen title={t.vocabulary} aside={leaveSources}>
        <StationSplit
          className="desk-split--line"
          label={t.stationJlpt}
          list={<LevelSelector source="vocab" selected={level} linkTo={lvl => `${BASE}/${lvl}`} figured />}
        >
          <LinePlatforms
            source="vocab"
            deck={level}
            card={lineSamples?.[level]?.card}
            modes={modes}
            onSelect={m => (m === FAST_REVIEW ? run(m) : board(() => run(m)))}
          />
        </StationSplit>
      </SelectionScreen>
    )
  }

  // ── 机 — a theme's bands beside a band's platforms (plan 115) ──
  // The same split as the JLPT line's, for the line a theme is: another
  // band swaps the platforms in place, and each platform carries the
  // band's own figures, from the stats route its run opens on. The way
  // out is the themes, the one screen left between here and the sources.
  if (desk && theme) {
    const figured = modes.map(m => ({
      ...m,
      aside: <ScopeFigures session={session} url={`/api/vocab/theme/${theme}/stats?level=${themeLevel}&mode=${m.key}`} />,
    }))
    return (
      <SelectionScreen title={t.vocabulary} sub={sub} aside={<Leave to={`${BASE}/themes`}>{t.leaveThemes}</Leave>}>
        <StationSplit
          label={themeLabelFor(t, theme)}
          list={<ThemeLevelSelector session={session} theme={theme} selected={themeLevel} linkTo={lvl => `${BASE}/theme/${theme}/level/${lvl}`} />}
        >
          <ModeSelector modes={figured} onSelect={m => (m === FAST_REVIEW ? run(m) : board(() => run(m)))} />
        </StationSplit>
      </SelectionScreen>
    )
  }

  // ── 机 — the tiers beside a tier's platforms (plan 115) ──
  // The pool and the size stand over the list they change. Another
  // pool is another line, so it opens on its first tier; another size
  // keeps the learner's place (domain/tiers' tierAtSize).
  if (desk && tier) {
    const open = Number(tier)
    const at = (n, size = tierSize, pool = jmdict) => `${BASE}/tier/${n}?size=${size}${pool ? '&domain=jmdict' : ''}`
    const figured = modes.map(m => ({
      ...m,
      aside: <ScopeFigures session={session} url={`/api/frequency/${freqDomain}/stats?tier=${open}&tier_size=${tierSize}&mode=${m.key}`} />,
    }))
    return (
      <SelectionScreen title={t.vocabulary} sub={sub} aside={leaveSources}>
        <StationSplit
          label={t.byFrequencyShort}
          list={(
            <>
              <Seg
                full
                label={t.byFrequencyShort}
                value={jmdict ? 'jmdict' : 'vocab'}
                onChange={key => navigate(at(1, tierSize, key === 'jmdict'), { replace: true })}
                options={[
                  { key: 'vocab', label: t.freqDomainDeck },
                  { key: 'jmdict', label: t.freqDomainJmdict },
                ]}
              />
              <TierSelector
                domain={freqDomain}
                session={session}
                tierSize={tierSize}
                selected={open}
                onTierSize={size => navigate(at(tierAtSize(open, tierSize, size), size), { replace: true })}
                linkTo={n => at(n)}
              />
            </>
          )}
        >
          <ModeSelector modes={figured} onSelect={m => (m === FAST_REVIEW ? run(m) : board(() => run(m)))} />
        </StationSplit>
      </SelectionScreen>
    )
  }

  return (
    <SelectionScreen
      title={t.vocabulary}
      sub={sub}
      aside={<Leave to={back}>{backLabel}</Leave>}
    >
      <ModeSelector modes={modes} onSelect={m => (m === FAST_REVIEW ? run(m) : board(() => run(m)))} />
    </SelectionScreen>
  )
}
