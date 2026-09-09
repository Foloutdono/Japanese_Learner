import { useLang } from '../../LangContext'
import { LEVELS, approx, kanjiThrough, stopsAhead } from '../../domain/boarding'
import { BoardQuestion, Continue } from './BoardFrame'
import { BoardOption } from './BoardOption'

// ── 4 · the level, and 5 · the goal (plan 075) ───────────────────
// The level list: the novice (no stop behind them) and the five JLPT
// stops, each with the kanji it stands on -- from the app's own
// volumes (GET /api/onboarding/volumes), the canvas's round figures
// standing in until they arrive. The goal offers only the stops ahead,
// the next one marked and preselected.

// The canvas's figures, for the beat before the volumes answer.
const KANJI_SIGN = { N5: 100, N4: 300, N3: 650, N2: 1000, N1: 2000 }

function kanjiFigure(volumes, level, lang) {
  const n = volumes ? approx(kanjiThrough(volumes, level), 50) : KANJI_SIGN[level]
  return n.toLocaleString(lang)
}

export function LevelStep({ volumes, value, onChange, onContinue }) {
  const { t, lang } = useLang()
  return (
    <>
      <div className="brd__body">
        <BoardQuestion hint={t.brdLevelHint}>{t.brdLevelQ}</BoardQuestion>
        <div className="brd__stage">
          <div className="brd__opts">
            <BoardOption
              on={value === 'novice'}
              onClick={() => onChange('novice')}
              code="—"
              label={t.brdNovice}
              desc={t.brdLevelDesc.novice}
              data-level="novice"
            />
            {LEVELS.map(level => (
              <BoardOption
                key={level}
                on={value === level}
                onClick={() => onChange(level)}
                code={level}
                label={t.levelName[level]}
                desc={t.brdLevelDesc[level](kanjiFigure(volumes, level, lang))}
                data-level={level}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="brd__foot">
        <Continue label={t.onbContinue} onClick={onContinue} disabled={!value} data-action="continue" />
      </div>
    </>
  )
}

// `level` is the learner's own choice, not the level the office
// stores: the novice is stored at N5 and has not passed it, so N5 is
// the first stop AHEAD of them. stopsAhead knows that; the hint has to
// print the choice by its own name rather than the stored code.
export function GoalStep({ volumes, level, value, onChange, onContinue }) {
  const { t, lang } = useLang()
  const ahead = stopsAhead(level)
  const from = level === 'novice' ? t.brdNovice : level
  return (
    <>
      <div className="brd__body">
        <BoardQuestion hint={t.brdGoalHint(from)}>{t.brdGoalQ}</BoardQuestion>
        <div className="brd__stage">
          <div className="brd__opts">
            {ahead.map((stop, i) => (
              <BoardOption
                key={stop}
                on={value === stop}
                onClick={() => onChange(stop)}
                code={stop}
                label={t.levelName[stop]}
                tag={i === 0 ? t.brdNextStop : null}
                desc={t.brdLevelDesc[stop](kanjiFigure(volumes, stop, lang))}
                data-goal={stop}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="brd__foot">
        <Continue label={t.onbContinue} onClick={onContinue} disabled={!value} data-action="continue" />
      </div>
    </>
  )
}
