import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { apiJson } from '../../lib/api'
import { addDays, journeyModel } from '../../domain/goalMath'
import { MAX_PACE, serviceLabel } from '../onboarding/paces'
import { ContractGrid } from './ContractGrid'
import { GhostTrack } from './GhostTrack'
import { journeyStations } from './stations'

// ── 定期券の裏 — the pass that turns over ───────────────────────
// The /profile CommuterPass gains a reverse side: the ghost train,
// fed by GET /api/journey/status. This wrapper owns the fetch, the
// journeyModel judgement, the flip, the front's one-line footer
// (status word · gold 有効期限 · turn-over control) and the back face
// (track, honest sentence, the two honest moves). The pass itself is
// untouched — the front face renders whatever `renderPass(footer)`
// returns, so the hall's non-flipping pass and this one stay the same
// component (plan 063, phase C).
//
// Fail-open on purpose: no reachable status, or a profile with no
// contract at all, renders renderPass(null) — the pass exactly as it
// was, no footer, no flip. A pass never breaks over its own reverse.
//
// The whole front is a pointer flip control (clicks on interactive
// children are ignored); keyboards and readers get the footer's real
// button, and the hidden face drops out of the tab order via CSS
// visibility, not tabIndex bookkeeping.

const STATUS_JP = {
  suspended: '運転見合わせ',
  ahead: '順調',
  onTime: '定刻',
  slightlyBehind: 'やや遅れ',
  delayed: '遅延',
}

const iso = d => d.toISOString().slice(0, 10)

export function JourneyPass({ session, fallbackStartLevel = null, renderPass }) {
  const { t, lang } = useLang()
  const navigate = useNavigate()
  // status + the clock reading taken when it arrived, as one value:
  // the model and the plan-car's position must agree on "now", and
  // render must stay idempotent — so the impure Date.now() happens in
  // the effect and the handler that deliver the payload, never in
  // render (React purity rules).
  const [journey, setJourney] = useState(null) // { status, nowMs }
  const [volumes, setVolumes] = useState(null)
  const [flipped, setFlipped] = useState(false)
  const [busy, setBusy] = useState(false)
  const [reprintError, setReprintError] = useState(false)

  useEffect(() => {
    let cancelled = false
    apiJson('/api/journey/status', session)
      .then(s => { if (!cancelled) setJourney({ status: s, nowMs: Date.now() }) })
      .catch(() => {})
    // Station positions on the track need the per-level volumes; their
    // failure degrades the drawing (departure + destination only),
    // never the words.
    apiJson('/api/onboarding/volumes', session)
      .then(v => { if (!cancelled) setVolumes(v) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [session])

  const status = journey?.status ?? null
  const nowMs = journey?.nowMs ?? 0
  const model = useMemo(
    () => (status ? journeyModel(status, new Date(nowMs)) : null),
    [status, nowMs],
  )

  if (!model || model.status == null) return renderPass(null)

  const fmt = new Intl.DateTimeFormat(lang === 'fr' ? 'fr' : 'en', {
    day: 'numeric', month: 'short', year: 'numeric',
  })

  async function reprint(body) {
    if (busy) return
    setBusy(true)
    setReprintError(false)
    try {
      // The endpoint answers with the fresh facts — that IS the
      // refetch, and the front's gold 有効期限 reads the new date the
      // moment the card turns back.
      const fresh = await apiJson('/api/journey/reprint', session, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      setJourney({ status: fresh, nowMs: Date.now() })
    } catch {
      setReprintError(true)
    } finally {
      setBusy(false)
    }
  }

  const footer = (
    <div className={`jour-line jour-st--${model.status}`}>
      <span className="jour-line__status">
        <b lang="ja">{STATUS_JP[model.status]}</b>
        <span className="jour-cap">{t.jourStatus[model.status]}</span>
      </span>
      {model.hasGoal && model.planned && (
        <span className="jour-line__validity">
          <span lang="ja">有効期限</span>
          <b>{fmt.format(model.planned)}</b>
        </span>
      )}
      <button
        type="button"
        className="jour-line__turn"
        onClick={() => setFlipped(true)}
        disabled={flipped}
      >
        {t.jourTurnOver} <span lang="ja">裏面</span> ↻
      </button>
    </div>
  )

  // Pointer convenience only — interactive children (the editable
  // username, the footer button itself) keep their own clicks.
  function onFrontClick(e) {
    if (e.target.closest('button, a, input, textarea, select, [contenteditable="true"]')) return
    setFlipped(true)
  }

  return (
    <div className={`jour-flip${flipped ? ' jour-flip--flipped' : ''}`}>
      <div className="jour-flip__inner">
        <div
          className="jour-flip__face jour-flip__face--front"
          onClick={onFrontClick}
          aria-hidden={flipped || undefined}
        >
          {renderPass(footer)}
        </div>
        <div
          className={`jour-flip__face jour-flip__face--back jour-st--${model.status}`}
          aria-hidden={!flipped || undefined}
        >
          <JourneyReverse
            t={t}
            fmt={fmt}
            lang={lang}
            status={status}
            model={model}
            nowMs={nowMs}
            volumes={volumes}
            fallbackStartLevel={fallbackStartLevel}
            busy={busy}
            reprintError={reprintError}
            onFlipBack={() => setFlipped(false)}
            onReprint={reprint}
            onResume={() => navigate('/')}
            onOffice={() => navigate('/settings#goal')}
          />
        </div>
      </div>
    </div>
  )
}

function JourneyReverse({
  t, fmt, lang, status, model, nowMs, volumes, fallbackStartLevel,
  busy, reprintError, onFlipBack, onReprint, onResume, onOffice,
}) {
  const start = status.goalStartLevel ?? fallbackStartLevel
  const stations = journeyStations(volumes, start, status.goalLevel, status.itemsTotal)
  const youF = status.itemsTotal ? (status.itemsDone / status.itemsTotal) * 100 : 0

  // The plan-car rides the line the printed date implies: a straight
  // run from signing to 有効期限 over the whole promise. Moving the
  // date (a reprint) moves the ghost — which is the honesty the
  // reprint buys. A goal-less pass has no printed line, so no ghost:
  // its judgement is pace-kept, in words alone.
  let planF = null
  if (model.hasGoal && model.planned && status.goalSetAt) {
    const setAt = new Date(status.goalSetAt).getTime()
    const span = model.planned.getTime() - setAt
    planF = span <= 0 ? 100 : Math.min(Math.max(((nowMs - setAt) / span) * 100, 0), 100)
  }

  const nf = new Intl.NumberFormat(lang === 'fr' ? 'fr' : 'en', { maximumFractionDigits: 1 })
  const actualStr = nf.format(model.actualPerDay)
  const dest = status.goalLevel

  let foot
  if (model.hasGoal) {
    if (model.status === 'suspended') {
      foot = t.jourFootSuspended(fmt.format(model.planned))
    } else if (model.status === 'ahead') {
      foot = t.jourFootAhead(actualStr, model.plannedPerDay, dest, Math.abs(model.deltaDays), fmt.format(model.projected))
    } else if (model.status === 'onTime') {
      foot = t.jourFootOnTime(actualStr, model.plannedPerDay, dest, fmt.format(model.planned))
    } else {
      foot = t.jourFootBehind(actualStr, model.plannedPerDay, dest, fmt.format(model.projected), model.deltaDays)
    }
  } else {
    foot = model.status === 'suspended'
      ? t.jourFootPaceSuspended(model.plannedPerDay)
      : t.jourFootPaceKept(actualStr, model.plannedPerDay)
  }

  const behind = model.status === 'delayed' || model.status === 'slightlyBehind'
  const canRecover = behind && model.recovery != null && model.recovery <= MAX_PACE
  const gapLabel = model.deltaDays == null
    ? null
    : `${model.deltaDays > 0 ? '+' : '−'}${t.jourDays(Math.abs(model.deltaDays))}`

  return (
    <>
      <div className="jour-rev__head">
        <span className="jour-rev__title">
          <b lang="ja">路線図</b>
          <span className="jour-cap">{t.jourYourLine}</span>
        </span>
        <span className="jour-rev__status">
          <b lang="ja">{STATUS_JP[model.status]}</b>
          <span className="jour-cap">{t.jourStatus[model.status]}</span>
        </span>
        <button type="button" className="jour-rev__turn" onClick={onFlipBack}>
          ↻ <span lang="ja">表面</span>
        </button>
      </div>

      <GhostTrack
        stations={stations}
        youF={youF}
        planF={planF}
        gapDeltaDays={model.deltaDays}
        gapLabel={gapLabel}
        youLabel={t.jourYou}
        planLabel={t.jourPlan}
      />

      <p className="jour-rev__foot">{foot}</p>

      <ContractGrid status={status} start={start} fmt={fmt} t={t} />

      {model.hasGoal && (behind || model.status === 'suspended') && (
        <div className="jour-rev__actions">
          {model.status === 'suspended' ? (
            <>
              <button type="button" className="jour-act" onClick={onResume} disabled={busy}>
                <strong><span lang="ja">運転再開</span>{t.jourActResume}</strong>
                {t.jourActResumeSub}
              </button>
              {model.remaining > 0 && (
                <button
                  type="button"
                  className="jour-act"
                  disabled={busy}
                  onClick={() => onReprint({
                    dailyNewTarget: 5,
                    goalTargetDate: iso(addDays(new Date(), model.remaining / 5)),
                  })}
                >
                  <strong><span lang="ja">再発行</span>{t.jourActSlow(5)}</strong>
                  {t.jourActSlowSub(fmt.format(addDays(new Date(), model.remaining / 5)))}
                </button>
              )}
            </>
          ) : (
            <>
              {canRecover && (
                <button
                  type="button"
                  className="jour-act"
                  disabled={busy}
                  onClick={() => onReprint({ dailyNewTarget: model.recovery })}
                >
                  <strong>
                    <span lang="ja">{serviceLabel(model.recovery).jp}</span>
                    {t.jourActRecover(model.recovery)}
                  </strong>
                  {t.jourActRecoverSub(fmt.format(model.planned))}
                </button>
              )}
              {model.projected && (
                <button
                  type="button"
                  className="jour-act"
                  disabled={busy}
                  onClick={() => onReprint({ goalTargetDate: iso(model.projected) })}
                >
                  <strong><span lang="ja">再発行</span>{t.jourActReprint(fmt.format(model.projected))}</strong>
                  {t.jourActReprintSub(actualStr)}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {!model.hasGoal && (
        <p className="jour-rev__none">
          {t.jourNoDest}{' '}
          <button type="button" className="jour-rev__office" onClick={onOffice}>
            {t.jourNoDestLink}
          </button>
        </p>
      )}

      {reprintError && <p className="jour-rev__error" role="alert">{t.jourReprintError}</p>}
    </>
  )
}

