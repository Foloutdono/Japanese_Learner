import { useState } from 'react'
import { useLang } from '../../LangContext'
import { useDesk } from '../../hooks/useDesk'
import { PickMark } from '../boarding/BoardOption'
import { CheckMark } from '../boarding/icons'
import { INTRO_CELLS, INTRO_ROMAJI } from '../../domain/nyumon'
import { IntroPage, IntroSentence } from './IntroPage'
import { playUi } from '../../lib/audio'

// ── 入門 1 · Écritures — three scripts in one sentence (plan 170) ──
// The sentence, its reading and its meaning; under them the three
// scripts, one lit at a time: touch one and its signs light up in the
// sentence. Hiragana is lit on arrival, so the screen shows what a
// touch does before anything is touched.
const SCRIPTS = ['hira', 'kata', 'kanji']
const GLYPH = { hira: 'あ', kata: 'ア', kanji: '漢' }

export default function ScriptsStep({ onContinue, skip }) {
  const { t } = useLang()
  const desk = useDesk()
  const [lit, setLit] = useState('hira')
  const signs = INTRO_CELLS.filter(c => c.script === lit).map(c => c.ch).join('')
  return (
    <IntroPage step="scripts" title={t.nyuScriptsQ} hint={t.nyuScriptsHint} onContinue={onContinue} skip={skip}>
      <div className="nyu-said">
        <IntroSentence lit={[lit]} />
        <p className="nyu-rom" lang="ja-Latn">{INTRO_ROMAJI}</p>
        <p className="nyu-fr">{t.nyuTranslation}</p>
      </div>
      <div className="nyu-scripts" role="group" aria-label={t.nyuScriptsQ}>
        {SCRIPTS.map((s, i) => (
          <button
            key={s}
            type="button"
            className={`nyu-script nyu-script--${s}`}
            aria-pressed={lit === s}
            aria-keyshortcuts={desk ? String(i + 1) : undefined}
            onClick={() => { playUi('click-mode-selection'); setLit(s) }}
            data-script={s}
          >
            <span className="nyu-ring" lang="ja" aria-hidden="true">{GLYPH[s]}</span>
            <span className="nyu-script__text">
              <span className="nyu-script__name">{t.nyuScript[s].name}</span>
              <span className="nyu-script__desc">{t.nyuScript[s].desc}</span>
            </span>
            {desk
              ? <PickMark digit={i + 1} corner />
              : <span className="nyu-check" aria-hidden="true"><CheckMark className="svg nyu-check__tick" /></span>}
          </button>
        ))}
      </div>
      <p className="sr-only" aria-live="polite">
        {t.nyuScriptsLit(t.nyuScript[lit].name, '')}<span lang="ja">{signs}</span>
      </p>
    </IntroPage>
  )
}
