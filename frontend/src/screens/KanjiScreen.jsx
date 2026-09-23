import { useState } from 'react'
import { useNavigate, useParams, useLocation, useSearchParams, Navigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { board } from '../stores/boarding'
import { Leave } from '../components/chrome/Bar'
import SelectionScreen from '../components/selection/SelectionScreen'
import LevelSelector from '../components/selection/LevelSelector'
import { useDesk } from '../hooks/useDesk'
import { StationSplit, LevelRedirect } from '../components/selection/StationSplit'
import { ModeFigures, ScopeFigures } from '../components/selection/ModeFigures'
import TierSelector from '../components/selection/TierSelector'
import ModeSelector from '../components/selection/ModeSelector'
import RadicalSelector, { RadicalRedirect } from '../components/selection/RadicalSelector'
import RadicalLesson, { RadicalFamilyList } from '../components/selection/RadicalLesson'
import { MODES as STUDY_MODES, FAST_REVIEW, modePickerEntries } from '../domain/studyModes'
import { tierLabelFor, tierAtSize } from '../domain/tiers'

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
// The third source (plan 086) is 部首: /learn/kanji/radicals is the
// index — the dictionary's own, dressed with the course's counts and
// the learner's figures (RadicalSelector) — and /learn/kanji/radical/:n
// is a LESSON before it is a list of platforms: the radical taught
// (RadicalLesson), the platforms under it, and its family behind a
// door on the plate (?family=1, the same screen). The run under it is
// the same KanjiRun over that family alone; the radical drill is not
// offered there, since every answer would be the one radical the
// learner just read about.
//
// See KanaScreen.jsx for the deep-link shape the station still accepts.
export default function KanjiScreen({ session }) {
  const { t } = useLang()
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const { level, tier, radical } = useParams()
  const [sp, setSp] = useSearchParams()
  const desk = useDesk()
  // The lesson reports its radical up, so the bar can name it.
  const [lesson, setLesson] = useState(null)

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
  const radicalsPage = page === 'radicals'
  const tierSize = Number(sp.get('size')) || 200
  const strokePage = Number(sp.get('stroke')) || null
  // A radical's family, browsed: the same screen with the lesson's
  // door pushed. A query rather than a path segment because
  // /learn/kanji/radical/:radical/:mode is already the RUN, and
  // because the lesson stays mounted across it — the door costs no
  // second fetch, and the back button (Android's included) undoes it.
  const browsing = sp.get('family') === '1'

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
    const SOURCES = [
      { key: 'levels', label: t.byLevel,          desc: t.byLevelDesc },
      { key: 'tiers',  label: t.byFrequencyKanji, desc: t.byFrequencyKanjiDesc },
      { key: 'radicals', label: t.byRadical,      desc: t.byRadicalDesc },
    ]
    return (
      <SelectionScreen
        title={t.kanjiTitle}
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
      <SelectionScreen title={t.kanjiTitle} sub={t.stationJlpt} aside={leaveSources}>
        {/* On the desk the line stands beside a stop's platforms, so
            the list alone opens on the learner's own stop (plan 114). */}
        {desk
          ? <LevelRedirect to={lvl => `${BASE}/${lvl}`} />
          : <LevelSelector source="kanji" onSelect={lvl => navigate(`${BASE}/${lvl}`)} />}
      </SelectionScreen>
    )
  }

  // ── The tiers: by frequency ──
  if (tiersPage) {
    // See VocabScreen: on the desk the list opens on its first tier.
    if (desk) return <Navigate replace to={`${BASE}/tier/1?size=${tierSize}`} />
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

  // ── The radicals: the index ──
  if (radicalsPage) {
    // On the desk the index stands beside every radical's page, so the
    // bare index opens on its page's first radical (plan 115).
    if (desk) {
      return (
        <SelectionScreen title={t.kanjiTitle} sub={t.byRadicalShort} aside={leaveSources}>
          <RadicalRedirect session={session} stroke={strokePage} to={n => `${BASE}/radical/${n}`} />
        </SelectionScreen>
      )
    }
    return (
      <SelectionScreen title={t.kanjiTitle} sub={t.byRadicalShort} aside={leaveSources}>
        <RadicalSelector
          session={session}
          stroke={strokePage}
          onStroke={n => setSp({ stroke: String(n) }, { replace: true })}
          onSelect={n => navigate(`${BASE}/radical/${n}`)}
        />
      </SelectionScreen>
    )
  }

  // ── A radical: the lesson, then its platforms ──
  if (radical) {
    const number = Number(radical)
    const index = `${BASE}/radicals`
    if (!Number.isInteger(number) || number < 1) return <Navigate replace to={index} />
    // Every drill but the radical one: with one family on the stage,
    // "which radical?" has one answer, and the learner has just read it.
    const modes = MODES.filter(m => STUDY_MODES[m.key]?.base !== 'radical')
    // The lesson's glyph rides into the run's own bar as ?g=, so the
    // stage can say 部首 水 without a second fetch. A glyph, never
    // anything the learner typed (lib/routePattern.js drops the query
    // before anything is recorded).
    const run = m => navigate(`${pathname}/${m}?g=${encodeURIComponent(lesson?.glyph ?? '')}`)
    const here = lesson && lesson.number === number ? lesson : null
    const sub = here ? `${t.byRadicalShort} · ${here.glyph} ${here.meaning}` : t.byRadicalShort
    // Back to the page of the index this radical is on, not to its
    // first page: the index carries the page in its URL for this.
    const leave = here ? `${index}?stroke=${here.stroke_count}` : index
    // One step out at a time: the family leaves to its lesson, the
    // lesson to the index. Both swaps land at the top: the document is
    // the scroller (.phone is min-height, not a viewport of its own),
    // and a path that does not change carries its scroll offset across
    // a body that changes completely — the door is a screen down the
    // plate, so the family opened already scrolled past its first
    // level, and the way back dropped the lesson somewhere in its
    // platforms.
    const swap = params => { setSp(params); window.scrollTo(0, 0) }

    // ── 机 — a radical's page as two panes (plan 115) ──
    // See the stations below: on the desk the radicals index stands
    // beside the lesson and its platforms, the open radical marked, each
    // platform figured from the family's own stats (the route the run
    // opens on), and another radical swaps the page by replacing the
    // URL. The family's door no longer takes the lesson's place: it
    // swaps the index for the family, in the list, and back — a push,
    // as on the phone, so Back undoes it; the crumb puts the index back
    // too. The family is the lesson's own answer (onLoaded), not a
    // second fetch, and the index stays mounted from one radical to the
    // next, on the page the learner left it.
    if (desk) {
      const figured = modes.map(m => (m.key === FAST_REVIEW ? m : {
        ...m,
        aside: <ScopeFigures session={session} url={`/api/kanji/stats?radical=${number}&mode=${m.key}`} />,
      }))
      const open = n => { navigate(`${BASE}/radical/${n}`, { replace: true }); window.scrollTo(0, 0) }
      return (
        <SelectionScreen
          title={t.kanjiTitle}
          sub={sub}
          aside={browsing ? <Leave onClick={() => swap({})}>{t.leaveRadicals}</Leave> : leaveSources}
        >
          <StationSplit
            label={browsing ? t.radFamily : t.byRadicalShort}
            list={browsing
              ? <RadicalFamilyList radical={here} session={session} />
              : <RadicalSelector session={session} selected={number} onSelect={open} />}
          >
            <RadicalLesson
              key={number}
              number={number}
              session={session}
              back={index}
              browse={false}
              familyOpen={browsing}
              onBrowse={() => swap(browsing ? {} : { family: '1' })}
              onLoaded={setLesson}
              platforms={<ModeSelector modes={figured} onSelect={m => (m === FAST_REVIEW ? run(m) : board(() => run(m)))} />}
            />
          </StationSplit>
        </SelectionScreen>
      )
    }

    const aside = browsing
      ? <Leave onClick={() => swap({})}>{t.radLesson}</Leave>
      : <Leave to={leave}>{t.leaveRadicals}</Leave>
    return (
      <SelectionScreen
        title={t.kanjiTitle}
        sub={sub}
        aside={aside}
      >
        <RadicalLesson
          key={number}
          number={number}
          session={session}
          back={index}
          browse={browsing}
          onBrowse={() => swap({ family: '1' })}
          onLoaded={setLesson}
          platforms={<ModeSelector modes={modes} onSelect={m => (m === FAST_REVIEW ? run(m) : board(() => run(m)))} />}
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

  // ── 机 — the line beside its platforms (plan 114) ──
  // See VocabScreen: on the desk a level's platforms stand beside the
  // JLPT line, each with its own figures; the way out is the sources.
  if (desk && byLevel) {
    const figured = modes.map(m => (m.key === FAST_REVIEW ? m : { ...m, aside: <ModeFigures source="kanji" deck={level} mode={m.key} /> }))
    return (
      <SelectionScreen title={t.kanjiTitle} sub={sub} aside={leaveSources}>
        <StationSplit
          label={t.stationJlpt}
          list={<LevelSelector source="kanji" selected={level} onSelect={lvl => navigate(`${BASE}/${lvl}`, { replace: true })} />}
        >
          <ModeSelector modes={figured} onSelect={m => (m === FAST_REVIEW ? run(m) : board(() => run(m)))} />
        </StationSplit>
      </SelectionScreen>
    )
  }

  // ── 机 — the tiers beside a tier's platforms (plan 115) ──
  // See VocabScreen: another size keeps the learner's place.
  if (desk && tier) {
    const open = Number(tier)
    const at = (n, size = tierSize) => `${BASE}/tier/${n}?size=${size}`
    const figured = modes.map(m => ({
      ...m,
      aside: <ScopeFigures session={session} url={`/api/frequency/kanji/stats?tier=${open}&tier_size=${tierSize}&mode=${m.key}`} />,
    }))
    return (
      <SelectionScreen title={t.kanjiTitle} sub={sub} aside={leaveSources}>
        <StationSplit
          label={t.byFrequencyShort}
          list={(
            <TierSelector
              domain="kanji"
              session={session}
              tierSize={tierSize}
              selected={open}
              onTierSize={size => navigate(at(tierAtSize(open, tierSize, size), size), { replace: true })}
              onSelect={n => navigate(at(n), { replace: true })}
            />
          )}
        >
          <ModeSelector modes={figured} onSelect={m => (m === FAST_REVIEW ? run(m) : board(() => run(m)))} />
        </StationSplit>
      </SelectionScreen>
    )
  }

  return (
    <SelectionScreen
      title={t.kanjiTitle}
      sub={sub}
      aside={<Leave to={back}>{byLevel ? t.leaveLevels : t.leaveTiers}</Leave>}
    >
      <ModeSelector modes={modes} onSelect={m => (m === FAST_REVIEW ? run(m) : board(() => run(m)))} />
    </SelectionScreen>
  )
}
