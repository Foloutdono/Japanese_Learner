import { isNative } from './platform'

// ── Where the session lives in the shell (plan 076) ───────────
// Supabase keeps the session in localStorage by default. A WebView's
// localStorage is real but not sacred -- iOS can purge website data
// under storage pressure, and an app that forgets its learner is an
// app that gets uninstalled -- so the shells keep it in the platform's
// own store (UserDefaults / SharedPreferences) through
// @capacitor/preferences. The plugin is reached lazily so the module
// evaluates the same on the web, in Node and in a test: only the first
// read inside a shell loads it. `undefined` on the web keeps
// supabase-js's default exactly as it was.
const plugin = () => import('@capacitor/preferences')

export const authStorage = isNative()
  ? {
      async getItem(key) {
        const { Preferences } = await plugin()
        return (await Preferences.get({ key })).value
      },
      async setItem(key, value) {
        const { Preferences } = await plugin()
        await Preferences.set({ key, value })
      },
      async removeItem(key) {
        const { Preferences } = await plugin()
        await Preferences.remove({ key })
      },
    }
  : undefined
