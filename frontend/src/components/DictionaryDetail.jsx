import { useState, useEffect, useMemo } from 'react'
import { useLang } from '../LangContext'
import { apiFetch } from '../api'
import { Readings } from './Readings'
import { StrokeOrderAnimation } from './StrokeOrderAnimation'

const API_BASE = import.meta.env.VITE_API_URL || ''

// ── Shared dictionary metadata/helpers ─────────────────────
// Previously defined inside DictionaryScreen.jsx only — pulled out
// here so anything else that needs to show a dictionary entry (e.g.
// QuizComponents' Flashcard, via DictionaryLookupSheet below) reuses
// the exact same badges/panel instead of a second copy drifting out
// of sync with it.
export const STATUS_META = {
  new:      { color: 'var(--text-secondary)', fallback: 'À apprendre' },
  learning: { color: 'var(--accent)',         fallback: 'En cours' },
  mastered: { color: 'var(--success)',        fallback: 'Maîtrisé' },
}

// Colours pulled from the app's own palette (ai-iro indigo / rokushou
// verdigris) instead of arbitrary hex, so — like every other colour
// in the app — these correctly flip between the dark and light theme
// rather than staying fixed regardless of `data-theme`.
export const TYPE_META = {
  kanji:    { color: 'var(--accent4)', fallback: 'Kanji' },
  vocab:    { color: 'var(--accent6)', fallback: 'Vocabulaire' },
  hiragana: { color: 'var(--accent3)', fallback: 'Hiragana' },
  katakana: { color: 'var(--accent5)', fallback: 'Katakana' },
}

// Both kana types share every bit of detail-panel/card logic that
// differs from kanji/vocab (no translated "meaning", romaji shown
// instead of a reading list, the stroke-order panel), so call sites
// check this instead of repeating the type === 'hiragana' ||
// type === 'katakana' pair everywhere.
export function isKanaType(type) {
  return type === 'hiragana' || type === 'katakana'
}

// Kanji, vocab, and kana entries can share the same character (a
// one-kanji word, or a kana that's also a valid word on its own), so
// the character alone isn't a safe React key / selection identity.
export function entryKey(entry) {
  return `${entry.type}:${entry.level}:${entry.kanji || entry.kana}`
}

export function speakJapanese(text) {
  if (!text) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'ja-JP'
  u.rate = 0.8
  window.speechSynthesis.speak(u)
}

export function StatusBadge({ state, t }) {
  const meta = STATUS_META[state] ?? STATUS_META.new
  return (
    <span className="status-badge">
      <span className="status-badge__dot" style={{ '--dot-color': meta.color }} />
      {t?.[`status_${state}`] ?? meta.fallback}
    </span>
  )
}

export function TypeBadge({ type, t }) {
  const meta = TYPE_META[type] ?? TYPE_META.kanji
  const label = type === 'kanji' ? (t?.dictKanji ?? 'Kanji')
    : type === 'hiragana' ? (t?.dictHiragana ?? 'Hiragana')
    : type === 'katakana' ? (t?.dictKatakana ?? 'Katakana')
    : (t?.dictVocab ?? 'Vocabulaire')
  return (
    <span className="dict-type-pill" style={{ '--pill-color': meta.color }}>
      {label}
    </span>
  )
}

// Drawn glyphs, not emoji — kept consistent with the rest of the
// dictionary UI, which draws its own icons rather than using emoji.
export function SpeakIcon() {
  return (
    <svg
      className="dict-detail__speak-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="4,9 8,9 12,5 12,19 8,15 4,15" fill="currentColor" stroke="none" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 6a8.5 8.5 0 0 1 0 12" />
    </svg>
  )
}

export function SearchIcon() {
  return (
    <svg
      className="dict-index-bar__icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  )
}

export function InfoRow({ label, value }) {
  return (
    <div className="dict-info-row">
      <span className="dict-info-row__label">
        {label}
      </span>
      <span className="dict-info-row__value">
        {value}
      </span>
    </div>
  )
}

// ── Detail panel ──────────────────────────────────────────
// Renders one entry's full detail. `onRadicalClick`/`onKanjiClick` are
// optional — DictionaryScreen passes real handlers so its radical link
// and composing-kanji chips can jump elsewhere in the dictionary; a
// caller that can't offer that navigation (e.g. a quiz flashcard,
// which has no dictionary screen underneath it to jump around in)
// just omits them, and those bits simply don't render rather than
// rendering as dead buttons.
export function DictionaryDetail({ entry, onClose, onRadicalClick, onKanjiClick }) {
  const { t, lang, contentMaps } = useLang()
  const map = entry.type === 'vocab' ? contentMaps?.vocab
    : entry.type === 'kanji' ? contentMaps?.kanji
    : null
  // Kana has no semantic "meaning" to translate — its romaji is shown
  // as its own reading row below instead (see the ternary further
  // down), so this stays null and the "Sens" row simply doesn't render.
  const meaning = isKanaType(entry.type)
    ? null
    : lang === 'fr'
      ? (map?.[entry.kanji || entry.kana] ?? entry.meaning)
      : entry.meaning

  // Every kanji character used in this vocab word, deduplicated and in
  // reading order — each becomes a link that jumps to that kanji's own
  // dictionary entry (see jumpToKanji in DictionaryScreen). Matches CJK
  // Unified Ideographs; a kana-only word (entry.kanji empty) yields none.
  const composingKanji = useMemo(() => {
    if (entry.type !== 'vocab' || !entry.kanji) return []
    const chars = entry.kanji.match(/[\u4e00-\u9faf]/g) || []
    return [...new Set(chars)]
  }, [entry.type, entry.kanji])

  const [strokeSvgFailed, setStrokeSvgFailed] = useState(false)
  useEffect(() => { setStrokeSvgFailed(false) }, [entry.svg_url])

  return (
    <>
      <div className="dict-detail__stage">
        <div className="dict-detail__char">
          {entry.kanji || entry.kana}
        </div>
        <div className="dict-detail__stage-actions">
          <button
            onClick={() => speakJapanese(entry.kana)}
            className="dict-detail__speak-btn"
            title={t.listen}
            aria-label={t.listen}
          >
            <SpeakIcon />
          </button>
          {/* Mobile-only (see index.css) — the fullscreen sheet needs
              an immediate way to dismiss without scrolling all the
              way down to the "Fermer" button. */}
          <button
            onClick={onClose}
            className="dict-detail__close-x"
            aria-label={t.close}
          >
            ×
          </button>
        </div>
      </div>

      <div className="dict-detail__body">
        <div className="dict-detail__badges">
          <TypeBadge type={entry.type} t={t} />
          <StatusBadge state={entry.status?.state ?? 'new'} t={t} />
        </div>

        {entry.type === 'kanji'
          ? (
            <div className="dict-detail__readings">
              <Readings
                kana={entry.kana}
                onLabel={t.onyomi}
                kunLabel={t.kunyomi}
              />
            </div>
          )
          : isKanaType(entry.type)
          ? <InfoRow label={t.romaji} value={entry.romaji} />
          : <InfoRow label={t.reading} value={entry.kana} />
        }
        {meaning != null && <InfoRow label={t.meaning}    value={meaning} />}
        <InfoRow label={t.level}  value={entry.level} />
        {entry.stroke_count && (
          <InfoRow label={t.strokes} value={`${entry.stroke_count} ${t.strokes}`} />
        )}
        {entry.type === 'kanji' && entry.radical != null && onRadicalClick && (
          <InfoRow
            label={t.radical}
            value={
              <button
                onClick={() => onRadicalClick(entry.radical)}
                className="dict-detail__radical-link"
              >
                #{entry.radical}
              </button>
            }
          />
        )}

        {onKanjiClick && composingKanji.length > 0 && (
          <div className="dict-detail__composing-kanji">
            <div className="dict-detail__composing-kanji-label">
              {t.composingKanji}
            </div>
            <div className="dict-detail__kanji-chips">
              {composingKanji.map(char => (
                <button
                  key={char}
                  onClick={() => onKanjiClick(char)}
                  className="dict-detail__kanji-chip"
                >
                  {char}
                </button>
              ))}
            </div>
          </div>
        )}

        {(entry.type === 'kanji' || isKanaType(entry.type)) && entry.svg_url && (
          <div className="dict-detail__stroke-section">
            <div className="dict-detail__stroke-label">
              {t.strokeOrder}
            </div>
            <div className="dict-detail__stroke-frame">
              {!strokeSvgFailed && (
                <StrokeOrderAnimation
                  src={`${API_BASE}${entry.svg_url}`}
                  loop
                  className="dict-detail__stroke-img"
                  onError={() => setStrokeSvgFailed(true)}
                />
              )}
              {strokeSvgFailed && (
                <div className="dict-detail__stroke-fallback" style={{ display: 'block' }}>
                  {t.notAvailable}
                </div>
              )}
            </div>
          </div>
        )}

        <button
          onClick={onClose}
          className="dict-detail__close-btn"
        >
          {t.close}
        </button>
      </div>
    </>
  )
}

// ── On-demand lookup by term ────────────────────────────────
// For contexts that only know a card's own text (e.g. a quiz
// flashcard) rather than a full search-result entry object.
// Searches /api/dictionary for `term` within `category` and takes the
// exact kanji/kana match if there is one, falling back to the first
// result otherwise (mirrors DictionaryScreen's own jumpToKanji
// auto-select logic). Only runs while `active` is true, so opening the
// sheet is what triggers the fetch — not every card getting flipped.
function useDictionaryLookup(session, term, category, lang, active) {
  const [state, setState] = useState({ entry: null, loading: false, error: false })

  useEffect(() => {
    if (!active || !term || !category) return
    let cancelled = false
    setState({ entry: null, loading: true, error: false })

    const params = new URLSearchParams({ q: term, page: 0, limit: 10, lang: lang ?? '', category })
    apiFetch(`/api/dictionary?${params.toString()}`, session)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        const results = data.results || []
        const match = results.find(e => e.kanji === term || e.kana === term) ?? results[0] ?? null
        setState({ entry: match, loading: false, error: !match })
      })
      .catch(() => { if (!cancelled) setState({ entry: null, loading: false, error: true }) })

    return () => { cancelled = true }
  }, [active, term, category, session, lang])

  return state
}

// ── Standalone lookup sheet ─────────────────────────────────
// Fetches and shows one dictionary entry by term + category, in the
// same overlay chrome DictionaryScreen's own mobile modal already
// uses (.dict-modal-overlay/.dict-modal-content) — so it looks like
// part of the same feature wherever it's opened from.
export function DictionaryLookupSheet({ term, category, session, onClose }) {
  const { t, lang } = useLang()
  const { entry, loading, error } = useDictionaryLookup(session, term, category, lang, true)

  return (
    <div onClick={onClose} className="dict-modal-overlay">
      <div onClick={e => e.stopPropagation()} className="dict-modal-content">
        {loading && (
          <div className="quiz-loading">{t.loadingDictionary}</div>
        )}
        {!loading && error && (
          <div className="quiz-loading">
            {t.notAvailable}
            <br /><br />
            <button onClick={onClose} className="dict-detail__close-btn">
              {t.close}
            </button>
          </div>
        )}
        {!loading && entry && (
          <DictionaryDetail entry={entry} onClose={onClose} />
        )}
      </div>
    </div>
  )
}