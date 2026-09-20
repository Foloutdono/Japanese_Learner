import { useLang } from '../../LangContext'
import { LINES, toggleLine } from '../../domain/boarding'
import { BoardQuestion, Continue } from './BoardFrame'
import { BoardOption } from './BoardOption'

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

export default function LinesStep({ value, onChange, onContinue }) {
  const { t } = useLang()
  return (
    <>
      <div className="brd__body">
        <BoardQuestion hint={t.brdLinesHint}>{t.brdLinesQ}</BoardQuestion>
        <div className="brd__stage">
          <div className="brd__opts" role="group" aria-label={t.brdLinesQ}>
            {LINES.map(line => (
              <BoardOption
                key={line}
                on={value.includes(line)}
                onClick={() => onChange(toggleLine(value, line))}
                code={<span lang="ja">{GLYPH[line]}</span>}
                label={t.brdLine[line]}
                desc={t.brdLineDesc[line]}
                data-line={line}
              />
            ))}
          </div>
          {value.length === 0 && <p className="brd__error" role="alert">{t.brdLinesNone}</p>}
        </div>
      </div>
      <div className="brd__foot">
        <Continue label={t.onbContinue} onClick={onContinue} disabled={value.length === 0} data-action="continue" />
      </div>
    </>
  )
}
