"""S³ · the year's inks, round 3 (plan 261). Round 2's (s2_inks.py), with
the owner's picks: the crape myrtle (百日紅) is summer's tree and the
red plum (紅梅) winter's; and the summer night is two prints, split by
the month: the fireflies in June and July, the fireworks in August."""
import copy

from s2_inks import SEASONS, HOURS, VIEWS, VIEWS_FR, P as P2, TREE_NAMES

__all__ = ['SEASONS', 'HOURS', 'VIEWS', 'VIEWS_FR', 'P', 'TREE_NAMES', 'NIGHTS', 'NIGHT_VIEWS', 'NIGHT_VIEWS_FR']

P = copy.deepcopy(P2)
for hour in HOURS:
    P['summer'][hour].update(tree='sarusuberi')
    P['winter'][hour].update(tree='ume')

# the summer night by the month: what changes in August (which month
# shows which print is the app's: src/domain/printHour.js)
NIGHTS = {'hanabi': dict(fireworks=True, flies=None)}
NIGHT_VIEWS = {'hanabi': '花火'}
NIGHT_VIEWS_FR = {'hanabi': 'les feux d’artifice'}
