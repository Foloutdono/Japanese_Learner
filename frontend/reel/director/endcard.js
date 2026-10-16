// ── 終点 — the card the reel leaves on (plan 210) ──────────────────────
// The terminus: the app's mark (the 辻 the icon draws, its road in the
// pass's gold, components/ui/markPaths.js), its name, one line, and what
// to do next. It arrives the way the landing page's hero does: the road
// runs out, the name lands, the call to action pops last.

import { MARK_INK, MARK_ROAD } from '../../src/components/ui/markPaths'
import { tween, wait, ease, lerp } from './clock'

export async function playEnd(beat, ctx) {
  const s = ctx.strings
  const layer = ctx.layers.end
  layer.innerHTML = `
    <div class="end__card">
      <svg class="end__mark" viewBox="0 0 1000 1000" aria-hidden="true">
        <path class="mark__road" d="${MARK_ROAD}"/>
        <path class="mark__ink" d="${MARK_INK}"/>
      </svg>
      <div class="end__name">${s.name}</div>
      <div class="end__road"></div>
      <div class="end__tag"></div>
      <div class="end__cta"></div>
      <div class="end__url"></div>
    </div>`
  const card = layer.querySelector('.end__card')
  const mark = layer.querySelector('.end__mark')
  const name = layer.querySelector('.end__name')
  const road = layer.querySelector('.end__road')
  const tag = layer.querySelector('.end__tag')
  const cta = layer.querySelector('.end__cta')
  const url = layer.querySelector('.end__url')
  tag.textContent = beat.caption?.text ?? s.tagline
  cta.textContent = beat.cta ?? s.cta
  url.textContent = beat.url ?? s.url
  for (const el of [mark, name, road, tag, cta, url]) el.style.opacity = '0'

  ctx.captions.hide()
  ctx.finger.leave()
  ctx.sfx.whoosh(0.5, 0.12)
  await tween(0.5, k => { card.style.opacity = String(k) }, ease.outCubic)
  ctx.sfx.app('gate-chime')
  await tween(0.55, k => {
    mark.style.opacity = String(Math.min(1, k * 1.6))
    mark.style.transform = `scale(${lerp(0.72, 1, k)})`
  }, ease.outBack)
  tween(0.42, k => {
    name.style.opacity = String(k)
    name.style.transform = `translateY(${lerp(10, 0, k)}px)`
  }, ease.outCubic)
  await wait(0.18)
  road.style.opacity = '1'
  await tween(0.5, k => { road.style.transform = `scaleX(${k})` }, ease.outExpo)
  tween(0.4, k => {
    tag.style.opacity = String(k)
    tag.style.transform = `translateY(${lerp(8, 0, k)}px)`
  }, ease.outCubic)
  await wait(0.35)
  ctx.sfx.app('click-screen-selection')
  tween(0.45, k => {
    cta.style.opacity = String(Math.min(1, k * 1.5))
    cta.style.transform = `scale(${lerp(0.8, 1, k)})`
  }, ease.outBack)
  await wait(0.25)
  tween(0.4, k => { url.style.opacity = String(k) }, ease.outCubic)
  await wait(beat.duration ?? 2.2)
}
