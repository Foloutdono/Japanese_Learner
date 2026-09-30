import { useState } from 'react'
import { useLang } from '../../LangContext'
import { useDesk } from '../../hooks/useDesk'
import { speakJapanese } from '../../lib/audio'
import { SpeakerIcon } from '../ui/Icons'
import { INTRO_PAIRS, INTRO_WORDS } from '../../domain/nyumon'
import { IntroPage } from './IntroPage'

// ── 入門 4 · Katakana — the same sounds, a second hand (plan 170) ──
// Three pairs, each one row -- the hiragana, its reading, the katakana
// -- then three katakana words the learner already knows. A word card
// says the whole word (lib/audio speakJapanese: the device's Japanese
// voice, else the server's clip) and shows its sound spelled and its
// meaning. ホテル is open on arrival, to show what a touch does.
export default function PairsStep({ onContinue, skip }) {
  const { t } = useLang()
  const desk = useDesk()
  const [open, setOpen] = useState(() => new Set([INTRO_WORDS[0].key]))
  const [last, setLast] = useState(null)
  function say(word) {
    speakJapanese(word.jp)
    setOpen(o => (o.has(word.key) ? o : new Set(o).add(word.key)))
    setLast(word.key)
  }
  return (
    <IntroPage step="katakana" title={t.nyuPairsQ} onContinue={onContinue} skip={skip}>
      <div className="nyu-pairs">
        <p className="nyu-pairs__caps" aria-hidden="true">
          <span className="nyu-pairs__cap">{t.nyuScript.hira.name}</span>
          <span className="nyu-pairs__cap">{t.nyuScript.kata.name}</span>
        </p>
        {INTRO_PAIRS.map(p => (
          <p key={p.romaji} className="nyu-pair">
            <span className="nyu-pair__glyph nyu-pair__glyph--hira" lang="ja">{p.hira}</span>
            <span className="nyu-pair__rom" lang="ja-Latn">{p.romaji}</span>
            <span className="nyu-pair__glyph nyu-pair__glyph--kata" lang="ja">{p.kata}</span>
          </p>
        ))}
      </div>
      <div className="nyu-known">
        <p className="nyu-known__lead">{t.nyuPairsLead}</p>
        <div className="nyu-words">
          {INTRO_WORDS.map((w, i) => {
            const shown = open.has(w.key)
            return (
              <button
                key={w.key}
                type="button"
                className={`nyu-word${shown ? ' nyu-word--open' : ''}${last === w.key ? ' nyu-word--heard' : ''}`}
                onClick={() => say(w)}
                aria-keyshortcuts={desk ? String(i + 1) : undefined}
                data-word={w.key}
              >
                <span className="nyu-word__jp" lang="ja">{w.jp}</span>
                {shown ? (
                  <>
                    <span className="nyu-word__beats" lang="ja-Latn">{w.beats.join(' · ')}</span>
                    <span className="nyu-word__mean">
                      <SpeakerIcon size={14} className="nyu-word__spk" />
                      {t.nyuQuote(t.nyuWords[w.key])}
                    </span>
                  </>
                ) : (
                  <span className="nyu-word__hear">{t.nyuHearWord}</span>
                )}
                {desk && <kbd className="desk-kbd nyu-word__key" aria-hidden="true">{i + 1}</kbd>}
              </button>
            )
          })}
        </div>
      </div>
    </IntroPage>
  )
}
