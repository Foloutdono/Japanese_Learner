import { describe, it, expect } from 'vitest'
import { render } from 'vitest-browser-react'
// Stylesheet contracts for the practice sessions and the exam at 390px
// (plan 072), on fixture markup — the same trick as stage.phone.test.jsx.
// The objects the canvas draws for Reading, Comprehension, Translation
// and the mock exam, pinned by their real classes.
import './index.css'

describe('the practice sessions at phone width', () => {
  it('the timer is a hairline over the sentence, the field and the action fill the foot', async () => {
    const screen = await render(
      <main className="container stage" style={{ '--line-color': 'var(--line-reading)' }}>
        <div className="timer">
          <div className="timer__bar"><span className="timer__fill" style={{ width: '62%' }} /></div>
          <span className="timer__label">12.3s</span>
        </div>
        <div className="prompt-card prompt-card--footed">
          <div className="prompt-card__body"><span className="sentence" lang="ja">雨が降りそうです。</span></div>
          <div className="prompt-card__foot"><span>N4 · JLPT</span><span /></div>
        </div>
        <form className="stage__foot">
          <input className="field" placeholder="romaji" />
          <button type="button" className="btn-primary">Submit</button>
        </form>
      </main>
    )
    const bar = screen.container.querySelector('.timer__bar')
    expect(getComputedStyle(bar).height).toBe('4px')
    const fill = screen.container.querySelector('.timer__fill')
    expect(fill.getBoundingClientRect().width).toBeCloseTo(bar.getBoundingClientRect().width * 0.62, 0)
    expect(getComputedStyle(screen.container.querySelector('.sentence')).textAlign).toBe('center')

    const foot = screen.container.querySelector('.stage__foot')
    expect(getComputedStyle(foot).flexDirection).toBe('column')
    const field = screen.container.querySelector('.field')
    expect(parseFloat(getComputedStyle(field).minHeight)).toBe(44)
    // The foot is a dock now — edge to edge of the stage, with the
    // page's own gutter given back inside it, so the action never sits
    // flush against the bottom of the screen (layout.phone.test.jsx
    // holds that end of it). So the row to fill is the foot's content
    // column, which is the card's own width.
    const card = screen.container.querySelector('.prompt-card').getBoundingClientRect()
    expect(foot.getBoundingClientRect().width).toBeCloseTo(screen.container.querySelector('.stage').getBoundingClientRect().width, 0)
    expect(field.getBoundingClientRect().width).toBeCloseTo(card.width, 0)
    expect(screen.container.querySelector('.btn-primary').getBoundingClientRect().width).toBeCloseTo(card.width, 0)
  })

  it("the run's entry is a slip on the page, at the answer rung", async () => {
    const screen = await render(
      <main className="container stage" style={{ '--line-color': 'var(--line-reading)' }}>
        <form className="stage__foot">
          <input className="field field--page" placeholder="romaji" />
          <button type="button" className="btn-primary">Submit</button>
        </form>
      </main>
    )
    const field = screen.container.querySelector('.field')
    const style = getComputedStyle(field)
    const page = getComputedStyle(document.documentElement).getPropertyValue('--bg-main').trim()

    // The whole point: this field sits ON the page, so a well painted in
    // the page's own ground is no field at all — which is exactly what
    // it was, in both themes and at every width. Whatever the well is,
    // it must not be the thing behind it. fields.browser.test.jsx holds
    // that for every mount in the app; this is the run's own copy, at
    // the width the entry was drawn for.
    const paint = (c) => { const d = document.createElement('div'); d.style.color = c; document.body.appendChild(d); const v = getComputedStyle(d).color; d.remove(); return v }
    expect(style.backgroundColor).not.toBe(paint(page))

    // The entry asks for the answer rung (--fs-lead, .stage__foot
    // .field). At phone width the field's own 16px floor takes it
    // first — that rule is 0-3-1 and no class rule reaches it, which is
    // the ruling and not an accident — so what is pinned here is that
    // the entry is still above the 15.2px base, never below the
    // threshold the floor exists to hold.
    expect(parseFloat(style.fontSize)).toBe(16)

    // Left-flush: a caret that walks back to the middle on every
    // keystroke is a worse instrument than a still one.
    expect(['start', 'left']).toContain(style.textAlign)
  })

  it('the page card reads top-down and left-aligned; a question card is flat', async () => {
    const screen = await render(
      <main className="container stage">
        <div className="prompt-card prompt-card--footed">
          <div className="prompt-card__body prompt-card__body--prose prose">
            <span className="prose__label">EN</span>
            <span className="prose__en prose__en--lead">I think it will rain tomorrow.</span>
            <span className="prose__rule" />
            <span className="prose__jp" lang="ja">明日は雨が降ると思う。</span>
          </div>
          <div className="prompt-card__foot"><span>N3</span><span /></div>
        </div>
        <div className="prompt-card prompt-card--ask">
          <span className="type-badge type-badge--comprehension">Detail</span>
          <span className="sentence sentence--left" lang="ja">男の人はどうして駅に行きましたか。</span>
        </div>
      </main>
    )
    const body = screen.container.querySelector('.prompt-card__body--prose')
    expect(getComputedStyle(body).justifyContent).toBe('flex-start')
    expect(getComputedStyle(body).alignItems).toBe('stretch')
    expect(getComputedStyle(screen.container.querySelector('.prose__en')).textAlign).toBe('left')
    expect(getComputedStyle(screen.container.querySelector('.prose__rule')).height).toBe('1px')
    const ask = screen.container.querySelector('.prompt-card--ask')
    expect(getComputedStyle(ask).textAlign).toBe('left')
    expect(getComputedStyle(ask).flexGrow).toBe('0')
    // The badge keeps its own width in the flat card's column.
    const badge = screen.container.querySelector('.type-badge')
    expect(badge.getBoundingClientRect().width).toBeLessThan(ask.getBoundingClientRect().width / 2)
    expect(badge.getBoundingClientRect().height).toBe(20)
  })

  it('the choices: lettered roundels, the picked row filled; the result is a lattice and 44px rows', async () => {
    const screen = await render(
      <main className="container stage" style={{ '--line-color': 'var(--line-rikai)' }}>
        <div className="mcq-list">
          <button type="button" className="mcq-row"><span className="mcq-row__accent" /><span className="mcq-row__index">A</span><span className="mcq-row__text mcq-row__text--latin">To meet a friend</span></button>
          <button type="button" className="mcq-row mcq-row--selected"><span className="mcq-row__accent" /><span className="mcq-row__index">B</span><span className="mcq-row__text mcq-row__text--latin">To buy a ticket</span></button>
        </div>
        <div className="result-lattice">
          <div className="record"><span className="record__value">4<span className="record__unit">/ 6</span></span><span className="record__label">Score</span></div>
          <div className="record"><span className="record__value">67<span className="record__unit">%</span></span><span className="record__label">Accuracy</span></div>
        </div>
        <div className="surface qrows">
          <div className="qrow-item"><button type="button" className="qrow"><span className="qrow__q">Q1</span></button></div>
          <div className="qrow-item"><button type="button" className="qrow"><span className="qrow__q">Q2</span><span className="qrow__note">You · A — correct · C</span></button></div>
        </div>
        <div className="stage__foot btn-row">
          <button type="button" className="btn-secondary">Re-read the text</button>
          <button type="button" className="btn-primary">Next</button>
        </div>
      </main>
    )
    const [a, b] = screen.container.querySelectorAll('.mcq-row__index')
    expect(getComputedStyle(a).borderRadius).toBe('50%')
    expect(getComputedStyle(a).backgroundColor).not.toBe(getComputedStyle(b).backgroundColor)
    expect(getComputedStyle(b).backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
    expect(getComputedStyle(screen.container.querySelector('.result-lattice')).gridTemplateColumns.split(' ')).toHaveLength(2)
    const [q1, q2] = screen.container.querySelectorAll('.qrow')
    expect(parseFloat(getComputedStyle(q1).minHeight)).toBe(44)
    expect(getComputedStyle(q2.parentElement).borderTopWidth).toBe('1px')
    // Two actions side by side, each half the foot.
    const [left, right] = screen.container.querySelectorAll('.btn-row > *')
    expect(left.getBoundingClientRect().width).toBeCloseTo(right.getBoundingClientRect().width, 0)
    expect(left.getBoundingClientRect().top).toBeCloseTo(right.getBoundingClientRect().top, 0)
  })
})

describe('the mock exam at phone width', () => {
  it('the meta row, the way through the paper, and the sheet bar docked on the dock edge', async () => {
    const screen = await render(
      <div>
        <main className="container stage" style={{ '--line-color': 'var(--line-exam)' }}>
          <div className="exam-meta">
            <button type="button" className="stage__leave">Exam</button>
            <span className="exam-meta__section"><h1 className="exam-meta__jp">N4 · Vocabulary</h1></span>
            <span className="exam-timer">24:18</span>
          </div>
          <button type="button" className="exam-mondai"><span><b className="exam-mondai__part">Part 3</b> · Show instructions</span></button>
          <div className="exam-nav">
            <button type="button" className="btn-secondary">Previous</button>
            <button type="button" className="exam-flag exam-flag--on">f</button>
            <button type="button" className="btn-primary">Next</button>
          </div>
          <div className="exam-sheetbar">
            <button type="button" className="exam-sheetbar__open">
              <span className="exam-sheetbar__label"><b className="exam-sheetbar__fig">7 / 21</b><span className="exam-sheetbar__cap">Answer sheet</span></span>
              <span className="exam-sheetbar__chips">
                <i className="exam-sheetbar__chip exam-sheetbar__chip--done" /><i className="exam-sheetbar__chip exam-sheetbar__chip--flag" /><i className="exam-sheetbar__chip" />
              </span>
            </button>
            <button type="button" className="exam-finish">Finish</button>
          </div>
        </main>
        <div className="sumi-probe" style={{ background: 'var(--bg-panel)' }} />
      </div>
    )
    const stage = screen.container.querySelector('.stage')
    const flag = screen.container.querySelector('.exam-flag')
    expect(flag.getBoundingClientRect().width).toBe(44)
    expect(flag.getBoundingClientRect().height).toBe(44)
    expect(getComputedStyle(screen.container.querySelector('.exam-nav')).gridTemplateColumns.split(' ')).toHaveLength(3)
    expect(parseFloat(getComputedStyle(screen.container.querySelector('.exam-mondai')).minHeight)).toBe(40)

    const bar = screen.container.querySelector('.exam-sheetbar')
    expect(getComputedStyle(bar).position).toBe('sticky')
    expect(getComputedStyle(bar).bottom).toBe('0px')
    // Sumi, edge to edge: the bar's ground is the panel's, and it runs
    // out to the stage's own edges past the padding.
    expect(getComputedStyle(bar).backgroundColor).toBe(getComputedStyle(screen.container.querySelector('.sumi-probe')).backgroundColor)
    expect(bar.getBoundingClientRect().left).toBeCloseTo(stage.getBoundingClientRect().left, 0)
    expect(bar.getBoundingClientRect().right).toBeCloseTo(stage.getBoundingClientRect().right, 0)
    const [done, flagged, blank] = screen.container.querySelectorAll('.exam-sheetbar__chip')
    expect(getComputedStyle(done).backgroundColor).not.toBe(getComputedStyle(blank).backgroundColor)
    expect(getComputedStyle(flagged).backgroundColor).not.toBe(getComputedStyle(done).backgroundColor)
    expect(getComputedStyle(done).width).toBe('8px')
  })

  it('the result: the ring is the canvas box, the review rows are 44px', async () => {
    const screen = await render(
      <main className="practice" style={{ '--line-color': 'var(--line-exam)' }}>
        <div className="exam-result-head">
          <div className="exam-score-ring">
            <svg className="exam-score-ring__svg" viewBox="0 0 108 108"><circle className="exam-score-ring__track" cx="54" cy="54" r="46" /><circle className="exam-score-ring__fill" cx="54" cy="54" r="46" /></svg>
            <span className="exam-score-ring__pct">81%</span>
          </div>
          <div className="exam-result-figs"><b className="exam-result-figs__score">17 / 21</b><span className="exam-result-figs__cap">correct</span></div>
        </div>
        <div className="surface exam-review">
          <div className="exam-review__part">
            <div className="exam-group"><b className="exam-group__part">Part 1</b><span className="exam-group__score">6 / 6</span></div>
            <button type="button" className="exam-review-row"><span className="exam-review-row__mark exam-review-row__mark--x" /><span className="exam-review-row__q">Q9</span><span className="exam-review-row__jp" lang="ja">この本はとても＿＿＿です。</span></button>
          </div>
        </div>
      </main>
    )
    const ring = screen.container.querySelector('.exam-score-ring')
    expect(getComputedStyle(ring).width).toBe('108px')
    expect(getComputedStyle(ring).height).toBe('108px')
    expect(getComputedStyle(screen.container.querySelector('.exam-score-ring__pct')).position).toBe('absolute')
    const row = screen.container.querySelector('.exam-review-row')
    expect(parseFloat(getComputedStyle(row).minHeight)).toBe(44)
    expect(getComputedStyle(row).borderTopWidth).toBe('1px')
    expect(getComputedStyle(screen.container.querySelector('.exam-review-row__mark')).borderRadius).toBe('999px')
  })
})
