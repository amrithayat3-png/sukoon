/** Inline SVG illustrations, built with the DOM so nothing is parsed from strings. */
const NS = 'http://www.w3.org/2000/svg';
let uid = 0;

export function s(tag, attrs, ...kids) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, String(v));
  for (const kid of kids.flat()) if (kid) el.append(kid);
  return el;
}

function svg(viewBox, cls, ...kids) {
  return s('svg', { viewBox, class: cls, 'aria-hidden': 'true', focusable: 'false' }, ...kids);
}

function gradient(id, c1, c2, vertical = true) {
  return s('linearGradient', { id, x1: 0, y1: 0, x2: vertical ? 0 : 1, y2: vertical ? 1 : 1 },
    s('stop', { offset: '0', 'stop-color': c1 }), s('stop', { offset: '1', 'stop-color': c2 }));
}

/** The Sukoon mark: a rising sun held by a leaf. */
export function logo(size = 34) {
  const g = `lg${uid++}`;
  const rays = [0, 45, 90, 135, 180, 225, 270, 315].map((a) =>
    s('rect', { x: 29, y: 2, width: 6, height: 11, rx: 3, fill: '#ffb703', transform: `rotate(${a} 32 32)` }));
  const el = svg('0 0 64 64', 'logo',
    s('defs', null, gradient(g, '#ffd166', '#ff8a5b')),
    ...rays,
    s('circle', { cx: 32, cy: 32, r: 15, fill: `url(#${g})` }),
    s('path', { d: 'M18 46c8-1 14-6 16-14 6 2 10 8 8 15-8 5-18 4-24-1z', fill: '#0f8b8d' }),
    s('path', { d: 'M22 45c6-3 11-7 15-12', stroke: '#e9fffb', 'stroke-width': 2, fill: 'none', 'stroke-linecap': 'round' }));
  el.setAttribute('width', size); el.setAttribute('height', size);
  return el;
}

/** Large welcome illustration: sunrise over layered hills with clouds, birds and leaves. */
export function heroArt() {
  const sky = `sk${uid++}`, sun = `sn${uid++}`, clip = `cp${uid++}`;
  const rays = Array.from({ length: 12 }, (_, i) =>
    s('rect', { x: 296, y: 38, width: 8, height: 22, rx: 4, fill: '#ffd166', opacity: 0.8, transform: `rotate(${i * 30} 300 120)` }));
  return svg('0 0 600 460', 'hero-art',
    s('defs', null, gradient(sky, '#fff1d6', '#ffe0e6'), gradient(sun, '#ffe08a', '#ff9a62'),
      s('clipPath', { id: clip }, s('rect', { x: 20, y: 20, width: 560, height: 420, rx: 44 }))),
    s('rect', { x: 20, y: 20, width: 560, height: 420, rx: 44, fill: `url(#${sky})` }),
    s('g', { 'clip-path': `url(#${clip})` },
    s('g', { class: 'spin' }, ...rays),
    s('circle', { cx: 300, cy: 120, r: 52, fill: `url(#${sun})` }),
    s('g', { class: 'drift' },
      s('path', { d: 'M80 150c0-18 14-30 32-30 6-14 26-20 40-8 18-2 32 12 30 28z', fill: '#fff', opacity: 0.95 })),
    s('g', { class: 'drift2' },
      s('path', { d: 'M420 190c0-14 12-24 26-24 6-12 22-16 34-6 14 0 24 10 24 22z', fill: '#fff', opacity: 0.9 })),
    s('path', { d: 'M20 330c60-50 130-60 200-30s140 50 200 10 120-30 160 10v110H20z', fill: '#9be0c0' }),
    s('path', { d: 'M20 370c80-40 150-30 230 0s150 40 330-20v90H20z', fill: '#52c3a3' }),
    s('path', { d: 'M20 410c100-30 200-10 300 0s190 10 260-20v50H20z', fill: '#0f8b8d' }),
    s('g', { class: 'sway' },
      s('path', { d: 'M110 400v-70', stroke: '#0b6e70', 'stroke-width': 5, 'stroke-linecap': 'round' }),
      s('path', { d: 'M110 350c-26-4-34-24-30-40 22 0 36 14 30 40z', fill: '#7ae0b8' }),
      s('path', { d: 'M110 335c24-6 32-24 28-38-22 0-34 14-28 38z', fill: '#ffd166' })),
    s('g', { class: 'sway2' },
      s('path', { d: 'M480 405v-80', stroke: '#0b6e70', 'stroke-width': 5, 'stroke-linecap': 'round' }),
      s('circle', { cx: 480, cy: 312, r: 18, fill: '#ff8a8a' }),
      s('circle', { cx: 480, cy: 312, r: 8, fill: '#ffe08a' }),
      s('path', { d: 'M480 370c-22 0-30-16-28-30 20 0 32 12 28 30z', fill: '#7ae0b8' })),
    s('g', { class: 'fly', fill: 'none', stroke: '#6b5bd6', 'stroke-width': 4, 'stroke-linecap': 'round' },
      s('path', { d: 'M180 200c10-12 20-12 28 0 8-12 18-12 28 0' }),
      s('path', { d: 'M236 240c8-10 16-10 22 0 6-10 14-10 22 0' })),
    s('circle', { cx: 70, cy: 80, r: 7, fill: '#ff8a8a', class: 'bob' }),
    s('circle', { cx: 540, cy: 90, r: 9, fill: '#8e7dff', class: 'bob2' }),
    s('circle', { cx: 520, cy: 250, r: 6, fill: '#ffb703', class: 'bob' })));
}

const ICONS = {
  kids: () => [s('ellipse', { cx: 24, cy: 20, rx: 11, ry: 13, fill: '#ff6b6b' }), s('path', { d: 'M24 33c-1 5 2 7 0 11', stroke: '#8a6a4a', 'stroke-width': 2, fill: 'none', 'stroke-linecap': 'round' }), s('path', { d: 'M19 14c1-3 3-4 5-4', stroke: '#fff', 'stroke-width': 2.5, fill: 'none', 'stroke-linecap': 'round' })],
  teens: () => [s('path', { d: 'M8 12h22a4 4 0 014 4v10a4 4 0 01-4 4H18l-6 5v-5H8a4 4 0 01-4-4V16a4 4 0 014-4z', fill: '#8e7dff' }), s('path', { d: 'M24 24h16a4 4 0 014 4v8a4 4 0 01-4 4h-2v4l-5-4H24a4 4 0 01-4-4v-8a4 4 0 014-4z', fill: '#ffb703' })],
  adults: () => [s('path', { d: 'M24 41C8 30 6 20 12 14c5-4 10-2 12 3 2-5 7-7 12-3 6 6 4 16-12 27z', fill: '#ff6b6b' }), s('path', { d: 'M38 6v8M34 10h8', stroke: '#ffb703', 'stroke-width': 3, 'stroke-linecap': 'round' })],
  seniors: () => [s('rect', { x: 21, y: 28, width: 6, height: 14, rx: 2, fill: '#a9744f' }), s('circle', { cx: 24, cy: 20, r: 12, fill: '#52c3a3' }), s('circle', { cx: 16, cy: 26, r: 8, fill: '#7ae0b8' }), s('circle', { cx: 33, cy: 25, r: 8, fill: '#3fae8f' })],
  work: () => [s('rect', { x: 6, y: 16, width: 32, height: 20, rx: 5, fill: 'none', stroke: '#0f8b8d', 'stroke-width': 4 }), s('rect', { x: 38, y: 22, width: 4, height: 8, rx: 2, fill: '#0f8b8d' }), s('rect', { x: 10, y: 20, width: 7, height: 12, rx: 2, fill: '#ff6b6b' })],
  sleep: () => [s('path', { d: 'M30 8a16 16 0 1012 24A13 13 0 0130 8z', fill: '#8e7dff' }), s('path', { d: 'M10 12l2 4 4 1-4 1-2 4-1-4-4-1 4-1zM38 36l1 3 3 1-3 1-1 3-1-3-3-1 3-1z', fill: '#ffb703' })],
  relationships: () => [s('circle', { cx: 18, cy: 24, r: 12, fill: '#ff8a8a', opacity: 0.9 }), s('circle', { cx: 30, cy: 24, r: 12, fill: '#8e7dff', opacity: 0.8 })],
  mood: () => [s('path', { d: 'M12 34a8 8 0 010-16 11 11 0 0121-2 9 9 0 013 18z', fill: '#9aa8d8' }), s('circle', { cx: 36, cy: 12, r: 7, fill: '#ffd166' })],
  anger: () => [s('path', { d: 'M24 5c3 8 11 11 11 22a11 11 0 01-22 0c0-6 3-8 5-12 2 3 3 4 4 5 1-5 0-9 2-15z', fill: '#ff6b6b' }), s('path', { d: 'M24 24c2 4 5 5 5 9a5 5 0 01-10 0c0-3 3-5 5-9z', fill: '#ffd166' })],
  lonely: () => [s('path', { d: 'M8 24L24 10l16 14v16H8z', fill: '#52c3a3' }), s('rect', { x: 19, y: 28, width: 10, height: 12, rx: 2, fill: '#ffd166' })],
  men: () => [s('circle', { cx: 24, cy: 24, r: 17, fill: 'none', stroke: '#0f8b8d', 'stroke-width': 4 }), s('path', { d: 'M24 11l5 13-5 13-5-13z', fill: '#ff6b6b' })],
  women: () => [s('g', null, ...[0, 72, 144, 216, 288].map((a) => s('ellipse', { cx: 24, cy: 12, rx: 6, ry: 9, fill: '#ff8ab3', transform: `rotate(${a} 24 24)` })), s('circle', { cx: 24, cy: 24, r: 6, fill: '#ffd166' }))],
  stress: () => [s('path', { d: 'M4 28c6-10 10-10 14 0s8 10 14 0 8-8 12-2', stroke: '#0f8b8d', 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round' }), s('path', { d: 'M4 38c6-10 10-10 14 0s8 10 14 0 8-8 12-2', stroke: '#7ae0b8', 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round' })],
  everyday: () => [s('path', { d: 'M24 44V8', stroke: '#a9744f', 'stroke-width': 4, 'stroke-linecap': 'round' }), s('path', { d: 'M24 10h14l4 5-4 5H24z', fill: '#ffb703' }), s('path', { d: 'M24 24H10l-4 5 4 5h14z', fill: '#8e7dff' })],
  spark: () => [s('path', { d: 'M24 6l5 13 13 5-13 5-5 13-5-13-13-5 13-5z', fill: '#ffb703' })],
};

const PACK_ICON = {
  'adults-work-burnout': ['work', 'teal'], 'adults-sleep-rhythm': ['sleep', 'lavender'],
  'adults-relationships': ['relationships', 'coral'], 'adults-low-mood': ['mood', 'sky'],
  'adults-anger': ['anger', 'coral'], 'adults-loneliness': ['lonely', 'mint'],
  'adults-men-pressure': ['men', 'teal'], 'adults-women-load': ['women', 'pink'],
  'adults-stress-wellbeing': ['stress', 'mint'], 'adults-everyday-situations': ['everyday', 'sun'],
  'teens-pressure-and-peers': ['teens', 'lavender'],
};
const TRACK_ICON = { kids: ['kids', 'coral'], teens: ['teens', 'lavender'], adults: ['adults', 'teal'], seniors: ['seniors', 'sun'] };

function bubble(name, tone, big) {
  const draw = ICONS[name] ?? ICONS.spark;
  const icon = svg('0 0 48 48', 'glyph', ...draw());
  const wrap = document.createElement('span');
  wrap.className = `icon-bubble tone-${tone}${big ? ' big' : ''}`;
  wrap.append(icon);
  return wrap;
}

export function packIcon(packId, big = false) {
  const [name, tone] = PACK_ICON[packId] ?? ['spark', 'teal'];
  return bubble(name, tone, big);
}
export function packTone(packId) { return (PACK_ICON[packId] ?? [0, 'teal'])[1]; }
export function trackIcon(trackId, big = false) {
  const [name, tone] = TRACK_ICON[trackId] ?? ['spark', 'teal'];
  return bubble(name, tone, big);
}
export function trackTone(trackId) { return (TRACK_ICON[trackId] ?? [0, 'teal'])[1]; }
export function stepIcon(name, tone) { return bubble(name, tone, false); }

/** Small celebration drawing for the thank-you screen. */
export function celebrate() {
  const bits = [['#ff6b6b', 40, 30], ['#ffb703', 160, 20], ['#8e7dff', 100, 12], ['#52c3a3', 20, 80], ['#ff8ab3', 180, 90]]
    .map(([c, x, y], i) => s('circle', { cx: x, cy: y, r: 6, fill: c, class: i % 2 ? 'bob' : 'bob2' }));
  return svg('0 0 200 160', 'celebrate',
    ...bits,
    s('circle', { cx: 100, cy: 90, r: 46, fill: '#ffd166' }),
    s('circle', { cx: 84, cy: 82, r: 5, fill: '#23313a' }), s('circle', { cx: 116, cy: 82, r: 5, fill: '#23313a' }),
    s('path', { d: 'M80 100c8 14 32 14 40 0', stroke: '#23313a', 'stroke-width': 5, fill: 'none', 'stroke-linecap': 'round' }),
    s('circle', { cx: 74, cy: 98, r: 7, fill: '#ff9a8a', opacity: 0.6 }), s('circle', { cx: 126, cy: 98, r: 7, fill: '#ff9a8a', opacity: 0.6 }));
}
