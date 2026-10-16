// ── 撮影 — filming a page one frame at a time (plan 210) ───────────────
// A screen recording of a busy page drops frames and stutters, and
// a headless browser in a container renders far slower than real time.
// So the reel is not recorded, it is stepped: Chrome's headless shell
// runs with its clocks under our control (--deterministic-mode), and
// for every frame we
//
//   1. advance the page's virtual time by one frame (timers, Date,
//      performance.now: Emulation.setVirtualTimePolicy with a budget),
//   2. let the director catch up (`__reel.tick()`: the sound rendered to
//      this instant, the taps it has decided on handed over),
//   3. press what it asked for, as real input (CDP Input: :active, focus
//      and the browser's own click, exactly as a finger would),
//   4. draw the frame at that instant (HeadlessExperimental.beginFrame,
//      whose frame time drives CSS animations, transitions and rAF) and
//      take its picture.
//
// Every frame is therefore exactly 1/fps after the last, however long it
// took to draw, and two renders of one script are the same film.

import { chromium } from 'playwright'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'

const DETERMINISTIC = [
  '--deterministic-mode',
  '--enable-begin-frame-control',
  '--disable-new-content-rendering-timeout',
  '--run-all-compositor-stages-before-draw',
  '--disable-threaded-animation',
  '--disable-threaded-scrolling',
  '--disable-checker-imaging',
  '--disable-image-animation-resync',
  '--autoplay-policy=no-user-gesture-required',
  '--font-render-hinting=none',
]

/** A headless shell to launch: Playwright's own, else any installed one. */
function shellCandidates() {
  if (process.env.REEL_CHROME) return [process.env.REEL_CHROME]
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, join(homedir(), '.cache', 'ms-playwright')].filter(Boolean)
  const found = []
  for (const root of roots) {
    if (!existsSync(root)) continue
    for (const dir of readdirSync(root).filter(d => d.startsWith('chromium_headless_shell-')).sort().reverse()) {
      for (const rel of ['chrome-linux/headless_shell', 'chrome-headless-shell-linux64/chrome-headless-shell',
        'chrome-mac/headless_shell', 'chrome-headless-shell-mac-arm64/chrome-headless-shell',
        'chrome-headless-shell-mac-x64/chrome-headless-shell', 'chrome-win/headless_shell.exe',
        'chrome-headless-shell-win64/chrome-headless-shell.exe']) {
        const file = join(root, dir, rel)
        if (existsSync(file)) found.push(file)
      }
    }
  }
  return found
}

/**
 * The headless shell, at the film's pixel density. A frame taken by
 * beginFrame is the window's own pixels, which Playwright's emulated
 * deviceScaleFactor does not reach: the scale is the window's, set here.
 */
export async function launchShell({ scale = 1 } = {}) {
  const args = [...DETERMINISTIC, `--force-device-scale-factor=${scale}`]
  try {
    if (!process.env.REEL_CHROME) return await chromium.launch({ headless: true, args })
  } catch (err) {
    if (!/Executable doesn't exist/.test(err.message)) throw err
  }
  for (const executablePath of shellCandidates()) {
    try { return await chromium.launch({ headless: true, executablePath, args }) } catch { /* next */ }
  }
  throw new Error('No Chrome headless shell found: run `npx playwright install chromium-headless-shell`, or set REEL_CHROME.')
}

/**
 * The stepped clock of one page. `frame()` advances it by 1/fps and
 * draws; `pump()` keeps it running (no pictures) until `until()` holds.
 */
export async function steppedPage(context, { fps, initialVirtualTime }) {
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  const interval = 1000 / fps
  // The renderer's frame clock runs on the machine's monotonic clock
  // (TimeTicks, in ms): frame times must start there and only grow.
  let ticks = Number(process.hrtime.bigint() / 1000n) / 1000
  // The page's wall clock starts where the script says (its hour decides
  // Today's print, and the status bar prints it).
  await cdp.send('Emulation.setVirtualTimePolicy', {
    policy: 'pause',
    ...(initialVirtualTime ? { initialVirtualTime } : {}),
  })

  async function advance() {
    await new Promise((resolve, reject) => {
      cdp.once('Emulation.virtualTimeBudgetExpired', resolve)
      cdp.send('Emulation.setVirtualTimePolicy', {
        policy: 'pauseIfNetworkFetchesPending',
        budget: interval,
        maxVirtualTimeTaskStarvationCount: 100,
      }).catch(reject)
    })
  }

  async function draw(screenshot) {
    ticks += interval
    const r = await cdp.send('HeadlessExperimental.beginFrame', {
      frameTimeTicks: ticks,
      interval,
      ...(screenshot ? { screenshot: { format: screenshot.format, quality: screenshot.quality, optimizeForSpeed: true } } : {}),
    })
    return r.screenshotData ? Buffer.from(r.screenshotData, 'base64') : null
  }

  return {
    page,
    cdp,
    async pump(until, { max = 6000, label = 'page' } = {}) {
      for (let i = 0; i < max; i++) {
        await advance()
        await draw(null)
        if (await until().catch(() => false)) return i
      }
      throw new Error(`${label} never became ready (${max} frames)`)
    },
    advance,
    draw,
  }
}

/**
 * Press, release, move and type, as the director asked, as real input.
 * Sent in order and NOT awaited one by one: Chrome dispatches a mouse
 * move on the next frame (rAF-aligned input), so a move awaited before
 * the frame that delivers it would wait forever. The caller draws the
 * frame, then awaits what this returns.
 */
export function dispatchInputs(cdp, inputs) {
  return Promise.all(inputs.map(input => send(cdp, input)))
}

function send(cdp, input) {
  switch (input.kind) {
    case 'mouse':
      return cdp.send('Input.dispatchMouseEvent', {
        type: input.type,
        x: input.x,
        y: input.y,
        button: input.type === 'mouseMoved' ? 'none' : 'left',
        buttons: input.type === 'mousePressed' || input.drag ? 1 : 0,
        clickCount: input.type === 'mouseMoved' ? 0 : 1,
        pointerType: 'mouse',
      })
    case 'wheel':
      return cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: input.x, y: input.y, deltaX: 0, deltaY: input.dy })
    case 'text':
      return cdp.send('Input.insertText', { text: input.text })
    case 'compose':
      return cdp.send('Input.imeSetComposition', { text: input.text, selectionStart: input.text.length, selectionEnd: input.text.length })
    case 'key': {
      const key = { key: input.key, code: input.code ?? input.key, windowsVirtualKeyCode: input.keyCode ?? 0 }
      return Promise.all([
        cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', ...key }),
        cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', ...key }),
      ])
    }
    default:
      return Promise.reject(new Error(`unknown input ${input.kind}`))
  }
}
