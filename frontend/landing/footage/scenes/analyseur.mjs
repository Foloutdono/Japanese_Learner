// 解析: a sentence typed into the analyser and read part by part: a
// word's entry, the grammar it found, a particle's point; back to the
// dictionary, so the loop closes where it opened.
export default {
  id: 'analyseur',
  start: '/dictionary',
  async run(page, h) {
    await h.beat(1400)
    await h.press(page.locator('button.anl-door__open'), { after: 1300 })
    await h.press(page.locator('textarea.anl-entry__field, textarea.anl-slip__field'), { pause: 300, after: 400 })
    // A word at a time, as an IME commits them.
    for (const chunk of ['駅で', '友達を', '待っています。']) {
      await page.keyboard.insertText(chunk)
      await h.beat(520)
    }
    await h.press(page.locator('button.anl-action'), { pause: 500, after: 2400 })
    await h.press(page.getByRole('button', { name: 'Aller à 駅' }), { after: 2600 })
    await h.look('word')
    if (h.desk) {
      // The desk keeps the words, the grammar and the entry in columns.
      await h.press(page.getByRole('button', { name: 'Aller à を' }), { after: 2600 })
      await h.press(page.locator('.bkd-point').filter({ hasText: 'ています' }), { after: 2600 })
    } else {
      await h.press(page.getByRole('button', { name: 'Fermer' }), { pause: 300, after: 1000 })
      await h.press(page.locator('button.anl-m__tool', { hasText: 'Grammaire' }), { after: 2600 })
      await h.look('grammar')
      await page.mouse.click(180, 120)                                     // the sheet's scrim
      await h.beat(1000)
      await h.press(page.getByRole('button', { name: 'Aller à を' }), { after: 2600 })
      await h.press(page.getByRole('button', { name: 'Fermer' }), { pause: 300, after: 1000 })
    }
    await h.press(page.locator('button.stage__leave'), { after: 1200 })
    await h.press(h.desk ? page.locator('a.desk-gate', { hasText: /dictionnaire/i }) : page.locator('button.stage__leave'), { after: 2000 })
  },
}
