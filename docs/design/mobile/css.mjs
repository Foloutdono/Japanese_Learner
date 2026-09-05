// Shared stylesheet for every artboard. A near-verbatim subset of
// frontend/src/index.css: same tokens, same class names, same values,
// so a developer can diff a mockup rule against the real sheet.
export const CSS = String.raw`
/* ── tokens (dark, the default) ── */
.jp {
  color-scheme: dark;
  --text-on-panel:      #f3ecdf;
  --text-on-panel-soft: #b3a488;
  --text-on-fill:       #1c1811;
  --paper:              #f3ecdf;
  --hud-h:          36px;
  --safe-top:       28px;
  --safe-bottom:    24px;
  --surface:        color-mix(in srgb, var(--text-primary) 4%, var(--bg-card));
  --surface-line:   color-mix(in srgb, var(--text-primary) 15%, var(--border));
  --fs-caption-xs:  0.62rem; --fs-caption: 0.72rem; --fs-sm: 0.82rem; --fs-body: 0.95rem;
  --fs-lead: 1.12rem; --fs-title: 1.25rem; --fs-heading: 1.70rem; --fs-display: 2.50rem;
  --fs-specimen-glyph: 6.5rem; --fs-specimen-word: 4.5rem;
  --fs-display-fluid: clamp(1.9rem, 1.4rem + 2.2vw, 3.1rem);
  --tr-term: 0.06em; --tr-name: 0.14em; --tr-caption: 0.18em; --tr-reading: 0.30em;
  --sp-1: 4px; --sp-2: 6px; --sp-3: 8px; --sp-4: 12px; --sp-5: 16px; --sp-6: 22px; --sp-7: 28px; --sp-8: 44px; --sp-9: 52px;
  --r-flat: 0; --r-plate: 4px; --r-card: 6px; --r-panel: 8px; --r-identity: 10px; --r-pill: 999px;
  --elev-hang:   0 10px 26px rgba(0, 0, 0, 0.22);
  --elev-board:  0 24px 60px rgba(0, 0, 0, 0.34);
  --elev-action: 0 4px 16px color-mix(in srgb, var(--accent2) 30%, transparent);
  --font-serif:   'Noto Serif JP', serif;
  --font-display: 'Space Grotesk', 'Segoe UI', system-ui, sans-serif;
  --font-jp:      'Noto Sans JP', 'Yu Gothic', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --stamp-ink: #c33a2c;
  --bg-main: #17151a; --bg-card: #201d24; --bg-card-hover: #2a2530; --bg-panel: #100e13;
  --overlay-hover: rgba(255,255,255,0.035); --chip-bg: rgba(255,255,255,0.08);
  --accent: #c1442c; --accent2: #c99a3e; --accent3: #7c6a9c;
  --success: #7d9a5b; --warning: #d1a24a; --danger: #9c3428;
  --accent4: #3f6d8e; --accent8: #b26c7a; --accent9: #4f6aa8;
  --teal: #4f7a72; --rust: #a8622f; --rating-wrong: #b7402a;
  --text-primary: #ece5d8; --text-secondary: #a79c8c;
  --state-new: #beb3a0; --state-learning: #b7402a; --state-mastered: #a97a25; --state-due: #755894;
  --border: #35303a; --burger-menu-border: #35303a;
  --line-kana: #c1442c; --line-vocab: #3f6d8e; --line-kanji: #7c6a9c; --line-grammar: #6b8a4a;
  --line-reading: #4f7d7a; --line-rikai: #c1702f; --line-honyaku: #4f6aa8; --line-kaiseki: #7a4a6e;
  --line-jisho: #c99a3e; --line-decks: #9c4a5e; --line-exam: #8a6b4f; --line-douga: #7a8a3f;
  --pass-ink: #575060;
  --medal-gold: #c99a3e; --medal-silver: #a8adb4; --medal-bronze: #a8703f;
  --deck-action: var(--line-decks);
}
/* ── tokens (light — washi) ── */
.jp.light {
  color-scheme: light;
  --bg-main: #f6f1e4; --bg-card: #efe6d0; --bg-card-hover: #e7dabd; --bg-panel: #1e1912;
  --overlay-hover: rgba(28,24,17,0.045); --chip-bg: rgba(28,24,17,0.055);
  --accent: #b7402a; --accent2: #a97a25; --accent3: #6f5d8f;
  --success: #5c7a43; --warning: #ad7c2e; --danger: #93301f;
  --accent4: #375b78; --accent8: #9c5866; --accent9: #3f5488;
  --teal: #43645f; --rust: #8d5027; --rating-wrong: #b7402a; --stamp-ink: #b23425;
  --text-primary: #221d15; --text-secondary: #665c4a;
  --state-new: #1a1812; --state-learning: #b7402a; --state-mastered: #a97a25; --state-due: #755894;
  --border: #c3af7c; --burger-menu-border: #605947;
  --line-kana: #b7402a; --line-vocab: #375b78; --line-kanji: #6f5d8f; --line-grammar: #5a7540;
  --line-reading: #43645f; --line-rikai: #a85c26; --line-honyaku: #43598c; --line-kaiseki: #653d5b;
  --line-jisho: #a97a25; --line-decks: #853d4e; --line-exam: #7a5c40; --line-douga: #6a7a35;
  --pass-ink: #4a4452;
  --medal-gold: #a97a25; --medal-silver: #8d939b; --medal-bronze: #8a5527;
}

/* ── base ── */
.jp, .jp * { box-sizing: border-box; margin: 0; padding: 0; }
.jp {
  background: var(--bg-main);
  color: var(--text-primary);
  font-family: var(--font-display);
  font-size: var(--fs-body);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
:where(.jp button) { cursor: pointer; color: inherit; background: none; border: none; font-family: inherit; font-weight: 600; }
.jp a { color: var(--accent2); }
.jp a:hover { color: var(--text-primary); }
.jp [lang="ja"] { font-family: var(--font-jp); }
.serif { font-family: var(--font-serif) !important; }
.fig-num { font-family: var(--font-display); font-weight: 700; line-height: 1; font-variant-numeric: tabular-nums; }
.cap {
  font-family: var(--font-display);
  font-size: var(--fs-caption-xs);
  font-weight: 700;
  letter-spacing: var(--tr-caption);
  text-transform: uppercase;
  color: var(--text-secondary);
}
.svg { width: 16px; height: 16px; flex: none; stroke: currentColor; fill: none; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }

/* ── the phone ── */
.phone {
  position: relative;
  width: 390px;
  height: 844px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background:
    radial-gradient(ellipse 130% 52% at 50% 30%, color-mix(in srgb, var(--text-primary) 5%, transparent), transparent 72%),
    var(--bg-main);
}
.phone__content {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: var(--sp-3) var(--sp-5) 0;
  gap: var(--sp-4);
}
.phone__content--flush { padding: 0; gap: 0; }
.phone__content > * { flex: none; }

/* ── 運行案内 — the HUD (top bar). Sumi, two registers of ink, no line colour. ── */
.hud {
  flex: none;
  background: var(--bg-panel);
  color: var(--text-on-panel);
  padding-top: var(--safe-top);
  z-index: 10;
}
.hud__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--sp-3);
  height: 48px;
  padding: 0 var(--sp-5);
}
.hud__level {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex: none;
  position: relative;
  border: 2px solid color-mix(in srgb, var(--pass-ink) 70%, var(--text-on-panel));
  border-radius: var(--r-pill);
  font-family: var(--font-display);
  font-weight: 700;
  font-size: var(--fs-caption);
  font-variant-numeric: tabular-nums;
  line-height: 1;
  color: var(--text-on-panel);
}
.hud__level > span { display: block; line-height: 1; }
.hud__level--gain { box-shadow: 0 0 0 5px color-mix(in srgb, var(--accent2) 35%, transparent); }
.hud-fare {
  position: absolute;
  top: 50%; left: 100%;
  margin-left: var(--sp-3);
  transform: translateY(-50%);
  display: inline-flex; align-items: baseline; gap: var(--sp-1);
  font-family: var(--font-display); font-weight: 700; font-size: var(--fs-body); line-height: 1;
  font-variant-numeric: tabular-nums; white-space: nowrap; color: var(--accent2);
}
.hud-fare__unit { font-size: var(--fs-caption-xs); letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-on-panel-soft); }
.hud__status {
  --st: var(--success);
  --st-ink: var(--success);
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  height: 30px;
  padding: 0 var(--sp-4);
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: var(--r-plate);
  background: color-mix(in srgb, #000 22%, var(--bg-panel));
  white-space: nowrap;
  overflow: hidden;
}
.hud__status::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: repeating-linear-gradient(0deg, rgba(255,255,255,0.03) 0 1px, transparent 1px 3px); }
.hud__status-word { font-family: var(--font-display); font-size: var(--fs-caption); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--st-ink); }
.hud__status-delta { font-family: var(--font-display); font-size: var(--fs-caption); font-weight: 700; letter-spacing: 0.04em; font-variant-numeric: tabular-nums; color: var(--text-on-panel-soft); }
.hud__status--slightlyBehind { --st: var(--warning); --st-ink: var(--warning); }
.hud__status--delayed, .hud__status--suspended { --st: var(--danger); --st-ink: color-mix(in srgb, var(--danger) 55%, var(--text-on-panel)); }
.hud__pass {
  display: inline-flex;
  align-items: center;
  gap: var(--sp-2);
  height: 34px;
  padding: 0 var(--sp-3) 0 var(--sp-3);
  border-radius: var(--r-card);
  background: linear-gradient(122deg, color-mix(in srgb, var(--pass-ink) 34%, var(--bg-panel)) 0%, var(--bg-panel) 58%);
  border: 1px solid color-mix(in srgb, var(--pass-ink) 45%, transparent);
  color: var(--text-on-panel);
  flex: none;
}
.hud__pass-wave { position: relative; width: 16px; height: 18px; flex-shrink: 0; }
.hud__pass-wave span { position: absolute; top: 50%; left: 1px; border: 1.5px solid var(--text-on-panel); border-color: transparent var(--text-on-panel) transparent transparent; border-radius: 50%; opacity: 0.75; }
.hud__pass-wave span:nth-child(1) { width: 6px; height: 6px; margin-top: -3px; }
.hud__pass-wave span:nth-child(2) { width: 11px; height: 11px; margin-top: -5.5px; opacity: 0.5; }
.hud__pass-wave span:nth-child(3) { width: 16px; height: 16px; margin-top: -8px; opacity: 0.3; }
.hud__pass-fig { display: inline-flex; align-items: baseline; font-family: var(--font-display); font-weight: 700; font-size: 12px; letter-spacing: 0.04em; line-height: 1; font-variant-numeric: tabular-nums; color: var(--accent2); }
.hud__pass-of { font-size: 11px; font-weight: 600; color: var(--text-on-panel-soft); }
.hud__pass-fig--inf { font-size: 1.05rem; }
.hud__pass--low { border-color: color-mix(in srgb, var(--warning) 70%, transparent); }
.hud__pass--out { border-color: color-mix(in srgb, var(--danger) 70%, var(--text-on-panel)); }
.hud__pass--out .hud__pass-fig { color: color-mix(in srgb, var(--danger) 55%, var(--text-on-panel)); }

/* ── 改札口 — the tab bar. Sumi, docked, five gates. ── */
.tabbar {
  flex: none;
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  background: var(--bg-panel);
  color: var(--text-on-panel);
  border-top: 1px solid var(--burger-menu-border);
  padding-bottom: var(--safe-bottom);
  z-index: 30;
}
.tab {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  height: 50px;
  padding: 0;
  border-radius: 0;
  color: var(--text-on-panel-soft);
}
.tab__jp { font-family: var(--font-jp); font-weight: 700; font-size: 1.05rem; line-height: 1.15; letter-spacing: 0.04em; }
.tab__cap { font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; }
.tab--on { color: var(--text-on-panel); }
.tab--on::before { content: ''; position: absolute; top: -1px; left: 22px; right: 22px; height: 2px; background: var(--text-on-panel); }
.tab--badged .tab__jp { transform: translateX(-10px); }
.tab__due {
  position: absolute;
  top: 3px;
  left: calc(50% + 8px);
  display: inline-flex;
  align-items: baseline;
  gap: 2px;
  padding: 1px 6px;
  border-radius: var(--r-pill);
  border: 1px solid color-mix(in srgb, var(--warning) 55%, transparent);
  color: var(--warning);
  font-family: var(--font-display);
  font-size: var(--fs-caption-xs);
  font-weight: 700;
  line-height: 1.3;
  font-variant-numeric: tabular-nums;
  background: var(--bg-panel);
}

/* ── the compact header: one row, a pigment rule under it ── */
.bar { --line-color: var(--accent2); display: flex; flex-direction: column; gap: var(--sp-2); }
.bar--register { --line-color: var(--text-secondary); }
.bar__row { display: flex; align-items: center; gap: var(--sp-3); min-height: 40px; }
.bar__roundel { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: 50%; border: 2px solid var(--line-color); color: color-mix(in srgb, var(--line-color) 65%, var(--text-primary)); font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: 0.04em; line-height: 1; }
.bar__names { display: flex; align-items: baseline; gap: var(--sp-3); min-width: 0; flex: 1; }
.bar__title { flex: none; font-family: var(--font-serif); font-weight: 700; font-size: var(--fs-title); line-height: 1.2; white-space: nowrap; }
.bar__sub { min-width: 0; overflow: hidden; text-overflow: ellipsis; font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-secondary); white-space: nowrap; }
.bar__aside { display: flex; align-items: center; gap: var(--sp-3); flex-shrink: 0; }
.bar__stripe { height: 2px; background: var(--line-color); }
.bar--register .bar__stripe { height: 1px; background: var(--surface-line); }

/* ── 駅名標 — the plate (kept for the chrome sheet) ── */
.plate { --line-color: var(--accent2); margin-bottom: 0; }
.plate__head { display: flex; align-items: stretch; justify-content: space-between; gap: 12px 20px; margin-bottom: 12px; }
.plate__names { display: flex; align-items: center; gap: 14px; min-width: 0; }
.plate__roundel {
  flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center;
  width: 34px; height: 34px; border-radius: 50%;
  border: 2.5px solid var(--line-color);
  color: color-mix(in srgb, var(--line-color) 65%, var(--text-primary));
  font-family: var(--font-display); font-size: 11px; font-weight: 700; letter-spacing: 0.04em;
}
.plate__stack { display: flex; flex-direction: column; min-width: 0; }
.plate__kana { font-family: var(--font-jp); font-size: 0.78rem; letter-spacing: 0.28em; text-indent: 0.28em; color: var(--text-secondary); line-height: 1.5; }
.plate__name { font-family: var(--font-serif); font-weight: 700; font-size: var(--fs-display-fluid); line-height: 1.15; letter-spacing: 0.14em; text-indent: 0.14em; color: var(--text-primary); }
.plate__romaji { font-family: var(--font-display); font-size: 0.72rem; font-weight: 700; letter-spacing: 0.3em; text-indent: 0.3em; text-transform: uppercase; color: var(--text-secondary); margin-top: 5px; }
.plate__aside { display: flex; flex-direction: column; align-items: flex-end; justify-content: space-between; gap: 10px; flex-shrink: 0; text-align: right; }
.plate__noriba { display: flex; flex-direction: column; align-items: flex-end; gap: 1px; }
.plate__noriba-jp { display: flex; align-items: baseline; gap: 6px; font-family: var(--font-jp); font-weight: 700; font-size: 0.8rem; color: var(--text-secondary); }
.plate__count { font-family: var(--font-display); font-size: 1.1rem; font-weight: 700; line-height: 1; color: color-mix(in srgb, var(--line-color) 65%, var(--text-primary)); font-variant-numeric: tabular-nums; }
.plate__stripe { height: 4px; background: var(--line-color); }
.plate--register { --line-color: var(--text-secondary); }
.plate--register .plate__stripe { height: 1px; background: var(--surface-line); }
.board-clock { font-family: var(--font-display); font-weight: 700; font-size: 1.15rem; letter-spacing: 0.06em; color: var(--accent2); font-variant-numeric: tabular-nums; }
.board-clock__colon { padding: 0 1px; opacity: 0.6; }

/* ── the card surface ── */
.surface { background: var(--surface); border: 1px solid var(--surface-line); border-radius: var(--r-card); }

/* ── 改札 — the fare gate card ── */
.gate-card {
  display: flex; flex-direction: column; gap: var(--sp-5);
  padding: var(--sp-6);
  background: var(--surface); border: 1px solid var(--surface-line); border-radius: var(--r-panel);
}
.gate-card__head { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-4); }
.gate-card__name { display: flex; flex-direction: column; }
.gate-card__jp { font-family: var(--font-serif); font-weight: 700; font-size: var(--fs-title); letter-spacing: var(--tr-name); }
.gate-card__title { font-family: var(--font-serif); font-weight: 700; font-size: var(--fs-lead); }
.gate-card__latin { font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-secondary); }
.gate-card__figure { display: flex; align-items: baseline; gap: var(--sp-2); }
.gate-card__count { font-family: var(--font-display); font-weight: 700; font-size: var(--fs-heading); line-height: 1; font-variant-numeric: tabular-nums; color: color-mix(in srgb, var(--accent2) 60%, var(--text-primary)); }
.gate-card__unit { font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-secondary); }
.gate-card__clear { font-size: var(--fs-body); font-weight: 600; color: var(--success); }
.gate-card__when { font-size: var(--fs-sm); color: var(--text-secondary); }
.gate-card__lanes { display: flex; flex-direction: column; gap: var(--sp-2); }
.lane {
  display: flex; align-items: center; gap: var(--sp-3);
  min-height: 44px;
  padding: var(--sp-2) var(--sp-4);
  border-radius: var(--r-card);
  border: 1px solid color-mix(in srgb, var(--lane-color, var(--accent2)) 30%, transparent);
  background: color-mix(in srgb, var(--lane-color, var(--accent2)) 10%, transparent);
  font-size: var(--fs-sm);
  color: var(--text-primary);
  text-align: left;
}
.lane--off { opacity: 0.5; border-color: var(--surface-line); background: transparent; }
.lane__tick { flex: none; width: 16px; height: 16px; border-radius: var(--r-plate); border: 1.5px solid color-mix(in srgb, var(--text-secondary) 60%, transparent); display: flex; align-items: center; justify-content: center; color: var(--bg-main); }
.lane:not(.lane--off) .lane__tick { background: var(--lane-color, var(--accent2)); border-color: var(--lane-color, var(--accent2)); }
.lane__tick .svg { width: 11px; height: 11px; stroke-width: 3; }
.lane__where { font-family: var(--font-display); font-weight: 700; color: color-mix(in srgb, var(--lane-color, var(--accent2)) 45%, var(--text-primary)); white-space: nowrap; }
.lane__mode { color: color-mix(in srgb, var(--text-secondary) 60%, var(--text-primary)); font-size: var(--fs-caption); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.lane__due { margin-left: auto; font-weight: 700; font-variant-numeric: tabular-nums; }
.gate-card__fare { display: flex; align-items: center; gap: var(--sp-3); font-size: var(--fs-sm); color: var(--text-secondary); }
.gate-card__fare b { font-family: var(--font-display); font-weight: 700; color: var(--text-primary); font-variant-numeric: tabular-nums; }
.gate-card__fare .fare-gold { color: var(--accent2); }
.gate-card__fare-sep { flex: 1; height: 1px; background: var(--surface-line); align-self: center; }
.gate-card__short { display: flex; align-items: center; gap: var(--sp-3); padding: var(--sp-3) var(--sp-4); border-radius: var(--r-card); border: 1px solid color-mix(in srgb, var(--warning) 45%, transparent); color: var(--warning); font-size: var(--fs-sm); }
.gate-card__short .svg { color: var(--warning); }
.btn-depart {
  display: flex; align-items: center; justify-content: center; flex-wrap: wrap;
  gap: var(--sp-1) var(--sp-3);
  min-height: 48px;
  padding: var(--sp-4) var(--sp-5);
  background: color-mix(in srgb, var(--accent2) 60%, var(--bg-panel));
  color: var(--text-on-panel);
  border-radius: var(--r-card);
  font-weight: 700;
  box-shadow: var(--elev-action);
}
.btn-depart__jp { font-family: var(--font-display); font-size: var(--fs-body); font-weight: 700; white-space: nowrap; }
.btn-depart__latin { font-family: var(--font-display); font-size: var(--fs-caption-xs); letter-spacing: var(--tr-caption); text-transform: uppercase; opacity: 0.8; }
.btn-depart__go { font-size: var(--fs-caption); opacity: 0.8; }
.btn-depart--sheet { box-shadow: none; }
.btn-depart--ghost { background: transparent; border: 1px solid var(--surface-line); color: var(--text-primary); box-shadow: none; }
.btn-primary { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: var(--sp-3) var(--sp-5); border-radius: var(--r-panel); background: color-mix(in srgb, var(--line-color, var(--accent)) 70%, var(--bg-panel)); color: var(--text-on-panel); font-weight: 600; font-size: var(--fs-body); }
.btn-primary--gold { background: color-mix(in srgb, var(--accent2) 60%, var(--bg-panel)); }
.btn-secondary { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: var(--sp-3) var(--sp-5); border-radius: var(--r-panel); background: transparent; border: 1px solid var(--surface-line); color: var(--text-primary); font-weight: 600; }

/* ── 定期券 — the pass ── */
.pass {
  --pass-color: var(--pass-ink);
  position: relative; display: flex; flex-direction: column; gap: 18px;
  padding: 20px 18px 18px;
  background: linear-gradient(155deg, color-mix(in srgb, var(--pass-color) 38%, var(--bg-panel)) 0%, var(--bg-panel) 62%);
  border: 1px solid color-mix(in srgb, var(--pass-color) 45%, transparent);
  border-radius: var(--r-identity);
  overflow: hidden;
  color: var(--text-on-panel);
}
.pass::after { content: ''; position: absolute; inset: -40% 55% -40% -20%; background: linear-gradient(105deg, transparent 30%, rgba(255,255,255,0.045) 50%, transparent 70%); transform: skewX(-12deg); pointer-events: none; }
.pass__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; }
.pass__brand { display: flex; align-items: center; gap: 12px; }
.pass__wave { position: relative; width: 20px; height: 22px; flex-shrink: 0; }
.pass__wave span { position: absolute; top: 50%; left: 1px; border: 1.6px solid var(--text-on-panel); border-color: transparent var(--text-on-panel) transparent transparent; border-radius: 50%; opacity: 0.7; }
.pass__wave span:nth-child(1) { width: 7px; height: 7px; margin-top: -3.5px; }
.pass__wave span:nth-child(2) { width: 13px; height: 13px; margin-top: -6.5px; opacity: 0.45; }
.pass__wave span:nth-child(3) { width: 20px; height: 20px; margin-top: -10px; opacity: 0.25; }
.pass__brand-names { display: flex; flex-direction: column; gap: 1px; }
.pass__brand-jp { font-family: var(--font-jp); font-weight: 700; font-size: 0.92rem; letter-spacing: 0.14em; }
.pass__brand-sub { font-family: var(--font-display); font-size: var(--fs-caption); font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--text-on-panel); }
.pass__head-right { display: flex; align-items: center; gap: var(--sp-3); }
.pass__gear { display: inline-flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: var(--r-pill); border: 1px solid rgba(255,255,255,0.18); color: var(--text-on-panel-soft); padding: 0; }
.pass__issuer { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; min-width: 34px; height: 26px; padding: 0 7px; border-radius: var(--r-pill); border: 2px solid var(--accent2); color: color-mix(in srgb, var(--accent2) 85%, var(--text-on-panel)); font-family: var(--font-display); font-size: 12px; font-weight: 700; letter-spacing: 0.04em; }
.pass__body { display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.pass__holder { display: flex; align-items: center; gap: 14px; min-width: 0; }
.pass__avatar-wrap { position: relative; width: 64px; height: 64px; flex-shrink: 0; }
.pass__ring { position: absolute; inset: 0; width: 100%; height: 100%; transform: rotate(-90deg); }
.pass__ring-track { fill: none; stroke: rgba(255,255,255,0.12); stroke-width: 5; }
.pass__ring-fill { fill: none; stroke: var(--accent2); stroke-width: 5; stroke-linecap: round; }
.pass__avatar { position: absolute; inset: 8px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: color-mix(in srgb, var(--pass-color) 45%, var(--bg-panel)); font-family: var(--font-serif); font-weight: 700; font-size: 1.4rem; color: var(--text-on-panel); }
.pass__name { font-family: var(--font-serif); font-size: var(--fs-title); font-weight: 700; line-height: 1.15; }
.pass__ranks { display: flex; flex-direction: column; align-items: flex-start; }
.pass__rank-jp { font-family: var(--font-jp); font-weight: 700; font-size: var(--fs-lead); letter-spacing: var(--tr-term); }
.pass__rank-latin { font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-on-panel-soft); }
.pass__balance { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; }
.pass__balance-meter { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.pass__xp { font-family: var(--font-display); font-size: var(--fs-sm); font-weight: 700; font-variant-numeric: tabular-nums; color: var(--text-on-panel-soft); }
.pass__track { height: 5px; border-radius: var(--r-pill); background: rgba(255,255,255,0.14); overflow: hidden; }
.pass__fill { display: block; height: 100%; background: var(--accent2); }
.pass__level { display: flex; flex-direction: column; align-items: flex-end; line-height: 1; flex-shrink: 0; }
.pass__level-num { font-family: var(--font-display); font-weight: 700; font-size: 1.9rem; line-height: 0.95; color: var(--text-on-panel); font-variant-numeric: tabular-nums; }
.pass__level-label { font-family: var(--font-display); font-size: 0.55rem; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: var(--text-on-panel-soft); margin-top: 5px; }
.pass__footer { display: flex; flex-direction: column; gap: var(--sp-4); }
.pass__footer-rule { height: 1px; background: rgba(255,255,255,0.12); }
.pass--strip { gap: 14px; padding: 14px 16px; }

/* ── スタンプラリー ── */
.stamp-rally { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-4); }
.stamp-rally__row { display: flex; align-items: center; gap: var(--sp-2); }
.stamp-rally__stamp { width: 26px; height: 26px; border-radius: var(--r-pill); display: inline-flex; align-items: center; justify-content: center; font-family: var(--font-display); font-size: var(--fs-caption-xs); line-height: 1; font-weight: 700; border: 1.5px solid color-mix(in srgb, var(--stamp-ink) 55%, transparent); color: color-mix(in srgb, var(--stamp-ink) 70%, var(--text-on-panel)); background: color-mix(in srgb, var(--stamp-ink) 12%, transparent); transform: rotate(var(--stamp-tilt, 0deg)); }
.stamp-rally__stamp--missed { border-style: dashed; border-color: rgba(255,255,255,0.2); background: transparent; color: var(--text-on-panel-soft); opacity: 0.6; }
.stamp-rally__stamp--today { border-width: 2px; border-color: var(--stamp-ink); background: color-mix(in srgb, var(--stamp-ink) 22%, transparent); }
.stamp-rally__label { display: flex; flex-direction: column; text-align: right; }
.stamp-rally__count { font-family: var(--font-display); font-weight: 700; font-size: var(--fs-sm); font-variant-numeric: tabular-nums; line-height: 1.3; }
.stamp-rally__unit { font-family: var(--font-display); font-size: var(--fs-caption-xs); margin-left: 3px; color: var(--text-on-panel-soft); }
.stamp-rally__caption { font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-on-panel-soft); }
.hall-pace { display: flex; align-items: center; gap: var(--sp-4); }
.hall-pace__name { display: flex; align-items: baseline; gap: var(--sp-2); flex-shrink: 0; }
.hall-pace__jp { font-family: var(--font-jp); font-weight: 700; font-size: var(--fs-sm); }
.hall-pace__latin { font-family: var(--font-display); font-size: var(--fs-caption-xs); letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-on-panel-soft); }
.hall-pace__bar { flex: 1; height: 5px; border-radius: var(--r-pill); background: color-mix(in srgb, var(--accent2) 18%, transparent); overflow: hidden; }
.hall-pace__fill { display: block; height: 100%; border-radius: inherit; background: var(--accent2); }
.hall-pace__count { flex-shrink: 0; font-variant-numeric: tabular-nums; font-weight: 700; font-size: var(--fs-sm); }
.hall-pace__sep { color: var(--text-on-panel-soft); font-weight: 400; }

/* ── 運行状況 — the journey line on the pass, and its back ── */
.jour-line { display: flex; align-items: baseline; gap: var(--sp-4); flex-wrap: wrap; }
.jour-st--onTime, .jour-st--ahead { --jour-st: var(--success); --jour-st-ink: var(--success); }
.jour-st--slightlyBehind { --jour-st: var(--warning); --jour-st-ink: var(--warning); }
.jour-st--delayed, .jour-st--suspended { --jour-st: var(--danger); --jour-st-ink: color-mix(in srgb, var(--danger) 55%, var(--text-on-panel)); }
.jour-line__status { display: flex; align-items: baseline; gap: var(--sp-3); }
.jour-line__status b { font-family: var(--font-display); font-weight: 700; font-size: var(--fs-sm); letter-spacing: 0.04em; text-transform: uppercase; color: var(--jour-st-ink, var(--text-on-panel)); }
.jour-cap { font-size: var(--fs-caption-xs); font-weight: 700; text-transform: uppercase; letter-spacing: var(--tr-caption); color: var(--text-on-panel-soft); }
.jour-line__validity { display: flex; align-items: baseline; gap: var(--sp-2); font-variant-numeric: tabular-nums; }
.jour-line__validity [lang="ja"] { font-family: var(--font-jp); font-size: var(--fs-caption-xs); color: var(--text-on-panel-soft); }
.jour-line__validity b { font-family: var(--font-display); font-weight: 700; font-size: var(--fs-sm); color: var(--accent2); }
.jour-line__turn { margin-left: auto; padding: var(--sp-2) 0; color: var(--text-on-panel-soft); font-size: var(--fs-caption); font-weight: 400; text-decoration: underline; text-underline-offset: 3px; white-space: nowrap; }
.jour-rev { display: flex; flex-direction: column; gap: var(--sp-5); padding: var(--sp-6) var(--sp-5) var(--sp-6); background: var(--bg-panel); border: 1px solid color-mix(in srgb, var(--pass-ink) 45%, transparent); border-radius: var(--r-identity); color: var(--text-on-panel); }
.jour-rev__head { display: flex; align-items: baseline; gap: var(--sp-4); flex-wrap: wrap; }
.jour-rev__title, .jour-rev__status { display: flex; align-items: baseline; gap: var(--sp-3); }
.jour-rev__title b { font-family: var(--font-jp); font-weight: 700; font-size: var(--fs-body); }
.jour-rev__status { margin-left: auto; }
.jour-rev__status b { font-family: var(--font-jp); font-weight: 700; font-size: var(--fs-lead); color: var(--jour-st-ink, var(--text-on-panel)); }
.jour-track { position: relative; height: 140px; }
.jour-track__span { position: absolute; inset: 0 20px; }
.jour-track__rail { position: absolute; left: 0; right: 0; top: 38px; height: 4px; border-radius: var(--r-plate); background: color-mix(in srgb, var(--text-on-panel) 18%, transparent); }
.jour-track__done { position: absolute; left: 0; top: 38px; height: 4px; border-radius: var(--r-plate); background: var(--jour-st, var(--success)); }
.jour-track__station { position: absolute; top: 34px; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: var(--sp-2); }
.jour-track__station i { width: 12px; height: 12px; border-radius: var(--r-pill); background: var(--bg-panel); border: 3px solid color-mix(in srgb, var(--text-on-panel) 70%, transparent); }
.jour-track__station--past i { background: var(--jour-st, var(--success)); border-color: var(--jour-st, var(--success)); }
.jour-track__station-name { font-family: var(--font-jp); font-size: var(--fs-caption); font-weight: 700; color: var(--text-on-panel-soft); white-space: nowrap; }
.jour-track__station-name--latin { font-family: var(--font-display); letter-spacing: var(--tr-term); font-variant-numeric: tabular-nums; }
.jour-track__gap { position: absolute; top: 118px; height: 0; border-top: 2px solid var(--jour-st, var(--warning)); }
.jour-track__gap::before, .jour-track__gap::after { content: ''; position: absolute; top: -5px; width: 2px; height: 8px; background: var(--jour-st, var(--warning)); }
.jour-track__gap::before { left: 0; }
.jour-track__gap::after { right: 0; }
.jour-track__gap b { position: absolute; left: 50%; top: 4px; transform: translateX(-50%); font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; font-variant-numeric: tabular-nums; color: var(--jour-st-ink, var(--warning)); white-space: nowrap; }
.jour-figs { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.12); border-radius: var(--r-card); overflow: hidden; }
.jour-fig { display: flex; flex-direction: column; gap: var(--sp-1); padding: var(--sp-4); background: var(--bg-panel); }
.jour-fig__v { display: flex; align-items: baseline; gap: var(--sp-2); font-family: var(--font-display); font-weight: 700; font-size: var(--fs-title); line-height: 1; font-variant-numeric: tabular-nums; color: var(--text-on-panel); }
.jour-fig__v--st { color: var(--jour-st-ink, var(--text-on-panel)); }
.jour-fig__u { font-size: var(--fs-sm); font-weight: 600; color: var(--text-on-panel-soft); }
.jour-fig__l { font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-on-panel-soft); }
.jour-track__you, .jour-track__plan { position: absolute; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: var(--sp-1); }
.jour-track__you { top: 2px; }
.jour-track__plan { top: 76px; }
.jour-track__tag { font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); color: var(--text-on-panel-soft); white-space: nowrap; }
.jour-track__you i { width: 20px; height: 13px; border-radius: var(--r-plate); background: var(--jour-st, var(--success)); }
.jour-track__plan i { width: 20px; height: 13px; border-radius: var(--r-plate); border: 2px dashed color-mix(in srgb, var(--text-on-panel) 50%, transparent); }
.jour-rev__foot { font-size: var(--fs-sm); line-height: 1.55; color: var(--text-on-panel-soft); }
.jour-rev__foot b { color: var(--text-on-panel); font-weight: 700; }
.jour-rev__actions { display: grid; grid-template-columns: 1fr; gap: var(--sp-3); }
.jour-act { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; min-height: 48px; padding: var(--sp-3) var(--sp-4); border: 1px solid rgba(255,255,255,0.16); border-radius: var(--r-card); text-align: left; font-size: var(--fs-caption); font-weight: 400; color: var(--text-on-panel-soft); }
.jour-act strong { display: flex; align-items: baseline; gap: var(--sp-3); font-family: var(--font-display); font-size: var(--fs-sm); font-weight: 700; color: var(--text-on-panel); }
.jour-act strong [lang="ja"] { font-family: var(--font-jp); }

/* ── 路線図 — the wall map (the Learning tab) ── */
.board {
  position: relative;
  background: linear-gradient(180deg, color-mix(in srgb, #fff 3%, var(--bg-panel)) 0%, var(--bg-panel) 34%, color-mix(in srgb, #000 12%, var(--bg-panel)) 100%);
  border: 1px solid color-mix(in srgb, var(--accent2) 16%, transparent);
  border-radius: 8px;
  overflow: hidden;
  color: var(--text-on-panel);
  box-shadow: var(--elev-board);
}
.board::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: repeating-linear-gradient(0deg, rgba(255,255,255,0.022) 0 1px, transparent 1px 3px); }
.board__masthead { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; padding: 18px 18px 14px; }
.board__station { display: flex; align-items: center; gap: 14px; min-width: 0; }
.board__roundel { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; min-width: 34px; height: 26px; padding: 0 7px; border-radius: 999px; border: 2px solid var(--accent2); color: color-mix(in srgb, var(--accent2) 85%, var(--text-on-panel)); font-family: var(--font-display); font-size: 12px; font-weight: 700; letter-spacing: 0.04em; }
.board__station-names { display: flex; flex-direction: column; min-width: 0; align-items: center; }
.board__kana { font-family: var(--font-jp); font-size: 0.72rem; letter-spacing: 0.3em; text-indent: 0.3em; opacity: 0.55; }
.board__name { font-family: var(--font-serif); font-weight: 700; font-size: 1.6rem; line-height: 1.15; letter-spacing: 0.14em; text-indent: 0.14em; }
.board__romaji { font-family: var(--font-display); font-size: 0.7rem; font-weight: 700; letter-spacing: 0.26em; text-indent: 0.26em; text-transform: uppercase; opacity: 0.5; margin-top: 5px; }
.board__now { display: flex; flex-direction: column; align-items: flex-end; justify-content: space-between; gap: 6px; }
.board__label { display: flex; align-items: baseline; gap: 8px; font-family: var(--font-jp); font-weight: 700; letter-spacing: 0.12em; color: color-mix(in srgb, var(--accent2) 85%, var(--text-on-panel)); }
.board__label-sub { font-family: var(--font-display); font-size: 0.6rem; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; }
.board .board-clock { color: color-mix(in srgb, var(--accent2) 85%, var(--text-on-panel)); }
.board__stripe { height: 4px; background: var(--accent2); }
.wmap__lines { display: flex; flex-direction: column; padding: var(--sp-3) var(--sp-3) var(--sp-2); }
.wmap-line { position: relative; display: flex; flex-wrap: wrap; align-items: center; gap: var(--sp-3) var(--sp-4); width: 100%; padding: var(--sp-4) var(--sp-3); border-radius: var(--r-card); color: inherit; text-align: left; }
.wmap-line--on { background: rgba(255,255,255,0.055); }
.wmap-line--on::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--line-color, var(--accent2)); }
.wmap-roundel { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: var(--r-pill); border: 2px solid var(--line-color, var(--accent2)); color: color-mix(in srgb, var(--line-color, var(--accent2)) 55%, var(--text-on-panel)); font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; }
.wmap-roundel--sm { width: 24px; height: 24px; }
.wmap-line__id { flex: 1 1 auto; display: flex; align-items: center; gap: var(--sp-4); min-width: 0; }
.wmap-line__names, .wmap-row__names { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.wmap-line__jp, .wmap-row__jp { font-family: var(--font-display); font-weight: 700; font-size: var(--fs-body); line-height: 1.2; white-space: nowrap; }
.wmap-line__sen { margin-left: var(--sp-1); font-size: var(--fs-caption); opacity: 0.6; }
.wmap-line__latin, .wmap-row__latin { font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; opacity: 0.55; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wmap-line__due { order: 2; }
.wmap-line .wmap-track { flex: 1 1 100%; order: 3; }
.wmap-track { position: relative; height: 30px; }
.wmap-track__rail, .wmap-track__done { position: absolute; top: 9px; left: 0; height: 3px; border-radius: var(--r-pill); }
.wmap-track__rail { width: 100%; background: color-mix(in srgb, var(--line-color, var(--accent2)) 30%, transparent); }
.wmap-track__done { background: var(--line-color, var(--accent2)); }
.wmap-track__stop { position: absolute; top: 5px; width: 11px; height: 11px; border-radius: var(--r-pill); transform: translateX(-50%); border: 2px solid color-mix(in srgb, var(--line-color, var(--accent2)) 55%, var(--bg-panel)); background: var(--bg-panel); }
.wmap-track__stop--past { background: var(--line-color, var(--accent2)); border-color: var(--line-color, var(--accent2)); }
.wmap-track__stop--end { border-radius: var(--r-plate); }
.wmap-track__label { position: absolute; top: 19px; transform: translateX(-50%); font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-term); opacity: 0.6; font-variant-numeric: tabular-nums; white-space: nowrap; }
.wmap-track__label--end { opacity: 0.45; }
.wmap-track__train { position: absolute; top: 2px; width: 7px; height: 17px; border-radius: var(--r-pill); transform: translateX(-50%); background: color-mix(in srgb, var(--line-color, var(--accent2)) 70%, var(--text-on-panel)); }
.wmap-due { display: inline-flex; align-items: baseline; gap: var(--sp-1); padding: var(--sp-1) var(--sp-3); border-radius: var(--r-pill); border: 1px solid color-mix(in srgb, var(--warning) 55%, transparent); color: var(--warning); font-family: var(--font-display); font-size: var(--fs-caption); font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
.wmap-due__unit { font-family: var(--font-display); font-weight: 700; font-size: var(--fs-caption-xs); letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.8; margin-left: 2px; }
.wmap__group { display: flex; flex-direction: column; padding: var(--sp-2) var(--sp-3) var(--sp-3); border-top: 1px solid rgba(255,255,255,0.06); }
.wmap__caption { display: flex; align-items: baseline; gap: var(--sp-3); padding: var(--sp-3) var(--sp-3) var(--sp-2); }
.wmap__caption-jp { font-family: var(--font-jp); font-weight: 700; font-size: var(--fs-caption); letter-spacing: var(--tr-name); color: color-mix(in srgb, var(--accent2) 85%, var(--text-on-panel)); }
.wmap__caption-latin { font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; opacity: 0.55; }
.wmap-row { position: relative; display: grid; grid-template-columns: 30px minmax(0, auto) minmax(0, 1fr) 22px; gap: var(--sp-4); align-items: center; width: 100%; padding: var(--sp-4) var(--sp-3); border-radius: var(--r-card); color: inherit; text-align: left; }
.wmap-row__note { display: flex; justify-content: flex-end; align-items: center; min-width: 0; }
.wmap-row__go { justify-self: end; font-size: var(--fs-caption-xs); color: color-mix(in srgb, var(--line-color, var(--accent2)) 55%, var(--text-on-panel)); opacity: 0.7; }

/* ── platform cards (のりば) ── */
.platform-grid { display: flex; flex-direction: column; gap: var(--sp-4); }
.platform-card {
  --rail: var(--row-color, var(--line-color, var(--accent)));
  position: relative; display: flex; align-items: stretch; gap: 0; width: 100%;
  background: var(--surface); border: 1px solid var(--surface-line); border-radius: 6px; overflow: hidden;
  color: var(--text-primary); text-align: left;
}
.platform-card--local { --rail: var(--text-secondary); }
.platform-card--rapid { --rail: var(--accent4); }
.platform-card--express { --rail: var(--warning); }
.platform-card--ltd { --rail: var(--accent); }
.platform-card--review { --rail: var(--text-secondary); }
.platform-card__lead { position: relative; flex-shrink: 0; width: 66px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; padding: 14px 4px 14px 14px; }
.platform-card__no { display: inline-flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 50%; border: 2.5px solid var(--rail); font-family: var(--font-display); font-weight: 700; font-size: 1.05rem; line-height: 1; color: color-mix(in srgb, var(--rail) 65%, var(--text-primary)); font-variant-numeric: tabular-nums; }
.platform-card__unit { font-family: var(--font-display); font-size: 0.6rem; letter-spacing: 0.08em; text-transform: uppercase; color: var(--text-secondary); }
.platform-card__service { font-family: var(--font-display); font-weight: 700; font-size: var(--fs-caption-xs); letter-spacing: 0.06em; text-transform: uppercase; line-height: 1.15; color: color-mix(in srgb, var(--rail) 65%, var(--text-primary)); text-align: center; white-space: nowrap; }
.platform-card__stops { display: flex; gap: 3px; }
.platform-card__pip { width: 4px; height: 4px; border-radius: 50%; background: var(--rail); opacity: 0.22; }
.platform-card__pip--on { opacity: 1; }
.platform-card__body { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: 4px; padding: 14px 10px 14px 12px; }
.platform-card__title { font-family: var(--font-serif); font-weight: 600; font-size: 1.08rem; line-height: 1.3; }
.platform-card__title-jp { font-family: var(--font-jp); font-weight: 500; font-size: var(--fs-caption); color: var(--text-secondary); margin-left: var(--sp-2); letter-spacing: var(--tr-term); }
.platform-card__desc { color: var(--text-secondary); font-size: 0.86rem; line-height: 1.45; }
.platform-card__sample { font-family: var(--font-jp); font-size: var(--fs-sm); color: var(--text-secondary); letter-spacing: 0.12em; }
.platform-card__aside { flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; justify-content: center; gap: var(--sp-2); padding: var(--sp-4) var(--sp-4); border-left: 1px solid var(--surface-line); min-width: 74px; }
.platform-card__go { align-self: center; flex-shrink: 0; padding-right: 12px; font-size: 0.7rem; color: color-mix(in srgb, var(--rail) 65%, var(--text-primary)); opacity: 0.7; }
.platform-card--line { --rail: var(--line-color); }

/* ── the level line (LevelSelector's route) ── */
.route { position: relative; display: flex; flex-direction: column; gap: var(--sp-3); padding-left: 30px; }
.route::before { content: ''; position: absolute; left: 10px; top: 28px; bottom: 28px; width: 3px; border-radius: var(--r-pill); background: color-mix(in srgb, var(--line-color) 35%, transparent); }
.route__done { position: absolute; left: 10px; top: 28px; width: 3px; border-radius: var(--r-pill); background: var(--line-color); }
.route-stop { position: relative; display: flex; align-items: center; gap: var(--sp-4); min-height: 56px; padding: var(--sp-3) var(--sp-4); background: var(--surface); border: 1px solid var(--surface-line); border-radius: var(--r-card); text-align: left; color: var(--text-primary); }
.route-stop::before { content: ''; position: absolute; left: -25px; top: 50%; width: 11px; height: 11px; border-radius: var(--r-pill); transform: translate(-50%, -50%); border: 2px solid color-mix(in srgb, var(--line-color) 55%, var(--bg-main)); background: var(--bg-main); }
.route-stop--past::before { background: var(--line-color); border-color: var(--line-color); }
.route-stop--current { border-color: var(--line-color); }
.route-stop--current::before { width: 15px; height: 15px; background: var(--line-color); border-color: var(--line-color); box-shadow: 0 0 0 3px color-mix(in srgb, var(--line-color) 25%, transparent); }
.route-stop__code { font-family: var(--font-display); font-weight: 700; font-size: var(--fs-lead); width: 34px; color: color-mix(in srgb, var(--line-color) 65%, var(--text-primary)); font-variant-numeric: tabular-nums; }
.route-stop__names { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.route-stop__jp { font-family: var(--font-display); font-weight: 700; font-size: var(--fs-body); }
.route-stop__hint { font-size: var(--fs-caption); color: var(--text-secondary); }
.route-stop__here { font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: color-mix(in srgb, var(--line-color) 65%, var(--text-primary)); }
.route-stop__fig { display: flex; align-items: baseline; gap: 3px; font-family: var(--font-display); font-weight: 700; font-size: var(--fs-sm); font-variant-numeric: tabular-nums; color: var(--text-secondary); }
.route-stop__fig b { color: var(--text-primary); }
.route-stop__go { font-size: 0.7rem; color: color-mix(in srgb, var(--line-color) 65%, var(--text-primary)); opacity: 0.7; }

/* ── the console (decks, dictionary, today share it) ── */
.console { background: var(--surface); border: 1px solid var(--surface-line); border-radius: var(--r-panel); overflow: hidden; }
.console__top { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: var(--sp-3); padding: var(--sp-3) var(--sp-4); border-bottom: 1px solid var(--surface-line); }
.console__chips { display: flex; flex-wrap: wrap; gap: 6px; min-width: 0; flex: 1 1 100%; }
.console__top > .console__action, .console__top > .chip { margin-left: auto; }
.chip { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 12px; border: 1px solid var(--surface-line); border-radius: 999px; color: var(--text-secondary); font-family: var(--font-display); font-size: var(--fs-caption); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; white-space: nowrap; flex: none; }
.chip--on { color: color-mix(in srgb, var(--tab-color, var(--line-color)) 60%, var(--text-primary)); border-color: color-mix(in srgb, var(--tab-color, var(--line-color)) 55%, transparent); background: color-mix(in srgb, var(--tab-color, var(--line-color)) 12%, transparent); }
.chip__glyph { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border: 1.5px solid currentColor; border-radius: var(--r-pill); font-family: var(--font-jp); font-size: 11px; font-weight: 700; letter-spacing: 0; color: color-mix(in srgb, var(--tab-color, var(--text-secondary)) 65%, var(--text-primary)); }
.console__action { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 14px; border-radius: 999px; background: color-mix(in srgb, var(--deck-action) 70%, var(--bg-panel)); color: var(--text-on-panel); font-family: var(--font-display); font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; white-space: nowrap; flex: none; }
.console__action--gold { background: color-mix(in srgb, var(--accent2) 60%, var(--bg-panel)); color: var(--text-on-panel); }
.console__index { display: flex; align-items: center; gap: 10px; min-height: 44px; padding: 6px 12px; }
.console__index .svg { color: var(--text-secondary); }
.console__field { flex: 1; min-width: 0; font-size: 1rem; color: var(--text-secondary); }
.console__field--filled { color: var(--text-primary); }
.console__clear { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; flex: none; border-radius: 999px; color: var(--text-secondary); background: color-mix(in srgb, var(--text-primary) 8%, transparent); position: relative; }
.console__clear::before { content: ""; position: absolute; inset: -8px; }
.console__clear .svg { width: 14px; height: 14px; color: inherit; }
.console__count { flex: none; font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-secondary); white-space: nowrap; }

/* ── dictionary results: the catalogue cards live in CSS4 (.dict-entry-card) ── */
.lvl { display: inline-flex; align-items: center; justify-content: center; height: 20px; padding: 0 7px; border-radius: var(--r-plate); border: 1px solid color-mix(in srgb, var(--lvl-color, var(--text-secondary)) 55%, transparent); color: var(--lvl-color, var(--text-secondary)); font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: 0.06em; }
.seal { --seal-color: var(--state-new); display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 6px; background: color-mix(in srgb, var(--seal-color) 15%, transparent); border: 1.5px solid color-mix(in srgb, var(--seal-color) 65%, transparent); box-shadow: inset 0 1px 3px rgba(0,0,0,0.2); color: color-mix(in srgb, var(--seal-color) 62%, var(--text-on-panel)); font-family: var(--font-jp); font-weight: 700; font-size: 13px; line-height: 1; transform: rotate(-5deg); flex: none; }
.seal--new { opacity: 0.55; }
.seal--learning { --seal-color: var(--state-learning); }
.seal--mastered { --seal-color: var(--state-mastered); box-shadow: inset 0 1px 3px rgba(0,0,0,0.2), 0 0 0 3px color-mix(in srgb, var(--seal-color) 18%, transparent); }

/* ── the study stage ── */
.stage { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: var(--sp-4); padding: var(--sp-4) var(--sp-5) 0; }
.stage__head { display: flex; align-items: center; gap: var(--sp-4); min-height: 40px; }
.stage__leave { display: inline-flex; align-items: center; gap: var(--sp-1); height: 44px; padding: 0 var(--sp-3) 0 var(--sp-2); border: 1px solid var(--surface-line); border-radius: var(--r-plate); color: var(--text-secondary); font-family: var(--font-display); font-weight: 700; font-size: var(--fs-sm); line-height: 1; }
.stage__where { display: flex; flex-direction: column; min-width: 0; flex: 1; }
.stage__where-jp { font-family: var(--font-display); font-weight: 700; font-size: var(--fs-sm); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.stage__where-latin { font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-secondary); white-space: nowrap; }
.today-remaining { display: inline-flex; align-items: center; justify-content: center; min-width: 26px; height: 22px; padding: 0 7px; border-radius: 999px; background: color-mix(in srgb, var(--accent2) 16%, transparent); color: var(--accent2); font-size: 12px; font-weight: 700; font-variant-numeric: tabular-nums; }
.stage .hud__pass { height: 34px; }
.stage__credits-cap { font-size: var(--fs-caption-xs); letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-secondary); }
.deck-progress { display: flex; height: 4px; border-radius: var(--r-pill); overflow: hidden; background: var(--surface-line); }
.deck-progress__segment { height: 100%; }
.study-assist { display: flex; justify-content: center; align-items: center; min-height: 30px; gap: var(--sp-4); }
.study-assist__toggle { display: inline-flex; align-items: center; gap: var(--sp-2); height: 36px; font-family: var(--font-display); font-size: var(--fs-caption); font-weight: 600; padding: 0 var(--sp-4); border-radius: var(--r-pill); color: var(--text-secondary); border: 1px solid var(--surface-line); }
.study-assist__toggle .svg { width: 14px; height: 14px; }
.study-assist__toggle--on { background: color-mix(in srgb, var(--accent2) 14%, transparent); border-color: color-mix(in srgb, var(--accent2) 60%, transparent); color: color-mix(in srgb, var(--accent2) 60%, var(--text-primary)); }
.stage > * { flex: none; }
.stage > .prompt-card { flex: 1 1 auto; }
.prompt-card { position: relative; display: flex; flex-direction: column; min-height: 160px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--r-panel); overflow: hidden; }
.prompt-card__body { flex: 1 0 auto; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--sp-3); padding: var(--sp-8) var(--sp-6) var(--sp-7); }
.prompt-card__foot { border-top: 1px solid var(--border); padding: var(--sp-3) var(--sp-5); display: flex; align-items: center; justify-content: space-between; gap: var(--sp-4); font-size: var(--fs-caption); color: var(--text-secondary); }
.stage-mark { --stage-ink: var(--state-new); position: absolute; top: var(--sp-4); right: var(--sp-5); font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; white-space: nowrap; color: color-mix(in srgb, var(--stage-ink) 65%, var(--text-primary)); }
.stage-mark--new { color: var(--text-secondary); }
.stage-mark--learning { --stage-ink: var(--state-learning); }
.stage-mark--mastered { --stage-ink: var(--state-mastered); }
.char-display { font-family: var(--font-jp); font-size: var(--fs-specimen-glyph); line-height: 1.15; letter-spacing: 0.02em; color: var(--text-primary); }
.char-display--word { font-size: var(--fs-specimen-word); }
.mcq-list { display: flex; flex-direction: column; gap: var(--sp-2); text-align: left; }
.mcq-row { --mcq-color: var(--line-color, var(--accent)); position: relative; display: flex; align-items: center; gap: var(--sp-4); width: 100%; min-height: 44px; padding: var(--sp-2) var(--sp-4); background: var(--surface); border: 1px solid var(--surface-line); border-radius: var(--r-card); color: var(--text-primary); text-align: left; overflow: hidden; }
.mcq-row__accent { position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--mcq-color); transform: scaleX(0); transform-origin: left; }
.mcq-row__index { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 50%; border: 2px solid color-mix(in srgb, var(--mcq-color) 55%, transparent); font-family: var(--font-display); font-size: 0.72rem; font-weight: 700; color: var(--text-secondary); }
.mcq-row__text { flex: 1; font-family: var(--font-jp); font-size: 17px; font-weight: 600; }
.mcq-row--correct { --mcq-color: var(--success); background: color-mix(in srgb, var(--mcq-color) 12%, var(--bg-card)); border-color: var(--mcq-color); }
.mcq-row--correct .mcq-row__accent { transform: scaleX(1); }
.mcq-row--correct .mcq-row__index { background: var(--mcq-color); border-color: var(--mcq-color); color: var(--bg-main); }
.mcq-row--correct .mcq-row__text { color: var(--mcq-color); }
.mcq-row--filler { opacity: 0.45; }
.rating-bar { flex: none; margin-inline: calc(-1 * var(--sp-5)); padding: var(--sp-3) var(--sp-5) calc(var(--sp-3) + var(--safe-bottom)); background: var(--bg-panel); }
.rating-bar__buttons { display: flex; background: transparent; border: 1px solid color-mix(in srgb, var(--text-on-panel) 12%, transparent); border-radius: var(--r-panel); overflow: hidden; }
.rating-bar__btn { display: flex; flex: 1 1 0; min-width: 0; flex-direction: column; align-items: center; justify-content: center; gap: var(--sp-2); min-height: 56px; padding: var(--sp-3) var(--sp-1); border-left: 1px solid color-mix(in srgb, var(--text-on-panel) 12%, transparent); border-radius: 0; color: var(--text-on-panel); text-align: center; }
.rating-bar__btn:first-child { border-left: none; }
.rating-bar__btn-ring { width: 6px; height: 6px; border-radius: var(--r-pill); background: var(--rating-color, var(--text-on-panel-soft)); opacity: 0.75; flex: none; }
.rating-bar__btn--pressed { background: color-mix(in srgb, var(--rating-color, transparent) 14%, transparent); }
.rating-bar__btn--pressed .rating-bar__btn-ring { opacity: 1; box-shadow: 0 0 0 3px color-mix(in srgb, var(--rating-color, transparent) 30%, transparent); }
.rating-bar__btn-label { font-family: var(--font-display); font-size: var(--fs-sm); font-weight: 700; line-height: 1; white-space: nowrap; }
.rating-bar__btn--q4 { --rating-color: var(--teal); }
.rating-bar__btn--q3 { --rating-color: var(--warning); }
.rating-bar__btn--q2 { --rating-color: var(--rust); }
.rating-bar__btn--q1 { --rating-color: var(--rating-wrong); }

/* ── 完了 — the cleared run ── */
.today-clear { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--sp-3); padding: var(--sp-4) var(--sp-4) var(--sp-6); text-align: center; }
.today-clear__mark { display: inline-flex; align-items: center; justify-content: center; width: 56px; height: 56px; border-radius: var(--r-pill); border: 2px solid color-mix(in srgb, var(--success) 70%, transparent); color: var(--success); font-family: var(--font-serif); font-size: 44px; letter-spacing: 0.1em; text-indent: 0.1em; color: color-mix(in srgb, var(--success) 70%, transparent); line-height: 1.2; }
.today-clear__title { font-family: var(--font-serif); font-weight: 700; font-size: 22px; }
.today-clear__body { color: var(--text-secondary); font-size: var(--fs-body); }
.today-clear__next { color: var(--text-secondary); font-size: var(--fs-sm); }
.fare-slip { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1px; width: 100%; margin-top: var(--sp-3); background: var(--surface-line); border: 1px solid var(--surface-line); border-radius: var(--r-card); overflow: hidden; }
.fare-slip__cell { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--sp-1); padding: var(--sp-4) var(--sp-2); background: var(--surface); }
.fare-slip__v { display: flex; align-items: baseline; gap: 3px; font-family: var(--font-display); font-weight: 700; font-size: var(--fs-title); line-height: 1; font-variant-numeric: tabular-nums; }
.fare-slip__u { font-size: var(--fs-caption-xs); font-weight: 600; color: var(--text-secondary); }
.fare-slip__v--gold { color: var(--accent2); }

/* ── スタンプ帳 / 記録 / 線 / 番付 ── */
.sbook { display: flex; flex-direction: column; gap: var(--sp-4); padding: var(--sp-5); background: var(--surface); border: 1px solid var(--surface-line); border-radius: var(--r-card); }
.sbook__dows, .sbook__grid { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: var(--sp-2); justify-items: center; }
.sbook__dow { font-family: var(--font-display); font-size: var(--fs-caption); font-weight: 700; color: var(--text-secondary); }
.sbook__stamp { width: 100%; aspect-ratio: 1; border-radius: var(--r-pill); display: inline-flex; align-items: center; justify-content: center; font-family: var(--font-display); font-size: var(--fs-caption); font-weight: 700; font-variant-numeric: tabular-nums; border: 1.5px solid color-mix(in srgb, var(--stamp-ink) 55%, transparent); color: color-mix(in srgb, var(--stamp-ink) 55%, var(--text-primary)); background: color-mix(in srgb, var(--stamp-ink) 12%, transparent); transform: rotate(var(--stamp-tilt, 0deg)); }
.sbook__stamp--missed { border-style: dashed; border-color: color-mix(in srgb, var(--text-primary) 22%, transparent); background: transparent; color: var(--text-secondary); opacity: 0.6; transform: none; }
.sbook__stamp--future { border-color: transparent; background: transparent; color: var(--text-secondary); opacity: 0.4; transform: none; }
.sbook__stamp--today { border-width: 2px; border-color: var(--stamp-ink); background: color-mix(in srgb, var(--stamp-ink) 22%, transparent); }
.sbook__side { display: flex; flex-direction: column; gap: var(--sp-4); padding-top: var(--sp-4); border-top: 1px solid var(--surface-line); }
.sbook__month { display: flex; align-items: baseline; gap: var(--sp-3); padding-bottom: var(--sp-2); border-bottom: 1px solid var(--surface-line); }
.sbook__month-jp { font-family: var(--font-serif); font-weight: 700; font-size: var(--fs-title); letter-spacing: var(--tr-name); }
.sbook__figs { display: flex; flex-flow: row wrap; justify-content: space-between; gap: var(--sp-4) var(--sp-5); }
.fig { display: flex; flex-direction: column; gap: var(--sp-2); min-width: 0; }
.fig__v { display: flex; align-items: baseline; gap: var(--sp-2); font-family: var(--font-display); font-weight: 700; font-size: var(--fs-title); line-height: 1; color: var(--text-primary); font-variant-numeric: tabular-nums; }
.fig__u { font-size: var(--fs-sm); font-weight: 600; color: var(--text-secondary); }
.fig__l { font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-secondary); }
.records { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: minmax(0, 1fr); gap: 1px; background: var(--surface-line); border: 1px solid var(--surface-line); border-radius: var(--r-card); overflow: hidden; }
.record { display: flex; flex-direction: column; justify-content: center; gap: var(--sp-1); min-width: 0; padding: var(--sp-5); background: var(--surface); }
.record__value { display: flex; align-items: baseline; gap: var(--sp-2); font-family: var(--font-display); font-weight: 700; font-size: var(--fs-heading); line-height: 1; color: var(--text-primary); font-variant-numeric: tabular-nums; }
.record__unit { font-size: var(--fs-sm); font-weight: 600; color: var(--text-secondary); }
.record__label { font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-secondary); }
.record--door { flex-direction: row; align-items: center; justify-content: space-between; gap: var(--sp-3); text-align: left; }
.pf-ledger { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; background: var(--surface-line); border: 1px solid var(--surface-line); border-radius: var(--r-card); overflow: hidden; }
.pf-line { display: flex; flex-direction: column; gap: var(--sp-3); min-width: 0; padding: var(--sp-4) var(--sp-4) var(--sp-3); background: var(--surface); text-align: left; color: inherit; }
.pf-line__id { display: flex; align-items: center; gap: var(--sp-3); }
.pf-line__roundel { flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; width: 30px; height: 30px; border-radius: var(--r-pill); border: 2px solid var(--line-color, var(--accent2)); color: color-mix(in srgb, var(--line-color, var(--accent2)) 60%, var(--text-primary)); font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; }
.pf-line__names { display: flex; flex-direction: column; min-width: 0; }
.pf-line__jp { font-family: var(--font-display); font-weight: 700; font-size: var(--fs-body); line-height: 1.2; }
.pf-line__sen { font-size: var(--fs-caption); color: var(--text-secondary); margin-left: var(--sp-1); }
.pf-line__fig { display: flex; align-items: baseline; gap: var(--sp-2); font-family: var(--font-display); font-weight: 700; font-size: var(--fs-title); line-height: 1; font-variant-numeric: tabular-nums; }
.pf-line__of { font-size: var(--fs-sm); font-weight: 600; color: var(--text-secondary); }
.pf-line__track { height: 3px; border-radius: var(--r-pill); background: color-mix(in srgb, var(--line-color, var(--accent2)) 30%, transparent); overflow: hidden; }
.pf-line__done { display: block; height: 100%; background: var(--line-color, var(--accent2)); }
.pf-cap { font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-secondary); }
.banzuke { background: var(--surface); border: 1px solid var(--surface-line); border-radius: var(--r-card); overflow: hidden; }
.bz__head { display: flex; align-items: center; gap: var(--sp-4); padding: var(--sp-4) var(--sp-5); border-bottom: 1px solid var(--surface-line); }
.bz__mark { display: flex; align-items: baseline; gap: var(--sp-3); }
.bz__jp { font-family: var(--font-serif); font-weight: 700; font-size: var(--fs-lead); }
.seg { margin-left: auto; display: inline-flex; border: 1px solid var(--surface-line); border-radius: var(--r-pill); overflow: hidden; }
.seg__opt { display: inline-flex; align-items: center; gap: var(--sp-2); height: 36px; padding: 0 var(--sp-4); border-left: 1px solid var(--surface-line); color: var(--text-secondary); border-radius: 0; }
.seg__opt:first-child { border-left: 0; }
.seg__opt-jp { font-family: var(--font-display); font-weight: 700; font-size: var(--fs-caption); letter-spacing: 0.06em; text-transform: uppercase; }
.seg__opt--on { background: color-mix(in srgb, var(--accent2) 14%, transparent); color: var(--text-primary); }
.leaderboard-row { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-bottom: 1px solid var(--border); }
.leaderboard-row:last-child { border-bottom: none; }
.leaderboard-row--me { box-shadow: inset 3px 0 0 var(--pass-ink); background: var(--overlay-hover); }
.leaderboard-row__rank { flex-shrink: 0; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-family: var(--font-jp); font-weight: 700; font-size: 13px; background: var(--bg-panel); color: var(--text-on-panel-soft); }
.leaderboard-row__rank--gold { color: var(--medal-gold); box-shadow: inset 0 0 0 1.5px var(--medal-gold); }
.leaderboard-row__rank--silver { color: var(--medal-silver); box-shadow: inset 0 0 0 1.5px var(--medal-silver); }
.leaderboard-row__rank--bronze { color: var(--medal-bronze); box-shadow: inset 0 0 0 1.5px var(--medal-bronze); }
.leaderboard-row__name { flex: 1; min-width: 0; font-family: var(--font-jp); font-weight: 700; color: var(--text-primary); }
.leaderboard-row__xp { flex-shrink: 0; min-width: 76px; text-align: right; font-family: var(--font-display); font-weight: 700; font-size: 13px; color: var(--text-primary); font-variant-numeric: tabular-nums; }

/* ── bottom sheets ── */
.scrim { position: absolute; inset: 0; background: rgba(0,0,0,0.55); z-index: 40; }
.sheet { position: absolute; left: 0; right: 0; bottom: 0; z-index: 50; display: flex; flex-direction: column; gap: var(--sp-5); padding: var(--sp-3) var(--sp-5) calc(var(--sp-5) + var(--safe-bottom)); background: var(--surface); border: 1px solid var(--surface-line); border-bottom: 0; border-radius: var(--r-panel) var(--r-panel) 0 0; box-shadow: var(--elev-board); }
.sheet--sumi { background: var(--bg-panel); color: var(--text-on-panel); border-color: color-mix(in srgb, var(--pass-ink) 45%, transparent); }
.sheet__handle { width: 36px; height: 4px; border-radius: var(--r-pill); background: color-mix(in srgb, currentColor 30%, transparent); align-self: center; }
.sheet__head { display: flex; align-items: baseline; gap: var(--sp-3); }
.sheet__jp { font-family: var(--font-serif); font-weight: 700; font-size: var(--fs-title); }
.sheet__cap { font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-secondary); }
.sheet--sumi .sheet__cap { color: var(--text-on-panel-soft); }
.balance { display: flex; align-items: flex-end; justify-content: space-between; gap: var(--sp-4); }
.balance__fig { display: flex; align-items: baseline; gap: var(--sp-2); font-family: var(--font-display); font-weight: 700; font-size: var(--fs-display); line-height: 1; font-variant-numeric: tabular-nums; color: var(--accent2); }
.balance__unit { font-size: var(--fs-sm); font-weight: 600; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-secondary); }
.balance__of { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; font-family: var(--font-display); font-size: var(--fs-sm); font-weight: 700; color: var(--text-secondary); font-variant-numeric: tabular-nums; text-align: right; }
.balance__track { height: 6px; border-radius: var(--r-pill); background: color-mix(in srgb, var(--accent2) 18%, transparent); overflow: hidden; }
.balance__fill { display: block; height: 100%; background: var(--accent2); }
.balance__rows { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; background: var(--surface-line); border: 1px solid var(--surface-line); border-radius: var(--r-card); overflow: hidden; }
.balance__cell { display: flex; flex-direction: column; gap: var(--sp-1); padding: var(--sp-4) var(--sp-4); background: var(--surface); }
.balance__cell b { display: flex; align-items: baseline; gap: var(--sp-1); font-family: var(--font-display); font-weight: 700; font-size: var(--fs-lead); line-height: 1; font-variant-numeric: tabular-nums; }
.balance__cell b [lang="ja"] { font-size: var(--fs-caption); color: var(--text-secondary); font-weight: 500; }
.offer { display: flex; flex-direction: column; gap: var(--sp-4); padding: var(--sp-5); border-radius: var(--r-identity); background: linear-gradient(155deg, color-mix(in srgb, var(--pass-ink) 38%, var(--bg-panel)) 0%, var(--bg-panel) 62%); border: 1px solid color-mix(in srgb, var(--accent2) 45%, transparent); color: var(--text-on-panel); }
.offer__head { display: flex; align-items: center; justify-content: space-between; gap: var(--sp-3); }
.offer__names { display: flex; flex-direction: column; }
.offer__jp { font-family: var(--font-serif); font-weight: 700; font-size: var(--fs-lead); }
.offer__cap { font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-on-panel-soft); }
.offer__body { font-size: var(--fs-sm); color: var(--text-on-panel-soft); line-height: 1.5; }
.offer__body b { color: var(--text-on-panel); }
.offer__price { display: flex; align-items: baseline; gap: var(--sp-2); font-family: var(--font-display); font-weight: 700; font-size: var(--fs-title); font-variant-numeric: tabular-nums; }
.offer__price small { font-size: var(--fs-caption); font-weight: 600; color: var(--text-on-panel-soft); letter-spacing: 0.06em; }

/* ── analyzer (Latin-first by ruling) ── */
.anl-door { display: flex; align-items: center; gap: var(--sp-4); min-height: 56px; padding: var(--sp-3) var(--sp-4); background: var(--surface); border: 1px solid var(--surface-line); border-radius: var(--r-card); text-align: left; color: var(--text-primary); --line-color: var(--line-kaiseki); }
.anl-door__names { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.anl-door__title { font-family: var(--font-serif); font-weight: 600; font-size: 1.08rem; line-height: 1.3; }
.anl-door__title [lang="ja"] { font-family: var(--font-jp); font-weight: 500; font-size: var(--fs-caption); color: var(--text-secondary); margin-left: var(--sp-2); letter-spacing: var(--tr-term); }
.anl-door__desc { font-size: var(--fs-caption); color: var(--text-secondary); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.anl-door__intakes { display: flex; gap: var(--sp-2); flex: none; }
.anl-door__intake { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: var(--r-pill); border: 1px solid var(--surface-line); color: color-mix(in srgb, var(--line-kaiseki) 55%, var(--text-primary)); padding: 0; }
.anl-door__intake .svg { width: 17px; height: 17px; }
.seg--full { width: 100%; margin-left: 0; }
.seg--full .seg__opt { flex: 1; justify-content: center; height: 40px; }
.seg__opt-latin { font-family: var(--font-display); font-weight: 700; font-size: var(--fs-caption); letter-spacing: var(--tr-caption); text-transform: uppercase; }
.seg__opt--on .seg__opt-latin { color: var(--text-primary); }
.seg--kaiseki .seg__opt--on { background: color-mix(in srgb, var(--line-kaiseki) 14%, transparent); }
.anl-card { display: flex; align-items: stretch; background: var(--surface); border: 1px solid var(--surface-line); border-radius: var(--r-card); overflow: hidden; text-align: left; color: var(--text-primary); }
.anl-card__lead { flex: none; width: 58px; display: flex; align-items: center; justify-content: center; padding-left: 10px; }
.anl-card__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; padding: 12px 10px; }
.anl-card__title { display: flex; align-items: baseline; gap: var(--sp-3); font-family: var(--font-serif); font-weight: 600; font-size: 1.08rem; }
.anl-card__title [lang="ja"] { font-family: var(--font-jp); font-weight: 500; font-size: var(--fs-caption); color: var(--text-secondary); letter-spacing: var(--tr-term); white-space: nowrap; }
.anl-card__desc { font-size: 0.86rem; color: var(--text-secondary); }
.anl-card__aside { flex: none; display: flex; flex-direction: column; justify-content: center; gap: var(--sp-2); min-width: 92px; padding: 0 12px; border-left: 1px solid var(--surface-line); }
.anl-fig { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
.anl-fig b { font-family: var(--font-display); font-weight: 700; font-size: var(--fs-body); line-height: 1; font-variant-numeric: tabular-nums; }
.anl-fig span { font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-secondary); white-space: nowrap; }
.anl-hist { display: flex; align-items: center; gap: var(--sp-4); min-height: 52px; padding: var(--sp-3) var(--sp-4); border-top: 1px solid var(--surface-line); text-align: left; color: var(--text-primary); }
.anl-hist:first-child { border-top: 0; }
.anl-hist__n { flex: none; font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; color: var(--text-secondary); width: 18px; }
.anl-hist__body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.anl-hist__jp { font-family: var(--font-jp); font-weight: 600; font-size: var(--fs-body); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.anl-hist__meta { display: flex; gap: var(--sp-3); font-size: var(--fs-caption); color: var(--text-secondary); }
.anl-kept { display: inline-flex; align-items: center; justify-content: center; height: 16px; padding: 0 5px; border-radius: 3px; border: 1px solid color-mix(in srgb, var(--stamp-ink) 55%, transparent); color: var(--stamp-ink); font-family: var(--font-jp); font-size: 10px; font-weight: 700; }
.head2 { display: flex; align-items: baseline; gap: var(--sp-3); }
.head2__latin { font-family: var(--font-serif); font-weight: 700; font-size: var(--fs-lead); }
.head2__jp { font-family: var(--font-jp); font-size: var(--fs-caption); color: var(--text-secondary); letter-spacing: var(--tr-term); }
.head2__count { margin-left: auto; font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-secondary); }
.textarea { display: flex; align-items: flex-start; min-height: 120px; padding: var(--sp-4); border-radius: var(--r-card); background: var(--bg-main); border: 1px solid transparent; color: var(--text-secondary); font-size: var(--fs-body); }

/* ── spec sheet furniture (Chrome artboard) ── */
.spec { display: flex; flex-direction: column; gap: var(--sp-6); padding: var(--sp-7); }
.spec__row { display: flex; align-items: flex-start; gap: var(--sp-6); flex-wrap: wrap; }
.spec__item { display: flex; flex-direction: column; gap: var(--sp-3); }
.spec__label { font-family: var(--font-display); font-size: var(--fs-caption-xs); font-weight: 700; letter-spacing: var(--tr-caption); text-transform: uppercase; color: var(--text-secondary); }
.spec__note { font-size: var(--fs-sm); color: var(--text-secondary); max-width: 520px; line-height: 1.5; }
.spec__note b { color: var(--text-primary); }
.spec__strip { width: 390px; }
.spec__strip .hud { padding-top: 0; }
.spec__strip .tabbar { padding-bottom: 0; }
`
