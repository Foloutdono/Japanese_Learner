import { comboOf, multOf } from '../../domain/duel'

// ── 対戦 — the race's moments (plan 285, the owner's C1) ────────────
// What the run says as it goes, each a thing that leaves by itself and
// takes no pointer: « Partez ! » over the line where the trains leave
// and « Arrivée ! » while the verdict is read; the rush's pill on the
// clock; who just went ahead, over their train; the combo at the head's
// right; and on each answer the note its speed earned by the tile and
// the points flying to the learner's train. Each moment is stamped on
// the run's clock (the server's), and drawn while `now` is inside it.
// All of it is aria-hidden: the totals, the clock and the verdict say
// the same to a screen reader.

/** How long each moment is on the screen. */
export const BAND_MS = 1000
export const PASS_MS = 1500
export const BREAK_MS = 1100
export const ANSWER_MS = 900

/** A word stamped over the race box: « Partez ! », or « Arrivée ! » with the finish's checkers. */
export function Band({ text, finish = false }) {
  return <span className={`pvp-band${finish ? ' pvp-band--finish' : ''}`} aria-hidden="true"><b className="pvp-band__word">{text}</b></span>
}

/** The rush: its pill on the clock. */
export function RushPill({ t, lang }) {
  return <span className="pvp-rushpill" aria-hidden="true"><b className="pvp-rushpill__word">{t.pvpRush}</b><span className="pvp-rushpill__mult">{multOf(2, lang)}</span></span>
}

/** Who just went ahead, over their own train. */
export function Overtake({ me, them, t }) {
  return (
    <span className={`pvp-pass${me ? ' pvp-pass--me' : ''}`} aria-hidden="true">
      <b className="pvp-pass__jp" lang="ja">追い越し</b><span>{me ? t.pvpPassMe : t.pvpPassThem(them)}</span>
    </span>
  )
}

const SPARKS = Array.from({ length: 10 }, (_, i) => i * 36)

/**
 * The combo, at the head's right: the ring fills toward the next tier,
 * the run of right answers in it, the multiplier beside it; a new tier
 * bursts from the ring. A streak of three or more broken says so for a
 * moment. Nothing under it: the ring alone is read in a glance.
 */
export function ComboRing({ streak, tiers, broke, tierAt, now, t, lang }) {
  if (broke && !streak && now - broke.at < BREAK_MS) {
    return (
      <span className="pvp-combo pvp-combo--broke" key={`b${broke.at}`} aria-hidden="true">
        <b className="pvp-combo__x">✕</b>
        <span className="pvp-combo__txt"><small className="pvp-combo__cap">{t.pvpCombo}</small><em className="pvp-combo__lost">{t.pvpComboLost(broke.n)}</em></span>
      </span>
    )
  }
  if (streak < 2) return null
  const { mult, share } = comboOf(streak, tiers)
  const tier = mult >= 3 ? ' pvp-combo--x3' : mult >= 2 ? ' pvp-combo--x2' : mult > 1 ? ' pvp-combo--x15' : ''
  return (
    <span className={`pvp-combo${tier}`} aria-hidden="true">
      <span className="pvp-combo__ring" style={{ '--p': `${Math.round(share * 360)}deg` }}>
        <b className="pvp-combo__n" key={streak}>{streak}</b>
        {tierAt != null && now - tierAt < ANSWER_MS && (
          <span className="pvp-combo__burst" key={tierAt}>{SPARKS.map(a => <i key={a} className="pvp-combo__spark" style={{ '--a': `${a}deg` }} />)}</span>
        )}
      </span>
      <span className="pvp-combo__txt">
        <small className="pvp-combo__cap">{t.pvpCombo}</small>
        {mult > 1 && <b className="pvp-combo__mult" key={mult}>{multOf(mult, lang)}</b>}
      </span>
    </span>
  )
}

/**
 * One answer's moment, at the tile it was given on (`at`, measured in
 * the stage's box when it was picked): a wrong one's cross; a right
 * one's speed note (神速, 快速) at the tile's end, and what it added
 * flying from the tile to the learner's train. Placed once, never moved
 * by its box: the flight is a transform.
 */
export function AnswerFx({ fx, t, lang }) {
  const { at } = fx
  if (!at) return null
  const y = at.y + at.h / 2
  if (!fx.right) {
    return <span className="pvp-cross" style={{ left: at.x + at.w - 18, top: y }} aria-hidden="true">✕</span>
  }
  const from = at.x + at.w * 0.66
  return (
    <>
      {fx.note && (
        <span className={`pvp-note pvp-note--${fx.note}`} style={{ left: at.x + at.w - 10, top: y }} aria-hidden="true">
          <b className="pvp-note__jp" lang="ja">{fx.note === 'flash' ? '神速' : '快速'}</b><small className="pvp-note__word">{t.pvpNote[fx.note]}</small>
        </span>
      )}
      {at.to && fx.scored > 0 && (
        <span className={`pvp-fly${fx.mult >= 2 || fx.rush ? ' pvp-fly--hot' : ''}`} aria-hidden="true"
          style={{ left: from, top: y, '--dx': at.to.x - from, '--dy': at.to.y - y }}>
          +{fx.scored.toLocaleString(lang)}
          {fx.mult > 1 && <small className="pvp-fly__tag"> {multOf(fx.mult, lang)}</small>}
          {fx.rush && <small className="pvp-fly__tag"> {t.pvpRush.toLowerCase()}</small>}
        </span>
      )}
    </>
  )
}

/** Sparks out of a point, for a won duel. */
export function Burst({ n = 20, delay = 0 }) {
  return (
    <span className="pvp-burst" aria-hidden="true" style={{ '--delay': `${delay}s` }}>
      {Array.from({ length: n }, (_, i) => <i key={i} className="pvp-burst__spark" style={{ '--a': `${(i * 360) / n}deg`, '--d': 80 + ((i * 37) % 70) }} />)}
    </span>
  )
}
