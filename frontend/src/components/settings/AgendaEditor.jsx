import { useState } from 'react'
import { useLang } from '../../LangContext'
import { playClick } from '../../lib/audio'
import { subjectInfo } from '../../lib/agenda'
import {
  DAYS, LEADS, STEP, SUBJECT_GROUPS, WEEKDAYS,
  blockProblem, clashWith, clock, daysLabel, dayName, durationParts, fromInput, toInput,
} from '../../domain/agenda'
import { Sheet } from '../chrome/Sheet'
import { Chip, Chips, Seg } from '../chrome/Console'

const WEEKEND = [5, 6]

// ── One block, edited (plan 181) ─────────────────────────────────
// A sheet (a dialog on the desk) over the Agenda page, in the order a
// block is thought of: what (the subject, as tiles in the gates' two
// groups), when (the days, with three presets, and the two times, the
// length said under them), and the reminder (on or off on one line, and
// how many minutes ahead as six keys). Save stays at the sheet's foot
// however far the sheet scrolls, Delete beside it for a block that
// exists; the scrim, the drag and Escape are the way out.
//
// The rules the server holds are checked here first so the sheet can
// say which one is broken, and name the block in the way when two share
// a stretch of a day.
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
  const isNew = index < 0
  const title = isNew ? t.agdNew : t.agdEdit

  // From the previous draft, not the rendered one: two taps before a
  // render must both count.
  const set = patch => {
    setError(null)
    setDraft(d => ({ ...d, ...(typeof patch === 'function' ? patch(d) : patch) }))
  }

  function toggleDay(day) {
    playClick()
    set(d => {
      const days = d.days.includes(day) ? d.days.filter(x => x !== day) : [...d.days, day]
      return { days: days.sort((a, b) => a - b) }
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
  const length = draft.start != null && draft.end != null && draft.end > draft.start ? durationParts(draft.end - draft.start) : null

  return (
    <Sheet open onClose={onClose} jp={title} label={title} className="agd-sheet" initialFocus=".agd-subject--on" dismiss>
      <form className="agd-form" onSubmit={submit} noValidate>
        <div className="agd-subjects" role="radiogroup" aria-label={t.agdSubject}>
          {[['learn', t.tabLearn], ['practice', t.tabPractice]].map(([group, name]) => (
            <div key={group} className="agd-subjects__group">
              <span className="agd-field__sub">{name}</span>
              <div className="agd-subjects__tiles">
                {SUBJECT_GROUPS[group].map(subject => {
                  const info = subjectInfo(subject, t)
                  const on = draft.subject === subject
                  return (
                    <button
                      key={subject}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      className={`agd-subject${on ? ' agd-subject--on' : ''}`}
                      style={{ '--agd-line': info.color }}
                      onClick={() => { playClick(); set({ subject }) }}
                    >
                      <span className="agd-subject__glyph" lang="ja" aria-hidden="true">{info.icon}</span>
                      <span className="agd-subject__name">{info.title}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="agd-field" role="group" aria-labelledby="agd-days">
          <div className="agd-field__row">
            <b id="agd-days" className="agd-field__name">{t.agdDays}</b>
            <Chips>
              <Chip on={same(WEEKDAYS)} onClick={preset(WEEKDAYS)}>{t.agdPresets.weekdays}</Chip>
              <Chip on={same(WEEKEND)} onClick={preset(WEEKEND)}>{t.agdPresets.weekend}</Chip>
              <Chip on={same(DAYS)} onClick={preset(DAYS)}>{t.agdPresets.all}</Chip>
            </Chips>
          </div>
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
        </div>

        <div className="agd-field">
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
          {length && <span className="agd-field__sub" data-lasts>{t.agdLasts(t.agdDuration(length.h, length.m))}</span>}
        </div>

        <div className="agd-field" role="group" aria-labelledby="agd-remind">
          <div className="agd-field__row">
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
          </div>
          {draft.notify && (
            <>
              <div className="agd-leads" role="radiogroup" aria-label={t.agdLeadLabel}>
                {LEADS.map(lead => (
                  <button
                    key={lead}
                    type="button"
                    role="radio"
                    aria-checked={draft.lead === lead}
                    aria-label={t.agdLead(lead)}
                    className={`agd-daybtn agd-leadkey${draft.lead === lead ? ' agd-daybtn--on' : ''}`}
                    onClick={() => { playClick(); set({ lead }) }}
                  >
                    {lead}
                  </button>
                ))}
              </div>
              <span className="agd-field__sub">{t.agdLeadCaption}</span>
            </>
          )}
        </div>

        <div className="agd-foot">
          {error && <p className="hint agd-error" role="alert">{error}</p>}
          <div className="agd-foot__acts">
            {!isNew && <button type="button" className="btn-secondary" disabled={busy} onClick={remove}>{t.agdDelete}</button>}
            <button type="submit" className="btn-primary" disabled={busy}>{t.agdSave}</button>
          </div>
        </div>
      </form>
    </Sheet>
  )
}
