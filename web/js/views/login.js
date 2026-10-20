import { api, keyStore } from '../api.js';
import { h, mount, errorBox, pageTitle } from '../ui.js';

export function loginView(root) {
  pageTitle('Sign in');
  const input = h('input', { type: 'password', id: 'key', autocomplete: 'off', required: true, 'aria-describedby': 'key-hint' });
  const slot = h('div');
  const submit = h('button', { class: 'btn', type: 'submit' }, 'Continue');
  const form = h('form', { class: 'card stack', onSubmit: async (e) => {
    e.preventDefault();
    slot.replaceChildren();
    submit.disabled = true;
    try {
      await api.verify(input.value.trim());
      keyStore.set(input.value.trim());
      location.hash = '#/';
    } catch (err) {
      slot.append(errorBox(err.status === 401 ? 'That access key was not recognised.' : err.message));
    } finally { submit.disabled = false; }
  } },
    h('div', { class: 'field' },
      h('label', { for: 'key' }, 'Clinician access key'),
      input,
      h('p', { class: 'hint', id: 'key-hint' }, 'Your key was issued to you by the Sukoon team. It stays in this browser tab only.')),
    slot, submit);
  mount(root,
    h('div', { class: 'hero' },
      h('h1', null, 'A calm companion for your sessions'),
      h('p', null, 'Interactive check-ins and scenario activities that help a conversation start. Designed for use alongside a licensed psychologist.')),
    h('div', { style: { maxWidth: '480px' } }, form));
}
