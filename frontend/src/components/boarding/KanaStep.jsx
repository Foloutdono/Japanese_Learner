import { useLang } from '../../LangContext'
import { KANA_ANSWERS } from '../../domain/boarding'
import { BoardQuestion, Continue } from './BoardFrame'

// ── 3 · the kana check, and 4 · the reveal (plan 075) ────────────
// "Can you read this?" over a card with one word per script. The four
// answers ARE the foot of the screen and each one advances: a reader
// of one script or none gets the reveal (curiosity paid, the level set
// to the first stop), a reader of both gets the level list. Both roads
// meet at the goal. The card is shared with the reveal, where the
// readings rise under each word, left then right.

const WORDS = [
  { jp: 'すし', romaji: 'su · shi', word: 'sushi', script: 'hiragana' },
  { jp: 'ホテル', romaji: 'ho · te · ru', word: 'hotel', script: 'katakana' },
]

function KanaCard({ reveal = false, t }) {
  return (
    <div className="brd-kana">
      {WORDS.map((w, i) => (
        <div className="brd-kana__pane" key={w.script}>
          <span className="brd-kana__jp" lang="ja">{w.jp}</span>
          {reveal && (
            <>
              <span className={`brd-kana__read${i ? ' brd-kana__read--second' : ''}`}>
                <span className="brd-kana__romaji">{w.romaji}</span>
                <span className="brd-kana__en">{t.brdKanaWord[w.word]}</span>
              </span>
              <span className="brd-kana__script">{t.brdKana[w.script]}</span>
            </>
          )}
        </div>
      ))}
    </div>
  )
}

export function KanaStep({ value, onAnswer }) {
  const { t } = useLang()
  return (
    <div className="brd__body">
      <BoardQuestion>{t.brdKanaQ}</BoardQuestion>
      <div className="brd__stage">
        <KanaCard t={t} />
        <div className="brd-grid" role="group" aria-label={t.brdKanaQ}>
          {KANA_ANSWERS.map(a => (
            <button
              key={a}
              type="button"
              className={`brd-kopt${value === a ? ' brd-kopt--on' : ''}`}
              aria-pressed={value === a}
              onClick={() => onAnswer(a)}
              data-kana={a}
            >
              <span className="brd-kopt__label">{t.brdKana[a]}</span>
              {a === 'hiragana' && <span className="brd-kopt__jp" lang="ja">{WORDS[0].jp}</span>}
              {a === 'katakana' && <span className="brd-kopt__jp" lang="ja">{WORDS[1].jp}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function KanaReveal({ onContinue }) {
  const { t } = useLang()
  return (
    <>
      <div className="brd__body">
        <BoardQuestion>{t.brdRevealQ}</BoardQuestion>
        <div className="brd__stage">
          <KanaCard reveal t={t} />
          <p className="brd__hint">{t.brdRevealHint}</p>
        </div>
      </div>
      <div className="brd__foot">
        <Continue label={t.onbContinue} onClick={onContinue} data-action="continue" />
      </div>
    </>
  )
}
