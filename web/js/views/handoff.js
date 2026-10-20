import { state } from '../state.js';
import { h, mount, pageTitle } from '../ui.js';
import { celebrate } from '../icons.js';

/** Shown to the client after finishing. The clinician continues, with a PIN if one was set. */
export function handoffView(root, sessionId) {
  pageTitle('All done');
  const pin = state.locks.get(sessionId);
  if (pin && state.unlocked.has(sessionId)) { location.hash = `#/results/${sessionId}`; return; }
  const open = () => { state.unlocked.add(sessionId); location.hash = `#/results/${sessionId}`; };
  let control;
  if (pin) {
    const input = h('input', { type: 'text', class: 'pin', id: 'x', inputmode: 'numeric', maxlength: 4, autocomplete: 'off', 'aria-label': 'Return PIN' });
    const msg = h('p', { class: 'error', role: 'alert', hidden: true }, 'That PIN does not match.');
    const go = () => { if (input.value === pin) open(); else { msg.hidden = false; input.select(); } };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
    control = h('div', { class: 'noprint stack' }, h('label', { for: 'x' }, 'Clinician: enter your return PIN'), input, msg, h('button', { class: 'btn', onClick: go }, 'Open results'));
  } else {
    control = h('div', { class: 'noprint' }, h('button', { class: 'btn', onClick: open }, 'Clinician: view summary'));
  }
  mount(root, h('div', { class: 'patient card center stack' },
    celebrate(),
    h('h1', null, 'Thank you, all done!'),
    h('p', null, 'Your answers have been saved. Please hand this device back to your psychologist.'),
    control));
}
