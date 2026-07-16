import { useState, useEffect } from 'react'
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
  const defaultModes = [
    ['qcm', t.modeQCM ?? 'QCM'],
    ['flashcard', t.modeFlashcard ?? 'Flashcard'],
    ['write', t.modeWrite ?? 'Écriture'],
  ]

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

export function ReadingGroup({ label, readings, size = 16, color = 'var(--text-primary)', center = false }) {
  if (!readings.length) return null
  return (
    <div style={{ marginBottom: 10 }}>
      {label && (
        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 5, textAlign: center ? 'center' : 'left' }}>
          {label}
        </div>
      )}
      <div style={{
        display: 'flex', flexWrap: 'wrap', columnGap: 16, rowGap: 4,
        justifyContent: center ? 'center' : 'flex-start',
      }}>
        {readings.map((r, i) => (
          <span key={i} style={{ fontSize: size, color, whiteSpace: 'nowrap' }}>
            {readings.length > 1 && (
              <span style={{ fontSize: Math.max(size - 5, 10), color: 'var(--text-secondary)', marginRight: 4 }}>
                {i + 1}.
              </span>
            )}
            <span style={{ fontFamily: 'Yu Gothic, sans-serif' }}>{r}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// Renders a kana reading field elegantly: on'yomi/kun'yomi split for a
// kanji's mixed readings, or a plain (numbered if there's more than one)
// list for a single-register reading like vocab. Returns null if empty.
export function Readings({ kana, onLabel, kunLabel, size = 16, color, center = false }) {
  const tokens = splitReadingTokens(kana)
  if (!tokens.length) return null

  const on  = tokens.filter(isOnyomiToken)
  const kun = tokens.filter(t => !isOnyomiToken(t))

  if (on.length && kun.length) {
    return (
      <div>
        <ReadingGroup label={onLabel}  readings={on}  size={size} color={color} center={center} />
        <ReadingGroup label={kunLabel} readings={kun} size={size} color={color} center={center} />
      </div>
    )
  }

  return <ReadingGroup readings={tokens} size={size} color={color} center={center} />
}

// ── Reveal panel ───────────────────────────────────────────
// Shared "answer" layout: the resolved answer on the left, readings on
// the right — used identically whether it's revealed by tapping a
// Flashcard or by answering a QCM. `kana` is optional (kana quiz cards
// have no separate reading to show — the kana itself IS the answer).
export function RevealPanel({ left, kana, t }) {
  return (
    <div style={{
      display: 'flex', gap: 24, justifyContent: 'center', alignItems: 'flex-start',
      flexWrap: 'wrap', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)',
    }}>
      <div>{left}</div>
      {kana && (
        <div style={{ paddingLeft: 20, borderLeft: '1px solid var(--border)' }}>
          <Readings
            kana={kana}
            onLabel={t?.onyomi ?? "On'yomi"}
            kunLabel={t?.kunyomi ?? "Kun'yomi"}
            size={16}
            center
          />
        </div>
      )}
    </div>
  )
}

// ── Inline reveal ──────────────────────────────────────────
// Single-box layout: main content on the left, readings on the right,
// no divider line. Used when the "answer" is already conveyed some
// other way (e.g. the highlighted MCQ choice) so we don't repeat it —
// `main` is just whatever should sit next to the readings, decided by
// the caller (unchanged prompt for QCM, swapped-to-answer for
// Flashcard).
export function InlineReveal({ main, kana, t, gap = 24, revealed = true }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!revealed) { setShow(false); return }
    // Mount hidden, then flip open on the next frame — flipping straight
    // to open on mount would skip the transition entirely.
    const id = requestAnimationFrame(() => setShow(true))
    return () => cancelAnimationFrame(id)
  }, [revealed])

  return (
    <div style={{
      display: 'flex', gap, justifyContent: 'center', alignItems: 'center',
      flexWrap: 'wrap', maxWidth: 640, margin: '0 auto',
    }}>
      {/* Capped width + wrapping keeps long meanings (e.g. multi-clause
          definitions) from stretching the row and shoving the readings
          off to the side. */}
      <div style={{ textAlign: 'center', maxWidth: 340, wordBreak: 'break-word' }}>
        {main}
      </div>
      {kana && (
        // Kept mounted at all times (width/opacity 0 when not revealed)
        // so opening it is a transition, not a pop-in — this is what
        // makes `main` visibly slide left as the space opens up.
        // Capped width forces long reading lists (kanji with many
        // on'yomi/kun'yomi) to wrap into a compact, centered block
        // instead of spilling out in one long left-aligned line.
        <div style={{
          maxWidth: show ? 300 : 0,
          opacity: show ? 1 : 0,
          overflow: 'hidden',
          transition: show ? 'max-width 0.35s ease, opacity 0.3s ease 0.05s' : 'none',
        }}>
          <Readings
            kana={kana}
            onLabel={t?.onyomi ?? "On'yomi"}
            kunLabel={t?.kunyomi ?? "Kun'yomi"}
            size={16}
            center
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
    <div onClick={handleClick} style={{ cursor: 'pointer' }}>
      {showBack ? back : front}
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 16 }}>
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