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
  it('the stamp book is seven across over three figures, the records three across, the lines rows, the doors two, the ranking rows targets', async () => {
    const screen = await render(
      <main className="profile">
        <section className="sbook">
          <div className="sbook__month"><span className="sbook__title">Septembre</span><span className="fig__l">2026</span></div>
          <div className="sbook__dows">{['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => <span key={i} className="sbook__dow">{d}</span>)}</div>
          <div className="sbook__grid">
            {Array.from({ length: 35 }, (_, i) => (
              <span key={i} className={`sbook__stamp${i === 20 ? ' sbook__stamp--missed' : i === 33 ? ' sbook__stamp--today' : i === 34 ? ' sbook__stamp--future' : ''}`} style={{ '--stamp-tilt': '3deg' }}>{(i % 30) + 1}</span>
            ))}
          </div>
          <div className="sbook__side"><div className="sbook__figs">
            <div className="fig"><span className="fig__v">14<span className="fig__u">jours</span></span><span className="fig__l">Série</span></div>
            <div className="fig"><span className="fig__v">21<span className="fig__u">jours</span></span><span className="fig__l">Record</span></div>
            <div className="fig"><span className="fig__v">32<span className="fig__u">/ 34</span></span><span className="fig__l">Tamponnés</span></div>
          </div></div>
        </section>
        <div className="records records--three">
          <div className="record"><span className="record__value">8 420</span><span className="record__label">Révisions</span></div>
          <div className="record"><span className="record__value">91<span className="record__unit">%</span></span><span className="record__label">Rétention</span></div>
          <div className="record"><span className="record__value">12</span><span className="record__label">Sans faute</span></div>
        </div>
        <div className="pf-ledger">
          {[['KN', 'Kana', '123', '/ 158'], ['TG', 'Vocabulaire JLPT', '730', '/ 7 924'], ['KJ', 'Kanji', '170', '/ 2 185'], ['BP', 'Grammaire', '43', '/ 497']].map(([code, name, n, of]) => (
            <button key={code} type="button" className="pf-line" style={{ '--line-color': 'var(--line-kana)' }}>
              <span className="pf-line__id"><span className="pf-line__roundel">{code}</span><span className="pf-line__names"><span className="pf-line__jp">{name}</span></span></span>
              <span className="pf-line__track"><span className="pf-line__done" style={{ width: '40%' }} /></span>
              <span className="pf-line__fig">{n}<span className="pf-line__of">{of}</span></span>
            </button>
          ))}
        </div>
        <div className="records">
          <button type="button" className="record record--door" style={{ '--line-color': 'var(--pass-ink)' }}><span className="pf-line__id"><span className="pf-line__roundel">TO</span><span className="pf-line__names"><span className="pf-line__jp">Statistiques</span></span></span></button>
          <button type="button" className="record record--door" style={{ '--line-color': 'var(--pass-ink)' }}><span className="pf-line__id"><span className="pf-line__roundel">S</span><span className="pf-line__names"><span className="pf-line__jp">Réglages</span></span></span></button>
        </div>
        <section className="banzuke">
          <div className="bz__head"><span className="bz__mark"><span className="bz__jp">Ranking</span></span><div className="seg bz__seg"><button type="button" className="seg__opt seg__opt--on"><span className="seg__opt-latin">This week</span></button><button type="button" className="seg__opt"><span className="seg__opt-latin">All time</span></button></div></div>
          <div className="leaderboard-row"><span className="leaderboard-row__rank leaderboard-row__rank--gold">1</span><span className="leaderboard-row__name">Mei</span><span className="leaderboard-row__xp">1,240 XP</span></div>
          <div className="leaderboard-row leaderboard-row--me"><span className="leaderboard-row__rank leaderboard-row__rank--bronze">3</span><span className="leaderboard-row__name">Aiko</span><span className="leaderboard-row__xp">960 XP</span></div>
          <div className="leaderboard-row"><span className="leaderboard-row__rank">4</span><span className="leaderboard-row__name">Sora</span><span className="leaderboard-row__xp">720 XP</span></div>
        </section>
      </main>
    )
    const $ = sel => screen.container.querySelector(sel)
    const $$ = sel => [...screen.container.querySelectorAll(sel)]
    expect(columns($('.sbook__grid'))).toBe(7)
    const stamps = $$('.sbook__stamp')
    const r = stamps[0].getBoundingClientRect()
    expect(Math.abs(r.width - r.height)).toBeLessThan(1)
    expect(getComputedStyle(stamps[0]).borderTopLeftRadius).toBe('999px')
    expect(getComputedStyle(stamps[20]).borderTopStyle).toBe('dashed')
    expect(getComputedStyle(stamps[33]).borderTopWidth).toBe('2px')
    // The three figures under the sheet share ONE row (plan 143): the
    // third used to wrap onto a row of its own at this width.
    const figs = $$('.sbook__figs > .fig').map(f => f.getBoundingClientRect())
    expect(figs).toHaveLength(3)
    for (const f of figs) expect(f.top).toBeCloseTo(figs[0].top, 0)
    // The records: three figures, three across, one row.
    expect(columns($('.records--three'))).toBe(3)
    const cells = $$('.records--three > .record').map(c => c.getBoundingClientRect())
    for (const c of cells) expect(c.top).toBeCloseTo(cells[0].top, 0)
    // The lines are rows, and every row's rail starts and ends where the
    // others do however long its name or figure (the subgrid) -- a name
    // no longer wraps and drops its figure below its neighbour's.
    const rows = $$('.pf-line').map(row => row.getBoundingClientRect())
    for (const [i, row] of rows.entries()) {
      expect(row.left, `row ${i}`).toBeCloseTo(rows[0].left, 0)
      expect(row.width, `row ${i}`).toBeCloseTo(rows[0].width, 0)
      if (i) expect(row.top).toBeGreaterThan(rows[i - 1].bottom - 1)
    }
    const rails = $$('.pf-line__track').map(t => t.getBoundingClientRect())
    for (const rail of rails) {
      expect(rail.left).toBeCloseTo(rails[0].left, 0)
      expect(rail.right).toBeCloseTo(rails[0].right, 0)
      expect(rail.width).toBeGreaterThan(100)
    }
    const names = $$('.pf-line__jp').map(n => n.getBoundingClientRect())
    for (const n of names) expect(n.height).toBeLessThan(26)
    // The two doors, two across.
    expect(columns($('.record--door').parentElement)).toBe(2)
    for (const row of $$('.leaderboard-row')) {
      expect(row.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
    }
    const rank = $('.leaderboard-row__rank')
    expect(rank.getBoundingClientRect().width).toBe(30)
    expect(getComputedStyle(rank).borderTopLeftRadius).toBe('999px')
    // The board's toggle sits on the head's right edge — and on the
    // title's OWN line, not a second one under it: at 390px the head
    // used to wrap, which put the only control in the card on a line
    // of its own (index.css, "The head holds ONE row").
    const mark = $('.bz__mark').getBoundingClientRect()
    const head = $('.bz__head').getBoundingClientRect()
    const seg = $('.bz__seg').getBoundingClientRect()
    expect(head.right - seg.right).toBeLessThan(head.width / 2)
    expect(seg.top).toBeLessThan(mark.bottom)
  })

  it('the status sheet: distance, a 70px track, two rows, the moves side by side', async () => {
    const screen = await render(
      <div className="sheet sheet--sumi status-sheet jour-st--slightlyBehind" style={{ position: 'static' }}>
        <div className="jour-dist">
          <span className="jour-dist__count">1,830<span className="jour-dist__of">/ 4,206</span></span>
          <span className="jour-dist__pct">43%</span>
          <span className="jour-dist__leg">Next stop N4 · 474 behind plan</span>
        </div>
        <div className="jour-track">
          <div className="jline">
            <span className="jline__span">
              <span className="jline__siding jline__siding--done" />
              <span className="jline__leg" style={{ left: 'calc(0% + 2px)', width: 'calc(46% - 4px)' }} />
              <span className="jline__done" style={{ left: 'calc(0% + 2px)', width: 'max(0px, calc(43.5% - 2px))' }} />
              <span className="jline__leg" style={{ left: 'calc(46% + 2px)', width: 'calc(54% - 2px)' }} />
              <span className="jline__gap" style={{ left: '43.5%', width: '11.3%' }} />
              <span className="jline__stop jline__stop--passed jline__stop--first" style={{ left: '0%' }}><b lang="ja">発</b></span>
              <span className="jline__stop jline__stop--next" style={{ left: '46%' }}><b>N4</b></span>
            </span>
          </div>
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
          <button type="button" className="jour-act"><strong>Run 15 a day</strong>arrive 15 Feb 2027</button>
          <button type="button" className="jour-act"><strong>Reprint the pass</strong>arrive 23 Apr 2027</button>
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
    // The drawing costs 70px: the card's line (plan 174's ghost train,
    // drawn on the desk too) less the dates the card prints under its
    // stops, which the comparisons below print here.
    expect(screen.container.querySelector('.jour-track').getBoundingClientRect().height).toBe(70)
    // Each row: value and delta on one line, the promise under them.
    const rows = [...screen.container.querySelectorAll('.jour-cmp')].map(r => r.getBoundingClientRect())
    expect(rows[1].top).toBeGreaterThan(rows[0].bottom - 1)
    const v = screen.container.querySelector('.jour-cmp__v').getBoundingClientRect()
    const d = screen.container.querySelector('.jour-cmp__d').getBoundingClientRect()
    const sub = screen.container.querySelector('.jour-cmp__sub').getBoundingClientRect()
    expect(d.top).toBeCloseTo(v.top, 0)
    expect(d.left).toBeGreaterThan(v.right)
    expect(sub.top).toBeGreaterThan(v.bottom - 1)
    // The two moves are ONE choice with two answers, so they stand side
    // by side and split the row — a choice stacked in a column reads as
    // a list of suggestions to work through. Still thumb-sized at 390px,
    // which is the width that decides whether the pair fits at all.
    const acts = [...screen.container.querySelectorAll('.jour-act')].map(a => a.getBoundingClientRect())
    expect(acts).toHaveLength(2)
    expect(acts[1].top).toBeCloseTo(acts[0].top, 0)
    expect(acts[1].left).toBeGreaterThan(acts[0].right)
    expect(acts[0].width).toBeCloseTo(acts[1].width, 0)
    for (const act of acts) {
      expect(act.height).toBeGreaterThanOrEqual(44)
    }
  })
})

describe('the settings at phone width', () => {
  it('the list rows are 60px targets divided by hairlines; the services three across, the stops five, the destinations upright', async () => {
    const screen = await render(
      <main className="settings">
        <div className="bar" style={{ '--line-color': 'var(--pass-ink)' }}><div className="bar__row"><span className="bar__roundel" aria-hidden="true">SG</span><span className="bar__names"><h1 className="bar__title">Settings</h1></span><span className="bar__aside"><button type="button" className="stage__leave">‹ Profile</button></span></div><div className="bar__stripe" aria-hidden="true" /></div>
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
          <span className="slip__hint">One line.</span>
          <button type="button" className="btn-secondary slip__act">Export</button>
        </div>
        <div className="slip">
          <button type="button" className="btn-secondary btn-secondary--danger slip__act">Delete</button>
        </div>
        <div className="slip">
          <div className="dest-stops">
            <div className="dest-here dest-here--leaving"><span className="dest__dot" /><span className="dest__names"><span className="dest__code">N4</span><span className="dest__load">Elementary</span></span><span className="dest__when dest__when--here">You are here</span></div>
            <div className="dest-grid">
              {['N3', 'N2', 'N1'].map(l => <button key={l} type="button" className={`dest${l === 'N3' ? ' dest--on dest--ridden' : ''}`}><span className="dest__dot" /><span className="dest__names"><span className="dest__code">{l}</span><span className="dest__load">Intermediate</span></span><span className="dest__when">12 Mar 2027</span></button>)}
            </div>
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
    // The rail runs through the centre of every dot, the current one
    // included: it is ringed, not enlarged, so its centre never moves.
    const on = screen.container.querySelector('.lvlstrip__stop--on .lvlstrip__dot').getBoundingClientRect()
    const off = screen.container.querySelector('.lvlstrip__stop:not(.lvlstrip__stop--on) .lvlstrip__dot').getBoundingClientRect()
    const cy = r => r.top + r.height / 2
    expect(Math.abs(cy(on) - cy(off))).toBeLessThan(1)
    const strip = screen.container.querySelector('.lvlstrip')
    const rail = getComputedStyle(strip, '::before')
    const railCy = strip.getBoundingClientRect().top + parseFloat(rail.top) + parseFloat(rail.height) / 2
    expect(Math.abs(railCy - cy(off))).toBeLessThan(1)
    // Every action on a page is the same box, edge to edge.
    const acts = [...screen.container.querySelectorAll('.slip__act')].map(a => a.getBoundingClientRect())
    const slipW = screen.container.querySelector('.slip').getBoundingClientRect().width
    for (const a of acts) expect(Math.abs(a.width - slipW)).toBeLessThan(1)
    for (const stop of screen.container.querySelectorAll('.lvlstrip__stop')) {
      expect(stop.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
    }
    expect(columns(screen.container.querySelector('.svc-grid'))).toBe(3)
    for (const svc of screen.container.querySelectorAll('.svc')) {
      expect(svc.getBoundingClientRect().height).toBeGreaterThanOrEqual(44)
    }
    // The chosen service is the one with the gold on its edge.
    const onSvc = screen.container.querySelector('.svc--on')
    const offSvc = screen.container.querySelector('.svc-grid .svc:not(.svc--on)')
    expect(getComputedStyle(onSvc).borderTopColor).not.toBe(getComputedStyle(offSvc).borderTopColor)
    // The stops ahead stand upright (plan 139), a target each, and the
    // line runs through every dot: each row draws its own halves of it.
    const stops = [...screen.container.querySelectorAll('.dest-stops :is(.dest, .dest-here)')]
    for (const stop of stops) expect(stop.getBoundingClientRect().height).toBeGreaterThanOrEqual(52)
    for (let i = 1; i < stops.length; i++) expect(stops[i].getBoundingClientRect().top).toBeGreaterThan(stops[i - 1].getBoundingClientRect().top)
    const cx = r => r.left + r.width / 2
    for (const stop of stops) {
      const dot = stop.querySelector('.dest__dot').getBoundingClientRect()
      const half = getComputedStyle(stop, '::after')
      const railCx = stop.getBoundingClientRect().left + parseFloat(getComputedStyle(stop).borderLeftWidth) + parseFloat(half.left) + parseFloat(half.width) / 2
      expect(Math.abs(railCx - cx(dot))).toBeLessThan(1)
    }
    expect(columns(screen.container.querySelector('.hour-grid'))).toBe(4)
  })
})
