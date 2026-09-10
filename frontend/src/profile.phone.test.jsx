import { describe, it, expect } from 'vitest'
import { render } from 'vitest-browser-react'
// Stylesheet contracts for the profile, the statistics and the settings
// at 390px (plan 074), on fixture markup — the same trick as
// practice.phone.test.jsx. The objects the canvas draws for Profile,
// ProfileInserts, StatusSheet, Statistics and the Settings pages,
// pinned by their real classes.
import './index.css'

const columns = el => getComputedStyle(el).gridTemplateColumns.split(' ').length

describe('the profile at phone width', () => {
  it('the stamp book is seven across, the inserts two across, the ranking rows are targets', async () => {
    const screen = await render(
      <main className="profile">
        <section className="sbook">
          <div className="sbook__month"><span className="sbook__title">Stamp book</span><span className="fig__l">September 2026</span></div>
          <div className="sbook__dows">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} className="sbook__dow">{d}</span>)}</div>
          <div className="sbook__grid">
            {Array.from({ length: 35 }, (_, i) => (
              <span key={i} className={`sbook__stamp${i === 20 ? ' sbook__stamp--missed' : i === 33 ? ' sbook__stamp--today' : i === 34 ? ' sbook__stamp--future' : ''}`} style={{ '--stamp-tilt': '3deg' }}>{(i % 30) + 1}</span>
            ))}
          </div>
          <div className="sbook__side"><div className="sbook__figs">
            <div className="fig"><span className="fig__v">3<span className="fig__u">days</span></span><span className="fig__l">Current streak</span></div>
            <div className="fig"><span className="fig__v">21<span className="fig__u">days</span></span><span className="fig__l">Longest</span></div>
            <div className="fig"><span className="fig__v">32<span className="fig__u">/ 34</span></span><span className="fig__l">Stamped</span></div>
          </div></div>
        </section>
        <div className="records">
          <div className="record"><span className="record__value">842</span><span className="record__label">Reviews</span></div>
          <div className="record"><span className="record__value">91<span className="record__unit">%</span></span><span className="record__label">Retention</span></div>
          <button type="button" className="record record--door" style={{ '--line-color': 'var(--pass-ink)' }}><span className="pf-line__id"><span className="pf-line__roundel">TO</span><span className="pf-line__names"><span className="pf-line__jp">Statistics</span></span></span></button>
          <button type="button" className="record record--door" style={{ '--line-color': 'var(--pass-ink)' }}><span className="pf-line__id"><span className="pf-line__roundel">S</span><span className="pf-line__names"><span className="pf-line__jp">Settings</span></span></span></button>
        </div>
        <div className="pf-ledger">
          {['KN', 'TG', 'KJ', 'BP'].map(code => (
            <button key={code} type="button" className="pf-line" style={{ '--line-color': 'var(--line-kana)' }}>
              <span className="pf-line__id"><span className="pf-line__roundel">{code}</span><span className="pf-line__names"><span className="pf-line__jp">Kana</span></span></span>
              <span className="pf-line__fig">104<span className="pf-line__of">/ 104</span></span>
              <span className="pf-line__track"><span className="pf-line__done" style={{ width: '100%' }} /></span>
            </button>
          ))}
        </div>
        <section className="banzuke">
          <div className="bz__head"><span className="bz__mark"><span className="bz__jp">Ranking</span></span><div className="seg bz__seg"><button type="button" className="seg__opt seg__opt--on"><span className="seg__opt-latin">This week</span></button><button type="button" className="seg__opt"><span className="seg__opt-latin">All time</span></button></div></div>
          <div className="leaderboard-row"><span className="leaderboard-row__rank leaderboard-row__rank--gold">1</span><span className="leaderboard-row__name">Mei</span><span className="leaderboard-row__xp">1,240 XP</span></div>
          <div className="leaderboard-row leaderboard-row--me"><span className="leaderboard-row__rank leaderboard-row__rank--bronze">3</span><span className="leaderboard-row__name">Aiko</span><span className="leaderboard-row__xp">960 XP</span></div>
          <div className="leaderboard-row"><span className="leaderboard-row__rank">4</span><span className="leaderboard-row__name">Sora</span><span className="leaderboard-row__xp">720 XP</span></div>
        </section>
      </main>
    )
    expect(columns(screen.container.querySelector('.sbook__grid'))).toBe(7)
    const stamps = screen.container.querySelectorAll('.sbook__stamp')
    const r = stamps[0].getBoundingClientRect()
    expect(Math.abs(r.width - r.height)).toBeLessThan(1)
    expect(getComputedStyle(stamps[0]).borderTopLeftRadius).toBe('999px')
    expect(getComputedStyle(stamps[20]).borderTopStyle).toBe('dashed')
    expect(getComputedStyle(stamps[33]).borderTopWidth).toBe('2px')
    expect(columns(screen.container.querySelector('.records'))).toBe(2)
    expect(columns(screen.container.querySelector('.pf-ledger'))).toBe(2)
    for (const row of screen.container.querySelectorAll('.leaderboard-row')) {
      expect(row.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
    }
    const rank = screen.container.querySelector('.leaderboard-row__rank')
    expect(rank.getBoundingClientRect().width).toBe(30)
    expect(getComputedStyle(rank).borderTopLeftRadius).toBe('999px')
    // The board's toggle sits on the head's right edge — and on the
    // title's OWN line, not a second one under it: at 390px the head
    // used to wrap, which put the only control in the card on a line
    // of its own (index.css, "The head holds ONE row").
    const mark = screen.container.querySelector('.bz__mark').getBoundingClientRect()
    const head = screen.container.querySelector('.bz__head').getBoundingClientRect()
    const seg = screen.container.querySelector('.bz__seg').getBoundingClientRect()
    expect(head.right - seg.right).toBeLessThan(head.width / 2)
    expect(seg.top).toBeLessThan(mark.bottom)
  })

  it('the status sheet: distance, a 44px track, two rows, the moves are targets', async () => {
    const screen = await render(
      <div className="sheet sheet--sumi status-sheet jour-st--slightlyBehind" style={{ position: 'static' }}>
        <div className="jour-dist">
          <span className="jour-dist__count">1,830<span className="jour-dist__of">/ 4,206</span></span>
          <span className="jour-dist__pct">43%</span>
          <span className="jour-dist__leg">Next stop N4 · 474 behind plan</span>
        </div>
        <div className="jour-track">
          <span className="jour-track__span">
            <span className="jour-track__rail" />
            <span className="jour-track__done" style={{ width: '43.5%' }} />
            <span className="jour-track__owed" style={{ left: '43.5%', width: '11.3%' }} />
            <span className="jour-track__station" style={{ left: '0%' }}>
              <i /><span className="jour-track__station-name">発</span>
            </span>
            <span className="jour-track__station" style={{ left: '46%' }}>
              <i /><span className="jour-track__station-name">N4</span>
            </span>
            <span className="jour-track__plan" style={{ left: '54.8%' }} />
            <span className="jour-track__you" style={{ left: '43.5%' }} />
          </span>
        </div>
        <div className="jour-cmps">
          <div className="jour-cmp">
            <span className="jour-cmp__k">Pace</span>
            <span className="jour-cmp__v">10.5<span className="jour-cmp__u">/ day</span></span>
            <span className="jour-cmp__d">-1.5</span>
            <span className="jour-cmp__sub">promised 12 / day · last 14 days</span>
          </div>
          <div className="jour-cmp">
            <span className="jour-cmp__k">Arrival</span>
            <span className="jour-cmp__v">23 Apr 2027</span>
            <span className="jour-cmp__d">+67 d</span>
            <span className="jour-cmp__sub">on the pass, 15 Feb 2027</span>
          </div>
        </div>
        <div className="jour-rev__actions">
          <button type="button" className="jour-act"><strong>Run 15 a day</strong>keeps 14 Mar</button>
          <button type="button" className="jour-act"><strong>Reprint at 7.1 a day</strong>arrive 23 Mar</button>
        </div>
      </div>
    )
    // The head: count and percent share the first line, the percent on
    // the right edge; the leg takes the line under them.
    const count = screen.container.querySelector('.jour-dist__count').getBoundingClientRect()
    const pct = screen.container.querySelector('.jour-dist__pct').getBoundingClientRect()
    const leg = screen.container.querySelector('.jour-dist__leg').getBoundingClientRect()
    const head = screen.container.querySelector('.jour-dist').getBoundingClientRect()
    expect(pct.top).toBeCloseTo(count.top, 0)
    expect(head.right - pct.right).toBeLessThan(1)
    expect(leg.top).toBeGreaterThan(count.bottom - 1)
    // The drawing costs 44px of a phone, not 132.
    expect(screen.container.querySelector('.jour-track').getBoundingClientRect().height).toBe(44)
    // Each row: value and delta on one line, the promise under them.
    const rows = [...screen.container.querySelectorAll('.jour-cmp')].map(r => r.getBoundingClientRect())
    expect(rows[1].top).toBeGreaterThan(rows[0].bottom - 1)
    const v = screen.container.querySelector('.jour-cmp__v').getBoundingClientRect()
    const d = screen.container.querySelector('.jour-cmp__d').getBoundingClientRect()
    const sub = screen.container.querySelector('.jour-cmp__sub').getBoundingClientRect()
    expect(d.top).toBeCloseTo(v.top, 0)
    expect(d.left).toBeGreaterThan(v.right)
    expect(sub.top).toBeGreaterThan(v.bottom - 1)
    for (const act of screen.container.querySelectorAll('.jour-act')) {
      expect(act.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
    }
  })
})

describe('the statistics at phone width', () => {
  it('six records two across, the calendar fourteen weeks whole, the forecast seven bars', async () => {
    const screen = await render(
      <main className="stats">
        <div className="records records--stats">
          {['Streak', 'Due today', 'Mastered', 'Accuracy', 'In progress', 'New'].map(l => (
            <div key={l} className="record"><span className="record__value">24</span><span className="record__label">{l}</span><span className="record__note">note</span></div>
          ))}
        </div>
        <div className="stat-cap"><span>Practice calendar</span><span>14 weeks · best day <b className="stat-cap__fig">88</b></span></div>
        <div className="cal cal--gold" style={{ '--weeks': 14 }}>
          <div className="cal__months"><span className="cal__month" style={{ gridColumn: '1 / span 2' }}>Sept.</span><span className="cal__month" style={{ gridColumn: '3 / span 12' }}>Oct.</span></div>
          <div className="cal__grid">{Array.from({ length: 98 }, (_, i) => <span key={i} className={`cal__cell${i % 5 ? ` cal__cell--${i % 5}` : ''}`} />)}</div>
          <div className="cal__foot"><span>One square a day</span><span className="cal__scale">less <span className="cal__cell" /><span className="cal__cell cal__cell--4" /> more</span></div>
        </div>
        <div className="forecast forecast--pass">
          <div className="forecast__bars">{[24, 61, 38, 52, 70, 44, 29].map((v, i) => <span key={i} className="forecast__col"><span className="forecast__v">{v}</span><span className="forecast__bar" style={{ height: `${v}%` }} /></span>)}</div>
          <div className="forecast__days">{['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(d => <span key={d}>{d}</span>)}</div>
        </div>
      </main>
    )
    expect(columns(screen.container.querySelector('.records'))).toBe(2)
    const records = [...screen.container.querySelectorAll('.record')].map(r => r.getBoundingClientRect())
    expect(records[5].top).toBeGreaterThan(records[3].bottom - 1)
    const grid = screen.container.querySelector('.cal__grid')
    expect(columns(grid)).toBe(14)
    // Whole, not scrolled: the grid fits the card.
    expect(grid.scrollWidth).toBeLessThanOrEqual(grid.clientWidth + 1)
    const cells = grid.querySelectorAll('.cal__cell')
    const c = cells[0].getBoundingClientRect()
    expect(Math.abs(c.width - c.height)).toBeLessThan(1)
    // A month is named into the columns its run owns, and the shortest
    // run the calendar will name is two of them (domain/statsModel.js,
    // MIN_MONTH_SPAN). The longest short month French sets has to print
    // in that: "SEPT." was cut to "SE" at both ends of the calendar.
    for (const month of screen.container.querySelectorAll('.cal__month')) {
      expect(month.scrollWidth, month.textContent).toBeLessThanOrEqual(month.clientWidth + 1)
    }
    // Column-major: the second cell sits under the first, the eighth beside it.
    const c1 = cells[1].getBoundingClientRect()
    const c7 = cells[7].getBoundingClientRect()
    expect(c1.left).toBeCloseTo(c.left, 0)
    expect(c1.top).toBeGreaterThan(c.top)
    expect(c7.top).toBeCloseTo(c.top, 0)
    expect(c7.left).toBeGreaterThan(c.right - 1)
    expect(columns(screen.container.querySelector('.forecast__bars'))).toBe(7)
    const bars = [...screen.container.querySelectorAll('.forecast__bar')].map(b => b.getBoundingClientRect().height)
    expect(bars[4]).toBeGreaterThan(bars[0])
  })
})

describe('the settings at phone width', () => {
  it('the list rows are 60px targets divided by hairlines; the services three across, the stops five, the destinations four', async () => {
    const screen = await render(
      <main className="settings">
        <div className="stg-headrow"><div className="stg-head"><h1 className="stg-head__jp">Settings</h1></div><button type="button" className="stage__leave">‹ Profile</button></div>
        <div className="stg-list">
          {['Display & language', 'Sound', 'Learning'].map(l => (
            <button key={l} type="button" className="stg-row"><span className="stg-row__names"><span className="stg-row__jp">{l}</span></span><span className="stg-row__value">Dark · English</span></button>
          ))}
        </div>
        <div className="slip">
          <div className="slip__label"><b className="slip__name">JLPT level</b><span className="cap">You are here</span></div>
          <div className="lvlstrip">
            {['N5', 'N4', 'N3', 'N2', 'N1'].map(l => (
              <button key={l} type="button" className={`lvlstrip__stop${l === 'N4' ? ' lvlstrip__stop--on' : ''}`}><span className="lvlstrip__dot" /><span className="lvlstrip__code">{l}</span>{l === 'N4' && <span className="lvlstrip__jp">Elementary</span>}</button>
            ))}
          </div>
        </div>
        <div className="slip">
          <div className="svc-grid">
            {['Local', 'Rapid', 'Express'].map(s => <button key={s} type="button" className={`svc${s === 'Rapid' ? ' svc--on' : ''}`}><span className="svc__jp">{s}</span><span className="svc__pace">10 / day</span></button>)}
          </div>
        </div>
        <div className="slip">
          <div className="dest-grid">
            {['N4', 'N3', 'N2', 'N1'].map(l => <button key={l} type="button" className={`dest${l === 'N3' ? ' dest--on' : ''}`}><span className="dest__code">{l}</span><span className="dest__load">Elementary</span></button>)}
          </div>
          <div className="hour-grid">
            {['Morning', 'Noon', 'Evening', 'Flexible'].map(h => <button key={h} type="button" className="svc"><span className="svc__jp">{h}</span><span className="svc__pace">07:30</span></button>)}
          </div>
        </div>
      </main>
    )
    const rows = screen.container.querySelectorAll('.stg-row')
    for (const row of rows) expect(row.getBoundingClientRect().height).toBeGreaterThanOrEqual(60)
    expect(getComputedStyle(rows[0]).borderTopWidth).toBe('0px')
    expect(getComputedStyle(rows[1]).borderTopWidth).toBe('1px')
    expect(columns(screen.container.querySelector('.lvlstrip'))).toBe(5)
    const on = screen.container.querySelector('.lvlstrip__stop--on .lvlstrip__dot').getBoundingClientRect()
    const off = screen.container.querySelector('.lvlstrip__stop:not(.lvlstrip__stop--on) .lvlstrip__dot').getBoundingClientRect()
    expect(on.width).toBeGreaterThan(off.width)
    for (const stop of screen.container.querySelectorAll('.lvlstrip__stop')) {
      expect(stop.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
    }
    expect(columns(screen.container.querySelector('.svc-grid'))).toBe(3)
    for (const svc of screen.container.querySelectorAll('.svc')) {
      expect(svc.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
    }
    // The chosen service is the one with the pass ink on its edge.
    const onSvc = screen.container.querySelector('.svc--on')
    const offSvc = screen.container.querySelector('.svc-grid .svc:not(.svc--on)')
    expect(getComputedStyle(onSvc).borderTopColor).not.toBe(getComputedStyle(offSvc).borderTopColor)
    expect(columns(screen.container.querySelector('.dest-grid'))).toBe(4)
    expect(columns(screen.container.querySelector('.hour-grid'))).toBe(4)
  })
})
