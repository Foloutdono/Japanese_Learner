import { useLang } from '../../LangContext'
import { LEVELS, approx, goalStops, kanjiThrough } from '../../domain/boarding'
import { BoardQuestion, Continue } from './BoardFrame'
import { BoardOption, PickMark } from './BoardOption'
import { useDesk } from '../../hooks/useDesk'
import { useBoxSize } from '../../hooks/useBoxWidth'

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

// ── 辻 — the stops as a climbing line (plans 140, 163) ──────────
// The owner's D04 on the desk: the line itself, climbing a step a
// level from the question's hub at its foot -- the novice's stop, then
// N5 up to N1 -- each stop a ring on its platform with its name and
// what it holds under it, and the line going on past N1. The level
// list inks the line up to the pick, the stops behind it filled ("the
// stops behind you will be marked known"), and hangs "You are here" over
// the pick. The goal list draws the same line: the stops behind the
// learner inked and no longer answers, the ride from where they stand
// to the pick in the pass's gold, and the arrival's month over the pick.
// Every answer keeps its contract: its data attribute, aria-pressed, and
// its digit -- in its ring's corner, the slot a station's key is read
// from (plan 155).
//
// The drawing is the box's own: measured (useBoxSize), the stops spread
// across its width and the climbs as steep as its height lets them, up
// to the drawing's 45 degrees -- so every name has its pitch to itself.
const LINE = ['novice', ...LEVELS]
const HUB = 40      // the hub's radius (the roads' hub, 80px)
const RING = 32     // a stop's ring's radius
const OVER = 112    // over a ring's centre: its half, the tie and the callout
const UNDER = 140   // under the lowest ring's centre: its half, a rung, a name, a tag, two lines
const TAIL = 88     // past the last ring's centre: its name's room
const RISE = 70     // a climb at its steepest, the drawing's 45 degrees
const ROOMY = 170   // a pitch that holds the widest name at the title's size

function climbGeometry(width, height) {
  const count = LINE.length
  const pitch = (width - HUB - TAIL) / count
  const climbs = count - 1
  const rise = Math.max(0, Math.min(RISE, (height - OVER - UNDER) / climbs))
  const top = OVER + Math.max(0, height - OVER - UNDER - climbs * rise) / 2
  const x = LINE.map((_, k) => HUB + (k + 1) * pitch)
  const y = LINE.map((_, k) => top + (count - 1 - k) * rise)
  const hub = [HUB, y[0] + rise]
  // A platform per stop, centred on its ring, and a climb between: the
  // climb's run is its rise, so the line climbs at 45 degrees.
  const half = Math.max(0, (pitch - rise) / 2)
  const points = [hub, [hub[0] + half, hub[1]]]
  LINE.forEach((_, k) => points.push([x[k] - half, y[k]], [x[k] + half, y[k]]))
  points[points.length - 1] = [width, y[count - 1]]
  return { pitch, x, y, hub, points, width }
}

// The line cut at a stop's centre -- `-1` is the hub, where it starts.
const centreOf = (g, k) => (k < 0 ? g.hub : [g.x[k], g.y[k]])
const upTo = (g, k) => [...g.points.slice(0, 2 * k + 3), centreOf(g, k)]
const across = (g, a, b) => [centreOf(g, a), ...g.points.slice(2 * a + 3, 2 * b + 3), centreOf(g, b)]
const pathOf = pts => pts.map(([px, py], i) => `${i ? 'L' : 'M'}${Math.round(px)} ${Math.round(py)}`).join('')

//   stops   the six, in line order: { key, code, name, desc, digit, tag }
//   answers the keys that are answers here (the goal's: the stops ahead)
//   at      the stop the learner stands at, on the goal (-1: the hub,
//           short of the novice's own stop); null on the level list
//   call    what hangs over the pick: { cap, fig }
function ClimbLine({ stops, answers, at = null, value, onChange, label, attr, call, no }) {
  const [boxRef, size] = useBoxSize(true)
  const pick = stops.findIndex(stop => stop.key === value)
  const g = size ? climbGeometry(size.width, size.height) : null
  const last = stops.length - 1
  const stand = at ?? -1
  // Inked as known: up to the pick on the level list, up to where the
  // learner stands on the goal's.
  const known = at == null ? pick : at
  return (
    <div
      ref={boxRef}
      // On a pitch too short for the widest name at the title's size
      // (a laptop's), the names step down a rung rather than meet.
      className={`desk-brd__climb${g && g.pitch < ROOMY ? ' desk-brd__climb--tight' : ''}`}
      role="group"
      aria-label={label}
    >
      {g && (
        <>
          <svg className="desk-brd__rails" viewBox={`0 0 ${size.width} ${size.height}`} aria-hidden="true">
            <path className="desk-brd__rail" d={pathOf(g.points)} />
            {known >= 0 && <path className="desk-brd__rail desk-brd__rail--known" d={pathOf(upTo(g, known))} />}
            {at != null && pick > stand && (
              <path className="desk-brd__rail desk-brd__rail--ride" d={pathOf(stand < 0 ? upTo(g, pick) : across(g, stand, pick))} />
            )}
          </svg>
          <span className="desk-brd__hub desk-brd__hub--at" style={{ '--x': g.hub[0], '--y': g.hub[1] }} aria-hidden="true">{no}</span>
          {stops.map((stop, k) => {
            const answer = answers.includes(stop.key)
            const state = k === pick ? 'on'
              : at == null ? (pick >= 0 && k < pick ? 'known' : null)
                : k <= at ? 'known'
                  : k < pick ? 'ride' : null
            const Tag = answer ? 'button' : 'span'
            const own = answer
              ? {
                  type: 'button',
                  'aria-pressed': k === pick,
                  'aria-keyshortcuts': String(stop.digit),
                  onClick: () => onChange(stop.key),
                  [attr]: stop.key,
                }
              : {}
            return (
              <Tag
                key={stop.key}
                className={`desk-brd__stop${state ? ` desk-brd__stop--${state}` : ''}`}
                // Plain numbers, placed by the sheet: the ring's centre
                // and the name's room, the stop's pitch (the last one's
                // to the paper's edge).
                style={{ '--x': g.x[k], '--y': g.y[k], '--w': k < last ? g.pitch : g.width - g.x[k] + RING }}
                {...own}
              >
                <span className={`desk-brd__stop-ring${stop.key === 'novice' ? ' desk-brd__stop-ring--jp' : ''}`} lang={stop.key === 'novice' ? 'ja' : undefined}>
                  {stop.code}
                  {answer && <PickMark digit={stop.digit} corner />}
                </span>
                <span className="desk-brd__stop-lab">
                  <span className="desk-brd__stop-name">{stop.name}</span>
                  {stop.tag && <span className="brd-tag">{stop.tag}</span>}
                  <span className="desk-brd__stop-desc">
                    {stop.desc.split(' · ').map(part => <span key={part}>{part}</span>)}
                  </span>
                </span>
              </Tag>
            )
          })}
          {pick >= 0 && call && (
            <p key={value} className="desk-brd__call" style={{ '--x': g.x[pick], '--y': g.y[pick] }} aria-live="polite">
              <span className="desk-brd__call-cap">{call.cap}</span>
              <span className="desk-brd__call-fig">{call.fig}</span>
            </p>
          )}
        </>
      )}
    </div>
  )
}

// A stop as the lists name it; the novice's is the kana's own sign on
// the desk's line, where the row's dash would sit in a ring.
function stopOf(t, lang, volumes, level, desk) {
  return {
    key: level,
    code: level === 'novice' ? (desk ? 'あ' : '—') : level,
    name: level === 'novice' ? t.brdNovice : t.levelName[level],
    desc: level === 'novice' ? t.brdLevelDesc.novice : t.brdLevelDesc[level](kanjiFigure(volumes, level, lang)),
    digit: levelDigit(level),
  }
}

// `no` is the desk's: the question's place on the strip, for its hub.
export function LevelStep({ volumes, value, onChange, onContinue, no = null }) {
  const { t, lang } = useLang()
  const desk = useDesk()
  const stops = LINE.map(level => stopOf(t, lang, volumes, level, desk))
  return (
    <>
      <div className="brd__body">
        <BoardQuestion hint={desk ? t.brdLevelHint : null}>{t.brdLevelQ}</BoardQuestion>
        <div className="brd__stage">
          {desk
            ? (
              <ClimbLine
                stops={stops}
                answers={LINE}
                value={value}
                onChange={onChange}
                label={t.brdLevelQ}
                attr="data-level"
                call={{ cap: t.levelCurrentMark, fig: value === 'novice' ? t.brdNovice : value }}
                no={no}
              />
            )
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
//
// On the desk the goal is drawn on the whole line (ClimbLine): `arrival`
// is the month the pick is reached in at the ride's pace, hung over it,
// or null until the volumes that price it have answered.
export function GoalStep({ volumes, level, kana, value, onChange, onContinue, arrival = null, no = null }) {
  const { t, lang } = useLang()
  const desk = useDesk()
  const ahead = goalStops(level, kana)
  const fromStart = ahead[0] === 'novice'
  const from = level === 'novice' ? t.brdNovice : level
  const tagged = stop => ({ ...stopOf(t, lang, volumes, stop, desk), tag: stop === ahead[0] ? t.brdNextStop : null })
  const stops = ahead.map(tagged)
  return (
    <>
      <div className="brd__body">
        <BoardQuestion hint={fromStart ? t.brdGoalHintStart : t.brdGoalHint(from)}>{t.brdGoalQ}</BoardQuestion>
        <div className="brd__stage">
          {desk
            ? (
              <ClimbLine
                stops={LINE.map(tagged)}
                answers={ahead}
                // Where the learner stands: the stop before the first
                // one ahead -- the hub, for one short of the kana.
                at={LINE.indexOf(ahead[0]) - 1}
                value={value}
                onChange={onChange}
                label={t.brdGoalQ}
                attr="data-goal"
                call={{ cap: t.statusArrival, fig: arrival ?? (value === 'novice' ? t.brdNovice : value) }}
                no={no}
              />
            )
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
