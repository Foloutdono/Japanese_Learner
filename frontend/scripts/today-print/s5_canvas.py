"""S⁵ · the canvas's round 5 artboards (plan 261), on a page of their own:
the season's day prints with the meadow laid out (s5_fore.py), the
summer's crape myrtle both ways (A and B, a day each), the ground up
close, and the four on the desk; drawn by round 5's scene (s5_scene.py).

    python3 scripts/today-print/s5_canvas.py ROUND9 OUT [board ...]

ROUND9 and OUT as for s1_canvas.py."""
import os
import re
import sys

import build
import s1_air
import s1_canvas
import s4_birds
import s4_canvas
import s5_scene

s1_canvas.s1 = s5_scene

B = {'myrtle': 'kacho'}
BOARDS = [
    # (file, kind, season, hour, title, variant)
    ('r5-spring.dc.html', 'phone', 'spring', 'day', '春 · the rape blossom in two drifts, the cherry’s petals lying under it', None),
    ('r5-summer-a.dc.html', 'phone', 'summer', 'day', '夏 · 百日紅 A, its florets under it; hydrangea bushes', None),
    ('r5-summer-b.dc.html', 'phone', 'summer', 'day', '夏 · 百日紅 B, the next day', B),
    ('r5-autumn.dc.html', 'phone', 'autumn', 'day', '秋 · cosmos and pampas, the maple’s leaves under it', None),
    ('r5-winter.dc.html', 'phone', 'winter', 'day', '冬 · camellias and dry grass in the snow, the plum’s petals on it', None),
    ('r5-spring-near.dc.html', 'near', 'spring', 'day', '春 · close', None),
    ('r5-summer-a-near.dc.html', 'near', 'summer', 'day', '夏 · A, close', None),
    ('r5-summer-b-near.dc.html', 'near', 'summer', 'day', '夏 · B, close', B),
    ('r5-autumn-near.dc.html', 'near', 'autumn', 'day', '秋 · close', None),
    ('r5-winter-near.dc.html', 'near', 'winter', 'day', '冬 · close', None),
    ('r5-spring-desk.dc.html', 'desk', 'spring', 'day', '春 on the desk', None),
    ('r5-summer-desk.dc.html', 'desk', 'summer', 'day', '夏 on the desk (A)', None),
    ('r5-autumn-desk.dc.html', 'desk', 'autumn', 'day', '秋 on the desk', None),
    ('r5-winter-desk.dc.html', 'desk', 'winter', 'day', '冬 on the desk', None),
    ('r5-summer-b-desk.dc.html', 'desk', 'summer', 'day', '夏 on the desk (B)', B),
]

# the ground up close: the phone's print from (x, y), w × h units
GROUND = (120, 596, 270, 150)


if __name__ == '__main__':
    tpl, root = sys.argv[1], sys.argv[2]
    s1_canvas.TPL = tpl
    os.makedirs(os.path.join(root, 'project'), exist_ok=True)
    only = set(sys.argv[3:])
    seasons_css = s1_air.CSS + s4_birds.CSS
    with open(os.path.join(root, 'project', 'seasons.css'), 'w') as fh:
        fh.write(seasons_css)
    css = open(os.path.join(tpl, 'grand.css')).read() + open(os.path.join(tpl, 'tsuji.css')).read() + seasons_css
    s4_canvas.NEAR = GROUND
    missing = set()
    for name, kind, season, hour, title, variant in BOARDS:
        if only and name not in only:
            continue
        if kind == 'phone':
            s = s1_canvas.phone(season, hour, title, variant=variant)
        elif kind == 'desk':
            s = s4_canvas.desk(season, hour, title, variant)
        else:
            s = s4_canvas.near(season, hour, title, variant)
        for c in s1_canvas.classes(s):
            if c not in build.UNSTYLED and not re.search(r'\.' + re.escape(c) + r'(?![\w-])', css):
                missing.add(c)
        with open(os.path.join(root, 'project', name), 'w') as fh:
            fh.write(s)
        print(f'{name:34} {len(s) // 1024:5} KB')
    print('classes with no rule:', sorted(c for c in missing if not c.startswith(('f9-ph--', 'f9d--', 'f9d-', 'ln--'))))
