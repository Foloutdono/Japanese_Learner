# ── The plate cannot promise more or less than the server enforces ──
# frontend/src/domain/paywall.js's PASS_PLATFORMS names the sections
# that front the routers under core/credits.require_pass; the reading
# ride's plate (plan 099) lists them. Pinned both ways: every gated
# router is fronted by a listed platform, and every listed platform
# fronts a gated router.
import re
from pathlib import Path

from fastapi import params

from core.credits import require_pass
from routes import ask, composition, dictation, exams, ocr, phrase, reading, translation, video

# Which platform fronts which router module. reading.py serves both the
# reading practice and the comprehension exercises; the analyzer is the
# phrase, ocr and video routers together; the asking (routes/ask.py,
# plan 131) is a panel inside the five practice runs.
FRONTED_BY = {
    "reading": (reading, ask),
    "comprehension": (reading, ask),
    "translation": (translation, ask),
    "dictation": (dictation, ask),
    "composition": (composition, ask),
    "exam": (exams,),
    "analyzer": (phrase, ocr, video),
}


def _gated(module) -> bool:
    return any(
        isinstance(dep, params.Depends) and dep.dependency is require_pass
        for dep in module.router.dependencies
    )


def _declared_platforms() -> set[str]:
    src = Path(__file__).resolve().parents[2] / "frontend" / "src" / "domain" / "paywall.js"
    text = src.read_text(encoding="utf-8")
    block = re.search(r"PASS_PLATFORMS = Object\.freeze\(\{(.*?)\}\)", text, re.S)
    assert block, "PASS_PLATFORMS is not where the test expects it in paywall.js"
    return set(re.findall(r"^\s*(\w+):\s*'", block.group(1), re.M))


def test_every_listed_platform_fronts_a_gated_router():
    declared = _declared_platforms()
    assert declared == set(FRONTED_BY), (
        f"paywall.js lists {sorted(declared)}, this test knows {sorted(FRONTED_BY)}"
    )
    for platform, modules in FRONTED_BY.items():
        for module in modules:
            assert _gated(module), f"{platform} fronts {module.__name__}, which is not pass-gated"


def test_every_gated_router_is_fronted_by_a_listed_platform():
    import importlib
    import pkgutil

    import routes

    fronted = {m for modules in FRONTED_BY.values() for m in modules}
    for info in pkgutil.iter_modules(routes.__path__):
        module = importlib.import_module(f"routes.{info.name}")
        router = getattr(module, "router", None)
        if router is None:
            continue
        if _gated(module):
            assert module in fronted, f"routes/{info.name}.py is pass-gated and no platform on the plate fronts it"
