"""景 — the reading challenge's sceneries, built (plan 309).

Writes what the carousel's reading challenge stands on when a scenery
other than the bay is chosen (frontend/carousel/sceneries.js,
`--scenery`):

  carousel/prints/<REV>/<scenery>/<print>.json
      a print in the app's four layers (the sky, what lies behind the
      train, the train, what stands in front of it), with the train's
      run and its time, for each season at each hour and August's night
      (spring-dawn ... winter-night, summer-hanabi): seventeen;
  carousel/prints/<REV>/<scenery>/meta.json
      the frame (its horizon, the disc the challenge sets on it, the
      rows the train runs in) and each print's look, the app's own entry
      in print.json.

None of it ships in the app: the carousel alone reads it, and the app's
grain and paper with it.

    cd frontend && python3 scripts/sceneries/build.py              # every scenery drawn
    cd frontend && python3 scripts/sceneries/build.py --only lake  # one (or a few, by commas)
    cd frontend && python3 scripts/sceneries/build.py --check      # rebuilt in memory, held to the files

Needs numpy and Pillow (today-print's build, which this imports for its
serialisers). Rebuild after any change to today-print or to these
modules, and bump REV whenever the output changes (and PRINTS_REV in
carousel/sceneries.js with it; src/carouselPrints.test.js holds them
equal), deleting the old revision's folder in the same commit."""
import argparse
import os
import sys
import time

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import common  # noqa: E402
import check  # noqa: E402
import lake  # noqa: E402
import river  # noqa: E402
import station  # noqa: E402

REV = 1
# the generated sceneries, each a print's composer (season, hour,
# variant) -> dict(layers, run, band, L); the bay and the long view are
# the app's own prints, drawn by the carousel as they are
SCENERIES = {
    'lake': lambda season, hour, variant: lake.lake(season, hour, variant),
    'torii': lambda season, hour, variant: lake.lake(season, hour, variant, gate=True),
    'river': lambda season, hour, variant: river.river(season, hour, variant),
    'station': lambda season, hour, variant: station.station(season, hour, variant),
}


def draw(scenery):
    """The scenery's files, {file name: text}, and the classes they
    carry; None for a scenery not drawn yet."""
    compose = SCENERIES[scenery]
    seen, files, L, band = {}, {}, None, None
    for name, season, hour, variant in common.PRINTS:
        try:
            p = compose(season, hour, variant)
        except NotImplementedError:
            return None, None
        L, band = p['L'], band or p['band']
        layers = common.serialise(p['layers'], seen)
        files[f'{name}.json'] = common.encode(common.document(REV, name, L, layers, p['run']))
    files['meta.json'] = common.encode(common.meta(REV, L, band), indent=2)
    return files, seen


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    ap.add_argument('--only', help='the sceneries to build, by commas')
    ap.add_argument('--check', action='store_true', help='rebuild in memory and hold the committed files to it')
    args = ap.parse_args()
    ids = args.only.split(',') if args.only else list(SCENERIES)
    unknown = [i for i in ids if i not in SCENERIES]
    if unknown:
        sys.exit(f'no such scenery: {", ".join(unknown)} (there are {", ".join(SCENERIES)})')
    bad = 0
    for scenery in ids:
        t0 = time.time()
        files, seen = draw(scenery)
        if files is None:
            print(f'{scenery}: not drawn yet')
            continue
        problems = check.rules(files)
        if args.check:
            problems += check.same(REV, scenery, files)
        else:
            for path, size in common.write(REV, scenery, files):
                print(f'{os.path.relpath(path, common.FRONTEND)}  {size // 1024} KB')
        total = sum(len(t.encode('utf-8')) for t in files.values())
        print(f'{scenery}: {len(files) - 1} prints, {total / 1e6:.2f} MB, {time.time() - t0:.1f} s'
              + ('' if args.check else f'; classes: {" ".join(sorted(seen))}'))
        for p in problems:
            print(f'  {scenery}: {p}')
        bad += len(problems)
    if bad:
        sys.exit(f'{bad} problem(s)')


if __name__ == '__main__':
    main()
