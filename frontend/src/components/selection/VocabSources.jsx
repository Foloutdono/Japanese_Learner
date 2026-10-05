import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { apiFetch } from '../../lib/api'
import { playUi } from '../../lib/audio'
import { useStats } from '../../stores/stats'
import { useProfileSummary } from '../../stores/profileSummary'
import { useStationSamples } from '../../stores/stationSamples'
import { board } from '../../stores/boarding'
import { deckItems } from '../../domain/lineProgress'
import { offeredModes } from '../../domain/studyModes'
import { DEFAULT_TIER_SIZE, TIER_SIZE_OPTIONS, tierLabelFor } from '../../domain/tiers'
import { themeLabelFor } from '../../domain/themes'
import { useListWalk, WALK_KEYS } from '../../hooks/useListWalk'
import { useGridWalk } from '../../hooks/useGridWalk'
import { useBoxWidth } from '../../hooks/useBoxWidth'
import { Seg, Console, ConsoleIndex } from '../chrome/Console'
import { GateButton } from '../ui/GateButton'
import { Loading } from '../ui/Loading'

// ── 机 — the vocabulary's sources, what you started first (plan 183) ──
// The owner's pick C of the canvas "Tsuji — the vocabulary's sources".
// Plan 137 hung the three sources as three equal plates the window's
// height, and on a real window the five JLPT levels shared 800px while
// the 41 tiers and the 36 themes scrolled in plates beside them: the
// shortest list had the most room, and nothing said which stop was the
// learner's. The page now opens on what the learner has started:
//
//   the strip    the learner's own level, with its bar, its first words
//                and the gate that resumes it (its first platform, the
//                main flashcards), then the other stops with the most
//                cards met -- another level, or a tier of the deck's own
//                ranking -- each a door to its platforms, as many as
//                the page is wide for
//   JLPT         the five levels as a line, each with its bar
//   Frequency    the pool and the size over the tiers as a grid of
//                numbered cells, a cell the learner has met words in
//                lit and filled to its share
//   Themes       the filter over the themes, in as many columns as
//                hold a name
//
// A door is a link that pushes (SplitRow's `push`, plan 123): the stop
// is a place left for, and Back comes back here. The pool and the size
// ride in this page's URL, as they do on the tiers' own page, so a
// reload keeps them. The themes have no figure of the learner's yet, so
// a theme is never in the strip.
//
// The JLPT and frequency plates are exported for the kanji's sources
// (KanjiSources.jsx), which set them as plan 137 drew them beside their
// radicals: a line's `source` names its stats and its tiers' domain,
// `base` its URL.
const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']
const BASE = '/learn/vocab'
// The strip's stops beside the lead, by the page's width: three where
// the page is 1,140px or more (a 1,440px window), two from NARROW, one
// on the narrowest desk (a 1,100px window leaves the page ~800px), so
// the lead keeps the width to stand its gate beside its words -- and
// only as many as the learner has started, the row shared by what is
// there. Measured, as a deck's page measures its modes (plan 154): the
// desk's stylesheet answers one width only. Under NARROW the sources
// under the strip are laid for the width too.
const NARROW = 960
const WIDE = 1140
const stripRoom = width => (width == null || width >= WIDE ? 3 : width >= NARROW ? 2 : 1)
// The lead's own width at which its gate takes a column of its own
// beside its words, rather than standing under them: the words keep
// their level's name whole and the gate its halo inside the card.
const SPLIT = 460
// What the lead's gate boards: the stop's first platform.
const RESUME_MODE = offeredModes('vocab')[0]

const share = (n, total) => `${total > 0 ? Math.min(100, (100 * n) / total) : 0}%`

export default function VocabSources({ session }) {
  const { t } = useLang()
  const [boxRef, width] = useBoxWidth(true)
  const narrow = width != null && width < NARROW
  const cut = useTierCut({ session })
  // The strip offers the deck's own tiers at the size on show. The JMdict
  // pool answers no met counts, so with it on show the strip asks for
  // the deck's tiers on its own rather than losing them.
  const deck = useDeckTiers(session, cut)
  return (
    <div ref={boxRef} className={`desk-sources desk-sources--resume${narrow ? ' desk-sources--narrow' : ''}`}>
      <ResumeStrip t={t} size={cut.size} tiers={deck.tiers} started={deck.started} room={stripRoom(width)} />
      <div className="desk-sources__lower">
        <JlptPlate t={t} desc={null} bars />
        <TierCellsPlate t={t} cut={cut} />
        <ThemesPlate t={t} session={session} />
      </div>
    </div>
  )
}

export function SourcePlate({ id, title, fig, desc, tools = null, className = '', children }) {
  return (
    <section className={`plate desk-source ${className}`.trim()} aria-labelledby={id}>
      <div className="desk-source__head">
        <h2 className="desk-source__title" id={id}>{title}</h2>
        {fig != null && <span className="desk-source__fig">{fig}</span>}
      </div>
      {desc && <p className="desk-source__desc">{desc}</p>}
      {tools && <div className="desk-source__tools">{tools}</div>}
      <span className="desk-source__stripe" aria-hidden="true" />
      {children}
    </section>
  )
}

// One tab stop a list, walked with ↑/↓ (hooks/useListWalk, plan 115).
function Rows({ label, className = '', children }) {
  const onWalk = useListWalk(true)
  return (
    <nav className={`desk-source__rows ${className}`.trim()} aria-label={label} onKeyDown={onWalk} aria-keyshortcuts={WALK_KEYS}>
      {children}
    </nav>
  )
}

// One tab stop a grid, walked with the four arrows (hooks/useGridWalk,
// plan 123): the tiers' cells and the themes' two columns.
const GRID_KEYS = 'ArrowUp ArrowDown ArrowLeft ArrowRight Home End'
function Grid({ label, className, children }) {
  const onWalk = useGridWalk(true)
  return (
    <nav className={className} aria-label={label} onKeyDown={onWalk} aria-keyshortcuts={GRID_KEYS}>
      {children}
    </nav>
  )
}

const click = () => playUi('click-mode-selection')

// A learned / met bar: the line's bar on the Learn gate (plan 130).
function Bar({ learned = 0, started, total, className = '' }) {
  return (
    <span className={`desk-line__bar ${className}`.trim()} aria-hidden="true">
      <i className="desk-line__met" style={{ width: share(started, total) }} />
      {learned > 0 && <i className="desk-line__learned" style={{ width: share(learned, total) }} />}
    </span>
  )
}

// The bar with its figure at its end: `figure` of `total` -- the cards
// learned for the learner's level, met for a stop they are riding.
function Meter({ figure, total, ...bar }) {
  if (!(total > 0)) return null
  return (
    <span className="desk-source__meter">
      <Bar total={total} {...bar} />
      <span className="desk-source__num"><b>{figure}</b>/ {total}</span>
    </span>
  )
}

// ── the strip ──
function ResumeStrip({ t, size, tiers, started, room }) {
  const navigate = useNavigate()
  const [leadRef, leadWidth] = useBoxWidth(true)
  const split = leadWidth != null && leadWidth >= SPLIT
  const stats = useStats().data
  const here = useProfileSummary()?.jlptLevel ?? null
  const samples = useStationSamples('vocab')
  const levels = LEVELS.map(level => ({ level, ...deckItems(stats, 'vocab', level) }))
  // The learner's own level, else the first they have met words in,
  // else the first: the strip always offers somewhere to go on.
  const lead = levels.find(l => l.level === here)
    ?? levels.find(l => l.started > 0)
    ?? levels[0]
  const others = [
    ...levels
      .filter(l => l !== lead && l.started > 0)
      .map(l => ({
        key: l.level,
        to: `${BASE}/${l.level}`,
        cap: t.byLevel,
        code: l.level,
        label: t[`levelHint${l.level}`] ?? l.level,
        sample: samples?.[l.level]?.sample,
        ...l,
      })),
    ...tiers
      .filter(tr => (started[String(tr.tier)] ?? 0) > 0)
      .map(tr => ({
        key: `tier-${tr.tier}`,
        to: `${BASE}/tier/${tr.tier}?size=${size}`,
        cap: t.byFrequencyShort,
        code: String(tr.tier),
        label: t.tierWords(tierLabelFor(tr.tier, size)),
        sample: tr.sample,
        started: started[String(tr.tier)],
        learned: 0,
        total: tr.count,
      })),
  ]
    // The most met first; a tie keeps the levels before the tiers and
    // each in its own order (the sort is stable).
    .sort((a, b) => b.started - a.started)
    .slice(0, room)
  const unseen = lead.total - lead.started
  const depart = () => board(() => navigate(`${BASE}/${lead.level}/${RESUME_MODE}`))
  return (
    <div className={`desk-resume desk-resume--${others.length}`} role="group" aria-label={t.sourcesInProgress}>
      <section
        ref={leadRef}
        className={`desk-resume__card desk-resume__card--lead${split ? ' desk-resume__card--split' : ''}`}
        aria-labelledby="desk-resume-lead"
      >
        <span className={`desk-resume__cap${lead.level === here ? ' desk-source__here' : ''}`}>
          {lead.level === here ? `${t.byLevel} · ${t.levelCurrentMark}` : t.byLevel}
        </span>
        <Link to={`${BASE}/${lead.level}`} className="desk-resume__name" id="desk-resume-lead" onClick={click}>
          <span className="desk-resume__code">{lead.level}</span>
          <span className="desk-resume__label">{t[`levelHint${lead.level}`] ?? lead.level}</span>
        </Link>
        <Meter learned={lead.learned} started={lead.started} total={lead.total} figure={lead.learned} />
        {samples?.[lead.level]?.sample && (
          <span className="desk-resume__sample" lang="ja" aria-hidden="true">{samples[lead.level].sample.join(' ')}</span>
        )}
        <span className="desk-resume__go">
          {lead.total > 0 && (
            <span className="desk-source__num">
              {lead.started > 0 && <>{t.startedNote(lead.started)} · </>}
              {t.unseenNote(unseen)}
            </span>
          )}
          <GateButton
            label={lead.started > 0 ? t.sourcesResume : t.start}
            onClick={depart}
            className="desk-resume__gate"
          />
        </span>
      </section>
      {others.map(o => (
        <Link key={o.key} to={o.to} className="desk-resume__card" onClick={click}>
          <span className="desk-resume__cap">{o.cap}</span>
          <span className="desk-resume__name">
            <span className="desk-resume__code">{o.code}</span>
            <span className="desk-resume__label">{o.label}</span>
          </span>
          <Meter learned={o.learned} started={o.started} total={o.total} figure={o.started} />
          {o.sample?.length > 0 && <span className="desk-resume__sample" lang="ja" aria-hidden="true">{o.sample.join(' ')}</span>}
        </Link>
      ))}
    </div>
  )
}

// ── the JLPT line ──
// `compact`: the rows at their own height rather than sharing the
// plate's, for a plate that stands over another in its column. `bars`:
// each level's first words and its bar under its name, where the strip
// above already says where the learner is and how far.
export function JlptPlate({ t, source = 'vocab', base = BASE, compact = false, bars = false, desc = t.byLevelDesc }) {
  const stats = useStats().data
  const here = useProfileSummary()?.jlptLevel ?? null
  const samples = useStationSamples(source, bars)
  const rows = LEVELS.map(level => ({ level, ...deckItems(stats, source, level) }))
  const learned = rows.reduce((n, r) => n + r.learned, 0)
  const total = rows.reduce((n, r) => n + r.total, 0)
  const tabStop = LEVELS.includes(here) ? here : LEVELS[0]
  return (
    <SourcePlate
      id="desk-source-jlpt"
      title={t.byLevel}
      fig={total > 0 ? <><b>{learned}</b>/ {total}</> : null}
      desc={desc}
      className={compact ? 'desk-source--compact' : ''}
    >
      <Rows label={t.stationJlpt} className={compact ? '' : 'desk-source__rows--line'}>
        {rows.map((r, i) => {
          const isHere = r.level === here
          const met = !bars && r.started > r.learned
          return (
            <Link
              key={r.level}
              to={`${base}/${r.level}`}
              className={`desk-source__row${isHere ? ' desk-source__row--here' : ''}${i === 0 ? ' desk-source__row--first' : ''}${i === LEVELS.length - 1 ? ' desk-source__row--last' : ''}`}
              aria-current={isHere ? 'location' : undefined}
              tabIndex={r.level === tabStop ? 0 : -1}
              onClick={click}
            >
              <span className="desk-source__ring" aria-hidden="true" />
              <span className="desk-source__code">{r.level}</span>
              <span className="desk-source__name">
                <span className="desk-source__label">{t[`levelHint${r.level}`] ?? r.level}</span>
                {!bars && (isHere || met) && (
                  <span className="desk-source__cap">
                    {isHere && <span className="desk-source__here">{t.levelCurrentMark}</span>}
                    {met && <span>{t.startedNote(r.started)}</span>}
                  </span>
                )}
                {samples?.[r.level]?.sample && (
                  <span className="desk-source__sample" lang="ja" aria-hidden="true">{samples[r.level].sample.join(' ')}</span>
                )}
                {bars && <Meter learned={r.learned} started={r.started} total={r.total} figure={r.learned} />}
              </span>
              {!bars && r.total > 0 && <span className="desk-source__num"><b>{r.learned}</b>/ {r.total}</span>}
            </Link>
          )
        })}
      </Rows>
    </SourcePlate>
  )
}

function useJson(path, session) {
  const [got, setGot] = useState(null)
  useEffect(() => {
    if (!path) return undefined
    let live = true
    apiFetch(path, session)
      .then(r => (r.ok ? r.json() : null))
      .then(body => { if (live) setGot({ path, body }) })
      .catch(() => { if (live) setGot({ path, body: null }) })
    return () => { live = false }
  }, [path, session])
  // An answer to the path the learner has just left is not this one's;
  // no path asks nothing.
  return path && got?.path === path ? got.body : undefined
}

// The tiers on show: the pool and the size from the page's URL, the
// tiers of that cut and the cards the learner has met in each, how to
// choose another cut and where a tier is. `pools`: the vocabulary's
// choice between the deck's words and the ones beyond it; the kanji
// have one ranking, so no switch.
function useTierCut({ session, source = 'vocab', base = BASE, pools = true }) {
  const [sp, setSp] = useSearchParams()
  const size = TIER_SIZE_OPTIONS.includes(Number(sp.get('size'))) ? Number(sp.get('size')) : DEFAULT_TIER_SIZE
  const jmdict = pools && sp.get('domain') === 'jmdict'
  const domain = jmdict ? `${source}_jmdict` : source
  const tiers = useJson(`/api/frequency/${domain}/tiers?tier_size=${size}`, session)
  const started = useJson(`/api/frequency/${domain}/tiers/started?tier_size=${size}`, session)?.started ?? {}
  const shown = (tiers?.tiers ?? []).filter(tr => tr.count > 0)
  // The rest of the page's query (a radical page's stroke, say) is kept.
  const choose = (pool, n) => setSp(prev => {
    const next = new URLSearchParams([...prev].filter(([k]) => k !== 'size' && k !== 'domain'))
    if (n !== DEFAULT_TIER_SIZE) next.set('size', String(n))
    if (pool) next.set('domain', 'jmdict')
    return next
  }, { replace: true })
  const at = n => `${base}/tier/${n}?size=${size}${jmdict ? '&domain=jmdict' : ''}`
  // undefined is a wait (useJson): the plate shows the dots, not an empty list.
  return { size, jmdict, pools, loading: tiers === undefined, tiers: shown, started, choose, at }
}

// The deck's own tiers at the cut's size: the cut's when it shows them,
// else asked for apart (the JMdict pool on show).
function useDeckTiers(session, cut) {
  const apart = cut.jmdict
  const tiers = useJson(apart ? `/api/frequency/vocab/tiers?tier_size=${cut.size}` : null, session)
  const started = useJson(apart ? `/api/frequency/vocab/tiers/started?tier_size=${cut.size}` : null, session)
  if (!apart) return { tiers: cut.tiers, started: cut.started }
  return { tiers: (tiers?.tiers ?? []).filter(tr => tr.count > 0), started: started?.started ?? {} }
}

// The pool over the size, each switch at the plate's width, as the
// tiers' own page draws them (TierSelector). No caption: the figures
// say what the size is, and the name is the switch's label.
function CutTools({ t, cut }) {
  return (
    <>
      {cut.pools && (
        <Seg
          full
          label={t.byFrequencyShort}
          value={cut.jmdict ? 'jmdict' : 'vocab'}
          onChange={key => cut.choose(key === 'jmdict', cut.size)}
          options={[
            { key: 'vocab', label: t.freqDomainDeck },
            { key: 'jmdict', label: t.freqDomainJmdict },
          ]}
        />
      )}
      <div className="desk-source__size">
        <Seg
          full
          label={t.tierSizeLabel}
          value={cut.size}
          onChange={n => cut.choose(cut.jmdict, n)}
          options={TIER_SIZE_OPTIONS.map(n => ({ key: n, label: String(n) }))}
        />
      </div>
    </>
  )
}

export function FrequencyPlate({ t, session, source = 'vocab', base = BASE, pools = true, title = t.byFrequency, desc = t.byFrequencyDesc }) {
  const cut = useTierCut({ session, source, base, pools })
  return (
    <SourcePlate
      id="desk-source-freq"
      title={title}
      fig={cut.tiers.length > 0 ? t.sourceTiers(cut.tiers.length) : null}
      desc={desc}
      tools={<CutTools t={t} cut={cut} />}
    >
      {cut.loading ? <Loading tight /> : <Rows label={t.byFrequencyShort} className="desk-source__rows--scroll">
        {cut.tiers.map((tr, i) => {
          const met = cut.started[String(tr.tier)] ?? 0
          return (
            <Link
              key={tr.tier}
              to={cut.at(tr.tier)}
              className={`desk-source__row${i === 0 ? ' desk-source__row--first' : ''}${i === cut.tiers.length - 1 ? ' desk-source__row--last' : ''}`}
              tabIndex={i === 0 ? 0 : -1}
              onClick={click}
            >
              <span className="desk-source__ring" aria-hidden="true" />
              <span className="desk-source__code">{tr.tier}</span>
              <span className="desk-source__name"><span className="desk-source__label">{tierLabelFor(tr.tier, cut.size)}</span></span>
              {met > 0 && <span className="desk-source__num">{t.startedNote(met)}</span>}
            </Link>
          )
        })}
      </Rows>}
    </SourcePlate>
  )
}

// The tiers as a grid of numbered cells: a cell's name and its met count
// in its label (and its tooltip), its number and count on its face, and
// its foot filled to the share met.
function TierCellsPlate({ t, cut }) {
  return (
    <SourcePlate
      id="desk-source-freq"
      title={t.byFrequency}
      fig={cut.tiers.length > 0 ? t.sourceTiers(cut.tiers.length) : null}
      tools={<CutTools t={t} cut={cut} />}
    >
      {cut.loading ? <Loading tight /> : <Grid label={t.byFrequencyShort} className="desk-source__cells">
        {cut.tiers.map((tr, i) => {
          const met = cut.started[String(tr.tier)] ?? 0
          const name = [
            t.tierLabel.replace('{n}', tr.tier),
            t.tierWords(tierLabelFor(tr.tier, cut.size)),
            met > 0 && t.startedNote(met),
          ].filter(Boolean).join(' · ')
          return (
            <Link
              key={tr.tier}
              to={cut.at(tr.tier)}
              className={`desk-source__cell${met > 0 ? ' desk-source__cell--met' : ''}`}
              aria-label={name}
              title={name}
              tabIndex={i === 0 ? 0 : -1}
              onClick={click}
            >
              <span className="desk-source__cell-code">{tr.tier}</span>
              {met > 0 && <span className="desk-source__cell-met">{met}</span>}
              {met > 0 && <i className="desk-source__cell-fill" style={{ width: share(met, tr.count) }} />}
            </Link>
          )
        })}
      </Grid>}
    </SourcePlate>
  )
}

function ThemesPlate({ t, session }) {
  const [query, setQuery] = useState('')
  const themes = useJson('/api/themes', session)?.themes
  const labeled = useMemo(() => (themes ?? []).map(th => ({ ...th, label: themeLabelFor(t, th.key) })), [themes, t])
  const q = query.trim().toLowerCase()
  const shown = q ? labeled.filter(th => th.label.toLowerCase().includes(q)) : labeled
  return (
    <SourcePlate
      id="desk-source-themes"
      title={t.byTheme}
      fig={labeled.length > 0 ? t.sourceThemes(labeled.length) : null}
      tools={labeled.length > 8 && (
        <Console>
          <ConsoleIndex
            value={query}
            onChange={e => setQuery(e.target.value)}
            onClear={() => setQuery('')}
            placeholder={t.filterThemes}
            aria-label={t.filterThemes}
            clearLabel={t.cancel}
            count={`${shown.length} / ${labeled.length}`}
          />
        </Console>
      )}
    >
      <Grid label={t.byThemeShort} className="desk-source__rows desk-source__rows--scroll desk-source__rows--cols">
        {shown.map((th, i) => (
          <Link
            key={th.key}
            to={`${BASE}/theme/${th.key}`}
            className="desk-source__row desk-source__row--plain"
            tabIndex={i === 0 ? 0 : -1}
            onClick={click}
          >
            <span className="desk-source__name"><span className="desk-source__label">{th.label}</span></span>
            <span className="desk-source__num">{th.count}</span>
          </Link>
        ))}
      </Grid>
    </SourcePlate>
  )
}
