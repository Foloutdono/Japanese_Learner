// A visible finger: a soft ring where each tap lands.
(() => {
  if (!location.origin.includes('localhost')) return
  const css = `.__tap{position:fixed;z-index:2147483647;pointer-events:none;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;
    background:rgba(255,255,255,.35);border:2px solid rgba(255,255,255,.85);box-shadow:0 0 18px rgba(0,0,0,.35);
    animation:__tap .55s ease-out forwards}@keyframes __tap{0%{transform:scale(.55);opacity:1}70%{opacity:.9}100%{transform:scale(1.25);opacity:0}}`
  const add = () => { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s) }
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', add) : add()
  const ring = (x, y) => { const d = document.createElement('div'); d.className = '__tap'; d.style.left = x + 'px'; d.style.top = y + 'px'; document.documentElement.appendChild(d); setTimeout(() => d.remove(), 700) }
  window.addEventListener('touchstart', e => { for (const t of e.changedTouches) ring(t.clientX, t.clientY) }, { capture: true, passive: true })
  window.__ring = ring
})()
