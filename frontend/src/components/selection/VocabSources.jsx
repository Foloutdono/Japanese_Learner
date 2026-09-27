import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { apiFetch } from '../../lib/api'
import { playUi } from '../../lib/audio'
import { useStats } from '../../stores/stats'
import { useProfileSummary } from '../../stores/profileSummary'
import { deckItems } from '../../domain/lineProgress'
import { DEFAULT_TIER_SIZE, TIER_SIZE_OPTIONS, tierLabelFor } from '../../domain/tiers'
import { themeLabelFor } from '../../domain/themes'
import { useListWalk, WALK_KEYS } from '../../hooks/useListWalk'
import { Seg, Console, ConsoleIndex } from '../chrome/Console'

// ── 机 — the vocabulary's three sources as plates (plan 137) ─────────
// The owner's pick S2 of the station screens canvas. On a phone
// /learn/vocab is three cards — JLPT, frequency, theme — each opening a
// list of its own, and on the desk that page was the three cards and
// the rest of the window empty, a step that only existed because a
// phone shows one list at a time. Here each source is a plate hanging
// the height of the window with its whole list on it, so every stop of
// every source is one click from its platforms:
//
//   JLPT       the five levels as a line, each with its learned / total
//              and, on the learner's own, where they are and how many
//              they have met
//   Frequency  the pool (the deck's words or everything beyond them)
//              and the tier size over the tiers, each with the cards
//              met in it (/api/frequency/{domain}/tiers/started)
//   Themes     the filter over the themes, each with its word count
//
// A row is a link that pushes (SplitRow's `push`, plan 123): the stop is
// a place left for, and Back comes back here. The pool and the size
// ride in this page's URL, as they do on the tiers' own page, so a
// reload keeps them.
//
// The JLPT and frequency plates are exported for the kanji's sources
// (KanjiSources.jsx), which set the same two beside their radicals: a
// line's `source` names its stats and its tiers' domain, `base` its URL.
const LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1']
const BASE = '/learn/vocab'

export default function VocabSources({ session }) {
  const { t } = useLang()
  return (
    <div className="desk-sources">
      <JlptPlate t={t} />
      <FrequencyPlate t={t} session={session} />
      <ThemesPlate t={t} session={session} />
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
      <p className="desk-source__desc">{desc}</p>
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

const click = () => playUi('click-mode-selection')

// `compact`: the rows at their own height rather than sharing the
// plate's, for a plate that stands over another in its column.
export function JlptPlate({ t, source = 'vocab', base = BASE, compact = false }) {
  const stats = useStats().data
  const here = useProfileSummary()?.jlptLevel ?? null
  const rows = LEVELS.map(level => ({ level, ...deckItems(stats, source, level) }))
  const learned = rows.reduce((n, r) => n + r.learned, 0)
  const total = rows.reduce((n, r) => n + r.total, 0)
  const tabStop = LEVELS.includes(here) ? here : LEVELS[0]
  return (
    <SourcePlate
      id="desk-source-jlpt"
      title={t.byLevel}
      fig={total > 0 ? <><b>{learned}</b>/ {total}</> : null}
      desc={t.byLevelDesc}
      className={compact ? 'desk-source--compact' : ''}
    >
      <Rows label={t.stationJlpt} className={compact ? '' : 'desk-source__rows--line'}>
        {rows.map((r, i) => {
          const isHere = r.level === here
          const met = r.started > r.learned
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
                {(isHere || met) && (
                  <span className="desk-source__cap">
                    {isHere && <span className="desk-source__here">{t.levelCurrentMark}</span>}
                    {met && <span>{t.startedNote(r.started)}</span>}
                  </span>
                )}
              </span>
              {r.total > 0 && <span className="desk-source__num"><b>{r.learned}</b>/ {r.total}</span>}
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
    let live = true
    apiFetch(path, session)
      .then(r => (r.ok ? r.json() : null))
      .then(body => { if (live) setGot({ path, body }) })
      .catch(() => { if (live) setGot({ path, body: null }) })
    return () => { live = false }
  }, [path, session])
  // An answer to the path the learner has just left is not this one's.
  return got?.path === path ? got.body : undefined
}

// `pools`: the vocabulary's choice between the deck's words and the
// ones beyond it. The kanji have one ranking, so no switch.
export function FrequencyPlate({ t, session, source = 'vocab', base = BASE, pools = true, title = t.byFrequency, desc = t.byFrequencyDesc }) {
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
  return (
    <SourcePlate
      id="desk-source-freq"
      title={title}
      fig={shown.length > 0 ? t.sourceTiers(shown.length) : null}
      desc={desc}
      tools={(
        <>
          {pools && (
            <Seg
              full
              label={t.byFrequencyShort}
              value={jmdict ? 'jmdict' : 'vocab'}
              onChange={key => choose(key === 'jmdict', size)}
              options={[
                { key: 'vocab', label: t.freqDomainDeck },
                { key: 'jmdict', label: t.freqDomainJmdict },
              ]}
            />
          )}
          {/* The size under the pool, at its width and height and named,
              as the tiers' own page draws it (TierSelector), rather than
              a small pill tucked in the plate's corner. */}
          <div className="desk-source__size">
            <span className="cap" aria-hidden="true">{t.tierSizeLabel}</span>
            <Seg
              full
              label={t.tierSizeLabel}
              value={size}
              onChange={n => choose(jmdict, n)}
              options={TIER_SIZE_OPTIONS.map(n => ({ key: n, label: String(n) }))}
            />
          </div>
        </>
      )}
    >
      <Rows label={t.byFrequencyShort} className="desk-source__rows--scroll">
        {shown.map((tr, i) => {
          const met = started[String(tr.tier)] ?? 0
          return (
            <Link
              key={tr.tier}
              to={at(tr.tier)}
              className={`desk-source__row${i === 0 ? ' desk-source__row--first' : ''}${i === shown.length - 1 ? ' desk-source__row--last' : ''}`}
              tabIndex={i === 0 ? 0 : -1}
              onClick={click}
            >
              <span className="desk-source__ring" aria-hidden="true" />
              <span className="desk-source__code">{tr.tier}</span>
              <span className="desk-source__name"><span className="desk-source__label">{tierLabelFor(tr.tier, size)}</span></span>
              {met > 0 && <span className="desk-source__num">{t.startedNote(met)}</span>}
            </Link>
          )
        })}
      </Rows>
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
      desc={t.byThemeDesc}
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
      <Rows label={t.byThemeShort} className="desk-source__rows--scroll">
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
      </Rows>
    </SourcePlate>
  )
}
