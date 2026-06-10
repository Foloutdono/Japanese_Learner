import { useLang } from '../LangContext'

// ── Big kana/kanji display ────────────────────────────────
export function CharDisplay({ char, size = 96 }) {
  return (
    <div style={{
      fontSize: size,
      fontFamily: 'Yu Gothic, sans-serif',
      color: '#fff',
      margin: '16px 0',
      lineHeight: 1,
    }}>
      {char}
    </div>
  )
}

// ── MCQ answer button ─────────────────────────────────────
export function MCQButton({ choice, correct, selected, answered, onClick }) {
  const isCorrect  = choice === correct
  const isSelected = choice === selected
  let bg = 'var(--bg-card)'
  if (answered && isCorrect)                bg = 'var(--success)'
  if (answered && isSelected && !isCorrect) bg = 'var(--danger)'

  return (
    <button
      onClick={onClick}
      style={{
        background: bg,
        color: 'var(--text-primary)',
        fontSize: 'clamp(16px, 3vw, 28px)',
        padding: '12px 20px',
        aspectRatio: '2 / 1',
        width: '80%',
        borderRadius: 12,
        textAlign: 'center',
        fontWeight: 'bold',
        transition: 'background 0.15s, transform 0.1s',
        cursor: answered ? 'default' : 'pointer',
        border: '2px solid var(--border)',
      }}
      onMouseEnter={e => { if (!answered) e.currentTarget.style.transform = 'scale(1.02)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)' }}
    >
      {choice}
    </button>
  )
}

// ── MCQ choices grid ──────────────────────────────────────
export function MCQGrid({ choices, correct, selected, answered, onAnswer }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: 12,
      width: '100%',
      margin: '0 auto',
    }}>
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
        style={{
          width: '100%',
          padding: '12px 20px',
          fontSize: 18,
          marginBottom: 12,
          ...inputStyle,
        }}
      />
      {!submitted && (
        <button
          onClick={onSubmit}
          style={{ background: 'var(--accent)', color: '#fff', width: '100%' }}
        >
          {t.submit}
        </button>
      )}
      {submitted && (
        <div style={{
          fontSize: 18, fontWeight: 'bold', marginTop: 8,
          color: isCorrect ? 'var(--success)' : 'var(--danger)',
        }}>
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
  const defaultModes = [['mcq', t.modeQCM], ['type', t.modeType]]

  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
      {(modes ?? defaultModes).map(([key, label]) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          style={{
            background: mode === key ? 'var(--accent)' : 'var(--bg-card)',
            color: 'var(--text-primary)',
            fontSize: 13,
          }}
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
    <div style={{ color: 'var(--success)', fontSize: 18, textAlign: 'center', padding: 40 }}>
      {t.quizComplete}
      <br /><br />
      <button
        onClick={onBack}
        style={{ background: 'var(--bg-panel)', color: 'var(--text-primary)' }}
      >
        {t.backToMenu}
      </button>
    </div>
  )
}

// ── Loading ───────────────────────────────────────────────
export function Loading() {
  const { t } = useLang()
  return (
    <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 40 }}>
      {t.loading}
    </div>
  )
}
