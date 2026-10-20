import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { act } from 'react'
import { LangProvider } from '../../LangContext'
import fr from '../../locales/fr/index.js'
import { ReleaseNote, UpdateToast } from './UpdateToast'
import { releaseNotice } from '../../stores/releaseNotice'
import { swUpdate } from '../../stores/swUpdate'
import { refillClock } from '../../domain/credits'
import '../../index.css'

// ── 工事 — a release is coming (plan 264) ──
// The docked note the server's X-Release-At raises: the minute, then
// "under way", one quiet action that closes it, and the new build's
// toast held back while it speaks (one note at a time in one place).

const $ = sel => document.querySelector(sel)

function announce(at) {
  act(() => releaseNotice.seen({ status: 200, headers: { get: () => String(Math.floor(at / 1000)) } }))
}

async function draw() {
  await render(
    <LangProvider>
      <MemoryRouter><UpdateToast /><ReleaseNote /></MemoryRouter>
    </LangProvider>,
  )
}

afterEach(() => {
  act(() => { releaseNotice.reset(); swUpdate.dismiss() })
  cleanup()
})

describe('the release note', () => {
  it('draws nothing while no release is announced', async () => {
    await draw()
    expect($('.dock-note--release')).toBeNull()
  })

  it('says the minute of a coming release, and closes when read', async () => {
    await draw()
    const at = Math.ceil((Date.now() + 10 * 60 * 1000) / 1000) * 1000
    announce(at)
    expect($('.dock-note--release').textContent).toContain(fr.releaseNoticeAt(refillClock(at, 'fr')))
    act(() => $('.dock-note--release button').click())
    expect($('.dock-note--release')).toBeNull()
  })

  it('says a release is under way once its minute has passed', async () => {
    await draw()
    announce(Date.now() - 60 * 1000)
    expect($('.dock-note--release').textContent).toContain(fr.releaseNoticeNow)
  })

  it('holds the new build\'s toast back while it speaks', async () => {
    await draw()
    act(() => swUpdate.offer(() => {}))
    expect($('.dock-note--update')).not.toBeNull()
    announce(Date.now() + 5 * 60 * 1000)
    expect($('.dock-note--update')).toBeNull()
    expect($('.dock-note--release')).not.toBeNull()
  })
})
