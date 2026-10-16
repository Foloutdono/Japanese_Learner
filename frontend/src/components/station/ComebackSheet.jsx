import { useEffect, useState } from 'react'
import { useLang } from '../../LangContext'
import { apiJson } from '../../lib/api'
import { playClick, playUi } from '../../lib/audio'
import { track } from '../../lib/track'
import { refreshToday } from '../../stores/today'
import { shutComeback } from '../../stores/dayClear'
import { Sheet } from '../chrome/Sheet'
import { Seg } from '../chrome/Console'
import { useDesk } from '../../hooks/useDesk'
import { useRadioWalk, radioTab } from '../../hooks/useRadioWalk'

// ── 運転再開 — the comeback sheet (plan 217) ──────────────────────
// A learner back from a stretch away met a gate of hundreds of cards,
// and a day that could not be cleared until they were all done. When
// GET /api/today's `review.comeback` names an offer (the reviews the
// gate would print are past a few days of the learner's own load,
// core/review_plan.comeback), the gate opens on this sheet instead:
// one line of welcome, how many cards wait, and three paces as the
// service cards Settings draws for the new cards (.svc):
//
//   Spread out   the backlog over 3, 5 or 7 days, plus a day's own --
//                a figure a day, the days under it (the default, 5)
//   Gently       twenty a day, no end date
//   All now      the gate as it was, and the minutes it takes
//
// Each offer is priced by the server, so the sheet never copies the
// arithmetic. Spread and gently pause the new cards until the learner
// is caught up, and say so. "Let's go" posts the choice
// (POST /api/review-plan/catchup) and the gate redraws on its share.
// Shut any other way, the sheet keeps out of the way for the rest of
// the visit (stores/dayClear's comebackShut) and opens again on the
// next one.
//
// Props:
//   offer             today.review.comeback
//   secondsPerReview  today.seconds_per_review, for the minutes; null
//                     before the learner has a pace
//   session
//   onClose()

const CHOICES = ['spread', 'gentle', 'all']
const DEFAULT_SECONDS = 10


export function ComebackSheet({ offer, secondsPerReview, session, onClose }) {
  const { t } = useLang()
  const desk = useDesk()
  const onWalk = useRadioWalk(desk, { check: true })
  const [choice, setChoice] = useState('spread')
  const [days, setDays] = useState(offer.default_days)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    track('catchup_offer', { owed: offer.owed, away: offer.days_away })
  }, [offer.owed, offer.days_away])

  const spread = offer.spread.find(s => s.days === days) ?? offer.spread[0]
  const minutes = n => Math.max(1, Math.ceil((n * (secondsPerReview || DEFAULT_SECONDS)) / 60))
  const cards = {
    spread: { name: t.cbSpread, figure: t.cbPerDay(spread.per_day), words: t.cbOverDays(spread.days) },
    gentle: { name: t.cbGentle, figure: t.cbPerDay(offer.gentle.per_day), words: t.cbNoEnd },
    all: { name: t.cbAll, figure: t.cbCards(offer.owed), words: t.cbMinutes(minutes(offer.owed)) },
  }

  function close() {
    shutComeback()
    onClose()
  }

  function go() {
    if (busy) return
    playUi('click')
    setBusy(true)
    setFailed(false)
    const body = choice === 'spread' ? { choice, days: spread.days } : { choice }
    apiJson('/api/review-plan/catchup', session, { method: 'POST', body: JSON.stringify(body) })
      .then(() => refreshToday())
      .then(() => onClose())
      .catch(() => setFailed(true))
      .finally(() => setBusy(false))
  }

  return (
    <Sheet open onClose={close} jp={t.cbJp} cap={t.cbCap} label={t.cbLabel} className="tdy-sheet cb-sheet" initialFocus=".cb-sheet .svc--on">
      <div className="cb-lead">
        <p className="cb-lead__hello">{offer.days_away > 1 ? t.cbAway(offer.days_away) : t.cbPiled}</p>
        <p className="slip__hint">{t.cbOwed(offer.owed)}</p>
      </div>
      <div className="svc-grid" role="radiogroup" aria-label={t.cbChoices} onKeyDown={onWalk}>
        {CHOICES.map((key, i) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={choice === key}
            tabIndex={radioTab(desk, i, CHOICES.indexOf(choice))}
            disabled={busy}
            className={`svc${choice === key ? ' svc--on' : ''}`}
            data-choice={key}
            onClick={() => { if (choice !== key) { playClick(); setChoice(key) } }}
          >
            <span className="svc__jp">{cards[key].name}</span>
            <span className="svc__pace">{cards[key].figure}</span>
            <span className="svc__words">{cards[key].words}</span>
          </button>
        ))}
      </div>
      {choice === 'spread' && (
        <Seg
          full
          className="tdy-seg tdy-seg--two"
          label={t.cbDays}
          value={String(spread.days)}
          onChange={key => { playClick(); setDays(Number(key)) }}
          options={offer.spread.map(s => ({ key: String(s.days), label: t.cbDaysN(s.days), sub: t.cbPerDay(s.per_day) }))}
        />
      )}
      {choice !== 'all' && <p className="slip__hint">{t.cbNewPaused}</p>}
      {failed && <p className="hint" role="alert">{t.cbError}</p>}
      <div className="tdy-sheet__foot">
        <button type="button" className="btn-depart btn-depart--sheet" disabled={busy} data-action="catchup-go" onClick={go}>
          <span className="btn-depart__jp">{t.cbGo}</span>
        </button>
      </div>
    </Sheet>
  )
}
