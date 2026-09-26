import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from 'vitest-browser-react'
import { page } from 'vitest/browser'
// The ruby rules under test live in the one stylesheet.
import '../../index.css'
import { ExampleSentence } from './ExampleSentence'

// Furigana that collide are wrong furigana: まいとし|かるいざわ run
// together over 毎年軽井沢 read as one word nobody can divide, and a
// reading that slides over the next kanji reads as that kanji's. These
// tests lay real sentences out in the browser and measure every reading
// against every other one and against every word's kanji, at a
// desktop's width and a phone's, where the line wraps.
//
// The parts are the backend's shape (study/furigana.align_sentence,
// content/vocab_extras._annotate_sentence): one kanji a part, `word`
// saying which morpheme it came from.

const P = (text, reading, word, extra = {}) => ({ text, reading, word, ...extra })
const K = (text, extra = {}) => ({ text, ...extra })

const SENTENCES = {
  // The screenshot: two words side by side, both wider read than written.
  karuizawa: [
    P('彼', 'かれ', 0), K('は'), P('毎', 'まい', 2), P('年', 'とし', 2),
    P('軽', 'かる', 3), P('井', 'い', 3), P('沢', 'ざわ', 3), K('へ'),
    P('行', 'い', 5), K('く。'),
  ],
  // The other screenshot, read right.
  okaasan: [
    K('お', { highlight: true }), P('母', 'かあ', -1, { highlight: true }), K('さん', { highlight: true }),
    K('に'), P('口', 'くち', 4), P('答', 'ごた', 4), K('えしてはいけませんよ。'),
  ],
  // One kana between two long readings, each overhanging into it.
  squeezed: [
    P('東', 'とう', 0), P('京', 'きょう', 0), K('に'), P('承', 'うけたまわ', 2), K('る。'),
  ],
  // Kanji words back to back with no kana anywhere between them.
  packed: [
    P('日', 'に', 0), P('本', 'ほん', 0), P('国', 'こく', 1), P('憲', 'けん', 2), P('法', 'ぽう', 2),
    P('第', 'だい', 3), P('九', 'きゅう', 4), P('条', 'じょう', 5),
  ],
  // A highlight cutting a word: its two halves stay two rubies.
  cut: [
    P('学', 'がく', 0, { highlight: true }), P('生', 'せい', 0), P('寮', 'りょう', 1), K('です。'),
  ],
  // Parts from a source that does not say which word they are.
  anonymous: [
    { text: '毎', reading: 'まい' }, { text: '年', reading: 'とし' },
    { text: '軽', reading: 'かる' }, { text: '井', reading: 'い' }, { text: '沢', reading: 'ざわ' },
  ],
  // Latin and digits beside a ruby: narrower than kana, never overhung.
  latin: [
    K('ＡＢ'), P('社', 'しゃ', 1), K('は'), K('3'), P('本', 'ぼん', 3), P('目', 'め', 4), K('です'),
  ],
  // Long enough to wrap at a phone's width.
  long: [
    P('毎', 'まい', 0), P('朝', 'あさ', 0), K('、'), P('駅', 'えき', 2), P('前', 'まえ', 2), K('の'),
    P('喫', 'きっ', 4), P('茶', 'さ', 4), P('店', 'てん', 4), K('で'), P('新', 'しん', 6), P('聞', 'ぶん', 6),
    K('を'), P('読', 'よ', 8), K('みながら'), P('珈', 'こー', 10), P('琲', 'ひー', 10), K('を'),
    P('飲', 'の', 12), K('み、'), P('一', 'いち', 14), P('日', 'にち', 14), K('の'), P('予', 'よ', 16),
    P('定', 'てい', 16), K('を'), P('確', 'かく', 18), P('認', 'にん', 18), K('します。'),
  ],
}

afterEach(() => cleanup())

async function lay(segments, width) {
  await page.viewport(width, 900)
  const screen = await render(
    <div style={{ width: `${width - 32}px`, margin: '0 16px' }}>
      <ExampleSentence ex={{ jp: segments.map(s => s.text).join(''), segments }} showTr={false} />
    </div>,
  )
  await document.fonts.ready
  return screen.container.querySelector('.dict-ex__jp')
}

// Whether two boxes share any area, with half a pixel of slack for
// subpixel rounding.
const overlaps = (a, b) =>
  a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5

// A ruby's base: the text before its <rt>, as a range, so the box is
// the glyphs' and not the annotation's.
function baseBox(ruby) {
  const range = document.createRange()
  range.setStart(ruby, 0)
  range.setEndBefore(ruby.querySelector('rt'))
  return range.getBoundingClientRect()
}

// The text as printed, without the readings over it.
function baseText(root) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let out = ''
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.parentElement.closest('rt')) out += node.nodeValue
  }
  return out
}

function expectNoCollision(root) {
  const rubies = [...root.querySelectorAll('ruby')]
  const rts = rubies.map(r => r.querySelector('rt').getBoundingClientRect())
  const bases = rubies.map(baseBox)
  for (let i = 0; i < rubies.length; i++) {
    // A reading sits over its own word ...
    expect(rts[i].bottom, `${rubies[i].textContent} sits above its kanji`).toBeLessThanOrEqual(bases[i].top + 2)
    expect(Math.min(rts[i].right, bases[i].right) - Math.max(rts[i].left, bases[i].left),
      `${rubies[i].textContent}'s reading is over its kanji`).toBeGreaterThan(0)
    for (let j = 0; j < rubies.length; j++) {
      if (i === j) continue
      // ... never over another word's reading ...
      if (j > i) {
        expect(overlaps(rts[i], rts[j]), `${rubies[i].textContent} and ${rubies[j].textContent}'s readings collide`).toBe(false)
      }
      // ... and never over another word's kanji: a reading standing
      // over a kanji reads as that kanji's.
      const column = { ...bases[j], top: rts[j].top, bottom: bases[j].bottom }
      expect(overlaps(rts[i], column), `${rubies[i].textContent}'s reading stands over ${rubies[j].textContent}`).toBe(false)
    }
  }
}

describe('ExampleSentence furigana', () => {
  for (const width of [1300, 390, 320]) {
    for (const [name, segments] of Object.entries(SENTENCES)) {
      it(`sets ${name} with no reading over another at ${width}px`, async () => {
        const root = await lay(segments, width)
        expectNoCollision(root)
        // The sentence reads whole, readings aside.
        expect(baseText(root)).toBe(segments.map(s => s.text).join(''))
      })
    }
  }

  it('joins one word\'s readings and never two words\'', async () => {
    const root = await lay(SENTENCES.karuizawa, 1300)
    const rubies = [...root.querySelectorAll('ruby')]
    expect(rubies.map(r => r.querySelector('rt').textContent)).toEqual(['かれ', 'まいとし', 'かるいざわ', 'い'])
    expect(rubies.map(r => r.firstChild.nodeValue)).toEqual(['彼', '毎年', '軽井沢', '行'])
  })

  it('keeps a space between two words\' readings side by side', async () => {
    for (const name of ['karuizawa', 'packed', 'cut']) {
      const root = await lay(SENTENCES[name], 1300)
      const rubies = [...root.querySelectorAll('ruby')]
      for (let i = 0; i + 1 < rubies.length; i++) {
        const a = rubies[i].querySelector('rt').getBoundingClientRect()
        const b = rubies[i + 1].querySelector('rt').getBoundingClientRect()
        // Glyph boxes, not the rt's padded box: what the eye sees.
        const glyphs = el => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect() }
        const ga = glyphs(rubies[i].querySelector('rt'))
        const gb = glyphs(rubies[i + 1].querySelector('rt'))
        if (Math.abs(a.top - b.top) > 2) continue // another line
        expect(gb.left - ga.right, `${name}: ${rubies[i].textContent} | ${rubies[i + 1].textContent}`).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('keeps parts that do not name their word apart', async () => {
    const root = await lay(SENTENCES.anonymous, 1300)
    expect([...root.querySelectorAll('rt')].map(rt => rt.textContent)).toEqual(['まい', 'とし', 'かる', 'い', 'ざわ'])
  })

  it('never joins a word across its highlight', async () => {
    const root = await lay(SENTENCES.cut, 1300)
    expect([...root.querySelectorAll('rt')].map(rt => rt.textContent)).toEqual(['がく', 'せい', 'りょう'])
  })

  it('overhangs kana on both sides only, and centres the reading otherwise', async () => {
    const root = await lay(SENTENCES.squeezed, 1300)
    const [tokyo, uketamawa] = root.querySelectorAll('ruby')
    // 東京 opens the line: nothing to overhang on its left.
    expect(tokyo.classList.contains('dict-ex__ruby--over')).toBe(false)
    // 承 sits between に and る: kana on both sides.
    expect(uketamawa.classList.contains('dict-ex__ruby--over')).toBe(true)
    for (const ruby of [tokyo, uketamawa]) {
      const rt = ruby.querySelector('rt').getBoundingClientRect()
      const base = baseBox(ruby)
      const centre = b => (b.left + b.right) / 2
      expect(Math.abs(centre(rt) - centre(base))).toBeLessThan(1.5)
    }
    // Latin is not overhung: its letters are narrower than a kana.
    const latin = await lay(SENTENCES.latin, 1300)
    expect([...latin.querySelectorAll('.dict-ex__ruby--over')]).toHaveLength(0)
  })

  it('puts the right reading over お母さん, centred on 母', async () => {
    const root = await lay(SENTENCES.okaasan, 1300)
    const ruby = root.querySelector('ruby')
    expect(ruby.firstChild.nodeValue).toBe('母')
    expect(ruby.querySelector('rt').textContent).toBe('かあ')
  })
})
