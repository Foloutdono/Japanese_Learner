"""S² · the print in its season, round 2 (plan 261, the canvas "Tsuji —
Today, the seasons"). Round 1's composition (s1_scene._scene), drawn
with round 2's parts in place of round 1's:

- Fuji without its snow in summer (s2_fuji.bare);
- the cloud peak as a tower of the print's own cloud banks, and fuller
  falls of petals and leaves (s2_air);
- a tree in every season, summer's and winter's to choose from
  (s2_flora.tree, with the option in `variant`: {'tree': 'yanagi'});
- and in front of everything, a few petals or leaves falling close to
  the eye (s2_air.close).

    scene(L, hour, season, variant=None) -> sky, back, train, front, run"""
import contextlib
import types

import s1_air
import s1_flora
import s1_scene
import s2_air
import s2_flora
import s2_fuji
import s2_inks


def _falls(L, h, o, hour):
    kind = o.get('falls')
    if kind == 'petals':
        return s2_air.petals(L, o)
    if kind == 'leaves':
        return s2_air.leaves(L, o)
    return s1_air.falls(L, h, o, hour)


_FUJI1 = s1_scene.fuji_s


def _fuji(fj, p, uid, seed, base):
    if 'bare_top' in p:
        return s2_fuji.bare(fj, p, uid, seed, None)
    return _FUJI1(fj, p, uid, seed, base)


AIR = types.SimpleNamespace(**{**vars(s1_air), 'thunderhead': s2_air.thunderhead, 'falls': _falls})
FLORA = types.SimpleNamespace(**{**vars(s1_flora), 'tree': s2_flora.tree, 'defs': s2_flora.defs})


@contextlib.contextmanager
def round2():
    """Round 1's composition reads its inks, its air, its flora and its
    Fuji from its module: round 2's, while a print is drawn."""
    saved = (s1_scene.pal, s1_scene.air, s1_scene.flora, s1_scene.fuji_s)
    s1_scene.pal, s1_scene.air, s1_scene.flora, s1_scene.fuji_s = s2_inks, AIR, FLORA, _fuji
    try:
        yield
    finally:
        s1_scene.pal, s1_scene.air, s1_scene.flora, s1_scene.fuji_s = saved


def inks(season, hour):
    with round2():
        return s1_scene.inks(season, hour)


def scene(L, hour, season, uid='s2', with_disc=True, variant=None):
    with round2():
        sky, back, train, front, run = s1_scene.scene(L, hour, season, uid, with_disc, variant)
        h, _, o = s1_scene.inks(season, hour)
        o = {**o, **(variant or {})}
        front += s2_air.close(L, h, o, hour, uid)
    return sky, back, train, front, run
