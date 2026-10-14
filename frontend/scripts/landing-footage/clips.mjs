// One script per feature clip (landing/config.mjs's CLIPS). Each begins on
// the screen it names and, where the app lets it, ends on the same one, so
// the loop on the page is seamless. A script only does what a learner's
// finger does; the recorder films whatever the app draws in answer.
import { beat, press, button, stroke, glyphStrokes, nextCards } from './helpers.mjs'

const optionN = (page, n) => page.locator('button', { hasText: new RegExp(`^\\s*${n}(?!\\d)`) })

export const CLIPS = {
  // The day's gate: the moon with what is due, Adjust, then Depart through
  // the train's doors to the first card, and back to the gate unanswered.
  aujourdhui: {
    start: '/today',
    async run(page) {
      await beat(page, 900)
      await press(page, byRole(page, 'Adjust'), { after: 1500 })
      await press(page, page.getByRole('tab', { name: /Every mode/ }).or(page.getByText(/^Every mode/)), { after: 1400 })
      await press(page, page.getByRole('tab', { name: /Main cards/ }).or(page.getByText(/^Main cards/)).first(), { after: 1200 })
      await page.keyboard.press('Escape')
      await beat(page, 1000)
      await press(page, page.getByText('Depart', { exact: true }), { after: 3200 })
      await press(page, page.getByText('Tap to reveal').first(), { after: 1800 })
      await press(page, page.getByRole('button', { name: /Gate/ }).first(), { after: 2200 })
    },
  },

  // The kana deck: Draw the kana, the finger's あ, the model's あ, and out.
  kana: {
    start: '/learn/kana/hiragana_basic',
    async run(page) {
      await beat(page, 1300)
      const before = page.cards.length
      await press(page, page.getByText('Draw the kana'), { after: 1800 })
      const card = await nextCards(page, before)
      const canvas = page.locator('canvas').first()
      for (const s of await glyphStrokes(page, card.kana)) await stroke(page, canvas, s, { ms: 480 })
      await beat(page, 600)
      await press(page, button(page, /Reveal answer/), { after: 2400 })
      await press(page, page.getByRole('button', { name: /Sets|Kana/ }).first(), { after: 1500 })
    },
  },

  // Vocabulary: a card turned, the answer rated, the next one in.
  vocabulaire: {
    start: '/learn/vocab/N5',
    async run(page) {
      await beat(page, 1300)
      await press(page, page.getByText('Word → meaning').first(), { after: 2200 })
      await press(page, page.getByText('Tap to reveal'), { after: 2000 })
      await press(page, button(page, /^Correct/), { after: 2200 })
      await press(page, page.getByText('Tap to reveal'), { after: 1800 })
      await press(page, button(page, /^Difficult/), { after: 2200 })
      await press(page, page.getByText('Tap to reveal'), { after: 1800 })
      await press(page, page.getByRole('button', { name: /Vocabulary/ }).first(), { after: 1500 })
    },
  },

  // Kanji: the glyph written from memory, checked against the model, then
  // the dictionary entry, where its strokes draw themselves in order.
  kanji: {
    start: '/learn/kanji/N5',
    async run(page) {
      const before = page.cards.length
      await press(page, page.getByText('Draw the kanji'), { after: 1800 })
      const card = await nextCards(page, before)
      const canvas = page.locator('canvas').first()
      for (const s of await glyphStrokes(page, card.kanji)) await stroke(page, canvas, s, { ms: 380 })
      await beat(page, 500)
      await press(page, button(page, /Reveal answer/), { after: 1800 })
      await press(page, page.locator('button[aria-label="Open dictionary entry"]'), { after: 6500 })
      await press(page, button(page, /^Close/), { after: 1400 })
      await press(page, page.getByRole('button', { name: /^Kanji/ }).first(), { after: 1500 })
    },
  },

  // Grammar: a point's lesson, then the question that asks for it, checked.
  grammaire: {
    start: '/learn/grammar/N5',
    async run(page) {
      await press(page, page.getByText('Climb the ladder'), { after: 2400 })
      const idea = page.getByRole('button', { name: 'I have an idea' })
      if (await idea.count()) {
        await page.mouse.wheel(0, 260)
        await beat(page, 1800)
        await press(page, idea, { after: 1600 })
      }
      const choices = await correctChoice(page)
      await press(page, choices, { after: 900 })
      await press(page, button(page, /^Check/), { after: 2800 })
      await press(page, page.getByRole('button', { name: /^Grammar/ }).first(), { after: 1500 })
    },
  },

  // Reading practice: the sentence shown against the clock, typed back in
  // romaji, then checked against the right reading.
  pratique: {
    start: '/practice',
    async run(page) {
      await press(page, page.getByRole('link', { name: 'Reading practice — N5' }).or(page.getByText('N5').first()), { after: 1800 })
      await press(page, page.locator('button[aria-label="Show the sentence and start the timer"]'), { after: 2600 })
      const shown = (await page.locator('main').innerText()).match(/[\u3040-\u30ff\u4e00-\u9fff]+[^\n]*/)?.[0]
      const phrase = page.batches.flatMap(b => b.phrases || []).find(p => shown && shown.startsWith(p.phrase.slice(0, 4)))
      const input = page.locator('input[placeholder^="e.g."]')
      await press(page, input, { after: 400 })
      await page.keyboard.type((phrase?.romaji || 'konnichiwa').replace(/[.!?。]/g, ''), { delay: 85 })
      await beat(page, 600)
      await press(page, button(page, /^Submit/), { after: 3200 })
      await press(page, page.getByText('Levels', { exact: true }).first(), { after: 1000 })
      await press(page, page.getByRole('link', { name: /^Practice/ }).last(), { after: 1400 })
    },
  },

  // The analyser: a sentence typed, taken apart, its grammar numbered, a
  // word opened.
  analyseur: {
    start: '/dictionary/analyzer',
    async run(page) {
      await press(page, page.getByPlaceholder(/Paste Japanese/), { after: 500 })
      await page.keyboard.type('駅で友達を待っています。', { delay: 140 })
      await beat(page, 700)
      await press(page, button(page, /^Analyze/), { after: 2600 })
      await press(page, page.locator('button.tok--unknown'), { after: 3600 })
      await press(page, button(page, /^Close/), { after: 1200 })
      await page.mouse.wheel(0, 700)
      await beat(page, 2000)
      await page.mouse.wheel(0, -1400)
      await beat(page, 700)
    },
  },

  // A mock exam: the paper, the clock, every question answered at a good
  // pace, the paper handed in, then the score and the correction.
  examen: {
    start: '/practice/exam',
    async run(page) {
      await press(page, button(page, /^Start/), { after: 2000 })
      await press(page, button(page, /^Start/), { after: 1500 })
      const questions = page.papers.at(-1).sections.flatMap(s => s.mondai.flatMap(m => m.questions))
      const missed = new Set([3, 10, 14]) // a learner at N5 gets most of it right
      for (const [i, q] of questions.entries()) {
        const right = q.choices.findIndex(c => c.id === q.answer)
        const pick = missed.has(i) ? (right + 1) % q.choices.length : right
        await press(page, optionN(page, pick + 1), { before: 100, after: 280, steps: 3 })
        if (i < questions.length - 1) await press(page, button(page, /^Next/), { before: 100, after: 330, steps: 3 })
      }
      await press(page, button(page, /Sheet/), { after: 1500 })
      await press(page, button(page, /Finish the paper/), { after: 1500 })
      const confirm = button(page, /^(Finish|Hand in|Submit)/)
      if (await confirm.filter({ visible: true }).count()) await press(page, confirm, { after: 3500 })
      await beat(page, 2500)
    },
  },
}

// The computer's clips (1440×900). The desk draws its own screens and answers
// to keys as well as to the pointer, so these press where the phone's taps
// and hit Space and Enter where a desk learner does; kana's script is the
// phone's own, since the drawing is the same.
const DESK = {
  aujourdhui: {
    start: '/today',
    async run(page) {
      await beat(page, 600)
      await press(page, page.getByText(/^Every mode/), { after: 1500 })
      await press(page, page.getByText(/^Main cards/).first(), { after: 1200 })
      await press(page, page.getByText('20', { exact: true }), { after: 1200 })
      await press(page, page.getByText('All', { exact: true }), { after: 1200 })
      await press(page, page.getByText('Depart', { exact: true }), { after: 3600 })
      await page.keyboard.press('Space')
      await beat(page, 2200)
      await press(page, page.getByRole('button', { name: /^Gate/ }).first(), { after: 2400 })
    },
  },

  vocabulaire: {
    start: '/learn/vocab/N5',
    async run(page) {
      await press(page, page.getByText('Word → meaning').first(), { after: 2200 })
      await page.keyboard.press('Space')
      await beat(page, 2200)
      await press(page, button(page, /^Correct/), { after: 2200 })
      await page.keyboard.press('Space')
      await beat(page, 2000)
      await press(page, button(page, /^Difficult/), { after: 2200 })
      await press(page, page.getByRole('button', { name: /^Vocabulary/ }).first(), { after: 1500 })
    },
  },

  kanji: {
    start: '/learn/kanji/N5',
    async run(page) {
      const before = page.cards.length
      await press(page, page.getByText('Draw the kanji'), { after: 1800 })
      const card = await nextCards(page, before)
      const canvas = page.locator('canvas').first()
      for (const s of await glyphStrokes(page, card.kanji)) await stroke(page, canvas, s, { ms: 380 })
      await beat(page, 500)
      await press(page, button(page, /Reveal answer/), { after: 7000 })
      await press(page, page.getByRole('button', { name: /^Kanji/ }).first(), { after: 1500 })
    },
  },

  grammaire: {
    start: '/learn/grammar/N5',
    async run(page) {
      await press(page, page.getByText('The ladder'), { after: 2800 })
      const idea = page.getByRole('button', { name: 'I have an idea' })
      if (await idea.count()) {
        await beat(page, 2200)
        await press(page, idea, { after: 1600 })
      }
      await press(page, await correctChoice(page), { after: 900 })
      await press(page, button(page, /^Check/), { after: 3200 })
      await press(page, page.getByRole('button', { name: /^Grammar/ }).first(), { after: 1500 })
    },
  },

  pratique: {
    start: '/practice',
    async run(page) {
      await press(page, page.locator('main button').first(), { after: 1800 })
      await beat(page, 900)
      await page.keyboard.press('Enter')
      await beat(page, 2600)
      await press(page, page.locator('button[aria-label="Show the sentence and start the timer"]'), { after: 2600 })
      const shown = (await page.locator('main').innerText()).match(/[\u3040-\u30ff\u4e00-\u9fff]+[^\n]*/)?.[0]
      const phrase = page.batches.flatMap(b => b.phrases || []).find(p => shown && shown.startsWith(p.phrase.slice(0, 4)))
      await press(page, page.locator('input[placeholder^="e.g."]'), { after: 400 })
      await page.keyboard.type((phrase?.romaji || 'konnichiwa').replace(/[.!?。]/g, ''), { delay: 85 })
      await beat(page, 600)
      await page.keyboard.press('Enter')
      await beat(page, 3600)
    },
  },

  analyseur: {
    start: '/dictionary/analyzer',
    async run(page) {
      await press(page, page.locator('textarea'), { after: 500 })
      await page.keyboard.type('駅で友達を待っています。', { delay: 140 })
      await beat(page, 700)
      await press(page, button(page, /^Analyze/), { after: 2800 })
      await press(page, page.locator('button.tok--unknown'), { after: 3800 })
      await page.keyboard.press('Escape')
      await beat(page, 1800)
    },
  },

  examen: {
    start: '/practice/exam',
    async run(page) {
      await beat(page, 900)
      await page.keyboard.press('Enter')
      await beat(page, 3200)
      await page.keyboard.press('Enter')
      await beat(page, 2000)
      const questions = page.papers.at(-1).sections.flatMap(s => s.mondai.flatMap(m => m.questions))
      const missed = new Set([3, 10, 14])
      for (const [i, q] of questions.entries()) {
        const right = q.choices.findIndex(c => c.id === q.answer)
        const pick = missed.has(i) ? (right + 1) % q.choices.length : right
        await beat(page, 260)
        await page.keyboard.press(String(pick + 1))
        await beat(page, 320)
        if (i < questions.length - 1) { await page.keyboard.press('ArrowRight'); await beat(page, 180) }
      }
      await press(page, button(page, /Finish the paper/), { after: 1600 })
      const confirm = button(page, /^(Finish|Hand in|Submit)/)
      if (await confirm.filter({ visible: true }).count()) await press(page, confirm, { after: 3500 })
      await beat(page, 3000)
    },
  },
}
for (const [id, desk] of Object.entries(DESK)) CLIPS[id].desk = desk
CLIPS.kana.desk = { start: '/learn/kana/hiragana_basic', run: CLIPS.kana.run }

async function correctChoice(page) {
  const cards = page.cards.flatMap(b => b?.cards || [])
  const text = await page.evaluate(() => {
    const root = document.querySelector('main') || document.body
    const c = root.cloneNode(true)
    c.querySelectorAll('rt, rp').forEach(n => n.remove())
    return c.textContent.replace(/\s+/g, '')
  })
  let want
  for (const c of cards) {
    const jp = (c.contrast?.furigana || []).map(t => t.text).join('').replace(/\s+/g, '')
    if (c.contrast?.answer && jp && text.includes(jp.replace('＿＿＿', ''))) { want = c.contrast.answer; break }
    if (text.includes(`What does ${c.grammar} mean?`)) { want = c.meaning; break }
  }
  const options = page.locator('button', { hasText: /^\s*\d(?!\d)/ })
  if (want) {
    const hit = options.filter({ hasText: want })
    if (await hit.count()) return hit.first()
  }
  return options.first()
}

function byRole(page, name) { return page.getByRole('button', { name }) }
export { optionN }
