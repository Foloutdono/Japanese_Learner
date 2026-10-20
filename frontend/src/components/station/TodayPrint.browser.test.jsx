import { describe, it, expect } from 'vitest'
import { render } from 'vitest-browser-react'
import { LangProvider } from '../../LangContext'
import { TodayPrint } from './TodayPrint'
import '../../index.css'

// ── 浮世絵 — the print behind the gate (plans 205, 206) ──────────
// The print is fetched from public/today/print/ (the real files, served
// as the app serves them) and laid in its layers; on a day with nothing
// left the last train has gone from the viaduct.

const settle = (ms = 60) => new Promise(r => setTimeout(r, ms))

async function print(props) {
  const screen = await render(
    <LangProvider>
      <div style={{ position: 'relative', width: 390, height: 746 }}>
        <TodayPrint look="autumn-night" device="phone" {...props} />
      </div>
    </LangProvider>
  )
  await expect.poll(() => screen.container.querySelector('.tpr__art--in'), { timeout: 5000 }).toBeTruthy()
  await settle()
  return screen
}

describe('the print of the hour', () => {
  it('lays the print in its layers, the train on its own', async () => {
    const screen = await print({})
    expect(screen.container.querySelectorAll('.tpr__layer')).toHaveLength(3)
    expect(screen.container.querySelector('.tpr__rail .tpr__train')).toBeTruthy()
  })

  it('has the last train gone on a day with nothing left', async () => {
    const screen = await print({ train: false })
    expect(screen.container.querySelectorAll('.tpr__layer')).toHaveLength(3)
    expect(screen.container.querySelector('.tpr__rail')).toBeNull()
  })

  it('fetches nothing before the frame has said which print it takes', async () => {
    const screen = await render(<LangProvider><TodayPrint look="autumn-night" device={null} /></LangProvider>)
    await settle(200)
    expect(screen.container.querySelector('.tpr__art--in')).toBeNull()
  })
})
