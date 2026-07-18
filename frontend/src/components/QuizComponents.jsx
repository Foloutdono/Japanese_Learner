import { useState, useEffect } from 'react'
import { useLang } from '../LangContext'

// ── Big kana/kanji display ────────────────────────────────
// `char` comes straight from card data, which occasionally has a
// stray newline or run of whitespace baked in (bad import, a reading
// accidentally concatenated in the same field, etc.). At this font
// size each blank line costs ~1.4x the font-size in height, so even
// one hidden newline can balloon the card far past its intended size
// with nothing visible to explain it. Collapsing whitespace here means
// that class of bad data can never reach the layout in the first
// place, regardless of where it came from.
function sanitizeDisplayChar(char) {
  return typeof char === 'string' ? char.replace(/\s+/g, ' ').trim() : char
}

export function CharDisplay({ char, size = 110 }) {
  const isLargeSize = size >= 60
  const displayChar = sanitizeDisplayChar(char)
  return (
    <div
      className="char-display"
      style={{
        '--char-size': `${size}px`,
        '--char-font': isLargeSize ? 'var(--font-jp)' : 'inherit',
      }}
      title={typeof displayChar === 'string' ? displayChar : undefined}
    >
      {displayChar}
    </div>
  )
}

// ── MCQ answer row ─────────────────────────────────────────
// An editorial hairline row, not a boxed button — the same visual
// language as LevelSelector/ModeSelector, so the choice always reads
// as "pick a row from a list" everywhere in the app, quiz included.
export function MCQButton({ choice, correct, selected, answered, onClick, index }) {
  const isCorrect  = choice === correct
  const isSelected = choice === selected

  let variant = ''
  if (answered && isCorrect) variant = ' mcq-row--correct'
  else if (answered && isSelected) variant = ' mcq-row--wrong'

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

// ── MCQ choices list ───────────────────────────────────────
export function MCQGrid({ choices, correct, selected, answered, onAnswer }) {
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
          onClick={() => onAnswer(choice)}
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
        onKeyDown={e => e.key === 'Enter' && onSubmit()}
        placeholder={placeholder ?? t.typeAnswer}
        disabled={submitted}
        autoFocus
        className="quiz-input"
        style={inputStyle}
      />
      {!submitted && (
        <button onClick={onSubmit} className="quiz-submit">
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
    ['qcm', t.modeQCM ?? 'QCM'],
    ['flashcard', t.modeFlashcard ?? 'Flashcard'],
    ['write', t.modeWrite ?? 'Écriture'],
  ]

  return (
    <div className="mode-toggle">
      {(modes ?? defaultModes).map(([key, label]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
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
      <button onClick={onBack} className="btn-panel">
        {t.backToMenu}
      </button>
    </div>
  )
}

// ── Loading ───────────────────────────────────────────────
export function Loading() {
  const { t } = useLang()
  return <div className="quiz-loading">{t.loading}</div>
}

// ── Deck progress (à apprendre / en cours / maîtrisé) ─────
export function DeckProgress({ stats }) {
  const { t } = useLang()
  if (!stats || !stats.total) return null

  const { total, new: toLearn, learning, mastered } = stats

  const segments = [
    { key: 'new',      value: toLearn,  color: 'var(--state-new)', label: t.progressNew      ?? 'À apprendre' },
    { key: 'learning', value: learning, color: 'var(--accent4)',   label: t.progressLearning ?? 'En cours' },
    { key: 'mastered', value: mastered, color: 'var(--success)',   label: t.progressMastered ?? 'Maîtrisé' },
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

// ── Kanji/vocab readings display ──────────────────────────
// On'yomi readings are written in katakana, kun'yomi in hiragana — a
// kanji's combined reading field mixes both, separated by '・' or ';',
// e.g. "イチ・イツ・ひと~・ひと.つ". We classify each token by its first
// actual kana character (skipping '.'/'~', which are okurigana/variant
// markers, not kana). Vocab readings don't have this on/kun distinction
// (a whole word has one register of readings, not two), so when a field
// doesn't contain both kinds, Readings just renders a plain list instead
// of forcing on'yomi/kun'yomi labels onto it.
function isOnyomiToken(token) {
  const firstKana = [...token].find(c => /[\u3040-\u30FF]/.test(c))
  if (!firstKana) return false
  return /[\u30A0-\u30FF]/.test(firstKana) // katakana range
}

function splitReadingTokens(kana) {
  return (kana || '')
    .split(/[・;]/)
    .map(s => s.trim())
    .filter(Boolean)
}

export function ReadingGroup({ label, readings, size = 18, color = 'var(--text-primary)', center = false, isLarge = false }) {
  if (!readings.length) return null
  const style = {
    '--reading-size': `${size}px`,
    '--reading-index-size': `${Math.max(size - 5, 10)}px`,
    '--reading-color': color,
    '--reading-font': isLarge ? 'var(--font-jp)' : 'inherit',
  }
  return (
    <div className="reading-group" style={style}>
      {label && (
        <div className={`reading-group__label${center ? ' reading-group__label--center' : ''}`}>
          {label}
        </div>
      )}
      <div className={`reading-group__list${center ? ' reading-group__list--center' : ''}`}>
        {readings.map((r, i) => (
          <span key={i} className="reading-group__item">
            {readings.length > 1 && (
              <span className="reading-group__item-index">{i + 1}.</span>
            )}
            <span className="reading-group__item-text">{r}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// Renders a kana reading field elegantly: on'yomi/kun'yomi split for a
// kanji's mixed readings, or a plain (numbered if there's more than one)
// list for a single-register reading like vocab. Returns null if empty.
export function Readings({ kana, onLabel, kunLabel, size = 18, color, center = false, isLarge = false }) {
  const tokens = splitReadingTokens(kana)
  if (!tokens.length) return null

  const on  = tokens.filter(isOnyomiToken)
  const kun = tokens.filter(t => !isOnyomiToken(t))

  if (on.length && kun.length) {
    return (
      <div>
        <ReadingGroup label={onLabel}  readings={on}  size={size} color={color} center={center} isLarge={isLarge} />
        <ReadingGroup label={kunLabel} readings={kun} size={size} color={color} center={center} isLarge={isLarge} />
      </div>
    )
  }

  return <ReadingGroup readings={tokens} size={size} color={color} center={center} isLarge={isLarge} />
}

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
          <Readings
            kana={kana}
            onLabel={t?.onyomi ?? "On'yomi"}
            kunLabel={t?.kunyomi ?? "Kun'yomi"}
            size={25}
            center
            isLarge={isLarge}
          />
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
export function Flashcard({ front, back, onReveal, t, resetKey }) {
  const [revealed, setRevealed] = useState(false)
  const [showBack, setShowBack] = useState(false)

  // When the caller moves on to a new card (e.g. passes the card's id
  // as resetKey), snap back to the unrevealed front instead of
  // carrying over the previous card's flip state.
  useEffect(() => {
    setRevealed(false)
    setShowBack(false)
  }, [resetKey])

  const handleClick = () => {
    if (!revealed) {
      setRevealed(true)
      setShowBack(true)
      onReveal?.()
    } else {
      setShowBack(s => !s)
    }
  }

  return (
    <div onClick={handleClick} className="flashcard">
      {showBack ? back : front}
      <div className="flashcard__hint">
        {revealed
          ? (t?.tapToFlip ?? 'Touchez pour retourner')
          : (t?.tapToReveal ?? 'Touchez pour révéler')}
      </div>
    </div>
  )
}

// ── Question type badge ─────────────────────────────────────────
export function QuestionTypeBadge({ type }) {
  const { t } = useLang()

  const TYPES = {
    comprehension: { label: t.questionTypeComprehension ?? 'Comprehension', variant: 'comprehension' },
    vocabulary:    { label: t.questionTypeVocabulary ?? 'Vocabulary',       variant: 'vocabulary' },
    grammar:       { label: t.questionTypeGrammar ?? 'Grammar',             variant: 'grammar' },
    inference:     { label: t.questionTypeInference ?? 'Inference',         variant: 'inference' },
  }

  const { label, variant } = TYPES[type] ?? { label: type, variant: 'default' }

  return (
    <span className={`type-badge type-badge--${variant}`}>
      {label}
    </span>
  )
}