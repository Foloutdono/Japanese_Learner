import { formatTimecode } from '../../lib/timecode'

// ── 聞き取り中 — a recording on its way to being heard (plan 265) ──
// The owner's pick B of the canvas "Tsuji analyser — new ways in", row
// 3: in place of the one busy line, a card naming the recording, its
// length and what will be left of the day's listening, and the four
// steps it goes through -- keep the sound, prepare it (the encoding,
// the one step long enough to show its share), send it, hear the
// speech. The steps the browser does can be called off; once the
// sound is sent the recogniser is paid, and the button goes.
//
// `progress` is useAnalyzerSession's: { stage, ratio, title, seconds,
// minutesLeft }. The stages map onto the four steps here and nowhere
// else.
const STEPS = ['keep', 'prepare', 'send', 'hear']
const STEP_OF = { fetch: 0, read: 0, decode: 0, encode: 1, upload: 2, hear: 3 }
// A YouTube video Gemini watches (`kind: 'link'`): the link is sent,
// and the listening is the model's on Google's side.
const LINK_STEPS = ['sendLink', 'hear']
const JAPANESE = /[\u3040-\u30ff\u4e00-\u9fff]/

function Ring({ state, n }) {
  if (state === 'done') {
    return (
      <span className="anl-hear__ring anl-hear__ring--done" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
          <polyline points="5 12 10 17 19 7" />
        </svg>
      </span>
    )
  }
  return <span className={`anl-hear__ring anl-hear__ring--${state}`} aria-hidden="true">{n}</span>
}

export function HearingSteps({ t, progress, onCancel }) {
  if (!progress) return null
  const link = progress.kind === 'link'
  const steps = link ? LINK_STEPS : STEPS
  const at = link ? 1 : (STEP_OF[progress.stage] ?? 3)
  const pct = Math.round((progress.ratio ?? 0) * 100)
  const seconds = progress.seconds
  const left = progress.minutesLeft != null && seconds != null
    ? Math.max(0, progress.minutesLeft - Math.max(1, Math.ceil(seconds / 60)))
    : progress.minutesLeft
  const meta = [
    seconds != null ? formatTimecode(Math.round(seconds)) : null,
    left != null ? t.hearMinutesLeft(left) : null,
  ].filter(Boolean).join(' · ')
  return (
    <section className="anl-hear" aria-label={t.hearLabel}>
      <div className="anl-hear__head">
        {progress.title && <span className="anl-hear__title" lang={JAPANESE.test(progress.title) ? 'ja' : undefined}>{progress.title}</span>}
        {meta && <span className="anl-hear__meta">{meta}</span>}
      </div>
      <ol className="anl-hear__steps">
        {steps.map((key, i) => {
          const state = i < at ? 'done' : i === at ? 'now' : 'next'
          return (
            <li key={key} className={`anl-hear__step anl-hear__step--${state}`} aria-current={state === 'now' ? 'step' : undefined}>
              <Ring state={state} n={i + 1} />
              {key === 'prepare' && state === 'now' ? (
                <span className="anl-hear__body">
                  <span className="anl-hear__line">
                    <span>{t.hearStepPrepare}</span>
                    <span className="anl-hear__pct">{t.hearPercent(pct)}</span>
                  </span>
                  <span className="anl-hear__bar" aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
                </span>
              ) : (
                <span className="anl-hear__label">{t[`hearStep${key[0].toUpperCase()}${key.slice(1)}`]}</span>
              )}
            </li>
          )
        })}
      </ol>
      {at < steps.length - 1 && onCancel && (
        <button type="button" className="btn-secondary anl-hear__cancel" onClick={onCancel}>{t.hearCancel}</button>
      )}
    </section>
  )
}
