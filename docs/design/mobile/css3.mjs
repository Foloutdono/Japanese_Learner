// CSS5 — the boarding (onboarding). Namespaced .brd-*; every value is a
// :root token or a literal index.css already uses. Motion is CSS only, one
// movement per screen, all of it loop-safe so a still frame still reads.
export const CSS5 = `
/* ── boarding: the frame ── */
.brd { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: var(--sp-5); padding: calc(var(--safe-top) + var(--sp-3)) var(--sp-5) calc(var(--safe-bottom) + var(--sp-6)); }
.brd__body { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: var(--sp-5); padding-top: calc(var(--sp-9) + var(--sp-8)); overflow-y: auto; }
.brd__body--top { padding-top: 0; }
.brd__body--arrival { padding-top: var(--sp-9); }
.brd__body--center { padding-top: 0; justify-content: center; }
.brd__stage { flex: none; display: flex; flex-direction: column; gap: var(--sp-5); margin-top: var(--sp-9); }
.brd__body--center .brd__stage { margin-top: 0; }
.brd__head { display: flex; align-items: center; gap: var(--sp-4); height: 44px; flex: none; }
.brd__back { display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; flex: none; border: 1px solid var(--surface-line); border-radius: var(--r-pill); color: var(--text-secondary); }
.brd__back .svg { width: 18px; height: 18px; }
.brd__track { position: relative; flex: 1; height: 6px; border-radius: var(--r-pill); background: color-mix(in srgb, var(--accent2) 18%, transparent); }
.brd__done { position: absolute; left: 0; top: 0; bottom: 0; border-radius: var(--r-pill); background: var(--accent2); transition: width 300ms ease-out; }
.brd__train { position: absolute; top: -4px; width: 8px; height: 14px; border-radius: var(--r-pill); background: var(--text-primary); transform: translateX(-50%); box-shadow: 0 0 0 3px var(--bg-main); }
.brd__count { flex: none; font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); color: var(--text-secondary); font-variant-numeric: tabular-nums; }
.brd__q { font-family: var(--font-serif); font-weight: 700; font-size: var(--fs-heading); line-height: 1.3; text-align: center; text-wrap: pretty; animation: brd-in 360ms ease-out both; }
.brd__q b { font-weight: 700; color: var(--accent2); }
.brd__hint { font-size: var(--fs-sm); line-height: 1.5; text-align: center; color: var(--text-secondary); }
.brd__foot { display: flex; flex-direction: column; gap: var(--sp-3); flex: none; }
.brd .btn-depart { width: 100%; }
.brd__link { align-self: center; display: inline-flex; align-items: center; min-height: 44px; padding: 0 var(--sp-3); font-size: var(--fs-sm); font-weight: 600; color: var(--text-secondary); text-decoration: underline; text-underline-offset: 3px; }
.brd__fine { text-align: center; font-size: var(--fs-caption); color: var(--text-secondary); }

/* ── options: one row, one choice ── */
.brd__opts { display: flex; flex-direction: column; gap: var(--sp-3); }
.brd__opts > * { animation: brd-in 360ms ease-out both; }
.brd__opts > :nth-child(2) { animation-delay: 40ms; } .brd__opts > :nth-child(3) { animation-delay: 80ms; } .brd__opts > :nth-child(4) { animation-delay: 120ms; } .brd__opts > :nth-child(5) { animation-delay: 160ms; } .brd__opts > :nth-child(6) { animation-delay: 200ms; }
.brd-opt { display: flex; align-items: center; gap: var(--sp-4); width: 100%; min-height: 60px; padding: var(--sp-3) var(--sp-4); background: var(--surface); border: 1px solid var(--surface-line); border-radius: var(--r-card); text-align: left; color: var(--text-primary); }
.brd-opt--on { border-color: var(--accent2); background: color-mix(in srgb, var(--accent2) 14%, var(--surface)); }
.brd-opt__icon { display: inline-flex; align-items: center; justify-content: center; width: 32px; height: 32px; flex: none; border: 1px solid var(--surface-line); border-radius: var(--r-pill); color: var(--text-secondary); }
.brd-opt__icon .svg { width: 16px; height: 16px; }
.brd-opt--on .brd-opt__icon { border-color: var(--accent2); color: var(--accent2); }
.brd-opt__code { display: inline-flex; align-items: center; justify-content: center; width: 38px; height: 38px; flex: none; border: 1px solid var(--surface-line); border-radius: var(--r-pill); font-family: var(--font-display); font-weight: 700; font-size: var(--fs-caption); letter-spacing: var(--tr-term); color: var(--text-secondary); }
.brd-opt--on .brd-opt__code { border-color: var(--accent2); color: var(--text-primary); }
.brd-opt__names { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.brd-opt__label { display: flex; align-items: center; gap: var(--sp-3); font-family: var(--font-display); font-weight: 700; font-size: var(--fs-body); line-height: 1.3; }
.brd-opt__desc { font-size: var(--fs-caption); line-height: 1.4; color: var(--text-secondary); }
.brd-opt__jp { flex: none; font-family: var(--font-jp); font-size: var(--fs-lead); color: var(--text-secondary); }
.brd-opt__check { display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; flex: none; border: 1.5px solid var(--surface-line); border-radius: var(--r-pill); color: transparent; }
.brd-opt__check .svg { width: 12px; height: 12px; stroke-width: 3; }
.brd-opt--on .brd-opt__check, .brd-plan--on .brd-opt__check { border-color: var(--accent2); color: var(--accent2); }
.brd-tag { display: inline-flex; align-items: center; height: 20px; padding: 0 var(--sp-2); flex: none; border: 1px solid var(--accent2); border-radius: var(--r-pill); font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-primary); white-space: nowrap; }

.brd-kopt { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); min-height: 56px; padding: 0 var(--sp-4); background: var(--surface); border: 1px solid var(--surface-line); border-radius: var(--r-card); color: var(--text-primary); text-align: left; }
.brd-kopt__label { font-family: var(--font-display); font-weight: 700; font-size: var(--fs-body); }
.brd-kopt__jp { font-family: var(--font-jp); font-size: var(--fs-lead); color: var(--text-secondary); }

/* ── welcome: the sign, the rolling stock, the promise ── */
.brd-hero { display: flex; flex-direction: column; align-items: center; gap: var(--sp-2); padding-top: var(--sp-7); text-align: center; animation: brd-in 480ms ease-out both; }
.brd-roll { position: relative; flex: 1; display: flex; flex-direction: column; justify-content: center; gap: var(--sp-4); margin: 0 calc(-1 * var(--sp-5)); overflow: hidden; }
.brd-roll__lane { display: flex; gap: var(--sp-4); width: max-content; animation: brd-roll 26s linear infinite; }
.brd-roll__lane--back { animation-duration: 34s; animation-direction: reverse; }
.brd-demo { position: relative; display: flex; flex-direction: column; gap: var(--sp-2); width: 156px; height: 204px; padding: var(--sp-3) var(--sp-4); background: var(--surface); border: 1px solid var(--surface-line); border-top: 3px solid var(--line-color, var(--accent2)); border-radius: var(--r-panel); }
.brd-demo__tag { font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: color-mix(in srgb, var(--line-color, var(--accent2)) 70%, var(--text-primary)); }
.brd-demo__glyph { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; }
.brd-demo__t { display: block; width: 100%; font-family: var(--font-jp); font-size: var(--fs-display); line-height: 1.2; text-align: center; white-space: nowrap; color: var(--text-primary); }
.brd-demo__t--sm { font-size: var(--fs-lead); line-height: 1.6; white-space: normal; text-wrap: balance; }
.brd-demo__t--cap { display: block; margin-bottom: var(--sp-1); font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-secondary); }
.brd-demo__t .cloze { color: var(--accent2); border-bottom: 2px solid var(--accent2); white-space: nowrap; }
.brd-demo__meaning { text-align: center; font-family: var(--font-display); font-weight: 700; font-size: var(--fs-sm); color: var(--accent); }
.brd-demo__foot { font-size: var(--fs-caption-xs); color: var(--text-secondary); text-align: center; }
.brd-demo__draw { flex: 1; position: relative; margin: 0 var(--sp-3); background: color-mix(in srgb, var(--text-primary) 4%, transparent); border: 1px solid var(--surface-line); border-radius: var(--r-plate); background-image: linear-gradient(var(--surface-line), var(--surface-line)), linear-gradient(var(--surface-line), var(--surface-line)); background-size: 1px 100%, 100% 1px; background-position: center, center; background-repeat: no-repeat; }
.brd-demo__draw svg { position: absolute; inset: 0; width: 100%; height: 100%; }
.brd-demo__draw path { fill: none; stroke: var(--text-primary); stroke-width: 5; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 120; stroke-dashoffset: 0; animation: brd-draw-in 1.6s ease-out 600ms both; }
.brd-demo__wave { flex: 1; display: flex; align-items: center; justify-content: center; gap: var(--sp-1); }
.brd-demo__wave i { width: 4px; height: 14px; border-radius: var(--r-pill); background: var(--line-color, var(--accent2)); animation: brd-wave 1.1s ease-in-out infinite alternate; }
.brd-demo__wave i:nth-child(2) { height: 26px; animation-delay: 120ms; } .brd-demo__wave i:nth-child(3) { height: 36px; animation-delay: 240ms; } .brd-demo__wave i:nth-child(4) { height: 22px; animation-delay: 360ms; } .brd-demo__wave i:nth-child(5) { height: 30px; animation-delay: 480ms; } .brd-demo__wave i:nth-child(6) { height: 16px; animation-delay: 600ms; }
.brd-tagline { font-family: var(--font-serif); font-weight: 700; font-size: var(--fs-lead); text-align: center; line-height: 1.4; text-wrap: pretty; }

/* ── the name ── */
.brd-field { display: flex; align-items: center; width: 100%; min-height: 64px; padding: 0 var(--sp-5); background: var(--surface); border: 1.5px solid var(--accent2); border-radius: var(--r-card); font-family: var(--font-display); font-weight: 700; font-size: var(--fs-heading); color: var(--text-primary); }
.brd-field--empty { border-color: var(--surface-line); color: var(--text-secondary); font-weight: 500; }
.brd-field__caret { width: 2px; height: 30px; margin-left: 2px; background: var(--accent2); animation: brd-blink 1s steps(2) infinite; }

/* ── the kana card ── */
.brd-kana { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); background: var(--surface); border: 1px solid var(--surface-line); border-radius: var(--r-panel); overflow: hidden; animation: brd-in 420ms ease-out both; }
.brd-kana__pane { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--sp-3); min-height: 236px; padding: var(--sp-5) var(--sp-3); }
.brd-kana__pane + .brd-kana__pane { border-left: 1px solid var(--surface-line); }
.brd-kana__jp { font-family: var(--font-jp); font-size: var(--fs-display); line-height: 1; color: var(--text-primary); }
.brd-kana__read { display: flex; flex-direction: column; align-items: center; gap: 1px; animation: brd-rise 500ms ease-out 200ms both; }
.brd-kana__romaji { font-family: var(--font-display); font-size: var(--fs-caption); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-secondary); }
.brd-kana__en { font-family: var(--font-display); font-weight: 700; font-size: var(--fs-lead); color: var(--accent2); }
.brd-kana__script { font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-secondary); }

/* ── the rhythm and the hours: cards in a lattice ── */
.brd-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--sp-3); }
.brd-grid--3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.brd-grid > * { animation: brd-in 360ms ease-out both; }
.brd-grid > :nth-child(2) { animation-delay: 40ms; } .brd-grid > :nth-child(3) { animation-delay: 80ms; } .brd-grid > :nth-child(4) { animation-delay: 120ms; }
.brd-cell { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; min-height: 120px; padding: var(--sp-4) var(--sp-3); background: var(--surface); border: 1px solid var(--surface-line); border-radius: var(--r-card); color: var(--text-primary); text-align: center; }
.brd-cell--on { border-color: var(--accent2); background: color-mix(in srgb, var(--accent2) 14%, var(--surface)); }
.brd-cell__n { font-family: var(--font-display); font-weight: 700; font-size: var(--fs-display); line-height: 1; font-variant-numeric: tabular-nums; }
.brd-cell__u { font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-secondary); }
.brd-cell__sub { margin-top: var(--sp-1); font-size: var(--fs-caption); color: var(--text-secondary); }
.brd-cell__label { font-family: var(--font-display); font-weight: 700; font-size: var(--fs-sm); }
.brd-cell__time { font-family: var(--font-display); font-weight: 700; font-size: var(--fs-title); font-variant-numeric: tabular-nums; }
.brd-cell .brd-tag { margin-bottom: var(--sp-1); }
.brd-cell--sm { min-height: 76px; }

/* ── the departure board and the day track ── */
.brd-board { display: flex; flex-direction: column; align-items: center; gap: var(--sp-3); padding: var(--sp-5); background: var(--bg-panel); color: var(--text-on-panel); border: 1px solid color-mix(in srgb, var(--accent2) 16%, transparent); border-radius: var(--r-panel); animation: brd-in 420ms ease-out both; }
.brd-board__cap { font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-on-panel-soft); }
.brd-board__flaps { display: flex; align-items: center; gap: var(--sp-1); perspective: 400px; }
.brd-board__colon { padding: 0 var(--sp-1); font-family: var(--font-display); font-weight: 700; font-size: var(--fs-title); color: var(--text-on-panel-soft); }
.brd-board .flap--turn { animation: brd-flip 900ms ease-in-out 3s 1 both; }
.brd-day { position: relative; height: 48px; margin: 0 var(--sp-3); }
.brd-day__rail { position: absolute; left: 0; right: 0; top: 16px; height: 3px; border-radius: var(--r-pill); background: color-mix(in srgb, var(--accent2) 30%, transparent); }
.brd-day__done { position: absolute; left: 0; top: 16px; height: 3px; border-radius: var(--r-pill); background: var(--accent2); }
.brd-day__tick { position: absolute; top: 28px; transform: translateX(-50%); font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-term); color: var(--text-secondary); font-variant-numeric: tabular-nums; }
.brd-day__tick--first { transform: none; } .brd-day__tick--last { transform: translateX(-100%); }
.brd-day__train { position: absolute; top: 6px; width: 22px; height: 22px; border-radius: var(--r-pill); background: var(--bg-main); border: 3px solid var(--accent2); transform: translateX(-50%); }
.brd-day__train::before { content: ''; position: absolute; inset: -11px; }

/* ── the notification, as the app would send it ── */
.brd-notif { display: flex; align-items: flex-start; gap: var(--sp-4); padding: var(--sp-5); background: var(--surface); border: 1px solid var(--surface-line); border-radius: var(--r-panel); box-shadow: var(--elev-hang); animation: brd-drop 700ms cubic-bezier(0.2, 0.8, 0.2, 1) both; }
.brd-notif__app { display: inline-flex; align-items: center; justify-content: center; width: 38px; height: 38px; flex: none; border-radius: var(--r-card); background: var(--bg-panel); color: var(--accent2); font-family: var(--font-serif); font-weight: 700; font-size: var(--fs-lead); }
.brd-notif__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.brd-notif__head { display: flex; justify-content: space-between; gap: var(--sp-3); font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-secondary); }
.brd-notif__title { font-family: var(--font-display); font-weight: 700; font-size: var(--fs-body); }
.brd-notif__text { font-size: var(--fs-sm); color: var(--text-secondary); }
.brd-dim { position: absolute; inset: 0; z-index: 50; display: flex; align-items: center; justify-content: center; padding: var(--sp-6); background: rgba(0, 0, 0, 0.55); }
.brd-alert { width: 100%; max-width: 290px; overflow: hidden; background: var(--surface); border: 1px solid var(--surface-line); border-radius: var(--r-panel); box-shadow: var(--elev-hang); text-align: center; }
.brd-alert__body { display: flex; flex-direction: column; gap: var(--sp-2); padding: var(--sp-5); }
.brd-alert__title { font-family: var(--font-display); font-weight: 700; font-size: var(--fs-body); line-height: 1.35; }
.brd-alert__text { font-size: var(--fs-sm); color: var(--text-secondary); }
.brd-alert__btns { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-top: 1px solid var(--surface-line); }
.brd-alert__btn { display: flex; align-items: center; justify-content: center; min-height: 44px; font-family: var(--font-display); font-weight: 700; font-size: var(--fs-body); color: var(--text-primary); }
.brd-alert__btn + .brd-alert__btn { border-left: 1px solid var(--surface-line); color: var(--accent2); }

/* ── building the journey ── */
.brd-build__track { position: relative; height: 8px; margin: var(--sp-3) var(--sp-2) var(--sp-4); border-radius: var(--r-pill); background: color-mix(in srgb, var(--accent2) 18%, transparent); }
.brd-build__done { position: absolute; left: 0; top: 0; bottom: 0; width: 62%; border-radius: var(--r-pill); background: var(--accent2); animation: brd-grow 2.4s ease-in-out both; }
.brd-build__train { position: absolute; top: -5px; left: 62%; width: 10px; height: 18px; border-radius: var(--r-pill); background: var(--text-primary); transform: translateX(-50%); box-shadow: 0 0 0 3px var(--bg-main); animation: brd-drive 2.4s ease-in-out both; }
.brd-steps { display: flex; flex-direction: column; gap: var(--sp-3); }
.brd-step { display: flex; align-items: center; gap: var(--sp-4); min-height: 56px; padding: 0 var(--sp-4); background: var(--surface); border: 1px solid var(--surface-line); border-radius: var(--r-card); }
.brd-step__mark { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; flex: none; border: 1.5px solid var(--surface-line); border-radius: var(--r-pill); color: var(--accent2); }
.brd-step__mark .svg { width: 13px; height: 13px; stroke-width: 3; }
.brd-step--done .brd-step__mark { border-color: var(--accent2); }
.brd-step--now .brd-step__mark { border-color: var(--accent2); animation: brd-pulse 1.2s ease-in-out infinite alternate; }
.brd-step--now .brd-step__mark::before { content: ''; width: 8px; height: 8px; border-radius: var(--r-pill); background: var(--accent2); }
.brd-step--next { opacity: 0.5; }
.brd-step__label { font-family: var(--font-display); font-weight: 700; font-size: var(--fs-body); }
.brd-step__val { margin-left: auto; font-size: var(--fs-sm); color: var(--text-secondary); white-space: nowrap; }

/* ── the plan: the projection and the promise ── */
.brd-chart { display: flex; flex-direction: column; gap: var(--sp-3); padding: var(--sp-4); background: var(--surface); border: 1px solid var(--surface-line); border-radius: var(--r-panel); animation: brd-in 420ms ease-out both; }
.brd-chart__title { font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-secondary); }
.brd-chart svg { display: block; width: 100%; height: auto; overflow: visible; }
.brd-chart .grid { stroke: var(--surface-line); stroke-width: 1; }
.brd-chart .axis { font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-term); fill: var(--text-secondary); }
.brd-chart .lbl { font-family: var(--font-display); font-size: var(--fs-caption); font-weight: 700; fill: var(--text-primary); }
.brd-chart .lbl--soft { fill: var(--text-secondary); }
.brd-chart .line { fill: none; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
.brd-chart .line--us { stroke: var(--accent2); stroke-dasharray: 400; stroke-dashoffset: 0; animation: brd-draw-line 1.6s ease-out 300ms both; }
.brd-chart .line--them { stroke: var(--text-secondary); stroke-width: 2; stroke-dasharray: 6 5; animation: brd-in 600ms ease-out 200ms both; }
.brd-chart .dot { stroke-width: 2; stroke: var(--surface); }
.brd-chart .dot--us { fill: var(--accent2); } .brd-chart .dot--them { fill: var(--text-secondary); }
.brd-chart__cap { font-size: var(--fs-caption); line-height: 1.4; color: var(--text-secondary); }
.brd-legend { display: flex; flex-wrap: wrap; gap: var(--sp-2) var(--sp-5); font-family: var(--font-display); font-size: var(--fs-caption); font-weight: 700; color: var(--text-secondary); }
.brd-legend span { display: inline-flex; align-items: center; gap: var(--sp-2); }
.brd-legend i { width: 14px; height: 3px; border-radius: var(--r-pill); background: var(--accent2); }
.brd-legend i.them { background: repeating-linear-gradient(90deg, var(--text-secondary) 0 4px, transparent 4px 7px); }
.brd-lead { font-size: var(--fs-body); line-height: 1.5; color: var(--text-secondary); }
.brd-lead b { color: var(--text-primary); }
.brd-bullets { display: flex; flex-direction: column; gap: var(--sp-2); }
.brd-bullet { display: flex; align-items: center; gap: var(--sp-3); min-height: 30px; font-family: var(--font-display); font-weight: 700; font-size: var(--fs-body); animation: brd-in 360ms ease-out both; }
.brd-bullet:nth-child(2) { animation-delay: 60ms; } .brd-bullet:nth-child(3) { animation-delay: 120ms; } .brd-bullet:nth-child(4) { animation-delay: 180ms; }
.brd-bullet .svg { color: var(--accent2); stroke-width: 3; }
.brd-bullet small { font-weight: 500; font-size: var(--fs-sm); color: var(--text-secondary); }

/* ── the offer ── */
.brd-offer { display: flex; flex-direction: column; align-items: center; gap: 2px; text-align: center; }
.brd-offer__cap { font-family: var(--font-display); font-size: var(--fs-caption); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-secondary); }
.brd-offer__pct { font-family: var(--font-display); font-weight: 700; font-size: var(--fs-display); line-height: 1; color: var(--accent2); font-variant-numeric: tabular-nums; animation: brd-pop 600ms cubic-bezier(0.2, 0.8, 0.2, 1) both; }
.brd-offer__sub { font-size: var(--fs-sm); color: var(--text-secondary); }
.brd-perks { display: flex; align-items: center; gap: var(--sp-5); padding: var(--sp-4) var(--sp-5); background: var(--bg-panel); color: var(--text-on-panel); border: 1px solid color-mix(in srgb, var(--accent2) 30%, transparent); border-radius: var(--r-identity); animation: brd-in 420ms ease-out 120ms both; }
.brd-perks__pass { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; width: 84px; height: 84px; flex: none; border: 1px solid color-mix(in srgb, var(--accent2) 40%, transparent); border-radius: var(--r-identity); background: linear-gradient(160deg, color-mix(in srgb, var(--accent2) 22%, transparent), transparent 70%); }
.brd-perks__inf { font-family: var(--font-display); font-weight: 700; font-size: var(--fs-display); line-height: 1; color: var(--accent2); }
.brd-perks__cap { font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-on-panel-soft); }
.brd-perks__list { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: var(--sp-2); }
.brd-perk { display: flex; align-items: center; gap: var(--sp-3); font-family: var(--font-display); font-weight: 700; font-size: var(--fs-sm); line-height: 1.3; }
.brd-perk .svg { width: 14px; height: 14px; stroke-width: 3; color: var(--accent2); }
.brd-plan { display: flex; align-items: center; gap: var(--sp-4); width: 100%; min-height: 60px; padding: var(--sp-3) var(--sp-4); background: var(--surface); border: 1px solid var(--surface-line); border-radius: var(--r-card); text-align: left; color: var(--text-primary); }
.brd-plan--on { border-color: var(--accent2); background: color-mix(in srgb, var(--accent2) 14%, var(--surface)); }
.brd-plan__names { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.brd-plan__label { display: flex; align-items: center; gap: var(--sp-3); font-family: var(--font-display); font-weight: 700; font-size: var(--fs-body); }
.brd-plan__price { font-size: var(--fs-caption); color: var(--text-secondary); font-variant-numeric: tabular-nums; }
.brd-plan__price b { color: var(--text-primary); }

/* ── the pass, issued ── */
.brd-issue { position: relative; margin-top: var(--sp-3); animation: brd-up 700ms cubic-bezier(0.2, 0.8, 0.2, 1) both; }
.brd-issue__seal { position: absolute; right: var(--sp-4); bottom: var(--sp-3); display: flex; align-items: center; justify-content: center; width: 60px; height: 60px; border: 3px solid var(--stamp-ink); border-radius: var(--r-plate); font-family: var(--font-serif); font-weight: 700; font-size: var(--fs-lead); color: var(--stamp-ink); background: color-mix(in srgb, var(--stamp-ink) 10%, transparent); transform: rotate(-12deg); opacity: 0.9; animation: brd-stamp 500ms cubic-bezier(0.2, 0.8, 0.2, 1) 700ms both; }

/* ── motion ── */
@keyframes brd-in    { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
@keyframes brd-rise  { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
@keyframes brd-up    { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: none; } }
@keyframes brd-drop  { from { opacity: 0; transform: translateY(-24px); } to { opacity: 1; transform: none; } }
@keyframes brd-stamp { from { opacity: 0; transform: scale(1.5) rotate(-12deg); } to { opacity: 0.9; transform: scale(1) rotate(-12deg); } }
@keyframes brd-roll  { from { transform: translateX(0); } to { transform: translateX(calc(-50% - var(--sp-4) / 2)); } }
@keyframes brd-blink { to { opacity: 0; } }
@keyframes brd-draw-in { from { stroke-dashoffset: 120; } }
@keyframes brd-draw-line { from { stroke-dashoffset: 400; } }
@keyframes brd-draw-check { from { stroke-dashoffset: 30; } }
@keyframes brd-wave  { from { transform: scaleY(0.4); } to { transform: scaleY(1); } }
@keyframes brd-flip  { 0% { transform: rotateX(0); } 50% { transform: rotateX(90deg); } 100% { transform: rotateX(0); } }
@keyframes brd-grow  { from { width: 0; } }
@keyframes brd-drive { from { left: 0; } }
@keyframes brd-pulse { from { box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent2) 30%, transparent); } to { box-shadow: 0 0 0 9px color-mix(in srgb, var(--accent2) 10%, transparent); } }
@keyframes brd-pop   { from { opacity: 0; transform: scale(1.5); } to { opacity: 1; transform: scale(1); } }

.brd :focus-visible, .brd-dim :focus-visible { outline: 2px solid var(--accent2); outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  .brd [class*="brd"], .brd [class*="brd"]::before, .brd-dim [class*="brd"], .brd .flap, .brd-roll__lane { animation: none; }
}

/* ── the motion sheet ── */
.mo { display: flex; flex-direction: column; gap: var(--sp-6); padding: var(--sp-7); }
.mo__row { display: flex; align-items: flex-start; gap: var(--sp-6); flex-wrap: wrap; }
.mo__col { display: flex; flex-direction: column; gap: var(--sp-3); width: 340px; }
.mo__col--wide { width: 520px; }
.mo__frames { display: flex; align-items: center; gap: var(--sp-3); }
.mo__frame { position: relative; width: 96px; height: 140px; overflow: hidden; background: var(--surface); border: 1px solid var(--surface-line); border-radius: var(--r-card); }
.mo__frame i { position: absolute; top: 12px; left: 10px; right: 10px; height: 4px; border-radius: var(--r-pill); background: color-mix(in srgb, var(--accent2) 18%, transparent); }
.mo__frame i::after { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: var(--w); border-radius: var(--r-pill); background: var(--accent2); }
.mo__frame b { position: absolute; top: 28px; left: var(--x); width: 76px; height: 90px; border-radius: var(--r-plate); background: color-mix(in srgb, var(--text-primary) 8%, transparent); border: 1px solid var(--surface-line); }
.mo__frame b.next { background: color-mix(in srgb, var(--accent2) 14%, transparent); border-color: color-mix(in srgb, var(--accent2) 40%, transparent); }
.mo__arrow { color: var(--text-secondary); }
.mo__list { display: flex; flex-direction: column; gap: var(--sp-2); }
.mo__item { display: grid; grid-template-columns: 120px minmax(0, 1fr); gap: var(--sp-3); font-size: var(--fs-sm); line-height: 1.45; color: var(--text-secondary); }
.mo__item b { font-family: var(--font-display); font-weight: 700; color: var(--text-primary); }

/* ── the pass's perks (the offer, the balance sheet) and the pass tag on locked doors ── */
.offer__perks { display: flex; flex-direction: column; gap: var(--sp-2); }
.offer__perk { display: flex; align-items: center; gap: var(--sp-3); font-family: var(--font-display); font-weight: 700; font-size: var(--fs-sm); line-height: 1.35; color: var(--text-on-panel); }
.offer__perk .svg { width: 14px; height: 14px; stroke-width: 3; flex: none; color: var(--accent2); }
.offer__perk small { font-weight: 500; color: var(--text-on-panel-soft); }
.pass-tag { display: inline-flex; align-items: center; gap: var(--sp-1); height: 20px; padding: 0 var(--sp-2); flex: none; border: 1px solid var(--accent2); border-radius: var(--r-pill); font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-primary); white-space: nowrap; }
.pass-tag b { font-weight: 700; color: var(--accent2); }
.lvl-note { font-size: var(--fs-caption); line-height: 1.5; color: var(--text-secondary); }
.lvl-note b { color: var(--text-primary); }
.lvl-sheet__body { font-size: var(--fs-body); line-height: 1.5; color: var(--text-secondary); }
.lvl-sheet__body b { color: var(--text-primary); }
.lvl-sheet__figs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; background: var(--surface-line); border: 1px solid var(--surface-line); border-radius: var(--r-card); overflow: hidden; }
.lvl-sheet__fig { display: flex; flex-direction: column; gap: var(--sp-1); padding: var(--sp-4); background: var(--surface); }
.lvl-sheet__fig b { font-family: var(--font-display); font-weight: 700; font-size: var(--fs-lead); line-height: 1; font-variant-numeric: tabular-nums; }
.lvl-sheet__fig span { font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-secondary); }
/* ── statistics, in the new register ── */
.stat-cap { display: flex; align-items: baseline; justify-content: space-between; gap: var(--sp-3); padding-bottom: var(--sp-2); border-bottom: 1px solid var(--surface-line); font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-secondary); }
.stat-cap b { color: var(--text-primary); }
.records--3 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.record__note { font-size: var(--fs-caption); color: var(--text-secondary); }
.cal--gold .cal__cell--1 { background: color-mix(in srgb, var(--accent2) 30%, transparent); }
.cal--gold .cal__cell--2 { background: color-mix(in srgb, var(--accent2) 55%, transparent); }
.cal--gold .cal__cell--3 { background: color-mix(in srgb, var(--accent2) 80%, transparent); }
.cal--gold .cal__cell--4 { background: var(--accent2); }
.forecast--pass .forecast__bar { background: color-mix(in srgb, var(--pass-ink) 55%, var(--text-primary)); }
`
