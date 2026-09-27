import { useLayoutEffect, useState } from 'react'
import { useLang } from '../../LangContext'
import { LEVELS, approx, goalStops, kanjiThrough } from '../../domain/boarding'
import { BoardQuestion, Continue } from './BoardFrame'
import { BoardOption, PickMark } from './BoardOption'
import { useDesk } from '../../hooks/useDesk'

// ── 4 · the level, and 5 · the goal (plan 075) ───────────────────
// The level list: the novice (no stop behind them) and the five JLPT
// stops, each with the kanji it stands on -- from the app's own
// volumes (GET /api/onboarding/volumes), the canvas's round figures
// standing in until they arrive. The goal offers only the stops ahead,
// the next one marked; for a learner still short of the kana that is
// the novice's own stop, which heads their list (domain/boarding.js
// goalStops).

// The canvas's figures, for the beat before the volumes answer.
const KANJI_SIGN = { N5: 100, N4: 300, N3: 650, N2: 1000, N1: 2000 }

function kanjiFigure(volumes, level, lang) {
  const n = volumes ? approx(kanjiThrough(volumes, level), 50) : KANJI_SIGN[level]
  return n.toLocaleString(lang)
}

// A level's pick on the desk is its own number (plan 122, owner's
// call): N5 on 5 ... N1 on 1, the novice -- before N5 -- on 0.
const levelDigit = level => (level === 'novice' ? 0 : Number(level.slice(1)))

// ── 机 — the stops as a line of stations (plan 140) ─────────────
// On the desk the list is drawn as what it names: stations on a line,
// the novice's stop first, each on the rail with its code in its ring
// and the stop's card under it. The ride is drawn in gold along the
// rail up to the pick -- where you stand, on the level list; where you
// are going, on the goal's -- so a pick is read off the drawing as a
// stretch of line rather than as one card among six. Six to a row where
// each holds half a run's column, three to a row under that (the 机
// section of index.css). Every stop keeps its row's contract: its data
// attribute, aria-pressed, and its digit (useBoardKeys).
function StationLine({ stops, value, onChange, label, attr }) {
  const at = stops.findIndex(stop => stop.key === value)
  const count = stops.length
  // One row when every stop holds half a run's column (the sheet's own
  // --desk-run-col-min, read off the box), two rows under that --
  // never four and two. Measured before paint, and again as the window
  // changes.
  const [box, setBox] = useState(null)
  const [columns, setColumns] = useState(count)
  useLayoutEffect(() => {
    if (!box) return undefined
    const read = () => {
      const css = getComputedStyle(box)
      const each = parseFloat(css.getPropertyValue('--desk-run-col-min')) / 2 || 0
      const gap = parseFloat(css.columnGap) || 0
      setColumns(box.clientWidth >= count * each + (count - 1) * gap ? count : Math.ceil(count / 2))
    }
    read()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(read)
    observer.observe(box)
    return () => observer.disconnect()
  }, [box, count])
  return (
    <div
      ref={setBox}
      className="brd__opts desk-brd__line"
      role="group"
      aria-label={label}
      style={{ '--stations': columns }}
    >
      {stops.map((stop, i) => (
        <button
          key={stop.key}
          type="button"
          className={[
            'desk-brd__stn',
            i === at && 'desk-brd__stn--on',
            i < at && 'desk-brd__stn--ride',
            // A row's ends draw no rail past them: two rows are two
            // stretches of the line, not a line cut mid-stub.
            i % columns === 0 && 'desk-brd__stn--head',
            (i % columns === columns - 1 || i === count - 1) && 'desk-brd__stn--tail',
          ].filter(Boolean).join(' ')}
          aria-pressed={i === at}
          onClick={() => onChange(stop.key)}
          aria-keyshortcuts={String(stop.digit)}
          {...{ [attr]: stop.key }}
        >
          <span className="desk-brd__rnd">{stop.code}</span>
          <span className="desk-brd__tile">
            {stop.tag && <span className="brd-tag">{stop.tag}</span>}
            <span className="desk-brd__name">{stop.name}</span>
            {/* What the stop is, over what it holds: a line each, so
                "· ~100 kanji" never opens a line of its own. */}
            <span className="desk-brd__desc">
              {stop.desc.split(' · ').map(part => <span key={part}>{part}</span>)}
            </span>
            <PickMark digit={stop.digit} corner />
          </span>
        </button>
      ))}
    </div>
  )
}

export function LevelStep({ volumes, value, onChange, onContinue }) {
  const { t, lang } = useLang()
  const desk = useDesk()
  const stops = ['novice', ...LEVELS].map(level => ({
    key: level,
    code: level === 'novice' ? '—' : level,
    name: level === 'novice' ? t.brdNovice : t.levelName[level],
    desc: level === 'novice' ? t.brdLevelDesc.novice : t.brdLevelDesc[level](kanjiFigure(volumes, level, lang)),
    digit: levelDigit(level),
  }))
  return (
    <>
      <div className="brd__body">
        <BoardQuestion>{t.brdLevelQ}</BoardQuestion>
        <div className="brd__stage">
          {desk
            ? <StationLine stops={stops} value={value} onChange={onChange} label={t.brdLevelQ} attr="data-level" />
            : (
              <div className="brd__opts">
                {stops.map(stop => (
                  <BoardOption
                    key={stop.key}
                    on={value === stop.key}
                    onClick={() => onChange(stop.key)}
                    code={stop.code}
                    label={stop.name}
                    desc={stop.desc}
                    pick={stop.digit}
                    data-level={stop.key}
                  />
                ))}
              </div>
            )}
        </div>
      </div>
      <div className="brd__foot">
        <Continue keys label={t.onbContinue} onClick={onContinue} disabled={!value} data-action="continue" />
      </div>
    </>
  )
}

// `level` is the learner's own choice, not the level the office
// stores: the novice is stored at N5 and has not passed it, so N5 is
// the first stop AHEAD of them. goalStops knows that, and knows the
// one case where the novice's OWN stop is still ahead -- a learner who
// cannot read both scripts yet, whose destination may simply be the
// kana. There is nothing behind such a learner to name, so the hint
// says the line is whole rather than printing a stop they have not
// reached.
export function GoalStep({ volumes, level, kana, value, onChange, onContinue }) {
  const { t, lang } = useLang()
  const desk = useDesk()
  const ahead = goalStops(level, kana)
  const fromStart = ahead[0] === 'novice'
  const from = level === 'novice' ? t.brdNovice : level
  const stops = ahead.map((stop, i) => ({
    key: stop,
    code: stop === 'novice' ? '—' : stop,
    name: stop === 'novice' ? t.brdNovice : t.levelName[stop],
    tag: i === 0 ? t.brdNextStop : null,
    desc: stop === 'novice' ? t.brdLevelDesc.novice : t.brdLevelDesc[stop](kanjiFigure(volumes, stop, lang)),
    digit: levelDigit(stop),
  }))
  return (
    <>
      <div className="brd__body">
        <BoardQuestion hint={fromStart ? t.brdGoalHintStart : t.brdGoalHint(from)}>{t.brdGoalQ}</BoardQuestion>
        <div className="brd__stage">
          {desk
            ? <StationLine stops={stops} value={value} onChange={onChange} label={t.brdGoalQ} attr="data-goal" />
            : (
              <div className="brd__opts">
                {stops.map(stop => (
                  <BoardOption
                    key={stop.key}
                    on={value === stop.key}
                    onClick={() => onChange(stop.key)}
                    code={stop.code}
                    label={stop.name}
                    tag={stop.tag}
                    desc={stop.desc}
                    pick={stop.digit}
                    data-goal={stop.key}
                  />
                ))}
              </div>
            )}
        </div>
      </div>
      <div className="brd__foot">
        <Continue keys label={t.onbContinue} onClick={onContinue} disabled={!value} data-action="continue" />
      </div>
    </>
  )
}
