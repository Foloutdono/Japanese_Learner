// ── The camera (plan 283) ────────────────────────────────────────
// Frames straight from Chrome's compositor (CDP's screencast), each with
// its own timestamp, then laid on a constant 30 fps by ffmpeg: sharper
// than Playwright's own recorder, which encodes VP8 at a low bitrate as
// it goes. A screen that does not move sends no frame; its last one is
// held for as long as it stood.
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export async function roll(page, v) {
  const cdp = await page.context().newCDPSession(page)
  const frames = []
  cdp.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    frames.push({ t: metadata.timestamp, data })
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
  })
  await cdp.send('Page.startScreencast', {
    format: 'jpeg', quality: 95, everyNthFrame: 1,
    maxWidth: v.width * v.scale, maxHeight: v.height * v.scale,
  })
  return async () => {
    const end = Date.now() / 1000
    await cdp.send('Page.stopScreencast').catch(() => {})
    return { frames, end }
  }
}

// H.264 at exactly the format's size, 30 fps, yuv420p, muted, with the
// index at the head (faststart) so the page can start it at once.
export function encode({ frames, end }, out, { width, height, crf }) {
  const dir = `${out}.frames`
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
  const name = i => `f${String(i).padStart(5, '0')}.jpg`
  let list = ''
  frames.forEach((f, i) => {
    writeFileSync(join(dir, name(i)), Buffer.from(f.data, 'base64'))
    const next = i + 1 < frames.length ? frames[i + 1].t : end
    list += `file '${name(i)}'\nduration ${Math.max(next - f.t, 0.001).toFixed(4)}\n`
  })
  list += `file '${name(frames.length - 1)}'\n`
  writeFileSync(join(dir, 'list.txt'), list)
  const vf = `scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=0x17151a,fps=30,format=yuv420p`
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', join(dir, 'list.txt'),
    '-vf', vf, '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-profile:v', 'high',
    '-movflags', '+faststart', out])
  rmSync(dir, { recursive: true, force: true })
  return { bytes: statSync(out).size, seconds: end - frames[0].t, fps: (frames.length - 1) / (frames.at(-1).t - frames[0].t) }
}

// The still the page shows before the clip plays: its first frame, so
// the poster gives way to the film without a jump.
export function still(video, out, { width, height }) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', '0.1', '-i', video, '-frames:v', '1',
    '-vf', `scale=${width}:${height}`, '-q:v', '3', out])
  return statSync(out).size
}
