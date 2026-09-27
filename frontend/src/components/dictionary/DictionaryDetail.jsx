import { Fragment, useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { LEVEL_COLORS } from './levelColors'
import { shortDate } from '../../lib/formatDate'
import { useLang } from '../../LangContext'
import { apiFetch } from '../../lib/api'
import { api } from '../../lib/origin'
import { FuriganaParts, splitReadingTokens } from '../study/Readings'
import { joinRuns } from '../../domain/rubyRuns'
import { ExampleSentence, SenseNumeral } from './ExampleSentence'
import { GrammarLesson } from '../study/GrammarLesson'
import { StrokeOrderAnimation } from '../study/StrokeOrderAnimation'
import { StageMark } from '../study/StageMark'
import { isOnyomiToken, pickPlateReadings } from '../../domain/readingPick'
import { GlossList, firstGloss, mergeSenses, splitGlosses } from '../study/gloss'
import { useMineAction, INERT_MINING } from '../analysis/useMineAction'
import { BoltIcon, ChevronIcon, CloseIcon, PlusIcon, StarIcon } from '../ui/Icons'
import { useDialog } from '../../hooks/useDialog'
import { dialogOpen } from '../../lib/dialogOpen'
import { composing } from '../../lib/keyGuards'
import { useDesk } from '../../hooks/useDesk'
import { holdEsc } from '../../stores/escHold'
import { speakJapanese, playKana, kanaSound } from '../../lib/audio'

// ── 見出し語 — the entry, as a plate ──────────────────────────
// The catalogue already draws every entry as a small 駅名標: the
// headword with its reading over it as furigana, the meaning below, the
// stage's ink along the bottom edge (the tile's reading was a line of
// its own above the word until the owner moved it onto the characters
// it belongs to; the plate below still prints both registers, because
// it has the room). Opening one used to swap that plate for a
// different object — a
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

// SenseNumeral and ExampleSentence live in ./ExampleSentence.jsx: the
// grammar lesson prints the same sentence object in three places
// (plan 087), so the renderer is shared rather than private here.

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
  grammar:  { color: 'var(--line-grammar)', fallback: 'Grammaire' },
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
// that assumption breaks down over the JMdict pool that now forms the
// tail of the vocabulary collection, where every entry has level: null
// and homographs are far more common — so kana is always folded in
// too, not just used as a fallback when kanji is absent.
// eslint-disable-next-line react-refresh/only-export-components -- entryKey is a plain identity-string helper used by DictionaryScreen.jsx for React keys/selection comparisons; not a component.
export function entryKey(entry) {
  // A grammar point has no kanji/kana halves; its card id already
  // carries the level and the pattern (content/grammar_points_data.py).
  if (entry.type === 'grammar') return `grammar:${entry.level ?? '_'}:${entry.raw_id}`
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

// CloseIcon moved to components/ui/Icons.jsx in plan 123: the desk's
// column docks (chrome/DeskDock) close with the entry's own roundel.

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
//
// `ink` names a STATE the figure is in rather than a value it holds —
// "due" is the only one, and it is the whole of what the floating
// "DUE NOW" note used to say above the lattice (plan 089). `jp` is for
// a figure whose value is a character rather than a number: the
// radical's own glyph, a kana's twin.
function Figure({ value, unit, unitLang, label, onClick, ink, jp }) {
  const body = (
    <span className="record__body">
      <span
        className={`record__value${ink ? ` record__value--${ink}` : ''}${jp ? ' record__value--jp' : ''}`}
        lang={jp ? 'ja' : undefined}
      >
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
  // Stable, or StrokeOrderAnimation's parse effect re-runs every render.
  const onError = useCallback(() => setFailed(true), [])
  return (
    <div className="dict-form__sheet">
      {!failed && (
        <StrokeOrderAnimation
          src={src}
          loop
          className="dict-form__glyph"
          onError={onError}
        />
      )}
      {failed && (
        <div className="dict-form__fallback">{notAvailableLabel}</div>
      )}
    </div>
  )
}

// The kana a row is an example of, picked out of the word in the
// entry's ink. The same job FuriganaParts' `hit` does for a kanji row,
// on a string that has no parts to mark it in: only the first
// occurrence is struck, since the row is showing where the character
// is read, not counting how often.
function Picked({ text, hit }) {
  const at = hit ? text.indexOf(hit) : -1
  if (at < 0) return text
  return (
    <>
      {text.slice(0, at)}
      <span className="dict-word__hit">{text.slice(at, at + hit.length)}</span>
      {text.slice(at + hit.length)}
    </>
  )
}

// Whether `char` sits inside a reading the aligner kept whole
// (study/furigana.py): a part that holds it and more, under one reading.
// A part of its own means the word reads the character by one of its
// readings; no reading at all means there is nothing to say.
function readAsWhole(parts, char) {
  return Boolean(char) && (parts ?? []).some(
    p => p.reading && p.text !== char && p.text.includes(char),
  )
}

// One word that uses the character: its furigana'd form with the kanji
// itself picked out in the entry's ink — so the reading this word
// demonstrates is what the eye lands on — its first gloss, and, when the
// caller can navigate, the ledger's chevron. Shared by the "used in
// these words" ledger and the readings sheet, where the same rows sit
// under the reading they demonstrate. Without `onClick` (the sheet
// over a quiz has no dictionary underneath to jump around in) it is a
// plain row, not a dead-looking button.
//
// `reading` is the kana entry's row (plan 088): it prints the word's
// READING with the kana picked out of it, because a reader still
// learning the syllabary cannot be shown 朝 as an example of あ. The
// written form stays behind the row, as what it opens.
//
// A word whose reading belongs to the whole of it — 今朝 read けさ, where
// け is no reading of 今 (熟字訓, 当て字) — keeps one ruby over the run
// and carries a 熟 in the 音/訓 square beside it: the one row in the
// ledger that is an example of the character but not of any of its
// readings, and it says so.
function WordRow({ w, char, onClick, reading = false }) {
  const { t } = useLang()
  const whole = !reading && readAsWhole(w.furigana, char)
  const body = (
    <>
      <span className="dict-word__jp" lang="ja">
        {reading
          ? <Picked text={w.kana} hit={char} />
          : w.furigana?.length
            ? <FuriganaParts parts={w.furigana} hit={char} hitClassName="dict-word__hit" />
            : w.kanji}
      </span>
      {whole && (
        <span className="dict-kind" title={t.readingsWhole}>
          <span aria-hidden="true">熟</span>
          <span className="sr-only">{t.readingsWhole}</span>
        </span>
      )}
      <span className="dict-word__gloss">{firstGloss(w.meaning)}</span>
    </>
  )
  return onClick
    ? (
      // A word written in kana alone (テレビ) has no kanji to search
      // for, and the reading is its headword as well as its reading.
      <button type="button" onClick={() => onClick(w.kanji || w.kana, w.kana)} className="dict-word">
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

// ── The register — a gate ─────────────────────────────────────
// The register, stood at rather than marked: its plain-language name
// and the count of readings behind it. The old sheet said this with a
// 22px carved square at --fs-caption-xs in the secondary ink — which
// names the register to nobody who can already read 音, and is too
// quiet to divide two blocks besides.
//
// It led with 音読み and captioned it CHINESE READING until the
// owner's call of 2026-09-21. The Latin half of that pair was doing
// all the work for the learner who needs the gate at all, so it is
// the gate now, at the rung and in the ink the Japanese held.
function ReadingGate({ name, n, open, onPick }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={`dict-gate${open ? ' dict-gate--on' : ''}`}
      aria-pressed={open}
    >
      <span className="dict-gate__name">
        {name}<span className="dict-gate__n">{n}</span>
      </span>
    </button>
  )
}

// One reading, and the words that demonstrate it: the reading as a
// band of sumi that sticks to the top of the list while its words
// pass under it, then the words in the ledger's own rows, unchanged —
// the kanji in each picked out in the entry's ink exactly as the
// ledger picks it out.
//
// The band is the fix for the sheet's second defect. The reading used
// to be set at --fs-lead in --text-primary — the rung and the ink of
// the word rows it heads — flush with a list that bleeds sixteen
// pixels further left than it does. A head cannot be the quietest
// thing in its own group. GROUND is what separates them now, which is
// what lets the rows keep their own gold: sumi against surface is not
// a distinction the rows can dilute, the way a shared rung was.
function ReadingBand({ reading, words, kind, char, onWord }) {
  return (
    <section className="dict-rd" aria-label={reading}>
      <h2 className="dict-rd__head">
        <span className="dict-rd__kind" aria-hidden="true">{kind}</span>
        <span className="dict-rd__yomi" lang="ja">{reading}</span>
      </h2>
      <div className="dict-words">
        {words.map((w, i) => <WordRow key={i} w={w} char={char} onClick={onWord} />)}
      </div>
    </section>
  )
}

// ── Every reading, behind two gates ───────────────────────────
// The panel behind the plate's door. A sheet of its own over whatever
// is on screen — the dock, or the lookup sheet over a quiz — in the
// lookup sheet's chrome, so the entry underneath stays exactly as it
// is and the list gets the width and the scroll a list that long
// needs: 生 has twenty readings, most with words. Its head is the
// plate's construction without the registers — the kanji, what this
// is, the ✕ — and the same stripe.
//
// ONE REGISTER AT A TIME, under the gates. Both registers in one
// column is what made them confusable at all; a gate each means they
// are never on screen together to be confused, and it halves the list
// 生 opens with. Inside the open one: the readings the deck has words
// for, in the deck's order, each a band over the ledger's own rows;
// the readings no word demonstrates — for 生 that is fourteen of
// twenty — close the list as one wrapped row of quiet pills under a
// caption that finally says what they are. A kanji with one register
// gets no gates: a segmented control with one segment is a label
// pretending to be a choice.
//
// Escape and the scrim close this sheet and only this sheet (see
// useDialog's `capture`); a word that opens closes it too — the
// reading this list was opened to demonstrate is answered by the
// word's own entry, and a third scrim over the two already standing is
// a stack no reader is keeping count of. On a phone it is the whole
// screen, as every sheet here is.
function ReadingsSheet({ entry, groups, onClose, onVocabClick }) {
  const { t } = useLang()
  const dialogRef = useDialog(onClose, { capture: true })
  return createPortal(
    <div onClick={onClose} className="dict-sheet__scrim dict-sheet__scrim--over">
      <div ref={dialogRef} onClick={e => e.stopPropagation()} className="dict-sheet dict-sheet--readings"
           role="dialog" aria-modal="true" aria-label={`${t.allReadings}: ${entry.kanji}`}>
        <ReadingsList entry={entry} groups={groups} onClose={onClose} onVocabClick={onVocabClick} />
      </div>
    </div>,
    document.body,
  )
}

// ── 机 — every reading, in the entry's own place (plan 120) ──────────
// On the desk an entry mostly stands in a column — the dictionary's
// dock, a run's side, the analyser's dock — and every door in it opens
// inside that column (DESIGN.md, "A door opens in the column, never over
// it"). The readings were the one door still setting a scrim over the
// lot. Here the list takes the entry's place in whatever holds it, a
// column or a lookup dialog, and ✕ or Esc steps back to the entry. Esc
// is taken in the capture phase and spent, so the dock, the lookup or
// the run holding the entry does not hear it too — unless a dialog that
// does not hold this list stands over it, whose key it then is.
function ReadingsInPlace({ entry, groups, onClose, onVocabClick }) {
  const { t } = useLang()
  const ref = useRef(null)
  const onCloseRef = useRef(onClose)
  useLayoutEffect(() => { onCloseRef.current = onClose })
  useEffect(() => {
    const node = ref.current
    node?.querySelector('.dict-plate__btn')?.focus({ preventScroll: true })
    node?.scrollIntoView?.({ block: 'nearest' })
    const onKey = e => {
      if (e.key !== 'Escape') return
      const over = [...document.querySelectorAll('[aria-modal="true"]')].some(d => !d.contains(node))
      if (over) return
      e.preventDefault()
      e.stopPropagation()
      onCloseRef.current()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])
  return (
    <div ref={ref} className="desk-readings" role="region" aria-label={`${t.allReadings}: ${entry.kanji}`}>
      <ReadingsList entry={entry} groups={groups} onClose={onClose} onVocabClick={onVocabClick} />
    </div>
  )
}

// The list itself — the plate's head, the gates, the bands and the
// pills — shared by the sheet and the list in place.
function ReadingsList({ entry, groups, onClose, onVocabClick }) {
  const { t } = useLang()
  const jump = onVocabClick
    ? (kanji, kana) => { onClose(); onVocabClick(kanji, kana) }
    : undefined
  const on = groups.filter(g => isOnyomiToken(g.reading))
  const kun = groups.filter(g => !isOnyomiToken(g.reading))
  // Which gate is open on arrival: the register the deck's own order
  // puts first, which is where a kanji marks its primary reading (see
  // domain/readingPick). A kanji taught for its kun reading does not
  // open on a 音 list, and one with a single register opens on it.
  const [gate, setGate] = useState(() => (
    kun.length === 0 || isOnyomiToken(groups[0]?.reading) ? 'on' : 'kun'
  ))
  const open = gate === 'on' && on.length > 0 ? on : kun
  const kind = open === on ? '音' : '訓'
  const withWords = open.filter(g => g.words?.length > 0)
  const rest = open.filter(g => !g.words?.length)
  return (
    <article className="dict-entry">
      <header className="dict-plate">
        <div className="dict-plate__row">
          <div className="dict-plate__marks">
            <span className="dict-readings__glyph" lang="ja">{entry.kanji}</span>
            <span className="dict-readings__title">{t.allReadings}</span>
          </div>
          <div className="dict-plate__actions">
            {/* Desk-only (plan 120), and Esc steps back too (plan 123). */}
            <button
              type="button"
              onClick={onClose}
              className="dict-plate__btn"
              title={`${t.close} (${t.keyEscape})`}
              aria-label={t.close}
              aria-keyshortcuts="Escape"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
        <div className="dict-plate__stripe" aria-hidden="true" />
      </header>
      {on.length > 0 && kun.length > 0 && (
        <div className="dict-gates">
          <ReadingGate
            name={t.readingsOnName} n={on.length}
            open={open === on} onPick={() => setGate('on')}
          />
          <ReadingGate
            name={t.readingsKunName} n={kun.length}
            open={open === kun} onPick={() => setGate('kun')}
          />
        </div>
      )}
      <div className="dict-entry__body dict-readings"
           aria-label={open === on ? t.readingsOnName : t.readingsKunName}>
        {withWords.map(({ reading, words }) => (
          <ReadingBand
            key={reading} reading={reading} words={words}
            kind={kind} char={entry.kanji} onWord={jump}
          />
        ))}
        {rest.length > 0 && (
          <section className="dict-rest" aria-label={t.readingsNoWords}>
            <div className="dict-rest__cap">{t.readingsNoWords}</div>
            <ul className="dict-rest__chips">
              {rest.map(({ reading }) => (
                <li key={reading} className="dict-rest__chip" lang="ja">{reading}</li>
              ))}
            </ul>
          </section>
        )}
        <button type="button" onClick={onClose} className="btn-secondary dict-entry__close">
          {t.close}
        </button>
      </div>
    </article>
  )
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
// Renders one entry's full detail. The SAME detail everywhere it is
// opened from — the catalogue, or the sheet a quiz card opens over a
// run: an entry is one object and a reader who taps 駅 mid-review is
// asking the same question as one who taps it in the dictionary.
//
// `onBack`/`onRadicalClick`/`onKanjiClick`/`onVocabClick` are optional
// and decide only what is a DOOR, never what is printed. Where a
// caller can offer the navigation, the radical figure, the kanji tiles
// and the word rows open it; where it cannot, each prints in the inert
// form it already has (Figure and WordRow have carried one all along)
// — a fact of the entry, not a dead control.
//
// They were gated on the handlers themselves, so the sheet over a quiz
// silently dropped the radical and the words a kanji appears in, and
// with the radical went its cell in the form lattice: the same entry
// was two different cards depending on where you had opened it from.
//
// `onGrammarClick(raw_id)` is the door a grammar point's compare rows
// open (plan 087): the rival's own entry, in whatever shell this is in.
//
// `onKanaClick(kana, type)` is the twin's door in a kana's form
// lattice: あ opens ア and back (plan 089).
//
// `mining` (a useMining instance, optional) is what makes the `+`
// roundel exist: the plate's one action, adding this entry to one of
// the learner's decks through the same write the analyzer's chips use.
// It was a grammar point's alone; every entry the app has a card for
// carries it now, and `entry.app_card` is what says whether there is
// one (routes/dictionary.py). Without `mining` the plate has the ✕.
//
// `onReview(rawId)` boards the one card this entry is: the action
// under the reader's own record, printed only where a card is DUE and
// only where a caller can offer the run — a lookup sheet opened over a
// quiz has no run to send anyone to, and an action with nowhere to go
// is not a fact the way an inert row is, it is a dead control.
//
// `favorites` (a useFavorites instance, optional) is the learner's
// shelf in the dictionary (plan 093). The plate's ＋ opens a menu of
// the two places an entry can be put: on the shelf (a bookmark, to
// read again) and in a deck (a card the scheduler will ask for). Each
// row exists only where its caller can honour it — no shelf row
// without `favorites`, no deck row without `mining` and a card — and
// with neither there is no ＋ at all: a sheet over a quiz files
// nowhere.
export function DictionaryDetail({ entry, onClose, onBack, onRadicalClick, onKanjiClick, onVocabClick, onGrammarClick, onKanaClick, onReview, mining, favorites, band = false }) {
  const { t, lang, contentMaps } = useLang()
  const map = entry.type === 'vocab' ? contentMaps?.vocab
    : entry.type === 'kanji' ? contentMaps?.kanji
    : null
  const isKanji   = entry.type === 'kanji'
  const isKana    = isKanaType(entry.type)
  // ── A grammar point ──
  // The same plate, read differently: the structure is its reading
  // register (how the pattern is formed), the pattern its headword, the
  // gloss its caption — printed whole, since "the copula: is/am/are" is
  // a phrase and not a list. No speak roundel: 〜てから is not a thing
  // that can be said. The gloss arrives in the learner's language from
  // routes/dictionary.py (plan 087), as the 文法 line's own cards do.
  const isGrammar = entry.type === 'grammar'
  // Kana has no semantic "meaning" to translate — its romaji is its
  // plain-language name and takes the plate's caption instead.
  const meaning = isKana
    ? null
    : isGrammar
      ? entry.meaning
      : lang === 'fr'
        // The card's own line first (plan 107: "{kanji}::{kana}", the
        // key vocab_fr.json gained for a form that is several cards --
        // 私 is わたし, わたくし and あたし, each its own gloss), then
        // the bare form, then what the server already localised.
        ? (map?.[`${entry.kanji || ''}::${entry.kana || ''}`]
          ?? map?.[entry.kanji || entry.kana]
          ?? entry.meaning)
        : entry.meaning

  // The app card behind this entry, or null: what the ＋ writes and
  // what "review this card" boards. Served whole rather than assembled
  // here, because only the server knows which entries have one
  // (routes/dictionary.py's _app_card). A JMdict pool word's carries
  // `pool` (plan 148): a deck takes it, but the day's queue asks it only
  // through a deck it is in, so "review this card" is not offered on it.
  const appCard = entry.app_card ?? null

  // The kanji this word is written with, each as a ledger row — the
  // same row the kanji panel uses for the words a character appears
  // in, the other way round. They were bare tiles: two boxes holding a
  // glyph each, under no heading, between the definition and the
  // reader's own record — a block that needs a heading to be legible
  // (DESIGN.md) and a stop in the middle of the reading. A row carrying
  // the reading the character takes IN THIS WORD and its own gloss
  // says what a tile could not, and the ledger is where the panel
  // already puts "what it connects to". Plan 089.
  //
  // `reading` is null where the aligner could not isolate the character
  // (生活 → せいかつ says nothing about which half is which); the row
  // then prints the glyph alone rather than inventing one.
  const kanjiRows = useMemo(() => (entry.kanji_parts ?? []).map(part => ({
    kanji: part.char,
    kana: part.reading ?? '',
    meaning: part.meaning,
    furigana: part.reading ? [{ text: part.char, reading: part.reading }] : null,
  })), [entry.kanji_parts])

  // The plate's three registers. A station plate sets the reading over
  // the name and the plain-language name under it; here the reading is
  // the word's furigana (per kanji, computed backend-side by
  // routes/dictionary.py's _word_furigana), the kanji's 音/訓 split, or
  // — when a word's alignment came back empty — its kana on a line of
  // its own, so a word never appears without its reading. The caption
  // is the entry's first gloss (the full list lives in the body), or a
  // kana's romaji.
  const headword = isGrammar ? entry.pattern : (entry.kanji || entry.kana)
  // A grammar point's is its pattern's (the catalogue's own reading,
  // study/grammar_examples.pattern_furigana): 中 read なか in 〜の中で.
  const headwordFurigana = entry.type === 'vocab' ? entry.furigana
    : isGrammar && entry.pattern_furigana?.some(part => part.reading) ? entry.pattern_furigana
      : null
  const showKanaLine = entry.type === 'vocab'
    && !headwordFurigana?.length
    && !!entry.kanji && !!entry.kana && entry.kana !== entry.kanji
  // routes/dictionary.py fills a kana's level slot with "Hiragana" /
  // "Katakana" for the catalogue's grouping; the plate prints JLPT
  // levels only — the script is plain from the character itself.
  const jlpt = /^N[1-5]$/.test(entry.level ?? '') ? entry.level : null

  // Every JMdict sense (from get_vocab_extras) and the example
  // sentences that illustrate each one. Split into "nested under a
  // sense" vs. "flat" here, once, so both the senses list and the
  // fallback examples block below read from the same source instead
  // of each re-deriving it slightly differently.
  // Folded first: JMdict files 毎月 under two senses carrying the same
  // three glosses and differing only by a frequency tag, and printing
  // them as they come makes one definition read as two (see
  // mergeSenses, plan 089). A merged sense keeps every number it
  // absorbed, so the sentences nested under those numbers still show.
  const senses = useMemo(() => mergeSenses(entry.senses), [entry.senses])
  const examples = entry.examples ?? []
  const senseNumbers = useMemo(() => new Set(senses.flatMap(s => s.numbers)), [senses])
  // Examples that don't get nested under a sense row: either there are
  // no senses at all (so the per-sense list itself doesn't render),
  // or an example's sense_number doesn't match any listed sense.
  const flatExamples = senses.length > 0
    ? examples.filter(ex => !senseNumbers.has(ex.sense_number))
    : examples
  const examplesBySense = numbers => examples.filter(ex => numbers.includes(ex.sense_number))

  // With no senses list, the definition is the app's own gloss line —
  // and it only earns a block when there is more to say than the one
  // word a caption could carry. A grammar point's body is its own
  // (below), so it takes no gloss block here.
  const glossCount = (senses.length > 0 || isGrammar) ? 0 : splitGlosses(meaning).length

  // The plate's third register, decided AFTER the body's, because it
  // stands down where the body would only repeat it: 土's plate said
  // SOIL and the line directly under it said "Soil · earth · ground ·
  // Turkey" — the same word twice, a rung apart, in a panel whose whole
  // argument is that a block should say something new (plan 089). Where
  // the gloss line does not print — a kanji with one meaning, a kana
  // (whose caption is its romaji), a word whose senses the caption does
  // not stand in for — the caption is the only place the meaning
  // appears and it stays.
  const bodyPrintsGloss = glossCount > 1
  // KANJIDIC2 glosses the characters in general use and little else:
  // 2,724 of its 13,108 carry a radical, a stroke count and readings but
  // no meaning in any language — rare and historic characters, and the
  // compatibility codepoints that twin a common one (社 U+FA4C beside the
  // everyday 社 U+793E). Every one of them is outside the app's own deck,
  // so this can only be reached from the dictionary's pool half. The plate
  // printed nothing at all in that case, which reads as a panel that failed
  // to load rather than a dictionary with no gloss to give; it says so now,
  // in the caption register but at book weight, so an absence is never
  // mistaken for the one word a caption normally carries.
  const meaningAbsent = isKanji && !firstGloss(meaning)
  const caption = isKana ? entry.romaji
    : isGrammar ? meaning
    : meaningAbsent ? t.noMeaningRecorded
    : bodyPrintsGloss ? null
    : firstGloss(meaning)

  // Stroke count and radical describe the *drawing* of the character,
  // so they sit beside the stroke-order sheet in one lattice rather
  // than in a metadata run somewhere else in the panel. The lattice's
  // column count divides its content (DESIGN.md, Surfaces): the sheet
  // spans every figure row beside it, and with no sheet the figures
  // take a column each.
  const hasRadical = isKanji && entry.radical != null
  // あ ↔ ア. A kana's lattice was one full-width sheet of washi and
  // nothing beside it, because a kana row carried no second fact to
  // print — the syllabary lists have no stroke count and KANJIDIC2 is
  // not asked about kana. It carries both now (routes/dictionary.py,
  // content/kana_strokes.py), so the sheet stands in the same lattice
  // the kanji panel draws rather than alone across the panel. Plan 089.
  const hasTwin = isKana && !!entry.twin
  const hasSheet = (isKanji || isKana) && !!entry.svg_url
  const figureCount = ((isKanji || isKana) && entry.stroke_count ? 1 : 0)
    + (hasRadical ? 1 : 0) + (hasTwin ? 1 : 0)
  const showForm = hasSheet || figureCount > 0
  // The row count exists so the sheet can span the figures stacked beside
  // it, so it is the SHEET's measure, not the figures'. Counting rows
  // without one laid a 2x2 grid over two cells and left the second row
  // bare --surface-line — a grey band under the lattice on every character
  // KanjiVG has no diagram for, which is most of the pool half. With no
  // sheet the figures take a column each, in one row.
  const formStyle = {
    '--dict-form-cols': hasSheet ? (figureCount > 0 ? 2 : 1) : figureCount,
    '--dict-form-rows': hasSheet ? Math.max(figureCount, 1) : 1,
  }

  const status = entry.status
  const record = status?.total_reviews > 0

  // ── Readings ──
  // The plate shows two: the first on'yomi and the first kun'yomi when
  // a kanji has both (see pickPlateReadings). 生 has twenty readings and
  // a plate is not the place for them; "+N" opens a sheet of its own
  // (ReadingsSheet), where every reading is listed with the words that
  // use it (entry.readings, from study/kanji_words.py). The open state
  // is keyed to the entry, so moving to another kanji closes it without
  // an effect.
  const tokens = useMemo(() => (isKanji ? splitReadingTokens(entry.kana) : []), [isKanji, entry.kana])
  const shownReadings = pickPlateReadings(tokens, 2)
  const hiddenReadings = tokens.length - shownReadings.length
  const readingGroups = entry.readings ?? []
  const [openKey, setOpenKey] = useState(null)
  // On the desk the list opens in the entry's place (ReadingsInPlace,
  // plan 120), taking the door with it; stepping back puts the focus
  // on the door again, as a dialog's close would.
  const desk = useDesk()
  const readingsDoor = useRef(null)
  const wasReading = useRef(false)
  // ── The ＋ and its menu ──
  // The shelf half: lit from the shelf the screen holds (favorites.has),
  // turned by one optimistic write. The only thing the plate says about
  // it is the one time it did not take, beside the ＋ in the caption
  // register — the slot the deck half prints "in deck" in. The state
  // itself is the shelf's, so opening another entry needs no reset; the
  // refusal is keyed to the entry it was about, the way the readings
  // sheet is, so it cannot follow the reader onto the next plate.
  const kept = !!favorites?.has(entry)
  const [favPending, setFavPending] = useState(false)
  const [favRefusal, setFavRefusal] = useState(null)
  const favError = favRefusal?.key === entryKey(entry) ? favRefusal.message : null
  // The deck half: the analyzer's own press (useMineAction) — the
  // remembered deck or the picker, then the write. Run on a stand-in
  // where there is no mining, so the hook order holds.
  const canMine = !!(mining && appCard)
  const mine = useMineAction({
    mining: mining ?? INERT_MINING,
    kind: appCard?.source,
    t,
    owner: entryKey(entry),
    onMine: deckId => mining.mineApp({
      deckId,
      source: appCard.source,
      level: appCard.level,
      rawId: appCard.raw_id,
      kind: appCard.source,
    }),
  })
  // The menu: open under the ＋, closed by a choice, a press outside or
  // Escape. Keyed to the entry so it never survives onto the next.
  const [menuFor, setMenuFor] = useState(null)
  const menuOpen = menuFor === entryKey(entry)
  const addRef = useRef(null)
  useEffect(() => {
    if (!menuOpen) return
    function onDown(e) { if (!addRef.current?.contains(e.target)) setMenuFor(null) }
    function onKey(e) { if (e.key === 'Escape') { e.stopPropagation(); setMenuFor(null) } }
    document.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [menuOpen])
  async function toggleFavorite() {
    setFavRefusal(null)
    setFavPending(true)
    try {
      await favorites.toggle(entry)
    } catch (err) {
      setFavRefusal({
        key: entryKey(entry),
        message: err?.status === 409 ? t.dictFavoriteFull : t.dictFavoriteFailed,
      })
    } finally {
      setFavPending(false)
    }
  }
  const readingsOpen = isKanji && readingGroups.length > 0 && openKey === entryKey(entry)
  useEffect(() => {
    if (desk && wasReading.current && !readingsOpen) readingsDoor.current?.focus({ preventScroll: true })
    wasReading.current = readingsOpen
  }, [desk, readingsOpen])
  // card_stats (study/card_lookup.py) says "not_started" for a card
  // with no state in any mode; the seal's vocabulary is new / learning
  // / mastered, and a card nobody has touched is the unstruck seal.
  const stage = !status?.status || status.status === 'not_started' ? 'new' : status.status

  if (desk && readingsOpen) {
    return <ReadingsInPlace entry={entry} groups={readingGroups} onClose={() => setOpenKey(null)} onVocabClick={onVocabClick} />
  }

  // The learner's own record (plan 089), placed by the layout: last in
  // the body, or, in the band (plan 126), under the plate in the top
  // panel -- the card and your numbers over the dictionary alone. The
  // band is a run's, where the schedule is the card panel's: each
  // verdict's tile says when the card comes back, and the card on the
  // stage is due by being there. So it keeps the two figures about the
  // learner and drops the interval and the next review (owner's cut).
  const recordBlock = record && (
          <section className="dict-block" aria-label={t.cardStats}>
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
              {!band && (
                <>
                  <Figure
                    value={status.interval_days != null ? status.interval_days : '—'}
                    unit={status.interval_days != null ? t.days : null}
                    label={t.interval}
                  />
                  <Figure
                    value={status.due ? t.dueValue : (shortDate(status.next_review, lang) ?? '—')}
                    ink={status.due ? 'due' : undefined}
                    label={t.nextReview}
                  />
                </>
              )}
            </div>
            {/* A ghost, not a filled action: the panel has no primary,
                and 辞書's gold could not carry one anyway (DESIGN.md,
                "the primary button"). It boards the one card this entry
                is — /today/run?only=… — in every mode it owes, which is
                what clearing it means. */}
            {status.due && onReview && appCard && !appCard.pool && (
              <button
                type="button"
                onClick={() => onReview(appCard.raw_id)}
                className="dict-due"
              >
                <BoltIcon size={14} />
                {t.reviewThisCard}
                <ChevronIcon direction="right" size={16} className="dict-due__chev" />
              </button>
            )}
          </section>
        )
  // The band wraps the plate and the record in a top panel; every
  // other layout keeps the article's own children, so a phone's DOM
  // does not change (plan 126).
  const Top = band ? 'div' : Fragment
  return (
    <article className={`dict-entry${band ? ' dict-entry--band' : ''}`}>
      <Top {...(band ? { className: 'dict-entry__top' } : {})}>
      {/* ── The plate ────────────────────────────────────────
          Sticky at the top of the scrolling shell, so the word stays
          in view while its examples scroll under it — on a phone the
          entry is the whole screen and this is the reading view. The
          seal and the level ride in one corner, the two actions in the
          other, and the three registers sit centred between them. */}
      <header className="dict-plate">
        <div className="dict-plate__row">
          <div className="dict-plate__marks">
            {/* Only where entries stack behind one another — the sheet
                over a run, once a word row or a kanji tile has opened
                another entry inside it. */}
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                className="dict-plate__btn dict-plate__back"
                title={t.back}
                aria-label={t.back}
              >
                <ChevronIcon direction="left" size={16} />
              </button>
            )}
            <StageMark stage={stage} inline />
            {jlpt && <span className="dict-plate__level">{jlpt}</span>}
          </div>
          <div className="dict-plate__actions" data-guide="dict.actions">
            {!isGrammar && (
              <button
                type="button"
                // A kana plays the deck's own clip -- the same voice the
                // kana cards use, offline, and えい said as ē -- rather
                // than being synthesized afresh (plan 121).
                onClick={() => (isKana ? playKana(kanaSound(entry)) : speakJapanese(entry.kana))}
                className="dict-plate__btn"
                title={t.listen}
                aria-label={t.listen}
              >
                <SpeakIcon />
              </button>
            )}
            {/* The plate's one action, with two destinations (plan
                092): the ＋ opens a menu — keep on the shelf, add to a
                deck — rather than a roundel per place, so the row stays
                three ghosts wherever the entry opens. A ghost like the
                two beside it — gold cannot carry a filled action
                (DESIGN.md, "the primary button") — earning the
                selection ring, 辞書's own, once the entry is kept. The
                outcome of either choice ("in deck", or a refusal) prints
                beside it in the caption register.

                The deck row exists where the server says there is a
                card: `entry.app_card` is its answer to "is there a card
                behind this entry" — a JMdict pool word too since plan
                144, which a vocab deck takes. The shelf row exists where
                the screen holds a shelf; a sheet over a quiz holds none. */}
            {(favorites || canMine) && (
              <span className="dict-plate__add" ref={addRef}>
                <button
                  type="button"
                  onClick={() => setMenuFor(menuOpen ? null : entryKey(entry))}
                  disabled={favPending || mine.pending}
                  className={`dict-plate__btn dict-plate__add-btn${kept ? ' dict-plate__add-btn--kept' : ''}`}
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  title={t.dictAdd}
                  aria-label={t.dictAdd}
                >
                  <PlusIcon size={16} />
                </button>
                {menuOpen && (
                  <div className="dict-add-menu" role="menu" aria-label={t.dictAdd}>
                    {favorites && (
                      <button
                        type="button"
                        role="menuitemcheckbox"
                        aria-checked={kept}
                        className="dict-add-menu__row"
                        onClick={() => { setMenuFor(null); toggleFavorite() }}
                      >
                        <StarIcon size={14} filled={kept} />
                        {kept ? t.dictFavoriteRemove : t.dictFavoriteAdd}
                      </button>
                    )}
                    {canMine && (
                      <button
                        type="button"
                        role="menuitem"
                        className="dict-add-menu__row"
                        onClick={e => { setMenuFor(null); mine.press(e) }}
                      >
                        <PlusIcon size={14} />
                        {mine.addedOnce ? t.addToAnotherDeck : t.dictAddToDeck}
                      </button>
                    )}
                  </div>
                )}
              </span>
            )}
            {(favError || mine.outcomeText) && (
              <span className={favError ? 'analysis-mine-status' : mine.outcomeClassName} role="status">
                {favError ?? mine.outcomeText}
              </span>
            )}
            {mine.picker}
            {/* No ✕ where there is nothing to close: the desk's dock
                (plan 114) is the catalogue's standing companion, not a
                panel that was opened. */}
            {/* On the desk every entry that has a ✕ also closes on Esc
                -- a lookup dialog, a door in a column, the analyser's
                dock -- so it says so there (plan 123). */}
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="dict-plate__btn"
                title={desk ? `${t.close} (${t.keyEscape})` : t.close}
                aria-label={t.close}
                aria-keyshortcuts={desk ? 'Escape' : undefined}
              >
                <CloseIcon />
              </button>
            )}
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
              {readingGroups.length > 0 && (
                <button
                  type="button"
                  ref={readingsDoor}
                  onClick={() => setOpenKey(readingsOpen ? null : entryKey(entry))}
                  className={`dict-plate__more${readingsOpen ? ' dict-plate__more--open' : ''}`}
                  aria-haspopup={desk ? undefined : 'dialog'}
                  aria-expanded={readingsOpen}
                  aria-label={t.allReadings}
                  title={t.allReadings}
                >
                  {hiddenReadings > 0 && <span>+{hiddenReadings}</span>}
                  <ChevronIcon direction="down" size={14} className="dict-plate__more-chev" />
                </button>
              )}
            </div>
          )}
          {showKanaLine && (
            <div className="dict-plate__reading" lang="ja">{entry.kana}</div>
          )}
          {/* How the pattern is formed, in the reading's place over it:
              "verb て-form + から" is to 〜てから what やま is to 山. */}
          {isGrammar && entry.structure && (
            <div className="dict-plate__structure" lang="ja">
              {entry.structure_furigana?.some(part => part.reading)
                ? <FuriganaParts parts={joinRuns(entry.structure_furigana)} />
                : entry.structure}
            </div>
          )}
          <h2 className={`dict-plate__word dict-plate__word--${headwordSize(headword)}`} lang="ja">
            {headwordFurigana?.length
              ? <FuriganaParts parts={headwordFurigana} />
              : headword}
          </h2>
          {caption && (
            <div className={`dict-plate__caption${meaningAbsent ? ' dict-plate__caption--absent' : ''}`}>
              {caption}
            </div>
          )}
        </div>

        <div className="dict-plate__stripe" aria-hidden="true" />
      </header>
      {band && recordBlock}
      </Top>

      <div className="dict-entry__body">

        {/* ── A grammar point's body ───────────────────────
            The lesson (plan 087): formation, meaning, the steps, the
            neighbours it is confused with, the sentences with the
            pattern picked out — as blocks that name themselves, the
            plate variant since the plate above is already drawn. A
            point whose lesson is not written yet prints the three
            blocks it always had. A compare row is a door where the
            shell can open one (`onGrammarClick`). */}
        {isGrammar && (
          <GrammarLesson variant="plate" point={entry} onCompare={onGrammarClick} />
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
                const exs = examplesBySense(sense.numbers)
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
        {!isGrammar && flatExamples.length > 0 && (
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
                  src={api(entry.svg_url)}
                  notAvailableLabel={t.notAvailable}
                />
              )}
              {(isKanji || isKana) && entry.stroke_count && (
                <Figure value={entry.stroke_count} unit="画" unitLang="ja" label={t.strokes} />
              )}
              {/* The radical's own glyph, read つち, rather than the
                  Kangxi filing number it is indexed under: #32 is a
                  fact about a dictionary's ordering and 土 is a fact
                  about the character. The number is still where the
                  door leads (content/radical_info.py knows both), and
                  it is still what prints where the table has no glyph
                  for it. Plan 089. */}
              {hasRadical && (
                <Figure
                  value={entry.radical_glyph ?? `#${entry.radical}`}
                  jp={!!entry.radical_glyph}
                  unit={entry.radical_name}
                  unitLang="ja"
                  label={t.radical}
                  onClick={onRadicalClick ? () => onRadicalClick(entry.radical) : undefined}
                />
              )}
              {hasTwin && (
                <Figure
                  value={entry.twin}
                  jp
                  label={entry.type === 'hiragana' ? t.dictKatakana : t.dictHiragana}
                  onClick={onKanaClick
                    ? () => onKanaClick(entry.twin, entry.type === 'hiragana' ? 'katakana' : 'hiragana')
                    : undefined}
                />
              )}
            </div>
          </section>
        )}

        {/* ── What it connects to ──────────────────────────
            Two directions of one relationship, and an entry only
            ever has one of them: a character links out to the words it
            is read in (a ledger of rows, each a door — for a kanji,
            four words chosen to demonstrate as many different readings
            as the deck can, the kanji picked out in each so the reading
            it uses is what the eye lands on, with the readings sheet
            holding the complete grouping; for a kana, four words it is
            read in, printed as READINGS rather than as written forms
            because a reader who is still learning あ cannot be sent to
            朝 — see study/kana_words.py), a word links down to the kanji
            it is built from (a row of tiles, each the small plate of
            the entry it opens). */}
        {(isKanji || isKana) && entry.vocab_examples?.length > 0 && (
          <section className="dict-block" aria-label={isKana ? t.kanaExamples : t.vocabExamples}>
            <div className="dict-words">
              {entry.vocab_examples.map((w, i) => (
                <WordRow
                  key={i}
                  w={w}
                  char={isKana ? entry.kana : entry.kanji}
                  onClick={onVocabClick}
                  reading={isKana}
                />
              ))}
            </div>
          </section>
        )}

        {kanjiRows.length > 0 && (
          <section className="dict-block" aria-label={t.composingKanji}>
            <div className="dict-words">
              {kanjiRows.map(row => (
                <WordRow
                  key={row.kanji}
                  w={row}
                  char={row.kanji}
                  onClick={onKanjiClick ? char => onKanjiClick(char) : undefined}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Your own record ──────────────────────────────
            Last, because it is about the reader rather than the word.
            Four figures, two by two, in the profile's records lattice;
            nothing renders at all for an entry never reviewed, since a
            grid of dashes is noise, not information.

            Due is not a fifth figure and no longer a note either. It
            used to be a right-flush "⚡ DUE NOW" caption hanging over a
            lattice it was not part of, beside a cell that said the next
            review was two days ago — two facts for one state, with the
            arithmetic left to the reader. The cell that owns the
            schedule says it, in the due ink, and the block then names
            the one thing to do about it. Plan 089. */}
        {!band && recordBlock}

        {/* A thumb affordance on a phone, where the entry is the whole
            screen and the ✕ is at the far end of it. Hidden everywhere
            else (see .dict-entry__close): the plate's ✕, Escape and the
            scrim already close a dock or a modal. */}
        {onClose && (
          <button type="button" onClick={onClose} className="btn-secondary dict-entry__close">
            {t.close}
          </button>
        )}
      </div>

      {readingsOpen && !desk && (
        <ReadingsSheet
          entry={entry}
          groups={readingGroups}
          onClose={() => setOpenKey(null)}
          onVocabClick={onVocabClick}
        />
      )}
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
//
// `kana` is the reading of the entry the caller already has in hand,
// and it is what makes the lookup land on the RIGHT word. A surface
// alone cannot say which 国境 (くにざかい or こっきょう) or which 工場
// (こうば or こうじょう) was meant, and a two-mora kana word is a
// substring of dozens of commoner ones — ラブ used to open アラブ. It is
// sent to the server as well as preferred here, because the second case
// cannot be fixed on the client: the wanted row is not on the page at
// all until the server puts it there (see dictionary.py's _exact_vocab).
// Optional — kanji and kana categories have no second key to
// disambiguate with and pass nothing.
//
// `id` is the other way in: a grammar point is looked up by its card
// id alone (the analyzer's chips carry one — routes/dictionary.py's
// `id` moves that point to the front of page 0). An id lookup insists
// on the exact row and never falls back to the page's first result:
// an id that names nothing is "not available", not a different point.
//
// `exact` (plan 115) drops the page's-first-result fallback for a term
// too: the desk's session panel docks a revealed card's entry unasked,
// and a personal deck's card whose front is no dictionary word would
// otherwise dock whatever word the search happened to rank first — an
// unrelated entry printed as the answer. The sheets, opened on a
// learner's own tap, keep the nearest match.
function useDictionaryLookup(session, term, category, lang, active, kana, id, exact = false) {
  const [state, setState] = useState({ entry: null, loading: false, error: false })

  useEffect(() => {
    if (!active || !category || (!term && !id)) return
    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect -- this setState is the "start of the fetch" reset (clears any previous term's stale result and flips on the loading spinner) that has to happen synchronously with kicking off the fetch below; it's inseparable from the network call, not a standalone "reset on id change" this could be replaced by a key-remount for.
    setState({ entry: null, loading: true, error: false })

    const params = new URLSearchParams({ q: term ?? '', page: 0, limit: 10, lang: lang ?? '', category })
    if (kana) params.set('kana', kana)
    if (id) params.set('id', id)
    apiFetch(`/api/dictionary?${params.toString()}`, session)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        const results = data.results || []
        const match = id
          ? (results.find(e => e.raw_id === id) ?? null)
          : (kana && results.find(e => e.kanji === term && e.kana === kana))
            ?? results.find(e => e.kanji === term || e.kana === term)
            ?? (exact ? null : results[0] ?? null)
        setState({ entry: match, loading: false, error: !match })
      })
      .catch(() => { if (!cancelled) setState({ entry: null, loading: false, error: true }) })

    return () => { cancelled = true }
  }, [active, term, category, session, lang, kana, id, exact])

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
//
// The entry's own doors work here too, and they open INTO the sheet:
// the words a kanji appears in, and the kanji a word is built from,
// stack on top of each other with ‹ back through them. The question a
// reader is asking when they tap 駅 under 駅前 is the same one wherever
// they are standing, and a run is exactly where it gets asked — which
// is why the catalogue opens this sheet too now, rather than moving
// itself to the row (plan 090).
//
// `onRadicalClick` and `onReview` are the two doors only a shell can
// honour, so they are the caller's to offer. The radical opens the
// catalogue's own 部 index and "review this card" boards a run: over a
// quiz there is neither an index to move nor room for a second run, so
// both are left out and the entry prints them as the figures they are.
// The dictionary screen passes both, and hands the radical over closed
// — what that door opens is the catalogue underneath this sheet.
//
// Opened on `term` (+ `kana`) for a word or a kanji, or on `id` for a
// grammar point (the analyzer's chips, a comprehension result's) —
// see useDictionaryLookup. `mining` is optional and reaches the plate's
// `+` roundel on a grammar entry where the opening screen has one;
// `favorites` likewise reaches its ★ where the screen holds a shelf.
// The stack of entries opened from one another, oldest first, and the
// entry at its head. Shared by the sheet (a portal over a quiz or the
// catalogue) and the body the desk docks beside the catalogue (plan
// 114), so the two walk their doors the same way.
function useLookupStack(session, { term, kana, category, id }, exact = false) {
  const { lang } = useLang()
  // Reset by the caller remounting on a new term (the key it is opened
  // with is the term itself).
  const [stack, setStack] = useState([{ term, kana, category, id }])
  const here = stack[stack.length - 1]
  // Only the first lookup is the unasked one: a door opened from it is
  // the learner's own tap and keeps the nearest match.
  const { entry, loading, error } = useDictionaryLookup(session, here.term, here.category, lang, true, here.kana, here.id, exact && stack.length === 1)

  const open = (nextTerm, nextCategory, nextKana) => {
    if (!nextTerm) return
    setStack(s => [...s, { term: nextTerm, kana: nextKana, category: nextCategory }])
  }
  // A grammar point's rival, by its card id (plan 087): the same stack,
  // so ‹ walks back through the points opened from one another.
  const openId = nextId => {
    if (!nextId) return
    setStack(s => [...s, { category: 'grammar', id: nextId }])
  }
  const back = stack.length > 1 ? () => setStack(s => s.slice(0, -1)) : undefined
  // Straight back to the entry the stack was opened on, however many
  // doors deep (plan 123): the run's docked entry's Esc.
  const root = stack.length > 1 ? () => setStack(s => s.slice(0, 1)) : undefined
  return { here, entry, loading, error, open, openId, back, root }
}

// What a lookup shows: the loading line, the "not available" answer, or
// the entry with its doors opening into the same stack.
function LookupContent({ look, onClose, onRadicalClick, onReview, mining, favorites, band = false }) {
  const { t } = useLang()
  const { entry, loading, error, open, openId, back } = look
  return (
    <>
      {loading && (
        <div className="quiz-loading">{t.loadingDictionary}</div>
      )}
      {!loading && error && (
        <div className="dict-sheet__empty">
          <div className="quiz-loading">{t.notAvailable}</div>
          {/* A docked lookup with no way out (the session panel's) has
              nothing for a Close to do. Every sheet passes one. */}
          {onClose && (
            <button type="button" onClick={onClose} className="btn-secondary">
              {t.close}
            </button>
          )}
        </div>
      )}
      {!loading && entry && (
        <DictionaryDetail
          entry={entry}
          band={band}
          onClose={onClose}
          onBack={back}
          onRadicalClick={onRadicalClick ? n => { onClose(); onRadicalClick(n) } : undefined}
          onReview={onReview}
          onKanjiClick={char => open(char, 'kanji')}
          // The twin opens into the stack like every other door here.
          onKanaClick={(kana, type) => open(kana, type)}
          // onVocabClick already hands over both halves, so stepping from
          // one entry to another inside the sheet gets the same exactness
          // the card does.
          onVocabClick={(k, r) => open(k || r, 'vocab', r)}
          onGrammarClick={openId}
          mining={mining}
          favorites={favorites}
        />
      )}
    </>
  )
}

export function DictionaryLookupSheet({ term, kana, category, id, session, mining, favorites, onClose, over = false, onRadicalClick, onReview }) {
  const { t } = useLang()
  const look = useLookupStack(session, { term, kana, category, id })
  const { here, entry } = look
  const dialogRef = useDialog(onClose, { capture: over })

  return createPortal(
    <div onClick={onClose} className={`dict-sheet__scrim${over ? ' dict-sheet__scrim--over' : ''}`}>
      {/* Named by the term it was opened on; a grammar point, opened
          by id, is named by its pattern once the entry is in hand and
          by the id until then. */}
      <div ref={dialogRef} onClick={e => e.stopPropagation()} className="dict-sheet"
           role="dialog" aria-modal="true" aria-label={`${t.dictionaryTitle}: ${here.term ?? entry?.pattern ?? here.id}`}>
        <LookupContent
          look={look}
          onClose={onClose}
          onRadicalClick={onRadicalClick}
          onReview={onReview}
          mining={mining}
          favorites={favorites}
        />
      </div>
    </div>,
    document.body,
  )
}

// ── 机 — the same lookup, standing where it was asked (plan 114) ──
// On the desk a door in the catalogue's dock opens INTO the dock rather
// than over the screen: the catalogue, the search and the scroll stay
// in view, and ✕ returns the dock to the entry the door was opened
// from. A run's session panel docks the revealed card's entry the same
// way. No portal, no scrim, no dialog: it is a column's content.
// `band` (plan 126): the entry in the desk run's band layout -- the plate
// and the learner's record in a top panel, the dictionary under it.
export function DictionaryLookupBody({ term, kana, category, id, session, mining, favorites, onExit, onRadicalClick, onReview, exact = false, escBack = false, band = false }) {
  const look = useLookupStack(session, { term, kana, category, id }, exact)
  // `escBack` (plan 123): a host with no way out of its own -- the run's
  // session panel, docked beside the card -- lets Escape step back out
  // of the doors opened in it, to the entry it was opened on. The key
  // is spent (preventDefault), so the run's Esc (DeskKeys' LeaveKey,
  // which waits to see) does not also leave the run: a learner who
  // opened 駅's kanji and pressed Esc lost the run and its tally. A list
  // open inside the entry (the readings, the ＋ menu) takes Escape first,
  // in the capture phase, and keeps it.
  //
  // Subscribed once, reading the stack through a ref: a listener that
  // re-subscribed on every door would fall behind the panel's own Esc
  // (which closes an open miss) and lose the key to it.
  const toRoot = useRef(null)
  useEffect(() => { toRoot.current = look.root })
  // A door open in the docked entry holds Esc: the run's head drops its
  // cap meanwhile (stores/escHold).
  const deep = escBack && Boolean(look.root)
  useEffect(() => (deep ? holdEsc() : undefined), [deep])
  useEffect(() => {
    if (!escBack) return undefined
    const onKey = e => {
      if (e.key !== 'Escape' || e.repeat || e.defaultPrevented || composing(e) || dialogOpen()) return
      if (!toRoot.current) return
      e.preventDefault()
      toRoot.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [escBack])
  return (
    <LookupContent
      look={look}
      band={band}
      onClose={onExit}
      onRadicalClick={onRadicalClick}
      onReview={onReview}
      mining={mining}
      favorites={favorites}
    />
  )
}
