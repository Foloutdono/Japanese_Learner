import { useState, useEffect } from 'react'
import { useLang } from '../LangContext'

export function CharDisplay({ char, size = 110 }) {
  return (
    <div 
      className="char-display" 
      data-large={size >= 60 ? 'true' : 'false'}
      style={{ '--char-size': `${size}px` }}
    >
      {char}
    </div>
  )
}

export function MCQButton({ choice, correct, selected, answered, onClick }) {
  const isCorrect = choice === correct
  const isSelected = choice === selected
  let variant = ''
  if (answered && isCorrect) variant = ' mcq-button--correct'
  else if (answered && isSelected) variant = ' mcq-button--wrong'
  return (
    <button onClick={onClick} disabled={answered} className={`mcq-button${variant}`}>
      {choice}
    </button>
  )
}

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

export function TypeInput({ value, onChange, onSubmit, submitted, answer, placeholder, wrongExtra = null }) {
  const { t } = useLang()
  const isCorrect = value.trim().toLowerCase() === answer?.toLowerCase()
  return (
    <div className="type-input-wrapper">
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

export function Loading() {
  const { t } = useLang()
  return <div className="quiz-loading">{t.loading}</div>
}

export function DeckProgress({ stats }) {
  const { t } = useLang()
  if (!stats || !stats.total) return null
  const { total, new: toLearn, learning, mastered } = stats
  const segments = [
    { key: 'new', value: toLearn, color: 'var(--text-secondary)', label: t.progressNew ?? 'À apprendre' },
    { key: 'learning', value: learning, color: 'var(--accent)', label: t.progressLearning ?? 'En cours' },
    { key: 'mastered', value: mastered, color: 'var(--success)', label: t.progressMastered ?? 'Maîtrisé' },
  ]
  return (
    <div className="deck-progress">
      <div className="deck-progress__bar">
        {segments.map(s => (
          s.value > 0 && (
            <div 
              key={s.key} 
              className="deck-progress__segment" 
              style={{ '--seg-width': `${(s.value / total) * 100}%`, '--seg-color': s.color }}
            />
          )
        ))}
      </div>
      <div className="deck-progress__legend">
        {segments.map(s => (
          <span key={s.key} className="deck-progress__legend-item">
            <span className="deck-progress__dot" style={{ '--dot-color': s.color }} />
            {s.value}/{total} {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}

function isOnyomiToken(token) {
  const firstKana = [...token].find(c => /[぀-ヿ]/.test(c))
  if (!firstKana) return false
  return /[゠-ヿ]/.test(firstKana) 
}

function splitReadingTokens(kana) {
  return (kana || '').split(/[・;]/).map(s => s.trim()).filter(Boolean)
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

export function Readings({ kana, onLabel, kunLabel, size = 18, color, center = false, isLarge = false }) {
  const tokens = splitReadingTokens(kana)
  if (!tokens.length) return null
  const on = tokens.filter(isOnyomiToken)
  const kun = tokens.filter(t => !isOnyomiToken(t))
  if (on.length && kun.length) {
    return (
      <div>
        <ReadingGroup label={onLabel} readings={on} size={size} color={color} center={center} isLarge={isLarge} />
        <ReadingGroup label={kunLabel} readings={kun} size={size} color={color} center={center} isLarge={isLarge} />
      </div>
    )
  }
  return <ReadingGroup readings={tokens} size={size} color={color} center={center} isLarge={isLarge} />
}

function splitMeaningTokens(meaning) {
  return (meaning || '').split(/[,;]/).map(s => s.trim()).filter(Boolean)
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
        <div className={`inline-reveal__panel ${show ? 'is-open' : 'is-closed'}`}>
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

export function QuestionTypeBadge({ type }) {
  const { t } = useLang()
  const TYPES = {
    comprehension: { label: t.questionTypeComprehension ?? 'Comprehension', variant: 'comprehension' },
    vocabulary: { label: t.questionTypeVocabulary ?? 'Vocabulary', variant: 'vocabulary' },
    grammar: { label: t.questionTypeGrammar ?? 'Grammar', variant: 'grammar' },
    inference: { label: t.questionTypeInference ?? 'Inference', variant: 'inference' },
  }
  const { label, variant } = TYPES[type] ?? { label: type, variant: 'default' }
  return (
    <span className={`type-badge type-badge--${variant}`}>
      {label}
    </span>
  )
}