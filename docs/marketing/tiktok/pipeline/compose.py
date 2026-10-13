"""Cut the recorded clips into the 1080x1920 TikTok edit."""
import subprocess, os, sys
WORK = os.environ.get('FILM_DIR', '/tmp/tsuji-film')
C = f'{WORK}/clips'; O = f'{WORK}/ov'; OUT = f'{WORK}/out'
os.makedirs(OUT, exist_ok=True)
PX, PY, PW, PH = 190, 400, 700, 1400

# scene: list of (clip, start, end, speed, caption)
SCENES = [
  ('s1_hook',     [('onboard', 1.85, 4.6, 0.9, 'hook')]),
  ('s2_try',      [('onboard', 4.6, 10.6, 2.0, 'try')]),
  ('s3_goal',     [('onboard', 18.9, 30.0, 2.8, 'goalA'), ('onboard', 30.0, 33.6, 1.2, 'goalA'), ('progress', 0.8, 7.6, 1.8, 'goalB')]),
  ('s4_board',    [('onboard', 36.5, 42.6, 2.6, 'boardA'), ('onboard', 43.4, 49.6, 1.6, 'boardB'), ('run', 0.6, 9.6, 1.8, 'boardC')]),
  ('s5_modes',    [('ladder', 0.8, 8.2, 1.6, 'modes'), ('draw', 1.2, 8.6, 1.5, 'modes')]),
  ('s6_practice', [('practice', 0.8, 5.6, 1.8, 'practice'), ('readprac', 0.6, 9.6, 1.9, 'practice'), ('practice', 12.5, 17.5, 1.7, 'practice')]),
  ('s7_join',     [('onboard', 1.85, 5.9, 1.0, 'join')]),
]

def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode: print(r.stderr[-3000:]); sys.exit(1)

def scene(name, segs):
    durs = [(e - s) / sp for _, s, e, sp, _ in segs]
    total = sum(durs)
    inputs = ['-loop', '1', '-framerate', '30', '-t', f'{total:.3f}', '-i', f'{O}/bg.png',
              '-loop', '1', '-framerate', '30', '-t', f'{total:.3f}', '-i', f'{O}/mask_phone.png',
              '-loop', '1', '-framerate', '30', '-t', f'{total:.3f}', '-i', f'{O}/frame.png']
    f = []
    for i, (clip, s, e, sp, _) in enumerate(segs):
        inputs += ['-i', f'{C}/{clip}.mp4']
        f.append(f'[{3+i}:v]trim={s}:{e},setpts=(PTS-STARTPTS)/{sp},fps=30,scale={PW}:{PH}:flags=lanczos,setsar=1[v{i}]')
    f.append(''.join(f'[v{i}]' for i in range(len(segs))) + f'concat=n={len(segs)}:v=1:a=0,format=yuva420p[ph0]')
    f.append('[1:v]format=gray,scale=%d:%d[m]' % (PW, PH))
    f.append('[ph0][m]alphamerge[ph]')
    f.append(f'[0:v][ph]overlay={PX}:{PY}:shortest=1[b1]')
    f.append('[b1][2:v]overlay=0:0[b2]')
    # captions: one input per distinct caption run
    runs, t = [], 0.0
    for (_, _, _, _, cap), d in zip(segs, durs):
        if runs and runs[-1][0] == cap: runs[-1][2] += d
        else: runs.append([cap, t, d])
        t += d
    base = 3 + len(segs); last = 'b2'
    for k, (cap, t0, d) in enumerate(runs):
        inputs += ['-loop', '1', '-framerate', '30', '-t', f'{total:.3f}', '-i', f'{O}/cap_{cap}.png']
        idx = base + k
        if k == 0 and name != 's1_hook':  # the first caption of a scene arrives: fade + rise
            f.append(f'[{idx}:v]format=rgba,fade=t=in:st=0:d=0.35:alpha=1[c{k}]')
            y = "'if(lt(t,0.4),36*pow(1-t/0.4,2),0)'"
        else:
            f.append(f'[{idx}:v]format=rgba[c{k}]'); y = '0'
        en = f"between(t,{t0:.3f},{t0 + d + 0.05:.3f})"
        f.append(f"[{last}][c{k}]overlay=0:{y}:enable='{en}'[o{k}]"); last = f'o{k}'
    f.append(f'[{last}]format=yuv420p[out]')
    out = f'{OUT}/{name}.mp4'
    run(['ffmpeg', '-y', '-loglevel', 'error', *inputs, '-filter_complex', ';'.join(f), '-map', '[out]',
         '-t', f'{total:.3f}', '-r', '30', '-c:v', 'libx264', '-crf', '17', '-preset', 'slow', '-pix_fmt', 'yuv420p', out])
    print(f'{name}: {total:.2f}s')
    return out

outs = [scene(n, s) for n, s in SCENES]
with open(f'{OUT}/list.txt', 'w') as fh:
    for o in outs: fh.write(f"file '{o}'\n")
# final: silent AAC track so every platform accepts it, faststart for upload
run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', f'{OUT}/list.txt',
     '-f', 'lavfi', '-i', 'anullsrc=r=44100:cl=stereo', '-shortest', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k',
     '-movflags', '+faststart', f'{OUT}/tsuji_tiktok.mp4'])
print('done')
