import { supabase } from './supabase'

// ── The session, for a write made without one in hand ─────────
// apiFetch attaches the bearer token only when it is handed a session,
// and a `null` there sends none: the backend answers 401 and the write
// is lost (Settings › Agenda saved nothing that way). A screen or store
// that does not hold the session asks for it here, as the shared GET
// stores do (stores/remote.js). Never throws: no session is null, and
// the call is then the sessionless one it would have been.
export async function currentSession() {
  try {
    const { data } = await supabase.auth.getSession()
    return data?.session ?? null
  } catch {
    return null
  }
}
