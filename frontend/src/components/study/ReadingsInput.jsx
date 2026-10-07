import { useRef, useState } from 'react'
import { useLang } from '../../LangContext'
import { CheckIcon } from '../ui/Icons'
import { playClick } from '../../lib/audio'
import { romajiEquals, kanaToRomaji, toHiragana } from '../../lib/romaji'
import { composing } from '../../lib/keyGuards'
import { formatPct, shareTier, sharePct } from '../../domain/readingShare'

// ── 読み入力 — the readings drill's answer field ────────────────
// A kanji has an open-ended number of readings and nobody agrees how many
// "count", so this does not ask for a fixed set. Each kind the card has
// (on, kun) gets one box, and the learner puts as many readings in it as
// they want: each becomes a chip, and on checking every stored reading is
// laid out in the same box beside what they wrote.
//
// A kind the card does not have gets no box at all, rather than an empty
// one the learner would reasonably try to fill.
//
// ── Adding a reading, on a keyboard and on a phone ────────────
// A reading becomes a chip on a separator -- comma, 、, ・, a space -- or
// the + that appears as soon as something is typed, or when the box
// loses the focus. Enter, and Valider, check the answer, taking whatever
// is still typed along with them, so a learner with one reading types it
// and presses Enter as before. Backspace in an empty box takes the last
// chip back to be corrected; a tap on a chip removes it.
//
// A space is only a separator once the input method has let go of it.
// Typing Japanese, Space is the key that converts the kana, and it
// arrives inside a composition: the text is split on the value the field
// holds, and never while a composition is open (the input's isComposing,
// then once more on compositionend, when a 、 the IME committed lands in
// the value). The keydown is not asked, which is what makes this work on
// Android, whose keyboards send keyCode 229 for everything. The + is for
// the phone that has no comma on its first page.
//
// The 15-reading cap is not a scoring rule -- it stops a stuck learner
// from growing the form without bound. 大 has 8 readings; nothing in the
// deck comes close to 15.
//
// ── 割合 (plan 177) ────────────────────────────────────────────
// Checked, each reading of the list also prints the share of the course's
// words that use it (`shares`, the card's `reading_shares`), so the answer
// says which readings were the ones worth knowing: セイ at half the words
// and せい.. at one in a hundred. A card with no word in the course
// carries no counts and prints none.
//
// ── Why the ticks are not a grade ─────────────────────────────
// Matching is generous and advisory, exactly as in write_romaji: the
// learner rates themselves afterwards and that rating is what the SRS
// records. Kana in either script and romaji are all accepted for the
// same reading -- しゅ, シュ and shu for シュ -- and the okurigana dot in
// "ま.ず" is ignored, because someone who typed "mazu" or "まず" for ま.ず
// has not made a mistake. (Romaji and hiragana never matched until the
// chips: the stored reading was compared as it stood, katakana against
// Latin, and the grey border a miss wore hid it. A struck chip would
// not have.)
const MAX_READINGS = 15
// \s takes the ideographic space (U+3000) a Japanese keyboard types too.
const SEPARATOR = /[\s,、，・;；/]+/

function matches(typed, entry) {
  const v = (typed ?? '').trim()
  if (!v) return false
  // Kana in either script, as stored or dot-stripped; or any
  // romanisation of it.
  const kana = toHiragana(v)
  return kana === toHiragana(entry.display) || kana === toHiragana(entry.reading)
    || romajiEquals(v, kanaToRomaji(entry.display))
}

function pieces(text) {
  return text.split(SEPARATOR).map(s => s.trim()).filter(Boolean)
}

// Reset between cards is by REMOUNT, not by an effect: the parent renders
// this with key={card.card_id}, so a new card gets a genuinely new
// component rather than an old one racing to clear itself. Resetting in an
// effect would leave one render in which the previous card's answers are
// still on screen under the new card's prompt.
export default function ReadingsInput({ readings, shares, submitted, onSubmit }) {
  const { t, lang } = useLang()
  const on  = readings?.on  ?? []
  const kun = readings?.kun ?? []

  const GROUPS = [
    { kind: 'on',  label: t.readingsOn,  entries: on },
    { kind: 'kun', label: t.readingsKun, entries: kun },
  ].filter(g => g.entries.length > 0)

  const [chips, setChips] = useState({ on: [], kun: [] })
  const [drafts, setDrafts] = useState({ on: '', kun: '' })
  const fields = useRef({})

  const total = chips.on.length + chips.kun.length
  const full  = total >= MAX_READINGS

  // Adds each reading in `texts` to `kind`'s chips, past the ones it
  // already holds and up to the cap, and returns the whole new set --
  // Enter needs it before the state it sets has landed.
  function added(from, kind, texts) {
    const next = { ...from, [kind]: [...from[kind]] }
    for (const text of texts) {
      if (next.on.length + next.kun.length >= MAX_READINGS) break
      if (!next[kind].includes(text)) next[kind].push(text)
    }
    return next
  }

  function type(kind, value, open) {
    if (open || !SEPARATOR.test(value)) {
      setDrafts(d => ({ ...d, [kind]: value }))
      return
    }
    // Everything before the last separator is a reading; what follows it
    // is still being typed.
    const parts = value.split(SEPARATOR)
    const rest = parts.pop()
    setChips(c => added(c, kind, parts.map(s => s.trim()).filter(Boolean)))
    setDrafts(d => ({ ...d, [kind]: rest }))
  }

  function commit(kind) {
    const texts = pieces(drafts[kind])
    if (!texts.length) return
    setChips(c => added(c, kind, texts))
    setDrafts(d => ({ ...d, [kind]: '' }))
  }

  function check() {
    playClick()
    let next = chips
    for (const g of GROUPS) next = added(next, g.kind, pieces(drafts[g.kind]))
    setChips(next)
    setDrafts({ on: '', kun: '' })
    onSubmit()
  }

  function onKeyDown(kind, e) {
    if (composing(e)) return
    if (e.key === 'Enter') {
      e.preventDefault()
      if (!submitted) check()
    } else if (e.key === 'Backspace' && drafts[kind] === '' && chips[kind].length) {
      // The last chip back into the box, to be corrected.
      e.preventDefault()
      const last = chips[kind][chips[kind].length - 1]
      setChips(c => ({ ...c, [kind]: c[kind].slice(0, -1) }))
      setDrafts(d => ({ ...d, [kind]: last }))
    }
  }

  function remove(kind, text) {
    playClick()
    setChips(c => ({ ...c, [kind]: c[kind].filter(x => x !== text) }))
    fields.current[kind]?.focus()
  }

  return (
    // .prompt-card gives this the same elevated surface every other
    // quiz interaction sits on — it used to float straight on the page
    // background under the kanji's own (properly carded) prompt.
    <div className="prompt-card readings-input">
      {GROUPS.map((g, gi) => {
        const id = `readings-${g.kind}`
        const typed = chips[g.kind]
        const draft = drafts[g.kind]
        return (
          <div key={g.kind} className="readings-input__group">
            <label className="readings-input__label" htmlFor={submitted ? undefined : id}>{g.label}</label>
            <div
              className={`field readings-input__box${submitted ? ' readings-input__box--checked' : ''}`}
              onClick={e => { if (e.target === e.currentTarget) fields.current[g.kind]?.focus() }}
            >
              {!submitted && typed.map(text => (
                <button
                  key={`typed:${text}`}
                  type="button"
                  className="readings-input__chip"
                  onClick={() => remove(g.kind, text)}
                  aria-label={t.readingsRemove(text)}
                  lang="ja"
                >
                  {text}<span className="readings-input__chip-x" aria-hidden="true">×</span>
                </button>
              ))}
              {/* Checked, the box is the kanji's own list, in its order:
                  each reading ticked where the learner found it -- in
                  its kana, whatever they typed it in -- or dashed where
                  they did not, and their wrong guesses struck after it. */}
              {submitted && g.entries.map(e => {
                const ok = typed.some(x => matches(x, e))
                const pct = shares?.total > 0 ? sharePct(shares.readings?.[e.reading] ?? 0, shares.total) : null
                return (
                  <span
                    key={`entry:${e.reading}`}
                    className={`readings-input__chip readings-input__chip--${ok ? 'ok' : 'missed'}`}
                    lang="ja"
                  >
                    {e.reading}
                    {pct !== null && (
                      <span className={`readings-input__pct readings-input__pct--${shareTier(pct)}`}>
                        {formatPct(pct, lang)}<small>%</small>
                      </span>
                    )}
                    {ok && <CheckIcon size={12} />}
                    <span className="sr-only">{ok ? t.readingsFound : t.readingsMissed}</span>
                  </span>
                )
              })}
              {submitted && typed.filter(x => !g.entries.some(e => matches(x, e))).map(text => (
                <span key={`wrong:${text}`} className="readings-input__chip readings-input__chip--wrong" lang="ja">
                  {text}
                  <span className="sr-only">{t.readingsWrong}</span>
                </span>
              ))}
              {!submitted && (
                <>
                  <input
                    id={id}
                    ref={el => { fields.current[g.kind] = el }}
                    value={draft}
                    onChange={e => type(g.kind, e.target.value, e.nativeEvent.isComposing)}
                    onCompositionEnd={e => type(g.kind, e.currentTarget.value, false)}
                    onKeyDown={e => onKeyDown(g.kind, e)}
                    onBlur={() => commit(g.kind)}
                    readOnly={full && !draft}
                    autoFocus={gi === 0}
                    autoCapitalize="off"
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    className="field field--bare quiz-input readings-input__field"
                    placeholder={typed.length ? '' : t.readingsPlaceholder}
                    lang="ja"
                  />
                  {draft.trim() && !full && (
                    <button
                      type="button"
                      className="readings-input__add"
                      // The press keeps the focus, and the phone's keyboard,
                      // in the box. The click then blurs it and takes the
                      // focus straight back: an Android keyboard holds even
                      // Latin letters in an open composition, and the blur
                      // is what ends it -- and adds the reading (onBlur).
                      // Off the Tab order, where leaving the box adds anyway.
                      onPointerDown={e => e.preventDefault()}
                      tabIndex={-1}
                      onClick={() => {
                        playClick()
                        const field = fields.current[g.kind]
                        field?.blur()
                        field?.focus()
                      }}
                      aria-label={t.readingsAdd}
                    >
                      +
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )
      })}

      {!submitted && (
        <button onClick={check} className="btn-primary quiz-submit readings-input__submit">
          {t.submit}
        </button>
      )}
      {!submitted && full && (
        <div className="readings-input__cap">{t.readingsCap}</div>
      )}
    </div>
  )
}
