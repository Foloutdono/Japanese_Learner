import { useEffect, useState } from 'react'
import { useLang } from '../../LangContext'
import { Sheet } from '../chrome/Sheet'
import { OpenBookIcon } from '../ui/Icons'
import { fetchLookup, pickEntry } from '../../lib/dictionaryLookup'
import { readingsHelp } from '../../domain/readingsHelp'
import { formatPct } from '../../domain/readingShare'
import { splitReadingTokens } from './Readings'
import { firstGloss } from './gloss'

// ── 読み — the sheet behind a reading's register (plan 276) ────────
// A kanji card prints its readings under 音読み · on'yomi and 訓読み ·
// kun'yomi, and nothing said what either was: a learner asked. The two
// names are doors since plan 276 (the owner's pick A3 on the canvas),
// and this is what they open: what each reading is, shown in a word of
// the card's own kanji with the kanji and its reading picked out, then
// what the card's marks are -- the share under a reading, the ~ and
// the dot -- each only where this kanji's readings carry it
// (domain/readingsHelp).
//
// The words are the dictionary entry's, asked for when the sheet opens
// and not before (lib/dictionaryLookup keeps it a few minutes, so the
// 🔍 beside it opens on the same answer). The text stands without
// them: while they are on their way, or if they never come, a row is
// its sentence alone.

function Example({ example }) {
  if (!example) return null
  const { word, hit } = example
  const parts = word.furigana ?? []
  const pick = read => parts.map((p, i) => {
    const text = read ? (p.reading ?? p.text) : p.text
    return i === hit ? <b key={i} className="readings-help__hit">{text}</b> : <span key={i}>{text}</span>
  })
  const gloss = firstGloss(word.meaning ?? '')
  return (
    <p className="readings-help__eg">
      <span lang="ja">{parts.length ? pick(false) : (word.kanji || word.kana)}</span>
      {word.kanji && <span lang="ja">{parts.length ? pick(true) : word.kana}</span>}
      {gloss && <small className="readings-help__gloss">{gloss}</small>}
    </p>
  )
}

function Register({ name, jp, text, example }) {
  return (
    <section className="readings-help__row">
      <h3 className="readings-help__name">{name}<span className="readings-help__name-jp" lang="ja">{jp}</span></h3>
      <p className="readings-help__text">{text}</p>
      <Example example={example} />
    </section>
  )
}

export function ReadingsHelp({ open, onClose, kanji, kana, shares, session }) {
  const { t, lang } = useLang()
  // The entry's words, under the kanji they were asked for: a card
  // turned to the next one never shows the last one's.
  const [found, setFound] = useState({ kanji: null, readings: null })
  useEffect(() => {
    if (!open || !kanji) return
    let cancelled = false
    fetchLookup(session, { term: kanji, category: 'kanji', lang })
      .then(data => {
        if (!cancelled) setFound({ kanji, readings: pickEntry(data, { term: kanji })?.readings ?? null })
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [open, kanji, lang, session])

  if (!open) return null
  const help = readingsHelp({
    kanji,
    tokens: splitReadingTokens(kana),
    shares,
    readings: found.kanji === kanji ? found.readings : null,
  })
  const tildeWord = help.tilde?.example?.word
  return (
    <Sheet open onClose={onClose} title={t.readingsHelpCap} icon={OpenBookIcon} line="var(--line-kanji)" label={t.readingsHelpCap} dismiss>
      <div className="readings-help">
        <Register name={t.readingsOnName} jp="音読み" text={t.readingsHelpOn} example={help.on?.example} />
        <Register name={t.readingsKunName} jp="訓読み" text={t.readingsHelpKun} example={help.kun?.example} />
        {(help.share || help.tilde || help.dot) && (
          <dl className="readings-help__marks">
            {help.share && (
              <>
                <dt className="readings-help__mark">{formatPct(help.share.pct, lang)}<small className="readings-help__unit">%</small></dt>
                <dd className="readings-help__means">{t.readingsHelpShare(kanji)}</dd>
              </>
            )}
            {help.tilde && (
              <>
                <dt className="readings-help__mark readings-help__mark--jp" lang="ja">{help.tilde.token}</dt>
                <dd className="readings-help__means">{t.readingsHelpTilde(kanji, help.tilde.side, tildeWord && { kanji: tildeWord.kanji, kana: tildeWord.kana })}</dd>
              </>
            )}
            {help.dot && (
              <>
                <dt className="readings-help__mark readings-help__mark--jp" lang="ja">{help.dot.token}</dt>
                <dd className="readings-help__means">{t.readingsHelpDot(help.dot.written)}</dd>
              </>
            )}
          </dl>
        )}
      </div>
    </Sheet>
  )
}
