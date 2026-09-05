import { useState, useEffect, useMemo, useRef, useId } from 'react'
import { createPortal } from 'react-dom'
import { LEVEL_COLORS } from './levelColors'
import { shortDate } from '../../lib/formatDate'
import { useLang } from '../../LangContext'
import { apiFetch } from '../../lib/api'
import { FuriganaParts, splitReadingTokens } from '../study/Readings'
import { StrokeOrderAnimation } from '../study/StrokeOrderAnimation'
import { StageMark } from '../study/StageMark'
import { isOnyomiToken, pickPlateReadings } from '../../domain/readingPick'
import { GlossList, firstGloss, splitGlosses } from '../study/gloss'
import { BoltIcon, ChevronIcon } from '../ui/Icons'
import { useDialog } from '../../hooks/useDialog'
import { speakJapanese } from '../../lib/audio'

const API_BASE = ''  // same-origin, always — see lib/api.js

// ── 見出し語 — the entry, as a plate ──────────────────────────
// The catalogue already draws every entry as a small 駅名標: reading
// above, headword, meaning below, the level's colour along the bottom
// edge. Opening one used to swap that plate for a different object — a
// sumi stage with a tategaki watermark, a vermillion speaker and seven
// uppercase section labels under it. This panel is the same plate the
// reader just tapped, at reading size: the three registers a station
// plate carries, 辞書's own gold as its stripe, and a body of blocks
// that name themselves (DESIGN.md, Structure — "a block that needs a
// heading to be legible is not finished"). A numbered list of glosses
// is a definition; a sentence over its translation is an example; a
// drawing of strokes on washi beside a stroke count is how the
// character is written. None of them needs a caption saying so.
//
// The pigment is 辞書's, injected once by the shell this renders in
// (.dict-dock on the dictionary screen, .dict-sheet over a quiz) and
// read here as --line-color: the entry is a dictionary object wherever
// it opens, the way the wall map's facility chip for 辞書 is gold on
// every screen. It appears as an edge (the stripe, a rail, a ring on
// hover) and as a numeral (the sense numbers) — never as a fill. The
// type colours that used to tint the panel (TYPE_META) were other
// sections' pigments, and stay on the catalogue's tabs where they
// belong.

// Small figure for a JMdict sense number — on the senses list itself
// and on any example sentence that could not nest under its sense, so
// a reader can tell which gloss a sentence illustrates. A tabular
// numeral in the entry's ink, per DESIGN.md's "colour is a numeral":
// no disc, no ring, no fill.
function SenseNumeral({ number, className = '' }) {
  return (
    <span className={`dict-sense__n ${className}`.trim()}>
      {number}
    </span>
  )
}

// One example sentence: furigana'd/highlighted Japanese over its
// translation. Shared by the nested-under-its-sense rendering and the
// flat fallback list (an example whose sense number matches no listed
// sense, or every example when there are no senses at all) so the two
// cannot drift apart.
function ExampleSentence({ ex, senseNumber }) {
  return (
    <div className="dict-ex">
      {senseNumber != null && <SenseNumeral number={senseNumber} className="dict-ex__n" />}
      <div className="dict-ex__jp" lang="ja">
        {ex.segments?.length > 0
          ? ex.segments.map((seg, j) => {
              // Each segment (a word, a kanji compound, a kana run) is
              // its own non-breaking unit — the line can wrap between
              // segments but never inside one, so a word never gets
              // split with a single trailing kanji/kana stranded alone
              // on the next line. Already split per kanji by the
              // backend (content/vocab_extras.py's _expand_furigana),
              // so this renders the segment as-is.
              const content = seg.reading
                ? <ruby>{seg.text}<rt>{seg.reading}</rt></ruby>
                : seg.text
              return seg.highlight
                ? <mark key={j} className="dict-ex__hl dict-ex__seg">{content}</mark>
                : <span key={j} className="dict-ex__seg">{content}</span>
            })
          : ex.jp}
      </div>
      <div className="dict-ex__tr">{ex.en}</div>
    </div>
  )
}

// ── Shared dictionary metadata/helpers ─────────────────────
// Previously defined inside DictionaryScreen.jsx only — pulled out
// here so anything else that needs to show a dictionary entry (e.g.
// QuizComponents' Flashcard, via DictionaryLookupSheet below) reuses
// the exact same panel instead of a second copy drifting out of sync
// with it.

// Per-category colours for the catalogue's category tabs (see
// DictionaryScreen's --tab-color). They are palette pigments so they
// flip with the theme; the detail panel itself no longer reads them —
// it wears 辞書's own line colour, injected by its shell.
// eslint-disable-next-line react-refresh/only-export-components -- TYPE_META is a plain colour/label lookup consumed by DictionaryScreen.jsx; not a component.
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
// eslint-disable-next-line react-refresh/only-export-components -- isKanaType is a plain predicate used by DictionaryScreen.jsx to branch shared detail-panel logic; not a component.
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

// Gloss splitting/normalising lives in ../study/gloss — the quiz
// components need the same helpers, and importing this whole
// detail-panel module for a pure text utility would be backwards
// (same reasoning as Readings.jsx being its own module).

// The mixer-aware one, imported above. This module used to define its
// own copy that ignored mute and the tts volume entirely, so a muted
// app still spoke. Re-exported so QuizComponents.jsx's
// DictionaryLookupSheet keeps its import path.
// eslint-disable-next-line react-refresh/only-export-components -- re-exported for QuizComponents.jsx's DictionaryLookupSheet; not a component.
export { speakJapanese }

// JLPT level as a quiet tinted tag, for the catalogue's entry cards
// (see .dict-entry-card .dict-level-badge, which reduces it further to
// marginalia). The detail plate does not use it: with one entry on
// screen the level is a plain numeral in the caption register, and the
// colour — which is a difficulty gradient, useful across a wall of
// forty plates — has nothing to compare against.
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
      className="dict-icon"
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
      className="dict-icon"
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

// SearchIcon moved to components/ui/Icons.jsx in plan 052 — it was
// used by three screens outside the dictionary, two of which were
// getting their glyph's size and colour from a `dict-` class purely by
// accident.

// One figure, in the profile's own cell: a large numeral, its unit
// inline, the caps label beneath (DESIGN.md, Type — "a figure and its
// label form a fixed pair"). It is the `.record` cell the 定期入れ's
// records lattice is built from, not a copy of it, so the stroke
// count beside the stroke-order sheet and the four figures of the
// reader's own record are the same object the profile prints.
// `onClick` makes it a door — the radical figure opens the radical
// index — with the ledger's own chevron sliding in on approach;
// without one it is inert text, not a dead-looking control.
function Figure({ value, unit, unitLang, label, onClick }) {
  const body = (
    <span className="record__body">
      <span className="record__value">
        {value}
        {unit && <span className="record__unit" lang={unitLang}>{unit}</span>}
      </span>
      <span className="record__label">{label}</span>
    </span>
  )
  return onClick
    ? (
      <button type="button" onClick={onClick} className="record record--door">
        {body}
        <ChevronIcon direction="right" size={16} className="record__chev" />
      </button>
    )
    : <div className="record">{body}</div>
}

// A grammatical/priority tag ("n", "v1", "uk"...) with its full JMdict
// note shown as a tooltip rather than on the tag itself (the note is
// often a full sentence — too long to sit inline). Set as a quiet
// dotted-underlined word in the caption register instead of a pill:
// a run of pills over every sense was the loudest thing in the body
// and said the least. A <button> rather than a plain span so a tap on
// mobile can focus it and reveal the tooltip too, not just desktop
// hover.
//
// The tooltip itself is portaled straight to document.body and placed
// with fixed coordinates computed from the tag's own bounding box,
// rather than living inside the tag as an absolutely-positioned span.
// Both places this renders (the phone sheet, the desktop dock) scroll
// their own content, and any scrolling ancestor clips an
// absolutely-positioned child that pokes outside it — the tooltip was
// getting cut off at the panel's edge. Fixed-position + portal escapes
// that entirely; the horizontal position is then clamped to the
// viewport and the tooltip flips above the tag when there isn't
// enough room below, so it never runs off-screen either.
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

// The stroke-order drawing on its sheet of washi, plus its own failure
// fallback. Owns `failed` itself and is remounted (via the
// `key={entry.svg_url}` its caller passes) whenever the entry changes,
// so a previous entry's load failure can never stick around and hide
// a diagram that would otherwise load fine for the new one — no reset
// effect needed since a fresh mount already starts from `failed: false`.
function StrokeSheet({ src, notAvailableLabel }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className="dict-form__sheet">
      {!failed && (
        <StrokeOrderAnimation
          src={src}
          loop
          className="dict-form__glyph"
          onError={() => setFailed(true)}
        />
      )}
      {failed && (
        <div className="dict-form__fallback">{notAvailableLabel}</div>
      )}
    </div>
  )
}

// One word that uses the kanji: its furigana'd form, its first gloss,
// and — when the caller can navigate — the ledger's chevron. Shared by
// the "used in these words" ledger and the readings panel, where the
// same rows sit under the reading they demonstrate. Without `onClick`
// (the sheet over a quiz has no dictionary underneath to jump around
// in) it is a plain row, not a dead-looking button.
function WordRow({ w, onClick }) {
  const body = (
    <>
      <span className="dict-word__jp" lang="ja">
        {w.furigana?.length ? <FuriganaParts parts={w.furigana} /> : w.kanji}
      </span>
      <span className="dict-word__gloss">{firstGloss(w.meaning)}</span>
    </>
  )
  return onClick
    ? (
      <button type="button" onClick={() => onClick(w.kanji, w.kana)} className="dict-word">
        {body}
        <ChevronIcon direction="right" size={16} className="dict-word__chev" />
      </button>
    )
    : <div className="dict-word dict-word--static">{body}</div>
}

// The 音 / 訓 mark: a small carved square, so the two registers tell
// apart without the long translated labels the study card prints.
function KindMark({ token }) {
  return <span className="dict-kind" aria-hidden="true">{isOnyomiToken(token) ? '音' : '訓'}</span>
}

// How big the headword is set. A lone character is a specimen and
// takes the specimen rung — the reader is looking at its shape, and
// the stroke sheet below repeats it at drawing size. A word takes the
// display rung; a long expression steps down once more so seven or
// eight characters still sit on a 340px dock without shattering.
function headwordSize(text) {
  const n = [...(text || '')].length
  if (n <= 1) return 'glyph'
  if (n <= 6) return 'word'
  return 'long'
}

// ── Detail panel ──────────────────────────────────────────
// Renders one entry's full detail. `onRadicalClick`/`onKanjiClick`/
// `onVocabClick` are optional — DictionaryScreen passes real handlers
// so its radical figure, kanji tiles and word rows can jump elsewhere
// in the dictionary; a caller that can't offer that navigation (e.g. a
// quiz flashcard, which has no dictionary screen underneath it to
// jump around in) just omits them, and those blocks simply don't
// render rather than rendering as dead buttons.
export function DictionaryDetail({ entry, onClose, onRadicalClick, onKanjiClick, onVocabClick }) {
  const { t, lang, contentMaps } = useLang()
  const map = entry.type === 'vocab' ? contentMaps?.vocab
    : entry.type === 'kanji' ? contentMaps?.kanji
    : null
  const isKanji = entry.type === 'kanji'
  const isKana  = isKanaType(entry.type)
  // Kana has no semantic "meaning" to translate — its romaji is its
  // plain-language name and takes the plate's caption instead.
  const meaning = isKana
    ? null
    : lang === 'fr'
      ? (map?.[entry.kanji || entry.kana] ?? entry.meaning)
      : entry.meaning

  // Every kanji character used in this vocab word, deduplicated and in
  // reading order — each becomes a tile that opens that kanji's own
  // entry (see jumpToKanji in DictionaryScreen). Matches CJK Unified
  // Ideographs; a kana-only word (entry.kanji empty) yields none.
  const composingKanji = useMemo(() => {
    if (entry.type !== 'vocab' || !entry.kanji) return []
    const chars = entry.kanji.match(/[一-龯]/g) || []
    return [...new Set(chars)]
  }, [entry.type, entry.kanji])

  // The plate's three registers. A station plate sets the reading over
  // the name and the plain-language name under it; here the reading is
  // the word's furigana (per kanji, computed backend-side by
  // routes/dictionary.py's _word_furigana), the kanji's 音/訓 split, or
  // — when a word's alignment came back empty — its kana on a line of
  // its own, so a word never appears without its reading. The caption
  // is the entry's first gloss (the full list lives in the body), or a
  // kana's romaji.
  const headword = entry.kanji || entry.kana
  const headwordFurigana = entry.type === 'vocab' ? entry.furigana : null
  const showKanaLine = entry.type === 'vocab'
    && !headwordFurigana?.length
    && !!entry.kanji && !!entry.kana && entry.kana !== entry.kanji
  const caption = isKana ? entry.romaji : firstGloss(meaning)
  // routes/dictionary.py fills a kana's level slot with "Hiragana" /
  // "Katakana" for the catalogue's grouping; the plate prints JLPT
  // levels only — the script is plain from the character itself.
  const jlpt = /^N[1-5]$/.test(entry.level ?? '') ? entry.level : null

  // Every JMdict sense (from get_vocab_extras) and the example
  // sentences that illustrate each one. Split into "nested under a
  // sense" vs. "flat" here, once, so both the senses list and the
  // fallback examples block below read from the same source instead
  // of each re-deriving it slightly differently.
  const senses = entry.senses ?? []
  const examples = entry.examples ?? []
  const senseNumbers = useMemo(() => new Set((entry.senses ?? []).map(s => s.number)), [entry.senses])
  // Examples that don't get nested under a sense row: either there are
  // no senses at all (so the per-sense list itself doesn't render),
  // or an example's sense_number doesn't match any listed sense.
  const flatExamples = senses.length > 0
    ? examples.filter(ex => !senseNumbers.has(ex.sense_number))
    : examples
  const examplesBySense = number => examples.filter(ex => ex.sense_number === number)

  // With no senses list, the definition is the app's own gloss line.
  // Its first gloss is already the plate's caption, so the block only
  // prints when there is more to say than that one word.
  const glossCount = senses.length > 0 ? 0 : splitGlosses(meaning).length

  // Stroke count and radical describe the *drawing* of the character,
  // so they sit beside the stroke-order sheet in one lattice rather
  // than in a metadata run somewhere else in the panel. The lattice's
  // column count divides its content (DESIGN.md, Surfaces): the sheet
  // spans every figure row beside it, and with no sheet the figures
  // take a column each.
  const hasRadicalLink = isKanji && entry.radical != null && !!onRadicalClick
  const hasSheet = (isKanji || isKana) && !!entry.svg_url
  const figureCount = ((isKanji || isKana) && entry.stroke_count ? 1 : 0) + (hasRadicalLink ? 1 : 0)
  const showForm = hasSheet || figureCount > 0
  const formStyle = {
    '--dict-form-cols': hasSheet ? (figureCount > 0 ? 2 : 1) : figureCount,
    '--dict-form-rows': Math.max(figureCount, 1),
  }

  const status = entry.status
  const record = status?.total_reviews > 0

  // ── Readings ──
  // The plate shows two: the first on'yomi and the first kun'yomi when
  // a kanji has both (see pickPlateReadings). 生 has twenty readings and
  // a plate is not the place for them; "+N" opens the panel, where every
  // reading is listed with the words that use it (entry.readings, from
  // study/kanji_words.py). The open state is keyed to the entry, so
  // moving to another kanji closes it without an effect.
  const tokens = useMemo(() => (isKanji ? splitReadingTokens(entry.kana) : []), [isKanji, entry.kana])
  const shownReadings = pickPlateReadings(tokens, 2)
  const hiddenReadings = tokens.length - shownReadings.length
  const readingGroups = entry.readings ?? []
  const [openKey, setOpenKey] = useState(null)
  const readingsOpen = isKanji && openKey === entryKey(entry)
  const readingsId = useId()
  // card_stats (study/card_lookup.py) says "not_started" for a card
  // with no state in any mode; the seal's vocabulary is new / learning
  // / mastered, and a card nobody has touched is the unstruck seal.
  const stage = !status?.status || status.status === 'not_started' ? 'new' : status.status

  return (
    <article className="dict-entry">
      {/* ── The plate ────────────────────────────────────────
          Sticky at the top of the scrolling shell, so the word stays
          in view while its examples scroll under it — on a phone the
          entry is the whole screen and this is the reading view. The
          seal and the level ride in one corner, the two actions in the
          other, and the three registers sit centred between them. */}
      <header className="dict-plate">
        <div className="dict-plate__row">
          <div className="dict-plate__marks">
            <StageMark stage={stage} inline />
            {jlpt && <span className="dict-plate__level">{jlpt}</span>}
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
            <button
              type="button"
              onClick={onClose}
              className="dict-plate__btn"
              title={t.close}
              aria-label={t.close}
            >
              <CloseIcon />
            </button>
          </div>
        </div>

        <div className="dict-plate__stack">
          {shownReadings.length > 0 && (
            <div className="dict-plate__readings">
              {shownReadings.map(tok => (
                <span key={tok} className="dict-plate__yomi" lang="ja">
                  <KindMark token={tok} />
                  {tok}
                </span>
              ))}
              {/* Every reading, each with its words, behind one small
                  door. The count says how many the plate is not printing
                  (none, for a kanji with two); the chevron says it opens. */}
              <button
                type="button"
                onClick={() => setOpenKey(readingsOpen ? null : entryKey(entry))}
                className={`dict-plate__more${readingsOpen ? ' dict-plate__more--open' : ''}`}
                aria-expanded={readingsOpen}
                aria-controls={readingsId}
                aria-label={t.allReadings}
                title={t.allReadings}
              >
                {hiddenReadings > 0 && <span>+{hiddenReadings}</span>}
                <ChevronIcon direction="down" size={14} className="dict-plate__more-chev" />
              </button>
            </div>
          )}
          {showKanaLine && (
            <div className="dict-plate__reading" lang="ja">{entry.kana}</div>
          )}
          <h2 className={`dict-plate__word dict-plate__word--${headwordSize(headword)}`} lang="ja">
            {headwordFurigana?.length
              ? <FuriganaParts parts={headwordFurigana} />
              : headword}
          </h2>
          {caption && <div className="dict-plate__caption">{caption}</div>}
        </div>

        <div className="dict-plate__stripe" aria-hidden="true" />
      </header>

      <div className="dict-entry__body">

        {/* ── Every reading, with its words ────────────────
            Opened from the plate. The deck's order (on'yomi, then
            kun'yomi), each reading a small group: its 音/訓 mark and the
            reading, then up to four words that use it in the ledger's
            own rows. A reading no word in the deck demonstrates is
            still listed — the panel is "all of them" — just alone. */}
        {readingsOpen && (
          <section className="dict-block dict-readings" id={readingsId} aria-label={t.allReadings}>
            {readingGroups.map(({ reading, words }) => (
              <div key={reading} className="dict-reading">
                <div className="dict-reading__head" lang="ja">
                  <KindMark token={reading} />
                  <span className="dict-reading__yomi">{reading}</span>
                </div>
                {words?.length > 0 && (
                  <div className="dict-words">
                    {words.map((w, i) => <WordRow key={i} w={w} onClick={onVocabClick} />)}
                  </div>
                )}
              </div>
            ))}
          </section>
        )}

        {/* ── What it means ────────────────────────────────
            First, always. A word shows its JMdict senses (a
            single-sense word renders through the same list, so there
            is one model rather than a gloss row that then repeats
            itself), each with the sentences that illustrate it; a
            kanji, or a word JMdict had no senses for, lists its
            glosses as one line of prose. */}
        {senses.length > 0 ? (
          <section className="dict-block" aria-label={t.meaning}>
            <ol className="dict-senses">
              {senses.map(sense => {
                const exs = examplesBySense(sense.number)
                return (
                  <li key={sense.number} className="dict-sense">
                    <SenseNumeral number={sense.number} />
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
                      {exs.length > 0 && (
                        <div className="dict-sense__examples">
                          {exs.map((ex, i) => <ExampleSentence key={i} ex={ex} />)}
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ol>
          </section>
        ) : (
          glossCount > 1 && (
            <section className="dict-block" aria-label={t.meaning}>
              <p className="dict-gloss"><GlossList meaning={meaning} /></p>
            </section>
          )
        )}

        {/* ── How it's used ────────────────────────────────
            Sentences that couldn't nest under a specific sense above.
            Straight after the definition, because a sentence reads
            best next to the meaning it illustrates. */}
        {flatExamples.length > 0 && (
          <section className="dict-block" aria-label={t.examples}>
            <div className="dict-examples">
              {flatExamples.map((ex, i) => (
                <ExampleSentence key={i} ex={ex} senseNumber={senses.length > 0 ? ex.sense_number : null} />
              ))}
            </div>
          </section>
        )}

        {/* ── How it's written ─────────────────────────────
            The stroke-order sheet with its stroke count and radical
            beside it — three facts about drawing the character, in
            one lattice. Before the words that use it: a 漢和辞典
            gives the character's own facts, then its compounds. */}
        {showForm && (
          <section className="dict-block" aria-label={t.strokeOrder}>
            <div className="dict-form" style={formStyle}>
              {hasSheet && (
                <StrokeSheet
                  key={entry.svg_url}
                  src={`${API_BASE}${entry.svg_url}`}
                  notAvailableLabel={t.notAvailable}
                />
              )}
              {(isKanji || isKana) && entry.stroke_count && (
                <Figure value={entry.stroke_count} unit="画" unitLang="ja" label={t.strokes} />
              )}
              {hasRadicalLink && (
                <Figure
                  value={`#${entry.radical}`}
                  label={t.radical}
                  onClick={() => onRadicalClick(entry.radical)}
                />
              )}
            </div>
          </section>
        )}

        {/* ── What it connects to ──────────────────────────
            Two directions of one relationship, and an entry only
            ever has one of them: a kanji links out to the words it
            appears in (a ledger of rows, each a door — four words
            chosen to cover as many readings as the deck can, and
            stood down while the readings panel above lists the same
            words under their readings), a word links down to the
            kanji it is built from (a row of tiles, each the small
            plate of the entry it opens). */}
        {onVocabClick && isKanji && !readingsOpen && entry.vocab_examples?.length > 0 && (
          <section className="dict-block" aria-label={t.vocabExamples}>
            <div className="dict-words">
              {entry.vocab_examples.map((w, i) => <WordRow key={i} w={w} onClick={onVocabClick} />)}
            </div>
          </section>
        )}

        {onKanjiClick && composingKanji.length > 0 && (
          <section className="dict-block" aria-label={t.composingKanji}>
            <div className="dict-parts">
              {composingKanji.map(char => (
                <button
                  type="button"
                  key={char}
                  onClick={() => onKanjiClick(char)}
                  className="dict-part"
                  lang="ja"
                >
                  {char}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── Your own record ──────────────────────────────
            Last, because it is about the reader rather than the word.
            Four figures, two by two, in the profile's records lattice;
            nothing renders at all for an entry never reviewed, since a
            grid of dashes is noise, not information. "Due now" is a
            state of the block, so it rides above the lattice as a note
            rather than inside it as a fifth figure. */}
        {record && (
          <section className="dict-block" aria-label={t.cardStats}>
            {status.due && (
              <div className="dict-block__note"><BoltIcon size={12} /> {t.dueNow}</div>
            )}
            <div className="records">
              <Figure
                value={status.accuracy != null ? status.accuracy : '—'}
                unit={status.accuracy != null ? '%' : null}
                label={t.accuracy}
              />
              <Figure
                value={`${status.correct_reviews}/${status.total_reviews}`}
                label={t.totalReviews}
              />
              <Figure
                value={status.interval_days != null ? status.interval_days : '—'}
                unit={status.interval_days != null ? t.days : null}
                label={t.interval}
              />
              <Figure
                value={shortDate(status.next_review, lang) ?? '—'}
                label={t.nextReview}
              />
            </div>
          </section>
        )}

        {/* A thumb affordance on a phone, where the entry is the whole
            screen and the ✕ is at the far end of it. Hidden everywhere
            else (see .dict-entry__close): the plate's ✕, Escape and the
            scrim already close a dock or a modal. */}
        <button type="button" onClick={onClose} className="btn-secondary dict-entry__close">
          {t.close}
        </button>
      </div>
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
// docks its panel beside the results on a wide screen, which is right
// there and wrong here — this is a portal over a quiz, with no
// catalogue to sit next to, so it is always a sheet. On a phone it is
// the whole screen, exactly as the dock is (see .dict-sheet).
export function DictionaryLookupSheet({ term, category, session, onClose }) {
  const { t, lang } = useLang()
  const { entry, loading, error } = useDictionaryLookup(session, term, category, lang, true)
  const dialogRef = useDialog(onClose)

  return createPortal(
    <div onClick={onClose} className="dict-sheet__scrim">
      <div ref={dialogRef} onClick={e => e.stopPropagation()} className="dict-sheet"
           role="dialog" aria-modal="true" aria-label={`${t.dictionaryTitle}: ${term}`}>
        {loading && (
          <div className="quiz-loading">{t.loadingDictionary}</div>
        )}
        {!loading && error && (
          <div className="dict-sheet__empty">
            <div className="quiz-loading">{t.notAvailable}</div>
            <button type="button" onClick={onClose} className="btn-secondary">
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
