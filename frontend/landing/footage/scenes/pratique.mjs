// 読: reading practice at N5 -- a sentence shown against the clock, its
// reading typed in romaji, checked and rated, twice; back to the levels.
export default {
  id: 'pratique',
  start: '/practice/reading/levels',
  prepare(page, h) {
    h.phrases = []
    page.on('response', async r => {
      if (!/\/api\/reading\/batch/.test(r.url())) return
      try { h.phrases.push(...(await r.json()).phrases) } catch { /* not JSON */ }
    })
  },
  async run(page, h) {
    await h.beat(1400)
    // The phone boards from the level; the desk has N5 open and boards from it.
    await h.press(h.desk ? page.locator('button.prc-go') : page.locator('button.route-stop', { hasText: 'N5' }), { after: 2600 })
    for (const [i, q] of [[0, 'q4'], [1, 'q5']]) {
      if (i) await h.press(page.getByRole('button', { name: 'Phrase suivante' }), { pause: 900, after: 1300 })
      await h.press(page.locator('button.clip-player__play'), { after: 1400 })
      await h.type(page.locator('input.field--page'), h.phrases[i].romaji.replace(/[.。!?]$/, ''), { delay: 95 })
      await h.beat(500)
      await h.press(page.getByRole('button', { name: 'Valider' }), { pause: 300, after: 2400 })
      await h.look('checked')
      await h.press(page.locator(`.rating-bar__btn--${q}`), { pause: 300, after: 1500 })
    }
    await h.press(page.locator('button.stage__leave'), { pause: 900, after: 2200 })
  },
}
