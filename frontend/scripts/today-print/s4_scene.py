"""S⁴ · the print in its season, round 4 (plan 261, the canvas "Tsuji —
Today, the seasons", round 4). Round 3's print (s3_scene), with what the
owner asked of it:

- the day's gulls redrawn: seen from the side, crossing the bay on the
  wind, beating and gliding (s4_birds), in place of the gulls that
  swung over one spot;
- the crape myrtle and the cloud peak each drawn several ways, for the
  owner to choose from: `variant={'myrtle': ..., 'peak': ...}`
  (s4_flora.MYRTLES, s4_air.PEAKS); left out, round 3's.

    scene(L, hour, season, variant=None) -> sky, back, train, front, run"""
import contextlib
import types

import s1_scene
import s2_air
import s3_scene
import s4_air
import s4_birds
import s4_flora


def _flight(L, h, o, hour):
    if h['birds'] == 'gulls':
        return s4_birds.gulls(L, h, o, hour)
    return s3_scene.AIR.flight(L, h, o, hour)


def _thunderhead(L, h, o, hour, uid):
    return s4_air.thunderhead(L, h, o, hour, uid)


AIR = types.SimpleNamespace(**{**vars(s3_scene.AIR), 'flight': _flight, 'thunderhead': _thunderhead,
                                'cloud_layout': s4_air.cloud_layout})
FLORA = types.SimpleNamespace(**{**vars(s3_scene.FLORA), 'tree': s4_flora.tree})


@contextlib.contextmanager
def round4():
    """Round 3's print, with round 4's air and flora in place."""
    with s3_scene.round3():
        saved = (s1_scene.air, s1_scene.flora)
        s1_scene.air, s1_scene.flora = AIR, FLORA
        try:
            yield
        finally:
            s1_scene.air, s1_scene.flora = saved


def inks(season, hour):
    with round4():
        return s1_scene.inks(season, hour)


def scene(L, hour, season, uid='s4', with_disc=True, variant=None):
    with round4():
        sky, back, train, front, run = s1_scene.scene(L, hour, season, uid, with_disc, variant)
        h, _, o = s1_scene.inks(season, hour)
        o = {**o, **(variant or {})}
        front += s2_air.close(L, h, o, hour, uid)
    return sky, back, train, front, run
