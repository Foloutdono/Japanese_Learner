import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useLang } from '../LangContext'
import { board } from '../stores/boarding'
import { Leave } from '../components/chrome/Bar'
import { Seg } from '../components/chrome/Console'
import SelectionScreen from '../components/selection/SelectionScreen'
import LevelSelector from '../components/selection/LevelSelector'
import ModeSelector from '../components/selection/ModeSelector'
import TierSelector from '../components/selection/TierSelector'
import { DEFAULT_TIER_SIZE } from '../domain/tiers'
import { sourcePaths } from '../domain/sentenceSource'

// ── 実践 — the station for the sentence platforms ─────────────
// Reading, comprehension and translation were each ONE route that
// began as a picker and became a session, and that route was on the
// stage frame — so choosing a source happened with no HUD and no tab
// bar, on a screen that is a station page like any other. The pickers
// live here now, under the chrome, and the session is its own route on
// the stage: the split the lines have had since plan 071 (a stop, then
// its platforms, then the run).
//
// Reading and translation ask the identical question — which source:
// the JLPT grades, the frequency tiers, or the learner's own cards —
// because they draw from the same bank (backend/routes/translation.py
// delegates to reading.py wholesale). So they ask it with the same
// screen rather than with two copies of it, and comprehension, which
// has only the level to choose, is the same screen with one axis.
//
//   /practice/reading            the sources
//   /practice/reading/levels     the JLPT grades
//   /practice/reading/tiers      the word list and its tiers
//   → /practice/reading/level/N4, /tier/3?size=200&domain=jmdict,
//     /mastery — the run, on the stage (screens/ReadingRun.jsx)
//
// Comprehension has no source list, so its own root IS the level list
// and the run is /practice/comprehension/N4.
// The title, the roundel and the pigment are the section's own and
// come from the path (SelectionScreen asks the registry), so a station
// only has to say WHICH lists it offers.
export default function SentenceStation({ session, base, levelsOnly = false }) {
  const { t } = useLang()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [sp, setSp] = useSearchParams()

  const tierSize = Number(sp.get('size')) || DEFAULT_TIER_SIZE
  const jmdict = sp.get('domain') === 'jmdict'
  const domainQuery = jmdict ? '&domain=jmdict' : ''
  const levelsPage = pathname.endsWith('/levels')
  const tiersPage = pathname.endsWith('/tiers')

  const leavePractice = <Leave onClick={() => navigate('/practice')}>{t.tabPractice}</Leave>
  const leaveSources = <Leave onClick={() => navigate(base)}>{t.leaveSources}</Leave>

  // ── The JLPT grades ──
  // The only step for comprehension, the second one for the other two.
  if (levelsPage || levelsOnly) {
    const run = lvl => navigate(levelsOnly ? `${base}/${lvl}` : `${base}/level/${lvl}`)
    return (
      <SelectionScreen sub={t.selectLevel} aside={levelsOnly ? leavePractice : leaveSources}>
        <LevelSelector onSelect={lvl => board(() => run(lvl))} />
      </SelectionScreen>
    )
  }

  // ── The word list and the tier, on one page ──
  if (tiersPage) {
    return (
      <SelectionScreen sub={t.selectTier} aside={leaveSources}>
        <Seg
          full
          label={t.selectDomain}
          value={jmdict ? 'jmdict' : 'vocab'}
          onChange={key => setSp(key === 'jmdict' ? { size: String(tierSize), domain: 'jmdict' } : { size: String(tierSize) }, { replace: true })}
          options={[
            { key: 'vocab', label: t.freqDomainDeck },
            { key: 'jmdict', label: t.freqDomainJmdict },
          ]}
        />
        <TierSelector
          domain={jmdict ? 'vocab_jmdict' : 'vocab'}
          session={session}
          tierSize={tierSize}
          onTierSize={size => setSp(jmdict ? { size: String(size), domain: 'jmdict' } : { size: String(size) }, { replace: true })}
          onSelect={(tr, _label, ts) => board(() => navigate(`${base}/tier/${tr}?size=${ts ?? tierSize}${domainQuery}`))}
        />
      </SelectionScreen>
    )
  }

  // ── The sources ──
  // 'mastery' needs no further choice, so choosing it is the last step
  // and boards straight away; the other two each have one more list.
  const SOURCES = [
    { key: 'level',     label: t.byLevel,     desc: t.byLevelDesc },
    { key: 'frequency', label: t.byFrequency, desc: t.byFrequencyDesc },
    { key: 'mastery',   label: t.byMastery,   desc: t.byMasteryDesc },
  ]
  const NEXT = sourcePaths(base)
  return (
    <SelectionScreen sub={t.selectStudySource} aside={leavePractice}>
      <ModeSelector
        modes={SOURCES}
        onSelect={key => (key === 'mastery'
          ? board(() => navigate(NEXT.mastery))
          : navigate(NEXT[key]))}
      />
    </SelectionScreen>
  )
}

