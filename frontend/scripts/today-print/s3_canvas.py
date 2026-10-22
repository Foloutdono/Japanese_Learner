"""S³ · the canvas's round 3 artboards (plan 261): the summer as the owner
chose it, drawn by round 3's scene (s3_scene.py) -- the cloud peak as a
cumulus, the crape myrtle redrawn, the night by the month -- and the
year as chosen, by the month.

    python3 scripts/today-print/s3_canvas.py ROUND9 OUT [board ...]

ROUND9 and OUT as for s1_canvas.py. Round 3 brings no moving part of
its own: the canvas's seasons.css is round 1's."""
import os
import re
import sys

import build
import s1_air
import s1_canvas
import s3_inks
import s3_scene

s1_canvas.s1 = s3_scene

AUGUST = ('八月十五日', 'samedi 15 août', '土')

BOARDS = [
    # (file, kind, season, hour, title, extra)
    ('r3-summer-dawn.dc.html', 'phone', 'summer', 'dawn', '夏 · 凱風, round 3', {}),
    ('r3-summer-day.dc.html', 'phone', 'summer', 'day', '夏 · 雲峰, round 3', {}),
    ('r3-summer-dusk.dc.html', 'phone', 'summer', 'dusk', '夏 · 夕凪, round 3', {}),
    ('r3-summer-night.dc.html', 'phone', 'summer', 'night', '夏 · 蛍, June and July', {}),
    ('r3-summer-night-hanabi.dc.html', 'phone', 'summer', 'night', '夏 · 花火, August', {'night': 'hanabi'}),
    ('r3-summer-desk.dc.html', 'desk', 'summer', 'day', '夏 · the desk by day, round 3', {}),
]


def phone(season, hour, title, night=None):
    if not night:
        return s1_canvas.phone(season, hour, title)
    saved = s1_canvas.DAY[season]
    s1_canvas.DAY[season] = AUGUST
    try:
        s = s1_canvas.phone(season, hour, title, variant=s3_inks.NIGHTS[night])
    finally:
        s1_canvas.DAY[season] = saved
    view, view_fr = s3_inks.NIGHT_VIEWS[night], s3_inks.NIGHT_VIEWS_FR[night]
    jp, fr, _ = AUGUST
    return re.sub(r'<p class="f9-title" lang="ja" aria-label="[^"]*">.*?</p>',
                  f'<p class="f9-title" lang="ja" aria-label="{fr} — {view_fr}">{jp}<span class="f9-title__view">{view}</span></p>',
                  s, count=1)


SEASON_INK = {'spring': '#e8a3bd', 'summer': '#5b9fd6', 'autumn': '#d9663e', 'winter': '#c9d6e6'}
SEASON_SOFT = {'spring': '#e8a3bd', 'summer': '#8fb6e8', 'autumn': '#e9865c', 'winter': '#c9d6e6'}
CAPTIONS = {
    'spring': {'dawn': 'spring dawn, the cherry', 'day': 'the cherries in their haze', 'dusk': 'the geese going home',
               'night': 'the hazy moon, lanterns'},
    'summer': {'dawn': 'Red Fuji, the south wind', 'day': 'the cloud peak, the crape myrtle', 'dusk': 'the evening calm, egrets',
               'night': 'the fireflies'},
    'autumn': {'dawn': 'dawn, the maples', 'day': 'the sails, the maples', 'dusk': 'the geese coming down',
               'night': 'the autumn moon'},
    'winter': {'dawn': 'the cold dawn, the red plum', 'day': 'clear after snow, the plum', 'dusk': 'the evening snow',
               'night': 'the winter moon'},
}
HOUR_LABEL = {'dawn': ('Dawn', '05:00 – 09:00'), 'day': ('Day', '09:00 – 16:00'), 'dusk': ('Dusk', '16:00 – 19:30'),
              'night': ('Night', '19:30 – 05:00')}
MOTTO = {'spring': 'はあけぼの', 'summer': 'は夜', 'autumn': 'は夕暮れ', 'winter': 'はつとめて'}


def slip(view, caption, months=''):
    """A view's title slip, as the gate's is printed."""
    extra = f'<span style="font-size: 12px; color: #6a5f50; margin-left: auto">{months}</span>' if months else ''
    return (f'<span style="display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: #efe3bf; color: #1d1a16; '
            f'border: 1px solid #1d1a16; box-shadow: inset 0 0 0 2px #efe3bf, inset 0 0 0 3px #a8382a">'
            f'<b lang="ja" style="font-family: \'Noto Serif JP\', serif; font-weight: 900; font-size: 20px; color: #a8382a">{view}</b>'
            f'<span style="font-size: 13px">{caption}</span>{extra}</span>')


def year():
    """The year as chosen: the seasons by the month, the summer's night
    split by it too, and the seventeen views."""
    # the months' starts across the year, in days
    starts = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365]

    def pc(m):
        return f'{starts[m] / 365 * 100:.2f}%'

    def span(m0, m1):
        return f'left: {pc(m0)}; width: {(starts[m1] - starts[m0]) / 365 * 100:.2f}%'
    months = ''.join(f'<span style="position: absolute; left: {pc(m)}">{n}</span>'
                     for m, n in enumerate(('JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC')))
    block = ('position: absolute; top: 0; bottom: 0; padding: 10px 12px; box-sizing: border-box; '
             'display: flex; flex-direction: column; gap: 6px; border-top: 3px solid {ink}; background: {bg}')
    serif = "font-family: 'Noto Serif JP', serif; font-weight: 900; font-size: 26px"

    def season_block(m0, m1, season, kanji, tree, dates):
        return (f'<div style="{span(m0, m1)}; {block.format(ink=SEASON_INK[season], bg="#161d2c" if season in ("spring", "autumn") else "#121a28")}">'
                f'<span lang="ja" style="{serif}">{kanji} <small style="font-size: 15px; font-weight: 700; color: {SEASON_SOFT[season]}">{tree}</small></span>'
                f'<span style="font-size: 13px; color: #a9a39a">{dates}</span></div>')
    bar = (season_block(0, 2, 'winter', '冬', '紅梅', 'to 28 February')
           + season_block(2, 5, 'spring', '春', '桜', '1 March – 31 May')
           + season_block(5, 8, 'summer', '夏', '百日紅・紫陽花', '1 June – 31 August')
           + season_block(8, 11, 'autumn', '秋', '紅葉', '1 September – 30 November')
           + season_block(11, 12, 'winter', '冬', '紅梅', 'from 1 Dec.')
           + '<div style="position: absolute; left: 80%; top: -6px; bottom: -6px; width: 2px; background: #e6bd62"></div>')
    nights = (f'<div style="position: absolute; {span(5, 7)}; top: 0; bottom: 0; border-top: 2px solid #c8d86a; background: #10161f; '
              f'padding: 6px 10px; box-sizing: border-box; font-size: 13px; display: flex; gap: 8px; align-items: center">'
              f'<b lang="ja" style="font-family: \'Noto Serif JP\', serif; font-size: 16px; color: #d6e48a">蛍</b><span style="color: #a9a39a">the fireflies</span></div>'
              f'<div style="position: absolute; {span(7, 8)}; top: 0; bottom: 0; border-top: 2px solid #f0a35a; background: #10161f; '
              f'padding: 6px 10px; box-sizing: border-box; font-size: 13px; display: flex; gap: 8px; align-items: center">'
              f'<b lang="ja" style="font-family: \'Noto Serif JP\', serif; font-size: 16px; color: #f6be7c">花火</b></div>')
    head = '<span></span>' + ''.join(
        f'<b lang="ja" style="font-family: \'Noto Serif JP\', serif; font-weight: 900; font-size: 22px; border-top: 3px solid {SEASON_INK[s]}; padding-top: 8px">'
        f'{k} <small style="font-family: \'Space Grotesk\', sans-serif; font-weight: 500; font-size: 14px; color: #a9a39a">{MOTTO[s]}</small></b>'
        for s, k in (('spring', '春'), ('summer', '夏'), ('autumn', '秋'), ('winter', '冬')))
    rows = []
    for hour in ('dawn', 'day', 'dusk', 'night'):
        label, hours = HOUR_LABEL[hour]
        rows.append(f'<span style="display: flex; flex-direction: column; gap: 2px; justify-content: center"><b style="font-size: 16px">{label}</b>'
                    f'<span style="font-size: 13px; color: #a9a39a">{hours}</span></span>')
        for season in ('spring', 'summer', 'autumn', 'winter'):
            view = s3_inks.VIEWS[season][hour]
            if season == 'summer' and hour == 'night':
                rows.append('<span style="display: flex; flex-direction: column; gap: 6px">'
                            + slip(view, CAPTIONS[season][hour], 'June, July')
                            + slip(s3_inks.NIGHT_VIEWS['hanabi'], 'the fireworks', 'August') + '</span>')
            else:
                rows.append(slip(view, CAPTIONS[season][hour]))
    return f'''<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>The year as chosen</title>
<script src="./support.js"></script>
<link rel="stylesheet" href="tsuji.css">
</head>
<body>
<x-dc>
<helmet>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&amp;family=Noto+Serif+JP:wght@500;700;900&amp;family=Space+Grotesk:wght@400;500;600;700&amp;display=swap">
<style>
body{{margin:0}}
</style>
</helmet>
<div style="width: 1440px; height: 900px; box-sizing: border-box; padding: 52px 56px; display: flex; flex-direction: column; gap: 40px; background: #0a101b; color: #ece5d8; font-family: 'Space Grotesk', sans-serif">

  <section aria-label="The calendar" style="display: flex; flex-direction: column; gap: 14px">
    <div style="position: relative; height: 18px; margin-left: 216px; font-size: 13px; color: #a9a39a; letter-spacing: 0.06em">{months}</div>
    <div style="display: flex; gap: 16px; align-items: stretch">
      <div style="width: 200px; flex: none; display: flex; flex-direction: column; justify-content: center; gap: 4px">
        <b style="font-size: 17px">By the month</b>
        <span style="font-size: 13px; color: #a9a39a">as the seasons are counted today</span>
      </div>
      <div style="position: relative; flex: 1; height: 96px">{bar}</div>
    </div>
    <div style="display: flex; gap: 16px; align-items: stretch">
      <div style="width: 200px; flex: none; display: flex; flex-direction: column; justify-content: center; gap: 4px">
        <b style="font-size: 15px">The summer night</b>
        <span style="font-size: 13px; color: #a9a39a">split by the month too</span>
      </div>
      <div style="position: relative; flex: 1; height: 40px">{nights}</div>
    </div>
    <div style="position: relative; height: 18px; margin-left: 216px">
      <span style="position: absolute; left: 80%; translate: -50% 0; font-size: 13px; color: #e6bd62; white-space: nowrap">today · 20 October</span>
    </div>
  </section>

  <section aria-label="The seventeen views" style="display: grid; grid-template-columns: 200px repeat(4, minmax(0, 1fr)); gap: 12px 16px; align-items: stretch">
    {head}
    {"".join(rows)}
  </section>
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{{"$preview":{{"width":1440,"height":900}}}}'>
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
    css = open(os.path.join(tpl, 'grand.css')).read() + open(os.path.join(tpl, 'tsuji.css')).read() + s1_air.CSS
    missing = set()
    for name, kind, season, hour, title, extra in BOARDS:
        if only and name not in only:
            continue
        s = phone(season, hour, title, **extra) if kind == 'phone' else s1_canvas.desk(season, hour, title)
        for c in s1_canvas.classes(s):
            if c not in build.UNSTYLED and not re.search(r'\.' + re.escape(c) + r'(?![\w-])', css):
                missing.add(c)
        with open(os.path.join(root, 'project', name), 'w') as fh:
            fh.write(s)
        print(f'{name:36} {len(s) // 1024:5} KB')
    if not only or 'r3-year.dc.html' in only:
        with open(os.path.join(root, 'project', 'r3-year.dc.html'), 'w') as fh:
            fh.write(year())
        print('r3-year.dc.html')
    print('classes with no rule:', sorted(c for c in missing if not c.startswith(('f9-ph--', 'f9d--', 'f9d-', 'ln--'))))
