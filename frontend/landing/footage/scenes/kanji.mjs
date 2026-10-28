// 漢字: the modes, then kanji drawn from their meaning in KanjiVG's
// stroke order, checked against the model and rated; back to the modes.
export default {
  id: 'kanji',
  start: '/learn/kanji/N5',
  async run(page, h) {
    await h.beat(1400)
    await h.press(page.locator('button.platform-card', { hasText: 'Tracer le kanji' }), { after: 3000 })
    for (const q of ['q4', 'q5']) {
      const prompt = (await page.locator('.prompt-card').first().innerText()).toLowerCase()
      const card = [...h.cards].reverse().find(c => c.kanji && c.mode?.includes('write_kanji')
        && prompt.includes(c.meaning.split(/[;,]/)[0].trim().toLowerCase()))
      if (!card) throw new Error(`no kanji for the prompt: ${prompt}`)
      await h.draw(await page.locator('canvas.canvas-board').boundingBox(), await h.strokes(card.kanji, 14), { stepMs: 12, between: 220 })
      await h.beat(600)
      await h.press(page.locator('.drawing-quiz__validate'), { after: 1800 })
      await h.look('checked')
      await h.press(page.locator(`.rating-bar__btn--${q}`), { pause: 300, after: 1200 })
    }
    await h.press(page.locator('button.stage__leave'), { after: 2200 })
  },
}
