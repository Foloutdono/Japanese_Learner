"""S¹ · the canvas's print artboards (plan 261). Round 9's artboards of
the canvas "Tsuji — Today, the visit card" (F9-dawn, F9-desk) with the
season's print in place of the hour's, its inks on the gate, its day and
its view on the title slip; and the canvas's seasons.css (s1_air.CSS).

    python3 scripts/today-print/s1_canvas.py ROUND9 OUT [board ...]

ROUND9 is a folder holding that canvas's F9-dawn.dc.html, F9-desk.dc.html,
grand.css and tsuji.css (read from the canvas); OUT the canvas folder the
artboards are written under (OUT/project/<name>.dc.html). The canvas
"Tsuji — Today, the seasons" loads grand.css and tsuji.css as round 9's
does, and seasons.css beside them."""
import os
import re
import sys

import build
import scene_f9
from layouts import PHONE, DESK
import s1_air
import s1_scene as s1
CLOCK = {'dawn': ('07:53', '06:55'), 'day': ('13:43', '12:45'), 'dusk': ('19:53', '18:55'), 'night': ('23:13', '22:15')}
DAY = {
    'spring': ('四月五日', 'lundi 5 avril', '月'),
    'summer': ('七月二十日', 'mardi 20 juillet', '火'),
    'autumn': ('十月二十日', 'mardi 20 octobre', '火'),
    'winter': ('一月二十日', 'mercredi 20 janvier', '水'),
}
WEEK = '月火水木金土日'


def layers(L, hour, season, variant=None, asbuilt=False):
    if asbuilt:
        sky, back, train, front, run = scene_f9.scene(L, hour, with_disc=True)
        h = scene_f9.HOURS[hour]
    else:
        sky, back, train, front, run = s1.scene(L, hour, season, with_disc=True, variant=variant)
        h, _, _ = s1.inks(season, hour)
    sky, back, train, front = (build.lighter(build.tight(p)) for p in (sky, back, train, front))
    return h, (sky, back, train, front), run


def art(L, parts, run, cls):
    sky, back, train, front = parts
    box = f'0 0 {L.W} {L.H}'
    grain = (L.horizon + 12) / L.H * 100
    return (f'<svg class="{cls}" viewBox="{box}" aria-hidden="true">{sky}</svg>'
            f'<div class="f9-tex f9-tex--grain" style="height: {grain:.3f}%" aria-hidden="true"></div>'
            f'<svg class="{cls}" viewBox="{box}" aria-hidden="true">{back}</svg>'
            f'<div class="f9-rail" aria-hidden="true"><svg class="f9-train" viewBox="{box}" style="--run: {run:.3f}%">{train}</svg></div>'
            f'<svg class="{cls}" viewBox="{box}" aria-hidden="true">{front}</svg>')


def inks_style(h):
    return (f'--f9-ink: {h["text"]}; --f9-soft: {h["text_soft"]}; --f9-disc-ink: {h["disc_ink"]}; '
            f'--f9-disc-soft: {h["disc_soft"]}; --f9-count-a: {h["count"][0]}; --f9-count-b: {h["count"][1]}')


def head(s, title):
    s = re.sub(r'<title>.*?</title>', f'<title>{title}</title>', s, count=1)
    return s.replace('<link rel="stylesheet" href="grand.css">',
                     '<link rel="stylesheet" href="grand.css">\n<link rel="stylesheet" href="seasons.css">', 1)


def phone(season, hour, title, variant=None, asbuilt=False):
    s = open(os.path.join(TPL, 'F9-dawn.dc.html')).read()
    h, parts, run = layers(PHONE, hour, season, variant, asbuilt)
    s = head(s, title)
    s = re.sub(r'<div class="ph f9-ph f9-ph--dawn" style="[^"]*">',
               f'<div class="ph f9-ph f9-ph--{hour}" style="{inks_style(h)}">', s, count=1)
    a, b = s.index('<svg class="f9-art"'), s.index('<div class="f9-tex f9-tex--paper"')
    s = s[:a] + art(PHONE, parts, run, 'f9-art') + '\n' + s[b:]
    jp, fr, _ = DAY[season]
    view, view_fr = h['view'], h['view_fr']
    s = re.sub(r'<p class="f9-title" lang="ja" aria-label="[^"]*">.*?</p>',
               f'<p class="f9-title" lang="ja" aria-label="{fr} — {view_fr}">{jp}<span class="f9-title__view">{view}</span></p>', s, count=1)
    end, plus = CLOCK[hour]
    s = s.replace('fini vers 07:53', f'fini vers {end}').replace('+1 à 06:55', f'+1 à {plus}')
    return s


def desk(season, hour, title):
    s = open(os.path.join(TPL, 'F9-desk.dc.html')).read()
    h, parts, run = layers(DESK, hour, season)
    s = head(s, title)
    s = re.sub(r'<div class="dk f9d f9d--dusk" style="[^"]*">',
               f'<div class="dk f9d f9d--{hour}" style="{inks_style(h)}">', s, count=1)
    a, b = s.index('<svg class="f9d-art"'), s.index('<div class="f9-tex f9-tex--paper"')
    s = s[:a] + art(DESK, parts, run, 'f9d-art') + '\n' + s[b:]
    jp, fr, wd = DAY[season]
    s = re.sub(r'<p class="f9-title f9d-title" lang="ja" aria-label="[^"]*">.*?</p>',
               f'<p class="f9-title f9d-title" lang="ja" aria-label="{fr} — {h["view_fr"]}">{jp}<span class="f9-title__view">{h["view"]}</span></p>', s, count=1)
    end, plus = CLOCK[hour]
    s = s.replace('fini vers 19:53', f'fini vers {end}').replace('· +1 à 18:55</span>\n      </p>', f'· +1 à {plus}</span>\n      </p>')
    # the week's days from today's
    k = WEEK.index(wd)
    days = [WEEK[(k + j) % 7] for j in range(7)]
    marks = iter(days)
    s = re.sub(r'(<div class="week__d[^"]*">.*?<span lang="ja">)(.)(</span>)', lambda m: m.group(1) + next(marks) + m.group(3), s)
    s = s.replace('<span class="stamp stamp--today" lang="ja" style="transform: rotate(-4deg)">火</span>',
                  f'<span class="stamp stamp--today" lang="ja" style="transform: rotate(-4deg)">{wd}</span>')
    return s


BOARDS = [
    # (file, kind, season, hour, title, extra)
    ('Main.dc.html', 'phone', 'spring', 'dawn', '春 · 春曙 — spring dawn', {}),
    ('spring-day.dc.html', 'phone', 'spring', 'day', '春 · 花霞 — the cherries in their haze', {}),
    ('spring-dusk.dc.html', 'phone', 'spring', 'dusk', '春 · 帰雁 — the geese going home', {}),
    ('spring-night.dc.html', 'phone', 'spring', 'night', '春 · 朧月 — the hazy moon', {}),
    ('spring-desk.dc.html', 'desk', 'spring', 'dawn', '春 · the desk at dawn', {}),
    ('summer-dawn.dc.html', 'phone', 'summer', 'dawn', '夏 · 凱風 — Red Fuji', {}),
    ('summer-day.dc.html', 'phone', 'summer', 'day', '夏 · 雲峰 — the cloud peak', {}),
    ('summer-dusk.dc.html', 'phone', 'summer', 'dusk', '夏 · 夕凪 — the evening calm', {}),
    ('summer-night.dc.html', 'phone', 'summer', 'night', '夏 · 蛍 — the fireflies', {}),
    ('summer-desk.dc.html', 'desk', 'summer', 'night', '夏 · the desk at night', {}),
    ('summer-night-hanabi.dc.html', 'phone', 'summer', 'night', '夏 · 花火 — the fireworks', {'variant': {'fireworks': True}}),
    ('autumn-dawn.dc.html', 'phone', 'autumn', 'dawn', '秋 · 曙 — dawn, the maples', {}),
    ('autumn-day.dc.html', 'phone', 'autumn', 'day', '秋 · 帰帆 — the sails, the maples', {}),
    ('autumn-dusk.dc.html', 'phone', 'autumn', 'dusk', '秋 · 落雁 — the geese, the maples', {}),
    ('autumn-night.dc.html', 'phone', 'autumn', 'night', '秋 · 秋月 — the autumn moon', {}),
    ('autumn-desk.dc.html', 'desk', 'autumn', 'dusk', '秋 · the desk at dusk', {}),
    ('autumn-dusk-now.dc.html', 'phone', 'autumn', 'dusk', '秋 · 落雁 as built', {'asbuilt': True}),
    ('winter-dawn.dc.html', 'phone', 'winter', 'dawn', '冬 · 寒暁 — the cold dawn', {}),
    ('winter-day.dc.html', 'phone', 'winter', 'day', '冬 · 雪晴 — clear after snow', {}),
    ('winter-dusk.dc.html', 'phone', 'winter', 'dusk', '冬 · 暮雪 — the evening snow', {}),
    ('winter-night.dc.html', 'phone', 'winter', 'night', '冬 · 寒月 — the winter moon', {}),
    ('winter-desk.dc.html', 'desk', 'winter', 'dawn', '冬 · the desk at dawn', {}),
]


def classes(markup):
    out = set()
    for m in re.finditer(r'class="([^"]*)"', markup):
        out.update(m.group(1).split())
    return out


if __name__ == '__main__':
    TPL, root = sys.argv[1], sys.argv[2]
    os.makedirs(os.path.join(root, 'project'), exist_ok=True)
    only = set(sys.argv[3:])
    with open(os.path.join(root, 'project', 'seasons.css'), 'w') as fh:
        fh.write(s1_air.CSS)
    css = open(os.path.join(TPL, 'grand.css')).read() + open(os.path.join(TPL, 'tsuji.css')).read() + s1_air.CSS
    missing = set()
    for name, kind, season, hour, title, extra in BOARDS:
        if only and name not in only:
            continue
        s = phone(season, hour, title, **extra) if kind == 'phone' else desk(season, hour, title)
        for c in classes(s):
            if c not in build.UNSTYLED and not re.search(r'\.' + re.escape(c) + r'(?![\w-])', css):
                missing.add(c)
        with open(os.path.join(root, 'project', name), 'w') as fh:
            fh.write(s)
        print(f'{name:32} {len(s) // 1024:5} KB')
    print('classes with no rule:', sorted(missing))
