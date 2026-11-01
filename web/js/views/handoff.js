import { api } from '../api.js';
import { state } from '../state.js';
import { errorBox, h, mount, pageTitle } from '../ui.js';
import { celebrate } from '../icons.js';
import { bodyMap, reflectionCards } from '../extras.js';
import { weatherPicker } from '../worlds.js';

/** Shown to the client after finishing: a few optional taps, then the clinician continues (with a PIN if one was set). */
export function handoffView(root, sessionId) {
  pageTitle('All done');
  const pin = state.locks.get(sessionId);
  if (pin && state.unlocked.has(sessionId)) { location.hash = `#/results/${sessionId}`; return; }
  const open = () => { state.unlocked.add(sessionId); location.hash = `#/results/${sessionId}`; };
  // Small optional saves. If one fails the activity is still complete, so stay quiet.
  const put = (body) => api.extras(sessionId, body).catch(() => null);

  const q = state.queue;
  const position = q ? q.sessionIds.indexOf(sessionId) : -1;
  const hasNext = Boolean(q) && position >= 0 && position === q.index && q.index < q.packIds.length - 1;
  const slot = h('div');

  let control;
  if (hasNext) {
    const next = h('button', { class: 'btn big', type: 'button', onClick: async () => {
      next.disabled = true;
      slot.replaceChildren();
      try {
        const session = await api.createSession(q.packIds[q.index + 1], q.alias);
        await api.extras(session.id, { consent: true }).catch(() => null);
        if (q.pin) state.locks.set(session.id, q.pin);
        q.index += 1;
        q.sessionIds.push(session.id);
        location.hash = `#/run/${session.id}`;
      } catch (err) { slot.append(errorBox(err.message)); next.disabled = false; }
    } }, `Next activity (${q.index + 2} of ${q.packIds.length})`);
    control = h('div', { class: 'stack' }, next, slot);
  } else if (pin) {
    const input = h('input', { type: 'text', class: 'pin', id: 'x', inputmode: 'numeric', maxlength: 4, autocomplete: 'off', 'aria-label': 'Return PIN' });
    const msg = h('p', { class: 'error', role: 'alert', hidden: true }, 'That PIN does not match.');
    const go = () => { if (input.value === pin) open(); else { msg.hidden = false; input.select(); } };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    control = h('div', { class: 'noprint stack' }, h('label', { for: 'x' }, 'Clinician: enter your return PIN'), input, msg, h('button', { class: 'btn', onClick: go }, 'Open results'));
  } else {
    control = h('div', { class: 'noprint' }, h('button', { class: 'btn', onClick: open }, 'Clinician: view summary'));
  }

  let endMood = null;
  mount(root, h('div', { class: 'patient stack' },
    h('div', { class: 'card center stack' },
      celebrate(),
      h('h1', null, hasNext ? 'Well done, that one is finished!' : 'Thank you, all done!'),
      h('p', null, hasNext ? 'Your answers have been saved. There is one more activity in this set.' : 'Your answers have been saved. If you like, tap a few optional things below, then hand this device back to your psychologist.')),
    reflectionCards(null, (id) => put({ reflection: id })),
    bodyMap([], (zones) => put({ bodyMap: zones })),
    weatherPicker(state, { get: () => endMood, set: (v) => { endMood = v; }, title: 'And how is the weather inside now?', onPick: (v) => { if (v) put({ moodEnd: v }); } }),
    h('div', { class: 'card center stack' }, control)));
}
