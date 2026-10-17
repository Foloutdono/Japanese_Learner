import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../../LangContext'
import { useMinute } from '../../../hooks/useMinute'
import { radioTab, useRadioWalk } from '../../../hooks/useRadioWalk'
import { useBoxSize } from '../../../hooks/useBoxWidth'
import { useReducedMotion } from '../../dayclear/useReducedMotion'
import { printHour } from '../../../domain/printHour'
import { stationFor } from '../../../config/stations'
import { LEVELS } from '../../../domain/sentenceSource'
import { usePracticeRecord } from '../../../stores/practiceRecord'
import { useStationSamples } from '../../../stores/stationSamples'
import { playBoardFlap, playDoorChime, playDoorSlide, playGateChime } from '../../../lib/audio'
import { GateButton } from '../../ui/GateButton'
import { EnterKey } from '../../chrome/DeskKeys'
import { Seg } from '../../chrome/Console'
import { PracticeSpecimen } from '../PracticeSpecimen'
import { ClockFace, Spill } from './GateParts'
import DESK from './desk.json'
import { fitDesk, SCENE } from './deskFit'

// ── 練習の改札、机 — the painted platform on the desk (plan 243) ──────
// The owner's pick B of the canvas "Tsuji — Practice on the desk" (the
// platform painted wide, one board hung beside the car), and the
// painting of it the owner made (scripts/practice-gate/source/desk.webp),
// with a level selector on the board. It replaces the six plates (plan
// 165) and brings 会話 back to the desk's gate: seven trains, as on the
// phone.
//
//   the platform  the painting as wide as the window and the window's
//                 height (deskFit.js), lit at Today's hour (曙, the day,
//                 落雁, 秋月) by scripts/practice-gate/desk.py; the car
//                 standing at it with its door open, its stripe in the
//                 chosen train's pigment (a colour blend over the
//                 stripe's own mask, as on the phone); the station clock
//                 drawn over the painted one (a tap shows the next hour)
//   the board     at the right, over the painting, as Today's column
//                 stands beside its dial: the levels as a band at its
//                 head (the learner's own marked), the seven trains with
//                 the learner's record at that level, then the chosen
//                 train's card at that level -- what the run asks, its
//                 first exercise in a well, and the way into its station
//   改札          the gate button on the platform, under the stage's
//                 middle: the doors close, the train pulls out, a veil
//                 says where it went, and the run opens (a tap skips to
//                 it). Enter presses it. Coming back, the train comes in.
//
// What the phone's painted gate draws on its car -- the roll signs, the
// LED, the pantograph rising to the wire -- the board says on the desk,
// which has the room the car's side did not: a sign is a word to read
// on a phone, and on a computer the list beside it reads better.

const KEY = {
  '/practice/reading': 'reading',
  '/practice/comprehension': 'comprehension',
  '/practice/translation': 'translation',
  '/practice/dictation': 'dictation',
  '/practice/composition': 'composition',
  '/practice/exam': 'exam',
  '/practice/conversation': 'conversation',
}
// What a platform's record counts (its station's figures), and the
// caption over its card.
const UNIT = {
  reading: 'sentences', translation: 'sentences', dictation: 'sentences', composition: 'sentences',
  comprehension: 'texts', exam: 'papers', conversation: 'replies',
}
const TAG = {
  reading: 'sentence', translation: 'sentence', comprehension: 'text', dictation: 'clip',
  composition: 'point', exam: 'paper', conversation: 'scene',
}
const HOURS = ['dawn', 'day', 'dusk', 'night']
// How much the open door lights the platform at each hour.
const SPILL = { dawn: 0.38, day: 0, dusk: 0.55, night: 1 }
// The train's acts, in ms from their start: the phone's (PracticeGate),
// less the pantograph, which the desk's painting carries folded.
const WAKE = 600
const ARRIVE = 2700
const DEPART = { chime: 160, close: 520, pull: 1350, gone: 2900, run: 3350 }
const DOOR_MS = 250
// The card's room, measured, since the board's height is the window's:
// the line saying what the run asks is drawn on a card at least HOW_MIN
// tall (it is the gate button's description either way), the well draws
// its full face in at least FACE_MIN and its caption over it from
// TAG_MIN, as the owner's picture has them; under FACE_MIN, plan 165's
// compact face.
const HOW_MIN = 400
const FACE_MIN = 230
const TAG_MIN = 260
// The clock face (GateParts' ClockFace) is drawn on a 44.96 dial.
const DIAL = 44.96
// The door's light (GateParts' Spill) spreads from an 80-unit doorway at
// (40, 4) of its 160 × 110 drawing.
const SPILL_DOOR = { x: 40, y: 4, w: 80 }

const ink = section => `var(--pg-ink-${KEY[section.path]})`
const layer = (name, hour) => `/practice/gate/desk/${DESK.rev}/${name}-${hour}.webp`
const asset = name => `url(/practice/gate/desk/${DESK.rev}/${name})`
const pctOf = rec => (rec?.of > 0 ? Math.round((rec.right / rec.of) * 100) : null)

// What the gate remembers for the visit: the train and the level as
// last chosen, and whether the train has just left (so the next visit
// sees it come in). Written through these two, as the phone's is.
const memory = { sel: 0, level: null, back: false }
function remember(choice) {
  Object.assign(memory, choice)
}
function cameBack(back) {
  memory.back = back
}

export default function DeskGate({ platforms, here, pathFor, onStation }) {
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

  // ── the train and the level the board has chosen ──
  const [sel, setSel] = useState(() => Math.min(memory.sel, n - 1))
  const [chosen, setChosen] = useState(memory.level)
  const own = LEVELS.includes(here) ? here : null
  const level = chosen ?? own ?? LEVELS[0]
  const section = platforms[sel]
  const key = KEY[section.path]

  // ── the frame and the board, measured: the painting is the frame's,
  //    and the stage is what the board leaves of it ──
  const rootRef = useRef(null)
  const boardRef = useRef(null)
  const [fit, setFit] = useState(null)
  useLayoutEffect(() => {
    const root = rootRef.current
    const board = boardRef.current
    if (!root || !board) return undefined
    const measure = () => {
      const r = root.getBoundingClientRect()
      const stage = Math.max(0, board.getBoundingClientRect().left - r.left)
      setFit({ ...fitDesk(r.width, r.height, stage), stage })
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(measure)
    ro.observe(root)
    ro.observe(board)
    return () => ro.disconnect()
  }, [])

  // ── the train: where it is, its door, its act ──
  const [act, setAct] = useState(() => (still ? null : memory.back ? { kind: 'arrive' } : { kind: 'wake' }))
  const [phase, setPhase] = useState(() => (act?.kind === 'arrive' ? 'away' : 'standing'))
  const [door, setDoor] = useState(still)

  useEffect(() => {
    if (!act) return undefined
    const ids = []
    const at = (ms, fn) => ids.push(setTimeout(fn, ms))
    const done = ms => at(ms, () => setAct(null))
    if (act.kind === 'wake') {
      at(WAKE, () => setDoor(true))
      done(WAKE + DOOR_MS)
    } else if (act.kind === 'arrive') {
      // Two frames on, so the train is drawn away before it glides in.
      let frame = requestAnimationFrame(() => {
        frame = requestAnimationFrame(() => setPhase('arriving'))
      })
      at(ARRIVE, () => { setPhase('standing'); cameBack(false) })
      at(ARRIVE + DOOR_MS, () => setDoor(true))
      done(ARRIVE + DOOR_MS)
      return () => { ids.forEach(clearTimeout); cancelAnimationFrame(frame) }
    } else if (act.kind === 'depart') {
      const go = () => {
        ids.forEach(clearTimeout)
        cameBack(true)
        navigate(act.to)
      }
      // A tap or a key on the way out goes straight to the run.
      at(0, () => {
        playGateChime()
        setPhase('closing')
        window.addEventListener('pointerdown', go)
        window.addEventListener('keydown', go)
      })
      at(DEPART.chime, playDoorChime)
      at(DEPART.close, () => { setDoor(false); playDoorSlide() })
      at(DEPART.pull, () => setPhase('leaving'))
      at(DEPART.gone, () => setPhase('gone'))
      at(DEPART.run, go)
      return () => {
        ids.forEach(clearTimeout)
        window.removeEventListener('pointerdown', go)
        window.removeEventListener('keydown', go)
      }
    }
    return () => ids.forEach(clearTimeout)
  }, [act, navigate])

  // ── 改札 — the gold button ──
  const busy = act?.kind === 'depart'
  const depart = useCallback(() => {
    if (act || phase !== 'standing') return
    const to = pathFor(section, level)
    if (!to) return
    if (still) { navigate(to); return }
    setAct({ kind: 'depart', to })
  }, [act, phase, pathFor, section, level, still, navigate])

  // ── the board's two choices ──
  const pick = i => {
    if (busy || i === sel) return
    playBoardFlap()
    setSel(i)
    remember({ sel: i })
  }
  const pickLevel = l => {
    if (busy) return
    playBoardFlap()
    setChosen(l)
    remember({ level: l })
  }
  const onWalk = useRadioWalk(true)
  const onDeparture = e => {
    // Enter on a train is its departure, as Enter anywhere on the gate
    // (EnterKey's, which a focused row would otherwise keep from it).
    if (e.key === 'Enter' && !e.repeat) {
      e.preventDefault()
      e.stopPropagation()
      depart()
      return
    }
    onWalk?.(e)
  }

  const records = usePracticeRecord().data
  const recordLine = (k, rec) => {
    if (records === undefined) return null
    if (!rec) return t.practiceNotYet
    const pct = pctOf(rec)
    return [t.practiceDone[UNIT[k]](rec.done), pct == null ? null : t.practiceRight(pct)].filter(Boolean).join(' · ')
  }

  const placed = fit ?? { u: 1, x: 0, y: 0, stage: 0 }
  const howId = `${uid}-how`
  const { door: D, clock: C } = DESK
  // The scene's measures go in unitless, in its units (index.css makes
  // them px inside the zoomed scene).
  const vars = {
    '--pg-line': ink(section),
    '--pd-w': SCENE.w,
    '--pd-h': SCENE.h,
    '--pd-car-top': DESK.car.top,
    '--pd-car-h': DESK.car.h,
    '--pd-door-x': D.x,
    '--pd-door-y': D.y,
    '--pd-door-w': D.w,
    '--pd-door-h': D.h,
    '--pd-car2': `url(${layer('car2', hour)})`,
    '--pd-band-a': asset('band-car.png'),
    '--pd-band-b': asset('band-car2.png'),
    '--pd-band-l': asset('band-leaf-l.png'),
    '--pd-band-r': asset('band-leaf-r.png'),
    '--pd-fill': DESK.fill[hour].top,
    '--pd-stage': placed.stage,
  }
  const spillZoom = D.w / SPILL_DOOR.w

  return (
    <div className={`pgate pgate--${hour} pdesk`} style={vars} data-phase={phase} ref={rootRef}>
      <div className="pdesk__frame">
        <div className="pdesk__stage" style={{ '--pd-u': placed.u, '--pd-x': placed.x, '--pd-y': placed.y }}>
          <div className="pdesk__scene">
            <Layers name="bg" hours={hours} hour={hour} />
            <div className={`pdesk__train pdesk__train--${phase}`} aria-hidden="true">
              <i className="pdesk-car2" style={{ left: -SCENE.w }} />
              <i className="pdesk-band pdesk-band--b" style={{ left: -SCENE.w }} />
              <Layers name="car" hours={hours} hour={hour} className="pdesk__car" />
              <i className="pdesk-band pdesk-band--a" />
              <i className="pdesk-car2" style={{ left: SCENE.w }} />
              <i className="pdesk-band pdesk-band--b" style={{ left: SCENE.w }} />
              <span className="pdesk-spill-at" style={{
                left: D.x - SPILL_DOOR.x * spillZoom,
                top: D.y + D.h - SPILL_DOOR.y * spillZoom,
                opacity: door && phase === 'standing' ? SPILL[hour] : 0,
              }}>
                <span className="pdesk-spill" style={{ zoom: spillZoom }}><Spill /></span>
              </span>
              <span className={`pdesk-door${door ? ' pdesk-door--open' : ''}`}>
                <span className="pdesk-leaf pdesk-leaf--l">
                  <img src={layer('leaf-l', hour)} alt="" draggable="false" />
                  <i className="pdesk-leaf__band pdesk-leaf__band--l" />
                </span>
                <span className="pdesk-leaf pdesk-leaf--r">
                  <img src={layer('leaf-r', hour)} alt="" draggable="false" />
                  <i className="pdesk-leaf__band pdesk-leaf__band--r" />
                </span>
              </span>
            </div>
            <Layers name="near" hours={hours} hour={hour} />
            <span className="pdesk-clock" style={{ left: C.cx - C.r, top: C.cy - C.r }}>
              <span style={{ zoom: (2 * C.r) / DIAL }}>
                <button type="button" className="pgate-clock" onClick={() => setPicked(HOURS[(HOURS.indexOf(hour) + 1) % HOURS.length])}
                  aria-label={t.practiceGateClockDesk(t.practiceGateHour[hour])}>
                  <span className="pgate-clock__dial" />
                  <ClockFace />
                </button>
              </span>
            </span>
          </div>
        </div>
      </div>

      <div className="pdesk__go">
        <GateButton
          label={t.depart}
          keys
          onClick={depart}
          aria-label={t.practiceGateBoard(section.title, level)}
          aria-describedby={howId}
          data-guide="practice.board"
        />
      </div>
      <EnterKey onEnter={depart} disabled={busy} />

      <div className="pdesk__board" ref={boardRef}>
        <div className="pdesk-panel pdesk-deps">
          <div data-guide="practice.grade">
            <Seg
              full
              className="pdesk-levels"
              label={t.practiceGateGrade}
              value={level}
              onChange={pickLevel}
              options={LEVELS.map(l => ({
                key: l,
                label: l,
                current: l === own ? 'location' : undefined,
                mark: l === own ? <i className="pdesk-here" aria-hidden="true" /> : null,
              }))}
            />
          </div>
          <div className="pdesk-deps__list" role="radiogroup" aria-label={t.practiceGateDest}
            onKeyDown={onDeparture} data-guide="practice.sign">
            {platforms.map((p, i) => {
              const k = KEY[p.path]
              return (
                <button key={p.path} type="button" role="radio" aria-checked={i === sel}
                  tabIndex={radioTab(true, i, sel)} className="pdesk-dep"
                  style={{ '--line-color': p.color }} onClick={() => pick(i)}>
                  <span className="pf-line__roundel" aria-hidden="true">{stationFor(p.path).code}</span>
                  <span className="pdesk-dep__names">
                    <span className="pdesk-dep__title">{p.title}</span>
                    <span className="pdesk-dep__rec">{recordLine(k, records?.[k]?.[level])}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
        <TrainCard section={section} platform={key} level={level} howId={howId} onStation={onStation} />
      </div>

      <div className={`pgate-veil${phase === 'gone' ? ' is-on' : ''}`} aria-hidden={phase === 'gone' ? undefined : true}>
        <span className="pgate-veil__jp" lang="ja">{section.icon}</span>
        <span className="pgate-veil__name">{section.title}</span>
        <span className="pgate-veil__grade">{level}</span>
      </div>
    </div>
  )
}

/** A layer of the painting at each hour drawn so far: the hour shown
    comes in over the last one (index.css's .pgate__layer, the phone's). */
function Layers({ name, hours, hour, className = '' }) {
  return (
    <div className={`pgate__layers pdesk__layers ${className}`.trim()} aria-hidden="true">
      {hours.map(h => <img key={h} className={`pgate__layer${h === hour ? ' is-on' : ''}`} src={layer(name, h)} alt="" draggable="false" />)}
    </div>
  )
}

/**
 * The chosen train's card at the chosen level: what its run asks, its
 * first exercise in a well (the station's own sample, PracticeSpecimen's
 * plate face), and the way into its station. As the window shortens the
 * well's caption goes first, then the line over it, then the face takes
 * its compact form; the short desk also leaves out the card's head and
 * its link, which the chosen row and the rail say already.
 */
function TrainCard({ section, platform, level, howId, onStation }) {
  const { t } = useLang()
  const samples = useStationSamples(platform)
  const [cardRef, cardBox] = useBoxSize(true)
  const [wellRef, wellBox] = useBoxSize(true)
  const stop = samples?.[level]?.card ?? null
  const card = platform === 'exam' ? stop?.vocab ?? null : stop
  const room = wellBox?.height ?? Infinity
  return (
    <section className="pdesk-panel pdesk-card" style={{ '--line-color': section.color }} aria-label={section.title} ref={cardRef}>
      <div className="pdesk-card__head">
        <span className="pf-line__roundel" aria-hidden="true">{stationFor(section.path).code}</span>
        <span className="pdesk-card__title">{section.title}</span>
        <span className="pdesk-card__level">{level}</span>
      </div>
      <p className="pdesk-card__how" id={howId} hidden={(cardBox?.height ?? Infinity) < HOW_MIN}>{t.practiceHow[platform]}</p>
      <div className="pdesk-card__well" ref={wellRef}>
        <PracticeSpecimen platform={platform} card={card} plate compact={room < FACE_MIN}
          tag={room >= TAG_MIN ? t.practiceSpecTag[TAG[platform]] : undefined} />
      </div>
      <button type="button" className="pdesk-card__open" onClick={() => onStation(section)}>{t.practiceDeskOpen}</button>
    </section>
  )
}
