import { useEffect, useMemo } from 'react'
import { LangProvider, useLang } from '../LangContext'
import { hideSplash } from '../lib/platform'
import { nativeReturnUrl } from '../lib/nativeReturn'

// ── 改札の戻り — the shell's callback, passing through the web ───
// Mounted by main.jsx in place of App on lib/nativeReturn.js's path:
// Supabase has just sent the shell's Google round trip HERE (it is
// where the shell asked to be sent, see lib/oauth.js), in the system
// browser the shell opened, and the only job is to forward the
// callback to the deep link the shell is listening for.
//
// Two ways out, because browsers disagree about the first. The forward
// is attempted on mount; Chrome's custom tab follows it, and the
// appUrlOpen listener in lib/native.js closes the tab. A browser that
// will not follow a custom scheme without a tap (Safari asks; some
// Chrome builds refuse a scripted one outright) gets the same link as
// a button, which is a tap. The tokens are never read here and never
// stored: lib/supabase.js is told not to look at this URL, and this
// screen only copies it onto another scheme.
function Return() {
  const { t } = useLang()
  const target = useMemo(() => nativeReturnUrl(window.location.href), [])

  useEffect(() => { hideSplash() }, [])
  useEffect(() => {
    try { window.location.replace(target) } catch { /* the button remains */ }
  }, [target])

  return (
    <div className="app-loading native-return">
      <div className="app-loading__sign" lang="ja" aria-hidden="true">{t.appTitle}</div>
      <p className="app-loading__note" role="status" aria-live="polite">{t.nativeReturnNote}</p>
      <a className="btn-primary native-return__open" href={target} data-action="native-return">
        {t.nativeReturnOpen}
      </a>
    </div>
  )
}

export default function NativeReturn() {
  return (
    <LangProvider>
      <Return />
    </LangProvider>
  )
}
