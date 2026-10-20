"""S⁵ · the print in its season, round 5 (plan 261, the canvas "Tsuji —
Today, the seasons", round 5). Round 4's print (s4_scene), with the
owner's picks and the foreground laid out:

- the crape myrtle two ways, a day each: A as the photo has it (s4_flora
  'photo'), B as the kachō-e draws it ('kacho'); A unless the variant
  names B, `variant={'myrtle': 'kacho'}` (which day shows which is the
  app's: src/domain/printHour.js);
- the cloud peak in three flat tones (s4_air 'tones');
- the gulls as round 4 drew them (s4_birds);
- the foreground laid out by depth (s5_fore): the bank's flowers at the
  trees' feet and far off, the trees' shadows, grass, and what the tree
  let fall lying where it fell (the trees' own drifts are left out:
  `fallen=False`).

    scene(L, hour, season, variant=None) -> sky, back, train, front, run"""
import contextlib
import types

import s1_scene
import s2_air
import s4_scene
import s5_fore

MYRTLES = ('photo', 'kacho')
PICKS = dict(myrtle='photo', peak='tones', fallen=False)

FLORA = types.SimpleNamespace(**{**vars(s4_scene.FLORA), 'bank': s5_fore.bank,
                                 'fore_back': s5_fore.fore_back, 'fore_front': s5_fore.fore_front})


@contextlib.contextmanager
def round5():
    """Round 4's print, with round 5's foreground in place."""
    with s4_scene.round4():
        saved = s1_scene.flora
        s1_scene.flora = FLORA
        try:
            yield
        finally:
            s1_scene.flora = saved


def inks(season, hour):
    with round5():
        return s1_scene.inks(season, hour)


def scene(L, hour, season, uid='s5', with_disc=True, variant=None):
    variant = {**PICKS, **(variant or {})}
    with round5():
        sky, back, train, front, run = s1_scene.scene(L, hour, season, uid, with_disc, variant)
        h, _, o = s1_scene.inks(season, hour)
        o = {**o, **variant}
        front += s2_air.close(L, h, o, hour, uid)
    return sky, back, train, front, run
