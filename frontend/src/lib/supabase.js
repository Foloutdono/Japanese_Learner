import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// Storybook's Vite build doesn't inherit the app's .env, so these are
// undefined there — createClient throws on a missing/invalid URL,
// which used to crash every story that imports anything on the
// BurgerMenu/TopBar → useProfileSummary chain. Every story file's own
// comments already assume "no session/backend" degrades gracefully
// (useProfileSummary falls back to the plain profile link); that only
// holds if construction itself doesn't throw, so fall back to a
// placeholder project when real credentials aren't present. Calls
// made against it (auth.getSession(), etc.) simply fail/resolve to no
// session, same as any other offline state.
export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder-anon-key',
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