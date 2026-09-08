# 0009 — Card readings fall back to server audio

- **Status**: accepted
- **Date**: 2026-09-08

## Context

ADR 0006 gave study audio to the browser's own `SpeechSynthesis` and named
the price it expected to pay: "voice quality varies by platform and some
Linux browsers ship no Japanese voice at all. The control must detect voice
availability and hide or disable itself rather than failing silently."

On a phone that price is not an edge case, and the remedy does not cover it.

- **Android's WebView** — what the Capacitor shell runs in — has no Web
  Speech API at all. `window.speechSynthesis` is undefined, so the native
  Android app was silent by construction.
- **Android Chrome** has the API but a Japanese voice only if the device's
  TTS engine has Japanese data installed, which on a French-locale phone it
  usually does not. Setting `utterance.lang` without a matching voice does
  not fail: the default voice reads the kana as if they were French.
- **iOS** ships Kyoko but refuses to speak unless the page's *first*
  `speak()` happened inside a user gesture, and answers a refusal with
  silence rather than an error. A card that speaks itself when the answer is
  revealed is a state change, not a tap, so a whole session could go by
  without ever spending the gesture.

And "hide the control" was only ever implemented where a control exists to
hide — the analyzer's `SpeakButton`. The study screens speak a card's
reading unconditionally, so on those phones the audio was simply absent,
with nothing on screen to say so.

## Decision

Try the device first, exactly as 0006 decided. When it cannot speak, play an
mp3 the backend synthesized instead: `GET /api/tts?text=…`, edge-tts, the
same engine and cache-to-disk shape as the exam listening section.

The endpoint accepts **only text this app ships** — every written form and
reading in the curated decks (`content/vocab_data.py`,
`content/kanji_data.py`, `content/kana_data.py`), plus the JMdict pool the
dictionary itself serves. Not a length cap, not a character class:
membership. Arbitrary text is refused, so an analyzer sentence still cannot
be synthesized server-side and the analyzer keeps 0006's rule unchanged,
`SpeakButton` and all.

That is what answers 0006's three objections rather than overruling them.
Its "disk" and "shape" arguments were both about text with no natural
bound; a card's reading is one of a fixed set, the same "small, fixed, and
worth caching" shape 0006 reserved edge-tts for. Its "latency" argument
survives intact, which is why the device is still tried first.

## Consequences

- Study audio works on any phone that can play an mp3 — including the native
  Android shell, where no client-side fix could have worked.
- The clip plays through the mixer, so mute and the volume sliders reach it.
  Browser speech, playing outside the AudioContext, never allowed that.
- The first play of a word costs a round trip. Every later one is served by
  the service worker (`word-audio` cache) or the browser's own, and the
  device path — when it works — still costs nothing.
- Disk is capped at 100 MB, oldest first, in its own subdirectory. Safe to
  evict because the text is in the URL: a dropped clip is remade by the next
  request that wants it. Exam clips, whose script only exists inside a
  stored paper, are not in that directory and are never evicted.
- A learner may hear a different voice on a different device — the device's
  own where it works, edge-tts where it does not. Uniformity was never on
  offer here: 0006 already accepted per-platform voices.
- Study audio is still not reproducible server-side in the sense 0006 meant:
  what the endpoint says is a function of shipped content, so it cannot
  carry generated material.

## Alternatives considered

**A Capacitor text-to-speech plugin.** Fixes the native shells and nothing
else. Most learners open the web build, where the plugin does not exist, and
it adds a native dependency to both platform projects.

**Shipping pre-rendered clips with the bundle,** the way `public/sounds/kanas`
already ships 102 kana. The decks are ~17,000 forms — two orders of
magnitude more — and it would still say nothing for the dictionary's JMdict
pool.

**Only making the device path work harder.** The gesture prime, the explicit
voice pick and dropping the `cancel()`-before-every-`speak()` are all in, and
they are what makes iOS speak at all. None of them conjures a Japanese voice
onto a device that has none, or an API into a WebView that lacks it.
