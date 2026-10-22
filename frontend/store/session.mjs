// A session supabase-js will accept from localStorage; the dev backend ignores the token.
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url')
const exp = Math.floor(Date.now() / 1000) + 3600 * 24 * 365
const jwt = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'local-dev-user', role: 'authenticated', exp, aud: 'authenticated', email: 'lea@example.com' })}.sig`
export const SESSION = {
  access_token: jwt, refresh_token: 'x', token_type: 'bearer', expires_in: 31536000, expires_at: exp,
  user: { id: 'local-dev-user', aud: 'authenticated', role: 'authenticated', email: 'lea@example.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-10-01T00:00:00Z' },
}
export const KEY = 'sb-llisnbgrckwxmmxspolo-auth-token'
