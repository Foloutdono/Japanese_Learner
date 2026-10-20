"""S⁴ · the day's gulls, redrawn (plan 261, the canvas "Tsuji — Today,
the seasons", round 4). Round 5 of the visit card drew them as wire,
wings bent and outlined, each swinging back and forth over one spot and
banking at the turn: a bird going nowhere, and a shape that read as a
stroke, not a bird.

A gull far off over a bay is its wings: the long crooked span, white,
the tips black (海猫, the black-tailed gull of Japan's coasts), the body
a small mark between them. So each is that span, filled and tapering
from the shoulder to the tip, the hand bent down from the wrist (the
gull's M), lit above and a shade under. It crosses the bay on the wind,
gliding, rising and falling a little and leaning into each turn, and
now and then beats three times, slowly; a few go together, loosely,
each in its own time, and are gone; the next come later.

The wings are jointed as birds5's are: an arm hinged at the shoulder, a
hand at the wrist, at their groups' origins. The beat and the glide are
one cycle of their own (--cyc), each bird's phase its own (--ph)."""
import random
from geo import f
from scene_f4 import anim

# the gull's inks by the hour: the white of it, the shade under its
# wings and body, the black of its tips
INK = {
    'day': dict(white='#fbfcfb', under='#8e9aac', tip='#1c1f26'),
    'dawn': dict(white='#f8eae2', under='#97848e', tip='#1d1a24'),
    'dusk': dict(white='#eadbe2', under='#80708a', tip='#16141e'),
}


def gull(cyc, phase, ink):
    """A black-tailed gull gliding, seen a little from below: some 19
    units from tip to tip, the shoulders at (±0.5, 0)."""
    c = ink
    st = f'--cyc: {f(cyc)}s; --ph: -{f(phase)}s'

    def wing(side):
        def x(v):
            return f(v * side)
        # the arm: broad at the shoulder, its leading edge curving up and
        # out to the wrist; under it, the shade of the underwing
        arm = (f'M{x(-0.2)} -0.7 C{x(1.4)} -1.6 {x(3)} -2.3 {x(4.7)} -2.5 L{x(4.7)} -1.2 '
               f'C{x(3.1)} -0.9 {x(1.5)} -0.1 {x(0.1)} 1.1 Z')
        shade = (f'M{x(0.1)} 1.1 C{x(1.5)} -0.1 {x(3.1)} -0.9 {x(4.7)} -1.2 L{x(4.7)} -1.62 '
                 f'C{x(3.1)} -1.36 {x(1.6)} -0.62 {x(0.2)} 0.5 Z')
        # the hand, from inside the wrist out and down to its point,
        # the outer third black
        hand = (f'M{x(-0.5)} -0.65 C{x(1.4)} -0.5 {x(3.2)} 0.3 {x(5)} 2.1 '
                f'C{x(3)} 1.1 {x(1.2)} 0.62 {x(-0.5)} 0.65 Z')
        tip = (f'M{x(2.9)} 0.25 C{x(3.6)} 0.75 {x(4.3)} 1.35 {x(5)} 2.1 '
               f'C{x(4.2)} 1.6 {x(3.5)} 1.25 {x(2.7)} 0.98 Z')
        lr = 'r' if side > 0 else 'l'
        return (f'<g transform="translate({x(0.5)} 0)"><g class="s4-gwing s4-gwing--{lr}" style="{st}">'
                f'<path d="{arm}" fill="{c["white"]}"></path><path d="{shade}" fill="{c["under"]}"></path>'
                f'<g transform="translate({x(4.6)} -1.85)"><g class="s4-ghand s4-ghand--{lr}" style="{st}">'
                f'<path d="{hand}" fill="{c["white"]}"></path><path d="{tip}" fill="{c["tip"]}"></path></g></g></g></g>')
    body = (f'<path d="M0 -1.5 C0.6 -1.5 0.8 -0.8 0.75 0 C0.7 1 0.4 1.8 0 2.2 C-0.4 1.8 -0.7 1 -0.75 0 '
            f'C-0.8 -0.8 -0.6 -1.5 0 -1.5 Z" fill="{c["white"]}"></path>'
            f'<path d="M0.72 0.4 C0.62 1.2 0.36 1.85 0 2.2 C-0.36 1.85 -0.62 1.2 -0.72 0.4 C-0.3 0.9 0.3 0.9 0.72 0.4 Z" fill="{c["under"]}"></path>'
            f'<path d="M-0.42 2.05 L0 2.6 L0.42 2.05 Z" fill="{c["tip"]}"></path>')
    return f'<g class="s4-gbody" style="{st}">{wing(-1)}{wing(1)}{body}</g>'


# where the gulls cross, per frame: (from, to, seconds, the delay into
# the crossing the print opens at, how many, their size)
FLIGHTS = {
    390: [((440, 434), (-60, 450), 44, 15, 3, 0.72)],
    1184: [((1290, 584), (-90, 600), 70, 27, 3, 0.98),
           ((-70, 546), (1250, 530), 96, 70, 2, 0.7)],
}
# the flock, loose: where each flies from the first
FORM = [(0, 0), (18, -8), (34, 3)]


def gulls(L, h, o, hour, uid='s4'):
    """海猫: a few gulls crossing the bay together, loosely, each gliding,
    leaning into its turns and beating in its own time; the next come
    later."""
    c = INK.get(hour, INK['day'])
    rng = random.Random(L.seed + 701)
    out = []
    for (x0, y0), (x1, y1), dur, delay, n, size in FLIGHTS[L.W]:
        way = 1 if x1 > x0 else -1
        birds = []
        for dx, dy in FORM[:n]:
            cyc = rng.uniform(4.2, 6.2)
            s = size * rng.uniform(0.88, 1.08)
            birds.append(f'<g transform="translate({f(-dx * way)} {f(dy)})">'
                         f'<g class="f5-keep" style="--kx: {f(rng.uniform(2, 4.5))}px; --ky: {f(rng.uniform(1.5, 3))}px; {anim(rng.uniform(6, 9), rng.uniform(0, 9))}">'
                         f'<g class="s4-groll" style="{anim(rng.uniform(3.6, 5.2), rng.uniform(0, 5))}">'
                         f'<g transform="scale({f(s)})">{gull(cyc, rng.uniform(0, cyc), c)}</g></g></g></g>')
        out.append(f'<g class="f5-flock" style="--x0: {f(x0)}px; --y0: {f(y0)}px; --x1: {f(x1)}px; --y1: {f(y1)}px; '
                   f'--xm: {f(x0 + (x1 - x0) * 0.4)}px; --ym: {f(y0 + (y1 - y0) * 0.4)}px; {anim(dur, delay)}">'
                   f'<g class="f5-undulate" style="--u: 5px; {anim(7.4, rng.uniform(0, 7))}">{"".join(birds)}</g></g>')
    return ''.join(out)


CSS = '''/* ── S⁴ · the day's gulls: a long glide, then three slow beats ──── */
.s4-gwing, .s4-ghand, .s4-gbody { transform-box: view-box; transform-origin: 0 0; animation-duration: var(--cyc, 15s); animation-delay: var(--ph, 0s); animation-iteration-count: infinite; animation-timing-function: ease-in-out; }
.s4-gwing--r { animation-name: s4-gbeat-r; }
.s4-gwing--l { animation-name: s4-gbeat-l; }
.s4-ghand--r { animation-name: s4-gflex-r; }
.s4-ghand--l { animation-name: s4-gflex-l; }
.s4-gbody { animation-name: s4-gbob; }
@keyframes s4-gbeat-r { 0%, 55%, 100% { rotate: 0deg; } 61% { rotate: -30deg; } 67% { rotate: 18deg; } 73% { rotate: -30deg; } 79% { rotate: 18deg; } 85% { rotate: -30deg; } 92% { rotate: 6deg; } }
@keyframes s4-gbeat-l { 0%, 55%, 100% { rotate: 0deg; } 61% { rotate: 30deg; } 67% { rotate: -18deg; } 73% { rotate: 30deg; } 79% { rotate: -18deg; } 85% { rotate: 30deg; } 92% { rotate: -6deg; } }
@keyframes s4-gflex-r { 0%, 55%, 100% { rotate: 0deg; } 62% { rotate: 16deg; } 68% { rotate: -14deg; } 74% { rotate: 16deg; } 80% { rotate: -14deg; } 86% { rotate: 16deg; } 93% { rotate: -4deg; } }
@keyframes s4-gflex-l { 0%, 55%, 100% { rotate: 0deg; } 62% { rotate: -16deg; } 68% { rotate: 14deg; } 74% { rotate: -16deg; } 80% { rotate: 14deg; } 86% { rotate: -16deg; } 93% { rotate: 4deg; } }
@keyframes s4-gbob { 0%, 55%, 100% { translate: 0 0; } 64%, 76%, 88% { translate: 0 -0.5px; } 70%, 82% { translate: 0 0.4px; } }
/* the glide leans into its turns */
.s4-groll { animation-iteration-count: infinite; animation-timing-function: ease-in-out; animation-name: s4-groll; animation-direction: alternate; }
@keyframes s4-groll { from { rotate: -9deg; } to { rotate: 9deg; } }
@media (prefers-reduced-motion: reduce) {
  .s4-gwing, .s4-ghand, .s4-gbody, .s4-groll { animation: none; }
}
'''
