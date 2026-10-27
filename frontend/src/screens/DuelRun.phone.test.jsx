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

const refusal = code => Object.assign(new Error(code), { code, status: 409 })

function serve({ endsIn = 60_000, verdict = null, mine = 0, kind = 'friend', answerFails = null, coverFails = 0 } = {}) {
  apiJson.mockReset()
  let coverReads = 0
  apiJson.mockImplementation(async (path, _s, init) => {
    if (path.endsWith('/start')) {
      return {
        startsAt: iso(-50), endsAt: iso(endsIn), serverNow: iso(0), q: word(0), qAt: iso(-50),
        total: 0, rights: 0, opponent: { timeline: [{ t: 1000, pts: 100, right: true }] },
      }
    }
    if (path.endsWith('/answer')) {
      if (answerFails) throw answerFails()
      const { pick } = JSON.parse(init.body)
      const right = pick === 0
      // `answer` is what an older server said; the run must not show it.
      return { n: 0, right, answer: 0, pts: right ? 100 : 0, ms: 900, total: right ? 100 : 0, rights: right ? 1 : 0, next: word(1), nextAt: iso(1000), endsAt: iso(endsIn) }
    }
    // The cover; once the run is over, the settled one (the first reads
    // after the start failing, when asked to).
    const started = apiJson.mock.calls.some(([p]) => p.endsWith('/start'))
    if (started && coverReads++ < coverFails) throw new Error('down')
    return verdict && started
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

  it('picks a run up where it was after a crash, with no ticket to press', async () => {
    serve()
    apiJson.mockImplementation(async path => {
      if (path.endsWith('/start')) {
        return { startsAt: iso(-20_000), endsAt: iso(40_000), serverNow: iso(0), q: word(3), qAt: iso(-500), total: 300, rights: 3, opponent: null }
      }
      return cover({ you: { ...cover().you, started: true } })
    })
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
    const root = screen.container
    await expect.poll(() => root.querySelectorAll('.pvp-tile').length).toBe(4)
    expect(root.querySelector('.exam-cover__go')).toBeNull()
    expect(root.querySelector('.pvp-train__fig').textContent).toBe('300')
    // The minute the server kept: forty seconds left, not sixty.
    const left = Number(root.querySelector('.stage__where-latin').textContent.match(/\d+/)[0])
    expect(left).toBeGreaterThan(30)
    expect(left).toBeLessThanOrEqual(40)
    expect(apiJson.mock.calls.filter(([p]) => p.endsWith('/start'))).toHaveLength(1)
  })

  it('ends the run at once when the duel closed under it, and says so', async () => {
    serve({ answerFails: () => refusal('pvp_closed'), mine: 300, verdict: { status: 'cancelled', result: null,
      you: { ...cover().you, played: true, started: true, score: 300, rights: 3, answered: 5, xp: 23, refunded: false } } })
    const root = await stage()
    await expect.poll(() => root.querySelectorAll('.pvp-tile').length).toBe(4)
    root.querySelectorAll('.pvp-tile')[0].click()
    await expect.poll(() => root.querySelector('.pvp-result__word')?.textContent, { timeout: 4000 }).toBe('Annulé')
    expect(root.textContent).toContain('Pas de verdict pour ce duel.')
    // Every answer counted, not only the right ones.
    expect(root.querySelector('.pvp-face__rights').textContent).toBe('3 justes sur 5')
    expect(root.querySelector('.pvp-result__review')).toBeNull()
    // No rematch with a friend the duel was closed on: the way back to the hall.
    expect(root.querySelector('.exam-cover__go').textContent).toBe('Duels')
  })

  it('says a ranked fare closed with the duel is given back', async () => {
    serve({ answerFails: () => refusal('pvp_closed'), kind: 'ranked', verdict: { status: 'cancelled', result: null,
      you: { ...cover().you, played: true, started: true, score: 100, rights: 1, answered: 1, xp: 7, refunded: true } } })
    const root = await stage()
    await expect.poll(() => root.querySelectorAll('.pvp-tile').length).toBe(4)
    root.querySelectorAll('.pvp-tile')[0].click()
    await expect.poll(() => root.querySelector('.pvp-result__word')?.textContent, { timeout: 4000 }).toBe('Annulé')
    // The colon's space is French typography's narrow one, set at display.
    expect(root.textContent).toMatch(/Pas de verdict pour ce duel\s: tes crédits sont rendus\./)
    expect(root.querySelector('.exam-cover__go').textContent).toBe('Nouveau sprint')
  })

  it('leaves the question to answer again when the network failed', async () => {
    serve()
    // The first answer is lost on the way; the second goes through.
    const served = apiJson.getMockImplementation()
    let tries = 0
    apiJson.mockImplementation(async (path, s, init) => {
      if (path.endsWith('/answer') && tries++ === 0) throw new Error('offline')
      return served(path, s, init)
    })
    const root = await stage()
    await expect.poll(() => root.querySelectorAll('.pvp-tile').length).toBe(4)
    root.querySelectorAll('.pvp-tile')[0].click()
    await expect.poll(() => root.querySelector('.pvp-tile[disabled]')).toBeNull()
    expect(root.querySelector('.pvp-result')).toBeNull()
    root.querySelectorAll('.pvp-tile')[0].click()
    await expect.poll(() => root.querySelector('.pvp-tile--right')).toBeTruthy()
    expect(apiJson.mock.calls.filter(([p]) => p.endsWith('/answer'))).toHaveLength(2)
  })

  it('says when the verdict could not be read, and reads it again on asking', async () => {
    serve({ endsIn: 200, mine: 400, coverFails: 1, verdict: { status: 'done', result: {
      outcome: 'win', mine: 400, theirs: 300, rights: 4, theirRights: 3, answered: 5, theirAnswered: 4, elo: null, xp: 30,
    } } })
    const root = await stage()
    await expect.poll(() => root.querySelector('.pvp-retry'), { timeout: 4000 }).toBeTruthy()
    expect(root.querySelector('.pvp-result__word')).toBeNull()
    expect(root.textContent).not.toContain('En attente')
    root.querySelector('.pvp-retry').click()
    await expect.poll(() => root.querySelector('.pvp-result__word')?.textContent, { timeout: 4000 }).toBe('Gagné')
  })

  it('reads the ticket again when « Partir » finds the duel closed, and keeps no button that would fail', async () => {
    apiJson.mockReset()
    let closed = false
    apiJson.mockImplementation(async path => {
      if (path.endsWith('/start')) {
        closed = true
        throw refusal('pvp_closed')
      }
      return closed ? cover({ status: 'cancelled' }) : cover()
    })
    const root = await stage()
    await expect.poll(() => root.querySelector('.pvp-run__help')?.textContent, { timeout: 4000 }).toBe('Ce duel est fermé.')
    expect([...root.querySelectorAll('.pvp-run__help')].filter(p => p.textContent === 'Ce duel est fermé.')).toHaveLength(1)
    expect(root.querySelector('.exam-cover__go')).toBeNull()
    expect([...root.querySelectorAll('button')].map(b => b.textContent)).toContain('Duels')
    expect([...root.querySelectorAll('button')].map(b => b.textContent)).not.toContain('Refuser le défi')
  })
})

