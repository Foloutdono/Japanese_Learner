// Watch API payloads for answers, so a clip always picks the right one.
export function watchAnswers(page) {
  const A = { contrast: [], comp: null, kanji: [] }
  page.on('response', async r => {
    if (!r.url().includes('/api/')) return
    let j; try { j = await r.json() } catch { return }
    const walk = (o) => { if (!o || typeof o !== 'object') return
      if (o.contrast && o.contrast.answer) A.contrast.push(o.contrast)
      if (Array.isArray(o.questions) && o.text) A.comp = o
      if (typeof o.card_id === 'string' && o.card_id.startsWith('kanji_') && o.kanji) A.kanji.push(o)
      for (const v of Object.values(o)) if (typeof v === 'object') walk(v) }
    walk(j)
  })
  return A
}
export async function answerChoose(page, A, { tapFn }) {
  const body = await page.innerText('body')
  const c = A.contrast.find(c => body.includes(c.tr)) || A.contrast.at(-1)
  const ans = c.answer.replace(/^〜/, '')
  const opts = page.locator('button:visible').filter({ hasText: new RegExp(`^\\s*\\d\\s*${ans}\\s*$`) })
  console.log('choose answer', ans, await opts.count())
  await tapFn(opts.first())
}
