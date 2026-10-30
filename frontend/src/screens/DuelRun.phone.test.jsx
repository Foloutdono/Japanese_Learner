import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { LangProvider } from '../LangContext'
import { StageFrame } from '../components/chrome/Shell'
import '../index.css'

// ── 対戦 — a duel's run against its server (plan 279) ──────────────
// What the run must never get wrong: a reply says right or wrong and
// never which choice was right (the paper is shared, and the corrections
// are sold once the duel is settled); a word's meanings are read in the
// learner's language; the verdict is the server's, waiting while the
// other has yet to run. And the owner's drawings: the race is the gap on
// the line, never a sentence (P2c), played as a game (C1, plan 285: the
// combo and the rush the server scores, each answer's moment, the
// arrival); the result, the two runs face to face line by line and what
// the duel paid (E4).

const apiJson = vi.fn()
// The duel's sound (plan 285): what the run asks of it, recorded.
const race = { answer: vi.fn(), pass: vi.fn(), finish: vi.fn(), stop: vi.fn() }
const startDuelRace = vi.fn(() => race)
const playDuelResult = vi.fn(() => ({ stop: () => {} }))
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
  loadDuelAudio: () => Promise.resolve(null), releaseDuelAudio: () => {},
  startDuelRace: (...a) => startDuelRace(...a), playDuelResult: (...a) => playDuelResult(...a),
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
// The rules a sprint-2 duel is scored by (study/duels.rules).
const RULES = { tiers: [{ at: 5, mult: 1.5 }, { at: 10, mult: 2 }, { at: 20, mult: 3 }], rushMs: 15_000 }
const lines = (over = {}) => ({ speed: 400, combo: 0, rush: 0, best: 4, flashes: 4, rights: 4, answered: 5, grade: null, ...over })
// French welds a space before ! to the word (locales/frenchSpacing).
const VICTORY = 'Victoire\u00a0!'

function serve({ endsIn = 60_000, verdict = null, mine = 0, kind = 'friend', answerFails = null, coverFails = 0, nextIn = 1000, rules = null, reply = {} } = {}) {
  apiJson.mockReset()
  let coverReads = 0
  apiJson.mockImplementation(async (path, _s, init) => {
    if (path.endsWith('/start')) {
      return {
        startsAt: iso(-50), endsAt: iso(endsIn), serverNow: iso(0), q: word(0), qAt: iso(-50),
        total: 0, rights: 0, opponent: { timeline: [{ t: 1000, pts: 100, right: true }] }, rules,
      }
    }
    if (path.endsWith('/answer')) {
      if (answerFails) throw answerFails()
      const { pick } = JSON.parse(init.body)
      const right = pick === 0
      // `answer` is what an older server said; the run must not show it.
      return { n: 0, right, answer: 0, pts: right ? 100 : 0, ms: 900, total: right ? 100 : 0, rights: right ? 1 : 0, next: word(1), nextAt: iso(nextIn), endsAt: iso(endsIn), ...reply }
    }
    // The cover; once the run is over, the settled one (the first reads
    // after the start failing, when asked to).
    const started = apiJson.mock.calls.some(([p]) => p.endsWith('/start'))
    if (started && coverReads++ < coverFails) throw new Error('down')
    return verdict && started
      ? cover({ kind, rules, you: { ...cover().you, played: true, started: true, score: mine, rights: 4, xp: 30 }, ...verdict })
      : cover({ kind, rules })
  })
}

async function ticket(at = '/duel/7') {
  const screen = await render(
    <LangProvider>
      <MemoryRouter initialEntries={[at]}>
        <Routes>
          <Route element={<StageFrame />}>
            <Route path="/duel/:id" element={<DuelRun session={{ access_token: 'tok' }} />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
  return screen.container
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
  startDuelRace.mockClear()
  playDuelResult.mockClear()
  Object.values(race).forEach(f => f.mockClear())
})

describe('a duel’s run', () => {
  it('reads a word’s meanings in the learner’s language', async () => {
    serve()
    const root = await stage()
    await expect.poll(() => root.querySelectorAll('.pvp-tile').length).toBe(4)
    // Alone in its tile (Q3): no number before it, since no key answers a duel.
    expect([...root.querySelectorAll('.pvp-tile')].map(b => b.textContent)).toEqual(['professeur', 'gare', 'pluie', 'livre'])
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

  it('keeps the verdict’s ink on the tile still under the finger', async () => {
    // A touched tile keeps :hover until the next touch, a clicked one while
    // the pointer rests on it, and .exam-tile:hover is two classes: the
    // tile must still show the verdict's border, never the hover's.
    // The verdict held long enough to look at it.
    serve({ nextIn: 30_000 })
    const root = await stage()
    await expect.poll(() => root.querySelectorAll('.pvp-tile').length).toBe(4)
    const tile = () => root.querySelectorAll('.pvp-tile')[2]
    await userEvent.click(tile())
    await expect.poll(() => tile().classList.contains('pvp-tile--wrong')).toBe(true)
    await userEvent.hover(tile())
    const ink = document.createElement('i')
    ink.style.color = 'var(--rating-wrong)'
    root.append(ink)
    await expect.poll(() => getComputedStyle(tile()).borderTopColor).toBe(getComputedStyle(ink).color)
  })

  it('prints the server’s verdict once the minute is over', async () => {
    serve({ endsIn: 200, mine: 400, verdict: { status: 'done', result: {
      outcome: 'loss', mine: 400, theirs: 500, rights: 4, theirRights: 5, answered: 6, theirAnswered: 5, elo: null, xp: 30,
    } } })
    const root = await stage()
    await expect.poll(() => root.querySelector('.pvp-result__word')?.textContent, { timeout: 5000 }).toBe('Défaite')
    expect(root.querySelector('.pvp-vs__margin').textContent).toBe('à 100 points')
    await expect.poll(() => root.querySelector('.pvp-vs__gains').textContent, { timeout: 6000 }).toContain('+30')
  })

  it('waits for the other player rather than declaring a winner', async () => {
    serve({ endsIn: 200, mine: 400, verdict: { status: 'open', result: null, them: { ...cover().them, played: false, score: null } } })
    const root = await stage()
    await expect.poll(() => root.querySelector('.pvp-result__word')?.textContent, { timeout: 5000 }).toBe('En attente de Kenta')
    expect(root.querySelector('.pvp-result__review')).toBeNull()
    // The other side empty, and no tug-of-war: nothing to pull against.
    expect(root.querySelector('.pvp-vs__side--empty .pvp-vs__who').textContent).toBe('Kenta')
    expect(root.querySelector('.pvp-vs__bars')).toBeNull()
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
    serve({ endsIn: 200, mine: 1572, kind: 'ranked', rules: RULES, verdict: { status: 'done', them: { ...cover().them, username: 'Hiro_88' }, result: {
      outcome: 'win', mine: 1572, theirs: 1559, rights: 19, theirRights: 17, answered: 23, theirAnswered: 21,
      lines: { mine: lines({ speed: 1300, combo: 222, rush: 50, best: 12, flashes: 9, rights: 19, answered: 23, grade: 'B' }),
        theirs: lines({ speed: 1400, combo: 159, rush: 0, best: 8, flashes: 7, rights: 17, answered: 21 }) },
      elo: { before: 1237, after: 1248, delta: 11 }, xp: 137,
    } } })
    const root = await stage()
    await expect.poll(() => root.querySelector('.pvp-result__word')?.textContent, { timeout: 5000 }).toBe(VICTORY)
    // Face to face, the totals counted up to the server's.
    await expect.poll(() => [...root.querySelectorAll('.pvp-vs__total')].map(f => f.textContent), { timeout: 3000 })
      .toEqual([(1572).toLocaleString('fr'), (1559).toLocaleString('fr')])
    expect([...root.querySelectorAll('.pvp-vs__who')].map(w => w.textContent)).toEqual(['Toi', 'Hiro_88'])
    // A tug-of-war bar a line, lit on the side that won it.
    const bars = [...root.querySelectorAll('.pvp-vs__bar')]
    expect(bars.map(b => b.querySelector('.pvp-vs__k').firstChild.textContent)).toEqual(['Vitesse', 'Combo', 'Rush', 'Justesse', 'Éclairs'])
    const won = bar => [...bar.querySelectorAll('.pvp-vs__fig')].map(f => f.classList.contains('pvp-vs__fig--won'))
    expect(won(bars[0])).toEqual([false, true])
    expect(won(bars[1])).toEqual([true, false])
    expect(bars[1].querySelector('.pvp-vs__k-sub').textContent).toBe('12 / 8 d’affilée')
    expect(root.querySelector('.pvp-vs__grade').getAttribute('aria-label')).toBe('Note B')
    // What it paid: the Elo it moved, the XP, the day's share left.
    const gains = root.querySelector('.pvp-vs__gains')
    await expect.poll(() => gains.textContent, { timeout: 6000 }).toContain((1248).toLocaleString('fr'))
    expect(gains.querySelector('.pvp-elo-move--up').textContent).toBe('▲ 11')
    await expect.poll(() => gains.textContent, { timeout: 6000 }).toContain('+137')
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
    // The run the server kept: forty seconds left of it, never the sprint
    // afresh. The head counts down as m:ss.
    const [, m, sec] = root.querySelector('.stage__where-latin').textContent.match(/^(\d+):(\d\d)$/)
    const left = Number(m) * 60 + Number(sec)
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
    expect(root.querySelector('.pvp-vs__sheet').textContent).toContain('3 justes sur 5')
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
    await expect.poll(() => root.querySelector('.pvp-result__word')?.textContent, { timeout: 4000 }).toBe(VICTORY)
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
  it('reads the verdict again while the server has yet to end the run', async () => {
    // The run's last reply came before the server's grace was over: the
    // first read finds the run unfinished, the next its verdict.
    serve({ endsIn: 200, mine: 400, verdict: { status: 'done', result: {
      outcome: 'win', mine: 400, theirs: 300, rights: 4, theirRights: 3, answered: 5, theirAnswered: 4, elo: null, xp: 30,
    } } })
    const served = apiJson.getMockImplementation()
    let early = 1
    apiJson.mockImplementation(async (path, s, init) => {
      const started = apiJson.mock.calls.some(([p]) => p.endsWith('/start'))
      if (started && path === '/api/pvp/duels/7' && early-- > 0) {
        return cover({ you: { ...cover().you, started: true, played: false } })
      }
      return served(path, s, init)
    })
    const root = await stage()
    await expect.poll(() => root.querySelector('.pvp-result__word')?.textContent, { timeout: 5000 }).toBe(VICTORY)
    expect(root.textContent).not.toContain('En attente')
  })

  it('starts a rematch’s new duel afresh, from its own ticket, on one press', async () => {
    apiJson.mockReset()
    apiJson.mockImplementation(async (path, _s, init) => {
      if (path === '/api/pvp/duels' && init?.method === 'POST') return { id: 8 }
      if (path === '/api/pvp/duels/8') return cover({ id: 8, them: { ...cover().them, played: false, score: null } })
      // Duel 7, run and settled: its result, and « Revanche ».
      return cover({ status: 'done', you: { ...cover().you, played: true, started: true, score: 400, rights: 4, answered: 5, xp: 30 },
        result: { outcome: 'win', mine: 400, theirs: 300, rights: 4, theirRights: 3, answered: 5, theirAnswered: 4, elo: null, xp: 30 } })
    })
    const root = await ticket()
    await expect.poll(() => root.querySelector('.pvp-result__word')?.textContent).toBe(VICTORY)
    const rematch = root.querySelector('.exam-cover__go')
    expect(rematch.textContent).toBe('Revanche')
    rematch.click()
    rematch.click()
    await expect.poll(() => root.querySelector('.pvp-result')).toBeNull()
    await expect.poll(() => root.querySelector('.exam-cover__go')?.textContent).toBe('Partir')
    expect(apiJson.mock.calls.filter(([p, , i]) => p === '/api/pvp/duels' && i?.method === 'POST')).toHaveLength(1)
  })

  it('marks the pick the server recorded when a lost answer is sent again', async () => {
    serve()
    const served = apiJson.getMockImplementation()
    let tries = 0
    apiJson.mockImplementation(async (path, s, init) => {
      if (path.endsWith('/answer')) {
        tries += 1
        // Tile 2 was recorded and its reply lost; tile 0 is then
        // pressed, and the reply is about the first pick.
        if (tries === 1) throw new Error('offline')
        return { n: 0, pick: 2, right: false, pts: 0, ms: 900, total: 0, rights: 0, next: word(1), nextAt: iso(1000), endsAt: iso(60_000) }
      }
      return served(path, s, init)
    })
    const root = await stage()
    await expect.poll(() => root.querySelectorAll('.pvp-tile').length).toBe(4)
    root.querySelectorAll('.pvp-tile')[2].click()
    await expect.poll(() => root.querySelector('.pvp-tile[disabled]')).toBeNull()
    root.querySelectorAll('.pvp-tile')[0].click()
    await expect.poll(() => root.querySelector('.pvp-tile--wrong')).toBeTruthy()
    const tiles = [...root.querySelectorAll('.pvp-tile')]
    expect(tiles[2].classList.contains('pvp-tile--wrong')).toBe(true)
    expect(tiles[0].classList.contains('pvp-tile--wrong')).toBe(false)
  })

  it('races a recording with no answer in it, rather than say it will be raced', async () => {
    serve()
    const served = apiJson.getMockImplementation()
    apiJson.mockImplementation(async (path, s, init) => {
      const out = await served(path, s, init)
      return path.endsWith('/start') ? { ...out, opponent: { timeline: [] } } : out
    })
    const root = await stage()
    await expect.poll(() => root.querySelectorAll('.pvp-track').length).toBe(2)
    expect(root.textContent).not.toContain('courra contre ton enregistrement')
  })

  it('prints no price on a ranked ticket the pass pays for', async () => {
    apiJson.mockReset()
    apiJson.mockImplementation(async () => cover({ kind: 'ranked', against: 'seek', price: 0 }))
    const root = await ticket()
    await expect.poll(() => root.querySelector('.exam-cover__go')?.textContent).toBe('Partir')
    expect(root.querySelector('.pvp-ticket').textContent).toContain('Inclus')
    expect(root.querySelector('.pvp-ticket').textContent).not.toContain('crédit')
  })

  it('prints the levels the paper asks, in the share the Elo stands at (plan 286)', async () => {
    apiJson.mockReset()
    apiJson.mockImplementation(async () => cover({ kind: 'ranked', against: 'open', level: 'N4',
      mix: [{ level: 'N5', share: 0.1 }, { level: 'N4', share: 0.9 }] }))
    const root = await ticket()
    await expect.poll(() => root.querySelector('.pvp-mix')?.textContent).toBe('N5 10\u00a0% · N4 90\u00a0%')
    const parts = [...root.querySelectorAll('.pvp-mix__part')].map(p => p.getBoundingClientRect().width)
    expect(parts).toHaveLength(2)
    expect(parts[1]).toBeCloseTo(parts[0] * 9, 0)
    expect(root.querySelector('.pvp-ticket').textContent).not.toContain('plus bas')
  })

  it('prints a whole level alone, and a paper dealt before the mix at its level', async () => {
    apiJson.mockReset()
    apiJson.mockImplementation(async () => cover({ level: 'N3', mix: [{ level: 'N3', share: 1 }] }))
    let root = await ticket()
    await expect.poll(() => root.querySelector('.pvp-mix')?.textContent).toBe('N3')
    expect(root.querySelector('.pvp-mix__bar')).toBeNull()
    apiJson.mockReset()
    apiJson.mockImplementation(async () => cover({ level: 'N4', mix: null }))
    root = await ticket('/duel/8')
    await expect.poll(() => root.querySelector('.pvp-ticket__dd')?.textContent).toBe('N4')
  })

  it('names the beginner’s stop in words, on the ticket and in its mix (plan 289)', async () => {
    apiJson.mockReset()
    apiJson.mockImplementation(async () => cover({ kind: 'ranked', against: 'open', level: 'novice',
      you: { ...cover().you, level: 'novice' }, mix: [{ level: 'novice', share: 0.3 }, { level: 'N5', share: 0.7 }] }))
    const root = await ticket()
    await expect.poll(() => root.querySelector('.pvp-mix')?.textContent).toBe('Débutant 30\u00a0% · N5 70\u00a0%')
    expect(root.querySelector('.pvp-ticket__level').textContent).toBe('Débutant')
    // Between the beginner's stop and N5, a paper asks kana and kanji.
    const facts = [...root.querySelectorAll('.pvp-ticket__fact')].map(f => f.querySelector('dd').textContent)
    expect(facts).toContain('mots, kana et kanji')
  })

  it('asks a kana for its romaji, the choices in Latin letters (plan 289)', async () => {
    serve()
    const root = await stage()
    await expect.poll(() => root.querySelectorAll('.pvp-tile').length).toBe(4)
    apiJson.mockImplementation(async (path) => (path.endsWith('/answer')
      ? { n: 0, right: true, pts: 100, ms: 900, total: 100, rights: 1, nextAt: iso(300), endsAt: iso(60_000),
        next: { n: 1, kind: 'kana', prompt: 'カ', reading: null, choices: ['me', 'ro', 'ka'] } }
      : cover()))
    root.querySelectorAll('.pvp-tile')[0].click()
    await expect.poll(() => root.querySelector('.pvp-page__prompt')?.textContent, { timeout: 3000 }).toBe('カ')
    expect(root.querySelector('.pvp-page__kind').textContent).toBe('Kana')
    expect([...root.querySelectorAll('.pvp-tile .exam-tile__t')].map(n => n.textContent)).toEqual(['me', 'ro', 'ka'])
    expect(root.querySelector('.pvp-tile .exam-tile__t').getAttribute('lang')).toBeNull()
  })

  it('keeps the answers in one list whatever the question asks, so the dock never changes shape', async () => {
    serve()
    const root = await stage()
    await expect.poll(() => root.querySelectorAll('.pvp-tile').length).toBe(4)
    const dock = () => root.querySelector('.exam-tiles')
    expect(dock().classList.contains('exam-tiles--two')).toBe(false)
    const height = dock().getBoundingClientRect().height
    // A reading's choices, Japanese: the same list, the same height.
    apiJson.mockImplementation(async (path) => (path.endsWith('/answer')
      ? { n: 0, right: true, pts: 100, ms: 900, total: 100, rights: 1, nextAt: iso(300), endsAt: iso(60_000),
        next: { n: 1, kind: 'reading', prompt: '先生', reading: null, choices: ['せんせい', 'せんせ', 'ぜんせい', 'せいせん'] } }
      : cover()))
    root.querySelectorAll('.pvp-tile')[0].click()
    await expect.poll(() => root.querySelector('.pvp-tile .exam-tile__t')?.textContent, { timeout: 3000 }).toBe('せんせい')
    expect(dock().classList.contains('exam-tiles--two')).toBe(false)
    expect(root.querySelector('.pvp-tile .exam-tile__t').getAttribute('lang')).toBe('ja')
    expect(Math.abs(dock().getBoundingClientRect().height - height)).toBeLessThan(2)
  })

  it('runs the sprint its duel was dealt: two minutes, or one for a duel dealt before (plan 284)', async () => {
    // The ticket names the duel's own sprint.
    apiJson.mockReset()
    apiJson.mockImplementation(async () => cover({ sprintMs: 60_000 }))
    let root = await ticket()
    await expect.poll(() => root.querySelector('.clrk-tk__foot')?.textContent).toContain('Sprint · 60 secondes')
    document.body.innerHTML = ''
    // A two-minute run: the head starts at 2:00 and the clock is full.
    serve({ endsIn: 120_000 })
    root = await stage()
    await expect.poll(() => root.querySelectorAll('.pvp-tile').length).toBe(4)
    expect(root.querySelector('.stage__where-latin').textContent).toMatch(/^(2:00|1:59)$/)
    const share = Number(root.querySelector('.pvp-clock__fill').style.transform.match(/scaleX\(([\d.]+)\)/)[1])
    expect(share).toBeGreaterThan(0.98)
  })

  it('says why a decline waits while the challenger runs their sprint', async () => {
    apiJson.mockReset()
    apiJson.mockImplementation(async path => {
      if (path.endsWith('/decline')) throw refusal('pvp_running')
      return cover({ them: { ...cover().them, played: false, score: null } })
    })
    const root = await ticket()
    await expect.poll(() => [...root.querySelectorAll('button')].find(b => b.textContent === 'Refuser le défi')).toBeTruthy()
    ;[...root.querySelectorAll('button')].find(b => b.textContent === 'Refuser le défi').click()
    await expect.poll(() => root.textContent).toMatch(/Ton ami court ce duel en ce moment\s: tu pourras refuser une fois son sprint fini\./)
  })

  it('says a duel that is gone is gone, never a username nobody holds', async () => {
    apiJson.mockReset()
    apiJson.mockImplementation(async () => { throw Object.assign(new Error('pvp_not_found'), { code: 'pvp_not_found', status: 404 }) })
    const root = await ticket()
    await expect.poll(() => root.querySelector('.pvp-run__fail')?.textContent).toBe('Ce duel n’existe plus.')
  })
  it('prints no score to beat on a ranked ticket: the server keeps it until « Partir »', async () => {
    apiJson.mockReset()
    apiJson.mockImplementation(async () => cover({ kind: 'ranked', against: 'seek', price: 2,
      them: { ...cover().them, played: true, score: null, rights: null } }))
    const root = await ticket()
    await expect.poll(() => root.querySelector('.exam-cover__go')?.textContent).toBe('Partir · 2 crédits')
    expect(root.querySelector('.pvp-ticket').textContent).not.toContain('À battre')
    expect(root.querySelector('.pvp-ticket__side--them .pvp-ticket__name').textContent).toBe('Kenta')
  })

  // ── C1, the race as a game (plan 285) ──
  it('rings the streak the server counts, and what it pays, with the answer’s moment', async () => {
    serve({ rules: RULES, nextIn: 30_000, reply: { streak: 5, mult: 1.5, combo: 50, rush: 0, scored: 150, total: 550 } })
    const root = await stage()
    await expect.poll(() => root.querySelectorAll('.pvp-tile').length).toBe(4)
    expect(root.querySelector('.pvp-combo')).toBeNull()
    root.querySelectorAll('.pvp-tile')[0].click()
    await expect.poll(() => root.querySelector('.pvp-combo__n')?.textContent).toBe('5')
    expect(root.querySelector('.pvp-combo__mult').textContent).toBe('×1,5')
    expect(root.querySelector('.pvp-combo').classList.contains('pvp-combo--x15')).toBe(true)
    // A hundred points is a flash; what the answer added flies to the train.
    expect(root.querySelector('.pvp-note--flash .pvp-note__jp').textContent).toBe('神速')
    expect(root.querySelector('.pvp-fly').textContent).toMatch(/^\+150 ×1,5$/)
    expect(root.querySelector('.pvp-track--me .pvp-train__fig').textContent).toBe('550')
  })

  it('says a streak lost for a moment, and draws no combo for a duel scored on speed alone', async () => {
    serve({ rules: RULES })
    let answers = 0
    const served = apiJson.getMockImplementation()
    apiJson.mockImplementation(async (path, s, init) => {
      if (!path.endsWith('/answer')) return served(path, s, init)
      answers += 1
      return answers === 1
        ? { n: 0, pick: 0, right: true, pts: 100, ms: 900, combo: 0, rush: 0, scored: 100, streak: 4, mult: 1, total: 400, rights: 4, next: word(1), nextAt: iso(300), endsAt: iso(60_000) }
        : { n: 1, pick: 2, right: false, pts: 0, ms: 900, combo: 0, rush: 0, scored: 0, streak: 0, mult: 1, total: 400, rights: 4, next: word(2), nextAt: iso(1000), endsAt: iso(60_000) }
    })
    const root = await stage()
    await expect.poll(() => root.querySelectorAll('.pvp-tile').length).toBe(4)
    root.querySelectorAll('.pvp-tile')[0].click()
    await expect.poll(() => root.querySelector('.pvp-combo__n')?.textContent).toBe('4')
    await expect.poll(() => root.querySelector('.pvp-tile[disabled]'), { timeout: 3000 }).toBeNull()
    root.querySelectorAll('.pvp-tile')[2].click()
    await expect.poll(() => root.querySelector('.pvp-combo--broke .pvp-combo__lost')?.textContent).toBe('4 perdu')
    expect(root.querySelector('.pvp-cross')).toBeTruthy()
    // Its moment over, the combo says nothing.
    await expect.poll(() => root.querySelector('.pvp-combo'), { timeout: 3000 }).toBeNull()
    document.body.innerHTML = ''
    // No rules (a duel dealt before them): the same streak rings nothing.
    serve({ reply: { streak: 5, mult: 1, scored: 100 } })
    const plain = await stage()
    await expect.poll(() => plain.querySelectorAll('.pvp-tile').length).toBe(4)
    plain.querySelectorAll('.pvp-tile')[0].click()
    await expect.poll(() => plain.querySelector('.pvp-tile--right')).toBeTruthy()
    expect(plain.querySelector('.pvp-combo')).toBeNull()
  })

  it('stamps « Partez ! » over the line, and the rush on the clock in the last seconds', async () => {
    // The rush comes 1.3 s in, once the band's first second is over.
    serve({ rules: RULES, endsIn: 16_300 })
    const root = await stage()
    await expect.poll(() => root.querySelector('.pvp-band:not(.pvp-band--finish) .pvp-band__word')?.textContent).toBe('Partez\u00a0!')
    expect(root.querySelector('.pvp-run--rush')).toBeNull()
    await expect.poll(() => root.querySelector('.pvp-run--rush'), { timeout: 3000 }).toBeTruthy()
    expect(root.querySelector('.pvp-rushpill__mult').textContent).toBe('×2')
    // The band is gone by then: it was the start's first second.
    expect(root.querySelector('.pvp-band')).toBeNull()
  })

  it('holds « Arrivée ! » on the line while the verdict is read, the answers put away', async () => {
    serve({ endsIn: 200, mine: 400, verdict: { status: 'done', result: {
      outcome: 'win', mine: 400, theirs: 300, rights: 4, theirRights: 3, answered: 5, theirAnswered: 4, elo: null, xp: 30,
    } } })
    const root = await stage()
    await expect.poll(() => root.querySelector('.pvp-band--finish .pvp-band__word')?.textContent, { timeout: 3000 }).toBe('Arrivée\u00a0!')
    expect(root.querySelector('.pvp-run--done')).toBeTruthy()
    expect(root.querySelector('.pvp-result')).toBeNull()
    await expect.poll(() => root.querySelector('.pvp-result__word')?.textContent, { timeout: 5000 }).toBe(VICTORY)
  })

  it('flashes who went ahead over their train when the lead changes hands', async () => {
    // The learner leads at once (100 to nothing); the recording goes past
    // them a second in (300).
    serve({ reply: { scored: 100 } })
    const served = apiJson.getMockImplementation()
    apiJson.mockImplementation(async (path, s, init) => {
      const out = await served(path, s, init)
      return path.endsWith('/start') ? { ...out, startsAt: iso(-200), qAt: iso(-200), opponent: { timeline: [{ t: 1400, pts: 300, right: true }] } } : out
    })
    const root = await stage()
    await expect.poll(() => root.querySelectorAll('.pvp-tile').length).toBe(4)
    root.querySelectorAll('.pvp-tile')[0].click()
    await expect.poll(() => root.querySelector('.pvp-track--me .pvp-train__fig')?.textContent).toBe('100')
    // The first lead is no change of hands.
    expect(root.querySelector('.pvp-pass')).toBeNull()
    await expect.poll(() => root.querySelector('.pvp-pass')?.textContent, { timeout: 3000 }).toBe('追い越しKenta devant')
    expect(root.querySelector('.pvp-pass').closest('.pvp-track').classList.contains('pvp-track--me')).toBe(false)
  })

  it('plays a run scored with the combo on the server’s clock, and tells it each reply', async () => {
    serve({ rules: RULES, nextIn: 30_000, reply: { streak: 5, mult: 1.5, scored: 150 } })
    const root = await stage()
    await expect.poll(() => root.querySelectorAll('.pvp-tile').length).toBe(4)
    expect(startDuelRace).toHaveBeenCalledTimes(1)
    const [{ startsAt, endsAt, rushMs }] = startDuelRace.mock.calls[0]
    expect(endsAt - startsAt).toBeGreaterThan(59_000)
    expect(rushMs).toBe(15_000)
    root.querySelectorAll('.pvp-tile')[0].click()
    await expect.poll(() => race.answer.mock.calls.length).toBe(1)
    expect(race.answer).toHaveBeenCalledWith({ right: true, flash: true, mult: 1.5, broke: 0 })
    document.body.innerHTML = ''
    // A duel scored on speed alone plays none of it.
    startDuelRace.mockClear()
    serve()
    const plain = await stage()
    await expect.poll(() => plain.querySelectorAll('.pvp-tile').length).toBe(4)
    expect(startDuelRace).not.toHaveBeenCalled()
  })

  it('sounds the result right after a run, and reads an old one in silence', async () => {
    serve({ endsIn: 200, mine: 400, rules: RULES, verdict: { status: 'done', result: {
      outcome: 'win', mine: 400, theirs: 300, rights: 4, theirRights: 3, answered: 5, theirAnswered: 4, elo: null, xp: 30,
      lines: { mine: lines({ grade: 'A' }), theirs: lines({ speed: 300, flashes: 3, rights: 3, answered: 4 }) },
    } } })
    const root = await stage()
    await expect.poll(() => root.querySelector('.pvp-result__word')?.textContent, { timeout: 5000 }).toBe(VICTORY)
    expect(playDuelResult).toHaveBeenCalledTimes(1)
    const [{ outcome, grade, loop, lines: won }] = playDuelResult.mock.calls[0]
    expect({ outcome, grade, loop }).toEqual({ outcome: 'win', grade: 'A', loop: true })
    // Speed, combo, rush, accuracy, flashes: the learner's or the other's.
    expect(won).toEqual([true, true, true, true, true])
    document.body.innerHTML = ''
    playDuelResult.mockClear()
    apiJson.mockReset()
    apiJson.mockImplementation(async () => cover({ status: 'done', rules: RULES, you: { ...cover().you, played: true, started: true, score: 400, rights: 4, answered: 5, xp: 30 },
      result: { outcome: 'win', mine: 400, theirs: 300, rights: 4, theirRights: 3, answered: 5, theirAnswered: 4, elo: null, xp: 30 } }))
    const again = await ticket()
    await expect.poll(() => again.querySelector('.pvp-result__word')?.textContent).toBe(VICTORY)
    expect(playDuelResult).not.toHaveBeenCalled()
  })

  it('draws only the lines a duel was scored on, and no Elo for a friend’s', async () => {
    serve({ endsIn: 200, mine: 400, verdict: { status: 'done', result: {
      outcome: 'draw', mine: 400, theirs: 400, rights: 4, theirRights: 4, answered: 5, theirAnswered: 5, elo: null, xp: 30,
      lines: { mine: lines(), theirs: lines() },
    } } })
    const root = await stage()
    await expect.poll(() => root.querySelector('.pvp-result__word')?.textContent, { timeout: 5000 }).toBe('Égalité')
    // A draw says no margin; a duel without rules no combo and no rush.
    expect(root.querySelector('.pvp-vs__margin')).toBeNull()
    expect([...root.querySelectorAll('.pvp-vs__k')].map(k => k.firstChild.textContent)).toEqual(['Vitesse', 'Justesse', 'Éclairs'])
    expect(root.querySelector('.pvp-vs__grade')).toBeNull()
    expect(root.querySelector('.pvp-elo-move')).toBeNull()
  })
})
