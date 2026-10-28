// 仮名: the line's modes, then kana drawn from their sound, stroke by
// stroke in KanjiVG's order, checked against the model and rated, and
// back to the modes, so the loop closes where it opened.
const KANA = { a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お', ka: 'か', ki: 'き', ku: 'く', ke: 'け', ko: 'こ', sa: 'さ', shi: 'し', su: 'す', se: 'せ', so: 'そ', ta: 'た', chi: 'ち', tsu: 'つ', te: 'て', to: 'と' }

export default {
  id: 'kana',
  start: '/learn/kana/hiragana_basic',
  async run(page, h) {
    await h.beat(1400)
    await h.press(page.locator('button.platform-card', { hasText: 'Tracer le kana' }), { after: 3000 })
    for (const q of ['q4', 'q5']) {
      const prompt = await page.locator('.prompt-card').first().innerText()
      const kana = KANA[prompt.split('\n').map(s => s.trim()).find(s => KANA[s])]
      if (!kana) throw new Error(`no kana for the prompt: ${prompt}`)
      await h.draw(await page.locator('canvas.canvas-board').boundingBox(), await h.strokes(kana))
      await h.beat(600)
      await h.press(page.locator('.drawing-quiz__validate'), { after: 1700 })
      await h.look('checked')
      await h.press(page.locator(`.rating-bar__btn--${q}`), { pause: 300, after: 1200 })
    }
    await h.press(page.locator('button.stage__leave'), { after: 2200 })
  },
}
