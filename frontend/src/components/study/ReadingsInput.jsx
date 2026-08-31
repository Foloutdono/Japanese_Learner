import { useState } from 'react'
import { useLang } from '../../LangContext'
import { CheckCircleIcon } from '../ui/Icons'
import { playClick } from '../../lib/audio'
import { romajiMatchesAny } from '../../lib/romaji'

// ── 読み入力 — the readings drill's answer field ────────────────
// A kanji has an open-ended number of readings and nobody agrees how many
// "count", so this does not ask for a fixed set. Each group starts with
// one empty row when the card has that kind of reading at all, the
// learner adds as many as they want, and on submit every stored reading
// is revealed beside what they wrote.
//
// The 15-row cap is not a scoring rule — it stops a stuck learner from
// growing the form without bound. 大 has 8 readings; nothing in the deck
// comes close to 15.
//
// ── Why the tick marks are not a grade ────────────────────────
// Matching is generous and advisory, exactly as in write_romaji: the
// learner rates themselves afterwards and that rating is what the SRS
// records. Kana and romaji are both accepted for the same reading, and
// the okurigana dot in "ま.ず" is ignored, because someone who typed
// "mazu" or "まず" for ま.ず has not made a mistake.
const MAX_ROWS = 15

function matches(typed, entries) {
  const v = (typed ?? '').trim()
  if (!v) return false
  // Kana as written (dot-stripped), or any romanisation of it.
  return entries.some(e =>
    v === e.display || v === e.reading || romajiMatchesAny(v, [e.display, e.reading]),
  )
}

// The full reading list joins with "・" (see readings-input__answer-list
// below) — at that row's text size the bare character all but
// disappears, and the readings read as one run-on string instead of a
// list. Same fix as BrowseCardsMenu's DottedReadings: split it out and
// give the separator its own larger, bolder styling.
// Each reading is its own nowrap unit: a kanji like 上 has fifteen kun
// readings, the list wraps over three lines, and without this the break
// lands INSIDE a reading — のぼ.り split across two lines reads as two
// different readings, which is the one thing this list must not do.
function DottedList({ entries }) {
  return entries.map((e, i) => (
    <span key={i} className="reading-sep-item">
      {i > 0 && <span className="reading-sep-dot" aria-hidden="true">・</span>}
      {e.reading}
    </span>
  ))
}

// Reset between cards is by REMOUNT, not by an effect: the parent renders
// this with key={card.card_id}, so a new card gets a genuinely new
// component rather than an old one racing to clear itself. Resetting in an
// effect would leave one render in which the previous card's answers are
// still on screen under the new card's prompt.
export default function ReadingsInput({ readings, submitted, onSubmit }) {
  const { t } = useLang()
  const on  = readings?.on  ?? []
  const kun = readings?.kun ?? []

  // One empty row per group that the card actually has. A kanji with no
  // kun-reading gets no kun group at all, rather than an empty box the
  // learner would reasonably try to fill.
  const seed = () => ({ on: on.length ? [''] : [], kun: kun.length ? [''] : [] })
  const [rows, setRows] = useState(seed)

  const total = rows.on.length + rows.kun.length
  const full  = total >= MAX_ROWS

  function setRow(kind, i, value) {
    setRows(r => ({ ...r, [kind]: r[kind].map((v, j) => (j === i ? value : v)) }))
  }
  function addRow(kind) {
    if (full) return
    playClick()
    setRows(r => ({ ...r, [kind]: [...r[kind], ''] }))
  }

  const GROUPS = [
    { kind: 'on',  label: t.readingsOn,  jp: '音読み', entries: on },
    { kind: 'kun', label: t.readingsKun, jp: '訓読み', entries: kun },
  ].filter(g => g.entries.length > 0)

  return (
    // .prompt-card gives this the same elevated surface every other
    // quiz interaction sits on — it used to float straight on the page
    // background under the kanji's own (properly carded) prompt.
    <div className="prompt-card readings-input">
      {GROUPS.map((g, gi) => (
        <div
          key={g.kind}
          className={`readings-input__group${gi > 0 ? ' readings-input__group--sep' : ''}`}
        >
          <div className="readings-input__label">
            <span lang="ja">{g.jp}</span> <span>{g.label}</span>
          </div>

          {rows[g.kind].map((value, i) => {
            const ok = submitted && matches(value, g.entries)
            return (
              <div key={i} className="readings-input__row">
                <input
                  value={value}
                  onChange={e => setRow(g.kind, i, e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !submitted) { playClick(); onSubmit() } }}
                  disabled={submitted}
                  autoFocus={i === 0 && g.kind === GROUPS[0].kind}
                  className={`field quiz-input readings-input__field${
                    submitted ? (ok ? ' readings-input__field--ok' : ' readings-input__field--miss') : ''}`}
                  placeholder={t.readingsPlaceholder}
                  lang="ja"
                />
                {ok && <CheckCircleIcon size={15} />}
              </div>
            )
          })}

          {!submitted && !full && (
            <button type="button" onClick={() => addRow(g.kind)} className="readings-input__add">
              + {t.readingsAdd}
            </button>
          )}

          {submitted && (
            <div className="readings-input__answer">
              <span className="readings-input__answer-label">{t.readingsAll}</span>
              <span className="readings-input__answer-list" lang="ja">
                <DottedList entries={g.entries} />
              </span>
            </div>
          )}
        </div>
      ))}

      {!submitted && (
        <button onClick={() => { playClick(); onSubmit() }} className="btn-primary quiz-submit readings-input__submit">
          {t.submit}
        </button>
      )}
      {!submitted && full && (
        <div className="readings-input__cap">{t.readingsCap}</div>
      )}
    </div>
  )
}
