// ── 携帯 — the phone, the app inside it, and the camera on it (plan 210) ──
// The app is drawn at the phone lane's width, 390 CSS px, under a
// status bar, so it lays itself out exactly as on a handset: the stage
// is an iframe of 390×800, its own viewport, at the app's own paths.
//
// The phone is one box moved by a rig: where its centre is on the board
// (x, y), its scale and its tilt. Framings name the rig's usual places
// (in the pocket, held up to the world, the app filling the film…) and
// move() glides between them; a handheld drift rides on top. Because the
// director owns the rig, it can say exactly where any point of the app
// lands on the board (toBoard), which is where the finger presses.

import { tween, every, drift, lerp, ease } from './clock'

const PHONE_W = 412
const PHONE_H = 866
const CX = PHONE_W / 2
const CY = PHONE_H / 2
// The screen's corner within the phone, and the app's within the screen.
const SCREEN_X = 11
const SCREEN_Y = 11
const STATUS_H = 44
export const APP_W = 390
export const APP_H = 800

export const BOARD_W = 432
export const BOARD_H = 768
const FILL = BOARD_W / APP_W

/** The rig's named places. `fill` follows a height in the app (focusY). */
export function framing(name, opts = {}) {
  switch (name) {
    case 'pocket': return { x: 216, y: BOARD_H + 340, s: 0.6, r: 7 }
    case 'hand': return { x: 216, y: 506, s: 0.6, r: -2.5 }
    case 'wide': return { x: 216, y: 430, s: 0.7, r: 0 }
    case 'screen': return { x: 216, y: 386, s: 0.872, r: 0 }
    case 'fill': {
      const visible = PHONE_H * FILL - BOARD_H
      const focusY = opts.focusY ?? 0.5
      return { x: 216, y: BOARD_H / 2 + (0.5 - focusY) * visible, s: FILL, r: 0 }
    }
    default: throw new Error(`no framing ${name}`)
  }
}

const SVG_NS = 'http://www.w3.org/2000/svg'

function statusIcons() {
  const wrap = document.createElement('span')
  wrap.className = 'phone__status-icons'
  wrap.innerHTML = `
    <svg width="18" height="11" viewBox="0 0 18 11" aria-hidden="true"><g fill="currentColor"><rect x="0" y="7" width="3" height="4" rx="1"/><rect x="5" y="5" width="3" height="6" rx="1"/><rect x="10" y="2.5" width="3" height="8.5" rx="1"/><rect x="15" y="0" width="3" height="11" rx="1"/></g></svg>
    <svg width="16" height="11" viewBox="0 0 16 11" aria-hidden="true"><path fill="currentColor" d="M8 2.2c2.4 0 4.6.9 6.2 2.5l1.3-1.3C13.6 1.4 10.9.3 8 .3S2.4 1.4.5 3.4l1.3 1.3C3.4 3.1 5.6 2.2 8 2.2zm0 3.7c1.4 0 2.6.5 3.6 1.4l1.3-1.3C11.6 4.7 9.9 4 8 4s-3.6.7-4.9 2l1.3 1.3c1-.9 2.2-1.4 3.6-1.4zm0 3.6 1.9-1.9a2.7 2.7 0 0 0-3.8 0z"/></svg>
    <svg width="27" height="12" viewBox="0 0 27 12" aria-hidden="true"><rect x="0.5" y="0.5" width="22" height="11" rx="3" fill="none" stroke="currentColor" opacity="0.5"/><rect x="2" y="2" width="16" height="8" rx="1.8" fill="currentColor"/><rect x="24" y="4" width="2" height="4" rx="1" fill="currentColor" opacity="0.5"/></svg>`
  return wrap
}

export function createPhone(rigLayer, { seed = 1, statusInk = '#ece5d8', clockText = '12:30' } = {}) {
  const root = document.createElement('div')
  root.className = 'phone'
  root.innerHTML = `
    <div class="phone__body"></div>
    <div class="phone__screen">
      <div class="phone__status"><span class="phone__time"></span></div>
      <iframe class="phone__app" title="Tsuji"></iframe>
      <div class="cam">
        <div class="cam__top"><span>⚡︎ AUTO</span><span>HDR</span><span>◎</span></div>
        <div class="cam__view"><div class="cam__feed"></div><div class="cam__grid"></div><div class="cam__focus"></div></div>
        <div class="cam__shot"></div>
        <div class="cam__zoom">1×</div>
        <div class="cam__modes"><span>Video</span><b>Photo</b><span>Portrait</span></div>
        <div class="cam__thumb"></div>
        <div class="cam__shutter"></div>
        <div class="cam__flash"></div>
      </div>
      <div class="phone__home"></div>
      <div class="phone__glass"></div>
    </div>
    <div class="phone__island"></div>`
  rigLayer.appendChild(root)

  const status = root.querySelector('.phone__status')
  status.style.color = statusInk
  root.querySelector('.phone__time').textContent = clockText
  status.appendChild(statusIcons())

  const iframe = root.querySelector('.phone__app')
  const cam = {
    root: root.querySelector('.cam'),
    view: root.querySelector('.cam__view'),
    feed: root.querySelector('.cam__feed'),
    focus: root.querySelector('.cam__focus'),
    shot: root.querySelector('.cam__shot'),
    thumb: root.querySelector('.cam__thumb'),
    shutter: root.querySelector('.cam__shutter'),
    flash: root.querySelector('.cam__flash'),
  }

  // ── The rig ──
  let mover = null
  let moving = Promise.resolve()
  const pose = { ...framing('pocket') }
  let shakeAmount = 0
  const dx = drift(seed * 11 + 1)
  const dy = drift(seed * 11 + 2)
  const dr = drift(seed * 11 + 3)
  let live = { ...pose }

  function apply(t) {
    const a = shakeAmount
    live = {
      x: pose.x + dx(t) * 3.2 * a,
      y: pose.y + dy(t) * 3.6 * a,
      s: pose.s,
      r: pose.r + dr(t) * 0.55 * a,
    }
    root.style.transform = `translate(${live.x - CX}px, ${live.y - CY}px) rotate(${live.r}deg) scale(${live.s})`
  }
  every(t => apply(t))
  apply(0)

  const phone = {
    root,
    iframe,
    cam,
    status,
    get pose() { return { ...pose } },
    /** The rig set at once. */
    set(to) { Object.assign(pose, to) },
    /**
     * Glide the rig to `to` (a framing's pose, or part of one). A newer
     * move takes the rig from wherever this one has it: two never pull
     * it at once.
     */
    move(to, duration = 0.9, easing = ease.inOutCubic) {
      const from = { ...pose }
      const target = { ...from, ...to }
      const mine = {}
      mover = mine
      moving = tween(duration, k => {
        if (mover !== mine) return
        pose.x = lerp(from.x, target.x, k)
        pose.y = lerp(from.y, target.y, k)
        pose.s = lerp(from.s, target.s, k)
        pose.r = lerp(from.r, target.r, k)
      }, easing)
      return moving
    },
    /** Resolves once the rig's latest move has landed. */
    settled() { return moving },
    /** How much the hand holding the phone drifts: 0 still, 1 handheld. */
    shake(amount, duration = 0.6) {
      const from = shakeAmount
      return tween(duration, k => { shakeAmount = lerp(from, amount, k) }, ease.inOutSine)
    },
    /** A point in the phone's own box, on the board (as drawn this frame). */
    phoneToBoard(px, py) {
      const rad = (live.r * Math.PI) / 180
      const ux = (px - CX) * live.s
      const uy = (py - CY) * live.s
      return { x: live.x + ux * Math.cos(rad) - uy * Math.sin(rad), y: live.y + ux * Math.sin(rad) + uy * Math.cos(rad) }
    },
    /** A point in the app's viewport, on the board. */
    toBoard(ax, ay) {
      return phone.phoneToBoard(SCREEN_X + ax, SCREEN_Y + STATUS_H + ay)
    },
    /** A point on the phone's screen (status bar included), on the board. */
    screenToBoard(sx, sy) {
      return phone.phoneToBoard(SCREEN_X + sx, SCREEN_Y + sy)
    },
    /** A point on the board, in the app's viewport (a preview's presses). */
    boardToApp(bx, by) {
      const rad = (-live.r * Math.PI) / 180
      const ux = (bx - live.x) / live.s
      const uy = (by - live.y) / live.s
      const px = CX + ux * Math.cos(rad) - uy * Math.sin(rad)
      const py = CY + ux * Math.sin(rad) + uy * Math.cos(rad)
      return { x: px - SCREEN_X, y: py - SCREEN_Y - STATUS_H }
    },
    /** The pose that centres the app's point (ax, ay) at `zoom`. */
    focusOn(ax, ay, zoom = 1.45, at = { x: BOARD_W / 2, y: BOARD_H * 0.5 }) {
      const px = SCREEN_X + ax
      const py = SCREEN_Y + STATUS_H + ay
      return { x: at.x - zoom * (px - CX), y: at.y - zoom * (py - CY), s: zoom, r: 0 }
    },
    setStatusInk(ink) { status.style.color = ink },
  }
  return phone
}

export { SVG_NS }
