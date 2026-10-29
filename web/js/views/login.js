import { api, keyStore } from '../api.js';
import { state } from '../state.js';
import { h, mount, errorBox, pageTitle } from '../ui.js';
import { logo } from '../icons.js';

const field = (id, label, attrs, hint) => h('div', { class: 'field' }, h('label', { for: id }, label), h('input', { id, required: true, ...attrs }), hint ? h('p', { class: 'hint' }, hint) : null);

/** Sign in. With accounts on, psychologists use email and password, or join an institute with an invite code. */
export function loginView(root) {
  pageTitle('Sign in');
  if (state.saas) { accountForm(root, false); return; }
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

function accountForm(root, creating) {
  const slot = h('div');
  const name = creating ? field('name', 'Your name', { type: 'text', autocomplete: 'name', maxlength: 80 }) : null;
  const code = creating ? field('code', 'Invite code', { type: 'text', autocomplete: 'off', maxlength: 20 }, 'Given to your institute by Sukoon.') : null;
  const email = field('email', 'Email', { type: 'email', autocomplete: 'email', maxlength: 120 });
  const pw = field('pw', 'Password', { type: 'password', autocomplete: creating ? 'new-password' : 'current-password', minlength: creating ? 8 : 1, maxlength: 100 }, creating ? 'At least 8 characters.' : null);
  const val = (f) => f.querySelector('input').value;
  const submit = h('button', { class: 'btn big', type: 'submit' }, creating ? 'Create my account' : 'Sign in');
  const form = h('form', { class: 'card stack', onSubmit: async (e) => {
    e.preventDefault();
    slot.replaceChildren();
    submit.disabled = true;
    try {
      const res = creating
        ? await api.signup({ inviteCode: val(code), name: val(name), email: val(email), password: val(pw) })
        : await api.login({ email: val(email), password: val(pw) });
      keyStore.set(res.token);
      location.hash = '#/';
    } catch (err) { slot.append(errorBox(err.message)); submit.disabled = false; }
  } },
    h('div', { class: 'row' }, logo(44), h('h2', { style: { margin: 0 } }, creating ? 'Join your institute' : 'Welcome back')),
    name, code, email, pw, slot, submit,
    h('button', { class: 'btn ghost', type: 'button', onClick: () => accountForm(root, !creating) }, creating ? 'I already have an account' : 'I have an invite code'));
  mount(root, h('div', { style: { maxWidth: '480px', margin: '32px auto' } }, form));
}
