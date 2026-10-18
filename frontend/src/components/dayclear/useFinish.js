import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { clearModel } from '../../domain/dayClear'
import { runKey } from '../../stores/dayClear'
import { showFare, useFareHold } from '../../stores/fare'
import { useChromeAway } from '../../stores/stage'
import { playArrival, playDayClear, playMilestone, playPassClip, playStamp } from '../../lib/audio'

// ── 終着 — the day's run, finished on Today (plan 247) ─────────────────
// The owner's picks of the canvas "Tsuji — the day cleared, new
// directions" (2026-10-18): the finish plays on Today's print and ends
// as Today, a kind of finish a timeline:
//
//   day      the day's seal slammed onto the sun or the moon (B), what
//            the day was under the dial, the board and the shut gate;
//            also a clear the day had already paid (`already`)
//   ticket   3, 7 and 14 days: the seal pressed, a crane a day of the
//            streak crossing the print (B2·b), the ticket to the board
//   month    30 days and on: night falls, the moon takes the seal, a
//            lantern a day set on the lake and the gold ticket rising
//            out of their light, clipped (B3·b)
//   partial  a run that left cards: Today's open gate for them, the
//            dial's thin ring the day's thread (B4·a)
//
// The clock runs from the server's answer (`clear`, stores/dayClear's
// or the workbench's): `at(beat)` says whether a beat has come; a tap,
// a click or Enter skips to the rest (`skip`); under reduced motion the
// rest is drawn at once. The beats' sounds play on the clock only, never
// on a skip. Three things follow the clock whichever way it got there:
//
//   staged   the phone's bars away until the chrome beat, in their
//            places, then drawn back in (stores/stage's useChromeAway)
//   fare     the pass's fare held until the fare beat, then said whole
//            (stores/fare); `toast` is XpToast's at the same beat (the
//            tick, the screen reader's amount, the 進級 when crossed)
//   onEnd    once, at the rest: the screen leaves /today/clear for /today
//
// Placed in the print's units by the screens (components/station/
// GateCard.jsx): a beat here is a time, never a place.

export const BEATS = Object.freeze({
  // SEALED: the stamp's way in has ended, and the seal is the disc again.
  day: [
    ['RING', 80], ['SLAM', 300], ['IMPACT', 680], ['LAND', 690], ['RECAP', 760], ['FARE_LINE', 860],
    ['WEEK', 900], ['SEALED', 930], ['PRESS', 990], ['ROLL', 1040], ['CHROME', 1300], ['BOARD', 1500],
    ['FARE', 1550], ['GATE', 1650], ['END', 2300],
  ],
  ticket: [
    ['PRESS_SEAL', 250], ['LAND', 300], ['BLOOM', 520], ['CRANES', 600], ['CHROME', 600], ['SEALED', 710],
    ['RECAP', 1000], ['WEEK', 1050], ['PRESS', 1150], ['ROLL', 1200], ['BOARD', 1900], ['GATE', 2100],
    ['PUNCH', 2300], ['FARE', 2400], ['END', 3400],
  ],
  month: [
    ['DUSK', 0], ['PRESS_SEAL', 300], ['LAND', 350], ['NIGHT', 450], ['BLOOM', 570], ['LANTERNS', 700],
    ['SEALED', 760], ['TICKET', 1600], ['CLIP', 2600], ['BITE', 2940], ['REST', 3000], ['CHROME', 3100],
    ['BOARD', 3200], ['GATE', 3300], ['FARE', 3350], ['END', 4300],
  ],
  partial: [
    ['ROLL', 150], ['THREAD', 300], ['LINE', 600], ['FARE', 650], ['STOP', 820], ['KEY', 900], ['END', 1500],
  ],
})

// The cranes cross a desk's sky (three times the phone's) in 4 s: the
// crossing still ends with the ceremony.
const DESK_END = Object.freeze({ ticket: 4800 })

/** Which finish a clear plays: the server's tier, or the everyday one. */
export function finishKind(status, model) {
  if (status === 'partial') return 'partial'
  if (status !== 'cleared' || !model) return null
  if (model.already || model.tier === 'day') return 'day'
  return model.tier === 'month' ? 'month' : 'ticket'
}

function beatsFor(kind, desk) {
  const list = BEATS[kind] ?? []
  const end = desk ? DESK_END[kind] : null
  return end ? list.map(([name, ms]) => [name, name === 'END' ? end : ms]) : list
}

// The sounds a beat makes, on the clock only.
function sound(kind, beat) {
  if (kind === 'day') {
    if (beat === 'IMPACT') playStamp()
    else if (beat === 'RECAP') playDayClear()
  } else if (kind === 'ticket') {
    if (beat === 'LAND') playStamp()
    else if (beat === 'CRANES') playMilestone()
    else if (beat === 'PUNCH') playPassClip()
  } else if (kind === 'month') {
    if (beat === 'LAND') playStamp()
    else if (beat === 'TICKET') playMilestone()
    else if (beat === 'BITE') playPassClip()
  } else if (kind === 'partial' && beat === 'ROLL') {
    playArrival()
  }
}

/**
 * The finish's state for Today. `run` is the run's tally (null: no
 * finish), `clear` the answer ({ status, result, levelUp }), `desk` the
 * desk's layout, `reduced` the rest at once.
 */
export function useFinish({ run, clear, desk = false, reduced = false, onEnd }) {
  const status = run ? (clear?.status ?? 'loading') : 'idle'
  const result = clear?.result ?? null
  const model = useMemo(() => (status === 'cleared' && result ? clearModel(result, run) : null), [status, result, run])
  const kind = finishKind(status, model)
  const beats = useMemo(() => beatsFor(kind, desk), [kind, desk])
  // The clock's identity: the run and what it plays. A new answer (a
  // retry that came back) starts the clock again.
  const key = kind ? `${runKey(run)}:${kind}` : null

  // How many beats have come, for this key; a skip jumps to the last.
  const [state, setState] = useState({ key: null, n: 0, skipped: false })
  const cur = state.key === key ? state : { key, n: 0, skipped: false }
  useEffect(() => {
    if (!key || reduced) return undefined
    const timers = beats.map(([, ms], i) => setTimeout(() => {
      setState(s => {
        const c = s.key === key ? s : { key, n: 0, skipped: false }
        return c.skipped || c.n >= i + 1 ? c : { ...c, n: i + 1 }
      })
    }, ms))
    return () => timers.forEach(clearTimeout)
  }, [key, reduced, beats])

  const n = !key ? 0 : reduced ? beats.length : cur.n
  const skipped = Boolean(key) && !reduced && cur.skipped

  // The beats' sounds, as the clock reaches them: none on a skip, none
  // under reduced motion.
  const heard = useRef({ key: null, n: 0 })
  useEffect(() => {
    const was = heard.current.key === key ? heard.current.n : 0
    if (kind && n > was && !skipped && !reduced) {
      for (let i = was; i < n; i += 1) sound(kind, beats[i][0])
    }
    heard.current = { key, n }
  }, [key, n, skipped, reduced, kind, beats])
  const index = useMemo(() => new Map(beats.map(([beat], i) => [beat, i + 1])), [beats])
  // A beat this finish's timeline does not have is always there.
  const at = useCallback(beat => {
    const i = index.get(beat)
    return i == null || n >= i
  }, [index, n])
  const ended = Boolean(key) && n >= beats.length
  const playing = Boolean(key) && !ended

  const skip = useCallback(() => {
    if (!key) return
    setState({ key, n: beats.length, skipped: true })
  }, [key, beats.length])

  // The phone's bars: off while the answer is awaited and until the
  // chrome beat; an error hands them back at once.
  const staged = status === 'loading' || (Boolean(kind) && !at('CHROME') && kind !== 'partial')

  // The fare: held from the first frame until its beat, then said whole.
  const fare = kind === 'partial' || model?.already
    ? (run?.xp ?? 0)
    : (model?.fare.total ?? 0)
  const fareCome = Boolean(kind) && at('FARE')
  useFareHold(status === 'loading' || (Boolean(kind) && !fareCome))
  const said = useRef(null)
  useEffect(() => {
    if (!fareCome || said.current === key) return
    said.current = key
    showFare(fare)
  }, [fareCome, key, fare])
  const levelUp = clear?.levelUp ?? null
  const toast = fareCome && fare > 0
    ? { id: `clear-${runKey(run)}`, amount: fare, leveledUp: Boolean(levelUp), newLevel: levelUp?.newLevel }
    : null

  // The rest, once: the screen's own business (its URL).
  const endRef = useRef(onEnd)
  useEffect(() => { endRef.current = onEnd })
  const done = useRef(null)
  useEffect(() => {
    if (!ended || done.current === key) return
    done.current = key
    endRef.current?.()
  }, [ended, key])

  // A beat's time, for a part that mounts on one beat and plays the next
  // as a delay of its own (one clock: a late timer cannot set them apart).
  const times = useMemo(() => new Map(beats), [beats])
  const ms = useCallback(beat => times.get(beat) ?? 0, [times])

  return {
    status, kind, model, result, run,
    at, ms, skip, skipped, reduced: Boolean(reduced), playing, ended,
    // Whether the transients play: the clock is running as drawn.
    live: Boolean(key) && !skipped && !reduced,
    staged, toast,
    // A month's night (B3·b): it has fallen once the veil is opaque.
    night: kind === 'month' && at('NIGHT'),
  }
}

/**
 * useFinish, and what a screen that plays it owes: the phone's bars
 * sent away in their places while the answer is awaited and until the
 * chrome beat, then drawn back in (stores/stage.js), Enter as a skip,
 * and the tap's: the
 * returned `onClickCapture` goes on the screen's root, so the tap that
 * skips activates nothing under it. Today plays it (screens/
 * TodayScreen.jsx), and the workbench (/dev/dayclear).
 */
export function useFinishScreen(args) {
  const fin = useFinish(args)
  useChromeAway(Boolean(args.run) && fin.staged)
  const { playing, skip } = fin
  useEffect(() => {
    if (!playing) return undefined
    const onKey = e => {
      if ((e.key !== 'Enter' && e.key !== ' ') || e.repeat) return
      e.preventDefault()
      e.stopImmediatePropagation()
      skip()
    }
    // Captured: the gate's own Enter (DeskKeys) waits for the rest.
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [playing, skip])
  const onClickCapture = useCallback(e => {
    e.preventDefault()
    e.stopPropagation()
    skip()
  }, [skip])
  return { ...fin, onClickCapture: playing ? onClickCapture : undefined }
}
