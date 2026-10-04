import { createContext, useContext, useRef, useState } from 'react'
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
//   keys       — the desk's (plan 115): the rows name their digit keys
//                (aria-keyshortcuts) and a listening clip answers Space,
//                its cap printed on the player. Never passed on a phone.
//                Revealed, on the desk's review (plan 123), the clip
//                still answers Space and the transcript stands open.
//   passageAside — the desk's too: a reading passage stands flat beside
//                its questions (ExamRunner's .desk-paper), so the block
//                draws the question without it.
//   apart      — the phone's paper (plan 171): the choices are not drawn
//                here but in the answer dock under the page (AnswerTiles,
//                below), so the page holds the question alone -- a prompt
//                set large, a passage that scrolls over its question, a
//                clip round its play button.
export default function QuestionRenderer({ question, selected, onSelect, revealed = false, devMode = false, keys = false, passageAside = false, apart = false }) {
  return (
    <KeysContext.Provider value={keys}>
      <ApartContext.Provider value={apart && !revealed}>
        <QuestionBlock question={question} selected={selected} onSelect={onSelect} revealed={revealed} devMode={devMode} passageAside={passageAside} />
      </ApartContext.Provider>
    </KeysContext.Provider>
  )
}

const ApartContext = createContext(false)

// ── The answer dock's tiles (plan 171) ───────────────────────
// The owner's pick V1 of the canvas "Tsuji — the mock exam on the
// phone": the mark sheet's bubbles carry each answer's own words, docked
// under the page where the thumb is, so the place an answer is given
// never moves whatever the question's length. The same radiogroup as the
// rows (arrows, one tab stop); two by two where four answers are brief,
// one under another where a sentence needs the width.
export function AnswerTiles({ question, selected, onSelect }) {
  const choices = question.choices ?? question.pieces ?? []
  const label = question.promptJp ?? question.questionPromptJp ?? question.passage?.titleJp ?? ''
  return (
    <ChoiceList
      tiles
      choices={choices}
      choiceType={question.choiceType || 'text'}
      selected={selected}
      onSelect={onSelect}
      revealed={false}
      answer={null}
      label={label}
    />
  )
}

// Read by the rows and the player, rather than threaded through every
// block: a provider adds no box.
const KeysContext = createContext(false)

function QuestionBlock({ question, selected, onSelect, revealed, devMode, passageAside }) {
  switch (question.type) {
    case 'mcq-text':
      return <McqBlock question={question} selected={selected} onSelect={onSelect} revealed={revealed} />
    case 'sentence-order':
      return <SentenceOrderBlock question={question} selected={selected} onSelect={onSelect} revealed={revealed} />
    case 'cloze-passage':
      return <ClozeBlock question={question} selected={selected} onSelect={onSelect} revealed={revealed} />
    case 'reading-passage':
      return <ReadingPassageBlock question={question} selected={selected} onSelect={onSelect} revealed={revealed} passageAside={passageAside} />
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
// The longest answer, in signs, that still reads whole in half a paper.
const BRIEF_SIGNS = 8

function ChoiceList({ choices, choiceType = 'text', selected, onSelect, revealed, answer, label, tiles = false }) {
  const { t } = useLang()
  const keys = useContext(KeysContext)
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
  // Four answers of a few signs each -- a reading, a spelling, a word
  // -- are an answer sheet: on the desk they stand two by two (plan
  // 169), where four rows down the paper sent the last two under the
  // docked Previous and Next on a laptop's window. A sentence keeps
  // its row. The phone draws the rows whatever this says.
  const brief = choiceType === 'text' && choices.length === 4
    && choices.every(c => [...(c.textJp ?? '')].length <= BRIEF_SIGNS)

  function onKeyDown(e) {
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1
      : 0
    if (!delta) return
    e.preventDefault()
    e.stopPropagation()
    const next = (activeIndex + delta + choices.length) % choices.length
    selectWithSound(onSelect, choices[next].id)
    listRef.current?.querySelectorAll(tiles ? '.exam-tile' : '.mcq-row')[next]?.focus()
  }

  if (tiles) {
    // Two tiles to a row hold six signs at the lead rung; past that the
    // words step down one, and a sentence takes the row's width.
    const longest = Math.max(0, ...choices.map(c => [...(c.textJp ?? '')].length))
    const tileText = !brief ? 'exam-tile__t exam-tile__t--long'
      : longest > 6 ? 'exam-tile__t exam-tile__t--mid' : 'exam-tile__t'
    return (
      <div
        ref={listRef}
        className={brief ? 'exam-tiles exam-tiles--two' : 'exam-tiles'}
        role="radiogroup"
        aria-label={label}
        onKeyDown={onKeyDown}
      >
        {choices.map((choice, i) => {
          const on = selected === choice.id
          return (
            <button
              key={choice.id}
              type="button"
              className={on ? 'exam-tile exam-tile--on' : 'exam-tile'}
              role="radio"
              aria-checked={on}
              tabIndex={i === activeIndex ? 0 : -1}
              onClick={() => selectWithSound(onSelect, choice.id)}
            >
              <span className="exam-tile__b">{i + 1}</span>
              {choiceType === 'image'
                ? <ImagePlaceholder alt={choice.imageAlt} compact />
                : <span className={tileText} lang="ja">{choice.textJp}</span>}
            </button>
          )
        })}
      </div>
    )
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
        className={brief ? 'mcq-list mcq-list--brief' : 'mcq-list'}
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
              aria-keyshortcuts={keys && !revealed ? String(i + 1) : undefined}
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

// Past this many signs a prompt set at the display rung runs to five
// lines on a phone; it steps down a rung instead.
const LONG_PROMPT = 24

function McqBlock({ question, selected, onSelect, revealed }) {
  const apart = useContext(ApartContext)
  if (apart) {
    return (
      <div className="exam-ask exam-ask--centre">
        <p className={[...(question.promptJp ?? '')].length > LONG_PROMPT ? 'exam-ask__big exam-ask__big--long' : 'exam-ask__big'} lang="ja">
          {question.underlineJp
            ? <PromptWithUnderline text={question.promptJp} underline={question.underlineJp} />
            : <GapText text={question.promptJp} />}
        </p>
        {question.imageAlt && <ImagePlaceholder alt={question.imageAlt} />}
      </div>
    )
  }
  return (
    <div className="exam-question">
      <p className="exam-question__prompt" lang="ja">
        {question.underlineJp ? (
          <PromptWithUnderline text={question.promptJp} underline={question.underlineJp} />
        ) : (
          <GapText text={question.promptJp} />
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
  if (idx === -1) return <GapText text={text} />
  return (
    <>
      <GapText text={text.slice(0, idx)} />
      <span className="exam-underline">{underline}</span>
      <GapText text={text.slice(idx + underline.length)} />
    </>
  )
}

// A paper writes its gap as a run of ＿ (＿＿＿＿, study/exam_grammar_gen.py
// and exam_vocab_gen.py). Printed, the underscores are a line of their
// own; here the run becomes the slot the grammar drill draws (index.css,
// "The gap"), the characters kept to hold its width and for a copy.
const GAP_RUN = /(＿{2,})/

export function GapText({ text }) {
  if (!text || !GAP_RUN.test(text)) return text ?? null
  return text.split(GAP_RUN).map((part, i) => (
    i % 2 ? <span key={i} className="exam-gap">{part}</span> : part
  ))
}

// もんだい2 — ★ sentence ordering. We only ever grade the piece that
// lands in the ★ slot (matching the real exam's answer sheet), but we
// still show all four blanks so the sentence reads naturally.
function SentenceOrderBlock({ question, selected, onSelect, revealed }) {
  const { t } = useLang()
  const { pieces, order, starIndex, contextJp } = question
  const byId = Object.fromEntries(pieces.map(p => [p.id, p]))
  const apart = useContext(ApartContext)
  if (apart) {
    return (
      <div className="exam-ask exam-ask--centre">
        {contextJp && <p className="exam-ask__line" lang="ja"><GapText text={contextJp} /></p>}
        <div className="exam-order-slots exam-ask__slots" aria-hidden="true">
          {order.map((pieceId, i) => (
            <span key={i} className={`exam-order-slot${i === starIndex ? ' exam-order-slot--star' : ''}`}>
              {'＿＿＿'}
              {i === starIndex && <StarIcon size={15} className="exam-order-slot__star" />}
            </span>
          ))}
        </div>
        <p className="exam-ask__hint">{t.examStarHint}</p>
      </div>
    )
  }
  return (
    <div className="exam-question">
      <p className="exam-question__prompt exam-question__prompt--context" lang="ja"><GapText text={contextJp} /></p>
      <div className="exam-order-slots" aria-hidden="true">
        {order.map((pieceId, i) => (
          <span key={i} className={`exam-order-slot${i === starIndex ? ' exam-order-slot--star' : ''}`}>
            {'＿＿＿'}
            {i === starIndex && <StarIcon size={15} className="exam-order-slot__star" />}
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
  // The blank's own marker number, not the section-wide `number` the
  // paper prints: 【1】 is the first blank of this passage whichever
  // question of the section it is (exam/examService.js).
  const { passage, blankNumber, number } = question
  const apart = useContext(ApartContext)
  if (apart) {
    return (
      <div className="exam-ask exam-ask--read">
        <div className="exam-ask__scroll">
          {passage.titleJp && <h4 className="exam-passage__title" lang="ja">{passage.titleJp}</h4>}
          <p className="exam-passage__text" lang="ja">
            <ClozeText template={passage.textTemplateJp} activeNumber={blankNumber ?? number} />
          </p>
        </div>
      </div>
    )
  }
  return (
    <div className="exam-question">
      <h4 className="exam-passage__title" lang="ja">{passage.titleJp}</h4>
      <p className="exam-passage__text" lang="ja">
        <ClozeText template={passage.textTemplateJp} activeNumber={blankNumber ?? number} />
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
// On the desk the passage stands beside them instead (`passageAside`).
function ReadingPassageBlock({ question, selected, onSelect, revealed, passageAside }) {
  const { passage } = question
  const apart = useContext(ApartContext)
  if (apart) {
    return (
      <div className="exam-ask exam-ask--read">
        <div className="exam-ask__scroll"><PassageText passage={passage} /></div>
        <p className="exam-ask__foot" lang="ja"><GapText text={question.promptJp} /></p>
      </div>
    )
  }
  return (
    <div className="exam-question">
      {!passageAside && (
        <div className="prompt-card exam-passage">
          <PassageText passage={passage} />
        </div>
      )}
      <p className="exam-question__prompt" lang="ja"><GapText text={question.promptJp} /></p>
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

// A reading passage's text and its memo: inside the question's card on
// a phone, on its own card beside the questions on the desk.
export function PassageText({ passage }) {
  return (
    <>
      <p className="exam-passage__text" lang="ja">{passage.textJp}</p>
      {passage.memoJp && (
        <div className="exam-memo" lang="ja">
          {passage.memoJp.split('\n').map((line, i) => <div key={i}>{line || ' '}</div>)}
        </div>
      )}
    </>
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
  const apart = useContext(ApartContext)
  return (
    <div className={apart ? 'exam-ask exam-ask--read' : 'exam-question'}>
      <div className={apart ? 'exam-ask__scroll exam-flyer' : 'prompt-card exam-flyer'}>
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
      <p className={apart ? 'exam-ask__foot' : 'exam-question__prompt'} lang="ja"><GapText text={question.promptJp} /></p>
      {!apart && (
        <ChoiceList
          choices={question.choices}
          selected={selected}
          onSelect={onSelect}
          revealed={revealed}
          answer={question.answer}
          label={question.promptJp}
        />
      )}
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
  const keys = useContext(KeysContext)
  const [showScript, setShowScript] = useState(false)
  const apart = useContext(ApartContext)
  const choices = question.choices
  const choiceType = question.choiceType || 'text'

  // The phone's page: the question over the clip, the clip as the ring
  // round its play button (the owner's pick of C5's player for the
  // paper, plan 171); the answers are the dock's.
  if (apart) {
    return (
      <div className="exam-ask exam-ask--centre">
        {question.questionPromptJp && <p className="exam-ask__line" lang="ja">{question.questionPromptJp}</p>}
        {question.imageAlt && <ImagePlaceholder alt={question.imageAlt} />}
        <AudioPlayer src={question.audioSrc} ring />
        {devMode && (
          <div className="exam-dev-panel">
            <button type="button" className="exam-dev-panel__toggle" onClick={() => setShowScript(s => !s)}>
              {showScript ? 'Hide script (dev)' : 'Show script (dev)'}
            </button>
            {showScript && <p className="exam-dev-panel__script" lang="ja">{question.scriptJp}</p>}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="exam-question">
      {question.questionPromptJp && <p className="exam-question__prompt" lang="ja">{question.questionPromptJp}</p>}
      {question.imageAlt && <ImagePlaceholder alt={question.imageAlt} />}

      <AudioPlayer src={question.audioSrc} keyHint={keys} />

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

      {/* Open on the desk's review (plan 123): the card stands whole
          beside its list there, and a listening question is the one a
          clean sheet still lists for this; folded, it folded again on
          every ←/→. */}
      {revealed && question.scriptJp && (
        <details className="exam-transcript" open={keys || undefined}>
          <summary className="exam-transcript__summary">{t.examTranscript}</summary>
          <p className="exam-transcript__text" lang="ja">{question.scriptJp}</p>
        </details>
      )}
    </div>
  )
}
