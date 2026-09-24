// ── 机 — a radio group honours its arrows (plan 123) ────────────────
// A `role="radiogroup"` tells a screen reader "radio, 2 of 4", and a
// keyboard reader expects what that promises: the group is ONE tab stop
// (the checked radio, or the first when none is), and the arrows move
// between its radios. The exam's choices have kept that rule since they
// became a radiogroup (exam/QuestionRenderer.jsx's ChoiceList); on the
// desk every other group now keeps it -- Seg, the console's band, the
// settings' grids and the new deck's types.
//
// The arrows are stopped where they are taken, so the page's own arrows
// (the analyser's tokens, the dictionary's catalogue) do not fire from a
// focused radio. They wrap, as a radio group's do.
//
// `check` is whether an arrow also checks the radio it reaches, as a
// radio group's arrows usually do. A group whose check is a round trip
// or a question -- the level (a confirmation), the pace, the goal, the
// hour, the rating scale (each a save that disables the group while it
// runs) -- passes `check: false`: the arrows move the focus alone and
// Space checks, so walking past three levels asks nothing and sends
// nothing.
//
// The handler is the group's onKeyDown, or nothing where the group is
// not walked (a phone, whose DOM stays as it was).
const STEP = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }

export function useRadioWalk(active, { check = true } = {}) {
  return active ? e => walk(e, check) : undefined
}

/** A radio's tabIndex on the desk: the checked one is the group's one
 *  stop, or the first when none is checked; nothing below the desk. */
export function radioTab(active, index, checkedIndex) {
  if (!active) return undefined
  return index === Math.max(0, checkedIndex) ? 0 : -1
}

function walk(e, check) {
  const step = STEP[e.key]
  if (!step || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return
  const radios = [...e.currentTarget.querySelectorAll('[role="radio"]')].filter(r => !r.disabled)
  const at = radios.indexOf(e.target.closest?.('[role="radio"]'))
  if (at < 0) return
  e.preventDefault()
  e.stopPropagation()
  const next = radios[(at + step + radios.length) % radios.length]
  next.focus()
  if (check && next.getAttribute('aria-checked') !== 'true') next.click()
}
