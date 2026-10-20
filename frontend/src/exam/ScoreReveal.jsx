import { useEffect, useState } from 'react'
import { useLang } from '../LangContext'
import { playCorrect } from '../lib/audio'
import { useReducedMotion } from '../components/dayclear/useReducedMotion'
import { CheckIcon } from '../components/ui/Icons'

// ── 目盛 — the score read off its bar (plan 254) ────────────────────
// The owner's pick A of the canvas "Tsuji — the exam result, animated":
// the bar fills from empty in the neutral ink, the two figures counting
// with it; the target's tick lights as the fill passes it, a ring going
// out from it once, and the correct chime sounds then. Landed, the bar and
// the percentage take the verdict's ink, the part still owed to the
// target is hatched, and the line under the bar says it: Target reached,
// or how many answers short. That line's room is held from the first
// frame, so nothing under it moves when it lands.
//
// Half a second's wait, a second and a half's fill. A tap, a click or a
// key ends it at once and is not swallowed -- the press still does what
// it does. `still` draws it ended, as reduced motion does. It is not a
// ceremony (DESIGN.md, Rewards): nothing on the screen waits for it.
//
// `base` is the block's own class family (exam-res on the phone,
// desk-score on the desk) for the figures, the bar and its tick; the
// parts both share are exam-score's. It renders the block's first three
// rows; the caption and the time under them stay the screen's.
const WAIT_MS = 500
const FILL_MS = 1500

const easeOut = x => 1 - (1 - x) ** 3
const cls = (...names) => names.filter(Boolean).join(' ')

export function ScoreReveal({ base, correct, total, pct, target, still = false }) {
  const { t } = useLang()
  const reduced = useReducedMotion()
  const [run, setRun] = useState(still ? 1 : 0)
  const shown = reduced ? 1 : run
  const done = shown >= 1

  useEffect(() => {
    if (done) return undefined
    let raf = 0
    let start = null
    const step = now => {
      start ??= now
      const x = Math.min(1, Math.max(0, (now - start - WAIT_MS) / FILL_MS))
      setRun(easeOut(x))
      if (x < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    const end = () => setRun(1)
    window.addEventListener('pointerdown', end)
    window.addEventListener('keydown', end)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointerdown', end)
      window.removeEventListener('keydown', end)
    }
  }, [done])

  const fill = Math.min(100, Math.max(0, pct))
  const met = pct >= target
  const crossed = met && fill * shown >= target
  // Rounded from the counts, as the percentage is: a pct that rounds up
  // to the target is met, and one under it is short by one at least.
  const short = Math.max(1, Math.ceil((total * target) / 100) - correct)

  useEffect(() => {
    if (crossed) playCorrect()
  }, [crossed])

  const ink = done ? (met ? null : 'low') : (crossed ? null : 'run')
  return (
    <>
      <div className={`${base}__figs`}>
        {/* Held at the final figure's width, so the "/ 25" beside it
            stays where it is while the count gains a digit. */}
        <b className={`${base}__fig`} style={{ minWidth: `${String(correct).length}ch` }}>{Math.round(correct * shown)}</b>
        <span className={`${base}__of`}>/ {total}</span>
        <span className={cls(`${base}__pct`, !done && `${base}__pct--run`, done && !met && `${base}__pct--low`)}>
          {t.percent(Math.round(pct * shown))}
        </span>
      </div>
      <div className={`${base}__bar`} role="img" aria-label={t.examScoreAgainst(pct, target)}>
        {/* The fill is drawn whole and slid in from the left under a
            clip, so the run moves a box rather than resizing one. */}
        <span className="exam-score__run">
          <span
            className={cls('exam-score__fill', ink && `exam-score__fill--${ink}`)}
            style={{ width: `${fill}%`, transform: done ? undefined : `translateX(${(shown - 1) * 100}%)` }}
          />
        </span>
        {done && !met && <span className="exam-score__owed" style={{ left: `${fill}%`, width: `${target - fill}%` }} />}
        <span className={cls(`${base}__tick`, crossed && `${base}__tick--lit`)} style={{ left: `${target}%` }} />
        {crossed && !still && !reduced && <span className="exam-score__ping" style={{ left: `${target}%` }} />}
      </div>
      <div className={cls('exam-score__verdict', !met && 'exam-score__verdict--low', done && 'exam-score__verdict--in')}>
        {met && <CheckIcon size={14} />}
        {met ? t.examTargetReached : t.examTargetShort(short)}
      </div>
    </>
  )
}
