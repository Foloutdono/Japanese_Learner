import { useContext, useEffect, useState } from 'react'
import { useLang } from '../../LangContext'
import { useDesk } from '../../hooks/useDesk'
import { dialogOpen } from '../../lib/dialogOpen'
import { playClick } from '../../lib/audio'
import { RunPanelsContext } from './runPanels'
import { PlusIcon, MinusIcon, SlidersIcon } from '../ui/Icons'
import SpeakToggle from './SpeakToggle'
import { CardContentsSheet } from '../settings/CardContentsPage'

// ── The hint switch ───────────────────────────────────────────
// A hint is something you reach for on a card you are stuck on, so it
// lives ON the card, not back on the mode picker: you only find out
// whether you needed the choices once you are looking at the prompt.
//
// This replaces the old "MCQ mode" vs "flashcard mode" split. Those were
// never two exercises — they were one question at two help levels, which
// is why they had two separate SRS tracks for the same knowledge. The
// help level is a switch now, and a hint deliberately does NOT fork the
// SRS: what a review consumes is the learner's own 1-4 self-rating,
// which means the same thing whether or not four options were on screen.
//
// Rendered from the hints actually present on the payload rather than
// from the mode's declared hints, so a card that could not produce a
// given hint (a personal card has no distractors; a grammar point with
// no cached sentences has no examples) simply doesn't offer it instead
// of showing a control that would do nothing.
//
// Props:
//   available — hint keys this card can actually offer, e.g. ['indice_1']
//   active    — Set/array of hint keys currently switched on
//   onToggle  — (hintKey) => void
//   disabled  — true while the card is locked mid-review
//   speaks    — true when this card says its answer once revealed: the
//               speak-on-reveal switch (SpeakToggle) then stands last in
//               the row, and the row shows even with no hint to offer
//   personalize — the line ('vocab' | 'kanji') of a card that can stand
//               a strip (plan 326, domain/cardContents), else null: its
//               last pill, the sliders alone, opens the Card contents
//               panel over the run on that line (plan 327), the queue
//               and the card left as they stand; `session` writes it
//
// On the desk (plan 115) C shows and hides the choices, the one hint a
// learner reaches for card after card — never Ctrl+C, never from a
// field, never under a dialog — and the switch prints its cap.
export default function HintBar({ available = [], active = [], onToggle, disabled = false, speaks = false, personalize = null, session = null }) {
  const { t } = useLang()
  const [personalizing, setPersonalizing] = useState(false)
  const desk = useDesk()
  // On the run's panels the card panel lists the keys (plan 126).
  const panels = useContext(RunPanelsContext)
  const choices = desk && !disabled && available.includes('indice_1')
  useEffect(() => {
    if (!choices) return undefined
    const onKey = e => {
      if ((e.key !== 'c' && e.key !== 'C') || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      if (dialogOpen() || e.target?.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target?.tagName ?? '')) return
      e.preventDefault()
      onToggle('indice_1')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [choices, onToggle])
  if (available.length === 0 && !speaks && !personalize) return null

  const isOn = key => (active instanceof Set ? active.has(key) : active.includes(key))

  // Sorted by their own numbering rather than left in whatever order the
  // payload happened to build them. indice_1/2/3 is a stated order, and a
  // control that moves depending on which card you are looking at is a
  // control you have to re-find every time.
  const ordered = [...available].sort()

  const LABELS = {
    indice_1: [t.hintChoicesShow, t.hintChoicesHide],
    indice_2: [t.hintSentencesShow, t.hintSentencesHide],
    indice_3: [t.hintFuriganaShow, t.hintFuriganaHide],
  }

  return (
    <div className="study-assist">
      {ordered.map(key => {
        const on = isOn(key)
        const [showLabel, hideLabel] = LABELS[key] ?? [key, key]
        return (
          <button
            key={key}
            type="button"
            className={`study-assist__toggle${on ? ' study-assist__toggle--on' : ''}`}
            onClick={() => onToggle(key)}
            disabled={disabled}
            aria-pressed={on}
            aria-keyshortcuts={desk && key === 'indice_1' ? 'C' : undefined}
          >
            {/* Study.dc.html draws a plus, not a bulb: these ADD a
                register to the card rather than offer a hint. */}
            {/* Since plan 326 the label is the register alone (the row
                must hold on one line in every language, beside the
                read-aloud and Personalize icons): the glyph says the
                rest, a plus to add it, a minus once it is on. */}
            {on ? <MinusIcon size={14} /> : <PlusIcon size={14} />}
            {on ? hideLabel : showLabel}
            {desk && !panels && key === 'indice_1' && <kbd className="desk-kbd" aria-hidden="true">C</kbd>}
          </button>
        )
      })}
      {speaks && <SpeakToggle />}
      {personalize && (
        <button
          type="button"
          className="study-assist__toggle study-assist__toggle--icon study-assist__toggle--go"
          aria-label={t.ccPersonalize}
          title={t.ccPersonalize}
          data-action="personalize"
          onClick={() => { playClick(); setPersonalizing(true) }}
        >
          <SlidersIcon size={14} />
        </button>
      )}
      {personalizing && personalize && (
        <CardContentsSheet session={session} line={personalize} onClose={() => setPersonalizing(false)} />
      )}
    </div>
  )
}
