import { track } from './track'
import { ticketName, ticketRoute, ticketNumber, ticketDate } from '../domain/dayClear'

// ── 記念乗車券 — a ticket, shared as an image (plan 191) ───────────────
// The canvas's Share board (540×675, drawn at 1080×1350): the 辻 mark and
// TSUJI, the ticket tilted with the day's stamp over it, and three
// figures (412 cartes revues · 58 mots appris · N5 en route). Drawn on a
// canvas, turned into a PNG and handed to the system's share sheet
// (navigator.share with a file) where there is one, else downloaded.
// The event is `ticket_share` with the ticket's days and nothing else.
//
// PLACEHOLDER (foundation): a plain drawing of the ticket and the three
// figures, so the button works end to end. The tickets' screen agent
// ports the Share board here (and may add its fonts' readiness).
//
//   renderTicketPng(input) -> Promise<Blob>
//   shareTicket(input)     -> Promise<'shared' | 'downloaded' | 'cancelled' | 'failed'>
//
// input: {
//   days       the ticket's days (14)
//   day        the day it was earned (YYYY-MM-DD; its foot)
//   from       the streak's first day (YYYY-MM-DD), for the range
//   stampDay   the day it is shared, for the stamp (YYYY-MM-DD)
//   figures    { reviews: 412, words: 58, level: 'N5' } (the profile's)
//   t          the locale table (tkbShareFigures, clrTicketCaption, tkbShareText)
// }
export const SHARE_W = 1080
export const SHARE_H = 1350

// A canvas cannot read the sheet's custom properties: the same values,
// named as index.css names them.
const INK = {
  ground: '#17151a', paper: '#f3ecdf', print: '#1c1811', soft: '#665c4a',
  stamp: '#c33a2c', gold: '#e6bd62', onPanel: '#f3ecdf', secondary: '#a79c8c',
}

export async function renderTicketPng({ days, day, figures, t }) {
  const canvas = document.createElement('canvas')
  canvas.width = SHARE_W
  canvas.height = SHARE_H
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = INK.ground
  ctx.fillRect(0, 0, SHARE_W, SHARE_H)

  ctx.fillStyle = INK.onPanel
  ctx.font = '700 32px "Space Grotesk", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('TSUJI', SHARE_W / 2, 120)

  // The ticket, tilted.
  ctx.save()
  ctx.translate(SHARE_W / 2, 560)
  ctx.rotate(-0.05)
  ctx.fillStyle = INK.paper
  ctx.fillRect(-300, -220, 600, 440)
  ctx.strokeStyle = INK.stamp
  ctx.lineWidth = 6
  ctx.strokeRect(-288, -208, 576, 416)
  ctx.fillStyle = INK.print
  ctx.textAlign = 'left'
  ctx.font = '700 26px "Noto Sans JP", sans-serif'
  ctx.fillText('記念乗車券', -250, -150)
  ctx.textAlign = 'right'
  ctx.fillStyle = INK.soft
  ctx.font = '700 22px "Space Grotesk", sans-serif'
  ctx.fillText(`N° ${ticketNumber(days)}`, 250, -150)
  ctx.textAlign = 'center'
  ctx.fillStyle = INK.print
  ctx.font = '700 32px "Noto Sans JP", sans-serif'
  ctx.fillText(ticketRoute(days), 0, -80)
  ctx.font = '900 140px "Noto Serif JP", serif'
  ctx.fillText(ticketName(days), 0, 70)
  ctx.font = '600 30px "Space Grotesk", sans-serif'
  ctx.fillText(t?.clrTicketCaption?.(days) ?? '', 0, 130)
  ctx.fillStyle = INK.soft
  ctx.font = '700 22px "Space Grotesk", sans-serif'
  ctx.fillText(`辻駅 発行   ${day ? ticketDate(day) : ''}`, 0, 185)
  ctx.restore()

  // The three figures.
  const labels = t?.tkbShareFigures ?? {}
  const figs = [[figures?.reviews, labels.reviews], [figures?.words, labels.words], [figures?.level, labels.level]]
  figs.forEach(([value, label], i) => {
    const x = (SHARE_W / 4) * (i + 1)
    ctx.textAlign = 'center'
    ctx.fillStyle = INK.onPanel
    ctx.font = '700 80px "Space Grotesk", sans-serif'
    ctx.fillText(value == null ? '—' : String(value), x, 1080)
    ctx.fillStyle = INK.secondary
    ctx.font = '700 24px "Space Grotesk", sans-serif'
    ctx.fillText((label ?? '').toUpperCase(), x, 1130)
  })

  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('no image'))), 'image/png'))
}

/** Share the ticket's image, or download it where the system cannot share a file. */
export async function shareTicket(input) {
  const { days, t } = input
  let blob
  try {
    blob = await renderTicketPng(input)
  } catch {
    return 'failed'
  }
  const name = `tsuji-${ticketNumber(days)}.png`
  const file = typeof File === 'function' ? new File([blob], name, { type: 'image/png' }) : null
  try {
    if (file && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], text: t?.tkbShareText?.(days) })
      track('ticket_share', { days })
      return 'shared'
    }
  } catch (e) {
    if (e?.name === 'AbortError') return 'cancelled'
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  track('ticket_share', { days })
  return 'downloaded'
}
