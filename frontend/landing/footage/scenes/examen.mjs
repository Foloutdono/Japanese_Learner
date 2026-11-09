// 模試: a mock paper at N5 -- its cover, the clock started, questions
// answered as one who knows them, a jump through the answer sheet to
// the next part; back to the papers, so the loop closes where it opened.
async function answer(page, h, { pause = 1100 } = {}) {
  const text = await page.locator('main').innerText()
  const prompt = Object.keys(h.keys).filter(p => text.includes(p)).sort((a, b) => b.length - a.length)[0]
  if (!prompt) throw new Error('no question of the paper is on the screen')
  await h.press(page.locator('button.exam-tile, button.desk-choice').filter({ hasText: h.keys[prompt] }), { pause, after: 900 })
}

export default {
  id: 'examen',
  start: '/practice/exam',
  prepare(page, h) {
    h.keys = {}
    page.on('response', async r => {
      if (!/\/api\/exams\/[^/]+$/.test(r.url().split('?')[0])) return
      try {
        for (const s of (await r.json()).sections ?? []) for (const m of s.mondai ?? []) for (const q of m.questions ?? []) {
          h.keys[q.promptJp ?? q.id] = q.choices.find(c => c.id === q.answer)?.textJp
        }
      } catch { /* not JSON */ }
    })
  },
  async run(page, h) {
    await h.beat(1400)
    await h.press(page.locator('button.exam-st__go, button.btn-depart'), { after: 2200 })
    await h.press(page.locator('button.exam-cover__go, main button.btn-depart'), { pause: 900, after: 2000 })
    for (let i = 0; i < 4; i++) {
      await answer(page, h)
      await h.press(page.locator('button.exam-dock__go--next, button.desk-turn--next'), { pause: 300, after: 900 })
    }
    // The phone opens its answer sheet; the desk has it beside the paper.
    if (!h.desk) await h.press(page.locator('button.exam-run__sheet'), { after: 2000 })
    await h.press(page.getByRole('button', { name: 'Question 8, vide' }), { after: 1500 })
    await answer(page, h, { pause: 1500 })
    await h.look('answered')
    await h.beat(800)
    await h.press(page.locator('button.exam-run__leave, button.stage__leave'), { after: 1300 })
    await h.press(page.getByRole('button', { name: 'Quitter' }).last(), { pause: 700, after: 2200 })
  },
}
