import { useEffect, useState } from 'react'
import { useLang } from '../../LangContext'
import { useDesk } from '../../hooks/useDesk'
import { playKana, preloadKana } from '../../lib/audio'
import { SpeakerIcon } from '../ui/Icons'
import { INTRO_VOWELS } from '../../domain/nyumon'
import { IntroPage } from './IntroPage'

// ── 入門 2 · Sons — five vowels, the recorded voice (plan 170) ───
// The five vowels as stations on the kana line, each one a button that
// plays its clip (the kana deck's own recording, lib/audio playKana),
// its romaji under it and, where the letters would mislead, how it
// sounds. The clips are fetched and decoded when the screen opens
// (preloadKana), so the first touch sounds like every other.
export default function SoundsStep({ onContinue, skip }) {
  const { t } = useLang()
  const desk = useDesk()
  const [last, setLast] = useState(null)
  useEffect(() => { preloadKana(INTRO_VOWELS.map(v => v.romaji)) }, [])
  function play(v) {
    playKana(v.romaji)
    setLast(v.romaji)
  }
  return (
    <IntroPage step="sounds" title={t.nyuSoundsQ} hint={t.nyuSoundsHint} onContinue={onContinue} skip={skip}>
      <ol className="nyu-vowels" aria-label={t.nyuVowelsAria}>
        {INTRO_VOWELS.map((v, i) => {
          const like = t.nyuSoundsLike[v.romaji]
          const on = last === v.romaji
          return (
            <li key={v.romaji} className={`nyu-vowel${on ? ' nyu-vowel--on' : ''}`}>
              <button
                type="button"
                className="nyu-vowel__btn"
                onClick={() => play(v)}
                aria-label={`${v.kana}, ${v.romaji}`}
                aria-keyshortcuts={desk ? String(i + 1) : undefined}
                data-vowel={v.romaji}
              >
                <span className="nyu-vowel__ring" lang="ja" aria-hidden="true">{v.kana}</span>
                <SpeakerIcon size={16} className="nyu-vowel__spk" />
                {desk && <kbd className="desk-kbd nyu-vowel__key" aria-hidden="true">{i + 1}</kbd>}
              </button>
              <span className="nyu-vowel__rom" lang="ja-Latn" aria-hidden="true">{v.romaji}</span>
              {like && <span className="nyu-vowel__like" aria-hidden="true">{t.nyuQuote(like)}</span>}
            </li>
          )
        })}
      </ol>
      <p className="nyu-line-note">{t.nyuSoundsFoot}</p>
    </IntroPage>
  )
}
