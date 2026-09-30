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

// 入門's first touch on the boarding (plan 170): the reveal names the
// third script too, quieter, in the kanji line's pigment -- one word read
// as one sign -- so « Kanji » means something when the lines are asked
// two screens later. The kana stay the first stop.
const KANJI = { jp: '駅', sound: 'eki', word: 'station', glyph: '漢' }

export function KanaStep({ value, onAnswer }) {
  const { t } = useLang()
  // 机 (plan 122): 1-4 answer, as a tap does.
  const desk = useDesk()
  return (
    <>
      <div className="brd__body">
        <BoardQuestion hint={desk ? t.brdKanaHint : null}>{t.brdKanaQ}</BoardQuestion>
        <div className="brd__stage">
          {desk ? <KanaTree value={value} onAnswer={onAnswer} /> : <Crossing value={value} onAnswer={onAnswer} />}
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
function withJa(text, jp, className = 'desk-brd__jp') {
  const at = text.indexOf(jp)
  if (at < 0) return text
  return <>{text.slice(0, at)}<span className={className} lang="ja">{jp}</span>{text.slice(at + jp.length)}</>
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

// ── 辻 on a phone — the crossing (plan 168) ──────────────────────
// The owner's A03: 辻 itself, two roads crossing, the two words where
// they meet, and an answer at each road's end -- drawn as what it reads
// (the words again, solid for a word read and dashed for one not yet),
// over what it says in words and what that is called. The answer picked
// before, come back to by Back, is lit.
//
// On the canvas's 358px stage (brd-map): the answers two by two, the
// roads from one's centre to the one across.
const CORNERS = [[81.5, 73], [276.5, 73], [81.5, 457], [276.5, 457]]

function Crossing({ value, onAnswer }) {
  const { t } = useLang()
  return (
    <div className="brd-map brd-cross" style={{ '--h': 530 }}>
      <svg className="brd-map__lines" viewBox="0 0 358 530" preserveAspectRatio="none" aria-hidden="true">
        <path className="brd-road" d="M81.5 73L276.5 457" />
        <path className="brd-road" d="M276.5 73L81.5 457" />
      </svg>
      <p className="brd-cross__words brd-map__at" style={{ '--x': 179, '--y': 265 }} lang="ja">
        {WORDS.map(w => <span key={w.script}>{w.jp}</span>)}
      </p>
      <div role="group" aria-label={t.brdKanaQ}>
        {KANA_ANSWERS.map((a, i) => (
          <button
            key={a}
            type="button"
            className="brd-cross__ans brd-map__at"
            // Plain numbers, placed by the sheet: the answer's centre.
            style={{ '--x': CORNERS[i][0], '--y': CORNERS[i][1] }}
            aria-pressed={value === a}
            onClick={() => onAnswer(a)}
            data-kana={a}
          >
            <span className="brd-cross__chips" aria-hidden="true">
              {WORDS.map((w, j) => (
                <span key={w.script} className={`brd-cross__chip${READS[a][j] ? '' : ' brd-cross__chip--not'}`} lang="ja">{w.jp}</span>
              ))}
            </span>
            <span className="brd-cross__label">
              {a === 'hiragana' || a === 'katakana' ? withJa(t.brdKanaOnly(only[a]), only[a], 'brd-cross__jp') : t.brdKana[a]}
            </span>
            <span className="brd-cross__sub">{t.brdKanaSays[a]}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// `first` is the kana's stop, { date, min } -- when the signs still
// unread are read by, and at what pace -- or null until the volumes
// that price it have answered.
export function KanaReveal({ onContinue, first = null }) {
  const { t } = useLang()
  const desk = useDesk()
  return (
    <>
      <div className="brd__body">
        <BoardQuestion hint={desk ? t.brdRevealLead : null}>{t.brdRevealQ}</BoardQuestion>
        <div className="brd__stage">
          {desk ? <RevealWords first={first} /> : <ReadLines first={first} />}
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
// each one's sound, and what it means; beside them the third script,
// quieter and for later (plan 170): a column in the kanji line's
// pigment, as tall as the cards so it costs the paper no height; under
// them the first stop -- the kana, and the day the signs still unread
// are read by.
function RevealWords({ first }) {
  const { t } = useLang()
  return (
    <>
      <div className="desk-brd__reveal-row">
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
        <p className="desk-brd__kanji">
          <span className="desk-brd__script">
            <span className="desk-brd__glyph desk-brd__glyph--kanji" lang="ja" aria-hidden="true">{KANJI.glyph}</span>
            {t.brdRevealKanji}
          </span>
          <span className="desk-brd__kanji-jp" lang="ja">{KANJI.jp}</span>
          <span className="desk-brd__kanji-sound" lang="ja-Latn">{KANJI.sound}</span>
          <span className="desk-brd__kanji-means">{t.brdRevealMeans} <b>{t.brdRevealWord(t.brdKanaWord[KANJI.word])}</b></span>
          <span className="desk-brd__kanji-later">{t.brdRevealLater}</span>
        </p>
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

// ── 辻 on a phone — each word read as a line (plan 168) ──────────
// The owner's A03b: each word as a little line of its own, under its
// script's name -- its signs the stations, each with its sound under it,
// running on to what the word means at the line's end -- and under the
// two, the first stop: the kana, and the day the signs still unread are
// read by at the ride's pace.
//
// On the canvas's 358px stage (brd-map): a line every 144px, its signs
// every 72px from the left, the meaning at the terminus.
const LINE_AT = [66, 210]
const SIGN_X = [44, 116, 188]
// The kanji's line, a third one under the two (plan 170).
const KANJI_AT = 354

function ReadLines({ first }) {
  const { t } = useLang()
  return (
    <>
      <div className="brd-map brd-read" style={{ '--h': 438 }}>
        <svg className="brd-map__lines" viewBox="0 0 358 438" preserveAspectRatio="none" aria-hidden="true">
          {LINE_AT.map(y => <path key={y} className="brd-read__line" d={`M20 ${y}H232`} />)}
          <path className="brd-read__line brd-read__line--kanji" d={`M20 ${KANJI_AT}H232`} />
        </svg>
        {WORDS.map((w, i) => {
          const y = LINE_AT[i]
          return (
            <div key={w.script} className="brd-read__word">
              <p className="brd-read__script brd-map__at brd-map__at--start" style={{ '--x': 0, '--y': y - 53 }}>
                <span className="brd-read__glyph" lang="ja" aria-hidden="true">{w.glyph}</span>
                {t.brdKana[w.script]}
              </p>
              <span className="brd-read__head brd-map__at" style={{ '--x': 237, '--y': y }} aria-hidden="true" />
              {w.signs.map(([kana, sound], j) => (
                <span key={kana} className="brd-read__sign brd-map__at" style={{ '--x': SIGN_X[j], '--y': y }}>
                  <span className="brd-read__sign-jp" lang="ja">{kana}</span>
                  <span className="brd-read__sound">{sound}</span>
                </span>
              ))}
              <p className="brd-read__means brd-map__at brd-map__at--corner" style={{ '--x': 254, '--y': y - 22 }}>
                <span className="brd-read__cap"><span lang="ja">{w.jp}</span> {t.brdRevealMeans}</span>
                <b className="brd-read__word-fr">{t.brdRevealWord(t.brdKanaWord[w.word])}</b>
              </p>
            </div>
          )
        })}
        <div className="brd-read__word brd-read__word--kanji">
          <p className="brd-read__script brd-map__at brd-map__at--start" style={{ '--x': 0, '--y': KANJI_AT - 53 }}>
            <span className="brd-read__glyph brd-read__glyph--kanji" lang="ja" aria-hidden="true">{KANJI.glyph}</span>
            {t.brdRevealKanji}
            <span className="brd-read__later">{t.brdRevealLater}</span>
          </p>
          <span className="brd-read__head brd-read__head--kanji brd-map__at" style={{ '--x': 237, '--y': KANJI_AT }} aria-hidden="true" />
          <span className="brd-read__sign brd-read__sign--kanji brd-map__at" style={{ '--x': SIGN_X[0], '--y': KANJI_AT }}>
            <span className="brd-read__sign-jp" lang="ja">{KANJI.jp}</span>
            <span className="brd-read__sound">{KANJI.sound}</span>
          </span>
          <p className="brd-read__means brd-map__at brd-map__at--corner" style={{ '--x': 254, '--y': KANJI_AT - 22 }}>
            <span className="brd-read__cap"><span lang="ja">{KANJI.jp}</span> {t.brdRevealMeans}</span>
            <b className="brd-read__word-fr">{t.brdRevealWord(t.brdKanaWord[KANJI.word])}</b>
          </p>
        </div>
      </div>
      {first && (
        <p className="brd-first">
          <span className="brd-first__ring" lang="ja" aria-hidden="true">あ</span>
          <span className="brd-first__txt"><Emphasized text={t.brdRevealFirst(first.date, first.min)} /></span>
        </p>
      )}
    </>
  )
}
