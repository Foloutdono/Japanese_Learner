"""S³ · the print in its season, round 3 (plan 261, the canvas "Tsuji —
Today, the seasons"). Round 2's print (s2_scene), with what the owner
chose of it and asked of it:

- the summer's cloud peak as a cumulus, a tower of great lobes lit from
  the sun the dial stands in (s3_air);
- the crape myrtle (百日紅) as summer's tree, and the red plum (紅梅)
  as winter's (s3_flora, s3_inks);
- the summer night split by the month: fireflies in June and July, the
  fireworks in August (s3_inks.NIGHTS; the app's printName picks it).

    scene(L, hour, season, variant=None) -> sky, back, train, front, run"""
import contextlib
import types

import s1_scene
import s2_air
import s2_scene
import s3_air
import s3_flora
import s3_inks


def _falls(L, h, o, hour):
    if o.get('falls') == 'snow':
        return s3_air.snowfall(L, o)
    return s2_scene.AIR.falls(L, h, o, hour)


AIR = types.SimpleNamespace(**{**vars(s2_scene.AIR), 'thunderhead': s3_air.thunderhead, 'cloud_layout': s3_air.cloud_layout,
                                'fireworks': s3_air.fireworks, 'fireworks_mirror': s3_air.fireworks_mirror, 'falls': _falls})
FLORA = types.SimpleNamespace(**{**vars(s2_scene.FLORA), 'tree': s3_flora.tree, 'defs': s3_flora.defs})


@contextlib.contextmanager
def round3():
    """Round 2's print, with round 3's inks, air and flora in place."""
    with s2_scene.round2():
        saved = (s1_scene.pal, s1_scene.air, s1_scene.flora)
        s1_scene.pal, s1_scene.air, s1_scene.flora = s3_inks, AIR, FLORA
        try:
            yield
        finally:
            s1_scene.pal, s1_scene.air, s1_scene.flora = saved


def inks(season, hour):
    with round3():
        return s1_scene.inks(season, hour)


def scene(L, hour, season, uid='s3', with_disc=True, variant=None):
    with round3():
        sky, back, train, front, run = s1_scene.scene(L, hour, season, uid, with_disc, variant)
        h, _, o = s1_scene.inks(season, hour)
        o = {**o, **(variant or {})}
        front += s2_air.close(L, h, o, hour, uid)
    return sky, back, train, front, run
