import { Fragment } from 'react'
import { useLang } from '../../LangContext'
import { KANA_ANSWERS } from '../../domain/boarding'
import { Emphasized } from '../ui/Emphasized'
import { BoardQuestion, Continue, FloorBack } from './BoardFrame'
import { useDesk } from '../../hooks/useDesk'
import { PickMark } from './BoardOption'

// ── 3 · the kana check, and 4 · the reveal (plan 075) ────────────
// "Can you read this?" over a card with one word per script. The four
// answers ARE the foot of the screen and each one advances: a reader
// of one script or none gets the reveal (curiosity paid, the level set
// to the first stop), a reader of both gets the level list. Both roads
// meet at the goal. The card is shared with the reveal, where the
// readings rise under each word, left then right.

const WORDS = [
  { jp: 'すし', romaji: 'su · shi', word: 'sushi', script: 'hiragana', signs: [['す', 'su'], ['し', 'shi']], glyph: 'あ' },
  { jp: 'ホテル', romaji: 'ho · te · ru', word: 'hotel', script: 'katakana', signs: [['ホ', 'ho'], ['テ', 'te'], ['ル', 'ru']], glyph: 'ア' },
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
  // 机 (plan 122): 1-4 answer, as a tap does.
  const desk = useDesk()
  return (
    <>
      <div className="brd__body">
        <BoardQuestion hint={desk ? t.brdKanaHint : null}>{t.brdKanaQ}</BoardQuestion>
        <div className="brd__stage">
          {desk ? <KanaTree value={value} onAnswer={onAnswer} /> : (
            <>
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
            </>
          )}
        </div>
      </div>
      {/* No Continue here, so no floor on a phone; the desk's way back. */}
      <FloorBack />
    </>
  )
}

// ── 辻 — the two words, and the four answers hung from them (plan 163)
// The owner's D03 on the desk: the two words as large as the paper
// lets them stand, and a tree from them to the four answers, each
// drawn as what it reads -- the two words again, a solid chip for a
// word read and a dashed one for a word not yet -- over what it says in
// words ("Only すし") and what that is called (the hiragana). The
// answer picked before, come back to by Back, lights its branch.
const READS = {
  hiragana: [true, false],
  katakana: [false, true],
  both: [true, true],
  none: [false, false],
}
const only = { hiragana: WORDS[0].jp, katakana: WORDS[1].jp }

// The Japanese in a label set as Japanese: the table places the word
// ("Only すし", "Seulement すし") and it is marked where it falls.
function withJa(text, jp) {
  const at = text.indexOf(jp)
  if (at < 0) return text
  return <>{text.slice(0, at)}<span className="desk-brd__jp" lang="ja">{jp}</span>{text.slice(at + jp.length)}</>
}

function KanaTree({ value, onAnswer }) {
  const { t } = useLang()
  const on = KANA_ANSWERS.indexOf(value)
  return (
    <div className={`desk-brd__kana${on >= 0 ? ' desk-brd__kana--on' : ''}`}>
      <p className="desk-brd__words" lang="ja">
        {WORDS.map(w => <span key={w.script}>{w.jp}</span>)}
      </p>
      <div className="desk-brd__tree" aria-hidden="true">
        {KANA_ANSWERS.map((a, i) => (
          <span
            key={a}
            className={`desk-brd__branch${i === on ? ' desk-brd__branch--on' : ''}`}
            // A plain number, the branch's column (the sheet's grid).
            style={{ '--i': i }}
          />
        ))}
        <span className="desk-brd__knot" />
      </div>
      <div className="brd-grid" role="group" aria-label={t.brdKanaQ}>
        {KANA_ANSWERS.map((a, i) => (
          <button
            key={a}
            type="button"
            className={`brd-kopt desk-brd__ans${value === a ? ' brd-kopt--on' : ''}`}
            aria-pressed={value === a}
            onClick={() => onAnswer(a)}
            aria-keyshortcuts={String(i + 1)}
            data-kana={a}
          >
            <PickMark digit={i + 1} corner />
            <span className="desk-brd__chips" aria-hidden="true">
              {WORDS.map((w, j) => (
                <span key={w.script} className={`desk-brd__chip${READS[a][j] ? '' : ' desk-brd__chip--not'}`} lang="ja">{w.jp}</span>
              ))}
            </span>
            <span className="brd-kopt__label">
              {a === 'hiragana' || a === 'katakana' ? withJa(t.brdKanaOnly(only[a]), only[a]) : t.brdKana[a]}
            </span>
            <span className="desk-brd__ans-sub">{t.brdKanaSays[a]}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// `first` is the desk's: the kana's stop, { date, min } -- when the
// signs still unread are read by, and at what pace.
export function KanaReveal({ onContinue, first = null }) {
  const { t } = useLang()
  const desk = useDesk()
  return (
    <>
      <div className="brd__body">
        <BoardQuestion hint={desk ? t.brdRevealLead : null}>{t.brdRevealQ}</BoardQuestion>
        <div className="brd__stage">
          {desk ? <RevealWords first={first} /> : (
            <>
              <KanaCard reveal t={t} />
              <p className="brd__hint">{t.brdRevealHint}</p>
            </>
          )}
        </div>
      </div>
      <div className="brd__foot">
        <Continue keys label={t.onbContinue} onClick={onContinue} data-action="continue" />
      </div>
    </>
  )
}

// ── 辻 — the two words read out, sign by sign (plan 163) ─────────
// The owner's D03a on the desk: each word on a card of its own under
// the kana line's pigment, named by its script, cut into its signs with
// each one's sound, and what it means; under them the first stop -- the
// kana, and the day the signs still unread are read by.
function RevealWords({ first }) {
  const { t } = useLang()
  return (
    <>
      <div className="desk-brd__reveal">
        {WORDS.map(w => (
          <div key={w.script} className="desk-brd__word">
            <span className="desk-brd__script">
              <span className="desk-brd__glyph" lang="ja" aria-hidden="true">{w.glyph}</span>
              {t.brdKana[w.script]}
            </span>
            <span className="desk-brd__word-jp" lang="ja">{w.jp}</span>
            <span className="desk-brd__signs">
              {w.signs.map(([kana, sound], i) => (
                <Fragment key={kana}>
                  {i > 0 && <span className="desk-brd__plus" aria-hidden="true">+</span>}
                  <span className="desk-brd__sign">
                    <span className="desk-brd__sign-jp" lang="ja">{kana}</span>
                    <span className="desk-brd__sign-sound">{sound}</span>
                  </span>
                </Fragment>
              ))}
            </span>
            <span className="desk-brd__means">
              {t.brdRevealMeans}
              <b>{t.brdRevealWord(t.brdKanaWord[w.word])}</b>
            </span>
          </div>
        ))}
      </div>
      {first && (
        <p className="desk-brd__first">
          <span className="desk-brd__glyph desk-brd__glyph--stop" lang="ja" aria-hidden="true">あ</span>
          <span><Emphasized text={t.brdRevealFirst(first.date, first.min)} /></span>
        </p>
      )}
    </>
  )
}
