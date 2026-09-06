import { useState, useEffect, useMemo, useRef } from 'react'
import { LEVEL_COLORS } from './levelColors'
import { shortDate } from '../../lib/formatDate'
import { createPortal } from 'react-dom'
import { useLang } from '../../LangContext'
import { apiFetch } from '../../lib/api'
import { FuriganaParts, splitReadingTokens } from '../study/Readings'
import { StrokeOrderAnimation } from '../study/StrokeOrderAnimation'
import { StageMark } from '../study/StageMark'
import { GlossList, firstGloss } from '../study/gloss'
import { BoltIcon, ChevronIcon } from '../ui/Icons'
import { Loading } from '../ui/Loading'
import Empty from '../ui/Empty'
import { Leave } from '../chrome/Bar'
import { Sheet } from '../chrome/Sheet'
import { useDialog } from '../../hooks/useDialog'
import { speakJapanese } from '../../lib/audio'
import { api } from '../../lib/origin'

// ── Shared dictionary metadata/helpers ─────────────────────
// Previously defined inside DictionaryScreen.jsx only — pulled out
// here so anything else that needs to show a dictionary entry (e.g.
// QuizComponents' Flashcard, via DictionaryLookupSheet below) reuses
// the exact same plate instead of a second copy drifting out of sync
// with it.

// Colours pulled from the app's own palette (ai-iro indigo / rokushou
// verdigris) instead of arbitrary hex, so — like every other colour
// in the app — these correctly flip between the dark and light theme
// rather than staying fixed regardless of `data-theme`.
// eslint-disable-next-line react-refresh/only-export-components -- TYPE_META is a plain colour/label lookup consumed by DictionaryScreen.jsx; not a component.
export const TYPE_META = {
  kanji:    { color: 'var(--accent4)', fallback: 'Kanji' },
  vocab:    { color: 'var(--accent6)', fallback: 'Vocabulaire' },
  hiragana: { color: 'var(--accent3)', fallback: 'Hiragana' },
  katakana: { color: 'var(--accent5)', fallback: 'Katakana' },
}

// Both kana types share every bit of plate/card logic that differs
// from kanji/vocab (no translated "meaning", romaji shown instead of a
// reading list, the stroke-order panel), so call sites check this
// instead of repeating the type === 'hiragana' || type === 'katakana'
// pair everywhere.
// eslint-disable-next-line react-refresh/only-export-components -- isKanaType is a plain predicate used by DictionaryScreen.jsx to branch shared plate logic; not a component.
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
// eslint-disable-next-line react-refresh/only-export-components -- entryKey is a plain identity-string helper used by DictionaryScreen.jsx for React keys/selection comparisons; not a component.
export function entryKey(entry) {
  return `${entry.type}:${entry.level ?? '_'}:${entry.kanji || ''}:${entry.kana || ''}`
}

// The stage a card (or the plate) prints, from the SRS status the API
// carries: a word never met prints nothing (the canvas's unmarked
// cards), a due word is still in progress.
// eslint-disable-next-line react-refresh/only-export-components -- stageOf is a plain status→stage mapping shared with DictionaryScreen.jsx's cards; not a component.
export function stageOf(status) {
  if (status === 'mastered') return 'mastered'
  if (status === 'learning' || status === 'due') return 'learning'
  if (status === 'new') return 'new'
  return null
}

// Gloss splitting/normalising lives in ./gloss — the quiz components
// need the same helpers, and importing this whole plate module for a
// pure text utility would be backwards (same reasoning as Readings.jsx
// being its own module).

// The mixer-aware one, imported above. This module used to define its
// own copy that ignored mute and the tts volume entirely, so a muted
// app still spoke. Re-exported so QuizComponents.jsx's
// DictionaryLookupSheet keeps its import path.
// eslint-disable-next-line react-refresh/only-export-components -- re-exported for QuizComponents.jsx's DictionaryLookupSheet; not a component.
export { speakJapanese }

// JLPT level as a quiet caption in the level's own colour (the card's
// corner, the plate's marks row).
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
      className="svg"
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
      className="svg"
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

// A grammatical/priority tag ("n", "v1", "⭐"...) with its full JMdict
// note shown as a tooltip rather than on the tag itself (the note is
// often a full sentence — too long to sit inline). A <button> rather
// than a plain span so a tap on mobile can focus it and reveal the
// tooltip too, not just desktop hover.
//
// The tooltip itself is portaled straight to document.body and placed
// with fixed coordinates computed from the tag's own bounding box,
// rather than living inside the tag as an absolutely-positioned span:
// every place this renders scrolls its own content, and a scrolling
// ancestor clips an absolutely-positioned child that pokes outside it.
// Fixed-position + portal escapes that entirely; the horizontal
// position is then clamped to the viewport and the tooltip flips above
// the tag when there isn't enough room below.
export function TagChip({ tag }) {
  const btnRef = useRef(null)
  const [popup, setPopup] = useState(null)
  const hasTooltip = tag.tooltip && tag.tooltip !== tag.label

  const showTooltip = () => {
    if (!hasTooltip || !btnRef.current) return
    const rect = btnRef.current.getBoundingClientRect()
    const halfWidth = 110 // half of .dict-tag__tip's max-width
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
      className="dict-tag"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {tag.label}
      {hasTooltip && popup && createPortal(
        <span
          className="dict-tag__tip"
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

// One example sentence: furigana'd/highlighted Japanese + translation.
function ExampleSentence({ ex }) {
  return (
    <div className="dict-ex">
      <span className="dict-ex__jp" lang="ja">
        {ex.segments?.length > 0
          ? ex.segments.map((seg, j) => {
              // Each segment (a word, a kanji compound, a kana run) is
              // its own non-breaking unit — the line can wrap between
              // segments but never inside one. Already split per kanji
              // by the backend (content/vocab_extras.py's
              // _expand_furigana), so this renders the segment as-is.
              const content = seg.reading
                ? <ruby>{seg.text}<rt>{seg.reading}</rt></ruby>
                : seg.text
              return seg.highlight
                ? <mark key={j} className="dict-ex__hl">{content}</mark>
                : <span key={j}>{content}</span>
            })
          : ex.jp}
      </span>
      <span className="dict-ex__tr">{ex.en}</span>
    </div>
  )
}

// The stroke-order diagram plus its own failure fallback. Owns
// `failed` itself and is remounted (via the `key={entry.svg_url}` its
// caller passes) whenever the entry changes, so a previous entry's
// load failure can never stick around and hide a diagram that would
// otherwise load fine for the new one.
function StrokeFrame({ src, notAvailableLabel }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className="dict-form__sheet">
      {!failed && (
        <StrokeOrderAnimation
          src={src}
          loop
          className="dict-form__img"
          onError={() => setFailed(true)}
        />
      )}
      {failed && <span className="hint">{notAvailableLabel}</span>}
    </div>
  )
}

// ── Readings ────────────────────────────────────────────────
// On'yomi are written in katakana, kun'yomi in hiragana (KANJIDIC2's
// convention, which the backend keeps); the okurigana markers ('.',
// '~', '-') are dropped for matching a reading against the words that
// use it. Katakana folds to hiragana so サン finds さんぽ.
const KATAKANA = /[ァ-ヶ]/
function isOnyomi(token) {
  const first = token.replace(/[.~-]/g, '')[0]
  return !!first && KATAKANA.test(first)
}
function readingStem(token) {
  const stem = token.split('.')[0].replace(/[~-]/g, '')
  return stem.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60))
}

function WordRow({ word, hit, onClick, as: Tag = 'button' }) {
  const kanji = word.kanji || word.kana || ''
  const parts = hit && kanji.includes(hit) ? kanji.split(hit) : null
  const jp = parts
    ? parts.flatMap((p, i) => (i === 0 ? [p] : [<span key={`h${i}`} className="dict-word__hit">{hit}</span>, p]))
    : kanji
  const props = Tag === 'button' ? { type: 'button', onClick } : {}
  return (
    <Tag className={`dict-word${Tag === 'button' ? '' : ' dict-word--static'}`} {...props}>
      <span className="dict-word__jp" lang="ja">{jp}</span>
      <span className="dict-word__gloss">{firstGloss(word.meaning)}</span>
      {Tag === 'button' && <ChevronIcon direction="right" size={14} className="dict-word__chev" />}
    </Tag>
  )
}

// ── The entry ───────────────────────────────────────────────
// The catalogue plate at reading size (the canvas's DictionaryEntry,
// plan 073): the way out, the stage word and the level in the marks
// row, the speaker in the actions; the reading over the headword, two
// readings with a door to the rest, the caption; then the body as
// blocks divided by hairlines and no headings — the senses with their
// examples, the form (the stroke sheet, the count, the radical door),
// the words it is used in, the learner's own record.
//
// `onRadicalClick`/`onKanjiClick`/`onVocabClick` are optional —
// DictionaryScreen passes real handlers so the radical door and the
// word rows can jump elsewhere in the dictionary; a caller that can't
// offer that navigation (a quiz flashcard, which has no dictionary
// underneath it) just omits them, and those doors render as plain
// rows rather than dead buttons. `leaveLabel` names where ‹ goes.
export function DictionaryDetail({ entry, onClose, onRadicalClick, onKanjiClick, onVocabClick, leaveLabel }) {
  const { t, lang, contentMaps } = useLang()
  const [readingsOpen, setReadingsOpen] = useState(false)
  const map = entry.type === 'vocab' ? contentMaps?.vocab
    : entry.type === 'kanji' ? contentMaps?.kanji
    : null
  // Kana has no semantic "meaning" to translate — its romaji stands in
  // as its reading on the plate instead, so this stays null and the
  // gloss block simply doesn't render for it.
  const meaning = isKanaType(entry.type)
    ? null
    : lang === 'fr'
      ? (map?.[entry.kanji || entry.kana] ?? entry.meaning)
      : entry.meaning

  // Every kanji character used in this vocab word, deduplicated and in
  // reading order — each becomes a door to that kanji's own entry (see
  // jumpToKanji in DictionaryScreen). Matches CJK Unified Ideographs;
  // a kana-only word (entry.kanji empty) yields none.
  const composingKanji = useMemo(() => {
    if (entry.type !== 'vocab' || !entry.kanji) return []
    const chars = entry.kanji.match(/[一-龯]/g) || []
    return [...new Set(chars)]
  }, [entry.type, entry.kanji])

  // The headword carries its reading as furigana — the fastest way to
  // see how a word is actually read. Only for vocab: a kana-only entry
  // has nothing to annotate, and a single kanji's on/kun split is shown
  // under the glyph. Computed backend-side (routes/dictionary.py's
  // _word_furigana) so a multi-kanji headword divides per kanji.
  const headwordFurigana = entry.type === 'vocab' ? entry.furigana : null

  // Every JMdict sense (from get_vocab_extras) and the example
  // sentences that illustrate each one.
  const senses = entry.senses ?? []
  const examples = entry.examples ?? []
  const senseNumbers = useMemo(() => new Set(senses.map(s => s.number)), [senses])
  const flatExamples = senses.length > 0
    ? examples.filter(ex => !senseNumbers.has(ex.sense_number))
    : examples
  const examplesBySense = number => examples.filter(ex => ex.sense_number === number)

  const isKanji = entry.type === 'kanji'
  const isKana  = isKanaType(entry.type)
  const hasRadicalLink = isKanji && entry.radical != null && !!onRadicalClick
  const showForm = (isKanji || isKana) && (entry.svg_url || entry.stroke_count || hasRadicalLink)
  const stage = stageOf(entry.status?.status)

  // The plate's readings: a kanji shows one on and one kun reading and
  // a door to the rest; the sheet behind the door groups every reading
  // with the words that use it.
  const tokens = useMemo(() => (isKanji ? splitReadingTokens(entry.kana) : []), [isKanji, entry.kana])
  const onyomi = tokens.filter(isOnyomi)
  const kunyomi = tokens.filter(tk => !isOnyomi(tk))
  const shown = [onyomi[0], kunyomi[0]].filter(Boolean)
  const more = tokens.length - shown.length
  const words = isKanji ? (entry.vocab_examples ?? []) : []
  const wordsFor = reading => {
    const stem = readingStem(reading)
    return stem ? words.filter(w => (w.kana || '').includes(stem)) : []
  }

  const plateReading = isKanji ? onyomi[0] ?? null : isKana ? entry.romaji : null
  const caption = meaning ? firstGloss(meaning) : null

  return (
    <article className="dict-entry">
      <header className="dict-plate">
        <div className="dict-plate__row">
          <div className="dict-plate__marks">
            {onClose && <Leave onClick={onClose}>{leaveLabel ?? t.dictionaryTitle}</Leave>}
            {stage && <StageMark stage={stage} />}
            {entry.level && <span className="dict-plate__level">{entry.level}</span>}
          </div>
          <div className="dict-plate__actions">
            <button
              type="button"
              onClick={() => speakJapanese(entry.kana)}
              className="dict-plate__btn"
              title={t.listen}
              aria-label={t.listen}
            >
              <SpeakIcon />
            </button>
          </div>
        </div>

        <div className="dict-plate__stack">
          {plateReading && <span className="dict-plate__reading" lang="ja">{plateReading}</span>}
          <h1 className={`dict-plate__word${isKanji || isKana ? ' dict-plate__word--glyph' : ''}`} lang="ja">
            {headwordFurigana?.length
              ? <FuriganaParts parts={headwordFurigana} />
              : (entry.kanji || entry.kana)}
          </h1>
          {isKanji && shown.length > 0 && (
            <div className="dict-plate__readings">
              {onyomi[0] && (
                <span className="dict-plate__yomi">
                  <span className="dict-kind" lang="ja">音</span>
                  <span lang="ja">{onyomi[0]}</span>
                </span>
              )}
              {kunyomi[0] && (
                <span className="dict-plate__yomi">
                  <span className="dict-kind" lang="ja">訓</span>
                  <span lang="ja">{kunyomi[0]}</span>
                </span>
              )}
              {more > 0 && (
                <button type="button" className="dict-plate__more" onClick={() => setReadingsOpen(true)} aria-label={t.allReadings}>
                  +{more}
                  <ChevronIcon direction="down" size={12} />
                </button>
              )}
            </div>
          )}
          {caption && <span className="dict-plate__caption">{caption}</span>}
        </div>
        <div className="dict-plate__stripe" aria-hidden="true" />
      </header>

      <div className="dict-entry__body">
        {/* ── What it means ──
            Vocab shows the full JMdict senses list (even a single-sense
            word renders through it, so there's one model rather than a
            gloss row that then repeats itself); kanji and any vocab
            entry JMdict had no senses for show one gloss line. */}
        {senses.length > 0 ? (
          <section className="dict-block">
            <ol className="dict-senses">
              {senses.map(sense => (
                <li key={sense.number} className="dict-sense">
                  <span className="dict-sense__n">{sense.number}</span>
                  <div className="dict-sense__body">
                    <span className="dict-sense__gloss"><GlossList meaning={sense.glossary} /></span>
                    {sense.tags?.length > 0 && (
                      <span className="dict-sense__tags">
                        {sense.tags.map(tag => <TagChip key={`${sense.number}-${tag.code}`} tag={tag} />)}
                      </span>
                    )}
                    {examplesBySense(sense.number).length > 0 && (
                      <div className="dict-examples">
                        {examplesBySense(sense.number).map((ex, i) => <ExampleSentence key={i} ex={ex} />)}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        ) : (
          meaning != null && (
            <section className="dict-block">
              <span className="dict-sense__gloss"><GlossList meaning={meaning} /></span>
            </section>
          )
        )}

        {/* Examples that couldn't nest under a specific sense. */}
        {flatExamples.length > 0 && (
          <section className="dict-block">
            <div className="dict-examples">
              {flatExamples.map((ex, i) => <ExampleSentence key={i} ex={ex} />)}
            </div>
          </section>
        )}

        {/* ── How it's written ──
            The stroke sheet with its own stroke count and the radical
            door beside it — three facts about drawing the character,
            one lattice. */}
        {showForm && (
          <section className="dict-block">
            <div className="dict-form">
              {entry.svg_url && (
                <StrokeFrame key={entry.svg_url} src={api(entry.svg_url)} notAvailableLabel={t.notAvailable} />
              )}
              {entry.stroke_count && (
                <div className="record">
                  <span className="record__value">{entry.stroke_count}</span>
                  <span className="record__label">{t.strokes}</span>
                </div>
              )}
              {hasRadicalLink && (
                <button type="button" className="record record--door" onClick={() => onRadicalClick(entry.radical)}>
                  <span className="record__value">#{entry.radical}</span>
                  <span className="record__label">{t.radical}</span>
                  <ChevronIcon direction="right" size={14} className="record__chev" />
                </button>
              )}
            </div>
          </section>
        )}

        {/* ── What it connects to ──
            Two directions of the same relationship, and an entry only
            ever has one of them: a kanji links out to the words it
            appears in, a vocab word links down to the kanji it's built
            from. */}
        {onVocabClick && isKanji && words.length > 0 && (
          <section className="dict-block">
            <div className="dict-words">
              {words.map((w, i) => (
                <WordRow key={i} word={w} hit={entry.kanji} onClick={() => onVocabClick(w.kanji, w.kana)} />
              ))}
            </div>
          </section>
        )}
        {onKanjiClick && composingKanji.length > 0 && (
          <section className="dict-block">
            <div className="dict-words">
              {composingKanji.map(char => (
                <button key={char} type="button" className="dict-word" onClick={() => onKanjiClick(char)}>
                  <span className="dict-word__jp" lang="ja"><span className="dict-word__hit">{char}</span></span>
                  <span className="dict-word__gloss">{contentMaps?.kanji?.[char] ?? ''}</span>
                  <ChevronIcon direction="right" size={14} className="dict-word__chev" />
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── Your own record ──
            Last, because it's about the reader rather than the word.
            Nothing renders for an entry never reviewed: a grid of
            dashes is noise, not information. */}
        {entry.status?.total_reviews > 0 && (
          <section className="dict-block">
            {entry.status.due && (
              <div className="dict-block__note"><BoltIcon size={12} /> {t.dueNow}</div>
            )}
            <div className="records">
              <div className="record">
                <span className="record__value">
                  {entry.status.accuracy != null ? <>{entry.status.accuracy}<span className="record__unit">%</span></> : '—'}
                </span>
                <span className="record__label">{t.accuracy}</span>
              </div>
              <div className="record">
                <span className="record__value">{entry.status.correct_reviews}<span className="record__unit">/ {entry.status.total_reviews}</span></span>
                <span className="record__label">{t.totalReviews}</span>
              </div>
              <div className="record">
                <span className="record__value">
                  {entry.status.interval_days != null ? <>{entry.status.interval_days}<span className="record__unit">{t.days}</span></> : '—'}
                </span>
                <span className="record__label">{t.interval}</span>
              </div>
              <div className="record">
                <span className="record__value">{shortDate(entry.status.next_review, lang) ?? '—'}</span>
                <span className="record__label">{t.nextReview}</span>
              </div>
            </div>
          </section>
        )}

        {onClose && (
          <div className="dict-block">
            <button type="button" className="btn-secondary dict-entry__close" onClick={onClose}>{t.close}</button>
          </div>
        )}
      </div>

      {/* Every reading, grouped by register, each with the words that
          use it and the rest as chips (canvas DictionaryReadings). */}
      <Sheet open={readingsOpen} onClose={() => setReadingsOpen(false)} label={t.allReadings} className="dict-readings">
        <div className="dict-register__head">
          <span className="dict-readings__glyph" lang="ja">{entry.kanji}</span>
          <span className="dict-readings__title">{t.allReadings}</span>
        </div>
        {[['音', onyomi, t.onyomi], ['訓', kunyomi, t.kunyomi]].map(([kind, list, title]) => list.length > 0 && (
          <section key={kind} className="dict-block dict-register">
            <div className="dict-register__head">
              <span className="dict-kind" lang="ja">{kind}</span>
              <span className="dict-readings__title">{title}</span>
            </div>
            {list.map(reading => {
              const used = wordsFor(reading)
              if (used.length === 0) return null
              return (
                <div key={reading} className="dict-reading">
                  <span className="dict-reading__yomi" lang="ja">{reading}</span>
                  <div className="dict-words">
                    {used.map((w, i) => <WordRow key={i} word={w} hit={entry.kanji} as="div" />)}
                  </div>
                </div>
              )
            })}
            {list.some(r => wordsFor(r).length === 0) && (
              <ul className="dict-register__rest">
                {list.filter(r => wordsFor(r).length === 0).map(r => (
                  <li key={r} className="dict-register__chip" lang="ja">{r}</li>
                ))}
              </ul>
            )}
          </section>
        ))}
        <div className="dict-block">
          <button type="button" className="btn-secondary dict-entry__close" onClick={() => setReadingsOpen(false)}>{t.close}</button>
        </div>
      </Sheet>
    </article>
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- this setState is the "start of the fetch" reset (clears any previous term's stale result and flips on the loading spinner) that has to happen synchronously with kicking off the fetch below; it's inseparable from the network call, not a standalone "reset on id change" this could be replaced by a key-remount for.
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
// Fetches and shows one dictionary entry by term + category, opened
// from a quiz card ("what was that word?"). It has its own centred
// chrome rather than borrowing the catalogue's: the dictionary screen
// docks its plate beside the results on a wide screen, which is right
// there and wrong here — this is a portal over a quiz, with no
// catalogue to sit next to, so it is always a sheet.
export function DictionaryLookupSheet({ term, category, session, onClose }) {
  const { t, lang } = useLang()
  const { entry, loading, error } = useDictionaryLookup(session, term, category, lang, true)
  const dialogRef = useDialog(onClose)

  return createPortal(
    <div onClick={onClose} className="dict-sheet__scrim">
      <div ref={dialogRef} onClick={e => e.stopPropagation()} className="dict-sheet"
           role="dialog" aria-modal="true" aria-label={`${t.dictionaryTitle}: ${term}`}>
        {loading && <Loading />}
        {!loading && error && (
          <Empty tone="error" icon={null} message={t.notAvailable} action={{ label: t.close, onClick: onClose }} />
        )}
        {!loading && entry && (
          <DictionaryDetail entry={entry} onClose={onClose} leaveLabel={t.close} />
        )}
      </div>
    </div>,
    document.body,
  )
}
