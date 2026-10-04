import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLang } from '../../LangContext'
import { playClick } from '../../lib/audio'
import { subjectInfo } from '../../lib/agenda'
import { whenLabel } from '../../lib/ahead'
import { canNudge, nudgePermission, requestNudgePermission } from '../../lib/platform'
import { saveAgenda, useAgenda } from '../../stores/agenda'
import { useDesk } from '../../hooks/useDesk'
import { useBoxWidth } from '../../hooks/useBoxWidth'
import {
  MAX_BLOCKS, agendaDay, blocksOn, clashWith, clock, dayName, daysLabel, durationParts,
  newBlock, nextBlock, withBlock,
} from '../../domain/agenda'
import { Loading } from '../ui/Loading'
import { BellIcon } from '../ui/Icons'
import { SettingsPage } from './SettingsPage'
import { AgendaWeek } from './AgendaWeek'
import { AgendaEditor } from './AgendaEditor'

// ── 時間割 — Settings › Agenda (plan 181) ────────────────────────
// The learner's week: blocks of time given to a subject — kanji 9 to 11,
// reading 14 to 16 — each with the reminder that goes with it. Three
// pieces, in the order a learner asks them:
//
//   what now   the block under way, or the next one, with the way into
//              its subject one press away
//   the week   seven days under the hours (AgendaWeek), the day being
//              looked at lit
//   the day    that day's blocks as rows a thumb can hit, each opening
//              its editor (AgendaEditor), and the way to add one on it
//
// Stacked, so the week has the page's whole width to say each block's
// name in; only where the page is wide enough for a roomy week and a day
// beside it (measured, not set at a window width) do the two stand side
// by side under what-now. The week is replaced whole on
// every save (PUT /api/agenda), so the page is always what the server
// holds.
//
// The reminders are the native shells' (lib/agenda.js, NativeBridge): a
// block can be set to remind on the web too, since the choice is the
// account's, and the page says where the reminder will arrive. Turning
// one on asks the OS first, as Settings › Notifications does.
const WIDE = 1040

function useDuration() {
  const { t } = useLang()
  return minutes => {
    const { h, m } = durationParts(minutes)
    return t.agdDuration(h, m)
  }
}

export function AgendaPage() {
  const { t, lang } = useLang()
  const pointer = useDesk()
  const { blocks, failed } = useAgenda()
  const [ref, width] = useBoxWidth(true)
  // `null` closed; otherwise the block being edited and its place.
  const [editing, setEditing] = useState(null)
  const [permission, setPermission] = useState(null)
  // The clock as the page opened: it names today, the next block and the
  // rule on today's column, and render does not read it.
  const [now] = useState(() => new Date())
  const [day, setDay] = useState(() => agendaDay(now))
  const duration = useDuration()

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
  const today = agendaDay(now)
  const next = nextBlock(blocks, now)
  const dayBlocks = blocksOn(blocks, day)
  const dayLong = dayName(day, lang, 'long')
  const full = blocks.length >= MAX_BLOCKS
  // Where the reminders will arrive, or why they will not.
  const note = !blocks.some(b => b.notify) ? null
    : !native ? t.agdWebNote
      : permission === 'denied' ? t.agdDenied : null

  async function save(block) {
    // A reminder asks the phone first, so the page never claims one the
    // OS will not deliver. A refusal does not stop the block from being
    // saved: the agenda is the learner's, and the page says the phone is
    // off.
    if (native && block.notify && permission !== 'granted') {
      await requestNudgePermission()
      setPermission(await nudgePermission())
    }
    await saveAgenda(withBlock(blocks, editing.index, block))
    // The day the block was saved on stays in view, or its first day.
    if (!block.days.includes(day)) setDay(block.days[0])
    setEditing(null)
  }

  async function remove() {
    await saveAgenda(withBlock(blocks, editing.index, null))
    setEditing(null)
  }

  const open = index => setEditing({ index, block: blocks[index] })
  const addOn = d => { playClick(); setEditing({ index: -1, block: newBlock(blocks, 'kanji', [d]) }) }
  function addAt(d, start) {
    setDay(d)
    const block = { ...newBlock(blocks, 'kanji', [d]), start, end: Math.min(start + 60, 24 * 60) }
    // A click on the free half hour before another block makes a block
    // that ends where that one starts, rather than one that clashes.
    const clash = clashWith(block, blocks)
    if (clash && clash.start > start) block.end = clash.start
    setEditing({ index: -1, block })
  }

  return (
    <SettingsPage title={t.settingsAgenda}>
      <div ref={ref} className={`agd${(width ?? 0) >= WIDE ? ' agd--wide' : ''}`}>
        <div className="agd-top">
          {next ? (
            <NowCard next={next} now={now} t={t} lang={lang} />
          ) : (
            <p className="agd-intro">{t.agdEmpty}</p>
          )}
        </div>

        <section className="agd-board" aria-label={t.agdWeek}>
          <AgendaWeek
            blocks={blocks}
            today={today}
            nowMinute={now.getHours() * 60 + now.getMinutes()}
            selected={day}
            onSelect={setDay}
            onOpen={open}
            onAddAt={addAt}
            pointer={pointer}
          />
        </section>

        <section className="agd-day" aria-label={dayLong}>
          <div className="agd-day__head">
            <b className="agd-day__name">{dayName(day, lang, 'long')}</b>
            {day === today && <span className="cap">{t.nudgeWhen.today}</span>}
          </div>
          {dayBlocks.length ? (
            <div className="stg-list">
              {dayBlocks.map(block => {
                const i = blocks.indexOf(block)
                const info = subjectInfo(block.subject, t)
                return (
                  <button
                    key={i}
                    type="button"
                    className="stg-row agd-row"
                    data-block={i}
                    style={{ '--agd-line': info.color }}
                    onClick={() => { playClick(); open(i) }}
                  >
                    <span className="agd-row__time">
                      <b>{clock(block.start)}</b>
                      <span className="agd-row__end">{clock(block.end)}</span>
                    </span>
                    <span className="stg-row__names">
                      <span className="stg-row__jp">
                        <span className="agd-row__glyph" lang="ja" aria-hidden="true">{info.icon}</span>
                        {info.title}
                      </span>
                      <span className="stg-row__value">
                        <span className="stg-row__text">
                          {daysLabel(block.days, lang, t.agdEveryDay)} · {duration(block.end - block.start)}
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
          ) : (
            <p className="agd-day__empty">{t.agdDayEmpty(dayLong)}</p>
          )}
          <button
            type="button"
            className="btn-secondary agd-day__add"
            data-action="agenda-add"
            disabled={full}
            onClick={() => addOn(day)}
          >
            {t.agdAddOn(dayLong)}
          </button>
          {note && <p className="slip__hint">{note}</p>}
        </section>
      </div>

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

// What now: the block under way, with when it ends, or the next one and
// when it starts; its subject's glyph in its colour and the way in.
function NowCard({ next, now, t, lang }) {
  const info = subjectInfo(next.block.subject, t)
  // The card is what is next by being there: a block to come says only
  // when, so the hour is never what a narrow card cuts.
  const when = next.now
    ? `${t.agdNow} · ${t.agdUntil(clock(next.block.end))}`
    : `${whenLabel(next.start, now, t, lang)} ${clock(next.block.start)}`
  return (
    <div className={`agd-now${next.now ? ' agd-now--live' : ''}`} style={{ '--agd-line': info.color }} data-next>
      <span className="agd-now__glyph" lang="ja" aria-hidden="true">{info.icon}</span>
      <span className="agd-now__text">
        <span className="agd-now__when">{when}</span>
        <b className="agd-now__name">{info.title}</b>
      </span>
      <Link to={info.path} className="btn-secondary agd-now__go" onClick={() => playClick()}>{t.agdGo}</Link>
    </div>
  )
}
