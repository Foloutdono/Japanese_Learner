import { useEffect, useState } from 'react'
import { comboOf } from '../../domain/duel'
import { playDuelResult } from '../../lib/audio'
import { useReducedMotion } from '../dayclear/useReducedMotion'
import { Train } from './Train'
import { Burst } from './RaceFx'

// ── 対戦 — the result, face to face (plan 285, the owner's E4) ───────
// Both trains facing, VS between them, both totals counting up; then a
// tug-of-war bar for each line the scores were made of, lit on the side
// that won it -- speed, the combo, the rush, the share right, the
// flashes; then the verdict with the margin, the grade stamped beside
// it, and what the duel paid (the Elo, a ranked one's; the XP). Every
// figure is the server's (study/duels.lines): nothing here scores. It
// holds nothing: the corrections and the rematch under it are live
// from the first frame. Under reduced motion it is drawn ended. Right
// after a run its sounds go with it (lib/audio/duel.js), and the quiet
// loop under it; a result opened again later is read in silence.

const BAR_AT = 1
const BAR_STEP = 0.28
const VERDICT_AT = 2.6
const GRADE_AT = 3.1
const GAINS_AT = 3.3

function useCountUp(target, { ms = 900, delay = 300, still = false } = {}) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (still) return undefined
    let frame
    const from = performance.now() + delay
    const step = time => {
      const f = Math.max(0, Math.min(1, (time - from) / ms))
      setShown(Math.round(target * (1 - (1 - f) ** 3)))
      if (f < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [target, ms, delay, still])
  return still ? target : shown
}

function Count({ n, lang, ms, delay, still }) {
  return useCountUp(n, { ms, delay, still }).toLocaleString(lang)
}

const pc = (share, lang) => share.toLocaleString(lang, { style: 'percent', maximumFractionDigits: 0 })

/** The lines both runs are read on, each won by the larger figure. */
function barsOf(mine, theirs, rules, t, lang) {
  const share = l => l.rights / Math.max(1, l.answered)
  return [
    { k: t.pvpLines.speed, a: mine.speed, b: theirs.speed },
    rules && { k: t.pvpLines.combo, a: mine.combo, b: theirs.combo, sub: t.pvpInARow(mine.best, theirs.best) },
    rules && { k: t.pvpLines.rush, a: mine.rush, b: theirs.rush },
    { k: t.pvpLines.accuracy, a: share(mine), b: share(theirs), show: v => pc(v, lang) },
    { k: t.pvpLines.flashes, a: mine.flashes, b: theirs.flashes },
  ].filter(Boolean)
}

/** What the duel paid: the Elo a ranked one moved, the XP and the day's share of its cap. */
function Gains({ elo, xp, xpLeft, xpShare, delay, still, t, lang }) {
  return (
    <div className="pvp-vs__gains" style={{ '--d': `${delay}s` }}>
      {elo && (
        <div className="pvp-vs__gain">
          <span className="pvp-vs__gain-k">{t.pvpElo}</span>
          <b className="pvp-vs__gain-fig"><Count n={elo.after} lang={lang} ms={800} delay={delay * 1000 + 100} still={still} /></b>
          <span className={`pvp-elo-move pvp-elo-move--${elo.delta >= 0 ? 'up' : 'down'}`}>
            {elo.delta >= 0 ? '▲' : '▼'} {Math.abs(elo.delta)}
          </span>
        </div>
      )}
      <div className="pvp-vs__gain pvp-vs__gain--xp">
        <span className="pvp-vs__gain-k">XP</span>
        <b className="pvp-vs__gain-fig">+<Count n={xp} lang={lang} ms={800} delay={delay * 1000 + 250} still={still} /></b>
        <span className="pvp-vs__xpbar" style={{ '--xp': xpShare }}><i className="pvp-vs__xpfill" /></span>
        <span className="pvp-vs__gain-sub">{t.pvpXpLeft(xpLeft)}</span>
      </div>
    </div>
  )
}

/** A duel settled: the two runs face to face, line by line (E4). */
export function Versus({ result, them, rules, xpLeft, xpShare, t, lang, sound = false }) {
  const still = useReducedMotion()
  const { outcome, mine, theirs, lines, elo, xp } = result
  const me = lines.mine
  const op = lines.theirs
  const bars = barsOf(me, op, rules, t, lang)
  const gap = Math.abs(mine - theirs)
  const grade = me.grade
  const heat = comboOf(me.best, rules?.tiers).mult
  // Its sounds on its own clock: a line's for the side that won it (the
  // learner's on a tie), the verdict, the grade, the gains.
  const won = bars.map(x => x.a >= x.b).join()
  useEffect(() => {
    if (!sound) return undefined
    const at = still
      ? { vs: 0, lines: 0, step: 0, verdict: 0.1, grade: 0.1, gains: 0.2 }
      : { vs: 0.05, lines: BAR_AT, step: BAR_STEP, verdict: VERDICT_AT, grade: GRADE_AT, gains: GAINS_AT + 0.05 }
    const played = playDuelResult({
      at, outcome, grade, loop: true,
      lines: still ? [] : won.split(',').map(w => w === 'true'),
    })
    return () => played.stop()
  }, [sound, still, outcome, grade, won])
  return (
    <section className={`pvp-vs${still ? ' pvp-vs--still' : ''}`} aria-label={t.pvpVerdict[outcome]}>
      <div className="pvp-vs__head">
        <span className="pvp-vs__side pvp-vs__side--me">
          <Train me mult={heat} />
          <b className="pvp-vs__total"><Count n={mine} lang={lang} still={still} /></b>
          <small className="pvp-vs__who">{t.pvpYou}</small>
        </span>
        <span className="pvp-vs__vs" aria-hidden="true">VS</span>
        <span className="pvp-vs__side pvp-vs__side--them">
          <Train flip />
          <b className="pvp-vs__total"><Count n={theirs} lang={lang} still={still} /></b>
          <small className="pvp-vs__who">{them}</small>
        </span>
      </div>
      <div className="pvp-vs__bars">
        {bars.map((x, i) => {
          const share = x.a + x.b > 0 ? x.a / (x.a + x.b) : 0.5
          const won = x.a === x.b ? 0 : x.a > x.b ? 1 : -1
          const fig = v => (x.show ? x.show(v) : v.toLocaleString(lang))
          return (
            <div className="pvp-vs__bar" key={x.k} style={{ '--d': `${BAR_AT + i * BAR_STEP}s`, '--share': share }}>
              <span className="pvp-vs__k">{x.k}{x.sub && <small className="pvp-vs__k-sub">{x.sub}</small>}</span>
              <span className="pvp-vs__row">
                <b className={`pvp-vs__fig pvp-vs__fig--me${won > 0 ? ' pvp-vs__fig--won' : ''}`}>{fig(x.a)}</b>
                <span className="pvp-vs__track"><i className="pvp-vs__pull" /></span>
                <b className={`pvp-vs__fig${won < 0 ? ' pvp-vs__fig--won' : ''}`}>{fig(x.b)}</b>
              </span>
            </div>
          )
        })}
      </div>
      <div className="pvp-vs__verdict" style={{ '--d': `${VERDICT_AT}s` }}>
        <span className="pvp-vs__words">
          <b className={`pvp-result__word pvp-vs__word pvp-vs__word--${outcome}`}>{t.pvpVerdict[outcome]}</b>
          {outcome !== 'draw' && <small className="pvp-vs__margin">{outcome === 'win' ? t.pvpAhead(gap) : t.pvpBehind(gap)}</small>}
        </span>
        {grade && (
          <span className={`pvp-vs__grade pvp-vs__grade--${grade}`} style={{ animationDelay: `${GRADE_AT}s` }}
            role="img" aria-label={t.pvpGrade(grade)}>{grade}</span>
        )}
      </div>
      <Gains elo={elo} xp={xp} xpLeft={xpLeft} xpShare={xpShare} delay={GAINS_AT} still={still} t={t} lang={lang} />
      {outcome === 'win' && !still && <Burst delay={VERDICT_AT + 0.1} />}
    </section>
  )
}

/**
 * A run with no verdict beside it: the friend has yet to run, or the duel
 * closed. The learner's own train and total, the other's side empty, the
 * word for why, and the run's own lines under it.
 */
export function Alone({ word, note, mine, lines, them, rules, xp, xpLeft, xpShare, t, lang }) {
  const still = useReducedMotion()
  const share = lines ? lines.rights / Math.max(1, lines.answered) : 0
  const rows = lines ? [
    { k: t.pvpLines.speed, v: lines.speed.toLocaleString(lang) },
    rules && { k: t.pvpLines.combo, v: `+${lines.combo.toLocaleString(lang)}` },
    rules && { k: t.pvpLines.rush, v: `+${lines.rush.toLocaleString(lang)}` },
    { k: t.pvpLines.accuracy, v: `${pc(share, lang)} · ${t.pvpRightsOf(lines.rights, lines.answered)}` },
    { k: t.pvpLines.flashes, v: lines.flashes.toLocaleString(lang) },
  ].filter(Boolean) : []
  return (
    <section className={`pvp-vs pvp-vs--alone${still ? ' pvp-vs--still' : ''}`} aria-label={word}>
      <div className="pvp-vs__head">
        <span className="pvp-vs__side pvp-vs__side--me">
          <Train me />
          <b className="pvp-vs__total"><Count n={mine} lang={lang} still={still} /></b>
          <small className="pvp-vs__who">{t.pvpYou}</small>
        </span>
        <span className="pvp-vs__vs" aria-hidden="true">VS</span>
        <span className="pvp-vs__side pvp-vs__side--them pvp-vs__side--empty">
          <Train flip />
          <b className="pvp-vs__total" aria-hidden="true">?</b>
          <small className="pvp-vs__who">{them}</small>
        </span>
      </div>
      <div className="pvp-vs__verdict">
        <span className="pvp-vs__words">
          <b className="pvp-result__word pvp-vs__word">{word}</b>
          <small className="pvp-vs__margin">{note}</small>
        </span>
      </div>
      {rows.length > 0 && (
        <dl className="pvp-vs__sheet">
          {rows.map(r => (
            <div className="pvp-vs__line" key={r.k}><dt className="pvp-vs__line-k">{r.k}</dt><dd className="pvp-vs__line-v">{r.v}</dd></div>
          ))}
        </dl>
      )}
      <Gains xp={xp} xpLeft={xpLeft} xpShare={xpShare} delay={0.6} still={still} t={t} lang={lang} />
    </section>
  )
}
