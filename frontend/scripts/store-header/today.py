"""The moving header (plan 308, the owner's pick E of the canvas "Tsuji —
the moving header"): the day's run on Today's print, as a page to film.

    cd frontend && python3 scripts/store-header/today.py OUT [print] [--date YYYY-MM-DD]

writes OUT/today.html, the print of the hour (autumn-day by default) in
the header's 21:9 window with Today's dial on its sun or moon, and a
script whose window.render(t) draws the frame at t seconds, so a film
of it is a set of stills taken one by one (film.mjs films it). One loop
of LOOP seconds:

- the run: the count on the disc rolls down from the day's cards to 0,
  the day's thread closing round it with its stop, while the train
  crosses the bay;
- the day's finish at the app's own beats (components/dayclear/
  useFinish.js, BEATS.day): the ring turning in, the day's seal slammed
  (TodayDial's CutSeal, its ink grain and its tilt) with its flash, its
  bloom and the 3px shake, the sun's glow given way to the seal's, the
  week's seven stamps with today's pressed and a full week's gold rings;
- the next day coming back over the loop's last 0.8 s.

Everything is drawn as the app draws it, from its own numbers: the dial
by PrintDial's geometry (TodayDial.jsx, domain/dial.js), its inks from
print.json, the keyframes from index.css (clr-slam, tdy-fin-ring,
tdy-fin-flash, clr-bloom, clr-shake, clr-press, tdy-fin-pop). Nothing
on it is a word: the count, 辻駅, the date and the days, so one film
serves every language. The print's own motion (its water, leaves,
birds, the pine's gusts) runs on its own CSS, set to the same clock.

The date is the seal's (its weekday, its foot) and the week's: pass one
in the print's season."""
import argparse
import dataclasses
import datetime
import importlib.util
import json
import math
import os

HERE = os.path.dirname(os.path.abspath(__file__))
FRONTEND = os.path.normpath(os.path.join(HERE, '..', '..'))

# The header's still (build.py), loaded under its own name: the print's
# build is also a module called `build`.
_spec = importlib.util.spec_from_file_location('store_header', os.path.join(HERE, 'build.py'))
header = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(header)

LOOP = 12                           # seconds; film.mjs films LOOP + SEAM and crossfades the seam
TOP = 300                           # the window's top, in the print's units: the dial needs the sky
CX, CY, R = 440, 495, 72            # the dial on the print: left of Fuji, as on the desk's Today
FRAME = dataclasses.replace(
    header.HEADER, fuji=(690, 470, 640, 230), cx=CX, cy=CY, cars=6,
    boats=[(150, 666, 1.0), (300, 658, 0.8), (560, 664, 0.85)], lone_boats=[(250, 664, 1.0), (520, 660, 0.95)],
    cranes_path=((1360, 392), (360, 372), 58), geese_path=((300, 392), (1300, 412), 36),
    cloud_sets={'dawn': [(-40, 330, 230, 18), (860, 318, 260, 20), (990, 520, 210, 16)],
                'day': [(-40, 330, 230, 19), (860, 318, 260, 21), (990, 520, 210, 17)],
                'dusk': [(-50, 340, 260, 10), (880, 350, 240, 9)],
                'night': [(-50, 340, 260, 10), (900, 520, 230, 9)]})
# The day's cards by line, in the lines' order round the dial (a typical day).
PARTS = [('kana', 2), ('vocab', 10), ('kanji', 8), ('grammar', 4)]
LINE = {'kana': '#b84f3c', 'vocab': '#3e7ba6', 'kanji': '#7b68a3', 'grammar': '#608045'}   # --line-* (index.css)
WEEKDAYS = '月火水木金土日'
SEAL, SEAL_GLOW, WASHI, GOLD_LIT = '#ce6153', '#e98066', '#efe3bf', '#e6bd62'               # --tpr-seal … --gate-gold-lit
MARIA = [(-0.56, -0.42, 0.2, 0.781), (-0.2, -0.66, 0.16, 0.7377), (0.52, -0.5, 0.15, 0.8627),
         (0.66, 0.34, 0.16, 0.7181), (-0.6, 0.48, 0.13, 0.834), (0.18, 0.72, 0.12, 0.7914)]   # TodayDial.jsx


def dial_arcs(parts, r, gap, cap):
    """domain/dial.js's dialArcs: each line's arc, from the top, clockwise."""
    total = sum(n for _, n in parts)
    usable = 2 * math.pi * r - gap * len(parts)
    at, out = gap / 2, []
    for key, n in parts:
        span = usable * n / total
        out.append((key, at + cap, max(0, span - 2 * cap)))
        at += span + gap
    return out


def page(name, day):
    header.TOP = TOP
    header.HEADER = FRAME
    header.sun = lambda L, h, uid: ''             # the disc is the dial's, drawn below
    (sky, back, train, front), _ = header.layers(name)
    L = FRAME
    run = L.W + header.train_length() + 40
    meta = json.load(open(os.path.join(FRONTEND, 'src', 'components', 'station', 'print', 'print.json')))['prints'][name]
    disc, ink = meta['disc'], meta['ink']
    count = sum(n for _, n in PARTS)

    # PrintDial's geometry at R, the desk frame's proportions (disc 100, halo 126, fare 141)
    k = R / 80
    halo, fare = R * 1.26, R * 1.41
    glow = R + 70
    size, mid = 2 * glow, glow
    width = 3.4 * k
    turn = f'rotate(-90 {mid} {mid})'
    c_halo, c_fare = 2 * math.pi * halo, 2 * math.pi * fare
    arcs = dial_arcs(PARTS, halo, 11 * halo / 101, width / 2)

    def ring(w, extra=''):
        return ''.join(f'<circle cx="{mid}" cy="{mid}" r="{halo:.3f}" fill="none" stroke="{LINE[key]}" stroke-width="{w:.3f}" stroke-linecap="round" '
                       f'stroke-dasharray="{ln:.3f} {c_halo:.3f}" stroke-dashoffset="{-st:.3f}" transform="{turn}"{extra}/>' for key, st, ln in arcs)
    halo_glow = (f'<g class="halo" style="--ho: {disc["haloGlow"]}" filter="url(#hb)">{ring(13 * k)}</g>' if disc['haloGlow'] > 0 else '')
    maria = (f'<g clip-path="url(#dc)" fill="#c9b68a" opacity="0.2" filter="url(#ms)">' +
             ''.join(f'<ellipse cx="{mid + x * R:.2f}" cy="{mid + y * R:.2f}" rx="{s * R:.2f}" ry="{s * R * q:.2f}"/>' for x, y, s, q in MARIA) +
             '</g>' if disc['maria'] else '')
    # At dawn the sun is already red: the seal is cut into it, in the sun's own red under its own glow.
    red_sun = disc['kind'] == 'sun_red'
    face = 'url(#df)' if red_sun else SEAL
    seal_glow, seal_glow_op = (disc['glow'], disc['glowOp']) if red_sun else (SEAL_GLOW, 0.42)
    week = [day - datetime.timedelta(days=6 - i) for i in range(7)]
    foot = day.strftime('%d·%m·%Y')

    tex = header.prints.OUT
    box = f'0 0 {L.W} {L.H}'
    slots = ''.join(f'<span class="slot{" now" if i == 6 else ""}"><i></i>{WEEKDAYS[d.weekday()]}</span>' for i, d in enumerate(week))
    return f'''<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@700&family=Noto+Serif+JP:wght@900&family=Space+Grotesk:wght@700&display=block">
<style>
html, body {{ margin: 0; background: #000; }}
.tpr {{ position: relative; width: {L.W}px; height: {L.H}px; overflow: hidden; }}
.tpr > .L {{ position: absolute; left: 0; top: 0; width: 100%; height: 100%; }}
.tpr > .g {{ height: {(L.horizon + 12) / L.H * 100:.3f}%; background: url(file://{tex}/grain.png) 0 0/640px 120px; }}
.p {{ background: url(file://{tex}/paper.png) 0 0/128px 128px; }}
.tpr__train {{ overflow: visible; }}
{header.s1_preview.moving_css()}
/* the dial, as PrintDial draws it */
.dial {{ position: absolute; left: {CX - mid}px; top: {CY - mid}px; width: {size}px; height: {size}px; }}
.dial > *, .w > svg {{ position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }}
.glow {{ animation: tpr-breathe 7s ease-in-out infinite alternate; }}
@keyframes tpr-breathe {{ from {{ opacity: 0.8; transform: scale(0.985); }} to {{ opacity: 1; transform: scale(1.035); }} }}
.halo {{ opacity: var(--ho, 0); animation: tpr-halo 5.5s ease-in-out infinite alternate; }}
@keyframes tpr-halo {{ to {{ opacity: calc(var(--ho, 0) * 0.55); }} }}
.count {{ display: flex; align-items: center; justify-content: center; }}
.count span {{ position: absolute; font: 700 60px/1 'Space Grotesk', sans-serif; font-variant-numeric: tabular-nums;
  background: linear-gradient(180deg, {ink['countA']} 0%, {ink['countB']} 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }}
.dial > .flash, .dial > .bloom {{ inset: auto; left: 50%; top: 50%; aspect-ratio: 1; border-radius: 999px; translate: -50% -50%; opacity: 0; }}
.dial > .flash {{ width: {3 * R}px; height: {3 * R}px;
  background: radial-gradient(circle, rgb(255 236 214 / 0.9) 0%, color-mix(in srgb, {SEAL_GLOW} 45%, transparent) 40%, transparent 70%); }}
.dial > .bloom {{ width: {2.5 * R}px; height: {2.5 * R}px; border: 2px solid {WASHI}; box-sizing: border-box; }}
.dial > .stop {{ inset: auto; width: {8 * k:.2f}px; height: {8 * k:.2f}px; border-radius: 999px; background: {disc['fare']};
  box-shadow: 0 0 0 2px color-mix(in srgb, {disc['fare']} 30%, transparent); translate: -50% -50%; }}
/* the week's stamps: the kit's slots (.clrk-slot) on the print, in the seal's red and the hour's ink */
.week {{ position: absolute; left: {CX}px; top: {CY + fare + 26:.1f}px; translate: -50% -50%; display: flex; gap: 10px; }}
.slot {{ position: relative; width: 26px; height: 26px; border-radius: 999px; display: grid; place-items: center; isolation: isolate;
  font: 700 12px/1 'Noto Sans JP', sans-serif; color: {ink['text']}; }}
.slot::before {{ content: ""; position: absolute; inset: 0; z-index: -1; border-radius: inherit;
  border: 1.5px solid color-mix(in srgb, {SEAL} 55%, transparent); background: color-mix(in srgb, {SEAL} 12%, transparent); }}
.slot.now::before {{ border: 2px solid {SEAL}; background: color-mix(in srgb, {SEAL} 22%, transparent); }}
.slot i {{ position: absolute; inset: -4px; border: 1px solid {GOLD_LIT}; border-radius: 999px; }}
</style></head><body>
<div class="tpr">
  <svg class="L" viewBox="{box}">{sky}</svg><div class="L g"></div><svg class="L" viewBox="{box}">{back}</svg>
  <div class="L" style="overflow:hidden"><svg class="L tpr__train" id="train" viewBox="{box}">{train}</svg></div>
  <svg class="L" viewBox="{box}">{front}</svg><div class="L p"></div>
  <div class="dial" id="dial">
    <div class="w" id="sunglow"><svg class="glow" viewBox="0 0 {size} {size}"><defs><radialGradient id="dg" cx="{mid}" cy="{mid}" r="{glow}" gradientUnits="userSpaceOnUse">
      <stop offset="{R / glow:.4f}" stop-color="{disc['glow']}" stop-opacity="{disc['glowOp']}"/><stop offset="{(R + 24) / glow:.4f}" stop-color="{disc['glow']}" stop-opacity="{disc['glowOp'] * 0.35:.3f}"/>
      <stop offset="1" stop-color="{disc['glow']}" stop-opacity="0"/></radialGradient></defs><circle cx="{mid}" cy="{mid}" r="{glow}" fill="url(#dg)"/></svg></div>
    <div class="w" id="sealglow" style="opacity:0"><svg class="glow" viewBox="0 0 {size} {size}"><defs><radialGradient id="sg" cx="{mid}" cy="{mid}" r="{glow}" gradientUnits="userSpaceOnUse">
      <stop offset="{R / glow:.4f}" stop-color="{seal_glow}" stop-opacity="{seal_glow_op}"/><stop offset="{(R + 24) / glow:.4f}" stop-color="{seal_glow}" stop-opacity="{seal_glow_op * 0.35:.3f}"/>
      <stop offset="1" stop-color="{seal_glow}" stop-opacity="0"/></radialGradient></defs><circle cx="{mid}" cy="{mid}" r="{glow}" fill="url(#sg)"/></svg></div>
    <svg class="disc" viewBox="0 0 {size} {size}"><defs>
      <radialGradient id="df" cx="0.4" cy="0.36" r="0.72"><stop offset="0" stop-color="{disc['fill'][0]}"/><stop offset="1" stop-color="{disc['fill'][1]}"/></radialGradient>
      <clipPath id="dc"><circle cx="{mid}" cy="{mid}" r="{R}"/></clipPath>
      <filter id="hb" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="{4.5 * k:.3f}"/></filter>
      <filter id="ms" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="{2.4 * k:.3f}"/></filter></defs>
      {halo_glow}<circle cx="{mid}" cy="{mid}" r="{R}" fill="url(#df)"/>{maria}</svg>
    <div class="w" id="ringw"><svg class="ring" id="ring" viewBox="0 0 {size} {size}">{ring(width)}</svg></div>
    <svg class="thread" viewBox="0 0 {size} {size}">
      <circle cx="{mid}" cy="{mid}" r="{fare:.3f}" fill="none" stroke="{disc['fare']}" stroke-opacity="0.38" stroke-linecap="round" stroke-width="{1.6 * k:.3f}" stroke-dasharray="0.01 {6.2 * k:.3f}"/>
      <circle id="ride" cx="{mid}" cy="{mid}" r="{fare:.3f}" fill="none" stroke="{disc['fare']}" stroke-opacity="0.85" stroke-linecap="round" stroke-width="{2.2 * k:.3f}" stroke-dasharray="0 {c_fare:.3f}" transform="{turn}"/></svg>
    <span class="stop" id="stop"></span>
    <div class="count" id="count"><span id="n0"></span><span id="n1"></span></div>
    <div class="w" id="stampw"><svg class="stamp" id="stamp" viewBox="0 0 {size} {size}"><defs>
      <radialGradient id="sf" cx="0.4" cy="0.36" r="0.72"><stop offset="0" stop-color="{disc['fill'][0]}"/><stop offset="1" stop-color="{disc['fill'][1]}"/></radialGradient>
      <filter id="ink" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="11" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -4 3.5" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/></filter>
      <clipPath id="band"><circle cx="96" cy="96" r="81"/></clipPath></defs>
      <g transform="translate({mid} {mid}) rotate(-6) scale({2 * R / 192:.5f}) translate(-96 -96)" filter="url(#ink)">
        <circle cx="96" cy="96" r="96" fill="{face.replace('#df', '#sf')}"/>
        <circle cx="96" cy="96" r="87" fill="none" stroke="{WASHI}" stroke-width="3.2"/>
        <circle cx="96" cy="96" r="81.5" fill="none" stroke="{WASHI}" stroke-width="1.2"/>
        <path d="M0 127h192v1.5H0zM0 149.5h192v1.5H0z" fill="{WASHI}" clip-path="url(#band)"/>
        <g fill="{WASHI}" text-anchor="middle" dominant-baseline="central">
          <text x="97.9" y="38.6" font-family="Noto Sans JP" font-weight="700" font-size="13.12" letter-spacing="3.9">辻駅</text>
          <text x="96" y="85" font-family="Noto Serif JP" font-weight="900" font-size="72">{WEEKDAYS[day.weekday()]}</text>
          <text x="96.8" y="138.8" font-family="Space Grotesk" font-weight="700" font-size="11.52" letter-spacing="1.6">{foot}</text>
        </g>
      </g></svg></div>
    <div class="flash" id="flash"></div><div class="bloom" id="bloom"></div>
  </div>
  <div id="weekw"><div class="week" id="week">{slots}</div></div>
</div>
<script>
const LOOP = {LOOP}, COUNT = {count}, RUN = {run}, CF = {c_fare:.4f}, FARE = {fare:.4f}, MID = {mid};
// The day's finish, at the app's own beats (useFinish.js, BEATS.day: RING 80, SLAM 300, IMPACT 680,
// RECAP 760, WEEK 900, PRESS 990 ms), from F, when the run's dial has gone.
const F = 6.95;
const BEATS = {{ RING: F + 0.08, SLAM: F + 0.30, HIT: F + 0.68, RECAP: F + 0.76, WEEK: F + 0.90, PRESS: F + 0.99, GOLD: F + 1.25 }};
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = (x) => x * x * (3 - 2 * x);
const $ = (id) => document.getElementById(id);
const ambient = [];
const fx = {{}};

/** One-shot keyframes, paused, set by the clock: index.css's own. */
function shot(key, el, frames, opts, at) {{
  const a = el.animate(frames, {{ fill: 'both', ...opts }}); a.pause();
  fx[key] = {{ a, at, dur: opts.duration }};
}}
function setup() {{
  document.getAnimations().forEach((a) => {{ a.pause(); ambient.push(a); }});
  const back = 'cubic-bezier(0.3, 1.45, 0.5, 1)', out = 'cubic-bezier(0.2, 0.8, 0.2, 1)';   // --ease-back, --ease-out
  shot('ring', $('ring'), [{{ opacity: 0, transform: 'scale(0.9) rotate(-24deg)' }}, {{ opacity: 1, transform: 'none' }}], {{ duration: 700, easing: out }}, BEATS.RING);
  shot('stamp', $('stamp'), [
    {{ opacity: 0, transform: 'translateY(-44px) scale(1.5) rotate(-8deg)', offset: 0 }},
    {{ opacity: 1, transform: 'translateY(-52px) scale(1.56) rotate(-6deg)', offset: 0.28 }},
    {{ opacity: 1, transform: 'translateY(0) scale(0.94) rotate(0deg)', offset: 0.62 }},
    {{ opacity: 1, transform: 'translateY(0) scale(1.02) rotate(0deg)', offset: 0.78 }},
    {{ opacity: 1, transform: 'none', offset: 1 }}], {{ duration: 620, easing: back }}, BEATS.SLAM);
  shot('flash', $('flash'), [{{ opacity: 0, transform: 'scale(0.6)' }}, {{ opacity: 1, offset: 0.25 }}, {{ opacity: 0, transform: 'scale(1.5)' }}], {{ duration: 900, easing: 'ease-out' }}, BEATS.HIT);
  shot('bloom', $('bloom'), [{{ opacity: 0.75, transform: 'scale(0.7)' }}, {{ opacity: 0, transform: 'scale(1.75)' }}], {{ duration: 900, easing: 'ease-out' }}, BEATS.HIT);
  shot('shake', $('dial'), [{{ transform: 'none' }}, {{ transform: 'translate(-3px, 2px)', offset: 0.15 }}, {{ transform: 'translate(3px, -2px)', offset: 0.3 }},
    {{ transform: 'translate(-2px, -1px)', offset: 0.45 }}, {{ transform: 'translate(2px, 1px)', offset: 0.6 }}, {{ transform: 'translate(-1px, 0)', offset: 0.8 }}, {{ transform: 'none' }}],
    {{ duration: 320, easing: 'linear' }}, BEATS.HIT);
  shot('week', $('week'), [{{ opacity: 0, transform: 'translateY(6px)' }}, {{ opacity: 1, transform: 'none' }}], {{ duration: 400, easing: 'ease' }}, BEATS.WEEK);
  const slots = [...document.querySelectorAll('.slot')];
  shot('press', slots[6], [{{ opacity: 0, transform: 'scale(1.8)' }}, {{ opacity: 1, transform: 'scale(0.92)', offset: 0.6 }}, {{ opacity: 1, transform: 'scale(1)' }}],
    {{ duration: 450, easing: 'ease-out' }}, BEATS.PRESS);
  slots.forEach((s, i) => shot('gold' + i, s.querySelector('i'), [{{ opacity: 0, transform: 'scale(0.6)' }}, {{ opacity: 1, transform: 'none' }}],
    {{ duration: 450, easing: back }}, BEATS.GOLD + i * 0.06));
}}

/** The frame at t seconds: the print's own motion at t, the loop's at t mod LOOP. */
function render(t) {{
  ambient.forEach((a) => {{ a.currentTime = t * 1000; }});
  const u = ((t % LOOP) + LOOP) % LOOP;
  // the run: the count rolls down to 0 between 0.8 and 6.9 s, the day's thread closing with it
  const p = smooth(clamp((u - 0.8) / 6.1));
  const v = (COUNT + 0.999) * p, f = v - Math.floor(v);
  const n = u >= 11.2 ? COUNT : COUNT - Math.floor(v + 1e-9);   // the next day's count comes back whole
  const r = 1 - (1 - (n === COUNT ? 1 : clamp(f / 0.38))) ** 3;
  $('n0').textContent = n; $('n1').textContent = n + 1;
  $('n0').style.transform = `translateY(${{((1 - r) * 0.5).toFixed(3)}}em)`; $('n0').style.opacity = r.toFixed(3);
  $('n1').style.transform = `translateY(${{(-r * 0.5).toFixed(3)}}em)`; $('n1').style.opacity = (n === COUNT ? 0 : 1 - r).toFixed(3);
  const back = u >= 11.2 ? smooth(clamp((u - 11.2) / 0.8)) : 0;   // the next day, over the loop's last 0.8 s
  const leave = 1 - clamp((u - (F - 0.25)) / 0.25);               // the run's dial going as the finish begins
  $('count').style.opacity = (u < 11.2 ? leave : back).toFixed(3);
  $('ride').setAttribute('stroke-dasharray', `${{(CF * p).toFixed(3)}} ${{CF.toFixed(3)}}`);
  $('ride').style.opacity = (1 - back).toFixed(3);
  const ang = p * 2 * Math.PI;
  $('stop').style.left = `${{MID + FARE * Math.sin(ang)}}px`; $('stop').style.top = `${{MID - FARE * Math.cos(ang)}}px`;
  $('stop').style.opacity = (u < 0.8 ? clamp(u / 0.4) : 1 - back).toFixed(3);
  for (const s of Object.values(fx)) s.a.currentTime = clamp((u - s.at) * 1000, 0, s.dur);
  if (u < BEATS.RING) fx.ring.a.currentTime = fx.ring.dur;        // the run's ring, standing
  $('ringw').style.opacity = (u >= F - 0.25 && u < BEATS.RING ? leave : 1).toFixed(3);
  $('bloom').style.visibility = u >= BEATS.HIT ? 'visible' : 'hidden';
  const lit = u < 11.2 ? clamp((u - BEATS.HIT) / 0.4) : 1 - back;  // the sun's glow giving way to the seal's
  $('sunglow').style.opacity = (1 - lit).toFixed(3); $('sealglow').style.opacity = lit.toFixed(3);
  $('stampw').style.opacity = (1 - back).toFixed(3);
  $('weekw').style.opacity = (1 - back).toFixed(3);
  $('train').style.transform = `translateX(${{(clamp((u - 0.2) / 11.2) * RUN).toFixed(2)}}px)`;
}}
window.render = render;
window.LOOP = LOOP;
window.BEATS = BEATS;
window.WINDOW = {{ top: {TOP}, width: {L.W}, height: {L.W * header.SIZE[1] / header.SIZE[0]:.4f} }};
document.fonts.ready.then(() => {{ setup(); render(0); window.READY = true; }});
</script></body></html>'''


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    ap.add_argument('out')
    ap.add_argument('print', nargs='?', default='autumn-day', choices=sorted(header.PRINTS))
    ap.add_argument('--date', default='2026-10-06', help="the seal's date (its weekday and the week end on it)")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    path = os.path.join(a.out, 'today.html')
    with open(path, 'w') as fh:
        fh.write(page(a.print, datetime.date.fromisoformat(a.date)))
    print(path)


if __name__ == '__main__':
    main()
