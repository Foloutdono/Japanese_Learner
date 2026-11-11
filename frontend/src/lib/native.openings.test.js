import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── 発車案内の扉 — a link from outside, taken once ──────────────
// The widget's Depart starts the app on app.tsuji://open/run, and
// getLaunchUrl keeps answering with that link for the life of the
// process. NativeBridge bound the openings again at every path, and
// each binding read it again: every way out of the run boarded it
// again. The start's link is read once a run, whoever binds.

const launchUrl = vi.fn()
const appListeners = {}

vi.mock('@capacitor/core', () => ({ registerPlugin: () => ({}) }))
vi.mock('@capacitor/app', () => ({
  App: {
    getLaunchUrl: () => launchUrl(),
    addListener: (name, fn) => {
      appListeners[name] = fn
      return Promise.resolve({ remove: () => { delete appListeners[name] } })
    },
  },
}))
vi.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: { addListener: () => Promise.resolve({ remove: () => {} }) },
}))
vi.mock('@capacitor/browser', () => ({ Browser: {} }))
vi.mock('@capacitor/filesystem', () => ({ Filesystem: {}, Directory: {} }))
vi.mock('@capacitor/share', () => ({ Share: {} }))
vi.mock('@capacitor/splash-screen', () => ({ SplashScreen: {} }))
vi.mock('@capacitor/status-bar', () => ({ StatusBar: {}, Style: {} }))

const settle = () => new Promise(r => setTimeout(r, 0))

let onOpenings
beforeEach(async () => {
  vi.resetModules()
  launchUrl.mockReset()
  for (const k of Object.keys(appListeners)) delete appListeners[k]
  ;({ onOpenings } = await import('./native'))
})

describe('onOpenings', () => {
  it('takes the link the app was started with', async () => {
    launchUrl.mockResolvedValue({ url: 'app.tsuji://open/run' })
    const handler = vi.fn()
    onOpenings(handler)
    await settle()
    expect(handler).toHaveBeenCalledExactlyOnceWith({ to: '/today/run', via: 'widget' })
  })

  it('never takes it again when bound again', async () => {
    launchUrl.mockResolvedValue({ url: 'app.tsuji://open/run' })
    const first = vi.fn()
    const unbind = onOpenings(first)
    await settle()
    unbind()
    await settle()

    // The learner leaves the run; the bridge binds again.
    const second = vi.fn()
    onOpenings(second)
    await settle()
    expect(launchUrl).toHaveBeenCalledTimes(1)
    expect(second).not.toHaveBeenCalled()
  })

  it('reads it once even when the first start had none', async () => {
    launchUrl.mockResolvedValue(undefined)
    onOpenings(vi.fn())
    await settle()
    // Android's intent data, or iOS's last link: a later read can hold a
    // link the listener already took, and must not take it twice.
    launchUrl.mockResolvedValue({ url: 'app.tsuji://open/today' })
    const again = vi.fn()
    onOpenings(again)
    await settle()
    expect(launchUrl).toHaveBeenCalledTimes(1)
    expect(again).not.toHaveBeenCalled()
  })

  it('still takes a link opened while the app runs', async () => {
    launchUrl.mockResolvedValue({ url: 'app.tsuji://open/run' })
    onOpenings(vi.fn())
    await settle()
    const handler = vi.fn()
    onOpenings(handler)
    await settle()
    appListeners.appUrlOpen({ url: 'app.tsuji://open/today' })
    expect(handler).toHaveBeenCalledExactlyOnceWith({ to: '/today', via: 'widget' })
  })

  it('takes a cold start\'s link once when it arrives both ways', async () => {
    let resolve
    launchUrl.mockReturnValue(new Promise(r => { resolve = r }))
    const handler = vi.fn()
    onOpenings(handler)
    appListeners.appUrlOpen({ url: 'app.tsuji://open/run' })
    resolve({ url: 'app.tsuji://open/run' })
    await settle()
    expect(handler).toHaveBeenCalledTimes(1)
  })
})
