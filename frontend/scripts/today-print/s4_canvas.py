"""S⁴ · the canvas's round 4 artboards (plan 261), on a page of their own:
the gulls redrawn, the crape myrtle three ways and the cloud peak four
ways, drawn by round 4's scene (s4_scene.py); a close view of each tree;
and the canvas's seasons.css with round 4's moving parts.

    python3 scripts/today-print/s4_canvas.py ROUND9 OUT [board ...]

ROUND9 and OUT as for s1_canvas.py."""
import os
import re
import sys

import build
import s1_air
import s1_canvas
import s4_birds
import s4_scene
from layouts import PHONE

s1_canvas.s1 = s4_scene

BOARDS = [
    # (file, kind, season, hour, title, variant)
    ('r4-gulls.dc.html', 'phone', 'autumn', 'day', '海猫 · the gulls, redrawn', None),
    ('r4-gulls-desk.dc.html', 'desk', 'autumn', 'day', '海猫 · the gulls on the desk', None),
    ('r4-myrtle-photo.dc.html', 'phone', 'summer', 'day', '百日紅 · A, as in your photo', {'myrtle': 'photo'}),
    ('r4-myrtle-kacho.dc.html', 'phone', 'summer', 'day', '百日紅 · B, as the kachō-e draws it', {'myrtle': 'kacho'}),
    ('r4-myrtle-flat.dc.html', 'phone', 'summer', 'day', '百日紅 · C, in a few flat shapes', {'myrtle': 'flat'}),
    ('r4-myrtle-photo-near.dc.html', 'near', 'summer', 'day', '百日紅 · A, close', {'myrtle': 'photo'}),
    ('r4-myrtle-kacho-near.dc.html', 'near', 'summer', 'day', '百日紅 · B, close', {'myrtle': 'kacho'}),
    ('r4-myrtle-flat-near.dc.html', 'near', 'summer', 'day', '百日紅 · C, close', {'myrtle': 'flat'}),
    ('r4-peak-hokusai.dc.html', 'phone', 'summer', 'day', '雲の峰 · 1, as Hokusai draws it', {'peak': 'hokusai'}),
    ('r4-peak-tones.dc.html', 'phone', 'summer', 'day', '雲の峰 · 2, in three flat tones', {'peak': 'tones'}),
    ('r4-peak-far.dc.html', 'phone', 'summer', 'day', '雲の峰 · 3, far off behind Fuji', {'peak': 'far'}),
    ('r4-peak-bank.dc.html', 'phone', 'summer', 'day', '雲の峰 · 4, a low bank, no tower', {'peak': 'bank'}),
    ('r4-peak-hokusai-desk.dc.html', 'desk', 'summer', 'day', '雲の峰 · 1 on the desk', {'peak': 'hokusai'}),
    ('r4-peak-tones-desk.dc.html', 'desk', 'summer', 'day', '雲の峰 · 2 on the desk', {'peak': 'tones'}),
    ('r4-peak-far-desk.dc.html', 'desk', 'summer', 'day', '雲の峰 · 3 on the desk', {'peak': 'far'}),
    ('r4-peak-bank-desk.dc.html', 'desk', 'summer', 'day', '雲の峰 · 4 on the desk', {'peak': 'bank'}),
]

# the close view of the tree: the phone's print from (x, y), w × h units,
# drawn at the board's width
NEAR = (200, 440, 190, 306)
NEAR_W = 390


def desk(season, hour, title, variant):
    """s1_canvas's desk artboard, with the variant drawn."""
    layers = s1_canvas.layers

    def with_variant(L, hour_, season_, variant_=None, asbuilt=False):
        return layers(L, hour_, season_, variant, asbuilt)
    s1_canvas.layers = with_variant
    try:
        return s1_canvas.desk(season, hour, title)
    finally:
        s1_canvas.layers = layers


def near(season, hour, title, variant):
    """The tree close: the phone's print cropped to it, its moving parts
    moving, without the gate."""
    h, (sky, back, train, front), run = s1_canvas.layers(PHONE, hour, season, variant)
    x, y, w, hh = NEAR
    H = round(NEAR_W * hh / w)
    box = f'{x} {y} {w} {hh}'
    art = ''.join(f'<svg class="f9-art" viewBox="{box}" aria-hidden="true">{part}</svg>' for part in (sky, back, front))
    return f'''<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>{title}</title>
<script src="./support.js"></script>
<link rel="stylesheet" href="tsuji.css">
<link rel="stylesheet" href="grand.css">
<link rel="stylesheet" href="seasons.css">
</head>
<body>
<x-dc>
<helmet>
<style>
body{{margin:0}}
</style>
</helmet>
<div style="position: relative; width: {NEAR_W}px; height: {H}px; overflow: hidden; background: {h['ground']}">
{art}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":{NEAR_W},"height":{H}}}}}'>
class Component extends DCLogic {{
  renderVals() {{ return {{}}; }}
}}
</script>
</body>
</html>
'''


if __name__ == '__main__':
    tpl, root = sys.argv[1], sys.argv[2]
    s1_canvas.TPL = tpl
    os.makedirs(os.path.join(root, 'project'), exist_ok=True)
    only = set(sys.argv[3:])
    seasons_css = s1_air.CSS + s4_birds.CSS
    with open(os.path.join(root, 'project', 'seasons.css'), 'w') as fh:
        fh.write(seasons_css)
    css = open(os.path.join(tpl, 'grand.css')).read() + open(os.path.join(tpl, 'tsuji.css')).read() + seasons_css
    missing = set()
    for name, kind, season, hour, title, variant in BOARDS:
        if only and name not in only:
            continue
        if kind == 'phone':
            s = s1_canvas.phone(season, hour, title, variant=variant)
        elif kind == 'desk':
            s = desk(season, hour, title, variant)
        else:
            s = near(season, hour, title, variant)
        for c in s1_canvas.classes(s):
            if c not in build.UNSTYLED and not re.search(r'\.' + re.escape(c) + r'(?![\w-])', css):
                missing.add(c)
        with open(os.path.join(root, 'project', name), 'w') as fh:
            fh.write(s)
        print(f'{name:34} {len(s) // 1024:5} KB')
    print('classes with no rule:', sorted(c for c in missing if not c.startswith(('f9-ph--', 'f9d--', 'f9d-', 'ln--'))))
