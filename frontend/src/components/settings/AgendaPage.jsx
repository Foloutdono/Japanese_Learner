import { useEffect, useState } from 'react'
import { useLang } from '../../LangContext'
import { playClick } from '../../lib/audio'
import { subjectInfo } from '../../lib/agenda'
import { canNudge, nudgePermission, requestNudgePermission } from '../../lib/platform'
import { saveAgenda, useAgenda } from '../../stores/agenda'
import {
  MAX_BLOCKS, agendaDay, clock, daysLabel, newBlock, nextBlock, withBlock,
} from '../../domain/agenda'
import { whenLabel } from '../../lib/ahead'
import { Loading } from '../ui/Loading'
import { BellIcon } from '../ui/Icons'
import { SettingsPage, Slip } from './SettingsPage'
import { AgendaWeek } from './AgendaWeek'
import { AgendaEditor } from './AgendaEditor'

// ── 時間割 — Settings › Agenda (plan 181) ────────────────────────
// The learner's week: blocks of time given to a subject — kanji 9 to 11,
// reading 14 to 16 — each with the reminder that goes with it. The week
// drawn, the blocks listed, a block edited on a sheet. The week is
// replaced whole on every save (PUT /api/agenda), so what the page shows
// is always what the server holds.
//
// The reminders are the native shells' (lib/agenda.js, NativeBridge): a
// block can be set to remind on the web too, since the choice is the
// account's, and the page says where the reminder will arrive. Turning
// one on asks the OS first, as Settings › Notifications does, and the
// page says so when the phone has them off.
export function AgendaPage() {
  const { t, lang } = useLang()
  const { blocks, failed } = useAgenda()
  // `null` closed; otherwise the block being edited and its place.
  const [editing, setEditing] = useState(null)
  const [permission, setPermission] = useState(null)
  // The clock as the page opened: it names today's column and the next
  // block, and render does not read it.
  const [now] = useState(() => new Date())

  useEffect(() => {
    let gone = false
    nudgePermission().then(p => { if (!gone) setPermission(p) })
    return () => { gone = true }
  }, [])

  if (!blocks) {
    return (
      <SettingsPage title={t.settingsAgenda}>
        {failed ? <p className="hint" role="alert">{t.agdLoadFailed}</p> : <Loading />}
      </SettingsPage>
    )
  }

  const native = canNudge()
  const wantsReminder = blocks.some(b => b.notify)
  const next = nextBlock(blocks, now)
  // Where the reminders will arrive, or why they will not.
  const note = !wantsReminder ? null : !native ? t.agdWebNote : permission === 'denied' ? t.agdDenied : null

  async function save(block) {
    // A reminder asks the phone first, so the page never claims one the
    // OS will not deliver. A refusal does not stop the block from being
    // saved: it is the agenda that is the learner's, and the page says
    // the phone is off.
    if (native && block.notify && permission !== 'granted') {
      await requestNudgePermission()
      setPermission(await nudgePermission())
    }
    await saveAgenda(withBlock(blocks, editing.index, block))
    setEditing(null)
  }

  async function remove() {
    await saveAgenda(withBlock(blocks, editing.index, null))
    setEditing(null)
  }

  const open = (index) => setEditing({ index, block: blocks[index] })
  const add = () => { playClick(); setEditing({ index: -1, block: newBlock(blocks) }) }

  return (
    <SettingsPage title={t.settingsAgenda}>
      <Slip label={t.agdWeek}>
        {blocks.length === 0 ? (
          <p className="slip__hint">{t.agdEmpty}</p>
        ) : (
          <>
            {next && (
              <p className="agd-next" data-next>
                <b>{next.now ? t.agdNow : t.agdNext}</b>
                {' · '}
                {next.now
                  ? t.agdNextNow(subjectInfo(next.block.subject, t).title, clock(next.block.end))
                  : `${whenLabel(next.start, now, t, lang)} ${clock(next.block.start)} · ${subjectInfo(next.block.subject, t).title}`}
              </p>
            )}
            <AgendaWeek blocks={blocks} today={agendaDay(now)} onOpen={i => open(i)} />
          </>
        )}
        <button type="button" className="btn-secondary slip__act" data-action="agenda-add" onClick={add} disabled={blocks.length >= MAX_BLOCKS}>
          {t.agdAdd}
        </button>
      </Slip>

      {blocks.length > 0 && (
        <Slip label={t.agdListLabel}>
          <div className="stg-list">
            {blocks.map((block, i) => {
              const info = subjectInfo(block.subject, t)
              return (
                <button key={i} type="button" className="stg-row agd-row" data-block={i} style={{ '--agd-line': info.color }} onClick={() => { playClick(); open(i) }}>
                  <span className="stg-row__icon agd-row__glyph" lang="ja" aria-hidden="true">{info.icon}</span>
                  <span className="stg-row__names">
                    <span className="stg-row__jp">{info.title}</span>
                    <span className="stg-row__value">
                      <span className="stg-row__text">
                        {daysLabel(block.days, lang, t.agdEveryDay)} · {clock(block.start)}–{clock(block.end)}
                      </span>
                    </span>
                  </span>
                  <span className={`agd-row__bell${block.notify ? '' : ' agd-row__bell--off'}`}>
                    {block.notify && <BellIcon size={14} />}
                    {block.notify ? t.agdBell(block.lead) : t.agdNoBell}
                  </span>
                </button>
              )
            })}
          </div>
          {note && <p className="slip__hint">{note}</p>}
        </Slip>
      )}

      {editing && (
        <AgendaEditor
          block={editing.block}
          index={editing.index}
          blocks={blocks}
          onSave={save}
          onDelete={remove}
          onClose={() => setEditing(null)}
        />
      )}
    </SettingsPage>
  )
}
