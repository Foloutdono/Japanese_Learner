import { useCallback, useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { playUi } from '../../lib/audio'
import { apiFetch } from '../../lib/api'
import { relativeDate } from '../../lib/formatDate'
import { board } from '../../stores/boarding'
import { useStats } from '../../stores/stats'
import { usePracticeRecord } from '../../stores/practiceRecord'
import { usePracticeStop } from '../../stores/practiceStop'
import { useStationSamples } from '../../stores/stationSamples'
import { deckItems } from '../../domain/lineProgress'
import { LEVELS, tierStop } from '../../domain/sentenceSource'
import { DEFAULT_TIER_SIZE, TIER_SIZE_OPTIONS, tierAtSize } from '../../domain/tiers'
import { Leave } from '../chrome/Bar'
import { Seg } from '../chrome/Console'
import SelectionScreen from '../selection/SelectionScreen'
import LevelSelector from '../selection/LevelSelector'
import TierSelector from '../selection/TierSelector'
import { RouteStops } from '../selection/RouteStops'
import { StationSplit, LevelRedirect } from '../selection/StationSplit'
import { PracticePage, PracticeLines, PracticeChips } from './PracticePage'
import { PracticeSpecimen } from './PracticeSpecimen'

// ── 実践 — a practice station on the desk, filled (plan 159) ─────────
// The owner's picks A and S1 of the canvas "Practice screens — layout
// options". Reading, translation, comprehension, dictation and
// composition were, on the desk, the phone's pages at a desk's width:
// three source cards across the top of an empty window (reading's and
// translation's /practice/x), then the five grades in one short row
// across it (/levels), then the tiers as a wall. Now each station is a
// line's split, the way plan 137 filled the Learn stations:
//
//   the list  the stops upright, sharing the column's height -- the five
//             grades, each printing a sentence (or the texts, or the
//             points) of its own bank, the bar of the grade's words and
//             the learner's record there; a tier list; or the learner's
//             own cards. Reading and translation, which draw from three
//             sources, carry the source as a switch at the list's head
//             (S1: the sources folded into the station), so the page
//             that only chose a source is gone on the desk;
//   the page  the open stop (PracticePage): what the run asks, the
//             exercise as it will ask it, four figures, the newest
//             misses and the grade's points.
//
// Choosing a stop replaces the URL (?level=N4, ?tier=3) and Board --
// the page's one filled action, and Enter -- departs. The phone keeps
// its pages (screens/SentenceStation.jsx): nothing here renders below
// the desk's width.
//
//   /practice/reading                 → the learner's grade, below
//   /practice/reading/levels?level=N4 the grades, N4 open
//   /practice/reading/tiers?size=200&domain=jmdict&tier=3
//   /practice/reading/cards           the learner's own cards
//   /practice/dictation?level=N4      a one-axis station's grades

const PLATFORMS = {
  '/practice/reading':       { key: 'reading',       unit: 'sentences', bank: 'sentences', tag: 'sentence', sourced: true },
  '/practice/translation':   { key: 'translation',   unit: 'sentences', bank: 'sentences', tag: 'sentence', sourced: true },
  '/practice/comprehension': { key: 'comprehension', unit: 'texts',     bank: 'texts',     tag: 'text',     misses: 'practiceTexts', points: 'practiceTextPoints' },
  '/practice/dictation':     { key: 'dictation',     unit: 'sentences', bank: 'clips',     tag: 'clip' },
  '/practice/composition':   { key: 'composition',   unit: 'sentences', bank: 'points',    tag: 'point',    misses: 'practiceMissedPoints' },
}

// Where a grade departs to: the run's own path (App.jsx's stage routes).
const runAt = (base, sourced, level) => (sourced ? `${base}/level/${level}` : `${base}/${level}`)

function pageOf(pathname, levelsOnly) {
  if (levelsOnly) return 'levels'
  if (pathname.endsWith('/levels')) return 'levels'
  if (pathname.endsWith('/tiers')) return 'tiers'
  if (pathname.endsWith('/cards')) return 'cards'
  return 'root'
}

const capital = s => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
const pctOf = rec => (rec?.of > 0 ? Math.round((rec.right / rec.of) * 100) : null)

export default function PracticeStation({ session, base, levelsOnly = false }) {
  const { t, lang } = useLang()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [sp] = useSearchParams()
  const platform = PLATFORMS[base]
  const page = pageOf(pathname, levelsOnly)

  const levelsPath = levelsOnly ? base : `${base}/levels`
  const level = LEVELS.includes(sp.get('level')) ? sp.get('level') : null
  const jmdict = sp.get('domain') === 'jmdict'
  const domain = jmdict ? 'vocab_jmdict' : 'vocab'
  const tierSize = TIER_SIZE_OPTIONS.includes(Number(sp.get('size'))) ? Number(sp.get('size')) : DEFAULT_TIER_SIZE
  const tierParam = Number(sp.get('tier'))
  const tier = Number.isInteger(tierParam) && tierParam > 0 ? tierParam : null
  const tiersPath = (size, jm, n) => `${base}/tiers?size=${size}${jm ? '&domain=jmdict' : ''}&tier=${n}`

  const stopKey = page === 'levels' ? level
    : page === 'tiers' && tier ? tierStop(domain, tier, tierSize)
    : page === 'cards' ? 'mastery'
    : null

  const samples = useStationSamples(platform.key)
  const records = usePracticeRecord().data?.[platform.key]
  const stop = usePracticeStop(platform.key, stopKey)
  const stats = useStats().data
  const tierDetail = useTierDetail(domain, tier, tierSize, session, page === 'tiers' && tier != null)

  const depart = useCallback(to => {
    playUi('click-mode-selection')
    board(() => navigate(to))
  }, [navigate])

  const frame = children => (
    <SelectionScreen aside={<Leave to={'/practice'}>{t.tabPractice}</Leave>}>{children}</SelectionScreen>
  )

  // A station's bare address has nothing of its own to show on the
  // desk: it opens on the learner's grade (StationSplit's LevelRedirect),
  // the way the Learn stations and the exam do.
  if (page === 'root' || (page === 'levels' && !level)) {
    return frame(<LevelRedirect to={lvl => `${levelsPath}?level=${lvl}`} />)
  }
  if (page === 'tiers' && !tier) {
    return frame(<Navigate replace to={tiersPath(tierSize, jmdict, 1)} />)
  }

  const unit = platform.unit
  const note = rec => (rec
    ? [t.practiceDone[unit](rec.done), pctOf(rec) == null ? null : t.practiceRight(pctOf(rec))].filter(Boolean).join(' · ')
    : t.practiceNotYet)

  // ── The list ──
  const source = page === 'levels' ? 'level' : page === 'tiers' ? 'frequency' : 'mastery'
  const switcher = platform.sourced && (
    <Seg
      full
      className="prc-sources"
      label={t.selectStudySource}
      value={source}
      onChange={key => {
        playUi('click-mode-selection')
        navigate(key === 'level' ? levelsPath : key === 'frequency' ? `${base}/tiers` : `${base}/cards`, { replace: true })
      }}
      options={[
        { key: 'level', label: t.byLevel },
        { key: 'frequency', label: t.practiceSourceFrequency },
        { key: 'mastery', label: t.byMastery },
      ]}
    />
  )

  let list
  if (page === 'levels') {
    list = (
      <LevelSelector
        source="vocab"
        sampleSource={platform.key}
        selected={level}
        linkTo={lvl => `${levelsPath}?level=${lvl}`}
        figured
        extra={lvl => ({
          // Comprehension's sample is its grade's texts, named apart.
          ...(platform.key === 'comprehension' ? { sample: samples?.[lvl]?.sample?.join(' · ') } : {}),
          note: records === undefined ? undefined : note(records?.[lvl]),
        })}
      />
    )
  } else if (page === 'tiers') {
    list = (
      <div className="prc-tiers">
        <Seg
          full
          label={t.selectDomain}
          value={jmdict ? 'jmdict' : 'vocab'}
          onChange={key => { playUi('click-mode-selection'); navigate(tiersPath(tierSize, key === 'jmdict', 1), { replace: true }) }}
          options={[
            { key: 'vocab', label: t.freqDomainDeck },
            { key: 'jmdict', label: t.freqDomainJmdict },
          ]}
        />
        <TierSelector
          domain={domain}
          session={session}
          tierSize={tierSize}
          onTierSize={size => navigate(tiersPath(size, jmdict, tierAtSize(tier, tierSize, size)), { replace: true })}
          selected={tier}
          linkTo={n => tiersPath(tierSize, jmdict, n)}
        />
      </div>
    )
  } else {
    list = (
      <div className="prc-one">
        <RouteStops
          stops={[{ key: 'mastery', name: t.byMastery, hint: t.byMasteryDesc, note: stop ? note(stop.record) : undefined }]}
          selected="mastery"
          linkTo={() => `${base}/cards`}
        />
      </div>
    )
  }

  // ── The page ──
  const rec = stop?.record ?? (page === 'levels' ? records?.[level] : undefined) ?? null
  const loaded = stop != null || (page === 'levels' && records !== undefined)
  const pct = pctOf(rec)
  const figures = [
    { key: 'done', label: t.practiceFig[unit], value: loaded ? (rec?.done ?? 0) : '—' },
    platform.key === 'comprehension'
      ? { key: 'right', label: t.practiceFig.questions, value: rec ? rec.right : '—', unit: rec ? `/ ${rec.of}` : null, bar: pct == null ? null : { value: pct, of: 100 } }
      : { key: 'right', label: t.practiceFig.right, value: pct ?? '—', unit: pct == null ? null : '%', bar: pct == null ? null : { value: pct, of: 100 } },
    null,
    { key: 'last', label: t.practiceFig.last, value: capital(relativeDate(rec?.last, lang, t)) ?? '—' },
  ]

  const misses = (
    <PracticeLines
      title={t[platform.misses ?? 'practiceMisses']}
      fig={stop?.misses?.length ? stop.misses.length : null}
      rows={stop ? missRows(stop.misses, t, lang) : null}
      empty={platform.key === 'comprehension' ? t.practiceNoTexts : t.practiceNoMisses}
    />
  )

  let pageBody
  if (page === 'levels') {
    const own = samples?.[level]
    const { learned, total, started } = deckItems(stats, 'vocab', level)
    figures[2] = {
      key: 'words', label: t.practiceFig.words, value: learned, unit: `/ ${total}`,
      bar: total > 0 ? { value: learned, met: started, of: total } : null,
      note: started > learned ? t.startedNote(started) : null,
    }
    const points = own?.points ?? []
    const known = new Set(stop?.known ?? [])
    pageBody = (
      <PracticePage
        label={level}
        title={`${level} · ${t[`levelHint${level}`] ?? level}`}
        desc={[t.practiceHow[platform.key], own?.size ? t.practiceBank[platform.bank](own.size) : null].filter(Boolean).join(' ')}
        onDepart={() => depart(runAt(base, platform.sourced, level))}
        spec={<PracticeSpecimen platform={platform.key} card={own?.card ?? null} tag={t.practiceSpecTag[platform.tag]} />}
        figures={figures}
      >
        {misses}
        {points.length > 0 && (
          <PracticeChips
            title={t[platform.points ?? 'practicePoints']}
            fig={t.practicePointsStudied(points.filter(p => known.has(p)).length, points.length)}
            items={points}
            known={known}
            knownLabel={t.practicePointStudied}
          />
        )}
      </PracticePage>
    )
  } else if (page === 'tiers') {
    const items = tierDetail?.items ?? []
    const words = items.map(w => w.kanji || (w.kana ?? '').split('/')[0]).filter(Boolean)
    const count = items.length || tierSize
    const from = (tier - 1) * tierSize + 1
    // The JMdict pool prints no met figure (routes/frequency.py's
    // tiers/started): 292k words are not walked per request.
    const met = jmdict ? null : tierDetail?.started ?? null
    figures[2] = {
      key: 'words', label: t.practiceFig.tierWords,
      value: met ?? '—', unit: met == null ? null : `/ ${count}`,
      bar: met == null ? null : { value: 0, met, of: count },
    }
    pageBody = (
      <PracticePage
        label={t.practiceTierTitle(tier, from, from + count - 1)}
        title={t.practiceTierTitle(tier, from, from + count - 1)}
        desc={`${t.practiceTierDesc(jmdict ? t.freqDomainJmdict : t.freqDomainDeck)} ${t.practiceHow[platform.key]}`}
        onDepart={() => depart(`${base}/tier/${tier}?size=${tierSize}${jmdict ? '&domain=jmdict' : ''}`)}
        spec={<PracticeSpecimen platform={platform.key} words={words.length ? words.slice(0, 6) : null} tag={t.practiceSpecTag.tier} />}
        figures={figures}
      >
        {misses}
        {words.length > 0 && (
          <PracticeChips
            title={t.practiceTierWords}
            fig={met == null ? null : t.practiceTierSeen(met, count)}
            items={[...new Set(words)]}
          />
        )}
      </PracticePage>
    )
  } else {
    const seen = LEVELS.reduce((n, lvl) => n + deckItems(stats, 'vocab', lvl).started, 0)
    figures[2] = { key: 'words', label: t.practiceFig.met, value: stats ? seen : '—' }
    pageBody = (
      <PracticePage
        label={t.byMastery}
        title={t.byMastery}
        desc={`${t.practiceMineDesc} ${t.practiceHow[platform.key]}`}
        onDepart={() => depart(`${base}/mastery`)}
        spec={<PracticeSpecimen platform={platform.key} note={t.practiceMineNote} tag={t.practiceSpecTag.mine} />}
        figures={figures}
      >
        {misses}
      </PracticePage>
    )
  }

  return frame(
    <StationSplit
      className="desk-split--line desk-split--practice"
      label={platform.sourced ? t.selectStudySource : t.stationJlpt}
      list={<>{switcher}{list}</>}
    >
      {pageBody}
    </StationSplit>
  )
}

// A stop's newest misses as the panel's rows. A comprehension text is
// a score rather than a miss: a mark when half or more went right.
function missRows(misses, t, lang) {
  return (misses ?? []).map((m, i) => {
    const score = Array.isArray(m.score) ? m.score : null
    return {
      key: `${m.at}-${i}`,
      mark: score ? (score[0] * 2 >= score[1] ? 'hit' : 'miss') : 'miss',
      jp: m.jp,
      sub: m.sub,
      fig: score ? `${score[0]} / ${score[1]}` : null,
      when: capital(relativeDate(m.at, lang, t)),
    }
  })
}

// A tier's words and how many of them the learner has met, for its
// page: /api/frequency's items (the words the run builds from, in rank
// order) and tiers/started (plan 137). Keyed on what was asked, so a
// tier swapped in place never shows the last tier's words.
function useTierDetail(domain, tier, size, session, enabled) {
  const { lang } = useLang()
  const key = `${domain}:${tier}:${size}:${lang}`
  const [detail, setDetail] = useState(null)
  useEffect(() => {
    if (!enabled) return undefined
    let alive = true
    const json = r => (r?.ok ? r.json() : null)
    Promise.all([
      apiFetch(`/api/frequency/${domain}/tier/${tier}/items?tier_size=${size}&lang=${lang}`, session).then(json),
      apiFetch(`/api/frequency/${domain}/tiers/started?tier_size=${size}`, session).then(json),
    ])
      .then(([items, started]) => {
        if (alive) setDetail({ key, items: items?.items ?? [], started: started?.started?.[String(tier)] ?? 0 })
      })
      .catch(() => { if (alive) setDetail({ key, items: [], started: null }) })
    return () => { alive = false }
  }, [enabled, key, domain, tier, size, lang, session])
  return enabled && detail?.key === key ? detail : null
}
