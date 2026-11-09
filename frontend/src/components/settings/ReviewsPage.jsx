import { useEffect, useState } from 'react'
import { useLang } from '../../LangContext'
import { apiJson } from '../../lib/api'
import { playClick } from '../../lib/audio'
import { refreshToday } from '../../stores/today'
import { Seg } from '../chrome/Console'
import { Loading } from '../ui/Loading'
import { SettingsPage, Slip } from './SettingsPage'
import { intlLocale } from '../../lib/locale'

// ── 回復運転 — Settings › Reviews (plan 217) ──────────────────────
// What bounds the day's reviews, as Service bounds its new cards
// (core/review_plan.py). Up to three slips, each only where it says
// something:
//
//   the ceiling   none, 50, 100 or 150 a day -- past it, cards wait for
//                 the next day and the day is cleared on the share; a
//                 ceiling under the learner's own daily load says the
//                 backlog will grow, since it would
//   the catch-up  the one under way, chosen on the comeback sheet: its
//                 share and its day, and the way to stop it
//   time away     an absence declared ahead: its days keep the streak
//                 and the new cards stop two days before it
//
// Every write answers with the plan as it now stands (routes/
// review_plan.py), and the gate is refetched so Today draws it at once.

// The device's own today, as the date fields count.
function localIso(offsetDays = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const dayCount = (from, until) => Math.round((Date.parse(until) - Date.parse(from)) / 86_400_000) + 1

/** Why this absence cannot be saved, as a locale key of rvAwayErr, or null. */
// eslint-disable-next-line react-refresh/only-export-components -- the rule, read by the tests; not a component.
export function awayProblem(from, until, maxDays, today = localIso()) {
  if (!from || !until) return 'missing'
  if (from < today) return 'past'
  if (until < from) return 'order'
  if (dayCount(from, until) > maxDays) return 'long'
  return null
}

export function ReviewsPage({ session }) {
  const { t, lang } = useLang()
  const [plan, setPlan] = useState(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [from, setFrom] = useState(() => localIso(1))
  const [until, setUntil] = useState(() => localIso(7))

  useEffect(() => {
    let live = true
    apiJson('/api/review-plan', session)
      .then(data => { if (live) setPlan(data) })
      .catch(() => { if (live) setFailed(true) })
    return () => { live = false }
  }, [session])

  function write(path, method, body) {
    if (busy) return
    playClick()
    setBusy(true)
    setFailed(false)
    apiJson(path, session, { method, ...(body ? { body: JSON.stringify(body) } : {}) })
      .then(data => { setPlan(data); refreshToday() })
      .catch(() => setFailed(true))
      .finally(() => setBusy(false))
  }

  if (!plan) {
    return (
      <SettingsPage title={t.settingsReviews}>
        {failed ? <p className="hint" role="alert">{t.rvError}</p> : <Loading />}
      </SettingsPage>
    )
  }

  const fmt = new Intl.DateTimeFormat(intlLocale(lang, 'en'), { day: 'numeric', month: 'long' })
  const date = s => fmt.format(new Date(`${s}T12:00:00`))
  const capOptions = [
    { key: 'none', label: t.rvCapNone },
    ...plan.capChoices.map(n => ({ key: String(n), label: String(n) })),
  ]
  const under = plan.reviewCap != null && plan.load > plan.reviewCap
  const catchup = plan.catchup
  const problem = awayProblem(from, until, plan.awayMaxDays)

  return (
    <SettingsPage title={t.settingsReviews}>
      <Slip label={t.rvCapLabel}>
        <span className="slip__hint">{t.rvCapHint}</span>
        <Seg
          full
          className="tdy-seg"
          label={t.rvCapLabel}
          value={plan.reviewCap == null ? 'none' : String(plan.reviewCap)}
          onChange={key => write('/api/review-plan/cap', 'PUT', { reviewCap: key === 'none' ? null : Number(key) })}
          options={capOptions}
        />
        {under && <span className="slip__hint" role="status">{t.rvCapUnder(plan.load)}</span>}
      </Slip>

      {catchup && (
        <Slip label={t.rvCatchupLabel} across>
          <span className="slip__hint">
            <b className="slip__value">
              {catchup.of ? t.rvCatchupSpread(catchup.per_day, catchup.day, catchup.of) : t.rvCatchupGentle(catchup.per_day)}
            </b>
            <br />
            {t.rvCatchupNew}
          </span>
          <button
            type="button"
            className="btn-secondary slip__act"
            disabled={busy}
            data-action="catchup-stop"
            onClick={() => write('/api/review-plan/catchup', 'DELETE')}
          >
            {t.rvCatchupStop}
          </button>
        </Slip>
      )}

      <Slip label={t.rvAwayLabel}>
        <span className="slip__hint">{t.rvAwayHint(plan.awayMaxDays)}</span>
        {plan.away ? (
          <>
            <b className="slip__value">{t.rvAwaySet(date(plan.away.from), date(plan.away.until))}</b>
            <button
              type="button"
              className="btn-secondary slip__act"
              disabled={busy}
              data-action="away-cancel"
              onClick={() => write('/api/review-plan/away', 'DELETE')}
            >
              {t.rvAwayCancel}
            </button>
          </>
        ) : (
          <>
            <div className="agd-times">
              <label className="agd-field">
                <b className="agd-field__name">{t.rvAwayFrom}</b>
                <input type="date" className="field field--page" min={localIso()} value={from} onChange={e => setFrom(e.target.value)} />
              </label>
              <label className="agd-field">
                <b className="agd-field__name">{t.rvAwayUntil}</b>
                <input type="date" className="field field--page" min={from || localIso()} value={until} onChange={e => setUntil(e.target.value)} />
              </label>
            </div>
            {problem && problem !== 'missing' && (
              <span className="slip__hint" role="status">
                {problem === 'long' ? t.rvAwayErr.long(plan.awayMaxDays) : t.rvAwayErr[problem]}
              </span>
            )}
            <button
              type="button"
              className="btn-secondary slip__act"
              disabled={busy || problem != null}
              data-action="away-save"
              onClick={() => write('/api/review-plan/away', 'PUT', { start: from, until })}
            >
              {t.rvAwaySave}
            </button>
          </>
        )}
      </Slip>

      {failed && <p className="hint" role="alert">{t.rvError}</p>}
    </SettingsPage>
  )
}
