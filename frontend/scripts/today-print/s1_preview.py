"""S¹ · the seasons' prints as stills, and how the lines under the dial
read on them (plan 261). Each print is laid out as the app lays it
(the sky, the grain, what lies behind, the train, what stands in front,
the paper), with its moving parts styled by the app's own rules
(index.css, the print's section) and the seasons' (s1_air.CSS), and shot
in Chromium under reduced motion: the still print.

    python3 scripts/today-print/s1_preview.py OUT [phone|desk] [season,...] [hour,...]

writes OUT/<season>-<hour>-<device>.png and prints, per print, the
contrast of the hour's ink and its soft ink against the print where the
lines stand (the minutes, the legend, the fare): round 9 held both to
4.5:1. Needs Pillow and a Chromium (CHROME, or Playwright's)."""
import importlib
import json
import os
import subprocess
import sys

from PIL import Image

import build
import s1_air
import s1_inks
from layouts import PHONE, DESK

# the round drawn (SCENE=s2_scene for round 2), and an option (VARIANT,
# as JSON: {"tree": "yanagi"}) whose stills are named with its TAG
s1_scene = importlib.import_module(os.environ.get('SCENE', 's1_scene'))
VARIANT = json.loads(os.environ.get('VARIANT', 'null'))
TAG = os.environ.get('TAG', '')

HERE = os.path.dirname(os.path.abspath(__file__))
FRONTEND = os.path.normpath(os.path.join(HERE, '..', '..'))
CHROME = os.environ.get('CHROME', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome')
TEX = os.path.join(FRONTEND, 'public', 'today', 'print', str(build.REV))

# where the lines stand, in the print's units
ZONES = {
    'phone': [(110, 314, 280, 332), (40, 340, 350, 358)],
    'desk': [(270, 390, 482, 412), (240, 425, 512, 480), (180, 490, 572, 512)],
}


def moving_css():
    css = open(os.path.join(FRONTEND, 'src', 'index.css')).read()
    a = css.index("/* The print's moving parts")
    b = css.index('.tpr-puff { opacity: 0.25; }', a)
    return css[a:b] + '.tpr-puff { opacity: 0.25; }\n}\n' + s1_air.CSS.replace('s1-', 'tpr-')


def class_name(c, _old=build.class_name):
    return 'tpr-' + c[3:] if c.startswith('s1-') else _old(c)


def page(L, layers, run, css):
    sky, back, train, front = layers
    box = f'0 0 {L.W} {L.H}'
    return f'''<!doctype html><html><head><meta charset="utf-8"><style>
html,body{{margin:0;background:#000}}
.tpr{{position:relative;width:{L.W}px;height:{L.H}px;overflow:hidden}}
.tpr > *{{position:absolute;left:0;top:0;width:100%;height:100%}}
.g{{height:{(L.horizon + 12) / L.H * 100:.3f}%;background:url(file://{TEX}/grain.png) 0 0/640px 120px}}
.p{{background:url(file://{TEX}/paper.png) 0 0/128px 128px}}
.tpr__train{{overflow:visible}}
{css}
</style></head><body><div class="tpr">
<svg viewBox="{box}">{sky}</svg><div class="g"></div><svg viewBox="{box}">{back}</svg>
<div style="overflow:hidden"><svg class="tpr__train" viewBox="{box}" style="--tpr-run: {run}%; transform: translateX(calc(var(--tpr-run) * 0.45))">{train}</svg></div>
<svg viewBox="{box}">{front}</svg><div class="p"></div></div></body></html>'''


def shoot(L, season, hour, out, css, device):
    sky, back, train, front, run = s1_scene.scene(L, hour, season, with_disc=True, variant=VARIANT)
    build.class_name = class_name
    seen = {}
    layers = build.rename_ids([build.rename_classes(build.lighter(build.tight(p)), seen) for p in (sky, back, train, front)])
    name = f'{season}-{hour}-{device}' + (f'-{TAG}' if TAG else '')
    html = os.path.join(out, name + '.html')
    png = os.path.join(out, name + '.png')
    with open(html, 'w') as fh:
        fh.write(page(L, layers, run, css))
    subprocess.run([CHROME, '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', '--force-prefers-reduced-motion',
                    f'--window-size={L.W},{L.H + 200}', f'--screenshot={png}', 'file://' + html],
                   check=True, capture_output=True, timeout=180)
    Image.open(png).crop((0, 0, L.W, L.H)).save(png)
    return png


def lum(c):
    def ch(v):
        v /= 255
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    return 0.2126 * ch(c[0]) + 0.7152 * ch(c[1]) + 0.0722 * ch(c[2])


def ratio(a, b):
    la, lb = lum(a), lum(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def worst(png, device, ink):
    """The contrast the ink keeps against all but the worst fiftieth of
    the print under the lines."""
    px = Image.open(png).convert('RGB').load()
    rgb = tuple(int(ink[i:i + 2], 16) for i in (1, 3, 5))
    out = []
    for x0, y0, x1, y1 in ZONES[device]:
        vals = sorted(ratio(rgb, px[x, y]) for x in range(x0, x1, 2) for y in range(y0, y1, 2))
        out.append(vals[len(vals) // 50])
    return min(out)


if __name__ == '__main__':
    out = sys.argv[1]
    device = sys.argv[2] if len(sys.argv) > 2 else 'phone'
    seasons = sys.argv[3].split(',') if len(sys.argv) > 3 else s1_inks.SEASONS
    hours = sys.argv[4].split(',') if len(sys.argv) > 4 else s1_inks.HOURS
    os.makedirs(out, exist_ok=True)
    L = PHONE if device == 'phone' else DESK
    css = moving_css()
    low = 0
    for season in seasons:
        for hour in hours:
            png = shoot(L, season, hour, out, css, device)
            h, _, _ = s1_scene.inks(season, hour)
            a, b = worst(png, device, h['text']), worst(png, device, h['text_soft'])
            low += (a < 4.5) + (b < 4.5)
            print(f'{season:7} {hour:6} ink {a:4.1f} · soft {b:4.1f}{"   <- under 4.5" if min(a, b) < 4.5 else ""}')
    print('under 4.5:', low)
