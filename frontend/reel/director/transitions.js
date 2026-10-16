// ── 乗換 — from the world to the app (plan 210) ───────────────────────
// The cut that makes the reel: the moment the viewer's problem (Japanese
// they cannot read) becomes the app's answer. Each transition brings the
// phone up to the next app beat and hands over with the app ready:
//
//   snap   the phone comes up as a camera, focuses, takes the picture,
//          and a swipe along its foot switches to the app holding it
//   lift   the text comes off the object, the phone rises under it, and
//          it lands in the app, character by character
//   rise   the phone comes up with the app already open
//   cut    a hard cut to the app, with a punch-in
//   whip   the world is swept aside and the phone is swept in
//   swap   between two app beats: the next station's plate passes over
//          the screen while the app changes place under it

import { tween, wait, ease, lerp, every, seeded } from './clock'
import { framing } from './phone'

function setOpacity(el, v) { el.style.opacity = String(v) }

/** The world behind the phone recedes: darker, a little smaller. */
export function recede(ctx, amount = 0.62, seconds = 0.8) {
  const dim = ctx.layers.dim
  const from = parseFloat(dim.style.opacity || '0')
  return tween(seconds, k => setOpacity(dim, lerp(from, amount, k)), ease.inOutSine)
}

async function focusSquare(cam, at) {
  const f = cam.focus
  f.style.left = `${at.x}px`
  f.style.top = `${at.y}px`
  await tween(0.24, k => {
    f.style.opacity = String(k)
    f.style.transform = `scale(${lerp(1.5, 1, k)})`
  }, ease.outCubic)
  await tween(0.12, k => setOpacity(f, lerp(1, 0.45, k)), ease.linear)
  await tween(0.12, k => setOpacity(f, lerp(0.45, 1, k)), ease.linear)
}

async function snap(beat, ctx) {
  const { phone, finger, captions, sfx, hook } = ctx
  const cam = phone.cam
  const app = ctx.nextApp()
  if (hook) hook.feed(cam.feed, 390, 520, 0.72)
  setOpacity(cam.root, 1)
  phone.setStatusInk('#fbf7ef')
  ctx.say(beat.caption)

  // The camera's view swims a little against the hand that holds it.
  const swim = { x: 0, y: 0, k: 1 }
  const sx = ctx.drift(41)
  const sy = ctx.drift(42)
  const stopSwim = every(t => {
    cam.feed.style.transform = `translate(${swim.x + sx(t) * 3 * swim.k}px, ${swim.y + sy(t) * 3 * swim.k}px)`
  })

  sfx.whoosh(0.55, 0.11)
  phone.shake(1, 0.5)
  await phone.move(framing('hand'), 0.8, ease.outCubic)
  await wait(0.1)

  // Focus on the text: a tap on the viewfinder.
  const focusAt = { x: 195, y: 260 }
  await finger.tap(() => phone.screenToBoard(195, 96 + focusAt.y), {
    input: false,
    onPress: () => { focusSquare(cam, focusAt) },
  })
  await wait(0.22)

  // The picture. The app is told now, so the photo is waiting for the
  // learner on the other side of the switch.
  const entering = ctx.enterApp(app)
  await finger.tap(() => phone.screenToBoard(195, 718), {
    input: false,
    quick: true,
    onPress: () => {
      sfx.shutter()
      cam.shutter.classList.add('is-pressed')
      wait(0.14).then(() => cam.shutter.classList.remove('is-pressed'))
      tween(0.3, k => setOpacity(cam.flash, k < 0.25 ? k * 4 * 0.85 : 0.85 * (1 - (k - 0.25) / 0.75)), ease.linear)
      stopSwim()
      // The frame, frozen where it was, then into the roll.
      const shot = document.createElement('img')
      shot.src = ctx.photoUrl(app) ?? ''
      cam.shot.replaceChildren(shot)
      setOpacity(cam.shot, 1)
      const thumb = document.createElement('img')
      thumb.src = shot.src
      cam.thumb.replaceChildren(thumb)
      setOpacity(thumb, 0)
    },
  })
  await wait(0.12)
  // From the view (0,96 · 390×520) into the roll's square (40,692 · 50×50);
  // the picture is cropped to the square as it goes (object-fit: cover).
  await tween(0.42, k => {
    cam.shot.style.left = `${lerp(0, 40, k)}px`
    cam.shot.style.top = `${lerp(96, 692, k)}px`
    cam.shot.style.width = `${lerp(390, 50, k)}px`
    cam.shot.style.height = `${lerp(520, 50, k)}px`
    cam.shot.style.borderRadius = `${lerp(0, 8, k)}px`
  }, ease.inOutCubic)
  setOpacity(cam.shot, 0)
  setOpacity(cam.thumb.firstChild, 1)
  await entering
  await wait(0.3)

  // Switch apps: a swipe along the foot of the screen.
  const swipeFrom = phone.screenToBoard(118, 834)
  const swipeTo = phone.screenToBoard(316, 834)
  const swipe = finger.drag(swipeFrom, swipeTo, { duration: 0.34, input: false })
  sfx.whoosh(0.4, 0.08)
  phone.iframe.style.transform = 'translateX(-130px)'
  await tween(0.5, k => {
    cam.root.style.transform = `translateX(${lerp(0, 400, k)}px)`
    phone.iframe.style.transform = `translateX(${lerp(-130, 0, k)}px)`
    phone.iframe.style.opacity = String(lerp(0.4, 1, k))
  }, ease.inOutCubic)
  await swipe
  setOpacity(cam.root, 0)
  cam.root.style.transform = ''
  phone.iframe.style.transform = ''
  phone.setStatusInk(ctx.statusInk)
  captions.hide()

  // And in, to the app.
  recede(ctx, 0.84, 0.9)
  phone.shake(0.1, 0.9)
  finger.rest()
  await phone.move(framing('screen'), 0.9, ease.inOutCubic)
}

/** The text leaves the object and lands in the app. */
async function lift(beat, ctx) {
  const { phone, finger, hook, stage, sfx } = ctx
  const app = ctx.nextApp()
  const from = hook ? hook.charRects() : []
  const fx = ctx.layers.fx
  // Each character, lifted into the effects layer where it stood.
  const flying = from.map(r => {
    const el = document.createElement('span')
    el.className = 'fx__char'
    el.textContent = r.ch
    el.style.fontSize = `${r.size}px`
    el.style.left = `${r.x}px`
    el.style.top = `${r.y}px`
    el.style.color = getComputedStyle(hook.text).color
    fx.appendChild(el)
    return { el, r }
  })
  if (hook?.text) hook.text.style.visibility = 'hidden'
  ctx.say(beat.caption)
  sfx.whoosh(0.5, 0.08)
  const rng = seeded(ctx.seed * 3 + 1)
  const lifted = flying.map(() => ({ dy: -18 - rng() * 22, rot: (rng() - 0.5) * 10 }))
  await tween(0.55, k => {
    flying.forEach((f, i) => {
      const kk = Math.min(1, Math.max(0, k * 1.6 - i * 0.03))
      f.el.style.transform = `translateY(${lifted[i].dy * kk}px) rotate(${lifted[i].rot * kk}deg) scale(${lerp(1, 1.08, kk)})`
      f.el.style.color = 'var(--gate-gold-lit)'
    })
  }, ease.outCubic)

  // The phone rises under the hovering text, with the app made ready.
  const target = await ctx.enterApp(app, { lift: true })
  recede(ctx, 0.84, 0.8)
  sfx.whoosh(0.5, 0.1)
  phone.shake(0.12, 0.8)
  await phone.move(framing('screen'), 0.85, ease.outCubic)
  const landing = target?.selector ? await target.reveal?.() : null
  const to = landing ? stage.charRects(target.selector) : []

  // Pair the characters in order, skipping what only one side has.
  const pairs = []
  let j = 0
  for (const f of flying) {
    while (j < to.length && to[j].ch !== f.r.ch && !/[、。！？!?\s]/.test(f.r.ch)) j++
    if (j < to.length && to[j].ch === f.r.ch) pairs.push([f, to[j++]])
    else pairs.push([f, null])
  }
  sfx.app('card-flip')
  await tween(0.75, k => {
    pairs.forEach(([f, t], i) => {
      const kk = ease.reach(Math.min(1, Math.max(0, (k - i * 0.022) / Math.max(0.3, 1 - pairs.length * 0.022))))
      if (!t) {
        f.el.style.opacity = String(1 - kk)
        return
      }
      const x = lerp(f.r.x, t.x, kk)
      const y = lerp(f.r.y + lifted[i].dy, t.y, kk) - Math.sin(Math.PI * kk) * 40
      f.el.style.left = `${x}px`
      f.el.style.top = `${y}px`
      f.el.style.transform = `rotate(${lerp(lifted[i].rot, 0, kk)}deg)`
      f.el.style.fontSize = `${lerp(f.r.size, t.size, kk)}px`
    })
  }, ease.linear)
  target?.land?.()
  await tween(0.18, k => flying.forEach(f => setOpacity(f.el, 1 - k)), ease.linear)
  flying.forEach(f => f.el.remove())
  ctx.captions.hide()
  finger.rest()
}

async function rise(beat, ctx) {
  const { phone, sfx } = ctx
  await ctx.enterApp(ctx.nextApp())
  ctx.say(beat.caption)
  recede(ctx, 0.84, 0.85)
  sfx.whoosh(0.5, 0.1)
  phone.shake(0.12, 0.8)
  await phone.move(framing('screen'), 0.9, ease.outCubic)
}

async function cut(beat, ctx) {
  const { phone, sfx } = ctx
  await ctx.enterApp(ctx.nextApp())
  setOpacity(ctx.layers.dim, 0.84)
  sfx.whoosh(0.25, 0.12)
  const to = framing('screen')
  phone.set({ ...to, s: to.s * 1.08 })
  ctx.say(beat.caption)
  await phone.move(to, 0.35, ease.outCubic)
}

async function whip(beat, ctx) {
  const { phone, sfx } = ctx
  await ctx.enterApp(ctx.nextApp())
  const world = ctx.layers.world
  sfx.whoosh(0.35, 0.16)
  const to = framing('screen')
  phone.set({ ...to, x: to.x + 460, r: 4 })
  await Promise.all([
    tween(0.42, k => { world.style.transform = `translateX(${lerp(0, -300, k)}px)`; world.style.filter = `blur(${Math.sin(Math.PI * k) * 6}px)` }, ease.inOutCubic),
    phone.move(to, 0.5, ease.outCubic),
  ])
  world.style.filter = ''
  setOpacity(ctx.layers.dim, 0.84)
  ctx.say(beat.caption)
}

/**
 * Between two app beats: the phone dips, the next feature's station
 * plate (its kanji and name, in its line's colour) passes over the
 * screen, and the app is somewhere else when it rises.
 */
export async function swap(nextBeat, ctx) {
  const { phone, sfx, strings } = ctx
  // The last scene's words leave with it.
  ctx.captions.hide()
  const [jp, latin] = strings.stations[nextBeat.feature] ?? ['', '']
  const plate = document.createElement('div')
  plate.className = 'fx__plate'
  plate.innerHTML = `<b lang="ja">${jp}</b><span>${latin}</span>`
  plate.style.setProperty('--plate-line', ctx.lineColor(nextBeat.feature))
  ctx.layers.fx.appendChild(plate)
  const pose = phone.pose
  sfx.whoosh(0.5, 0.1)
  const leaving = phone.move({ ...pose, s: pose.s * 0.94, y: pose.y + 10 }, 0.35, ease.inCubic)
  await tween(0.32, k => {
    plate.style.transform = `translateX(${lerp(440, 0, k)}px)`
    setOpacity(plate, 1)
  }, ease.outCubic)
  await leaving
  await ctx.enterApp(nextBeat)
  await wait(0.35)
  ctx.sfx.app('click-screen-selection')
  await Promise.all([
    tween(0.34, k => { plate.style.transform = `translateX(${lerp(0, -440, k)}px)` }, ease.inCubic),
    phone.move(framing('screen'), 0.5, ease.outCubic),
  ])
  plate.remove()
}

export const TRANSITIONS = { snap, lift, rise, cut, whip }
