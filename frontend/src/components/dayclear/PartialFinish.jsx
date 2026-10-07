import { useEffect, useRef } from 'react'
import { useLang } from '../../LangContext'
import { playArrival } from '../../lib/audio'
import { EnterKey } from '../chrome/DeskKeys'
import { ClearHeader, XpTotal, QuietButton, GateButton } from './kit'

// ── 途中下車 — a run that ended with cards left today (plan 191) ───────
// The canvas's Partial board: "Trajet terminé" -- the run's three
// figures (20 révisions, +118 xp, 85 % justes), the day as a loop with
// the day's seal waiting at its end, "14 cartes restent aujourd'hui",
// the tease (~5 min for the day's stamp and the prime de série +55 xp),
// the quiet way back over the gate "Continuer · 14 cartes". A run cut
// short by a chosen length (quota), one lane or the credits ends here.
//
// PLACEHOLDER (foundation): static. The screen agent ports the board and
// owns the `partial` region of index.css and the `clrPartial` locale group.
//
// Props:
//   result   the not-cleared answer: { cleared: false, remaining,
//            seconds_per_review, preview: { streak, bonus, jackpot, milestone } }
//   run      the run's tally ({ cleared, xp, minutes, cards })
//   desk     drawn beside the rail (the composition at the phone's width)
//   reduced  the rest state at once
//   onContinue()  the rest of the day: /today/run
//   onLeave()     the quiet way back: /today
export default function PartialFinish({ result, run, desk, reduced, onContinue, onLeave }) {
  const { t } = useLang()
  const once = useRef(false)
  useEffect(() => {
    if (once.current) return
    once.current = true
    playArrival()
  }, [])

  const cards = run?.cards ?? []
  const right = cards.length ? Math.round((100 * cards.filter(c => c.verdict >= 1).length) / cards.length) : null
  const left = result?.remaining ?? 0
  const minutes = result?.seconds_per_review ? Math.max(1, Math.ceil((left * result.seconds_per_review) / 60)) : null
  const prime = (result?.preview?.bonus ?? 0) + (result?.preview?.jackpot ?? 0)
  return (
    <main id="main-content" className={['ptl', desk && 'ptl--desk', reduced && 'clrk--reduced'].filter(Boolean).join(' ')}>
      <ClearHeader center cap="途中下車" title={t.ptlTitle} />
      <ul className="ptl__figs" aria-label={t.ptlRunAria}>
        <li><b>{run?.cleared ?? cards.length}</b> {t.ptlReviews}</li>
        <li><XpTotal value={run?.xp ?? 0} shine={!reduced} shineDelay={900} /></li>
        {right != null && <li><b>{right}&#8239;%</b> {t.ptlRight}</li>}
      </ul>
      <p className="ptl__left"><b>{left}</b> {t.ptlLeft(left)}</p>
      {minutes != null && <p className="ptl__tease">{t.ptlTease(minutes)} <span className="clrk-xp">+{prime}&#160;xp</span></p>}
      <div className="ptl__actions">
        <QuietButton onClick={onLeave}>{t.backToStation}</QuietButton>
        <GateButton compact arrive keys={desk} label={t.ptlContinue(left)} onClick={onContinue} />
      </div>
      <EnterKey onEnter={onContinue} />
    </main>
  )
}
