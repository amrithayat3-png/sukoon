import { api } from '../api.js';
import { errorBox, h, link, mount, pageTitle } from '../ui.js';

export function accountView(root) {
  pageTitle('My account');
  const slot = h('div');
  const current = h('input', { type: 'password', id: 'pw0', autocomplete: 'current-password', required: true });
  const next = h('input', { type: 'password', id: 'pw1', autocomplete: 'new-password', minlength: 8, required: true });
  mount(root,
    h('div', { class: 'crumbs' }, link('#/', 'Home'), ' / My account'),
    h('h1', null, 'My account'),
    h('form', { class: 'card stack', style: { maxWidth: '480px' }, onSubmit: async (e) => {
      e.preventDefault();
      slot.replaceChildren();
      try {
        await api.changePassword({ current: current.value, next: next.value });
        current.value = ''; next.value = '';
        slot.append(h('p', { class: 'notice', role: 'status' }, 'Your password has been changed.'));
      } catch (err) { slot.append(errorBox(err.message)); }
    } },
      h('h2', { style: { margin: 0 } }, 'Change password'),
      h('div', { class: 'field' }, h('label', { for: 'pw0' }, 'Current password'), current),
      h('div', { class: 'field' }, h('label', { for: 'pw1' }, 'New password'), next, h('p', { class: 'hint' }, 'At least 8 characters.')),
      slot, h('button', { class: 'btn', type: 'submit' }, 'Change password')));
}
