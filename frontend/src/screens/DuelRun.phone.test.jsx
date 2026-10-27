import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import { StageFrame } from '../components/chrome/Shell'
import '../index.css'

// ── 対戦 — a duel's run against its server (plan 276) ──────────────
// What the run must never get wrong: a reply says right or wrong and
// never which choice was right (the paper is shared, and the corrections
// are sold once the duel is settled); a word's meanings are read in the
// learner's language; the verdict is the server's, waiting while the
// other has yet to run. And the owner's two drawings: the race is the
// gap on the line, never a sentence (P2c); the result, the two totals
// face to face and the Elo the duel moved (R1a).

const apiJson = vi.fn()
vi.mock('../lib/api', () => ({
  api: p => p,
  apiFetch: vi.fn(),
  apiJson: (...a) => apiJson(...a),
  apiJsonWithTimeout: vi.fn(),
  apiUpload: vi.fn(),
  ApiError: class ApiError extends Error {},
}))
vi.mock('../lib/audio', async importOriginal => ({
  ...(await importOriginal()),
  playUi: () => {}, playClick: () => {}, startAmbiance: () => {}, stopAmbiance: () => {},
}))
vi.mock('../stores/duels', () => ({ refreshDuels: vi.fn(), useDuels: () => ({ data: null }) }))
vi.mock('../components/chrome/LevelBar', () => ({ LevelBar: () => null }))

const { default: DuelRun } = await import('./DuelRun')

const iso = ms => new Date(Date.now() + ms).toISOString()
const word = n => ({
  n, kind: 'word', prompt: '先生', reading: 'せんせい',
  choices: { fr: ['professeur', 'gare', 'pluie', 'livre'], en: ['teacher', 'station', 'rain', 'book'] },
})
const cover = (over = {}) => ({
  id: 7, kind: 'friend', mode: 'async', level: 'N5', status: 'open', against: 'friend',
  you: { username: 'Lucas', level: 'N5', role: 'opponent', played: false, started: false, score: null, rights: null, xp: null },
  them: { username: 'Kenta', level: 'N5', elo: 1300, played: true, score: 500, rights: 5 },
  price: 0, expiresAt: iso(3_600_000), startsAt: null, serverNow: iso(0), result: null,
  reviewed: false, reviewPrice: 1, xp: { today: 0, cap: 150 },
  ...over,
})

function serve({ endsIn = 60_000, verdict = null, mine = 0, kind = 'friend' } = {}) {
  apiJson.mockReset()
  apiJson.mockImplementation(async (path, _s, init) => {
    if (path.endsWith('/start')) {
      return {
        startsAt: iso(-50), endsAt: iso(endsIn), serverNow: iso(0), q: word(0), qAt: iso(-50),
        total: 0, rights: 0, opponent: { timeline: [{ t: 1000, pts: 100, right: true }] },
      }
    }
    if (path.endsWith('/answer')) {
      const { pick } = JSON.parse(init.body)
      const right = pick === 0
      // `answer` is what an older server said; the run must not show it.
      return { n: 0, right, answer: 0, pts: right ? 100 : 0, ms: 900, total: right ? 100 : 0, rights: right ? 1 : 0, next: word(1), nextAt: iso(1000), endsAt: iso(endsIn) }
    }
    // The cover; once the run is over, the settled one.
    return verdict && apiJson.mock.calls.some(([p]) => p.endsWith('/start'))
      ? cover({ kind, you: { ...cover().you, played: true, started: true, score: mine, rights: 4, xp: 30 }, ...verdict })
      : cover({ kind })
  })
}

async function stage() {
  const screen = await render(
    <LangProvider>
      <MemoryRouter initialEntries={['/duel/7']}>
        <Routes>
          <Route element={<StageFrame />}>
            <Route path="/duel/:id" element={<DuelRun session={{ access_token: 'tok' }} />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
  await expect.poll(() => screen.container.querySelector('.exam-cover__go')).toBeTruthy()
  screen.container.querySelector('.exam-cover__go').click()
  return screen.container
}

beforeEach(() => {
  localStorage.setItem('lang', 'fr')
})

describe('a duel’s run', () => {
  it('reads a word’s meanings in the learner’s language', async () => {
    serve()
    const root = await stage()
    await expect.poll(() => root.querySelectorAll('.pvp-tile').length).toBe(4)
    expect([...root.querySelectorAll('.pvp-tile')].map(b => b.textContent)).toEqual(['1professeur', '2gare', '3pluie', '4livre'])
  })

  it('marks the tile picked, and never the right one', async () => {
    serve()
    const root = await stage()
    await expect.poll(() => root.querySelectorAll('.pvp-tile').length).toBe(4)
    root.querySelectorAll('.pvp-tile')[2].click()
    await expect.poll(() => root.querySelector('.pvp-tile--wrong')).toBeTruthy()
    const tiles = [...root.querySelectorAll('.pvp-tile')]
    expect(tiles[2].classList.contains('pvp-tile--wrong')).toBe(true)
    expect(root.querySelector('.pvp-tile--right')).toBeNull()
    const sent = apiJson.mock.calls.find(([p]) => p.endsWith('/answer'))
    expect(JSON.parse(sent[2].body)).toEqual({ n: 0, pick: 2 })
  })

  it('prints the server’s verdict once the minute is over', async () => {
    serve({ endsIn: 200, mine: 400, verdict: { status: 'done', result: {
      outcome: 'loss', mine: 400, theirs: 500, rights: 4, theirRights: 5, answered: 6, theirAnswered: 5, elo: null, xp: 30,
    } } })
    const root = await stage()
    await expect.poll(() => root.querySelector('.pvp-result__word')?.textContent, { timeout: 4000 }).toBe('Perdu')
    expect(root.textContent).toContain('+30')
  })

  it('waits for the other player rather than declaring a winner', async () => {
    serve({ endsIn: 200, mine: 400, verdict: { status: 'open', result: null, them: { ...cover().them, played: false, score: null } } })
    const root = await stage()
    await expect.poll(() => root.querySelector('.pvp-result__word')?.textContent, { timeout: 4000 }).toBe('En attente de Kenta')
    expect(root.querySelector('.pvp-result__review')).toBeNull()
  })

  it('draws the gap on the trailing train’s rail, and no sentence', async () => {
    serve()
    const root = await stage()
    // The other's recorded answer, a second in: 100 to nothing.
    await expect.poll(() => root.querySelector('.pvp-gapline__fig')?.textContent, { timeout: 4000 }).toBe('−100')
    const gap = root.querySelector('.pvp-gapline')
    expect(gap.closest('.pvp-track').classList.contains('pvp-track--me')).toBe(true)
    // Behind, the hatching is the leader's ink, not the learner's.
    expect(gap.classList.contains('pvp-gapline--mine')).toBe(false)
    expect(root.querySelectorAll('.pvp-gapline')).toHaveLength(1)
    expect(root.querySelector('.pvp-line-race').textContent).not.toMatch(/mènes|retard/)
  })

  it('shows the Elo a ranked duel moved beside the XP it paid', async () => {
    serve({ endsIn: 200, mine: 1572, kind: 'ranked', verdict: { status: 'done', them: { ...cover().them, username: 'Hiro_88' }, result: {
      outcome: 'win', mine: 1572, theirs: 1559, rights: 19, theirRights: 17, answered: 23, theirAnswered: 21,
      elo: { before: 1237, after: 1248, delta: 11 }, xp: 137,
    } } })
    const root = await stage()
    await expect.poll(() => root.querySelector('.pvp-result__word')?.textContent, { timeout: 4000 }).toBe('Gagné')
    expect([...root.querySelectorAll('.pvp-face__fig')].map(f => f.textContent))
      .toEqual([(1572).toLocaleString('fr'), (1559).toLocaleString('fr')])
    // The finish under them, each car where its total stopped.
    expect(root.querySelectorAll('.pvp-finish__row')).toHaveLength(2)
    const facts = root.querySelector('.pvp-result__facts')
    expect(facts.textContent).toContain(`${(1248).toLocaleString('fr')}+11`)
    expect(facts.textContent).toContain('+137XP')
  })
})
