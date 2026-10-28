// 語彙: the modes, then words answered as one who knows them: twice
// from the four choices, once on the card alone, and back to the modes.
async function rightChoice(page, h) {
  const word = (await page.locator('.prompt-card').first().innerText()).split('\n')[0].trim()
  const meaning = (h.cardFor(word)?.meaning ?? '').split(/[,·;(]/)[0].trim().toLowerCase()
  const rows = page.locator('button.mcq-row')
  for (let i = 0; i < await rows.count(); i++) {
    if (meaning && (await rows.nth(i).innerText()).toLowerCase().includes(meaning)) return rows.nth(i)
  }
  throw new Error(`no choice reads "${meaning}" for ${word}`)
}

export default {
  id: 'vocabulaire',
  start: '/learn/vocab/N5',
  async run(page, h) {
    await h.beat(1400)
    await h.press(page.locator('button.platform-card', { hasText: 'Mot → sens' }), { after: 3000 })
    await h.press(page.getByRole('button', { name: 'Afficher les choix' }), { after: 1300 })
    for (const q of ['q4', 'q5']) {
      await h.press(await rightChoice(page, h), { pause: 900, after: 1500 })
      await h.look('answered')
      await h.press(page.locator(`.rating-bar__btn--${q}`), { pause: 300, after: 1300 })
    }
    await h.press(page.getByRole('button', { name: 'Masquer les choix' }), { after: 1100 })
    await h.press(page.locator('.flashcard'), { pause: 300, after: 1500 })
    await h.press(page.locator('.rating-bar__btn--q4'), { pause: 300, after: 1200 })
    await h.press(page.locator('button.stage__leave'), { after: 2200 })
  },
}
