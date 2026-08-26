"""chat(vision=True) selects a separate model list.

The one thing `vision` may change is WHICH tuple is walked. Retry, the
dead-model/dead-provider memory and the 400-vs-402 split are shared on
purpose -- a vision model goes stale exactly like a text model, and the
vision primary fails transiently ~1 call in 5, so the retry matters more
here rather than less. See study/llm_shared.py's catalog comments.
"""
import unittest
from unittest import mock

from study import llm_shared
from study.llm_shared import LLMUnavailable, Provider, chat


def _provider(name, models=(), vision_models=()):
    return Provider(name=name, url=f"https://{name}.test/v1/chat/completions",
                    api_key="k", models=models, vision_models=vision_models)


class VisionCatalogTests(unittest.TestCase):
    def test_every_vision_model_is_a_non_empty_string(self) -> None:
        for name, provider in llm_shared._PROVIDER_CATALOG.items():
            for model in provider.vision_models:
                self.assertIsInstance(model, str, name)
                self.assertTrue(model.strip(), name)

    def test_text_and_vision_lists_never_overlap(self) -> None:
        # A text model 400s on an image and a vision model is not tuned
        # for the bounded-JSON tasks `models` exists for. An id in both
        # means one of the two lists is wrong.
        for name, provider in llm_shared._PROVIDER_CATALOG.items():
            overlap = set(provider.models) & set(provider.vision_models)
            self.assertEqual(overlap, set(), f"{name} lists {overlap} in both")

    def test_at_least_one_provider_has_vision_models(self) -> None:
        # Guards the regression this whole plan exists to undo: plan 018
        # concluded no vision model existed and shipped OCR without one.
        self.assertTrue(
            any(p.vision_models for p in llm_shared._PROVIDER_CATALOG.values()),
            "no provider has vision models -- re-run scripts/check_llm_models.py --vision",
        )


class VisionSelectionTests(unittest.TestCase):
    def test_raises_when_no_provider_has_a_vision_model(self) -> None:
        with mock.patch.object(llm_shared, "PROVIDERS",
                               [_provider("only-text", models=("t1",))]):
            with self.assertRaises(LLMUnavailable) as ctx:
                chat([{"role": "user", "content": "hi"}], vision=True)
        # The message must name the probe script: "no vision model" is a
        # config problem with a specific remedy, not a transient failure.
        self.assertIn("check_llm_models", str(ctx.exception))

    def test_vision_picks_from_vision_models_not_models(self) -> None:
        sent = {}

        class _Resp:
            status_code = 200
            ok = True
            def json(self):
                return {"choices": [{"message": {"content": "猫"}}]}

        def _fake_post(url, **kwargs):
            sent["model"] = kwargs["json"]["model"]
            return _Resp()

        provider = _provider("both", models=("TEXT-ONLY",), vision_models=("VISION-ONLY",))
        with mock.patch.object(llm_shared, "PROVIDERS", [provider]), \
             mock.patch.object(llm_shared.requests.Session, "post", side_effect=_fake_post):
            out = chat([{"role": "user", "content": "x"}], vision=True)

        self.assertEqual(out, "猫")
        self.assertEqual(sent["model"], "VISION-ONLY")

    def test_text_path_still_picks_from_models(self) -> None:
        sent = {}

        class _Resp:
            status_code = 200
            ok = True
            def json(self):
                return {"choices": [{"message": {"content": "ok"}}]}

        def _fake_post(url, **kwargs):
            sent["model"] = kwargs["json"]["model"]
            return _Resp()

        provider = _provider("both", models=("TEXT-ONLY",), vision_models=("VISION-ONLY",))
        with mock.patch.object(llm_shared, "PROVIDERS", [provider]), \
             mock.patch.object(llm_shared.requests.Session, "post", side_effect=_fake_post):
            chat([{"role": "user", "content": "x"}])

        self.assertEqual(sent["model"], "TEXT-ONLY")

    def test_provider_without_vision_models_is_skipped_not_failed(self) -> None:
        sent = {}

        class _Resp:
            status_code = 200
            ok = True
            def json(self):
                return {"choices": [{"message": {"content": "ok"}}]}

        def _fake_post(url, **kwargs):
            sent["model"] = kwargs["json"]["model"]
            return _Resp()

        providers = [
            _provider("text-only", models=("T",)),
            _provider("has-vision", models=("T2",), vision_models=("V",)),
        ]
        with mock.patch.object(llm_shared, "PROVIDERS", providers), \
             mock.patch.object(llm_shared.requests.Session, "post", side_effect=_fake_post):
            chat([{"role": "user", "content": "x"}], vision=True)

        self.assertEqual(sent["model"], "V")


if __name__ == "__main__":
    unittest.main()


class VisionProviderOrderTests(unittest.TestCase):
    """Vision walks providers in a different order than text: the only
    free vertical-capable model is on OpenRouter, while the text models
    are best on NVIDIA. Getting this backwards silently costs tategaki
    (manga and novels), because the NVIDIA fallback answers confidently
    and wrongly rather than erroring."""

    def test_vision_prefers_openrouter_text_prefers_nvidia(self) -> None:
        providers = [_provider("nvidia", models=("t",), vision_models=("v1",)),
                     _provider("openrouter", models=("t2",), vision_models=("v2",))]
        with mock.patch.object(llm_shared, "PROVIDERS", providers):
            self.assertEqual([p.name for p in llm_shared._providers_for(False)],
                             ["nvidia", "openrouter"])
            self.assertEqual([p.name for p in llm_shared._providers_for(True)],
                             ["openrouter", "nvidia"])

    def test_unknown_provider_keeps_its_place_after_the_preferred_ones(self) -> None:
        providers = [_provider("nvidia"), _provider("somethingelse"), _provider("openrouter")]
        with mock.patch.object(llm_shared, "PROVIDERS", providers):
            self.assertEqual([p.name for p in llm_shared._providers_for(True)],
                             ["openrouter", "nvidia", "somethingelse"])
