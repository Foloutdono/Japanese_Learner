"""Round 8's boughs, each branch made to meet its tier: where a branch
ran under its tier with sky between them, it now rises into the tier at
the end nearer the trunk (or straight up, when it starts under the tier)
and runs on inside the foliage, so no sky shows between needles and
wood. The tiers keep their places (clear of the train)."""
from el8 import BOUGHS as B8
from el7 import resample


def underside(cx, cy, hh):
    return cy + 0.28 * hh


def gap(spine, tier):
    cx, cy, w, hh = tier
    u = underside(cx, cy, hh)
    return max([(y - bw / 2) - u for x, y, bw in resample(spine, 2) if cx - w / 2 + 3 <= x <= cx + w / 2 - 3] or [0])


# the two boughs whose branch ran under their tier with sky between
# (the upper left, the right); the others already meet theirs
GAPPED = (2, 3)


def seated(boughs=B8):
    out = []
    for i, (spine, tier) in enumerate(boughs):
        cx, cy, w, hh = tier
        if i not in GAPPED:
            out.append((spine, tier))
            continue
        u = underside(cx, cy, hh)
        ax, ay, aw = spine[0]
        if cx - w / 2 < ax < cx + w / 2:
            ex = ax + (cx - ax) * 0.25          # starts under the tier: rise into it
        else:
            d = 1 if cx > ax else -1           # enter at the near end, a little inward
            ex = cx - d * w * 0.36
        d = 1 if ex > ax else -1
        kept = [p for p in spine[:-1] if (ex - p[0]) * d > 6 and p[1] > u + 2] or [spine[0]]
        kw = kept[-1][2]
        # a bend that rises to the entry point
        lx, ly, _ = kept[-1]
        bend = (lx + (ex - lx) * 0.55, ly + (u - ly) * 0.8, kw * 0.85)
        entry = (ex, u - 1.5, kw * 0.7)
        inside = (ex + (cx - ex) * 0.45, u - hh * 0.32, max(1.6, kw * 0.5))
        out.append((kept + [bend, entry, inside], tier))
    return out


if __name__ == '__main__':
    for (s0, t0), (s1, t1) in zip(B8, seated()):
        print(t0, 'gap', round(gap(s0, t0), 1), '->', round(gap(s1, t1), 1), [tuple(round(v) for v in p) for p in s1])
