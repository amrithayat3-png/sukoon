import { api, keyStore } from '../api.js';
import { h, mount, errorBox, pageTitle } from '../ui.js';
import { logo } from '../icons.js';

/** Only used when the server is configured to require an access key. */
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
    h('div', { class: 'row' }, logo(44), h('h2', { style: { margin: 0 } }, 'Welcome to Sukoon')),
    h('div', { class: 'field' },
      h('label', { for: 'key' }, 'Access key'),
      input,
      h('p', { class: 'hint', id: 'key-hint' }, 'Your key was issued to you by the Sukoon team.')),
    slot, submit);
  mount(root, h('div', { style: { maxWidth: '480px', margin: '32px auto' } }, form));
}
