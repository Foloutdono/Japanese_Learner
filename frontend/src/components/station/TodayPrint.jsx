import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLang } from '../../LangContext'
import { kanjiNumber } from '../../domain/dayClear'
import { useDeparture } from '../../stores/departure'
import { useReducedMotion } from '../dayclear/useReducedMotion'
import { handOver, liftLayer } from './print/liftPrint'
import { PRINT, usePrintScene } from './print/usePrint'

// ── 浮世絵 — the print of the hour, behind Today's gate (plan 205) ──
// The owner's pick of the canvas "Tsuji — Today, the visit card"
// (round 9). One landscape, four prints, the hour choosing which:
// 曙 dawn, the red sun, a fisherman sculling home; 帰帆 the day, sails
// coming home on the bay; 落雁 dusk, the geese coming down under the
// moon; 秋月 the night, the autumn moon, the fishing fires. Fuji over
// the bay, the bullet train crossing on its stone viaduct, a pine and
// the autumn's grasses in front. And the year choosing the season
// (plan 261, the canvas "Tsuji — Today, the seasons"): the cherry and
// its petals in spring; in summer Red Fuji, the cloud peak, the crape
// myrtle, the fireflies, August's fireworks; the maples in autumn; the
// snow and the red plum in winter. `look` names the print
// (domain/printHour's printName).
//
// The print is layered the way it is drawn: the sky; the sky's wood
// grain (a tile, drawn once); what lies behind the train; the train on
// a layer of its own, so the compositor carries it across at an even
// pace however busy the rest is; what stands in front of it; the
// paper's fibre over all. Its moving parts are CSS (index.css, the
// print's section) and keep still under reduced motion. Decoration:
// the gate says everything it shows in words. On a day with nothing
// left the last train has gone (`train={false}`, plan 206).
//
// The sky, what lies behind and what stands in front are each lifted
// once they have come (plan 208, print/liftPrint.js): drawn as the
// print has them for a moment, measured, then rebuilt as boxes, so the
// compositor moves the print's parts and the main thread is left to the
// gate. A layer that cannot be lifted stays as drawn. Its loops are then
// handed to the Web Animations API (plan 207, handOver), so their turns
// do not wake the main thread either; a change to reduced motion lifts
// the layer again, still or moving.

// The lifted layers, once a visit: the same print lifts the same way.
const lifted = new WeakMap()
const drawn = (scene, name) => `<svg viewBox="0 0 ${scene.w} ${scene.h}" focusable="false">${scene.layers[name]}</svg>`

// 予熱 (plan 292): each layer as it stood when Today was last left, put
// back as it is when Today is opened again. Rebuilt at every visit, the
// hand-over alone (getAnimations, then every loop's keyframes) held the
// tab bar's tap for most of a second on a phone. Its loops are paused
// while it is out of the page -- the browser would go on turning them,
// unseen, on every frame of every other screen -- and play again, all
// together and so still in step, when it is back. One print's layers at
// a time: another print (the hour turned, the frame went wide) lets the
// last one's go.
let kept = { scene: null, layers: new Map() }

function keptLayers(scene) {
  if (kept.scene !== scene) {
    for (const layer of kept.layers.values()) for (const a of layer.moving) a.cancel()
    kept = { scene, layers: new Map() }
  }
  return kept.layers
}

function buildLayer(el, scene, name) {
  const done = lifted.get(scene) ?? {}
  if (!(name in done)) {
    el.innerHTML = drawn(scene, name)
    try {
      done[name] = `<div class="tpr-lift__root">${liftLayer(el.firstChild)}</div>`
    } catch {
      done[name] = null
    }
    lifted.set(scene, done)
  }
  el.innerHTML = done[name] ?? drawn(scene, name)
  return { node: el.firstChild, moving: done[name] ? handOver(el.firstChild) : [] }
}

function PrintLayer({ scene, name }) {
  const ref = useRef(null)
  const reduced = useReducedMotion()
  useLayoutEffect(() => {
    const el = ref.current
    const layers = keptLayers(scene)
    const key = `${name}:${reduced ? 'still' : 'moving'}`
    let layer = layers.get(key)
    // Another print mounted at once keeps its own: a node has one place.
    if (layer && !layer.node.isConnected) {
      el.replaceChildren(layer.node)
      for (const a of layer.moving) a.play()
    } else {
      // A change to reduced motion lets the other way go.
      for (const [k, other] of layers) {
        if (k !== key && k.startsWith(`${name}:`) && !other.node.isConnected) {
          for (const a of other.moving) a.cancel()
          layers.delete(k)
        }
      }
      layer = buildLayer(el, scene, name)
      if (!layers.has(key)) layers.set(key, layer)
    }
    // Taken out and paused, for the next visit to play again. A layer
    // not kept (another print held the place) stops for good.
    return () => {
      layer.node.remove()
      const keep = kept.layers.get(key) === layer
      for (const a of layer.moving) keep ? a.pause() : a.cancel()
    }
  }, [scene, name, reduced])
  return <div className="tpr__layer" ref={ref} />
}

// While a departure's gate has the screen, the print is not seen and
// Today is about to go: it steps out of the page then, so the restyles
// and the swap the departure makes do not carry its thousands of shapes
// (plan 207). The gate's scrim is opaque by 168ms (TicketGate's
// gate-scrim at its speed); the print steps out just after.
const UNDER_GATE_MS = 200

function useUnderGate() {
  const departing = useDeparture()
  // The departure the gate has covered: a new one, or none, uncovers.
  const [covered, setCovered] = useState(null)
  useEffect(() => {
    if (!departing?.stage) return undefined
    const id = setTimeout(() => setCovered(departing), UNDER_GATE_MS)
    return () => clearTimeout(id)
  }, [departing])
  return departing != null && covered === departing
}

export function TodayPrint({ look, device, frameRef, train = true }) {
  const scene = usePrintScene(look, device)
  const under = useUnderGate()
  const box = scene ? `0 0 ${scene.w} ${scene.h}` : null
  return (
    <div className={`tpr${under ? ' tpr--under-gate' : ''}`} ref={frameRef} aria-hidden="true">
      <div className={`tpr__art${scene ? ' tpr__art--in' : ''}`}>
        {scene && (
          <>
            <PrintLayer scene={scene} name="sky" />
            <div className="tpr__grain" />
            <PrintLayer scene={scene} name="back" />
            {train && <div className="tpr__rail">
              <svg
                className="tpr__train"
                viewBox={box}
                focusable="false"
                style={{
                  '--tpr-run': `${scene.train.run}%`,
                  animationDuration: `${scene.train.dur}s`,
                  animationDelay: `-${scene.train.delay}s`,
                }}
                dangerouslySetInnerHTML={{ __html: scene.layers.train }}
              />
            </div>}
            <PrintLayer scene={scene} name="front" />
            <div className="tpr__paper" />
          </>
        )}
      </div>
    </div>
  )
}

// The print's title slip (題箋): the day, and the hour's view in the
// print's vermilion, set down its right edge the way a print carries
// it. Said whole to a screen reader, in the learner's language (a
// paragraph cannot be named, so the words are there, unseen).
export function PrintTitle({ now, look }) {
  const { t, lang } = useLang()
  const day = new Intl.DateTimeFormat(lang === 'fr' ? 'fr-FR' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long' }).format(now)
  return (
    <p className="tpr-title">
      <span lang="ja" aria-hidden="true">
        {kanjiNumber(now.getMonth() + 1)}月{kanjiNumber(now.getDate())}日
        <span className="tpr-title__view">{PRINT.prints[look].view}</span>
      </span>
      <span className="sr-only">{t.printTitle(day, t.printViews[PRINT.prints[look].viewKey])}</span>
    </p>
  )
}
