"""S² · the canvas's round 2 artboards (plan 261): s1_canvas's
artboards, drawn by round 2's scene (s2_scene.py).

    python3 scripts/today-print/s2_canvas.py ROUND9 OUT [board ...]

ROUND9 and OUT as for s1_canvas.py. Round 2 brings no moving part of
its own: the canvas's seasons.css is round 1's."""
import os
import re
import sys

import build
import s1_air
import s1_canvas
import s2_scene

# round 1's artboards, drawn by round 2's scene
s1_canvas.s1 = s2_scene

BOARDS = [
    # (file, kind, season, hour, title, extra)
    ('r2-spring-dawn.dc.html', 'phone', 'spring', 'dawn', '春 · 春曙, round 2', {}),
    ('r2-spring-day.dc.html', 'phone', 'spring', 'day', '春 · 花霞, round 2', {}),
    ('r2-spring-dusk.dc.html', 'phone', 'spring', 'dusk', '春 · 帰雁, round 2', {}),
    ('r2-spring-night.dc.html', 'phone', 'spring', 'night', '春 · 朧月, round 2', {}),
    ('r2-spring-desk.dc.html', 'desk', 'spring', 'day', '春 · the desk by day, round 2', {}),
    ('r2-summer-dawn.dc.html', 'phone', 'summer', 'dawn', '夏 · 凱風, round 2', {}),
    ('r2-summer-day.dc.html', 'phone', 'summer', 'day', '夏 · 雲峰, round 2', {}),
    ('r2-summer-dusk.dc.html', 'phone', 'summer', 'dusk', '夏 · 夕凪, round 2', {}),
    ('r2-summer-night.dc.html', 'phone', 'summer', 'night', '夏 · 蛍, round 2', {}),
    ('r2-summer-desk.dc.html', 'desk', 'summer', 'day', '夏 · the desk by day, round 2', {}),
    ('r2-summer-day-sarusuberi.dc.html', 'phone', 'summer', 'day', '夏 · 百日紅, otherwise', {'variant': {'tree': 'sarusuberi'}}),
    ('r2-summer-day-yanagi.dc.html', 'phone', 'summer', 'day', '夏 · 柳, otherwise', {'variant': {'tree': 'yanagi'}}),
    ('r2-autumn-dawn.dc.html', 'phone', 'autumn', 'dawn', '秋 · 曙, round 2', {}),
    ('r2-autumn-day.dc.html', 'phone', 'autumn', 'day', '秋 · 帰帆, round 2', {}),
    ('r2-autumn-dusk.dc.html', 'phone', 'autumn', 'dusk', '秋 · 落雁, round 2', {}),
    ('r2-autumn-night.dc.html', 'phone', 'autumn', 'night', '秋 · 秋月, round 2', {}),
    ('r2-autumn-desk.dc.html', 'desk', 'autumn', 'dusk', '秋 · the desk at dusk, round 2', {}),
    ('r2-winter-dawn.dc.html', 'phone', 'winter', 'dawn', '冬 · 寒暁, round 2', {}),
    ('r2-winter-day.dc.html', 'phone', 'winter', 'day', '冬 · 雪晴, round 2', {}),
    ('r2-winter-dusk.dc.html', 'phone', 'winter', 'dusk', '冬 · 暮雪, round 2', {}),
    ('r2-winter-night.dc.html', 'phone', 'winter', 'night', '冬 · 寒月, round 2', {}),
    ('r2-winter-desk.dc.html', 'desk', 'winter', 'day', '冬 · the desk by day, round 2', {}),
    ('r2-winter-day-bare.dc.html', 'phone', 'winter', 'day', '冬 · 雪の木, otherwise', {'variant': {'tree': 'bare'}}),
]


if __name__ == '__main__':
    tpl, root = sys.argv[1], sys.argv[2]
    s1_canvas.TPL = tpl
    os.makedirs(os.path.join(root, 'project'), exist_ok=True)
    only = set(sys.argv[3:])
    css = open(os.path.join(tpl, 'grand.css')).read() + open(os.path.join(tpl, 'tsuji.css')).read() + s1_air.CSS
    missing = set()
    for name, kind, season, hour, title, extra in BOARDS:
        if only and name not in only:
            continue
        if kind == 'phone':
            s = s1_canvas.phone(season, hour, title, **extra)
        else:
            s = s1_canvas.desk(season, hour, title)
        for c in s1_canvas.classes(s):
            if c not in build.UNSTYLED and not re.search(r'\.' + re.escape(c) + r'(?![\w-])', css):
                missing.add(c)
        with open(os.path.join(root, 'project', name), 'w') as fh:
            fh.write(s)
        print(f'{name:36} {len(s) // 1024:5} KB')
    print('classes with no rule:', sorted(c for c in missing if not c.startswith(('f9-ph--', 'f9d--', 'f9d-', 'ln--'))))
