import { useState, useEffect, useRef } from 'react'
import { useLang } from '../../LangContext'
import { playClick, playArrival } from '../../lib/audio'
import { Readings, ReadingGroup } from './Readings'
import { glossParts } from './gloss'
import { Loading } from '../ui/Loading'
import { DictionaryLookupSheet, SearchIcon, SpeakIcon, speakJapanese } from '../dictionary/DictionaryDetail'
import { CheckCircleIcon, XCircleIcon, ChevronIcon } from '../ui/Icons'

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
// `display` is what the row shows; `choice` stays the raw value every
// comparison below runs on. Keeping those separate is deliberate: a
// meaning choice gets normalised for reading (see formatGlossLine),
// and if that normalised text were also what "did the user pick the
// right answer" compared, then any two options whose raw strings
// differed only in punctuation would start grading as the same answer.
export function MCQButton({ choice, display, correct, selected, answered, onClick, index, cramped }) {
  const isCorrect  = choice === correct
  const isSelected = choice === selected
  // A filler is any choice that isn't the right answer and wasn't the
  // one picked — once revealed, it's just noise, so it collapses away
  // (see .mcq-row--filler) instead of sitting there unanswered-looking.
  const isFiller   = answered && !isCorrect && !isSelected

  let variant = ''
  if (answered && isCorrect) variant = ' mcq-row--correct'
  else if (answered && isSelected) variant = ' mcq-row--wrong'
  if (isFiller) variant += ' mcq-row--filler'

  if (answered && cramped) {
    variant += ' mcq-row--small'
  }

  return (
    <button
      onClick={onClick}
      disabled={answered}
      aria-hidden={isFiller}
      className={`mcq-row${variant}`}
    >
      <span className="mcq-row__accent" aria-hidden="true" />
      <span className="mcq-row__index">{String(index + 1).padStart(2, '0')}</span>
      <span className="mcq-row__text">{display ?? choice}</span>
    </button>
  )
}

// Digit row shortcuts for the first 4 choices. On an AZERTY keyboard
// the unshifted number row types &é"' rather than 1234, so both sets
// are mapped to the same indices — whichever layout someone's on,
// the physical top-row keys 1-4 answer choices 1-4.
const CHOICE_KEY_INDEX = { '1': 0, '2': 1, '3': 2, '4': 3, '&': 0, 'é': 1, '"': 2, "'": 3 }

// ── MCQ choices list ───────────────────────────────────────
// `formatChoice` is an optional display transform for the choice text
// — screens whose options are meanings pass formatGlossLine so a
// packed "to appear,to leave" reads properly, while screens whose
// options are kanji or romaji pass nothing and are left untouched.
// Only the rendered text changes; `choices`/`correct` stay raw for
// keying and grading (see MCQButton).
export function MCQGrid({ choices, correct, selected, answered, onAnswer, formatChoice }) {
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
          display={formatChoice ? formatChoice(choice) : choice}
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
          {isCorrect
            ? <><CheckCircleIcon size={16} /> {t.correct}</>
            : <><XCircleIcon size={16} /> {t.wrong} {answer}</>}
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

  // The end of a session had no sound at all — the one moment in a
  // study run that is unambiguously an achievement. Guarded against
  // StrictMode's double effect, which would otherwise flam it.
  const sounded = useRef(false)
  useEffect(() => {
    if (sounded.current) return
    sounded.current = true
    playArrival()
  }, [])

  return (
    <div className="quiz-done">
      {/* The message and the button are two rows, not two <br/>s. In a
          flex container a <br> is a zero-width flex item and breaks
          nothing, so the button used to sit on the same line as the
          text it was supposed to follow. */}
      <p className="quiz-done__msg">
        <CheckCircleIcon size={22} /> {t.quizComplete}
      </p>
      <button onClick={() => { playClick(); onBack() }} className="btn-panel">
        <ChevronIcon direction="left" size={14} /> {t.backToMenu}
      </button>
    </div>
  )
}

// Loading now lives in ./Loading (imported above) — re-exported here
// too for backward compatibility, since some screens still import it
// from QuizComponents. This used to be a second copy of the exact
// same markup living in both files; keeping one source of truth means
// a future tweak to the loading ring can't drift out of sync between
// the two.
export { Loading }

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
// A card's `meaning` field is several synonymous glosses packed into
// one string. Rather than showing them all at the same weight, the
// first one — the primary meaning — is rendered larger and
// highlighted; the rest sit below it as smaller, muted secondary
// meanings.
//
// Splitting is delegated to glossParts (see gloss.jsx). This used to
// split on /[,;]/ directly, which got the common case right but broke
// on the two things that helper exists to handle: a gloss carrying its
// own comma inside a qualifier ("to take (seat, position)" came out as
// the two fragments "to take (seat" and "position)"), and the leading
// JMdict code groups some deck entries still carry ("(v5r,vi) to
// relieve" led with a bare "(v5r" as the headline meaning). It also
// now shares the dictionary's sentence-casing, so the same word reads
// the same way in a quiz as it does in its dictionary entry.
export function MeaningDisplay({ meaning, size = 28, color = 'var(--accent3)', center = true }) {
  const [primary, ...rest] = glossParts(meaning)
  if (!primary) return null

  const style = { '--meaning-size': `${size}px`, '--meaning-color': color }

  return (
    <div className={`meaning-display${center ? ' meaning-display--center' : ''}`} style={style}>
      <div className="meaning-display__primary">{primary}</div>
      {rest.length > 0 && (
        <div className="meaning-display__secondary">{rest.join(' · ')}</div>
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
  // `revealed` — has this card been shown at least once. Permanent
  // for the card's lifetime: it's what unlocks the dictionary lookup/
  // sound-replay row below and fires `onReveal` (once), same as
  // before.
  // `showingBack` — which face is on top right now. Separate from
  // `revealed` on purpose: collapsing them into one flag is what made
  // the reveal one-way (see the retired comment this replaces) — once
  // `revealed` flipped true, there was no remaining state left to say
  // "but show the front again".
  const [revealed, setRevealed]       = useState(false)
  const [showingBack, setShowingBack] = useState(false)

  // When the caller moves on to a new card (e.g. passes the card's id
  // as resetKey), snap back to the unrevealed front instead of
  // carrying over the previous card's flip state.
  useEffect(() => {
    setRevealed(false)
    setShowingBack(false)
  }, [resetKey])

  // First tap reveals the back and fires onReveal once (so the parent
  // can start the rating flow / log the card as seen). Every tap
  // after that just flips between front and back at will — there's no
  // "settle on the answer" point anymore, since re-checking the front
  // after seeing the back is a completely normal thing to want mid-review.
  const handleClick = () => {
    playClick()
    if (!revealed) {
      setRevealed(true)
      setShowingBack(true)
      onReveal?.()
    } else {
      setShowingBack(s => !s)
    }
  }

  // Keyboard reveal/flip: spacebar, plus ZQSD — the AZERTY keyboard's
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
      {showingBack ? back : front}
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