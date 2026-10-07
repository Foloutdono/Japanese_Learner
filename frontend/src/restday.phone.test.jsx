import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from 'vitest-browser-react'
import { MemoryRouter } from 'react-router-dom'
import { LangProvider } from './LangContext'
import './index.css'

// ── 運休 — the rest-day notice on a phone (plan 191) ────────────────
// The canvas's RestDay board at 390×844: the week as seven stations on
// one line with the 運休 stub over the missed Tuesday and Wednesday
// waiting, the streak held at 8, the reserve, today's 41 cards with each
// line's share, and the gate. Its entrance plays on the board's clock;
// a tap skips to the rest, reduced motion fades it in whole. And the
// week everywhere else (Today's stamp rally, the profile's stamp book)
// lays the same stub over a day the profile's week marks `rest: true`.

vi.mock('./lib/audio', async o => ({ ...(await o()), playClick: vi.fn(), playUi: vi.fn() }))

const { default: RestDayNotice } = await import('./components/dayclear/RestDayNotice')
const { StampRally } = await import('./components/station/StampRally')
const { StampBook } = await import('./components/profile/ProfileBlocks')
const { InkFilters } = await import('./components/dayclear/kit')
const { REST_WEEK, TODAY_REST, REST_MINUTES } = await import('./components/dayclear/fixtures')
const fr = (await import('./locales/fr/index.js')).default

const settle = (ms = 120) => new Promise(r => setTimeout(r, ms))
const $ = sel => document.querySelector(sel)
const $$ = sel => [...document.querySelectorAll(sel)]

beforeEach(() => {
  document.body.innerHTML = ''
  // A phone's scrollbar overlays the page: no gutter taken from its width.
  document.documentElement.style.scrollbarGutter = 'auto'
  try { localStorage.setItem('lang', 'fr') } catch { /* private mode */ }
})

// French sets a narrow no-break space before its colons.
const plain = s => s.replace(/[\u202f\u00a0]/g, ' ').replace(/\s+/g, ' ').trim()

// As the workbench draws it: Today's <main> in the stage frame, full height.
async function mount(props = {}) {
  const onDepart = vi.fn()
  await render(
    <LangProvider>
      <MemoryRouter>
        <div className="phone phone--stage">
          <main id="main-content" className="today">
            <InkFilters />
            <RestDayNotice
              rest={TODAY_REST.rest}
              week={REST_WEEK}
              total={TODAY_REST.total}
              minutes={REST_MINUTES}
              lanes={TODAY_REST.lanes}
              onDepart={onDepart}
              {...props}
            />
          </main>
        </div>
      </MemoryRouter>
    </LangProvider>
  )
  return { onDepart }
}

describe('the rest-day notice at 390×844', () => {
  it('says the streak held, as the board does', async () => {
    await mount({ reduced: true })
    expect($('.rst .clrk-hdr__cap').textContent).toBe('連続乗車 継続')
    expect($('#rst-title').textContent).toBe('Ta série tient')
    expect($('.rst-streak__n').textContent).toBe('8')
    expect($('.rst-streak__w').textContent).toBe('jours de suite')
    expect($('.rst-reserve__t').textContent).toBe('Jour de repos utilisé mardi')
    expect(plain($('.rst-reserve__s').textContent)).toBe('0 en réserve · le prochain au 14ᵉ jour')
    expect($('.rst-today__n').textContent).toBe('41')
    expect(plain($('.rst-today__min').textContent)).toBe('~14 min')
    expect($('.rst-gatewrap .btn-depart--gate').textContent).toContain('Départ')
  })

  it('draws the week as stations, the stub over the missed day and today waiting', async () => {
    await mount({ reduced: true })
    const stations = $$('.rst-week > li')
    expect(stations).toHaveLength(7)
    expect(stations.map(li => li.textContent)).toEqual(['木', '金', '土', '日', '月', '火運休', '水'])
    expect($$('.rst-week .clrk-slot.clrk-inked')).toHaveLength(5)
    // The stub in pass ink, laid over Tuesday; the miss under it gone at rest.
    const stub = $('.rst-stn--rest .clrk-slot--rest')
    expect(stub).not.toBeNull()
    expect(getComputedStyle($('.rst-stn--rest .rst-miss')).opacity).toBe('0')
    expect(getComputedStyle(stub, '::before').backgroundColor).toBe('rgb(87, 80, 96)')
    expect($('.rst-week > li:last-child .clrk-slot--wait')).not.toBeNull()
    // The board's places: 50px between stations, 56px beside the stub,
    // the row centred.
    const centre = el => { const r = el.getBoundingClientRect(); return r.left + r.width / 2 }
    const xs = stations.map(centre)
    expect(xs.map((x, i) => (i ? Math.round(x - xs[i - 1]) : 0)).slice(1)).toEqual([50, 50, 50, 50, 56, 56])
    expect(Math.round((xs[0] + xs[6]) / 2)).toBe(195)
    // The line: the run to Monday, through the stub, dashed into today.
    expect($$('.rst-line').map(l => l.className.match(/rst-line--(\w+)/)[1])).toEqual(['run', 'over', 'next'])
    expect(Math.round($('.rst-line--run').getBoundingClientRect().width)).toBe(200)
  })

  it('names the reserve and the rally for a screen reader', async () => {
    await mount({ reduced: true })
    expect(plain($('.rst-rally').getAttribute('aria-label')))
      .toBe('La semaine : jeudi à lundi tamponnés, mardi couvert par un jour de repos, mercredi aujourd’hui')
    expect(plain($('.rst-today').getAttribute('aria-label'))).toBe('Aujourd’hui : 41 cartes, environ 14 minutes')
  })

  it('stripes today\'s card with each line\'s share, the largest first', async () => {
    await mount({ reduced: true })
    const parts = $$('.rst-edge i')
    expect(parts.map(i => i.style.flexGrow)).toEqual(['20', '14', '7'])
    expect(parts.map(i => i.style.background)).toEqual(['var(--line-kanji)', 'var(--line-vocab)', 'var(--line-grammar)'])
  })

  it('lays the screen out whole: the gate at the foot, nothing past the edges', async () => {
    await mount({ reduced: true })
    await settle(400)
    const gate = $('.rst-gatewrap .btn-depart--gate').getBoundingClientRect()
    expect(Math.round(gate.bottom)).toBe(844 - 28)
    expect(Math.round($('.rst-head').getBoundingClientRect().top)).toBe(44)
    expect(Math.round($('.rst-rally').getBoundingClientRect().top)).toBe(220)
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390)
    expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(844)
  })

  it('plays the entrance, and a tap skips to the rest', async () => {
    await mount({ reduced: false })
    const root = $('section.rst')
    expect(root.classList.contains('clrk--skip')).toBe(false)
    expect($('.rst-line--run').classList.contains('rst-draw')).toBe(true)
    expect($('.rst-stn--rest .rst-drop').classList.contains('rst-drop--go')).toBe(true)
    await settle(300)
    root.click()
    await settle()
    expect(root.classList.contains('clrk--skip')).toBe(true)
    // What had arrived stays put; what had not fades in.
    expect($('.rst-line--run').classList.contains('rst-draw')).toBe(false)
    expect($('.rst-line--run').classList.contains('clrk-fade')).toBe(false)
    expect($('.rst-streak').classList.contains('clrk-fade')).toBe(true)
    expect($('.rst-gatewrap').classList.contains('clrk-fade')).toBe(true)
    expect($('.rst-stn--rest .rst-drop').classList.contains('rst-drop--go')).toBe(false)
  })

  it('under reduced motion fades the scene in whole and moves nothing', async () => {
    await mount({ reduced: true })
    const root = $('section.rst')
    expect(root.classList.contains('clrk--reduced')).toBe(true)
    expect($('.rst__world').classList.contains('clrk-fade')).toBe(true)
    expect($$('.rst-draw, .rst-drop--go, .rst-puff--go, .rst-miss--go')).toHaveLength(0)
    expect(getComputedStyle($('.rst-stn--rest .rst-drop')).animationName).toBe('none')
    root.click()
    await settle()
    expect(root.classList.contains('clrk--skip')).toBe(false)
  })

  it('departs from the gate', async () => {
    const { onDepart } = await mount({ reduced: true })
    $('.rst-gatewrap .btn-depart--gate').click()
    expect(onDepart).toHaveBeenCalledTimes(1)
  })

  it('names two covered days, and a reserve at its cap with no next', async () => {
    const week = REST_WEEK.map((d, i) => (i === 4 ? { ...d, state: 'rest' } : d))
    await mount({ reduced: true, week, rest: { held: 2, unseen: ['2026-10-05', '2026-10-06'], streak: 7, next_at: null } })
    expect($$('.rst-stn--rest')).toHaveLength(2)
    expect($('.rst-reserve__t').textContent).toBe('Jours de repos utilisés lundi et mardi')
    expect(plain($('.rst-reserve__s').textContent)).toBe('2 en réserve')
  })
})

// ── 運休 on the week everywhere ──────────────────────────────────────
function iso(d) {
  return d.toISOString().slice(0, 10)
}
function localIso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

describe('a covered day on Today\'s stamp rally and the stamp book', () => {
  it('lays the 運休 stub on the rally where it drew a miss', async () => {
    const now = new Date()
    const back = n => { const d = new Date(now); d.setDate(now.getDate() - n); return iso(d) }
    const week = [
      { date: back(3), count: 12, practice: 0 },
      { date: back(2), count: 9, practice: 0 },
      { date: back(1), count: 0, practice: 0, rest: true },
    ]
    await render(<StampRally week={week} streak={3} t={fr} />)
    const stamps = $$('.stamp-rally__stamp')
    expect(stamps).toHaveLength(7)
    const rest = stamps[5]
    expect(rest.classList.contains('stamp-rally__stamp--rest')).toBe(true)
    expect(rest.textContent).toBe('運休')
    expect(stamps.filter(s => s.classList.contains('stamp-rally__stamp--rest'))).toHaveLength(1)
    // Pass ink, not stamp ink; a station wider than a stamp.
    expect(getComputedStyle(rest).backgroundColor).toBe('rgb(87, 80, 96)')
    expect(rest.getBoundingClientRect().width).toBeGreaterThan(stamps[4].getBoundingClientRect().width)
    expect(stamps[4].classList.contains('stamp-rally__stamp--missed')).toBe(false)
    expect(stamps[2].classList.contains('stamp-rally__stamp--missed')).toBe(true)
  })

  it('lays the stub on the stamp book\'s day too', async () => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    const calendar = [{ date: localIso(d), count: 0, practice: 0, rest: true }]
    await render(<StampBook calendar={calendar} streak={1} longest={4} t={fr} lang="fr" />)
    const rest = $$('.sbook__stamp--rest')
    expect(rest).toHaveLength(1)
    expect(rest[0].textContent).toBe('運休')
    expect(getComputedStyle(rest[0]).backgroundColor).toBe('rgb(87, 80, 96)')
  })
})
