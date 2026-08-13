import { useRef, useState } from 'react'
import { useLang } from '../LangContext'
import { playUi } from '../lib/audio'
import { ImageIcon, SpeakerOffIcon, StarIcon } from '../components/ui/Icons'

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
function ChoiceList({ choices, choiceType = 'text', selected, onSelect, revealed, answer }) {
  return (
    <div className="mcq-list">
      {choices.map((choice, i) => {
        const isSelected = selected === choice.id
        const isCorrect = revealed && choice.id === answer
        const isWrong = revealed && isSelected && choice.id !== answer
        const rowClass = ['mcq-row', isCorrect && 'mcq-row--correct', isWrong && 'mcq-row--wrong'].filter(Boolean).join(' ')
        return (
          <button
            key={choice.id}
            type="button"
            className={rowClass}
            disabled={revealed}
            aria-pressed={isSelected}
            onClick={() => selectWithSound(onSelect, choice.id)}
          >
            <span className="mcq-row__accent" />
            <span className="mcq-row__index">{i + 1}</span>
            {choiceType === 'image' ? (
              <ImagePlaceholder alt={choice.imageAlt} compact />
            ) : (
              <span className="mcq-row__text" lang="ja">{choice.textJp}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// Stand-in for a real exam illustration/photo. Once assets are
// extracted from the source PDFs, swap this for a plain <img> — every
// call site already carries the real alt text, so nothing else needs
// to change.
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
      <div className="mcq-list">
        {pieces.map((piece, i) => {
          const isSelected = selected === piece.id
          const isCorrect = revealed && piece.id === question.answer
          const isWrong = revealed && isSelected && piece.id !== question.answer
          const rowClass = ['mcq-row', isCorrect && 'mcq-row--correct', isWrong && 'mcq-row--wrong'].filter(Boolean).join(' ')
          return (
            <button key={piece.id} type="button" className={rowClass} disabled={revealed} aria-pressed={isSelected} onClick={() => selectWithSound(onSelect, piece.id)}>
              <span className="mcq-row__accent" />
              <span className="mcq-row__index">{i + 1}</span>
              <span className="mcq-row__text" lang="ja">{piece.textJp}</span>
            </button>
          )
        })}
      </div>
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
      <ChoiceList choices={question.choices} selected={selected} onSelect={onSelect} revealed={revealed} answer={question.answer} />
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
            {passage.memoJp.split('\n').map((line, i) => <div key={i}>{line || '\u00A0'}</div>)}
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
      />
    </div>
  )
}

// もんだい6 (reading) — flyer/table reading.
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
      <ChoiceList choices={question.choices} selected={selected} onSelect={onSelect} revealed={revealed} answer={question.answer} />
    </div>
  )
}

// ── Listening (もんだい1-4) ──────────────────────────────────
// AUDIO NOTE: `question.audioSrc` is null until per-question clips are
// dropped in (see README). The player degrades to a clearly-labelled
// "audio pending" bar rather than silently doing nothing, and the
// transcript stays hidden from real learners — it only ever appears
// behind the `devMode` toggle passed down from ExamRunner, for the
// person wiring up/QAing the clips.
function ListeningBlock({ question, selected, onSelect, revealed, devMode }) {
  const { t } = useLang()
  const [showScript, setShowScript] = useState(false)
  const audioRef = useRef(null)
  const choices = question.choices
  const choiceType = question.choiceType || 'text'

  return (
    <div className="exam-question">
      {question.questionPromptJp && <p className="exam-question__prompt" lang="ja">{question.questionPromptJp}</p>}
      {question.imageAlt && <ImagePlaceholder alt={question.imageAlt} />}

      <AudioBar src={question.audioSrc} audioRef={audioRef} t={t} />

      {devMode && (
        <div className="exam-dev-panel">
          <button type="button" className="exam-dev-panel__toggle" onClick={() => setShowScript(s => !s)}>
            {showScript ? 'Hide script (dev)' : 'Show script (dev)'}
          </button>
          {showScript && <p className="exam-dev-panel__script" lang="ja">{question.scriptJp}</p>}
        </div>
      )}

      <ChoiceList choices={choices} choiceType={choiceType} selected={selected} onSelect={onSelect} revealed={revealed} answer={question.answer} />
    </div>
  )
}

function AudioBar({ src, audioRef, t }) {
  if (!src) {
    return (
      <div className="exam-audio-bar exam-audio-bar--pending">
        <SpeakerOffIcon size={16} />
        <span>{t.examAudioPending}</span>
      </div>
    )
  }
  return (
    <div className="exam-audio-bar">
      <audio ref={audioRef} controls src={src} />
    </div>
  )
}
