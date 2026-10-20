// ── 刻 — the hour of the print (plan 205, plan 219) ─────────────
// Which of Today's four prints the clock shows, and so which of the
// four ambiances plays: 曙 dawn from 5:00, 帰帆 the day from 9:00,
// 落雁 dusk from 16:00, 秋月 the night from 19:30, all local. One rule
// for the picture and the sound, so the two never disagree about the
// hour (components/station/print/usePrint.js, lib/audio/ambiance.js).

const FROM = [[5 * 60, 'dawn'], [9 * 60, 'day'], [16 * 60, 'dusk'], [19 * 60 + 30, 'night']]

export function printHour(now) {
  const m = now.getHours() * 60 + now.getMinutes()
  let hour = 'night'
  for (const [at, name] of FROM) if (m >= at) hour = name
  return hour
}

// ── 季 — the season of the print (plan 261) ─────────────────────
// The owner's pick of the canvas "Tsuji — Today, the seasons": the
// seasons by the month, as they are counted today. 春 March to May (the
// cherry), 夏 June to August (the crape myrtle, the cloud peak), 秋
// September to November (the maples), 冬 December to February (the red
// plum, the snow); and the summer's night split by the month too, the
// fireflies in June and July, the fireworks in August.
const SEASONS = ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer',
  'autumn', 'autumn', 'autumn', 'winter']
const AUGUST = 7

export function printSeason(now) {
  return SEASONS[now.getMonth()]
}

/** The print the day and the hour show: the season's at the hour
 *  (`spring-dawn` … `winter-night`), or August's night, the fireworks
 *  (`summer-hanabi`). A finish that keeps the night (plan 250) passes
 *  its hour. */
export function printName(now, hour = printHour(now)) {
  const season = printSeason(now)
  if (season === 'summer' && hour === 'night' && now.getMonth() === AUGUST) return 'summer-hanabi'
  return `${season}-${hour}`
}
