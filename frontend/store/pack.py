"""Store screenshots, last step: one zip per language, a folder per Play Console size.
    python3 store/pack.py   ->  store/out/tsuji-store-fr.zip, store/out/tsuji-store-en.zip"""
import os, zipfile
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out')
# (source folder suffix, folder name in fr, in en, Play's limits: min side, max side, max MB)
SETS = [
    ('', '1-telephone', '1-phone', 320, 3840, 8),
    ('-tablet7', '2-tablette-7-pouces', '2-tablet-7-inch', 320, 3840, 8),
    ('-tablet10', '3-tablette-10-pouces', '3-tablet-10-inch', 1080, 7680, 8),
    ('-chromebook', '4-chromebook', '4-chromebook', 1080, 7680, 8),
    ('-xr', '5-android-xr', '5-android-xr', 720, 7680, 15),
]

for lang in ('fr', 'en'):
    path = os.path.join(OUT, f'tsuji-store-{lang}.zip')
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_STORED) as z:
        for suffix, fr, en, lo, hi, mb in SETS:
            src = os.path.join(OUT, lang + suffix)
            shots = sorted(f for f in os.listdir(src) if f[:2].isdigit() and f.endswith('.png'))
            assert len(shots) == 8, (src, shots)
            for f in shots:
                p = os.path.join(src, f)
                w, h = Image.open(p).size
                assert lo <= min(w, h) and max(w, h) <= hi, (p, w, h)
                assert abs(max(w, h) / min(w, h) - 16 / 9) < 0.01, (p, w, h)
                assert os.path.getsize(p) <= mb * 1e6, p
                z.write(p, f'{fr if lang == "fr" else en}/{f}')
        z.write(os.path.join(OUT, lang, 'feature-graphic-1024x500.png'),
                ('0-image-de-presentation' if lang == 'fr' else '0-feature-graphic') + '/feature-graphic-1024x500.png')
    print(path, round(os.path.getsize(path) / 1e6, 1), 'MB')
