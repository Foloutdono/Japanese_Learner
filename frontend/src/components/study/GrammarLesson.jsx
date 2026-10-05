import { Fragment, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useLang } from '../../LangContext'
import { apiJson, ApiError } from '../../lib/api'
import { playUi } from '../../lib/audio'
import { useDialog } from '../../hooks/useDialog'
import { ChevronIcon } from '../ui/Icons'
import { ExampleSentence } from '../dictionary/ExampleSentence'
import { StageMark } from './StageMark'
import { FuriganaParts } from './Readings'
import { joinRuns } from '../../domain/rubyRuns'
import { inline, readUse, SHORT_RUN } from './lessonText'
import { GrammarTour } from './GrammarTour'

// ── 文法 — a grammar point, taught (plan 087) ───────────────────
// One lesson, printed in three places: before a NEW card in a run
// (the gate), behind the door on every card and in the station's
// index (the sheet), and as the body of the dictionary's grammar plate
// (the plate variant, where the plate itself is already drawn).
//
// Blocks divided by hairlines and no section headings (DESIGN.md, "a
// body that names itself"): the steps carry their own mark (RULE, USE,
// CAREFUL) the way the radical index marks a level; a row that opens a
// neighbour is a door; a sentence over its translation is an example.
// Each block carries its name as an aria-label only.
//
// The marks were pairs -- 規則 RULE -- until the owner's call of
// 2026-09-21: the Japanese half named a part of a lesson rather than a
// place, which is the caption "Say less" forbids (DESIGN.md), and it
// was carrying the weight the plain-language half should have. The
// name is the mark now, and .dict-mark__name is set to hold the line
// on its own.
//
// A point whose lesson is not written yet (a level before its content
// wave) prints what it has: formation, meaning, examples — exactly the
// plate as it was.
//
// `point` is any of: /api/grammar/point's body, a dictionary row, or a
// card's embedded `lesson` merged with the card's own identity (see
// GrammarRun). All three carry pattern / structure / meaning / steps /
// compare / examples in the learner's language already.

const STEP_KEY = { rule: 'glRule', use: 'glUse', careful: 'glCareful' }

// A pattern or a formation, with its furigana where it has a reading.
function Read({ text, parts }) {
  return parts?.some(part => part.reading) ? <FuriganaParts parts={parts} /> : text
}

// A step's text: paragraphs, and a run of "- " lines as a list. One
// delimiter (**…**) for emphasis -- the same, and the only, markup the
// locale tables carry -- and the Japanese in the prose set as Japanese
// and never cut (lessonText.inline). A use that names its forms prints
// them under it (plan 146): "Pour poser ce dont on parle : わたしは,
// 今日は" is the description over the two forms, whole, in the lesson's
// ink; a paradigm (Négatif : …. Passé : ….) is its labels beside its
// forms. A line that reads neither way is printed as it came.
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
    ? <ul key={i} className="gl-step__list">{b.items.map((it, j) => <UseItem key={j} text={it} />)}</ul>
    : <p key={i} className="gl-step__p"><LessonInline text={b.text} /></p>)
}

// Prose with its Japanese marked: lang="ja" for the face and the
// glyph forms, and .gl-ja so a run (or a formula, A は B です) is one
// unbreakable unit on the line.
export function LessonInline({ text }) {
  return inline(text).map((piece, i) => {
    const body = piece.ja
      ? <span className={`gl-ja${piece.text.length <= SHORT_RUN ? ' gl-ja--word' : ''}`} lang="ja">{piece.text}</span>
      : piece.text
    return piece.strong ? <strong key={i}>{body}</strong> : <Fragment key={i}>{body}</Fragment>
  })
}

function Forms({ forms }) {
  return (
    <span className="gl-forms">
      {forms.map((form, i) => (
        <span key={i} className="gl-form">
          <span className={`gl-form__ja${form.ja.length <= SHORT_RUN ? ' gl-ja--word' : ''}`} lang="ja">{form.ja}</span>
          {form.gloss && <span className="gl-form__gloss"><LessonInline text={form.gloss} /></span>}
        </span>
      ))}
    </span>
  )
}

function UseItem({ text }) {
  const shape = readUse(text)
  if (shape?.table) {
    return (
      <li className="gl-use">
        <dl className="gl-paradigm">
          {shape.table.map((row, i) => (
            <div key={i} className="gl-paradigm__row">
              <dt className="gl-paradigm__label"><LessonInline text={row.label} /></dt>
              <dd className="gl-paradigm__forms"><Forms forms={row.forms} /></dd>
            </div>
          ))}
        </dl>
      </li>
    )
  }
  if (shape) {
    return (
      <li className="gl-use">
        <span className="gl-use__say"><LessonInline text={shape.say} /></span>
        <Forms forms={shape.forms} />
      </li>
    )
  }
  return <li className="gl-use"><span className="gl-use__say"><LessonInline text={text} /></span></li>
}

// A sentence's register is worth a word only where the point has one
// of its own and the sentence departs from it: この店はしずかだ under the
// polite です／だ. Under a neutral point every sentence is polite or
// casual by nature, and a tag on each would say nothing.
function registerTag(point, ex, t) {
  if (!point.register || point.register === 'neutral' || !ex.register || ex.register === point.register) return null
  return t.glRegister?.[ex.register] ?? ex.register
}

export function GrammarLesson({ point, variant = 'sheet', onCompare, onBoard, onClose, onBack }) {
  const { t, lang } = useLang()
  const [showTr, setShowTr] = useState(true)
  // 発見 again (plan 187e): the plate keeps the tour a tap away, from its
  // start or at its scene, and says how the point was first met. Not on
  // the gate, which is the tour's own fallback, nor on a point with none.
  const [replay, setReplay] = useState(null)
  const canReplay = variant !== 'gate' && Boolean(point.tour)
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
            {/* The formation and the pattern with their furigana, as
                the dictionary's plate sets its headword's
                (lesson_payload's structure_furigana and pattern_furigana). */}
            {point.structure && (
              <div className="dict-plate__structure" lang="ja">
                <Read text={point.structure} parts={joinRuns(point.structure_furigana)} />
              </div>
            )}
            <h2 className="dict-plate__word dict-plate__word--word" lang="ja">
              <Read text={point.pattern} parts={point.pattern_furigana} />
            </h2>
            {point.meaning && <div className="dict-plate__caption">{point.meaning}</div>}
          </div>
          <div className="dict-plate__stripe" aria-hidden="true" />
        </header>
      )}

      {replay && (
        <div className="gl-replay">
          <GrammarTour point={point} replay startAt={replay} onBoard={() => setReplay(null)} />
        </div>
      )}

      {!replay && canReplay && (
        <div className="gl-tour">
          {point.tour_record && (
            <p className="gl-tour__record">
              {t.tourRecord(
                new Date(point.tour_record.done_at).toLocaleDateString(lang, { day: 'numeric', month: 'short' }),
                point.tour_record.tries, point.tour_record.helped,
              )}
            </p>
          )}
          <div className="gl-tour__ghosts">
            <button type="button" className="btn-secondary" onClick={() => { playUi('click-screen-selection'); setReplay('look') }} data-action="replay">
              {t.tourReplay}
            </button>
            {point.tour.scene && (
              <button type="button" className="btn-secondary" onClick={() => { playUi('click-screen-selection'); setReplay('scene') }} data-action="replay-scene">
                {t.tourReplayScene}
              </button>
            )}
          </div>
        </div>
      )}

      {!replay && <div className="dict-entry__body gl-body">
        {/* The plate variant opens on the lesson. It used to open on
            two blocks reprinting the formation and the gloss — and it
            is the ONE variant where the plate above has already printed
            both (DictionaryDetail's dict-plate__structure and
            dict-plate__caption), so they said everything twice and
            pushed the first step below the fold. The sheet and the gate draw
            their own plate above, which carries the same two registers,
            so neither ever printed them either. Plan 089.

            The caption they used to back up is no longer clamped for a
            grammar point (.dict-plate__caption--whole): a clamp defers
            to a fuller copy in the body, and there is no longer one. */}
        {steps.length > 0 && (
          <section className="dict-block gl-block gl-block--steps" aria-label={t.glLesson}>
            <ol className="gl-steps">
              {steps.map((step, i) => (
                <li key={i} className={`gl-step gl-step--${step.kind}`}>
                  <div className="dict-mark gl-step__mark">
                    <span className="dict-mark__name">{t[STEP_KEY[step.kind]] ?? step.kind}</span>
                  </div>
                  <div className="gl-step__body"><StepText text={step.text} /></div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {examples.length > 0 && (
          <section className="dict-block gl-block gl-block--examples" aria-label={t.examples}>
            <div className="dict-examples">
              {examples.map((ex, i) => (
                <ExampleSentence key={i} ex={{ ...ex, segments: ex.furigana }} showTr={showTr}
                                 senseNumber={i + 1} tag={registerTag(point, ex, t)} />
              ))}
            </div>
            <button type="button" onClick={() => setShowTr(v => !v)} className="gl-tr-toggle">
              <ChevronIcon direction={showTr ? 'up' : 'down'} size={14} />
              {showTr ? t.hideTranslation : t.showTranslation}
            </button>
          </section>
        )}

        {/* The neighbours, AFTER the sentences. A rival is what you
            reach for once you have read the rule and seen it work —
            above the examples it read as the next lesson rather than as
            the thing this one is confused with, and it stood between a
            learner and the sentences they came for. Plan 089. */}
        {compare.length > 0 && (
          <section className="dict-block gl-block gl-block--compare" aria-label={t.glCompare}>
            <div className="gl-compare">
              {compare.map(rival => {
                const body = (
                  <>
                    <span className="gl-door__body">
                      <span className="gl-door__head">
                        <span className="gl-door__pattern" lang="ja"><Read text={rival.pattern} parts={rival.furigana} /></span>
                        {rival.level && <span className="gl-door__level">{rival.level}</span>}
                        {rival.meaning && <span className="gl-door__gloss"><LessonInline text={rival.meaning} /></span>}
                      </span>
                      <span className="gl-door__note"><LessonInline text={rival.text} /></span>
                    </span>
                    {onCompare && rival.raw_id && <ChevronIcon direction="right" size={16} className="gl-door__chev" />}
                  </>
                )
                // A written card's rival names no catalogue point
                // (structures.grammar_lesson): no id, so no door.
                return onCompare && rival.raw_id
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

        {variant === 'gate' && (
          <div className="gl-gate__foot">
            <button type="button" className="btn-primary gl-gate__board" onClick={() => { playUi('click-mode-selection'); onBoard?.() }}>
              {t.glBoard}
            </button>
          </div>
        )}
      </div>}
    </article>
  )
}

// ── The stack ───────────────────────────────────────────────────
// The points a lesson walks: a compare row pushes its rival, ‹ pops.
// `initial` is a lesson already in hand — the one a new card carries —
// so the lesson opens on it without a round trip; anything else is
// fetched by id. Shared by the sheet and the desk's page
// (GrammarLessonBody), so the two walk their doors the same way.
function useLessonStack(id, initial, session) {
  const { lang } = useLang()
  const [stack, setStack] = useState([id])
  const [cache, setCache] = useState(() => (initial && initial.raw_id === id ? { [id]: initial } : {}))
  const [error, setError] = useState(null)
  const here = stack[stack.length - 1]
  const point = cache[here]

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

  return {
    here,
    point,
    error,
    notFound: error instanceof ApiError && error.status === 404,
    back: stack.length > 1 ? () => setStack(s => s.slice(0, -1)) : undefined,
    compare: rawId => setStack(s => [...s, rawId]),
  }
}

// ── The sheet ───────────────────────────────────────────────────
// The lookup sheet's shell (a portal over whatever opened it, the
// dictionary's own chrome) holding that stack.
export function GrammarLessonSheet({ id, initial, session, onClose, over = false }) {
  const { t } = useLang()
  const { here, point, error, notFound, back, compare } = useLessonStack(id, initial, session)
  const dialogRef = useDialog(onClose, { capture: over })

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
            onBack={back}
            onCompare={compare}
          />
        )}
      </div>
    </div>,
    document.body,
  )
}

// ── 机 — a lesson on the page, beside the points (plan 115) ──────────
// The sheet's lesson without the sheet: the desk's grammar station sets
// the level's points beside the open one's lesson, so a point is one
// click (or ←/→) and there is no dialog, scrim or ✕ to close. The same
// stack: a compare row still walks to its rival, ‹ back.
export function GrammarLessonBody({ id, session }) {
  const { t } = useLang()
  const { point, error, notFound, back, compare } = useLessonStack(id, undefined, session)
  if (!point && !error) return <div className="quiz-loading">{t.loading}</div>
  if (!point) {
    return (
      <div className="dict-sheet__empty">
        <div className="quiz-loading">{notFound ? t.notAvailable : t.loadError}</div>
      </div>
    )
  }
  return <GrammarLesson point={point} variant="sheet" onBack={back} onCompare={compare} />
}
