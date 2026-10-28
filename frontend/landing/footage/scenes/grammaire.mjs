// 文法: the ladder opens a rule on its tour -- three sentences to look
// at, a guess, the rule, a scene, the learner's own line -- then back
// to the line's plate, so the loop closes where it opened. The learner
// is kept with が as the next rule to meet.
export default {
  id: 'grammaire',
  start: '/learn/grammar/N5',
  async run(page, h) {
    const go = () => page.locator('button.btn-depart')
    await h.beat(1400)
    // The phone climbs from the plate's gate; the desk from the ladder's card.
    await h.press(h.desk ? page.locator('button.platform-card', { hasText: "L'échelle" }) : go(), { after: 3000 })
    await h.press(go(), { pause: 900, after: 1300 })                       // J'ai une idée
    await h.press(page.getByRole('radio', { name: /sujet grammatical/ }), { pause: 900, after: 700 })
    await h.press(go(), { pause: 300, after: 2600 })                       // Vérifier: the rule
    await h.press(go(), { after: 2400 })                                   // Continuer: the scene
    await h.press(go(), { after: 1500 })                                   // À toi de jouer
    await h.press(page.getByRole('radio', { name: /わたしがもっています/ }), { pause: 900, after: 700 })
    await h.press(go(), { pause: 300, after: 2400 })                       // Vérifier
    await h.look('played')
    await h.press(page.locator('button.stage__leave'), { after: 2200 })
  },
}
