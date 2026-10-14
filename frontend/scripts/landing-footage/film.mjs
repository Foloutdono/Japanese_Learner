// node scripts/landing-footage/film.mjs [phone|desk] clip [clip …]
// Films the named clips against the local app (see README.md) into out/.
import { mkdirSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { open, APP } from './session.mjs'
import { startRecording } from './record.mjs'
import { CLIPS } from './clips.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const OUT = process.env.OUT || join(here, 'out')
mkdirSync(OUT, { recursive: true })
const env = readFileSync(join(here, '../../../backend/.env'), 'utf8')
const DSN = env.match(/^DATABASE_URL=(.*)$/m)[1].trim()
const DUMP = process.env.DUMP || join(OUT, 'demo.sql')

const sh = (cmd, args, input) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8', input, maxBuffer: 1 << 28 })
  if (r.status) throw new Error(`${cmd}: ${r.stderr}`)
  return r.stdout
}
const restore = () => {
  sh('psql', [DSN, '-q', '-c', 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'])
  sh('psql', [DSN, '-q', '-v', 'ON_ERROR_STOP=0', '-f', DUMP])
}

const [device, ...ids] = process.argv.slice(2)
if (!['phone', 'desk'].includes(device)) throw new Error('usage: film.mjs phone|desk clip…')
if (process.env.SNAPSHOT) { sh('pg_dump', [DSN, '--no-owner', '-f', DUMP]); console.log('snapshot written') }

for (const id of ids) {
  const clip = (CLIPS[id] || {})[device] || CLIPS[id]
  if (!clip) throw new Error(`no clip ${id}`)
  restore()
  const { browser, page, width, height, scale } = await open(device)
  page.cards = []
  page.batches = []
  page.papers = []
  page.on('response', async r => { if (/\/api\/\w+\/cards/.test(r.url())) page.cards.push(await r.json().catch(() => null))
    if (/\/api\/exams\/[^/]+$/.test(r.url()) && r.status() === 200) page.papers.push(await r.json().catch(() => ({})))
    if (r.url().includes('/api/reading/batch')) page.batches.push(await r.json().catch(() => ({}))) })
  page.on('pageerror', e => console.log('  pageerror:', e.message.slice(0, 160)))
  await page.goto(APP + clip.start)
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.waitForTimeout(2800)
  const rec = await startRecording(page, { width: width * scale, height: height * scale })
  await page.waitForTimeout(500)
  let failed
  try { await clip.run(page) } catch (e) { failed = e }
  await page.waitForTimeout(900)
  const name = device === 'desk' ? `${id}-desk` : id
  const info = await rec.stop(join(OUT, `${name}.mp4`), { still: join(OUT, `${name}.jpg`) })
  await browser.close()
  console.log(failed ? 'FAILED' : 'ok', name, info, failed ? failed.message.split('\n')[0] : '')
}
