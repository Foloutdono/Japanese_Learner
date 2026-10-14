"""The few helpers the print's modules share with the canvas they were
drawn on: number formatting, the lines' pigments and the dial's arcs
(as frontend/src/domain/dial.js measures them)."""
import math

# The day on the screenshot: 292 due, 87 board, 205 wait.
PARTS = [('kana', 6), ('vocab', 168), ('kanji', 96), ('grammar', 22)]
TOTAL = sum(n for _, n in PARTS)
RIDES, WAITS = 87, 205
LINE = {
    'kana': '#b84f3c', 'vocab': '#3e7ba6', 'kanji': '#7b68a3', 'grammar': '#608045',
}
NAME = {'kana': 'Kana', 'vocab': 'Vocabulaire', 'kanji': 'Kanji', 'grammar': 'Grammaire'}


def f(x):
    return f'{x:.2f}'.rstrip('0').rstrip('.')


def arcs(r, gap=8, cap=3, parts=PARTS):
    """[(key, start, len, mid_angle_deg)] along a circle of radius r,
    from the top, clockwise (domain/dial.dialArcs)."""
    c = 2 * math.pi * r
    total = sum(n for _, n in parts)
    usable = c - gap * len(parts)
    at = gap / 2
    out = []
    for key, n in parts:
        span = usable * n / total
        start = at + cap
        ln = max(0, span - 2 * cap)
        mid = (at + span / 2) / c * 360
        out.append((key, start, ln, mid))
        at += span + gap
    return out, c
