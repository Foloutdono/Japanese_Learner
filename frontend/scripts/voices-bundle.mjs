// The app's sound recipes as one script, for a page outside the app.
//
// Bundles src/lib/audio/recipes.js with the primitives it plays on, the
// voiceOut node every voice sounds through and the level each voice
// plays at (settings.js's voiceLevel, the app's own), and sets them on
// `globalThis.TsujiVoices`. Nothing of the app's audio graph comes with
// them, so a page that plays them owns its one context. Three readers:
// the loudness meter (measure-voices.mjs), which renders every voice
// in Chromium's OfflineAudioContext, the listening panel
// (sound-panel.mjs), which plays them to a person choosing between
// them, and the landing page
// (frontend/landing/build.mjs writes it to public/landing/voices.js),
// whose demos play them to a visitor. All three therefore hear the
// shipped recipes themselves rather than a copy that could drift.
// `later` comes too: a moment with a beat in it (the fare after a
// rating) plays on the audio clock, and left out, the minifier folds
// the clock's lead to a constant zero.
import { rolldown } from 'rolldown'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const audio = path.resolve(here, '../src/lib/audio')

const ENTRY = '\0tsuji-voices'
const entrySource = `
import { VOICE_EVENTS, VOICE_FAMILIES } from ${JSON.stringify(path.join(audio, 'recipes.js'))}
import { voiceOut, later } from ${JSON.stringify(path.join(audio, 'synth.js'))}
import { BASE_GAIN, trimFor, voiceLevel } from ${JSON.stringify(path.join(audio, 'settings.js'))}
globalThis.TsujiVoices = { VOICE_EVENTS, VOICE_FAMILIES, voiceOut, later, voiceLevel, BASE_GAIN, trimFor }
`

/** The bundle, as the text of one classic script. */
export async function voicesBundle() {
  const bundle = await rolldown({
    input: ENTRY,
    plugins: [{
      name: 'tsuji-voices-entry',
      resolveId: id => (id === ENTRY ? id : null),
      load: id => (id === ENTRY ? entrySource : null),
    }],
    // settings.js reads React for its hooks; the bundle only needs the
    // table, but React's own guard wants the build mode named.
    transform: { define: { 'process.env.NODE_ENV': '"production"' } },
  })
  const { output } = await bundle.generate({ format: 'iife', minify: true })
  await bundle.close()
  return output[0].code
}
