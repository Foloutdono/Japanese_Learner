const BASE = import.meta.env.VITE_API_URL || ''

export const api = (path) => `${BASE}${path}`

export async function apiFetch(path, session, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
    ...options.headers,
  }
  return fetch(api(path), { ...options, headers })
}