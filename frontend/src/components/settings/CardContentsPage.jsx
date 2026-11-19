import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { playClick } from '../../lib/audio'
import { useCardContents, setCardContents } from '../../stores/cardContents'
import { CARD_FIELDS, CARD_LINES } from '../../domain/cardContents'
import { Loading } from '../ui/Loading'
import { Seg } from '../chrome/Console'
import { SettingsPage } from './SettingsPage'
import { Sheet } from '../chrome/Sheet'
import { SlidersIcon } from '../ui/Icons'

// ── 札の中身 — Réglages › Card contents (plan 326) ───────────────────
// The owner's pick D1 of the canvas "Tsuji — card templates": a line at
// a time (Vocabulary | Kanji), each field a row with a switch, the row
// saying what it adds by showing it on one word of the course (届ける,
// 送), so nobody switches on a name they cannot picture. The question's
// fields are offered under their own heading, and only the ones that
// cannot give the answer away (domain/cardContents.js holds the rule).
// Reached from Réglages, and since plan 327 as a panel over the run
// from its Personalize button (CardContentsSheet), the queue kept.

// One word of the course, as each field shows it on the card.
function Sample({ field, t }) {
  const s = t.ccSample
  switch (field) {
    case 'furigana':
      return <span lang="ja" className="cc-row__sample cc-row__sample--jp"><ruby>届<rt>とど</rt></ruby>ける</span>
    case 'example':
      return <span lang="ja" className="cc-row__sample cc-row__sample--jp">家に届けていただけますか。</span>
    case 'kanji':
      return <span className="cc-row__sample"><span lang="ja">届</span> {s.kanji}</span>
    case 'pair':
      return <span className="cc-row__sample"><span lang="ja">届く</span> {s.pair}</span>
    case 'words':
      return <span className="cc-row__sample"><span lang="ja">送る · 放送</span> {s.words}</span>
    case 'radical':
      return <span className="cc-row__sample"><span lang="ja">辶</span> {s.radical}</span>
    case 'strokes':
      return <span className="cc-row__sample">{t.ccStrokes(9)}</span>
    default:
      return <span className="cc-row__sample">{s[field] ?? ''}</span>
  }
}

// The glyph before each row, the kanji that names the field (the
// owner's pick C of plan 327's titles): 問 and 答 head the two sides.
const GLYPHS = {
  furigana: 'ふ', sentence: '文', example: '例', kanji: '漢', meanings: '意',
  pair: '対', verb: '動', words: '語', radical: '部', strokes: '画',
}

function Rows({ line, side, fields, on, onFlip, t }) {
  if (fields.length === 0) return null
  return (
    <section className="cc-group" aria-labelledby={`cc-${line}-${side}`}>
      <div className="cc-group__head">
        <span lang="ja" className="cc-group__seal" aria-hidden="true">{side === 'question' ? '問' : '答'}</span>
        <h3 className="cc-group__title" id={`cc-${line}-${side}`}>{side === 'question' ? t.ccQuestion : t.ccAnswer}</h3>
        <span className="cc-group__rule" aria-hidden="true" />
      </div>
      <div className="stg-list">
        {fields.map(field => {
          const checked = on.includes(field)
          const labelId = `cc-${line}-${field}`
          return (
            <div key={field} className="stg-row cc-row" data-field={field}>
              <span lang="ja" className="stg-row__icon cc-row__glyph" aria-hidden="true">{GLYPHS[field]}</span>
              <span className="stg-row__names">
                <span className="stg-row__jp" id={labelId}>{t.ccField[field]}</span>
                <Sample field={field} t={t} />
              </span>
              <button
                type="button" role="switch" className="bz-switch" aria-checked={checked}
                aria-labelledby={labelId} onClick={() => onFlip(field)}
              >
                <span className="bz-switch__knob" aria-hidden="true" />
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/** Réglages › Card contents' fields, a line at a time: the page's body,
 *  and the panel a run's Personalize opens over the card (plan 327),
 *  so a learner changes what the cards show without leaving the queue.
 *  `initialLine` is the line of the card in hand. */
export function CardContentsBody({ session, initialLine = 'vocab' }) {
  const { t } = useLang()
  const { data, failed: loadFailed } = useCardContents()
  const [line, setLine] = useState(CARD_LINES.includes(initialLine) ? initialLine : 'vocab')
  const [failed, setFailed] = useState(false)

  if (!data) return loadFailed ? <p className="hint" role="alert">{t.onbPassError}</p> : <Loading />

  const on = data[line] ?? []
  function flip(field) {
    playClick()
    setFailed(false)
    const next = on.includes(field) ? on.filter(f => f !== field) : [...on, field]
    setCardContents(line, next, session).catch(() => setFailed(true))
  }

  return (
    <>
      <Seg
        full
        label={t.settingsCards}
        value={line}
        onChange={key => { playClick(); setLine(key) }}
        options={CARD_LINES.map(key => ({ key, label: t.brdLine[key] }))}
      />
      <Rows line={line} side="question" fields={CARD_FIELDS[line].question} on={on} onFlip={flip} t={t} />
      <Rows line={line} side="answer" fields={CARD_FIELDS[line].answer} on={on} onFlip={flip} t={t} />
      {line === 'vocab' && <p className="slip__hint">{t.ccHint}</p>}
      {failed && <p className="hint" role="alert">{t.onbPassError}</p>}
    </>
  )
}

export function CardContentsPage({ session }) {
  const { t } = useLang()
  const location = useLocation()
  // An old link from a run (before plan 327 the run came here) still
  // goes back to the card.
  const back = location.state?.back ?? undefined
  const backLabel = back ? t.back : null
  return (
    <SettingsPage title={t.settingsCards} back={back} backLabel={backLabel}>
      <CardContentsBody session={session} />
    </SettingsPage>
  )
}

/** The panel over a run (plan 327): the same fields in a sheet, the run
 *  and its card left as they stand beneath it. */
export function CardContentsSheet({ session, line, onClose }) {
  const { t } = useLang()
  return (
    <Sheet open onClose={onClose} title={t.settingsCards} icon={SlidersIcon} className="cc-sheet" dismiss>
      <CardContentsBody session={session} initialLine={line} />
    </Sheet>
  )
}
