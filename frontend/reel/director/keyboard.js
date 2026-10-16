// ── 鍵盤 — the phone's keyboard (plan 210) ────────────────────────────
// A field focused on a phone brings the keyboard up, and the app's
// viewport shrinks above it: the app lays itself out again in what is
// left, as it does on a handset. Typing is shown the way a phone shows
// it, a key lifting into a bubble as each letter lands, while the text
// itself reaches the app as real input.
//
// Two layouts: `latin` (romaji, as the reading and dictation runs ask)
// and `ja` (the same keys in the Japanese input mode: a composition
// underlined in the field and the candidates over the keys, for the
// runs that want Japanese).

import { tween, wait, ease, lerp } from './clock'

const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']
export const KEYBOARD_H = 292
const APP_TOP = 44

export function createKeyboard(phone, { sfx, lang = 'en' } = {}) {
  const screen = phone.root.querySelector('.phone__screen')
  const el = document.createElement('div')
  el.className = 'kbd'
  el.innerHTML = `
    <div class="kbd__cands"></div>
    ${ROWS.map((row, i) => `<div class="kbd__row kbd__row--${i}">${i === 2 ? '<span class="kbd__key kbd__key--mod">⇧</span>' : ''}${[...row].map(c => `<span class="kbd__key" data-k="${c}">${c}</span>`).join('')}${i === 2 ? '<span class="kbd__key kbd__key--mod">⌫</span>' : ''}</div>`).join('')}
    <div class="kbd__row kbd__row--3"><span class="kbd__key kbd__key--mod">123</span><span class="kbd__key kbd__key--space" data-k=" "></span><span class="kbd__key kbd__key--ret" data-k="\n"></span></div>`
  screen.appendChild(el)
  const space = el.querySelector('.kbd__key--space')
  const ret = el.querySelector('.kbd__key--ret')
  const cands = el.querySelector('.kbd__cands')
  let up = false

  function keyFor(ch) {
    return el.querySelector(`[data-k="${CSS.escape(ch.toLowerCase())}"]`)
  }

  /** The key's bubble, as a phone draws a pressed key. */
  function press(ch) {
    const key = keyFor(ch)
    if (!key) return
    key.classList.add('is-down')
    const bubble = document.createElement('span')
    bubble.className = 'kbd__bubble'
    bubble.textContent = ch === ' ' || ch === '\n' ? '' : ch
    if (ch.trim()) key.appendChild(bubble)
    sfx?.key?.()
    wait(0.09).then(() => { key.classList.remove('is-down'); bubble.remove() })
  }

  const keyboard = {
    get up() { return up },
    /** Bring it up: the app's viewport shrinks above it. */
    async show(mode = 'latin') {
      el.classList.toggle('kbd--ja', mode === 'ja')
      space.textContent = mode === 'ja' ? '日本語' : lang === 'fr' ? 'espace' : 'space'
      ret.textContent = mode === 'ja' ? '改行' : lang === 'fr' ? 'OK' : 'return'
      cands.replaceChildren()
      if (up) return
      up = true
      phone.iframe.style.height = `${844 - APP_TOP - KEYBOARD_H}px`
      await tween(0.3, k => { el.style.transform = `translateY(${lerp(KEYBOARD_H + 10, 0, k)}px)` }, ease.outCubic)
    },
    async hide() {
      if (!up) return
      up = false
      cands.replaceChildren()
      await tween(0.24, k => { el.style.transform = `translateY(${lerp(0, KEYBOARD_H + 10, k)}px)` }, ease.inCubic)
      phone.iframe.style.height = ''
    },
    press,
    /** The conversion's candidates over the keys (the Japanese mode). */
    candidates(list) {
      cands.replaceChildren(...list.map((c, i) => {
        const s = document.createElement('span')
        s.className = `kbd__cand${i === 0 ? ' kbd__cand--first' : ''}`
        s.textContent = c
        return s
      }))
    },
    /** Where a key is on the board (for a finger that presses return). */
    keyPoint(ch) {
      const key = keyFor(ch)
      if (!key) return null
      const box = key.getBoundingClientRect()
      const scr = screen.getBoundingClientRect()
      // Keys are measured as drawn: back into the screen's own units.
      const s = phone.pose.s
      return phone.screenToBoard((box.left - scr.left) / s + box.width / s / 2, (box.top - scr.top) / s + box.height / s / 2)
    },
  }
  return keyboard
}
