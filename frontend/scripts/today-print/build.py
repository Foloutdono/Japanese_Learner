"""浮世絵 — the print of the hour, built for the app (plan 205).

Writes what Today's gate draws behind itself
(components/station/TodayPrint.jsx):

  public/today/print/<REV>/<hour>-<phone|desk>.json
      the print in four layers -- the sky, what lies behind the train,
      the train, what stands in front of it -- each an <svg>, with the
      train's run across the print and its time;
  public/today/print/<REV>/grain.png, paper.png
      the sky's wood grain and the paper's fibre, tiles drawn once;
  src/components/station/print/print.json
      what the app draws itself, per hour: the disc's inks (the dial is
      the app's, live), the inks of the lines set on the print, the
      sky's stops for the frame under it; and the two frames' geometry.

The print's moving parts carry tpr-* classes, styled in index.css (the
print's section); a class renamed here is renamed there.
src/todayPrint.test.js holds the two equal.

    cd frontend && python3 scripts/today-print/build.py

Needs numpy and Pillow (the textures). The print is the canvas
"Tsuji — Today, the visit card", round 9: the modules are the rounds'
own (see README.md), and their output is the canvas's byte for byte.
Bump REV whenever the output changes, so no learner keeps a cached
print (the service worker keeps /today/ cache-first).
"""
import base64
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import textures  # noqa: E402
from layouts import PHONE, DESK  # noqa: E402
from scene_f9 import HOURS, scene  # noqa: E402

REV = 1
FRONTEND = os.path.normpath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(FRONTEND, 'public', 'today', 'print', str(REV))
SRC = os.path.join(FRONTEND, 'src', 'components', 'station', 'print', 'print.json')
ORDER = ('dawn', 'day', 'dusk', 'night')
# the train's crossing in seconds, and how far into it the print opens
DEVICES = (('phone', PHONE, 46, 20), ('desk', DESK, 84, 31))


# Hooks the rounds drew by and never styled: left out of the print, so
# every class it carries has a rule (src/todayPrint.test.js).
UNSTYLED = {'fuji', 'f4-stars', 'f5-clouds', 'f5-tilt--geese', 'f7-pine', 'b5-gull', 'b5-ghand--r'}


def class_name(c):
    """The canvas's classes (a round's prefix each) as the app's one
    namespace."""
    if c.startswith('b5-'):
        return 'tpr-bird-' + c[3:]
    if c == 'f4-flame':
        return 'tpr-flare'          # the lantern's glow; f7-flame is the fire's tongues
    if c == 'fuji':
        return 'tpr-fuji'
    m = re.match(r'f\d-(.+)$', c)
    if not m:
        raise ValueError(f'a class the build does not know: {c}')
    return 'tpr-' + m.group(1)


def rename_classes(markup, seen):
    def one(m):
        out = []
        for c in m.group(1).split():
            if c in UNSTYLED:
                continue
            n = class_name(c)
            if seen.setdefault(n, c) != c:
                raise ValueError(f'{c} and {seen[n]} would both be {n}')
            out.append(n)
        return f' class="{" ".join(out)}"' if out else ''
    return re.sub(r' class="([^"]*)"', one, markup)


def rename_ids(layers):
    """Every id given the print's prefix, and every reference to it, so
    nothing in the print can meet an id of the app's."""
    ids = set()
    for part in layers:
        ids.update(re.findall(r'\bid="([^"]+)"', part))
    def fix(part):
        part = re.sub(r'\bid="([^"]+)"', lambda m: f'id="tpr-{m.group(1)}"', part)
        part = re.sub(r'url\(#([^)]+)\)', lambda m: f'url(#tpr-{m.group(1)})' if m.group(1) in ids else m.group(0), part)
        part = re.sub(r'href="#([^"]+)"', lambda m: f'href="#tpr-{m.group(1)}"' if m.group(1) in ids else m.group(0), part)
        return part
    return [fix(p) for p in layers]


def tight(markup):
    return re.sub(r'>\s+<', '><', markup).strip()


def _fmt(v):
    s = f'{v:.1f}'.rstrip('0').rstrip('.')
    return '0' if s in ('-0', '') else s


_ML = re.compile(r'(?:[ML]\s*-?[\d.]+[ ,]+-?[\d.]+\s*)+')
_NUM = re.compile(r'-?\d+\.\d+')


def _path(d):
    """Path data to a tenth of a unit (a twentieth of a pixel at most
    on either frame, never seen); a path of straight strokes alone -- the
    pine's needles, the grass's hairs -- as moves and relative lines,
    which is most of the print's weight. Each step is rounded against
    where the last one landed, so no error gathers along a path."""
    if _ML.fullmatch(d.strip()):
        out, x, y = [], 0.0, 0.0
        for cmd, a, b in re.findall(r'([ML])\s*(-?[\d.]+)[ ,]+(-?[\d.]+)', d):
            a, b = float(a), float(b)
            if cmd == 'M':
                x, y = round(a, 1), round(b, 1)
                out.append(f'M{_fmt(x)} {_fmt(y)}')
            else:
                dx, dy = round(a - x, 1), round(b - y, 1)
                x, y = x + dx, y + dy
                ys = _fmt(dy)
                out.append('l' + _fmt(dx) + ('' if ys.startswith('-') else ' ') + ys)
        return ''.join(out)
    return _NUM.sub(lambda n: _fmt(float(n.group(0))), d)


def lighter(markup):
    return re.sub(r'\bd="([^"]*)"', lambda m: f'd="{_path(m.group(1))}"', markup)


def png(data_uri):
    return base64.b64decode(data_uri.split(',', 1)[1])


def main():
    os.makedirs(OUT, exist_ok=True)
    seen = {}
    for hour in ORDER:
        for device, L, dur, delay in DEVICES:
            sky, back, train, front, run = scene(L, hour, with_disc=False)
            layers = rename_ids([rename_classes(lighter(tight(p)), seen) for p in (sky, back, train, front)])
            doc = {
                'rev': REV, 'hour': hour, 'device': device, 'w': L.W, 'h': L.H,
                'train': {'run': round(run, 3), 'dur': dur, 'delay': delay},
                'layers': dict(zip(('sky', 'back', 'train', 'front'), layers)),
            }
            path = os.path.join(OUT, f'{hour}-{device}.json')
            with open(path, 'w') as fh:
                json.dump(doc, fh, ensure_ascii=False, separators=(',', ':'))
            print(f'{os.path.relpath(path, FRONTEND)}  {os.path.getsize(path) // 1024} KB')
    with open(os.path.join(OUT, 'grain.png'), 'wb') as fh:
        fh.write(png(textures.grain()))
    with open(os.path.join(OUT, 'paper.png'), 'wb') as fh:
        fh.write(png(textures.paper()))

    def frame(L):
        return {'w': L.W, 'h': L.H, 'cx': L.cx, 'cy': L.cy, 'disc': L.disc_r, 'halo': L.halo_r, 'fare': L.fare_r,
                'horizon': L.horizon}
    hours = {}
    for hour in ORDER:
        h = HOURS[hour]
        hours[hour] = {
            'view': h['view'],
            'sky': [[o, c] for o, c in h['sky']],
            'band': h['band'],
            'ground': h['ground'],
            'disc': {
                'kind': h['disc'], 'fill': list(h['disc_fill']), 'glow': h['disc_glow'], 'glowOp': h['glow_op'],
                'haloGlow': h['halo_glow'], 'maria': bool(h['maria']), 'fare': h['fare_ink'],
            },
            'ink': {
                'text': h['text'], 'soft': h['text_soft'], 'discSoft': h['disc_soft'],
                'countA': h['count'][0], 'countB': h['count'][1],
            },
        }
    with open(SRC, 'w') as fh:
        json.dump({'rev': REV, 'frames': {'phone': frame(PHONE), 'desk': frame(DESK)}, 'hours': hours},
                  fh, ensure_ascii=False, indent=2)
        fh.write('\n')
    print(os.path.relpath(SRC, FRONTEND))
    print('classes:', ' '.join(sorted(seen)))


if __name__ == '__main__':
    main()
