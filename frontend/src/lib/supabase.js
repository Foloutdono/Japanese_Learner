import { createClient } from '@supabase/supabase-js'
import { authStorage } from './authStorage'
// Side-effect import, and it must stay ABOVE createClient: the module
// takes a refused OAuth callback off the URL as it loads, and ES
// module order is the only thing that puts it there before supabase-js
// reads the same URL in its own initialize(). See lib/authRedirect.js.
import './authRedirect'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// Storybook's Vite build doesn't inherit the app's .env, so these are
// undefined there — createClient throws on a missing/invalid URL,
// which used to crash every story that imports anything on the
// Hud → useProfileSummary chain. Every story file's own
// comments already assume "no session/backend" degrades gracefully
// (useProfileSummary falls back to the plain profile link); that only
// holds if construction itself doesn't throw, so fall back to a
// placeholder project when real credentials aren't present. Calls
// made against it (auth.getSession(), etc.) simply fail/resolve to no
// session, same as any other offline state.
// The session's store is the platform's own inside the native shell
// (lib/authStorage.js, plan 076); `undefined` keeps the default here.
export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder-anon-key',
  authStorage ? { auth: { storage: authStorage } } : undefined,
)

// A missing URL in `npm run dev` is nearly always the .env trap:
// the real values live in the tracked .env.production, which Vite
// does not load in development. Warn loudly rather than letting the
// placeholder fail later as an opaque ERR_NAME_NOT_RESOLVED on the
// first auth call. See .env.example.
if (import.meta.env.DEV && !SUPABASE_URL) {
  console.warn(
    '[supabase] VITE_SUPABASE_URL is unset — using a placeholder project. ' +
    'Auth will fail. See frontend/.env.example: copy the VITE_SUPABASE_ ' +
    'lines from .env.production into .env.development.local.',
  )
}