import { useState, useEffect } from 'react'
import { useLang } from '../LangContext'

// ═══════════════════════════════════════════════════════════════
// QUIZ COMPONENTS — Japanese Minimalist Design System
// Zero inline styles. Everything lives in CSS.
// ═══════════════════════════════════════════════════════════════

// ── CharDisplay ──────────────────────────────────────────────
// Large Japanese character. Size via data-size attribute.
// Font switches to Japanese face at md+ sizes.
export function CharDisplay({ char, size = 'xl', interactive = false }) {
  const sizeMap = {
    32: 'xs', 48: 'sm', 72: 'md', 96: 'lg',
    110: 'xl', 140: '2xl', 180: '3xl',
  }
  
  // Support both numeric sizes and string tokens
  const sizeToken = typeof size === 'number' ? (sizeMap[size] || 'xl') : size
  
  const className = [
    'char-display',
    `char-display--size-${sizeToken}`,
    interactive && 'char-display--interactive',
  ].filter(Boolean).join(' ')

  return <div className={className}>{char}</div>
}

// ── MCQ Button ───────────────────────────────────────────────
export function MCQButton({ choice, correct, selected, answered, onClick }) {
  const isCorrect  = choice === correct
  const isSelected = choice === selected

  const className = [
    'mcq-button',
    answered && isCorrect  && 'mcq-button--correct',
    answered && isSelected && !isCorrect && 'mcq-button--wrong',
  ].filter(Boolean).join(' ')

  return (
    <button
      onClick={onClick}
      disabled={answered}
      className={className}
    >
      {choice}
    </button>
  )
}

// ── MCQ Grid ─────────────────────────────────────────────────
export function MCQGrid({ choices, correct, selected, answered, onAnswer }) {
  return (
    <div className="mcq-grid">
      {choices.map(choice => (
        <MCQButton
          key={choice}
          choice={choice}
          correct={correct}
          selected={selected}
          answered={answered}
          onClick={() => onAnswer(choice)}
        />
      ))}
    </div>
  )
}

// ── Type Input ───────────────────────────────────────────────
export function TypeInput({
  value, onChange, onSubmit, submitted, answer,
  placeholder, wrongExtra = null,
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

// ── Mode Toggle ──────────────────────────────────────────────
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

// ── Done Message ─────────────────────────────────────────────
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

// ── Loading ──────────────────────────────────────────────────
export function Loading() {
  const { t } = useLang()
  return <div className="quiz-loading">{t.loading}</div>
}

// ── Deck Progress ────────────────────────────────────────────
export function DeckProgress({ stats }) {
  const { t } = useLang()
  if (!stats || !stats.total) return null

  const { total, new: toLearn, learning, mastered } = stats

  const segments = [
    { key: 'new',      value: toLearn,  color: 'var(--text-secondary)', label: t.progressNew      ?? 'À apprendre' },
    { key: 'learning', value: learning, color: 'var(--accent)',         label: t.progressLearning ?? 'En cours' },
    { key: 'mastered', value: mastered, color: 'var(--success)',        label: t.progressMastered ?? 'Maîtrisé' },
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

// ── Reading token utilities ──────────────────────────────────
function isOnyomiToken(token) {
  const firstKana = [...token].find(c => /[\u3040-\u30FF]/.test(c))
  if (!firstKana) return false
  return /[\u30A0-\u30FF]/.test(firstKana)
}

function splitReadingTokens(kana) {
  return (kana || '')
    .split(/[・;]/)
    .map(s => s.trim())
    .filter(Boolean)
}

// ── ReadingGroup ─────────────────────────────────────────────
export function ReadingGroup({ label, readings, size = 'md', color, center = false, isLarge = false }) {
  if (!readings.length) return null

  const className = [
    'reading-group',
    center && 'reading-group--center',
    isLarge && 'reading-group--large',
  ].filter(Boolean).join(' ')

  // Size tokens map to CSS custom properties
  const sizeMap = { xs: 14, sm: 16, md: 18, lg: 22, xl: 25, '2xl': 32 }
  const sizeValue = sizeMap[size] || sizeMap.md

  return (
    <div 
      className={className}
      style={{
        '--reading-size': `${sizeValue}px`,
        '--reading-index-size': `${Math.max(sizeValue - 5, 10)}px`,
        '--reading-color': color || 'var(--text-primary)',
        '--reading-font': isLarge ? 'var(--font-jp)' : 'inherit',
      }}
    >
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

// ── Readings ─────────────────────────────────────────────────
export function Readings({ kana, onLabel, kunLabel, size = 'md', color, center = false, isLarge = false }) {
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

// ── MeaningDisplay ───────────────────────────────────────────
export function MeaningDisplay({ meaning, size = 'lg', color, center = true }) {
  const [primary, ...rest] = (meaning || '')
    .split(/[,;]/)
    .map(s => s.trim())
    .filter(Boolean)
  
  if (!primary) return null

  const sizeMap = { sm: 20, md: 24, lg: 28, xl: 36, '2xl': 48 }
  const sizeValue = sizeMap[size] || sizeMap.lg

  const className = [
    'meaning-display',
    center && 'meaning-display--center',
  ].filter(Boolean).join(' ')

  return (
    <div 
      className={className}
      style={{
        '--meaning-size': `${sizeValue}px`,
        '--meaning-color': color || 'var(--accent3)',
      }}
    >
      <div className="meaning-display__primary">{primary}</div>
      {rest.length > 0 && (
        <div className="meaning-display__secondary">{rest.join(', ')}</div>
      )}
    </div>
  )
}

// ── InlineReveal ─────────────────────────────────────────────
export function InlineReveal({ main, kana, t, gap = 24, revealed = true, isLarge = false }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!revealed) { setShow(false); return }
    const id = requestAnimationFrame(() => setShow(true))
    return () => cancelAnimationFrame(id)
  }, [revealed])

  return (
    <div className="inline-reveal" style={{ '--reveal-gap': `${gap}px` }}>
      <div className="inline-reveal__main">{main}</div>
      {kana && (
        <div className={`inline-reveal__panel${show ? ' inline-reveal__panel--visible' : ''}`}>
          <Readings
            kana={kana}
            onLabel={t?.onyomi ?? "On'yomi"}
            kunLabel={t?.kunyomi ?? "Kun'yomi"}
            size="xl"
            center
            isLarge={isLarge}
          />
        </div>
      )}
    </div>
  )
}

// ── Flashcard ────────────────────────────────────────────────
export function Flashcard({ front, back, onReveal, t, resetKey }) {
  const [revealed, setRevealed] = useState(false)
  const [showBack, setShowBack] = useState(false)

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

// ── QuestionTypeBadge ────────────────────────────────────────
export function QuestionTypeBadge({ type }) {
  const { t } = useLang()

  const TYPES = {
    comprehension: { label: t.questionTypeComprehension ?? 'Comprehension', variant: 'comprehension' },
    vocabulary:    { label: t.questionTypeVocabulary    ?? 'Vocabulary',    variant: 'vocabulary' },
    grammar:       { label: t.questionTypeGrammar       ?? 'Grammar',       variant: 'grammar' },
    inference:     { label: t.questionTypeInference     ?? 'Inference',     variant: 'inference' },
  }

  const { label, variant } = TYPES[type] ?? { label: type, variant: 'default' }

  return (
    <span className={`type-badge type-badge--${variant}`}>
      {label}
    </span>
  )
}

// ── RatingBar ────────────────────────────────────────────────
export function RatingBar({ onRate, t }) {
  const levels = [
    { key: 5, label: t?.ratingPerfect   ?? 'Parfait',    variant: 'fill-success' },
    { key: 4, label: t?.ratingGood      ?? 'Bon',        variant: 'outline-success' },
    { key: 3, label: t?.ratingHard      ?? 'Difficile',  variant: 'fill-warning' },
    { key: 2, label: t?.ratingWrong     ?? 'Faux',       variant: 'outline-danger' },
    { key: 1, label: t?.ratingVeryWrong ?? 'Très faux',  variant: 'fill-danger' },
    { key: 0, label: t?.ratingBlackout  ?? 'Blackout',   variant: 'void' },
  ]

  return (
    <div className="rating-bar">
      <div className="rating-bar__hint">
        {t?.rateQuality ?? 'Évaluez votre réponse'}
      </div>
      <div className="rating-bar__buttons">
        {levels.map(({ key, label, variant }) => (
          <button
            key={key}
            onClick={() => onRate(key)}
            className={`rating-btn rating-btn--${variant}`}
          >
            <span className="rating-btn__index">{key}</span>
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}