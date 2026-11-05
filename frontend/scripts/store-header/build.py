"""The App Store header (plan 308): the print of the hour, as wide as the
store's product page draws it.

    cd frontend && python3 scripts/store-header/build.py OUT [print ...]

writes OUT/<print>.png, 3840 x 1646 (21:9, RGB, no alpha): the size App
Store Connect asks of a product page's header. A print is a season at an
hour, as Today names it (`autumn-day`, `spring-dawn` ...); the four
seasons' day by default. `--guides` writes beside each a small copy with
the template's art safe area drawn on it, for a look before upload.

It is the print Today's gate stands on (scripts/today-print/), drawn by
that folder's own modules on the desk's frame and seen through a 21:9
window, so a print redrawn there is redrawn here. Apple's template keeps
a header's art in a centred 1646 x 661 box (SAFE, read from its Sketch
file); Fuji and the train stand inside it, the trees and the meadow
outside, where a device may crop them. To fit them there the frame is
changed in a few places (HEADER, fit_sky, sun): Fuji brought to the
middle and sized to the box, the bay made shallower, the train stopped
under the summit, the sky's gradient laid over the window, the sun
without the dial's rings (the dial is the app's). The trees, the meadow
and what flies or falls stand where the desk's print has them.

Shot in Chromium under reduced motion, as scripts/today-print/s1_preview.py
shoots the stills: the app's own rules for the moving parts (index.css,
the print's section), at a device scale that puts the desk's 1184 units
across 3840 pixels. Needs Pillow and a Chromium (CHROME, or Playwright's)."""
import dataclasses
import glob
import os
import subprocess
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.normpath(os.path.join(HERE, '..', 'today-print')))

import build as prints  # noqa: E402  the print's build: its classes, ids, textures
import el7  # noqa: E402
import s1_preview  # noqa: E402  the still: the moving parts at rest
import s1_scene  # noqa: E402
import s5_scene  # noqa: E402
from geo import f  # noqa: E402
from layouts import DESK  # noqa: E402

SIZE = (3840, 1646)                 # App Store Connect's header, 21:9
SAFE = (1097, 493, 1646, 661)       # the template's art safe area: x, y, w, h in pixels
SCALE = SIZE[0] / DESK.W            # pixels per unit: the desk's print across the header
TOP = 352                           # the window's top, in the print's units
DEFAULT = ('spring-day', 'summer-day', 'autumn-day', 'winter-day')

# The desk's frame with the subject brought to the window. The safe
# area is two fifths of the window's height, and Fuji's summit and the
# train both stand in it, so the bay is drawn shallower than the desk's
# (38 units of water, not 54) and the hills a little lower, which leaves
# Fuji the rest: in the middle, its summit at the safe area's top, its
# foot in the mist as on the desk. The sun over its left shoulder, the
# boats on both sides, clouds in the window's sky, a train of six cars
# whose two noses a phone's narrower crop keeps. The trees, the meadow
# and everything else stand where the desk's print has them.
HEADER = dataclasses.replace(
    DESK,
    cx=405, cy=446, disc_r=40, halo_r=50, fare_r=56,
    fuji=(592, 512, 640, 220),
    hills=(618, 634), water=(646, 684), wall=(684, 700), viaduct=(700, 746), ground=746,
    cars=6,
    boats=[(150, 666, 1.0), (330, 658, 0.8), (784, 662, 0.85)],
    lone_boats=[(250, 664, 1.0), (720, 660, 0.95)],
    cranes_path=((1360, 424), (360, 404), 58),   # dawn's cranes, halfway in the window's sky
    cloud_sets={
        'dawn': [(-40, 392, 250, 18), (790, 380, 270, 20), (930, 552, 250, 16)],
        'day': [(-40, 392, 250, 19), (790, 380, 270, 21), (930, 552, 250, 17)],
        'dusk': [(-50, 398, 280, 10), (800, 420, 240, 9)],
        'night': [(-50, 408, 280, 10), (820, 552, 240, 9)],
    },
)
TRAIN_AT = 592                      # where the train's middle stands: under the summit


def train_length():
    """The train's length nose to nose, as scene_f9.train8 draws it."""
    return 2 * el7.NOSE + HEADER.cars * (el7.CAR + el7.GAP) - el7.GAP


def held():
    """Fuji's summit and the train inside the safe area, and the window
    inside the frame: what the layout above must keep."""
    band = (TOP + SAFE[1] / SCALE, TOP + (SAFE[1] + SAFE[3]) / SCALE)
    summit, roof, floor = HEADER.fuji[1], HEADER.viaduct[0] - 13.5, HEADER.viaduct[0] - 0.4
    length = train_length()
    left, right = SAFE[0] / SCALE, (SAFE[0] + SAFE[2]) / SCALE
    problems = []
    if not band[0] < summit < roof < floor < band[1]:
        problems.append(f'Fuji ({summit}) and the train ({roof}-{floor}) are not inside the safe band {band}')
    if not (left < TRAIN_AT - length / 2 and TRAIN_AT + length / 2 < right):
        problems.append(f'the train ({TRAIN_AT - length / 2:.0f}-{TRAIN_AT + length / 2:.0f}) is wider than the safe area')
    if TOP + SIZE[1] / SCALE > HEADER.H:
        problems.append('the window runs past the frame\'s foot')
    return problems


def sun(L, h, uid):
    """The print's sun (or moon) and its glow, without the dial's rings:
    the dial is the app's, and a header has none."""
    r = L.disc_r
    glow_r = r * 1.7
    maria = ''
    if h['maria']:
        blobs = [(-0.56, -0.42, 0.2), (-0.2, -0.66, 0.16), (0.52, -0.5, 0.15), (0.66, 0.34, 0.16), (-0.6, 0.48, 0.13), (0.18, 0.72, 0.12)]
        maria = ''.join(f'<ellipse cx="{f(L.cx + x * r)}" cy="{f(L.cy + y * r)}" rx="{f(s * r)}" ry="{f(s * r * 0.82)}"></ellipse>'
                        for x, y, s in blobs)
        maria = f'<g clip-path="url(#{uid}DiscClip)" fill="#c9b68a" opacity="0.2" filter="url(#{uid}Soft)">{maria}</g>'
    return f'''<defs>
        <radialGradient id="{uid}DiscGlow" cx="{f(L.cx)}" cy="{f(L.cy)}" r="{f(glow_r)}" gradientUnits="userSpaceOnUse">
          <stop offset="{f(r / glow_r)}" stop-color="{h['disc_glow']}" stop-opacity="{h['glow_op']}"></stop>
          <stop offset="{f((r + r * 0.24) / glow_r)}" stop-color="{h['disc_glow']}" stop-opacity="{f(h['glow_op'] * 0.35)}"></stop>
          <stop offset="1" stop-color="{h['disc_glow']}" stop-opacity="0"></stop>
        </radialGradient>
        <radialGradient id="{uid}DiscFill" cx="0.4" cy="0.36" r="0.72">
          <stop offset="0" stop-color="{h['disc_fill'][0]}"></stop>
          <stop offset="1" stop-color="{h['disc_fill'][1]}"></stop>
        </radialGradient>
        <clipPath id="{uid}DiscClip"><circle cx="{f(L.cx)}" cy="{f(L.cy)}" r="{f(r)}"></circle></clipPath>
        <filter id="{uid}Soft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="{f(2.4 * r / 80)}"></feGaussianBlur></filter>
      </defs>
      <circle cx="{f(L.cx)}" cy="{f(L.cy)}" r="{f(glow_r)}" fill="url(#{uid}DiscGlow)"></circle>
      <circle cx="{f(L.cx)}" cy="{f(L.cy)}" r="{f(r)}" fill="url(#{uid}DiscFill)"></circle>
      {maria}'''


def fit_sky(sky):
    """The sky's gradient and the dark band at its top laid over the
    window rather than the frame, so the header's sky runs from the
    hour's deepest ink to its horizon as the print's does, instead of
    showing only the lower, paler half of it."""
    L = HEADER
    band = 0.11 * SIZE[1] / SCALE   # the band's share of the frame, taken of the window
    swaps = [
        (f'id="f4Sky" x1="0" y1="0" x2="0" y2="{f(L.horizon)}"', f'id="f4Sky" x1="0" y1="{f(TOP)}" x2="0" y2="{f(L.horizon)}"'),
        (f'id="f4Band" x1="0" y1="0" x2="0" y2="{f(L.H * 0.11)}"', f'id="f4Band" x1="0" y1="{f(TOP)}" x2="0" y2="{f(TOP + band)}"'),
        (f'<rect width="{L.W}" height="{f(L.H * 0.11)}" fill="url(#f4Band)">', f'<rect y="{f(TOP)}" width="{L.W}" height="{f(band)}" fill="url(#f4Band)">'),
    ]
    for old, new in swaps:
        if sky.count(old) != 1:
            raise SystemExit(f'the sky is not drawn as this script expects: {old}')
        sky = sky.replace(old, new)
    return sky


def layers(name):
    """The print's four layers on the header's frame, as the app's build
    writes them (its classes and ids), and where the train stops."""
    season, hour, variant = parse(name)
    saved = s1_scene.disc
    s1_scene.disc = sun
    try:
        sky, back, train, front, _run = s5_scene.scene(HEADER, hour, season, with_disc=True, variant=variant)
    finally:
        s1_scene.disc = saved
    sky = fit_sky(sky)
    seen = {}
    out = prints.rename_ids([prints.rename_classes(prints.lighter(prints.tight(p)), seen) for p in (sky, back, train, front)])
    # train8 draws the train ending 20 units left of the frame; its layer
    # is carried right until the train's middle stands at TRAIN_AT
    return out, TRAIN_AT + train_length() / 2 + 20


PRINTS = {name: (season, hour, variant) for name, season, hour, variant, _night in prints.PRINTS}


def parse(name):
    """A print as Today names it, read off the print's own list:
    `autumn-day` -> ('autumn', 'day', None), `summer-hanabi` the August
    night's fireworks, a summer print ending in -b the crape myrtle as
    the kachō-e draws it."""
    if name not in PRINTS:
        raise SystemExit(f'not a print: {name} (one of {", ".join(PRINTS)})')
    return PRINTS[name]


def page(parts, shift, css):
    sky, back, train, front = parts
    L = HEADER
    box = f'0 0 {L.W} {L.H}'
    tex = prints.OUT                    # the print's grain and paper tiles, as the app serves them
    return f'''<!doctype html><html><head><meta charset="utf-8"><style>
html,body{{margin:0;background:#000}}
.tpr{{position:relative;width:{L.W}px;height:{L.H}px;overflow:hidden}}
.tpr > *{{position:absolute;left:0;top:0;width:100%;height:100%}}
.g{{height:{(L.horizon + 12) / L.H * 100:.3f}%;background:url(file://{tex}/grain.png) 0 0/640px 120px}}
.p{{background:url(file://{tex}/paper.png) 0 0/128px 128px}}
.tpr__train{{overflow:visible}}
{css}
</style></head><body><div class="tpr">
<svg viewBox="{box}">{sky}</svg><div class="g"></div><svg viewBox="{box}">{back}</svg>
<div style="overflow:hidden"><svg class="tpr__train" viewBox="{box}" style="transform: translateX({f(shift)}px)">{train}</svg></div>
<svg viewBox="{box}">{front}</svg><div class="p"></div></div></body></html>'''


def chrome():
    if os.environ.get('CHROME'):
        return os.environ['CHROME']
    found = sorted(glob.glob('/opt/pw-browsers/chromium-*/chrome-linux*/chrome'))
    return found[-1] if found else 'chromium'


def shoot(name, out, css):
    parts, shift = layers(name)
    html = os.path.join(out, f'.{name}.html')
    full = os.path.join(out, f'.{name}.full.png')
    with open(html, 'w') as fh:
        fh.write(page(parts, shift, css))
    try:
        subprocess.run([chrome(), '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
                        '--force-prefers-reduced-motion', f'--force-device-scale-factor={SCALE:.6f}',
                        f'--window-size={HEADER.W},{HEADER.H + 200}', f'--screenshot={full}', 'file://' + html],
                       check=True, capture_output=True, timeout=600)
        im = Image.open(full).convert('RGB')
        top = round(TOP * SCALE)
        if im.width < SIZE[0] or im.height < top + SIZE[1]:
            raise SystemExit(f'{name}: the shot is {im.width} x {im.height}, too small for the window')
        im = im.crop((0, top, SIZE[0], top + SIZE[1]))
    finally:
        for p in (html, full):
            if os.path.exists(p):
                os.remove(p)
    png = os.path.join(out, f'{name}.png')
    im.save(png, optimize=True)
    return png, im


def guides(im, path):
    """A small copy with the art safe area drawn on it."""
    x, y, w, h = SAFE
    small = im.copy()
    d = ImageDraw.Draw(small)
    d.rectangle((x, y, x + w, y + h), outline=(0, 255, 0), width=6)
    small.thumbnail((1920, 1920))
    small.save(path, quality=88)


def main(argv):
    show = '--guides' in argv
    args = [a for a in argv if a != '--guides']
    if not args:
        raise SystemExit(__doc__)
    out, names = args[0], args[1:] or list(DEFAULT)
    problems = held()
    if problems:
        raise SystemExit('\n'.join(problems))
    os.makedirs(out, exist_ok=True)
    css = s1_preview.moving_css()
    for name in names:
        png, im = shoot(name, out, css)
        print(f'{png}  {im.width} x {im.height}  {os.path.getsize(png) // 1024} KB')
        if show:
            guides(im, os.path.join(out, f'{name}-guides.jpg'))


if __name__ == '__main__':
    main(sys.argv[1:])
