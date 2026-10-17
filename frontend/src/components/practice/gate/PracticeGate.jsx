import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../../LangContext'
import { useMinute } from '../../../hooks/useMinute'
import { useReducedMotion } from '../../dayclear/useReducedMotion'
import { printHour } from '../../../domain/printHour'
import { stationFor } from '../../../config/stations'
import { LEVELS } from '../../../domain/sentenceSource'
import { GateButton } from '../../ui/GateButton'
import { playBoardFlap, playDoorChime, playDoorSlide, playGateChime, playPantograph, playSpark } from '../../../lib/audio'
import GATE from './gate.json'
import { FOLD_MS, RAISE_MS, TOUCH_MS } from './pantograph'
import { fitScene } from './gateFit'
import { ClockFace, Leaves, Pantograph, Rivets, Spark, Spill } from './GateParts'

// ── 練習の改札 — the painted platform (plan 225) ──────────────────────
// The Practice gate on the phone, as the owner chose it on the canvas
// "Practice gate — five wheels" (board 4, 方向幕 "Le quai peint"): the
// owner's own painting of the platform, a car standing at it with its
// door open, made live. The painting is the scene (the canopy, the
// sky, Fuji, the car, the platform), cut into layers by
// scripts/practice-gate; what changes is drawn over it, where the
// painting has it:
//
//   方向幕  two roll signs on the car's side -- the grade (種別) and
//           where the train goes (行先) -- each rolled by a tap on the
//           row above or below the lit one, with the flaps' clatter;
//           the lit destination opens its station, as a plate's head did
//   LED     under them, paging between what the run asks and where the
//           train goes
//   扉      the door's two leaves, open while the train stands
//   菱      the pantograph, folded on the roof until the train wakes and
//           raises it to the wire, a spark where it touches; a tap on it
//           lowers or raises it
//   時計    the station clock, keeping the time; a tap shows the next hour
//   改札    the gate's gold button: the doors close, the train pulls out,
//           and the run it goes to opens
//   雲      the clouds, lifted off the sky (scripts/practice-gate/
//           clouds.py), drifting slowly behind the sky's own mask, so
//           the canopy, its lamps, the wires and the land stay in front
//
// The band along the cars takes the chosen line's pigment through a
// colour blend over its own mask, so the stripe keeps its paint. The
// next cars (the door-shut painting) pass while the train moves, each
// carrying the same signs. When the learner comes back from the run,
// the train comes in again.
//
// The hour is Today's (domain/printHour, plan 205): 曙 dawn from 5:00,
// the day from 9:00, 落雁 dusk from 16:00, 秋月 night from 19:30, the
// painting lit again for each and its sky Today's.
//
// The scene is 390 × 724 units, one CSS px each inside a zoomed root
// (Today's print's lifted layers are placed the same way): every number
// in this file and in the section of index.css it uses is the canvas's.
// The desk has a painted platform of its own (DeskGate, plan 244).

// The standing car and the next cars' tiles, left to right (the scene's
// units; a car is 340.71 wide). Each next car's signs sit 100.5 in.
const CAR = 24.65
const TILES = [-997.48, -656.77, -316.06, 365.36, 706.07, 1046.78]
const COACH_SIGN = 100.5
const ROLL_MS = 380
const HOURS = ['dawn', 'day', 'dusk', 'night']
// How much the open door lights the platform at each hour.
const SPILL = { dawn: 0.38, day: 0, dusk: 0.55, night: 1 }
// The train's acts, in ms from their start. Woken: it raises its
// pantograph, then opens its doors. Arriving: it glides in on the wire,
// arcing as it brakes, stops, opens. Departing: the gate's chime, the
// door chime, the doors closing, the pull out with its sparks, the
// veil with where it goes, the run.
const WAKE = 900
const ARRIVE = { sparks: [1250, 1650, 2050], stop: 2700 }
const DEPART = { chime: 160, close: 520, pull: 1350, sparks: [0, 280, 650, 1100, 1450], gone: 2900, run: 3350 }
const DOOR_MS = 250

// The lines' keys on the scene: index.css's --pg-ink-*, the washi
// theme's pigments in either theme (the signs are boards under the
// platform's light), and t.practiceHow's.
const KEY = {
  '/practice/reading': 'reading',
  '/practice/comprehension': 'comprehension',
  '/practice/translation': 'translation',
  '/practice/dictation': 'dictation',
  '/practice/composition': 'composition',
  '/practice/exam': 'exam',
  '/practice/conversation': 'conversation',
}
const ink = section => `var(--pg-ink-${KEY[section.path]})`

// What the gate remembers for the visit: the signs as last set, and
// whether the train has just left (so the next visit sees it come in).
const memory = { sel: 0, g: null, back: false }
function remember(sel, g) {
  memory.sel = sel
  memory.g = g
}
function cameBack(back) {
  memory.back = back
}

/** A spark where the head meets the wire, somewhere along its strip. */
function strike(setSpark) {
  setSpark(s => ({ n: s.n + 1, x: 92 + Math.random() * 48 }))
  playSpark()
}

/** Steps from 0 to `i` round a loop of `n`, the short way. */
function around(i, n) {
  let k = ((i % n) + n) % n
  if (k > n / 2) k -= n
  return k
}

const layer = (name, hour) => `/practice/gate/${GATE.rev}/${name}-${hour}.webp`
const asset = name => `url(/practice/gate/${GATE.rev}/${name})`

export default function PracticeGate({ platforms, here, pathFor, onStation }) {
  const { t } = useLang()
  const navigate = useNavigate()
  const still = useReducedMotion()
  const now = useMinute()
  const uid = useId()
  const n = platforms.length

  // ── the hour, and every hour drawn so far, kept for the crossfade ──
  const [picked, setPicked] = useState(null)
  const hour = picked ?? printHour(now)
  const [hours, setHours] = useState([hour])
  if (!hours.includes(hour)) setHours([...hours, hour])

  // ── the frame ──
  const frameRef = useRef(null)
  const [fit, setFit] = useState(null)
  useLayoutEffect(() => {
    const el = frameRef.current
    if (!el) return undefined
    const measure = () => {
      const r = el.getBoundingClientRect()
      setFit(fitScene(r.width, r.height))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── the signs: a platform, a grade (the learner's own until another is rolled) ──
  const [sel, setSel] = useState(() => Math.min(memory.sel, n - 1))
  const [from, setFrom] = useState(sel)
  const [rolledG, setRolledG] = useState(memory.g)
  const g = rolledG ?? Math.max(0, LEVELS.indexOf(here))
  const [rolling, setRolling] = useState(null)
  useEffect(() => {
    if (!rolling) return undefined
    const id = setTimeout(() => setRolling(null), ROLL_MS)
    return () => clearTimeout(id)
  }, [rolling])
  // The LED says what the platform asks, then where the train goes.
  const [led, setLed] = useState(1)
  useEffect(() => {
    const id = setTimeout(() => setLed(on => (on ? 0 : 1)), led ? 7000 : 3200)
    return () => clearTimeout(id)
  }, [led])

  // ── the train: where it is, its door, its pantograph, its act ──
  const [act, setAct] = useState(() => (still ? null : memory.back ? { kind: 'arrive' } : { kind: 'wake' }))
  const [phase, setPhase] = useState(() => (act?.kind === 'arrive' ? 'away' : 'standing'))
  const [door, setDoor] = useState(still)
  const [pan, setPan] = useState(() => (still || act?.kind === 'arrive' ? 'raised' : 'down'))
  const [spark, setSpark] = useState({ n: 0, x: 115 })

  useEffect(() => {
    if (!act) return undefined
    const ids = []
    const at = (ms, fn) => ids.push(setTimeout(fn, ms))
    const spark = () => strike(setSpark)
    // 菱 — up to the wire: air, the arms unfolding, a spark as it touches.
    const raise = start => {
      at(start, () => { setPan('raising'); playPantograph() })
      at(start + TOUCH_MS, spark)
      at(start + RAISE_MS + 10, () => setPan('raised'))
      return start + RAISE_MS + 10
    }
    const done = ms => at(ms, () => setAct(null))
    if (act.kind === 'wake') {
      const up = raise(WAKE)
      at(up + DOOR_MS, () => setDoor(true))
      done(up + DOOR_MS)
    } else if (act.kind === 'raise') {
      done(raise(0))
    } else if (act.kind === 'lower') {
      at(FOLD_MS + 20, () => setPan('down'))
      done(FOLD_MS + 20)
    } else if (act.kind === 'arrive') {
      // Two frames on, so the train is drawn away before it glides in.
      let frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => setPhase('arriving'))
      })
      ARRIVE.sparks.forEach(ms => at(ms, spark))
      at(ARRIVE.stop, () => { setPhase('standing'); cameBack(false) })
      at(ARRIVE.stop + DOOR_MS, () => setDoor(true))
      done(ARRIVE.stop + DOOR_MS)
      return () => { ids.forEach(clearTimeout); cancelAnimationFrame(frame) }
    } else if (act.kind === 'depart') {
      const go = () => {
        ids.forEach(clearTimeout)
        cameBack(true)
        navigate(act.to)
      }
      // A tap or a key on the way out goes straight to the run.
      const t0 = act.raise ? raise(0) : 0
      at(t0, () => {
        playGateChime()
        setPhase('closing')
        window.addEventListener('pointerdown', go)
        window.addEventListener('keydown', go)
      })
      at(t0 + DEPART.chime, playDoorChime)
      at(t0 + DEPART.close, () => { setDoor(false); playDoorSlide() })
      at(t0 + DEPART.pull, () => setPhase('leaving'))
      DEPART.sparks.forEach(ms => at(t0 + DEPART.pull + ms, spark))
      at(t0 + DEPART.gone, () => setPhase('gone'))
      at(t0 + DEPART.run, go)
      return () => {
        ids.forEach(clearTimeout)
        window.removeEventListener('pointerdown', go)
        window.removeEventListener('keydown', go)
      }
    }
    return () => ids.forEach(clearTimeout)
  }, [act, navigate])

  // ── 改札 — the gold button ──
  const section = platforms[sel]
  const level = LEVELS[g]
  const depart = () => {
    if (act || phase !== 'standing') return
    const to = pathFor(section, level)
    if (!to) return
    remember(sel, g)
    if (still) { navigate(to); return }
    setAct({ kind: 'depart', to, raise: pan === 'down' })
  }
  const togglePan = () => {
    if (act || phase !== 'standing' || still) return
    if (pan === 'raised') {
      // Down off the wire: it draws a little arc as it lets go.
      strike(setSpark)
      playPantograph()
      setPan('lowering')
      setAct({ kind: 'lower' })
    } else if (pan === 'down') setAct({ kind: 'raise' })
  }

  // ── the rolls ──
  const busy = act?.kind === 'depart'
  const pickDest = i => {
    if (busy) return
    if (around(i - sel, n) === 0) { onStation(section); return }
    playBoardFlap()
    setRolling({ key: 'dest', at: i })
    setFrom(sel)
    setSel(i)
  }
  const pickGrade = k => {
    if (busy || k === g || k < 0 || k >= LEVELS.length) return
    playBoardFlap()
    setRolling({ key: 'grade', at: k })
    setRolledG(k)
  }
  const destRows = useRef([])
  const gradeRows = useRef([])
  const walk = (e, length, current, pick, rows) => {
    const step = { ArrowUp: -1, ArrowDown: 1 }[e.key]
    if (!step) return
    e.preventDefault()
    const next = length === n ? (current + step + n) % n : current + step
    if (next < 0 || next >= length) return
    pick(next)
    rows.current[next]?.focus()
  }

  const howId = `${uid}-how`
  const leaf = GATE.leaf[hour]
  const d = around(sel - from, n)
  const sceneVars = {
    '--pg-line': ink(section),
    '--pg-car2': `url(${layer('car2', hour)})`,
    '--pg-band-a': asset('band-car.png'),
    '--pg-band-b': asset('band-car2.png'),
    '--pg-fill-top': GATE.fill[hour].top,
    '--pg-fill-side': GATE.fill[hour].side,
    '--pg-sky': asset('sky.png'),
    '--pg-sky-top': GATE.sky.top,
    '--pg-sky-h': GATE.sky.height,
  }
  // Until the frame is measured the scene stands at its own size.
  const placed = fit ?? { u: 1, x: 0, y: 0 }
  const placeVars = { '--pg-u': placed.u, '--pg-x': placed.x, '--pg-y': placed.y }
  const signs = [-1, 0, 1].map(k => ({ grade: LEVELS[g + k] ?? null, dest: platforms[(sel + k + n) % n] }))
  const rollingKey = rolling?.key

  return (
    <div className={`pgate pgate--${hour}`} style={sceneVars} data-phase={phase}>
      <div className="pgate__frame" ref={frameRef}>
        {placed.x > 0 && <><i className="pgate__wing pgate__wing--l" /><i className="pgate__wing pgate__wing--r" /></>}
        <div className="pgate__stage" style={placeVars}>
          <div className="pgate__scene">
            <div className="pgate__layers" aria-hidden="true">
              {hours.map(h => <img key={h} className={`pgate__layer${h === hour ? ' is-on' : ''}`} src={layer('bg', h)} alt="" draggable="false" />)}
            </div>
            <div className="pgate__sky" aria-hidden="true">
              <div className="pgate__layers pgate__clouds">
                {hours.map(h => <img key={h} className={`pgate__layer${h === hour ? ' is-on' : ''}`} src={layer('clouds', h)} alt="" draggable="false" />)}
              </div>
            </div>

            <div className={`pgate__train pgate__train--${phase}`}>
              {TILES.slice(0, 3).map(x => <i key={x} className="pgate-c2" style={{ left: x }} aria-hidden="true" />)}
              <div className="pgate__layers pgate__car" aria-hidden="true">
                {hours.map(h => <img key={h} className={`pgate__layer${h === hour ? ' is-on' : ''}`} src={layer('car', h)} alt="" draggable="false" />)}
              </div>
              {TILES.slice(3).map(x => <i key={x} className="pgate-c2" style={{ left: x }} aria-hidden="true" />)}
              {TILES.slice(0, 3).map(x => <i key={x} className="pgate-band pgate-band--b" style={{ left: x }} aria-hidden="true" />)}
              <i className="pgate-band pgate-band--a" style={{ left: CAR }} aria-hidden="true" />
              {TILES.slice(3).map(x => <i key={x} className="pgate-band pgate-band--b" style={{ left: x }} aria-hidden="true" />)}
              <span className="pgate-spill-at" style={{ opacity: door && phase === 'standing' ? SPILL[hour] : 0 }}><Spill /></span>

              {TILES.map(x => <CoachSign key={x} x={x + COACH_SIGN} signs={signs} section={section} level={level} here={here} />)}

              <Pantograph state={pan} bob={phase === 'leaving' && pan === 'raised'} />
              {spark.n > 0 && <Spark key={spark.n} x={spark.x} />}
              <button type="button" className="pgate-panto__tap" onClick={togglePan}
                aria-label={pan === 'raised' ? t.practiceGatePantoLower : t.practiceGatePantoRaise} />

              <Leaves open={door} leaf={leaf} />

              <div className="pgate-sign pgate-sign--main">
                <Rivets w={215} h={183} />
                <div className="pgate-roll pgate-roll--grade" role="group" aria-label={t.practiceGateGrade}
                  data-guide="practice.grade" onKeyDown={e => walk(e, LEVELS.length, g, pickGrade, gradeRows)}>
                  <div className={`pgate-roll__drum${rollingKey === 'grade' ? ' pgate-roll__drum--rolling' : ''}`}>
                    {LEVELS.map((label, k) => {
                      const at = k - g
                      return (
                        <button key={label} type="button" ref={el => { gradeRows.current[k] = el }}
                          className="pgate-roll__row pgate-roll__row--grade" style={{ '--k': at }}
                          tabIndex={at === 0 ? 0 : -1} aria-hidden={Math.abs(at) <= 1 ? undefined : true}
                          aria-current={at === 0 ? 'true' : undefined} onClick={() => pickGrade(k)}>
                          {label}
                          {label === here && <i className="pgate-roll__here" aria-hidden="true" />}
                        </button>
                      )
                    })}
                  </div>
                  <RollShade />
                </div>
                <div className="pgate-roll pgate-roll--dest" role="group" aria-label={t.practiceGateDest}
                  data-guide="practice.sign" onKeyDown={e => walk(e, n, sel, pickDest, destRows)}>
                  <div className={`pgate-roll__drum${rollingKey === 'dest' ? ' pgate-roll__drum--rolling' : ''}`}>
                    {platforms.map((p, i) => {
                      const k = around(i - sel, n)
                      // A row that would wrap round the drum jumps rather than rolling across it.
                      const moves = around(i - from, n) - d === k
                      return (
                        <button key={p.path} type="button" ref={el => { destRows.current[i] = el }}
                          className={`pgate-roll__row pgate-roll__row--dest${moves ? '' : ' pgate-roll__row--jump'}${Math.abs(k) <= 2 ? '' : ' pgate-roll__row--off'}`}
                          style={{ '--k': k, '--pg-row': ink(p) }}
                          tabIndex={k === 0 ? 0 : -1} aria-hidden={Math.abs(k) <= 1 ? undefined : true}
                          aria-current={k === 0 ? 'true' : undefined}
                          aria-label={k === 0 ? t.practiceGateStation(p.title) : p.title}
                          onClick={() => pickDest(i)}>
                          <DestRow section={p} name={t.practiceGateShort[KEY[p.path]]} />
                        </button>
                      )
                    })}
                  </div>
                  <RollShade />
                </div>
                <div className="pgate-led" aria-hidden="true">
                  <p className={`pgate-led__page${led ? '' : ' is-on'}`}>
                    <LedLine section={section} level={level} />
                  </p>
                  <p className={`pgate-led__page pgate-led__page--how${led ? ' is-on' : ''}`} id={howId}>
                    {t.practiceHow[KEY[section.path]]}
                  </p>
                </div>
              </div>
            </div>

            <div className="pgate__layers pgate__near" aria-hidden="true">
              {hours.map(h => <img key={h} className={`pgate__layer${h === hour ? ' is-on' : ''}`} src={layer('near', h)} alt="" draggable="false" />)}
            </div>

            <button type="button" className="pgate-clock" onClick={() => setPicked(HOURS[(HOURS.indexOf(hour) + 1) % HOURS.length])}
              aria-label={t.practiceGateClock(t.practiceGateHour[hour])}>
              <span className="pgate-clock__dial" />
              <ClockFace />
            </button>

            <GateButton
              label={t.depart}
              className="pgate__go"
              compact
              onClick={depart}
              aria-label={t.practiceGateBoard(section.title, level)}
              aria-describedby={howId}
              data-guide="practice.board"
            />

            <div className={`pgate-veil${phase === 'gone' ? ' is-on' : ''}`} aria-hidden={phase === 'gone' ? undefined : true}>
              <span className="pgate-veil__jp" lang="ja">{section.icon}</span>
              <span className="pgate-veil__name">{section.title}</span>
              <span className="pgate-veil__grade">{level}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** The two dimmed rows of a roll sign, its arrows and its glass. */
function RollShade() {
  return (
    <>
      <i className="pgate-roll__dim pgate-roll__dim--up" aria-hidden="true" />
      <i className="pgate-roll__dim pgate-roll__dim--down" aria-hidden="true" />
      <i className="pgate-roll__arrow pgate-roll__arrow--up" aria-hidden="true" />
      <i className="pgate-roll__arrow pgate-roll__arrow--down" aria-hidden="true" />
      <i className="pgate-roll__glass" aria-hidden="true" />
    </>
  )
}

/** A destination's row: the line's roundel, its name in Japanese and,
    under it, in the learner's language. */
function DestRow({ section, name }) {
  return (
    <>
      <span className="pgate-roll__code" aria-hidden="true">{stationFor(section.path).code}</span>
      <span className="pgate-roll__names" aria-hidden="true">
        <span className="pgate-roll__jp" lang="ja">{section.icon}</span>
        <span className="pgate-roll__name">{name}</span>
      </span>
    </>
  )
}

/** The LED's line: where the train goes (〜ゆき) and its grade, the
    destination's full name under it. */
function LedLine({ section, level }) {
  return (
    <>
      <span className="pgate-led__jp" lang="ja">
        {section.icon}<small>ゆき</small><span className="pgate-led__grade">{level}</span>
      </span>
      <span className="pgate-led__full">{section.title}</span>
    </>
  )
}

/** The next cars carry the same signs, still. */
function CoachSign({ x, signs, section, level, here }) {
  const { t } = useLang()
  return (
    <div className="pgate-sign pgate-sign--coach" style={{ left: x }} aria-hidden="true">
      <Rivets w={218} h={183} />
      <div className="pgate-roll pgate-roll--grade">
        {signs.map(({ grade }, i) => (
          <span key={i} className="pgate-roll__row pgate-roll__row--grade" style={{ '--k': i - 1 }}>
            {grade}
            {grade && grade === here && <i className="pgate-roll__here" />}
          </span>
        ))}
        <RollShade />
      </div>
      <div className="pgate-roll pgate-roll--dest">
        {signs.map(({ dest }, i) => (
          <span key={i} className="pgate-roll__row pgate-roll__row--dest" style={{ '--k': i - 1, '--pg-row': ink(dest) }}>
            <DestRow section={dest} name={t.practiceGateShort[KEY[dest.path]]} />
          </span>
        ))}
        <RollShade />
      </div>
      <div className="pgate-led">
        <p className="pgate-led__page is-on"><LedLine section={section} level={level} /></p>
      </div>
    </div>
  )
}
