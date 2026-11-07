// `npm test`: every lane, in CI's three groups, one group after another.
//
// The seven browser lanes run at once starve one another on a machine of
// four cores: a test that takes 1.8s alone ran past vitest's 15s, a frame
// was read before it had drawn, a different test each run. CI found it
// first and gave each group a runner of its own (.github/workflows/ci.yml:
// `frontend-node`, the phone and small screens, `frontend-desk`); `npm
// test` ran them all together still, so a full run here failed where CI
// passed. Run apart, they pass as they do alone. The groups are the
// package's own scripts' (test:node, test:browsers:mobile,
// test:browsers:desk).
//
// Arguments are handed to every group (`npm test -- -t "the card"`), and a
// group none of whose files a filter matches passes rather than fails. The
// run goes on past a failing group, so every failure is reported, and
// exits non-zero if any group failed.
import { spawnSync } from 'node:child_process'

const GROUPS = [
  ['node'],
  ['browser', 'phone', 'tablet', 'touch'],
  ['desktop', 'wide', 'short'],
]

const extra = process.argv.slice(2)
const failed = []
for (const group of GROUPS) {
  const args = ['vitest', 'run', ...group.flatMap(p => ['--project', p]), '--passWithNoTests', ...extra]
  const { status } = spawnSync('npx', args, { stdio: 'inherit', shell: process.platform === 'win32' })
  if (status !== 0) failed.push(group.join(', '))
}
if (failed.length) {
  console.error(`\nFailed: ${failed.map(g => `[${g}]`).join(' ')}`)
  process.exit(1)
}
