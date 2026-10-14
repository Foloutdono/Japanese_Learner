// Records a page as the app draws it: the browser's own screencast, at
// the device's pixels, cut into a constant 30 fps h264 file.
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'

export async function startRecording(page, { width, height }) {
  const cdp = await page.context().newCDPSession(page)
  const dir = mkdtempSync(join(tmpdir(), 'footage-'))
  const frames = []
  let closed = false
  cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    if (closed) return
    const n = frames.length
    frames.push({ t: metadata.timestamp, file: join(dir, `${String(n).padStart(6, '0')}.jpg`) })
    writeFileSync(frames[n].file, Buffer.from(data, 'base64'))
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
  })
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: width, maxHeight: height, everyNthFrame: 1 })
  const started = Date.now()
  return {
    frames,
    async stop(out, { crf = 26, trimStart = 0, still = null } = {}) {
      await cdp.send('Page.stopScreencast').catch(() => {})
      closed = true
      const end = Date.now() / 1000 - 0.05
      const list = []
      const keep = frames.filter(f => f.t >= frames[0].t + trimStart)
      keep.forEach((f, i) => list.push(`file '${f.file}'`, `duration ${((keep[i + 1]?.t ?? end) - f.t).toFixed(4)}`))
      list.push(`file '${keep.at(-1).file}'`)
      const txt = join(dir, 'list.txt')
      writeFileSync(txt, list.join('\n'))
      const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', txt,
        '-vf', `fps=30,scale=${width}:${height}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf),
        '-movflags', '+faststart', '-an', out], { encoding: 'utf8' })
      if (r.status) throw new Error(r.stderr)
      if (still) spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', keep[0].file, '-vf', `scale=${width}:${height}`, '-q:v', '3', still])
      const info = { frames: keep.length, seconds: +(end - keep[0].t).toFixed(2), wall: (Date.now() - started) / 1000 }
      rmSync(dir, { recursive: true, force: true })
      return info
    },
  }
}
