import { useState } from 'react'
import { useLang } from '../../LangContext'
import { useDesk } from '../../hooks/useDesk'
import { Emphasized } from '../ui/Emphasized'
import { SwapIcon } from '../ui/Icons'
import { phraseOrder } from '../../domain/nyumon'
import { IntroPage } from './IntroPage'

// ── 入門 5 · Phrase — words, tags, the verb last (plan 170) ──────
// The sentence drawn as a line: a ghost stop for the « je » nobody
// says, then each word with its tag hung after it (で where, を what --
// the screen never says "particle"), to the verb at the terminus.
// Swapping the two tagged words keeps the meaning, which is the point:
// the tag carries the role, not the place. The line runs down on a
// phone and across on the desk (index.css), in the ambient ink: a
// sentence is no section and the gold is the learner's own.
export default function SentenceStep({ onContinue, skip }) {
  const { t } = useLang()
  const desk = useDesk()
  const [swapped, setSwapped] = useState(false)
  return (
    <IntroPage step="sentence" title={t.nyuSentenceQ} hint={t.nyuSentenceHint} onContinue={onContinue} skip={skip}>
      <ol className="nyu-phrase">
        <li className="nyu-stn nyu-stn--ghost">
          <span className="nyu-stn__mark" aria-hidden="true" />
          <span className="nyu-stn__head"><span className="nyu-stn__ghost">{t.nyuGhost}</span></span>
        </li>
        {phraseOrder(swapped).map(p => (
          <li key={p.jp} className={`nyu-stn${p.verb ? ' nyu-stn--end' : ''}`}>
            <span className="nyu-stn__mark" aria-hidden="true" />
            <span className="nyu-stn__head">
              <span className="nyu-stn__jp" lang="ja">{p.jp}</span>
              {p.tag && (
                <span className="nyu-tag">
                  <span className="nyu-tag__jp" lang="ja">{p.tag}</span>
                  <span className="nyu-tag__role">{t.nyuRoles[p.role]}</span>
                </span>
              )}
              {p.verb && <span className="nyu-stn__verb">{t.nyuVerb}</span>}
            </span>
            <span className="nyu-stn__gloss">
              <b lang="ja-Latn">{p.romaji}</b> {t.nyuQuote(t.nyuMeans[p.mean])}
            </span>
          </li>
        ))}
      </ol>
      <div className="nyu-swap">
        <p className="nyu-fr">{t.nyuTranslation}</p>
        <button
          type="button"
          className="nyu-swap__btn"
          aria-pressed={swapped}
          aria-keyshortcuts={desk ? '1' : undefined}
          onClick={() => setSwapped(s => !s)}
          data-action="swap"
        >
          <SwapIcon size={18} className="nyu-swap__ico" />
          {t.nyuSwap}
          {desk && <kbd className="desk-kbd" aria-hidden="true">1</kbd>}
        </button>
        <p className="nyu-swap__said" aria-live="polite">{swapped ? <Emphasized text={t.nyuSwapped} /> : null}</p>
      </div>
    </IntroPage>
  )
}
