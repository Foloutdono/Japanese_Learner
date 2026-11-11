// 本日: the gate, the day's service turned over, departure, three cards
// answered, and back on the gate, so the loop closes where it opened.
export default {
  id: 'aujourdhui',
  start: '/today',
  async run(page, h) {
    await h.beat(1800)
    // The phone opens the service from its door; the desk has it open.
    if (!h.desk) await h.press(page.getByRole('button', { name: /Ajuster/ }), { after: 1000 })
    await h.look('service')
    await h.press(page.getByRole('radio', { name: /Tous les modes/ }), { after: 900 })
    await h.press(page.getByRole('radio', { name: /Principales/ }), { after: 1000 })
    if (!h.desk) {
      await page.keyboard.press('Escape')
      await h.beat(900)
    }
    await h.press(page.locator('button.btn-depart'), { after: 3600 })
    for (const q of ['q4', 'q5', 'q4']) {
      await h.beat(700)
      await h.press(page.locator('.flashcard'), { pause: 200, after: 1100 })
      await h.look('revealed')
      await h.press(page.locator(`.rating-bar__btn--${q}`), { pause: 300, after: 500 })
    }
    await h.beat(600)
    await h.press(page.locator('button.stage__leave'), { after: 2400 })
  },
}
