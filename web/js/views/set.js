import { api } from '../api.js';
import { state } from '../state.js';
import { consentBlock } from '../legal.js';
import { errorBox, h, link, mount, pageTitle } from '../ui.js';

const MAX = 4;

/** Build a custom set of up to four activities for one person. They run one after another. */
export async function setView(root) {
  pageTitle('Build a set');
  try {
    const { tracks } = await api.tracks();
    const lists = await Promise.all(tracks.map((t) => api.packs(t.id).then((r) => ({ track: t, packs: r.packs }))));
    const picked = [];
    const count = h('p', { class: 'muted', 'aria-live': 'polite' }, `Pick 2 to ${MAX} activities, in the order you want them.`);
    const orderList = h('ol', { class: 'setorder' });
    const slot = h('div');
    const start = h('button', { class: 'btn big', type: 'button', disabled: true }, 'Start the set');
    let consented = false;
    const consent = consentBlock((ok) => { consented = ok; refresh(); });
    const alias = h('input', { type: 'text', id: 'set-alias', maxlength: 40, autocomplete: 'off' });
    const pin = h('input', { type: 'text', id: 'set-pin', inputmode: 'numeric', maxlength: 4, autocomplete: 'off' });
    const titles = new Map(lists.flatMap((l) => l.packs.map((p) => [p.id, p.title])));
    const boxes = new Map();

    function refresh() {
      orderList.replaceChildren(...picked.map((id, i) => h('li', null, titles.get(id), ' ',
        h('button', { class: 'btn ghost small', type: 'button', 'aria-label': `Move ${titles.get(id)} up`, disabled: i === 0, onClick: () => { picked.splice(i - 1, 0, picked.splice(i, 1)[0]); refresh(); } }, 'Up'))));
      for (const [id, box] of boxes) box.disabled = !picked.includes(id) && picked.length >= MAX;
      count.textContent = picked.length ? `${picked.length} chosen. Total about ${picked.length * 5} minutes.` : `Pick 2 to ${MAX} activities, in the order you want them.`;
      start.disabled = picked.length < 2 || !consented;
    }

    start.addEventListener('click', async () => {
      const code = pin.value.trim();
      if (code && !/^\d{4}$/.test(code)) { slot.replaceChildren(errorBox('The return PIN must be exactly 4 digits.')); return; }
      start.disabled = true;
      slot.replaceChildren();
      try {
        const first = await api.createSession(picked[0], alias.value.trim() || undefined);
        await api.extras(first.id, { consent: true, ...(state.mood ? { moodStart: state.mood } : {}) }).catch(() => null);
        if (code) state.locks.set(first.id, code);
        state.queue = { packIds: [...picked], index: 0, alias: alias.value.trim() || undefined, sessionIds: [first.id], pin: code || undefined };
        location.hash = `#/run/${first.id}`;
      } catch (err) { slot.replaceChildren(errorBox(err.message)); start.disabled = false; }
    });

    mount(root,
      h('div', { class: 'crumbs' }, link('#/', 'Home'), ' / Build a set'),
      h('h1', null, 'Build a custom set'),
      h('p', { class: 'lead muted' }, 'Choose a short run of activities for one person. After each one the screen offers the next, and every result is kept in the summary.'),
      count,
      lists.filter((l) => l.packs.length).map(({ track, packs }) => h('section', { class: 'card' },
        h('h2', null, track.label),
        h('div', { class: 'stack' }, packs.map((p) => {
          const box = h('input', { type: 'checkbox', id: `set-${p.id}`, onChange: () => {
            if (box.checked) picked.push(p.id); else picked.splice(picked.indexOf(p.id), 1);
            refresh();
          } });
          boxes.set(p.id, box);
          return h('label', { class: 'check', for: `set-${p.id}` }, box, h('span', null, h('strong', null, p.title), ' ', h('span', { class: 'chip' }, `About ${p.estimatedMinutes} min`), h('br'), h('span', { class: 'small muted' }, p.summary)));
        })))),
      h('section', { class: 'card' }, h('h2', null, 'Your order'), orderList),
      h('section', { class: 'card stack' },
        h('div', { class: 'field' }, h('label', { for: 'set-alias' }, 'Label for this set (optional)'), alias, h('p', { class: 'hint' }, 'Initials or a nickname only.')),
        h('div', { class: 'field' }, h('label', { for: 'set-pin' }, 'Return PIN (optional)'), pin)),
      consent.node, slot, h('div', null, start));
    refresh();
  } catch (err) { mount(root, errorBox(err.message)); }
}
