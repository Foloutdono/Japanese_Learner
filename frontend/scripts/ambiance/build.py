"""Build the ambiance of the hour (plan 219).

    cd frontend && python3 scripts/ambiance/build.py   # needs numpy and ffmpeg

Writes, for each hour of Today's print (dawn, day, dusk, night):

- public/sounds/ambiant/<REV>/<hour>.mp3: one LOOP-second loop, with
  PAD seconds of itself wrapped on at each end;
- src/lib/audio/ambiance.json: the revision, the loop and the pad, which
  is all lib/audio/ambiance.js needs to play them.

The player loops between PAD and PAD + LOOP. The loop is built on a
circle (kit.py), so that region joins itself exactly; the pad is there
so that a decoder that adds or drops a few ms at the file's start (an
mp3's priming) only moves the phase, never opens a gap at the seam.

The output is deterministic: the same build writes the same bytes on
the same ffmpeg.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from kit import SR, circular_filter, hp, soft_limit  # noqa: E402
from hours import HOURS  # noqa: E402

# Bump whenever the output changes: the service worker keeps /sounds/
# cache-first for a year, so a loop rebuilt under the same revision
# never reaches a returning learner. The old revision's folder goes in
# the same commit.
REV = 'lake1'
LOOP = 120.0
PAD = 1.0
BITRATE = '128k'

FRONTEND = os.path.normpath(os.path.join(HERE, '..', '..'))
OUT = os.path.join(FRONTEND, 'public', 'sounds', 'ambiant', REV)
MANIFEST = os.path.join(FRONTEND, 'src', 'lib', 'audio', 'ambiance.json')


def loudness(path):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true',
                        '-f', 'null', '-'], capture_output=True, text=True).stderr
    s = r[r.rfind('Summary'):]
    return float(s.split('I:')[1].split('LUFS')[0]), float(s.split('Peak:')[1].split('dBFS')[0])


def write_wav(path, x):
    raw = np.ascontiguousarray(x.T.astype('<f4')).tobytes()
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '2',
                    '-i', '-', '-c:a', 'pcm_f32le', path], input=raw, check=True)


def master(x, target, tmp):
    """Rumble off, then the loop to `target` LUFS, its peaks rounded."""
    x = circular_filter(x, lambda f: hp(f, 32, 2))
    x = x / (np.abs(x).max() + 1e-12) * 0.5
    write_wav(tmp, x)
    i, _ = loudness(tmp)
    return soft_limit(x * 10 ** ((target - i) / 20), 0.9)


def main():
    names = sys.argv[1:] or list(HOURS)
    os.makedirs(OUT, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for name in names:
            fn, lufs = HOURS[name]
            wav = os.path.join(tmp, f'{name}.wav')
            x = master(fn(LOOP), lufs, wav)
            p = int(PAD * SR)
            write_wav(wav, np.concatenate([x[:, -p:], x, x[:, :p]], axis=1))
            mp3 = os.path.join(OUT, f'{name}.mp3')
            subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-c:a', 'libmp3lame',
                            '-b:a', BITRATE, '-map_metadata', '-1', '-fflags', '+bitexact',
                            '-flags:a', '+bitexact', mp3], check=True)
            i, pk = loudness(mp3)
            print(f'{name:6s} {i:6.1f} LUFS  peak {pk:6.1f} dBFS  {os.path.getsize(mp3) / 1e6:.2f} MB', flush=True)
    # an older revision's folder is stale: the app only asks for REV's
    parent = os.path.dirname(OUT)
    for d in os.listdir(parent):
        full = os.path.join(parent, d)
        if os.path.isdir(full) and d != REV:
            shutil.rmtree(full)
    with open(MANIFEST, 'w') as f:
        json.dump({'rev': REV, 'loop': LOOP, 'pad': PAD, 'hours': list(HOURS)}, f, indent=2)
        f.write('\n')


if __name__ == '__main__':
    main()
