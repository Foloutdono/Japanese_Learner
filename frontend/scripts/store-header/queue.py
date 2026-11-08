"""The moving header's captioned versions (plan 308, round 7, the owner's
pick I of the canvas "Tsuji — the moving header"): the day's queue on Today's
print, card by card, in the modes Today deals, each card's caption its header.

    cd frontend && python3 scripts/store-header/queue.py OUT [print] [--date YYYY-MM-DD]

writes OUT/queue.html, today.py's page (the print of the hour, Today's dial
and the day's finish) with the queue laid over it, and a script whose
window.render(t) draws the frame at t seconds, as today.py's does, so
film.mjs films it (`--page queue --lang en|fr|es`). The language is the
page's query (?lang=), with ?view=film for a frame at the window's own size.
One loop of LOOP seconds:

- the day: the dial on the day's 24 cards beside its four lines;
- the queue: the cards come along the platform one after another, the one at
  its middle answered: Kana → romaji (ゲ turned over), Word → meaning (毎日),
  Draw the kanji (日 in KanjiVG's stroke order, from its meaning), and the
  grammar ladder's Choose (の in これは、友だち＿かさです) and Build (を typed
  as "wo" in つめたい水＿飲みました, then the rating);
- the day done: today.py's finish (the seal at useFinish.js's beats), the
  week's stamps in its card, the seal turning back into the next day's 24.

The cards are set as the run sets them rather than captured: the run's faces,
inks and borders (read from the running app's computed styles: .gl-sent,
.gl-gap, .gl-tr, .gl-tile, .field, .btn-primary, .rating-bar__btn), its words
(locales/*/index.js, the API's meanings), at a size made for a phone, so every
text stays inside Apple's safe area and sharp at 3840 pixels. Each card's
caption is the mode's name in its line's pigment (--line-*) and what to do.
Captions are words, so each localization gets its own film.

The sounds are the app's, at the moments it plays them (window.SOUNDS): the
card turning (card-flip), the next card coming (card-transition), a choice
picked (click), the rating (correct), and the finish's stamp and chord."""
import argparse
import datetime
import importlib.util
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))

# today.py's page, the print and the dial and the finish this one lays the queue over
_spec = importlib.util.spec_from_file_location('store_header_today', os.path.join(HERE, 'today.py'))
today = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(today)

# 日's strokes, KanjiVG's (backend/kanjivg/065e5.svg), as the app's stroke order draws them
NICHI = ['M31.5,24.5c1.12,1.12,1.74,2.75,1.74,4.75c0,1.6-0.16,38.11-0.09,53.5c0.02,3.82,0.05,6.35,0.09,6.75',
         'M33.48,26c0.8-0.05,37.67-3.01,40.77-3.25c3.19-0.25,5,1.75,5,4.25c0,4-0.22,40.84-0.23,56c0,3.48,0,5.72,0,6',
         'M34.22,55.25c7.78-0.5,35.9-2.5,44.06-2.75',
         'M34.23,86.5c10.52-0.75,34.15-2.12,43.81-2.25']

# Every word as the app prints it (locales/*/index.js, the API's meanings) or as the captions say it.
TEXT = {
    'en': {
        'eyebrow': 'Today', 'count': '24 cards',
        'line': {'kana': 'Kana', 'vocab': 'Vocabulary', 'kanji': 'Kanji', 'grammar': 'Grammar'},
        'cap': {'kana': ['Kana → romaji', 'Recall how it sounds'],
                'word': ['Word → meaning', 'Recall what it means'],
                'draw': ['Draw the kanji', 'By hand, from its meaning'],
                'choose': ['Grammar · Choose', 'Complete the sentence'],
                'build': ['Grammar · Build', "Type what's missing"]},
        'hint': 'Tap to reveal', 'word': ['Every day', ''], 'day': ['Day', 'sun · Japan · counter for days'],
        'trC': "This is my friend's umbrella.", 'trB': 'I drank cold water.', 'right': 'Right.',
        'field': 'kana or rōmaji', 'check': 'Check', 'rate': ['Missed', 'Almost', 'Correct', 'Easy'],
        'finT': 'Day done.', 'finS': "Each card comes back when it's due.",
    },
    'fr': {
        'eyebrow': "Aujourd'hui", 'count': '24 cartes',
        'line': {'kana': 'Kana', 'vocab': 'Vocabulaire', 'kanji': 'Kanji', 'grammar': 'Grammaire'},
        'cap': {'kana': ['Kana → romaji', 'Retrouve sa prononciation'],
                'word': ['Mot → sens', 'Retrouve son sens'],
                'draw': ['Tracer le kanji', "À la main, d'après son sens"],
                'choose': ['Grammaire · Choisir', 'Complète la phrase'],
                'build': ['Grammaire · Construire', 'Tape ce qui manque']},
        'hint': 'Touche pour révéler', 'word': ['Tous les jours', ''], 'day': ['Jour', 'soleil · Japon · compteur de jours'],
        'trC': "C'est le parapluie de mon ami.", 'trB': "J'ai bu de l'eau froide.", 'right': 'Juste.',
        'field': 'kana ou rōmaji', 'check': 'Vérifier', 'rate': ['Raté', 'Presque', 'Correct', 'Facile'],
        'finT': 'Journée bouclée.', 'finS': 'Chaque carte revient à son heure.',
    },
    'es': {
        'eyebrow': 'Hoy', 'count': '24 tarjetas',
        'line': {'kana': 'Kana', 'vocab': 'Vocabulario', 'kanji': 'Kanji', 'grammar': 'Gramática'},
        'cap': {'kana': ['Kana → romaji', 'Recuerda cómo suena'],
                'word': ['Palabra → significado', 'Recuerda qué significa'],
                'draw': ['Trazar el kanji', 'A mano, según su significado'],
                'choose': ['Gramática · Elegir', 'Completa la frase'],
                'build': ['Gramática · Construir', 'Escribe lo que falta']},
        'hint': 'Toca para revelar', 'word': ['Cada día', 'todos los días'], 'day': ['Día', 'sol · Japón · luz del sol · contador de días'],
        'trC': 'Este es el paraguas de mi amigo.', 'trB': 'Bebí agua fría.', 'right': 'Correcto.',
        'field': 'kana o rōmaji', 'check': 'Comprobar', 'rate': ['Fallado', 'Casi', 'Correcto', 'Fácil'],
        'finT': 'Día completado.', 'finS': 'Cada tarjeta vuelve a su hora.',
    },
}
# The ladder's choices, in the order the app numbered them for each language's capture.
TILES = {'en': ['は', 'の', 'が'], 'fr': ['が', 'は', 'の'], 'es': ['は', 'が', 'の']}

CSS = r'''
html, body { overflow: hidden; }
.tpr { transform-origin: 0 0; }
.ov { position: absolute; inset: 0; pointer-events: none; color: #221d15; font-family: 'Space Grotesk', 'Noto Sans JP', sans-serif; }
.jp { font-family: 'Noto Sans JP', sans-serif; }
/* a card of the queue: the run's washi card (light theme), its caption its header */
.qc { position: absolute; left: 0; top: 0; width: 480px; height: 196px; border-radius: 14px; background: #efe6d0;
  box-shadow: 0 0 0 1px rgb(171 153 109 / 0.55), 0 1px 0 rgb(255 255 255 / 0.45) inset, 0 14px 32px -12px rgb(30 22 12 / 0.6), 0 2px 6px rgb(30 22 12 / 0.22);
  will-change: transform, opacity; }
.qh { position: absolute; left: 14px; right: 14px; top: 13px; display: flex; align-items: center; gap: 10px; white-space: nowrap; }
.qh b { font: 600 16px/1 'Space Grotesk', sans-serif; letter-spacing: 0.01em; color: #fbf6ea; border-radius: 6px; padding: 6px 9px 5px; }
.qh span { font: 600 21px/1 'Space Grotesk', sans-serif; letter-spacing: -0.005em; }
.qb { position: absolute; left: 0; right: 0; top: 50px; bottom: 8px; display: grid; place-items: center; }
.face { grid-area: 1 / 1; display: grid; justify-items: center; align-content: center; gap: 6px; }
.hint { font: 600 11px/1 'Space Grotesk', sans-serif; letter-spacing: 0.18em; text-transform: uppercase; color: #665c4a; }
.spec { font: 400 98px/1 'Noto Sans JP', sans-serif; }
.romaji { font: 400 66px/1 'Space Grotesk', sans-serif; }
.meaning { font: 700 36px/1.05 'Space Grotesk', sans-serif; letter-spacing: -0.01em; }
.sense { font: 400 17px/1.2 'Space Grotesk', sans-serif; color: #665c4a; }
.reading { font: 400 28px/1.2 'Noto Sans JP', sans-serif; }
/* the kanji: its meaning, then drawn on the run's canvas */
.draw { display: grid; grid-template-columns: 1fr auto 132px; align-items: center; gap: 14px; width: 100%; padding: 0 22px 0 26px; box-sizing: border-box; }
.draw .m { font: 700 56px/1 'Space Grotesk', sans-serif; letter-spacing: -0.01em; }
.draw .g { font: 400 16px/1.3 'Space Grotesk', sans-serif; color: #665c4a; margin-top: 8px; text-wrap: balance; }
.draw .to { font: 500 28px/1 'Space Grotesk', sans-serif; color: rgb(34 29 21 / 0.4); }
.canvas { width: 132px; height: 132px; border-radius: 10px; background: #1d1b20; box-shadow: 0 0 0 2px #c9b27c; position: relative; overflow: hidden; }
.canvas svg { position: absolute; inset: 0; width: 100%; height: 100%; }
/* the ladder: the sentence, its gap, its translation, the choices (the run's .gl-sent, .gl-gap, .gl-tr, .gl-tile) */
.gl { display: grid; grid-template-rows: 18px 54px 24px 42px; justify-items: center; align-items: center; width: 100%; height: 138px; }
.gl .ok { font: 700 18px/1 'Space Grotesk', sans-serif; color: #405b2e; height: 18px; }
.gl .sent { font: 500 30px/1 'Noto Sans JP', sans-serif; white-space: nowrap; padding-top: 14px; }
.gl rt { font: 500 13px/1 'Noto Sans JP', sans-serif; color: #665c4a; }
.gap { display: inline-block; vertical-align: -2px; min-width: 42px; height: 36px; margin: 0 3px; border-radius: 6px 6px 0 0; background: rgb(34 29 21 / 0.06);
  border-bottom: 2px dashed #665c4a; box-sizing: border-box; text-align: center; font: 500 26px/34px 'Space Grotesk', sans-serif; padding: 0 5px; }
.gap.typed { border-bottom: 2px solid #a97a25; }
.gap.filled { border-bottom: 0; border-radius: 6px; font: 700 30px/36px 'Noto Sans JP', sans-serif; }
.gl .tr { font: 400 17px/1.2 'Space Grotesk', sans-serif; color: #665c4a; }
.gl .tr.lead { font: 600 18px/1.2 'Space Grotesk', sans-serif; color: #221d15; }
.row { position: relative; width: 100%; height: 40px; align-self: end; }
.row > div { position: absolute; inset: 0; display: flex; justify-content: center; gap: 10px; }
.tile { display: flex; align-items: center; gap: 10px; width: 118px; height: 40px; box-sizing: border-box; padding: 0 10px; border-radius: 8px;
  background: #e7dec8; box-shadow: inset 0 0 0 1px #ab996d; }
.tile i { display: grid; place-items: center; width: 26px; height: 26px; border-radius: 99px; box-shadow: inset 0 0 0 2px #665c4a;
  font: 700 14px/1 'Space Grotesk', sans-serif; font-style: normal; color: #665c4a; }
.tile span { font: 600 21px/1 'Noto Sans JP', sans-serif; }
.tile.yes { box-shadow: inset 0 0 0 2px #4d7639; }
.tile.yes i { box-shadow: inset 0 0 0 2px #4d7639; color: #405b2e; }
.field { width: 280px; height: 40px; box-sizing: border-box; border-radius: 6px; background: #f6f1e4; box-shadow: inset 0 0 0 2px #a97a25;
  display: flex; align-items: center; padding: 0 14px; font: 400 20px/1 'Space Grotesk', sans-serif; }
.field .ph { color: #665c4a; opacity: 0.85; }
.check { height: 40px; padding: 0 18px; border-radius: 6px; display: grid; place-items: center; font: 600 16px/1 'Space Grotesk', sans-serif;
  background: #e7dec8; color: #665c4a; box-shadow: inset 0 0 0 1px #ab996d; }
.check.on { background: linear-gradient(180deg, #e7c26d, #c99a3e); color: #221d15; box-shadow: 0 1px 0 rgb(255 255 255 / 0.4) inset; }
.rate { display: grid; place-content: center; justify-items: center; gap: 3px; width: 100px; height: 40px; border-radius: 8px; box-sizing: border-box;
  background: linear-gradient(180deg, #332e26, #2b261e); color: #f3ecdf; font: 600 14px/1 'Space Grotesk', sans-serif; }
.rate em { font-style: normal; font-size: 12px; line-height: 1; height: 12px; }
.rate em.dot { width: 7px; height: 7px; border-radius: 99px; }
.rate.best { background: linear-gradient(180deg, #70c1ca, #59b9c6); color: #1c1811; }
.tap { position: absolute; width: 40px; height: 40px; margin: -20px 0 0 -20px; border-radius: 50%;
  background: rgb(42 36 28 / 0.14); box-shadow: inset 0 0 0 1.5px rgb(42 36 28 / 0.55); opacity: 0; }
/* the day, and the day done */
.dc { position: absolute; left: 532px; top: 456px; width: 314px; height: 196px; box-sizing: border-box; padding: 18px 18px; border-radius: 14px;
  background: rgb(243 234 210 / 0.97); box-shadow: 0 0 0 1px rgb(171 153 109 / 0.55), 0 14px 32px -12px rgb(30 22 12 / 0.6); display: grid; align-content: center; gap: 6px; }
.dc small { font: 600 14px/1 'Space Grotesk', sans-serif; letter-spacing: 0.16em; text-transform: uppercase; color: #665c4a; }
.dc b { font: 700 40px/1.05 'Space Grotesk', sans-serif; letter-spacing: -0.015em; }
.dc .lines { display: grid; grid-template-columns: auto auto; justify-content: start; gap: 9px 16px; margin-top: 8px; }
.dc .lines span { display: inline-flex; align-items: center; gap: 7px; font: 600 17px/1 'Space Grotesk', sans-serif; white-space: nowrap; }
.dc.fin b { font-size: 30px; }
.dc .lines i { width: 10px; height: 10px; border-radius: 99px; }
.dc .lines em { font-style: normal; font-variant-numeric: tabular-nums; color: #665c4a; }
.dc p { margin: 0; font: 500 20px/1.28 'Space Grotesk', sans-serif; color: rgb(34 29 21 / 0.82); text-wrap: balance; }
.dc .wk { height: 30px; position: relative; margin: 4px 0 2px; }
.dc .wk .week { position: static; translate: none; left: auto; top: auto; }
#dialbox { position: absolute; inset: 0; transform-origin: 0 0; will-change: transform, opacity; }
#stage { position: absolute; inset: 0; transform-origin: 0 0; }
'''

JS = r'''
const QS = new URLSearchParams(location.search);
const LANG = ['en', 'fr', 'es'].includes(QS.get('lang')) ? QS.get('lang') : 'en';
const VIEW = QS.get('view') || 'wide';
const TX = TEXTS[LANG], TL = TILE_ORDER[LANG];
const L2 = 24;
const T = { intro: [0, 2.9], kana: [2.9, 6.0], word: [6.0, 9.3], draw: [9.3, 13.2], choose: [13.2, 17.0], build: [17.0, 20.6], fin: [20.6, 24] };
const ORDER = ['kana', 'word', 'draw', 'choose', 'build'];
const LINE_OF = { kana: 'kana', word: 'vocab', draw: 'kanji', choose: 'grammar', build: 'grammar' };
const LINECOL = { kana: '#b84f3c', vocab: '#3e7ba6', kanji: '#7b68a3', grammar: '#608045' };
const PARTS = { kana: 2, vocab: 10, kanji: 8, grammar: 4 };
const CW = 480, CH = 196, Y0 = 456, PITCH = 508, AT = 592;
// The app's sounds, where it plays them (lib/audio/chimes.js): a card turned over (playFlip), the next card
// coming (CardTransition's card-transition), a choice picked (GrammarPlate's playClick), a passing rating
// (RatingBar's playCorrect), the finish's stamp and chord at today.py's beats, moved onto this loop.
const FIN_AT = (beat) => T.fin[0] + beat - 6.65;
const SOUNDS = [
  ['card-transition', 2.15], ['card-flip', T.kana[0] + 1.5],
  ['card-transition', T.word[0] - 0.2], ['card-flip', T.word[0] + 1.4],
  ['card-transition', T.draw[0] - 0.2],
  ['card-transition', T.choose[0] - 0.2], ['click', T.choose[0] + 1.42], ['card-flip', T.choose[0] + 1.64],
  ['card-transition', T.build[0] - 0.2], ['card-flip', T.build[0] + 1.97], ['correct', T.build[0] + 2.75],
  ['card-stamp', FIN_AT(6.95 + 0.68)], ['day-clear', FIN_AT(6.95 + 0.76)],
];
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);
const el = (tag, cls, parent, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; if (parent) parent.appendChild(e); return e; };
const html = (parent, s) => { parent.insertAdjacentHTML('beforeend', s); return parent.lastElementChild; };
const fadeAt = (tau, at, d = 0.22) => clamp((tau - at) / d);

const CARDS = {};
function card(m) {
  const c = el('div', 'qc');
  const h = el('div', 'qh', c);
  el('b', '', h, TX.cap[m][0]).style.background = LINECOL[LINE_OF[m]];
  el('span', '', h, TX.cap[m][1]);
  const body = el('div', 'qb', c);
  return { c, body };
}
/** A flashcard: its front, turned over to its back at `at`, as the app's card turns. */
function flipper(m, front, back, at) {
  const { c, body } = card(m);
  const f = html(body, `<div class="face">${front}</div>`), b = html(body, `<div class="face">${back}</div>`);
  return { c, set(tau) {
    const p = clamp((tau - at) / 0.32), sx = Math.abs(Math.cos(p * Math.PI));
    body.style.transform = `scaleX(${Math.max(0.02, sx).toFixed(3)})`;
    f.style.opacity = p < 0.5 ? 1 : 0; b.style.opacity = p < 0.5 ? 0 : 1;
  } };
}
function build() {
  const tpr = document.querySelector('.tpr');
  const OV = el('div', 'ov'); tpr.insertBefore(OV, document.getElementById('dial'));
  window.OV = OV;
  CARDS.kana = flipper('kana', `<div class="spec">ゲ</div><div class="hint">${TX.hint}</div>`, `<div class="romaji">ge</div>`, 1.5);
  CARDS.word = flipper('word', `<div class="spec" style="font-size:84px">毎日</div><div class="hint">${TX.hint}</div>`,
    `<div class="meaning">${TX.word[0]}</div>${TX.word[1] ? `<div class="sense">${TX.word[1]}</div>` : ''}<div class="reading">まいにち</div>`, 1.4);
  { // the kanji, drawn stroke by stroke on the run's canvas
    const { c, body } = card('draw');
    const d = html(body, `<div class="draw"><div><div class="m">${TX.day[0]}</div><div class="g">${TX.day[1]}</div></div><div class="to">→</div>
      <div class="canvas"><svg viewBox="0 0 109 109"><g stroke="rgb(255 255 255 / 0.16)" stroke-width="0.8" stroke-dasharray="2.4 2.4"><line x1="54.5" y1="4" x2="54.5" y2="105"/><line x1="4" y1="54.5" x2="105" y2="54.5"/></g>
      ${NICHI_PATHS.map((p) => `<path d="${p}" fill="none" stroke="#f3ecdf" stroke-width="5.6" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}</svg></div></div>`);
    const paths = [...d.querySelectorAll('path')];
    paths.forEach((p) => { const L = p.getTotalLength(); p.dataset.len = L; p.style.strokeDasharray = `${L} ${L}`; });
    CARDS.draw = { c, set(tau) {
      paths.forEach((p, i) => { const L = Number(p.dataset.len), f = clamp((tau - (0.55 + i * 0.42)) / 0.34); p.style.strokeDashoffset = (L * (1 - f)).toFixed(2); });
    } };
  }
  { // the ladder's Choose: the sentence, its gap, its translation, three choices
    const { c, body } = card('choose');
    const g = html(body, `<div class="gl"><div class="ok"></div><div class="sent">これは、<ruby>友<rt>とも</rt></ruby>だち<span class="gap"></span>かさです。</div>
      <div class="tr">${TX.trC}</div><div class="row"><div>${TL.map((k, i) => `<div class="tile"><i>${i + 1}</i><span>${k}</span></div>`).join('')}</div></div></div>`);
    const ok = g.querySelector('.ok'), gap = g.querySelector('.gap'), tiles = [...g.querySelectorAll('.tile')], right = TL.indexOf('の');
    CARDS.choose = { c, right, tiles, set(tau) {
      const a = fadeAt(tau, 1.62);
      ok.textContent = TX.right; ok.style.opacity = a;
      gap.classList.toggle('filled', a > 0.5); gap.textContent = a > 0.5 ? 'の' : '';
      tiles.forEach((t, i) => { t.classList.toggle('yes', i === right && a > 0); t.style.opacity = (i === right ? 1 : 1 - 0.5 * a).toFixed(3); });
    } };
  }
  { // the ladder's Build: the sentence, its gap, its translation, the field; then the rating
    const { c, body } = card('build');
    const g = html(body, `<div class="gl"><div class="ok"></div><div class="sent">つめたい<ruby>水<rt>みず</rt></ruby><span class="gap typed"></span><ruby>飲<rt>の</rt></ruby>みました。</div>
      <div class="tr lead">${TX.trB}</div><div class="row"><div class="e"><div class="field"><span class="ph">${TX.field}</span></div><div class="check">${TX.check}</div></div>
      <div class="r">${TX.rate.map((r, i) => `<div class="rate${i === 3 ? ' best' : ''}">${i < 2 ? `<em class="dot" style="background:${i ? '#d08a3a' : '#c4553f'}"></em>` : '<em>✓</em>'}${r}</div>`).join('')}</div></div></div>`);
    const ok = g.querySelector('.ok'), gap = g.querySelector('.gap'), field = g.querySelector('.field'), chk = g.querySelector('.check');
    const e = g.querySelector('.e'), r = g.querySelector('.r');
    CARDS.build = { c, field, rates: [...r.children], set(tau) {
      const typed = tau >= 1.25 ? 'wo' : tau >= 0.95 ? 'w' : '';
      const a = fadeAt(tau, 1.95);
      field.innerHTML = typed ? `<span>${typed}</span>` : `<span class="ph">${TX.field}</span>`;
      chk.classList.toggle('on', !!typed);
      gap.classList.toggle('filled', a > 0.5); gap.classList.toggle('typed', a <= 0.5);
      gap.textContent = a > 0.5 ? 'を' : typed;
      ok.textContent = TX.right; ok.style.opacity = a;
      e.style.opacity = (1 - clamp(a * 2)).toFixed(3); r.style.opacity = clamp(a * 2 - 1).toFixed(3);
    } };
  }
  for (const m of ORDER) OV.appendChild(CARDS[m].c);
  window.TAP = el('i', 'tap', OV);
  // the day, and the day done (the week's stamps the finish's own)
  const intro = el('div', 'dc', OV); window.INTRO = intro;
  el('small', '', intro, TX.eyebrow); el('b', '', intro, TX.count);
  const lines = el('div', 'lines', intro);
  for (const ln of ['kana', 'vocab', 'kanji', 'grammar']) {
    const s = el('span', '', lines); el('i', '', s).style.background = LINECOL[ln]; s.append(TX.line[ln] + ' '); el('em', '', s, PARTS[ln]);
  }
  const fin = el('div', 'dc fin', OV); window.FIN = fin;
  el('b', '', fin, TX.finT);
  const wk = el('div', 'wk', fin); wk.appendChild(document.getElementById('week'));
  el('p', '', fin, TX.finS);
  const DB = el('div', ''); DB.id = 'dialbox'; window.DIALBOX = DB;
  tpr.insertBefore(DB, OV);                    // behind the cards: they slide on and off it
  // the frame's safe area: the header's box (x 338-846, y 452-656) as it stands, or scaled into another's
  const ST = el('div', ''); ST.id = 'stage'; tpr.insertBefore(ST, DB); ST.appendChild(DB); ST.appendChild(OV);
  ST.style.transform = `translate(${STAGE.to[0]}px, ${STAGE.to[1]}px) scale(${STAGE.k}) translate(${-STAGE.from[0]}px, ${-STAGE.from[1]}px)`;
  DB.appendChild(document.getElementById('dial'));
}

function renderV(ta) {
  const t = ((ta % L2) + L2) % L2;
  const u = t < T.intro[1] ? 0.8 : t < T.fin[0] ? 6.62 : t < 23.2 ? Math.min(6.65 + (t - T.fin[0]), 11.19) : 11.2 + (t - 23.2);
  renderE(ta, u);
  $('train').style.transform = `translateX(${(clamp((t - 0.2) / 23.2) * RUN).toFixed(2)}px)`;
  const s = 0.9, dx = 428, dy = 554;
  DIALBOX.style.transform = `translate(${dx - CX * s}px, ${dy - CY * s}px) scale(${s})`;
  DIALBOX.style.opacity = (t < 2.75 ? 1 - clamp((t - 2.0) / 0.5) : t < 20.25 ? 0 : clamp((t - 20.25) / 0.4)).toFixed(3);
  // the queue: where along it the platform stands
  let pos;
  if (t < T.kana[0]) pos = -1.6 * (1 - ease(clamp((t - 2.15) / 0.75)));
  else if (t < T.fin[0] - 0.3) {
    pos = 0;
    for (let i = 1; i < ORDER.length; i++) pos += ease(clamp((t - (T[ORDER[i]][0] - 0.25)) / 0.6));
  } else pos = 4 + 1.9 * ease(clamp((t - (T.fin[0] - 0.3)) / 0.8));
  const k = ORDER.findIndex((m) => t >= T[m][0] && t < T[m][1]);
  ORDER.forEach((m, i) => {
    const C = CARDS[m], d = i - pos, ad = Math.min(1, Math.abs(d));
    C.c.style.transform = `translate(${(AT - CW / 2 + d * PITCH).toFixed(2)}px, ${Y0}px) scale(${(1 - 0.06 * ad).toFixed(4)})`;
    C.c.style.opacity = (1 - 0.6 * ad).toFixed(3);
    C.set(i === k ? t - T[m][0] : (k < 0 ? (t > 10 ? 99 : 0) : (i < k ? 99 : 0)));
  });
  // a tap where the learner answers
  TAP.style.opacity = 0;
  const tap = (m, at, x, y) => {
    const f = (t - T[m][0] - at) / 0.5;
    if (k === ORDER.indexOf(m) && f >= 0 && f <= 1) Object.assign(TAP.style, { left: x + 'px', top: y + 'px', opacity: (0.95 * (1 - f)).toFixed(3), transform: `scale(${(0.6 + 0.7 * f).toFixed(3)})` });
  };
  const at = (node) => { const r = node.getBoundingClientRect(), o = OV.getBoundingClientRect(), z = o.width / 1184; return [(r.left + r.width / 2 - o.left) / z, (r.top + r.height / 2 - o.top) / z]; };
  if (k === 3) { const [x, y] = at(CARDS.choose.tiles[CARDS.choose.right]); tap('choose', 1.42, x, y); }
  if (k === 4) { const [x1, y1] = at(CARDS.build.field); tap('build', 0.75, x1 - 90, y1); const [x2, y2] = at(CARDS.build.rates[3]); tap('build', 2.75, x2, y2); }
  const io = t < 12 ? 1 - clamp((t - 1.85) / 0.4) : clamp((t - 23.5) / 0.4);   // gone before the first card comes
  INTRO.style.opacity = io.toFixed(3); INTRO.style.transform = `translateX(${((1 - io) * (t < 12 ? -10 : 10)).toFixed(2)}px)`;
  const fo = clamp((t - 21.35) / 0.4) * (1 - clamp((t - 22.95) / 0.4));
  FIN.style.opacity = fo.toFixed(3); FIN.style.transform = `translateY(${((1 - fo) * 6).toFixed(2)}px)`;
}

function fit() {
  const tpr = document.querySelector('.tpr');
  if (VIEW === 'film') { tpr.style.transform = 'none'; return; }
  const x0 = VIEW === 'phone' ? (1184 - WIN_H * 1.5) / 2 : 0, w = VIEW === 'phone' ? WIN_H * 1.5 : 1184;
  tpr.style.transform = `scale(${innerWidth / w}) translate(${-x0}px, ${-TOP_PX}px)`;
}
document.fonts.ready.then(() => {
  setup(); build(); fit(); renderV(Number(QS.get('t')) || 0);
  addEventListener('resize', fit);
  window.render = renderV; window.LOOP = L2; window.WINDOW = { top: TOP_PX, width: 1184, height: WIN_H }; window.SOUNDS = SOUNDS; window.READY = true;
  if (QS.get('live') !== '0' && VIEW !== 'film') {
    let on = true, last = 0;
    document.addEventListener('visibilitychange', () => { on = !document.hidden; });
    addEventListener('message', (e) => { if (e.data === 'pause') on = false; else if (e.data === 'play') on = true; });
    const tick = (now) => { if (on && now - last > 30) { last = now; renderV((Date.now() % 864e5) / 1000); } requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  }
});
'''


# The frames a film is cut for, each a window onto the print and a box the queue is laid into:
# App Store Connect's header (21:9, 3840 x 1646, today.py's window and layout as they stand) and its
# search results (3:2, 3840 x 2560 at most: the window from 110, as tall as the print allows, and
# the header's box scaled into the centred 2168 x 1030 safe area of Apple's search results template,
# with the sky's gradient laid over the taller window).
FRAMES = {
    'header': {'size': (3840, 1646), 'top': today.TOP, 'safe': (1097, 493, 1646, 661)},
    'search': {'size': (3840, 2560), 'top': 110, 'safe': (836, 765, 2168, 1030)},
}
BOX = (338, 452, 846, 656)      # where the header's layout keeps the queue: its safe area, in the print's units


def page(name, day, frame='header'):
    fr = FRAMES[frame]
    scale = fr['size'][0] / today.header.DESK.W
    win_h = today.header.DESK.W * fr['size'][1] / fr['size'][0]
    if fr['top'] + win_h > today.header.DESK.H + 0.5:
        raise SystemExit(f'the {frame} window runs past the print\'s foot')
    sx, sy, sw, sh = (v / scale for v in fr['safe'])
    k = min(sw / (BOX[2] - BOX[0]), sh / (BOX[3] - BOX[1]))
    stage = {'k': round(min(k, 1.0) if frame == 'header' else k, 4), 'from': [(BOX[0] + BOX[2]) / 2, (BOX[1] + BOX[3]) / 2],
             'to': [sx + sw / 2, fr['top'] + sy + sh / 2]}
    if frame == 'header':
        stage = {'k': 1, 'from': [0, 0], 'to': [0, 0]}
    size, top = today.header.SIZE, today.TOP
    today.header.SIZE, today.TOP = fr['size'], fr['top']
    try:
        html = today.page(name, day)
    finally:
        today.header.SIZE, today.TOP = size, top
    html = html.replace('family=Noto+Sans+JP:wght@700', 'family=Noto+Sans+JP:wght@400;500;600;700')
    html = html.replace('family=Space+Grotesk:wght@700', 'family=Space+Grotesk:wght@400;500;600;700')
    html = html.replace('</style>', CSS + '</style>', 1)
    # today.py's render, with this loop's clock handed in rather than read from its own
    for old, new in (('function render(t) {', 'function renderE(t, u) {'), ('  const u = ((t % LOOP) + LOOP) % LOOP;\n', '')):
        assert old in html, old
        html = html.replace(old, new)
    tail = html[html.index('window.render = render;'):html.index('</script></body></html>')]
    js = (f'const TEXTS = {json.dumps(TEXT, ensure_ascii=False)};\nconst TILE_ORDER = {json.dumps(TILES, ensure_ascii=False)};\n'
          f'const NICHI_PATHS = {json.dumps(NICHI)};\nconst TOP_PX = {fr["top"]};\nconst WIN_H = {win_h:.4f};\n'
          f'const STAGE = {json.dumps(stage)};\nconst CX = {today.CX}, CY = {today.CY};\n' + JS)
    return html.replace(tail, '').replace('</script></body></html>', js + '</script></body></html>')


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    ap.add_argument('out')
    ap.add_argument('print', nargs='?', default='autumn-day', choices=sorted(today.header.PRINTS))
    ap.add_argument('--date', default='2026-10-06', help="the seal's date (its weekday and the week end on it)")
    ap.add_argument('--frame', default='header', choices=sorted(FRAMES), help="the header's 21:9, or search results' 3:2")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    path = os.path.join(a.out, 'queue.html')
    with open(path, 'w') as fh:
        fh.write(page(a.print, datetime.date.fromisoformat(a.date), a.frame))
    print(path)


if __name__ == '__main__':
    main()
