// ── 時間割 — the agenda, said while the app is shut (plan 181) ──
// The native shells tell the learner a study block is starting: one local
// notification per occurrence of each block that asks for one, for the
// next seven days, at the block's start less its lead. Like the day's
// train (lib/ahead.js) it is decided while the app is open and planned
// again whenever the app opens, comes back to the front or the agenda is
// saved (NativeBridge), so the week always rolls on. A tap opens the
// subject's own place.
//
// Pure: the notifications and the words they carry. The network and the
// plugins are lib/platform.js's.
import { getAllSections } from '../config/tabs'
import { SUBJECT_PATH, clock, occurrences } from '../domain/agenda'

// Ids apart from the day's train (101–107) and the retired repeating
// reminder (1), so each cancels and plans its own without touching the
// other. One notification per occurrence, nearest first; iOS keeps 64
// pending in all, so the two never ask for more than 55 between them.
export const AGENDA_FIRST_ID = 201
export const AGENDA_IDS = Array.from({ length: 48 }, (_, i) => AGENDA_FIRST_ID + i)
export const AGENDA_DAYS = 7
// A notification closer than this is not scheduled: it would fire
// while the app that planned it is still open.
const LEAD_MS = 60_000

/** A subject as the gates name it: its title, glyph and line colour.
 *  The queue is the Today gate's, the rest their own sections'. */
export function subjectInfo(subject, t) {
  const path = SUBJECT_PATH[subject]
  const section = getAllSections(t).find(s => s.path === path)
  return {
    path,
    title: section?.title ?? subject,
    icon: section?.icon ?? '',
    color: section?.color ?? 'var(--accent2)',
  }
}

/** The notifications to schedule for `blocks`, as the shell takes them:
 *  { id, at, title, body, lines, extra }. Blocks that ask for none, and
 *  moments already gone, are left out. */
export function planAgenda({ blocks, t, now }) {
  const out = []
  for (const { block, start } of occurrences(blocks, now, AGENDA_DAYS)) {
    if (out.length >= AGENDA_IDS.length) break
    if (!block.notify) continue
    const at = new Date(start.getTime() - block.lead * 60_000)
    if (at.getTime() - now.getTime() < LEAD_MS) continue
    const { title, path } = subjectInfo(block.subject, t)
    out.push({
      id: AGENDA_IDS[out.length],
      at,
      title: t.agdNotifTitle(title, block.lead),
      body: t.agdNotifBody(clock(block.start), clock(block.end), block.lead),
      lines: [],
      extra: { to: path },
    })
  }
  return out
}
