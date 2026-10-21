import { useLayoutEffect } from 'react'

// ── The stage's line, held between the video and the dock ────────
// The phone's stage (plan 219) sets its line at display size, and the
// server cuts a line wider than two rows of it where it cuts clean
// (study/line_cut.py). A line it could not cut -- かもしれない whole is
// three rows -- or a phone too short for two rows grew the stage past
// the screen, and the dock, held at its foot, sat on the translation
// (the owner, 2026-10-20: "if impossible to cut in two, make them
// smaller in size to not clip out").
//
// So the line steps down the rungs until the stage holds it: `data-fit`
// on the section, 1 a rung down (`--fs-heading`), 2 the floor
// (`--fs-title`, the size of every other breakdown's words), the CSS
// saying what each rung sets. Past the floor the page scrolls behind
// the dock, as a tall card does. Holding it is the stage being no
// taller than the height it was given (its min-height, the screen's
// 100dvh): measured, never guessed from the line's length, since rows
// are a matter of where its words wrap.
//
// Written straight onto the section, as the sung word is (SubtitleLine):
// a rung handed over as state redrew the whole analyser for each step.
// Tried from the top before the paint whenever `key` (the line, its
// translation, what the Affichage sheet prints) changes, and again when
// the screen does (turned, a browser's bar coming and going) and when
// the font arrives. Not on a ResizeObserver of the stage: the fit
// resizes the stage, and an observer resizing what it observes loops.
export const FIT_STEPS = 2

export function useLineFit(ref, key) {
  useLayoutEffect(() => {
    const section = ref.current
    const stage = section?.closest('.anl-m')
    if (!stage) return undefined
    let live = true
    const fit = () => {
      if (live) fitLine(section, stage)
    }
    fit()
    document.fonts?.ready.then(fit)
    window.addEventListener('resize', fit)
    return () => {
      live = false
      window.removeEventListener('resize', fit)
    }
  }, [ref, key])
}

export function fitLine(section, stage) {
  const room = parseFloat(getComputedStyle(stage).minHeight)
  const over = () => Number.isFinite(room) && stage.getBoundingClientRect().height > room + 0.5
  section.removeAttribute('data-fit')
  for (let step = 1; step <= FIT_STEPS && over(); step += 1) {
    section.setAttribute('data-fit', String(step))
  }
}
