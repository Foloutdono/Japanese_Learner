import { useState, useEffect, useMemo, useRef } from 'react'
import { LEVEL_COLORS } from './levelColors'
import { createPortal } from 'react-dom'
import { useLang } from '../../LangContext'
import { apiFetch } from '../../lib/api'
import { Readings, Furigana } from '../study/Readings'
import { StrokeOrderAnimation } from '../study/StrokeOrderAnimation'
import { StageBadge } from '../study/StageBadge'
import { GlossList, firstGloss } from '../study/gloss'
import { BoltIcon } from '../ui/Icons'

const API_BASE = import.meta.env.VITE_API_URL || ''

// Small round "1 2 3..." markers for JMdict sense numbers — used both
// on the senses list itself and on each example sentence, so a reader
// can tell at a glance which sense an example illustrates. Drawn with
// CSS (a plain circle background) rather than the Unicode "①②③..."
// glyphs — those render inconsistently across fonts/platforms and end
// up tiny and hard to read at UI sizes, whereas a real element scales
// and stays legible at any size.
function SenseMarker({ number, className = '' }) {
  return (
    <span className={`dict-sense-marker ${className}`.trim()}>
      {number}
    </span>
  )
}

// One example sentence: furigana'd/highlighted Japanese + translation.
// Pulled out so both the nested-under-its-sense rendering and the flat
// fallback list (used when there's only one sense to show examples
// under, so nesting would add a layer for nothing) share one
// implementation instead of drifting apart.
function ExampleSentence({ ex, senseNumber }) {
  return (
    <div className="dict-example">
      {senseNumber != null && (
        <div className="dict-example__sense">
          <SenseMarker number={senseNumber} />
        </div>
      )}
      <div className="dict-example__jp">
        {ex.segments?.length > 0
          ? ex.segments.map((seg, j) => {
              // Each segment (a word, a kanji compound, a kana run) is
              // its own non-breaking unit — the line can wrap between
              // segments but never inside one, so a word never gets
              // split with a single trailing kanji/kana stranded alone
              // on the next line.
              const content = seg.reading
                ? <Furigana text={seg.text} reading={seg.reading} />
                : seg.text
              return seg.highlight
                ? <mark key={j} className="dict-example__hl dict-example__seg">{content}</mark>
                : <span key={j} className="dict-example__seg">{content}</span>
            })
          : ex.jp}
      </div>
      <div className="dict-example__en">{ex.en}</div>
    </div>
  )
}

// ── Shared dictionary metadata/helpers ─────────────────────
// Previously defined inside DictionaryScreen.jsx only — pulled out
// here so anything else that needs to show a dictionary entry (e.g.
// QuizComponents' Flashcard, via DictionaryLookupSheet below) reuses
// the exact same badges/panel instead of a second copy drifting out
// of sync with it.
//
// Status (new/learning/mastered) is now shown via the same hanko-seal
// StageBadge every quiz card already stamps itself with (see
// StageBadge.jsx) rather than a dictionary-only dot+label — one seal
// vocabulary for the same underlying SRS state everywhere in the app.

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

// Vertical (tategaki) type mark running down the identity plate's
// left edge — what kind of entry this is, in the same register a
// printed dictionary prints its own running head. Deliberately
// Japanese rather than the translated TYPE_META label: it's a
// decorative mark (aria-hidden), and the kanji read as part of the
// plate's composition where a Latin word would read as a UI chip.
const TYPE_MARK = {
  kanji:    '漢字',
  vocab:    '語彙',
  hiragana: '平仮名',
  katakana: '片仮名',
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
// `level` used to be enough of a tiebreaker for same-kanji homographs
// (different readings of one surface form rarely shared a level), but
// that assumption breaks down for the JMdict-wide pool (category
// "jmdict"), where every entry has level: null and homographs are far
// more common — so kana is always folded in too, not just used as a
// fallback when kanji is absent.
export function entryKey(entry) {
  return `${entry.type}:${entry.level ?? '_'}:${entry.kanji || ''}:${entry.kana || ''}`
}

// Gloss splitting/normalising lives in ./gloss — the quiz components
// need the same helpers, and importing this whole detail-panel module
// for a pure text utility would be backwards (same reasoning as
// Readings.jsx being its own module).

export function speakJapanese(text) {
  if (!text) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'ja-JP'
  u.rate = 0.8
  window.speechSynthesis.speak(u)
}

// JLPT level shown as a quiet index-tab: a left accent stroke plus a
// lightly-tinted ground in the level's own colour, rather than a loud
// solid-fill pill — reads like a library card's colour-coded spine
// label. Colour still scales with difficulty (N5 calmest → N1 most
// intense) using pigments already in the palette rather than
// introducing new ones.
export function LevelBadge({ level }) {
  if (!level) return null
  return (
    <span className="dict-level-badge" style={{ '--level-color': LEVEL_COLORS[level] ?? 'var(--accent3)' }}>
      {level}
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

export function CloseIcon() {
  return (
    <svg
      className="dict-detail__close-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="18" y1="6" x2="6" y2="18" />
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

// One number, named underneath it. The panel's unit of measurement —
// used for both the form block's stroke count/radical (which sit
// beside the stroke-order diagram they describe) and the practice
// record's grid, so a figure reads the same way wherever it appears
// instead of each block inventing its own label/value arrangement.
// `onClick` turns it into a real button (the radical tile navigates);
// without one it's inert text, not a dead-looking control.
function StatTile({ value, label, onClick }) {
  const inner = (
    <>
      <span className="dict-stat__value">{value}</span>
      <span className="dict-stat__label">{label}</span>
    </>
  )
  return onClick
    ? <button type="button" onClick={onClick} className="dict-stat dict-stat--link">{inner}</button>
    : <div className="dict-stat">{inner}</div>
}

// A grammatical/priority tag ("n", "v1", "⭐"...) with its full JMdict
// note shown as a tooltip rather than on the pill itself (the note is
// often a full sentence — too long to sit inline without wrapping into
// a two-line pill). A <button> rather than a plain span so a tap on
// mobile can focus it and reveal the tooltip too, not just desktop
// hover.
//
// The tooltip itself is portaled straight to document.body and placed
// with fixed coordinates computed from the chip's own bounding box,
// rather than living inside the chip as an absolutely-positioned span.
// Both places this renders (the mobile fullscreen sheet, the desktop
// side panel) scroll their own content, and any scrolling ancestor
// clips an absolutely-positioned child that pokes outside it — the
// tooltip was getting cut off at the panel's edge. Fixed-position +
// portal escapes that entirely; the horizontal position is then
// clamped to the viewport and the tooltip flips above the chip when
// there isn't enough room below, so it never runs off-screen either.
export function TagChip({ tag }) {
  const btnRef = useRef(null)
  const [popup, setPopup] = useState(null)
  const hasTooltip = tag.tooltip && tag.tooltip !== tag.label

  const showTooltip = () => {
    if (!hasTooltip || !btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    const halfWidth = 110 // half of .dict-tag-chip__tooltip's max-width
    const left = Math.min(
      Math.max(rect.left + rect.width / 2, 8 + halfWidth),
      window.innerWidth - 8 - halfWidth,
    )
    const placement = window.innerHeight - rect.bottom < 90 ? 'above' : 'below'
    const top = placement === 'above' ? rect.top - 6 : rect.bottom + 6
    setPopup({ top, left, placement })
  }
  const hideTooltip = () => setPopup(null)

  return (
    <button
      type="button"
      ref={btnRef}
      className="dict-tag-chip"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {tag.label}
      {hasTooltip && popup && createPortal(
        <span
          className="dict-tag-chip__tooltip"
          role="tooltip"
          data-placement={popup.placement}
          style={{ top: popup.top, left: popup.left }}
        >
          {tag.tooltip}
        </span>,
        document.body,
      )}
    </button>
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
export function DictionaryDetail({ entry, onClose, onRadicalClick, onKanjiClick, onVocabClick }) {
  const { t, lang, contentMaps } = useLang()
  const map = entry.type === 'vocab' ? contentMaps?.vocab
    : entry.type === 'kanji' ? contentMaps?.kanji
    : null
  // Kana has no semantic "meaning" to translate — its romaji stands in
  // as its reading on the identity plate instead, so this stays null
  // and the gloss block simply doesn't render for it.
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

  // The big headline character(s) get their reading shown right on top
  // as furigana — the fastest way to see how a word is actually read.
  // Only for vocab: a kana-only entry has nothing to annotate, and a
  // single kanji's on'yomi/kun'yomi split (shown under the headword on
  // the plate via <Readings>) is already the more complete picture
  // than picking one reading to sit above it.
  // vocab_data.py can pack several readings into entry.kana separated
  // by "/" — the headline furigana uses just the first, primary one.
  const headwordReading = entry.type === 'vocab' && entry.kanji && entry.kana
    ? entry.kana.split('/')[0].trim() || null
    : null

  const [strokeSvgFailed, setStrokeSvgFailed] = useState(false)
  useEffect(() => { setStrokeSvgFailed(false) }, [entry.svg_url])

  // Every JMdict sense (from get_vocab_extras) and the example
  // sentences that illustrate each one. Split into "nested under a
  // sense" vs. "flat" here, once, so both the senses list and the
  // fallback examples block below read from the same source instead
  // of each re-deriving it slightly differently.
  const senses = entry.senses ?? []
  const examples = entry.examples ?? []
  const senseNumbers = useMemo(() => new Set(senses.map(s => s.number)), [senses])
  // Examples that don't get nested under a sense row: either there are
  // no senses at all (so the per-sense list itself doesn't render —
  // see senses.length > 0 below), or an example's sense_number doesn't
  // match any listed sense.
  const flatExamples = senses.length > 0
    ? examples.filter(ex => !senseNumbers.has(ex.sense_number))
    : examples
  const examplesBySense = number => examples.filter(ex => ex.sense_number === number)

  // The panel's one data-driven accent: what kind of entry this is
  // (see TYPE_META) tints the plate's top rule and every section
  // marker below it, so a kanji panel and a vocab panel are
  // recognisably different objects at a glance rather than the same
  // grey form with different text in it.
  const typeStyle = { '--type-color': TYPE_META[entry.type]?.color ?? 'var(--accent)' }

  const isKanji = entry.type === 'kanji'
  const isKana  = isKanaType(entry.type)
  // Stroke count and radical describe the *drawing* of the character,
  // so they belong beside the stroke-order diagram rather than in a
  // metadata run somewhere else in the panel. The whole block only
  // exists if at least one of the three has something to show.
  const hasRadicalLink = isKanji && entry.radical != null && !!onRadicalClick
  const showForm = (isKanji || isKana) && (entry.svg_url || entry.stroke_count || hasRadicalLink)

  return (
    <>
      {/* ── Identity plate ───────────────────────────────────
          Everything needed to answer "what is this, and how is it
          read" — headword, reading, level, status seal — on one sumi
          block, so the body below can open straight onto meaning
          instead of a row of loose badges. */}
      <div className="dict-detail__stage" style={typeStyle}>
        <span className="dict-detail__type-mark" aria-hidden="true">
          {TYPE_MARK[entry.type]}
        </span>

        <div className="dict-detail__stage-top">
          <div className="dict-detail__stage-badges">
            <LevelBadge level={entry.level} />
            <StageBadge stage={entry.status?.status ?? 'new'} inline />
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
              <CloseIcon />
            </button>
          </div>
        </div>

        <div className="dict-detail__char">
          {headwordReading
            ? <Furigana text={entry.kanji} reading={headwordReading} />
            : (entry.kanji || entry.kana)}
        </div>

        {/* Reading, directly under the headword it belongs to. Kanji
            gets its on/kun split labelled 音/訓 — the traditional
            abbreviations, short enough to sit inline where the full
            "Lectures on'yomi (sino-japonaises)" never could. Kana gets
            its romaji. Vocab gets neither: the headword above already
            carries its reading as furigana. */}
        {isKanji && (
          <div className="dict-detail__stage-readings">
            <Readings kana={entry.kana} onLabel="音" kunLabel="訓" size={17} />
          </div>
        )}
        {isKana && entry.romaji && (
          <div className="dict-detail__stage-romaji">{entry.romaji}</div>
        )}
      </div>

      <div className="dict-detail__body" style={typeStyle}>

        {/* ── 1. What it means ─────────────────────────────
            First thing in the body, always. Vocab shows the full
            JMdict senses list (even a single-sense word renders
            through it, so there's one model rather than a gloss row
            that then repeats itself); kanji and any vocab entry
            JMdict had no senses for show one prominent gloss line. */}
        {senses.length > 0 ? (
          <div className="dict-detail__senses">
            <div className="dict-detail__senses-label">
              {t.senses ?? (lang === 'fr' ? 'Sens (JMdict)' : 'Senses (JMdict)')}
            </div>
            {senses.map(sense => (
              <div key={sense.number} className="dict-sense">
                <SenseMarker number={sense.number} className="dict-sense__number" />
                <div className="dict-sense__body">
                  {sense.tags?.length > 0 && (
                    <div className="dict-sense__tags">
                      {sense.tags.map(tag => (
                        <TagChip key={`${sense.number}-${tag.code}`} tag={tag} />
                      ))}
                    </div>
                  )}
                  <div className="dict-sense__gloss">
                    <GlossList meaning={sense.glossary} />
                  </div>
                  {examplesBySense(sense.number).length > 0 && (
                    <div className="dict-sense__examples">
                      {examplesBySense(sense.number).map((ex, i) => (
                        <ExampleSentence key={i} ex={ex} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          meaning != null && (
            <div className="dict-detail__gloss">
              <div className="dict-detail__gloss-label">{t.meaning}</div>
              <div className="dict-detail__gloss-text">
                <GlossList meaning={meaning} />
              </div>
            </div>
          )
        )}

        {/* ── 2. How it's used ─────────────────────────────
            Examples that couldn't nest under a specific sense above.
            Immediately after the definition, because a sentence reads
            best next to the meaning it illustrates. */}
        {flatExamples.length > 0 && (
          <div className="dict-detail__examples">
            <div className="dict-detail__examples-label">
              {t.examples ?? 'Exemples'}
            </div>
            {flatExamples.map((ex, i) => (
              <ExampleSentence key={i} ex={ex} senseNumber={senses.length > 0 ? ex.sense_number : null} />
            ))}
          </div>
        )}

        {/* ── 3. What it connects to ───────────────────────
            Two directions of the same relationship, and an entry only
            ever has one of them: a vocab word links down to the kanji
            it's built from, a kanji links out to the words it appears
            in. Adjacent so they read as one "elsewhere in the
            dictionary" zone. */}
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

        {onVocabClick && isKanji && entry.vocab_examples?.length > 0 && (
          <div className="dict-detail__vocab-examples">
            <div className="dict-detail__vocab-examples-label">
              {t.vocabExamples}
            </div>
            <div className="dict-vocab-example-list">
              {entry.vocab_examples.map((w, i) => (
                <button
                  key={i}
                  onClick={() => onVocabClick(w.kanji, w.kana)}
                  className="dict-vocab-example-row"
                >
                  <span className="dict-vocab-example-row__word">
                    {w.kana ? <Furigana text={w.kanji} reading={w.kana.split('/')[0].trim()} /> : w.kanji}
                  </span>
                  <span className="dict-vocab-example-row__meaning">
                    {firstGloss(w.meaning)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── 4. How it's written ──────────────────────────
            The stroke-order diagram with its own stroke count and
            radical sitting right beside it — these three facts are
            all about drawing the character, so they're one block
            rather than a diagram at the bottom and its numbers
            stranded in a metadata list further up. */}
        {showForm && (
          <div className="dict-detail__form">
            <div className="dict-detail__form-label">
              {t.strokeOrder}
            </div>
            <div className="dict-detail__form-grid">
              {entry.svg_url && (
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
              )}
              {(entry.stroke_count || hasRadicalLink) && (
                <div className="dict-stat-grid dict-detail__form-stats">
                  {entry.stroke_count && (
                    <StatTile value={entry.stroke_count} label={t.strokes} />
                  )}
                  {hasRadicalLink && (
                    <StatTile
                      value={`#${entry.radical}`}
                      label={t.radical}
                      onClick={() => onRadicalClick(entry.radical)}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 5. Your own record ──────────────────────────
            Last, because it's about the reader rather than the word.
            Four figures in the same lattice the results grid uses;
            nothing renders at all for an entry never reviewed, since
            a grid of dashes is noise, not information. */}
        {entry.status?.total_reviews > 0 && (
          <div className="dict-detail__practice">
            <div className="dict-detail__practice-label">
              {t.cardStats}
              {entry.status.due && (
                <span className="dict-detail__due-note"><BoltIcon size={12} /> {t.dueNow}</span>
              )}
            </div>
            <div className="dict-stat-grid">
              <StatTile
                value={entry.status.accuracy != null ? `${entry.status.accuracy}%` : '—'}
                label={t.accuracy}
              />
              <StatTile
                value={`${entry.status.correct_reviews}/${entry.status.total_reviews}`}
                label={t.totalReviews}
              />
              <StatTile
                value={entry.status.interval_days != null ? `${entry.status.interval_days} ${t.days}` : '—'}
                label={t.interval}
              />
              <StatTile
                value={entry.status.next_review ? new Date(entry.status.next_review).toLocaleDateString() : '—'}
                label={t.nextReview}
              />
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

  return createPortal(
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
    </div>,
    document.body,
  )
}