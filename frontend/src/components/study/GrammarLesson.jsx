import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useLang } from '../../LangContext'
import { apiJson, ApiError } from '../../lib/api'
import { playUi } from '../../lib/audio'
import { useDialog } from '../../hooks/useDialog'
import { Emphasized } from '../ui/Emphasized'
import { ChevronIcon } from '../ui/Icons'
import { ExampleSentence } from '../dictionary/ExampleSentence'
import { StageMark } from './StageMark'

// ── 文法 — a grammar point, taught (plan 087) ───────────────────
// One lesson, printed in three places: before a NEW card in a run
// (the gate), behind the door on every card and in the station's
// index (the sheet), and as the body of the dictionary's grammar plate
// (the plate variant, where the plate itself is already drawn).
//
// Blocks divided by hairlines and no section headings (DESIGN.md, "a
// body that names itself"): the steps carry their own pair marks
// (規則 RULE, 使い方 USE, 注意 CAREFUL) the way the radical index
// marks a level; a row that opens a neighbour is a door; a sentence
// over its translation is an example. Each block carries its name as
// an aria-label only.
//
// A point whose lesson is not written yet (a level before its content
// wave) prints what it has: formation, meaning, examples — exactly the
// plate as it was.
//
// `point` is any of: /api/grammar/point's body, a dictionary row, or a
// card's embedded `lesson` merged with the card's own identity (see
// GrammarRun). All three carry pattern / structure / meaning / steps /
// compare / examples in the learner's language already.

const STEP_JP = { rule: '規則', use: '使い方', careful: '注意' }
const STEP_KEY = { rule: 'glRule', use: 'glUse', careful: 'glCareful' }

// A step's text: paragraphs, and a run of "- " lines as a list. One
// delimiter (**…**) for emphasis, through Emphasized — the same, and
// the only, markup the locale tables carry.
export function StepText({ text }) {
  const lines = String(text ?? '').split('\n')
  const blocks = []
  for (const line of lines) {
    if (line.startsWith('- ')) {
      const last = blocks[blocks.length - 1]
      if (last?.kind === 'list') last.items.push(line.slice(2))
      else blocks.push({ kind: 'list', items: [line.slice(2)] })
    } else if (line.trim()) {
      blocks.push({ kind: 'p', text: line })
    }
  }
  return blocks.map((b, i) => b.kind === 'list'
    ? <ul key={i} className="gl-step__list">{b.items.map((it, j) => <li key={j}><Emphasized text={it} /></li>)}</ul>
    : <p key={i} className="gl-step__p"><Emphasized text={b.text} /></p>)
}

export function GrammarLesson({ point, variant = 'sheet', onCompare, onBoard, onClose, onBack }) {
  const { t } = useLang()
  const [showTr, setShowTr] = useState(true)
  const steps = point.steps ?? []
  const compare = point.compare ?? []
  const examples = point.examples ?? []
  const stage = point.stage ?? (point.status?.status && point.status.status !== 'not_started' ? point.status.status : 'new')
  const register = point.register ? (t.glRegister?.[point.register] ?? point.register) : null

  return (
    <article className={`gl gl--${variant}`}>
      {variant !== 'plate' && (
        /* The plate, as the dictionary draws it: the seal and the level
           in one corner, the way back and the close in the other, the
           three registers centred between them — formation over the
           pattern over the gloss. */
        <header className="dict-plate gl-plate">
          <div className="dict-plate__row">
            <div className="dict-plate__marks">
              {onBack && (
                <button type="button" onClick={onBack} className="dict-plate__btn dict-plate__back" title={t.back} aria-label={t.back}>
                  <ChevronIcon direction="left" size={16} />
                </button>
              )}
              <StageMark stage={stage} inline />
              {point.level && <span className="dict-plate__level">{point.level}</span>}
            </div>
            <div className="dict-plate__actions">
              {register && <span className="gl-register">{register}</span>}
              {onClose && (
                <button type="button" onClick={onClose} className="dict-plate__btn" title={t.close} aria-label={t.close}>
                  <span aria-hidden="true">✕</span>
                </button>
              )}
            </div>
          </div>
          <div className="dict-plate__stack">
            {point.structure && <div className="dict-plate__structure" lang="ja">{point.structure}</div>}
            <h2 className="dict-plate__word dict-plate__word--word" lang="ja">{point.pattern}</h2>
            {point.meaning && <div className="dict-plate__caption">{point.meaning}</div>}
          </div>
          <div className="dict-plate__stripe" aria-hidden="true" />
        </header>
      )}

      <div className="dict-entry__body gl-body">
        {variant === 'plate' && point.structure && (
          <section className="dict-block gl-block" aria-label={t.formation}>
            <p className="dict-gloss dict-formation" lang="ja">{point.structure}</p>
          </section>
        )}
        {variant === 'plate' && point.meaning && (
          <section className="dict-block gl-block" aria-label={t.meaning}>
            <p className="dict-gloss">{point.meaning}</p>
          </section>
        )}

        {steps.length > 0 && (
          <section className="dict-block gl-block" aria-label={t.glLesson}>
            <ol className="gl-steps">
              {steps.map((step, i) => (
                <li key={i} className={`gl-step gl-step--${step.kind}`}>
                  <div className="dict-mark gl-step__mark">
                    <span className="dict-mark__jp" lang="ja">{STEP_JP[step.kind] ?? step.kind}</span>
                    <span className="dict-mark__name">{t[STEP_KEY[step.kind]] ?? step.kind}</span>
                  </div>
                  <div className="gl-step__body"><StepText text={step.text} /></div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {compare.length > 0 && (
          <section className="dict-block gl-block" aria-label={t.glCompare}>
            <div className="gl-compare">
              {compare.map(rival => {
                const body = (
                  <>
                    <span className="gl-door__body">
                      <span className="gl-door__head">
                        <span className="gl-door__pattern" lang="ja">{rival.pattern}</span>
                        {rival.level && <span className="gl-door__level">{rival.level}</span>}
                        {rival.meaning && <span className="gl-door__gloss">{rival.meaning}</span>}
                      </span>
                      <span className="gl-door__note"><Emphasized text={rival.text} /></span>
                    </span>
                    {onCompare && <ChevronIcon direction="right" size={16} className="gl-door__chev" />}
                  </>
                )
                return onCompare
                  ? (
                    <button key={rival.raw_id ?? rival.pattern} type="button" className="gl-door"
                            onClick={() => { playUi('click-screen-selection'); onCompare(rival.raw_id) }}>
                      {body}
                    </button>
                  )
                  : <div key={rival.raw_id ?? rival.pattern} className="gl-door gl-door--inert">{body}</div>
              })}
            </div>
          </section>
        )}

        {examples.length > 0 && (
          <section className="dict-block gl-block" aria-label={t.examples}>
            <div className="dict-examples">
              {examples.map((ex, i) => (
                <ExampleSentence key={i} ex={{ ...ex, segments: ex.furigana }} showTr={showTr} />
              ))}
            </div>
            <button type="button" onClick={() => setShowTr(v => !v)} className="gl-tr-toggle">
              <ChevronIcon direction={showTr ? 'up' : 'down'} size={14} />
              {showTr ? t.hideTranslation : t.showTranslation}
            </button>
          </section>
        )}

        {variant === 'gate' && (
          <div className="gl-gate__foot">
            <button type="button" className="btn-primary gl-gate__board" onClick={() => { playUi('click-mode-selection'); onBoard?.() }}>
              {t.glBoard}
            </button>
          </div>
        )}
      </div>
    </article>
  )
}

// ── The sheet ───────────────────────────────────────────────────
// The lookup sheet's shell (a portal over whatever opened it, the
// dictionary's own chrome) holding a stack of points: a compare row
// pushes its rival, ‹ pops. `initial` is a lesson already in hand —
// the one a new card carries — so the sheet opens on it without a
// round trip; anything else is fetched by id.
export function GrammarLessonSheet({ id, initial, session, onClose, over = false }) {
  const { t, lang } = useLang()
  const [stack, setStack] = useState([id])
  const [cache, setCache] = useState(() => (initial && initial.raw_id === id ? { [id]: initial } : {}))
  const [error, setError] = useState(null)
  const here = stack[stack.length - 1]
  const point = cache[here]
  const dialogRef = useDialog(onClose, { capture: over })

  useEffect(() => {
    if (point) return undefined
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- start-of-fetch reset that must land with the fetch it announces.
    setError(null)
    apiJson(`/api/grammar/point?id=${encodeURIComponent(here)}&lang=${lang}`, session)
      .then(data => { if (!cancelled) setCache(c => ({ ...c, [here]: data })) })
      .catch(err => { if (!cancelled) setError(err) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [here, lang, session])

  const notFound = error instanceof ApiError && error.status === 404

  return createPortal(
    <div onClick={onClose} className={`dict-sheet__scrim${over ? ' dict-sheet__scrim--over' : ''}`}>
      <div ref={dialogRef} onClick={e => e.stopPropagation()} className="dict-sheet gl-sheet"
           role="dialog" aria-modal="true" aria-label={`${t.glLesson}: ${point?.pattern ?? here}`}>
        {!point && !error && <div className="quiz-loading">{t.loading}</div>}
        {!point && error && (
          <div className="dict-sheet__empty">
            <div className="quiz-loading">{notFound ? t.notAvailable : t.loadError}</div>
            <button type="button" onClick={onClose} className="btn-secondary">{t.close}</button>
          </div>
        )}
        {point && (
          <GrammarLesson
            point={point}
            variant="sheet"
            onClose={onClose}
            onBack={stack.length > 1 ? () => setStack(s => s.slice(0, -1)) : undefined}
            onCompare={rawId => setStack(s => [...s, rawId])}
          />
        )}
      </div>
    </div>,
    document.body,
  )
}
