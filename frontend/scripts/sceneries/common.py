"""What every scenery shares (plan 309): the bay's hand, and the files.

A scenery is another view of the country Today's print shows, drawn for
the reading challenge alone (frontend/carousel/challenge.js) and never
for the app. It is made of the print's own parts, in the print's own
inks, by the generator in frontend/scripts/today-print, imported from
where it stands and never edited: each print is drawn inside round 5
(s5_scene.round5) and dressed for its season's hour (s1_scene.dressed),
so every ink, bird, tree and falling thing is the bay's.

    inside(season, hour, variant)   round 5's parts and inks, dressed
    sky(L, season, hour, variant)   the bay's own sky layer at the
                                    scenery's frame: its first <defs>
                                    (shared_defs) is what every reused
                                    part points into
    swapped(...), fore(table), fireworks_at(spots)
                                    a table of the generator's given a
                                    scenery's entry while it is drawn
    turned(svg, foot, at, k)        a part set down elsewhere, turned
    small_train(...)                the bay's train, far off
    serialise(layers, seen), document(...), meta(...), write(...)

Every part seeds its own random, so a rebuild writes the same bytes."""
import contextlib
import dataclasses
import importlib.util
import json
import math
import os
import re
import sys
import types

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
FRONTEND = os.path.normpath(os.path.join(HERE, '..', '..'))
TODAY = os.path.join(FRONTEND, 'scripts', 'today-print')
OUT = os.path.join(FRONTEND, 'carousel', 'prints')
APP_PRINTS = os.path.join(FRONTEND, 'src', 'components', 'station', 'print', 'print.json')
if TODAY not in sys.path:
    sys.path.insert(0, TODAY)

import s1_scene  # noqa: E402
import s3_air  # noqa: E402
import s5_fore  # noqa: E402
import s5_scene  # noqa: E402
from geo import f  # noqa: E402
from scene_f9 import train8  # noqa: E402


def _by_path(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


# today-print's build.py shares its name with this folder's: taken by its
# path, under a name of its own (its serialisers and its REV)
tp = _by_path('today_print_build', os.path.join(TODAY, 'build.py'))

# the bay's shared <defs> are written for this uid: every part that
# points into them (boats, the train, the air's and the flora's own) is
# drawn with it
UID = 's5'
# the prints of the year, as the app's: the season's at each hour and
# August's night (the -b myrtle is the app's alone: the challenge loads
# the A print for it)
PRINTS = [(name, season, hour, variant) for name, season, hour, variant, _night in tp.PRINTS
          if not name.endswith('-b')]
# the train's crossing on the phone and how far into it the print opens,
# as the app's
DUR, DELAY = next((dur, delay) for device, _L, dur, delay in tp.DEVICES if device == 'phone')

# where the challenge sets things on the print (plan 309), in the
# print's units at 2.769 px a unit: its disc (the sun or moon it draws
# itself, centre and radius), the text's column, and the masthead's row
# under the hook and once the print is raised for the reading (52.7
# units up); the stars keep out of both rows
DISC = (195, 150, 24)
COLUMN = (66, 324)
MASTHEAD = ((126, 153), (179, 206))


# ── the bay's hand ─────────────────────────────────────────────────

@contextlib.contextmanager
def inside(season, hour, variant=None):
    """Round 5's parts and the season's inks at the hour, dressed as the
    bay's print is drawn: air, flora and fuji are round 5's, h, s and o
    the hour's inks, the bay's and the season's notes."""
    with s5_scene.round5():
        h, s, o = s1_scene.inks(season, hour)
        o = {**o, **s5_scene.PICKS, **(variant or {}), 'uid': UID}
        with s1_scene.dressed(season, hour, o):
            yield types.SimpleNamespace(air=s1_scene.air, flora=s1_scene.flora, fuji=s1_scene.fuji_s,
                                        h=h, s=s, o=o, season=season, hour=hour)


def sky(L, season, hour, variant=None):
    """The bay's own sky layer, drawn at the scenery's frame: its <defs>
    (every gradient, clip and filter the reused parts point into), the
    sky's bokashi to the scenery's horizon, its band, its stars and the
    hazy moon; the stars that fall in the masthead's rows taken out, a
    star by the masthead reading as a stray mark."""
    layer = s5_scene.scene(L, hour, season, with_disc=False, variant=variant)[0]
    x0, x1 = COLUMN[0] - 8, COLUMN[1] + 8

    def star(m):
        x, y = float(m.group(1)), float(m.group(2))
        return '' if x0 < x < x1 and any(a - 4 < y < b + 4 for a, b in MASTHEAD) else m.group(0)
    return re.sub(r'<circle cx="(-?[\d.]+)" cy="(-?[\d.]+)" r="[\d.]+" fill-opacity="[\d.]+"></circle>', star, layer)


def shared_defs(L, season, hour, variant=None):
    """The first <defs>…</defs> of the bay's sky at the scenery's frame:
    the generator's own block, never a copy."""
    return re.match(r'\s*(<defs>[\s\S]*?</defs>)', sky(L, season, hour, variant)).group(1)


@contextlib.contextmanager
def swapped(*puts):
    """The generator's tables given a scenery's entries while it is drawn,
    (table, key, value) each, and given back after (s1_scene.dressed's
    idiom)."""
    saved = []
    try:
        for table, key, value in puts:
            saved.append((table, key, table[key]))
            table[key] = value
        yield
    finally:
        for table, key, value in reversed(saved):
            table[key] = value


def fore(table):
    """The meadow's layout (s5_fore.FORE) as the scenery lays it out."""
    return swapped((s5_fore.FORE, 390, table))


def fireworks_at(spots):
    """August's fireworks where the scenery has room for them:
    (x, y, r, ink, seconds) each, as s3_air.FIREWORKS."""
    return swapped((s3_air.FIREWORKS, 390, spots))


def turned(svg, foot, at, k, flip=True):
    """A part drawn standing at `foot` set down at `at`, k of its size,
    turned to face the other way if `flip`."""
    (fx, fy), (ax, ay) = foot, at
    return (f'<g transform="translate({f(ax)} {f(ay)}) scale({f(-k if flip else k)} {f(k)}) '
            f'translate({f(-fx)} {f(-fy)})">{svg}</g>')


# the bay's train as small_train has train8 draw it, on a rail at 100:
# its wheels at 99.6, nothing of it more than 19.6 above them (the
# pantographs' heads are 17.5 up); and how far off the print's edge the
# train layer starts it and its run leaves it (check.py reads a train
# back from its layer by these)
TRAIN_RAIL = 100
TRAIN_WHEELS, TRAIN_TALL = 99.6, 19.6
TRAIN_CLEAR = 20


def small_train(L, h, s, hour, k, wheels, lead=None, reflect=None, uid='sc'):
    """The bay's train (scene_f9.train8) far off, k of its size, its
    wheels on the rail at `wheels`, and its run across the print
    recomputed so the still print (the train at 0.45 of its run) shows
    its nose at `lead` while the whole run still brings it in from off
    the left edge and takes it off the right; left out, where it enters
    as the run begins and is gone as it ends, as the bay's. `reflect`:
    the water's line, to double it in the water under it, softer and
    broken, in the train's own layer so the two go together. Returns the
    layer, its run (a share of the print's width, as a print's), and
    the rows it takes (y0, y1).

    The carousel draws the train layer as an image a print's width
    either side of the frame (app.loadPrint), so whatever lies left of
    -W in it is never drawn, at any point of the run, and only shows as
    a train cut short once it moves. A lead the run cannot reach from
    there is refused: to park the nose at `lead` and still be gone off
    the right at the end, the run starts the train lead - 0.45 * travel
    along, which leaves the tail past -W for any lead under
    k * length - 0.1 * W + 9 (154 at half the bay's size on the phone,
    103 at 0.36)."""
    Lt = dataclasses.replace(L, viaduct=(TRAIN_RAIL, TRAIN_RAIL + 40))
    svg, run_full = train8(Lt, h, s, hour, UID)
    length = run_full / 100 * L.W - L.W - 2 * TRAIN_CLEAR
    if lead is None:
        lead = 0.45 * (L.W + k * length + 2 * TRAIN_CLEAR) - TRAIN_CLEAR
    # the nose's place at a share r of the run is n0 + travel * r: n0 off
    # the left edge (20 units clear), the tail off the right at the end
    travel = max((lead + TRAIN_CLEAR) / 0.45, (L.W + k * length + TRAIN_CLEAR - lead) / 0.55)
    n0 = lead - 0.45 * travel
    if n0 - k * length < -L.W:
        raise ValueError(f'small_train: a lead of {lead:g} at {k:g} of the size lays the train past the left edge of the '
                         f'image the carousel draws it in (-{L.W}); the least lead it can park at is '
                         f'{math.ceil(k * length - 0.1 * L.W + 9)}')
    tx, ty = n0 + TRAIN_CLEAR * k, wheels - k * TRAIN_WHEELS
    body = f'<g id="{uid}Train" transform="translate({f(tx)} {f(ty)}) scale({f(k)})">{svg}</g>'
    # from the pantograph's head to the wheels, and a little blur round them
    top, foot = wheels - k * TRAIN_TALL, wheels + 1.5
    if reflect is not None:
        body += (f'<defs><clipPath id="{uid}TrainWater"><rect x="{f(-L.W * 3)}" y="{f(reflect + 0.4)}" width="{L.W * 6}" '
                 f'height="{f(wheels - top + 30)}"></rect></clipPath></defs>'
                 f'<g clip-path="url(#{uid}TrainWater)"><g opacity="0.3" filter="url(#f6Smear)">'
                 f'<use href="#{uid}Train" transform="matrix(1 0 0 -1 0 {f(2 * reflect)})"></use></g></g>')
        foot = 2 * reflect - top + 2
    return body, travel / L.W * 100, (round(top - 2, 1), round(foot, 1))


# ── the files ─────────────────────────────────────────────────────

def serialise(layers, seen):
    """The layers as the app's prints are written (today-print's build):
    tight, path data to a tenth of a unit, the rounds' classes in the
    app's one namespace (`seen` gathers them), every id and reference to
    it given the print's prefix."""
    return tp.rename_ids([tp.rename_classes(tp.lighter(tp.tight(p)), seen) for p in layers])


def document(rev, name, L, layers, run):
    """A print as the carousel reads it, shaped as the app's are."""
    return {'rev': rev, 'print': name, 'device': 'phone', 'w': L.W, 'h': L.H,
            'train': {'run': round(run, 3), 'dur': DUR, 'delay': DELAY},
            'layers': dict(zip(('sky', 'back', 'train', 'front'), layers))}


def meta(rev, L, train_band):
    """What the carousel draws itself, per scenery: the frame (its
    horizon for the sky's stops, the disc the challenge sets on it, the
    rows the train runs in, or none) and each print's look, the app's
    own entry for that print in print.json (its sky, band, ground, disc
    and inks: the hour's, the scenery's too)."""
    with open(APP_PRINTS) as fh:
        app = json.load(fh)
    cx, cy, r = DISC
    return {'rev': rev, 'generator': app['rev'],
            'frame': {'w': L.W, 'h': L.H, 'horizon': L.horizon, 'cx': cx, 'cy': cy, 'disc': r,
                      'trainBand': list(train_band) if train_band else None},
            'prints': {name: app['prints'][name] for name, *_ in PRINTS}}


def encode(doc, indent=None):
    """A print on one line, as the app's; the meta legible."""
    if indent:
        return json.dumps(doc, ensure_ascii=False, indent=indent) + '\n'
    return json.dumps(doc, ensure_ascii=False, separators=(',', ':'))


def folder(rev, scenery):
    return os.path.join(OUT, str(rev), scenery)


def write(rev, scenery, files):
    """The scenery's files, {file name: text}, into its folder; returns
    each path and its size."""
    root = folder(rev, scenery)
    os.makedirs(root, exist_ok=True)
    out = []
    for name, text in files.items():
        path = os.path.join(root, name)
        with open(path, 'w', encoding='utf-8') as fh:
            fh.write(text)
        out.append((path, os.path.getsize(path)))
    return out
