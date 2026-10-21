import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { CONTENT_TTL_MS, MINE_TTL_MS, useCachedJson } from '../../lib/cachedJson'
import { playUi } from '../../lib/audio'
import { DEFAULT_TIER_SIZE, TIER_SIZE_OPTIONS, tierLabelFor } from '../../domain/tiers'
import { themeLabelFor } from '../../domain/themes'
import { useListWalk, WALK_KEYS } from '../../hooks/useListWalk'
import { useGridWalk } from '../../hooks/useGridWalk'
import { Seg, Console, ConsoleIndex } from '../chrome/Console'
import { Loading } from '../ui/Loading'
import { LineDoors } from './LineDoors'

// ── 机 — the vocabulary's sources, doors all the way down (plan 267) ──
// The owner's pick C3 of the canvas "Tsuji — the sources and the line,
// redrawn". Plan 183 opened the page on a strip of what the learner had
// started -- their level and its gate, then the stops with the most
// cards met -- over three plates side by side: JLPT, the tiers as a grid
// of cells, the themes. The strip and the JLPT plate said the learner's
// level twice, and each plate scrolled in a third of the window. Every
// source is now a band the page's width, drawn as the line over a
// level's station is, as doors in a lattice:
//
//   JLPT         the five levels as doors, the gate as the line's last
//                (LineDoors)
//   Frequency    the pool and the size at the head of the band, the
//                tiers as numbered doors beside them, a door the learner
//                has met words in lit and its foot filled to its share
//   Themes       the filter over the themes, as many to a row as hold a
//                name
//
// A door is a link that pushes (SplitRow's `push`, plan 123): the stop
// is a place left for, and Back comes back here. The pool and the size
// ride in this page's URL, as they do on the tiers' own page, so a
// reload keeps them.
//
// SourcePlate and FrequencyPlate are the kanji's sources' (C1,
// KanjiSources.jsx), which keep their plates under the doors: a line's
// `source` names its tiers' domain, `base` its URL.
const BASE = '/learn/vocab'

const share = (n, total) => `${total > 0 ? Math.min(100, (100 * n) / total) : 0}%`

export default function VocabSources({ session }) {
  const { t } = useLang()
  const cut = useTierCut({ session })
  return (
    <div className="desk-sources desk-sources--doors">
      <LineDoors source="vocab" base={BASE} />
      <TierBand t={t} cut={cut} />
      <ThemesBand t={t} session={session} />
    </div>
  )
}

// `side` stands in the head, at the far end of the title: the kanji's
// tier size and the radicals' stroke rail, where the plate under the
// doors is too short to give its controls a row of their own.
export function SourcePlate({ id, title, fig, desc, tools = null, side = null, className = '', children }) {
  return (
    <section className={`plate desk-source ${className}`.trim()} aria-labelledby={id}>
      <div className="desk-source__head">
        <h2 className="desk-source__title" id={id}>{title}</h2>
        {fig != null && <span className="desk-source__fig">{fig}</span>}
        {side}
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
// plan 123): the tiers' doors and the themes'.
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

// One answer per path, shared with every plate and station that asks
// the same (lib/cachedJson, plan 211): walking the size and the pool
// fast asks each cut once, and a cut walked back to is drawn at once.
// undefined while the path's answer is on its way, null when it failed.
// What the learner has met moves when a run ends, so it is kept briefly.
const useJson = (path, session, ttlMs = CONTENT_TTL_MS) => useCachedJson(path, session, { ttlMs })

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
  const started = useJson(`/api/frequency/${domain}/tiers/started?tier_size=${size}`, session, MINE_TTL_MS)?.started ?? {}
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

// The pool over the size, each switch at its column's width, as the
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

// The kanji's tiers (C1): a row each under the size, its number, its
// range, a bar of the cards met and how many.
export function FrequencyPlate({ t, session, source = 'vocab', base = BASE, pools = true, title = t.byFrequency }) {
  const cut = useTierCut({ session, source, base, pools })
  return (
    <SourcePlate
      id="desk-source-freq"
      title={title}
      side={<CutTools t={t} cut={cut} />}
      className="desk-source--tiers"
    >
      {cut.loading ? <Loading tight /> : <Rows label={t.byFrequencyShort} className="desk-source__rows--scroll">
        {cut.tiers.map((tr, i) => {
          const met = cut.started[String(tr.tier)] ?? 0
          return (
            <Link
              key={tr.tier}
              to={cut.at(tr.tier)}
              className={`desk-source__row desk-source__row--tier${met > 0 ? ' desk-source__row--met' : ''}`}
              tabIndex={i === 0 ? 0 : -1}
              onClick={click}
            >
              <span className="desk-source__code">{tr.tier}</span>
              <span className="desk-source__label">{tierLabelFor(tr.tier, cut.size)}</span>
              <span className="desk-line__bar" aria-hidden="true">
                <i className="desk-line__met" style={{ width: share(met, tr.count) }} />
              </span>
              <span className="desk-source__num">{met > 0 ? met : ''}</span>
            </Link>
          )
        })}
      </Rows>}
    </SourcePlate>
  )
}

// The vocabulary's tiers (C3): a band the page's width, the pool and
// the size at its head, the tiers as doors in a lattice beside them --
// a door's name and its met count in its label (and its tooltip), its
// number and count on its face, its foot filled to the share met.
function TierBand({ t, cut }) {
  return (
    <section className="desk-band desk-band--tiers" aria-labelledby="desk-source-freq">
      <div className="desk-band__head">
        <h2 className="desk-source__title" id="desk-source-freq">{t.byFrequency}</h2>
        <CutTools t={t} cut={cut} />
      </div>
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
    </section>
  )
}

function ThemesBand({ t, session }) {
  const [query, setQuery] = useState('')
  const themes = useJson('/api/themes', session)?.themes
  const labeled = useMemo(() => (themes ?? []).map(th => ({ ...th, label: themeLabelFor(t, th.key) })), [themes, t])
  const q = query.trim().toLowerCase()
  const shown = q ? labeled.filter(th => th.label.toLowerCase().includes(q)) : labeled
  return (
    <section className="desk-band desk-band--themes" aria-labelledby="desk-source-themes">
      <div className="desk-band__head">
        <h2 className="desk-source__title" id="desk-source-themes">{t.byTheme}</h2>
        {labeled.length > 8 && (
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
      </div>
      <Grid label={t.byThemeShort} className="desk-source__rows desk-source__rows--cols">
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
    </section>
  )
}
