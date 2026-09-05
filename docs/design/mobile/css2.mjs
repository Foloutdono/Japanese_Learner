// Furniture for the second wave of screens: the other card faces, the
// level board, the practice sessions, the exam, decks, stats, settings,
// the ticket office, sign-in, the dictionary entry, the analyzer's stage.
export const CSS2 = String.raw`
/* ── the other card faces ── */
.flashcard { display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); }
.flashcard-answer { font-family: var(--font-display); font-size: 2rem; font-weight: 700; line-height: 1.1; color: var(--accent); }
.flashcard-reading { font-family: var(--font-jp); font-size: var(--fs-lead); letter-spacing: var(--tr-reading); text-indent: var(--tr-reading); color: var(--text-secondary); }
.reveal-actions { position: absolute; top: var(--sp-3); left: var(--sp-3); display: flex; gap: var(--sp-2); }
.reveal-actions button { display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: var(--r-pill); border: 1px solid var(--border); color: var(--text-secondary); padding: 0; }
.reveal-actions .svg { width: 15px; height: 15px; }
.draw-prompt { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.draw-prompt__meaning { font-family: var(--font-serif); font-weight: 700; font-size: var(--fs-heading); line-height: 1.15; }
.draw-prompt__hint { font-family: var(--font-jp); font-size: var(--fs-sm); color: var(--text-secondary); letter-spacing: var(--tr-term); }
.canvas-wrap { position: relative; width: 100%; max-width: 300px; aspect-ratio: 1; margin: 0 auto; border-radius: var(--r-card); border: 1px solid var(--border); background: #201d24; overflow: hidden; }
.canvas-wrap::before { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, transparent calc(50% - 0.5px), rgba(255,255,255,0.08) calc(50% - 0.5px), rgba(255,255,255,0.08) calc(50% + 0.5px), transparent calc(50% + 0.5px)), linear-gradient(0deg, transparent calc(50% - 0.5px), rgba(255,255,255,0.08) calc(50% - 0.5px), rgba(255,255,255,0.08) calc(50% + 0.5px), transparent calc(50% + 0.5px)); }
.canvas-wrap svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.canvas-label { display: flex; align-items: center; justify-content: space-between; width: 100%; max-width: 300px; margin: 0 auto; }
.canvas-clear-btn { display: inline-flex; align-items: center; gap: var(--sp-2); height: 36px; padding: 0 var(--sp-4); border-radius: var(--r-pill); border: 1px solid var(--surface-line); color: var(--text-secondary); font-family: var(--font-display); font-size: var(--fs-caption); font-weight: 600; }
.readings-input { display: flex; flex-direction: column; gap: var(--sp-4); width: 100%; text-align: left; }
.readings-input__label { display: flex; align-items: baseline; gap: var(--sp-2); }
.readings-input__label b { font-family: var(--font-jp); font-weight: 700; font-size: var(--fs-sm); }
.readings-input__label span { font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-secondary); }
.readings-input__row { display: flex; flex-direction: column; gap: var(--sp-2); }
.field { display: flex; align-items: center; width: 100%; min-height: 44px; padding: var(--sp-3) var(--sp-4); border-radius: var(--r-card); background: var(--bg-main); border: 1px solid var(--surface-line); color: var(--text-secondary); font-size: var(--fs-body); text-align: left; }
.field--filled { color: var(--text-primary); font-family: var(--font-jp); font-weight: 600; }
.field--focus { border-color: var(--accent); }
.readings-input__add { align-self: flex-start; display: inline-flex; align-items: center; gap: var(--sp-2); height: 36px; padding: 0 var(--sp-3); color: var(--text-secondary); font-family: var(--font-display); font-size: var(--fs-caption); font-weight: 600; }
.readings-input__add .svg { width: 13px; height: 13px; }
.stage__foot { flex: none; display: flex; flex-direction: column; gap: var(--sp-3); padding-bottom: calc(var(--sp-3) + var(--safe-bottom)); }

/* ── 進級 — the level board docked across the top ── */
.levelup { flex: none; display: flex; justify-content: center; padding-top: var(--safe-top); background: var(--bg-panel); }
.levelup__board { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-5); width: 100%; height: 68px; padding-inline: var(--sp-6); background: var(--bg-panel); color: var(--text-on-panel); border-bottom: 3px solid var(--accent2); box-shadow: var(--elev-hang); }
.levelup__mark { display: flex; flex-direction: column; gap: var(--sp-1); min-width: 0; }
.levelup__jp { font-family: var(--font-jp); font-weight: 700; font-size: var(--fs-lead); letter-spacing: var(--tr-name); line-height: 1; color: var(--accent2); }
.levelup__latin, .levelup__unit { font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; white-space: nowrap; color: var(--text-on-panel-soft); }
.levelup__flaps { display: flex; flex-direction: column; align-items: center; gap: var(--sp-1); flex-shrink: 0; }
.split-flap { display: flex; gap: 3px; }
.flap { position: relative; display: flex; align-items: center; justify-content: center; width: 30px; height: 40px; border-radius: var(--r-plate); background: color-mix(in srgb, #000 30%, var(--bg-panel)); border: 1px solid rgba(255,255,255,0.1); font-family: var(--font-display); font-weight: 700; font-size: var(--fs-display); line-height: 1; color: var(--text-on-panel); font-variant-numeric: tabular-nums; }
.flap::after { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: 1px; background: rgba(0,0,0,0.6); }
.card-stamp__rakkan { position: absolute; right: var(--sp-6); bottom: calc(var(--sp-8) + var(--sp-4)); display: flex; align-items: center; justify-content: center; width: 1.3em; height: 1.3em; font-family: var(--font-jp); font-weight: 700; font-size: var(--fs-specimen-glyph); line-height: 1; color: var(--stamp-ink); border: 0.06em solid var(--stamp-ink); border-radius: var(--r-card); opacity: 0.18; transform: rotate(-8deg); pointer-events: none; }
.card-stamp__ripple { position: absolute; inset: 0; border-radius: inherit; box-shadow: inset 0 0 0 2px var(--stamp-ink); opacity: 0.35; pointer-events: none; }
.rating-bar--fading { opacity: 0.55; }

/* ── the practice sessions ── */
.timer { display: flex; flex-direction: column; gap: var(--sp-2); }
.timer__bar { height: 4px; border-radius: var(--r-pill); background: var(--surface-line); overflow: hidden; }
.timer__fill { display: block; height: 100%; background: var(--warning); }
.timer__label { font-family: var(--font-display); font-size: var(--fs-caption); font-weight: 700; font-variant-numeric: tabular-nums; color: var(--text-secondary); text-align: center; }
.sentence { font-family: var(--font-jp); font-size: 1.5rem; font-weight: 500; line-height: 1.7; letter-spacing: var(--tr-term); text-align: center; }
.sentence--left { text-align: left; }
.prose { display: flex; flex-direction: column; gap: var(--sp-3); width: 100%; text-align: left; }
.prose__label { font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-secondary); }
.prose__en { font-family: var(--font-display); font-size: var(--fs-lead); font-weight: 500; line-height: 1.5; }
.prose__jp { font-family: var(--font-jp); font-size: var(--fs-lead); font-weight: 600; line-height: 1.6; }
.prose__romaji { font-family: var(--font-display); font-size: var(--fs-sm); color: var(--text-secondary); }
.prose__ai { font-size: var(--fs-sm); line-height: 1.55; color: var(--text-secondary); }
.prose__rule { height: 1px; background: var(--border); }
.type-badge { display: inline-flex; align-items: center; height: 20px; padding: 0 8px; border-radius: var(--r-plate); border: 1px solid var(--surface-line); font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-secondary); }
.mcq-row--selected { --mcq-color: var(--line-color, var(--accent)); background: color-mix(in srgb, var(--mcq-color) 9%, var(--bg-card)); border-color: var(--mcq-color); }
.mcq-row--selected .mcq-row__accent { transform: scaleX(1); }
.mcq-row--selected .mcq-row__index { background: var(--mcq-color); border-color: var(--mcq-color); color: var(--bg-main); }
.mcq-row__text--jp { font-size: 16px; }

/* ── 模試 — the exam runner and its result ── */
.exam-meta { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-4); }
.exam-meta__section { display: flex; align-items: baseline; gap: var(--sp-2); }
.exam-meta__jp { font-family: var(--font-display); font-weight: 700; font-size: var(--fs-body); }
.exam-timer { display: inline-flex; align-items: center; font-family: var(--font-display); font-weight: 700; font-size: var(--fs-lead); font-variant-numeric: tabular-nums; }
.exam-timer--low { color: var(--danger); }
.exam-mondai { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); min-height: 40px; padding: 0 var(--sp-4); background: var(--surface); border: 1px solid var(--surface-line); border-radius: var(--r-card); color: var(--text-secondary); font-size: var(--fs-caption); }
.exam-mondai b { font-family: var(--font-display); font-weight: 700; font-size: var(--fs-sm); color: var(--text-primary); }
.exam-underline { text-decoration: underline; text-underline-offset: 4px; text-decoration-thickness: 2px; text-decoration-color: var(--accent); }
.exam-nav { display: grid; grid-template-columns: 1fr 44px 1fr; gap: var(--sp-3); }
.exam-nav .btn-secondary, .exam-nav .btn-primary { min-height: 44px; padding-inline: var(--sp-4); font-size: var(--fs-sm); }
.exam-flag { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: var(--r-panel); border: 1px solid var(--surface-line); color: var(--text-secondary); padding: 0; }
.exam-flag--on { color: var(--warning); border-color: color-mix(in srgb, var(--warning) 55%, transparent); }
.exam-sheetbar { flex: none; display: flex; align-items: center; justify-content: space-between; gap: var(--sp-4); margin-inline: calc(-1 * var(--sp-5)); padding: var(--sp-3) var(--sp-5) calc(var(--sp-3) + var(--safe-bottom)); background: var(--bg-panel); color: var(--text-on-panel); }
.exam-sheetbar__chips { display: grid; grid-template-columns: repeat(11, 8px); gap: 3px; }
.exam-sheetbar__chip { width: 8px; height: 8px; border-radius: 2px; background: rgba(255,255,255,0.14); }
.exam-sheetbar__chip--done { background: var(--text-on-panel-soft); }
.exam-sheetbar__chip--flag { background: var(--warning); }
.exam-sheetbar__label { display: flex; flex-direction: column; gap: 1px; }
.exam-sheetbar__label b { font-family: var(--font-display); font-size: var(--fs-sm); font-weight: 700; font-variant-numeric: tabular-nums; }
.exam-sheetbar__label span { font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-on-panel-soft); white-space: nowrap; }
.exam-finish { display: inline-flex; align-items: center; height: 40px; padding: 0 var(--sp-4); border-radius: var(--r-card); border: 1px solid rgba(255,255,255,0.18); color: var(--text-on-panel); font-family: var(--font-display); font-size: var(--fs-sm); font-weight: 700; }
.exam-result-head { display: flex; align-items: center; gap: var(--sp-5); padding: var(--sp-4) 0; }
.exam-score-ring { position: relative; width: 108px; height: 108px; flex: none; }
.exam-score-ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.exam-score-ring__track { fill: none; stroke: var(--surface-line); stroke-width: 8; }
.exam-score-ring__fill { fill: none; stroke: var(--success); stroke-width: 8; stroke-linecap: round; }
.exam-score-ring__tick { stroke: var(--text-secondary); stroke-width: 2; }
.exam-score-ring__pct { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-family: var(--font-display); font-weight: 700; font-size: var(--fs-heading); font-variant-numeric: tabular-nums; }
.exam-result-figs { display: flex; flex-direction: column; gap: var(--sp-2); }
.exam-result-figs b { font-family: var(--font-display); font-weight: 700; font-size: var(--fs-title); font-variant-numeric: tabular-nums; line-height: 1; }
.exam-result-figs span { font-size: var(--fs-caption); color: var(--text-secondary); }
.exam-group { display: flex; align-items: baseline; justify-content: space-between; padding: var(--sp-3) var(--sp-4) var(--sp-2); }
.exam-group b { font-family: var(--font-display); font-weight: 700; font-size: var(--fs-sm); }
.exam-group span { font-family: var(--font-display); font-size: var(--fs-sm); font-weight: 700; font-variant-numeric: tabular-nums; color: var(--text-secondary); }
.exam-review-row { display: flex; align-items: center; gap: var(--sp-4); min-height: 44px; padding: 0 var(--sp-4); border-top: 1px solid var(--surface-line); text-align: left; color: var(--text-primary); }
.exam-review-row__mark { width: 18px; height: 18px; border-radius: var(--r-pill); display: inline-flex; align-items: center; justify-content: center; flex: none; }
.exam-review-row__mark--ok { background: color-mix(in srgb, var(--success) 20%, transparent); color: var(--success); }
.exam-review-row__mark--x { background: color-mix(in srgb, var(--danger) 25%, transparent); color: color-mix(in srgb, var(--danger) 60%, var(--text-primary)); }
.exam-review-row__mark .svg { width: 11px; height: 11px; stroke-width: 3; }
.exam-review-row__q { font-family: var(--font-display); font-weight: 700; font-size: var(--fs-sm); font-variant-numeric: tabular-nums; width: 30px; }
.exam-review-row__jp { flex: 1; min-width: 0; font-family: var(--font-jp); font-size: var(--fs-sm); color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.exam-review-row__blank { flex: 1; font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-secondary); }

/* ── 教材 — decks ── */
.deck-identity { display: flex; align-items: center; gap: var(--sp-4); }
.deck-identity__names { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.deck-identity__name { font-family: var(--font-serif); font-weight: 700; font-size: var(--fs-title); line-height: 1.2; }
.deck-identity__meta { font-size: var(--fs-caption); color: var(--text-secondary); }
.chip-row { display: flex; flex-wrap: wrap; gap: var(--sp-2); }
.chip-row .chip { text-transform: none; letter-spacing: 0.02em; font-size: var(--fs-sm); font-weight: 600; color: var(--text-primary); height: 34px; padding: 0 10px; }
.chip-row .chip .svg { width: 14px; height: 14px; color: var(--text-secondary); }
.card-list { display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--surface-line); border-radius: var(--r-card); overflow: hidden; }
.card-row { display: flex; align-items: center; gap: var(--sp-4); min-height: 56px; padding: var(--sp-3) var(--sp-4); border-top: 1px solid var(--surface-line); text-align: left; color: var(--text-primary); }
.card-row:first-child { border-top: 0; }
.card-row__front { display: flex; flex-direction: column; min-width: 0; width: 96px; flex: none; }
.card-row__jp { font-family: var(--font-jp); font-weight: 700; font-size: var(--fs-lead); line-height: 1.2; }
.card-row__kana { font-family: var(--font-jp); font-size: var(--fs-caption); color: var(--text-secondary); letter-spacing: var(--tr-term); }
.card-row__back { flex: 1; min-width: 0; font-size: var(--fs-sm); color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.deck-card__count { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; }
.deck-card__count b { font-family: var(--font-display); font-weight: 700; font-size: var(--fs-title); line-height: 1; font-variant-numeric: tabular-nums; }
.deck-card__count span { font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-secondary); }

/* ── 統計 — statistics ── */
.section-header { display: flex; align-items: baseline; flex-wrap: wrap; gap: 6px 14px; }
.section-header__mark { display: flex; align-items: baseline; gap: 12px; min-width: 0; }
.section-header__jp { font-family: var(--font-serif); font-weight: 700; font-size: var(--fs-lead); line-height: 1.1; color: var(--text-primary); }
.section-header__title { font-family: var(--font-display); font-size: 0.62rem; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: var(--text-secondary); }
.section-header__count { margin-left: auto; font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-secondary); }
.section-header__rule { flex-basis: 100%; width: 100%; height: 1px; margin-top: 4px; background: linear-gradient(90deg, var(--line-color, var(--accent)) 0 40px, var(--surface-line) 40px); }
.headline { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; background: var(--surface-line); border: 1px solid var(--surface-line); border-radius: var(--r-card); overflow: hidden; }
.plaque { display: flex; flex-direction: column; gap: var(--sp-1); padding: var(--sp-4) var(--sp-4); background: var(--surface); }
.plaque__v { display: flex; align-items: baseline; gap: var(--sp-2); font-family: var(--font-display); font-weight: 700; font-size: var(--fs-heading); line-height: 1; font-variant-numeric: tabular-nums; }
.plaque__u { font-size: var(--fs-sm); font-weight: 600; color: var(--text-secondary); }
.plaque__l { font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-secondary); }
.plaque__note { font-size: var(--fs-caption); color: var(--text-secondary); }
.cal { display: flex; flex-direction: column; gap: var(--sp-2); padding: var(--sp-4); background: var(--surface); border: 1px solid var(--surface-line); border-radius: var(--r-card); overflow: hidden; }
.cal__months { display: grid; grid-template-columns: repeat(14, minmax(0, 1fr)); gap: 3px; font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-secondary); }
.cal__grid { display: grid; grid-template-columns: repeat(14, minmax(0, 1fr)); grid-template-rows: repeat(7, 1fr); grid-auto-flow: column; gap: 3px; }
.cal__cell { aspect-ratio: 1; border-radius: 2px; background: color-mix(in srgb, var(--text-primary) 6%, transparent); }
.cal__cell--1 { background: color-mix(in srgb, var(--stamp-ink) 25%, transparent); }
.cal__cell--2 { background: color-mix(in srgb, var(--stamp-ink) 50%, transparent); }
.cal__cell--3 { background: color-mix(in srgb, var(--stamp-ink) 75%, transparent); }
.cal__cell--4 { background: var(--stamp-ink); }
.cal__foot { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); font-size: var(--fs-caption); color: var(--text-secondary); }
.cal__scale { display: inline-flex; align-items: center; gap: 3px; }
.cal__scale .cal__cell { width: 9px; height: 9px; aspect-ratio: auto; }
.forecast { display: flex; flex-direction: column; gap: var(--sp-3); padding: var(--sp-4); background: var(--surface); border: 1px solid var(--surface-line); border-radius: var(--r-card); }
.forecast__bars { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: var(--sp-2); align-items: end; height: 96px; }
.forecast__col { display: flex; flex-direction: column; align-items: center; justify-content: flex-end; gap: var(--sp-1); height: 100%; }
.forecast__bar { width: 100%; border-radius: var(--r-plate) var(--r-plate) 0 0; background: color-mix(in srgb, var(--state-due) 75%, var(--text-primary)); }
.forecast__v { font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; font-variant-numeric: tabular-nums; color: var(--text-secondary); }
.forecast__days { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: var(--sp-2); text-align: center; font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: var(--text-secondary); }
.forecast__legend { display: flex; gap: var(--sp-4); font-size: var(--fs-caption); color: var(--text-secondary); }
.forecast__legend b { color: var(--text-primary); font-variant-numeric: tabular-nums; }

/* ── 設定 — the pass's own preferences ── */
.stg-head { display: flex; flex-direction: column; gap: 2px; }
.stg-head__jp { font-family: var(--font-serif); font-weight: 700; font-size: var(--fs-title); line-height: 1.2; }
.stg-head__latin { font-family: var(--font-display); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.3em; text-transform: uppercase; color: var(--text-secondary); }
.stg-list { display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--surface-line); border-radius: var(--r-card); overflow: hidden; }
.stg-row { display: flex; align-items: center; gap: var(--sp-4); min-height: 60px; padding: var(--sp-3) var(--sp-4); border-top: 1px solid var(--surface-line); text-align: left; color: var(--text-primary); }
.stg-row:first-child { border-top: 0; }
.stg-row__names { display: flex; flex-direction: column; flex: 1; min-width: 0; }
.stg-row__jp { font-family: var(--font-display); font-weight: 700; font-size: var(--fs-body); line-height: 1.2; }
.stg-row__latin { font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-secondary); }
.stg-row__value { font-size: var(--fs-sm); color: var(--text-secondary); white-space: nowrap; }
.stg-row .svg { color: var(--text-secondary); }
.slip { display: flex; flex-direction: column; gap: var(--sp-3); }
.slip__label { display: flex; align-items: baseline; justify-content: space-between; gap: var(--sp-3); }
.slip__label b { font-family: var(--font-display); font-size: var(--fs-sm); font-weight: 700; }
.slip__hint { font-size: var(--fs-caption); color: var(--text-secondary); line-height: 1.5; }
.lvlstrip { position: relative; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); padding: var(--sp-3) 0 0; }
.lvlstrip::before { content: ''; position: absolute; left: 10%; right: 10%; top: 17px; height: 3px; border-radius: var(--r-pill); background: color-mix(in srgb, var(--pass-ink) 60%, var(--text-secondary)); }
.lvlstrip__stop { position: relative; display: flex; flex-direction: column; align-items: center; gap: var(--sp-2); padding: 0; color: var(--text-secondary); }
.lvlstrip__dot { width: 13px; height: 13px; border-radius: var(--r-pill); background: var(--bg-main); border: 2px solid var(--text-secondary); }
.lvlstrip__stop--on { color: var(--text-primary); }
.lvlstrip__stop--on .lvlstrip__dot { width: 17px; height: 17px; margin: -2px 0; background: var(--text-primary); border-color: var(--text-primary); }
.lvlstrip__code { font-family: var(--font-display); font-weight: 700; font-size: var(--fs-sm); }
.lvlstrip__jp { font-family: var(--font-display); font-size: var(--fs-caption-xs); letter-spacing: 0.06em; text-transform: uppercase; }
.svc-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--sp-3); }
.svc { display: flex; flex-direction: column; align-items: center; gap: 2px; min-height: 64px; padding: var(--sp-3) var(--sp-2); background: var(--surface); border: 1px solid var(--surface-line); border-radius: var(--r-card); color: var(--text-primary); }
.svc--on { border-color: var(--pass-ink); background: color-mix(in srgb, var(--pass-ink) 14%, var(--surface)); }
.svc__jp { font-family: var(--font-display); font-weight: 700; font-size: var(--fs-sm); }
.svc__pace { font-family: var(--font-display); font-size: var(--fs-caption); font-weight: 700; font-variant-numeric: tabular-nums; color: var(--text-secondary); }
.svc__star { color: var(--accent2); }
.grades { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--sp-3); }
.grades .svc__words { font-family: var(--font-display); font-size: var(--fs-caption-xs); color: var(--text-secondary); text-align: center; line-height: 1.4; }

/* ── みどりの窓口 — the ticket office ── */
.onb { display: flex; flex-direction: column; gap: var(--sp-5); padding: calc(var(--safe-top) + var(--sp-3)) var(--sp-5) var(--sp-5); flex: 1; min-height: 0; overflow: hidden; }
.onb-header { display: flex; align-items: flex-end; justify-content: space-between; gap: var(--sp-4); }
.onb-header__stack { display: flex; flex-direction: column; }
.onb-header__kana { font-family: var(--font-jp); font-size: 0.72rem; letter-spacing: var(--tr-reading); text-indent: var(--tr-reading); color: var(--text-secondary); }
.onb-header__name { font-family: var(--font-serif); font-weight: 700; font-size: var(--fs-title); letter-spacing: var(--tr-name); line-height: 1.2; }
.onb-header__latin { font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-secondary); }
.onb-line { display: flex; align-items: center; gap: var(--sp-2); }
.onb-line__stamp { width: 24px; height: 24px; border-radius: var(--r-pill); display: inline-flex; align-items: center; justify-content: center; font-family: var(--font-jp); font-size: var(--fs-caption-xs); font-weight: 700; border: 1.5px dashed color-mix(in srgb, var(--text-primary) 25%, transparent); color: var(--text-secondary); }
.onb-line__stamp--done { border: 1.5px solid color-mix(in srgb, var(--stamp-ink) 55%, transparent); color: color-mix(in srgb, var(--stamp-ink) 70%, var(--text-primary)); background: color-mix(in srgb, var(--stamp-ink) 12%, transparent); transform: rotate(-4deg); }
.onb-line__stamp--now { border: 2px solid var(--stamp-ink); color: var(--stamp-ink); background: color-mix(in srgb, var(--stamp-ink) 22%, transparent); }
.onb-line__rail { flex: 1; height: 2px; background: var(--surface-line); }
.onb-h2 { font-family: var(--font-serif); font-weight: 700; font-size: var(--fs-title); line-height: 1.35; }
.onb-lvl { display: flex; align-items: center; gap: var(--sp-4); min-height: 64px; padding: var(--sp-3) var(--sp-4); background: var(--surface); border: 1px solid var(--surface-line); border-radius: var(--r-card); text-align: left; color: var(--text-primary); }
.onb-lvl__code { display: inline-flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: var(--r-pill); border: 2.5px solid var(--pass-ink); font-family: var(--font-display); font-weight: 700; font-size: var(--fs-sm); flex: none; }
.onb-lvl__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.onb-lvl__sign { display: flex; align-items: baseline; gap: var(--sp-3); font-family: var(--font-serif); font-weight: 700; font-size: var(--fs-lead); }
.onb-lvl__load { font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-secondary); }
.onb-lvl__sample { font-family: var(--font-jp); font-size: var(--fs-sm); color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.onb-alt { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); min-height: 44px; padding: 0 var(--sp-4); border: 1px solid var(--surface-line); border-radius: var(--r-card); color: var(--text-primary); font-size: var(--fs-sm); font-weight: 600; text-align: left; }
.onb-alt span[lang="ja"] { color: var(--text-secondary); font-size: var(--fs-caption); }
.onb-dests { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--sp-2); }
.onb-dest { display: inline-flex; flex-direction: column; align-items: center; justify-content: center; gap: 1px; min-height: 48px; padding: var(--sp-2) var(--sp-2); border: 1px solid var(--surface-line); border-radius: var(--r-card); color: var(--text-primary); }
.onb-dest--on { border-color: var(--pass-ink); background: color-mix(in srgb, var(--pass-ink) 14%, var(--surface)); }
.onb-dest__code { font-family: var(--font-display); font-weight: 700; font-size: var(--fs-sm); }
.onb-dest__jp { font-family: var(--font-serif); font-weight: 700; font-size: var(--fs-body); }
.onb-dest__load { font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: 0.08em; color: var(--text-secondary); }
.onb-board { background: var(--bg-panel); color: var(--text-on-panel); border: 1px solid color-mix(in srgb, var(--accent2) 16%, transparent); border-radius: var(--r-panel); overflow: hidden; }
.onb-board__head { display: flex; align-items: baseline; justify-content: space-between; gap: var(--sp-3); padding: var(--sp-3) var(--sp-4); border-bottom: 3px solid var(--accent2); }
.onb-board__head b { font-family: var(--font-jp); font-weight: 700; letter-spacing: var(--tr-name); color: color-mix(in srgb, var(--accent2) 85%, var(--text-on-panel)); }
.onb-board__head span { font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-on-panel-soft); }
.onb-row { display: grid; grid-template-columns: 96px minmax(0, 1fr) auto; gap: var(--sp-3); align-items: center; width: 100%; min-height: 52px; padding: var(--sp-2) var(--sp-4); border-top: 1px solid rgba(255,255,255,0.08); color: inherit; text-align: left; }
.onb-row--on { background: rgba(255,255,255,0.06); }
.onb-row__svc { display: flex; flex-direction: column; }
.onb-row__jp { font-family: var(--font-jp); font-weight: 700; font-size: var(--fs-sm); }
.onb-row__en { font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.55; }
.onb-row__pattern { display: flex; align-items: center; gap: 0; }
.onb-row__pattern i { width: 7px; height: 7px; border-radius: var(--r-pill); background: var(--bg-panel); border: 1.5px solid color-mix(in srgb, var(--text-on-panel) 55%, transparent); flex: none; }
.onb-row__pattern i.on { background: var(--accent2); border-color: var(--accent2); }
.onb-row__pattern b { flex: 1; height: 2px; background: color-mix(in srgb, var(--text-on-panel) 30%, transparent); }
.onb-row__figs { display: flex; flex-direction: column; align-items: flex-end; font-family: var(--font-display); font-variant-numeric: tabular-nums; }
.onb-row__pace { font-weight: 700; font-size: var(--fs-sm); }
.onb-row__arrive { font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-on-panel-soft); }
.onb-row__star { color: var(--accent2); }
.onb-action { display: inline-flex; align-items: center; justify-content: center; width: 100%; min-height: 48px; border-radius: var(--r-panel); background: color-mix(in srgb, var(--accent) 70%, var(--bg-panel)); color: var(--text-on-panel); font-weight: 700; font-size: var(--fs-body); }
.onb-honest { font-size: var(--fs-sm); line-height: 1.55; color: var(--text-secondary); }
.onb-honest b { color: var(--text-primary); }

/* ── sign-in ── */
.auth { flex: 1; display: flex; flex-direction: column; justify-content: center; gap: var(--sp-6); padding: var(--safe-top) var(--sp-6) var(--safe-bottom); }
.auth-header { display: flex; flex-direction: column; align-items: center; gap: var(--sp-2); }
.auth-header__glyph { font-family: var(--font-serif); font-weight: 700; font-size: var(--fs-display); letter-spacing: var(--tr-name); text-indent: var(--tr-name); line-height: 1.1; }
.auth-header__title { font-family: var(--font-display); font-size: var(--fs-caption); font-weight: 700; letter-spacing: 0.3em; text-indent: 0.3em; text-transform: uppercase; color: var(--text-secondary); }
.auth-card { display: flex; flex-direction: column; gap: var(--sp-4); padding: var(--sp-6); background: var(--surface); border: 1px solid var(--surface-line); border-radius: var(--r-panel); }
.auth-submit { display: inline-flex; align-items: center; justify-content: center; width: 100%; min-height: 48px; border-radius: var(--r-panel); background: color-mix(in srgb, var(--accent) 70%, var(--bg-panel)); color: var(--text-on-panel); font-weight: 700; font-size: var(--fs-body); }
.auth-foot { text-align: center; font-size: var(--fs-caption); color: var(--text-secondary); }

/* ── the dictionary entry ── */
.dd { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: var(--sp-5); padding: 0 var(--sp-5); overflow: hidden; }
.dd-plate { position: relative; display: flex; gap: var(--sp-4); padding: var(--sp-5) var(--sp-5) var(--sp-5) 0; margin-inline: calc(-1 * var(--sp-5)); padding-left: var(--sp-5); background: var(--bg-panel); color: var(--text-on-panel); }
.dd-tategaki { display: flex; flex-direction: column; align-items: center; gap: var(--sp-2); align-self: stretch; font-family: var(--font-jp); font-weight: 700; font-size: var(--fs-caption); line-height: 1; color: var(--text-on-panel-soft); border-right: 1px solid rgba(255,255,255,0.14); padding-right: var(--sp-3); flex: none; }
.dd-plate__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--sp-3); }
.dd-plate__row { display: flex; align-items: center; gap: var(--sp-3); }
.dd-plate__actions { margin-left: auto; display: flex; gap: var(--sp-2); }
.dd-plate__actions button { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: var(--r-pill); border: 1px solid rgba(255,255,255,0.18); color: var(--text-on-panel); padding: 0; }
.dd-plate__actions .svg { width: 15px; height: 15px; }
.dd-head { font-family: var(--font-serif); font-weight: 700; font-size: 4.5rem; line-height: 1; letter-spacing: 0.04em; }
.dd-readings { display: flex; gap: var(--sp-5); flex-wrap: wrap; }
.dd-reading { display: flex; align-items: baseline; gap: var(--sp-2); font-family: var(--font-jp); font-size: var(--fs-body); }
.dd-reading b { font-family: var(--font-jp); font-size: var(--fs-caption); color: var(--text-on-panel-soft); }
.dd-section { display: flex; flex-direction: column; gap: var(--sp-3); }
.dd-section__cap { font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-secondary); }
.dd-meaning { font-family: var(--font-display); font-size: var(--fs-title); font-weight: 600; }
.dd-example { display: flex; flex-direction: column; gap: 1px; padding: var(--sp-3) var(--sp-4); background: var(--surface); border: 1px solid var(--surface-line); border-radius: var(--r-card); }
.dd-example__jp { font-family: var(--font-jp); font-weight: 600; font-size: var(--fs-body); }
.dd-example__jp mark { background: color-mix(in srgb, var(--line-jisho) 22%, transparent); color: inherit; padding: 0 2px; border-radius: 2px; }
.dd-example__en { font-size: var(--fs-caption); color: var(--text-secondary); }
.dd-tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; background: var(--surface-line); border: 1px solid var(--surface-line); border-radius: var(--r-card); overflow: hidden; }
.dd-tile { display: flex; flex-direction: column; gap: var(--sp-1); padding: var(--sp-3) var(--sp-4); background: var(--surface); }
.dd-tile b { font-family: var(--font-display); font-weight: 700; font-size: var(--fs-lead); line-height: 1; font-variant-numeric: tabular-nums; }
.dd-tile span { font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-secondary); }
.dd-stroke { display: flex; gap: var(--sp-4); align-items: stretch; }
.dd-stroke__frame { width: 108px; height: 108px; flex: none; border-radius: var(--r-card); background: var(--paper); display: flex; align-items: center; justify-content: center; }
.dd-stroke__frame svg { width: 84px; height: 84px; }
.dd-stroke .dd-tiles { flex: 1; grid-template-columns: 1fr; }

/* ── the analyzer's stage ── */
.anl-stepper { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); }
.anl-stepper__btn { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: var(--r-pill); border: 1px solid var(--surface-line); color: var(--text-secondary); padding: 0; }
.anl-stepper__count { font-family: var(--font-display); font-size: var(--fs-caption); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-secondary); }
.anl-stepper__count i { font-style: normal; text-transform: none; }
.anl-stops { display: flex; gap: var(--sp-1); flex: 1; justify-content: center; }
.anl-stops i { width: 8px; height: 8px; border-radius: var(--r-pill); background: color-mix(in srgb, var(--line-kaiseki) 40%, transparent); }
.anl-stops i.on { background: var(--line-kaiseki); }
.tok-line { display: flex; flex-wrap: wrap; gap: var(--sp-1) 2px; padding: var(--sp-4); background: var(--surface); border: 1px solid var(--surface-line); border-radius: var(--r-card); }
.tok { --tok: var(--text-secondary); display: inline-flex; flex-direction: column; align-items: center; gap: 1px; padding: 2px 4px 3px; border-radius: var(--r-plate); border-bottom: 2px solid var(--tok); font-family: var(--font-jp); font-size: 1.25rem; font-weight: 600; line-height: 1.3; color: var(--text-primary); }
.tok--on { background: color-mix(in srgb, var(--line-kaiseki) 14%, transparent); }
.tok--mastered { --tok: var(--state-mastered); }
.tok--learning { --tok: var(--state-learning); }
.tok--new { --tok: var(--state-new); }
.tok--unknown { --tok: var(--state-new); }
.tok--offdeck { --tok: transparent; border-bottom: 2px dashed var(--text-secondary); }
.tok--particle { --tok: transparent; color: var(--text-secondary); }
.tok__furi { font-size: var(--fs-caption-xs); font-weight: 500; color: var(--text-secondary); line-height: 1; }
.token-card { display: flex; flex-direction: column; gap: var(--sp-3); padding: var(--sp-4); background: var(--surface); border: 1px solid var(--surface-line); border-radius: var(--r-card); }
.token-card__head { display: flex; align-items: baseline; gap: var(--sp-3); }
.token-card__surface { font-family: var(--font-serif); font-weight: 700; font-size: var(--fs-heading); line-height: 1.1; }
.token-card__reading { font-family: var(--font-jp); font-size: var(--fs-sm); color: var(--text-secondary); letter-spacing: var(--tr-reading); }
.token-card__pos { margin-left: auto; }
.token-card__gloss { font-size: var(--fs-body); }
.token-card__foot { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); }
.token-card__kanji { display: flex; gap: var(--sp-2); }
.token-card__kanji span { display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: var(--r-plate); border: 1px solid var(--surface-line); font-family: var(--font-jp); font-weight: 700; }
.anl-legend { display: flex; flex-wrap: wrap; gap: var(--sp-3) var(--sp-4); font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-secondary); }
.anl-legend span { display: inline-flex; align-items: center; gap: var(--sp-2); }
.anl-legend i { width: 14px; height: 3px; border-radius: var(--r-pill); }
`
export const CSS3 = String.raw`
/* ── the third wave ── */
.mcq-row--wrong { --mcq-color: var(--danger); background: color-mix(in srgb, var(--mcq-color) 12%, var(--bg-card)); border-color: var(--mcq-color); }
.mcq-row--wrong .mcq-row__accent { transform: scaleX(1); }
.mcq-row--wrong .mcq-row__index { background: var(--mcq-color); border-color: var(--mcq-color); color: var(--bg-main); }
.mcq-row--wrong .mcq-row__text { color: color-mix(in srgb, var(--danger) 60%, var(--text-primary)); }
.btn-depart:disabled, .btn-depart--off { opacity: 0.45; box-shadow: none; }
.cloze { font-family: var(--font-jp); font-size: var(--fs-heading); font-weight: 500; line-height: 1.6; letter-spacing: var(--tr-term); text-align: center; }
.cloze__blank { display: inline-block; min-width: 2.2em; border-bottom: 2px solid var(--line-color, var(--accent)); color: var(--line-color, var(--accent)); font-weight: 700; }
.browse-nav { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-3); }
.reissue { position: absolute; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; padding: var(--sp-6); }
.reissue__scrim { position: absolute; inset: 0; background: rgba(0,0,0,0.62); }
.reissue__pass { --pass-color: var(--pass-ink); position: relative; display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); width: 100%; padding: var(--sp-6) var(--sp-7) var(--sp-6); background: linear-gradient(122deg, color-mix(in srgb, var(--pass-color) 22%, var(--surface)) 0%, var(--surface) 62%); border: 1px solid var(--surface-line); border-radius: 12px; box-shadow: 0 26px 70px rgba(0,0,0,0.5); text-align: center; }
.reissue__cap { display: flex; align-items: baseline; gap: var(--sp-3); }
.reissue__cap b { font-family: var(--font-display); font-weight: 700; font-size: var(--fs-caption); letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--accent2); }
.reissue__from { font-family: var(--font-jp); font-size: var(--fs-sm); color: var(--text-secondary); text-decoration: line-through; }
.reissue__rank { font-family: var(--font-serif); font-weight: 700; font-size: var(--fs-display); line-height: 1.1; letter-spacing: var(--tr-name); text-indent: var(--tr-name); }
.reissue__latin { font-family: var(--font-display); font-size: var(--fs-caption); font-weight: 700; letter-spacing: 0.3em; text-indent: 0.3em; text-transform: uppercase; color: var(--text-secondary); }
.reissue__name { font-family: var(--font-serif); font-size: var(--fs-title); font-weight: 700; }
.type-list { display: flex; flex-direction: column; gap: var(--sp-2); }
.type-row { display: flex; align-items: center; gap: var(--sp-4); min-height: 52px; padding: var(--sp-2) var(--sp-4); border: 1px solid var(--surface-line); border-radius: var(--r-card); color: var(--text-primary); text-align: left; }
.type-row--on { border-color: var(--line-decks); background: color-mix(in srgb, var(--line-decks) 12%, transparent); }
.type-row__names { display: flex; flex-direction: column; min-width: 0; }
.type-row__label { font-family: var(--font-display); font-weight: 700; font-size: var(--fs-sm); }
.type-row__desc { font-size: var(--fs-caption); color: var(--text-secondary); }
.form { display: flex; flex-direction: column; gap: var(--sp-3); padding: var(--sp-4); background: var(--surface); border: 1px solid var(--surface-line); border-radius: var(--r-card); }
.form__label { font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-secondary); }
.form__row { display: flex; gap: var(--sp-3); }
.result-lattice { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; background: var(--surface-line); border: 1px solid var(--surface-line); border-radius: var(--r-card); overflow: hidden; }
.qrow { display: flex; align-items: center; gap: var(--sp-3); min-height: 44px; padding: 0 var(--sp-4); border-top: 1px solid var(--surface-line); font-size: var(--fs-sm); }
.qrow:first-child { border-top: 0; }
.qrow__q { font-family: var(--font-display); font-weight: 700; width: 30px; font-variant-numeric: tabular-nums; }
.qrow__note { color: var(--text-secondary); margin-left: auto; font-size: var(--fs-caption); }
.paper-slot { align-self: flex-end; font-family: var(--font-jp); font-size: var(--fs-caption); color: var(--text-secondary); padding: var(--sp-1) var(--sp-3); }
.intake-pair { display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-3); }
.intake-btn { display: inline-flex; align-items: center; justify-content: center; gap: var(--sp-2); min-height: 48px; border: 1px solid var(--surface-line); border-radius: var(--r-card); color: var(--text-primary); font-weight: 600; }
.intake-btn .svg { color: var(--text-secondary); }
.photo-frame { position: relative; height: 150px; border-radius: var(--r-card); background: var(--surface); border: 1px solid var(--surface-line); overflow: hidden; }
.photo-frame::before { content: ''; position: absolute; inset: 18px 40px; border: 1px dashed color-mix(in srgb, var(--line-kaiseki) 60%, transparent); border-radius: 2px; }
.photo-frame i { position: absolute; width: 14px; height: 14px; border: 2px solid var(--line-kaiseki); }
.photo-frame i:nth-child(1) { top: 12px; left: 34px; border-right: 0; border-bottom: 0; }
.photo-frame i:nth-child(2) { top: 12px; right: 34px; border-left: 0; border-bottom: 0; }
.photo-frame i:nth-child(3) { bottom: 12px; left: 34px; border-right: 0; border-top: 0; }
.photo-frame i:nth-child(4) { bottom: 12px; right: 34px; border-left: 0; border-top: 0; }
.photo-frame span { position: absolute; inset: 18px 40px; display: flex; align-items: center; justify-content: center; padding: var(--sp-3); font-family: var(--font-jp); font-size: var(--fs-lead); line-height: 1.6; text-align: center; color: var(--text-secondary); }
.hint { font-size: var(--fs-caption); color: var(--text-secondary); line-height: 1.5; }
.picker-row { display: flex; align-items: center; gap: var(--sp-4); min-height: 56px; padding: 0 var(--sp-4); border-top: 1px solid var(--surface-line); text-align: left; color: var(--text-primary); }
.picker-row:first-child { border-top: 0; }
.picker-row__name { flex: 1; font-family: var(--font-jp); font-weight: 700; font-size: var(--fs-lead); }
.picker-row__count { font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-secondary); }
.hour-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: var(--sp-2); }
.onb-announce { font-family: var(--font-jp); font-size: var(--fs-caption); letter-spacing: var(--tr-name); color: var(--text-secondary); }
.onb-body { font-size: var(--fs-sm); line-height: 1.55; color: var(--text-secondary); }
.onb-link { align-self: center; font-size: var(--fs-caption); color: var(--text-secondary); text-decoration: underline; text-underline-offset: 3px; }
.onb-form { --ink: var(--text-on-fill); position: relative; display: flex; flex-direction: column; gap: var(--sp-4); padding: var(--sp-5); background: var(--paper); color: var(--ink); border-radius: var(--r-card); }
.onb-form__seal { position: absolute; top: var(--sp-4); right: var(--sp-4); display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border: 2px solid var(--stamp-ink); border-radius: var(--r-pill); color: var(--stamp-ink); font-family: var(--font-jp); font-weight: 700; transform: rotate(-8deg); opacity: 0.8; }
.onb-form__head { display: flex; flex-direction: column; }
.onb-form__jp { font-family: var(--font-serif); font-weight: 700; font-size: var(--fs-lead); letter-spacing: var(--tr-name); }
.onb-form__latin { font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; opacity: 0.7; }
.onb-form__row { display: flex; flex-direction: column; gap: var(--sp-2); }
.onb-form__label { display: flex; align-items: baseline; gap: var(--sp-2); }
.onb-form__label b { font-family: var(--font-jp); font-weight: 700; font-size: var(--fs-sm); }
.onb-form__label span { font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; opacity: 0.7; }
.onb-form__value { font-family: var(--font-serif); font-weight: 700; font-size: var(--fs-title); padding-bottom: 2px; border-bottom: 1px dashed color-mix(in srgb, var(--ink) 40%, transparent); }
.onb-form .hour { display: inline-flex; flex-direction: column; align-items: center; gap: 1px; min-height: 44px; padding: var(--sp-2) var(--sp-1); border: 1px solid color-mix(in srgb, var(--ink) 25%, transparent); border-radius: var(--r-card); color: var(--ink); font-family: var(--font-display); font-size: var(--fs-caption); font-weight: 700; }
.onb-form .hour--on { border-color: var(--ink); background: color-mix(in srgb, var(--ink) 8%, transparent); }
.onb-form .hour b { font-family: var(--font-jp); font-size: var(--fs-sm); }
.onb-roundels { display: flex; gap: var(--sp-3); }
.empty { display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); padding: var(--sp-7) var(--sp-5); text-align: center; background: var(--surface); border: 1px solid var(--surface-line); border-radius: var(--r-card); }
.empty__icon { color: var(--text-secondary); }
.empty__icon .svg { width: 28px; height: 28px; stroke-width: 1.8; }
.empty__msg { font-family: var(--font-serif); font-weight: 700; font-size: var(--fs-lead); }
.empty__hint { font-size: var(--fs-sm); color: var(--text-secondary); }
.loading { display: flex; align-items: center; justify-content: center; gap: var(--sp-2); padding: var(--sp-7); }
.loading i { width: 8px; height: 8px; border-radius: var(--r-pill); background: var(--accent2); opacity: 0.35; }
.loading i:nth-child(2) { opacity: 0.7; }
.loading i:nth-child(3) { opacity: 1; }
.rating-bar__buttons--6 { flex-wrap: wrap; }
.rating-bar__buttons--6 .rating-bar__btn { flex: 0 0 33.333%; }
.rating-bar__buttons--6 .rating-bar__btn:nth-child(3n + 1) { border-left: none; }
.rating-bar__buttons--6 .rating-bar__btn:nth-child(n + 4) { border-top: 1px solid color-mix(in srgb, var(--text-on-panel) 12%, transparent); }
.rating-bar__btn--q0 { --rating-color: var(--danger); }
.rating-bar__btn--q5 { --rating-color: var(--success); }
`

export const CSS4 = String.raw`
/* ── 辞書 — the catalogue cards and the entry plate (rework of 2026-09-05) ── */
.dict-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--sp-3); }
.dict-entry-card { --plate: var(--level-color, var(--text-secondary)); position: relative; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 4px; padding: 22px 12px 16px; background: var(--surface); border: 1px solid var(--surface-line); border-radius: var(--r-card); text-align: center; overflow: hidden; color: var(--text-primary); }
.dict-entry-card::after { content: ''; position: absolute; left: 0; right: 0; bottom: 0; height: 3px; background: var(--plate); opacity: 0.85; }
.dict-entry-card__char { font-size: 38px; font-family: var(--font-jp); line-height: 1; }
.dict-entry-card__kana { font-size: 13px; color: var(--text-secondary); font-family: var(--font-jp); letter-spacing: 0.02em; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dict-entry-card__meaning { font-size: 14px; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; }
.dict-entry-card .dict-level-badge { position: absolute; top: 7px; left: 10px; font-family: var(--font-display); font-size: 10px; font-weight: 700; letter-spacing: 0.1em; color: var(--text-secondary); opacity: 0.6; }
.dict-entry-card .stage-mark { top: var(--sp-3); right: var(--sp-3); letter-spacing: var(--tr-term); opacity: 0.75; }
.dict-entry { --dict-ink: color-mix(in srgb, var(--line-color, var(--accent2)) 60%, var(--text-primary)); --line-color: var(--line-jisho); flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; color: var(--text-primary); }
.dict-plate { display: flex; flex-direction: column; gap: var(--sp-3); padding: var(--sp-3) var(--sp-5) 0; background: var(--surface); }
.dict-plate__row { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-4); min-height: var(--sp-8); }
.dict-plate__marks { display: flex; align-items: center; gap: var(--sp-4); }
.dict-plate__level { font-family: var(--font-display); font-size: var(--fs-caption); font-weight: 700; letter-spacing: var(--tr-caption); color: var(--text-secondary); }
.dict-plate__marks .stage-mark { position: static; }
.dict-plate__actions { display: flex; align-items: center; gap: var(--sp-3); }
.dict-plate__btn { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; width: var(--sp-8); height: var(--sp-8); padding: 0; border: 1px solid var(--surface-line); border-radius: var(--r-pill); color: var(--text-primary); }
.dict-plate__btn .svg { width: 18px; height: 18px; }
.dict-plate__stack { display: flex; flex-direction: column; align-items: center; gap: var(--sp-2); padding-bottom: var(--sp-4); text-align: center; }
.dict-plate__reading { font-family: var(--font-jp); font-size: var(--fs-sm); letter-spacing: var(--tr-reading); text-indent: var(--tr-reading); color: var(--text-secondary); }
.dict-plate__word { margin: 0; font-family: var(--font-jp); font-weight: 400; font-size: var(--fs-display); line-height: 1.2; letter-spacing: var(--tr-term); text-indent: var(--tr-term); color: var(--text-primary); }
.dict-plate__word--glyph { font-size: var(--fs-specimen-word); line-height: 1.1; letter-spacing: 0; text-indent: 0; }
.dict-plate__readings { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: var(--sp-2) var(--sp-4); max-width: 100%; }
.dict-plate__yomi { display: inline-flex; align-items: center; gap: var(--sp-2); font-family: var(--font-jp); font-size: var(--fs-body); letter-spacing: var(--tr-term); color: var(--text-secondary); }
.dict-kind { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; width: var(--sp-6); height: var(--sp-6); border: 1px solid var(--surface-line); border-radius: var(--r-plate); font-family: var(--font-jp); font-size: var(--fs-caption-xs); font-weight: 700; line-height: 1; color: var(--text-secondary); }
.dict-plate__more { display: inline-flex; align-items: center; gap: var(--sp-1); min-height: 30px; padding: 0 var(--sp-3); border: 1px solid var(--surface-line); border-radius: var(--r-pill); color: var(--text-secondary); font-family: var(--font-display); font-size: var(--fs-caption); font-weight: 700; letter-spacing: var(--tr-term); }
.dict-plate__more .svg { width: 12px; height: 12px; }
.dict-plate__caption { font-family: var(--font-display); font-size: var(--fs-sm); font-weight: 700; letter-spacing: var(--tr-caption); text-indent: var(--tr-caption); text-transform: uppercase; color: var(--text-secondary); }
.dict-plate__stripe { flex-shrink: 0; height: 3px; margin: 0 calc(-1 * var(--sp-5)); background: var(--line-color, var(--accent2)); }
.dict-entry__body { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.dict-block { padding: var(--sp-4) var(--sp-5); }
.dict-block + .dict-block { border-top: 1px solid var(--surface-line); }
.dict-block__note { display: flex; justify-content: flex-end; align-items: center; gap: var(--sp-1); margin-bottom: var(--sp-3); font-family: var(--font-display); font-size: var(--fs-caption); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: color-mix(in srgb, var(--state-due) 65%, var(--text-primary)); }
.dict-block__note .svg { width: 12px; height: 12px; }
.dict-senses { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--sp-3); }
.dict-sense { display: grid; grid-template-columns: var(--sp-6) minmax(0, 1fr); gap: var(--sp-3); align-items: baseline; }
.dict-sense__n { font-family: var(--font-display); font-size: var(--fs-caption); font-weight: 700; font-variant-numeric: tabular-nums; color: var(--dict-ink); }
.dict-sense__body { display: flex; flex-direction: column; gap: var(--sp-2); min-width: 0; }
.dict-sense__gloss { font-size: var(--fs-body); line-height: 1.5; color: var(--text-primary); }
.dict-tag { font-family: var(--font-display); font-size: var(--fs-caption); font-weight: 600; letter-spacing: var(--tr-term); color: var(--text-secondary); text-decoration: underline dotted; text-decoration-color: var(--surface-line); text-underline-offset: 3px; }
.dict-examples { display: flex; flex-direction: column; gap: var(--sp-3); }
.dict-ex { display: flex; flex-direction: column; gap: 2px; }
.dict-ex__jp { font-family: var(--font-jp); font-size: var(--fs-lead); line-height: 1.7; color: var(--text-primary); }
.dict-ex__hl { color: var(--dict-ink); font-weight: 700; }
.dict-ex__tr { font-size: var(--fs-sm); line-height: 1.5; color: var(--text-secondary); }
.dict-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: repeat(2, minmax(0, 1fr)); gap: 1px; background: var(--surface-line); border: 1px solid var(--surface-line); border-radius: var(--r-card); overflow: hidden; }
.dict-form__sheet { grid-row: 1 / -1; display: flex; align-items: center; justify-content: center; min-height: 120px; padding: var(--sp-3); background: var(--paper); }
.dict-form__sheet svg { width: 84px; height: 84px; }
.dict-form .record { padding: var(--sp-3) var(--sp-4); }
.dict-words { display: flex; flex-direction: column; margin: 0 calc(-1 * var(--sp-5)); }
.dict-word { position: relative; display: flex; align-items: center; gap: var(--sp-3); width: 100%; min-height: 48px; padding: var(--sp-2) var(--sp-5); text-align: left; color: inherit; }
.dict-word + .dict-word { border-top: 1px solid var(--surface-line); }
.dict-word__jp { flex-shrink: 0; font-family: var(--font-jp); font-size: var(--fs-lead); line-height: 1.4; color: var(--text-primary); }
.dict-word__hit { color: var(--dict-ink); font-weight: 700; }
.dict-word__gloss { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: right; font-size: var(--fs-sm); color: var(--text-secondary); }
.dict-word__chev { flex-shrink: 0; color: var(--text-secondary); opacity: 0.7; }
.dict-register { display: flex; flex-direction: column; gap: var(--sp-3); }
.dict-register__head { display: flex; align-items: center; gap: var(--sp-3); }
.dict-readings__glyph { font-family: var(--font-jp); font-size: var(--fs-heading); line-height: 1; color: var(--text-primary); }
.dict-readings__title { font-family: var(--font-display); font-size: var(--fs-caption); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-secondary); }
.dict-reading { display: flex; flex-direction: column; gap: var(--sp-1); }
.dict-reading__yomi { font-family: var(--font-jp); font-size: var(--fs-lead); letter-spacing: var(--tr-term); color: var(--text-primary); }
.dict-register__rest { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: var(--sp-2); }
.dict-register__chip { display: inline-flex; align-items: center; height: 30px; padding: 0 var(--sp-3); border: 1px solid var(--surface-line); border-radius: var(--r-pill); font-family: var(--font-jp); font-size: var(--fs-sm); color: var(--text-secondary); }
.dict-parts { display: flex; gap: var(--sp-2); }
.dict-part { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; border: 1px solid var(--surface-line); border-radius: var(--r-card); font-family: var(--font-jp); font-size: var(--fs-lead); color: var(--text-primary); }
`
