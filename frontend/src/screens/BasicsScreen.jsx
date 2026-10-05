import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams, Navigate } from 'react-router-dom'
import { useLang } from '../LangContext'
import { apiJson } from '../lib/api'
import { playUi } from '../lib/audio'
import { board } from '../stores/boarding'
import { useBasics, refreshBasics } from '../stores/basics'
import { useDesk } from '../hooks/useDesk'
import { Leave } from '../components/chrome/Bar'
import SelectionScreen from '../components/selection/SelectionScreen'
import { RouteStops } from '../components/selection/RouteStops'
import { StationSplit } from '../components/selection/StationSplit'
import { GateButton } from '../components/ui/GateButton'
import { Loading } from '../components/ui/Loading'

// ── 基礎 — the basics course's station (plan 186g) ───────────────
// /learn/basics lists the course's fourteen units as the stops of a
// route -- the same rows every line's station draws, the unit the
// course is at ringed -- and /learn/basics/:unit is a unit's page: what
// it teaches, in the order the course deals it (its rules, its words,
// its kanji), each with its bar, the sentences it builds to, and the
// gate. Boarding rides Today's run held to the unit (`?unit=`): its due
// reviews, then its cards never met, each rule opening on its lesson
// (plan 186b), whatever the day's ration -- the learner chose the unit.
//
// On the desk the units stand beside the open unit, as a line's stops
// stand beside a stop's platforms (StationSplit, plan 114), and the bare
// station opens on the unit the course is at.
//
// The course's cards are the lines' own (study/basics.py): progress on a
// unit is progress on N5, and a unit's page is only a way through them.
export default function BasicsScreen({ session }) {
  const { t, lang } = useLang()
  const navigate = useNavigate()
  const { unit: unitId } = useParams()
  const desk = useDesk()
  const { data, failed } = useBasics()
  // A run's reviews move the figures: ask again on every visit.
  useEffect(() => { refreshBasics() }, [])

  const units = data?.units ?? []
  const here = data?.at ? units[data.at - 1]?.id : null
  const stops = units.map(u => ({
    key: u.id,
    code: String(u.unit),
    name: u.jp,
    hint: u.title?.[lang] ?? u.title?.en,
    hereLabel: t.levelCurrentMark,
    learned: u.learned,
    total: u.total,
    started: u.met,
    startedLabel: t.startedNote(u.met),
  }))

  if (!data) {
    return (
      <SelectionScreen title={t.basicsTitle} aside={<Leave to="/learn">{t.tabLearn}</Leave>}>
        {failed ? <p className="hint" role="alert">{t.homeFeedDown}</p> : <Loading />}
      </SelectionScreen>
    )
  }
  if (unitId && !units.some(u => u.id === unitId)) return <Navigate replace to="/learn/basics" />

  // ── The station: the units ──
  if (!unitId) {
    if (desk) return <Navigate replace to={`/learn/basics/${here ?? units[0]?.id}`} />
    return (
      <SelectionScreen title={t.basicsTitle} aside={<Leave to="/learn">{t.tabLearn}</Leave>}>
        <RouteStops stops={stops} here={here} onSelect={id => navigate(`/learn/basics/${id}`)} />
      </SelectionScreen>
    )
  }

  const page = <UnitPage key={unitId} unitId={unitId} session={session} />

  if (desk) {
    return (
      <SelectionScreen title={t.basicsTitle} aside={<Leave to="/learn">{t.tabLearn}</Leave>}>
        <StationSplit
          className="desk-split--line"
          label={t.basicsUnits}
          list={<RouteStops stops={stops} here={here} selected={unitId} linkTo={id => `/learn/basics/${id}`} figured />}
        >
          {page}
        </StationSplit>
      </SelectionScreen>
    )
  }

  const open = units.find(u => u.id === unitId)
  return (
    <SelectionScreen
      title={t.basicsTitle}
      sub={open?.jp}
      aside={<Leave to="/learn/basics">{t.basicsUnits}</Leave>}
    >
      {page}
    </SelectionScreen>
  )
}

// ── A unit's page ────────────────────────────────────────────────
function UnitPage({ unitId, session }) {
  const { t, lang } = useLang()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [unit, setUnit] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    apiJson(`/api/basics/${encodeURIComponent(unitId)}?lang=${lang}`, session)
      .then(body => { if (live) setUnit(body) })
      .catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [unitId, lang, session])

  if (failed) return <p className="hint" role="alert">{t.homeFeedDown}</p>
  if (!unit) return <Loading />

  function depart() {
    playUi('click-screen-selection')
    board(() => navigate(`/today/run?unit=${encodeURIComponent(unit.id)}`, { state: { from: pathname } }))
  }

  const title = unit.title?.[lang] ?? unit.title?.en
  return (
    <section className="bsc-unit" aria-label={`${unit.jp} ${title}`}>
      <header className="bsc-unit__head">
        <span className="bsc-unit__of">{t.basicsUnit(unit.unit, unit.of)}</span>
        <span className="bsc-unit__name">
          <span className="bsc-unit__jp" lang="ja">{unit.jp}</span>
          <span className="bsc-unit__title">{title}</span>
        </span>
        <span className="bsc-unit__figs">
          <span className="bsc-unit__fig"><b>{unit.learned}</b> / {unit.total}</span>
          <span className="bsc-unit__met">{t.basicsMetOf(unit.met, unit.total)}</span>
        </span>
        <Bar met={unit.met} learned={unit.learned} total={unit.total} />
      </header>

      <GateButton label={t.depart} onClick={depart} className="bsc-unit__go" data-action="basics-depart" />

      {unit.grammar.length > 0 && (
        <CardList label={t.basicsPoints}>
          {unit.grammar.map(p => (
            <Row key={p.card_id} card={p} jp={p.pattern} meaning={p.meaning} />
          ))}
        </CardList>
      )}
      {unit.vocab.length > 0 && (
        <CardList label={t.basicsWords}>
          {unit.vocab.map(w => (
            <Row key={w.card_id} card={w} jp={w.kanji || w.kana} reading={w.kanji ? w.kana : null} meaning={w.meaning} />
          ))}
        </CardList>
      )}
      {unit.kanji.length > 0 && (
        <CardList label={t.basicsKanji} grid>
          {unit.kanji.map(k => (
            <Row key={k.card_id} card={k} jp={k.kanji} meaning={k.meaning} glyph />
          ))}
        </CardList>
      )}
      {unit.sentences.length > 0 && (
        <section className="bsc-list" aria-label={t.basicsSentences}>
          <h3 className="bsc-list__name">{t.basicsSentences}</h3>
          <ol className="bsc-sentences">
            {unit.sentences.map(s => (
              <li key={s.jp} className="bsc-sentence">
                <span lang="ja" className="bsc-sentence__jp">{s.jp}</span>
                {s.translation && <span className="bsc-sentence__tr">{s.translation}</span>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </section>
  )
}

function CardList({ label, grid = false, children }) {
  return (
    <section className="bsc-list" aria-label={label}>
      <h3 className="bsc-list__name">{label}</h3>
      <ul className={`bsc-rows${grid ? ' bsc-rows--grid' : ''}`}>{children}</ul>
    </section>
  )
}

/** One card of the unit: its Japanese, its meaning, and its bar -- the
 *  card's own progress, new to mastered (plan 147). */
function Row({ card, jp, reading = null, meaning, glyph = false }) {
  return (
    <li className={`bsc-row${glyph ? ' bsc-row--glyph' : ''}${card.met ? ' bsc-row--met' : ''}`} data-card={card.card_id}>
      <span className="bsc-row__jp" lang="ja">{jp}</span>
      {reading && <span className="bsc-row__reading" lang="ja">{reading}</span>}
      <span className="bsc-row__meaning">{meaning}</span>
      <span className="bsc-row__bar" aria-hidden="true">
        <i style={{ width: `${Math.round(Math.min(1, Math.max(0, card.progress ?? 0)) * 100)}%` }} />
      </span>
    </li>
  )
}

/** The unit's make-up: learned in full ink, met but not learned in half
 *  of it -- the stops' own bar (RouteStops). */
function Bar({ met, learned, total }) {
  const share = n => `${total > 0 ? Math.round(Math.min(1, n / total) * 1000) / 10 : 0}%`
  return (
    <span className="bsc-unit__bar" aria-hidden="true">
      <i className="bsc-unit__bar-met" style={{ width: share(met) }} />
      <i className="bsc-unit__bar-learned" style={{ width: share(learned) }} />
    </span>
  )
}
