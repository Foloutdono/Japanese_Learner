import { describe, it, expect, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import { CardTransition } from './CardTransition'
// The stamp's onDone rides a real animationend, so the sheet that
// declares card-stamp-fade-out has to be loaded for it to fire.
import '../../index.css'

vi.mock('../../lib/audio', async (o) => ({ ...(await o()), playSfx: vi.fn() }))

// ── The stamp must always close the gate it opened ──────────────
// Every study screen holds the next card until onStampDone fires (see
// each screen's pendingGatesRef). So the one thing CardTransition may
// never do is accept a stamp and then stay silent about it: that hangs
// the queue on an animation nobody is going to run, and the learner is
// stuck on a card they have already answered.
//
// This is not hypothetical. TodayScreen built the stamp's key as
// `id|mode` and the transition's as `id:mode:nonce` — two strings that
// can never be equal — so its promotion stamps were invisible AND every
// stamped review froze behind the screens' 4s safety net, or forever
// when the same review also levelled you up, because that path arms no
// timer at all.

const settle = ms => new Promise(r => setTimeout(r, ms))

function mount({ cardKey, stampKey, onStampDone }) {
  return render(
    <LangProvider>
      <CardTransition
        cardKey={cardKey}
        stamp={{ id: 1, to: 'learning', cardKey: stampKey }}
        onStampDone={onStampDone}
        stage="learning"
      >
        <div>card</div>
      </CardTransition>
    </LangProvider>
  )
}

describe('CardTransition — the stamp gate', () => {
  it('shows a stamp for the live card and reports when it finishes', async () => {
    let fired = 0
    const screen = await mount({
      cardKey: 'kanji_1:flashcard:3',
      stampKey: 'kanji_1:flashcard:3',
      onStampDone: () => { fired++ },
    })
    expect(screen.container.querySelector('.card-stamp-overlay')).toBeTruthy()
    // 'learning' holds 900ms, then fades; onDone rides the real
    // animationend, so this waits rather than guessing.
    await settle(2500)
    expect(fired, 'a shown stamp must report done').toBe(1)
  }, 30000)

  it('reports a stamp it cannot show, instead of swallowing it', async () => {
    let fired = 0
    const screen = await mount({
      cardKey: 'kanji_1:flashcard:3',
      stampKey: 'kanji_1|flashcard',   // the shape that used to hang
      onStampDone: () => { fired++ },
    })
    expect(screen.container.querySelector('.card-stamp-overlay')).toBeNull()
    await settle(200)
    expect(fired, 'an unshowable stamp must still close its gate').toBe(1)
  }, 30000)

  it('reports an unshowable stamp exactly once', async () => {
    // onStampDone is an inline arrow at every call site, so its identity
    // changes on every render; without the id guard the effect would
    // re-fire and advance the queue more than once.
    let fired = 0
    const screen = await mount({
      cardKey: 'a', stampKey: 'b', onStampDone: () => { fired++ },
    })
    for (let i = 0; i < 3; i++) {
      await screen.rerender(
        <LangProvider>
          <CardTransition
            cardKey="a"
            stamp={{ id: 1, to: 'learning', cardKey: 'b' }}
            onStampDone={() => { fired++ }}
            stage="learning"
          >
            <div>card</div>
          </CardTransition>
        </LangProvider>
      )
    }
    await settle(200)
    expect(fired).toBe(1)
  }, 30000)
})
