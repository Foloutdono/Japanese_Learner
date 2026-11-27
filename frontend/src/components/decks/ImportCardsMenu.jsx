import { useState, useMemo, useEffect } from 'react'
import { useLang } from '../../LangContext'
import { playClick } from '../../lib/audio'
import { CrossIcon, ChevronIcon, CheckCircleIcon } from '../ui/Icons'
import { Seg } from '../chrome/Console'
import { useDialog } from '../../hooks/useDialog'
import { columnsFor, exampleText, readCards } from './importCards'
import { NO, OWN, YES, exactCount, matchKey, offered, pickOf, splitImport, usingCount } from './importMatches'

// How long a paste rests before it is asked about.
const MATCH_WAIT_MS = 400

const KIND_LABEL = { vocab: 'vocabType', kanji: 'kanjiType', kana: 'kanaType', grammar: 'grammarType' }

// The paste is read against the deck's own structure (./importCards.js):
// its columns, a header row in either language, quoted cells. The
// preview says which columns it read and which rows it will leave out
// and why, so nothing is dropped silently; `onImport` receives only the
// whole ones, as {fields, notes}.
//
// `onMatch`, when the deck can hold the app's own cards, asks which of them
// the whole rows may mean (importMatches.js, plan 335). When some match for
// certain, one notice asks whether to use them: Yes, No, or Details, where
// each match can be switched back to the learner's own card. Until it is
// answered, and the details are shut, nothing changes; the answer splits
// the import in two, `onImport(own, skipped, apps)`: the written rows and
// the refs to link. Without `onMatch`, or when nothing matches, every row
// is written as it always was.
export default function ImportCardsMenu({ structure, onImport, onMatch, onClose }) {
  const { t, lang } = useLang()
  const dialogRef = useDialog(onClose)
  const [importText, setImportText] = useState('')
  const [termSep, setTermSep]       = useState('comma')
  const [cardSep, setCardSep]       = useState('newline')
  const [customTerm, setCustomTerm] = useState('')
  const [customCard, setCustomCard] = useState('')
  const [importing, setImporting]   = useState(false)
  const [matches, setMatches]       = useState({ key: '', rows: [] })
  const [picks, setPicks]           = useState({})
  const [answer, setAnswer]         = useState(null)
  const [details, setDetails]       = useState(false)

  function getTermSep() {
    if (termSep === 'tab')    return '\t'
    if (termSep === 'comma')  return ','
    if (termSep === 'custom') return customTerm
    return '\t'
  }

  function getCardSep() {
    if (cardSep === 'newline')   return '\n'
    if (cardSep === 'semicolon') return ';'
    if (cardSep === 'custom')    return customCard
    return '\n'
  }

  // A spreadsheet's copy is tab-separated: the first paste that carries
  // a tab, into an empty box still on the default, takes it.
  function onText(value) {
    if (!importText && termSep === 'comma' && value.includes('\t')) setTermSep('tab')
    setImportText(value)
  }

  function insertExample() {
    playClick()
    setImportText(exampleText(structure, getTermSep() || ',', t, lang))
  }

  const read = useMemo(
    () => readCards(importText, getTermSep(), getCardSep(), structure, t),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the separators are read through getTermSep/getCardSep, whose inputs are listed.
    [importText, termSep, cardSep, customTerm, customCard, structure, t],
  )
  const whole = useMemo(() => read.cards.filter(c => c.missing.length === 0), [read])
  const skipped = read.cards.length - whole.length
  const rows = useMemo(() => whole.map(({ fields, notes }) => ({ fields, notes })), [whole])
  const rowsKey = useMemo(() => matchKey(rows), [rows])

  // The app's cards the rows may mean, asked once the paste has rested.
  // A failed ask is quiet: the import goes on as written. An answer for an
  // earlier paste is never read against this one (`key`).
  useEffect(() => {
    if (!onMatch || rows.length === 0) return undefined
    let live = true
    const timer = setTimeout(async () => {
      try {
        const found = await onMatch(rows)
        if (live && found) { setMatches({ key: rowsKey, rows: found }); setPicks({}); setAnswer(null); setDetails(false) }
      } catch { /* the rows stay as written */ }
    }, MATCH_WAIT_MS)
    return () => { live = false; clearTimeout(timer) }
  }, [rows, rowsKey, onMatch])

  const found = matches.key === rowsKey ? matches.rows : []
  // The details open are the answer being worked out: its rows show what
  // yes would do, so what is on the screen is what the import sends.
  const live = answer ?? (details ? YES : null)
  const sure = exactCount(found)
  const using = usingCount(picks, found, live)
  const pickAt = at => pickOf(picks, found, at, live)

  async function handleImport() {
    if (whole.length === 0 || importing) return
    setImporting(true)
    try {
      const { own, apps } = splitImport(rows, found, picks, live)
      await onImport(own, skipped, apps)
    } finally {
      setImporting(false)
    }
  }

  const colName = col => columnLabel(col, t)
  const { once, repeat } = columnsFor(structure)

  return (
    <div className="import-overlay" onClick={onClose}>
      <div ref={dialogRef} className="import-modal" onClick={e => e.stopPropagation()}
           role="dialog" aria-modal="true" aria-labelledby="import-cards-title">

        {/* Header */}
        <div className="import-header">
          <div className="import-header__title" id="import-cards-title">{t.importTitle}</div>
          <button onClick={() => { playClick(); onClose() }} className="import-header__close" aria-label={t.close}>
            <CrossIcon size={16} />
          </button>
        </div>
        <div className="import-subtitle">
          {t.importSubtitle}
        </div>

        {/* The columns this deck reads, in order, and how to change it. */}
        {structure && (
          <div className="import-columns">
            <div className="import-columns__line">
              <span className="import-columns__label">{t.importColumns}</span>
              {once.map(colName).join(' · ')}
              {repeat.length > 0 && ` · ${t.importRepeat.replace('{cols}', repeat.map(colName).join(' · '))}`}
            </div>
            <div className="import-columns__hint">{t.importHeaderHint}</div>
            <button type="button" className="deckdetail-form__addline import-columns__example" onClick={insertExample}>
              {t.importExample}
            </button>
          </div>
        )}

        {/* Text area */}
        <textarea
          value={importText}
          onChange={e => onText(e.target.value)}
          placeholder={structure ? exampleText(structure, getTermSep() || ',', t, lang) : ''}
          className="field field--multi field--page import-textarea"
          aria-label={t.importTitle}
        />

        {/* Separators */}
        <div className="import-sep-row">
          <SepGroup
            title={t.termSep}
            value={termSep} onChange={setTermSep}
            custom={customTerm} onCustomChange={setCustomTerm}
            options={[
              ['comma',  t.comma],
              ['tab',    t.tab],
              ['custom', t.custom],
            ]}
          />
          <SepGroup
            title={t.cardSep}
            value={cardSep} onChange={setCardSep}
            custom={customCard} onCustomChange={setCustomCard}
            options={[
              ['newline',   t.newRow],
              ['semicolon', t.semicolon],
              ['custom',    t.custom],
            ]}
          />
        </div>

        {/* Preview */}
        <div className="import-preview">
          <div className="import-preview__title">
            {t.importPreview}
            {read.cards.length > 0
              ? ` — ${whole.length} ${t.cards}${skipped ? ` · ${t.importSkipped.replace('{n}', skipped)}` : ''}`
              : ` — ${t.noPreview}`}
          </div>
          {read.header && (
            <div className="import-preview__note">
              {t.importHeaderFound}: {read.columns.map(colName).join(' · ')}
            </div>
          )}
          {read.ignored.length > 0 && (
            <div className="import-preview__note">
              {t.importIgnoredCols.replace('{cols}', read.ignored.join(', '))}
            </div>
          )}
          {read.cards.length === 0 ? (
            <div className="import-preview__empty">{t.noPreview}</div>
          ) : (
            <>
              {sure > 0 && (
                <MatchNotice
                  t={t} sure={sure} using={using} answer={answer} open={details}
                  matches={found} rows={rows} structure={structure} pickAt={pickAt}
                  onToggle={() => { playClick(); setDetails(d => !d) }}
                  onYes={() => { playClick(); setAnswer(YES); setDetails(false) }}
                  onNo={() => { playClick(); setAnswer(NO); setPicks({}); setDetails(false) }}
                  onChange={() => { playClick(); setAnswer(null); setDetails(true) }}
                  onPick={(at, v) => { playClick(); setPicks(p => ({ ...p, [at]: v })) }}
                />
              )}
              <div className="import-preview__list">
                {previewRows(read.cards, 20).map(({ c, at }, i) => (
                  <div key={i} className={`import-preview-row${c.missing.length ? ' import-preview-row--skipped' : ''}`}>
                    <span className="import-preview-row__front" lang="ja">{c.fields[structure.front_key]}</span>
                    <span className="import-preview-row__arrow"><ChevronIcon direction="right" size={13} /></span>
                    <span className="import-preview-row__back">{c.fields[structure.back_key]}</span>
                    {c.missing.length > 0
                      ? (
                        <span className="import-preview-row__hint">
                          {t.importMissing.replace('{fields}', c.missing.map(k => colName({ key: k })).join(', '))}
                        </span>
                      )
                      : <span className="import-preview-row__meta">{extrasOf(c, structure, t)}</span>}
                    {at >= 0 && offered(found[at]).length > 0 && pickAt(at) !== OWN && (
                      <span className="import-preview-row__app" title={t.importAppCard}>
                        <CheckCircleIcon size={15} />
                        <span className="sr-only">{t.importAppCard}</span>
                      </span>
                    )}
                  </div>
                ))}
                {read.cards.length > 20 && (
                  <div className="import-preview__more">
                    ... {t.andMore.replace('{n}', read.cards.length - 20)}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="import-footer">
          <button onClick={() => { playClick(); onClose() }} className="import-footer__cancel">
            {t.cancel}
          </button>
          <button
            onClick={() => { playClick(); handleImport() }}
            disabled={whole.length === 0 || importing}
            className={`import-footer__submit${whole.length > 0 ? ' import-footer__submit--active' : ''}${importing ? ' import-footer__submit--importing' : ''}`}
          >
            {importing
              ? t.importing
              : whole.length > 0
                ? `${t.importBtn} ${whole.length} ${t.cards}`
                : t.importBtn}
          </button>
        </div>
      </div>
    </div>
  )
}

function columnLabel(col, t) {
  if (col.key === 'notes') return t.field_notes
  return (col.part ? t[`field_${col.key}_${col.part}`] : null) ?? t[`field_${col.key}`] ?? col.key
}

// What a whole row carries beyond its two faces: the optional fields it
// fills, and a repeatable one counted (Phrase d'exemple ×2).
function extrasOf(card, structure, t) {
  return structure.fields
    .filter(f => f.key !== structure.front_key && f.key !== structure.back_key)
    .map(f => {
      const v = card.fields[f.key]
      if (Array.isArray(v)) return v.length ? `${t[`field_${f.key}`] ?? f.key} ×${v.length}` : null
      return String(v ?? '').trim() ? (t[`field_${f.key}`] ?? f.key) : null
    })
    .filter(Boolean)
    .join(' · ')
}

// The preview's rows with, for each, its place among the whole ones: the
// server's answer is one list per whole row, the preview draws the
// skipped ones too.
function previewRows(cards, limit) {
  let w = -1
  return cards.map(c => ({ c, at: c.missing.length === 0 ? ++w : -1 })).slice(0, limit)
}

// The one question (plan 335): how many cards match the app's own, and
// whether to use them. Yes, No, or Details, which lists every match with
// the card it would be. Once answered it shrinks to a line and Change.
function MatchNotice({ t, sure, using, answer, open, matches, rows, structure, pickAt, onToggle, onYes, onNo, onChange, onPick }) {
  if (answer) {
    return (
      <div className="import-match-note import-match-note--done">
        <p className="import-match-note__msg">
          {answer === YES && <CheckCircleIcon size={15} className="import-match-note__ok" />}
          {answer === YES
            ? t.importMatchUsing.replace('{n}', using)
            : t.importMatchKept}
        </p>
        <button type="button" className="deckdetail-form__addline" onClick={onChange}>{t.importChange}</button>
      </div>
    )
  }
  return (
    <div className="import-match-note">
      <p className="import-match-note__msg">{t.importMatchAsk.replace('{n}', sure)}</p>
      {open && (
        <div className="import-match-note__list">
          {matches.map((cands, at) => offered(cands).length > 0 && (
            <div key={at} className="import-match-note__row">
              <div className="import-match-note__you">
                <span lang="ja">{rows[at].fields[structure.front_key]}</span>
                {' · '}{rows[at].fields[structure.back_key]}
              </div>
              <MatchChoice t={t} word={rows[at].fields[structure.front_key]}
                           candidates={offered(cands)} value={pickAt(at)} onChange={v => onPick(at, v)} />
            </div>
          ))}
        </div>
      )}
      <div className="import-match-note__act">
        <button type="button" className="deckdetail-form__addline" onClick={onToggle} aria-expanded={open}>
          {open ? t.importHideDetails : t.importDetails}
        </button>
        <span className="import-match-note__push" />
        <button type="button" className="import-footer__cancel" onClick={onNo}>{t.importMatchNo}</button>
        <button type="button" className="import-footer__submit import-footer__submit--active" onClick={onYes}>
          {t.importMatchYes}
        </button>
      </div>
    </div>
  )
}

// One row's choice between the app's cards it may mean and its own: a
// segmented pick (DESIGN.md, Controls), the app's card in the learner's
// language under it. Japanese is content: it is the option's text, and
// the only caption is the app's own meaning.
function MatchChoice({ t, word, candidates, value, onChange }) {
  const kinds = new Set(candidates.map(c => c.source))
  const options = [
    ...candidates.map((c, i) => ({
      key: String(i),
      mark: (
        <span className="import-match__opt">
          <span lang="ja">{c.front}{c.kana && c.kana !== c.front ? ` ${c.kana}` : ''}</span>
          {kinds.size > 1 && <small className="import-match__kind">{t[KIND_LABEL[c.source]]}</small>}
        </span>
      ),
    })),
    { key: String(OWN), label: t.importOwn },
  ]
  // The card the row would be, whether or not it is the one chosen.
  const shown = candidates[value === OWN ? 0 : value]
  return (
    <div className="import-match">
      <Seg full className="import-match__seg" label={t.importMatchLabel.replace('{word}', word)}
           options={options} value={String(value)} onChange={k => onChange(Number(k))} />
      <div className="import-match__line">
        {shown.meaning}
        {shown.source !== 'kana' && shown.level ? ` · ${shown.level}` : ''}
        {shown.in_deck ? ` · ${t.alreadyInDeck}` : ''}
      </div>
    </div>
  )
}

// ── Separator group ───────────────────────────────────────
function SepGroup({ title, value, onChange, custom, onCustomChange, options }) {
  return (
    <div>
      <div className="import-sep-group__title">{title}</div>
      {options.map(([val, label]) => (
        <label key={val} className="import-sep-option">
          <input type="radio" checked={value === val} onChange={() => { playClick(); onChange(val) }} />
          <span className="import-sep-option__label">{label}</span>
          {val === 'custom' && value === 'custom' && (
            <input
              value={custom}
              onChange={e => onCustomChange(e.target.value)}
              className="field field--page import-sep-custom-input"
              placeholder="..."
            />
          )}
        </label>
      ))}
    </div>
  )
}