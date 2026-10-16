// ── 字幕 — the film's words (plan 210) ────────────────────────────────
// Short-video captions: big, few, and on the beat. A caption arrives a
// word at a time (each word pops in, 70ms after the last), holds, and
// leaves as one. Inside a caption:
//
//   *word*        is set in the metal's gold (the one word that matters)
//   日本語         Japanese runs are set in the Japanese face
//   😭            emoji are drawn from the system's colour emoji
//
// Three places on the board (top, middle, bottom), all inside the band
// a short-video app leaves clear of its own header, caption and buttons.

import { tween, wait, ease, lerp } from './clock'

const JA = /[\u3000-\u303f\u3040-\u30ff\u3400-\u9fff\uff66-\uff9f]/
const EMOJI = /\p{Extended_Pictographic}/u

/** Split a caption into words, each { text, gold, ja, emoji }. */
export function wordsOf(text) {
  const out = []
  const re = /\*([^*]+)\*|(\S+)/g
  let m
  while ((m = re.exec(text))) {
    const gold = m[1] != null
    const chunk = m[1] ?? m[2]
    // A gold run of several words pops as one.
    out.push({ text: chunk, gold, ja: JA.test(chunk), emoji: EMOJI.test(chunk) && !/[A-Za-z0-9぀-鿿]/.test(chunk) })
  }
  return out
}

export function createCaptions(layer, { style = 'board' } = {}) {
  let current = null

  async function hide() {
    if (!current) return
    const el = current
    current = null
    await tween(0.18, k => {
      el.style.opacity = String(1 - k)
      el.style.transform = `translateY(${lerp(0, -6, k)}px)`
    }, ease.inCubic)
    el.remove()
  }

  // A caption says its line and goes: `hold` seconds after its last word
  // (2.4 by default; null keeps it until the next).
  async function show(text, { at = 'top', hold = 2.4, gap = 0.07 } = {}) {
    if (style === 'none' || !text) return
    await hide()
    const el = document.createElement('div')
    el.className = `cap cap--${at} cap--${style}`
    const line = document.createElement('div')
    line.className = 'cap__line'
    const words = wordsOf(text)
    const spans = words.map((w, i) => {
      const span = document.createElement('span')
      span.className = `cap__word${w.gold ? ' cap__word--gold' : ''}${w.emoji ? ' cap__emoji' : ''}`
      if (w.ja) span.lang = 'ja'
      span.textContent = w.text
      line.appendChild(span)
      if (i < words.length - 1) line.appendChild(document.createTextNode(' '))
      return span
    })
    el.appendChild(line)
    layer.appendChild(el)
    current = el
    spans.forEach((span, i) => {
      wait(i * gap).then(() => tween(0.22, k => {
        span.style.opacity = String(Math.min(1, k * 1.6))
        span.style.transform = `translateY(${lerp(7, 0, k)}px) scale(${lerp(0.82, 1, k)})`
      }, ease.outBack))
    })
    if (hold != null) {
      wait(words.length * gap + hold).then(() => { if (current === el) hide() })
    }
  }

  return { show, hide, get showing() { return current != null } }
}
