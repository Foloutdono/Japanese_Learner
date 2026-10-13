import sys, subprocess, os, tempfile
from PIL import Image
clip, out = sys.argv[1], sys.argv[2]; ts = [float(x) for x in sys.argv[3].split(',')]
cols = int(sys.argv[4]) if len(sys.argv) > 4 else 8
d = tempfile.mkdtemp(dir=os.environ.get('FILM_DIR', '/tmp/tsuji-film'))
ims = []
for i, t in enumerate(ts):
    p = os.path.join(d, f'{i}.png')
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-ss', str(t), '-i', clip, '-frames:v', '1', '-vf', 'scale=195:-1', p], check=True)
    ims.append(Image.open(p))
w, h = ims[0].size; rows = (len(ims) + cols - 1) // cols
o = Image.new('RGB', (w * cols, h * rows))
for i, im in enumerate(ims): o.paste(im, ((i % cols) * w, (i // cols) * h))
o.save(out)
