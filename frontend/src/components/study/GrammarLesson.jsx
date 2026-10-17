import { Fragment, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useLang } from '../../LangContext'
import { ApiError } from '../../lib/api'
import { cachedJson, MINE_TTL_MS } from '../../lib/cachedJson'
import { playUi } from '../../lib/audio'
import { useDialog } from '../../hooks/useDialog'
import {
  ChevronIcon, MessageIcon, OpenBookIcon, SlotsIcon, SwapIcon, TableIcon, TextLinesIcon, WarningIcon,
} from '../ui/Icons'
import { ExampleSentence } from '../dictionary/ExampleSentence'
import { StageMark } from './StageMark'
import { FuriganaParts } from './Readings'
import { joinRuns } from '../../domain/rubyRuns'
import { inline, readUse, SHORT_RUN } from './lessonText'
import { GrammarTour } from './GrammarTour'

// ── 文法 — a grammar point, taught (plan 087) ───────────────────
// One lesson, printed in four places: before a NEW card in a run
// (the gate), behind the door on every card and in the station's
// index (the sheet), as the body of the dictionary's grammar plate
// (the plate variant, where the plate itself is already drawn), and
// on the desk's grammar page beside the points.
//
// ── Sections a reader finds at a glance (plan 235) ──
// The owner found the lesson hard to read: three caption-sized marks
// over one wall of hairline-divided prose, the Japanese in the gold
// wherever it appeared, and the formation a grey line above the
// pattern. So the lesson is set in SECTIONS, each opening on a head --
// a glyph in the entry's ink, the name in the primary ink, a hairline
// running on to the column's edge -- and each holding one kind of
// thing:
//
//   Construction  the formation as a formula: the slot to fill, set as
//                 a dashed blank in plain words, then the pattern
//   Règle         the rule, the lesson's one lead sentence
//   Formes        a use line that is a paradigm (Négatif : …. Passé :
//                 ….), as a table: the label beside its forms
//   Emploi        every other use: what it is for, over its forms
//   Attention     the trap, a box on an edge of the due ink
//   Exemples      the sentences, numbered, the translation switch on
//                 the head
//   À ne pas confondre  the rivals, each a door
//
// The gold is the pattern's alone: its forms in the formula, the
// forms the rule sets in bold, the rivals' patterns. The rest of the
// Japanese in the prose is set as Japanese (its face, never cut) in
// the prose's own ink. The sections fall in two columns ('gl-col'):
// the lesson, then the sentences and the rivals -- one after the other
// on a phone, side by side where the desk's grammar page has the room.
//
// A point whose lesson is not written yet (a level before its content
// wave) prints what it has: the formula, the examples.
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
// 今日は" is the description over the two forms, whole; a paradigm
// (Négatif : …. Passé : ….) is its labels beside its forms. A line that
// reads neither way is printed as it came.
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
        <FormsTable rows={shape.table} />
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

// A paradigm as a table (plan 235): each label in its own cell beside
// its forms, rows divided by hairlines, so "le passé négatif" is found
// by running an eye down one column rather than reading a paragraph.
function FormsTable({ rows }) {
  return (
    <dl className="gl-table">
      {rows.map((row, i) => (
        <div key={i} className="gl-table__row">
          <dt className="gl-table__label"><LessonInline text={row.label} /></dt>
          <dd className="gl-table__forms"><Forms forms={row.forms} /></dd>
        </div>
      ))}
    </dl>
  )
}

// A use line that is a paradigm (Négatif : …. Passé : ….): its rows,
// or null.
function paradigm(line) {
  return readUse(line.replace(/^- /, ''))?.table ?? null
}

// ── The formula (plan 235) ──
// "verbe forme en て + から" is a slot to fill, a plus, and the pattern.
// A segment that holds a Latin letter is a slot -- what the learner
// brings, in plain words, drawn as a dashed blank; the rest is the
// pattern, in the lesson's ink, with its furigana where it has a reading
// (中 read なか in "nom + の中で"). The structure's furigana parts are cut
// at the pluses so each piece keeps its own readings. A pattern that
// closes on a gloss in brackets -- "回 (combien de fois)", "中（ちゅう：
// pendant ／ じゅう：tout au long de）" -- is the pattern and a note after
// it, not a slot: the words are about the form, not a place to fill.
const LATIN = /[A-Za-zÀ-ÿ]/
const NOTE = /^(.*?)\s*([（(][^（）()]*[）)])$/

// The parts of `seg` that carry its first `n` characters.
function headParts(seg, n) {
  const out = []
  let left = n
  for (const part of seg) {
    if (left <= 0) break
    const len = [...part.text].length
    if (len <= left || part.reading) out.push(part)
    else out.push({ text: [...part.text].slice(0, left).join('') })
    left -= len
  }
  return out
}

// A segment read as the formula sets it: a slot, or the pattern with
// the note its brackets hold.
function readSegment(seg) {
  const plain = seg.map(p => p.text).join('')
  if (!LATIN.test(plain)) return { pattern: seg }
  const m = plain.match(NOTE)
  if (m && m[1] && !LATIN.test(m[1]) && LATIN.test(m[2])) {
    return { pattern: headParts(seg, [...m[1]].length), note: m[2] }
  }
  return { slot: plain }
}

function formulaSegments(text, parts) {
  const source = parts?.length ? parts : [{ text: text ?? '' }]
  const segs = [[]]
  for (const part of source) {
    if (part.reading) {
      segs[segs.length - 1].push(part)
      continue
    }
    String(part.text).split('+').forEach((piece, i) => {
      if (i > 0) segs.push([])
      if (piece) segs[segs.length - 1].push({ text: piece })
    })
  }
  return segs
    .map(seg => {
      const out = seg.map(p => ({ ...p }))
      if (out[0] && !out[0].reading) out[0].text = out[0].text.trimStart()
      const last = out[out.length - 1]
      if (last && !last.reading) last.text = last.text.trimEnd()
      return out.filter(p => p.text)
    })
    .filter(seg => seg.length)
}

function Formula({ text, parts }) {
  const segs = formulaSegments(text, joinRuns(parts))
  return (
    <p className="gl-formula">
      {segs.map((seg, i) => {
        const { slot, pattern, note } = readSegment(seg)
        return (
          <Fragment key={i}>
            {i > 0 && <span className="gl-formula__plus">+</span>}
            {slot != null
              ? <span className="gl-formula__slot"><LessonInline text={slot} /></span>
              : (
                <span className="gl-formula__pat" lang="ja">
                  {pattern.some(p => p.reading) ? <FuriganaParts parts={pattern} /> : pattern.map(p => p.text).join('')}
                </span>
              )}
            {note && <span className="gl-formula__note"><LessonInline text={note} /></span>}
          </Fragment>
        )
      })}
    </p>
  )
}

// A section's head: its glyph in the entry's ink, its name, and a
// hairline running on to the column's edge -- the divider and the
// label in one line, so no block needs a rule of its own above it.
// `children` stand at the head's end (the translation switch).
const HEAD_ICON = {
  structure: SlotsIcon,
  rule: OpenBookIcon,
  forms: TableIcon,
  use: TextLinesIcon,
  careful: WarningIcon,
  examples: MessageIcon,
  compare: SwapIcon,
}

function SectionHead({ kind, label, children }) {
  const Icon = HEAD_ICON[kind]
  return (
    <div className="gl-sec__head">
      <Icon size={18} className="gl-sec__icon" />
      <h3 className="gl-sec__name">{label}</h3>
      <span className="gl-sec__rule" aria-hidden="true" />
      {children}
    </div>
  )
}

// A sentence's register is worth a word only where the point has one
// of its own and the sentence departs from it: この店はしずかだ under the
// polite です／だ. Under a neutral point every sentence is polite or
// casual by nature, and a tag on each would say nothing.
function registerTag(point, ex, t) {
  if (!point.register || point.register === 'neutral' || !ex.register || ex.register === point.register) return null
  return t.glRegister?.[ex.register] ?? ex.register
}

export function GrammarLesson({ point, variant = 'sheet', onCompare, onBoard, onClose, onBack, onExample }) {
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

  // The steps, sorted into their sections. A use line that reads as a
  // paradigm is the point's forms, set as a table of its own; the rest
  // of the use step prints as it reads, its "- " lines a list. A step
  // of a kind the lesson does not name still prints, as the rule does.
  const rules = steps.filter(s => s.kind === 'rule' || !STEP_KEY[s.kind])
  const cautions = steps.filter(s => s.kind === 'careful')
  const useLines = steps.filter(s => s.kind === 'use')
    .flatMap(s => String(s.text ?? '').split('\n'))
    .filter(line => line.trim())
  const formRows = useLines.flatMap(line => paradigm(line) ?? [])
  const useText = useLines.filter(line => !paradigm(line)).join('\n')

  return (
    <article className={`gl gl--${variant}`}>
      {variant !== 'plate' && (
        /* The plate, as the dictionary draws it: the seal and the level
           in one corner, the way back and the close in the other, the
           pattern over its gloss between them. The formation left the
           plate for the lesson's first section (plan 235). */
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
        <div className="gl-cols">
          <div className="gl-col">
            {point.structure && (
              <section className="gl-sec gl-sec--structure" aria-label={t.glStructure}>
                <SectionHead kind="structure" label={t.glStructure} />
                <Formula text={point.structure} parts={point.structure_furigana} />
              </section>
            )}
            {rules.length > 0 && (
              <section className="gl-sec gl-sec--rule" aria-label={t.glRule}>
                <SectionHead kind="rule" label={t.glRule} />
                <div className="gl-sec__body">
                  {rules.map((step, i) => <StepText key={i} text={step.text} />)}
                </div>
              </section>
            )}
            {formRows.length > 0 && (
              <section className="gl-sec gl-sec--forms" aria-label={t.glForms}>
                <SectionHead kind="forms" label={t.glForms} />
                <FormsTable rows={formRows} />
              </section>
            )}
            {useText && (
              <section className="gl-sec gl-sec--use" aria-label={t.glUse}>
                <SectionHead kind="use" label={t.glUse} />
                <div className="gl-sec__body"><StepText text={useText} /></div>
              </section>
            )}
            {cautions.length > 0 && (
              <section className="gl-sec gl-sec--careful" aria-label={t.glCareful}>
                <SectionHead kind="careful" label={t.glCareful} />
                <div className="gl-sec__body">
                  {cautions.map((step, i) => <StepText key={i} text={step.text} />)}
                </div>
              </section>
            )}
          </div>

          <div className="gl-col">
            {examples.length > 0 && (
              <section className="gl-sec gl-sec--examples" aria-label={t.examples}>
                <SectionHead kind="examples" label={t.examples}>
                  <button type="button" onClick={() => setShowTr(v => !v)} className="gl-tr-toggle">
                    <ChevronIcon direction={showTr ? 'up' : 'down'} size={14} />
                    {showTr ? t.hideTranslation : t.showTranslation}
                  </button>
                </SectionHead>
                <div className="dict-examples">
                  {examples.map((ex, i) => (
                    <ExampleSentence key={i} ex={{ ...ex, segments: ex.furigana }} showTr={showTr}
                                     onOpen={onExample ? () => onExample(ex) : undefined} openLabel={t.showBreakdown}
                                     senseNumber={i + 1} tag={registerTag(point, ex, t)} />
                  ))}
                </div>
              </section>
            )}

            {/* The neighbours, AFTER the sentences. A rival is what you
                reach for once you have read the rule and seen it work —
                above the examples it read as the next lesson rather than as
                the thing this one is confused with, and it stood between a
                learner and the sentences they came for. Plan 089. */}
            {compare.length > 0 && (
              <section className="gl-sec gl-sec--compare" aria-label={t.glCompare}>
                <SectionHead kind="compare" label={t.glConfuse} />
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
          </div>
        </div>

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
    // One request per point however many sheets ask (lib/cachedJson, plan 211).
    cachedJson(`/api/grammar/point?id=${encodeURIComponent(here)}&lang=${lang}`, session, { ttlMs: MINE_TTL_MS })
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
