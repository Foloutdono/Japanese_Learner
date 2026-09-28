import { useLang } from '../../LangContext'
import { LINES, approx, toggleLine } from '../../domain/boarding'
import { useDesk } from '../../hooks/useDesk'
import { Emphasized } from '../ui/Emphasized'
import { BoardQuestion, Continue } from './BoardFrame'
import { BoardOption, PickMark } from './BoardOption'
import { LockMark } from './icons'

// ── the lines: what to learn ─────────────────────────────────────
// Three rows, any number of them on, all three on to begin with: the
// vocabulary, the kanji, the grammar -- the lines of the Learn gate
// that carry a JLPT track. The kana are not offered: every ticket rides
// them (they are what the other three are read through, and the kana
// check has already said how much of that ride is left), so the hint
// says so rather than a fourth row saying it for them.
//
// The choice is what the plan prices (domain/boarding.js planFigures),
// what the pass's ghost train counts (backend routes/journey.py), and
// which plates hang first on the Learn gate. It is a default, never a
// lock: the other lines stay one tap away, and Settings › Learning can
// change it (backend core/lines.py).
//
// One glyph per line as the roundel's code, the way the level list
// wears its N-codes -- the same glyph that opens each line's plate
// (config/tabs.js): 語 for the words, 漢 for the characters, 文 for the
// patterns.
const GLYPH = { vocab: '語', kanji: '漢', grammar: '文' }

// On the desk (plan 161) `carries` is what each line holds on this ride,
// { vocab, kanji, grammar }, `stop` the goal it rides to and `arrival`
// the month the lines picked arrive in -- each null until the volumes
// that price them have answered.
export default function LinesStep({ value, onChange, onContinue, carries = null, stop = null, arrival = null }) {
  const { t } = useLang()
  const desk = useDesk()
  return (
    <>
      <div className="brd__body">
        <BoardQuestion hint={t.brdLinesHint}>{t.brdLinesQ}</BoardQuestion>
        <div className="brd__stage">
          {desk ? <LineCards value={value} onChange={onChange} carries={carries} stop={stop} arrival={arrival} /> : (
            <div className="brd__opts" role="group" aria-label={t.brdLinesQ}>
              {LINES.map((line, i) => (
                <BoardOption
                  key={line}
                  pick={i + 1}
                  on={value.includes(line)}
                  onClick={() => onChange(toggleLine(value, line))}
                  code={<span lang="ja">{GLYPH[line]}</span>}
                  label={t.brdLine[line]}
                  desc={t.brdLineDesc[line]}
                  data-line={line}
                />
              ))}
            </div>
          )}
          {value.length === 0 && <p className="brd__error" role="alert">{t.brdLinesNone}</p>}
        </div>
      </div>
      <div className="brd__foot">
        <Continue keys label={t.onbContinue} onClick={onContinue} disabled={value.length === 0} data-action="continue" />
      </div>
    </>
  )
}

// ── 辻 — the lines as cards, the kana over them (plan 161) ───────
// The owner's D05 on the desk: the kana a strip across the paper, on
// every ticket and so no answer; the three lines a card each under
// their own pigment -- the glyph that opens the line's plate in its
// ring, what it is, and what it carries on this ride ("~700 words to
// N5") -- and under them the month the lines picked arrive in, which
// moves as a line is taken off or put back.
const ROUNDED = n => approx(n, n < 200 ? 10 : n < 2000 ? 50 : 100)

function LineCards({ value, onChange, carries, stop, arrival }) {
  const { t, lang } = useLang()
  const reach = stop === 'novice' ? null : stop
  return (
    <>
      <div className="desk-brd__ticket">
        <span className="desk-brd__glyph desk-brd__glyph--ticket" lang="ja" aria-hidden="true">あ</span>
        <span className="desk-brd__ticket-txt"><b>{t.kanaTitle}</b>{t.brdKanaFirst}</span>
        <span className="desk-brd__ticket-lock"><LockMark />{t.brdOnEveryTicket}</span>
      </div>
      <div className="desk-brd__lines" role="group" aria-label={t.brdLinesQ}>
        {LINES.map((line, i) => {
          const on = value.includes(line)
          const n = carries?.[line] ?? 0
          return (
            <button
              key={line}
              type="button"
              className="desk-brd__line"
              aria-pressed={on}
              aria-keyshortcuts={String(i + 1)}
              onClick={() => onChange(toggleLine(value, line))}
              data-line={line}
            >
              <PickMark digit={i + 1} corner />
              <span className="desk-brd__line-ring" lang="ja" aria-hidden="true">{GLYPH[line]}</span>
              <span className="desk-brd__line-name">{t.brdLine[line]}</span>
              <span className="desk-brd__line-desc">{t.brdLineDesc[line]}</span>
              {reach && n > 0 && (
                <span className="desk-brd__line-vol">
                  <b className="desk-brd__line-fig">~{ROUNDED(n).toLocaleString(lang)}</b>
                  <span className="desk-brd__line-unit">{t.brdLineCarries[line](reach)}</span>
                </span>
              )}
            </button>
          )
        })}
      </div>
      {reach && arrival && value.length > 0 && (
        <p className="desk-brd__first">
          <span className="desk-brd__glyph desk-brd__glyph--goal" aria-hidden="true">{reach}</span>
          <span><Emphasized text={t.brdLinesArrive(value.length, reach, arrival)} /></span>
        </p>
      )}
    </>
  )
}
