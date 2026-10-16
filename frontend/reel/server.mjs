// ── The reel's dev server (plan 210) ──────────────────────────────
// The app's own Vite config (so the stage builds the app exactly as
// `npm run dev` does), with three things added:
//
//   /__reel/director         the director (reel/director.html)
//   /__reel/stage/<path>     the stage (reel/stage.html), at an app path
//   /__reel/files/<path>     a file under frontend/reel/ or the reel's
//                            cache, by path (the scripts' own media)
//
// The stage is served at the app's own path, under a prefix the stage
// takes off before the router reads it: the router must see
// /dictionary/analyzer, and Vite must be told which document to serve.
//
// HMR is off when rendering: a file saved mid-render must not reload a
// page whose clock is being stepped. `npm run reel -- --preview` keeps it.

import { createServer } from 'vite'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, extname, normalize } from 'node:path'

export const REEL = dirname(fileURLToPath(import.meta.url))
export const FRONTEND = resolve(REEL, '..')
export const REPO = resolve(FRONTEND, '..')

const TYPES = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.mp4': 'video/mp4', '.json': 'application/json', '.txt': 'text/plain',
}

function reelRoutes(roots) {
  return {
    name: 'tsuji:reel-routes',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const [path] = req.url.split('?')
        try {
          if (path === '/__reel/director' || path.startsWith('/__reel/stage/') || path === '/__reel/stage') {
            const file = path.startsWith('/__reel/stage') ? 'stage.html' : 'director.html'
            const html = await server.transformIndexHtml(req.url, readFileSync(resolve(REEL, file), 'utf8'))
            res.setHeader('Content-Type', 'text/html; charset=utf-8')
            res.setHeader('Cache-Control', 'no-store')
            res.end(html)
            return
          }
          if (path.startsWith('/__reel/files/')) {
            const rel = normalize(decodeURIComponent(path.slice('/__reel/files/'.length)))
            for (const root of roots) {
              const file = resolve(root, rel)
              if (!file.startsWith(root)) continue
              if (existsSync(file) && statSync(file).isFile()) {
                res.setHeader('Content-Type', TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream')
                res.setHeader('Cache-Control', 'no-store')
                res.end(readFileSync(file))
                return
              }
            }
            res.statusCode = 404
            res.end('not found')
            return
          }
        } catch (err) {
          next(err)
          return
        }
        next()
      })
    },
  }
}

/**
 * Start the server; resolves to { server, origin }. `roots` are the
 * folders /__reel/files/ may serve from (the script's own folder and
 * the cache), searched in order.
 */
export async function startReelServer({ port = 0, hmr = false, roots = [] } = {}) {
  const server = await createServer({
    configFile: resolve(FRONTEND, 'vite.config.js'),
    root: FRONTEND,
    mode: 'development',
    logLevel: 'warn',
    clearScreen: false,
    server: {
      port,
      strictPort: false,
      host: '127.0.0.1',
      hmr,
      fs: { allow: [REPO] },
    },
    plugins: [reelRoutes([...roots, REEL].map(r => resolve(r)))],
  })
  await server.listen()
  const address = server.httpServer.address()
  return { server, origin: `http://127.0.0.1:${address.port}` }
}
