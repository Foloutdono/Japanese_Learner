import { useState, useEffect } from 'react'
import { useLang } from '../LangContext'
import { playClick } from './sound'
import { Readings, ReadingGroup } from './Readings'
import { DictionaryLookupSheet, SearchIcon, SpeakIcon, speakJapanese } from './DictionaryDetail'

// ── Is the page actually cramped? ──────────────────────────
// Replaces a blind `window.innerWidth < 480` check: that treated
// every phone as tight on space, even ones with a short card and
// plenty of room to spare (nothing to gain by shrinking rows then).
// This checks whether the page genuinely overflows the viewport —
// re-checked on resize and shortly after each render, since layout
// (the reveal animation, the rating bar appearing) can change page
// height without firing a resize event.
function useIsCramped() {
  const [cramped, setCramped] = useState(false)
  useEffect(() => {
    const check = () => setCramped(document.documentElement.scrollHeight > window.innerHeight - 20)
    check()
    window.addEventListener('resize', check)
    const id = window.setTimeout(check, 350)
    return () => {
      window.removeEventListener('resize', check)
      window.clearTimeout(id)
    }
  }, [])
  return cramped
}

// ── Big kana/kanji display ────────────────────────────────
export function CharDisplay({ char, size = 110 }) {
  const isLargeSize = size >= 60
  return (
    <div
      className="char-display"
      style={{
        '--char-size': `${size}px`,
        '--char-font': isLargeSize ? 'var(--font-jp)' : 'inherit',
      }}
    >
      {char}
    </div>
  )
}

// ── MCQ answer row ─────────────────────────────────────────
// An editorial hairline row, not a boxed button — the same visual
// language as LevelSelector/ModeSelector, so the choice always reads
// as "pick a row from a list" everywhere in the app, quiz included.
export function MCQButton({ choice, correct, selected, answered, onClick, index, cramped }) {
  const isCorrect  = choice === correct
  const isSelected = choice === selected

  let variant = ''
  if (answered && isCorrect) variant = ' mcq-row--correct'
  else if (answered && isSelected) variant = ' mcq-row--wrong'

  if (answered && cramped) {
    variant += ' mcq-row--small'
  }

  return (
    <button
      onClick={onClick}
      disabled={answered}
      className={`mcq-row${variant}`}
    >
      <span className="mcq-row__accent" aria-hidden="true" />
      <span className="mcq-row__index">{String(index + 1).padStart(2, '0')}</span>
      <span className="mcq-row__text">{choice}</span>
    </button>
  )
}

// Digit row shortcuts for the first 4 choices. On an AZERTY keyboard
// the unshifted number row types &é"' rather than 1234, so both sets
// are mapped to the same indices — whichever layout someone's on,
// the physical top-row keys 1-4 answer choices 1-4.
const CHOICE_KEY_INDEX = { '1': 0, '2': 1, '3': 2, '4': 3, '&': 0, 'é': 1, '"': 2, "'": 3 }

// ── MCQ choices list ───────────────────────────────────────
export function MCQGrid({ choices, correct, selected, answered, onAnswer }) {
  const cramped = useIsCramped()

  // One shared entry point for an answer, whether it came from a
  // mouse click on MCQButton or a number-key shortcut below — so the
  // click sound never gets forgotten on one path but not the other.
  function handleAnswer(choice) {
    playClick()
    onAnswer(choice)
  }

  useEffect(() => {
    if (answered) return
    const handler = e => {
      if (e.repeat) return
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const idx = CHOICE_KEY_INDEX[e.key]
      if (idx !== undefined && idx < choices.length) {
        handleAnswer(choices[idx])
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [choices, answered, onAnswer])

  return (
    <div className="mcq-list">
      {choices.map((choice, i) => (
        <MCQButton
          key={choice}
          choice={choice}
          correct={correct}
          selected={selected}
          answered={answered}
          index={i}
          cramped={cramped}
          onClick={() => handleAnswer(choice)}
        />
      ))}
    </div>
  )
}

// ── Type input + submit + result ──────────────────────────
export function TypeInput({
  value, onChange, onSubmit, submitted, answer,
  placeholder, inputStyle = {}, wrongExtra = null,
}) {
  const { t } = useLang()
  const isCorrect = value.trim().toLowerCase() === answer?.toLowerCase()

  return (
    <div>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { playClick(); onSubmit() } }}
        placeholder={placeholder ?? t.typeAnswer}
        disabled={submitted}
        autoFocus
        className="quiz-input"
        style={inputStyle}
      />
      {!submitted && (
        <button onClick={() => { playClick(); onSubmit() }} className="quiz-submit">
          {t.submit}
        </button>
      )}
      {submitted && (
        <div className={`quiz-result ${isCorrect ? 'quiz-result--correct' : 'quiz-result--wrong'}`}>
          {isCorrect ? t.correct : `${t.wrong} ${answer}`}
          {!isCorrect && wrongExtra}
        </div>
      )}
    </div>
  )
}

// ── Mode toggle ───────────────────────────────────────────
export function ModeToggle({ mode, onChange, modes }) {
  const { t } = useLang()
  const defaultModes = [
    ['qcm', t.modeQCM],
    ['flashcard', t.modeFlashcard],
    ['write', t.modeWrite],
  ]

  return (
    <div className="mode-toggle">
      {(modes ?? defaultModes).map(([key, label]) => (
        <button
          key={key}
          onClick={() => { playClick(); onChange(key) }}
          className={`mode-toggle__btn${mode === key ? ' mode-toggle__btn--active' : ''}`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ── Done message ──────────────────────────────────────────
export function DoneMessage({ onBack }) {
  const { t } = useLang()
  return (
    <div className="quiz-done">
      {t.quizComplete}
      <br /><br />
      <button onClick={() => { playClick(); onBack() }} className="btn-panel">
        {t.backToMenu}
      </button>
    </div>
  )
}

// ── Loading ───────────────────────────────────────────────
export function Loading() {
  const { t } = useLang()
  return (
    <div className="quiz-loading">
      <svg className="quiz-loading__ensor" viewBox="0 0 48 48" aria-hidden="true">
        <circle
          className="quiz-loading__ensor-circle"
          cx="24" cy="24" r="19"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
      <span className="quiz-loading__text">{t.loading}</span>
    </div>
  )
}

// ── Deck progress (à apprendre / en cours / maîtrisé) ─────
export function DeckProgress({ stats }) {
  const { t } = useLang()
  if (!stats || !stats.total) return null

  const { total, new: toLearn, learning, mastered } = stats

  const segments = [
    { key: 'new',      value: toLearn,  color: 'var(--state-new)',      label: t.progressNew },
    { key: 'learning', value: learning, color: 'var(--state-learning)', label: t.progressLearning },
    { key: 'mastered', value: mastered, color: 'var(--state-mastered)', label: t.progressMastered },
  ]

  return (
    <div className="deck-progress">
      <div className="deck-progress__bar">
        {segments.map(s => (
          s.value > 0 && (
            <div
              key={s.key}
              className="deck-progress__segment"
              style={{ width: `${(s.value / total) * 100}%`, background: s.color }}
            />
          )
        ))}
      </div>
      <div className="deck-progress__legend">
        {segments.map(s => (
          <span key={s.key} className="deck-progress__legend-item">
            <span className="deck-progress__dot" style={{ background: s.color }} />
            {s.value}/{total} {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}

// Readings display now lives in ./Readings (imported above) —
// re-exported here too for backward compatibility, since other
// screens still import Readings/ReadingGroup from QuizComponents.
export { Readings, ReadingGroup }

// ── Meaning display ────────────────────────────────────────
// A card's `meaning` field is often several synonyms separated by
// commas/semicolons (e.g. "to eat, to have a meal"). Rather than
// showing them all at the same weight, the first one — the primary
// meaning — is rendered larger and highlighted; the rest sit below it
// as smaller, muted secondary meanings.
function splitMeaningTokens(meaning) {
  return (meaning || '')
    .split(/[,;]/)
    .map(s => s.trim())
    .filter(Boolean)
}

export function MeaningDisplay({ meaning, size = 28, color = 'var(--accent3)', center = true }) {
  const [primary, ...rest] = splitMeaningTokens(meaning)
  if (!primary) return null

  const style = { '--meaning-size': `${size}px`, '--meaning-color': color }

  return (
    <div className={`meaning-display${center ? ' meaning-display--center' : ''}`} style={style}>
      <div className="meaning-display__primary">{primary}</div>
      {rest.length > 0 && (
        <div className="meaning-display__secondary">{rest.join(', ')}</div>
      )}
    </div>
  )
}

// ── Inline reveal panel ──────────────────────────────────
// Single-box layout: main content on the left, readings on the right,
// no divider line. Used when the "answer" is already conveyed some
// other way (e.g. the highlighted MCQ choice) so we don't repeat it —
// `main` is just whatever should sit next to the readings, decided by
// the caller (unchanged prompt for QCM, swapped-to-answer for
// Flashcard).
export function InlineReveal({ main, kana, t, gap = 24, revealed = true, isLarge = false }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!revealed) { setShow(false); return }
    // Mount hidden, then flip open on the next frame — flipping straight
    // to open on mount would skip the transition entirely.
    const id = requestAnimationFrame(() => setShow(true))
    return () => cancelAnimationFrame(id)
  }, [revealed])

  return (
    <div className="inline-reveal" style={{ '--reveal-gap': `${gap}px` }}>
      {/* Capped width + wrapping keeps long meanings (e.g. multi-clause
          definitions) from stretching the row and shoving the readings
          off to the side. */}
      <div className="inline-reveal__main">{main}</div>
      {kana && (
        // Kept mounted at all times (width/opacity 0 when not revealed)
        // so opening it is a transition, not a pop-in — this is what
        // makes `main` visibly slide left as the space opens up.
        // Capped width forces long reading lists (kanji with many
        // on'yomi/kun'yomi) to wrap into a compact, centered block
        // instead of spilling out in one long left-aligned line.
        <div className={`inline-reveal__panel${show ? ' inline-reveal__panel--open' : ''}`}>
          {/* Fixed-width inner wrapper: the readings' flex-wrap layout
              is computed once against this stable width, then the
              outer panel just clips/reveals more of it as its
              max-width animates open. Without this, the readings
              re-wrap at every intermediate width during the
              transition, visibly jumping between layouts whenever
              there's more than one on'yomi/kun'yomi reading. */}
          <div className="inline-reveal__panel-inner">
            <Readings
              kana={kana}
              onLabel={t.onyomi}
              kunLabel={t.kunyomi}
              size={25}
              center
              isLarge={isLarge}
            />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Flashcard (click anywhere to reveal, then flip freely) ─
// Owns its own reveal/face state so the card behaves like a physical
// flashcard: the first click reveals the back (and fires `onReveal`
// once, e.g. so the parent can log the card as "seen"); every click
// after that just flips between front and back at will, with no extra
// prop wiring needed from the parent.
//
//   <Flashcard
//     front={<CharDisplay char={char} />}
//     back={<RevealPanel left={meaning} kana={kana} t={t} />}
//     onReveal={() => markSeen(cardId)}
//     resetKey={cardId}
//     t={t}
//   />
// ── Reveal actions (dictionary lookup + replay sound) ──────
// The pair of secondary actions that show up once an answer is
// revealed: jump to the full dictionary entry, and replay its
// pronunciation. Pulled out of Flashcard so MCQ/write modes — which
// have their own reveal moment but aren't a Flashcard — can drop the
// exact same row in after they show the answer, instead of a second
// copy of this logic drifting out of sync.
//
// Both actions are opt-in and independent:
//  - dictionary lookup needs dictTerm + dictCategory + session
//  - replay-sound needs either an explicit onReplaySound callback
//    (e.g. a screen's own playKana/speakJapanese with the right
//    argument) or, failing that, falls back to speaking `sound` (or
//    dictTerm if `sound` isn't given) via the browser's own TTS.
// A caller that wires up neither renders nothing at all.
//
// Icon-only, pinned to the card's top-left corner (see .reveal-actions
// in index.css) — the caller is expected to render this as a child of
// a `position: relative` card (PromptCard/.flashcard), not out in the
// surrounding page flow.
export function RevealActions({ t, revealed, resetKey, dictTerm, dictCategory, session, sound, onReplaySound }) {
  const [showDictionary, setShowDictionary] = useState(false)

  // Same as Flashcard's own reset — a caller reusing this across
  // cards (passing the card's id as resetKey) shouldn't carry a
  // dictionary sheet left open from the previous card into the next.
  useEffect(() => { setShowDictionary(false) }, [resetKey])

  const speakText = sound ?? dictTerm
  const canLookUp = revealed && dictTerm && dictCategory && session
  const canPlaySound = revealed && (onReplaySound || speakText)

  if (!canLookUp && !canPlaySound) return null

  function openDictionary(e) {
    e?.stopPropagation?.()
    playClick()
    setShowDictionary(true)
  }

  function closeDictionary(e) {
    e?.stopPropagation?.()
    setShowDictionary(false)
  }

  function replaySound(e) {
    e?.stopPropagation?.()
    if (onReplaySound) onReplaySound()
    else speakJapanese(speakText)
  }

  return (
    <>
      <div className="reveal-actions">
        {canPlaySound && (
          <button
            type="button"
            onClick={replaySound}
            className="reveal-action-btn"
            title={t.listen}
            aria-label={t.listen}
          >
            <SpeakIcon />
          </button>
        )}
        {canLookUp && (
          <button
            type="button"
            onClick={openDictionary}
            className="reveal-action-btn"
            title={t.openDictionary}
            aria-label={t.openDictionary}
          >
            <SearchIcon />
          </button>
        )}
      </div>

      {showDictionary && (
        <DictionaryLookupSheet
          term={dictTerm}
          category={dictCategory}
          session={session}
          onClose={closeDictionary}
        />
      )}
    </>
  )
}

// ── Flashcard (click anywhere to reveal, then flip freely) ─
// Owns its own reveal/face state so the card behaves like a physical
// flashcard: the first click reveals the back (and fires `onReveal`
// once, e.g. so the parent can log the card as "seen"); every click
// after that just flips between front and back at will, with no extra
// prop wiring needed from the parent.
//
//   <Flashcard
//     front={<CharDisplay char={char} />}
//     back={<RevealPanel left={meaning} kana={kana} t={t} />}
//     onReveal={() => markSeen(cardId)}
//     resetKey={cardId}
//     t={t}
//   />
//
// dictTerm/dictCategory/session/sound/onReplaySound are all opt-in —
// see RevealActions above — and pass straight through to it.
export function Flashcard({ front, back, onReveal, t, resetKey, dictTerm, dictCategory, session, sound, onReplaySound }) {
  const [revealed, setRevealed] = useState(false)

  // When the caller moves on to a new card (e.g. passes the card's id
  // as resetKey), snap back to the unrevealed front instead of
  // carrying over the previous card's flip state.
  useEffect(() => {
    setRevealed(false)
  }, [resetKey])

  // Reveal is now one-way: once flipped, the card settles on its
  // answer instead of flipping back and forth forever. Retired in
  // favour of the dictionary lookup below — once you've seen the
  // answer, looking the entry up is more useful than re-hiding it.
  const handleClick = () => {
    if (revealed) return
    playClick()
    setRevealed(true)
    onReveal?.()
  }

  // Keyboard reveal: spacebar, plus ZQSD — the AZERTY keyboard's
  // equivalent home-row of WASD — so a French keyboard gets a
  // natural one-handed shortcut instead of reaching for the mouse.
  useEffect(() => {
    const handler = e => {
      if (e.repeat) return
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const key = e.key.toLowerCase()
      if (key === ' ' || ['z', 'q', 's', 'd'].includes(key)) {
        e.preventDefault()
        handleClick()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [revealed])

  return (
    <div onClick={handleClick} className="flashcard">
      <RevealActions
        t={t}
        revealed={revealed}
        resetKey={resetKey}
        dictTerm={dictTerm}
        dictCategory={dictCategory}
        session={session}
        sound={sound}
        onReplaySound={onReplaySound}
      />
      {revealed ? back : front}
      <div className="flashcard__hint">
        {!revealed && (t.tapToReveal)}
      </div>
    </div>
  )
}

// ── Question type badge ─────────────────────────────────────────
export function QuestionTypeBadge({ type }) {
  const { t } = useLang()

  const TYPES = {
    comprehension: { label: t.questionTypeComprehension, variant: 'comprehension' },
    vocabulary:    { label: t.questionTypeVocabulary,       variant: 'vocabulary' },
    grammar:       { label: t.questionTypeGrammar,             variant: 'grammar' },
    inference:     { label: t.questionTypeInference,         variant: 'inference' },
  }

  const { label, variant } = TYPES[type] ?? { label: type, variant: 'default' }

  return (
    <span className={`type-badge type-badge--${variant}`}>
      {label}
    </span>
  )
}