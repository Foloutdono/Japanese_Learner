// ── 舞台 — the director's hold on the app inside the phone (plan 210) ──
// The stage is the real app in the phone's iframe (reel/stage.html,
// booted by stage/boot.js). This is how the director reaches into it:
// find what is drawn, wait for it to arrive, say where it stands on the
// board (through the phone's rig, as drawn this frame), scroll it, and
// tell the stage's backend which beat it is answering for.

import { nextFrame, wait, tween, ease, lerp } from './clock'

export function createStage(phone, { host }) {
  const iframe = phone.iframe
  let win = null

  const stage = {
    get win() { return win },
    get doc() { return win?.document ?? null },
    get api() { return win?.__reelStage ?? null },

    /** Load the app at `path`; resolves once the stage has booted. */
    load(path) {
      win = null
      return new Promise((resolve, reject) => {
        iframe.onload = () => {
          win = iframe.contentWindow
          resolve(win)
        }
        iframe.onerror = reject
        iframe.src = `/__reel/stage${path}`
      })
    },

    /** The first drawn element matching `selector` (or the element itself). */
    find(selector) {
      if (!win) return null
      if (typeof selector !== 'string') return selector
      return win.__reelStage?.find(selector) ?? null
    },

    all(selector) {
      if (!win) return []
      return [...win.document.querySelectorAll(selector)].filter(el => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.height > 0
      })
    },

    /** Wait, a frame at a time, for `selector` to be drawn. */
    async waitFor(selector, { timeout = 10, test } = {}) {
      const frames = Math.ceil(timeout * 60)
      for (let i = 0; i < frames; i++) {
        const el = stage.find(selector)
        if (el && (!test || test(el))) return el
        await nextFrame()
      }
      throw new Error(`stage: ${selector} never appeared`)
    },

    async waitGone(selector, { timeout = 10 } = {}) {
      const frames = Math.ceil(timeout * 60)
      for (let i = 0; i < frames; i++) {
        if (!stage.find(selector)) return
        await nextFrame()
      }
      throw new Error(`stage: ${selector} never left`)
    },

    /** An element's box in the app's viewport. */
    appRect(el) {
      const r = stage.find(el)?.getBoundingClientRect()
      return r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null
    },

    /** An element's box on the board, as the phone is drawn now. */
    boardRect(el) {
      const r = stage.appRect(el)
      if (!r) return null
      const pts = [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]].map(([x, y]) => phone.toBoard(x, y))
      const xs = pts.map(p => p.x)
      const ys = pts.map(p => p.y)
      const x = Math.min(...xs)
      const y = Math.min(...ys)
      return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
    },

    /**
     * Where to press `el` on the board, re-read every frame (a function
     * the finger follows): its centre, or a fraction of its box.
     */
    point(el, { fx = 0.5, fy = 0.5 } = {}) {
      const target = stage.find(el)
      let last = null
      return () => {
        const r = target?.isConnected ? target.getBoundingClientRect() : null
        if (r && r.width > 0) last = phone.toBoard(r.left + r.width * fx, r.top + r.height * fy)
        return last ?? { x: 216, y: 600 }
      }
    },

    /** Where `el` stands in the app's height, 0 (top) to 1 (bottom). */
    focusY(el) {
      const r = stage.appRect(el)
      return r ? Math.min(1, Math.max(0, (r.y + r.h / 2) / win.innerHeight)) : 0.5
    },

    /** Scroll the app's scroller holding `el` so `el` sits at `at` of the view. */
    async scrollTo(el, { at = 0.35, duration = 0.7 } = {}) {
      const target = stage.find(el)
      if (!target) return
      let box = target.parentElement
      while (box && box !== win.document.body) {
        const s = win.getComputedStyle(box)
        if (/(auto|scroll)/.test(s.overflowY) && box.scrollHeight > box.clientHeight + 2) break
        box = box.parentElement
      }
      const scroller = box && box !== win.document.body ? box : win.document.scrollingElement
      const from = scroller.scrollTop
      const r = target.getBoundingClientRect()
      const view = scroller === win.document.scrollingElement ? win.innerHeight : scroller.clientHeight
      const to = Math.max(0, Math.min(scroller.scrollHeight - view, from + r.top - view * at))
      if (Math.abs(to - from) < 2) return
      await tween(duration, k => { scroller.scrollTop = lerp(from, to, k) }, ease.inOutCubic)
    },

    /** Go to an app path, as a link would. */
    navigate(path) { win?.__reelStage.navigate(path) },

    /** The beat the stage's backend answers for. */
    setBeat(index) { host.stage.current = index },

    /** Hide or show an element of the app (the text a lift carries in). */
    veil(el, hidden) {
      const target = stage.find(el)
      if (target) target.style.visibility = hidden ? 'hidden' : ''
    },

    /** One rect per character of `el`'s text, on the board. */
    charRects(el) {
      const target = stage.find(el)
      if (!target) return []
      const out = []
      const walker = win.document.createTreeWalker(target, win.NodeFilter.SHOW_TEXT)
      const range = win.document.createRange()
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        // Ruby readings are not the sentence.
        if (node.parentElement?.closest('rt, rp, .tok__furi')) continue
        const text = node.textContent
        for (let i = 0; i < text.length; i++) {
          if (!text[i].trim()) continue
          range.setStart(node, i)
          range.setEnd(node, i + 1)
          const r = range.getBoundingClientRect()
          if (!r.width) continue
          const a = phone.toBoard(r.left, r.top)
          const b = phone.toBoard(r.right, r.bottom)
          const size = parseFloat(win.getComputedStyle(node.parentElement).fontSize) * phone.pose.s
          out.push({ ch: text[i], x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y, size })
        }
      }
      return out
    },

    /** Let the app settle for a moment of the reel's time. */
    settle: (seconds = 0.3) => wait(seconds),
  }
  return stage
}
