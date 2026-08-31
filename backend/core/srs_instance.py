import os

from srs.srs import SRSEngine
from study.modes import SRS_MODES

DATABASE_URL = os.environ.get("DATABASE_URL")

# SRS_MODES is handed to the engine rather than imported by it: srs/ sits
# below study/ and imports nothing from it, but the engine still has to
# know which modes the app can actually put in front of a learner, so
# that its whole-account aggregates (mastery counts, the interval
# ladder, the due forecast, daruma goals) agree with /api/stats about
# what counts. See SRSEngine._servable_filter. This is the only place
# the engine is constructed, so there is no second instance counting
# differently.
srs = SRSEngine(DATABASE_URL, servable_modes=sorted(SRS_MODES))
