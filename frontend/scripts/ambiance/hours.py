"""The four hours of Today's print, as four loops (plan 219): a lake at
the foot of Fuji in autumn, its stone shore, the pine, and the local
line running along the water.

Each hour is a quiet bed (the open water, the shore, a little wind)
and two or three events in its two minutes, so most of the loop is
air. The owner asked for less, twice: keep it sparse.

A layer's level is where its loud moments sit (kit.level), in dB
relative to the hour's other layers; build.py then sets the loop's
loudness (HOURS) and the app's trim the rest.
"""
import numpy as np

from kit import Loop, reverb, circular_filter, lp, filt, level
import sounds as s


def L(T, seed):
    return Loop(T, seed)


def hills(T, seed, x, rt60=3.4, pre=0.12):
    """The mountains round the lake: a long, late, darkened answer."""
    return reverb(L(T, seed), x, rt60=rt60, pre=pre, hf=0.65, bright=4500)


def far_events(T, seed, calls, cutoff=4000, depth=0.3):
    """Calls placed far off: (t, mono, pan) through the air's filter."""
    lo = L(T, seed)
    for (t, y, pan) in calls:
        lo.place(s.distant(y, lo.rng, cutoff, depth), t, pan)
    return lo.out


def train(T, seed, t_mid, **kw):
    lo = L(T, seed)
    roll, joints = s.train_pass(lo, t_mid, **kw)
    w = L(T, seed + 1)
    for (t, ev, pan) in joints:
        w.place(ev, t, pan)
    return roll, w.out


def bed(T, seed, breeze, calm, groups, per, wind_cycles, wind_base):
    shore = s.lake_shore(L(T, seed), calm=calm, groups=groups, per=per, hollow=0.5)
    wash = s.lake_wash(L(T, seed + 1), breeze=breeze)
    wind = s.pine_wind(L(T, seed + 2), gust_cycles=wind_cycles, base=wind_base)
    return shore, wash, wind


# ── 曙 dawn, from 5:00 ─────────────────────────────────────────────
def dawn(T):
    """Still water at first light; a tit singing somewhere along the
    shore, twice; a fisher sculling out for a few strokes."""
    shore, wash, wind = bed(T, 101, 0.05, 1.0, (6, 12), (1, 3), 4, 0.1)
    r = np.random.default_rng(104)
    birds = far_events(T, 105, [(T * 0.18, s.tit_song(r), -0.5), (T * 0.66, s.tit_song(r), 0.35)],
                       cutoff=6500, depth=0.2)
    birds = level(birds, -29)
    scull = s.sculling(L(T, 106), t0=T * 0.4, strokes=6, period=2.6, pan=(-0.4, 0.0), level=1.0)
    scull = level(circular_filter(scull, lambda f: lp(f, 3000, 1)), -32)
    return (level(shore, -27) + level(wash, -37) + level(wind, -37)
            + birds * 0.5 + hills(T, 107, birds, rt60=2.2) * 0.8
            + scull * 0.6 + hills(T, 108, scull, rt60=2.0) * 0.4)


# ── 帰帆 the day, from 9:00 ────────────────────────────────────────
def day(T):
    """A light breeze on the lake; the pine; a kite calling once over
    the water; the local train going by, its crossing ringing first."""
    shore, wash, wind = bed(T, 201, 0.4, 0.6, (3.5, 7), (1, 3), 8, 0.2)
    r = np.random.default_rng(204)
    kite = far_events(T, 205, [(T * 0.22, s.kite_call(r), 0.3), (T * 0.22 + 6.5, s.kite_call(r), 0.45)],
                      cutoff=5000, depth=0.25)
    kite = level(kite, -28)
    t_mid = T * 0.64
    bells = level(circular_filter(s.crossing(L(T, 206), t_mid - 19, t_mid + 3, pan=0.5),
                                  lambda f: lp(f, 3000, 2)), -33)
    roll, joints = train(T, 207, t_mid, cars=2, speed=14.0, dist=85.0, direction=1)
    passing = level(roll, -27) + level(joints, -28)
    return (level(shore, -25) + level(wash, -32) + level(wind, -29)
            + kite * 0.4 + hills(T, 208, kite, rt60=2.4) * 0.9
            + bells * 0.4 + hills(T, 209, bells, rt60=2.6) * 0.7
            + passing * 0.85 + hills(T, 210, passing, rt60=2.0) * 0.35)


# ── 落雁 dusk, from 16:00 ──────────────────────────────────────────
def dusk(T):
    """The wind gone, the water stilling; the evening bell (入相の鐘)
    from the far shore, once; a train far along the lake; the first
    crickets."""
    shore, wash, wind = bed(T, 301, 0.15, 0.85, (5, 10), (1, 2), 4, 0.08)
    b = L(T, 306)
    bell = s.temple_bell(b.rng, f0=98.0, vel=1.0, dur=40.0)
    b.place(filt(bell, lambda f: lp(f, 1500, 2))[: len(bell)], T * 0.12, -0.35)
    bell = level(b.out, -23)
    roll, joints = train(T, 308, T * 0.66, cars=2, speed=13.0, dist=140.0, direction=-1)
    passing = level(roll, -31) + level(joints, -32)
    bugs = s.night_insects(L(T, 309), suzu=2, matsu=0, bout=(4, 9), rest=(8, 18))
    return (level(shore, -26) + level(wash, -35) + level(wind, -38)
            + bell * 0.45 + hills(T, 312, bell, rt60=4.5) * 0.9
            + passing * 0.8 + hills(T, 314, passing, rt60=2.4) * 0.4 + level(bugs, -39))


# ── 秋月 the night, from 19:30 ─────────────────────────────────────
def night(T):
    """The autumn moon: a few crickets in the grass, the water barely
    touching the stones, an owl once, far in the woods."""
    bugs = s.night_insects(L(T, 401), suzu=3, matsu=1, bout=(4, 10), rest=(6, 14), matsu_gap=(8, 20))
    bugs = circular_filter(bugs, lambda f: lp(f, 6500, 1))
    shore, wash, wind = bed(T, 402, 0.03, 1.0, (7, 14), (1, 2), 3, 0.08)
    r = np.random.default_rng(405)
    owl = level(far_events(T, 406, [(T * 0.42, s.owl_call(r), 0.55)], cutoff=2500, depth=0.2), -30)
    return (level(bugs, -37) + level(shore, -28) + level(wash, -40) + level(wind, -40)
            + owl * 0.45 + hills(T, 407, owl, rt60=2.6))


# Each hour's loudness, LUFS integrated. Day sits where the metro
# platform loop it replaced sat (-36); the quiet hours under it.
HOURS = {'dawn': (dawn, -37.5), 'day': (day, -36.0), 'dusk': (dusk, -37.0), 'night': (night, -38.5)}
