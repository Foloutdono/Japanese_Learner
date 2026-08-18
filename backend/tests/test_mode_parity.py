import re
import unittest
from pathlib import Path

from study import modes

FRONTEND_REGISTRY = (
    Path(__file__).resolve().parents[2] / "frontend" / "src" / "domain" / "studyModes.js"
)
EN_LOCALE = (
    Path(__file__).resolve().parents[2] / "frontend" / "src" / "locales" / "en" / "index.js"
)
FR_LOCALE = (
    Path(__file__).resolve().parents[2] / "frontend" / "src" / "locales" / "fr" / "index.js"
)


def _frontend_keys() -> set[str]:
    """
    The keys declared in the frontend registry, read out of the source
    rather than duplicated into a shared JSON file — one definition, no
    third copy to drift.
    """
    src = FRONTEND_REGISTRY.read_text(encoding="utf-8")
    return set(re.findall(r"^\s*mode\('([^']+)'", src, re.MULTILINE))


def _locale_keys(path: Path) -> set[str]:
    src = path.read_text(encoding="utf-8")
    return set(re.findall(r"^\s*(mode_[a-z0-9_]+):", src, re.MULTILINE))


class ModeParityTests(unittest.TestCase):
    """
    The mode key space is defined twice — study/modes.py and
    domain/studyModes.js — because one side needs SQL and the other needs
    labels and renderers. Both files say they mirror each other; this is
    what makes that true rather than aspirational.

    It matters more than a normal duplication: card_modes.mode is a bare
    TEXT column with no CHECK and no FK, so a key that exists on one side
    only fails silently. A frontend-only key 400s every request for that
    mode; a backend-only key is a mode nobody can reach.
    """

    def setUp(self) -> None:
        if not FRONTEND_REGISTRY.exists():
            self.skipTest(f"frontend registry not found at {FRONTEND_REGISTRY}")

    def test_key_sets_match_exactly(self) -> None:
        frontend = _frontend_keys()
        backend = set(modes.ALL_MODE_KEYS)
        self.assertEqual(
            frontend, backend,
            f"\n  frontend only: {sorted(frontend - backend)}"
            f"\n  backend only:  {sorted(backend - frontend)}",
        )

    def test_frontend_declares_the_expected_count(self) -> None:
        # 17 graded + the ungraded browse.
        self.assertEqual(len(_frontend_keys()), 18)

    def test_every_mode_has_an_english_label_and_description(self) -> None:
        # A missing label silently renders the raw key ('kanji.readings')
        # in the picker, which looks like a bug but reads like a typo.
        locale = _locale_keys(EN_LOCALE)
        for key in modes.ALL_MODE_KEYS:
            base = "mode_" + key.replace(".", "_")
            self.assertIn(base, locale, f"missing en label for {key}")
            self.assertIn(f"{base}_desc", locale, f"missing en description for {key}")

    def test_locales_agree_on_mode_keys(self) -> None:
        en, fr = _locale_keys(EN_LOCALE), _locale_keys(FR_LOCALE)
        self.assertEqual(
            en, fr,
            f"\n  en only: {sorted(en - fr)}\n  fr only: {sorted(fr - en)}",
        )

    def test_every_mode_has_a_service_badge(self) -> None:
        # config/stations.js used to hold its own SERVICE map, and an
        # unmapped key fell through to a 番線 platform number
        # (ModeSelector.jsx) — no error, just a mode card that looked
        # like a source picker. Every key must name a rung.
        src = FRONTEND_REGISTRY.read_text(encoding="utf-8")
        # Each mode(...) call spans to the next one; check each block names
        # a service.
        blocks = re.split(r"^\s*mode\('", src, flags=re.MULTILINE)[1:]
        for block in blocks:
            key = block[: block.index("'")]
            self.assertRegex(
                block[: block.index("}),") if "})," in block else len(block) - 1],
                r"service:\s*SERVICE\.",
                f"{key} declares no service badge",
            )


if __name__ == "__main__":
    unittest.main()
