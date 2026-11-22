// ── 任務 — what the screens know about a mission (plan 328) ────────
// The server says which missions a learner has, how far they are and what
// each pays (study/missions.py); the screens print them in the learner's
// words (locales `msn*`). This is the little that is the client's: the
// plate each achievement hangs as, the glyph each discovery inks, and how
// a reward reads.

// A plate is a station: its code on the origin line (辻, TJ), its name,
// its reading. In the catalogue's own order.
export const PLATES = Object.freeze({
  kana_done:  { code: 'TJ 01', jp: '仮名', kana: 'かな' },
  words_100:  { code: 'TJ 02', jp: '百語', kana: 'ひゃくご' },
  words_500:  { code: 'TJ 03', jp: '五百語', kana: 'ごひゃくご' },
  words_1000: { code: 'TJ 04', jp: '千語', kana: 'せんご' },
  grammar_n5: { code: 'TJ 05', jp: '文法', kana: 'ぶんぽう' },
  days_7:     { code: 'TJ 06', jp: '七日', kana: 'なのか' },
  days_30:    { code: 'TJ 07', jp: '三十日', kana: 'さんじゅうにち' },
  days_100:   { code: 'TJ 08', jp: '百日', kana: 'ひゃくにち' },
  exam_passed: { code: 'TJ 09', jp: '合格', kana: 'ごうかく' },
  ranked_win: { code: 'TJ 10', jp: '勝利', kana: 'しょうり' },
})

export const GLYPHS = Object.freeze({
  first_dictation: '書', first_photo: '写', first_conversation: '話', first_exam: '試', first_deck: '札',
  first_friend: '友', first_duel: '闘', arrival_date: '旅', first_import: '移', first_video: '映',
})

// The line a practice coupon sends the learner to, for its 3px rail (a
// place: the one thing a mission may wear a pigment for).
export const PLATFORM_LINE = Object.freeze({
  reading: 'reading', comprehension: 'rikai', translation: 'honyaku', conversation: 'kaiwa',
})

/** `+8` for a learner paid in credits, `+13 XP` for one paid in XP. */
export function rewardText(item) {
  return item.credits > 0 ? `+${item.credits}` : `+${item.xp} XP`
}

/** How many of a day's missions are done (the bonus is not one). */
export function doneCount(day) {
  return (day?.missions ?? []).filter(m => m.done).length
}

/** The day's sum, as a learner is paid it: the three and their bonus. */
export function daySum(day) {
  const list = [...(day?.missions ?? []), ...(day?.bonus ? [day.bonus] : [])]
  const credits = list.reduce((n, m) => n + m.credits, 0)
  return credits > 0 ? `+${credits}` : `+${list.reduce((n, m) => n + m.xp, 0)} XP`
}
