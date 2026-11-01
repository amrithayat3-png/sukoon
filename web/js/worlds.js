import { h } from './ui.js';
import { s } from './icons.js';

const sv = (cls, vb, ...kids) => s('svg', { viewBox: vb, class: cls, 'aria-hidden': 'true', focusable: 'false', preserveAspectRatio: 'xMidYMax slice' }, ...kids);
const grad = (id, a, b) => s('linearGradient', { id, x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: '0', 'stop-color': a }), s('stop', { offset: '1', 'stop-color': b }));
const rect = (x, y, w, hh, fill, rx = 0) => s('rect', { x, y, width: w, height: hh, fill, rx });
const circ = (cx, cy, r, fill) => s('circle', { cx, cy, r, fill });

function flower(x, y, c, n) {
  return s('g', { class: `sway-s d${n}` },
    s('path', { d: `M${x} ${y + 26}V${y}`, stroke: '#3c9d6b', 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' }),
    circ(x, y - 4, 7, c), circ(x - 7, y, 6, c), circ(x + 7, y, 6, c), circ(x, y + 5, 6, c), circ(x, y, 5, '#ffe08a'));
}

const SCENES = {
  kids: () => [
    s('defs', null, grad('wk', '#d7f1ff', '#fff5d6')),
    rect(0, 0, 400, 140, 'url(#wk)'),
    circ(330, 36, 20, '#ffcf4d'), s('g', { class: 'drift' }, s('ellipse', { cx: 90, cy: 34, rx: 34, ry: 12, fill: '#fff' }), s('ellipse', { cx: 112, cy: 28, rx: 22, ry: 11, fill: '#fff' })),
    s('path', { d: 'M0 100q80-34 170-8t230-10V140H0z', fill: '#8fdc9b' }),
    s('path', { d: 'M0 120q110-30 220-4t180-6V140H0z', fill: '#5fc27a' }),
    flower(50, 98, '#ff8ab3', 0), flower(130, 108, '#ffffff', 1), flower(230, 100, '#ffb703', 2), flower(320, 106, '#a592ff', 3),
    s('g', { class: 'fly' }, s('path', { d: 'M265 58q8-12 16 0q-8 6-16 0zM281 58q8-12 16 0q-8 6-16 0z', fill: '#ff8ab3' })),
  ],
  teens: () => [
    s('defs', null, grad('wt', '#6a5be2', '#ffb27a')),
    rect(0, 0, 400, 140, 'url(#wt)'),
    circ(320, 34, 15, '#fff6d9'), circ(326, 31, 13, '#8b7ce6'),
    ...[[40, 20], [120, 12], [200, 26], [260, 10], [370, 18]].map(([x, y]) => circ(x, y, 1.6, '#fff')),
    ...[[0, 80, 40], [44, 62, 36], [84, 90, 44], [132, 70, 34], [170, 54, 40], [214, 84, 38], [256, 66, 42], [302, 92, 36], [342, 72, 58]].map(([x, y, w]) => rect(x, y, w, 140 - y, '#33306e')),
    ...[[8, 92], [20, 104], [52, 74], [60, 90], [96, 104], [140, 84], [178, 68], [186, 84], [222, 98], [264, 80], [276, 96], [352, 86], [372, 100]].map(([x, y]) => rect(x, y, 5, 6, '#ffd166', 1)),
  ],
  adults: () => [
    s('defs', null, grad('wa', '#cfeeea', '#fff1d6')),
    rect(0, 0, 400, 140, 'url(#wa)'),
    circ(70, 52, 22, '#ffc857'),
    s('path', { d: 'M0 92q90-40 190-6t210-18V140H0z', fill: '#9bd7c4' }),
    s('path', { d: 'M0 112q120-34 240-2t160-10V140H0z', fill: '#4fb59a' }),
    s('path', { d: 'M150 140q40-10 20-28t60-22 70-20', stroke: '#fff1d6', 'stroke-width': 10, fill: 'none', 'stroke-linecap': 'round' }),
    ...[[300, 66], [340, 74], [26, 86]].map(([x, y]) => s('g', null, rect(x - 2, y + 10, 4, 18, '#8a6a4a'), circ(x, y, 14, '#2f9477'))),
    s('g', { class: 'fly' }, s('path', { d: 'M200 40q6-8 12 0M214 36q6-8 12 0', stroke: '#2a6f63', 'stroke-width': 2, fill: 'none', 'stroke-linecap': 'round' })),
  ],
  seniors: () => [
    s('defs', null, grad('ws', '#ffd9a8', '#fff3de')),
    rect(0, 0, 400, 140, 'url(#ws)'),
    s('path', { d: 'M120 112a80 80 0 0 1 160 0z', fill: '#ffb347', class: 'rise' }),
    rect(0, 108, 400, 32, '#f3c88d'),
    ...Array.from({ length: 9 }, (_, i) => rect(14 + i * 46, 88, 8, 52, '#a7714b', 3)),
    rect(0, 84, 400, 8, '#8a5a38', 3),
    s('g', null, s('path', { d: 'M340 84h30l-4 22h-22z', fill: '#d9774b' }), s('path', { d: 'M355 84q-14-24 4-34q4 18-4 34zM355 84q16-20 2-38q-10 20-2 38z', fill: '#4fa070' })),
    s('g', { class: 'bob' }, circ(60, 54, 3, '#fff'), circ(74, 48, 2, '#fff')),
  ],
};

export function worldArt(trackId, cls = 'world-art') {
  return sv(cls, '0 0 400 140', ...(SCENES[trackId] ?? SCENES.adults)());
}

export const WORLD_NAME = { kids: 'the garden', teens: 'the city at dusk', adults: 'the winding path', seniors: 'the sunrise porch' };

/**
 * The signature moment: a 30 second guided breath. Orb grows for 4s, rests 1s, softens for 5s,
 * three times. A ring fills as time passes. Everything is local; nothing is sent anywhere.
 */
export function breatheSection() {
  const R = 142, C = 2 * Math.PI * R;
  const word = h('div', { class: 'orb-word' }, 'Ready?');
  const count = h('div', { class: 'orb-count', 'aria-hidden': 'true' }, '');
  const live = h('div', { class: 'sr-only', 'aria-live': 'polite' }, '');
  const prog = s('circle', { cx: 150, cy: 150, r: R, class: 'ring-prog', 'stroke-dasharray': C, fill: 'none' });
  prog.style.strokeDashoffset = String(C);
  const ring = s('svg', { viewBox: '0 0 300 300', class: 'ring', 'aria-hidden': 'true', focusable: 'false' },
    s('circle', { cx: 150, cy: 150, r: R, class: 'ring-track', fill: 'none' }),
    s('circle', { cx: 150, cy: 150, r: 128, class: 'ring-dots', fill: 'none' }),
    prog);
  const orb = h('div', { class: 'orb' }, h('span', { class: 'orb-glow' }), h('span', { class: 'orb-core' }), h('span', { class: 'orb-shine' }),
    h('div', { class: 'orb-text' }, word, count));
  const stage = h('div', { class: 'orb-stage', 'data-phase': 'idle' }, ring, orb,
    ...[1, 2, 3, 4, 5, 6].map((n) => h('i', { class: `mote m${n}` })));
  const btn = h('button', { class: 'btn big glow', type: 'button' }, 'Begin 30 seconds');
  let raf = 0;
  const finish = (msg, phase) => { cancelAnimationFrame(raf); raf = 0; stage.dataset.phase = phase; word.textContent = msg; count.textContent = ''; btn.textContent = phase === 'done' ? 'Breathe again' : 'Begin 30 seconds'; };
  btn.addEventListener('click', () => {
    if (raf) { finish('Ready?', 'idle'); prog.style.strokeDashoffset = String(C); return; }
    const t0 = performance.now();
    btn.textContent = 'Stop';
    let last = '';
    const frame = (now) => {
      if (!stage.isConnected) { finish('', 'idle'); return; }
      const t = (now - t0) / 1000;
      if (t >= 30) { prog.style.strokeDashoffset = '0'; finish('Well done', 'done'); live.textContent = 'Well done'; return; }
      prog.style.strokeDashoffset = String(C * (1 - t / 30));
      const c = t % 10;
      const phase = c < 4 ? 'in' : c < 5 ? 'hold' : 'out';
      const left = phase === 'in' ? 4 - c : phase === 'hold' ? 5 - c : 10 - c;
      if (phase !== last) {
        last = phase;
        stage.dataset.phase = phase;
        word.textContent = phase === 'in' ? 'Breathe in' : phase === 'hold' ? 'Hold gently' : 'Breathe out';
        live.textContent = word.textContent;
      }
      count.textContent = String(Math.ceil(left));
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  });
  return h('section', { class: 'breathe reveal' },
    h('div', { class: 'breathe-stars', 'aria-hidden': 'true' }),
    h('div', { class: 'breathe-copy' },
      h('span', { class: 'eyebrow light' }, 'A calm moment'),
      h('h2', null, 'Breathe together before you begin'),
      h('p', null, 'Follow the glow. In for four, a gentle rest, then a slow breath out. Thirty seconds is enough to settle a room.'),
      btn, live),
    stage);
}

const WEATHER = [
  ['sunny', 'Sunny', 'Bright and light. Lovely.'],
  ['partly', 'A bit cloudy', 'Some clouds are okay. We can look at them together.'],
  ['rainy', 'Rainy', 'Rainy days count too. You are in the right place.'],
  ['stormy', 'Stormy', 'Thank you for showing it. We will go gently.'],
  ['rainbow', 'Rainbow', 'Mixed and hopeful. That is real too.'],
];

function weatherGlyph(kind) {
  const cloud = (fill = '#c9d6e3') => s('path', { d: 'M18 40a9 9 0 0 1 1-18 12 12 0 0 1 23 3 8 8 0 0 1-1 15z', fill });
  const g = {
    sunny: [circ(32, 32, 11, '#ffb703'), ...[0, 45, 90, 135, 180, 225, 270, 315].map((a) => s('rect', { x: 30.5, y: 6, width: 3, height: 8, rx: 1.5, fill: '#ffb703', transform: `rotate(${a} 32 32)` }))],
    partly: [circ(24, 24, 9, '#ffb703'), cloud('#dbe6f1')],
    rainy: [cloud('#a9bcd0'), ...[[22, 46], [32, 50], [42, 46]].map(([x, y]) => s('path', { d: `M${x} ${y}l-3 8`, stroke: '#4f86e8', 'stroke-width': 3, 'stroke-linecap': 'round' }))],
    stormy: [cloud('#7d8fa6'), s('path', { d: 'M34 40l-7 10h6l-3 9 10-13h-6l3-6z', fill: '#ffc83d' })],
    rainbow: [...['#ff6b6b', '#ffb703', '#52c3a3', '#6fa8ff'].map((c, i) => s('path', { d: `M${8 + i * 5} 46a${24 - i * 5} ${24 - i * 5} 0 0 1 ${48 - i * 10} 0`, stroke: c, 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round' }))],
  }[kind];
  return s('svg', { viewBox: '0 0 64 64', class: 'wglyph', 'aria-hidden': 'true', focusable: 'false' }, ...g);
}

/**
 * Inner weather. Used before an activity (shared with the psychologist only, erased with the session)
 * and again at the end. Pass get/set/onPick to reuse it for another moment.
 */
export function weatherPicker(state, opts = {}) {
  const get = opts.get ?? (() => state.mood);
  const set = opts.set ?? ((v) => { state.mood = v; });
  const idle = 'Tap one. There is no wrong answer.';
  const reply = h('p', { class: 'weather-reply', 'aria-live': 'polite' }, get() ? WEATHER.find((w) => w[0] === get())?.[2] : idle);
  const buttons = WEATHER.map(([id, name, text]) => {
    const b = h('button', { class: 'weather', type: 'button', 'aria-pressed': String(get() === id), onClick: () => {
      set(get() === id ? null : id);
      for (const x of buttons) x.setAttribute('aria-pressed', String(x.dataset.id === get()));
      reply.textContent = get() ? text : idle;
      opts.onPick?.(get());
    } }, weatherGlyph(id), h('span', null, name));
    b.dataset.id = id;
    return b;
  });
  return h('section', { class: 'card' }, h('h2', null, opts.title ?? 'What is the weather like inside today?'),
    h('div', { class: 'weather-row', role: 'group', 'aria-label': 'Inner weather' }, buttons), reply,
    h('p', { class: 'small muted' }, opts.note ?? 'Only your psychologist sees this, and it is erased with the session.'));
}
