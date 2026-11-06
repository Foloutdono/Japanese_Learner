"""What a scenery's files are held to (plan 309), as the app's prints are
by src/todayPrint.test.js and as src/carouselPrints.test.js holds them:

- each print in the app's shape: its revision and name, the phone's
  frame, the train's run and its time, the four layers in order;
- every id in the print's namespace (tpr-), once, and every reference
  inside it finding its id; no <defs> inside another (the carousel's
  loader gathers each layer's <defs> with a non-greedy match, which a
  nested one would cut short);
- every class the app's own, with its one-line rule in index.css (no new
  class), and no opacity attribute on a moving part;
- the meta: the generator's revision, the frame, the year's seventeen
  prints each with the app's own look;
- at most 12 MB a scenery;
- and with --check, a rebuild writing the committed bytes.

    cd frontend && python3 scripts/sceneries/check.py            # the committed folders
    cd frontend && python3 scripts/sceneries/check.py --check    # ... and a rebuild against them"""
import argparse
import json
import os
import re
import sys

sys.dont_write_bytecode = True
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import common  # noqa: E402

BUDGET = 12_000_000
CSS = os.path.join(common.FRONTEND, 'src', 'index.css')


def _css():
    with open(CSS, encoding='utf-8') as fh:
        return re.sub(r'/\*[\s\S]*?\*/', '', fh.read())


def nested_defs(markup):
    """How deep the deepest <defs> sits in another."""
    depth = worst = 0
    for m in re.finditer(r'<(/?)defs>', markup):
        depth += -1 if m.group(1) else 1
        worst = max(worst, depth)
    return worst - 1 if worst else 0


def print_problems(name, doc, css):
    out = []
    want = {'print': name, 'device': 'phone', 'w': 390, 'h': 746}
    for key, value in want.items():
        if doc.get(key) != value:
            out.append(f'{name}: {key} is {doc.get(key)!r}, not {value!r}')
    train = doc.get('train') or {}
    if not (isinstance(train.get('run'), (int, float)) and train['run'] >= 0
            and train.get('dur') == common.DUR and train.get('delay') == common.DELAY):
        out.append(f'{name}: train {train!r}')
    layers = doc.get('layers') or {}
    if list(layers) != ['sky', 'back', 'train', 'front']:
        return out + [f'{name}: layers {list(layers)}']
    text = ''.join(layers.values())
    ids = re.findall(r'\bid="([^"]+)"', text)
    if len(set(ids)) != len(ids):
        twice = sorted({i for i in ids if ids.count(i) > 1})
        out.append(f'{name}: an id twice: {", ".join(twice[:5])}')
    stray = [i for i in ids if not i.startswith('tpr-')]
    if stray:
        out.append(f'{name}: ids outside tpr-: {", ".join(stray[:5])}')
    known = set(ids)
    refs = {m.group(1) or m.group(2) for m in re.finditer(r'url\(#([^)]+)\)|href="#([^"]+)"', text)}
    if refs - known:
        out.append(f'{name}: references nothing holds: {", ".join(sorted(refs - known)[:5])}')
    classes = {c for m in re.finditer(r'class="([^"]+)"', text) for c in m.group(1).split()}
    for c in sorted(classes):
        if not c.startswith('tpr-') or not re.search(r'\.' + re.escape(c) + r'(?![\w-])', css):
            out.append(f'{name}: class {c} has no rule in index.css')
    for m in re.finditer(r'<\w+ [^>]*class="tpr-[^"]*"[^>]*>', text):
        if re.search(r'\sopacity="', m.group(0)):
            out.append(f'{name}: a moving part with an opacity of its own: {m.group(0)[:80]}')
            break
    for layer, markup in layers.items():
        if nested_defs(markup):
            out.append(f'{name}: a <defs> inside another in its {layer}')
    return out


def meta_problems(rev, meta):
    out = []
    with open(common.APP_PRINTS, encoding='utf-8') as fh:
        app = json.load(fh)
    if meta.get('rev') != rev:
        out.append(f'meta: rev {meta.get("rev")!r}, not {rev}')
    if meta.get('generator') != app['rev']:
        out.append(f'meta: generator {meta.get("generator")!r}, not the app print\'s {app["rev"]}')
    frame = meta.get('frame') or {}
    cx, cy, r = common.DISC
    for key, value in {'w': 390, 'h': 746, 'cx': cx, 'cy': cy, 'disc': r}.items():
        if frame.get(key) != value:
            out.append(f'meta: frame {key} is {frame.get(key)!r}, not {value!r}')
    if not (isinstance(frame.get('horizon'), (int, float)) and 0 < frame['horizon'] < 746):
        out.append(f'meta: frame horizon {frame.get("horizon")!r}')
    band = frame.get('trainBand', 'missing')
    if band is not None and not (isinstance(band, list) and len(band) == 2 and 0 <= band[0] < band[1] <= 746):
        out.append(f'meta: frame trainBand {band!r}')
    names = [name for name, *_ in common.PRINTS]
    prints = meta.get('prints') or {}
    if sorted(prints) != sorted(names):
        out.append(f'meta: prints {sorted(prints)}')
    for name in names:
        if name in prints and prints[name] != app['prints'][name]:
            out.append(f'meta: {name} is not the app\'s look')
    return out


def rules(files, rev=None):
    """Every rule above, over a scenery's files ({file name: text})."""
    css = _css()
    out = []
    names = [name for name, *_ in common.PRINTS]
    want = sorted([f'{n}.json' for n in names] + ['meta.json'])
    if sorted(files) != want:
        out.append(f'files: {sorted(set(files) ^ set(want))} differ from the seventeen prints and the meta')
    meta = json.loads(files['meta.json']) if 'meta.json' in files else {}
    rev = rev if rev is not None else meta.get('rev')
    out += meta_problems(rev, meta)
    for name in names:
        if f'{name}.json' in files:
            doc = json.loads(files[f'{name}.json'])
            if doc.get('rev') != rev:
                out.append(f'{name}: rev {doc.get("rev")!r}, not {rev}')
            out += print_problems(name, doc, css)
    total = sum(len(t.encode('utf-8')) for t in files.values())
    if total > BUDGET:
        out.append(f'{total / 1e6:.1f} MB, over the {BUDGET / 1e6:.0f} MB a scenery may weigh')
    return out


def committed(rev, scenery):
    root = common.folder(rev, scenery)
    if not os.path.isdir(root):
        return None
    files = {}
    for name in sorted(os.listdir(root)):
        with open(os.path.join(root, name), encoding='utf-8') as fh:
            files[name] = fh.read()
    return files


def same(rev, scenery, files):
    """Where the committed folder differs from a rebuild's files."""
    on_disk = committed(rev, scenery)
    if on_disk is None:
        return [f'no folder {os.path.relpath(common.folder(rev, scenery), common.FRONTEND)}: build it']
    out = [f'{name}: the rebuild differs' for name in sorted(files) if on_disk.get(name) != files[name]]
    out += [f'{name}: on disk, not built' for name in sorted(set(on_disk) - set(files))]
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    ap.add_argument('ids', nargs='*', help='the sceneries to check (every one built, by default)')
    ap.add_argument('--check', action='store_true', help='rebuild each in memory and hold the files to it')
    args = ap.parse_args()
    # this folder's build.py, by its path: today-print's holds the name
    build = common._by_path('scenery_build', os.path.join(common.HERE, 'build.py'))
    bad = 0
    for scenery in args.ids or list(build.SCENERIES):
        files = committed(build.REV, scenery)
        if files is None:
            print(f'{scenery}: no folder')
            continue
        problems = rules(files, build.REV)
        if args.check:
            fresh, _ = build.draw(scenery)
            problems += same(build.REV, scenery, fresh) if fresh else ['not drawn by its module, but on disk']
        total = sum(len(t.encode('utf-8')) for t in files.values())
        print(f'{scenery}: {len(files) - 1} prints, {total / 1e6:.2f} MB, {len(problems)} problem(s)')
        for p in problems:
            print(f'  {p}')
        bad += len(problems)
    if bad:
        sys.exit(1)


if __name__ == '__main__':
    main()
