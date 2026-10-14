"""The birds, jointed. Each wing is an arm hinged at the shoulder and a
hand hinged at the wrist; the arm beats (a quicker downstroke, a slower
recovery), the hand follows a beat late so the tip bends against the
air, and the body rises a little on each downstroke. Seen from the side
(the goose, the crane) a beating wing folds through its own edge, so the
arm turns over vertically (scaleY through 0); seen from below (the gull)
the wings turn about the shoulders. Every hinge sits at its group's
local origin, so a rotation or a fold pivots where the bird's joint is.

Timing is per bird (`--beat`, the wingbeat in seconds; `--lag`, the
hand's delay), set by the scene so no two birds beat together."""
from geo import f


def _style(**kw):
    return '; '.join(f'--{k}: {v}' for k, v in kw.items())


def goose(beat=0.9, phase=0.0, ink='#1b2238', far='#2c3552'):
    """A goose (雁) flying right, seen from the side, ~22 units across
    the wings, the shoulder at the origin."""
    st = _style(beat=f'{f(beat)}s', ph=f'-{f(phase)}s')
    far_wing = (f'<g class="b5-arm b5-arm--far" style="{st}">'
                f'<path d="M-1.4 0 C-1.3 -2.2 -0.8 -4 -0.3 -5.5 L1.6 -5.2 C1.9 -3.5 2 -1.7 2.2 0 Z" fill="{far}"></path>'
                f'<g transform="translate(0.6 -5.4)"><g class="b5-hand" style="{st}">'
                f'<path d="M-0.9 -0.1 C-1 -2.2 -1.2 -3.9 -1.7 -5.6 C-0.3 -4.4 0.7 -2.7 1.1 0.2 Z" fill="{far}"></path></g></g></g>')
    near_wing = (f'<g class="b5-arm" style="{st}">'
                 f'<path d="M-1.8 0 C-1.6 -2.6 -1 -4.8 -0.4 -6.6 L1.9 -6.2 C2.2 -4.2 2.4 -2 2.6 0 Z" fill="{ink}"></path>'
                 f'<g transform="translate(0.7 -6.4)"><g class="b5-hand" style="{st}">'
                 f'<path d="M-1.1 -0.2 C-1.2 -2.6 -1.4 -4.6 -2 -6.6 C-0.4 -5.2 0.8 -3.2 1.3 0.2 Z" fill="{ink}"></path></g></g></g>')
    body = (f'<path d="M-7 0.6 C-5 -0.9 1 -1.5 4.6 -0.7 C5.6 -0.4 5.8 0.5 4.8 0.9 C1.8 1.8 -3.2 1.8 -7 0.6 Z" fill="{ink}"></path>'
            f'<path d="M4.4 -0.4 C6.8 -1 9.4 -1.5 11.6 -1.8" fill="none" stroke="{ink}" stroke-width="1.15" stroke-linecap="round"></path>'
            f'<circle cx="12" cy="-1.9" r="1" fill="{ink}"></circle>'
            f'<path d="M12.8 -1.9 L14.2 -1.6" stroke="{ink}" stroke-width="0.6" stroke-linecap="round"></path>'
            f'<path d="M-7 0.6 L-9 0.2 L-8.6 1.4 Z" fill="{ink}"></path>')
    return (f'<g class="b5-heave" style="{st}">'
            f'<g transform="translate(-1.2 0.2)">{far_wing}</g>{body}<g transform="translate(0.2 -0.4)">{near_wing}</g></g>')


def crane(beat=1.8, phase=0.0):
    """A red-crowned crane (丹頂) flying left, seen from the side: the
    neck straight out, black with a white nape, the red crown, the legs
    trailing; white wings with black flight feathers. Beats slowly and
    glides between beats."""
    st = _style(beat=f'{f(beat)}s', ph=f'-{f(phase)}s')
    w, k = '#f6f3ec', '#14141c'
    far_wing = (f'<g class="b5-arm b5-arm--far b5-arm--glide" style="{st}">'
                f'<path d="M0 0 C-1.2 -4 -0.2 -8 2.6 -11.4 L5.2 -10.2 C4.4 -7 4.2 -3.6 4.6 -0.4 Z" fill="#d9d4ca"></path>'
                f'<g transform="translate(3.9 -10.8)"><g class="b5-hand b5-hand--glide" style="{st}">'
                f'<path d="M-1.3 -0.6 C0 -4 2.6 -7.6 6.4 -10.4 C5.4 -6.6 4.4 -3.2 2.6 0.6 Z" fill="#cfc9be"></path>'
                f'<path d="M6.4 -10.4 C5.4 -7.6 4.6 -4.6 3.8 -1.6 L5.2 -2.4 C5.6 -5 5.9 -7.8 6.4 -10.4 Z" fill="{k}"></path></g></g></g>')
    near_wing = (f'<g class="b5-arm b5-arm--glide" style="{st}">'
                 f'<path d="M-1 0 C-2.4 -4.4 -1.2 -9 2 -12.8 L5.2 -11.4 C4.4 -7.6 4.2 -3.8 4.8 -0.4 Z" fill="{w}"></path>'
                 f'<path d="M2 -12.8 L5.2 -11.4 C4.8 -9 4.6 -6.4 4.7 -3.6 L3.4 -3.2 C3.2 -6.4 2.8 -9.6 2 -12.8 Z" fill="{k}"></path>'
                 f'<g transform="translate(3.6 -12.1)"><g class="b5-hand b5-hand--glide" style="{st}">'
                 f'<path d="M-1.6 -0.7 C-0.2 -4.6 2.6 -8.6 6.8 -11.8 C5.8 -7.6 4.8 -3.6 2.8 0.7 Z" fill="{w}"></path>'
                 f'<path d="M6.8 -11.8 C5.8 -8.6 4.9 -5.2 4 -1.8 L5.6 -2.6 C6 -5.6 6.3 -8.8 6.8 -11.8 Z" fill="{k}"></path></g></g></g>')
    body = (f'<path d="M-13 0.6 C-7 -1.8 2 -2.6 9 -1.6 C13 -1 15.4 0.4 16.4 1.6 C11 3 3 3.6 -4 3.2 C-8 2.9 -11 2 -13 0.6 Z" fill="{w}"></path>'
            f'<path d="M10 -0.2 C12.6 0.4 15 1 16.4 1.6 C14.6 2.2 12.4 2.4 10 2.2 Z" fill="{k}"></path>'
            f'<path d="M-12.6 0.6 C-18 -0.6 -23 -1.7 -27.6 -2.6" fill="none" stroke="{k}" stroke-width="2.1" stroke-linecap="round"></path>'
            f'<path d="M-17.8 -0.4 C-20 -0.9 -22 -1.4 -23.6 -1.8" fill="none" stroke="{w}" stroke-width="0.9" stroke-linecap="round"></path>'
            f'<circle cx="-28.6" cy="-2.8" r="1.8" fill="{k}"></circle>'
            f'<circle cx="-28.9" cy="-4" r="0.9" fill="#c33a2c"></circle>'
            f'<path d="M-30.2 -2.6 L-35.6 -1.8" stroke="#cdb27a" stroke-width="0.95" stroke-linecap="round"></path>'
            f'<path d="M15.6 1.6 L32 3.6 M15.4 2.4 L31.4 5" stroke="{k}" stroke-width="0.85" stroke-linecap="round"></path>')
    return (f'<g class="b5-heave b5-heave--glide" style="{st}">'
            f'<g transform="translate(-3 -0.6)">{far_wing}</g>{body}<g transform="translate(-1.6 -0.8)">{near_wing}</g></g>')


def gull(beat=0.42, phase=0.0, ink='#ffffff', edge='#7c8794'):
    """A gull seen from below, gliding on bent wings, now and then
    beating them in a short run. The shoulders are at (±1.2, 0)."""
    st = _style(beat=f'{f(beat)}s', ph=f'-{f(phase)}s')

    def wing(side):
        s = side
        arm = f'M0 0 C{f(s * 2)} -1.2 {f(s * 4)} -2.4 {f(s * 5.6)} -2.8 L{f(s * 5.8)} -1.6 C{f(s * 4)} -1 {f(s * 2)} 0.2 0 1 Z'
        hand = f'M0 0 C{f(s * 1.6)} 0.5 {f(s * 3.4)} 1.4 {f(s * 5.2)} 2.6 C{f(s * 3.4)} 2.2 {f(s * 1.6)} 1.6 0 1.1 Z'
        return (f'<g transform="translate({f(s * 1.2)} 0)"><g class="b5-garm b5-garm--{"r" if s > 0 else "l"}" style="{st}">'
                f'<path d="{arm}" fill="{ink}" stroke="{edge}" stroke-width="0.25"></path>'
                f'<g transform="translate({f(s * 5.6)} -2.2)"><g class="b5-ghand b5-ghand--{"r" if s > 0 else "l"}" style="{st}">'
                f'<path d="{hand}" fill="{ink}" stroke="{edge}" stroke-width="0.25"></path></g></g></g></g>')
    body = f'<ellipse cx="0" cy="0.4" rx="1.3" ry="2.6" fill="{ink}" stroke="{edge}" stroke-width="0.25"></ellipse>'
    return f'<g class="b5-gull" style="{st}">{wing(-1)}{wing(1)}{body}</g>'


CSS = '''
/* ── the birds, jointed (F⁗) ──────────────────────────────────────
   An arm hinged at the shoulder, a hand at the wrist, both at their
   group's local origin (transform-box: view-box). The downstroke is
   quicker than the recovery; the hand follows a beat late; the body
   rises on the downstroke. Each bird sets its --beat and --ph. */
.b5-arm, .b5-hand, .b5-heave, .b5-garm, .b5-ghand { transform-box: view-box; transform-origin: 0 0; animation-duration: var(--beat); animation-delay: var(--ph); animation-iteration-count: infinite; }
.b5-arm { animation-name: b5-fold; animation-timing-function: linear; }
@keyframes b5-fold {
  0% { scale: 1 1; animation-timing-function: cubic-bezier(0.55, 0, 0.7, 0.4); }
  42% { scale: 1 -0.86; animation-timing-function: cubic-bezier(0.3, 0.5, 0.5, 1); }
  100% { scale: 1 1; }
}
.b5-arm--far { animation-name: b5-fold-far; }
@keyframes b5-fold-far {
  0% { scale: 1 0.82; animation-timing-function: cubic-bezier(0.55, 0, 0.7, 0.4); }
  42% { scale: 1 -0.62; animation-timing-function: cubic-bezier(0.3, 0.5, 0.5, 1); }
  100% { scale: 1 0.82; }
}
.b5-hand { animation-name: b5-bend; animation-timing-function: ease-in-out; animation-delay: calc(var(--ph) - var(--beat) * 0.12); }
@keyframes b5-bend { 0%, 100% { rotate: 14deg; } 42% { rotate: -22deg; } }
.b5-heave { animation-name: b5-heave; animation-timing-function: ease-in-out; }
@keyframes b5-heave { 0%, 100% { translate: 0 0.5px; } 30% { translate: 0 -0.7px; } }
/* the crane beats twice and glides */
.b5-arm--glide { animation-name: b5-fold-glide; }
@keyframes b5-fold-glide {
  0% { scale: 1 1; animation-timing-function: cubic-bezier(0.55, 0, 0.7, 0.4); }
  18% { scale: 1 -0.8; animation-timing-function: cubic-bezier(0.3, 0.5, 0.5, 1); }
  40% { scale: 1 1; animation-timing-function: cubic-bezier(0.55, 0, 0.7, 0.4); }
  58% { scale: 1 -0.8; animation-timing-function: cubic-bezier(0.3, 0.5, 0.5, 1); }
  80% { scale: 1 0.55; }
  100% { scale: 1 1; }
}
.b5-arm--far.b5-arm--glide { animation-name: b5-fold-glide-far; }
@keyframes b5-fold-glide-far {
  0% { scale: 1 0.8; animation-timing-function: cubic-bezier(0.55, 0, 0.7, 0.4); }
  18% { scale: 1 -0.6; animation-timing-function: cubic-bezier(0.3, 0.5, 0.5, 1); }
  40% { scale: 1 0.8; animation-timing-function: cubic-bezier(0.55, 0, 0.7, 0.4); }
  58% { scale: 1 -0.6; animation-timing-function: cubic-bezier(0.3, 0.5, 0.5, 1); }
  80% { scale: 1 0.42; }
  100% { scale: 1 0.8; }
}
.b5-hand--glide { animation-name: b5-bend-glide; }
@keyframes b5-bend-glide { 0%, 40%, 100% { rotate: 12deg; } 18%, 58% { rotate: -20deg; } 80% { rotate: 4deg; } }
.b5-heave--glide { animation-name: b5-heave-glide; }
@keyframes b5-heave-glide { 0%, 40%, 100% { translate: 0 0.6px; } 14%, 54% { translate: 0 -0.9px; } 80% { translate: 0 0.2px; } }
/* the gull: glides on bent wings, then a short run of beats */
.b5-garm { animation-name: b5-gull-arm; animation-timing-function: ease-in-out; animation-duration: calc(var(--beat) * 9); }
.b5-garm--r { scale: 1 1; }
.b5-garm--l { scale: 1 1; }
@keyframes b5-gull-arm {
  0%, 62%, 100% { rotate: 0deg; }
  68% { rotate: -26deg; } 74% { rotate: 22deg; } 80% { rotate: -24deg; } 86% { rotate: 20deg; } 92% { rotate: -6deg; }
}
.b5-garm--l { animation-name: b5-gull-arm-l; }
@keyframes b5-gull-arm-l {
  0%, 62%, 100% { rotate: 0deg; }
  68% { rotate: 26deg; } 74% { rotate: -22deg; } 80% { rotate: 24deg; } 86% { rotate: -20deg; } 92% { rotate: 6deg; }
}
.b5-ghand { animation-name: b5-gull-hand; animation-timing-function: ease-in-out; animation-duration: calc(var(--beat) * 9); }
@keyframes b5-gull-hand { 0%, 62%, 100% { rotate: 0deg; } 70% { rotate: 14deg; } 76% { rotate: -16deg; } 82% { rotate: 14deg; } 88% { rotate: -12deg; } }
.b5-ghand--l { animation-name: b5-gull-hand-l; }
@keyframes b5-gull-hand-l { 0%, 62%, 100% { rotate: 0deg; } 70% { rotate: -14deg; } 76% { rotate: 16deg; } 82% { rotate: -14deg; } 88% { rotate: 12deg; } }
'''
