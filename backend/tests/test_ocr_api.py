"""POST /api/ocr -- the vision tier of photo input.

Every test here runs OFFLINE: `chat` is monkeypatched, never called for
real. A test that needs a live model is a test that fails when the free
tier is busy, which is exactly the confusion plan 018 fell into.
"""
import io
import struct
import zlib

import pytest

import routes.ocr as ocr_module
from study.llm_shared import LLMUnavailable
from core.db import db_conn
from conftest import TEST_USER_ID


def _png_bytes() -> bytes:
    """A real 1x1 PNG, built rather than pasted so the magic bytes and
    CRCs are genuine -- _sniff_image_type checks the header, and a fake
    blob would pass or fail for the wrong reason."""
    def chunk(tag: bytes, data: bytes) -> bytes:
        return (struct.pack(">I", len(data)) + tag + data
                + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF))

    ihdr = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
    idat = zlib.compress(b"\x00\xff\xff\xff")
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")


@pytest.fixture(autouse=True)
def _reset_usage():
    """The daily cap is persistent, so without this the first test to run
    would leak its count into every later one."""
    conn = db_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM ocr_usage WHERE user_id = %s", (TEST_USER_ID,))
        conn.commit()
    finally:
        conn.close()
    yield


def _post(client, data=None, filename="p.png", content_type="image/png", vertical="false"):
    return client.post(
        "/api/ocr",
        files={"file": (filename, data if data is not None else _png_bytes(), content_type)},
        data={"vertical": vertical},
    )


def test_returns_normalized_text(client, monkeypatch):
    monkeypatch.setattr(ocr_module, "chat", lambda *a, **k: "猫 が 公園 を 歩く")
    response = _post(client)
    assert response.status_code == 200
    body = response.json()
    # Inter-CJK spaces are an artifact of the recognizer, not content.
    assert body["text"] == "猫が公園を歩く"
    assert body["chars"] == len(body["text"])


def test_uses_the_vision_model_list(client, monkeypatch):
    seen = {}

    def _fake_chat(messages, **kwargs):
        seen.update(kwargs)
        seen["content_types"] = [part["type"] for part in messages[0]["content"]]
        return "猫"

    monkeypatch.setattr(ocr_module, "chat", _fake_chat)
    assert _post(client).status_code == 200
    assert seen.get("vision") is True
    # The image must ride as an OpenAI-style content part -- that is what
    # makes chat() reusable without a transport change.
    assert seen["content_types"] == ["text", "image_url"]


def test_prompt_always_carries_the_orientation_instructions(client, monkeypatch):
    """LOAD-BEARING: every candidate model scored 0/3 on vertical text
    without these, and 3/3 with them."""
    seen = {}
    monkeypatch.setattr(
        ocr_module, "chat",
        lambda messages, **k: (seen.update(prompt=messages[0]["content"][0]["text"]), "猫")[1],
    )
    _post(client)
    assert "VERTICALLY" in seen["prompt"]
    assert "TOP to BOTTOM" in seen["prompt"]
    assert "RIGHT to LEFT" in seen["prompt"]


def test_vertical_flag_only_appends_a_hint(client, monkeypatch):
    """The flag must never select a different prompt or model -- the one
    prompt already handles both orientations."""
    prompts = {}
    monkeypatch.setattr(
        ocr_module, "chat",
        lambda messages, **k: (prompts.setdefault(
            len(prompts), messages[0]["content"][0]["text"]), "猫")[1],
    )
    _post(client, vertical="false")
    _post(client, vertical="true")
    assert prompts[1].startswith(prompts[0])
    assert len(prompts[1]) > len(prompts[0])


def test_code_fences_are_stripped(client, monkeypatch):
    monkeypatch.setattr(ocr_module, "chat", lambda *a, **k: "```\n猫が好き\n```")
    assert _post(client).json()["text"] == "猫が好き"


def test_real_newlines_survive_space_stripping(client, monkeypatch):
    """The [ \\t]+ vs \\s+ bug, re-asserted because this is a SECOND
    implementation of the rule (the first is frontend/src/lib/ocr.js).
    A newline between CJK characters is a line break the recognizer
    detected, not an inserted word separator."""
    monkeypatch.setattr(ocr_module, "chat", lambda *a, **k: "猫 が\n公園 を")
    assert _post(client).json()["text"] == "猫が\n公園を"


def test_non_image_body_is_rejected(client, monkeypatch):
    monkeypatch.setattr(ocr_module, "chat",
                        lambda *a, **k: pytest.fail("must not call a model"))
    response = _post(client, data=b"this is not an image", filename="p.png")
    assert response.status_code == 400


def test_empty_body_is_rejected(client):
    assert _post(client, data=b"").status_code == 400


def test_oversized_image_is_rejected(client, monkeypatch):
    monkeypatch.setattr(ocr_module, "chat",
                        lambda *a, **k: pytest.fail("must not call a model"))
    huge = _png_bytes() + b"\x00" * (ocr_module._MAX_IMAGE_BYTES + 1)
    assert _post(client, data=huge).status_code == 413


def test_no_vision_provider_maps_to_503(client, monkeypatch):
    def _boom(*a, **k):
        raise LLMUnavailable("no vision models")

    monkeypatch.setattr(ocr_module, "chat", _boom)
    response = _post(client)
    assert response.status_code == 503


def test_daily_limit_returns_429_and_names_the_limit(client, monkeypatch):
    monkeypatch.setattr(ocr_module, "chat", lambda *a, **k: "猫")
    monkeypatch.setattr(ocr_module, "_DAILY_OCR_LIMIT", 2)

    assert _post(client).status_code == 200
    assert _post(client).status_code == 200
    third = _post(client)
    assert third.status_code == 429
    assert "2" in third.json()["detail"]


def test_a_failed_call_still_costs_a_slot(client, monkeypatch):
    """Counted before the model call on purpose: a client retrying a
    failing call is exactly what the cap exists to stop."""
    monkeypatch.setattr(ocr_module, "_DAILY_OCR_LIMIT", 1)

    def _boom(*a, **k):
        raise LLMUnavailable("down")

    monkeypatch.setattr(ocr_module, "chat", _boom)
    assert _post(client).status_code == 503

    monkeypatch.setattr(ocr_module, "chat", lambda *a, **k: "猫")
    assert _post(client).status_code == 429
