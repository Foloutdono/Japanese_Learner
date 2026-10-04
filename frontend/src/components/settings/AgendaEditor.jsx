import { useState } from 'react'
import { useLang } from '../../LangContext'
import { playClick } from '../../lib/audio'
import { subjectInfo } from '../../lib/agenda'
import {
  DAYS, LEADS, STEP, SUBJECTS, WEEKDAYS,
  blockProblem, clashWith, clock, daysLabel, dayName, fromInput, toInput,
} from '../../domain/agenda'
import { Sheet } from '../chrome/Sheet'
import { Chip, Chips, Seg } from '../chrome/Console'

const WEEKEND = [5, 6]

// ── One block, edited (plan 181) ─────────────────────────────────
// A sheet over the Agenda page: the subject, the days it repeats on, the
// hours, and the reminder that goes with it (on or off, and how long
// before the start). The rules the server holds are checked here first
// so the sheet can say which one is broken, and name the block in the
// way when two share a stretch of a day.
//
//   block    the block as stored, or the new one it starts from
//   index    its place in `blocks`, or -1 for a new block
//   blocks   the whole week, to find a clash
//   onSave   (block) => Promise, rejecting when the server refuses
//   onDelete () => Promise, only for a block that exists
export function AgendaEditor({ block, index, blocks, onSave, onDelete, onClose }) {
  const { t, lang } = useLang()
  const [draft, setDraft] = useState(block)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const set = patch => { setError(null); setDraft(d => ({ ...d, ...patch })) }
  const isNew = index < 0

  function toggleDay(day) {
    playClick()
    setError(null)
    // From the previous draft, not the rendered one: two taps before a
    // render must both count.
    setDraft(d => {
      const days = d.days.includes(day) ? d.days.filter(x => x !== day) : [...d.days, day]
      return { ...d, days: days.sort((a, b) => a - b) }
    })
  }

  async function submit(e) {
    e.preventDefault()
    if (busy) return
    const problem = blockProblem(draft)
    if (problem) { setError(t.agdProblem[problem]); return }
    const clash = clashWith(draft, blocks, index)
    if (clash) {
      setError(t.agdClash(subjectInfo(clash.subject, t).title, daysLabel(clash.days, lang, t.agdEveryDay), clock(clash.start), clock(clash.end)))
      return
    }
    setBusy(true)
    try {
      await onSave(draft)
    } catch {
      setError(t.agdSaveFailed)
      setBusy(false)
    }
  }

  async function remove() {
    if (busy) return
    setBusy(true)
    try {
      await onDelete()
    } catch {
      setError(t.agdSaveFailed)
      setBusy(false)
    }
  }

  const preset = days => () => { playClick(); set({ days }) }
  const same = days => days.length === draft.days.length && days.every(d => draft.days.includes(d))

  return (
    <Sheet open onClose={onClose} jp={isNew ? t.agdNew : t.agdEdit} label={isNew ? t.agdNew : t.agdEdit} className="agd-sheet" initialFocus=".chip--on">
      <form className="agd-form" onSubmit={submit} noValidate>
        <div className="agd-field" role="group" aria-labelledby="agd-subject">
          <b id="agd-subject" className="agd-field__name">{t.agdSubject}</b>
          <Chips>
            {SUBJECTS.map(subject => {
              const info = subjectInfo(subject, t)
              return (
                <Chip
                  key={subject}
                  on={draft.subject === subject}
                  glyph={info.icon}
                  color={info.color}
                  onClick={() => { playClick(); set({ subject }) }}
                >
                  {info.title}
                </Chip>
              )
            })}
          </Chips>
        </div>

        <div className="agd-field" role="group" aria-labelledby="agd-days">
          <b id="agd-days" className="agd-field__name">{t.agdDays}</b>
          <div className="agd-days">
            {DAYS.map(day => (
              <button
                key={day}
                type="button"
                className={`agd-daybtn${draft.days.includes(day) ? ' agd-daybtn--on' : ''}`}
                aria-pressed={draft.days.includes(day)}
                aria-label={dayName(day, lang, 'long')}
                onClick={() => toggleDay(day)}
              >
                {dayName(day, lang, 'short')}
              </button>
            ))}
          </div>
          <Chips>
            <Chip on={same(WEEKDAYS)} onClick={preset(WEEKDAYS)}>{t.agdPresets.weekdays}</Chip>
            <Chip on={same(WEEKEND)} onClick={preset(WEEKEND)}>{t.agdPresets.weekend}</Chip>
            <Chip on={same(DAYS)} onClick={preset(DAYS)}>{t.agdPresets.all}</Chip>
          </Chips>
        </div>

        <div className="agd-times">
          <label className="agd-field">
            <b className="agd-field__name">{t.agdFrom}</b>
            <input
              type="time"
              className="field"
              step={STEP * 60}
              value={toInput(draft.start)}
              onChange={e => set({ start: fromInput(e.target.value) })}
            />
          </label>
          <label className="agd-field">
            <b className="agd-field__name">{t.agdTo}</b>
            <input
              type="time"
              className="field"
              step={STEP * 60}
              value={toInput(draft.end)}
              onChange={e => set({ end: fromInput(e.target.value) })}
            />
          </label>
        </div>

        <div className="agd-field" role="group" aria-labelledby="agd-remind">
          <b id="agd-remind" className="agd-field__name">{t.agdRemind}</b>
          <Seg
            label={t.agdRemind}
            value={draft.notify ? 'on' : 'off'}
            onChange={key => { playClick(); set({ notify: key === 'on' }) }}
            options={[
              { key: 'on', label: t.notifOnOff.on },
              { key: 'off', label: t.notifOnOff.off },
            ]}
          />
          {draft.notify && (
            <>
              <span className="agd-field__sub">{t.agdLeadLabel}</span>
              <Chips label={t.agdLeadLabel}>
                {LEADS.map(lead => (
                  <Chip key={lead} on={draft.lead === lead} onClick={() => { playClick(); set({ lead }) }}>
                    {t.agdLead(lead)}
                  </Chip>
                ))}
              </Chips>
            </>
          )}
        </div>

        {error && <p className="hint agd-error" role="alert">{error}</p>}

        <div className="agd-actions">
          <button type="submit" className="btn-primary" disabled={busy}>{t.agdSave}</button>
          {!isNew && <button type="button" className="btn-secondary" disabled={busy} onClick={remove}>{t.agdDelete}</button>}
          <button type="button" className="btn-secondary" onClick={onClose}>{t.cancel}</button>
        </div>
      </form>
    </Sheet>
  )
}
