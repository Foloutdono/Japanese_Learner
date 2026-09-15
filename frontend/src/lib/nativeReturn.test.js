import { describe, it, expect } from 'vitest'
import { NATIVE_REDIRECT, NATIVE_RETURN_PATH, isNativeReturn, nativeReturnUrl } from './nativeReturn'

// ── 改札の戻り — the shell's callback passing through the web ───
// The one property that matters: whatever Supabase put on the URL —
// tokens in the fragment, a code in the query, a refusal in either —
// reaches the deep link byte for byte, so lib/oauth.js's reader sees
// exactly what it would have seen had Supabase sent it there itself.
describe('nativeReturn', () => {
  it('recognises its own path and nothing else', () => {
    expect(isNativeReturn(`https://app.test${NATIVE_RETURN_PATH}`)).toBe(true)
    expect(isNativeReturn(`https://app.test${NATIVE_RETURN_PATH}#access_token=a&refresh_token=r`)).toBe(true)
    expect(isNativeReturn('https://app.test/')).toBe(false)
    expect(isNativeReturn('https://app.test/today#access_token=a')).toBe(false)
    expect(isNativeReturn('not a url')).toBe(false)
  })

  it('forwards the implicit-flow fragment untouched', () => {
    expect(nativeReturnUrl('https://app.test/auth/native#access_token=at1&refresh_token=rt1&token_type=bearer'))
      .toBe(`${NATIVE_REDIRECT}#access_token=at1&refresh_token=rt1&token_type=bearer`)
  })

  it('forwards a PKCE code in the query untouched', () => {
    expect(nativeReturnUrl('https://app.test/auth/native?code=abc123'))
      .toBe(`${NATIVE_REDIRECT}?code=abc123`)
  })

  it('forwards a refusal too — it is the shell\'s to read, not the web\'s', () => {
    expect(nativeReturnUrl('https://app.test/auth/native#error=server_error&error_code=identity_already_exists'))
      .toBe(`${NATIVE_REDIRECT}#error=server_error&error_code=identity_already_exists`)
  })

  it('is the bare deep link when there is nothing to carry', () => {
    expect(nativeReturnUrl('https://app.test/auth/native')).toBe(NATIVE_REDIRECT)
    expect(nativeReturnUrl('nonsense')).toBe(NATIVE_REDIRECT)
  })

  it('is the string the manifests are written against', () => {
    expect(NATIVE_REDIRECT).toBe('app.tsuji://auth-callback')
  })
})
