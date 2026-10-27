import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { LangProvider } from './LangContext'
import { StageFrame } from './components/chrome/Shell'
import './index.css'

// ── 対戦 — the duels' screens on a phone (plan 276) ─────────────────
// The screens the owner picked, against a server answering as
// routes/pvp.py does. The hall (H3, its Elo the curve, G1): the figure,
// the place and the last twenty duels over where the placement started
// it, or before any Elo the way to the test. The friends (F1): a learner is found by their
// exact handle and is that handle alone until a request is accepted; a
// friend's card holds the report, four closed reasons and never a word
// typed. The departure (D2): the ranked sprint is paid on the button
// that names its price and starts at once; before the placement test
// there is no Elo, and the button leads to the test. The Elo board (L2):
// both scopes counted by the server, the learner between their
// neighbours, the cut only where places are skipped. Today's notice
// (E3): the first challenge, a live room before it, hidden until
// tomorrow by its ✕.

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
const { DuelLine } = await import('./components/pvp/DuelLine')
const { LEVEL_PATH } = await import('./domain/duel')

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
  rating: { placed: true, elo: 1248, provisional: false, games: 21, wins: 15, draws: 0, losses: 6, peak: 1248,
    placedLevel: 'N4', start: 1200, rank: 3, of: 10, trend: [1180, 1210, 1195, 1230, 1248] },
  toPlay: [{ id: 45, kind: 'friend', mode: 'async', level: 'N5', status: 'open', against: 'friend', who: 'Kenta', mine: null, theirs: 1552,
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

  it('says there is no Elo before the placement test, and leads to it', async () => {
    duels = { data: { ...HALL, rating: { placed: false } } }
    await mountHall()
    expect($('.pvp-curve--none .pvp-curve__none').textContent).toBe('Pas encore d’Elo')
    expect($('.pvp-curve__svg')).toBeNull()
    expect($('.records--three')).toBeNull()
    $('.pvp-curve--none').click()
    await settle()
    expect($('.where').textContent).toBe(LEVEL_PATH)
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
    duels = { data: { prices: { ranked: 2, review: 1 }, rating: { placed: true, elo: 1248 } } }
    answer = (path, init) => (path === '/api/pvp/duels' && init?.method === 'POST' ? { id: 51, against: 'seek' } : null)
    await mountDeparture()
    const go = $('.exam-cover__go')
    expect(go.textContent).toBe('Partir · 2 crédits')
    go.click()
    await settle()
    expect(sentBody('/api/pvp/duels')).toEqual({ ranked: true })
    expect($('.where').textContent).toBe('/duel/51#start')
  })

  it('sends a learner without an Elo to the placement test, and charges nothing', async () => {
    duels = { data: { prices: { ranked: 2, review: 1 }, rating: { placed: false } } }
    await mountDeparture()
    const go = $('.exam-cover__go')
    expect(go.textContent).toBe('Passer le test de placement')
    go.click()
    await settle()
    expect(asked('/api/pvp/duels', 'POST')).toHaveLength(0)
    expect($('.where').textContent).toBe(LEVEL_PATH)
  })

  it('takes platform 2 to the friend’s sheet', async () => {
    duels = { data: { prices: { ranked: 2, review: 1 }, rating: { placed: true, elo: 1248 } } }
    answer = path => (path === '/api/pvp/friends' ? BOOK : null)
    await mountDeparture()
    $$('.pvp-quai')[1].click()
    await settle(50)
    expect($$('.pvp-quai').map(q => q.getAttribute('aria-checked'))).toEqual(['false', 'true'])
    expect($('.exam-cover__go').textContent).toBe('Choisir un ami')
    $('.exam-cover__go').click()
    await settle()
    expect(asked('/api/pvp/friends')).toHaveLength(1)
    expect($('.pvp-sheet .pvp-pick__row').textContent).toContain('Kenta')
  })
})

// ── L2 — the Elo board ──

const place = (rank, extra = {}) => ({ rank, username: `L${rank}`, elo: 1500 - rank * 20, provisional: false, me: false, ...extra })

function boardServer(path) {
  const p = new URL(path, 'http://x').searchParams
  if (p.get('scope') === 'friends') {
    const entries = [place(1), place(2, { me: true, username: 'Lucas' }), place(3)]
    return { scope: 'friends', offset: 0, of: 3, entries, near: entries,
      me: { ...entries[1], gap: { elo: 21, username: 'L1', rank: 1 } } }
  }
  const me = place(8, { me: true, username: 'Lucas' })
  return { scope: 'all', offset: 0, of: 10, entries: [1, 2, 3, 4, 5].map(r => place(r, r === 2 ? { provisional: true } : {})),
    near: [place(7), me, place(9)], me: { ...me, gap: { elo: 21, username: 'L7', rank: 7 } } }
}

const mountBoard = () => mount('/profile/duels/board', '/profile/duels/board', <DuelBoardScreen session={SESSION} />)

describe('the Elo board (L2)', () => {
  it('counts both scopes from the server, and asks for the top and the learner’s neighbours', async () => {
    answer = boardServer
    await mountBoard()
    expect($$('.bz__seg .seg__opt').map(o => o.textContent)).toEqual(['Tous · 10', 'Amis · 3'])
    const asks = asked('/api/pvp/board').map(c => new URL(c.path, 'http://x').searchParams)
    expect(asks.map(p => p.get('scope')).sort()).toEqual(['all', 'friends'])
    expect(asks.every(p => p.get('limit') === '5' && p.get('around') === '1')).toBe(true)
  })

  it('draws the top, a cut, then the learner between their neighbours', async () => {
    answer = boardServer
    await mountBoard()
    expect($$('.banzuke .leaderboard-row__rank').map(r => Number(r.textContent))).toEqual([1, 2, 3, 4, 5, 7, 8, 9])
    expect($$('.banzuke .bz__cut')).toHaveLength(1)
    const me = $('.leaderboard-row--me')
    expect(me.querySelector('.leaderboard-row__name').textContent).toBe('Toi')
    // A provisional Elo is marked; a settled one is not.
    expect($$('.leaderboard-row')[1].querySelector('.pvp-board__prov')).toBeTruthy()
    expect($$('.leaderboard-row')[0].querySelector('.pvp-board__prov')).toBeNull()
    expect($('.bz__gap-to').textContent).toBe('21 points d’Elo de la 7ᵉ place')
  })

  it('draws no cut where no place is skipped', async () => {
    answer = boardServer
    await mountBoard()
    $$('.bz__seg .seg__opt')[1].click()
    await settle(50)
    expect($$('.banzuke .leaderboard-row__rank').map(r => Number(r.textContent))).toEqual([1, 2, 3])
    expect($('.banzuke .bz__cut')).toBeNull()
    expect($('.bz__gap-to').textContent).toBe('21 points d’Elo de la 1re place')
  })

  it('says a learner off the board is not ranked yet', async () => {
    answer = path => {
      const scope = new URL(path, 'http://x').searchParams.get('scope')
      return { scope, offset: 0, of: 4, entries: [1, 2, 3, 4].map(r => place(r)), near: [],
        me: { rank: null, elo: 1200, placed: true, provisional: true, gap: null, me: true } }
    }
    await mountBoard()
    expect($('.leaderboard-row--me')).toBeNull()
    expect($('.bz__gap-to').textContent).toBe('pas encore classé')
  })
})

// ── E3 — the challenge on Today ──

const mountLine = (props = {}) => mount('/today', '/today', <div className="tdy"><DuelLine {...props} /></div>)

describe('the challenge on Today (E3)', () => {
  it('names the first challenge, its score to beat, and boards it', async () => {
    duels = { data: { live: [], toPlay: [{ id: 45, kind: 'friend', mode: 'async', who: 'Kenta', theirs: 1552 }, { id: 46, kind: 'friend', mode: 'async', who: 'aiko', theirs: 1225 }] } }
    await mountLine()
    expect($('.pvp-line .tdy-door__what').textContent).toBe(`Kenta te défie · ${(1552).toLocaleString('fr')} à battre`)
    expect($('.pvp-line .tdy-door__go').textContent).toBe('Jouer')
    $('.pvp-line .tdy-cb__open').click()
    await settle()
    expect($('.where').textContent).toBe('/duel/45')
  })

  it('puts a friend waiting in a live room first', async () => {
    duels = { data: { live: [{ id: 47, kind: 'friend', mode: 'live', who: 'Sora22', theirs: null }], toPlay: [{ id: 45, kind: 'friend', mode: 'async', who: 'Kenta', theirs: 1552 }] } }
    await mountLine()
    expect($('.pvp-line .tdy-door__what').textContent).toBe('Sora22 t’attend en direct')
    expect($('.pvp-line .tdy-door__go').textContent).toBe('Entrer')
  })

  it('names a learner off the board « Voyageur »', async () => {
    duels = { data: { live: [], toPlay: [{ id: 45, kind: 'friend', mode: 'async', who: null, theirs: 900 }] } }
    await mountLine()
    expect($('.pvp-line .tdy-door__what').textContent).toBe('Voyageur te défie · 900 à battre')
  })

  it('hides until tomorrow on its ✕', async () => {
    duels = { data: { live: [], toPlay: [{ id: 45, kind: 'friend', mode: 'async', who: 'Kenta', theirs: 1552 }] } }
    await mountLine()
    $('.pvp-line .tdy-cb__hide').click()
    await settle(50)
    expect($('.pvp-line')).toBeNull()
    expect(localStorage.getItem('jp-duel-line-hidden')).toBe(new Date().toDateString())
  })

  it('says nothing while the finish plays, nor with nothing waiting', async () => {
    duels = { data: { live: [], toPlay: [{ id: 45, kind: 'friend', mode: 'async', who: 'Kenta', theirs: 1552 }] } }
    await mountLine({ hold: true })
    expect($('.pvp-line')).toBeNull()
    document.body.innerHTML = ''
    duels = { data: { live: [], toPlay: [] } }
    await mountLine()
    expect($('.pvp-line')).toBeNull()
  })
})
