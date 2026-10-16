// ── 掴み — the hook: the moment before the app (plan 210) ──────────────
// The first second and a half of a short video decides whether it is
// watched, and the reel spends it on a moment every learner has had:
// Japanese in front of you, and no way in. Each hook draws a place and
// an object in it carrying the script's text (a sign, a departure board,
// a menu, a page, a message, or the creator's own photo or footage),
// and plays the beat of not being able to read it.
//
// Every character of the text is its own span, so a transition can take
// the text off the object and carry it into the app (transitions.js),
// and `subject` says where the text stands on the board, which is what
// the phone's camera frames when it is raised.

import { tween, wait, ease, lerp, every, drift, seeded } from './clock'

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

// Where a line may break: between words only (the breakdown's tokens,
// set by buildHook), as a printed sign is set; `word-break: keep-all`
// on the text forbids every other break.
let breakAt = new Set()

/** The text as spans, one per character (kept for the lift). */
function chars(text, cls = 'obj__ch') {
  return [...text].map((c, i) => {
    if (c === '\n') return '<br>'
    const wbr = i > 0 && breakAt.has(i) ? '<wbr>' : ''
    return `${wbr}<span class="${cls}">${esc(c)}</span>`
  }).join('')
}

// ── Places ─────────────────────────────────────────────────────────
// A blurred world behind the object: lights out of focus, as a phone
// camera focused on a sign at night would see them.
function bokeh(rnd, count, palette, area = { x: [0, 432], y: [0, 560] }) {
  let out = ''
  for (let i = 0; i < count; i++) {
    const size = 14 + rnd() * 70
    const x = area.x[0] + rnd() * (area.x[1] - area.x[0])
    const y = area.y[0] + rnd() * (area.y[1] - area.y[0])
    const color = palette[Math.floor(rnd() * palette.length)]
    const a = 0.25 + rnd() * 0.45
    out += `<i class="bokeh" style="left:${x - size / 2}px;top:${y - size / 2}px;width:${size}px;height:${size}px;--c:${color};opacity:${a}"></i>`
  }
  return out
}

const PLACES = {
  street: rnd => `<div class="place place--street">${bokeh(rnd, 26, ['#ffb35c', '#ff6f4f', '#7fb4ff', '#ffe08a', '#c58bff'])}<div class="place__ground"></div></div>`,
  platform: rnd => `<div class="place place--platform">${bokeh(rnd, 16, ['#fff2cf', '#bfe3ff', '#ffd27a'], { x: [0, 432], y: [0, 300] })}<div class="place__edge"></div><div class="place__tactile"></div></div>`,
  izakaya: rnd => `<div class="place place--izakaya">${bokeh(rnd, 18, ['#ffb24a', '#ff7a3d', '#ffd98a'])}</div>`,
  desk: () => '<div class="place place--desk"><div class="place__lamp"></div></div>',
  cafe: rnd => `<div class="place place--cafe">${bokeh(rnd, 22, ['#ffd7a0', '#ffffff', '#ffb877', '#d9c2ff'])}</div>`,
}

// ── Objects ────────────────────────────────────────────────────────
function signNotice(beat) {
  const title = beat.title ?? (beat.style === 'construction' ? '工事中' : 'お知らせ')
  const sub = beat.sub ? `<p class="sign__sub" lang="ja">${chars(beat.sub, 'obj__ch obj__ch--sub')}</p>` : ''
  if (beat.style === 'construction') {
    return `
      <div class="obj sign-wrap">
        <div class="sign__legs"><i></i><i></i></div>
        <div class="sign sign--construction" data-object>
          <div class="sign__lamp"></div>
          <div class="sign__frame"><div class="sign__panel">
            <div class="sign__title" lang="ja">${esc(title)}</div>
            <p class="sign__text" lang="ja" data-subject>${chars(beat.text)}</p>
            ${sub}
          </div></div>
        </div>
      </div>`
  }
  return `
    <div class="obj sign-wrap">
      <i class="sign__pole"></i>
      <div class="sign sign--notice" data-object>
        <div class="sign__screws"><i></i><i></i><i></i><i></i></div>
        <div class="sign__title" lang="ja">${esc(title)}</div>
        <p class="sign__text" lang="ja" data-subject>${chars(beat.text)}</p>
        ${sub}
        <div class="sign__foot" lang="ja">${esc(beat.from ?? '管理事務所')}</div>
      </div>
    </div>`
}

function signStation(beat) {
  const prev = beat.prev ?? 'しぶや'
  const next = beat.next ?? 'はらじゅく'
  return `
    <div class="obj sign sign--station" data-object>
      <div class="sign__kana" lang="ja">${esc(beat.reading ?? '')}</div>
      <p class="sign__text sign__text--station" lang="ja" data-subject>${chars(beat.text)}</p>
      <div class="sign__latin">${esc(beat.romaji ?? '')}</div>
      <div class="sign__band"><span lang="ja">← ${esc(prev)}</span><span lang="ja">${esc(next)} →</span></div>
    </div>`
}

function signStreet(beat) {
  return `
    <div class="obj sign-wrap">
      <i class="sign__pole"></i>
      <div class="sign sign--street" data-object>
        <div class="sign__arrows"><span>←</span><span>↑</span><span>→</span></div>
        <p class="sign__text" lang="ja" data-subject>${chars(beat.text)}</p>
        ${beat.sub ? `<p class="sign__sub" lang="ja">${chars(beat.sub, 'obj__ch obj__ch--sub')}</p>` : ''}
      </div>
    </div>`
}

function signShop(beat) {
  return `
    <div class="obj sign sign--shop" data-object>
      <div class="sign__noren"><i></i><i></i><i></i></div>
      <p class="sign__text sign__text--v" lang="ja" data-subject>${chars(beat.text)}</p>
    </div>`
}

function boardDepartures(beat) {
  const rows = beat.rows ?? [
    ['12:34', '各停', 'しぶや', '2'],
    ['12:41', '快速', 'しんじゅく', '3'],
    ['12:48', '特急', 'よこはま', '1'],
  ]
  return `
    <div class="obj led" data-object>
      <div class="led__head" lang="ja"><span>時刻</span><span>種別</span><span>行先</span><span>番線</span></div>
      ${rows.map((r, i) => `<div class="led__row led__row--${i}" lang="ja"><span>${esc(r[0])}</span><span class="led__kind">${esc(r[1])}</span><span>${esc(r[2])}</span><span>${esc(r[3])}</span></div>`).join('')}
      <div class="led__ticker"><p class="led__text" lang="ja" data-subject>${chars(beat.text)}</p></div>
      <div class="led__dots"></div>
    </div>`
}

function menuWall(beat) {
  const items = beat.items ?? [['らーめん', '八五〇'], ['ぎょうざ', '四〇〇'], ['ちゃーはん', '六〇〇'], ['からあげ', '五〇〇'], ['なま', '五五〇']]
  return `
    <div class="obj menu" data-object>
      <div class="menu__slats">${items.map(([name, price]) => `<div class="menu__slat" lang="ja"><b>${esc(name)}</b><small>${esc(price)}</small></div>`).join('')}</div>
      <div class="menu__paper"><p class="menu__text" lang="ja" data-subject>${chars(beat.text)}</p></div>
    </div>`
}

function pageManga(beat) {
  return `
    <div class="obj manga" data-object>
      <div class="manga__panel manga__panel--a">
        <div class="manga__lines"></div>
        <div class="manga__bubble"><p class="manga__text" lang="ja" data-subject>${chars(beat.text)}</p></div>
      </div>
      <div class="manga__panel manga__panel--b"><div class="manga__tone"></div><span class="manga__sfx" lang="ja">${esc(beat.sfx ?? 'ドキッ')}</span></div>
      <div class="manga__panel manga__panel--c"><div class="manga__tone manga__tone--dark"></div><div class="manga__bubble manga__bubble--small"><span lang="ja">…！</span></div></div>
    </div>`
}

// Neutral prose around the reel's sentence on a page of a novel.
const PROSE = ['駅の前に小さな本屋がある。', '朝はいつも同じ電車に乗る。', '窓の外は、もう暗くなっていた。', '彼女は何も言わずに笑った。']

function pageBook(beat) {
  const before = beat.before ?? PROSE.slice(0, 2)
  const after = beat.after ?? PROSE.slice(2)
  return `
    <div class="obj book" data-object>
      <div class="book__page">
        <div class="book__cols" lang="ja">
          ${before.map(s => `<p class="book__col book__col--dim">${esc(s)}</p>`).join('')}
          <p class="book__col book__text" data-subject>${chars(beat.text)}</p>
          ${after.map(s => `<p class="book__col book__col--dim">${esc(s)}</p>`).join('')}
        </div>
        <div class="book__folio">${esc(beat.folio ?? '一二七')}</div>
      </div>
    </div>`
}

function pageLetter(beat) {
  return `
    <div class="obj letter" data-object>
      <p class="letter__to" lang="ja">${esc(beat.to ?? 'お元気ですか。')}</p>
      <p class="letter__text" lang="ja" data-subject>${chars(beat.text)}</p>
      <p class="letter__from" lang="ja">${esc(beat.from ?? 'ゆき')}</p>
    </div>`
}

function chatMessage(beat) {
  return `
    <div class="obj chat" data-object>
      <div class="chat__head"><span class="chat__avatar">${esc((beat.from ?? 'ゆき').slice(0, 1))}</span><b lang="ja">${esc(beat.from ?? 'ゆき')}</b></div>
      <div class="chat__body">
        ${beat.before ? `<div class="chat__bubble chat__bubble--them" lang="ja">${esc(beat.before)}</div>` : ''}
        <div class="chat__bubble chat__bubble--them chat__bubble--main"><p class="chat__text" lang="ja" data-subject>${chars(beat.text)}</p></div>
        <div class="chat__typing"><i></i><i></i><i></i></div>
      </div>
    </div>`
}

function media(beat, files) {
  const src = files(beat.file)
  if (beat.style === 'video') {
    return `<div class="obj obj--media"><img class="media__frame" alt="" data-frames="${esc(beat.frames ?? '')}" src="${esc(src)}"></div>`
  }
  return `<div class="obj obj--media"><img class="media__img" alt="" src="${esc(src)}">${beat.text ? `<p class="media__text" lang="ja" data-subject>${chars(beat.text)}</p>` : ''}</div>`
}

const OBJECTS = {
  sign: beat => ({ notice: signNotice, construction: signNotice, station: signStation, street: signStreet, shop: signShop })[beat.style](beat),
  board: boardDepartures,
  menu: menuWall,
  page: beat => ({ manga: pageManga, book: pageBook, letter: pageLetter })[beat.style](beat),
  chat: chatMessage,
  media,
}

const PLACE_OF = {
  sign: beat => (beat.style === 'station' ? 'platform' : beat.style === 'shop' ? 'izakaya' : 'street'),
  board: () => 'platform',
  menu: () => 'izakaya',
  page: beat => (beat.style === 'manga' ? 'cafe' : 'desk'),
  chat: () => 'cafe',
  media: () => null,
}

/** Shrink the object's text until it fits its box (the sign's width). */
function fit(el, { max, min, lines = 2 }) {
  if (!el) return
  const vertical = getComputedStyle(el).writingMode.startsWith('vertical')
  for (let size = max; size >= min; size -= 1) {
    el.style.fontSize = `${size}px`
    const lh = parseFloat(getComputedStyle(el).lineHeight) || size * 1.3
    const extent = vertical ? el.scrollWidth : el.scrollHeight
    const box = vertical ? el.clientWidth : el.clientHeight
    const overflow = vertical ? el.scrollHeight > el.clientHeight + 1 : el.scrollWidth > el.clientWidth + 1
    if (!overflow && extent <= Math.max(box, lh * lines + 2)) return
  }
}

/**
 * Build the hook's world in `layer`: { scene, subjectRect(), feed(), … }.
 * `files` maps a script's own file name to the URL it is served at.
 */
export function buildHook(beat, layer, { seed = 7, files = f => f, breaks = [] } = {}) {
  const rnd = seeded(seed * 31 + 7)
  breakAt = new Set(breaks)
  const placeName = beat.place ?? PLACE_OF[beat.scene](beat)
  const scene = document.createElement('div')
  scene.className = `scene scene--${beat.scene} scene--${beat.style}${breaks.length ? ' scene--words' : ''}`
  scene.innerHTML = `${placeName ? PLACES[placeName](rnd) : ''}<div class="scene__obj">${OBJECTS[beat.scene](beat, files)}</div>`
  layer.appendChild(scene)

  const text = scene.querySelector('[data-subject]')
  const fits = {
    sign: { max: beat.style === 'station' ? 64 : 40, min: 16, lines: beat.style === 'station' ? 1 : 3 },
    board: { max: 22, min: 12, lines: 2 },
    menu: { max: 20, min: 12, lines: 6 },
    page: { max: beat.style === 'manga' ? 22 : 19, min: 11, lines: 12 },
    chat: { max: 19, min: 13, lines: 5 },
    media: { max: 28, min: 14, lines: 3 },
  }
  fit(text, fits[beat.scene])

  // The head that holds the camera: a slow push and a handheld drift.
  const head = { zoom: 1, x: 0, y: 0, shake: 1 }
  const hx = drift(seed * 5 + 1)
  const hy = drift(seed * 5 + 2)
  const hr = drift(seed * 5 + 3)
  const stop = every(t => {
    const a = head.shake
    scene.style.transform = `translate(${head.x + hx(t * 0.8) * 2.4 * a}px, ${head.y + hy(t * 0.8) * 2.8 * a}px) rotate(${hr(t * 0.7) * 0.35 * a}deg) scale(${head.zoom})`
  })

  const hook = {
    beat,
    scene,
    text,
    head,
    /** Where the text stands on the board, as drawn now. */
    subjectRect() {
      const r = (text ?? scene.querySelector('.obj')).getBoundingClientRect()
      return { x: r.left, y: r.top, w: r.width, h: r.height }
    },
    /** The object's own body (the sign, the board, the page), on the board. */
    objectRect() {
      const r = (scene.querySelector('[data-object]') ?? scene.querySelector('.obj')).getBoundingClientRect()
      return { x: r.left, y: r.top, w: r.width, h: r.height }
    },
    /** One rect per character, on the board (for the lift). */
    charRects() {
      return [...scene.querySelectorAll('[data-subject] .obj__ch')].map(el => {
        const r = el.getBoundingClientRect()
        return { ch: el.textContent, x: r.left, y: r.top, w: r.width, h: r.height, size: parseFloat(getComputedStyle(el).fontSize) }
      })
    },
    /**
     * A still copy of the world framing the text, `w`×`h`, for the
     * phone's viewfinder and the photo: the subject centred, filling
     * `fill` of the width.
     */
    feed(container, w, h, fill = 0.8) {
      // Measured in the scene's own frame: the head's drift and lean off.
      const held = scene.style.transform
      scene.style.transform = 'none'
      const r = hook.subjectRect()
      const base = scene.getBoundingClientRect()
      scene.style.transform = held
      const copy = scene.cloneNode(true)
      copy.classList.add('scene--feed')
      // The copy keeps the board's size, so it lays out as the world did.
      Object.assign(copy.style, {
        position: 'absolute', left: '0', top: '0', right: 'auto', bottom: 'auto',
        width: `${base.width}px`, height: `${base.height}px`, transformOrigin: '0 0',
      })
      container.replaceChildren(copy)
      const s = Math.min((w * fill) / r.w, (h * 0.62) / r.h, 3.2)
      const cx = r.x - base.left + r.w / 2
      const cy = r.y - base.top + r.h / 2
      copy.style.transform = `translate(${w / 2 - cx * s}px, ${h / 2 - cy * s}px) scale(${s})`
      return copy
    },
    /** Push the head in on the text, as a reader leaning closer. */
    lean(zoom = 1.12, seconds = 1.6) {
      const r = hook.subjectRect()
      const from = { ...head }
      // Keep the text's centre where it is while the scene scales.
      const cx = r.x + r.w / 2
      const cy = r.y + r.h / 2
      return tween(seconds, k => {
        head.zoom = lerp(from.zoom, zoom, k)
        head.x = lerp(from.x, (216 - cx) * (zoom - 1) * 0.6, k)
        head.y = lerp(from.y, (330 - cy) * (zoom - 1) * 0.6, k)
      }, ease.inOutSine)
    },
    dispose() {
      stop()
      scene.remove()
    },
  }
  return hook
}

/** The beat of not reading it: question marks around the text. */
export async function puzzle(hook, fxLayer, { count = 3, seed = 7, sound } = {}) {
  const rnd = seeded(seed * 13 + 5)
  const r = hook.objectRect()
  // Around the object's shoulders, never over its text.
  const spots = [
    { x: r.x - 14, y: r.y - 6, rot: -18 },
    { x: r.x + r.w - 22, y: r.y - 46, rot: 12 },
    { x: r.x + r.w - 4, y: r.y + r.h * 0.38, rot: 20 },
  ]
  const marks = []
  for (let i = 0; i < count; i++) {
    const el = document.createElement('span')
    el.className = 'fx__q'
    el.textContent = i === count - 1 ? '？' : '?'
    const spot = spots[i % spots.length]
    el.style.left = `${Math.max(6, Math.min(396, spot.x + (rnd() - 0.5) * 8))}px`
    el.style.top = `${Math.max(36, spot.y + (rnd() - 0.5) * 8)}px`
    fxLayer.appendChild(el)
    marks.push({ el, rot: spot.rot + (rnd() - 0.5) * 10 })
  }
  for (const [i, m] of marks.entries()) {
    sound?.(i)
    tween(0.42, k => {
      m.el.style.opacity = String(Math.min(1, k * 2))
      m.el.style.transform = `translateY(${lerp(14, 0, k)}px) rotate(${m.rot}deg) scale(${lerp(0.4, 1, k)})`
    }, ease.outBack)
    await wait(0.24)
  }
  return {
    async clear() {
      await tween(0.25, k => { marks.forEach(m => { m.el.style.opacity = String(1 - k) }) }, ease.inCubic)
      marks.forEach(m => m.el.remove())
    },
  }
}
