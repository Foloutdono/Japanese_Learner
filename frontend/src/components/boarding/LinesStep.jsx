import { useLang } from '../../LangContext'
import { LINES, approx, toggleLine } from '../../domain/boarding'
import { useDesk } from '../../hooks/useDesk'
import { Emphasized } from '../ui/Emphasized'
import { BoardQuestion, Continue } from './BoardFrame'
import { PickMark } from './BoardOption'
import { CheckMark, LockMark } from './icons'

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

// `carries` is what each line holds on this ride, { vocab, kanji,
// grammar }, `stop` the goal it rides to and `arrival` the month the
// lines picked arrive in -- each null until the volumes that price them
// have answered (plan 163 on the desk, plan 168 on a phone). `no` is the
// question's place on the line, which the phone's hub prints.
export default function LinesStep({ value, onChange, onContinue, carries = null, stop = null, arrival = null, no = null, novice = false }) {
  const { t } = useLang()
  const desk = useDesk()
  // 入門 (plan 170): a learner short of both scripts is told the lines in
  // a beginner's words, and when they start -- after the kana.
  const desc = novice ? t.brdLineDescNovice : t.brdLineDesc
  const hint = novice ? t.brdLinesHintNovice : desk ? t.brdLinesHint : null
  return (
    <>
      <div className="brd__body">
        <BoardQuestion hint={hint}>{t.brdLinesQ}</BoardQuestion>
        <div className="brd__stage">
          {desk
            ? <LineCards value={value} onChange={onChange} carries={carries} stop={stop} arrival={arrival} desc={desc} />
            : <LineFan value={value} onChange={onChange} carries={carries} stop={stop} arrival={arrival} no={no} desc={desc} />}
          {desk && value.length === 0 && <p className="brd__error" role="alert">{t.brdLinesNone}</p>}
        </div>
      </div>
      <div className="brd__foot">
        <Continue keys label={t.onbContinue} onClick={onContinue} disabled={value.length === 0} data-action="continue" />
      </div>
    </>
  )
}

// ── 辻 on a phone — the kana into the hub, three lines out (plan 168)
// The owner's A05: the kana run into the question's hub -- they ride on
// every ticket, so they are no answer -- and three lines leave it in
// their pigments, each to its card: the glyph that opens the line's
// plate in its ring, what it is, and what it carries on this ride. A line
// switched off goes dashed and its card pales; the arrival under the
// cards moves with them.
//
// On the canvas's 358px stage (brd-map): the kana over the hub, the three
// cards' top centres the roads run to.
const FAN = [56, 179, 302]

function LineFan({ value, onChange, carries, stop, arrival, no, desc }) {
  const { t, lang } = useLang()
  const reach = stop === 'novice' ? null : stop
  return (
    <>
      <div className="brd-map brd-fan" style={{ '--h': 398 }}>
        <svg className="brd-map__lines" viewBox="0 0 358 398" preserveAspectRatio="none" aria-hidden="true">
          <path className="brd-fan__trunk" d="M179 40V98" />
          {LINES.map((line, i) => (
            <path
              key={line}
              className={`brd-fan__road${value.includes(line) ? '' : ' brd-fan__road--off'}`}
              data-road={line}
              d={`M179 98L${FAN[i]} 174`}
            />
          ))}
        </svg>
        <span className="brd-fan__kana brd-map__at" style={{ '--x': 179, '--y': 20 }} lang="ja" aria-hidden="true">あ</span>
        <span className="brd-hub brd-map__at" style={{ '--x': 179, '--y': 98 }} aria-hidden="true">{no}</span>
        <p className="brd-fan__ticket brd-map__at brd-map__at--corner" style={{ '--x': 210, '--y': 2 }}>
          <b className="brd-fan__ticket-name">{t.brdKanaFirstShort}</b>
          <span className="brd-fan__ticket-lock"><LockMark />{t.brdOnEveryTicket}</span>
        </p>
        <div role="group" aria-label={t.brdLinesQ}>
          {LINES.map((line, i) => {
            const on = value.includes(line)
            const n = carries?.[line] ?? 0
            return (
              <button
                key={line}
                type="button"
                className="brd-lcard brd-map__at brd-map__at--top"
                // Plain numbers, placed by the sheet: the card's top centre.
                style={{ '--x': FAN[i], '--y': 174 }}
                aria-pressed={on}
                onClick={() => onChange(toggleLine(value, line))}
                data-line={line}
              >
                <span className="brd-lcard__chk" aria-hidden="true"><CheckMark /></span>
                <span className="brd-lcard__ring" lang="ja" aria-hidden="true">{GLYPH[line]}</span>
                <span className="brd-lcard__name">{t.brdLine[line]}</span>
                <span className="brd-lcard__desc">{desc[line]}</span>
                {reach && n > 0 && (
                  <span className="brd-lcard__vol">
                    <b className="brd-lcard__fig">~{ROUNDED(n).toLocaleString(lang)}</b>
                    <span className="brd-lcard__unit">{t.brdLineCarries[line](reach)}</span>
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
      {value.length === 0
        ? <p className="brd-arrive brd-arrive--none" role="alert">{t.brdLinesNone}</p>
        : reach && arrival && <p className="brd-arrive"><Emphasized text={t.brdLinesArrive(value.length, reach, arrival)} /></p>}
    </>
  )
}

// ── 辻 — the lines as cards, the kana over them (plan 163) ───────
// The owner's D05 on the desk: the kana a strip across the paper, on
// every ticket and so no answer; the three lines a card each under
// their own pigment -- the glyph that opens the line's plate in its
// ring, what it is, and what it carries on this ride ("~700 words to
// N5") -- and under them the month the lines picked arrive in, which
// moves as a line is taken off or put back.
const ROUNDED = n => approx(n, n < 200 ? 10 : n < 2000 ? 50 : 100)

function LineCards({ value, onChange, carries, stop, arrival, desc }) {
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
              <span className="desk-brd__line-desc">{desc[line]}</span>
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
