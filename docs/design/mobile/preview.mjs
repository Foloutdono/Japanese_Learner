// Plain-HTML previews of the artboards for a headless screenshot: the
// runtime hole {{theme}} is filled and the DC wrappers are dropped.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
for (const f of readdirSync('.').filter(f => f.endsWith('.dc.html'))) {
  let h = readFileSync(f, 'utf8')
  h = h.replace('<script src="./support.js"></script>', '')
       .replace(/<x-dc>|<\/x-dc>|<helmet>|<\/helmet>/g, '')
       .replace(/<script data-dc-script[\s\S]*?<\/script>/, '')
       .replace(/\{\{theme\}\}/g, 'dark')
  writeFileSync(`preview/${f.replace('.dc.html', '.html')}`, h)
  writeFileSync(`preview/${f.replace('.dc.html', '.light.html')}`, h.replace(/class="jp phone dark|class="jp dark/g, m => m.replace('dark', 'light')))
}
console.log('previews written')
