import { api } from './api.js';
import { h } from './ui.js';
import { s } from './icons.js';

export const ZONES = [['head', 'Head'], ['throat', 'Throat'], ['chest', 'Chest'], ['stomach', 'Stomach'], ['hands', 'Hands'], ['back', 'Back'], ['legs', 'Legs and feet']];
export const REFLECTIONS = [['calmer', 'I feel a bit calmer'], ['noticed', 'I noticed something new'], ['talk', 'I would like to talk about it'], ['hard', 'That was hard for me'], ['nothing', 'Nothing much']];

/** Tap where you feel it. Chips are the accessible control; the figure is a friendly mirror of them. */
export function bodyMap(initial, onChange) {
  const picked = new Set(initial);
  const shapes = {};
  const shape = (id, tag, attrs) => {
    const el = s(tag, { ...attrs, class: 'zone' });
    el.addEventListener('click', () => toggle(id));
    shapes[id] = el;
    return el;
  };
  const figure = s('svg', { viewBox: '0 0 120 250', class: 'bodymap', 'aria-hidden': 'true', focusable: 'false' },
    shape('head', 'circle', { cx: 60, cy: 24, r: 20 }),
    shape('throat', 'rect', { x: 52, y: 44, width: 16, height: 14, rx: 6 }),
    shape('chest', 'rect', { x: 34, y: 58, width: 52, height: 42, rx: 16 }),
    shape('stomach', 'rect', { x: 38, y: 100, width: 44, height: 40, rx: 16 }),
    shape('hands', 'ellipse', { cx: 18, cy: 120, rx: 10, ry: 14 }),
    shape('back', 'rect', { x: 92, y: 62, width: 14, height: 70, rx: 7 }),
    shape('legs', 'rect', { x: 40, y: 142, width: 40, height: 96, rx: 16 }));
  const hands2 = s('ellipse', { cx: 102, cy: 120, rx: 10, ry: 14, class: 'zone' });
  hands2.addEventListener('click', () => toggle('hands'));
  figure.append(hands2);
  const chips = ZONES.map(([id, label]) => {
    const b = h('button', { class: 'chipbtn', type: 'button', 'aria-pressed': 'false', onClick: () => toggle(id) }, label);
    b.dataset.id = id;
    return b;
  });
  function paint() {
    for (const b of chips) b.setAttribute('aria-pressed', String(picked.has(b.dataset.id)));
    for (const [id, el] of Object.entries(shapes)) el.classList.toggle('on', picked.has(id));
    hands2.classList.toggle('on', picked.has('hands'));
  }
  function toggle(id) {
    if (picked.has(id)) picked.delete(id); else picked.add(id);
    paint();
    onChange([...picked]);
  }
  paint();
  return h('section', { class: 'card' },
    h('h2', null, 'Where do you feel it in your body?'),
    h('p', { class: 'muted' }, 'Optional. Tap any place where you notice tension, worry or tiredness.'),
    h('div', { class: 'bodywrap' }, figure, h('div', { class: 'chipcol', role: 'group', 'aria-label': 'Body areas' }, chips)));
}

export function reflectionCards(initial, onPick) {
  let current = initial;
  const buttons = REFLECTIONS.map(([id, label]) => {
    const b = h('button', { class: 'choice', type: 'button', 'aria-pressed': String(current === id), onClick: () => {
      current = id;
      for (const x of buttons) x.setAttribute('aria-pressed', String(x.dataset.id === current));
      onPick(id);
    } }, label);
    b.dataset.id = id;
    return b;
  });
  return h('section', { class: 'card' }, h('h2', null, 'One thing I noticed'), h('p', { class: 'muted' }, 'Optional. Pick the one that fits best.'),
    h('div', { class: 'choices', role: 'group', 'aria-label': 'What I noticed' }, buttons));
}

/** A small plant that grows as questions are answered. No scores, just progress. */
export function seedling(stage) {
  const n = Math.max(0, Math.min(5, stage));
  const top = 66 - (10 + n * 8);
  const leaves = [[0, 'M30 58q-14-2-16-14q12 0 16 14z'], [1, 'M30 52q14-2 16-14q-12 0-16 14z'], [2, 'M30 44q-14-2-16-14q12 0 16 14z'], [3, 'M30 38q14-2 16-14q-12 0-16 14z']];
  return s('svg', { viewBox: '0 0 60 70', class: 'seedling', 'aria-hidden': 'true', focusable: 'false' },
    s('ellipse', { cx: 30, cy: 66, rx: 20, ry: 5, fill: '#b98b5e' }),
    s('path', { d: `M30 66V${top}`, stroke: '#3c9d6b', 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round' }),
    ...leaves.filter(([i]) => n > i).map(([, d]) => s('path', { d, fill: i2c(d) })),
    n >= 5 ? s('g', null, ...[[30, 8], [24, 12], [36, 12], [30, 16]].map(([x, y]) => s('circle', { cx: x, cy: y, r: 5, fill: '#ff8ab3' })), s('circle', { cx: 30, cy: 12, r: 4, fill: '#ffd166' })) : null,
    n < 5 && n > 0 ? s('circle', { cx: 30, cy: top, r: 3, fill: '#7ed6a5' }) : null);
}
const i2c = (d) => (d.includes('-14') ? '#52c3a3' : '#2fa584');

/** Full-screen calm pause with a slow breath and a grounding prompt. Nothing is saved or sent. */
export function openPause() {
  const prior = document.activeElement;
  const word = h('div', { class: 'pause-word', 'aria-live': 'polite' }, 'Breathe in');
  const orb = h('div', { class: 'pause-orb', 'aria-hidden': 'true' });
  let flip = true;
  const tick = setInterval(() => { flip = !flip; word.textContent = flip ? 'Breathe in' : 'Breathe out'; }, 4000);
  const close = () => { clearInterval(tick); overlay.remove(); document.removeEventListener('keydown', onKey); prior?.focus?.(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const back = h('button', { class: 'btn big', type: 'button', onClick: close }, 'I am ready to continue');
  const overlay = h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Take a pause' },
    h('div', { class: 'overlay-card' },
      h('h2', null, 'Take a pause'),
      h('p', { class: 'muted' }, 'There is no hurry. Your answers so far are kept.'),
      orb, word,
      h('p', null, 'Look around and name three things you can see, and two things you can hear.'),
      back,
      h('p', { class: 'small' }, h('a', { href: '#/help' }, 'I need help now'), ' (your answers stay saved)')));
  document.body.append(overlay);
  document.addEventListener('keydown', onKey);
  back.focus();
}

/** Read the question aloud with the device's own voice. Hidden when the browser has none. */
export function readAloud(getText) {
  if (!('speechSynthesis' in window)) return null;
  return h('button', { class: 'btn ghost small', type: 'button', 'aria-label': 'Read this question aloud', onClick: () => {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(getText());
    u.lang = 'en';
    u.rate = 0.9;
    window.speechSynthesis.speak(u);
  } }, 'Read aloud');
}

/** One-tap feedback for psychologists. Sends only a rating, optional text and the screen name. */
export function openFeedback(page) {
  const prior = document.activeElement;
  let rating = 0;
  const note = h('textarea', { id: 'fb-text', rows: 4, maxlength: 1000, 'aria-label': 'Your comments (optional)' });
  const status = h('p', { class: 'small muted', 'aria-live': 'polite' }, 'Please do not include any patient details.');
  const send = h('button', { class: 'btn', type: 'button', disabled: true, onClick: async () => {
    send.disabled = true;
    try { await api.feedback({ rating, text: note.value.trim(), page }); status.textContent = 'Thank you. This helps us improve Sukoon.'; setTimeout(close, 1200); }
    catch (e) { status.textContent = e.message; send.disabled = false; }
  } }, 'Send feedback');
  const stars = [1, 2, 3, 4, 5].map((n) => h('button', { class: 'chipbtn', type: 'button', 'aria-pressed': 'false', onClick: () => {
    rating = n; send.disabled = false;
    stars.forEach((b, i) => b.setAttribute('aria-pressed', String(i + 1 === n)));
  } }, ['Poor', 'Fair', 'Good', 'Very good', 'Great'][n - 1]));
  const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey); prior?.focus?.(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const overlay = h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Send feedback' },
    h('div', { class: 'overlay-card left' },
      h('h2', null, 'How is Sukoon working for you?'),
      h('div', { class: 'row', role: 'group', 'aria-label': 'Rating' }, stars),
      h('div', { class: 'field', style: { marginTop: '12px' } }, h('label', { for: 'fb-text' }, 'Anything we should know? (optional)'), note),
      status,
      h('div', { class: 'row' }, send, h('button', { class: 'btn ghost', type: 'button', onClick: close }, 'Close'))));
  document.body.append(overlay);
  document.addEventListener('keydown', onKey);
  stars[0].focus();
}

/** The take-home card, laid out for paper. Hidden on screen, shown in print. */
export function homeworkSheet(cards, session) {
  return h('section', { class: 'homework-sheet print-only' },
    h('h1', null, 'Take-home practice'),
    h('p', { class: 'small' }, session.alias ? `For: ${session.alias} · ` : '', `Session ${session.code} · ${new Date(session.completedAt).toLocaleDateString()}`),
    cards.map((c) => h('div', { class: 'hw-card' },
      h('h2', null, c.title, h('span', { class: 'small' }, `  about ${c.minutes} min`)),
      h('p', { class: 'why' }, c.why),
      h('ol', null, c.steps.map((st) => h('li', null, st))),
      c.tip ? h('p', { class: 'small' }, `Tip: ${c.tip}`) : null)),
    h('p', { class: 'small' }, 'Practise a little each day. If anything feels too hard, stop and talk to your psychologist. If you feel unsafe, contact emergency services or a trusted adult right away.'));
}
