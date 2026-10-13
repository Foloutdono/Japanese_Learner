"""The mark (plan 158): 辻 in Noto Serif JP Black, its road in the metal.

The one-dot 辻 -- five strokes, the form DESIGN.md names -- is not in the
font: Noto Serif JP draws 辻 with two dots (JIS2004) and ships no jp90
alternate. So the mark is cut from the face itself: the 十 from 辻
(U+8FBB) and the one-dot 辶 from 込 (U+8FBC), which the font draws with
the same radical in the same place. The 辶's sweep -- the road the radical
stands for -- is the gold; everything else is the ink. `--dots 2` cuts the
font's own 辻 instead.

Writes, from those outlines and nothing else:

  src/components/ui/markPaths.js   the two paths the app draws (Mark.jsx)
  brand/mark.svg                   the mark alone, paper and gold
  brand/icon.svg                   the app icon, 1024, on the icon's blue
  brand/icon-foreground.svg        Android's adaptive layer, in its safe zone
  brand/icon-background.svg        ... and its ground
  brand/splash.svg                 the native splash, 2732, on the page ground

scripts/render-icon.mjs turns the SVGs into the PNGs the generators read
(`npm run icons`, `npm run assets:native`). Dev-time only, like it; needs
`pip install fonttools brotli` and the @fontsource package installed:

  python3 scripts/build-mark.py && npm run icons && npm run assets:native

(`assets:native` ends in scripts/sharpen-launcher.mjs, which redraws the
adaptive foreground at the size the launcher shows it.)
"""
import argparse
import glob
import os

from fontTools.pens.boundsPen import BoundsPen
from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FONTS = os.path.join(ROOT, 'node_modules/@fontsource/noto-serif-jp/files')

# The token values, written out: an icon file cannot read a custom property.
GROUND = '#17151a'  # --bg-main (dark), the splash and the boot screen
PAPER = '#f3ecdf'   # --text-on-panel
GOLD = '#c99a3e'    # --accent2, the pass's metal
GOLD_LIT = '#e6bd62'  # --gate-gold-lit, the metal where it catches the light

# The icon's ground (plan 204, the owner's pick of the blues drawn on the
# home screen): a blue lit from the top, 紺 at the foot. The road, low on
# it, takes the lit gold: about 5:1 against the blue there, where
# --accent2 holds under 4.
BLUE_TOP = '#1f8fd0'
BLUE_FOOT = '#1b2f68'

ASCENT = 880        # the em box's top above the baseline, in font units
EM = 1000


def num(v):
    return ('%.1f' % v).rstrip('0').rstrip('.')


def contours(ch, weight=900):
    for fn in sorted(glob.glob(os.path.join(FONTS, f'noto-serif-jp-*-{weight}-normal.woff2'))):
        font = TTFont(fn)
        cmap = font.getBestCmap()
        if ord(ch) in cmap:
            glyphs = font.getGlyphSet()
            rec = RecordingPen()
            glyphs[cmap[ord(ch)]].draw(rec)
            out, cur = [], []
            for op, args in rec.value:
                cur.append((op, args))
                if op in ('closePath', 'endPath'):
                    out.append(cur)
                    cur = []
            return out
    raise SystemExit(f'{ch} not found in {FONTS} -- is @fontsource/noto-serif-jp installed?')


def bounds(cs):
    pen = BoundsPen(None)
    for c in cs:
        for op, args in c:
            getattr(pen, op)(*args)
    x0, y0, x1, y1 = pen.bounds
    return x0, ASCENT - y1, x1, ASCENT - y0          # y down from the em box's top


def split(dots):
    """(ink, road): the contours by what they are, not by their order."""
    wide = lambda c: bounds([c])[2] - bounds([c])[0] > 800
    tsuji = contours('辻')
    road = [c for c in tsuji if wide(c)]
    cross = [c for c in tsuji if not wide(c) and bounds([c])[0] > 300]
    if dots == 2:
        rest = [c for c in tsuji if not wide(c) and bounds([c])[0] <= 300]
    else:
        komu = contours('込')
        road = [c for c in komu if wide(c)]
        rest = [c for c in komu if not wide(c) and bounds([c])[2] < 400]
    assert len(road) == 1 and len(cross) == 2 and len(rest) == (2 if dots == 1 else 3), \
        'the font no longer draws 辻/込 as expected -- look at the contours before trusting the mark'
    return cross + rest, road


def path(cs, s=1.0, tx=0.0, ty=0.0):
    """contours -> svg path data, y flipped, scaled by s about the em box's top-left"""
    pen = SVGPathPen(None, ntos=num)
    tp = TransformPen(pen, (s, 0, 0, -s, tx, ty + ASCENT * s))
    for c in cs:
        for op, args in c:
            getattr(tp, op)(*args)
    return pen.getCommands()


def placed(ink, road, height, cx, cy):
    """the mark scaled so its INK is `height` tall, its ink centred on (cx, cy)"""
    x0, y0, x1, y1 = bounds(ink + road)
    s = height / (y1 - y0)
    tx, ty = cx - (x0 + x1) / 2 * s, cy - (y0 + y1) / 2 * s
    return path(ink, s, tx, ty), path(road, s, tx, ty)


def svg(size, body, ground=None):
    rect = f'<rect width="{size}" height="{size}" fill="{ground}"/>' if ground else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" '
            f'width="{size}" height="{size}">{rect}{body}</svg>\n')


def blue(size):
    # The icon's ground, as a body: its own gradient, then the panel it fills.
    return ('<defs><linearGradient id="blue" x1="0" y1="0" x2="0.35" y2="1">'
            f'<stop offset="0" stop-color="{BLUE_TOP}"/><stop offset="1" stop-color="{BLUE_FOOT}"/>'
            f'</linearGradient></defs><rect width="{size}" height="{size}" fill="url(#blue)"/>')


def mark(ink_d, road_d, ink=PAPER, road=GOLD):
    # The road first: the ink's zigzag lands on it at the joint.
    return f'<path d="{road_d}" fill="{road}"/><path d="{ink_d}" fill="{ink}"/>'


def write(rel, text):
    with open(os.path.join(ROOT, rel), 'w', encoding='utf-8') as f:
        f.write(text)
    print('wrote', rel)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--dots', type=int, choices=(1, 2), default=1)
    dots = ap.parse_args().dots
    ink, road = split(dots)

    # In the em box, unscaled: the app sets it at 1em, where the text glyph stood.
    write('src/components/ui/markPaths.js', (
        '// Generated by scripts/build-mark.py (plan 158) -- do not edit by hand.\n'
        '// 辻 in Noto Serif JP Black, in its own em box (1000 units, y down):\n'
        '// the ink, and the road -- 辶\'s sweep -- which the app draws in the metal.\n'
        f'export const MARK_INK = \'{path(ink)}\'\n'
        f'export const MARK_ROAD = \'{path(road)}\'\n'
    ))
    write('brand/mark.svg', svg(EM, mark(path(ink), path(road))))

    # The icon: the ink 612 of 1024 tall, centred on the blue, as
    # large as the maskable crop allows (plan 204). The mark's furthest
    # point is 0.666 of its height from the centre, ~408px here, inside the
    # crop's 409.6 (the central 80% circle). The same file is the maskable
    # and the apple-touch icon, so pwa-assets.config.js pads neither again.
    write('brand/icon.svg', svg(1024, blue(1024) + mark(*placed(ink, road, 612, 512, 512), road=GOLD_LIT)))
    # Android's adaptive foreground. @capacitor/assets insets it 16.7% into
    # its 108dp layer, so this canvas is the launcher's 72dp viewport, not
    # the layer (plan 158 drew it for the layer, and the mark came out at
    # 44% of the tile): the ink 68% of it tall, the size the maskable
    # icon above shows at on the same launcher, its furthest point ~464px
    # from the centre inside the 66dp safe circle's 469.
    # Its ground is the same viewport, so the blue runs as on the icon.
    write('brand/icon-foreground.svg', svg(1024, mark(*placed(ink, road, 696, 512, 512), road=GOLD_LIT)))
    write('brand/icon-background.svg', svg(1024, blue(1024)))
    # The splash, filled to the screen's height on either shell: 190px of
    # 2732 lands the mark at about the boot screen's sign (4rem) on a phone,
    # where the app takes over from it.
    write('brand/splash.svg', svg(2732, mark(*placed(ink, road, 190, 1366, 1366)), GROUND))


if __name__ == '__main__':
    main()
