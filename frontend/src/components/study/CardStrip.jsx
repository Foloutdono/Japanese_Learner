import { useState } from 'react'
import { useLang } from '../../LangContext'
import { playClick } from '../../lib/audio'
import { contentLang } from '../../lib/locale'
import { useCardExtras } from '../../lib/cardExtras'
import { useCardContents } from '../../stores/cardContents'
import { choseAny, fieldsFor, hasStrip } from '../../domain/cardContents'
import { DictionaryLookupSheet, SpeakIcon, speakJapanese } from '../dictionary/DictionaryDetail'
import { ChevronIcon, TextLinesIcon } from '../ui/Icons'
import { BreakdownSheet } from './BreakdownSheet'

// ── 札の帯 — the strip under a flip card (plan 326) ─────────────────
// The owner's pick B of the canvas "Tsuji — card templates": the card
// stays as it was, and what the learner chose in Réglages › Card
// contents stands under it, in the dictionary's words
// (lib/cardExtras.js, backend study/card_extras.py). Before the card is
// turned it holds only what the question may show (a sentence, never
// its translation: domain/cardContents.js); once turned, the rest. Each
// row about another entry (a kanji, the pair, a word with the kanji,
// the word's forms) opens that entry in the dictionary's sheet, over
// the run, which keeps its place; the sentence has its own voice and,
// once the card is turned (plan 327), its breakdown: never over the
// question, where the breakdown's gloss of the word would answer it.
// A learner who chose nothing sees nothing, and asks for nothing.

function Sentence({ example }) {
  const parts = example.segments?.length ? example.segments : [{ text: example.jp, highlight: false }]
  return (
    <span lang="ja" className="cstrip__jp">
      {parts.map((s, i) => (s.highlight ? <mark key={i} className="cstrip__word">{s.text}</mark> : <span key={i}>{s.text}</span>))}
    </span>
  )
}

function Row({ onOpen, label, children }) {
  if (!onOpen) return <div className="cstrip__row">{children}</div>
  return (
    <button type="button" className="cstrip__row cstrip__row--door" aria-label={label} onClick={onOpen}>
      {children}
      <ChevronIcon direction="right" size={16} className="cstrip__chev" />
    </button>
  )
}

export function CardStrip({ card, revealed, session, next = [] }) {
  const { t, lang } = useLang()
  const content = contentLang(lang)
  const { data: chosen } = useCardContents()
  const strip = hasStrip(card)
  const wanted = strip && choseAny(chosen)
  const question = wanted ? fieldsFor(card, chosen, 'question') : []
  const answer = wanted ? fieldsFor(card, chosen, 'answer') : []
  const asks = wanted && (question.length > 0 || answer.length > 0)
  const extras = useCardExtras(card?.card_id, content, session, asks, next)
  const [entry, setEntry] = useState(null)
  const [brokenDown, setBrokenDown] = useState(false)

  if (!asks || !extras) return null
  const fields = new Set(revealed ? answer : question.filter(f => f === 'sentence'))
  const example = extras.example
  const showSentence = example && (fields.has('example') || fields.has('sentence'))
  const rows = []

  const open = (term, kana, category) => () => { playClick(); setEntry({ term, kana, category }) }
  const word = card.kanji || card.kana

  if (showSentence) {
    rows.push(
      <div key="example" className="cstrip__row cstrip__row--sentence">
        <span className="cstrip__text">
          <Sentence example={example} />
          {/* The translation is the answer's alone. */}
          {revealed && fields.has('example') && example.tr && <span className="cstrip__tr">{example.tr}</span>}
        </span>
        <span className="cstrip__acts">
          <button
            type="button" className="reveal-action-btn" aria-label={t.ccPlaySentence} title={t.ccPlaySentence}
            onClick={e => { e.stopPropagation(); speakJapanese(example.jp) }}
          >
            <SpeakIcon />
          </button>
          {revealed && session && (
            <button
              type="button" className="reveal-action-btn" aria-label={t.breakdownSentence} title={t.breakdownSentence}
              data-action="strip-breakdown"
              onClick={e => { e.stopPropagation(); playClick(); setBrokenDown(true) }}
            >
              <TextLinesIcon />
            </button>
          )}
        </span>
      </div>,
    )
  }
  if (revealed) {
    if (fields.has('kanji')) {
      for (const k of extras.kanji ?? []) {
        rows.push(
          <Row key={`k-${k.char}`} onOpen={session ? open(k.char, null, 'kanji') : null} label={`${k.char} · ${k.meaning}`}>
            <span lang="ja" className="cstrip__glyph">{k.char}</span>
            <span className="cstrip__text cstrip__text--strong">{k.meaning}</span>
            {k.reading && <span lang="ja" className="cstrip__aside">{k.reading}</span>}
          </Row>,
        )
      }
    }
    if (fields.has('meanings') && extras.meanings?.length) {
      rows.push(
        <div key="meanings" className="cstrip__row">
          <span className="cstrip__text">{extras.meanings.join(' · ')}</span>
          <span className="cstrip__tag">{t.ccAlso}</span>
        </div>,
      )
    }
    if (fields.has('pair')) {
      for (const p of extras.pair ?? []) {
        rows.push(
          <Row key={`p-${p.kanji}`} onOpen={session ? open(p.kanji, p.kana, 'vocab') : null} label={`${p.kanji} · ${p.meaning}`}>
            <span lang="ja" className="cstrip__glyph cstrip__glyph--word">{p.kanji}</span>
            <span className="cstrip__text">{p.meaning}</span>
            <span className="cstrip__tag">{t.ccField.pair}</span>
          </Row>,
        )
      }
    }
    if (fields.has('verb') && extras.verb?.length) {
      rows.push(
        <Row key="verb" onOpen={session ? open(word, card.kana, 'vocab') : null} label={`${extras.verb.join(' · ')} · ${t.ccForms}`}>
          <span className="cstrip__text">{extras.verb.join(' · ')}</span>
          <span className="cstrip__tag">{t.ccForms}</span>
        </Row>,
      )
    }
    if (fields.has('words')) {
      for (const w of extras.words ?? []) {
        rows.push(
          <Row key={`w-${w.kanji}`} onOpen={session ? open(w.kanji, w.kana, 'vocab') : null} label={`${w.kanji} · ${w.meaning}`}>
            <span lang="ja" className="cstrip__glyph cstrip__glyph--word">{w.kanji}</span>
            <span className="cstrip__text">{w.meaning}</span>
            <span lang="ja" className="cstrip__aside">{w.kana}</span>
          </Row>,
        )
      }
    }
    if ((fields.has('radical') && extras.radical) || (fields.has('strokes') && extras.strokes)) {
      rows.push(
        <div key="radical" className="cstrip__row">
          {fields.has('radical') && extras.radical && (
            <>
              <span lang="ja" className="cstrip__glyph">{extras.radical.glyph}</span>
              <span className="cstrip__text">{extras.radical.meaning}</span>
            </>
          )}
          {fields.has('strokes') && extras.strokes && <span className="cstrip__tag">{t.ccStrokes(extras.strokes)}</span>}
        </div>,
      )
    }
  }
  if (rows.length === 0) return null

  return (
    <>
      <div className="cstrip" data-guide="card.strip">{rows}</div>
      {brokenDown && revealed && example && (
        <BreakdownSheet
          sentence={example.jp} translation={example.tr || null} session={session}
          onClose={e => { e?.stopPropagation?.(); setBrokenDown(false) }}
        />
      )}
      {entry && (
        <DictionaryLookupSheet
          term={entry.term} kana={entry.kana} category={entry.category} session={session}
          onClose={e => { e?.stopPropagation?.(); setEntry(null) }}
        />
      )}
    </>
  )
}
