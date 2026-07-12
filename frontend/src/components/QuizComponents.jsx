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

        fontSize: 'clamp(16px, 2vw, 24px)',

        minHeight: '70px',
        padding: '12px',

        width: '100%',

        borderRadius: 12,
        border: '2px solid var(--border)',

        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',

        textAlign: 'center',
        wordBreak: 'break-word',

        fontWeight: 'bold',

        transition: 'background 0.15s, transform 0.1s',

        cursor: answered ? 'default' : 'pointer',
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
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: 'clamp(8px, 2vw, 16px)',
      width: '100%',
      maxWidth: 900,
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

// ── Deck progress (à apprendre / en cours / maîtrisé) ─────
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
    <div style={{ maxWidth: 480, margin: '0 auto 20px' }}>
      <div style={{
        display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden',
        background: 'var(--bg-card)',
      }}>
        {segments.map(s => (
          s.value > 0 && (
            <div key={s.key} style={{ width: `${(s.value / total) * 100}%`, background: s.color }} />
          )
        ))}
      </div>
      <div style={{
        display: 'flex', justifyContent: 'center', flexWrap: 'wrap',
        gap: 14, marginTop: 8, fontSize: 12, color: 'var(--text-secondary)',
      }}>
        {segments.map(s => (
          <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: s.color, display: 'inline-block',
            }} />
            {s.value}/{total} {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Question type badge ─────────────────────────────────────────
export function QuestionTypeBadge({ type }) {
  const { t } = useLang()

  const TYPES = {
    comprehension: {
      label: t.questionTypeComprehension ?? 'Comprehension',
      color: '#3B82F6',
    },
    vocabulary: {
      label: t.questionTypeVocabulary ?? 'Vocabulary',
      color: '#10B981',
    },
    grammar: {
      label: t.questionTypeGrammar ?? 'Grammar',
      color: '#F59E0B',
    },
    inference: {
      label: t.questionTypeInference ?? 'Inference',
      color: '#8B5CF6',
    },
  }

  const { label, color } = TYPES[type] ?? {
    label: type,
    color: 'var(--text-secondary)',
  }

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '4px 10px',
        borderRadius: 999,
        background: color,
        color: '#fff',
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.03em',
        textTransform: 'uppercase',
        marginBottom: 12,
      }}
    >
      {label}
    </span>
  )
}