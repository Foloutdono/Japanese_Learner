"""S² · the year's inks, round 2 (plan 261). Round 1's (s1_inks.py),
with what the owner asked of it: fuller colour in the cherry and the
maple, Fuji without its snow in summer (s2_fuji.py), and a tree for
every season (s2_flora.py)."""
import copy

from s1_inks import SEASONS, HOURS, VIEWS, VIEWS_FR, P as P1

# the round's inks are read through this module as round 1's are
# (s2_scene), its seasons, hours and views with them
__all__ = ['SEASONS', 'HOURS', 'VIEWS', 'VIEWS_FR', 'P', 'TREES', 'TREE_NAMES']

P = copy.deepcopy(P1)

# ── 春: the cherry fuller, its petals close to the eye ──────────────
SPRING = {
    'dawn': dict(bloom=('#fbe0ec', '#eba7c5', '#ad6c9a'), crowns=(['#e3a4c2', '#cf86ad', '#f0c6d8'], 0.44, 0.9)),
    'day': dict(bloom=('#ffeaf2', '#f5b2ca', '#d97ca4'), crowns=(['#f6c5d6', '#efa6c1', '#fbdbe6'], 0.5, 0.95)),
    'dusk': dict(bloom=('#f8d0dc', '#e39bb6', '#87618e'), crowns=(['#c48aa6', '#a8789a', '#d6a0b8'], 0.44, 0.86)),
    'night': dict(bloom=('#f2dae8', '#c99fc2', '#54446c'), crowns=(['#6a5e84', '#786a90', '#5c5478'], 0.4, 0.8)),
}
for hour, o in SPRING.items():
    P['spring'][hour].update(o, tree='sakura', close='petals')

# ── 秋: the maple fuller, its leaves close to the eye ────────────────
AUTUMN = {
    'dawn': dict(maple=('#e3603e', '#b83c30', '#6e2434'), crowns=(['#a8505a', '#c46c5a', '#904a5e', '#cc845e'], 0.6, 0.85), falls='leaves'),
    'day': dict(maple=('#f2582a', '#d23a22', '#8e241c'), crowns=(['#d4502c', '#e88a2c', '#e0ae3c', '#b83a28'], 0.64, 0.95)),
    'dusk': dict(maple=('#cc4c3a', '#983030', '#4c2030'), crowns=(['#8a4246', '#9e5642', '#764048', '#a8684a'], 0.58, 0.8)),
    'night': dict(maple=('#5a3040', '#44263a', '#24161e'), crowns=(['#30293a', '#3a2e3c', '#403244'], 0.5, 0.72)),
}
for hour, o in AUTUMN.items():
    P['autumn'][hour].update(o, tree='maple', close='leaves')

# ── 夏: Fuji without its snow; a tree in green (or in flower) ────────
BARE_FUJI = {
    'dawn': dict(bare_top='#9a3222', bare_mid='#c4583a', fuji_foot='#c98a62', forest_top='#2c4a40', forest_foot='#5e7e6a',
                 fuji_shade='#4a1610', gully='#6a1e14', ridge_lit='#f2a070', light_op=0.3, snow='#fbf2ea', streaks=6),
    'day': dict(bare_top='#4a5584', bare_mid='#6b6c94', fuji_foot='#9aaccb', forest_top='#3c6670', forest_foot='#7c9cae',
                fuji_shade='#1e2a52', gully='#2e3866', ridge_lit='#b8c2dc', light_op=0.25, snow='#ffffff', streaks=5),
    'dusk': dict(bare_top='#363a66', bare_mid='#5a4c7a', fuji_foot='#8a7a96', forest_top='#283f52', forest_foot='#5a6478',
                 fuji_shade='#141630', gully='#20224a', ridge_lit='#f0a890', light_op=0.3, snow='#f6ece8', streaks=4),
    'night': dict(bare_top='#1a2642', bare_mid='#24324e', fuji_foot='#34486a', forest_top='#122430', forest_foot='#24384c',
                  fuji_shade='#080f20', gully='#0c1428', ridge_lit='#6a80a8', light_op=0.25, snow='#c9d4e4', streaks=3, snow_op=0.6),
}
for hour, fuji in BARE_FUJI.items():
    h = P['summer'][hour].setdefault('h', {})
    h['fuji'] = {**h.get('fuji', {}), **fuji}
    P['summer'][hour].update(bare=True, tree='aomomiji')

# ── 冬: a tree under the snow ────────────────────────────────────────
for hour in HOURS:
    P['winter'][hour].update(tree='ume')

# the options the canvas shows beside each season's row
TREES = {
    'summer': ('aomomiji', 'sarusuberi', 'yanagi'),
    'winter': ('ume', 'bare'),
}
TREE_NAMES = {
    'sakura': '桜', 'maple': '紅葉', 'aomomiji': '青もみじ', 'sarusuberi': '百日紅', 'yanagi': '柳', 'ume': '紅梅', 'bare': '雪の木',
}
