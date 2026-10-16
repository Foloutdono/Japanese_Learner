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
