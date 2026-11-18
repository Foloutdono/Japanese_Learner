import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { playClick } from '../../lib/audio'
import { useCardContents, setCardContents } from '../../stores/cardContents'
import { CARD_FIELDS, CARD_LINES } from '../../domain/cardContents'
import { Loading } from '../ui/Loading'
import { Seg } from '../chrome/Console'
import { SettingsPage } from './SettingsPage'

// ── 札の中身 — Réglages › Card contents (plan 326) ───────────────────
// The owner's pick D1 of the canvas "Tsuji — card templates": a line at
// a time (Vocabulary | Kanji), each field a row with a switch, the row
// saying what it adds by showing it on one word of the course (届ける,
// 送), so nobody switches on a name they cannot picture. The question's
// fields are offered under their own heading, and only the ones that
// cannot give the answer away (domain/cardContents.js holds the rule).
// Reached from Réglages and from a run's Personalize button, which
// passes the run to go back to (`location.state.back`).

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

function Rows({ line, side, fields, on, onFlip, t }) {
  if (fields.length === 0) return null
  return (
    <section className="cc-group" aria-labelledby={`cc-${line}-${side}`}>
      <span className="cc-group__cap" id={`cc-${line}-${side}`}>{side === 'question' ? t.ccQuestion : t.ccAnswer}</span>
      <div className="stg-list">
        {fields.map(field => {
          const checked = on.includes(field)
          const labelId = `cc-${line}-${field}`
          return (
            <div key={field} className="stg-row cc-row" data-field={field}>
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

export function CardContentsPage({ session }) {
  const { t } = useLang()
  const location = useLocation()
  const { data, failed: loadFailed } = useCardContents()
  const [line, setLine] = useState('vocab')
  const [failed, setFailed] = useState(false)
  // From a run's Personalize button: back to the card, not to Réglages.
  const back = location.state?.back ?? undefined
  const backLabel = back ? t.back : null

  if (!data) {
    return (
      <SettingsPage title={t.settingsCards} back={back} backLabel={backLabel}>
        {loadFailed ? <p className="hint" role="alert">{t.onbPassError}</p> : <Loading />}
      </SettingsPage>
    )
  }

  const on = data[line] ?? []
  function flip(field) {
    playClick()
    setFailed(false)
    const next = on.includes(field) ? on.filter(f => f !== field) : [...on, field]
    setCardContents(line, next, session).catch(() => setFailed(true))
  }

  return (
    <SettingsPage title={t.settingsCards} back={back} backLabel={backLabel}>
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
    </SettingsPage>
  )
}
