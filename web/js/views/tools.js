import { h, link, mount, pageTitle } from '../ui.js';
import { breatheSection } from '../worlds.js';

const SENSES = [[5, 'things you can see'], [4, 'things you can touch or feel'], [3, 'things you can hear'], [2, 'things you can smell'], [1, 'thing you can taste']];

function fiveSenses() {
  const box = h('div', { class: 'card stack', 'aria-live': 'polite' });
  let step = 0;
  let found = 0;
  const draw = () => {
    if (step >= SENSES.length) {
      box.replaceChildren(h('h2', null, 'Five senses'), h('p', null, 'Well done. Take one slow breath and look around the room once more.'),
        h('button', { class: 'btn ghost', type: 'button', onClick: () => { step = 0; found = 0; draw(); } }, 'Start again'));
      return;
    }
    const [n, label] = SENSES[step];
    box.replaceChildren(
      h('h2', null, 'Five senses'),
      h('p', { class: 'muted' }, 'Bring your attention back to the room. Tap each time you find one.'),
      h('p', { class: 'big-prompt' }, `Find ${n} ${label}`),
      h('div', { class: 'dots big', 'aria-hidden': 'true' }, Array.from({ length: n }, (_, i) => h('i', { class: i < found ? 'on' : '' }))),
      h('button', { class: 'btn big', type: 'button', onClick: () => { found += 1; if (found >= n) { step += 1; found = 0; } draw(); } }, found + 1 >= n ? 'Found the last one' : 'I found one'));
  };
  draw();
  return box;
}

function thoughtCheck() {
  const fields = ['What thought is on your mind?', 'What supports it, and what does not?', 'How would you say it to a good friend?'].map((label, i) => {
    const area = h('textarea', { id: `tc${i}`, rows: 3, maxlength: 400, autocomplete: 'off' });
    return { area, node: h('div', { class: 'field' }, h('label', { for: `tc${i}` }, label), area) };
  });
  return h('section', { class: 'card stack' }, h('h2', null, 'Thought check'),
    h('p', { class: 'muted' }, 'Write for yourself. Nothing here is saved or sent anywhere, and it disappears when you leave this page.'),
    fields.map((f) => f.node),
    h('button', { class: 'btn ghost', type: 'button', onClick: () => fields.forEach((f) => { f.area.value = ''; }) }, 'Clear everything'));
}

function worryBox() {
  const list = h('ul', { class: 'parked' });
  const input = h('input', { type: 'text', id: 'worry', maxlength: 120, autocomplete: 'off', 'aria-label': 'A worry to set aside' });
  const park = () => {
    const text = input.value.trim();
    if (!text) return;
    list.append(h('li', null, text));
    input.value = '';
    input.focus();
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); park(); } });
  return h('section', { class: 'card stack' }, h('h2', null, 'Worry parking'),
    h('p', { class: 'muted' }, 'Set a worry aside for now. You can come back to it at a time you choose. Nothing is saved.'),
    h('div', { class: 'row' }, input, h('button', { class: 'btn', type: 'button', onClick: park }, 'Park it')),
    list,
    h('button', { class: 'btn ghost', type: 'button', onClick: () => list.replaceChildren() }, 'Let them go for today'));
}

export function toolsView(root) {
  pageTitle('Calming tools');
  mount(root,
    h('div', { class: 'crumbs' }, link('#/', 'Home'), ' / Calming tools'),
    h('h1', null, 'Calming tools'),
    h('p', { class: 'lead muted' }, 'Small practices to use any time. They are not a treatment, and nothing you type is stored.'),
    breatheSection(),
    h('div', { class: 'stack' }, fiveSenses(), thoughtCheck(), worryBox()),
    h('p', { class: 'small muted' }, 'If you feel unsafe, please open ', link('#/help', 'Help now'), '.'));
}
