import { useEffect, useState } from 'react'
import { useLang } from '../../LangContext'
import { playClick } from '../../lib/audio'
import { subjectInfo } from '../../lib/agenda'
import { canNudge, nudgePermission, requestNudgePermission } from '../../lib/platform'
import { saveAgenda, useAgenda } from '../../stores/agenda'
import { useDesk } from '../../hooks/useDesk'
import { useBoxWidth } from '../../hooks/useBoxWidth'
import { useMinute } from '../../hooks/useMinute'
import {
  MAX_BLOCKS, TEMPLATES, agendaDay, blocksOn, clashWith, clock, dayName, daysLabel, durationParts,
  newBlock, nextBlock, weekShare, withBlock,
} from '../../domain/agenda'
import { AgendaNext } from '../agenda/AgendaNext'
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
  // The clock, once a minute: it names today, what is under way and the
  // rule on today's column, and render does not read it.
  const now = useMinute()
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
          {blocks.length ? (
            <AgendaNext blocks={blocks} now={now} />
          ) : (
            <Starters blocks={blocks} onPick={block => { playClick(); setDay(block.days[0]); setEditing({ index: -1, block }) }} />
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
          {blocks.length > 0 && <WeekShare blocks={blocks} duration={duration} />}
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
                const live = Boolean(next?.now && next.block === block && day === today)
                return (
                  <button
                    key={i}
                    type="button"
                    className={`stg-row agd-row${live ? ' agd-row--live' : ''}`}
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
                    {live ? (
                      <span className="agd-row__live">{t.agdNow}</span>
                    ) : (
                      <span className={`agd-row__bell${block.notify ? '' : ' agd-row__bell--off'}`}>
                        {block.notify && <BellIcon size={14} />}
                        {block.notify ? t.agdBell(block.lead) : t.agdNoBell}
                      </span>
                    )}
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

// The week's hours by subject: the total, a bar of each subject's share
// in its line colour, and the four largest named with their hours.
function WeekShare({ blocks, duration }) {
  const { t } = useLang()
  const { total, parts } = weekShare(blocks)
  return (
    <div className="agd-share">
      <div className="agd-share__head">
        <span className="agd-field__sub">{t.agdWeekTotalLabel}</span>
        <b className="agd-share__total">{duration(total)}</b>
      </div>
      <span className="agd-share__bar" aria-hidden="true">
        {parts.map(p => (
          <i key={p.subject} style={{ flexGrow: p.minutes, '--agd-line': subjectInfo(p.subject, t).color }} />
        ))}
      </span>
      <ul className="agd-share__parts">
        {parts.slice(0, 4).map(p => {
          const info = subjectInfo(p.subject, t)
          return (
            <li key={p.subject} style={{ '--agd-line': info.color }}>
              <span className="agd-share__dot" aria-hidden="true" />
              {info.title}
              <span className="agd-share__h">{duration(p.minutes)}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// An empty week: what the page is for, and three blocks to start from,
// each opening the editor already filled in.
function Starters({ blocks, onPick }) {
  const { t, lang } = useLang()
  return (
    <div className="agd-start">
      <p className="agd-intro">{t.agdEmpty}</p>
      <span className="agd-field__sub">{t.agdStartWith}</span>
      <div className="agd-start__picks">
        {TEMPLATES.map(block => {
          const info = subjectInfo(block.subject, t)
          return (
            <button
              key={block.subject}
              type="button"
              className="agd-start__pick"
              style={{ '--agd-line': info.color }}
              disabled={Boolean(clashWith(block, blocks))}
              onClick={() => onPick({ ...block })}
            >
              <span className="agd-now__glyph" lang="ja" aria-hidden="true">{info.icon}</span>
              <span className="agd-start__words">
                <b>{info.title}</b>
                <span className="agd-start__when">{daysLabel(block.days, lang, t.agdEveryDay)} · {clock(block.start)}–{clock(block.end)}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
