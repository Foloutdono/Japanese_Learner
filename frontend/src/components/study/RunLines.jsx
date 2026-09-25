import { useEffect, useRef, useState } from 'react'
import { useLang } from '../../LangContext'
import { useRunTally } from '../../stores/runTally'
import { QUALITY_LABEL_KEY } from '../../domain/ratingScales'
import { useListWalk, WALK_KEYS } from '../../hooks/useListWalk'
import { DeskFigure } from './RunRecords'

// ── 机 — the run's lines, the second of a practice run's left panels (plan 128) ──
// What a card run's card panel (CardPanel, plan 126) is to a card, this
// is to a practice run: the panel under this run's figures. A sentence
// does not come back the way a card does, so there is no forecast to
// print; what the width buys instead is the run itself -- every sentence
// so far, each with the grade it got as a dot in the verdict's ink, the
// one on the stage last -- and any of them reopens its breakdown in the
// right column (hooks/useRunLines). The owner's pick of three drawn
// candidates (the lines; the exercise's instruments; the keys alone).
//
//   - The lines: one tab stop, walked with ↑/↓ (hooks/useListWalk, plan
//     123's one walk), the row whose breakdown the right column shows lit
//     -- the sentence on the stage unless another is open. Newest at the
//     foot, kept in view as the run grows.
//   - The keys the elements no longer print on the panels
//     (RunPanelsContext): the run passes its own.
//   - The rhythm, on a sumi foot: minutes since the run started, and
//     sentences a minute (stores/runTally) -- or what the run passes.
//
// No caption on the panel, as on the card panel (owner's cut, plan 126):
// the dots and the lines name themselves.
//
// The asking (問), when it comes: the owner means to add a desk-only
// chatbot for short questions with precise answers. This panel is its
// place -- the list giving up its lower half to it once the sentence on
// the stage is graded, the moment the breakdown opens and for the same
// reason: before the grade an answer to "what does this mean?" is the
// answer key. Not built; recorded in DESIGN.md, "The desk".
//
// Rendered by a run as StudyStage's `panel`, which draws it only on the
// desk's panels; a phone never mounts it.
//
//   lines     the committed lines (useRunLines): { key, jp, quality } --
//             or, where a run's lines are not Japanese sentences (the
//             questions of comprehension), { key, text, lang, quality,
//             answered, verdict }
//   current   the row on the stage: { label, lang, quality } -- its text
//             is the run's to choose, since what may be shown before the
//             grade is the mode's (translation's reference is the
//             answer; dictation's line is unknown until the reveal)
//   openKey   the committed line open in the side, or null
//   onOpen    open a committed line (again: close it); without it the
//             rows are a record, not doors (comprehension's questions
//             while they are asked)
//   onCurrent back to the sentence on the stage
//   keys      [[cap, what it does], …]
//   rhythm    the figures after the minutes, in place of sentences a
//             minute
export function RunLines({ lines = [], current = null, openKey = null, onOpen, onCurrent, keys = [], rhythm, label }) {
  const { t } = useLang()
  const listRef = useRef(null)
  const doors = Boolean(onOpen)
  const onWalk = useListWalk(doors, { items: ':scope > li > button' })
  const pace = useLinesRhythm()
  const figures = [pace.elapsed, ...(rhythm ?? [pace.perMinute])]
  const count = lines.length + (current ? 1 : 0)

  // The newest row in view as the list grows past its panel.
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    list.scrollTop = list.scrollHeight
  }, [count])

  const rows = [
    ...lines.map(l => ({
      key: l.key, text: l.text ?? l.jp, lang: l.lang ?? 'ja', quality: l.quality,
      answered: l.answered, verdict: l.verdict, now: false,
    })),
    ...(current ? [{ key: '\u0000now', text: current.label, lang: current.lang, quality: current.quality, now: true }] : []),
  ]
  const litKey = openKey ?? (current ? '\u0000now' : null)
  const name = label ?? t.deskLinesLabel

  return (
    <section className="desk-run__panel desk-sentences" aria-label={name}>
      {rows.length > 0 && (
        <ol
          ref={listRef}
          className="desk-sentences__list"
          aria-label={name}
          aria-keyshortcuts={doors ? WALK_KEYS : undefined}
          onKeyDown={onWalk}
        >
          {rows.map(r => {
            const lit = r.key === litKey
            const rated = Number.isInteger(r.quality)
            const verdict = r.verdict ?? (rated ? t[QUALITY_LABEL_KEY[r.quality]] : null)
            const classes = [
              'desk-sentence',
              lit && 'desk-sentence--lit',
              r.now && 'desk-sentence--now',
            ].filter(Boolean).join(' ')
            const body = (
              <>
                <span
                  className={`desk-sentence__dot${rated ? ` desk-sentence__dot--q${r.quality}` : r.answered ? ' desk-sentence__dot--answered' : ''}`}
                  aria-hidden="true"
                />
                <span className="desk-sentence__text" lang={r.lang}>{r.text}</span>
                {verdict && <span className="sr-only">{verdict}</span>}
                {r.now && <span className="sr-only">{t.deskLinesNow}</span>}
              </>
            )
            return (
              <li key={r.key}>
                {doors ? (
                  <button
                    type="button"
                    className={classes}
                    aria-current={lit ? 'true' : undefined}
                    tabIndex={lit ? 0 : -1}
                    title={r.text}
                    onClick={() => (r.now ? onCurrent?.() : onOpen(r.key))}
                  >
                    {body}
                  </button>
                ) : (
                  <span className={classes} aria-current={lit ? 'true' : undefined} title={r.text}>{body}</span>
                )}
              </li>
            )
          })}
        </ol>
      )}
      {keys.length > 0 && (
        <div className="desk-keys" role="list" aria-label={t.deskKeysTitle}>
          {keys.map(([cap, what]) => (
            <span key={cap} role="listitem" className="desk-keys__item"><kbd className="desk-kbd">{cap}</kbd>{what}</span>
          ))}
        </div>
      )}
      <div className="desk-rhythm" role="group" aria-label={t.deskRhythm}>
        {figures.map(f => <DeskFigure key={f.label} label={f.label} value={f.value} unit={f.unit} />)}
      </div>
    </section>
  )
}

// Minutes since the run started and sentences a minute, off this run's
// tally -- the card panel's rhythm, less the estimate to finish: a
// practice run has no queue to finish.
function useLinesRhythm() {
  const { t, lang } = useLang()
  const tally = useRunTally()
  const now = useClock(30000)
  const elapsed = tally.startedAt ? Math.max(0, now - tally.startedAt) : 0
  const perMinute = tally.reviewed > 0 && elapsed >= 60000 ? tally.reviewed / (elapsed / 60000) : null
  const decimal = new Intl.NumberFormat(lang === 'fr' ? 'fr-FR' : 'en-GB', { maximumFractionDigits: 1 })
  return {
    elapsed: { label: t.deskElapsed, value: Math.floor(elapsed / 60000), unit: 'min' },
    perMinute: { label: t.deskPerMinuteLines, value: perMinute == null ? '—' : decimal.format(perMinute) },
  }
}

function useClock(everyMs) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs)
    return () => clearInterval(id)
  }, [everyMs])
  return now
}
