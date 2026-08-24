import { useRef, useState } from 'react'
import { useLang } from '../LangContext'
import { playUi } from '../lib/audio'
import AudioPlayer from './AudioPlayer'
import { ImageIcon, StarIcon } from '../components/ui/Icons'

// ── QuestionRenderer ─────────────────────────────────────────
// Takes ONE flattened question (see examService.flattenQuestions) and
// renders the right UI for its `type`. This is the one place that
// needs to grow when a future exam introduces a new question shape —
// ExamRunner itself never branches on type.
//
// Props:
//   question   — flattened question object
//   selected   — the choice id (or piece id) the learner has picked, or null
//   onSelect   — (choiceId) => void
//   revealed   — if true, show correct/incorrect styling (review mode)
//   devMode    — if true, show a "reveal script" toggle for listening
//                questions (never shown to real learners — see AUDIO
//                NOTE below)
export default function QuestionRenderer({ question, selected, onSelect, revealed = false, devMode = false }) {
  switch (question.type) {
    case 'mcq-text':
      return <McqBlock question={question} selected={selected} onSelect={onSelect} revealed={revealed} />
    case 'sentence-order':
      return <SentenceOrderBlock question={question} selected={selected} onSelect={onSelect} revealed={revealed} />
    case 'cloze-passage':
      return <ClozeBlock question={question} selected={selected} onSelect={onSelect} revealed={revealed} />
    case 'reading-passage':
      return <ReadingPassageBlock question={question} selected={selected} onSelect={onSelect} revealed={revealed} />
    case 'table-reading':
      return <TableReadingBlock question={question} selected={selected} onSelect={onSelect} revealed={revealed} />
    case 'listening-mcq':
    case 'listening-situational':
    case 'listening-response':
      return <ListeningBlock question={question} selected={selected} onSelect={onSelect} revealed={revealed} devMode={devMode} />
    default:
      return <div className="exam-unsupported">Unsupported question type: {question.type}</div>
  }
}

// Every row-picking handler in the app plays the same tap feedback
// (see LevelSelector/ModeSelector) — matched here so answering a
// question doesn't feel like a different control language.
function selectWithSound(onSelect, id) {
  playUi('click-mode-selection')
  onSelect(id)
}

// ── Shared choice list ───────────────────────────────────────
// Renders both text and image choices with the app's existing
// mcq-row language (see index.css `.mcq-list`/`.mcq-row`).
//
// EVERY question type goes through here, including sentence-order —
// which used to carry its own hand-inlined copy of this loop over
// `pieces`. That duplicate is why the missing-selected-state bug below
// shipped twice, so the pieces are mapped to the choice shape at the
// call site instead and there is once again one row implementation.
//
// Two states, not one. `--selected` is what the learner picks DURING
// the exam and is the whole point of a control that can be pressed:
// without it, tapping an answer changed a counter and nothing at all
// on the thing actually tapped. `--correct`/`--wrong` are the graded
// verdict and only exist once `revealed` — during a live exam nothing
// may hint at the answer, which is exactly why the two are separate
// classes rather than one shared "active" look.
function ChoiceList({ choices, choiceType = 'text', selected, onSelect, revealed, answer, label }) {
  const { t } = useLang()
  const listRef = useRef(null)

  // A radiogroup has to honour the arrow keys it advertises: assistive
  // tech announces "radio, 2 of 4" precisely because Left/Right move
  // between and check the options. ExamRunner binds those same keys to
  // "previous/next question" globally, so without this a screen-reader
  // user pressing Right to reach choice 3 would land on a different
  // question instead. Handled here, and ExamRunner skips any arrow that
  // came from inside a radiogroup.
  //
  // Roving tabindex for the same reason — a radiogroup is ONE tab stop,
  // not four.
  const activeIndex = Math.max(0, choices.findIndex(c => c.id === selected))

  function onKeyDown(e) {
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1
      : 0
    if (!delta) return
    e.preventDefault()
    e.stopPropagation()
    const next = (activeIndex + delta + choices.length) % choices.length
    selectWithSound(onSelect, choices[next].id)
    listRef.current?.querySelectorAll('.mcq-row')[next]?.focus()
  }

  return (
    <>
      {/* A live question is a single-choice group, so it is a radiogroup
          — `aria-pressed` (what these rows used to carry) describes an
          independent toggle and tells a screen-reader user nothing
          about the other three options. Once revealed nothing is
          selectable, so the rows go back to being plain disabled
          buttons rather than radios that lie about being settable. */}
      <div
        ref={listRef}
        className="mcq-list"
        role={revealed ? undefined : 'radiogroup'}
        aria-label={revealed ? undefined : label}
        onKeyDown={revealed ? undefined : onKeyDown}
      >
        {choices.map((choice, i) => {
          const isSelected = selected === choice.id
          const isCorrect = revealed && choice.id === answer
          const isWrong = revealed && isSelected && choice.id !== answer
          const rowClass = [
            'mcq-row',
            !revealed && isSelected && 'mcq-row--selected',
            isCorrect && 'mcq-row--correct',
            isWrong && 'mcq-row--wrong',
          ].filter(Boolean).join(' ')

          // Said in words, not only in red and green: on a correct
          // answer the picked row and the right row are the SAME row,
          // and a learner reading two colours alone can't tell whether
          // they got it right or are being shown what they missed.
          let tag = null
          if (isCorrect) tag = isSelected ? `${t.examYourAnswer} · ${t.examCorrectAnswer}` : t.examCorrectAnswer
          else if (isWrong) tag = t.examYourAnswer

          return (
            <button
              key={choice.id}
              type="button"
              className={rowClass}
              disabled={revealed}
              role={revealed ? undefined : 'radio'}
              aria-checked={revealed ? undefined : isSelected}
              tabIndex={revealed ? undefined : i === activeIndex ? 0 : -1}
              onClick={() => selectWithSound(onSelect, choice.id)}
            >
              <span className="mcq-row__accent" aria-hidden="true" />
              <span className="mcq-row__index">{i + 1}</span>
              {choiceType === 'image' ? (
                <ImagePlaceholder alt={choice.imageAlt} compact />
              ) : (
                <span className="mcq-row__text" lang="ja">{choice.textJp}</span>
              )}
              {tag && <span className="mcq-row__tag">{tag}</span>}
            </button>
          )
        })}
      </div>
      {/* A blank scores the same as a wrong answer but isn't one, and
          the review used to render the two identically — nothing
          highlighted, the row simply looking unengaged. */}
      {revealed && selected == null && (
        <p className="exam-question__blank-note">{t.examNotAnswered}</p>
      )}
    </>
  )
}

// Stand-in for a real exam illustration/photo. Once an illustration
// set is commissioned or generated, swap this for a plain <img> —
// every call site already carries the real alt text, so nothing else
// needs to change.
function ImagePlaceholder({ alt, compact = false }) {
  return (
    <span className={compact ? 'exam-image-placeholder exam-image-placeholder--compact' : 'exam-image-placeholder'}>
      <ImageIcon size={17} className="exam-image-placeholder__icon" />
      <span className="exam-image-placeholder__alt">{alt}</span>
    </span>
  )
}

function McqBlock({ question, selected, onSelect, revealed }) {
  return (
    <div className="exam-question">
      <p className="exam-question__prompt" lang="ja">
        {question.underlineJp ? (
          <PromptWithUnderline text={question.promptJp} underline={question.underlineJp} />
        ) : (
          question.promptJp
        )}
      </p>
      {question.imageAlt && <ImagePlaceholder alt={question.imageAlt} />}
      <ChoiceList
        choices={question.choices}
        choiceType={question.choiceType || 'text'}
        selected={selected}
        onSelect={onSelect}
        revealed={revealed}
        answer={question.answer}
        label={question.promptJp}
      />
    </div>
  )
}

function PromptWithUnderline({ text, underline }) {
  const idx = text.indexOf(underline)
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <span className="exam-underline">{underline}</span>
      {text.slice(idx + underline.length)}
    </>
  )
}

// もんだい2 — ★ sentence ordering. We only ever grade the piece that
// lands in the ★ slot (matching the real exam's answer sheet), but we
// still show all four blanks so the sentence reads naturally.
function SentenceOrderBlock({ question, selected, onSelect, revealed }) {
  const { t } = useLang()
  const { pieces, order, starIndex, contextJp } = question
  const byId = Object.fromEntries(pieces.map(p => [p.id, p]))
  return (
    <div className="exam-question">
      <p className="exam-question__prompt exam-question__prompt--context" lang="ja">{contextJp}</p>
      <div className="exam-order-slots" aria-hidden="true">
        {order.map((pieceId, i) => (
          <span key={i} className={`exam-order-slot${i === starIndex ? ' exam-order-slot--star' : ''}`}>
            {i === starIndex ? <StarIcon size={15} /> : '＿＿＿'}
          </span>
        ))}
      </div>
      <p className="exam-question__hint">{t.examStarHint}</p>
      {/* Pieces already carry `{id, textJp}` — the same shape a choice
          has — so they go through the shared row list rather than a
          second copy of it. */}
      <ChoiceList
        choices={pieces}
        selected={selected}
        onSelect={onSelect}
        revealed={revealed}
        answer={question.answer}
        label={t.examStarHint}
      />
      {revealed && (
        <p className="exam-order-solution" lang="ja">
          {t.examFullSentence} {order.map(id => byId[id].textJp).join(' ')}
        </p>
      )}
    </div>
  )
}

// もんだい3 (grammar) — cloze passage. `question.passage` carries the
// full text template with 【NN】 markers; we highlight the marker for
// the blank currently being answered and mask the others so later
// blanks in the same passage aren't spoiled.
function ClozeBlock({ question, selected, onSelect, revealed }) {
  const { passage, number } = question
  return (
    <div className="exam-question">
      <h4 className="exam-passage__title" lang="ja">{passage.titleJp}</h4>
      <p className="exam-passage__text" lang="ja">
        <ClozeText template={passage.textTemplateJp} activeNumber={number} />
      </p>
      <ChoiceList
        choices={question.choices}
        selected={selected}
        onSelect={onSelect}
        revealed={revealed}
        answer={question.answer}
        label={passage.titleJp}
      />
    </div>
  )
}

function ClozeText({ template, activeNumber }) {
  const parts = template.split(/【(\d+)】/g)
  return (
    <>
      {parts.map((part, i) => {
        if (i % 2 === 0) return <span key={i}>{part}</span>
        const num = Number(part)
        return (
          <span key={i} className={`exam-blank-pill${num === activeNumber ? ' exam-blank-pill--active' : ''}`}>
            {num}
          </span>
        )
      })}
    </>
  )
}

// もんだい4/5 (reading) — passage (plus optional memo) above the question(s).
function ReadingPassageBlock({ question, selected, onSelect, revealed }) {
  const { passage } = question
  return (
    <div className="exam-question">
      <div className="prompt-card exam-passage">
        <p className="exam-passage__text" lang="ja">{passage.textJp}</p>
        {passage.memoJp && (
          <div className="exam-memo" lang="ja">
            {passage.memoJp.split('\n').map((line, i) => <div key={i}>{line || ' '}</div>)}
          </div>
        )}
      </div>
      <p className="exam-question__prompt" lang="ja">{question.promptJp}</p>
      <ChoiceList
        choices={question.choices}
        choiceType={question.choiceType || 'text'}
        selected={selected}
        onSelect={onSelect}
        revealed={revealed}
        answer={question.answer}
        label={question.promptJp}
      />
    </div>
  )
}

// もんだい6 (reading) — flyer/table reading.
//
// No generator emits `table-reading` yet, on purpose: exam_reading_gen.py
// names generalizing this block's hardcoded flyer schema as the
// prerequisite for writing one. It stays here as the target of that
// work rather than being cleared away as unreachable code.
function TableReadingBlock({ question, selected, onSelect, revealed }) {
  const { flyer } = question
  return (
    <div className="exam-question">
      <div className="prompt-card exam-flyer">
        <h4 className="exam-flyer__title" lang="ja">{flyer.titleJp}</h4>
        <p className="exam-flyer__subtitle" lang="ja">{flyer.subtitleJp}</p>
        <p className="exam-flyer__hours" lang="ja">{flyer.hoursJp}</p>
        {flyer.sales.map((sale, i) => (
          <div key={i} className="exam-flyer__row">
            <span className="exam-flyer__dates" lang="ja">{sale.datesJp}</span>
            <span className="exam-flyer__items" lang="ja">{sale.itemsJp}</span>
          </div>
        ))}
        <div className="exam-flyer__weekly">
          {flyer.weeklyJp.map((row, i) => (
            <div key={i} className="exam-flyer__row">
              <span className="exam-flyer__dates" lang="ja">{row.daysJp}</span>
              <span className="exam-flyer__items" lang="ja">{row.itemsJp}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="exam-question__prompt" lang="ja">{question.promptJp}</p>
      <ChoiceList
        choices={question.choices}
        selected={selected}
        onSelect={onSelect}
        revealed={revealed}
        answer={question.answer}
        label={question.promptJp}
      />
    </div>
  )
}

// ── Listening (もんだい1-4) ──────────────────────────────────
// AUDIO NOTE: `question.audioSrc` is null until per-question clips are
// dropped in (see README). The player degrades to a clearly-labelled
// "audio pending" bar rather than silently doing nothing.
//
// The transcript is withheld during the exam and offered in review:
// `scriptJp` ships inside every paper already (study/exam_tts.py builds
// the clip FROM it), and a listening question you got wrong is
// unlearnable without it. The separate `devMode` toggle stays for
// whoever is QAing generated clips against their script BEFORE sitting
// the paper — the one case where it has to be visible while the
// question is still live, and so the one case that still has to be
// kept away from real learners.
function ListeningBlock({ question, selected, onSelect, revealed, devMode }) {
  const { t } = useLang()
  const [showScript, setShowScript] = useState(false)
  const choices = question.choices
  const choiceType = question.choiceType || 'text'

  return (
    <div className="exam-question">
      {question.questionPromptJp && <p className="exam-question__prompt" lang="ja">{question.questionPromptJp}</p>}
      {question.imageAlt && <ImagePlaceholder alt={question.imageAlt} />}

      <AudioPlayer src={question.audioSrc} />

      {devMode && !revealed && (
        <div className="exam-dev-panel">
          <button type="button" className="exam-dev-panel__toggle" onClick={() => setShowScript(s => !s)}>
            {showScript ? 'Hide script (dev)' : 'Show script (dev)'}
          </button>
          {showScript && <p className="exam-dev-panel__script" lang="ja">{question.scriptJp}</p>}
        </div>
      )}

      <ChoiceList
        choices={choices}
        choiceType={choiceType}
        selected={selected}
        onSelect={onSelect}
        revealed={revealed}
        answer={question.answer}
        label={question.questionPromptJp}
      />

      {revealed && question.scriptJp && (
        <details className="exam-transcript">
          <summary className="exam-transcript__summary">{t.examTranscript}</summary>
          <p className="exam-transcript__text" lang="ja">{question.scriptJp}</p>
        </details>
      )}
    </div>
  )
}
