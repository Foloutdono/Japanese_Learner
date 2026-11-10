import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { LangProvider, useLang } from './LangContext'
import { StageFrame } from './components/chrome/Shell'
import './index.css'

// ── 対戦 — the duels' screens on a phone (plan 279) ─────────────────
// The screens the owner picked, against a server answering as
// routes/pvp.py does. The hall (H3, its Elo the curve, G1): the figure,
// the place and the last twenty duels over where the learner's level
// started it, or before a first ranked duel that start and the level it
// comes from, no test asked (plan 282). The holder's insert (L1) is the
// door alone (E1) until there is a curve to draw. The friends (F1): a learner is found by their
// exact handle and is that handle alone until a request is accepted; a
// friend's card holds the report, four closed reasons and never a word
// typed. The departure (D2): the ranked sprint is paid on the button
// that names its price and starts at once, a first one too. The Elo board (L2,
// whole since plan 315): both scopes counted by the server, read a page at a
// time, the learner off the page pinned to the foot, a name opening its card. Today (plan 287):
// the key beside the gate (D1), what waits counted on its shoulder, the
// hall behind it; on a day done the board's row (E), the first challenge
// received -- a live room before it -- or the Elo and the way to the hall.

vi.mock('./lib/audio', async o => ({ ...(await o()), playClick: vi.fn(), playUi: vi.fn() }))
const calls = []
let answer = () => null
vi.mock('./lib/api', async o => ({
  ...(await o()),
  apiJson: vi.fn(async (path, _session, init) => {
    calls.push({ path, init })
    const body = await answer(path, init)
    if (body == null) throw new Error('down')
    return body
  }),
}))
let duels = { data: null }
vi.mock('./stores/duels', () => ({ useDuels: () => duels, refreshDuels: vi.fn() }))
vi.mock('./components/chrome/LevelBar', () => ({ LevelBar: () => null }))
globalThis.fetch = vi.fn().mockRejectedValue(new Error('no backend'))

const { default: DuelsScreen } = await import('./screens/DuelsScreen')
const { default: DuelFriendsScreen } = await import('./screens/DuelFriendsScreen')
const { default: DuelDeparture } = await import('./screens/DuelDeparture')
const { default: DuelBoardScreen } = await import('./screens/DuelBoardScreen')
const { DuelKey } = await import('./components/pvp/DuelKey')
const { DuelBoard } = await import('./components/pvp/DuelRow')
const { DuelsInsert } = await import('./components/pvp/DuelsInsert')

const settle = (ms = 150) => new Promise(r => setTimeout(r, ms))
const $ = sel => document.querySelector(sel)
const $$ = sel => [...document.querySelectorAll(sel)]
const button = (name, root = document) => [...root.querySelectorAll('button')].find(b => b.textContent.trim() === name)
const asked = (path, method = 'GET') => calls.filter(c => c.path.split('?')[0] === path && (c.init?.method ?? 'GET') === method)
const sentBody = (path, method = 'POST') => JSON.parse(asked(path, method).at(-1).init.body)

/** Where the screen went: the path, and whether it asked the run to start. */
function Where() {
  const loc = useLocation()
  return <p className="where">{loc.pathname}{loc.state?.start ? '#start' : ''}</p>
}

async function mount(at, path, element, { stage = false } = {}) {
  const page = stage
    ? <Route element={<StageFrame />}><Route path={path} element={element} /></Route>
    : <Route path={path} element={<div className="phone"><div className="phone__content">{element}</div></div>} />
  await render(
    <LangProvider>
      <MemoryRouter initialEntries={[at]}>
        <Routes>
          {page}
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </LangProvider>
  )
  await settle()
}

const SESSION = { access_token: 'tok' }

beforeEach(() => {
  document.body.innerHTML = ''
  calls.length = 0
  duels = { data: null }
  answer = () => null
  try {
    localStorage.setItem('lang', 'fr')
    localStorage.removeItem('jp-duel-line-hidden')
  } catch { /* private mode */ }
})

// ── H3 — the hall ──

const HALL = {
  rating: { elo: 1248, provisional: false, games: 21, wins: 15, draws: 0, losses: 6, peak: 1248,
    level: 'N4', start: 1200, rank: 3, of: 10, trend: [1180, 1210, 1195, 1230, 1248] },
  toPlay: [{ id: 45, kind: 'friend', role: 'opponent', mode: 'async', level: 'N5', status: 'open', against: 'friend', who: 'Kenta', mine: null, theirs: 1552,
    expiresAt: new Date(Date.now() + 47 * 3_600_000).toISOString() }],
  live: [], running: [], done: [],
  friends: { count: 4, requests: 1 }, prices: { ranked: 2, review: 1 }, xp: { today: 0, cap: 150 },
}

const mountHall = () => mount('/profile/duels', '/profile/duels', <DuelsScreen session={SESSION} />)

describe('the hall (H3, G1)', () => {
  it('heads with the Elo, its place and its curve over the placement’s start', async () => {
    duels = { data: HALL }
    await mountHall()
    expect($('.pvp-curve__fig').textContent).toBe((1248).toLocaleString('fr'))
    expect($('.pvp-curve__rank').textContent).toBe('3ᵉ sur 10')
    expect($('.pvp-curve__svg polyline').getAttribute('points').split(' ')).toHaveLength(5)
    expect($('.pvp-curve__svg .pvp-curve__start')).toBeTruthy()
    // The curve keeps its height whatever the card's width.
    expect(Math.round($('.pvp-curve__svg').getBoundingClientRect().height)).toBe(72)
    expect($('.pvp-curve__foot').textContent).toContain(`départ ${(1200).toLocaleString('fr')}`)
    // The first thing under the bar: the hall's head is the Elo.
    expect($('main.pvp > .pvp-curve')).toBeTruthy()
    $('.pvp-curve').click()
    await settle()
    expect($('.where').textContent).toBe('/profile/duels/board')
  })

  it('lists the challenge to play and boards the ranked sprint from its platform', async () => {
    duels = { data: HALL }
    await mountHall()
    expect($('.pvp-console__who').textContent).toBe('Kenta')
    expect($('.pvp-console__what').textContent).toMatch(new RegExp(`^${(1552).toLocaleString('fr')} à battre · reste 4[67] h$`))
    $$('.pvp-platform')[0].click()
    await settle()
    expect($('.where').textContent).toBe('/duel/new')
  })

  it('lists the strangers’ runs waiting for an opponent under the challenges, and takes the seat picked', async () => {
    const run = { id: 61, kind: 'ranked', mode: 'async', against: 'seek', who: 'Mika', elo: 1230, provisional: false,
      mix: [{ level: 'N4', share: 1 }], expiresAt: new Date(Date.now() + 40 * 3_600_000).toISOString(),
      since: new Date().toISOString() }
    duels = { data: { ...HALL, waiting: [run, { ...run, id: 62, who: null }] } }
    answer = path => (path === '/api/pvp/duels' ? { id: 61, against: 'seek' } : null)
    await mountHall()
    expect($('.pvp-console .console__band-opt').textContent).toBe('À jouer · 3')
    expect($('.pvp-console__cap').textContent).toBe('Sprint classé · en attente d’un adversaire')
    const rows = $$('.pvp-console__row')
    expect(rows.map(r => r.querySelector('.pvp-console__who').textContent)).toEqual(['Kenta', 'Mika', 'Voyageur'])
    // Its Elo and its time, never its score.
    expect(rows[1].querySelector('.pvp-console__what').textContent).toMatch(new RegExp(`^Elo ${(1230).toLocaleString('fr')} · reste (39|40) h$`))
    rows[1].querySelector('.pvp-console__go').click()
    await settle()
    expect(sentBody('/api/pvp/duels')).toEqual({ ranked: true, duel: 61 })
    // Its cover, the price before « Partir ».
    expect($('.where').textContent).toBe('/duel/61')
  })

  it('says so when another learner took the run first', async () => {
    const run = { id: 61, kind: 'ranked', mode: 'async', against: 'seek', who: 'Mika', elo: 1230, provisional: false,
      mix: null, expiresAt: new Date(Date.now() + 40 * 3_600_000).toISOString() }
    duels = { data: { ...HALL, toPlay: [], waiting: [run] } }
    answer = () => { throw Object.assign(new Error('gone'), { code: 'pvp_run_gone' }) }
    await mountHall()
    expect($('.pvp-console__none')).toBeNull()
    $('.pvp-console__row .pvp-console__go').click()
    await settle()
    expect($('.pvp-console .pvp-error').textContent).toBe('Quelqu’un a pris ce sprint avant toi.')
    expect($('.where')).toBeNull()
  })

  it('offers the way back into a sprint left mid-minute', async () => {
    const running = { id: 52, kind: 'friend', mode: 'async', level: 'N5', status: 'open', against: 'friend', who: 'aiko',
      mine: null, theirs: 1225, running: true, endsAt: new Date(Date.now() + 40_000).toISOString(),
      expiresAt: new Date(Date.now() + 47 * 3_600_000).toISOString() }
    const waiting = { ...running, id: 53, who: 'Sora22', mine: 900, theirs: null, running: undefined, endsAt: undefined }
    duels = { data: { ...HALL, toPlay: [], running: [running, waiting] } }
    await mountHall()
    $$('.pvp-console .console__band-opt').find(b => b.textContent.startsWith('En cours')).click()
    await settle(50)
    const rows = $$('.pvp-console__row')
    expect(rows.map(r => r.querySelector('.pvp-console__what').textContent))
      .toEqual(['Ton sprint est en cours', `Toi ${(900).toLocaleString('fr')} · En attente de Sora22`])
    // A run waiting on the other has nothing to open; the one under way, its way back.
    expect(rows[1].querySelector('.pvp-console__go')).toBeNull()
    const back = rows[0].querySelector('.pvp-console__go')
    expect(back.textContent).toBe('Reprendre')
    back.click()
    await settle()
    expect($('.where').textContent).toBe('/duel/52')
  })

  it('shows the Elo the learner’s level starts them at before a first ranked duel, no test asked', async () => {
    // Plan 281: nothing to take first. The figure is the level's start,
    // provisional; no curve yet, the level it starts from instead.
    duels = { data: { ...HALL, rating: { elo: 1200, provisional: true, games: 0, wins: 0, draws: 0, losses: 0, peak: 1200,
      level: 'N4', start: 1200, rank: null, of: 10, trend: [] } } }
    await mountHall()
    expect($('.pvp-curve__fig').firstChild.textContent).toBe((1200).toLocaleString('fr'))
    expect($('.pvp-curve__prov')).not.toBeNull()
    expect($('.pvp-curve__svg')).toBeNull()
    expect($('.pvp-curve__from').textContent).toBe('Il part de ton niveau N4, puis bouge à chaque sprint classé.')
    expect($('.records--three')).toBeNull()
    $('.pvp-curve').click()
    await settle()
    expect($('.where').textContent).toBe('/profile/duels/board')
  })
})

// ── L1 / E1 — the Elo in the holder ──

function InsertHost() {
  const { t, lang } = useLang()
  return <DuelsInsert t={t} lang={lang} navigate={useNavigate()} />
}

describe('the Elo in the holder (L1, E1)', () => {
  const mountInsert = () => mount('/profile', '/profile', <InsertHost />)

  it('is the door alone before a first ranked duel, the level’s start its figure', async () => {
    duels = { data: { ...HALL, rating: { ...HALL.rating, elo: 1000, games: 0, wins: 0, losses: 0, peak: 1000,
      level: 'N5', start: 1000, rank: null, trend: [] } } }
    await mountInsert()
    expect($('.pvp-insert')).toBeNull()
    expect($('.record--door .record__value--door').textContent).toBe((1000).toLocaleString('fr'))
  })

  it('lays the Elo out under the door once a ranked duel has a curve', async () => {
    duels = { data: HALL }
    await mountInsert()
    expect($('.pvp-insert__num').textContent).toBe((1248).toLocaleString('fr'))
    $('.pvp-insert').click()
    await settle()
    expect($('.where').textContent).toBe('/profile/duels')
  })
})

// ── F1 — the friends ──

const BOOK = {
  friends: [{ username: 'Kenta', elo: 1011, provisional: false, wins: 4, draws: 0, losses: 2 }],
  requests: [{ username: 'taro_99' }],
  sent: [{ username: 'Rin' }],
  blocked: [],
  limits: { friends: 100 },
}

function friendsServer(path, init) {
  if (path === '/api/pvp/friends') return BOOK
  if (path.startsWith('/api/pvp/search')) return { username: 'aiko', relation: 'none' }
  if (path === '/api/pvp/requests') return { status: 'sent' }
  if (path === '/api/pvp/learner/Kenta') return { username: 'Kenta', relation: 'friend', elo: 1011, provisional: false, wins: 4, draws: 0, losses: 2 }
  if (path === '/api/pvp/learner/taro_99') return { username: 'taro_99', relation: 'received' }
  if (path === '/api/pvp/reports') return { ok: true }
  if (path === '/api/pvp/duels' && init?.method === 'POST') return { id: 61, against: 'friend' }
  if (path.startsWith('/api/pvp/requests/')) return { status: 'friends' }
  return null
}

const mountFriends = () => mount('/profile/duels/friends', '/profile/duels/friends', <DuelFriendsScreen session={SESSION} />)

describe('the friends (F1)', () => {
  beforeEach(() => { answer = friendsServer })

  it('finds a learner by their exact handle, and shows that handle alone', async () => {
    await mountFriends()
    await userEvent.fill($('#pvp-find'), 'aiko')
    await userEvent.keyboard('{Enter}')
    await settle()
    expect(new URL(asked('/api/pvp/search')[0].path, 'http://x').searchParams.get('username')).toBe('aiko')
    const found = $('.pvp-find .pvp-person')
    expect(found.querySelector('.pvp-person__name').textContent).toBe('aiko')
    // Nothing of theirs but the name before a request is accepted.
    expect(found.textContent).not.toMatch(/Elo|V ·/)
    button('Demander en ami', found).click()
    await settle()
    expect(sentBody('/api/pvp/requests')).toEqual({ username: 'aiko' })
    expect($('.pvp-find .pvp-person__sub').textContent).toBe('Demandé')
  })

  it('asks nothing for a handle that cannot be one', async () => {
    await mountFriends()
    await userEvent.fill($('#pvp-find'), 'ai')
    await userEvent.keyboard('{Enter}')
    await settle()
    expect(asked('/api/pvp/search')).toHaveLength(0)
    expect($('.pvp-find [role="alert"]').textContent).toBe('Personne ne porte ce pseudo.')
  })

  it('answers a request with its two buttons', async () => {
    await mountFriends()
    const request = $$('.pvp-person').find(p => p.textContent.includes('taro_99'))
    button('Accepter', request).click()
    await settle()
    expect(asked('/api/pvp/requests/taro_99/accept', 'POST')).toHaveLength(1)
  })

  it('opens a friend’s card: the Elo, your record, a report of four reasons', async () => {
    await mountFriends()
    button('Kenta').click()
    await settle()
    const card = $('.pvp-card')
    expect([...card.querySelectorAll('.pvp-card__num')].map(n => n.textContent)).toEqual([(1011).toLocaleString('fr'), '4–2'])
    expect([...card.querySelectorAll('.pvp-card__reason')].map(n => n.textContent))
      .toEqual(['Pseudo inapproprié', 'Triche', 'Demandes ou défis répétés', 'Autre chose'])
    expect(card.querySelector('textarea, input[type="text"]')).toBeNull()
    const send = button('Envoyer le signalement', card)
    expect(send.disabled).toBe(true)
    ;[...card.querySelectorAll('.pvp-pick__row')].find(r => r.textContent === 'Triche').click()
    await settle(50)
    send.click()
    await settle()
    expect(sentBody('/api/pvp/reports')).toEqual({ username: 'Kenta', reason: 'cheat' })
    expect(card.querySelector('[role="status"]').textContent).toBe('Signalement envoyé. Une personne le lira.')
    expect(button('Retirer des amis', card)).toBeTruthy()
  })

  it('shows a learner who is not a friend by their handle alone', async () => {
    await mountFriends()
    button('taro_99').click()
    await settle()
    const card = $('.pvp-card')
    expect(card.querySelector('.pvp-card__fig')).toBeNull()
    expect(card.textContent).toContain('Avant d’être amis, on ne voit que le pseudo.')
    expect(button('Retirer des amis', card)).toBeUndefined()
    expect(button('Bloquer', card)).toBeTruthy()
  })

  it('challenges a friend from their row, the sheet opened on them', async () => {
    await mountFriends()
    const row = $$('.pvp-person').find(p => p.textContent.includes('Kenta'))
    button('Défier', row).click()
    await settle()
    const sheet = $('.pvp-sheet')
    expect(sheet.querySelector('.pvp-pick__row--on').textContent).toContain('Kenta')
    button('Défier Kenta', sheet).click()
    await settle()
    expect(sentBody('/api/pvp/duels')).toEqual({ opponent: 'Kenta', mode: 'async', ranked: false })
    expect($('.where').textContent).toBe('/duel/61')
  })
})

// ── D2 — the departure ──

const mountDeparture = () => mount('/duel/new', '/duel/new', <DuelDeparture session={SESSION} />, { stage: true })

describe('the departure (D2)', () => {
  it('pays the ranked sprint on the button that names its price, and starts it', async () => {
    duels = { data: { prices: { ranked: 2, review: 1 }, rating: { elo: 1248, games: 21 } } }
    answer = (path, init) => (path === '/api/pvp/duels' && init?.method === 'POST' ? { id: 51, against: 'seek' } : null)
    await mountDeparture()
    const go = $('.exam-cover__go')
    expect(go.textContent).toBe('Partir · 2 crédits')
    go.click()
    await settle()
    expect(sentBody('/api/pvp/duels')).toEqual({ ranked: true })
    expect($('.where').textContent).toBe('/duel/51#start')
  })

  it('asks no test of a learner who has never raced: the first ranked sprint starts at once', async () => {
    // Plan 281: the server starts the Elo from the learner's level.
    duels = { data: { prices: { ranked: 2, review: 1 }, rating: { elo: 1000, games: 0, level: 'N5', trend: [] } } }
    answer = (path, init) => (path === '/api/pvp/duels' && init?.method === 'POST' ? { id: 52, against: 'ghost' } : null)
    await mountDeparture()
    expect($('.pvp-run__help').textContent).toBe('Si personne de ton Elo n’est libre, tu cours contre la partie enregistrée d’un vrai joueur, son pseudo affiché.')
    const go = $('.exam-cover__go')
    expect(go.textContent).toBe('Partir · 2 crédits')
    go.click()
    await settle()
    expect(sentBody('/api/pvp/duels')).toEqual({ ranked: true })
    expect($('.where').textContent).toBe('/duel/52#start')
  })

  it('prints the ranked sprint’s ticket before it is bought, read off the hall (plan 288, A)', async () => {
    duels = { data: { prices: { ranked: 2, review: 1 }, rating: { elo: 1248, games: 21 },
      ranked: { mix: [{ level: 'N4', share: 0.8 }, { level: 'N3', share: 0.2 }], low: 1048, high: 1448, stake: 10 } } }
    await mountDeparture()
    // The hall chose the platform: none is offered again.
    expect($('[role="radio"]')).toBeNull()
    expect($('.pvp-ticket').getAttribute('aria-label')).toBe('Sprint classé')
    expect($('.clrk-tk__no').textContent).toBe('2 crédits')
    expect($$('.pvp-ticket__level').map(n => n.textContent)).toEqual(['Elo 1\u202f248', 'Elo 1\u202f048 – 1\u202f448'])
    const facts = $$('.pvp-ticket__fact').map(f => [f.querySelector('dt').textContent, f.querySelector('dd').textContent])
    expect(facts).toEqual([
      ['Niveau du duel', 'N4 80\u00a0% · N3 20\u00a0%'],
      ['Questions', 'mots et kanji · 3 réponses'],
      ['Durée', '2 min'],
      ['Enjeu', '± 10 Elo'],
    ])
    expect($$('.pvp-mix__part')).toHaveLength(2)
    expect($('.exam-cover__go').textContent).toBe('Partir · 2 crédits')
  })

  it('prints a beginner’s ticket in words and kana (plan 289)', async () => {
    duels = { data: { prices: { ranked: 2, review: 1 }, rating: { elo: 800, games: 0, level: 'novice' },
      ranked: { mix: [{ level: 'novice', share: 1 }], low: 600, high: 1000, stake: 20 } } }
    await mountDeparture()
    const facts = $$('.pvp-ticket__fact').map(f => f.querySelector('dd').textContent)
    expect(facts.slice(0, 2)).toEqual(['Débutant', 'mots et kana · 3 réponses'])
  })
})

// ── L2 — the Elo board, whole since plan 315 ──

const place = (rank, extra = {}) => ({ rank, username: `L${rank}`, elo: 1500 - rank * 20, provisional: false, me: false, ...extra })

/** A board of `of` places, the learner at `mine` (none: off it), read a
 *  page at a time as routes/pvp.py answers it. */
function boardOf(of, mine, scope) {
  return params => {
    const offset = Number(params.get('offset'))
    const limit = Number(params.get('limit'))
    const at = r => place(r, r === mine ? { me: true, username: 'Lucas' } : r === 2 ? { provisional: true } : {})
    const entries = []
    for (let r = offset + 1; r <= Math.min(of, offset + limit); r += 1) entries.push(at(r))
    const me = mine
      ? { ...at(mine), gap: mine > 1 ? { elo: 21, username: `L${mine - 1}`, rank: mine - 1 } : null }
      : { rank: null, elo: 1200, provisional: true, gap: null, me: true }
    return { scope, offset, of, entries, near: [], me }
  }
}

const CARDS = {
  L3: { username: 'L3', relation: 'none', board: { elo: 1440, provisional: false, rank: 3, of: 120 } },
  L1: { username: 'L1', relation: 'friend', elo: 1480, provisional: false, wins: 2, draws: 0, losses: 1,
    board: { elo: 1480, provisional: false, rank: 1, of: 3 } },
}

function boardServer(path, init) {
  if (path.startsWith('/api/pvp/learner/')) return CARDS[path.split('/').at(-1)]
  if (path === '/api/pvp/requests' && init?.method === 'POST') return { status: 'sent' }
  if (path === '/api/pvp/friends') {
    return { friends: [{ username: 'L1', elo: 1480, provisional: false, wins: 2, draws: 0, losses: 1 }],
      requests: [], sent: [], blocked: [], limits: { friends: 200 } }
  }
  const p = new URL(path, 'http://x').searchParams
  return p.get('scope') === 'friends' ? boardOf(3, 2, 'friends')(p) : boardOf(120, 80, 'all')(p)
}

const mountBoard = () => mount('/profile/duels/board', '/profile/duels/board', <DuelBoardScreen session={SESSION} />)
const ranks = () => $$('.banzuke .leaderboard-row__rank').map(r => Number(r.textContent))
const boardAsks = () => asked('/api/pvp/board').map(c => new URL(c.path, 'http://x').searchParams)

describe('the Elo board (L2, plan 315)', () => {
  it('counts both scopes from the server, and reads each a page at a time from its top', async () => {
    answer = boardServer
    await mountBoard()
    expect($$('.bz__seg .seg__opt').map(o => o.textContent)).toEqual(['Tous · 120', 'Amis · 3'])
    const asks = boardAsks()
    expect(asks.map(p => p.get('scope')).sort()).toEqual(['all', 'friends'])
    expect(asks.every(p => p.get('offset') === '0' && p.get('limit') === '50')).toBe(true)
  })

  it('draws the whole page, the provisional marked and said, the learner off it pinned to the foot', async () => {
    answer = boardServer
    await mountBoard()
    expect(ranks()).toEqual(Array.from({ length: 50 }, (_, i) => i + 1))
    // A provisional Elo is marked, and what the mark means is said once.
    expect($$('.leaderboard-row')[1].querySelector('.pvp-board__prov')).toBeTruthy()
    expect($$('.leaderboard-row')[0].querySelector('.pvp-board__prov')).toBeNull()
    expect($$('.bzp__line').at(-1).textContent).toContain('Provisoire')
    // The learner's place, 80th, rides the foot with the gap to the 79th.
    expect($('.bzp__me .leaderboard-row__rank').textContent).toBe('80')
    expect($('.bzp__me .leaderboard-row__name').textContent).toBe('Toi')
    expect($('.bzp__me-gap').textContent).toContain('+21 → 79ᵉ')
  })

  it('reads the next places from the foot of the list', async () => {
    answer = boardServer
    await mountBoard()
    button('Places suivantes').click()
    await settle()
    expect(boardAsks().at(-1).get('offset')).toBe('50')
    expect(ranks()).toEqual(Array.from({ length: 100 }, (_, i) => i + 1))
  })

  it('jumps to the learner’s place, the places before it a press away', async () => {
    answer = boardServer
    await mountBoard()
    $('.bzp__jump').click()
    await settle()
    expect(boardAsks().at(-1).get('offset')).toBe('69')
    expect(ranks()[0]).toBe(70)
    expect($('.banzuke .leaderboard-row--me .leaderboard-row__name').textContent).toBe('Toi')
    button('Places précédentes').click()
    await settle()
    expect(ranks()[0]).toBe(20)
  })

  it('draws a scope whose learner is on the list with its gap under it', async () => {
    answer = boardServer
    await mountBoard()
    $$('.bz__seg .seg__opt')[1].click()
    await settle(50)
    expect(ranks()).toEqual([1, 2, 3])
    expect($('.bzp__me')).toBeNull()
    expect($('.bz__gap-to').textContent).toBe('21 points d’Elo de la 1re place')
  })

  it('says a learner off the board is not ranked yet', async () => {
    answer = path => {
      const p = new URL(path, 'http://x').searchParams
      return boardOf(4, null, p.get('scope'))(p)
    }
    await mountBoard()
    expect($('.leaderboard-row--me')).toBeNull()
    expect($('.bzp__me')).toBeNull()
    expect($('.bz__gap-to').textContent).toBe('pas encore classé')
  })

  it('opens a name’s card: what the board says of them, and the way to ask them as a friend', async () => {
    answer = boardServer
    await mountBoard()
    $$('.banzuke .leaderboard-row')[2].querySelector('button.leaderboard-row__name').click()
    await settle()
    expect(asked('/api/pvp/learner/L3')).toHaveLength(1)
    const figs = $$('.pvp-card__fig').map(f => f.textContent)
    expect(figs).toEqual([`${(1440).toLocaleString('fr')}Elo`, '3ᵉsur 120'])
    expect($('.pvp-card__facts .pvp-sheet__help')).toBeNull()
    button('Demander en ami').click()
    await settle()
    expect(sentBody('/api/pvp/requests')).toEqual({ username: 'L3' })
    expect($('.pvp-card__way').textContent).toBe('Demandé')
  })

  it('opens nothing from the learner’s own row', async () => {
    answer = boardServer
    await mountBoard()
    $$('.bz__seg .seg__opt')[1].click()
    await settle(50)
    expect($('.banzuke .leaderboard-row--me button')).toBeNull()
  })

  it('challenges a friend from their card', async () => {
    answer = boardServer
    await mountBoard()
    $$('.bz__seg .seg__opt')[1].click()
    await settle(50)
    $$('.banzuke .leaderboard-row')[0].querySelector('button.leaderboard-row__name').click()
    await settle()
    expect($$('.pvp-card__fig').map(f => f.textContent)).toContain('2–1entre vous')
    button('Défier L1').click()
    await settle()
    // The friend's sheet opens on them.
    expect(asked('/api/pvp/friends')).toHaveLength(1)
    expect($('.pvp-pick__row--on .pvp-pick__name').textContent).toBe('L1')
  })
})

// ── 対戦 on Today (plan 287) — the key (D1) and the board's row (E) ──

const mountKey = (props = {}) => mount('/today', '/today', <div className="tdy"><DuelKey {...props} /></div>)
const mountDayBoard = (props = {}) => mount('/today', '/today', <div className="tdy"><DuelBoard className="tdy-board" ask rows={[]} {...props} /></div>)
const RATED = { elo: 1248, games: 21, trend: [] }

describe('the duels’ key beside Today’s gate (D1)', () => {
  it('is the duels’ door by its name alone, and opens the hall', async () => {
    duels = { data: { rating: RATED, live: [], toPlay: [] } }
    await mountKey()
    const key = $('.pvp-key')
    expect(key.getAttribute('aria-label')).toBe('Duels')
    expect(key.textContent).toBe('')
    expect(key.dataset.guide).toBe('today.duels')
    key.click()
    await settle()
    expect($('.where').textContent).toBe('/profile/duels')
  })

  it('counts what waits on its shoulder, as the holder’s door does', async () => {
    duels = { data: { rating: RATED, live: [{ id: 47, kind: 'friend', role: 'opponent', mode: 'live', who: 'Sora22' }], toPlay: [{ id: 45, kind: 'friend', role: 'opponent', mode: 'async', who: 'Kenta', theirs: 1552 }] } }
    await mountKey()
    expect($('.pvp-key__due').textContent).toBe('2')
    expect($('.pvp-key').getAttribute('aria-label')).toBe('Duels · 2 défis à jouer')
  })

  it('stands while the finish plays, its count held', async () => {
    duels = { data: { rating: RATED, live: [], toPlay: [{ id: 45, kind: 'friend', role: 'opponent', mode: 'async', who: 'Kenta', theirs: 1552 }] } }
    await mountKey({ hold: true })
    expect($('.pvp-key')).not.toBeNull()
    expect($('.pvp-key__due')).toBeNull()
  })

  it('arrives with the gate on a finish, on the gate’s beat', async () => {
    duels = { data: { rating: RATED, live: [], toPlay: [] } }
    await mountKey({ hold: true, arrive: true, arriveDelay: 1200 })
    expect($('.pvp-key').classList.contains('clrk-gate--arrive')).toBe(true)
    expect($('.pvp-key').style.getPropertyValue('--gate-d')).toBe('1200ms')
    document.body.innerHTML = ''
    await mountKey()
    expect($('.pvp-key').classList.contains('clrk-gate--arrive')).toBe(false)
  })

  it('is a square at the gate’s height beside it', async () => {
    duels = { data: { rating: RATED, live: [], toPlay: [] } }
    await mount('/today', '/today', (
      <div className="tdy"><div className="tdy-gaterow"><button type="button" className="btn-depart btn-depart--gate">Embarquer</button><DuelKey /></div></div>
    ))
    const gate = $('.btn-depart--gate').getBoundingClientRect()
    const key = $('.pvp-key').getBoundingClientRect()
    expect(Math.round(key.height)).toBe(Math.round(gate.height))
    expect(Math.round(key.width)).toBe(Math.round(key.height))
    expect(key.left).toBeGreaterThan(gate.right)
  })
})

describe('the duels on a day done’s board (E)', () => {
  it('names the learner’s Elo and opens the hall', async () => {
    duels = { data: { rating: RATED, live: [], toPlay: [] } }
    await mountDayBoard()
    expect($('.pvp-row .tdy-next__day').textContent).toBe('Duels')
    expect($('.pvp-row .tdy-next__n').textContent).toBe(`${(1248).toLocaleString('fr')}Elo`)
    expect($('.pvp-row .tdy-board__way').textContent).toBe('Défier')
    $('.pvp-row').click()
    await settle()
    expect($('.where').textContent).toBe('/profile/duels')
  })

  it('names the first challenge, its score to beat, and boards it', async () => {
    duels = { data: { rating: RATED, live: [], toPlay: [{ id: 45, kind: 'friend', role: 'opponent', mode: 'async', who: 'Kenta', theirs: 1552 }, { id: 46, kind: 'friend', role: 'opponent', mode: 'async', who: 'aiko', theirs: 1225 }] } }
    await mountDayBoard()
    expect($('.pvp-row .tdy-next__day').textContent).toBe('Kenta te défie')
    expect($('.pvp-row .tdy-next__n').textContent).toBe(`${(1552).toLocaleString('fr')}à battre`)
    expect($('.pvp-row .tdy-board__way').textContent).toBe('Jouer')
    $('.pvp-row').click()
    await settle()
    expect($('.where').textContent).toBe('/duel/45')
  })

  it('puts a friend waiting in a live room first', async () => {
    duels = { data: { rating: RATED, live: [{ id: 47, kind: 'friend', role: 'opponent', mode: 'live', who: 'Sora22', theirs: null }], toPlay: [{ id: 45, kind: 'friend', role: 'opponent', mode: 'async', who: 'Kenta', theirs: 1552 }] } }
    await mountDayBoard()
    expect($('.pvp-row .tdy-next__day').textContent).toBe('Sora22 t’attend en direct')
    expect($('.pvp-row .tdy-board__way').textContent).toBe('Entrer')
  })

  it('never names the learner’s own challenge, nor their ranked seat, as one they received', async () => {
    duels = { data: { rating: RATED, live: [], toPlay: [
      { id: 50, kind: 'friend', role: 'challenger', mode: 'async', who: 'Kenta', theirs: null },
      { id: 51, kind: 'ranked', role: 'opponent', mode: 'async', who: null, theirs: 900 },
    ] } }
    await mountDayBoard()
    expect($('.pvp-row .tdy-next__day').textContent).toBe('Duels')
  })

  it('names a learner off the board « Voyageur »', async () => {
    duels = { data: { rating: RATED, live: [], toPlay: [{ id: 45, kind: 'friend', role: 'opponent', mode: 'async', who: null, theirs: 900 }] } }
    await mountDayBoard()
    expect($('.pvp-row .tdy-next__day').textContent).toBe('Voyageur te défie')
  })

  it('stands after the reviews held back, before the day’s own rows', async () => {
    duels = { data: { rating: RATED, live: [], toPlay: [] } }
    await mountDayBoard({ rows: [<p key="held" className="row-held" />, <p key="tomorrow" className="row-tomorrow" />] })
    expect([...$('.tdy-board').children].map(el => el.className)).toEqual(['row-held', 'tdy-next tdy-board__go pvp-row', 'row-tomorrow'])
    document.body.innerHTML = ''
    await mountDayBoard({ rows: [<p key="tomorrow" className="row-tomorrow" />] })
    expect([...$('.tdy-board').children].map(el => el.className)).toEqual(['tdy-next tdy-board__go pvp-row', 'row-tomorrow'])
  })

  it('says nothing while the finish plays, nor before the duels have answered', async () => {
    duels = { data: { rating: RATED, live: [], toPlay: [] } }
    await mountDayBoard({ ask: false, rows: [<p key="tomorrow" className="row-tomorrow" />] })
    expect($('.pvp-row')).toBeNull()
    expect($('.row-tomorrow')).not.toBeNull()
    document.body.innerHTML = ''
    duels = { data: null }
    await mountDayBoard()
    expect($('.tdy-board')).toBeNull()
  })
})
